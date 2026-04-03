// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Contract ABIs
// Scanner Oracle + Registry + ERC20 + TokenGate
// ═══════════════════════════════════════════════════════════════

export const REGISTRY_ABI = [
  "function getAgent(uint256 agentId) view returns (tuple(string name, string agentURI, address operator, uint256 registeredAt, uint256 totalDecisions, uint256 successfulActions, uint256 totalValueProtected, uint8 status, uint8 tier))",
  "function getAgentCount() view returns (uint256)",
  "function getReputationScore(uint256 agentId) view returns (uint256)",
  "function getSuccessRate(uint256 agentId) view returns (uint256)",
  "function isAgentActive(uint256 agentId) view returns (bool)",
  "function hasAgent(address operator) view returns (bool)",
  "function operatorToAgent(address operator) view returns (uint256)",
];

export const SCANNER_ABI = [
  "function getTokenScan(address token) view returns (tuple(address token, uint256 riskScore, uint256 liquidity, uint256 holderCount, uint256 topHolderPercent, uint256 buyTax, uint256 sellTax, bool isHoneypot, bool ownerCanMint, bool ownerCanPause, bool ownerCanBlacklist, bool isContractRenounced, bool isLiquidityLocked, bool isVerified, uint256 scanTimestamp, address scannedBy, string flags, bytes32 reasoningHash, uint256 scanVersion))",
  "function getTokenRiskScore(address token) view returns (uint256)",
  "function isHoneypot(address token) view returns (bool)",
  "function isScanned(address token) view returns (bool)",
  "function getScannedTokenCount() view returns (uint256)",
  "function getRecentScans(uint256 count) view returns (tuple(address token, uint256 riskScore, uint256 liquidity, uint256 holderCount, uint256 topHolderPercent, uint256 buyTax, uint256 sellTax, bool isHoneypot, bool ownerCanMint, bool ownerCanPause, bool ownerCanBlacklist, bool isContractRenounced, bool isLiquidityLocked, bool isVerified, uint256 scanTimestamp, address scannedBy, string flags, bytes32 reasoningHash, uint256 scanVersion)[])",
  "function getScannerStats() view returns (uint256 totalScans, uint256 totalHoneypots, uint256 totalRugRisks, uint256 totalTokens)",
  "function getTokenRisk(address token) view returns (tuple(uint8 riskScore, uint48 lastUpdated, address attestedBy, bytes32 reasoningHash))",
  "function isTokenSafe(address token) view returns (bool)",
  "function getTokenFlags(address token) view returns (tuple(bool isHoneypot, bool hasHighTax, bool isUnverified, bool hasConcentratedOwnership, bool hasLowLiquidity))",
  "function getTokenRiskBatch(address[] tokens) view returns (tuple(uint8 riskScore, uint48 lastUpdated, address attestedBy, bytes32 reasoningHash)[])",
  "function isTokenSafeBatch(address[] tokens) view returns (bool[])",
  "function stalenessThreshold() view returns (uint256)",
  "function RISK_THRESHOLD() view returns (uint8)",
];

export const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export const TOKEN_GATE_ABI = [
  "function getHolderTier(address user) view returns (uint8)",
  "function getFeeDiscount(address user) view returns (uint256)",
  "function isHolder(address user) view returns (bool)",
  "function getBalance(address user) view returns (uint256)",
];
