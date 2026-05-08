"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWalletContext } from "../../lib/WalletContext";
import { CONTRACTS, HOLDER_TIER_BENEFITS } from "../../lib/constants";
import Link from "next/link";
import {
  Skull, Loader2,
  Wallet, Eye, RefreshCw, ArrowRight,
  ExternalLink, Activity, Shield,
  Crown, Lock,
  Zap, ChevronDown, ChevronUp,
  ShieldCheck,
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
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setCountdown(REFRESH_INTERVAL);
      if (!silent) toast.success("Scan complete, " + data.alertCount + " issues found");
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
  const ai = result?.aiAnalysis;
  const isGold = result?.tier === "Gold";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">

        {/* NOT CONNECTED */}
        {!isConnected && (
          <div className="space-y-10">
            <div className="text-center pt-8 pb-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6"
                style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)", color: "var(--accent)" }}>
                <Activity className="w-3.5 h-3.5" />
                AI Wallet Security Scanner
              </div>
              <h1 className="t-h1 text-white mb-4">
                Guardian Shield
              </h1>
              <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Connect your wallet and Aegis will scan every token you hold
                for rug pulls, honeypots, whale dumps, and contract risks.
                Enable Telegram alerts to get notified when new risks are detected.
                Read-only. No signatures required.
              </p>
              <button onClick={connect} disabled={isConnecting}
                className="btn-primary inline-flex items-center gap-2 mt-8 text-base px-8 py-3.5">
                <Wallet className="w-5 h-5" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Skull, label: "Rug Pull Detection", desc: "Mint capabilities, owner dumps, LP pulls", color: "#ef4444" },
                { icon: Activity, label: "Whale Tracking", desc: "Large holder concentration & movements", color: "var(--accent)" },
                { icon: Zap, label: "Honeypot Scanner", desc: "Simulated sells to detect trapped tokens", color: "#f97316" },
                { icon: Eye, label: "Contract Analysis", desc: "Pause, blacklist, proxy, upgrade detection", color: "var(--purple)" },
              ].map((f) => (
                <div key={f.label} className="card card-hover-lift p-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <div className="text-sm font-semibold text-white mb-1">{f.label}</div>
                  <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{f.desc}</div>
                </div>
              ))}
            </div>

            <div className="card p-6">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Crown className="w-4 h-4" style={{ color: "#ffd700" }} />
                $UNIQ Holder Tiers
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {([
                  { tier: "Free", req: "0 $UNIQ", color: "#6b7280" },
                  { tier: "Bronze", req: "10K $UNIQ", color: "#cd7f32" },
                  { tier: "Silver", req: "100K $UNIQ", color: "#c0c0c0" },
                  { tier: "Gold", req: "1M $UNIQ", color: "#ffd700" },
                ] as const).map((t) => (
                  <div key={t.tier} className="p-4 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid " + t.color + "15" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4" style={{ color: t.color }} />
                      <span className="text-sm font-bold" style={{ color: t.color }}>{t.tier}</span>
                      <span className="text-[10px] font-mono ml-auto" style={{ color: "var(--text-muted)" }}>{t.req}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {HOLDER_TIER_BENEFITS[t.tier].features}
                    </p>
                  </div>
                ))}
              </div>
              <a href={"https://flap.sh/bnb/" + CONTRACTS.UNIQ_TOKEN} target="_blank" rel="noopener noreferrer"
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "rgba(167, 139, 250, 0.08)", color: "var(--purple)", border: "1px solid rgba(167, 139, 250, 0.15)" }}>
                Get $UNIQ to Unlock Features <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="text-center">
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Want a quick one-time scan?</p>
              <Link href="/scanner" className="text-xs font-medium inline-flex items-center gap-1" style={{ color: "var(--accent)" }}>
                Open Token Scanner <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        {/* LOADING (Phase 4, skeleton scaffold) */}
        {isConnected && loading && (
          <div className="space-y-4">
            <div className="card p-8">
              <div className="flex items-center gap-3 mb-5">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--accent)" }} />
                <div>
                  <div className="t-h3 text-white">Scanning Your Wallet</div>
                  <div className="t-caption">Checking each token for honeypots, hidden taxes, whale risks, and rug pulls… (15–30s)</div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonStat key={i} />)}
              </div>
            </div>
            <div className="card p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton width={32} height={32} rounded="lg" />
                  <div className="flex-1"><Skeleton height={12} width="40%" className="mb-1.5" /><Skeleton height={10} width="70%" /></div>
                  <Skeleton height={20} width={56} rounded="full" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ERROR (Phase 4, EmptyState) */}
        {isConnected && error && !loading && (
          <EmptyState
            icon={Skull}
            tone="danger"
            title="Scan failed"
            description={error}
            action={address && (
              <button onClick={() => scanWallet(address)} className="btn-primary inline-flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Retry Scan
              </button>
            )}
          />
        )}

        {/* DASHBOARD */}
        {isConnected && result && !loading && (() => {
          // ─── Redesigned dashboard — monochrome neutral, single accent ──
          // Severity tone helper: returns muted/grayscale by default,
          // a single restrained sem-danger only for genuine critical.
          const sevTone = (sev: "critical" | "warning" | "info") =>
            sev === "critical"
              ? { label: "Critical", color: "var(--sem-danger)", dot: "var(--sem-danger)" }
              : sev === "warning"
              ? { label: "Warning",  color: "var(--text-primary)",  dot: "var(--sem-warning)" }
              : { label: "Info",     color: "var(--text-secondary)", dot: "var(--text-muted)" };

          const totalIssues = critAlerts.length + warnAlerts.length;
          const issuesTone = critAlerts.length > 0
            ? "var(--sem-danger)"
            : warnAlerts.length > 0
            ? "var(--text-primary)"
            : "var(--text-muted)";

          return (
          <div className="page-enter space-y-8">

            {/* ── HEADER ── single line, monochrome, no rainbow chips ── */}
            <div className="sticky top-16 z-40 -mx-4 px-4 py-4 backdrop-blur-xl"
              style={{ background: "rgba(9,9,11,0.85)", borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Shield className="w-4 h-4 shrink-0" style={{ color: "var(--text-secondary)" }} />
                  <h1 className="text-base font-semibold tracking-tight text-white truncate">Guardian Shield</h1>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                    <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--accent)" }} />
                    Live · refresh in {countdown}s
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono hidden md:inline" style={{ color: "var(--text-muted)" }}>
                    {address?.slice(0, 6)}…{address?.slice(-4)}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                    {result.tier}
                  </span>
                  <button onClick={() => address && scanWallet(address)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-white/[0.04]"
                    style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                    <RefreshCw className="w-3 h-3" /> Rescan
                  </button>
                </div>
              </div>
            </div>

            {/* ── HERO STATUS LINE ── one large statement, no boxes ── */}
            <div className="px-1">
              <div className="section-eyebrow mb-3">Wallet status</div>
              <h2 className="t-display mb-3" style={{ color: "var(--text-primary)" }}>
                {result.overallRisk === "DANGEROUS"
                  ? <>Critical risks <span style={{ color: "var(--sem-danger)" }}>detected</span>.</>
                  : result.overallRisk === "AT_RISK"
                  ? <>Some tokens need <span style={{ color: "var(--text-secondary)" }}>review</span>.</>
                  : <>Your wallet looks <span style={{ color: "var(--text-secondary)" }}>clean</span>.</>}
              </h2>
              <p className="t-body max-w-2xl" style={{ color: "var(--text-secondary)" }}>
                {totalIssues === 0
                  ? "No active threats across your holdings. Guardian re-checks every 60 seconds."
                  : "Aegis is monitoring " + result.tokenCount + " token" + (result.tokenCount === 1 ? "" : "s") + ". " + totalIssues + " issue" + (totalIssues === 1 ? "" : "s") + " require attention below."}
              </p>
            </div>

            {/* ── STAT STRIP ── flat, monochrome, no icon colours ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden"
              style={{ background: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
              {[
                { label: "Tokens scanned", value: String(result.tokenCount) },
                { label: "Critical",       value: String(critAlerts.length), tone: critAlerts.length > 0 ? "var(--sem-danger)" : "var(--text-primary)" },
                { label: "Warnings",       value: String(warnAlerts.length), tone: warnAlerts.length > 0 ? "var(--text-primary)" : "var(--text-primary)" },
                { label: "BNB balance",    value: parseFloat(result.bnbBalance).toFixed(4) },
              ].map((s) => (
                <div key={s.label} className="px-5 py-5" style={{ background: "var(--bg-base)" }}>
                  <div className="section-eyebrow mb-2">{s.label}</div>
                  <div className="text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums" style={{ color: s.tone || "var(--text-primary)" }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            {/* ── TWO COLUMN BODY ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* LEFT */}
              <div className="lg:col-span-3 space-y-6">

                {/* AI ANALYSIS, flat, no coloured header band */}
                {ai && (
                  <div className="card p-6 space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="section-eyebrow mb-2">{isGold ? "AI security analysis" : "Security analysis"}</div>
                        <h3 className="t-h3 text-white">
                          {ai.riskRating === "DANGEROUS" ? "Action required."
                            : ai.riskRating === "AT_RISK" ? "Review recommended."
                            : ai.riskRating === "CAUTION" ? "Monitor closely."
                            : "All checks passing."}
                        </h3>
                      </div>
                      {isGold && (
                        <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded shrink-0"
                          style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
                          AI · Llama 3.3
                        </span>
                      )}
                    </div>

                    <p className="t-body" style={{ color: "var(--text-secondary)" }}>
                      {ai.summary}
                    </p>

                    {(ai.topThreats.length > 0 || ai.actions.length > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px rounded-xl overflow-hidden"
                        style={{ background: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                        {ai.topThreats.length > 0 && (
                          <div className="p-4" style={{ background: "var(--bg-base)" }}>
                            <div className="section-eyebrow mb-3">Top threats</div>
                            <ol className="space-y-2.5">
                              {ai.topThreats.map((threat, i) => (
                                <li key={i} className="flex items-start gap-2.5">
                                  <span className="text-xs font-mono shrink-0 w-4" style={{ color: "var(--text-muted)" }}>{String(i + 1).padStart(2, "0")}</span>
                                  <span className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{threat}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {ai.actions.length > 0 && (
                          <div className="p-4" style={{ background: "var(--bg-base)" }}>
                            <div className="section-eyebrow mb-3">Recommended actions</div>
                            <ol className="space-y-2.5">
                              {ai.actions.map((action, i) => (
                                <li key={i} className="flex items-start gap-2.5">
                                  <span className="text-xs font-mono shrink-0 w-4" style={{ color: "var(--text-muted)" }}>{String(i + 1).padStart(2, "0")}</span>
                                  <span className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{action}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    )}

                    {ai.holdingBreakdown.length > 0 && (
                      <div>
                        <div className="section-eyebrow mb-3">Token verdicts</div>
                        <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
                          {ai.holdingBreakdown.map((h, i) => {
                            const vl = h.verdict.toLowerCase();
                            const isDanger  = vl.includes("honeypot") || vl.includes("exit") || vl.includes("dangerous");
                            const isWarn    = vl.includes("high risk") || vl.includes("consider selling") || vl.includes("moderate") || vl.includes("monitor");
                            const dot = isDanger ? "var(--sem-danger)" : isWarn ? "var(--sem-warning)" : "var(--text-muted)";
                            return (
                              <div key={i} className="flex items-center gap-4 py-3"
                                style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
                                <span className="text-sm font-semibold text-white min-w-[64px] shrink-0">{h.symbol}</span>
                                <span className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{h.verdict}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {!isGold && (
                      <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Upgrade to Gold for LLM-powered reasoning.
                        </span>
                        <a href={"https://flap.sh/bnb/" + CONTRACTS.UNIQ_TOKEN} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: "var(--accent)" }}>
                          Get $UNIQ <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* SECURITY ALERTS, flat list, single column, sev shown via tiny dot + label */}
                <div className="card overflow-hidden">
                  <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <div>
                      <div className="section-eyebrow mb-1">Security alerts</div>
                      <h3 className="t-h3 text-white">{totalIssues === 0 ? "No active issues" : totalIssues + " issue" + (totalIssues === 1 ? "" : "s")}</h3>
                    </div>
                    {totalIssues > 0 && (
                      <span className="text-xs font-mono tabular-nums" style={{ color: issuesTone }}>
                        {critAlerts.length} crit · {warnAlerts.length} warn
                      </span>
                    )}
                  </div>

                  {[...critAlerts, ...warnAlerts, ...infoAlerts.filter(a => userRank >= (tierRank[a.minTier] ?? 0))].map((alert) => {
                    const tone = sevTone(alert.severity);
                    const expanded = expandedAlert === alert.id;
                    return (
                      <div key={alert.id} className="transition-colors hover:bg-white/[0.015]"
                        style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <button onClick={() => setExpandedAlert(expanded ? null : alert.id)}
                          className="w-full px-6 py-4 flex items-center gap-4 text-left">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tone.dot }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: tone.color }}>
                                {tone.label}
                              </span>
                              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>·</span>
                              <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{alert.token}</span>
                            </div>
                            <div className="text-sm font-medium text-white truncate">{alert.title}</div>
                          </div>
                          {expanded
                            ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                            : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
                        </button>
                        {expanded && (
                          <div className="pl-12 pr-6 pb-5 animate-fade-in">
                            <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>{alert.description}</p>
                            <a href={"https://bscscan.com/token/" + alert.tokenAddress} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: "var(--accent)" }}>
                              View on BscScan <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {(() => {
                    const locked = infoAlerts.filter(a => userRank < (tierRank[a.minTier] ?? 0));
                    if (locked.length === 0) return null;
                    return (
                      <div className="px-6 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {locked.length} more alert{locked.length === 1 ? "" : "s"} require a higher tier
                          </span>
                        </div>
                        <a href={"https://flap.sh/bnb/" + CONTRACTS.UNIQ_TOKEN} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-medium hover:underline" style={{ color: "var(--accent)" }}>
                          Upgrade
                        </a>
                      </div>
                    );
                  })()}

                  {result.alerts.length === 0 && (
                    <div className="px-6 py-16 text-center">
                      <ShieldCheck className="w-8 h-8 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
                      <p className="text-sm font-medium text-white mb-1">All clear</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>No threats detected across your holdings.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT */}
              <div className="lg:col-span-2 space-y-6">

                {/* HOLDINGS, minimal table-style list, score chip is monochrome */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="section-eyebrow mb-1">Holdings</div>
                        <h3 className="t-h3 text-white">{sortedScans.length} token{sortedScans.length === 1 ? "" : "s"}</h3>
                      </div>
                    </div>
                  </div>

                  {sortedScans.length > 0 ? sortedScans.map((scan) => {
                    const holding = result.holdings.find((h) => h.address.toLowerCase() === scan.address.toLowerCase());
                    const isExpanded = expandedToken === scan.address;
                    const dot = scan.riskScore >= 70 ? "var(--sem-danger)"
                      : scan.riskScore >= 40 ? "var(--sem-warning)"
                      : scan.riskScore >= 20 ? "var(--text-secondary)"
                      : "var(--text-muted)";
                    return (
                      <div key={scan.address} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <button onClick={() => setExpandedToken(isExpanded ? null : scan.address)}
                          className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-colors">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">{scan.symbol}</span>
                              <span className="text-[11px] tabular-nums font-mono" style={{ color: "var(--text-muted)" }}>
                                · risk {scan.riskScore}
                              </span>
                            </div>
                            {scan.flags.length > 0 && (
                              <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                                {scan.flags.slice(0, 3).map(formatFlag).join(" · ")}
                                {scan.flags.length > 3 ? " · +" + (scan.flags.length - 3) : ""}
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-mono tabular-nums shrink-0" style={{ color: "var(--text-secondary)" }}>
                            {holding ? formatBalance(holding.balance) : "\u2014"}
                          </span>
                          {isExpanded
                            ? <ChevronUp className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                            : <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />}
                        </button>
                        {isExpanded && (
                          <div className="px-5 pb-5 pt-2 animate-fade-in">
                            <div className="grid grid-cols-2 gap-px rounded-lg overflow-hidden mb-3"
                              style={{ background: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                              {[
                                { label: "Buy tax",    val: scan.buyTax.toFixed(1) + "%" },
                                { label: "Sell tax",   val: scan.sellTax.toFixed(1) + "%" },
                                { label: "Liquidity",  val: "$" + (scan.liquidityUsd >= 1000 ? (scan.liquidityUsd / 1000).toFixed(1) + "K" : scan.liquidityUsd.toFixed(0)) },
                                { label: "Top holder", val: scan.topHolderPercent + "%" },
                              ].map((m) => (
                                <div key={m.label} className="px-3 py-2.5" style={{ background: "var(--bg-base)" }}>
                                  <div className="section-eyebrow mb-1">{m.label}</div>
                                  <div className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{m.val}</div>
                                </div>
                              ))}
                            </div>
                            {scan.flags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {scan.flags.map((f) => (
                                  <span key={f} className="text-[10px] font-medium px-2 py-0.5 rounded"
                                    style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                                    {formatFlag(f)}
                                  </span>
                                ))}
                              </div>
                            )}
                            <a href={"https://bscscan.com/token/" + scan.address} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: "var(--accent)" }}>
                              View on BscScan <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div className="px-5 py-12 text-center">
                      <p className="text-sm font-medium text-white mb-1">
                        {result.tokenCount > 0 ? "Only safe tokens" : "No tokens found"}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {result.tokenCount > 0 ? "All recognised holdings cleared." : "This wallet holds no ERC-20s."}
                      </p>
                    </div>
                  )}
                </div>

                {/* TELEGRAM, neutral card, single accent on CTA */}
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="section-eyebrow mb-1">Push alerts</div>
                      <h3 className="t-h3 text-white">Telegram</h3>
                    </div>
                    {tgConnected && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
                        <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--accent)" }} />
                        Active
                      </span>
                    )}
                  </div>
                  {userRank >= 2 ? (
                    tgConnected ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          You&apos;ll receive critical alerts in Telegram.
                        </span>
                        <button onClick={disconnectTelegram} disabled={tgLoading}
                          className="text-xs font-medium hover:underline disabled:opacity-40"
                          style={{ color: "var(--text-secondary)" }}>
                          {tgLoading ? "…" : "Disconnect"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <input type="text" value={tgChatId} onChange={(e) => setTgChatId(e.target.value)}
                            placeholder="Telegram chat ID"
                            className="flex-1 text-xs px-3 py-2.5 rounded-lg outline-none min-w-0 focus:border-white/20 transition-colors"
                            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
                          <button onClick={connectTelegram} disabled={tgLoading || !tgChatId.trim()}
                            className="px-3.5 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-40 shrink-0 transition-opacity"
                            style={{ background: "var(--accent)", color: "var(--bg-base)" }}>
                            {tgLoading ? "…" : "Connect"}
                          </button>
                        </div>
                        <a href="https://t.me/aegis_protocol_bot" target="_blank" rel="noopener noreferrer"
                          className="text-[11px] mt-3 inline-flex items-center gap-1 hover:underline" style={{ color: "var(--text-muted)" }}>
                          Get your chat ID → @aegis_protocol_bot <ExternalLink className="w-3 h-3" />
                        </a>
                      </>
                    )
                  ) : (
                    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                      <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                      <span className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        Telegram alerts unlock at <span className="text-white font-medium">Silver tier</span> (100K $UNIQ).
                      </span>
                    </div>
                  )}
                </div>

                {/* QUICK LINKS, flat, monochrome, hover changes border only */}
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/vault" className="card card-hover-lift p-4 group">
                    <div className="section-eyebrow mb-1">Yield</div>
                    <div className="text-sm font-semibold text-white mb-1">Protected Vault</div>
                    <div className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Open <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                  <Link href="/scanner" className="card card-hover-lift p-4 group">
                    <div className="section-eyebrow mb-1">Scan</div>
                    <div className="text-sm font-semibold text-white mb-1">Token Scanner</div>
                    <div className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Open <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                </div>

                {/* TIER PANEL, neutral, no gold/purple glow */}
                {result.tier === "Gold" ? (
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="section-eyebrow mb-1">Membership</div>
                        <h3 className="t-h3 text-white">Gold tier</h3>
                      </div>
                      <span className="text-xs font-mono tabular-nums" style={{ color: "var(--text-muted)" }}>
                        {result.uniqBalance >= 1_000_000 ? (result.uniqBalance / 1_000_000).toFixed(2) + "M" : (result.uniqBalance / 1_000).toFixed(0) + "K"} $UNIQ
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      All features unlocked: AI analysis, Telegram alerts, priority queue, 40% fee discount.
                    </p>
                  </div>
                ) : (
                  <a href={"https://flap.sh/bnb/" + CONTRACTS.UNIQ_TOKEN} target="_blank" rel="noopener noreferrer"
                    className="card card-hover-lift p-5 block group">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="section-eyebrow mb-1">Upgrade</div>
                        <h3 className="t-h3 text-white">Unlock more</h3>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5" style={{ color: "var(--text-muted)" }} />
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Hold $UNIQ for AI analysis, Telegram alerts, and fee discounts up to 40%.
                    </p>
                  </a>
                )}
              </div>
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
}
