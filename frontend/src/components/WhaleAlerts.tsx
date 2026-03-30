"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  AlertTriangle,
  TrendingDown,
  ArrowRightLeft,
  Droplets,
  Skull,
  Shield,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────

export type AlertType =
  | "WHALE_SELL"
  | "WHALE_MOVE"
  | "LIQUIDITY_REMOVE"
  | "LARGE_TRANSFER"
  | "EXCHANGE_DEPOSIT"
  | "RUG_SIGNAL"
  | "HONEYPOT_DETECTED"
  | "HIGH_RISK_TOKEN";

export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface WhaleAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  token: string;
  tokenSymbol: string;
  from: string;
  to: string;
  amount: string;
  percentOfSupply: number;
  message: string;
  timestamp: number;
  txHash?: string;
}

// ─── Mock Alert Generator (simulates real-time whale alerts) ──

const SAMPLE_TOKENS = [
  { symbol: "CAKE", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82" },
  { symbol: "DOGE", address: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43" },
  { symbol: "FLOKI", address: "0xfb5B838b6cfEEdC2873aB27866079AC55363D37E" },
  { symbol: "SHIB", address: "0x2859e4544C4bB03966803b044A93563Bd2D0DD4D" },
  { symbol: "PEPE", address: "0x25d887Ce7a35172C62FeBFD67a1856F20FaEbB00" },
  { symbol: "BABYDOGE", address: "0xc748673057861a797275CD8A068AbB95A902e8de" },
];

const ALERT_TEMPLATES: { type: AlertType; severity: AlertSeverity; msg: string }[] = [
  { type: "WHALE_SELL", severity: "HIGH", msg: "Whale sold {amount} {symbol} via PancakeSwap" },
  { type: "EXCHANGE_DEPOSIT", severity: "MEDIUM", msg: "Large deposit to Binance: {amount} {symbol}" },
  { type: "LARGE_TRANSFER", severity: "MEDIUM", msg: "Whale transferred {amount} {symbol} to new wallet" },
  { type: "LIQUIDITY_REMOVE", severity: "CRITICAL", msg: "Liquidity removed: {amount} {symbol} LP withdrawn" },
  { type: "RUG_SIGNAL", severity: "CRITICAL", msg: "Potential rug: {symbol} liquidity dropped >50% in 1h" },
  { type: "WHALE_MOVE", severity: "LOW", msg: "Top holder moved {amount} {symbol} between wallets" },
];

function generateAlert(): WhaleAlert {
  const token = SAMPLE_TOKENS[Math.floor(Math.random() * SAMPLE_TOKENS.length)];
  const template = ALERT_TEMPLATES[Math.floor(Math.random() * ALERT_TEMPLATES.length)];
  const amount = (Math.random() * 1000000 + 10000).toFixed(0);
  const percent = Math.random() * 5 + 0.5;

  return {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: template.type,
    severity: template.severity,
    token: token.address,
    tokenSymbol: token.symbol,
    from: `0x${Math.random().toString(16).slice(2, 42).padEnd(40, "0")}`,
    to: `0x${Math.random().toString(16).slice(2, 42).padEnd(40, "0")}`,
    amount,
    percentOfSupply: percent,
    message: template.msg.replace("{amount}", Number(amount).toLocaleString()).replace("{symbol}", token.symbol),
    timestamp: Date.now(),
  };
}

// ─── Helpers ───────────────────────────────────────────────────

function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case "CRITICAL": return "#ef4444";
    case "HIGH": return "#f97316";
    case "MEDIUM": return "#eab308";
    case "LOW": return "#3b82f6";
    case "INFO": return "#6b7280";
  }
}

function getSeverityBg(severity: AlertSeverity): string {
  switch (severity) {
    case "CRITICAL": return "rgba(239,68,68,0.1)";
    case "HIGH": return "rgba(249,115,22,0.1)";
    case "MEDIUM": return "rgba(234,179,8,0.1)";
    case "LOW": return "rgba(59,130,246,0.1)";
    case "INFO": return "rgba(107,114,128,0.1)";
  }
}

function getAlertIcon(type: AlertType) {
  switch (type) {
    case "WHALE_SELL": return TrendingDown;
    case "EXCHANGE_DEPOSIT": return ArrowRightLeft;
    case "LARGE_TRANSFER": return ArrowRightLeft;
    case "LIQUIDITY_REMOVE": return Droplets;
    case "RUG_SIGNAL": return Skull;
    case "WHALE_MOVE": return ArrowRightLeft;
    case "HONEYPOT_DETECTED": return Skull;
    case "HIGH_RISK_TOKEN": return AlertTriangle;
  }
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ═══════════════════════════════════════════════════════════════
// Component: WhaleAlerts
// ═══════════════════════════════════════════════════════════════

export default function WhaleAlerts() {
  const [alerts, setAlerts] = useState<WhaleAlert[]>([]);
  const [filter, setFilter] = useState<AlertSeverity | "ALL">("ALL");
  const [isLive, setIsLive] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [criticalCount, setCriticalCount] = useState(0);

  // Generate initial alerts + simulate real-time feed
  useEffect(() => {
    // Generate some initial alerts
    const initial: WhaleAlert[] = [];
    for (let i = 0; i < 8; i++) {
      const alert = generateAlert();
      alert.timestamp = Date.now() - (i * 45000 + Math.random() * 30000);
      initial.push(alert);
    }
    setAlerts(initial);
    setCriticalCount(initial.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH").length);
  }, []);

  // Simulate real-time feed
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      const newAlert = generateAlert();
      setAlerts((prev) => [newAlert, ...prev].slice(0, 50));
      if (newAlert.severity === "CRITICAL" || newAlert.severity === "HIGH") {
        setCriticalCount((prev) => prev + 1);
      }
    }, 15000 + Math.random() * 25000);
    return () => clearInterval(interval);
  }, [isLive]);

  const filteredAlerts = filter === "ALL" ? alerts : alerts.filter((a) => a.severity === filter);

  return (
    <div className="space-y-6">
      {/* Header + Stats */}
      <div className="glass-card glow-border p-6" style={{ borderRadius: "16px" }}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#00e0ff]" />
            Whale &amp; Risk Alerts
            {isLive && (
              <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-live" />
                LIVE
              </span>
            )}
          </h4>
          <div className="flex items-center gap-3">
            {criticalCount > 0 && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                <AlertTriangle className="w-3 h-3" />
                {criticalCount} Critical
              </span>
            )}
            <button
              onClick={() => setIsLive(!isLive)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                isLive
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
              }`}
            >
              {isLive ? "Live" : "Paused"}
            </button>
          </div>
        </div>

        {/* Alert Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: "Total Alerts", value: alerts.length, color: "#00e0ff" },
            { label: "Critical", value: alerts.filter((a) => a.severity === "CRITICAL").length, color: "#ef4444" },
            { label: "High Risk", value: alerts.filter((a) => a.severity === "HIGH").length, color: "#f97316" },
            { label: "Tokens Tracked", value: new Set(alerts.map((a) => a.token)).size, color: "#a855f7" },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-lg text-center" style={{ background: `${s.color}08`, borderLeft: `3px solid ${s.color}` }}>
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                filter === f
                  ? "bg-[#00e0ff]/10 text-[#00e0ff] border border-[#00e0ff]/20"
                  : "text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Alert Feed */}
      <div className="space-y-2">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => {
            const Icon = getAlertIcon(alert.type);
            const isExpanded = expanded === alert.id;

            return (
              <div
                key={alert.id}
                className="glass-card overflow-hidden transition-all duration-200 hover:border-opacity-50"
                style={{
                  borderRadius: "12px",
                  borderLeft: `3px solid ${getSeverityColor(alert.severity)}`,
                  background: alert.severity === "CRITICAL" ? "rgba(239,68,68,0.03)" : undefined,
                }}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : alert.id)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  {/* Icon */}
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: getSeverityBg(alert.severity) }}
                  >
                    <Icon className="w-4 h-4" style={{ color: getSeverityColor(alert.severity) }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{
                          background: getSeverityBg(alert.severity),
                          color: getSeverityColor(alert.severity),
                        }}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-xs text-gray-500">{alert.tokenSymbol}</span>
                      <span className="text-xs text-gray-600">·</span>
                      <span className="text-xs text-gray-500">{timeAgo(alert.timestamp)}</span>
                    </div>
                  </div>

                  {/* Expand */}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  )}
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <p className="text-xs text-gray-500">Token</p>
                        <p className="text-sm font-mono text-white">{alert.tokenSymbol}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Amount</p>
                        <p className="text-sm font-mono text-white">{Number(alert.amount).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">% of Supply</p>
                        <p className={`text-sm font-mono ${alert.percentOfSupply > 2 ? "text-red-400" : "text-yellow-400"}`}>
                          {alert.percentOfSupply.toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Type</p>
                        <p className="text-sm font-mono text-gray-300">{alert.type.replace(/_/g, " ")}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">From</p>
                        <p className="text-xs font-mono text-gray-400 truncate">{alert.from}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">To</p>
                        <p className="text-xs font-mono text-gray-400 truncate">{alert.to}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <a
                        href={`https://bscscan.com/token/${alert.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
                        style={{ background: "rgba(0,224,255,0.08)", color: "#00e0ff", border: "1px solid rgba(0,224,255,0.15)" }}
                      >
                        View Token <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="glass-card glow-border p-12 text-center" style={{ borderRadius: "16px" }}>
            <Shield className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No alerts matching your filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
