// ═══════════════════════════════════════════════════════════════
// AegisScanner — High-level SDK wrapper
// Typed, cached, ergonomic access to the on-chain oracle
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";
import { SCANNER_ABI } from "./abi";
import type { TokenRiskData, TokenFlags, TokenScanData, AegisScannerConfig } from "./types";

const DEFAULT_BSC_RPC = "https://bsc-dataseed1.binance.org";

export class AegisScanner {
  private contract: ethers.Contract;
  public readonly address: string;

  constructor(config: AegisScannerConfig, provider?: ethers.Provider) {
    this.address = config.address;
    const prov = provider ?? new ethers.JsonRpcProvider(config.rpcUrl ?? DEFAULT_BSC_RPC);
    this.contract = new ethers.Contract(config.address, SCANNER_ABI, prov);
  }

  // ─── Oracle Interface ──────────────────────────────────────

  /** Check if a token is safe (fresh scan, score < 70, not honeypot) */
  async isTokenSafe(token: string): Promise<boolean> {
    return this.contract.isTokenSafe(token);
  }

  /** Get full risk data for a token */
  async getTokenRisk(token: string): Promise<TokenRiskData> {
    const r = await this.contract.getTokenRisk(token);
    return {
      riskScore: Number(r.riskScore),
      lastUpdated: Number(r.lastUpdated),
      attestedBy: r.attestedBy,
      reasoningHash: r.reasoningHash,
    };
  }

  /** Get structured boolean security flags */
  async getTokenFlags(token: string): Promise<TokenFlags> {
    const f = await this.contract.getTokenFlags(token);
    return {
      isHoneypot: f.isHoneypot,
      hasHighTax: f.hasHighTax,
      isUnverified: f.isUnverified,
      hasConcentratedOwnership: f.hasConcentratedOwnership,
      hasLowLiquidity: f.hasLowLiquidity,
    };
  }

  /** Batch safety check for up to 100 tokens */
  async isTokenSafeBatch(tokens: string[]): Promise<boolean[]> {
    return this.contract.isTokenSafeBatch(tokens);
  }

  /** Batch risk data for up to 100 tokens */
  async getTokenRiskBatch(tokens: string[]): Promise<TokenRiskData[]> {
    const results = await this.contract.getTokenRiskBatch(tokens);
    return results.map((r: any) => ({
      riskScore: Number(r.riskScore),
      lastUpdated: Number(r.lastUpdated),
      attestedBy: r.attestedBy,
      reasoningHash: r.reasoningHash,
    }));
  }

  // ─── Metadata ──────────────────────────────────────────────

  /** Whether the token has been scanned at least once */
  async isScanned(token: string): Promise<boolean> {
    return this.contract.isScanned(token);
  }

  /** Current staleness threshold in seconds */
  async getStalenessThreshold(): Promise<number> {
    return Number(await this.contract.stalenessThreshold());
  }

  /** Risk score threshold (tokens at/above this are unsafe) */
  async getRiskThreshold(): Promise<number> {
    return Number(await this.contract.RISK_THRESHOLD());
  }

  // ─── Legacy Functions ──────────────────────────────────────

  /** Get the full scan data (legacy struct with all 19 fields) */
  async getTokenScan(token: string): Promise<TokenScanData> {
    return this.contract.getTokenScan(token);
  }

  /** Get raw risk score (0-100, as uint256) */
  async getTokenRiskScore(token: string): Promise<number> {
    return Number(await this.contract.getTokenRiskScore(token));
  }

  /** Check honeypot status directly */
  async isHoneypot(token: string): Promise<boolean> {
    return this.contract.isHoneypot(token);
  }

  /** Total unique tokens scanned */
  async getScannedTokenCount(): Promise<number> {
    return Number(await this.contract.getScannedTokenCount());
  }

  /** Get N most recently scanned tokens (most recent first) */
  async getRecentScans(count: number): Promise<TokenScanData[]> {
    return this.contract.getRecentScans(count);
  }

  /** Get aggregate scanner statistics */
  async getScannerStats(): Promise<{
    totalScans: number;
    totalHoneypots: number;
    totalRugRisks: number;
    totalTokens: number;
  }> {
    const [s, h, r, t] = await this.contract.getScannerStats();
    return {
      totalScans: Number(s),
      totalHoneypots: Number(h),
      totalRugRisks: Number(r),
      totalTokens: Number(t),
    };
  }
}
