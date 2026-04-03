import { ethers } from "ethers";
import type { IScanner, IAnalyzer, ISubmitter } from "./interfaces";
import type { AgentConfig, AgentStats, ScanResult, TokenAnalysis, AttestationData } from "./types";
import { CONSENSUS_ABI, STAKING_ABI } from "./abi";

/**
 * AegisAgent — Main agent runtime for the Aegis Protocol oracle network.
 *
 * Orchestrates scanning, analysis, and attestation submission.
 * Agents must be staked (minimum Scout tier: 10K $UNIQ) to submit attestations.
 *
 * Usage:
 * ```ts
 * const agent = new AegisAgent(config);
 * agent.addScanner(myCustomScanner);
 * agent.addAnalyzer(myAnalyzer);
 * await agent.scanAndAttest("0xTokenAddress");
 * ```
 */
export class AegisAgent {
  private config: Required<AgentConfig>;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private consensus: ethers.Contract;
  private staking: ethers.Contract;
  private scanners: IScanner[] = [];
  private analyzer: IAnalyzer | null = null;
  private customSubmitter: ISubmitter | null = null;
  private running = false;
  private stats: AgentStats = {
    scansCompleted: 0,
    attestationsSubmitted: 0,
    errors: 0,
    uptime: 0,
    lastScanTimestamp: 0,
  };

  constructor(config: AgentConfig) {
    this.config = {
      rpcUrl: config.rpcUrl,
      privateKey: config.privateKey,
      consensusAddress: config.consensusAddress,
      stakingAddress: config.stakingAddress,
      scannerAddress: config.scannerAddress ?? "",
      chainId: config.chainId ?? 97,
      pollInterval: config.pollInterval ?? 15_000,
      batchSize: config.batchSize ?? 3,
      dryRun: config.dryRun ?? false,
    };

    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    this.wallet = new ethers.Wallet(this.config.privateKey, this.provider);
    this.consensus = new ethers.Contract(this.config.consensusAddress, CONSENSUS_ABI, this.wallet);
    this.staking = new ethers.Contract(this.config.stakingAddress, STAKING_ABI, this.wallet);
  }

  /** Add a scanner data source */
  addScanner(scanner: IScanner): this {
    this.scanners.push(scanner);
    return this;
  }

  /** Set the analyzer (merges multiple scan results) */
  addAnalyzer(analyzer: IAnalyzer): this {
    this.analyzer = analyzer;
    return this;
  }

  /** Set a custom submitter (override default on-chain submission) */
  setSubmitter(submitter: ISubmitter): this {
    this.customSubmitter = submitter;
    return this;
  }

  /** Check if the agent is staked at minimum Scout level */
  async isStaked(): Promise<boolean> {
    return this.staking.isStaked(this.wallet.address);
  }

  /** Get the agent's current stake tier */
  async getStakeTier(): Promise<number> {
    return Number(await this.staking.getStakeTier(this.wallet.address));
  }

  /** Get the agent's wallet address */
  get address(): string {
    return this.wallet.address;
  }

  /** Get runtime stats */
  getStats(): AgentStats {
    return { ...this.stats };
  }

  /**
   * Scan a token address using all registered scanners.
   * Returns raw ScanResult array (one per scanner).
   */
  async scan(tokenAddress: string): Promise<ScanResult[]> {
    if (this.scanners.length === 0) {
      throw new Error("No scanners registered. Call addScanner() first.");
    }

    const results: ScanResult[] = [];
    const settled = await Promise.allSettled(
      this.scanners.map((s) => s.scan(tokenAddress))
    );

    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }

    this.stats.scansCompleted++;
    this.stats.lastScanTimestamp = Date.now();

    return results;
  }

  /**
   * Scan, analyze, and submit attestation for a token.
   * Full pipeline: scan → analyze → pack → submit on-chain.
   */
  async scanAndAttest(tokenAddress: string): Promise<string | null> {
    const scans = await this.scan(tokenAddress);
    if (scans.length === 0) {
      throw new Error("All scanners failed for " + tokenAddress);
    }

    // Merge/analyze
    let analysis: TokenAnalysis;
    if (this.analyzer) {
      analysis = await this.analyzer.analyze(tokenAddress, scans);
    } else {
      analysis = this.defaultMerge(tokenAddress, scans);
    }

    // Pack attestation
    const attestation = this.packAttestation(analysis);

    if (this.config.dryRun) {
      return null;
    }

    // Submit
    if (this.customSubmitter) {
      const txHash = await this.customSubmitter.submit(attestation);
      this.stats.attestationsSubmitted++;
      return txHash;
    }

    return this.submitOnChain(attestation);
  }

  /** Stop the agent */
  stop(): void {
    this.running = false;
  }

  // ─── Internal ──────────────────────────────────────────────

  private defaultMerge(tokenAddress: string, scans: ScanResult[]): TokenAnalysis {
    // Worst-case merge: take highest risk signals
    const merged: TokenAnalysis = {
      token: tokenAddress,
      riskScore: Math.max(...scans.map((s) => s.riskScore)),
      liquidity: scans.reduce(
        (max, s) => (s.liquidity > max ? s.liquidity : max),
        BigInt(0)
      ),
      holderCount: Math.max(...scans.map((s) => s.holderCount)),
      topHolderPercent: Math.max(...scans.map((s) => s.topHolderPercent)),
      buyTax: Math.max(...scans.map((s) => s.buyTax)),
      sellTax: Math.max(...scans.map((s) => s.sellTax)),
      isHoneypot: scans.some((s) => s.isHoneypot),
      ownerCanMint: scans.some((s) => s.ownerCanMint),
      ownerCanPause: scans.some((s) => s.ownerCanPause),
      ownerCanBlacklist: scans.some((s) => s.ownerCanBlacklist),
      isContractRenounced: scans.every((s) => s.isContractRenounced),
      isLiquidityLocked: scans.some((s) => s.isLiquidityLocked),
      isVerified: scans.some((s) => s.isVerified),
      sources: scans.map((_s, i) => this.scanners[i]?.name ?? `scanner-${i}`),
      confidence: Math.round((scans.length / this.scanners.length) * 100),
      reasoning: `Merged ${scans.length} scan source(s)`,
      reasoningHash: ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify({ token: tokenAddress, ts: Date.now() }))
      ),
    };
    return merged;
  }

  private packAttestation(analysis: TokenAnalysis): AttestationData {
    return {
      token: analysis.token,
      riskScore: Math.min(100, Math.max(0, analysis.riskScore)),
      liquidity: analysis.liquidity,
      holderCount: analysis.holderCount,
      topHolderPercent: Math.min(10000, analysis.topHolderPercent),
      buyTax: Math.min(10000, analysis.buyTax),
      sellTax: Math.min(10000, analysis.sellTax),
      boolFlags: [
        analysis.isHoneypot,
        analysis.ownerCanMint,
        analysis.ownerCanPause,
        analysis.ownerCanBlacklist,
        analysis.isContractRenounced,
        analysis.isLiquidityLocked,
        analysis.isVerified,
      ],
      reasoningHash: analysis.reasoningHash,
    };
  }

  private async submitOnChain(attestation: AttestationData): Promise<string> {
    const tx = await this.consensus.submitAttestation(
      attestation.token,
      attestation.riskScore,
      attestation.liquidity,
      attestation.holderCount,
      attestation.topHolderPercent,
      attestation.buyTax,
      attestation.sellTax,
      attestation.boolFlags,
      attestation.reasoningHash
    );
    const receipt = await tx.wait();
    this.stats.attestationsSubmitted++;
    return receipt.hash;
  }
}
