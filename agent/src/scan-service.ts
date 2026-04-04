// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Persistent Scan Service
// Standalone process: listens for PairCreated events on BSC,
// scans tokens, submits results to AegisScanner oracle on-chain.
// Usage: npx ts-node src/scan-service.ts
// ═══════════════════════════════════════════════════════════════

import * as dotenv from "dotenv";
import { ethers } from "ethers";
import * as http from "http";

dotenv.config({ path: "../.env" });

// ─── Configuration ────────────────────────────────────────────

const CONFIG = {
  rpcUrl: process.env.BSC_RPC || "https://bsc-testnet-rpc.publicnode.com",
  privateKey: process.env.PRIVATE_KEY || "",
  scannerAddress: process.env.SCANNER_ADDRESS || "",
  registryAddress: process.env.REGISTRY_ADDRESS || "",
  loggerAddress: process.env.LOGGER_ADDRESS || "",
  agentId: parseInt(process.env.AGENT_ID || "0"),
  pollInterval: parseInt(process.env.POLL_INTERVAL || "15000"),
  dryRun: process.env.DRY_RUN === "true",
  // PancakeSwap V2 Factory — BSC Testnet
  factoryAddress: process.env.PANCAKE_FACTORY || "0xB7926C0430Afb07AA7DEfDE6DA862aE0Bde767bc",
  // HTTP port for manual scan requests from frontend
  httpPort: parseInt(process.env.SCAN_SERVICE_PORT || "3001"),
  // How many blocks to look back on startup for recent PairCreated events
  lookbackBlocks: parseInt(process.env.LOOKBACK_BLOCKS || "5000"),
};

// BSC Testnet RPC fallbacks
const RPC_FALLBACKS = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://data-seed-prebsc-1-s1.binance.org:8545",
  "https://data-seed-prebsc-2-s1.binance.org:8545",
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

async function queryGoPlus(token: string, chainId: number = 97): Promise<GoPlusResult | null> {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await fetch(
        `https://api.gopluslabs.com/api/v1/token_security/${chainId}?contract_addresses=${token}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (resp.status === 429) {
        // Rate limited — exponential backoff
        const wait = Math.pow(2, attempt + 1) * 1000;
        console.warn(`[GoPlus] Rate limited, retrying in ${wait / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!resp.ok) {
        if (attempt < maxRetries - 1) {
          const wait = Math.pow(2, attempt) * 1000;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        return null;
      }
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
    } catch (err: any) {
      if (attempt < maxRetries - 1) {
        const wait = Math.pow(2, attempt) * 1000;
        console.warn(`[GoPlus] Request failed (attempt ${attempt + 1}/${maxRetries}): ${err.message}`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      return null;
    }
  }
  return null;
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
  private emptyPollCount = 0;
  private lowActivityWarned = false;
  private httpServer: http.Server | null = null;

  private stats = {
    startedAt: Date.now(),
    pairsDetected: 0,
    scansSubmitted: 0,
    scansFailed: 0,
    honeypotsFound: 0,
    rpcFailures: 0,
    tickCount: 0,
    manualScans: 0,
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

    // Look back to catch recent historical PairCreated events
    const currentBlock = await this.provider.getBlockNumber();
    this.lastBlock = Math.max(0, currentBlock - CONFIG.lookbackBlocks);

    console.log(`\n[ScanService] Current block: ${currentBlock}`);
    console.log(`[ScanService] Looking back ${CONFIG.lookbackBlocks} blocks from ${this.lastBlock}`);
    console.log(`[ScanService] Polling every ${CONFIG.pollInterval / 1000}s`);

    // Start HTTP server for manual scan requests
    this.startHttpServer();

    // Fast historical catch-up with larger block ranges
    console.log(`[ScanService] Scanning historical blocks ${this.lastBlock}..${currentBlock}...`);
    await this.catchUpHistory(currentBlock);

    console.log("");

    while (this.isRunning) {
      try {
        this.stats.tickCount++;
        await this.tick();
      } catch (err: any) {
        console.error(`[ScanService] Tick error: ${err.message}`);
        await this.handleRpcFailure();
      }
      await this.sleep(CONFIG.pollInterval);
    }
  }

  stop(): void {
    this.isRunning = false;
    if (this.httpServer) {
      this.httpServer.close();
      console.log("[ScanService] HTTP server closed");
    }
    console.log("[ScanService] Stopping...");
    this.printStats();
  }

  // ─── Historical Catch-Up ─────────────────────────────────

  private async catchUpHistory(currentBlock: number): Promise<void> {
    const BATCH_SIZE = 1000; // larger range for historical catch-up
    let from = this.lastBlock + 1;

    while (from <= currentBlock && this.isRunning) {
      const to = Math.min(currentBlock, from + BATCH_SIZE - 1);
      try {
        const filter = this.factory.filters.PairCreated();
        const events = await this.factory.queryFilter(filter, from, to);
        if (events.length > 0) {
          console.log(`[CatchUp] Found ${events.length} PairCreated events in blocks ${from}-${to}`);
          for (const event of events) {
            const log = event as ethers.EventLog;
            const token0 = (log.args[0] as string).toLowerCase();
            const token1 = (log.args[1] as string).toLowerCase();
            const pair = log.args[2] as string;
            console.log(`[PairCreated] token0=${token0.slice(0, 10)}... token1=${token1.slice(0, 10)}... pair=${pair.slice(0, 10)}... block=${log.blockNumber}`);
            this.stats.pairsDetected++;
            if (!BASE_TOKENS.has(token0) && !this.scannedTokens.has(token0)) {
              await this.scanAndSubmit(token0);
            }
            if (!BASE_TOKENS.has(token1) && !this.scannedTokens.has(token1)) {
              await this.scanAndSubmit(token1);
            }
          }
        }
      } catch (err: any) {
        console.warn(`[CatchUp] Error scanning blocks ${from}-${to}: ${err.message?.slice(0, 80)}`);
        await this.sleep(3000);
        // Don't advance — retry same range on next iteration
        continue;
      }
      from = to + 1;
      // Small delay between batches to avoid rate limiting
      if (from <= currentBlock) await this.sleep(500);
    }
    this.lastBlock = currentBlock;
    console.log(`[CatchUp] Historical scan complete. Now at block ${this.lastBlock}`);
  }

  // ─── Main Tick ──────────────────────────────────────────────

  private async tick(): Promise<void> {
    const currentBlock = await this.provider.getBlockNumber();
    if (currentBlock <= this.lastBlock) return;

    const fromBlock = this.lastBlock + 1;
    const toBlock = Math.min(currentBlock, fromBlock + 50); // conservative cap for public RPCs

    try {
      const filter = this.factory.filters.PairCreated();
      const events = await this.factory.queryFilter(filter, fromBlock, toBlock);

      if (events.length === 0) {
        this.emptyPollCount++;
        if (this.emptyPollCount >= 5 && !this.lowActivityWarned) {
          this.lowActivityWarned = true;
          console.warn(`\n⚠ [ScanService] No PairCreated events detected in ${this.emptyPollCount} polling intervals.`);
          console.warn(`  Liquidity activity may be low on BSC Testnet.`);
          console.warn(`  Manual scans can be submitted via POST http://localhost:${CONFIG.httpPort}/scan`);
          console.warn(`  The service will continue polling.\n`);
        }
      } else {
        this.emptyPollCount = 0;
        this.lowActivityWarned = false;
      }

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
      if (err.message?.includes("rate") || err.message?.includes("limit") || err.message?.includes("429") || err.code === "SERVER_ERROR") {
        console.warn(`[ScanService] RPC rate limited (${err.message?.slice(0, 80)}), backing off...`);
        await this.sleep(5000);
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

  // ─── Manual Scan (from HTTP endpoint) ───────────────────────

  async scanManual(token: string): Promise<{ success: boolean; message: string; riskScore?: number }> {
    const addr = token.toLowerCase().trim();

    if (!ethers.isAddress(addr)) {
      return { success: false, message: "Invalid address" };
    }

    // Check if already scanned on-chain
    try {
      const alreadyScanned = await this.scanner.isScanned(addr);
      if (alreadyScanned) {
        this.scannedTokens.add(addr);
        return { success: true, message: "Already scanned on-chain" };
      }
    } catch {
      // Continue — submit regardless
    }

    if (this.scannedTokens.has(addr)) {
      return { success: true, message: "Already scanned this session" };
    }

    console.log(`[ManualScan] Triggered for ${addr}`);
    this.stats.manualScans++;

    try {
      await this.scanAndSubmit(addr);
      return { success: true, message: "Scan submitted to oracle", riskScore: undefined };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  // ─── HTTP Server for Manual Scans ───────────────────────────

  private startHttpServer(): void {
    this.httpServer = http.createServer(async (req, res) => {
      // CORS headers for frontend
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === "POST" && req.url === "/scan") {
        let body = "";
        req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        req.on("end", async () => {
          try {
            const { token } = JSON.parse(body);
            if (!token || typeof token !== "string") {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: false, message: "Missing token address" }));
              return;
            }
            const result = await this.scanManual(token);
            res.writeHead(result.success ? 200 : 500, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, message: "Invalid JSON body" }));
          }
        });
        return;
      }

      if (req.method === "GET" && req.url === "/status") {
        const uptime = Math.round((Date.now() - this.stats.startedAt) / 1000);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          running: this.isRunning,
          uptime,
          ...this.stats,
          tokensTracked: this.scannedTokens.size,
          lastBlock: this.lastBlock,
          factory: CONFIG.factoryAddress,
        }));
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    this.httpServer.listen(CONFIG.httpPort, () => {
      console.log(`[ScanService] HTTP server listening on port ${CONFIG.httpPort}`);
      console.log(`  POST /scan  {"token":"0x..."} — trigger manual scan`);
      console.log(`  GET  /status                  — service status`);
    });
  }

  // ─── RPC Fallback ───────────────────────────────────────────

  private async handleRpcFailure(): Promise<void> {
    this.stats.rpcFailures++;
    this.rpcIndex = (this.rpcIndex + 1) % RPC_FALLBACKS.length;
    const newRpc = RPC_FALLBACKS[this.rpcIndex];
    console.warn(`[ScanService] RPC failure #${this.stats.rpcFailures} — switching to ${newRpc}`);

    try {
      this.provider = new ethers.JsonRpcProvider(newRpc);
      // Validate new provider is reachable
      await this.provider.getBlockNumber();
      this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
      this.factory = new ethers.Contract(CONFIG.factoryAddress, FACTORY_ABI, this.provider);
      this.scanner = new ethers.Contract(CONFIG.scannerAddress, SCANNER_ABI, this.wallet);
      if (CONFIG.loggerAddress && ethers.isAddress(CONFIG.loggerAddress)) {
        this.logger = new ethers.Contract(CONFIG.loggerAddress, LOGGER_ABI, this.wallet);
      }
      console.log(`[ScanService] Successfully switched to ${newRpc}`);
    } catch {
      // Current fallback also failed — try next one
      console.warn(`[ScanService] Fallback ${newRpc} unreachable, trying next...`);
      this.rpcIndex = (this.rpcIndex + 1) % RPC_FALLBACKS.length;
      const nextRpc = RPC_FALLBACKS[this.rpcIndex];
      this.provider = new ethers.JsonRpcProvider(nextRpc);
      this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
      this.factory = new ethers.Contract(CONFIG.factoryAddress, FACTORY_ABI, this.provider);
      this.scanner = new ethers.Contract(CONFIG.scannerAddress, SCANNER_ABI, this.wallet);
      if (CONFIG.loggerAddress && ethers.isAddress(CONFIG.loggerAddress)) {
        this.logger = new ethers.Contract(CONFIG.loggerAddress, LOGGER_ABI, this.wallet);
      }
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

    // Chain ID — must be BSC Testnet (97)
    const network = await this.provider.getNetwork();
    console.log(`[ScanService] Chain ID: ${network.chainId}`);
    if (Number(network.chainId) !== 97) {
      throw new Error(`Expected BSC Testnet (chain 97) but connected to chain ${network.chainId}`);
    }

    // Verify factory contract exists
    const factoryCode = await this.provider.getCode(CONFIG.factoryAddress);
    if (factoryCode.length <= 2) {
      throw new Error(`Factory contract not found at ${CONFIG.factoryAddress} — wrong address?`);
    }
    console.log(`[ScanService] Factory: ${CONFIG.factoryAddress} (verified on-chain)`);

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
    console.log(`  Manual scans:    ${this.stats.manualScans}`);
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
