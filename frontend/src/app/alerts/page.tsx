"use client";

import { useState, useEffect, useCallback } from "react";
import * as api from "../../lib/api";
import {
  Bell, AlertTriangle, ArrowRight, ExternalLink,
  Loader2, RefreshCw, Filter, TrendingDown,
  ArrowUpRight, Search,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────

function severityColor(s: string) {
  if (s === "CRITICAL") return "var(--red)";
  if (s === "HIGH") return "#f97316";
  if (s === "MEDIUM") return "var(--yellow)";
  return "var(--text-muted)";
}

function severityBg(s: string) {
  if (s === "CRITICAL") return "rgba(248,113,113,0.08)";
  if (s === "HIGH") return "rgba(249,115,22,0.08)";
  if (s === "MEDIUM") return "rgba(251,191,36,0.08)";
  return "rgba(255,255,255,0.03)";
}

function typeIcon(t: string) {
  switch (t) {
    case "WHALE_SELL": return TrendingDown;
    case "EXCHANGE_DEPOSIT": return ArrowUpRight;
    case "LARGE_TRANSFER": return ArrowRight;
    default: return AlertTriangle;
  }
}

function typeLabel(t: string) {
  switch (t) {
    case "WHALE_SELL": return "Whale Sell";
    case "EXCHANGE_DEPOSIT": return "Exchange Deposit";
    case "LARGE_TRANSFER": return "Large Transfer";
    default: return t;
  }
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "—";
}

// ─── Page ─────────────────────────────────────────────────────

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<api.ThreatAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [tokenSearch, setTokenSearch] = useState("");
  const [scanning, setScanning] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getRecentAlerts(100);
      setAlerts(result.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load alerts";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleTokenScan = useCallback(async () => {
    const addr = tokenSearch.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return;
    setScanning(true);
    try {
      const newAlerts = await api.scanTokenThreats(addr);
      if (Array.isArray(newAlerts) && newAlerts.length > 0) {
        setAlerts((prev) => [...newAlerts, ...prev]);
      }
    } catch {
      // silent — alerts page continues with existing data
    } finally {
      setScanning(false);
    }
  }, [tokenSearch]);

  const filteredAlerts = filter === "ALL"
    ? alerts
    : alerts.filter((a) => a.type === filter);

  const types = ["ALL", "WHALE_SELL", "EXCHANGE_DEPOSIT", "LARGE_TRANSFER"];
  const typeCounts: Record<string, number> = {};
  for (const a of alerts) {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  }

  return (
    <div className="min-h-screen relative z-10">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Bell className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Threat Alerts
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Real-time whale movements and suspicious on-chain activity
            </p>
          </div>
          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="btn-secondary flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Token Scan Bar */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-4">
        <div className="card p-3 flex gap-2 items-center">
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={tokenSearch}
            onChange={(e) => setTokenSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTokenScan()}
            placeholder="Monitor a token — paste address to scan for whale activity"
            className="flex-1 bg-transparent outline-none text-sm font-mono"
            style={{ color: "var(--text-primary)" }}
          />
          <button
            onClick={handleTokenScan}
            disabled={scanning || !tokenSearch.trim()}
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
          >
            {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
            Scan
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
          {types.map((t) => {
            const count = t === "ALL" ? alerts.length : (typeCounts[t] || 0);
            const active = filter === t;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                style={{
                  background: active ? "var(--accent-muted)" : "var(--bg-raised)",
                  color: active ? "var(--accent)" : "var(--text-muted)",
                  border: `1px solid ${active ? "var(--accent-border)" : "var(--border-subtle)"}`,
                }}
              >
                {t === "ALL" ? "All" : typeLabel(t)}
                <span className="text-[10px] opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Alert List */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
        {loading && !alerts.length ? (
          <div className="card p-10 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: "var(--accent)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading threat feed...</p>
          </div>
        ) : error ? (
          <div className="card p-6 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--yellow)" }} />
            <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>{error}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Make sure the Aegis API server is running on port 3001
            </p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="card p-10 text-center">
            <Bell className="w-10 h-10 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h3 className="text-base font-semibold text-white mb-2">No alerts yet</h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {filter !== "ALL"
                ? `No ${typeLabel(filter).toLowerCase()} alerts found. Try a different filter.`
                : "Scan a token above or wait for the threat engine to detect activity."
              }
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAlerts.map((alert, idx) => {
              const Icon = typeIcon(alert.type);
              return (
                <div
                  key={alert.id || idx}
                  className="card p-4 transition-colors"
                  style={{ borderLeft: `3px solid ${severityColor(alert.severity)}` }}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: severityBg(alert.severity) }}
                    >
                      <Icon className="w-4 h-4" style={{ color: severityColor(alert.severity) }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-semibold text-white">{typeLabel(alert.type)}</span>
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ background: severityBg(alert.severity), color: severityColor(alert.severity) }}
                        >
                          {alert.severity}
                        </span>
                        {alert.tokenSymbol && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
                            {alert.tokenSymbol}
                          </span>
                        )}
                        <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>
                          {alert.timestamp ? timeAgo(alert.timestamp) : "—"}
                        </span>
                      </div>
                      <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
                        {alert.description}
                      </p>
                      <div className="flex items-center gap-4 text-[11px] font-mono flex-wrap" style={{ color: "var(--text-muted)" }}>
                        {alert.valueUsd > 0 && (
                          <span style={{ color: "var(--text-primary)" }}>
                            ${alert.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        )}
                        <span>From: {shortAddr(alert.fromAddress)}</span>
                        <span>To: {shortAddr(alert.toAddress)}</span>
                        {alert.txHash && (
                          <a
                            href={`https://bscscan.com/tx/${alert.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:underline"
                            style={{ color: "var(--accent)" }}
                          >
                            Tx <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
