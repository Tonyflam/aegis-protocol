"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWalletContext } from "../../lib/WalletContext";
import { CONTRACTS, HOLDER_TIER_BENEFITS } from "../../lib/constants";
import Link from "next/link";
import {
  AlertTriangle, Skull, CheckCircle, Loader2,
  Wallet, Eye, RefreshCw, ArrowRight,
  ExternalLink, Activity, Bot, Shield,
  Crown, Clock, TrendingUp, Lock,
  Zap, ChevronDown, ChevronUp, Send,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ───────────────────────────────────────────────────

interface WalletToken {
  address: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  isKnownSafe: boolean;
}

interface TokenScan {
  address: string;
  symbol: string;
  name: string;
  riskScore: number;
  recommendation: string;
  flags: string[];
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  liquidityUsd: number;
  isLiquidityLocked: boolean;
  isRenounced: boolean;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isProxy: boolean;
  topHolderPercent: number;
}

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  category: "threat" | "monitoring";
  title: string;
  description: string;
  token: string;
  tokenAddress: string;
  timestamp: number;
  minTier: "Free" | "Bronze" | "Silver" | "Gold";
}

interface GuardianResult {
  address: string;
  bnbBalance: string;
  holdings: WalletToken[];
  scans: TokenScan[];
  alerts: Alert[];
  overallRisk: "SAFE" | "AT_RISK" | "DANGEROUS";
  maxRiskScore: number;
  aiSummary: string;
  tier: string;
  uniqBalance: number;
  tokenCount: number;
  alertCount: number;
  scannedAt: number;
}

// ─── Helpers ─────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  Free: "#6b7280",
  Bronze: "#cd7f32",
  Silver: "#c0c0c0",
  Gold: "#ffd700",
};

function riskColor(score: number) {
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f97316";
  if (score >= 20) return "#eab308";
  return "#22c55e";
}


function overallBadge(risk: string) {
  switch (risk) {
    case "DANGEROUS":
      return { color: "#ef4444", bg: "rgba(239, 68, 68, 0.08)", label: "At Risk", icon: Skull };
    case "AT_RISK":
      return { color: "#f97316", bg: "rgba(249, 115, 22, 0.08)", label: "Caution", icon: AlertTriangle };
    default:
      return { color: "#22c55e", bg: "rgba(34, 197, 94, 0.08)", label: "Healthy", icon: CheckCircle };
  }
}

function formatBalance(bal: string) {
  const n = parseFloat(bal);
  if (isNaN(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

function formatFlag(flag: string) {
  const map: Record<string, string> = {
    HONEYPOT: "Honeypot",
    EXTREME_TAX: "Extreme Tax",
    HIGH_TAX: "High Tax",
    MODERATE_TAX: "Notable Tax",
    CRITICAL_LOW_LIQUIDITY: "No Liquidity",
    LOW_LIQUIDITY: "Low Liquidity",
    UNLOCKED_LIQUIDITY: "LP Unlocked",
    MINT_FUNCTION: "Can Mint",
    PAUSE_FUNCTION: "Can Pause",
    BLACKLIST_FUNCTION: "Can Blacklist",
    PROXY_CONTRACT: "Proxy",
    WHALE_DOMINATED: "Whale Risk",
    HIGH_CONCENTRATION: "Concentrated",
  };
  return map[flag] || flag;
}

const REFRESH_INTERVAL = 60;

// ─── Main Component ──────────────────────────────────────────

export default function GuardianShieldPage() {
  const { address, isConnected, connect, isConnecting } = useWalletContext();
  const [result, setResult] = useState<GuardianResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [threatsOpen, setThreatsOpen] = useState(true);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Telegram notification state
  const [tgChatId, setTgChatId] = useState("");
  const [tgConnected, setTgConnected] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tgConfigured, setTgConfigured] = useState(false);

  const scanWallet = useCallback(async (addr: string, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/guardian?address=${encodeURIComponent(addr)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Scan failed (${res.status})`);
      }
      const data: GuardianResult = await res.json();
      setResult(data);
      setCountdown(REFRESH_INTERVAL);
      if (!silent) toast.success(`Scan complete — ${data.alertCount} issues found`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      if (!silent) {
        setError(msg);
        toast.error(msg);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Auto-scan on wallet connect
  useEffect(() => {
    if (isConnected && address && !result && !loading) {
      scanWallet(address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  // Auto-refresh countdown
  useEffect(() => {
    if (!result || !address) return;
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          scanWallet(address, true);
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [result, address, scanWallet]);

  // Check Telegram status when wallet connects
  useEffect(() => {
    if (!isConnected || !address) return;
    fetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", address }),
    })
      .then((r) => r.json())
      .then((d) => {
        setTgConnected(!!d.registered);
        setTgConfigured(!!d.configured);
      })
      .catch(() => {});
  }, [isConnected, address]);

  const connectTelegram = async () => {
    if (!address || !tgChatId.trim()) return;
    setTgLoading(true);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", address, chatId: tgChatId.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setTgConnected(true);
        setTgConfigured(!!data.configured);
        toast.success("Telegram alerts activated!");
      } else {
        toast.error(data.error || "Registration failed");
      }
    } catch {
      toast.error("Failed to connect Telegram");
    } finally {
      setTgLoading(false);
    }
  };

  const disconnectTelegram = async () => {
    if (!address) return;
    setTgLoading(true);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unregister", address }),
      });
      const data = await res.json();
      if (data.success) {
        setTgConnected(false);
        setTgChatId("");
        toast.success("Telegram alerts deactivated");
      }
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setTgLoading(false);
    }
  };

  const tierRank: Record<string, number> = { Free: 0, Bronze: 1, Silver: 2, Gold: 3 };
  const userRank = tierRank[result?.tier ?? "Free"] ?? 0;

  const critAlerts = result?.alerts.filter((a) => a.severity === "critical") || [];
  const warnAlerts = result?.alerts.filter((a) => a.severity === "warning") || [];
  const infoAlerts = result?.alerts.filter((a) => a.severity === "info") || [];
  const sortedScans = result?.scans ? [...result.scans].sort((a, b) => b.riskScore - a.riskScore) : [];
  const tierColor = result ? (TIER_COLORS[result.tier] || TIER_COLORS.Free) : TIER_COLORS.Free;
  const badge = overallBadge(result?.overallRisk ?? "SAFE");
  const BadgeIcon = badge.icon;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">

        {/* ════════════════════════════════════════════════════
            NOT CONNECTED — Landing
        ════════════════════════════════════════════════════ */}
        {!isConnected && (
          <div className="space-y-8">
            {/* Hero */}
            <div className="text-center pt-8 pb-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
                <Shield className="w-8 h-8" style={{ color: "var(--accent)" }} />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
                Guardian Shield
              </h1>
              <p className="text-sm sm:text-base max-w-lg mx-auto" style={{ color: "var(--text-muted)" }}>
                Connect your wallet to activate real-time monitoring. Aegis reads your token holdings
                and continuously watches for rug pull signals, whale dumps, liquidity pulls, and contract
                risks — all read-only, no signatures required.
              </p>
              <button onClick={connect} disabled={isConnecting}
                className="btn-primary inline-flex items-center gap-2 mt-6">
                <Wallet className="w-4 h-4" />
                {isConnecting ? "Connecting..." : "Connect & Start Monitoring"}
              </button>
            </div>

            {/* What We Monitor */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Skull, label: "Rug Pull Detection", desc: "Mint capability, owner dumps, LP pulls" },
                { icon: Activity, label: "Whale Tracking", desc: "Large holder movements & concentration" },
                { icon: Eye, label: "Liquidity Watch", desc: "LP depth, lock status, removal risk" },
                { icon: AlertTriangle, label: "Contract Risks", desc: "Pause, blacklist, proxy, honeypot" },
              ].map((f) => (
                <div key={f.label} className="card p-4 text-center">
                  <f.icon className="w-5 h-5 mx-auto mb-2" style={{ color: "var(--accent)" }} />
                  <div className="text-xs font-medium text-white">{f.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{f.desc}</div>
                </div>
              ))}
            </div>

            {/* Tier Info */}
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Crown className="w-4 h-4" style={{ color: "#ffd700" }} />
                $UNIQ Holder Tiers
              </h3>
              <div className="space-y-2">
                {([
                  { tier: "Free", req: "0 $UNIQ", color: "#6b7280" },
                  { tier: "Bronze", req: "10K $UNIQ", color: "#cd7f32" },
                  { tier: "Silver", req: "100K $UNIQ", color: "#c0c0c0" },
                  { tier: "Gold", req: "1M $UNIQ", color: "#ffd700" },
                ] as const).map((t) => (
                  <div key={t.tier} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${t.color}15`, border: `1px solid ${t.color}30` }}>
                      <Shield className="w-4 h-4" style={{ color: t.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: t.color }}>{t.tier}</span>
                        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{t.req}</span>
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        {HOLDER_TIER_BENEFITS[t.tier].features}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <a href={`https://flap.sh/bnb/${CONTRACTS.UNIQ_TOKEN}`} target="_blank" rel="noopener noreferrer"
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "rgba(167, 139, 250, 0.08)", color: "var(--purple)", border: "1px solid rgba(167, 139, 250, 0.15)" }}>
                Get $UNIQ to Unlock Features <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="text-center pt-2">
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                Want a quick one-time scan instead?
              </p>
              <Link href="/scanner" className="text-xs font-medium inline-flex items-center gap-1"
                style={{ color: "var(--accent)" }}>
                Open Token Scanner <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            LOADING STATE
        ════════════════════════════════════════════════════ */}
        {isConnected && loading && (
          <div className="card p-12 text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: "var(--accent)" }} />
            <h2 className="text-lg font-semibold text-white mb-2">Scanning Your Holdings</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Checking each token for honeypots, hidden taxes, whale risks, and rug pull signals...
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              This takes 15-30 seconds
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            ERROR STATE
        ════════════════════════════════════════════════════ */}
        {isConnected && error && !loading && (
          <div className="card p-8 text-center" style={{ borderColor: "rgba(239, 68, 68, 0.2)" }}>
            <Skull className="w-10 h-10 mx-auto mb-3" style={{ color: "#ef4444" }} />
            <h2 className="text-lg font-semibold text-white mb-2">Scan Failed</h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>{error}</p>
            {address && (
              <button onClick={() => scanWallet(address)} className="btn-primary inline-flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            MONITORING DASHBOARD
        ════════════════════════════════════════════════════ */}
        {isConnected && result && !loading && (
          <div className="animate-fade-in">

            {/* ═══ STICKY HEADER ═══ */}
            <div className="sticky top-16 z-40 -mx-4 px-4 py-3 backdrop-blur-xl"
              style={{ background: "rgba(9,9,11,0.92)", borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">Guardian Shield</h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}35` }}>
                    {result.tier}
                  </span>
                  <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)", border: "1px solid rgba(52,211,153,0.15)" }}>
                    <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} />
                    Live
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono hidden sm:inline" style={{ color: "var(--text-muted)" }}>
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  <span className="text-[11px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                    <Clock className="w-3 h-3" />{countdown}s
                  </span>
                  <button onClick={() => address && scanWallet(address)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:brightness-125"
                    style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
                    <RefreshCw className="w-3 h-3" /> Rescan
                  </button>
                </div>
              </div>
            </div>

            {/* ═══ ROW 1: HERO STATUS (full width) ═══ */}
            <section className="mt-6 mb-8">
              <div className="card p-0 overflow-hidden" style={{ borderColor: `${badge.color}20` }}>
                <div className="h-1" style={{ background: `linear-gradient(90deg, ${badge.color}, ${badge.color}60, transparent)` }} />
                <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: badge.bg, border: `2px solid ${badge.color}25` }}>
                      <BadgeIcon className="w-7 h-7" style={{ color: badge.color }} />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "var(--text-muted)" }}>
                        Security Status
                      </div>
                      <div className="text-2xl font-bold tracking-tight" style={{ color: badge.color }}>
                        {badge.label}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Tokens", value: String(result.tokenCount), color: "var(--accent)", icon: Activity },
                      { label: "Critical", value: String(critAlerts.length), color: critAlerts.length > 0 ? "#ef4444" : "var(--green)", icon: Skull },
                      { label: "Warnings", value: String(warnAlerts.length), color: warnAlerts.length > 0 ? "#f97316" : "var(--green)", icon: AlertTriangle },
                      { label: "BNB", value: parseFloat(result.bnbBalance).toFixed(4), color: "#f0b90b", icon: Wallet },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: "var(--bg-elevated)" }}>
                        <s.icon className="w-4 h-4 shrink-0" style={{ color: s.color }} />
                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
                            {s.label}
                          </div>
                          <div className="text-lg font-bold leading-none mt-0.5" style={{ color: s.color }}>
                            {s.value}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ═══ ROW 2: TWO-COLUMN GRID (7/5 split) ═══ */}
            <section className="mb-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* ─── LEFT (7/12): Security Alerts ─── */}
                <div className="lg:col-span-7">
                  <div className="card overflow-hidden">
                    <button onClick={() => setThreatsOpen(!threatsOpen)}
                      className="w-full px-5 py-4 flex items-center justify-between text-left"
                      style={{ borderBottom: threatsOpen ? "1px solid var(--border-subtle)" : undefined }}>
                      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Shield className="w-4 h-4" style={{ color: critAlerts.length > 0 ? "#ef4444" : "var(--accent)" }} />
                        Security Alerts
                      </h2>
                      <div className="flex items-center gap-2">
                        {critAlerts.length > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                            style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                            {critAlerts.length} CRITICAL
                          </span>
                        )}
                        {warnAlerts.length > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(249,115,22,0.08)", color: "#f97316" }}>
                            {warnAlerts.length} WARN
                          </span>
                        )}
                        {threatsOpen
                          ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                          : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
                      </div>
                    </button>

                    {threatsOpen && (critAlerts.length > 0 || warnAlerts.length > 0 || infoAlerts.length > 0) && (
                      <div>
                        {/* ── Critical ── */}
                        {critAlerts.length > 0 && (
                          <>
                            <div className="px-5 py-1.5 text-[10px] uppercase tracking-widest font-semibold"
                              style={{ background: "rgba(239,68,68,0.04)", color: "#ef4444", borderBottom: "1px solid var(--border-subtle)" }}>
                              Critical
                            </div>
                            {critAlerts.map((alert) => (
                              <div key={alert.id} className="border-l-[3px] hover:bg-white/[0.015] transition-colors"
                                style={{ borderLeftColor: "#ef4444", borderBottom: "1px solid var(--border-subtle)" }}>
                                <button onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                                  className="w-full px-5 py-3 flex items-start gap-3 text-left">
                                  <Skull className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold" style={{ color: "#ef4444" }}>{alert.title}</div>
                                    <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{alert.token}</div>
                                  </div>
                                  {expandedAlert === alert.id
                                    ? <ChevronUp className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                                    : <ChevronDown className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />}
                                </button>
                                {expandedAlert === alert.id && (
                                  <div className="pl-12 pr-5 pb-3 animate-fade-in">
                                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{alert.description}</p>
                                    <a href={`https://bscscan.com/token/${alert.tokenAddress}`} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] font-medium mt-2 hover:underline"
                                      style={{ color: "var(--accent)" }}>
                                      View on BscScan <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            ))}
                          </>
                        )}

                        {/* ── Warnings ── */}
                        {warnAlerts.length > 0 && (
                          <>
                            <div className="px-5 py-1.5 text-[10px] uppercase tracking-widest font-semibold"
                              style={{ background: "rgba(249,115,22,0.03)", color: "#f97316", borderBottom: "1px solid var(--border-subtle)" }}>
                              Warnings
                            </div>
                            {warnAlerts.map((alert) => (
                              <div key={alert.id} className="border-l-[3px] hover:bg-white/[0.015] transition-colors"
                                style={{ borderLeftColor: "#f97316", borderBottom: "1px solid var(--border-subtle)" }}>
                                <button onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                                  className="w-full px-5 py-3 flex items-start gap-3 text-left">
                                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#f97316" }} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold" style={{ color: "#f97316" }}>{alert.title}</div>
                                    <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{alert.token}</div>
                                  </div>
                                  {expandedAlert === alert.id
                                    ? <ChevronUp className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                                    : <ChevronDown className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />}
                                </button>
                                {expandedAlert === alert.id && (
                                  <div className="pl-12 pr-5 pb-3 animate-fade-in">
                                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{alert.description}</p>
                                    <a href={`https://bscscan.com/token/${alert.tokenAddress}`} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] font-medium mt-2 hover:underline"
                                      style={{ color: "var(--accent)" }}>
                                      View on BscScan <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            ))}
                          </>
                        )}

                        {/* ── Informational ── */}
                        {infoAlerts.length > 0 && (
                          <>
                            <div className="px-5 py-1.5 text-[10px] uppercase tracking-widest font-semibold"
                              style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
                              Monitoring
                            </div>
                            {infoAlerts.filter(a => userRank >= (tierRank[a.minTier] ?? 0)).map((alert) => (
                              <div key={alert.id} className="border-l-[3px] hover:bg-white/[0.015] transition-colors"
                                style={{ borderLeftColor: "var(--accent)", borderBottom: "1px solid var(--border-subtle)" }}>
                                <button onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                                  className="w-full px-5 py-3 flex items-start gap-3 text-left">
                                  <Eye className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{alert.title}</div>
                                    <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{alert.token}</div>
                                  </div>
                                  {expandedAlert === alert.id
                                    ? <ChevronUp className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                                    : <ChevronDown className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />}
                                </button>
                                {expandedAlert === alert.id && (
                                  <div className="pl-12 pr-5 pb-3 animate-fade-in">
                                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{alert.description}</p>
                                    <a href={`https://bscscan.com/token/${alert.tokenAddress}`} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] font-medium mt-2 hover:underline"
                                      style={{ color: "var(--accent)" }}>
                                      View on BscScan <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* Locked info alerts */}
                            {(() => {
                              const locked = infoAlerts.filter(a => userRank < (tierRank[a.minTier] ?? 0));
                              if (locked.length === 0) return null;
                              return (
                                <div className="px-5 py-2.5 flex items-center justify-between"
                                  style={{ background: "rgba(255,255,255,0.01)", borderBottom: "1px solid var(--border-subtle)" }}>
                                  <div className="flex items-center gap-2">
                                    <Lock className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                                      +{locked.length} more with higher tier
                                    </span>
                                  </div>
                                  <a href={`https://flap.sh/bnb/${CONTRACTS.UNIQ_TOKEN}`} target="_blank" rel="noopener noreferrer"
                                    className="text-[10px] font-medium flex items-center gap-1" style={{ color: "var(--purple)" }}>
                                    <Zap className="w-3 h-3" /> Upgrade
                                  </a>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    )}

                    {/* All clear */}
                    {threatsOpen && result.alerts.length === 0 && (
                      <div className="px-5 py-8 text-center">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--green)" }} />
                        <h3 className="text-xs font-semibold text-white">All Clear</h3>
                        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>No threats detected in your holdings.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ─── RIGHT (5/12): Token Holdings ─── */}
                <div className="lg:col-span-5">
                  <div className="card overflow-hidden lg:sticky lg:top-32">
                    <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Wallet className="w-4 h-4" style={{ color: "var(--accent)" }} />
                        Token Holdings
                      </h2>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)" }}>
                        {sortedScans.length} token{sortedScans.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {sortedScans.length > 0 && (
                      <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                        {sortedScans.map((scan) => {
                          const holding = result.holdings.find((h) => h.address.toLowerCase() === scan.address.toLowerCase());
                          const isExpanded = expandedToken === scan.address;
                          const color = riskColor(scan.riskScore);
                          return (
                            <div key={scan.address}>
                              <button onClick={() => setExpandedToken(isExpanded ? null : scan.address)}
                                className="w-full px-5 py-2.5 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors">
                                <span className="w-8 h-6 rounded text-[10px] font-bold flex items-center justify-center shrink-0"
                                  style={{ background: `${color}10`, color, border: `1px solid ${color}15` }}>
                                  {scan.riskScore}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-semibold text-white">{scan.symbol}</span>
                                  <span className="text-[10px] ml-1.5 hidden sm:inline truncate" style={{ color: "var(--text-muted)" }}>{scan.name}</span>
                                </div>
                                <span className="text-[11px] font-mono shrink-0" style={{ color: "var(--text-secondary)" }}>
                                  {holding ? formatBalance(holding.balance) : "\u2014"}
                                </span>
                                {isExpanded
                                  ? <ChevronUp className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                                  : <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />}
                              </button>
                              {isExpanded && (
                                <div className="px-5 pb-4 pt-1 animate-fade-in" style={{ background: "var(--bg-elevated)" }}>
                                  <div className="grid grid-cols-2 gap-2 mb-3">
                                    {[
                                      { label: "Buy Tax", val: `${scan.buyTax.toFixed(1)}%`, warn: scan.buyTax > 10 },
                                      { label: "Sell Tax", val: `${scan.sellTax.toFixed(1)}%`, warn: scan.sellTax > 10 },
                                      { label: "Liquidity", val: `$${scan.liquidityUsd >= 1000 ? `${(scan.liquidityUsd / 1000).toFixed(1)}K` : scan.liquidityUsd.toFixed(0)}`, warn: scan.liquidityUsd < 1000 },
                                      { label: "Top Holder", val: `${scan.topHolderPercent}%`, warn: scan.topHolderPercent > 30 },
                                    ].map((m) => (
                                      <div key={m.label} className="p-2 rounded-lg text-center" style={{ background: "var(--bg-raised)" }}>
                                        <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{m.label}</div>
                                        <div className="text-xs font-bold mt-0.5" style={{ color: m.warn ? "#f97316" : "var(--text-primary)" }}>{m.val}</div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex flex-wrap gap-1 mb-3">
                                    {scan.flags.map((f) => (
                                      <span key={f} className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${color}10`, color }}>{formatFlag(f)}</span>
                                    ))}
                                    {scan.isHoneypot && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>HONEYPOT</span>}
                                    {scan.isLiquidityLocked && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "var(--green)" }}>LP Locked</span>}
                                    {scan.isRenounced && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "var(--green)" }}>Renounced</span>}
                                  </div>
                                  <a href={`https://bscscan.com/token/${scan.address}`} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-medium hover:underline" style={{ color: "var(--accent)" }}>
                                    View on BscScan <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {sortedScans.length === 0 && (
                      <div className="px-5 py-8 text-center">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--green)" }} />
                        <p className="text-xs font-medium text-white">
                          {result.tokenCount > 0 ? "Only Known-Safe Tokens" : "No Tokens Found"}
                        </p>
                        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                          {result.tokenCount > 0 ? "Your wallet holds recognized safe tokens." : "This wallet has no token holdings."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ═══ ROW 3: FEATURES (full width, 4-col) ═══ */}
            <section>
              <h2 className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
                Features
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

                {/* AI Analysis */}
                {result.tier === "Gold" && result.aiSummary ? (
                  <div className="card p-4" style={{ borderColor: "rgba(255,215,0,0.15)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="w-4 h-4" style={{ color: "#ffd700" }} />
                      <span className="text-[11px] font-semibold" style={{ color: "#ffd700" }}>AI Analysis</span>
                    </div>
                    <p className="text-[10px] leading-relaxed line-clamp-4" style={{ color: "var(--text-secondary)" }}>
                      {result.aiSummary}
                    </p>
                  </div>
                ) : (
                  <div className="card p-4 flex items-center gap-3 opacity-60">
                    <Lock className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                    <div>
                      <div className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>AI Analysis</div>
                      <div className="text-[9px] font-bold uppercase" style={{ color: "#ffd700" }}>Gold Tier</div>
                    </div>
                  </div>
                )}

                {/* Telegram */}
                {userRank >= 2 ? (
                  <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Send className="w-4 h-4" style={{ color: "#229ED9" }} />
                      <span className="text-[11px] font-semibold text-white">Telegram</span>
                      {tgConnected && (
                        <span className="ml-auto flex items-center gap-1 text-[9px] font-medium" style={{ color: "var(--green)" }}>
                          <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} /> On
                        </span>
                      )}
                    </div>
                    {tgConnected ? (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Active</span>
                        <button onClick={disconnectTelegram} disabled={tgLoading}
                          className="text-[10px] font-medium px-2 py-0.5 rounded hover:bg-white/5 transition-colors"
                          style={{ color: "#ef4444" }}>
                          {tgLoading ? "..." : "Off"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-1.5">
                          <input type="text" value={tgChatId} onChange={(e) => setTgChatId(e.target.value)}
                            placeholder="Chat ID"
                            className="flex-1 text-[10px] px-2 py-1.5 rounded outline-none min-w-0"
                            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
                          <button onClick={connectTelegram} disabled={tgLoading || !tgChatId.trim()}
                            className="px-2.5 py-1.5 rounded text-[10px] font-medium disabled:opacity-40 shrink-0"
                            style={{ background: "#229ED9", color: "#fff" }}>
                            {tgLoading ? "..." : "Link"}
                          </button>
                        </div>
                        <a href="https://t.me/aegis_protocol_bot" target="_blank" rel="noopener noreferrer"
                          className="text-[9px] mt-1.5 inline-block hover:underline" style={{ color: "#229ED9" }}>
                          Get ID from @aegis_protocol_bot
                        </a>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="card p-4 flex items-center gap-3 opacity-60">
                    <Lock className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                    <div>
                      <div className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>Telegram</div>
                      <div className="text-[9px] font-bold uppercase" style={{ color: "#c0c0c0" }}>Silver+</div>
                    </div>
                  </div>
                )}

                {/* Vault */}
                <Link href="/vault"
                  className="card card-action p-4 flex items-center gap-3 group">
                  <TrendingUp className="w-4 h-4 shrink-0" style={{ color: "var(--green)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-white">Protected Vault</div>
                    <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>Venus yield</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                    style={{ color: "var(--text-muted)" }} />
                </Link>

                {/* Upgrade */}
                {result.tier !== "Gold" ? (
                  <a href={`https://flap.sh/bnb/${CONTRACTS.UNIQ_TOKEN}`} target="_blank" rel="noopener noreferrer"
                    className="card card-action p-4 flex items-center gap-3 group">
                    <Crown className="w-4 h-4 shrink-0" style={{ color: "var(--purple)" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-white">
                        {result.tier === "Free" ? "Get $UNIQ" : "Upgrade"}
                      </div>
                      <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                        {result.tier === "Free" ? "Unlock features" : result.tier === "Bronze" ? "Silver unlock" : "Gold unlock"}
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                  </a>
                ) : (
                  <div className="card p-4 flex items-center gap-3">
                    <Crown className="w-4 h-4 shrink-0" style={{ color: "#ffd700" }} />
                    <div>
                      <div className="text-[11px] font-semibold" style={{ color: "#ffd700" }}>Gold Tier</div>
                      <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>All unlocked</div>
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
