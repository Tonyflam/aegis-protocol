// ═══════════════════════════════════════════════════════════════
// Aegis Security OS — Frontend API Client
// Connects to the Aegis API server (Express backend)
// ═══════════════════════════════════════════════════════════════

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json();
}

// ─── Token Scanner ────────────────────────────────────────────

export interface TokenRiskReport {
  address: string;
  name: string;
  symbol: string;
  riskScore: number;
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  isVerified: boolean;
  hasProxy: boolean;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isRenounced: boolean;
  liquidityUsd: number;
  liquidityLocked: boolean;
  holderCount: number;
  topHolderPercent: number;
  flags: string[];
  scannedAt: number;
}

export interface PortfolioToken {
  address: string;
  symbol: string;
  name: string;
  balance: string;
  balanceUsd: number;
  riskScore: number;
  isHoneypot: boolean;
}

export interface PortfolioSnapshot {
  wallet: string;
  bnbBalance: string;
  bnbValueUsd: number;
  tokens: PortfolioToken[];
  totalValueUsd: number;
  overallRisk: number;
  scannedAt: number;
}

export function scanToken(address: string): Promise<TokenRiskReport> {
  return apiFetch(`/api/v1/scan/token/${address}`);
}

export function scanWallet(address: string): Promise<PortfolioSnapshot> {
  return apiFetch(`/api/v1/scan/wallet/${address}`);
}

// ─── Approvals ────────────────────────────────────────────────

export interface TokenApproval {
  tokenAddress: string;
  tokenSymbol: string;
  spender: string;
  spenderLabel: string;
  allowance: string;
  isUnlimited: boolean;
  riskLevel: "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  lastUsed: number;
}

export interface ApprovalScanResult {
  wallet: string;
  approvals: TokenApproval[];
  totalApprovals: number;
  riskyApprovals: number;
  scannedAt: number;
}

export function scanApprovals(address: string): Promise<ApprovalScanResult> {
  return apiFetch(`/api/v1/approvals/${address}`);
}

// ─── Portfolio Guardian ───────────────────────────────────────

export interface PortfolioHealth {
  portfolio: PortfolioSnapshot;
  securityScore: SecurityScore;
  alerts: ThreatAlert[];
}

export function getPortfolioHealth(address: string): Promise<PortfolioHealth> {
  return apiFetch(`/api/v1/portfolio/${address}`);
}

// ─── Security Score ───────────────────────────────────────────

export interface SecurityScore {
  address: string;
  overallScore: number;
  breakdown: {
    tokenSafety: number;
    approvalHygiene: number;
    transactionPatterns: number;
    exposureRisk: number;
    historicalBehavior: number;
  };
  grade: string;
  calculatedAt: number;
}

export function getWalletScore(address: string): Promise<SecurityScore> {
  return apiFetch(`/api/v1/score/wallet/${address}`);
}

export function getTokenScore(address: string): Promise<SecurityScore> {
  return apiFetch(`/api/v1/score/token/${address}`);
}

// ─── Threat Intelligence ──────────────────────────────────────

export interface ThreatAlert {
  id: string;
  type: string;
  severity: string;
  tokenAddress: string;
  tokenSymbol: string;
  fromAddress: string;
  toAddress: string;
  valueUsd: number;
  valueBnb: number;
  description: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

export function getRecentAlerts(limit = 50): Promise<{ success: boolean; data: ThreatAlert[]; count: number }> {
  return apiFetch(`/api/v1/threats/recent?limit=${limit}`);
}

export function scanTokenThreats(address: string): Promise<ThreatAlert[]> {
  return apiFetch(`/api/v1/threats/token/${address}`);
}

// ─── Transaction Firewall ─────────────────────────────────────

export interface TransactionSimulation {
  safe: boolean;
  riskScore: number;
  warnings: string[];
  balanceChanges: { token: string; symbol: string; amount: string; direction: "in" | "out" }[];
  approvalChanges: { token: string; spender: string; amount: string }[];
  gasEstimate: string;
  decodedFunction: string;
  simulatedAt: number;
}

export function simulateTransaction(tx: {
  to: string;
  from: string;
  data?: string;
  value?: string;
}): Promise<TransactionSimulation> {
  return apiFetch("/api/v1/simulate", {
    method: "POST",
    body: JSON.stringify(tx),
  });
}

// ─── Health / Stats ───────────────────────────────────────────

export function getApiHealth(): Promise<{
  status: string;
  version: string;
  engines: string[];
  uptime: number;
}> {
  return apiFetch("/health");
}
