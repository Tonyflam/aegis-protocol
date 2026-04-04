"use client";

import { useEffect, useState } from "react";
import { useScannerData, useTokenLookup } from "../../lib/useScanner";
import type { TokenScan } from "../../lib/useScanner";
import Link from "next/link";
import {
  Search, Shield, AlertTriangle, CheckCircle, Activity,
  ExternalLink, XCircle, Copy, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────

function riskColor(score: number): string {
  if (score >= 70) return "var(--red)";
  if (score >= 40) return "var(--yellow)";
  return "var(--green)";
}

function riskLabel(score: number): string {
  if (score >= 70) return "High Risk";
  if (score >= 40) return "Medium";
  return "Low Risk";
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Example BSC Mainnet tokens for live scanning via GoPlusLabs
const EXAMPLE_TOKENS = [
  { name: "CAKE", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82" },
  { name: "WBNB", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" },
  { name: "USDT", address: "0x55d398326f99059fF775485246999027B3197955" },
  { name: "BUSD", address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" },
];

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ─── Flag Badge ──────────────────────────────────────────────

function FlagBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{
        background: active ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.03)",
        color: active ? "var(--red)" : "var(--text-muted)",
        border: `1px solid ${active ? "rgba(248,113,113,0.2)" : "var(--border-subtle)"}`,
      }}
    >
      {active ? "⚠ " : "✓ "}{label}
    </span>
  );
}

// ─── Scan Result Card ────────────────────────────────────────

function ScanResultCard({ scan, expanded, onToggle }: { scan: TokenScan; expanded: boolean; onToggle: () => void }) {
  const color = riskColor(scan.riskScore);
  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${color} 10%, transparent)` }}>
          {scan.riskScore >= 70 ? <AlertTriangle className="w-4 h-4" style={{ color }} /> :
           scan.riskScore >= 40 ? <Shield className="w-4 h-4" style={{ color }} /> :
           <CheckCircle className="w-4 h-4" style={{ color }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-white">{shortAddr(scan.token)}</span>
            <button onClick={(e) => { e.stopPropagation(); copyToClipboard(scan.token); }}
              className="opacity-40 hover:opacity-100 transition-opacity">
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{timeAgo(scan.scanTimestamp)}</span>
            {scan.isHoneypot && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(248,113,113,0.1)", color: "var(--red)" }}>Honeypot</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold" style={{ color }}>{scan.riskScore}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{riskLabel(scan.riskScore)}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} /> :
                    <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {/* Metrics */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Holders", value: scan.holderCount.toLocaleString() },
              { label: "Top Holder", value: `${(scan.topHolderPercent / 100).toFixed(1)}%` },
              { label: "Liquidity", value: `${parseFloat(scan.liquidity).toFixed(2)} BNB` },
              { label: "Buy Tax", value: `${(scan.buyTax / 100).toFixed(1)}%` },
              { label: "Sell Tax", value: `${(scan.sellTax / 100).toFixed(1)}%` },
              { label: "Version", value: `v${scan.scanVersion}` },
            ].map((m, i) => (
              <div key={i} className="p-2 rounded-lg text-center" style={{ background: "var(--bg-elevated)" }}>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                <p className="text-xs font-mono font-semibold text-white">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-1.5">
            <FlagBadge active={scan.isHoneypot} label="Honeypot" />
            <FlagBadge active={scan.ownerCanMint} label="Mintable" />
            <FlagBadge active={scan.ownerCanPause} label="Pausable" />
            <FlagBadge active={scan.ownerCanBlacklist} label="Blacklist" />
            <FlagBadge active={!scan.isContractRenounced} label="Not Renounced" />
            <FlagBadge active={!scan.isLiquidityLocked} label="LP Unlocked" />
            <FlagBadge active={!scan.isVerified} label="Unverified" />
          </div>

          {/* Links */}
          <div className="flex items-center gap-3 pt-1">
            <Link href={`/scan/${scan.token}`} className="text-[11px] flex items-center gap-1 hover:underline" style={{ color: "var(--accent)" }}>
              Full Report <ExternalLink className="w-2.5 h-2.5" />
            </Link>
            <a href={`https://testnet.bscscan.com/token/${scan.token}`} target="_blank" rel="noopener noreferrer"
              className="text-[11px] flex items-center gap-1 hover:underline" style={{ color: "var(--text-muted)" }}>
              BSCScan <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────

export default function ScannerPage() {
  const { stats, recentScans, loading, isLive, fetchStats } = useScannerData();
  const tokenLookup = useTokenLookup();
  const [query, setQuery] = useState("");
  const [expandedScan, setExpandedScan] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<"all" | "high" | "medium" | "low">("all");

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => {
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length === 42 && trimmed.startsWith("0x")) {
      tokenLookup.lookup(trimmed);
    }
  }

  const filtered = recentScans.filter((s) => {
    if (riskFilter === "high") return s.riskScore >= 70;
    if (riskFilter === "medium") return s.riskScore >= 40 && s.riskScore < 70;
    if (riskFilter === "low") return s.riskScore < 40;
    return true;
  });

  return (
    <div className="min-h-screen relative z-10">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Search className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Token Scanner
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Query the on-chain oracle — real contract data from BSC Testnet
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLive ? (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5"
                style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)" }}>
                <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} /> Live
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-md"
                style={{ background: "rgba(251,191,36,0.08)", color: "var(--yellow)" }}>
                Connecting...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Scans", value: stats.totalScans.toLocaleString(), color: "var(--accent)" },
              { label: "Tokens Tracked", value: stats.totalTokens.toLocaleString(), color: "var(--green)" },
              { label: "Honeypots Found", value: stats.totalHoneypots.toLocaleString(), color: "var(--red)" },
              { label: "Rug Risks", value: stats.totalRugRisks.toLocaleString(), color: "var(--yellow)" },
            ].map((s, i) => (
              <div key={i} className="card p-4">
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
        <form onSubmit={handleSearch} className="card p-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Paste BSC token address (0x...)"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm font-mono bg-transparent outline-none"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              />
            </div>
            <button type="submit" disabled={tokenLookup.loading || query.length !== 42} className="btn-primary flex items-center gap-2">
              {tokenLookup.loading ? "Querying..." : "Scan"}
            </button>
          </div>

          {tokenLookup.error && (
            <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: "var(--red)" }}>
              <XCircle className="w-3.5 h-3.5" /> {tokenLookup.error}
            </div>
          )}

          {/* Example tokens */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Try:</span>
            {EXAMPLE_TOKENS.map((t) => (
              <button key={t.name} onClick={() => { setQuery(t.address); tokenLookup.lookup(t.address); }}
                className="text-[10px] px-2 py-1 rounded-md font-mono hover:opacity-80 transition-opacity"
                style={{ background: "var(--bg-elevated)", color: "var(--accent)", border: "1px solid var(--border-subtle)" }}>
                {t.name}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Lookup Result */}
      {tokenLookup.scan && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4 animate-fade-in">
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Scan Result</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm text-white">{shortAddr(tokenLookup.scan.token)}</p>
                  <button onClick={() => copyToClipboard(tokenLookup.scan!.token)} className="opacity-40 hover:opacity-100">
                    <Copy className="w-3 h-3" />
                  </button>
                  {tokenLookup.safe !== null && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: tokenLookup.safe ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                        color: tokenLookup.safe ? "var(--green)" : "var(--red)",
                      }}>
                      {tokenLookup.safe ? "✓ isTokenSafe = true" : "✗ isTokenSafe = false"}
                    </span>
                  )}
                  {tokenLookup.isLiveScan && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "rgba(139,92,246,0.1)", color: "var(--purple)" }}>
                      Live Scan (GoPlusLabs)
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold" style={{ color: riskColor(tokenLookup.scan.riskScore) }}>{tokenLookup.scan.riskScore}</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{riskLabel(tokenLookup.scan.riskScore)}</p>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
              {[
                { label: "Holders", value: tokenLookup.scan.holderCount.toLocaleString() },
                { label: "Top Holder", value: `${(tokenLookup.scan.topHolderPercent / 100).toFixed(1)}%` },
                { label: "Liquidity", value: `${parseFloat(tokenLookup.scan.liquidity).toFixed(2)} BNB` },
                { label: "Buy Tax", value: `${(tokenLookup.scan.buyTax / 100).toFixed(1)}%` },
                { label: "Sell Tax", value: `${(tokenLookup.scan.sellTax / 100).toFixed(1)}%` },
                { label: "Scan Version", value: `v${tokenLookup.scan.scanVersion}` },
              ].map((m, i) => (
                <div key={i} className="p-2 rounded-lg text-center" style={{ background: "var(--bg-elevated)" }}>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                  <p className="text-xs font-mono font-semibold text-white">{m.value}</p>
                </div>
              ))}
            </div>

            {/* Flags */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              <FlagBadge active={tokenLookup.scan.isHoneypot} label="Honeypot" />
              <FlagBadge active={tokenLookup.scan.ownerCanMint} label="Mintable" />
              <FlagBadge active={tokenLookup.scan.ownerCanPause} label="Pausable" />
              <FlagBadge active={tokenLookup.scan.ownerCanBlacklist} label="Blacklist" />
              <FlagBadge active={!tokenLookup.scan.isContractRenounced} label="Not Renounced" />
              <FlagBadge active={!tokenLookup.scan.isLiquidityLocked} label="LP Unlocked" />
              <FlagBadge active={!tokenLookup.scan.isVerified} label="Unverified" />
            </div>

            {/* Oracle data */}
            {tokenLookup.riskData && (
              <div className="p-3 rounded-lg mb-3" style={{ background: "var(--bg-elevated)" }}>
                <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Oracle Data (IAegisScanner.getTokenRisk)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div><span style={{ color: "var(--text-muted)" }}>Score: </span><span className="font-mono text-white">{tokenLookup.riskData.riskScore}</span></div>
                  <div><span style={{ color: "var(--text-muted)" }}>Updated: </span><span className="font-mono text-white">{timeAgo(tokenLookup.riskData.lastUpdated)}</span></div>
                  <div><span style={{ color: "var(--text-muted)" }}>Attester: </span><span className="font-mono text-white">{shortAddr(tokenLookup.riskData.attestedBy)}</span></div>
                  <div><span style={{ color: "var(--text-muted)" }}>Hash: </span><span className="font-mono text-white">{tokenLookup.riskData.reasoningHash.slice(0, 10)}...</span></div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Link href={`/scan/${tokenLookup.scan.token}`} className="text-[11px] flex items-center gap-1 hover:underline" style={{ color: "var(--accent)" }}>
                Permanent Report Link <ExternalLink className="w-2.5 h-2.5" />
              </Link>
              <button onClick={() => { tokenLookup.clear(); setQuery(""); }} className="text-[11px] hover:underline" style={{ color: "var(--text-muted)" }}>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Scan Feed */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: "var(--accent)" }} />
            Recent Scans
            {isLive && <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} />}
          </h2>
          <div className="flex gap-1">
            {(["all", "high", "medium", "low"] as const).map((f) => (
              <button key={f} onClick={() => setRiskFilter(f)}
                className="text-[10px] font-medium px-2.5 py-1 rounded-md capitalize transition-colors"
                style={{
                  background: riskFilter === f ? "var(--accent-muted)" : "var(--bg-raised)",
                  color: riskFilter === f ? "var(--accent)" : "var(--text-muted)",
                  border: `1px solid ${riskFilter === f ? "var(--accent)" : "var(--border-subtle)"}`,
                }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading && recentScans.length === 0 && (
          <div className="card p-12 text-center">
            <Activity className="w-6 h-6 mx-auto mb-3 animate-pulse" style={{ color: "var(--accent)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading scan data from BSC Testnet...</p>
          </div>
        )}

        {!loading && !isLive && recentScans.length === 0 && (
          <div className="card p-12 text-center">
            <Shield className="w-6 h-6 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>Connecting to AegisScanner oracle...</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Reading from BSC Testnet. If no scans appear, the scan agent service may be offline.
              Use the search bar above to query any token address.
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((scan) => (
              <ScanResultCard
                key={scan.token + scan.scanTimestamp}
                scan={scan}
                expanded={expandedScan === scan.token}
                onToggle={() => setExpandedScan(expandedScan === scan.token ? null : scan.token)}
              />
            ))}
          </div>
        )}

        {isLive && filtered.length === 0 && recentScans.length > 0 && (
          <div className="card p-8 text-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No scans match the &ldquo;{riskFilter}&rdquo; filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
