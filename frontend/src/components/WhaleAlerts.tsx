"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import {
  Bell,
  AlertTriangle,
  TrendingDown,
  ArrowRightLeft,
  Droplets,
  Shield,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Filter,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────

export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface WhaleAlert {
  id: string;
  severity: AlertSeverity;
  token: string;
  tokenSymbol: string;
  from: string;
  to: string;
  amountRaw: string;
  amountFormatted: string;
  usdValue: number;
  message: string;
  timestamp: number;
  txHash: string;
  blockNumber: number;
}

// ─── Tracked Tokens (real BSC Mainnet addresses) ──────────────

const TRACKED_TOKENS = [
  { symbol: "WBNB", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", decimals: 18, priceUsd: 0 },
  { symbol: "CAKE", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", decimals: 18, priceUsd: 0 },
  { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, priceUsd: 1 },
  { symbol: "BUSD", address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", decimals: 18, priceUsd: 1 },
  { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18, priceUsd: 1 },
];

// Minimum USD value to qualify as a "whale" transfer
const WHALE_THRESHOLD_USD = 50_000;

// Known exchange hot wallets (partial list for labeling)
const KNOWN_ADDRESSES: Record<string, string> = {
  "0x8894e0a0c962cb723c1ef8a1b63d28aaa26e8f6f": "Binance Hot Wallet",
  "0xe2fc31f816a9b94326492132018c3aecc4a93ae1": "Binance Hot Wallet 2",
  "0xf977814e90da44bfa03b6295a0616a897441acec": "Binance Cold Wallet",
  "0x28c6c06298d514db089934071355e5743bf21d60": "Binance 14",
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549": "Binance 15",
  "0x3c783c21a0383057d128bae431894a5c19f9cf06": "PancakeSwap Router",
};

// ERC-20 Transfer event signature
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

// BSC Mainnet providers — PublicNode primary (supports getLogs), others as fallback
const BSC_RPCS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed2.binance.org",
  "https://bsc-dataseed3.binance.org",
  "https://bsc-dataseed1.defibit.io",
  "https://bsc-dataseed2.defibit.io",
];

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

function getAlertIcon(usdValue: number) {
  if (usdValue >= 10_000_000) return TrendingDown;
  if (usdValue >= 1_000_000) return AlertTriangle;
  if (usdValue >= 500_000) return Droplets;
  return ArrowRightLeft;
}

function classifySeverity(usdValue: number): AlertSeverity {
  if (usdValue >= 5_000_000) return "CRITICAL";
  if (usdValue >= 500_000) return "HIGH";
  if (usdValue >= 100_000) return "MEDIUM";
  return "LOW";
}

function labelAddress(addr: string): string {
  const known = KNOWN_ADDRESSES[addr.toLowerCase()];
  if (known) return known;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

// ─── Fetch real whale transfers from BSC ───────────────────────

let rpcIndex = 0;

function getProvider(): ethers.JsonRpcProvider {
  const url = BSC_RPCS[rpcIndex % BSC_RPCS.length];
  return new ethers.JsonRpcProvider(url, 56, { staticNetwork: true });
}

function rotateRpc(): void {
  rpcIndex = (rpcIndex + 1) % BSC_RPCS.length;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchLogsWithRetry(
  provider: ethers.JsonRpcProvider,
  filter: ethers.Filter,
  maxRetries = 4
): Promise<ethers.Log[]> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await provider.getLogs(filter);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes("rate limit") || msg.includes("-32005") || msg.includes("Too Many") || msg.includes("BAD_DATA");
      if (isRateLimit && attempt < maxRetries - 1) {
        rotateRpc();
        provider = getProvider();
        await sleep(1500 * (attempt + 1)); // backoff: 1.5s, 3s, 4.5s
        continue;
      }
      throw err;
    }
  }
  return [];
}

async function fetchWhaleTransfers(bnbPrice: number): Promise<WhaleAlert[]> {
  let provider = getProvider();
  const latestBlock = await provider.getBlockNumber();
  // Scan last ~200 blocks (~10 minutes on BSC)
  const fromBlock = latestBlock - 200;

  const tokenMap = new Map(TRACKED_TOKENS.map((t) => [t.address.toLowerCase(), t]));

  // Update WBNB price from live data
  const wbnbToken = TRACKED_TOKENS.find((t) => t.symbol === "WBNB");
  if (wbnbToken) wbnbToken.priceUsd = bnbPrice;
  // CAKE approximate — a dedicated price feed could improve this
  const cakeToken = TRACKED_TOKENS.find((t) => t.symbol === "CAKE");
  if (cakeToken) cakeToken.priceUsd = 2.5;

  // Query each token individually to avoid batch rate limits
  const allLogs: ethers.Log[] = [];
  for (const token of TRACKED_TOKENS) {
    try {
      const logs = await fetchLogsWithRetry(provider, {
        fromBlock,
        toBlock: latestBlock,
        topics: [TRANSFER_TOPIC],
        address: token.address,
      });
      allLogs.push(...logs);
    } catch {
      // Skip this token on persistent failure, continue with others
      console.warn(`[WhaleAlerts] Failed to fetch logs for ${token.symbol}, skipping`);
    }
    // Small delay between per-token queries to stay under rate limits
    await sleep(300);
    // Re-get provider in case it was rotated during retry
    provider = getProvider();
  }

  const alerts: WhaleAlert[] = [];

  for (const log of allLogs) {
    const tokenInfo = tokenMap.get(log.address.toLowerCase());
    if (!tokenInfo) continue;

    const from = "0x" + log.topics[1].slice(26);
    const to = "0x" + log.topics[2].slice(26);
    const amountRaw = BigInt(log.data);
    const amountFormatted = Number(ethers.formatUnits(amountRaw, tokenInfo.decimals));

    const usdValue = amountFormatted * tokenInfo.priceUsd;

    // Only include whale-sized transfers
    if (usdValue < WHALE_THRESHOLD_USD) continue;

    const severity = classifySeverity(usdValue);
    const fromLabel = labelAddress(from);
    const toLabel = labelAddress(to);

    alerts.push({
      id: `${log.transactionHash}-${log.index}`,
      severity,
      token: tokenInfo.address,
      tokenSymbol: tokenInfo.symbol,
      from,
      to,
      amountRaw: amountRaw.toString(),
      amountFormatted: amountFormatted.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      usdValue,
      message: `${amountFormatted.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${tokenInfo.symbol} transferred (${formatUsd(usdValue)}) — ${fromLabel} → ${toLabel}`,
      timestamp: Date.now(),
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
    });
  }

  // Sort by USD value descending
  alerts.sort((a, b) => b.usdValue - a.usdValue);
  return alerts;
}

// ═══════════════════════════════════════════════════════════════
// Component: WhaleAlerts
// ═══════════════════════════════════════════════════════════════

export default function WhaleAlerts({ bnbPrice }: { bnbPrice: number }) {
  const [alerts, setAlerts] = useState<WhaleAlert[]>([]);
  const [filter, setFilter] = useState<AlertSeverity | "ALL">("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const price = bnbPrice > 0 ? bnbPrice : 600;
      const newAlerts = await fetchWhaleTransfers(price);

      setAlerts((prev) => {
        const existing = new Map(prev.map((a) => [a.id, a]));
        for (const alert of newAlerts) {
          existing.set(alert.id, alert);
        }
        return Array.from(existing.values())
          .sort((a, b) => b.usdValue - a.usdValue)
          .slice(0, 100);
      });
      setLastFetch(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch whale transfers from BSC");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bnbPrice]);

  // Initial fetch
  useEffect(() => {
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh every 60s
  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(fetchAlerts, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchAlerts]);

  const filteredAlerts = filter === "ALL" ? alerts : alerts.filter((a) => a.severity === filter);
  const criticalCount = alerts.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH").length;

  return (
    <div className="space-y-6">
      {/* Header + Stats */}
      <div className="card p-6" style={{ borderRadius: "12px" }}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-[color:var(--accent)]" />
            Whale &amp; Risk Alerts
            <span className="text-xs px-2 py-1 rounded-md bg-[var(--accent)]/10 text-[color:var(--accent)] border border-[var(--accent)]/20">
              BSC Mainnet
            </span>
          </h4>
          <div className="flex items-center gap-3">
            {criticalCount > 0 && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                <AlertTriangle className="w-3 h-3" />
                {criticalCount} Critical/High
              </span>
            )}
            <button
              onClick={fetchAlerts}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg transition-all bg-[var(--accent)]/10 text-[color:var(--accent)] border border-[var(--accent)]/20 hover:bg-[var(--accent)]/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 inline mr-1 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Scanning..." : "Refresh"}
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                autoRefresh
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
              }`}
            >
              {autoRefresh ? <Wifi className="w-3 h-3 inline mr-1" /> : <WifiOff className="w-3 h-3 inline mr-1" />}
              {autoRefresh ? "Auto" : "Paused"}
            </button>
          </div>
        </div>

        {/* Data Source Notice */}
        <div className="flex items-center gap-2 mb-4 p-2 rounded-lg" style={{ background: "rgba(0,224,255,0.04)", border: "1px solid var(--accent-muted)" }}>
          <Shield className="w-3 h-3 text-[color:var(--accent)] flex-shrink-0" />
          <p className="text-xs text-gray-400">
            Scanning real ERC-20 Transfer events on BSC Mainnet (last ~200 blocks). Minimum threshold: ${WHALE_THRESHOLD_USD.toLocaleString()}.
            {lastFetch && <span className="text-gray-500"> Last scan: {timeAgo(lastFetch)}</span>}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Alert Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: "Whale Transfers", value: alerts.length, color: "var(--accent)" },
            { label: "Critical", value: alerts.filter((a) => a.severity === "CRITICAL").length, color: "#ef4444" },
            { label: "High Risk", value: alerts.filter((a) => a.severity === "HIGH").length, color: "#f97316" },
            { label: "Tokens Tracked", value: TRACKED_TOKENS.length, color: "#a855f7" },
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
                  ? "bg-[var(--accent)]/10 text-[color:var(--accent)] border border-[var(--accent)]/20"
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
        {loading && alerts.length === 0 ? (
          <div className="card p-12 text-center" style={{ borderRadius: "12px" }}>
            <RefreshCw className="w-8 h-8 text-[color:var(--accent)] mx-auto mb-3 animate-spin" />
            <p className="text-gray-400">Scanning BSC Mainnet for whale transfers...</p>
            <p className="text-xs text-gray-500 mt-1">Checking last ~200 blocks for large ERC-20 transfers</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="card p-12 text-center" style={{ borderRadius: "12px" }}>
            <Shield className="w-8 h-8 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">
              {filter !== "ALL"
                ? `No ${filter} severity alerts found`
                : "No whale transfers detected in recent blocks"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {filter !== "ALL"
                ? "Try selecting a different filter"
                : `No transfers above $${(WHALE_THRESHOLD_USD / 1000).toFixed(0)}K in the last ~10 minutes. This is normal during low activity periods.`}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const Icon = getAlertIcon(alert.usdValue);
            const isExpanded = expanded === alert.id;

            return (
              <div
                key={alert.id}
                className="card overflow-hidden transition-all duration-200 hover:border-opacity-50"
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
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: getSeverityBg(alert.severity) }}
                  >
                    <Icon className="w-4 h-4" style={{ color: getSeverityColor(alert.severity) }} />
                  </div>
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
                      <span className="text-xs text-gray-600">&middot;</span>
                      <span className="text-xs text-gray-500">Block #{alert.blockNumber}</span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <p className="text-xs text-gray-500">Token</p>
                        <p className="text-sm font-mono text-gray-300">{alert.tokenSymbol}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">USD Value</p>
                        <p className="text-sm font-mono text-gray-300">{formatUsd(alert.usdValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">From</p>
                        <p className="text-sm font-mono text-gray-300" title={alert.from}>
                          {labelAddress(alert.from)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">To</p>
                        <p className="text-sm font-mono text-gray-300" title={alert.to}>
                          {labelAddress(alert.to)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Amount</p>
                        <p className="text-sm font-mono text-gray-300">{alert.amountFormatted} {alert.tokenSymbol}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Block</p>
                        <p className="text-sm font-mono text-gray-300">#{alert.blockNumber}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                      <a
                        href={`https://bscscan.com/tx/${alert.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-[color:var(--accent)] hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View on BSCScan: {alert.txHash.slice(0, 16)}...{alert.txHash.slice(-8)}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
