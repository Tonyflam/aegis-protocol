import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSub } from "../../../lib/telegram-store";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import {
  saveSnapshot,
  getSnapshot,
  getTgSent,
  setTgSent,
  getAlertHistory,
  setAlertHistory,
  type AlertHistory,
} from "../../../lib/guardian-snapshot";

// ─── Guardian Shield API ─────────────────────────────────────
// Accepts a wallet address, fetches token holdings via /api/wallet,
// scans each token via /api/scan, then generates AI risk alerts via Groq.

const GROQ_KEY = process.env.GROQ_API_KEY || "";
const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_API = `https://api.telegram.org/bot${TG_BOT_TOKEN}`;

// How long an alert ID stays in the "already sent" set before it can re-alert.
const TG_ALERT_REMIND_MS = 6 * 60 * 60 * 1000; // 6h
// Min spacing between two consecutive Telegram messages per wallet.
const TG_MIN_GAP_MS = 5 * 60 * 1000; // 5min

// Content-stable alert id so dedup works across scans.
// Same rule on same token => same id forever.
function stableAlertId(severity: string, title: string, tokenAddress: string): string {
  return createHash("sha1")
    .update(`${severity}|${title}|${tokenAddress.toLowerCase()}`)
    .digest("hex")
    .slice(0, 16);
}

function formatRelative(ms: number): string {
  const s = Math.max(1, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── Push alerts to Telegram if subscribed ───────────────────
// Strategy: classify alerts vs the last cron scan recorded in AlertHistory.
// We deliver a single contextual message only when state has actually changed:
//   • new critical/warning alerts that weren't present last scan
//   • alerts whose severity was raised since last scan
//   • alerts that have been cleared (you sold, contract changed, etc.)
// If none of those changed, we stay silent — silence is the most important
// signal that monitoring is real and not theatre.
async function pushTelegramAlerts(
  address: string,
  alerts: Alert[],
  history: AlertHistory,
  nextHistory: AlertHistory,
): Promise<void> {
  const addr = address.toLowerCase();
  const sub = await getSub(addr);
  if (!sub || !TG_BOT_TOKEN) return;

  const now = Date.now();
  const actionable = alerts.filter(a => a.severity === "critical" || a.severity === "warning");
  const byId = new Map(alerts.map(a => [a.id, a] as const));

  const prevIds = new Set(history.lastIds);
  const prevSeverity = history.lastSeverity || {};
  const sevRank = (s: string) => (s === "critical" ? 2 : s === "warning" ? 1 : 0);

  const newAlerts = actionable.filter(a => !prevIds.has(a.id));
  const escalated = actionable.filter(a => {
    const prev = prevSeverity[a.id];
    return prev && sevRank(a.severity) > sevRank(prev);
  });
  // Cleared = something we previously flagged as actionable that no longer
  // appears in the current scan. Sorted oldest-firstSeen first.
  const resolvedIds = history.lastIds
    .filter(id => !byId.has(id) && sevRank(prevSeverity[id] || "info") > 0)
    .sort((a, b) => (history.firstSeen[a] ?? 0) - (history.firstSeen[b] ?? 0));

  // Min-gap throttle — never crowd the chat.
  const tgSent = await getTgSent(addr);
  if (tgSent && now - tgSent.at < TG_MIN_GAP_MS) return;

  // Safety-net dedup (kicks in if Redis history was lost).
  const stillRemembered = tgSent && now - tgSent.at < TG_ALERT_REMIND_MS
    ? new Set(tgSent.sentIds)
    : new Set<string>();
  const trulyNew = newAlerts.filter(a => !stillRemembered.has(a.id));

  const hasNew = trulyNew.length > 0;
  const hasEscalated = escalated.length > 0;
  const hasResolved = resolvedIds.length > 0;
  if (!hasNew && !hasEscalated && !hasResolved) return;

  // ── Premium card composition ─────────────────────────────
  const sevTag = (a: Alert) => a.severity === "critical" ? "\u{1F534} CRITICAL" : "\u{1F7E1} WARNING";
  const renderAlert = (a: Alert): string => {
    const tokenLink = a.tokenAddress
      ? ` · <a href="https://bscscan.com/token/${a.tokenAddress}">BSCScan</a>`
      : "";
    const sym = a.token ? `<b>$${escapeHtml(a.token)}</b>` : "";
    const seenAt = history.firstSeen[a.id];
    const ageBadge = seenAt && now - seenAt > 60_000 ? ` <i>· still active ${formatRelative(now - seenAt)}</i>` : "";
    return [
      `${sevTag(a)} ${sym}, <b>${escapeHtml(a.title)}</b>${ageBadge}`,
      `   <i>${escapeHtml(a.description)}</i>${tokenLink}`,
    ].join("\n");
  };

  // Headline reflects the dominant state change so every message reads fresh.
  let headlineEmoji: string;
  let headlineLabel: string;
  if (hasNew) {
    const critNew = trulyNew.filter(a => a.severity === "critical").length;
    if (critNew > 0) {
      headlineEmoji = "\u{1F6A8}";
      headlineLabel = "NEW CRITICAL RISK";
    } else {
      headlineEmoji = "\u26A0\uFE0F";
      headlineLabel = "NEW WARNING";
    }
  } else if (hasEscalated) {
    headlineEmoji = "\u26A1";
    headlineLabel = "RISK ESCALATED";
  } else {
    headlineEmoji = "\u2705";
    headlineLabel = "RISK CLEARED";
  }

  const scanLabel = `Scan #${nextHistory.scanCount}`;
  const timeLabel = new Date(now).toUTCString().replace(" GMT", " UTC");

  const headerLines: string[] = [
    `${headlineEmoji} <b>AEGIS GUARDIAN</b>  ·  <b>${headlineLabel}</b>`,
    `Wallet · <code>${address.slice(0, 6)}\u2026${address.slice(-4)}</code>`,
    `<i>${scanLabel} · ${timeLabel}</i>`,
  ];

  const counts: string[] = [];
  if (hasNew) {
    const c = trulyNew.filter(a => a.severity === "critical").length;
    const w = trulyNew.filter(a => a.severity === "warning").length;
    if (c > 0) counts.push(`<b>${c}</b> new critical`);
    if (w > 0) counts.push(`<b>${w}</b> new warning${w === 1 ? "" : "s"}`);
  }
  if (hasEscalated) counts.push(`<b>${escalated.length}</b> escalated`);
  if (hasResolved) counts.push(`<b>${resolvedIds.length}</b> cleared`);
  if (counts.length > 0) headerLines.push(counts.join("  ·  "));

  const SEP = "\u2500".repeat(18);
  const bodyChunks: string[] = [];

  if (hasNew) {
    const criticals = trulyNew.filter(a => a.severity === "critical").slice(0, 4);
    const warnings = trulyNew.filter(a => a.severity === "warning").slice(0, 4);
    const newCards: string[] = [];
    for (const a of criticals) newCards.push(renderAlert(a));
    if (criticals.length > 0 && warnings.length > 0) newCards.push("");
    for (const a of warnings) newCards.push(renderAlert(a));
    const overflow = trulyNew.length - criticals.length - warnings.length;
    if (overflow > 0) newCards.push(`<i>+ ${overflow} more new, see full report</i>`);
    if (newCards.length > 0) bodyChunks.push(newCards.join("\n\n"));
  }

  if (hasEscalated) {
    const lines = [`<b>\u2B06\uFE0F Severity raised</b>`];
    for (const a of escalated.slice(0, 3)) {
      const prev = prevSeverity[a.id];
      lines.push(`• ${escapeHtml(a.title)} <i>(${prev} \u2192 ${a.severity})</i>`);
    }
    if (escalated.length > 3) lines.push(`<i>+ ${escalated.length - 3} more</i>`);
    bodyChunks.push(lines.join("\n"));
  }

  if (hasResolved) {
    const lines = [`<b>\u2705 Cleared since last scan</b>`];
    for (const id of resolvedIds.slice(0, 3)) {
      const firstSeenAt = history.firstSeen[id];
      const dur = firstSeenAt ? ` <i>(was active ${formatRelative(now - firstSeenAt)})</i>` : "";
      const sev = prevSeverity[id] || "alert";
      lines.push(`• ${sev} <code>${id.slice(0, 8)}</code>${dur}`);
    }
    if (resolvedIds.length > 3) lines.push(`<i>+ ${resolvedIds.length - 3} more cleared</i>`);
    bodyChunks.push(lines.join("\n"));
  }

  // Footer context: how many ongoing risks remain, oldest one
  const stillActive = actionable.filter(a => prevIds.has(a.id));
  if (stillActive.length > 0 && (hasNew || hasEscalated)) {
    const oldest = stillActive
      .map(a => history.firstSeen[a.id])
      .filter((t): t is number => typeof t === "number")
      .sort((x, y) => x - y)[0];
    if (oldest) {
      bodyChunks.push(`<i>${stillActive.length} ongoing risk${stillActive.length === 1 ? "" : "s"} still active · oldest first seen ${formatRelative(now - oldest)}</i>`);
    }
  }

  const text = [headerLines.join("\n"), SEP, bodyChunks.join("\n\n")].join("\n\n");

  const reply_markup = {
    inline_keyboard: [
      [
        { text: "\u{1F6E1}\uFE0F Full Report", url: `https://aegisguardian.xyz/guardian?address=${address}` },
        { text: "\u{1F50D} Wallet on BSCScan", url: `https://bscscan.com/address/${address}` },
      ],
      [
        { text: "\u{1F507} Mute 6h", callback_data: `mute:${address}:21600` },
        { text: "\u2705 Acknowledge", callback_data: `ack:${address}` },
      ],
    ],
  };

  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: sub.chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      // Record EVERY actionable id (including ones that didn't change) so
      // we don't re-send if history is later lost.
      const merged = new Set([...stillRemembered, ...actionable.map(a => a.id)]);
      await setTgSent(addr, { sentIds: [...merged], at: now });
    }
  } catch { /* Telegram unavailable, skip silently */ }
}

// Minimal HTML escape so user-controlled token symbols and titles cannot
// inject Telegram HTML-mode formatting.
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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

// Build rule-based analysis (works for all tiers, no LLM needed)
function buildRuleBasedAnalysis(
  alerts: Alert[],
  scans: TokenScan[],
  holdings: WalletToken[],
  bnbBalance: string,
): AiAnalysis {
  const critCount = alerts.filter((a) => a.severity === "critical").length;
  const warnCount = alerts.filter((a) => a.severity === "warning").length;

  const riskRating: AiAnalysis["riskRating"] =
    critCount >= 2 ? "DANGEROUS" : critCount >= 1 ? "AT_RISK" : warnCount >= 2 ? "CAUTION" : "SAFE";

  const topThreats = alerts
    .filter((a) => a.severity === "critical" || a.severity === "warning")
    .slice(0, 4)
    .map((a) => `${a.token}: ${a.title}`);

  const actions: string[] = [];
  const honeypots = scans.filter((s) => s.isHoneypot);
  if (honeypots.length > 0)
    actions.push(`Sell ${honeypots.map((s) => s.symbol).join(", ")} immediately, honeypot detected`);
  const highRisk = scans.filter((s) => s.riskScore >= 70 && !s.isHoneypot);
  if (highRisk.length > 0)
    actions.push(`Consider exiting ${highRisk.map((s) => s.symbol).join(", ")}, critical risk score`);
  const mintable = scans.filter((s) => s.ownerCanMint && !s.isHoneypot);
  if (mintable.length > 0)
    actions.push(`Monitor ${mintable.map((s) => s.symbol).join(", ")}, owner can mint unlimited tokens`);
  const lowLiq = scans.filter((s) => s.liquidityUsd < 10000 && s.liquidityUsd > 0 && !s.isHoneypot);
  if (lowLiq.length > 0)
    actions.push(`Be cautious with ${lowLiq.map((s) => s.symbol).join(", ")}, low liquidity`);
  if (parseFloat(bnbBalance) < 0.01)
    actions.push("Top up BNB, you may not have enough for gas fees");
  if (actions.length === 0)
    actions.push("No immediate action required, continue monitoring");

  const holdingBreakdown = scans.map((s) => {
    let verdict: string;
    if (s.isHoneypot) verdict = "HONEYPOT, Cannot sell. Exit if possible.";
    else if (s.riskScore >= 70) verdict = `High risk (${s.riskScore}/100). ${s.flags.slice(0, 2).join(", ")}. Consider selling.`;
    else if (s.riskScore >= 40) verdict = `Moderate risk (${s.riskScore}/100). ${s.flags.slice(0, 2).join(", ")}. Monitor closely.`;
    else if (s.riskScore >= 20) verdict = `Low risk (${s.riskScore}/100). Minor flags detected.`;
    else verdict = `Safe (${s.riskScore}/100). No major issues found.`;
    return { symbol: s.symbol, verdict };
  });

  const tokenWord = scans.length === 1 ? "token" : "tokens";
  const summary = critCount > 0
    ? `Your wallet contains ${scans.length} ${tokenWord} with ${critCount} critical issue${critCount > 1 ? "s" : ""} and ${warnCount} warning${warnCount !== 1 ? "s" : ""}. ${honeypots.length > 0 ? `${honeypots.map(h => h.symbol).join(", ")} ${honeypots.length === 1 ? "is a" : "are"} confirmed honeypot${honeypots.length > 1 ? "s" : ""}. ` : ""}Immediate action recommended.`
    : warnCount > 0
    ? `Your wallet holds ${scans.length} ${tokenWord} with ${warnCount} warning${warnCount !== 1 ? "s" : ""}. No critical threats but some elevated risk. Review flagged items below.`
    : `Your wallet holds ${scans.length} ${tokenWord}. No critical threats detected. Holdings appear safe.`;

  return { summary, riskRating, topThreats, actions, holdingBreakdown };
}
// ─── Build alerts from scan results ──────────────────────────
function buildAlerts(scans: TokenScan[], holdings: WalletToken[]): Alert[] {
  const alerts: Alert[] = [];
  const now = Date.now();
  let alertId = 0;


  for (const scan of scans) {
    const holding = holdings.find(
      (h) => h.address.toLowerCase() === scan.address.toLowerCase()
    );
    const bal = holding ? holding.balance : "0";

    // ═══ THREAT ALERTS (static contract findings) ═══

    // Critical: Honeypot
    if (scan.isHoneypot) {
      alerts.push({
        id: `alert-${++alertId}`, severity: "critical", category: "threat", minTier: "Free",
        title: `${scan.symbol} is a Honeypot`,
        description: `You hold ${bal} ${scan.symbol}. This token blocks sells, you cannot exit this position.`,
        token: scan.symbol, tokenAddress: scan.address, timestamp: now,
      });
    }

    // Critical: Extreme tax
    if (scan.sellTax > 50 || scan.buyTax > 50) {
      alerts.push({
        id: `alert-${++alertId}`, severity: "critical", category: "threat", minTier: "Free",
        title: `${scan.symbol} has extreme tax (${scan.sellTax}% sell)`,
        description: `Selling costs ${scan.sellTax}% in tax. Most of your ${bal} tokens will be lost on exit.`,
        token: scan.symbol, tokenAddress: scan.address, timestamp: now,
      });
    }

    // Critical: Can mint
    if (scan.ownerCanMint && !scan.isRenounced) {
      alerts.push({
        id: `alert-${++alertId}`, severity: "critical", category: "threat", minTier: "Free",
        title: `${scan.symbol} owner can mint unlimited tokens`,
        description: `The contract owner can create unlimited ${scan.symbol}, diluting your ${bal} holdings to zero.`,
        token: scan.symbol, tokenAddress: scan.address, timestamp: now,
      });
    }

    // Warning: High tax
    if (scan.sellTax > 10 && scan.sellTax <= 50) {
      alerts.push({
        id: `alert-${++alertId}`, severity: "warning", category: "threat", minTier: "Free",
        title: `${scan.symbol} has high sell tax (${scan.sellTax}%)`,
        description: `Selling costs ${scan.sellTax}% per trade. Factor this into your exit strategy.`,
        token: scan.symbol, tokenAddress: scan.address, timestamp: now,
      });
    }

    // ═══ MONITORING ALERTS (ongoing watch items) ═══

    // Free tier: Whale dump risk monitoring
    if (scan.topHolderPercent > 20) {
      alerts.push({
        id: `alert-${++alertId}`, severity: scan.topHolderPercent > 50 ? "critical" : "warning",
        category: "monitoring", minTier: "Free",
        title: `Watching for whale dumps on ${scan.symbol}`,
        description: `Top holder owns ${scan.topHolderPercent}% of supply. Monitoring for large sells that could crash the price.`,
        token: scan.symbol, tokenAddress: scan.address, timestamp: now,
      });
    }

    // Free tier: Honeypot detection post-buy
    if (!scan.isHoneypot && scan.sellTax > 3 && scan.sellTax <= 10) {
      alerts.push({
        id: `alert-${++alertId}`, severity: "info", category: "monitoring", minTier: "Free",
        title: `Monitoring ${scan.symbol} sell tax changes`,
        description: `Current sell tax is ${scan.sellTax.toFixed(1)}%. Watching for increases that could trap sellers.`,
        token: scan.symbol, tokenAddress: scan.address, timestamp: now,
      });
    }

    // Free tier: Liquidity pull risk
    if (!scan.isLiquidityLocked && scan.liquidityUsd > 0) {
      alerts.push({
        id: `alert-${++alertId}`, severity: "warning", category: "monitoring", minTier: "Free",
        title: `Watching for liquidity pull on ${scan.symbol}`,
        description: `LP tokens are unlocked ($${scan.liquidityUsd.toFixed(0)} at risk). Monitoring for removal by the developer.`,
        token: scan.symbol, tokenAddress: scan.address, timestamp: now,
      });
    }

    // Free tier: Low liquidity warning
    if (scan.liquidityUsd > 0 && scan.liquidityUsd < 1000) {
      alerts.push({
        id: `alert-${++alertId}`, severity: "warning", category: "monitoring", minTier: "Free",
        title: `${scan.symbol} liquidity critically low`,
        description: `Only $${scan.liquidityUsd.toFixed(0)} in liquidity. You may not be able to sell your ${bal} tokens.`,
        token: scan.symbol, tokenAddress: scan.address, timestamp: now,
      });
    }

    // Bronze+: Dev wallet control monitoring
    if (!scan.isRenounced && (scan.ownerCanPause || scan.ownerCanBlacklist || scan.ownerCanMint)) {
      const controls = [
        scan.ownerCanMint ? "mint tokens" : "",
        scan.ownerCanPause ? "pause trading" : "",
        scan.ownerCanBlacklist ? "blacklist wallets" : "",
      ].filter(Boolean).join(", ");
      alerts.push({
        id: `alert-${++alertId}`, severity: "warning", category: "monitoring", minTier: "Bronze",
        title: `Tracking dev wallet for ${scan.symbol}`,
        description: `Owner has active controls: ${controls}. Watching for suspicious admin actions.`,
        token: scan.symbol, tokenAddress: scan.address, timestamp: now,
      });
    }

    // Bronze+: Proxy contract monitoring
    if (scan.isProxy) {
      alerts.push({
        id: `alert-${++alertId}`, severity: "warning", category: "monitoring", minTier: "Bronze",
        title: `Watching ${scan.symbol} for contract upgrades`,
        description: `Upgradeable proxy detected. Monitoring for code changes that could introduce malicious behavior.`,
        token: scan.symbol, tokenAddress: scan.address, timestamp: now,
      });
    }

    // Silver+: Priority liquidity depth monitoring
    if (scan.liquidityUsd >= 1000 && scan.liquidityUsd < 50000) {
      alerts.push({
        id: `alert-${++alertId}`, severity: "info", category: "monitoring", minTier: "Silver",
        title: `Tracking ${scan.symbol} liquidity depth`,
        description: `$${scan.liquidityUsd >= 1000 ? `${(scan.liquidityUsd / 1000).toFixed(1)}K` : scan.liquidityUsd.toFixed(0)} liquidity. Priority monitoring for significant changes in pool depth.`,
        token: scan.symbol, tokenAddress: scan.address, timestamp: now,
      });
    }

    // Info: Not verified (all tiers)
    if (!scan.flags.includes("VERIFIED") && scan.riskScore >= 20) {
      alerts.push({
        id: `alert-${++alertId}`, severity: "info", category: "threat", minTier: "Free",
        title: `${scan.symbol} contract is not source-verified`,
        description: `Source code not published on BscScan. You can't inspect what the contract does.`,
        token: scan.symbol, tokenAddress: scan.address, timestamp: now,
      });
    }
  }

  // Sort: critical first, then warning, then info
  const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  // Replace counter-based IDs with content-stable IDs so dedup actually works.
  // Same rule on same token => identical id across every scan, forever.
  for (const a of alerts) {
    a.id = stableAlertId(a.severity, a.title, a.tokenAddress);
  }

  return alerts;
}

// ─── Enhanced AI Analysis via Groq (Gold tier) ──────────────
async function generateAiAnalysis(
  alerts: Alert[],
  scans: TokenScan[],
  holdings: WalletToken[],
  bnbBalance: string,
): Promise<AiAnalysis> {
  const baseline = buildRuleBasedAnalysis(alerts, scans, holdings, bnbBalance);
  if (!GROQ_KEY) return baseline;

  const holdingsSummary = holdings
    .map((h) => `${h.symbol}: ${Number(h.balance).toLocaleString()} tokens`)
    .join(", ");

  const scanSummary = scans
    .map(
      (s) =>
        `${s.symbol} (risk: ${s.riskScore}/100, ${s.recommendation}, tax: ${s.buyTax}/${s.sellTax}%, liq: $${s.liquidityUsd.toFixed(0)}, honeypot: ${s.isHoneypot}, mint: ${s.ownerCanMint}, renounced: ${s.isRenounced}, flags: [${s.flags.join(", ")}])`
    )
    .join("\n");

  const prompt = `You are Aegis Shield AI, an expert DeFi security analyst on BNB Chain. Analyze this wallet and return ONLY valid JSON.

Wallet: ${bnbBalance} BNB
Holdings: ${holdingsSummary}

Token scans:
${scanSummary}

Return ONLY this JSON (no markdown, no backticks):
{
  "summary": "2-4 sentence security assessment. Be specific about which tokens are risky and why. Mention dollar amounts of liquidity. Be direct.",
  "riskRating": "SAFE|CAUTION|AT_RISK|DANGEROUS",
  "topThreats": ["specific threat 1", "specific threat 2", "specific threat 3"],
  "actions": ["specific action 1 with token name", "specific action 2"],
  "holdingBreakdown": [{"symbol": "TOKEN", "verdict": "1-sentence verdict with specific data"}]
}`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || baseline.summary,
          riskRating: ["SAFE", "CAUTION", "AT_RISK", "DANGEROUS"].includes(parsed.riskRating) ? parsed.riskRating : baseline.riskRating,
          topThreats: Array.isArray(parsed.topThreats) ? parsed.topThreats.slice(0, 5) : baseline.topThreats,
          actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 5) : baseline.actions,
          holdingBreakdown: Array.isArray(parsed.holdingBreakdown) ? parsed.holdingBreakdown.slice(0, 10) : baseline.holdingBreakdown,
        };
      }
    }
  } catch { /* Groq unavailable, fall back to rule-based */ }
  return baseline;
}

// ─── Tier thresholds (must match constants.ts) ──────────────
const UNIQ_ADDRESS = "0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777";
const TIER_THRESHOLDS = { Bronze: 10_000, Silver: 100_000, Gold: 1_000_000 };

function computeTier(holdings: WalletToken[]): { tier: string; uniqBalance: number } {
  const uniq = holdings.find(
    (h) => h.address.toLowerCase() === UNIQ_ADDRESS,
  );
  const balance = uniq ? parseFloat(uniq.balance) : 0;
  if (balance >= TIER_THRESHOLDS.Gold) return { tier: "Gold", uniqBalance: balance };
  if (balance >= TIER_THRESHOLDS.Silver) return { tier: "Silver", uniqBalance: balance };
  if (balance >= TIER_THRESHOLDS.Bronze) return { tier: "Bronze", uniqBalance: balance };
  return { tier: "Free", uniqBalance: balance };
}

// ─── Main Handler ────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (await checkRateLimit(request, { maxRequests: 10, windowMs: 60_000 })) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("address");
  const cachedOnly = searchParams.get("cached") === "1";
  const source = searchParams.get("source") || "user";
  const isCron = source === "cron";

  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  // ── Cached read path ─────────────────────────────────────
  // Used by the UI's poll loop so the page surfaces cron-found alerts
  // immediately on reopen. Falls through to live scan if no snapshot.
  if (cachedOnly) {
    const snap = await getSnapshot(walletAddress);
    if (snap) {
      const data = snap.data as Record<string, unknown>;
      return NextResponse.json({ ...data, fromCache: true, cachedAt: snap.at });
    }
    return NextResponse.json({ error: "No cached snapshot yet" }, { status: 404 });
  }

  const origin = new URL(request.url).origin;

  try {
    // 1. Fetch wallet holdings
    const walletRes = await fetch(
      `${origin}/api/wallet?address=${encodeURIComponent(walletAddress)}`,
      { signal: AbortSignal.timeout(30000) }
    );
    if (!walletRes.ok) {
      return NextResponse.json({ error: "Failed to fetch wallet holdings" }, { status: 502 });
    }
    const walletData = await walletRes.json();
    const holdings: WalletToken[] = walletData.tokens || [];
    const bnbBalance: string = walletData.bnbBalance || "0";

    // 2. Compute holder tier from UNIQ balance
    const { tier, uniqBalance } = computeTier(holdings);

    // 3. Scan each token for risk (max 10 to stay fast).
    //    Pass source=guardian so analytics can filter these out of the
    //    "Recent Scans" feed (P1.3).
    const tokensToScan = holdings.slice(0, 10);
    const scanPromises = tokensToScan.map(async (token) => {
      try {
        const scanRes = await fetch(
          `${origin}/api/scan?address=${encodeURIComponent(token.address)}&source=guardian`,
          { signal: AbortSignal.timeout(20000) }
        );
        if (scanRes.ok) {
          return (await scanRes.json()) as TokenScan;
        }
      } catch { /* skip failed scans */ }
      return null;
    });

    const scanResults = (await Promise.allSettled(scanPromises))
      .filter(
        (r): r is PromiseFulfilledResult<TokenScan> =>
          r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);

    // 4. Build alerts from scan results
    const alerts = buildAlerts(scanResults, holdings);

    // 5. AI analysis — structured for all tiers, LLM-enhanced for Gold
    const aiAnalysis = tier === "Gold"
      ? await generateAiAnalysis(alerts, scanResults, holdings, bnbBalance)
      : buildRuleBasedAnalysis(alerts, scanResults, holdings, bnbBalance);
    const aiSummary = aiAnalysis.summary;

    // 6. Overall risk level
    const hasCritical = alerts.some((a) => a.severity === "critical");
    const hasWarning = alerts.some((a) => a.severity === "warning");
    const overallRisk = hasCritical ? "DANGEROUS" : hasWarning ? "AT_RISK" : "SAFE";

    const maxRiskScore = scanResults.length > 0
      ? Math.max(...scanResults.map((s) => s.riskScore))
      : 0;

    const responsePayload = {
      address: walletAddress,
      bnbBalance,
      holdings,
      scans: scanResults,
      alerts,
      overallRisk,
      maxRiskScore,
      aiSummary,
      aiAnalysis,
      tier,
      uniqBalance,
      tokenCount: holdings.length,
      alertCount: alerts.length,
      scannedAt: Date.now(),
    };

    // 7. Persist snapshot so the UI can show this scan instantly on reopen
    //    even when the page wasn't open (cron-driven scans).
    await saveSnapshot(walletAddress, responsePayload).catch(() => {});

    // 8. Update alert history & push Telegram — ONLY from the cron path.
    // User-initiated page opens never push. The cron is the single delivery
    // channel; the dashboard merely reflects the latest snapshot. This is
    // what stops "opening the page sent a Telegram message" behaviour.
    if (isCron) {
      const now = Date.now();
      const prevHistory: AlertHistory = (await getAlertHistory(walletAddress)) || {
        firstSeen: {},
        lastSeverity: {},
        lastIds: [],
        scanCount: 0,
        lastScanAt: 0,
      };

      const currentIds = new Set(alerts.map(a => a.id));
      const nextFirstSeen: Record<string, number> = {};
      const nextSeverity: Record<string, "critical" | "warning" | "info"> = {};
      for (const a of alerts) {
        nextFirstSeen[a.id] = prevHistory.firstSeen[a.id] ?? now;
        nextSeverity[a.id] = a.severity;
      }
      // Keep firstSeen for ids absent now but present last scan — needed so
      // pushTelegramAlerts can render "was active 3h" on resolved items.
      for (const id of prevHistory.lastIds) {
        if (!currentIds.has(id) && prevHistory.firstSeen[id]) {
          nextFirstSeen[id] = prevHistory.firstSeen[id];
          nextSeverity[id] = prevHistory.lastSeverity[id];
        }
      }

      const nextHistory: AlertHistory = {
        firstSeen: nextFirstSeen,
        lastSeverity: nextSeverity,
        lastIds: alerts.map(a => a.id),
        scanCount: prevHistory.scanCount + 1,
        lastScanAt: now,
      };

      await pushTelegramAlerts(walletAddress, alerts, prevHistory, nextHistory).catch(() => {});
      await setAlertHistory(walletAddress, nextHistory).catch(() => {});
    }

    return NextResponse.json(responsePayload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Guardian scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
