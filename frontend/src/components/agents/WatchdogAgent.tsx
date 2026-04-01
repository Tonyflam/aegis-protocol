"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import { useWalletContext } from "../../lib/WalletContext";

import {
  Eye,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  Loader2,
  Info,
  Activity,
  DollarSign,
  ArrowDown,
  ArrowUp,
  Star,
  StarOff,
  Shield,
  Zap,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Watchdog Agent — Protocol Health Monitor
// Monitors TVL, health, and security of BSC DeFi protocols.
// Tracks user positions and alerts on significant changes.
// ═══════════════════════════════════════════════════════════════

// ─── Types ─────────────────────────────────────────────────────

interface Protocol {
  id: string;
  name: string;
  slug: string;
  symbol: string;
  tvl: number;
  tvlChange1d: number;
  tvlChange7d: number;
  category: string;
  chains: string[];
  logo: string;
  url: string;
  isWatched: boolean;
  healthScore: number;
  healthLevel: "HEALTHY" | "CAUTION" | "WARNING" | "DANGER";
}

interface UserPosition {
  protocol: string;
  tokenSymbol: string;
  tokenAddress: string;
  balance: string;
  valueUsd: number;
}

// ─── Constants ─────────────────────────────────────────────────

const BSC_RPC = "https://bsc-rpc.publicnode.com";
const WATCHLIST_KEY = "aegis_watchdog_watchlist";

// Protocol-specific tokens to check for user positions
const PROTOCOL_TOKENS: { protocol: string; tokens: { address: string; symbol: string; decimals: number; priceUsd: number }[] }[] = [
  {
    protocol: "Venus",
    tokens: [
      { address: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63", symbol: "XVS", decimals: 18, priceUsd: 8 },
      { address: "0xA07c5b74C9B40447a954e1466938b865b6BBea36", symbol: "vBNB", decimals: 8, priceUsd: 600 },
      { address: "0xfD5840Cd36d94D7229439859C0112a4185BC0255", symbol: "vUSDT", decimals: 8, priceUsd: 1 },
      { address: "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8", symbol: "vUSDC", decimals: 8, priceUsd: 1 },
    ],
  },
  {
    protocol: "PancakeSwap",
    tokens: [
      { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", symbol: "CAKE", decimals: 18, priceUsd: 2.5 },
    ],
  },
  {
    protocol: "Alpaca Finance",
    tokens: [
      { address: "0x8F0528cE5eF7B51152A59745bEfDD91D97091d2F", symbol: "ALPACA", decimals: 18, priceUsd: 0.2 },
    ],
  },
  {
    protocol: "Beefy Finance",
    tokens: [
      { address: "0xCa3F508B8e4Dd382eE878A314789373D80A5190A", symbol: "BIFI", decimals: 18, priceUsd: 300 },
    ],
  },
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// ─── Helpers ───────────────────────────────────────────────────

function formatTvl(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function getHealthScore(tvl: number, change1d: number, change7d: number): { score: number; level: Protocol["healthLevel"] } {
  let score = 100;

  // TVL size factor
  if (tvl < 100_000) score -= 30;
  else if (tvl < 1_000_000) score -= 15;
  else if (tvl < 10_000_000) score -= 5;

  // 1-day change factor
  if (change1d < -20) score -= 40;
  else if (change1d < -10) score -= 25;
  else if (change1d < -5) score -= 10;
  else if (change1d < 0) score -= 3;

  // 7-day change factor
  if (change7d < -30) score -= 25;
  else if (change7d < -15) score -= 15;
  else if (change7d < -5) score -= 5;

  score = Math.max(0, Math.min(100, score));
  const level: Protocol["healthLevel"] =
    score >= 80 ? "HEALTHY" :
    score >= 60 ? "CAUTION" :
    score >= 40 ? "WARNING" : "DANGER";

  return { score, level };
}

function getHealthColor(level: string): string {
  switch (level) {
    case "HEALTHY": return "#22c55e";
    case "CAUTION": return "#eab308";
    case "WARNING": return "#f97316";
    case "DANGER": return "#ef4444";
    default: return "#6b7280";
  }
}

function loadWatchlist(): Set<string> {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveWatchlist(list: Set<string>): void {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...list]));
}

// ─── Data Fetching ─────────────────────────────────────────────

async function fetchBscProtocols(): Promise<Protocol[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch("https://api.llama.fi/protocols", { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();

    const watchlist = loadWatchlist();

    // Filter to BSC protocols with meaningful TVL
    const bscProtocols = data
      .filter((p: Record<string, unknown>) => {
        const chains = p.chains as string[] | undefined;
        if (!chains || !chains.some((c: string) => c.toLowerCase() === "bsc" || c.toLowerCase() === "binance")) return false;
        const tvl = Number(p.tvl) || 0;
        return tvl > 10_000;
      })
      .map((p: Record<string, unknown>): Protocol => {
        const tvl = Number(p.tvl) || 0;
        const change1d = Number(p.change_1d) || 0;
        const change7d = Number(p.change_7d) || 0;
        const health = getHealthScore(tvl, change1d, change7d);

        return {
          id: String(p.id || ""),
          name: String(p.name || ""),
          slug: String(p.slug || ""),
          symbol: String(p.symbol || ""),
          tvl,
          tvlChange1d: change1d,
          tvlChange7d: change7d,
          category: String(p.category || "Other"),
          chains: (p.chains as string[]) || [],
          logo: String(p.logo || ""),
          url: String(p.url || ""),
          isWatched: watchlist.has(String(p.slug || "")),
          healthScore: health.score,
          healthLevel: health.level,
        };
      })
      .sort((a: Protocol, b: Protocol) => b.tvl - a.tvl)
      .slice(0, 50); // Top 50

    return bscProtocols;
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

async function detectUserPositions(walletAddress: string): Promise<UserPosition[]> {
  const provider = new ethers.JsonRpcProvider(BSC_RPC, 56, { staticNetwork: true });
  const positions: UserPosition[] = [];

  for (const proto of PROTOCOL_TOKENS) {
    for (const token of proto.tokens) {
      try {
        const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
        const balance = await contract.balanceOf(walletAddress);
        if (balance > 0n) {
          const formatted = Number(ethers.formatUnits(balance, token.decimals));
          positions.push({
            protocol: proto.protocol,
            tokenSymbol: token.symbol,
            tokenAddress: token.address,
            balance: formatted.toLocaleString(undefined, { maximumFractionDigits: 4 }),
            valueUsd: formatted * token.priceUsd,
          });
        }
      } catch {
        // Skip failed checks
      }
    }
  }

  return positions;
}

// ═══════════════════════════════════════════════════════════════
// Component: WatchdogAgent
// ═══════════════════════════════════════════════════════════════

export default function WatchdogAgent({}: { bnbPrice: number }) {
  const { address, isConnected } = useWalletContext();

  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "WATCHED" | "DANGER" | "CAUTION">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const initialLoadDone = useRef(false);

  // Auto-load on mount
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check positions when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      handleCheckPositions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  const handleRefresh = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchBscProtocols();
      if (data.length === 0) {
        setError("Failed to fetch protocol data");
      } else {
        setProtocols(data);
        setLastRefresh(Date.now());
      }
    } catch {
      setError("Failed to connect to DeFiLlama API");
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const handleCheckPositions = useCallback(async () => {
    if (!address || positionsLoading) return;
    setPositionsLoading(true);
    try {
      const pos = await detectUserPositions(address);
      setPositions(pos);
    } catch {
      // Silently fail for position detection
    } finally {
      setPositionsLoading(false);
    }
  }, [address, positionsLoading]);

  const toggleWatch = useCallback((slug: string) => {
    setProtocols((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, isWatched: !p.isWatched } : p)),
    );
    const watchlist = loadWatchlist();
    if (watchlist.has(slug)) {
      watchlist.delete(slug);
    } else {
      watchlist.add(slug);
    }
    saveWatchlist(watchlist);
  }, []);

  // Derived data
  const filteredProtocols = protocols
    .filter((p) => {
      if (filter === "WATCHED") return p.isWatched;
      if (filter === "DANGER") return p.healthLevel === "DANGER";
      if (filter === "CAUTION") return p.healthLevel === "CAUTION" || p.healthLevel === "WARNING";
      return true;
    })
    .filter((p) => {
      if (!searchQuery) return true;
      return p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             p.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    });

  const dangerCount = protocols.filter((p) => p.healthLevel === "DANGER").length;
  const watchedCount = protocols.filter((p) => p.isWatched).length;
  const totalTvl = protocols.reduce((s, p) => s + p.tvl, 0);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="card p-6" style={{ borderRadius: "12px" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
              <Eye className="w-5 h-5" style={{ color: "#3b82f6" }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Watchdog Agent</h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Protocol Health Monitor — TVL & Risk Tracker</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="text-xs px-4 py-2 rounded-lg transition-all flex items-center gap-1.5"
            style={{ background: "rgba(59,130,246,0.08)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.15)" }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {lastRefresh && (
          <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "rgba(59,130,246,0.03)", border: "1px solid rgba(59,130,246,0.08)" }}>
            <Info className="w-3 h-3 flex-shrink-0" style={{ color: "#3b82f6" }} />
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Monitoring {protocols.length} BSC protocols · Data from DeFiLlama · Updated {new Date(lastRefresh).toLocaleTimeString()}
            </p>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.1)" }}>
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {protocols.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4" style={{ borderRadius: "12px", borderLeft: "3px solid #3b82f6" }}>
            <p className="text-2xl font-bold text-white">{protocols.length}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Protocols</p>
          </div>
          <div className="card p-4" style={{ borderRadius: "12px", borderLeft: "3px solid #22c55e" }}>
            <p className="text-2xl font-bold text-white">{formatTvl(totalTvl)}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total BSC TVL</p>
          </div>
          <div className="card p-4" style={{ borderRadius: "12px", borderLeft: `3px solid ${dangerCount > 0 ? "#ef4444" : "#22c55e"}` }}>
            <p className="text-2xl font-bold" style={{ color: dangerCount > 0 ? "#ef4444" : "#22c55e" }}>{dangerCount}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Danger Alerts</p>
          </div>
          <div className="card p-4" style={{ borderRadius: "12px", borderLeft: "3px solid #eab308" }}>
            <p className="text-2xl font-bold text-white">{watchedCount}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Watching</p>
          </div>
        </div>
      )}

      {/* User Positions */}
      {isConnected && positions.length > 0 && (
        <div className="card p-5" style={{ borderRadius: "12px", borderLeft: "3px solid var(--accent)" }}>
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: "var(--accent)" }} />
            Your DeFi Positions
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {positions.map((pos) => (
              <div key={pos.tokenAddress} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(0,0,0,0.3)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,224,255,0.06)" }}>
                  <DollarSign className="w-4 h-4" style={{ color: "var(--accent)" }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">{pos.tokenSymbol}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{pos.protocol}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-white">{pos.balance}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    ~${pos.valueUsd > 1000 ? `${(pos.valueUsd / 1000).toFixed(1)}K` : pos.valueUsd.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search */}
      {protocols.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            {(["ALL", "WATCHED", "DANGER", "CAUTION"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all ${filter === f ? "border" : "border border-transparent"}`}
                style={filter === f ? {
                  background: f === "ALL" ? "rgba(59,130,246,0.08)" :
                              f === "WATCHED" ? "rgba(234,179,8,0.08)" :
                              f === "DANGER" ? "rgba(239,68,68,0.08)" : "rgba(249,115,22,0.08)",
                  color: f === "ALL" ? "#3b82f6" :
                         f === "WATCHED" ? "#eab308" :
                         f === "DANGER" ? "#ef4444" : "#f97316",
                  borderColor: f === "ALL" ? "rgba(59,130,246,0.2)" :
                               f === "WATCHED" ? "rgba(234,179,8,0.2)" :
                               f === "DANGER" ? "rgba(239,68,68,0.2)" : "rgba(249,115,22,0.2)",
                } : { color: "var(--text-muted)" }}
              >
                {f}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search protocols..."
            className="text-xs px-3 py-1.5 rounded-lg bg-black/30 border text-white outline-none focus:border-blue-500/30 transition-colors flex-1 min-w-[140px]"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          />
        </div>
      )}

      {/* Protocol List */}
      {protocols.length > 0 && (
        <div className="space-y-2">
          {filteredProtocols.map((protocol) => (
            <div
              key={protocol.slug}
              className="card p-4 flex items-center gap-3 transition-all"
              style={{
                borderRadius: "12px",
                borderLeft: `3px solid ${getHealthColor(protocol.healthLevel)}`,
              }}
            >
              {/* Logo/Icon */}
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
                {protocol.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={protocol.logo} alt={protocol.name} width={24} height={24} className="rounded" />
                ) : (
                  <Shield className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">{protocol.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-muted)" }}>
                    {protocol.category}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                    TVL: {formatTvl(protocol.tvl)}
                  </span>
                  <span className="text-xs flex items-center gap-0.5" style={{
                    color: protocol.tvlChange1d >= 0 ? "#22c55e" : "#ef4444",
                  }}>
                    {protocol.tvlChange1d >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {Math.abs(protocol.tvlChange1d).toFixed(1)}% (24h)
                  </span>
                  <span className="text-xs flex items-center gap-0.5" style={{
                    color: protocol.tvlChange7d >= 0 ? "#22c55e" : "#ef4444",
                  }}>
                    {protocol.tvlChange7d >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {Math.abs(protocol.tvlChange7d).toFixed(1)}% (7d)
                  </span>
                </div>
              </div>

              {/* Health Score */}
              <div className="text-center flex-shrink-0">
                <div className="text-lg font-bold" style={{ color: getHealthColor(protocol.healthLevel) }}>
                  {protocol.healthScore}
                </div>
                <div className="text-xs px-1.5 py-0.5 rounded" style={{
                  background: `${getHealthColor(protocol.healthLevel)}10`,
                  color: getHealthColor(protocol.healthLevel),
                }}>
                  {protocol.healthLevel}
                </div>
              </div>

              {/* Watch Toggle */}
              <button
                onClick={() => toggleWatch(protocol.slug)}
                className="p-2 rounded-lg transition-all hover:bg-white/5 flex-shrink-0"
                title={protocol.isWatched ? "Unwatch" : "Watch"}
              >
                {protocol.isWatched ? (
                  <Star className="w-4 h-4" fill="#eab308" style={{ color: "#eab308" }} />
                ) : (
                  <StarOff className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                )}
              </button>

              {/* External Link */}
              {protocol.url && (
                <a
                  href={protocol.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-white/5 flex-shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                </a>
              )}
            </div>
          ))}

          {filteredProtocols.length === 0 && (
            <div className="card p-8 text-center" style={{ borderRadius: "12px" }}>
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400" />
              <p className="text-sm text-white">
                {filter === "DANGER" ? "No protocols in danger" :
                 filter === "WATCHED" ? "No watched protocols yet — click the star icon to watch" :
                 "No protocols match your search"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && protocols.length === 0 && (
        <div className="card p-12 text-center" style={{ borderRadius: "12px" }}>
          <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin" style={{ color: "#3b82f6" }} />
          <p className="text-sm text-white font-medium">Loading BSC Protocol Data</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Fetching from DeFiLlama...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && protocols.length === 0 && !error && (
        <div className="card p-12 text-center" style={{ borderRadius: "12px" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)" }}>
            <Eye className="w-8 h-8" style={{ color: "#3b82f6" }} />
          </div>
          <h4 className="text-xl font-semibold text-white mb-2">Protocol Monitor</h4>
          <p className="text-sm max-w-md mx-auto mb-6" style={{ color: "var(--text-secondary)" }}>
            Monitor the health and TVL of BSC DeFi protocols in real-time. Get alerted when protocols
            you use show signs of trouble.
          </p>
          <button onClick={handleRefresh} className="btn-primary flex items-center gap-2 mx-auto">
            <Zap className="w-4 h-4" /> Load Protocols
          </button>
        </div>
      )}
    </div>
  );
}
