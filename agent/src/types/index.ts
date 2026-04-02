// ═══════════════════════════════════════════════════════════════
// Aegis Security OS — Core Type Definitions
// Shared interfaces for all engines, persistence, and providers
// ═══════════════════════════════════════════════════════════════

// ─── Token Types ──────────────────────────────────────────────

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface TokenRiskReport {
  token: TokenInfo;
  riskScore: number;              // 0-100
  recommendation: "SAFE" | "CAUTION" | "AVOID" | "SCAM";
  flags: string[];

  // On-chain analysis
  totalSupply: string;
  holderCount: number;
  topHolderPercent: number;
  ownerBalance: number;

  // Liquidity
  liquidityUsd: number;
  isLiquidityLocked: boolean;
  lpTokenBurned: boolean;

  // Contract security
  isVerified: boolean;
  isRenounced: boolean;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isProxy: boolean;

  // Honeypot detection
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;

  // Metadata
  scanTimestamp: number;
  scanDuration: number;
}

// ─── Approval Types ───────────────────────────────────────────

export interface TokenApproval {
  tokenAddress: string;
  tokenSymbol: string;
  spender: string;
  spenderLabel: string;
  allowance: string;           // raw amount
  allowanceFormatted: string;  // human-readable
  isUnlimited: boolean;
  riskLevel: ApprovalRiskLevel;
  riskReasons: string[];
  lastUsedBlock: number | null;
  approvedAtBlock: number | null;
}

export enum ApprovalRiskLevel {
  SAFE = "SAFE",
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export interface ApprovalScanResult {
  walletAddress: string;
  approvals: TokenApproval[];
  totalApprovals: number;
  highRiskCount: number;
  criticalCount: number;
  totalValueAtRisk: number;
  scanTimestamp: number;
}

// ─── Portfolio Types ──────────────────────────────────────────

export interface PortfolioToken {
  token: TokenInfo;
  balance: string;
  balanceFormatted: string;
  valueUsd: number;
  riskScore: number;
  recommendation: string;
  flags: string[];
  isHoneypot: boolean;
}

export interface PortfolioSnapshot {
  walletAddress: string;
  tokens: PortfolioToken[];
  totalValueUsd: number;
  highRiskCount: number;
  honeypotCount: number;
  healthScore: number;          // 0-100 (100 = perfect)
  scanTimestamp: number;
}

// ─── Threat Types ─────────────────────────────────────────────

export interface ThreatAlert {
  id: string;
  type: ThreatAlertType;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  from: string;
  to: string;
  amount: string;
  amountUsd: number;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

export enum ThreatAlertType {
  WHALE_SELL = "WHALE_SELL",
  WHALE_MOVE = "WHALE_MOVE",
  LIQUIDITY_REMOVE = "LIQUIDITY_REMOVE",
  LARGE_TRANSFER = "LARGE_TRANSFER",
  EXCHANGE_DEPOSIT = "EXCHANGE_DEPOSIT",
  NEW_WHALE = "NEW_WHALE",
  RUG_SIGNAL = "RUG_SIGNAL",
  CONTRACT_EXPLOIT = "CONTRACT_EXPLOIT",
  FLASH_LOAN = "FLASH_LOAN",
  APPROVAL_ABUSE = "APPROVAL_ABUSE",
}

// ─── Transaction Simulation Types ─────────────────────────────

export interface TransactionSimulation {
  to: string;
  from: string;
  data: string;
  value: string;
  chainId: number;
  gasEstimate: string;

  // Results
  success: boolean;
  revertReason: string | null;
  balanceChanges: BalanceChange[];
  approvalChanges: ApprovalChange[];
  riskScore: number;
  warnings: string[];
  timestamp: number;
}

export interface BalanceChange {
  token: TokenInfo | null;     // null = native BNB
  from: string;
  to: string;
  amount: string;
  amountUsd: number;
  direction: "IN" | "OUT";
}

export interface ApprovalChange {
  tokenAddress: string;
  tokenSymbol: string;
  spender: string;
  spenderLabel: string;
  oldAllowance: string;
  newAllowance: string;
  isUnlimited: boolean;
  riskLevel: ApprovalRiskLevel;
}

// ─── Security Score Types ─────────────────────────────────────

export interface SecurityScore {
  address: string;             // wallet or token
  addressType: "wallet" | "token";
  overallScore: number;        // 0-100
  breakdown: {
    tokenSafety: number;       // 0-100
    approvalHygiene: number;   // 0-100
    transactionPatterns: number; // 0-100
    exposureRisk: number;      // 0-100
    historicalBehavior: number; // 0-100
  };
  riskFactors: string[];
  lastUpdated: number;
}

// ─── Engine Interface ─────────────────────────────────────────

export interface EngineResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  duration: number;           // ms
  timestamp: number;
  cached: boolean;
}

// ─── Provider Types ───────────────────────────────────────────

export interface RPCProvider {
  url: string;
  chainId: number;
  label: string;
  priority: number;
  healthy: boolean;
  lastCheck: number;
}

// ─── Known Addresses ──────────────────────────────────────────

export const KNOWN_EXCHANGES: Record<string, string> = {
  "0x631fc1ea2270e98fbd9d92658ece0f5a269aa161": "Binance Hot Wallet 1",
  "0xb38e8c17e38363af6ebdcb3dae12e0243582891d": "Binance Hot Wallet 2",
  "0x8894e0a0c962cb723c1ef8f1d0dea26f46f2efed": "Binance Hot Wallet 3",
  "0x5a52e96bacdabb82fd05763e25335261b270efcb": "Binance Hot Wallet 5",
  "0xdccf3b77da55107280bd850ea519df3705d1a75a": "Binance Hot Wallet 6",
  "0x01c952174c24e1210d26961d456a77a39e1f0bb0": "Binance Hot Wallet 7",
  "0x161ba15a5f335c9f06bb5bbb0a9ce14076fbb645": "Bitget",
  "0x1ab4973a48dc892cd9971ece8e01dcc7688f8f23": "MEXC",
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549": "Bybit",
  "0x28c6c06298d514db089934071355e5743bf21d60": "Binance 14",
};

export const KNOWN_DEX_ROUTERS: Record<string, string> = {
  "0x10ed43c718714eb63d5aa57b78b54704e256024e": "PancakeSwap V2",
  "0x13f4ea83d0bd40e75c8222255bc855a974568dd4": "PancakeSwap V3",
  "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506": "SushiSwap",
};

export const DEAD_ADDRESSES = new Set([
  "0x000000000000000000000000000000000000dead",
  "0x0000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000001",
]);

export const BSC_TOKENS: Record<string, string> = {
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  USDT: "0x55d398326f99059fF775485246999027B3197955",
  CAKE: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  ETH:  "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
  BTCB: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
  USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  XRP:  "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE",
};

// Safe tokens that skip deep scanning
export const SAFE_TOKENS = new Set([
  BSC_TOKENS.WBNB.toLowerCase(),
  BSC_TOKENS.BUSD.toLowerCase(),
  BSC_TOKENS.USDT.toLowerCase(),
  BSC_TOKENS.CAKE.toLowerCase(),
  BSC_TOKENS.ETH.toLowerCase(),
  BSC_TOKENS.BTCB.toLowerCase(),
  BSC_TOKENS.USDC.toLowerCase(),
  BSC_TOKENS.XRP.toLowerCase(),
]);
