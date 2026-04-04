// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Persistent Scan Service
// Standalone process: listens for PairCreated events on BSC,
// scans tokens, submits results to AegisScanner oracle on-chain.
// Usage: npx ts-node src/scan-service.ts
// ═══════════════════════════════════════════════════════════════

import * as dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config({ path: "../.env" });

// ─── Configuration ────────────────────────────────────────────

const CONFIG = {
  rpcUrl: process.env.BSC_RPC || "https://data-seed-prebsc-1-s1.binance.org:8545",
  privateKey: process.env.PRIVATE_KEY || "",
  scannerAddress: process.env.SCANNER_ADDRESS || "",
  registryAddress: process.env.REGISTRY_ADDRESS || "",
  loggerAddress: process.env.LOGGER_ADDRESS || "",
  agentId: parseInt(process.env.AGENT_ID || "0"),
  pollInterval: parseInt(process.env.POLL_INTERVAL || "30000"),
  dryRun: process.env.DRY_RUN === "true",
  // Manual token to scan on startup (skip event listening)
  manualToken: process.env.SCAN_TOKEN || "",
  // PancakeSwap Factory — BSC Testnet has limited activity,
  // so also accept a manual factory override
  factoryAddress: process.env.PANCAKE_FACTORY || "0x6725F303b657a9451d8BA641348b6761A6CC7a17",
};

// BSC Testnet RPC fallbacks
const RPC_FALLBACKS = [
  "https://data-seed-prebsc-1-s1.binance.org:8545",
  "https://data-seed-prebsc-2-s1.binance.org:8545",
  "https://bsc-testnet-rpc.publicnode.com",
];

// Well-known base tokens on BSC Testnet (don't scan these)
const BASE_TOKENS = new Set([
  "0xae13d989dac2f0debff460ac112a837c89baa7cd", // WBNB Testnet
  "0xed24fc36d5ee211ea25a80239fb8c4cfd80f12ee", // BUSD Testnet
  "0x337610d27c682e347c9cd60bd4b3b107c9d34ddd", // USDT Testnet
  // BSC Mainnet base tokens (in case factory is pointed at mainnet)
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WBNB
  "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
  "0x55d398326f99059ff775485246999027b3197955", // USDT
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
]);

const FACTORY_ABI = [
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)",
  "function allPairsLength() view returns (uint)",
];

// AegisScanner ABI — use explicit signature to avoid overload ambiguity
const SCANNER_ABI = [
  "function submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32) external",
  "function isScanned(address) view returns (bool)",
  "function getScannerStats() view returns (uint256,uint256,uint256,uint256)",
  "function getTokenScan(address) view returns (tuple(address,uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,bool,bool,bool,bool,bool,uint256,address,string,bytes32,uint256))",
];

const LOGGER_ABI = [
  "function logDecision(uint256 agentId, address targetUser, uint8 decisionType, uint8 riskLevel, uint256 confidence, bytes32 analysisHash, bytes32 dataHash, bool actionTaken, uint256 actionId) external",
];

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function owner() view returns (address)",
];

// ─── GoPlusLabs API ───────────────────────────────────────────

interface GoPlusResult {
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  isOpenSource: boolean;
  holderCount: number;
  ownerCanChangeBalance: boolean;
  hiddenOwner: boolean;
  canTakeBackOwnership: boolean;
}

async function queryGoPlus(token: string, chainId: number = 56): Promise<GoPlusResult | null> {
  try {
    const resp = await fetch(
      `https://api.gopluslabs.com/api/v1/token_security/${chainId}?contract_addresses=${token}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!resp.ok) return null;
    const json = (await resp.json()) as any;
    const data = json?.result?.[token.toLowerCase()];
    if (!data) return null;
    return {
      isHoneypot: data.is_honeypot === "1",
      buyTax: parseFloat(data.buy_tax || "0") * 100,
      sellTax: parseFloat(data.sell_tax || "0") * 100,
      isOpenSource: data.is_open_source === "1",
      holderCount: parseInt(data.holder_count || "0"),
      ownerCanChangeBalance: data.owner_change_balance === "1",
      hiddenOwner: data.hidden_owner === "1",
      canTakeBackOwnership: data.can_take_back_ownership === "1",
    };
  } catch {
    return null;
  }
}

// ─── Scan Service Class ───────────────────────────────────────

class ScanService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private factory: ethers.Contract;
  private scanner: ethers.Contract;
  private logger: ethers.Contract | null = null;

  private isRunning = false;
  private lastBlock = 0;
  private rpcIndex = 0;
  private scannedTokens = new Set<string>();
  private consecutiveRateLimits = 0;
  private backoffMs = 5000;

  private stats = {
    startedAt: Date.now(),
    pairsDetected: 0,
    scansSubmitted: 0,
    scansFailed: 0,
    honeypotsFound: 0,
    rpcFailures: 0,
    tickCount: 0,
  };

  constructor() {
    this.provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
    this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
    this.factory = new ethers.Contract(CONFIG.factoryAddress, FACTORY_ABI, this.provider);
    this.scanner = new ethers.Contract(CONFIG.scannerAddress, SCANNER_ABI, this.wallet);

    if (CONFIG.loggerAddress && ethers.isAddress(CONFIG.loggerAddress)) {
      this.logger = new ethers.Contract(CONFIG.loggerAddress, LOGGER_ABI, this.wallet);
    }
  }

  async start(): Promise<void> {
    this.printBanner();
    await this.validate();

    this.isRunning = true;

    // Manual token scan mode — scan a specific token and exit
    if (CONFIG.manualToken && ethers.isAddress(CONFIG.manualToken)) {
      console.log(`\n[ScanService] Manual scan mode: ${CONFIG.manualToken}`);
      await this.scanAndSubmit(CONFIG.manualToken.toLowerCase());
      this.printStats();
      return;
    }

    this.lastBlock = await this.provider.getBlockNumber();

    console.log(`\n[ScanService] Listening from block ${this.lastBlock}`);
    console.log(`[ScanService] Polling every ${CONFIG.pollInterval / 1000}s\n`);

    while (this.isRunning) {
      try {
        this.stats.tickCount++;
        await this.tick();
        // Reset backoff on successful tick
        this.consecutiveRateLimits = 0;
        this.backoffMs = 5000;
      } catch (err: any) {
        console.error(`[ScanService] Tick error: ${err.message}`);
        await this.handleRpcFailure();
      }
      await this.sleep(CONFIG.pollInterval);
    }
  }

  stop(): void {
    this.isRunning = false;
    console.log("[ScanService] Stopping...");
    this.printStats();
  }

  // ─── Main Tick ──────────────────────────────────────────────

  private async tick(): Promise<void> {
    const currentBlock = await this.provider.getBlockNumber();
    if (currentBlock <= this.lastBlock) return;

    const fromBlock = this.lastBlock + 1;
    const toBlock = Math.min(currentBlock, fromBlock + 100); // conservative cap

    try {
      const filter = this.factory.filters.PairCreated();
      const events = await this.factory.queryFilter(filter, fromBlock, toBlock);

      for (const event of events) {
        const log = event as ethers.EventLog;
        const token0 = (log.args[0] as string).toLowerCase();
        const token1 = (log.args[1] as string).toLowerCase();
        const pair = log.args[2] as string;

        console.log(`[PairCreated] token0=${token0.slice(0, 10)}... token1=${token1.slice(0, 10)}... pair=${pair.slice(0, 10)}... block=${log.blockNumber}`);
        this.stats.pairsDetected++;

        // Identify the non-base token(s)
        if (!BASE_TOKENS.has(token0) && !this.scannedTokens.has(token0)) {
          await this.scanAndSubmit(token0);
        }
        if (!BASE_TOKENS.has(token1) && !this.scannedTokens.has(token1)) {
          await this.scanAndSubmit(token1);
        }
      }
    } catch (err: any) {
      const msg = err.message?.toLowerCase() || "";
      if (msg.includes("rate") || msg.includes("limit") || msg.includes("429") || msg.includes("too many") || msg.includes("exceeded")) {
        this.consecutiveRateLimits++;
        this.backoffMs = Math.min(this.backoffMs * 1.5, 120000);
        console.warn(`[ScanService] Rate limited (${this.consecutiveRateLimits}x), backing off ${Math.round(this.backoffMs / 1000)}s...`);
        await this.sleep(this.backoffMs);
        // Rotate RPC after 3 consecutive rate limits
        if (this.consecutiveRateLimits >= 3) {
          await this.handleRpcFailure();
          this.consecutiveRateLimits = 0;
        }
      } else {
        throw err;
      }
    }

    this.lastBlock = toBlock;

    // Print status every 20 ticks
    if (this.stats.tickCount % 20 === 0) {
      this.printStats();
    }
  }

  // ─── Scan & Submit Pipeline ─────────────────────────────────

  private async scanAndSubmit(token: string): Promise<void> {
    // Duplicate guard
    if (this.scannedTokens.has(token)) {
      console.log(`[ScanService] Skip duplicate: ${token.slice(0, 10)}...`);
      return;
    }

    // On-chain duplicate check
    try {
      const alreadyScanned = await this.scanner.isScanned(token);
      if (alreadyScanned) {
        this.scannedTokens.add(token);
        console.log(`[ScanService] Already on-chain: ${token.slice(0, 10)}...`);
        return;
      }
    } catch {
      // continue if RPC fails — submit anyway
    }

    console.log(`[ScanService] Scanning ${token}...`);
    const startMs = Date.now();

    try {
      // Step 1: Basic token info
      const basics = await this.getTokenBasics(token);

      // Step 2: GoPlus security check 
      const goplus = await queryGoPlus(token, 97); // 97 = BSC Testnet

      // Step 3: Build risk assessment
      const { riskScore, flags, boolFlags } = this.assessRisk(basics, goplus);

      // Build reasoning for hash
      const reasoning = [
        `Token: ${basics.symbol} (${token})`,
        `Score: ${riskScore}/100`,
        `Honeypot: ${boolFlags[0]}`,
        `Buy Tax: ${goplus?.buyTax.toFixed(1) || "0"}% | Sell Tax: ${goplus?.sellTax.toFixed(1) || "0"}%`,
        `Holders: ${goplus?.holderCount || 0}`,
        `Flags: ${flags.join(", ") || "none"}`,
        `Scan: ${new Date().toISOString()}`,
      ].join("\n");

      const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes(reasoning));
      const elapsed = Date.now() - startMs;

      // Step 4: Submit on-chain
      if (CONFIG.dryRun) {
        console.log(`[ScanService] DRY RUN — ${basics.symbol} score=${riskScore} [${elapsed}ms]`);
      } else {
        const buyTaxBps = Math.round((goplus?.buyTax || 0) * 100);
        const sellTaxBps = Math.round((goplus?.sellTax || 0) * 100);

        const tx = await this.scanner["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
          token,
          riskScore,
          0, // liquidity (USD wei) — GoPlus doesn't provide on testnet
          goplus?.holderCount || 0,
          0, // topHolderPercent bps
          buyTaxBps,
          sellTaxBps,
          boolFlags,
          flags.join(","),
          reasoningHash
        );
        const receipt = await tx.wait();
        console.log(`[ScanService] ✓ ${basics.symbol} score=${riskScore} flags=[${flags.join(",")}] tx=${receipt.hash.slice(0, 16)}... [${elapsed}ms]`);

        // Log to DecisionLogger if available
        if (this.logger) {
          try {
            const logTx = await this.logger.logDecision(
              CONFIG.agentId,
              token,           // targetUser = token address
              0,               // RiskAssessment
              riskScore >= 70 ? 4 : riskScore >= 40 ? 3 : riskScore >= 20 ? 2 : 1, // riskLevel
              Math.min(riskScore > 0 ? 8500 : 5000, 10000), // confidence
              reasoningHash,
              ethers.keccak256(ethers.toUtf8Bytes(token)), // dataHash
              true,            // actionTaken
              0                // actionId
            );
            await logTx.wait();
          } catch {
            // Non-critical — don't fail the scan
          }
        }
      }

      this.scannedTokens.add(token);
      this.stats.scansSubmitted++;
      if (boolFlags[0]) this.stats.honeypotsFound++;

    } catch (err: any) {
      this.stats.scansFailed++;
      console.error(`[ScanService] ✗ ${token.slice(0, 10)}... — ${err.message}`);
    }
  }

  // ─── Token Analysis ─────────────────────────────────────────

  private async getTokenBasics(token: string): Promise<{ name: string; symbol: string; decimals: number }> {
    try {
      const contract = new ethers.Contract(token, ERC20_ABI, this.provider);
      const [name, symbol, decimals] = await Promise.allSettled([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
      ]);
      return {
        name: name.status === "fulfilled" ? name.value : "Unknown",
        symbol: symbol.status === "fulfilled" ? symbol.value : "???",
        decimals: decimals.status === "fulfilled" ? Number(decimals.value) : 18,
      };
    } catch {
      return { name: "Unknown", symbol: "???", decimals: 18 };
    }
  }

  private assessRisk(
    basics: { name: string; symbol: string },
    goplus: GoPlusResult | null
  ): { riskScore: number; flags: string[]; boolFlags: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] } {
    let score = 30; // baseline risk for unaudited token
    const flags: string[] = [];

    if (goplus) {
      if (goplus.isHoneypot) {
        score = 100;
        flags.push("HONEYPOT");
      }
      if (goplus.buyTax > 10) {
        score = Math.min(100, score + 20);
        flags.push("HIGH_TAX");
      }
      if (goplus.sellTax > 10) {
        score = Math.min(100, score + 20);
        flags.push("HIGH_SELL_TAX");
      }
      if (!goplus.isOpenSource) {
        score = Math.min(100, score + 15);
        flags.push("UNVERIFIED");
      }
      if (goplus.ownerCanChangeBalance) {
        score = Math.min(100, score + 25);
        flags.push("OWNER_CHANGE_BALANCE");
      }
      if (goplus.hiddenOwner) {
        score = Math.min(100, score + 10);
        flags.push("HIDDEN_OWNER");
      }
      if (goplus.canTakeBackOwnership) {
        score = Math.min(100, score + 15);
        flags.push("TAKEBACK_OWNERSHIP");
      }
      // If GoPlus confirms clean, lower score
      if (!goplus.isHoneypot && goplus.isOpenSource && goplus.buyTax < 5 && goplus.sellTax < 5
          && !goplus.ownerCanChangeBalance && !goplus.hiddenOwner) {
        score = Math.max(0, score - 20);
      }
    } else {
      // No GoPlus data — mark as incomplete
      flags.push("PARTIAL_SCAN");
      score = Math.min(100, score + 10);
    }

    const boolFlags: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] = [
      goplus?.isHoneypot || false,  // honeypot
      false,                         // canMint (unknown without bytecode)
      false,                         // canPause
      false,                         // canBlacklist
      false,                         // renounced (unknown)
      false,                         // lpLocked (unknown)
      goplus?.isOpenSource || false,  // verified
    ];

    return { riskScore: Math.min(100, Math.max(0, score)), flags, boolFlags };
  }

  // ─── RPC Fallback ───────────────────────────────────────────

  private async handleRpcFailure(): Promise<void> {
    this.stats.rpcFailures++;
    this.rpcIndex = (this.rpcIndex + 1) % RPC_FALLBACKS.length;
    const newRpc = RPC_FALLBACKS[this.rpcIndex];
    console.warn(`[ScanService] Switching RPC to ${newRpc}`);

    this.provider = new ethers.JsonRpcProvider(newRpc);
    this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
    this.factory = new ethers.Contract(CONFIG.factoryAddress, FACTORY_ABI, this.provider);
    this.scanner = new ethers.Contract(CONFIG.scannerAddress, SCANNER_ABI, this.wallet);
    if (CONFIG.loggerAddress && ethers.isAddress(CONFIG.loggerAddress)) {
      this.logger = new ethers.Contract(CONFIG.loggerAddress, LOGGER_ABI, this.wallet);
    }

    await this.sleep(3000);
  }

  // ─── Validation ─────────────────────────────────────────────

  private async validate(): Promise<void> {
    // Private key
    if (!CONFIG.privateKey || !/^[0-9a-fA-F]{64}$/.test(CONFIG.privateKey)) {
      throw new Error("PRIVATE_KEY must be a 64-char hex string in .env");
    }
    // Scanner address
    if (!CONFIG.scannerAddress || !ethers.isAddress(CONFIG.scannerAddress)) {
      throw new Error("SCANNER_ADDRESS must be a valid address in .env");
    }

    // Chain ID
    const network = await this.provider.getNetwork();
    console.log(`[ScanService] Chain ID: ${network.chainId}`);

    // Balance
    const balance = await this.provider.getBalance(this.wallet.address);
    console.log(`[ScanService] Wallet: ${this.wallet.address}`);
    console.log(`[ScanService] Balance: ${ethers.formatEther(balance)} BNB`);
    if (balance < ethers.parseEther("0.01")) {
      throw new Error("Insufficient balance — need >0.01 BNB for gas");
    }

    // Scanner contract exists
    const code = await this.provider.getCode(CONFIG.scannerAddress);
    if (code.length <= 2) {
      throw new Error(`Scanner contract not found at ${CONFIG.scannerAddress}`);
    }
    console.log(`[ScanService] Scanner: ${CONFIG.scannerAddress} (verified)`);

    // Check scanner stats
    const stats = await this.scanner.getScannerStats();
    console.log(`[ScanService] Oracle stats: scans=${stats[0]}, tokens=${stats[3]}`);
  }

  // ─── Output ─────────────────────────────────────────────────

  private printBanner(): void {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          AEGIS SCAN SERVICE — Security Oracle Agent           ║
║                                                               ║
║  Monitors PairCreated → Scans tokens → Submits to Oracle      ║
╚═══════════════════════════════════════════════════════════════╝
`);
    console.log(`  Mode:     ${CONFIG.dryRun ? "DRY RUN" : "LIVE"}`);
    console.log(`  Scanner:  ${CONFIG.scannerAddress || "NOT SET"}`);
    console.log(`  Factory:  ${CONFIG.factoryAddress}`);
    console.log(`  Interval: ${CONFIG.pollInterval / 1000}s`);
  }

  private printStats(): void {
    const uptime = Math.round((Date.now() - this.stats.startedAt) / 1000);
    console.log(`\n[ScanService] ── Stats (uptime ${uptime}s) ──`);
    console.log(`  Pairs detected:  ${this.stats.pairsDetected}`);
    console.log(`  Scans submitted: ${this.stats.scansSubmitted}`);
    console.log(`  Scans failed:    ${this.stats.scansFailed}`);
    console.log(`  Honeypots found: ${this.stats.honeypotsFound}`);
    console.log(`  RPC failures:    ${this.stats.rpcFailures}`);
    console.log(`  Tokens tracked:  ${this.scannedTokens.size}`);
    console.log(`  Ticks:           ${this.stats.tickCount}\n`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

// ─── Entry Point ──────────────────────────────────────────────

const service = new ScanService();

// Graceful shutdown
process.on("SIGINT", () => service.stop());
process.on("SIGTERM", () => service.stop());

service.start().catch((err) => {
  console.error(`\n❌ Fatal: ${err.message}`);
  process.exit(1);
});
