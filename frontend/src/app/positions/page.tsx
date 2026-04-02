"use client";

import { useState, useEffect, useCallback } from "react";
import { useWalletContext } from "../../lib/WalletContext";
import * as api from "../../lib/api";
import {
  Eye, Shield, AlertTriangle, CheckCircle, Wallet,
  Loader2, RefreshCw, ExternalLink, Lock, Unlock,
  TrendingUp, Skull, Search,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Helpers ──────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 80) return "var(--green)";
  if (s >= 50) return "var(--yellow)";
  return "var(--red)";
}

function gradeColor(g: string) {
  if (g === "A" || g === "A+") return "var(--green)";
  if (g === "B" || g === "B+") return "#34d399";
  if (g === "C" || g === "C+") return "var(--yellow)";
  return "var(--red)";
}

function riskBadge(score: number) {
  if (score >= 70) return { label: "HIGH", color: "var(--red)", bg: "rgba(248,113,113,0.08)" };
  if (score >= 40) return { label: "MED", color: "var(--yellow)", bg: "rgba(251,191,36,0.08)" };
  return { label: "LOW", color: "var(--green)", bg: "rgba(52,211,153,0.08)" };
}

// ─── Page ─────────────────────────────────────────────────────

export default function PositionsPage() {
  const { address, isConnected } = useWalletContext();
  const [inputAddr, setInputAddr] = useState("");
  const [loading, setLoading] = useState(false);
  const [portfolio, setPortfolio] = useState<api.PortfolioHealth | null>(null);
  const [approvals, setApprovals] = useState<api.ApprovalScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetAddress = inputAddr.trim() || address || "";

  const fetchData = useCallback(async (addr: string) => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return;
    setLoading(true);
    setError(null);
    try {
      const [portfolioRes, approvalsRes] = await Promise.allSettled([
        api.getPortfolioHealth(addr),
        api.scanApprovals(addr),
      ]);
      if (portfolioRes.status === "fulfilled") setPortfolio(portfolioRes.value);
      if (approvalsRes.status === "fulfilled") setApprovals(approvalsRes.value);
      if (portfolioRes.status === "rejected" && approvalsRes.status === "rejected") {
        throw new Error("Failed to load portfolio data");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch when wallet connected
  useEffect(() => {
    if (address) fetchData(address);
  }, [address, fetchData]);

  const score = portfolio?.securityScore;
  const snap = portfolio?.portfolio;

  return (
    <div className="min-h-screen relative z-10">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Eye className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Positions
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Portfolio health, token holdings, and approval management
            </p>
          </div>
          {snap && (
            <button
              onClick={() => fetchData(targetAddress)}
              disabled={loading}
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Address Input */}
      {!isConnected && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-4">
          <div className="card p-3 flex gap-2 items-center">
            <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              value={inputAddr}
              onChange={(e) => setInputAddr(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchData(inputAddr.trim())}
              placeholder="Enter any BSC wallet address to view positions..."
              className="flex-1 bg-transparent outline-none text-sm font-mono"
              style={{ color: "var(--text-primary)" }}
            />
            <button
              onClick={() => fetchData(inputAddr.trim())}
              disabled={loading || !inputAddr.trim()}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
              View
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !snap && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
          <div className="card p-10 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: "var(--accent)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Scanning wallet...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !snap && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
          <div className="card p-6 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--yellow)" }} />
            <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>{error}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Make sure the Aegis API server is running on port 3001
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!snap && !loading && !error && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
          <div className="card p-10 text-center">
            <Wallet className="w-10 h-10 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h3 className="text-base font-semibold text-white mb-2">View your portfolio security</h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {isConnected
                ? "Loading your wallet data..."
                : "Connect your wallet or enter any BSC address to see token holdings, risk scores, and approval status."
              }
            </p>
          </div>
        </div>
      )}

      {/* Portfolio Data */}
      {snap && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-10 space-y-4">
          {/* Security Score + Summary */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Score Card */}
            {score && (
              <div className="card p-5 flex flex-col items-center justify-center text-center">
                <div
                  className="w-24 h-24 rounded-full border-3 flex flex-col items-center justify-center mb-3"
                  style={{ borderColor: scoreColor(score.overallScore), borderWidth: "3px" }}
                >
                  <span className="text-3xl font-bold" style={{ color: scoreColor(score.overallScore) }}>
                    {score.overallScore}
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: scoreColor(score.overallScore) }}>
                    / 100
                  </span>
                </div>
                <span
                  className="text-lg font-bold mb-1"
                  style={{ color: gradeColor(score.grade) }}
                >
                  Grade {score.grade}
                </span>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Security Score</span>
              </div>
            )}

            {/* Score Breakdown */}
            {score && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  Score Breakdown
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Token Safety", value: score.breakdown.tokenSafety, weight: "30%" },
                    { label: "Approval Hygiene", value: score.breakdown.approvalHygiene, weight: "25%" },
                    { label: "Tx Patterns", value: score.breakdown.transactionPatterns, weight: "15%" },
                    { label: "Exposure Risk", value: score.breakdown.exposureRisk, weight: "15%" },
                    { label: "History", value: score.breakdown.historicalBehavior, weight: "15%" },
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {item.label} <span className="opacity-60">({item.weight})</span>
                        </span>
                        <span className="text-[11px] font-mono" style={{ color: scoreColor(item.value) }}>
                          {item.value}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-base)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.value}%`, background: scoreColor(item.value) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Portfolio Summary */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Portfolio Summary
              </h3>
              <div className="space-y-0">
                {[
                  { label: "Wallet", value: `${snap.wallet.slice(0, 6)}...${snap.wallet.slice(-4)}` },
                  { label: "BNB Balance", value: `${parseFloat(snap.bnbBalance).toFixed(4)} BNB` },
                  { label: "BNB Value", value: `$${snap.bnbValueUsd.toFixed(2)}` },
                  { label: "Tokens Held", value: snap.tokens.length.toString() },
                  { label: "Total Value", value: `$${snap.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
                  { label: "Overall Risk", value: `${snap.overallRisk}/100`, color: snap.overallRisk >= 50 ? "var(--red)" : snap.overallRisk >= 25 ? "var(--yellow)" : "var(--green)" },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between py-2 text-xs" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <span style={{ color: "var(--text-muted)" }}>{row.label}</span>
                    <span className="font-mono" style={{ color: row.color || "var(--text-primary)" }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Token Holdings */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Eye className="w-4 h-4" style={{ color: "var(--accent)" }} />
              Token Holdings ({snap.tokens.length})
            </h3>
            {snap.tokens.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
                No tokens found in this wallet
              </p>
            ) : (
              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider pb-2" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
                  <div className="col-span-4">Token</div>
                  <div className="col-span-2 text-right">Balance</div>
                  <div className="col-span-2 text-right">Value</div>
                  <div className="col-span-2 text-right">Risk</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>
                {snap.tokens.map((token, i) => {
                  const badge = riskBadge(token.riskScore);
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-12 gap-2 items-center py-2.5 text-xs"
                      style={{ borderBottom: "1px solid var(--border-subtle)" }}
                    >
                      <div className="col-span-4 flex items-center gap-2 min-w-0">
                        <span className="font-medium text-white truncate">{token.symbol}</span>
                        <a
                          href={`https://bscscan.com/token/${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                        </a>
                      </div>
                      <div className="col-span-2 text-right font-mono" style={{ color: "var(--text-secondary)" }}>
                        {parseFloat(token.balance).toFixed(2)}
                      </div>
                      <div className="col-span-2 text-right font-mono text-white">
                        ${token.balanceUsd.toFixed(2)}
                      </div>
                      <div className="col-span-2 text-right">
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ background: badge.bg, color: badge.color }}
                        >
                          {token.riskScore} {badge.label}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        {token.isHoneypot ? (
                          <span className="flex items-center justify-end gap-1 text-[10px]" style={{ color: "var(--red)" }}>
                            <Skull className="w-3 h-3" /> Honeypot
                          </span>
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5 ml-auto" style={{ color: "var(--green)" }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Token Approvals */}
          {approvals && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Token Approvals ({approvals.totalApprovals})
                {approvals.riskyApprovals > 0 && (
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded ml-1"
                    style={{ background: "rgba(248,113,113,0.08)", color: "var(--red)" }}
                  >
                    {approvals.riskyApprovals} risky
                  </span>
                )}
              </h3>
              {approvals.approvals.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
                  No token approvals found
                </p>
              ) : (
                <div className="space-y-2">
                  {approvals.approvals.map((appr, i) => {
                    const isRisky = appr.riskLevel === "HIGH" || appr.riskLevel === "CRITICAL";
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{
                          background: isRisky ? "rgba(248,113,113,0.04)" : "var(--bg-base)",
                          border: `1px solid ${isRisky ? "rgba(248,113,113,0.15)" : "var(--border-subtle)"}`,
                        }}
                      >
                        {appr.isUnlimited ? (
                          <Unlock className="w-4 h-4 shrink-0" style={{ color: "var(--red)" }} />
                        ) : (
                          <Lock className="w-4 h-4 shrink-0" style={{ color: "var(--green)" }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-white">{appr.tokenSymbol}</span>
                            <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                              → {appr.spenderLabel || `${appr.spender.slice(0, 8)}...${appr.spender.slice(-4)}`}
                            </span>
                          </div>
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {appr.isUnlimited ? "Unlimited approval" : `Allowance: ${appr.allowance}`}
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            background: isRisky ? "rgba(248,113,113,0.08)" : appr.riskLevel === "MEDIUM" ? "rgba(251,191,36,0.08)" : "rgba(52,211,153,0.08)",
                            color: isRisky ? "var(--red)" : appr.riskLevel === "MEDIUM" ? "var(--yellow)" : "var(--green)",
                          }}
                        >
                          {appr.riskLevel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Threat Alerts for this wallet */}
          {portfolio?.alerts && portfolio.alerts.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: "var(--yellow)" }} />
                Active Alerts ({portfolio.alerts.length})
              </h3>
              <div className="space-y-2">
                {portfolio.alerts.slice(0, 10).map((alert, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: "rgba(251,191,36,0.04)" }}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--yellow)" }} />
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{alert.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
            Last scanned: {new Date(snap.scannedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
