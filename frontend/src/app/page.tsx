"use client";

import { useEffect, useState, useCallback } from "react";
import { useScannerData, useTokenLookup } from "../lib/useScanner";
import type { TokenScan } from "../lib/useScanner";
import Link from "next/link";
import { CONTRACTS } from "../lib/constants";
import {
  Search, Shield, AlertTriangle, CheckCircle, Activity,
  ExternalLink, XCircle, Copy, ChevronDown, ChevronUp,
  Code2, ArrowRight, Users, Database,
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
          <div className="flex flex-wrap gap-1.5">
            <FlagBadge active={scan.isHoneypot} label="Honeypot" />
            <FlagBadge active={scan.ownerCanMint} label="Mintable" />
            <FlagBadge active={scan.ownerCanPause} label="Pausable" />
            <FlagBadge active={scan.ownerCanBlacklist} label="Blacklist" />
            <FlagBadge active={!scan.isContractRenounced} label="Not Renounced" />
            <FlagBadge active={!scan.isLiquidityLocked} label="LP Unlocked" />
            <FlagBadge active={!scan.isVerified} label="Unverified" />
          </div>
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

export default function Home() {
  const { stats, recentScans, loading, isLive, fetchStats } = useScannerData();
  const tokenLookup = useTokenLookup();
  const [query, setQuery] = useState("");
  const [expandedScan, setExpandedScan] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [manualScanLoading, setManualScanLoading] = useState(false);
  const [manualScanMsg, setManualScanMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [isLive, fetchStats]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setManualScanMsg(null);
    const trimmed = query.trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      tokenLookup.lookup(trimmed);
    }
  }

  const requestManualScan = useCallback(async () => {
    const addr = query.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return;
    setManualScanLoading(true);
    setManualScanMsg(null);
    try {
      const resp = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: addr }),
      });
      const data = await resp.json();
      if (data.success) {
        setManualScanMsg({ ok: true, text: data.message || "Scan submitted — re-query in a few seconds" });
        setTimeout(() => { tokenLookup.lookup(addr); fetchStats(); }, 5000);
      } else {
        setManualScanMsg({ ok: false, text: data.message || "Scan request failed" });
      }
    } catch {
      setManualScanMsg({ ok: false, text: "Scan service unavailable — is scan-service running?" });
    } finally {
      setManualScanLoading(false);
    }
  }, [query, tokenLookup, fetchStats]);

  const filtered = recentScans.filter((s) => {
    if (riskFilter === "high") return s.riskScore >= 70;
    if (riskFilter === "medium") return s.riskScore >= 40 && s.riskScore < 70;
    if (riskFilter === "low") return s.riskScore < 40;
    return true;
  });

  return (
    <div className="min-h-screen relative z-10 flex flex-col overflow-hidden">

      {/* ── HERO + SCANNER ── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-8 w-full">
        <div className="hero-glow" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6 backdrop-blur-sm animate-fade-in"
          style={{ background: "rgba(0,212,245,0.06)", border: "1px solid rgba(0,212,245,0.15)", color: "var(--accent)" }}>
          <Shield className="w-3.5 h-3.5" />
          The Safety Oracle for BNB Chain
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] mb-4 animate-fade-in">
          <span className="text-white">Scan Any Token.</span>
          <br />
          <span className="text-shimmer">Trust the Data.</span>
        </h1>

        <p className="text-base sm:text-lg leading-relaxed mb-8 max-w-2xl animate-fade-in" style={{ color: "var(--text-secondary)" }}>
          Like Chainlink for price feeds — but for token safety. Paste any BNB Chain token address
          and get an instant risk score backed by on-chain oracle data. Any smart contract can
          call <span className="font-mono text-white">isTokenSafe()</span> to query the feed.
        </p>

        {/* Scanner Input — Directly in the Hero */}
        <form onSubmit={handleSearch} className="card p-4 mb-6 animate-fade-in">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Paste BSC token address (0x...)"
                className="w-full pl-10 pr-4 py-3 rounded-lg text-sm font-mono bg-transparent outline-none"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              />
            </div>
            <button type="submit" disabled={tokenLookup.loading || !/^0x[0-9a-fA-F]{40}$/.test(query.trim())} className="btn-primary flex items-center gap-2 text-base px-6">
              {tokenLookup.loading ? "Querying..." : "Scan"}
            </button>
          </div>

          {tokenLookup.error && (
            <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: "var(--red)" }}>
              <XCircle className="w-3.5 h-3.5" /> {tokenLookup.error}
              {tokenLookup.error.toLowerCase().includes("not scanned") && /^0x[0-9a-fA-F]{40}$/.test(query.trim()) && (
                <button
                  onClick={requestManualScan}
                  disabled={manualScanLoading}
                  className="ml-2 px-3 py-1 rounded-md text-[11px] font-medium transition-colors"
                  style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent)" }}
                >
                  {manualScanLoading ? "Requesting..." : "Request Scan"}
                </button>
              )}
            </div>
          )}
          {manualScanMsg && (
            <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: manualScanMsg.ok ? "var(--green)" : "var(--red)" }}>
              {manualScanMsg.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {manualScanMsg.text}
            </div>
          )}
        </form>

        {/* Status badges */}
        <div className="flex items-center gap-3 flex-wrap animate-fade-in">
          {isLive ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
              style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)", border: "1px solid rgba(52,211,153,0.15)" }}>
              <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} /> Oracle Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
              style={{ background: "rgba(251,191,36,0.08)", color: "var(--yellow)", border: "1px solid rgba(251,191,36,0.15)" }}>
              Connecting...
            </span>
          )}
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px]"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
            BSC Testnet · <span className="font-mono text-white">{shortAddr(CONTRACTS.SCANNER)}</span>
          </span>
          <a href={`https://testnet.bscscan.com/address/${CONTRACTS.SCANNER}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] hover:underline"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)", color: "var(--accent)" }}>
            View on BSCScan <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </section>

      {/* ── LOOKUP RESULT ── */}
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
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold" style={{ color: riskColor(tokenLookup.scan.riskScore) }}>{tokenLookup.scan.riskScore}</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{riskLabel(tokenLookup.scan.riskScore)}</p>
              </div>
            </div>
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
            <div className="flex flex-wrap gap-1.5 mb-4">
              <FlagBadge active={tokenLookup.scan.isHoneypot} label="Honeypot" />
              <FlagBadge active={tokenLookup.scan.ownerCanMint} label="Mintable" />
              <FlagBadge active={tokenLookup.scan.ownerCanPause} label="Pausable" />
              <FlagBadge active={tokenLookup.scan.ownerCanBlacklist} label="Blacklist" />
              <FlagBadge active={!tokenLookup.scan.isContractRenounced} label="Not Renounced" />
              <FlagBadge active={!tokenLookup.scan.isLiquidityLocked} label="LP Unlocked" />
              <FlagBadge active={!tokenLookup.scan.isVerified} label="Unverified" />
            </div>
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

      {/* ── STATS ROW ── */}
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

      {/* ── LIVE SCAN FEED ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
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
              Reading from BSC Testnet. Use the search bar above to query any token address.
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

      <div className="section-divider" />

      {/* ── HOW IT WORKS ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 w-full">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--accent)" }}>How It Works</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            A Decentralized <span className="text-gradient">Safety Oracle</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { num: "01", icon: Search, title: "Agents Scan", desc: "Scanner agents analyze token contracts — honeypot traps, tax rates, liquidity locks, whale concentration, mint/pause functions. Results are scored 0–100.", color: "var(--accent)" },
            { num: "02", icon: Users, title: "Consensus Finalizes", desc: "Multiple agent attestations required. Weighted by stake tier. The median score becomes the oracle truth — just like Chainlink aggregates prices.", color: "var(--purple)" },
            { num: "03", icon: Database, title: "Contracts Query", desc: "Any smart contract calls isTokenSafe(address). DEX routers, wallets, and bots integrate with a single line of Solidity. Zero-gas view calls.", color: "var(--green)" },
          ].map((step, i) => (
            <div key={i} className="group relative card p-8 hover:border-[var(--border-hover)] transition-all duration-300">
              <span className="text-[80px] font-bold leading-none absolute top-4 right-6 select-none"
                style={{ color: "rgba(255,255,255,0.02)" }}>{step.num}</span>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: `color-mix(in srgb, ${step.color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${step.color} 15%, transparent)` }}>
                <step.icon className="w-5 h-5" style={{ color: step.color }} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── ONE LINE OF SOLIDITY ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--accent)" }}>Integration</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-4">
              One Line of <span className="text-gradient">Solidity</span>
            </h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
              Any DEX router, wallet contract, or trading bot can gate actions behind the safety oracle.
              If a token hasn&apos;t been scanned or is flagged unsafe, the transaction reverts — just like checking a Chainlink price before executing a trade.
            </p>

            <div className="space-y-3 mb-6">
              {[
                { label: "isTokenSafe(address)", desc: "Boolean — returns true only if scanned and below risk threshold" },
                { label: "getTokenRisk(address)", desc: "Full risk data — score, timestamp, attester, reasoning hash" },
                { label: "getTokenFlags(address)", desc: "Structured flags — honeypot, high tax, unverified, concentrated ownership" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--green)" }} />
                  <div>
                    <p className="text-sm font-mono font-medium text-white">{item.label}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/integrate" className="btn-primary inline-flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              View Integration Guide
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="card p-6 relative overflow-hidden">
            <div className="absolute inset-0 opacity-30"
              style={{ background: "radial-gradient(ellipse at top right, rgba(0,212,245,0.06) 0%, transparent 60%)" }} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-mono px-2 py-1 rounded" style={{ background: "var(--bg-elevated)", color: "var(--accent)" }}>
                  Solidity
                </span>
              </div>
              <pre className="text-xs font-mono leading-relaxed overflow-x-auto" style={{ color: "var(--text-secondary)" }}>
                <code>{`interface IAegisScanner {
    function isTokenSafe(address token)
        external view returns (bool);
}

// Like Chainlink for safety:
modifier aegisSafe(address token) {
    require(
        IAegisScanner(${shortAddr(CONTRACTS.SCANNER)})
            .isTokenSafe(token),
        "Aegis: token flagged unsafe"
    );
    _;
}

function swap(
    address tokenOut,
    uint256 amount
) external aegisSafe(tokenOut) {
    // normal swap logic
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
