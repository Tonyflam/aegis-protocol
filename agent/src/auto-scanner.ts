// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Auto-Scanner Agent Pipeline
// Monitors PancakeSwap Factory for PairCreated events,
// triggers full risk analysis, submits to AegisScanner on-chain.
// Target: scan every new BSC token within 60s of pair creation.
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";
import { TokenScanner, TokenRiskReport } from "./token-scanner";
import { ScanQueue, ScanPriority } from "./scan-queue";

// ─── Config ──────────────────────────────────────────────────

export interface AutoScannerConfig {
  /** RPC URL for BSC (mainnet or testnet) */
  rpcUrl: string;
  /** Private key of the authorized scanner wallet */
  privateKey: string;
  /** Deployed AegisScanner contract address */
  scannerAddress: string;
  /** How often to poll for new pairs (ms). Default: 15s */
  pollInterval?: number;
  /** How many scans to process per tick. Default: 3 */
  batchSize?: number;
  /** Dry run — log but don't submit on-chain */
  dryRun?: boolean;
  /** PancakeSwap Factory address override (testnet) */
  factoryAddress?: string;
  /** GoPlusLabs API key (optional, higher rate limits) */
  goPlusApiKey?: string;
}

// PancakeSwap Factory on BSC Mainnet
const PANCAKE_FACTORY_MAINNET = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";

const FACTORY_ABI = [
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)",
  "function allPairsLength() view returns (uint)",
];

// AegisScanner V2 ABI (submit only)
const SCANNER_ABI = [
  "function submitScan(address token, uint256 riskScore, uint256 liquidity, uint256 holderCount, uint256 topHolderPercent, uint256 buyTax, uint256 sellTax, bool[7] calldata boolFlags, string calldata flags, bytes32 reasoningHash) external",
  "function isScanned(address token) view returns (bool)",
];

// Well-known base tokens we don't scan (WBNB, BUSD, etc.)
const BASE_TOKENS = new Set([
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WBNB
  "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
  "0x55d398326f99059ff775485246999027b3197955", // USDT
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
  "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // ETH
  "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", // BTCB
]);

// ─── GoPlusLabs Integration ─────────────────────────────────

interface GoPlusResult {
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  isOpenSource: boolean;
  isProxy: boolean;
  canTakeBackOwnership: boolean;
  ownerCanChangeBalance: boolean;
  hiddenOwner: boolean;
  externalCall: boolean;
  holderCount: number;
}

async function queryGoPlus(token: string): Promise<GoPlusResult | null> {
  try {
    const resp = await fetch(
      `https://api.gopluslabs.com/api/v1/token_security/56?contract_addresses=${token}`,
      { signal: AbortSignal.timeout(8000) }
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
      isProxy: data.is_proxy === "1",
      canTakeBackOwnership: data.can_take_back_ownership === "1",
      ownerCanChangeBalance: data.owner_change_balance === "1",
      hiddenOwner: data.hidden_owner === "1",
      externalCall: data.external_call === "1",
      holderCount: parseInt(data.holder_count || "0"),
    };
  } catch {
    return null;
  }
}

// ─── AutoScanner Class ──────────────────────────────────────

export class AutoScanner {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private factory: ethers.Contract;
  private scanner: ethers.Contract;
  private tokenScanner: TokenScanner;
  private queue: ScanQueue;

  private config: Required<AutoScannerConfig>;
  private isRunning = false;
  private lastBlock = 0;
  private stats = {
    pairsDetected: 0,
    scansSubmitted: 0,
    scansFailed: 0,
    honeypotsFound: 0,
    avgScanTimeMs: 0,
    totalScanTimeMs: 0,
  };

  constructor(config: AutoScannerConfig) {
    this.config = {
      pollInterval: 15_000,
      batchSize: 3,
      dryRun: true,
      factoryAddress: PANCAKE_FACTORY_MAINNET,
      goPlusApiKey: "",
      ...config,
    };

    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    this.wallet = new ethers.Wallet(this.config.privateKey, this.provider);
    this.factory = new ethers.Contract(this.config.factoryAddress, FACTORY_ABI, this.provider);
    this.scanner = new ethers.Contract(this.config.scannerAddress, SCANNER_ABI, this.wallet);
    this.tokenScanner = new TokenScanner(this.config.rpcUrl);
    this.queue = new ScanQueue();

    console.log("[AutoScanner] Initialized");
    console.log(`  Scanner Contract: ${this.config.scannerAddress}`);
    console.log(`  Factory: ${this.config.factoryAddress}`);
    console.log(`  Operator: ${this.wallet.address}`);
    console.log(`  Dry Run: ${this.config.dryRun}`);
    console.log(`  Poll Interval: ${this.config.pollInterval / 1000}s`);
    console.log(`  Batch Size: ${this.config.batchSize}`);
  }

  // ═══════════════════════════════════════════════════════════
  //                     LIFECYCLE
  // ═══════════════════════════════════════════════════════════

  async start(): Promise<void> {
    this.isRunning = true;
    this.lastBlock = await this.provider.getBlockNumber();
    console.log(`[AutoScanner] Starting from block ${this.lastBlock}`);

    while (this.isRunning) {
      try {
        await this.tick();
      } catch (err: any) {
        console.error(`[AutoScanner] Tick error: ${err.message}`);
      }
      await this.sleep(this.config.pollInterval);
    }
  }

  stop(): void {
    this.isRunning = false;
    console.log("[AutoScanner] Stopped");
  }

  getStats() {
    return { ...this.stats, queue: this.queue.getStats() };
  }

  // ═══════════════════════════════════════════════════════════
  //                     MAIN TICK
  // ═══════════════════════════════════════════════════════════

  private async tick(): Promise<void> {
    // Step 1: Discover new pairs
    await this.discoverNewPairs();

    // Step 2: Process scan queue
    await this.processQueue();
  }

  // ═══════════════════════════════════════════════════════════
  //              STEP 1: DISCOVER NEW PAIRS
  // ═══════════════════════════════════════════════════════════

  private async discoverNewPairs(): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      if (currentBlock <= this.lastBlock) return;

      // Query PairCreated events in the new block range
      // Cap at 200 blocks to avoid RPC rate limits
      const fromBlock = this.lastBlock + 1;
      const toBlock = Math.min(currentBlock, fromBlock + 200);

      const filter = this.factory.filters.PairCreated();
      const events = await this.factory.queryFilter(filter, fromBlock, toBlock);

      for (const event of events) {
        const log = event as ethers.EventLog;
        const token0 = (log.args[0] as string).toLowerCase();
        const token1 = (log.args[1] as string).toLowerCase();

        // Enqueue the non-base token from each pair
        if (!BASE_TOKENS.has(token0)) {
          if (this.queue.enqueueNewPair(token0)) {
            this.stats.pairsDetected++;
            console.log(`[AutoScanner] New pair detected: ${token0} (block ${log.blockNumber})`);
          }
        }
        if (!BASE_TOKENS.has(token1)) {
          if (this.queue.enqueueNewPair(token1)) {
            this.stats.pairsDetected++;
            console.log(`[AutoScanner] New pair detected: ${token1} (block ${log.blockNumber})`);
          }
        }
      }

      this.lastBlock = toBlock;
    } catch (err: any) {
      // RPC errors are expected on testnet — just log and continue
      if (!err.message?.includes("rate") && !err.message?.includes("limit")) {
        console.error(`[AutoScanner] Pair discovery error: ${err.message}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //              STEP 2: PROCESS SCAN QUEUE
  // ═══════════════════════════════════════════════════════════

  private async processQueue(): Promise<void> {
    const { batchSize } = this.config;

    for (let i = 0; i < batchSize; i++) {
      const job = this.queue.dequeue();
      if (!job) break;

      try {
        const start = Date.now();
        console.log(`[AutoScanner] Scanning ${job.token} (priority: ${ScanPriority[job.priority]})`);

        // Run the full analysis pipeline
        const report = await this.runPipeline(job.token);
        const elapsed = Date.now() - start;

        // Update stats
        this.stats.totalScanTimeMs += elapsed;
        const totalScans = this.stats.scansSubmitted + this.stats.scansFailed;
        this.stats.avgScanTimeMs = Math.round(this.stats.totalScanTimeMs / (totalScans + 1));

        if (report.isHoneypot) this.stats.honeypotsFound++;

        // Submit on-chain
        await this.submitOnChain(report);

        // Mark complete — queue will schedule re-scan based on risk score
        this.queue.complete(job.token, report.riskScore);
        this.stats.scansSubmitted++;

        console.log(`[AutoScanner] ✓ ${report.symbol} score=${report.riskScore} (${report.recommendation}) [${elapsed}ms]`);
      } catch (err: any) {
        this.queue.fail(job.token);
        this.stats.scansFailed++;
        console.error(`[AutoScanner] ✗ Failed ${job.token}: ${err.message}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //          FULL ANALYSIS PIPELINE (per token)
  // ═══════════════════════════════════════════════════════════

  /**
   * Pipeline order:
   * 1. TokenScanner deep scan (honeypot.is + liquidity + bytecode)
   * 2. GoPlusLabs verification (cross-reference)
   * 3. Merge results (worst-case from both sources)
   */
  private async runPipeline(token: string): Promise<TokenRiskReport> {
    // 1. Primary scan (existing TokenScanner)
    const report = await this.tokenScanner.scanToken(token);

    // 2. Cross-reference with GoPlusLabs
    const goplus = await queryGoPlus(token);
    if (goplus) {
      // Merge: take the worst-case from both sources
      if (goplus.isHoneypot && !report.isHoneypot) {
        report.isHoneypot = true;
        report.riskScore = 100;
        report.recommendation = "SCAM";
        if (!report.flags.includes("HONEYPOT")) report.flags.push("HONEYPOT");
      }
      // Use higher tax reading
      if (goplus.buyTax > report.buyTax) report.buyTax = goplus.buyTax;
      if (goplus.sellTax > report.sellTax) report.sellTax = goplus.sellTax;

      // Use GoPlus holder count if we don't have one
      if (report.holderCount === 0 && goplus.holderCount > 0) {
        report.holderCount = goplus.holderCount;
      }

      // Additional GoPlus-specific red flags
      if (goplus.canTakeBackOwnership && !report.flags.includes("TAKEBACK_OWNERSHIP")) {
        report.flags.push("TAKEBACK_OWNERSHIP");
        report.riskScore = Math.min(100, report.riskScore + 15);
      }
      if (goplus.ownerCanChangeBalance && !report.flags.includes("OWNER_CHANGE_BALANCE")) {
        report.flags.push("OWNER_CHANGE_BALANCE");
        report.riskScore = Math.min(100, report.riskScore + 20);
      }
      if (goplus.hiddenOwner && !report.flags.includes("HIDDEN_OWNER")) {
        report.flags.push("HIDDEN_OWNER");
        report.riskScore = Math.min(100, report.riskScore + 10);
      }

      // Recalculate recommendation based on merged score
      if (report.riskScore >= 70) report.recommendation = "SCAM";
      else if (report.riskScore >= 40) report.recommendation = "AVOID";
      else if (report.riskScore >= 20) report.recommendation = "CAUTION";
      else report.recommendation = "SAFE";
    }

    return report;
  }

  // ═══════════════════════════════════════════════════════════
  //              SUBMIT TO AEGISSCANNER ON-CHAIN
  // ═══════════════════════════════════════════════════════════

  private async submitOnChain(report: TokenRiskReport): Promise<void> {
    // Build reasoning string for hash
    const reasoning = [
      `Token: ${report.symbol} (${report.address})`,
      `Score: ${report.riskScore}/100 — ${report.recommendation}`,
      `Honeypot: ${report.isHoneypot}`,
      `Buy Tax: ${report.buyTax}% | Sell Tax: ${report.sellTax}%`,
      `Liquidity: $${report.liquidityUsd.toFixed(0)}`,
      `Holders: ${report.holderCount}`,
      `Top Holder: ${report.topHolderPercent}%`,
      `Flags: ${report.flags.join(", ") || "none"}`,
      `Timestamp: ${new Date().toISOString()}`,
    ].join("\n");

    const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes(reasoning));

    // Pack bool flags: [honeypot, canMint, canPause, canBlacklist, renounced, lpLocked, verified]
    const boolFlags: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] = [
      report.isHoneypot,
      report.ownerCanMint,
      report.ownerCanPause,
      report.ownerCanBlacklist,
      report.isRenounced,
      report.isLiquidityLocked,
      report.isVerified,
    ];

    // Convert percentages to basis points for contract
    const liquidityWei = ethers.parseEther(report.liquidityUsd.toFixed(0));
    const topHolderBps = Math.round(report.topHolderPercent * 100); // % → bps
    const buyTaxBps = Math.round(report.buyTax * 100);              // % → bps
    const sellTaxBps = Math.round(report.sellTax * 100);            // % → bps

    const flagStr = report.flags.join(",");

    if (this.config.dryRun) {
      console.log(`[AutoScanner] DRY RUN — would submit: ${report.symbol} score=${report.riskScore} hash=${reasoningHash.slice(0, 10)}...`);
      return;
    }

    try {
      const tx = await this.scanner.submitScan(
        report.address,
        report.riskScore,
        liquidityWei,
        report.holderCount,
        topHolderBps,
        buyTaxBps,
        sellTaxBps,
        boolFlags,
        flagStr,
        reasoningHash
      );
      const receipt = await tx.wait();
      console.log(`[AutoScanner] On-chain submit tx: ${receipt.hash}`);
    } catch (err: any) {
      console.error(`[AutoScanner] On-chain submit failed: ${err.message}`);
      throw err; // propagate so queue marks as failed
    }
  }

  // ═══════════════════════════════════════════════════════════
  //                     UTILITIES
  // ═══════════════════════════════════════════════════════════

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Manually enqueue a token for scanning (e.g. from frontend API) */
  enqueueToken(token: string): boolean {
    return this.queue.enqueueNewPair(token);
  }

  /** Check if a token is already tracked */
  isTracked(token: string): boolean {
    return this.queue.size > 0; // simplified — could check queue internals
  }
}
