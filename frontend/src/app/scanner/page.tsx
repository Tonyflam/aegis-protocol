"use client";

import { useState, useCallback } from "react";
import {
  Search, Shield, AlertTriangle, CheckCircle, XCircle,
  Loader2, ExternalLink, Copy,
  Lock, Droplets, Code2, Skull,
  ChevronDown, ChevronUp, Info,
} from "lucide-react";

// ─── Types (matches API response) ────────────────────────────

interface TokenScanResult {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  riskScore: number;
  recommendation: "SAFE" | "CAUTION" | "AVOID" | "SCAM";
  flags: string[];
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  isOpenSource: boolean;
  isProxy: boolean;
  isRenounced: boolean;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  canTakeBackOwnership: boolean;
  hasHiddenOwner: boolean;
  ownerAddress: string;
  creatorAddress: string;
  holderCount: number;
  topHolderPercent: number;
  liquidityUsd: number;
  lpHolderCount: number;
  lpTotalLocked: number;
  isLpLocked: boolean;
  sources: { name: string; status: "ok" | "failed"; detail?: string }[];
  scanTimestamp: number;
  scanDuration: number;
}

// ─── Helpers ─────────────────────────────────────────────────

const RISK_CONFIG = {
  SAFE: { color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)", label: "Safe" },
  CAUTION: { color: "#eab308", bg: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.2)", label: "Caution" },
  AVOID: { color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)", label: "Avoid" },
  SCAM: { color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", label: "Scam" },
};

const FLAG_LABELS: Record<string, { label: string; severity: "critical" | "high" | "medium" | "low" }> = {
  HONEYPOT: { label: "Honeypot Detected", severity: "critical" },
  CANNOT_SELL_ALL: { label: "Cannot Sell All Tokens", severity: "critical" },
  SELF_DESTRUCT: { label: "Self-Destruct Function", severity: "critical" },
  EXTREME_TAX: { label: "Extreme Tax (>50%)", severity: "critical" },
  RECLAIM_OWNERSHIP: { label: "Can Reclaim Ownership", severity: "high" },
  HIDDEN_OWNER: { label: "Hidden Owner", severity: "high" },
  MINTABLE: { label: "Mintable Supply", severity: "high" },
  HIGH_TAX: { label: "High Tax (>10%)", severity: "high" },
  NO_LIQUIDITY: { label: "No Liquidity", severity: "high" },
  WHALE_DOMINATED: { label: "Whale Dominated (>50%)", severity: "high" },
  NOT_OPEN_SOURCE: { label: "Source Not Verified", severity: "high" },
  LOW_LIQUIDITY: { label: "Low Liquidity (<$10K)", severity: "medium" },
  LP_NOT_LOCKED: { label: "LP Not Locked", severity: "medium" },
  PAUSABLE: { label: "Transfers Pausable", severity: "medium" },
  BLACKLIST: { label: "Blacklist Function", severity: "medium" },
  PROXY_CONTRACT: { label: "Proxy Contract", severity: "medium" },
  TAX_MODIFIABLE: { label: "Tax Can Be Changed", severity: "medium" },
  HIGH_CONCENTRATION: { label: "High Concentration (>30%)", severity: "medium" },
  EXTERNAL_CALL: { label: "External Calls", severity: "low" },
  MODERATE_TAX: { label: "Moderate Tax (>5%)", severity: "low" },
};

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical": return "#ef4444";
    case "high": return "#f97316";
    case "medium": return "#eab308";
    case "low": return "#a1a1aa";
    default: return "#a1a1aa";
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Components ──────────────────────────────────────────────

function RiskScoreBadge({ score, recommendation }: { score: number; recommendation: string }) {
  const config = RISK_CONFIG[recommendation as keyof typeof RISK_CONFIG] || RISK_CONFIG.CAUTION;
  return (
    <div
      className="w-32 h-32 rounded-2xl flex flex-col items-center justify-center shrink-0"
      style={{ background: config.bg, border: `2px solid ${config.border}` }}
    >
      <span className="text-5xl font-bold" style={{ color: config.color }}>{score}</span>
      <span className="text-xs font-semibold mt-1" style={{ color: config.color }}>{config.label.toUpperCase()}</span>
    </div>
  );
}

function SecurityCheck({ label, safe, tooltip }: { label: string; safe: boolean; tooltip?: string }) {
  return (
    <div className="flex items-center gap-2 py-2">
      {safe ? (
        <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "#10b981" }} />
      ) : (
        <XCircle className="w-4 h-4 shrink-0" style={{ color: "#f87171" }} />
      )}
      <span className="text-sm" style={{ color: safe ? "var(--text-secondary)" : "var(--text-primary)" }}>{label}</span>
      {tooltip && (
        <span title={tooltip}>
          <Info className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
        </span>
      )}
    </div>
  );
}

function DataSourceBadge({ source }: { source: { name: string; status: "ok" | "failed"; detail?: string } }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded"
      style={{
        background: source.status === "ok" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
        color: source.status === "ok" ? "#10b981" : "#f87171",
      }}
      title={source.detail}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: source.status === "ok" ? "#10b981" : "#f87171" }}
      />
      {source.name}
    </span>
  );
}

// ─── Main Page ───────────────────────────────────────────────

export default function ScannerPage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<TokenScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleScan = useCallback(async () => {
    const address = input.trim();
    if (!address) return;

    // Basic validation
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      setError("Invalid address. Enter a valid BSC token contract address (0x...).");
      return;
    }

    setIsScanning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Scan failed (HTTP ${res.status})`);
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — please try again.");
    } finally {
      setIsScanning(false);
    }
  }, [input]);

  const handleCopyAddress = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isScanning) handleScan();
    },
    [handleScan, isScanning]
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 pb-8">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}
          >
            <Search className="w-5 h-5" style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Token Scanner</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Scan any BSC token for honeypots, rug pulls, and security risks
            </p>
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-8">
        <div
          className="flex items-center gap-2 p-2 rounded-xl"
          style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}
        >
          <Search className="w-5 h-5 ml-2 shrink-0" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste BSC token address (0x...)"
            className="flex-1 bg-transparent text-sm font-mono text-white placeholder:text-[var(--text-muted)] outline-none py-2"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            onClick={handleScan}
            disabled={isScanning || !input.trim()}
            className="btn-primary flex items-center gap-2 !px-5 !py-2.5 shrink-0"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Scan
              </>
            )}
          </button>
        </div>

        {/* Quick Examples */}
        {!result && !isScanning && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Try:</span>
            {[
              { label: "$CAKE", addr: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82" },
              { label: "$UNIQ", addr: "0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777" },
            ].map((ex) => (
              <button
                key={ex.addr}
                onClick={() => { setInput(ex.addr); setError(null); }}
                className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors hover:border-[var(--border-hover)]"
                style={{ background: "var(--bg-elevated)", color: "var(--accent)", border: "1px solid var(--border-subtle)" }}
              >
                {ex.label}
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="mt-4 flex items-start gap-3 p-4 rounded-xl"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#f87171" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "#f87171" }}>Scan Failed</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{error}</p>
            </div>
          </div>
        )}
      </section>

      {/* Loading State */}
      {isScanning && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-12">
          <div className="card p-10 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: "var(--accent)" }} />
            <p className="text-sm font-medium text-white mb-2">Scanning Token...</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Checking GoPlusLabs, honeypot.is, and BSC on-chain data
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              {["GoPlusLabs", "honeypot.is", "BSC RPC"].map((src) => (
                <span
                  key={src}
                  className="text-[10px] font-medium px-2 py-0.5 rounded animate-pulse"
                  style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                >
                  {src}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Results */}
      {result && !isScanning && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 space-y-4">
          {/* ── Token Header + Risk Score ── */}
          <div className="card p-6">
            <div className="flex items-start gap-6 flex-wrap sm:flex-nowrap">
              <RiskScoreBadge score={result.riskScore} recommendation={result.recommendation} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className="text-xl font-bold text-white">{result.name}</h2>
                  <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>${result.symbol}</span>
                  {result.isHoneypot && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
                      HONEYPOT
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                    {truncateAddress(result.address)}
                  </span>
                  <button onClick={handleCopyAddress} className="p-0.5 rounded hover:bg-white/5 transition-colors" title="Copy address">
                    <Copy className="w-3 h-3" style={{ color: copied ? "#10b981" : "var(--text-muted)" }} />
                  </button>
                  <a
                    href={`https://bscscan.com/token/${result.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-medium px-2 py-0.5 rounded transition-colors"
                    style={{ color: "var(--accent)", background: "var(--accent-muted)" }}
                  >
                    BSCScan <ExternalLink className="w-2.5 h-2.5 inline" />
                  </a>
                </div>

                {/* Key Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Buy Tax", value: `${result.buyTax.toFixed(1)}%`, warn: result.buyTax > 5 },
                    { label: "Sell Tax", value: `${result.sellTax.toFixed(1)}%`, warn: result.sellTax > 5 },
                    { label: "Liquidity", value: `$${formatNumber(result.liquidityUsd)}`, warn: result.liquidityUsd < 10000 },
                    { label: "Holders", value: result.holderCount > 0 ? formatNumber(result.holderCount) : "N/A", warn: false },
                  ].map((s) => (
                    <div key={s.label} className="p-2.5 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                      <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                      <p className="text-sm font-semibold" style={{ color: s.warn ? "#f97316" : "var(--text-primary)" }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Data Sources */}
            <div className="mt-4 pt-4 flex items-center gap-2 flex-wrap" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Data from:</span>
              {result.sources.map((src) => (
                <DataSourceBadge key={src.name} source={src} />
              ))}
              <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>
                Scanned in {result.scanDuration}ms
              </span>
            </div>
          </div>

          {/* ── Risk Flags ── */}
          {result.flags.length > 0 && (
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: "#f97316" }} />
                Risk Flags ({result.flags.length})
              </h3>
              <div className="space-y-2">
                {result.flags
                  .sort((a, b) => {
                    const order = { critical: 0, high: 1, medium: 2, low: 3 };
                    const sa = FLAG_LABELS[a]?.severity ?? "low";
                    const sb = FLAG_LABELS[b]?.severity ?? "low";
                    return order[sa] - order[sb];
                  })
                  .map((flag) => {
                    const info = FLAG_LABELS[flag] || { label: flag, severity: "low" };
                    const color = getSeverityColor(info.severity);
                    return (
                      <div
                        key={flag}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{ background: `${color}08`, border: `1px solid ${color}20` }}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                        <span className="text-xs font-medium" style={{ color }}>{info.severity.toUpperCase()}</span>
                        <span className="text-sm" style={{ color: "var(--text-primary)" }}>{info.label}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ── No Flags = Clean ── */}
          {result.flags.length === 0 && (
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5" style={{ color: "#10b981" }} />
                <div>
                  <p className="text-sm font-medium text-white">No Risk Flags Detected</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    This token passed all security checks. Always do your own research.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Security Details (Expandable) ── */}
          <div className="card overflow-hidden">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-white/[0.01] transition-colors"
            >
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Shield className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Security Details
              </h3>
              {showDetails ? (
                <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              ) : (
                <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              )}
            </button>

            {showDetails && (
              <div className="px-6 pb-6 pt-0">
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-0">
                  {/* Contract Security */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                      <Code2 className="w-3 h-3" />Contract Security
                    </p>
                    <SecurityCheck label="Source Code Verified" safe={result.isOpenSource} />
                    <SecurityCheck label="Ownership Renounced" safe={result.isRenounced} />
                    <SecurityCheck label="No Mint Function" safe={!result.ownerCanMint} />
                    <SecurityCheck label="No Pause Function" safe={!result.ownerCanPause} />
                    <SecurityCheck label="No Blacklist Function" safe={!result.ownerCanBlacklist} />
                    <SecurityCheck label="Cannot Reclaim Ownership" safe={!result.canTakeBackOwnership} />
                    <SecurityCheck label="No Hidden Owner" safe={!result.hasHiddenOwner} />
                    <SecurityCheck label="Not a Proxy" safe={!result.isProxy} />
                  </div>

                  {/* Liquidity & Holders */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                      <Droplets className="w-3 h-3" />Liquidity & Holders
                    </p>
                    <SecurityCheck
                      label={`Liquidity: $${formatNumber(result.liquidityUsd)}`}
                      safe={result.liquidityUsd >= 10000}
                    />
                    <SecurityCheck
                      label={`LP Locked: ${result.lpTotalLocked.toFixed(1)}%`}
                      safe={result.isLpLocked}
                    />
                    <SecurityCheck
                      label={`Top Holder: ${result.topHolderPercent.toFixed(1)}%`}
                      safe={result.topHolderPercent < 30}
                    />
                    <SecurityCheck
                      label={`Buy Tax: ${result.buyTax.toFixed(1)}%`}
                      safe={result.buyTax <= 5}
                    />
                    <SecurityCheck
                      label={`Sell Tax: ${result.sellTax.toFixed(1)}%`}
                      safe={result.sellTax <= 5}
                    />
                    {result.holderCount > 0 && (
                      <SecurityCheck
                        label={`Holders: ${formatNumber(result.holderCount)}`}
                        safe={result.holderCount >= 100}
                      />
                    )}
                    {result.lpHolderCount > 0 && (
                      <SecurityCheck
                        label={`LP Holders: ${result.lpHolderCount}`}
                        safe={result.lpHolderCount >= 5}
                      />
                    )}
                  </div>
                </div>

                {/* Addresses */}
                {(result.ownerAddress || result.creatorAddress) && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Addresses</p>
                    <div className="space-y-1.5">
                      {result.ownerAddress && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Owner:</span>
                          <a
                            href={`https://bscscan.com/address/${result.ownerAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono hover:underline"
                            style={{ color: result.isRenounced ? "#10b981" : "var(--accent)" }}
                          >
                            {result.isRenounced ? "Renounced (0x000...)" : truncateAddress(result.ownerAddress)}
                          </a>
                        </div>
                      )}
                      {result.creatorAddress && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Creator:</span>
                          <a
                            href={`https://bscscan.com/address/${result.creatorAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono hover:underline"
                            style={{ color: "var(--accent)" }}
                          >
                            {truncateAddress(result.creatorAddress)}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Disclaimer ── */}
          <div className="flex items-start gap-2 px-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Risk scores are calculated from real-time data provided by GoPlusLabs and honeypot.is.
              No analysis is 100% accurate — always do your own research before investing.
              A low risk score does not guarantee safety.
            </p>
          </div>
        </section>
      )}

      {/* Empty State */}
      {!result && !isScanning && !error && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
          <div className="card p-10 text-center">
            <Search className="w-10 h-10 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h3 className="text-lg font-semibold text-white mb-2">Scan Any BSC Token</h3>
            <p className="text-sm max-w-md mx-auto mb-6" style={{ color: "var(--text-secondary)" }}>
              Paste a token contract address above to check for honeypots, high taxes,
              liquidity risks, and contract vulnerabilities. All data is fetched live from
              GoPlusLabs, honeypot.is, and BSC on-chain.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 max-w-lg mx-auto">
              {[
                { icon: Skull, label: "Honeypot Check", desc: "Simulated sell test" },
                { icon: Droplets, label: "Liquidity Depth", desc: "PancakeSwap LP analysis" },
                { icon: Lock, label: "Contract Audit", desc: "Mint, pause, blacklist" },
              ].map((f) => (
                <div key={f.label} className="p-3 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                  <f.icon className="w-4 h-4 mx-auto mb-2" style={{ color: "var(--accent)" }} />
                  <p className="text-xs font-medium text-white">{f.label}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
