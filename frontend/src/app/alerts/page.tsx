"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell, AlertTriangle, ArrowUpRight, ArrowDownRight,
  RefreshCw, Loader2, ExternalLink,
  Repeat, Info,
  Activity,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────

interface WhaleAlert {
  id: string;
  type: "transfer" | "swap" | "liquidity";
  direction: "in" | "out";
  from: string;
  to: string;
  valueUsd: number;
  valueBnb: number;
  tokenSymbol: string;
  txHash: string;
  timestamp: number;
  blockNumber: number;
  fromLabel: string;
  toLabel: string;
}

// ─── Known Addresses ─────────────────────────────────────────

const KNOWN_LABELS: Record<string, string> = {
  "0x631fc1ea2270e98fbd9d92658ece0f5a269aa161": "Binance Hot Wallet",
  "0xb38e8c17e38363af6ebdcb3dae12e0243582891d": "Binance Hot Wallet 2",
  "0x8894e0a0c962cb723c1ef8f1d0dea26f46f2efed": "Binance Hot Wallet 3",
  "0x28c6c06298d514db089934071355e5743bf21d60": "Binance 14",
  "0xf977814e90da44bfa03b6295a0616a897441acec": "Binance Cold Wallet",
  "0x5a52e96bacdabb82fd05763e25335261b270efcb": "Binance Hot Wallet 5",
  "0x161ba15a5f335c9f06bb5bbb0a9ce14076fbb645": "Bitget",
  "0x1ab4973a48dc892cd9971ece8e01dcc7688f8f23": "MEXC",
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549": "Bybit",
  "0x10ed43c718714eb63d5aa57b78b54704e256024e": "PancakeSwap V2",
  "0x13f4ea83d0bd40e75c8222255bc855a974568dd4": "PancakeSwap V3",
  "0x000000000000000000000000000000000000dead": "Burn Address",
};

function getLabel(address: string): string {
  const lower = address.toLowerCase();
  return KNOWN_LABELS[lower] || `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function isExchange(address: string): boolean {
  const lower = address.toLowerCase();
  return [
    "0x631fc1ea", "0xb38e8c17", "0x8894e0a0", "0x28c6c062",
    "0xf977814e", "0x5a52e96b", "0x161ba15a", "0x1ab4973a", "0x21a31ee1",
  ].some((prefix) => lower.startsWith(prefix));
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── BNB Transfer Monitor ────────────────────────────────────
// Fetches real BNB transfers above a threshold from BSC mainnet.

const BSC_RPC = "https://bsc-dataseed1.binance.org";

async function fetchBnbPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd",
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return 600;
    const json = await res.json();
    return json.binancecoin?.usd ?? 600;
  } catch {
    return 600;
  }
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(BSC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    signal: AbortSignal.timeout(10000),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

interface BlockTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string;
}

async function fetchRecentWhaleTransfers(minBnb: number): Promise<WhaleAlert[]> {
  const bnbPrice = await fetchBnbPrice();
  const latestHex = (await rpcCall("eth_blockNumber", [])) as string;
  const latest = parseInt(latestHex, 16);

  const alerts: WhaleAlert[] = [];
  // Scan last 5 blocks (~15 seconds of BSC)
  const blocksToScan = 5;

  const blockPromises = [];
  for (let i = 0; i < blocksToScan; i++) {
    const blockHex = "0x" + (latest - i).toString(16);
    blockPromises.push(
      rpcCall("eth_getBlockByNumber", [blockHex, true]).catch(() => null)
    );
  }

  const blocks = await Promise.all(blockPromises);

  for (const block of blocks) {
    if (!block || !(block as { transactions?: BlockTx[] }).transactions) continue;
    const txs = (block as { timestamp: string; transactions: BlockTx[] }).transactions;
    const blockTs = parseInt((block as { timestamp: string }).timestamp, 16) * 1000;

    for (const tx of txs) {
      if (!tx.value || tx.value === "0x0" || !tx.to) continue;
      const valueBnb = parseInt(tx.value, 16) / 1e18;
      if (valueBnb < minBnb) continue;

      const valueUsd = valueBnb * bnbPrice;
      const fromLabel = getLabel(tx.from);
      const toLabel = getLabel(tx.to);

      alerts.push({
        id: tx.hash,
        type: isExchange(tx.from) || isExchange(tx.to) ? "swap" : "transfer",
        direction: isExchange(tx.to) ? "in" : "out",
        from: tx.from,
        to: tx.to,
        valueUsd,
        valueBnb,
        tokenSymbol: "BNB",
        txHash: tx.hash,
        timestamp: blockTs,
        blockNumber: parseInt(tx.blockNumber, 16),
        fromLabel,
        toLabel,
      });
    }
  }

  return alerts.sort((a, b) => b.valueUsd - a.valueUsd);
}

// ─── Main Page ───────────────────────────────────────────────

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<WhaleAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minValue, setMinValue] = useState<"50k" | "100k" | "500k" | "1m">("100k");
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  const mountedRef = useRef(true);

  const fetchAlerts = useCallback(async (showRefresh = false) => {
    const minBnbMap: Record<string, number> = {
      "50k": 80, "100k": 160, "500k": 800, "1m": 1600,
    };
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const result = await fetchRecentWhaleTransfers(minBnbMap[minValue]);
      if (!mountedRef.current) return;
      setAlerts(result);
      setLastRefresh(Date.now());
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to fetch whale alerts");
    } finally {
      if (!mountedRef.current) return;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [minValue]);

  useEffect(() => {
    mountedRef.current = true;
    fetchAlerts();
    const id = setInterval(() => fetchAlerts(true), 30000); // Auto-refresh every 30s
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchAlerts]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)" }}
            >
              <Bell className="w-5 h-5" style={{ color: "var(--purple)" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Whale Alerts</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Live large BNB transfers on BSC Mainnet
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Min value filter */}
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
              {(["50k", "100k", "500k", "1m"] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setMinValue(val)}
                  className="text-[11px] font-medium px-3 py-1.5 transition-colors"
                  style={{
                    background: minValue === val ? "var(--accent-muted)" : "transparent",
                    color: minValue === val ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  ${val.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              onClick={() => fetchAlerts(true)}
              disabled={isRefreshing}
              className="p-2 rounded-lg transition-colors hover:bg-white/5"
              style={{ border: "1px solid var(--border-subtle)" }}
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--green)" }}>Live — BSC Mainnet</span>
          </div>
          {lastRefresh > 0 && (
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Updated {timeAgo(lastRefresh)}
            </span>
          )}
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Showing transfers &gt; ${minValue.toUpperCase()}
          </span>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        {/* Loading */}
        {isLoading && (
          <div className="card p-10 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: "var(--purple)" }} />
            <p className="text-sm font-medium text-white mb-1">Scanning BSC Blocks...</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Analyzing recent blocks for large BNB transfers
            </p>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div
            className="flex items-start gap-3 p-4 rounded-xl mb-4"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#f87171" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "#f87171" }}>Failed to fetch alerts</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{error}</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && alerts.length === 0 && (
          <div className="card p-10 text-center">
            <Activity className="w-10 h-10 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h3 className="text-lg font-semibold text-white mb-2">No Whale Transfers Found</h3>
            <p className="text-sm max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
              No BNB transfers above ${minValue.toUpperCase()} were found in the last few blocks.
              Try lowering the threshold or wait for new blocks.
            </p>
          </div>
        )}

        {/* Alert List */}
        {!isLoading && alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert) => {
              const toExchange = isExchange(alert.to);
              const fromExchange = isExchange(alert.from);
              const isSellSignal = toExchange;

              return (
                <div
                  key={alert.id}
                  className="card p-4 hover:border-[var(--border-hover)] transition-all duration-200"
                >
                  <div className="flex items-center gap-4">
                    {/* Direction Icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: isSellSignal ? "rgba(239,68,68,0.08)" : fromExchange ? "rgba(16,185,129,0.08)" : "rgba(167,139,250,0.08)",
                        border: `1px solid ${isSellSignal ? "rgba(239,68,68,0.15)" : fromExchange ? "rgba(16,185,129,0.15)" : "rgba(167,139,250,0.15)"}`,
                      }}
                    >
                      {isSellSignal ? (
                        <ArrowUpRight className="w-5 h-5" style={{ color: "#ef4444" }} />
                      ) : fromExchange ? (
                        <ArrowDownRight className="w-5 h-5" style={{ color: "#10b981" }} />
                      ) : (
                        <Repeat className="w-5 h-5" style={{ color: "var(--purple)" }} />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold text-white">
                          {formatUsd(alert.valueUsd)}
                        </span>
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                          ({alert.valueBnb.toFixed(2)} BNB)
                        </span>
                        {isSellSignal && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                            EXCHANGE DEPOSIT
                          </span>
                        )}
                        {fromExchange && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                            EXCHANGE WITHDRAWAL
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <span className={fromExchange ? "font-semibold" : "font-mono"} style={fromExchange ? { color: "var(--accent)" } : undefined}>
                          {alert.fromLabel}
                        </span>
                        <ArrowUpRight className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                        <span className={toExchange ? "font-semibold" : "font-mono"} style={toExchange ? { color: "#f87171" } : undefined}>
                          {alert.toLabel}
                        </span>
                      </div>
                    </div>

                    {/* Right Side */}
                    <div className="text-right shrink-0">
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {timeAgo(alert.timestamp)}
                      </p>
                      <a
                        href={`https://bscscan.com/tx/${alert.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-medium inline-flex items-center gap-0.5 mt-1"
                        style={{ color: "var(--accent)" }}
                      >
                        View TX <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info Banner */}
        <div className="mt-6 flex items-start gap-2 px-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Whale alerts are detected from real BSC mainnet block data via public RPC.
            Exchange deposits may signal upcoming sell pressure. Exchange withdrawals may signal accumulation.
            Refreshes automatically every 30 seconds.
          </p>
        </div>
      </section>
    </div>
  );
}
