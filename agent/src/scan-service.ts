// ═══════════════════════════════════════════════════════════════
// Aegis — Token Safety Scanner Service
// On-chain analysis engine: reads bytecode, checks owner status,
// detects honeypot patterns, submits real risk scores to oracle.
// Usage: npx ts-node src/scan-service.ts
// ═══════════════════════════════════════════════════════════════

import * as dotenv from "dotenv";
import { ethers } from "ethers";
import * as http from "http";

dotenv.config({ path: "../.env" });

// ─── Configuration ────────────────────────────────────────────

const CONFIG = {
  // Testnet: where our oracle contract lives (writes go here)
  testnetRpc: process.env.BSC_RPC || "https://bsc-testnet-rpc.publicnode.com",
  // Mainnet: where real tokens live (reads/analysis happen here)
  mainnetRpc: process.env.BSC_MAINNET_RPC || "https://bsc-dataseed1.binance.org",
  privateKey: process.env.PRIVATE_KEY || "",
  scannerAddress: process.env.SCANNER_ADDRESS || "",
  registryAddress: process.env.REGISTRY_ADDRESS || "",
  loggerAddress: process.env.LOGGER_ADDRESS || "",
  agentId: parseInt(process.env.AGENT_ID || "0"),
  pollInterval: parseInt(process.env.POLL_INTERVAL || "15000"),
  dryRun: process.env.DRY_RUN === "true",
  // Mainnet PancakeSwap Factory for auto-scan
  factoryAddress: process.env.PANCAKE_FACTORY || "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
  httpPort: parseInt(process.env.SCAN_SERVICE_PORT || "3001"),
  lookbackBlocks: parseInt(process.env.LOOKBACK_BLOCKS || "200"),
};

// BSC Mainnet RPC fallbacks (for reading token data)
const MAINNET_RPC_FALLBACKS = [
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed2.binance.org",
  "https://bsc-dataseed3.binance.org",
  "https://bsc-rpc.publicnode.com",
];

// BSC Testnet RPC fallbacks (for oracle writes)
const TESTNET_RPC_FALLBACKS = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://data-seed-prebsc-1-s1.binance.org:8545",
  "https://data-seed-prebsc-2-s1.binance.org:8545",
];

// Well-known base tokens on BSC Mainnet (don't scan these — they're infrastructure)
const BASE_TOKENS = new Set([
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WBNB
  "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
  "0x55d398326f99059ff775485246999027b3197955", // USDT
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
  "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // ETH
  "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3", // DAI
]);

const FACTORY_ABI = [
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)",
  "function allPairsLength() view returns (uint)",
];

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
  "function balanceOf(address) view returns (uint256)",
];

// ─── Known function selectors for bytecode analysis ──────────

const BYTECODE_SELECTORS: Record<string, string> = {
  pause: "8456cb59",
  unpause: "3f4ba83a",
  mint: "40c10f19",
  burn: "42966c68",
  blacklist: "f9f92be4",
  addToBlacklist: "44337ea1",
  isBlacklisted: "fe575a87",
  owner: "8da5cb5b",
  renounceOwnership: "715018a6",
  transferOwnership: "f2fde38b",
  setFee: "69fe0e2d",
  setTaxFee: "8ee88c53",
  excludeFromFee: "437823ec",
  selfdestruct: "ff",  // SELFDESTRUCT opcode
};

// ─── On-Chain Token Analysis ─────────────────────────────────

interface OnChainAnalysis {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;    // raw wei string
  totalSupplyFormatted: number;
  bytecodeLength: number;
  isContract: boolean;
  hasOwner: boolean;
  ownerAddress: string;
  isRenounced: boolean;   // owner is address(0)
  // Bytecode capability detection
  canPause: boolean;
  canMint: boolean;
  canBlacklist: boolean;
  canBurn: boolean;
  hasRenounceFunction: boolean;
  hasFeeFunction: boolean;
  hasSelfDestruct: boolean;
  // Balance analysis
  ownerBalancePercent: number;  // owner's % of totalSupply
  // GoPlus data (optional)
  goplus: GoPlusResult | null;
}

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

async function analyzeTokenOnChain(token: string, provider: ethers.JsonRpcProvider): Promise<OnChainAnalysis> {
  const analysis: OnChainAnalysis = {
    name: "Unknown", symbol: "???", decimals: 18, totalSupply: "0", totalSupplyFormatted: 0,
    bytecodeLength: 0, isContract: false,
    hasOwner: false, ownerAddress: ethers.ZeroAddress, isRenounced: false,
    canPause: false, canMint: false, canBlacklist: false, canBurn: false,
    hasRenounceFunction: false, hasFeeFunction: false, hasSelfDestruct: false,
    ownerBalancePercent: 0, goplus: null,
  };

  // Step 1: Check bytecode exists
  const code = await provider.getCode(token);
  analysis.bytecodeLength = code.length;
  analysis.isContract = code.length > 2;
  if (!analysis.isContract) return analysis;

  // Step 1b: Detect EIP-1167 minimal proxy and resolve implementation
  let codeForAnalysis = code;
  if (code.startsWith("0x363d3d373d3d3d363d73") && code.length <= 92) {
    // EIP-1167 clone — extract implementation address
    const implAddress = "0x" + code.slice(22, 62);
    console.log(`[Analysis] EIP-1167 proxy detected → implementation: ${implAddress}`);
    try {
      const implCode = await provider.getCode(implAddress);
      if (implCode.length > 2) {
        codeForAnalysis = implCode;
        analysis.bytecodeLength = implCode.length; // Use implementation size
      }
    } catch {
      // Fall back to proxy bytecode
    }
  }

  // Step 2: Scan bytecode for known function selectors
  const codeLower = codeForAnalysis.toLowerCase();
  analysis.canPause = codeLower.includes(BYTECODE_SELECTORS.pause);
  analysis.canMint = codeLower.includes(BYTECODE_SELECTORS.mint);
  analysis.canBlacklist = codeLower.includes(BYTECODE_SELECTORS.blacklist) || codeLower.includes(BYTECODE_SELECTORS.addToBlacklist);
  analysis.canBurn = codeLower.includes(BYTECODE_SELECTORS.burn);
  analysis.hasRenounceFunction = codeLower.includes(BYTECODE_SELECTORS.renounceOwnership);
  analysis.hasFeeFunction = codeLower.includes(BYTECODE_SELECTORS.setFee) || codeLower.includes(BYTECODE_SELECTORS.setTaxFee) || codeLower.includes(BYTECODE_SELECTORS.excludeFromFee);
  // Check for SELFDESTRUCT opcode — only flag if bytecode is very short (proxy-like)
  analysis.hasSelfDestruct = false; // Can't reliably detect from bytecode alone

  // Step 3: Read ERC20 metadata + owner
  const contract = new ethers.Contract(token, ERC20_ABI, provider);
  const results = await Promise.allSettled([
    contract.name(),
    contract.symbol(),
    contract.decimals(),
    contract.totalSupply(),
    contract.owner(),
  ]);

  if (results[0].status === "fulfilled") analysis.name = results[0].value;
  if (results[1].status === "fulfilled") analysis.symbol = results[1].value;
  if (results[2].status === "fulfilled") analysis.decimals = Number(results[2].value);
  if (results[3].status === "fulfilled") {
    analysis.totalSupply = results[3].value.toString();
    analysis.totalSupplyFormatted = parseFloat(ethers.formatUnits(results[3].value, analysis.decimals));
  }
  if (results[4].status === "fulfilled") {
    analysis.hasOwner = true;
    analysis.ownerAddress = results[4].value;
    analysis.isRenounced = results[4].value === ethers.ZeroAddress;
  }

  // Step 4: Check owner's share of supply
  if (analysis.hasOwner && !analysis.isRenounced && analysis.totalSupplyFormatted > 0) {
    try {
      const ownerBal = await contract.balanceOf(analysis.ownerAddress);
      const ownerAmount = parseFloat(ethers.formatUnits(ownerBal, analysis.decimals));
      analysis.ownerBalancePercent = Math.round((ownerAmount / analysis.totalSupplyFormatted) * 10000); // bps
    } catch {
      // balanceOf not available or failed
    }
  }

  // Step 5: Try GoPlus as optional bonus data (non-blocking)
  try {
    analysis.goplus = await queryGoPlus(token, 56); // BSC Mainnet
  } catch {
    // GoPlus unavailable — that's fine, on-chain analysis is primary
  }

  return analysis;
}

// ─── GoPlus API (optional, best-effort) ──────────────────────

async function queryGoPlus(token: string, chainId: number = 97): Promise<GoPlusResult | null> {
  try {
    const resp = await fetch(
      `https://api.gopluslabs.com/api/v1/token_security/${chainId}?contract_addresses=${token}`,
      { signal: AbortSignal.timeout(5000) }
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
    return null; // GoPlus unreachable — rely on on-chain analysis
  }
}

// ─── Risk Assessment Engine ──────────────────────────────────

function assessRisk(
  analysis: OnChainAnalysis
): { riskScore: number; flags: string[]; boolFlags: [boolean, boolean, boolean, boolean, boolean, boolean, boolean]; confidence: number } {
  let score = 20; // baseline for unknown token
  const flags: string[] = [];
  let confidence = 70; // base confidence from on-chain data

  const gp = analysis.goplus;

  // ── GoPlus signals (highest weight when available) ──
  if (gp) {
    confidence = 90;
    if (gp.isHoneypot) {
      score = 95;
      flags.push("HONEYPOT");
    }
    if (gp.buyTax > 10) {
      score = Math.min(100, score + 20);
      flags.push("HIGH_BUY_TAX");
    }
    if (gp.sellTax > 10) {
      score = Math.min(100, score + 25);
      flags.push("HIGH_SELL_TAX");
    }
    if (gp.ownerCanChangeBalance) {
      score = Math.min(100, score + 25);
      flags.push("OWNER_CHANGE_BALANCE");
    }
    if (gp.hiddenOwner) {
      score = Math.min(100, score + 10);
      flags.push("HIDDEN_OWNER");
    }
    if (gp.canTakeBackOwnership) {
      score = Math.min(100, score + 15);
      flags.push("TAKEBACK_OWNERSHIP");
    }
    // Clean GoPlus → reduce score
    if (!gp.isHoneypot && gp.isOpenSource && gp.buyTax < 5 && gp.sellTax < 5
        && !gp.ownerCanChangeBalance && !gp.hiddenOwner) {
      score = Math.max(0, score - 15);
    }
  }

  // ── On-chain bytecode signals ──
  if (!analysis.isContract) {
    score = 85;
    flags.push("NOT_A_CONTRACT");
    confidence = 95;
  } else {
    if (analysis.canMint) {
      score = Math.min(100, score + 15);
      flags.push("MINTABLE");
    }
    if (analysis.canBlacklist) {
      score = Math.min(100, score + 15);
      flags.push("CAN_BLACKLIST");
    }
    if (analysis.canPause) {
      score = Math.min(100, score + 10);
      flags.push("PAUSABLE");
    }
    if (analysis.hasFeeFunction) {
      score = Math.min(100, score + 10);
      flags.push("DYNAMIC_FEE");
    }
    if (analysis.hasSelfDestruct) {
      score = Math.min(100, score + 20);
      flags.push("SELF_DESTRUCT");
    }
    if (analysis.bytecodeLength < 500) {
      score = Math.min(100, score + 10);
      flags.push("TINY_CONTRACT");
    }
  }

  // ── Owner analysis ──
  if (analysis.hasOwner && !analysis.isRenounced) {
    score = Math.min(100, score + 5);
    if (analysis.ownerBalancePercent > 5000) { // >50% of supply
      score = Math.min(100, score + 20);
      flags.push("CONCENTRATED_OWNERSHIP");
    } else if (analysis.ownerBalancePercent > 2000) { // >20%
      score = Math.min(100, score + 10);
      flags.push("HIGH_OWNER_BALANCE");
    }
  }
  if (analysis.isRenounced) {
    score = Math.max(0, score - 10);
    flags.push("RENOUNCED");
  }

  // ── Supply analysis ──
  if (analysis.totalSupplyFormatted > 1_000_000_000_000) { // > 1 trillion
    score = Math.min(100, score + 5);
    flags.push("EXTREME_SUPPLY");
  }

  // ── Known verified status ──
  if (gp?.isOpenSource) {
    score = Math.max(0, score - 5);
    flags.push("VERIFIED_SOURCE");
  }

  const boolFlags: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] = [
    gp?.isHoneypot || false,       // honeypot
    analysis.canMint,               // canMint
    analysis.canPause,              // canPause
    analysis.canBlacklist,          // canBlacklist
    analysis.isRenounced,           // renounced
    false,                          // lpLocked (unknown without LP analysis)
    gp?.isOpenSource || false,      // verified
  ];

  return { riskScore: Math.min(100, Math.max(0, score)), flags, boolFlags, confidence };
}

// ─── Scan Service Class ───────────────────────────────────────

class ScanService {
  // Mainnet provider — for reading token data (where real tokens live)
  private mainnetProvider: ethers.JsonRpcProvider;
  // Testnet provider — for writing to our oracle contract
  private testnetProvider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private factory: ethers.Contract;
  private scanner: ethers.Contract;
  private logger: ethers.Contract | null = null;

  private isRunning = false;
  private lastBlock = 0;
  private mainnetRpcIndex = 0;
  private testnetRpcIndex = 0;
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
    // Mainnet = read token data; Testnet = write to oracle
    this.mainnetProvider = new ethers.JsonRpcProvider(CONFIG.mainnetRpc);
    this.testnetProvider = new ethers.JsonRpcProvider(CONFIG.testnetRpc);
    this.wallet = new ethers.Wallet(CONFIG.privateKey, this.testnetProvider);
    // Factory on MAINNET (PancakeSwap V2 mainnet factory)
    this.factory = new ethers.Contract(CONFIG.factoryAddress, FACTORY_ABI, this.mainnetProvider);
    // Scanner oracle on TESTNET (our deployed contract)
    this.scanner = new ethers.Contract(CONFIG.scannerAddress, SCANNER_ABI, this.wallet);

    if (CONFIG.loggerAddress && ethers.isAddress(CONFIG.loggerAddress)) {
      this.logger = new ethers.Contract(CONFIG.loggerAddress, LOGGER_ABI, this.wallet);
    }
  }

  async start(): Promise<void> {
    this.printBanner();
    await this.validate();

    this.isRunning = true;

    // Track mainnet blocks (that's where PairCreated events happen)
    const currentBlock = await this.mainnetProvider.getBlockNumber();
    this.lastBlock = Math.max(0, currentBlock - CONFIG.lookbackBlocks);

    console.log(`\n[ScanService] BSC Mainnet block: ${currentBlock}`);
    console.log(`[ScanService] Looking back ${CONFIG.lookbackBlocks} blocks from ${this.lastBlock}`);
    console.log(`[ScanService] Polling every ${CONFIG.pollInterval / 1000}s`);

    this.startHttpServer();

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
    const BATCH_SIZE = 50; // Small batches for free RPC limits
    let from = this.lastBlock + 1;
    let consecutiveErrors = 0;

    while (from <= currentBlock && this.isRunning) {
      const to = Math.min(currentBlock, from + BATCH_SIZE - 1);
      try {
        const filter = this.factory.filters.PairCreated();
        const events = await this.factory.queryFilter(filter, from, to);
        consecutiveErrors = 0; // Reset on success
        if (events.length > 0) {
          console.log(`[CatchUp] Found ${events.length} PairCreated events in blocks ${from}-${to}`);
          for (const event of events) {
            const log = event as ethers.EventLog;
            const token0 = (log.args[0] as string).toLowerCase();
            const token1 = (log.args[1] as string).toLowerCase();
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
        consecutiveErrors++;
        console.warn(`[CatchUp] Error blocks ${from}-${to} (attempt ${consecutiveErrors}): ${err.message?.slice(0, 60)}`);
        if (consecutiveErrors >= 3) {
          console.warn(`[CatchUp] Skipping blocks ${from}-${to} after ${consecutiveErrors} failures`);
          consecutiveErrors = 0;
          // Fall through to advance from
        } else {
          await this.sleep(2000);
          continue;
        }
      }
      from = to + 1;
      if (from <= currentBlock) await this.sleep(300);
    }
    this.lastBlock = currentBlock;
    console.log(`[CatchUp] Historical scan complete. Now at block ${this.lastBlock}`);
  }

  // ─── Main Tick ──────────────────────────────────────────────

  private async tick(): Promise<void> {
    const currentBlock = await this.mainnetProvider.getBlockNumber();
    if (currentBlock <= this.lastBlock) return;

    const fromBlock = this.lastBlock + 1;
    const toBlock = Math.min(currentBlock, fromBlock + 50);

    try {
      const filter = this.factory.filters.PairCreated();
      const events = await this.factory.queryFilter(filter, fromBlock, toBlock);

      if (events.length === 0) {
        this.emptyPollCount++;
        if (this.emptyPollCount >= 5 && !this.lowActivityWarned) {
          this.lowActivityWarned = true;
          console.warn(`\n⚠ [ScanService] No PairCreated events in ${this.emptyPollCount} polls.`);
          console.warn(`  Manual scans: POST http://localhost:${CONFIG.httpPort}/scan\n`);
        }
      } else {
        this.emptyPollCount = 0;
        this.lowActivityWarned = false;
      }

      for (const event of events) {
        const log = event as ethers.EventLog;
        const token0 = (log.args[0] as string).toLowerCase();
        const token1 = (log.args[1] as string).toLowerCase();
        this.stats.pairsDetected++;

        if (!BASE_TOKENS.has(token0) && !this.scannedTokens.has(token0)) {
          await this.scanAndSubmit(token0);
        }
        if (!BASE_TOKENS.has(token1) && !this.scannedTokens.has(token1)) {
          await this.scanAndSubmit(token1);
        }
      }
    } catch (err: any) {
      if (err.message?.includes("rate") || err.message?.includes("limit") || err.message?.includes("429") || err.code === "SERVER_ERROR") {
        console.warn(`[ScanService] RPC rate limited, backing off...`);
        await this.sleep(5000);
      } else {
        throw err;
      }
    }

    this.lastBlock = toBlock;
    if (this.stats.tickCount % 20 === 0) this.printStats();
  }

  // ─── Scan & Submit Pipeline ─────────────────────────────────

  private async scanAndSubmit(token: string, force: boolean = false): Promise<{ riskScore: number; flags: string[] } | null> {
    if (!force && this.scannedTokens.has(token)) {
      console.log(`[ScanService] Skip duplicate: ${token.slice(0, 10)}...`);
      return null;
    }

    // On-chain duplicate check (skip for force/manual re-scans)
    if (!force) {
      try {
        const alreadyScanned = await this.scanner.isScanned(token);
        if (alreadyScanned) {
          this.scannedTokens.add(token);
          console.log(`[ScanService] Already on-chain: ${token.slice(0, 10)}...`);
          return null;
        }
      } catch {
        // continue
      }
    }

    console.log(`[ScanService] Analyzing ${token} on BSC Mainnet...`);
    const startMs = Date.now();

    try {
      // Full on-chain analysis — reads from BSC MAINNET
      const analysis = await analyzeTokenOnChain(token, this.mainnetProvider);

      if (!analysis.isContract) {
        console.log(`[ScanService] ${token.slice(0, 10)}... — not a contract, skipping`);
        this.scannedTokens.add(token);
        return null;
      }

      // Risk assessment from on-chain + optional GoPlus data
      const { riskScore, flags, boolFlags, confidence } = assessRisk(analysis);

      // Build reasoning
      const reasoning = [
        `Token: ${analysis.symbol} (${analysis.name})`,
        `Address: ${token}`,
        `Score: ${riskScore}/100 (confidence: ${confidence}%)`,
        `Supply: ${analysis.totalSupplyFormatted.toLocaleString()}`,
        `Owner: ${analysis.hasOwner ? analysis.ownerAddress : "none"}`,
        `Renounced: ${analysis.isRenounced}`,
        `Bytecode: ${analysis.bytecodeLength} chars`,
        `Capabilities: ${[
          analysis.canMint && "mint",
          analysis.canPause && "pause",
          analysis.canBlacklist && "blacklist",
          analysis.hasFeeFunction && "fee",
        ].filter(Boolean).join(", ") || "none detected"}`,
        `Owner Balance: ${(analysis.ownerBalancePercent / 100).toFixed(1)}%`,
        `GoPlus: ${analysis.goplus ? "available" : "unavailable"}`,
        `Flags: ${flags.join(", ") || "none"}`,
        `Scan: ${new Date().toISOString()}`,
      ].join("\n");

      const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes(reasoning));
      const elapsed = Date.now() - startMs;

      // Submit on-chain
      if (CONFIG.dryRun) {
        console.log(`[ScanService] DRY RUN — ${analysis.symbol} score=${riskScore} flags=[${flags.join(",")}] [${elapsed}ms]`);
      } else {
        const buyTaxBps = Math.round((analysis.goplus?.buyTax || 0) * 100);
        const sellTaxBps = Math.round((analysis.goplus?.sellTax || 0) * 100);

        const tx = await this.scanner["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
          token,
          riskScore,
          0, // liquidity — requires DEX pair analysis
          analysis.goplus?.holderCount || 0,
          analysis.ownerBalancePercent,
          buyTaxBps,
          sellTaxBps,
          boolFlags,
          flags.join(","),
          reasoningHash
        );
        const receipt = await tx.wait();
        console.log(`[ScanService] ✓ ${analysis.symbol} score=${riskScore} flags=[${flags.join(",")}] tx=${receipt.hash.slice(0, 16)}... [${elapsed}ms]`);

        // Log to DecisionLogger if available
        if (this.logger) {
          try {
            const logTx = await this.logger.logDecision(
              CONFIG.agentId,
              token,
              0, // RiskAssessment
              riskScore >= 70 ? 4 : riskScore >= 40 ? 3 : riskScore >= 20 ? 2 : 1,
              Math.min(confidence * 100, 10000),
              reasoningHash,
              ethers.keccak256(ethers.toUtf8Bytes(token)),
              true,
              0
            );
            await logTx.wait();
          } catch {
            // Non-critical
          }
        }
      }

      this.scannedTokens.add(token);
      this.stats.scansSubmitted++;
      if (boolFlags[0]) this.stats.honeypotsFound++;

      return { riskScore, flags };
    } catch (err: any) {
      this.stats.scansFailed++;
      console.error(`[ScanService] ✗ ${token.slice(0, 10)}... — ${err.message}`);
      return null;
    }
  }

  // ─── Manual Scan (from HTTP endpoint) ───────────────────────

  async scanManual(token: string): Promise<{ success: boolean; message: string; riskScore?: number; flags?: string[] }> {
    const addr = token.toLowerCase().trim();

    if (!ethers.isAddress(addr)) {
      return { success: false, message: "Invalid address" };
    }

    console.log(`[ManualScan] Triggered for ${addr}`);
    this.stats.manualScans++;

    try {
      // First, check if it's actually a contract on mainnet
      const code = await this.mainnetProvider.getCode(addr);
      if (code.length <= 2) {
        return { success: false, message: "Not a contract on BSC Mainnet — check the address" };
      }

      // Force re-scan — always analyze fresh, even if previously scanned
      const result = await this.scanAndSubmit(addr, true);
      if (result) {
        return { success: true, message: "Scan submitted to oracle", riskScore: result.riskScore, flags: result.flags };
      }
      return { success: false, message: "Scan failed — token analysis returned no result" };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  // ─── HTTP Server ────────────────────────────────────────────

  private startHttpServer(): void {
    this.httpServer = http.createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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
          } catch {
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

    // Rotate mainnet RPC
    this.mainnetRpcIndex = (this.mainnetRpcIndex + 1) % MAINNET_RPC_FALLBACKS.length;
    const newMainnet = MAINNET_RPC_FALLBACKS[this.mainnetRpcIndex];
    console.warn(`[ScanService] RPC failure #${this.stats.rpcFailures} — switching mainnet to ${newMainnet}`);

    try {
      this.mainnetProvider = new ethers.JsonRpcProvider(newMainnet);
      await this.mainnetProvider.getBlockNumber();
      this.factory = new ethers.Contract(CONFIG.factoryAddress, FACTORY_ABI, this.mainnetProvider);
      console.log(`[ScanService] Mainnet RPC switched to ${newMainnet}`);
    } catch {
      // Also try next
      this.mainnetRpcIndex = (this.mainnetRpcIndex + 1) % MAINNET_RPC_FALLBACKS.length;
      const nextRpc = MAINNET_RPC_FALLBACKS[this.mainnetRpcIndex];
      this.mainnetProvider = new ethers.JsonRpcProvider(nextRpc);
      this.factory = new ethers.Contract(CONFIG.factoryAddress, FACTORY_ABI, this.mainnetProvider);
    }

    // Also rotate testnet RPC for oracle writes
    this.testnetRpcIndex = (this.testnetRpcIndex + 1) % TESTNET_RPC_FALLBACKS.length;
    const newTestnet = TESTNET_RPC_FALLBACKS[this.testnetRpcIndex];
    try {
      this.testnetProvider = new ethers.JsonRpcProvider(newTestnet);
      await this.testnetProvider.getBlockNumber();
      this.wallet = new ethers.Wallet(CONFIG.privateKey, this.testnetProvider);
      this.scanner = new ethers.Contract(CONFIG.scannerAddress, SCANNER_ABI, this.wallet);
      if (CONFIG.loggerAddress && ethers.isAddress(CONFIG.loggerAddress)) {
        this.logger = new ethers.Contract(CONFIG.loggerAddress, LOGGER_ABI, this.wallet);
      }
    } catch {
      // Non-critical — testnet might still work on old connection
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

    // Validate TESTNET connection (where oracle contract lives)
    const testnetNetwork = await this.testnetProvider.getNetwork();
    console.log(`[ScanService] Testnet Chain ID: ${testnetNetwork.chainId} (oracle writes)`);
    if (Number(testnetNetwork.chainId) !== 97) {
      throw new Error(`Expected BSC Testnet (chain 97) for oracle but connected to chain ${testnetNetwork.chainId}`);
    }

    // Validate MAINNET connection (where real tokens live)
    const mainnetNetwork = await this.mainnetProvider.getNetwork();
    console.log(`[ScanService] Mainnet Chain ID: ${mainnetNetwork.chainId} (token reads)`);
    if (Number(mainnetNetwork.chainId) !== 56) {
      throw new Error(`Expected BSC Mainnet (chain 56) for token analysis but connected to chain ${mainnetNetwork.chainId}`);
    }

    // Verify factory contract on mainnet
    const factoryCode = await this.mainnetProvider.getCode(CONFIG.factoryAddress);
    if (factoryCode.length <= 2) {
      throw new Error(`Factory contract not found at ${CONFIG.factoryAddress} on mainnet`);
    }
    console.log(`[ScanService] Factory: ${CONFIG.factoryAddress} (mainnet, verified)`);

    // Balance on testnet (for gas to submit oracle writes)
    const balance = await this.testnetProvider.getBalance(this.wallet.address);
    console.log(`[ScanService] Wallet: ${this.wallet.address}`);
    console.log(`[ScanService] Testnet Balance: ${ethers.formatEther(balance)} tBNB`);
    if (balance < ethers.parseEther("0.01")) {
      throw new Error("Insufficient tBNB balance — need >0.01 tBNB for gas");
    }

    // Scanner contract on testnet
    const code = await this.testnetProvider.getCode(CONFIG.scannerAddress);
    if (code.length <= 2) {
      throw new Error(`Scanner contract not found at ${CONFIG.scannerAddress} on testnet`);
    }
    console.log(`[ScanService] Scanner: ${CONFIG.scannerAddress} (testnet, verified)`);

    // Check scanner stats
    const stats = await this.scanner.getScannerStats();
    console.log(`[ScanService] Oracle stats: scans=${stats[0]}, tokens=${stats[3]}`);
  }

  // ─── Output ─────────────────────────────────────────────────

  private printBanner(): void {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           AEGIS SCAN SERVICE — Token Safety Scanner           ║
║                                                               ║
║  Reads BSC Mainnet → Analyzes → Writes to Testnet Oracle     ║
╚═══════════════════════════════════════════════════════════════╝
`);
    console.log(`  Mode:        ${CONFIG.dryRun ? "DRY RUN" : "LIVE"}`);
    console.log(`  Scanner:     ${CONFIG.scannerAddress || "NOT SET"}`);
    console.log(`  Factory:     ${CONFIG.factoryAddress} (mainnet)`);
    console.log(`  Mainnet RPC: ${CONFIG.mainnetRpc}`);
    console.log(`  Testnet RPC: ${CONFIG.testnetRpc}`);
    console.log(`  Interval:    ${CONFIG.pollInterval / 1000}s`);
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
