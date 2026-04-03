// ═══════════════════════════════════════════════════════════════
// ABI — Human-readable ABI for the AegisScanner V2 oracle
// ═══════════════════════════════════════════════════════════════

/**
 * Human-readable ABI for the AegisScanner V2 contract.
 * Use with ethers.js v6:
 *
 *   const scanner = new ethers.Contract(address, SCANNER_ABI, provider);
 *   const safe = await scanner.isTokenSafe("0x...");
 */
export const SCANNER_ABI = [
  // ─── Oracle Interface (IAegisScanner) ──────────────────
  "function getTokenRisk(address token) view returns (tuple(uint8 riskScore, uint48 lastUpdated, address attestedBy, bytes32 reasoningHash))",
  "function isTokenSafe(address token) view returns (bool)",
  "function getTokenFlags(address token) view returns (tuple(bool isHoneypot, bool hasHighTax, bool isUnverified, bool hasConcentratedOwnership, bool hasLowLiquidity))",
  "function getTokenRiskBatch(address[] tokens) view returns (tuple(uint8 riskScore, uint48 lastUpdated, address attestedBy, bytes32 reasoningHash)[])",
  "function isTokenSafeBatch(address[] tokens) view returns (bool[])",
  "function isScanned(address token) view returns (bool)",
  "function stalenessThreshold() view returns (uint256)",
  "function RISK_THRESHOLD() view returns (uint8)",
  "function MAX_BATCH_SIZE() view returns (uint256)",

  // ─── Legacy View Functions ─────────────────────────────
  "function getTokenScan(address token) view returns (tuple(address token, uint256 riskScore, uint256 liquidity, uint256 holderCount, uint256 topHolderPercent, uint256 buyTax, uint256 sellTax, bool isHoneypot, bool ownerCanMint, bool ownerCanPause, bool ownerCanBlacklist, bool isContractRenounced, bool isLiquidityLocked, bool isVerified, uint256 scanTimestamp, address scannedBy, string flags, bytes32 reasoningHash, uint256 scanVersion))",
  "function getTokenRiskScore(address token) view returns (uint256)",
  "function isHoneypot(address token) view returns (bool)",
  "function getScannedTokenCount() view returns (uint256)",
  "function getRecentScans(uint256 count) view returns (tuple(address token, uint256 riskScore, uint256 liquidity, uint256 holderCount, uint256 topHolderPercent, uint256 buyTax, uint256 sellTax, bool isHoneypot, bool ownerCanMint, bool ownerCanPause, bool ownerCanBlacklist, bool isContractRenounced, bool isLiquidityLocked, bool isVerified, uint256 scanTimestamp, address scannedBy, string flags, bytes32 reasoningHash, uint256 scanVersion)[])",
  "function getScannerStats() view returns (uint256 totalScans, uint256 totalHoneypots, uint256 totalRugRisks, uint256 totalTokens)",

  // ─── Events ────────────────────────────────────────────
  "event TokenRiskUpdated(address indexed token, uint8 riskScore, address indexed agent, bytes32 reasoningHash, uint256 timestamp)",
  "event TokenScanned(address indexed token, uint256 riskScore, bool isHoneypot, uint256 liquidity, address indexed scannedBy, uint256 timestamp)",
  "event ScannerAuthorized(address indexed scanner, bool authorized)",
] as const;
