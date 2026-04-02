"use client";

import { useState, useCallback } from "react";
import { useWalletContext } from "../../lib/WalletContext";
import * as api from "../../lib/api";
import {
  Search, Shield, AlertTriangle, CheckCircle,
  ExternalLink, Loader2, XCircle, Lock, Unlock,
  Skull, Droplets, Eye, Copy, Check,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Helpers ──────────────────────────────────────────────────

function riskColor(score: number) {
  if (score >= 70) return "var(--red)";
  if (score >= 40) return "var(--yellow)";
  return "var(--green)";
}

function riskLabel(score: number) {
  if (score >= 70) return "HIGH RISK";
  if (score >= 40) return "MEDIUM";
  return "LOW RISK";
}

function riskBg(score: number) {
  if (score >= 70) return "rgba(248,113,113,0.08)";
  if (score >= 40) return "rgba(251,191,36,0.08)";
  return "rgba(52,211,153,0.08)";
}

// ─── Page ─────────────────────────────────────────────────────

export default function ScannerPage() {
  useWalletContext();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<api.TokenRiskReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleScan = useCallback(async () => {
    const addr = input.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      toast.error("Enter a valid BSC token address (0x...)");
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const result = await api.scanToken(addr);
      setReport(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [input]);

  const copyAddress = useCallback(() => {
    if (!report) return;
    navigator.clipboard.writeText(report.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [report]);

  return (
    <div className="min-h-screen relative z-10">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Search className="w-6 h-6" style={{ color: "var(--accent)" }} />
          Token Scanner
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Scan any BSC token for honeypot traps, rug-pull risks, and contract dangers
        </p>
      </div>

      {/* Search Box */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-6">
        <div className="card p-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                placeholder="Enter BSC token address (0x...)"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm font-mono bg-transparent outline-none"
                style={{
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <button
              onClick={handleScan}
              disabled={loading || !input.trim()}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              {loading ? "Scanning..." : "Scan Token"}
            </button>
          </div>
          {/* Quick scan buttons */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Quick scan:</span>
            {[
              { label: "WBNB", addr: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" },
              { label: "BUSD", addr: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" },
              { label: "CAKE", addr: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82" },
              { label: "$UNIQ", addr: "0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777" },
            ].map((t) => (
              <button
                key={t.label}
                onClick={() => { setInput(t.addr); }}
                className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors"
                style={{
                  background: "var(--accent-muted)",
                  color: "var(--accent)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-6">
          <div className="card p-4 flex items-center gap-3" style={{ borderColor: "rgba(248,113,113,0.3)" }}>
            <XCircle className="w-5 h-5 shrink-0" style={{ color: "var(--red)" }} />
            <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {report && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-10 space-y-4">
          {/* Risk Score Header */}
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-white">{report.name || "Unknown Token"}</span>
                  <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>{report.symbol}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                    {report.address.slice(0, 10)}...{report.address.slice(-8)}
                  </span>
                  <button onClick={copyAddress} className="p-0.5 rounded hover:opacity-70 transition-opacity">
                    {copied ? (
                      <Check className="w-3 h-3" style={{ color: "var(--green)" }} />
                    ) : (
                      <Copy className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                    )}
                  </button>
                  <a
                    href={`https://bscscan.com/token/${report.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-0.5"
                  >
                    <ExternalLink className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                  </a>
                </div>
              </div>
              {/* Score Circle */}
              <div
                className="flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 shrink-0"
                style={{ borderColor: riskColor(report.riskScore) }}
              >
                <span className="text-2xl font-bold" style={{ color: riskColor(report.riskScore) }}>
                  {report.riskScore}
                </span>
                <span className="text-[9px] font-medium" style={{ color: riskColor(report.riskScore) }}>
                  {riskLabel(report.riskScore)}
                </span>
              </div>
            </div>

            {/* Honeypot Warning */}
            {report.isHoneypot && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg mb-4"
                style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}
              >
                <Skull className="w-5 h-5 shrink-0" style={{ color: "var(--red)" }} />
                <div>
                  <span className="text-sm font-semibold" style={{ color: "var(--red)" }}>HONEYPOT DETECTED</span>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    This token prevents selling. You will lose your funds if you buy it.
                  </p>
                </div>
              </div>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Buy Tax", value: `${report.buyTax.toFixed(1)}%`, bad: report.buyTax > 10 },
                { label: "Sell Tax", value: `${report.sellTax.toFixed(1)}%`, bad: report.sellTax > 10 },
                { label: "Liquidity", value: report.liquidityUsd >= 1e6 ? `$${(report.liquidityUsd / 1e6).toFixed(2)}M` : report.liquidityUsd >= 1e3 ? `$${(report.liquidityUsd / 1e3).toFixed(1)}K` : `$${report.liquidityUsd.toFixed(0)}`, bad: report.liquidityUsd < 10000 },
                { label: "Holders", value: report.holderCount.toLocaleString(), bad: report.holderCount < 50 },
              ].map((m, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: "var(--bg-base)" }}>
                  <span className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>{m.label}</span>
                  <span className="text-base font-semibold font-mono" style={{ color: m.bad ? "var(--red)" : "var(--text-primary)" }}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Security Checks */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" style={{ color: "var(--accent)" }} />
              Security Checks
            </h3>
            <div className="space-y-2">
              {[
                { label: "Honeypot", pass: !report.isHoneypot, icon: Skull },
                { label: "Verified Source Code", pass: report.isVerified, icon: Eye },
                { label: "Ownership Renounced", pass: report.isRenounced, icon: report.isRenounced ? Lock : Unlock },
                { label: "Liquidity Locked", pass: report.liquidityLocked, icon: Lock },
                { label: "No Mint Function", pass: !report.ownerCanMint, icon: AlertTriangle },
                { label: "No Pause Function", pass: !report.ownerCanPause, icon: AlertTriangle },
                { label: "No Blacklist", pass: !report.ownerCanBlacklist, icon: AlertTriangle },
                { label: "No Proxy Contract", pass: !report.hasProxy, icon: Eye },
                { label: "Top Holder < 20%", pass: report.topHolderPercent < 20, icon: Droplets },
              ].map((check, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-lg"
                  style={{ background: check.pass ? "rgba(52,211,153,0.04)" : "rgba(248,113,113,0.04)" }}
                >
                  <div className="flex items-center gap-2">
                    <check.icon className="w-3.5 h-3.5" style={{ color: check.pass ? "var(--green)" : "var(--red)" }} />
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{check.label}</span>
                  </div>
                  {check.pass ? (
                    <CheckCircle className="w-4 h-4" style={{ color: "var(--green)" }} />
                  ) : (
                    <XCircle className="w-4 h-4" style={{ color: "var(--red)" }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Flags */}
          {report.flags.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: "var(--yellow)" }} />
                Risk Flags
              </h3>
              <div className="flex flex-wrap gap-2">
                {report.flags.map((flag, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-md"
                    style={{ background: riskBg(60), color: "var(--yellow)" }}
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Scanned At */}
          <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
            Scanned {new Date(report.scannedAt).toLocaleString()} · Data from Honeypot.is + GoPlus + PancakeSwap
          </p>
        </div>
      )}

      {/* Empty State */}
      {!report && !loading && !error && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-10">
          <div className="card p-10 text-center">
            <Search className="w-10 h-10 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h3 className="text-base font-semibold text-white mb-2">Scan any BSC token</h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              Paste a token contract address to check for honeypots, rug pulls,
              malicious functions, and other on-chain dangers.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap text-[11px]" style={{ color: "var(--text-muted)" }}>
              {[
                "Honeypot Detection",
                "Tax Analysis",
                "Ownership Audit",
                "Liquidity Check",
                "Holder Distribution",
              ].map((f) => (
                <span key={f} className="flex items-center gap-1 px-2.5 py-1 rounded-md" style={{ background: "var(--bg-elevated)" }}>
                  <CheckCircle className="w-3 h-3" style={{ color: "var(--accent)" }} /> {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
