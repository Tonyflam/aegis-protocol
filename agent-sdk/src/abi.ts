/** Minimal ABIs for agent interaction */

export const CONSENSUS_ABI = [
  "function submitAttestation(address token, uint256 riskScore, uint256 liquidity, uint256 holderCount, uint256 topHolderPercent, uint256 buyTax, uint256 sellTax, bool[7] boolFlags, bytes32 reasoningHash) external",
  "function getActiveRound(address token) external view returns (tuple(address token, uint256 roundId, uint256 createdAt, bool finalized, uint256 attestationCount, uint8 finalRiskScore))",
  "function getAttestationCount(address token) external view returns (uint256)",
  "function finalizeConsensus(address token) external",
  "function MIN_ATTESTATIONS() external view returns (uint256)",
  "event AttestationSubmitted(address indexed token, address indexed agent, uint256 riskScore, uint256 roundId)",
  "event ConsensusFinalized(address indexed token, uint256 roundId, uint8 finalRiskScore, uint256 attestationCount)",
] as const;

export const STAKING_ABI = [
  "function stake(uint256 amount) external",
  "function requestUnstake() external",
  "function withdraw() external",
  "function getStakeTier(address agent) external view returns (uint8)",
  "function getWeight(address agent) external view returns (uint256)",
  "function isStaked(address agent) external view returns (bool)",
  "function getStake(address agent) external view returns (uint256)",
  "function SCOUT_STAKE() external view returns (uint256)",
  "function GUARDIAN_STAKE() external view returns (uint256)",
  "function SENTINEL_STAKE() external view returns (uint256)",
  "function ARCHON_STAKE() external view returns (uint256)",
  "event Staked(address indexed agent, uint256 amount, uint256 totalStake, uint8 tier)",
] as const;

export const SCANNER_ABI = [
  "function getTokenRisk(address token) external view returns (tuple(uint8 riskScore, uint48 lastUpdated, address attestedBy, bytes32 reasoningHash))",
  "function isTokenSafe(address token) external view returns (bool)",
  "function getTokenFlags(address token) external view returns (tuple(bool isHoneypot, bool hasHighTax, bool isUnverified, bool hasConcentratedOwnership, bool hasLowLiquidity))",
  "function isScanned(address token) external view returns (bool)",
  "function getTokenScan(address token) external view returns (tuple(address token, uint256 riskScore, uint256 liquidity, uint256 holderCount, uint256 topHolderPercent, uint256 buyTax, uint256 sellTax, bool isHoneypot, bool ownerCanMint, bool ownerCanPause, bool ownerCanBlacklist, bool isContractRenounced, bool isLiquidityLocked, bool isVerified, uint256 scanTimestamp, address scannedBy, string flags, bytes32 reasoningHash, uint256 scanVersion))",
  "event TokenRiskUpdated(address indexed token, uint8 riskScore, address indexed agent, bytes32 reasoningHash, uint256 timestamp)",
] as const;
