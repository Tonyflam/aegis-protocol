"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWalletContext } from "../../lib/WalletContext";
import { CONTRACTS, HOLDER_TIER_BENEFITS } from "../../lib/constants";
import Link from "next/link";
import {
  AlertTriangle, Skull, CheckCircle, Loader2,
  Wallet, Eye, RefreshCw, ArrowRight,
  ExternalLink, Activity, Bot, Shield,
  Crown, TrendingUp, Lock,
  Zap, ChevronDown, ChevronUp, Send,
  Target, ShieldAlert, ShieldCheck, Crosshair,
} from "lucide-react";
import toast from "react-hot-toast";
import { EmptyState, Skeleton, SkeletonStat } from "../../components/ui";

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

interface AiAnalysis {
  summary: string;
  riskRating: "SAFE" | "CAUTION" | "AT_RISK" | "DANGEROUS";
  topThreats: string[];
  actions: string[];
  holdingBreakdown: { symbol: string; verdict: string }[];
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
  aiAnalysis: AiAnalysis;
  tier: string;
  uniqBalance: number;
  tokenCount: number;
  alertCount: number;
  scannedAt: number;
}

// ─── Helpers ─────────────────────────────────────────────────

function riskTier(score: number): "high" | "med" | "low" | "safe" {
  if (score >= 70) return "high";
  if (score >= 40) return "med";
  if (score >= 20) return "low";
  return "safe";
}

function overallBadge(risk: string) {
  switch (risk) {
    case "DANGEROUS":
      return { tone: "var(--sem-danger)", label: "At Risk", sub: "Critical threats detected", icon: ShieldAlert };
    case "AT_RISK":
      return { tone: "var(--sem-warning)", label: "Caution", sub: "Issues need review", icon: AlertTriangle };
    default:
      return { tone: "var(--sem-success)", label: "Secure", sub: "No threats detected", icon: ShieldCheck };
  }
}

function aiRatingStyle(rating: string) {
  switch (rating) {
    case "DANGEROUS":
      return { tone: "var(--sem-danger)", label: "Dangerous" };
    case "AT_RISK":
      return { tone: "var(--sem-warning)", label: "At Risk" };
    case "CAUTION":
      return { tone: "var(--sem-warning)", label: "Caution" };
    default:
      return { tone: "var(--sem-success)", label: "Safe" };
  }
}

function formatBalance(bal: string) {
  const n = parseFloat(bal);
  if (isNaN(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
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
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  // Wall-clock timestamp of the next scheduled rescan. Anchoring on a
  // timestamp (rather than decrementing a counter) means the countdown
  // survives tab backgrounding — browsers throttle setInterval to as
  // little as 1/min when a tab is hidden, so a decrement would lie about
  // how recently the wallet was checked. We always compute remaining
  // seconds from `nextScanAtRef.current - Date.now()` instead.
  const nextScanAtRef = useRef<number>(Date.now() + REFRESH_INTERVAL * 1000);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tgChatId, setTgChatId] = useState("");
  const [tgConnected, setTgConnected] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);

  const scanWallet = useCallback(async (addr: string, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      // Silent polls hit the cached snapshot written by the server-side
      // cron — this is what makes alerts visible the moment the page
      // reopens, even after being closed for hours. A 404 means no
      // snapshot exists yet, so we transparently fall back to a live scan.
      const url = silent
        ? "/api/guardian?address=" + encodeURIComponent(addr) + "&cached=1"
        : "/api/guardian?address=" + encodeURIComponent(addr);
      let res = await fetch(url);
      if (silent && res.status === 404) {
        res = await fetch("/api/guardian?address=" + encodeURIComponent(addr));
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Scan failed (" + res.status + ")");
      }
      const data: GuardianResult = await res.json();
      setResult(data);
      nextScanAtRef.current = Date.now() + REFRESH_INTERVAL * 1000;
      setCountdown(REFRESH_INTERVAL);
      if (!silent) toast.success("Scan complete — " + data.alertCount + " issues found");
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

  useEffect(() => {
    if (isConnected && address && !result && !loading) {
      scanWallet(address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  // Tick the displayed countdown from a wall-clock anchor. When the tab
  // is hidden the browser throttles this interval, but because we read
  // Date.now() each tick the displayed value is always truthful — and
  // if the deadline passed while the tab was hidden, we fire a silent
  // rescan immediately on the next tick (or on visibilitychange below).
  useEffect(() => {
    if (!result || !address) return;
    const tick = () => {
      const remaining = Math.ceil((nextScanAtRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        // Avoid spamming the API if multiple ticks catch up at once.
        nextScanAtRef.current = Date.now() + REFRESH_INTERVAL * 1000;
        setCountdown(REFRESH_INTERVAL);
        scanWallet(address, true);
      } else {
        setCountdown(remaining);
      }
    };
    tick();
    tickRef.current = setInterval(tick, 1000);
    // Re-sync the moment the tab becomes visible — a hidden tab's
    // setInterval can be throttled to ~1/min, so we force a tick.
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [result, address, scanWallet]);

  useEffect(() => {
    if (!isConnected || !address) return;
    fetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", address }),
    })
      .then((r) => r.json())
      .then((d) => setTgConnected(!!d.registered))
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
  const badge = overallBadge(result?.overallRisk ?? "SAFE");
  const ai = result?.aiAnalysis;
  const aiStyle = aiRatingStyle(ai?.riskRating || "SAFE");
  const isGold = result?.tier === "Gold";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>

      {/* ── DISCONNECTED HERO ─────────────────────────────────────── */}
      {!isConnected && (
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24 space-y-16">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
              AI Wallet Security · Always On
            </div>
            <h1 className="t-display max-w-3xl mx-auto">Guardian Shield</h1>
            <p className="t-body-lg max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
              Connect your wallet. Aegis scans every token you hold for rug pulls, honeypots, whale dumps,
              and contract risk — silently, every minute.
            </p>
            <div className="flex justify-center pt-2">
              <button onClick={connect} disabled={isConnecting}
                className="btn-primary inline-flex items-center gap-2 text-base px-6 py-3">
                <Wallet className="w-4 h-4" />
                {isConnecting ? "Connecting…" : "Connect wallet"}
              </button>
            </div>
            <p className="t-caption pt-1">Read-only · No signatures required</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: Skull,    label: "Rug pull detection",  desc: "Mint authority, owner dumps, LP withdrawals." },
              { icon: Activity, label: "Whale tracking",       desc: "Concentration & large-holder movements." },
              { icon: Zap,      label: "Honeypot scanner",     desc: "Simulated sells expose trapped tokens." },
              { icon: Eye,      label: "Contract analysis",    desc: "Pause, blacklist, proxy, upgrade detection." },
            ].map((f) => (
              <div key={f.label} className="card card-hover-lift p-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                  <f.icon className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                </div>
                <div className="text-[13px] font-semibold text-white mb-1">{f.label}</div>
                <div className="t-caption">{f.desc}</div>
              </div>
            ))}
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                <span className="text-[13px] font-semibold text-white">$UNIQ holder tiers</span>
              </div>
              <a href={"https://flap.sh/bnb/" + CONTRACTS.UNIQ_TOKEN} target="_blank" rel="noopener noreferrer"
                className="t-caption flex items-center gap-1 hover:text-white transition-colors">
                Get $UNIQ <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {([
                { tier: "Free",   req: "0 $UNIQ"        },
                { tier: "Bronze", req: "10K $UNIQ"      },
                { tier: "Silver", req: "100K $UNIQ"     },
                { tier: "Gold",   req: "1M $UNIQ"       },
              ] as const).map((t, i) => (
                <div key={t.tier} className="p-4 rounded-lg"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-white">{t.tier}</span>
                    {i === 3 && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                        style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>BEST</span>
                    )}
                  </div>
                  <p className="text-[11px] mb-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {HOLDER_TIER_BENEFITS[t.tier].features}
                  </p>
                  <span className="t-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{t.req}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <Link href="/scanner" className="t-caption hover:text-white transition-colors inline-flex items-center gap-1">
              Just want a one-time scan? Open Token Scanner <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* ── LOADING ───────────────────────────────────────────────── */}
      {isConnected && loading && (
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--accent)" }} />
            <div>
              <div className="text-sm font-semibold text-white">Scanning your wallet</div>
              <div className="t-caption">Checking each token for honeypots, taxes, whale risks, rug pulls…</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonStat key={i} />)}
          </div>
          <div className="card p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {/* ── ERROR ─────────────────────────────────────────────────── */}
      {isConnected && error && !loading && !result && (
        <div className="max-w-2xl mx-auto px-6 py-16">
          <EmptyState
            icon={ShieldAlert}
            tone="danger"
            title="Scan failed"
            description={error}
            action={
              <button onClick={() => address && scanWallet(address)}
                className="btn-primary inline-flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            }
          />
        </div>
      )}

      {/* ── DASHBOARD ─────────────────────────────────────────────── */}
      {isConnected && result && !loading && (
        <div className="animate-fade-in">

          {/* Sticky header */}
          <div className="sticky top-16 z-40 backdrop-blur-xl"
            style={{ background: "rgba(9,9,11,0.85)", borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <h1 className="text-[15px] font-semibold tracking-tight text-white shrink-0">Guardian Shield</h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide uppercase"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                  {result.tier} tier
                </span>
                <span className="hidden md:inline-flex items-center gap-1.5 t-caption">
                  <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--sem-success)" }} />
                  Live · refresh in {countdown}s
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline t-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {address?.slice(0, 6)}…{address?.slice(-4)}
                </span>
                <button onClick={() => address && scanWallet(address)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all hover:bg-white/[0.04]"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                  <RefreshCw className="w-3 h-3" /> Rescan
                </button>
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

            {/* HERO STATUS — single calm card */}
            <div className="card p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: badge.tone }} />
                    <span className="section-eyebrow">Security status</span>
                  </div>
                  <div className="t-h1 text-white">{badge.label}</div>
                  <p className="t-body" style={{ color: "var(--text-secondary)" }}>
                    {badge.sub} across {result.tokenCount} token{result.tokenCount !== 1 ? "s" : ""}.
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-px rounded-lg overflow-hidden shrink-0"
                  style={{ background: "var(--border-subtle)" }}>
                  {[
                    { label: "Tokens",   value: String(result.tokenCount),                  dot: false },
                    { label: "Critical", value: String(critAlerts.length),                  dot: critAlerts.length > 0, dotColor: "var(--sem-danger)" },
                    { label: "Warnings", value: String(warnAlerts.length),                  dot: warnAlerts.length > 0, dotColor: "var(--sem-warning)" },
                    { label: "BNB",      value: parseFloat(result.bnbBalance).toFixed(3),   dot: false },
                  ].map((s) => (
                    <div key={s.label} className="px-4 py-3 sm:px-5 sm:py-4 min-w-[88px]"
                      style={{ background: "var(--gray-800)" }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        {s.dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dotColor }} />}
                        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          {s.label}
                        </span>
                      </div>
                      <div className="text-xl sm:text-2xl font-semibold tracking-tight tabular-nums text-white">
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* LEFT: Analysis + Alerts */}
              <div className="lg:col-span-3 space-y-6">

                {/* AI Analysis */}
                {ai && (
                  <div className="card overflow-hidden">
                    <div className="px-6 py-4 flex items-center justify-between"
                      style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <div className="flex items-center gap-3">
                        <Bot className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                        <div>
                          <h2 className="text-[13px] font-semibold text-white">
                            {isGold ? "AI security analysis" : "Security analysis"}
                          </h2>
                          <span className="t-caption">
                            {isGold ? "Enhanced with LLM reasoning" : "Rule-based analysis"}
                          </span>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider"
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: aiStyle.tone }} />
                        {aiStyle.label}
                      </span>
                    </div>

                    <div className="p-6 space-y-6">
                      <p className="t-body" style={{ color: "var(--text-secondary)" }}>{ai.summary}</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px rounded-lg overflow-hidden"
                        style={{ background: "var(--border-subtle)" }}>
                        {ai.topThreats.length > 0 && (
                          <div className="p-5" style={{ background: "var(--gray-800)" }}>
                            <div className="flex items-center gap-2 mb-3">
                              <Target className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                              <span className="section-eyebrow">Top threats</span>
                            </div>
                            <ul className="space-y-2.5">
                              {ai.topThreats.map((threat, i) => (
                                <li key={i} className="flex items-start gap-2.5">
                                  <span className="t-mono text-[10px] tabular-nums shrink-0 mt-1"
                                    style={{ color: "var(--text-muted)" }}>{String(i + 1).padStart(2, "0")}</span>
                                  <span className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{threat}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {ai.actions.length > 0 && (
                          <div className="p-5" style={{ background: "var(--gray-800)" }}>
                            <div className="flex items-center gap-2 mb-3">
                              <Crosshair className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                              <span className="section-eyebrow">Recommended actions</span>
                            </div>
                            <ul className="space-y-2.5">
                              {ai.actions.map((action, i) => (
                                <li key={i} className="flex items-start gap-2.5">
                                  <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                                  <span className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{action}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {ai.holdingBreakdown.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Wallet className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                            <span className="section-eyebrow">Token-by-token verdict</span>
                          </div>
                          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                            {ai.holdingBreakdown.map((h, i) => {
                              const vl = h.verdict.toLowerCase();
                              const dot = vl.includes("honeypot") || vl.includes("exit") || vl.includes("dangerous")
                                ? "var(--sem-danger)"
                                : vl.includes("high risk") || vl.includes("consider selling") || vl.includes("moderate") || vl.includes("monitor")
                                ? "var(--sem-warning)"
                                : "var(--sem-success)";
                              return (
                                <div key={i}
                                  className="flex items-start gap-3 px-4 py-3"
                                  style={{
                                    background: i % 2 === 0 ? "var(--gray-800)" : "transparent",
                                    borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
                                  }}>
                                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: dot }} />
                                  <span className="text-[12px] font-semibold text-white min-w-[56px] shrink-0">{h.symbol}</span>
                                  <span className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{h.verdict}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {!isGold && (
                      <div className="px-6 py-3 flex items-center justify-between"
                        style={{ background: "var(--bg-elevated)", borderTop: "1px solid var(--border-subtle)" }}>
                        <span className="t-caption">
                          Upgrade to <span className="text-white font-medium">Gold</span> for LLM-powered analysis
                        </span>
                        <a href={"https://flap.sh/bnb/" + CONTRACTS.UNIQ_TOKEN} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] font-medium inline-flex items-center gap-1 hover:text-white transition-colors"
                          style={{ color: "var(--accent)" }}>
                          Get $UNIQ <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Alerts */}
                <div className="card overflow-hidden">
                  <div className="px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <h2 className="text-[13px] font-semibold text-white">Security alerts</h2>
                    <span className="t-caption">
                      {critAlerts.length + warnAlerts.length === 0
                        ? "No issues"
                        : (critAlerts.length + warnAlerts.length) + " issue" + (critAlerts.length + warnAlerts.length !== 1 ? "s" : "")}
                    </span>
                  </div>

                  {[...critAlerts, ...warnAlerts].map((alert) => {
                    const isCrit = alert.severity === "critical";
                    const dot = isCrit ? "var(--sem-danger)" : "var(--sem-warning)";
                    const isExpanded = expandedAlert === alert.id;
                    return (
                      <div key={alert.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <button onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                          className="w-full px-6 py-3.5 flex items-start gap-3 text-left transition-colors hover:bg-white/[0.015]">
                          <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: dot }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium text-white truncate">{alert.title}</div>
                            <div className="t-caption mt-0.5">{alert.token}</div>
                          </div>
                          <span className="t-caption uppercase tracking-wider shrink-0 mt-0.5">
                            {isCrit ? "Critical" : "Warning"}
                          </span>
                          {isExpanded
                            ? <ChevronUp className="w-3.5 h-3.5 shrink-0 mt-1" style={{ color: "var(--text-muted)" }} />
                            : <ChevronDown className="w-3.5 h-3.5 shrink-0 mt-1" style={{ color: "var(--text-muted)" }} />}
                        </button>
                        {isExpanded && (
                          <div className="px-6 pb-4 pl-[42px] animate-fade-in space-y-2">
                            <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                              {alert.description}
                            </p>
                            <a href={"https://bscscan.com/token/" + alert.tokenAddress} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium hover:text-white transition-colors"
                              style={{ color: "var(--accent)" }}>
                              View on BscScan <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {infoAlerts.filter(a => userRank >= (tierRank[a.minTier] ?? 0)).map((alert) => {
                    const isExpanded = expandedAlert === alert.id;
                    return (
                      <div key={alert.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <button onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                          className="w-full px-6 py-3 flex items-start gap-3 text-left transition-colors hover:bg-white/[0.015]">
                          <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: "var(--text-muted)" }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{alert.title}</div>
                            <div className="t-caption mt-0.5">{alert.token}</div>
                          </div>
                          <span className="t-caption uppercase tracking-wider shrink-0 mt-0.5">Info</span>
                        </button>
                        {isExpanded && (
                          <div className="px-6 pb-3 pl-[42px] animate-fade-in">
                            <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{alert.description}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {(() => {
                    const locked = infoAlerts.filter(a => userRank < (tierRank[a.minTier] ?? 0));
                    if (locked.length === 0) return null;
                    return (
                      <div className="px-6 py-3 flex items-center justify-between"
                        style={{ background: "var(--bg-elevated)" }}>
                        <span className="t-caption flex items-center gap-2">
                          <Lock className="w-3 h-3" />
                          {locked.length} more alert{locked.length !== 1 ? "s" : ""} require higher tier
                        </span>
                        <a href={"https://flap.sh/bnb/" + CONTRACTS.UNIQ_TOKEN} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] font-medium hover:text-white transition-colors"
                          style={{ color: "var(--accent)" }}>
                          Upgrade
                        </a>
                      </div>
                    );
                  })()}

                  {result.alerts.length === 0 && (
                    <div className="px-6 py-12 text-center">
                      <div className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center"
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                        <CheckCircle className="w-5 h-5" style={{ color: "var(--sem-success)" }} />
                      </div>
                      <h3 className="text-[13px] font-semibold text-white mb-1">All clear</h3>
                      <p className="t-caption">No threats detected in your wallet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Holdings + Sidebar */}
              <div className="lg:col-span-2 space-y-6">

                {/* Holdings */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <h2 className="text-[13px] font-semibold text-white">Holdings</h2>
                    <span className="t-caption">{sortedScans.length} token{sortedScans.length !== 1 ? "s" : ""}</span>
                  </div>

                  {sortedScans.length > 0 ? sortedScans.map((scan) => {
                    const holding = result.holdings.find((h) => h.address.toLowerCase() === scan.address.toLowerCase());
                    const isExpanded = expandedToken === scan.address;
                    const tier = riskTier(scan.riskScore);
                    const dot = tier === "high" ? "var(--sem-danger)" : tier === "med" || tier === "low" ? "var(--sem-warning)" : "var(--sem-success)";
                    return (
                      <div key={scan.address} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <button onClick={() => setExpandedToken(isExpanded ? null : scan.address)}
                          className="w-full px-5 py-3 flex items-center gap-3 text-left transition-colors hover:bg-white/[0.015]">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold text-white">{scan.symbol}</span>
                              <span className="t-mono text-[10px] tabular-nums px-1.5 py-0.5 rounded"
                                style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
                                {scan.riskScore}
                              </span>
                            </div>
                            {scan.flags.length > 0 && (
                              <div className="t-caption truncate mt-0.5">
                                {scan.flags.slice(0, 2).map(formatFlag).join(" · ")}
                                {scan.flags.length > 2 ? " · +" + (scan.flags.length - 2) : ""}
                              </div>
                            )}
                          </div>
                          <span className="t-mono text-[11px] tabular-nums shrink-0" style={{ color: "var(--text-secondary)" }}>
                            {holding ? formatBalance(holding.balance) : "—"}
                          </span>
                          {isExpanded
                            ? <ChevronUp className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                            : <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />}
                        </button>
                        {isExpanded && (
                          <div className="px-5 pb-4 pt-1 animate-fade-in" style={{ background: "var(--bg-elevated)" }}>
                            <div className="grid grid-cols-2 gap-px rounded-lg overflow-hidden mb-3"
                              style={{ background: "var(--border-subtle)" }}>
                              {[
                                { label: "Buy tax",    val: scan.buyTax.toFixed(1) + "%",  warn: scan.buyTax > 10 },
                                { label: "Sell tax",   val: scan.sellTax.toFixed(1) + "%", warn: scan.sellTax > 10 },
                                { label: "Liquidity",  val: "$" + (scan.liquidityUsd >= 1000 ? (scan.liquidityUsd / 1000).toFixed(1) + "K" : scan.liquidityUsd.toFixed(0)), warn: scan.liquidityUsd < 1000 },
                                { label: "Top holder", val: scan.topHolderPercent + "%", warn: scan.topHolderPercent > 30 },
                              ].map((m) => (
                                <div key={m.label} className="px-3 py-2.5" style={{ background: "var(--gray-800)" }}>
                                  <div className="t-caption">{m.label}</div>
                                  <div className="text-[13px] font-semibold mt-0.5 tabular-nums flex items-center gap-1.5"
                                    style={{ color: m.warn ? "var(--sem-warning)" : "var(--text-primary)" }}>
                                    {m.warn && <span className="w-1 h-1 rounded-full" style={{ background: "var(--sem-warning)" }} />}
                                    {m.val}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {(scan.flags.length > 0 || scan.isHoneypot || scan.isLiquidityLocked || scan.isRenounced) && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {scan.isHoneypot && (
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded inline-flex items-center gap-1"
                                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--sem-danger)" }}>
                                    <span className="w-1 h-1 rounded-full" style={{ background: "var(--sem-danger)" }} />
                                    Honeypot
                                  </span>
                                )}
                                {scan.flags.map((f) => (
                                  <span key={f} className="text-[10px] font-medium px-2 py-0.5 rounded"
                                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                                    {formatFlag(f)}
                                  </span>
                                ))}
                                {scan.isLiquidityLocked && (
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded inline-flex items-center gap-1"
                                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--sem-success)" }}>
                                    <span className="w-1 h-1 rounded-full" style={{ background: "var(--sem-success)" }} />
                                    LP locked
                                  </span>
                                )}
                                {scan.isRenounced && (
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded inline-flex items-center gap-1"
                                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--sem-success)" }}>
                                    <span className="w-1 h-1 rounded-full" style={{ background: "var(--sem-success)" }} />
                                    Renounced
                                  </span>
                                )}
                              </div>
                            )}
                            <a href={"https://bscscan.com/token/" + scan.address} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium hover:text-white transition-colors"
                              style={{ color: "var(--accent)" }}>
                              View on BscScan <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div className="px-5 py-10 text-center">
                      <div className="w-9 h-9 mx-auto mb-3 rounded-full flex items-center justify-center"
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                        <CheckCircle className="w-4 h-4" style={{ color: "var(--sem-success)" }} />
                      </div>
                      <p className="text-[13px] font-semibold text-white mb-1">
                        {result.tokenCount > 0 ? "Only safe tokens" : "No tokens found"}
                      </p>
                      <p className="t-caption">
                        {result.tokenCount > 0 ? "Recognized safe tokens only." : "No token holdings."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Telegram */}
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Send className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
                    <span className="text-[13px] font-semibold text-white">Telegram alerts</span>
                    {tgConnected && (
                      <span className="ml-auto inline-flex items-center gap-1 t-caption">
                        <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--sem-success)" }} />
                        Active
                      </span>
                    )}
                  </div>
                  {userRank >= 2 ? (
                    tgConnected ? (
                      <div className="flex items-center justify-between">
                        <span className="t-caption">Push alerts active</span>
                        <button onClick={disconnectTelegram} disabled={tgLoading}
                          className="text-[11px] font-medium hover:text-white transition-colors"
                          style={{ color: "var(--text-muted)" }}>
                          {tgLoading ? "…" : "Disconnect"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <input type="text" value={tgChatId} onChange={(e) => setTgChatId(e.target.value)}
                            placeholder="Your Chat ID"
                            className="flex-1 text-[12px] px-3 py-2 rounded-md outline-none min-w-0 transition-colors focus:bg-white/[0.04]"
                            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
                          <button onClick={connectTelegram} disabled={tgLoading || !tgChatId.trim()}
                            className="px-3 py-2 rounded-md text-[12px] font-medium disabled:opacity-40 shrink-0 transition-all"
                            style={{ background: "var(--accent)", color: "var(--bg-base)" }}>
                            {tgLoading ? "…" : "Connect"}
                          </button>
                        </div>
                        <a href="https://t.me/aegis_protocol_bot" target="_blank" rel="noopener noreferrer"
                          className="t-caption mt-3 inline-flex items-center gap-1 hover:text-white transition-colors">
                          Get your ID from @aegis_protocol_bot <ExternalLink className="w-3 h-3" />
                        </a>
                      </>
                    )
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-md" style={{ background: "var(--bg-elevated)" }}>
                      <Lock className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                      <span className="t-caption">
                        Requires <span className="text-white font-medium">Silver</span> tier (100K $UNIQ)
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick Links */}
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/vault" className="card card-hover-lift p-4 group">
                    <TrendingUp className="w-3.5 h-3.5 mb-2" style={{ color: "var(--text-secondary)" }} />
                    <span className="text-[13px] font-semibold text-white block">Protected vault</span>
                    <span className="t-caption">Earn yield with AI guard</span>
                  </Link>
                  <Link href="/scanner" className="card card-hover-lift p-4 group">
                    <Shield className="w-3.5 h-3.5 mb-2" style={{ color: "var(--text-secondary)" }} />
                    <span className="text-[13px] font-semibold text-white block">Token scanner</span>
                    <span className="t-caption">Scan any BSC token</span>
                  </Link>
                </div>

                {/* Tier card */}
                {result.tier === "Gold" ? (
                  <div className="card p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Crown className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                      <span className="text-[13px] font-semibold text-white">Gold tier</span>
                      <span className="ml-auto t-mono text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                        {result.uniqBalance >= 1_000_000 ? (result.uniqBalance / 1_000_000).toFixed(1) + "M" : (result.uniqBalance / 1_000).toFixed(0) + "K"} $UNIQ
                      </span>
                    </div>
                    <p className="t-caption mb-3">All features unlocked.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["AI analysis", "Telegram", "Priority alerts", "40% fee discount"].map((f) => (
                        <span key={f} className="text-[10px] font-medium px-2 py-0.5 rounded"
                          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <a href={"https://flap.sh/bnb/" + CONTRACTS.UNIQ_TOKEN} target="_blank" rel="noopener noreferrer"
                    className="card card-hover-lift p-5 block group">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                      <span className="text-[13px] font-semibold text-white">Upgrade tier</span>
                      <ExternalLink className="w-3 h-3 ml-auto opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }} />
                    </div>
                    <p className="t-caption">Hold $UNIQ for AI analysis, Telegram alerts, and fee discounts.</p>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
