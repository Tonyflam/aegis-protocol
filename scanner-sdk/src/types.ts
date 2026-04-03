// ═══════════════════════════════════════════════════════════════
// Types — TypeScript interfaces matching the Solidity structs
// ═══════════════════════════════════════════════════════════════

/** Matches IAegisScanner.TokenRiskData */
export interface TokenRiskData {
  riskScore: number;       // 0-100
  lastUpdated: number;     // Unix timestamp
  attestedBy: string;      // Agent address (checksummed)
  reasoningHash: string;   // bytes32 hex
}

/** Matches IAegisScanner.TokenFlags */
export interface TokenFlags {
  isHoneypot: boolean;
  hasHighTax: boolean;
  isUnverified: boolean;
  hasConcentratedOwnership: boolean;
  hasLowLiquidity: boolean;
}

/** Full scan data from getTokenScan() (legacy + V2 fields) */
export interface TokenScanData {
  token: string;
  riskScore: bigint;
  liquidity: bigint;
  holderCount: bigint;
  topHolderPercent: bigint;
  buyTax: bigint;
  sellTax: bigint;
  isHoneypot: boolean;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isContractRenounced: boolean;
  isLiquidityLocked: boolean;
  isVerified: boolean;
  scanTimestamp: bigint;
  scannedBy: string;
  flags: string;
  reasoningHash: string;
  scanVersion: bigint;
}

/** Config for the AegisScanner SDK class */
export interface AegisScannerConfig {
  /** Deployed AegisScanner contract address */
  address: string;
  /** ethers.js v6 JsonRpcProvider URL or Provider instance */
  rpcUrl?: string;
}
