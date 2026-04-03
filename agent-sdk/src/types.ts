/**
 * Core types for the Aegis Agent SDK
 */

/** Raw scan result from an IScanner implementation */
export interface ScanResult {
  token: string;
  riskScore: number;
  liquidity: bigint;
  holderCount: number;
  topHolderPercent: number;
  buyTax: number;
  sellTax: number;
  isHoneypot: boolean;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isContractRenounced: boolean;
  isLiquidityLocked: boolean;
  isVerified: boolean;
}

/** Enhanced analysis from an IAnalyzer (multiple data sources merged) */
export interface TokenAnalysis extends ScanResult {
  sources: string[];
  confidence: number; // 0-100
  reasoning: string;
  reasoningHash: string;
}

/** Packed data ready for on-chain attestation */
export interface AttestationData {
  token: string;
  riskScore: number;
  liquidity: bigint;
  holderCount: number;
  topHolderPercent: number;
  buyTax: number;
  sellTax: number;
  boolFlags: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
  reasoningHash: string;
}

/** Agent configuration */
export interface AgentConfig {
  rpcUrl: string;
  privateKey: string;
  consensusAddress: string;
  stakingAddress: string;
  scannerAddress?: string;
  chainId?: number;
  pollInterval?: number;   // ms between poll cycles (default: 15000)
  batchSize?: number;      // max tokens per cycle (default: 3)
  dryRun?: boolean;        // if true, don't submit on-chain
}

/** Agent runtime stats */
export interface AgentStats {
  scansCompleted: number;
  attestationsSubmitted: number;
  errors: number;
  uptime: number;
  lastScanTimestamp: number;
}
