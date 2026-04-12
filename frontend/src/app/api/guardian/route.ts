import { NextRequest, NextResponse } from "next/server";

// ─── Guardian Shield API ─────────────────────────────────────
// Accepts a wallet address, fetches token holdings via /api/wallet,
// scans each token via /api/scan, then generates AI risk alerts via Groq.

const GROQ_KEY = process.env.GROQ_API_KEY || "";

// Telegram alert throttle: only send once per wallet per hour (or when alerts change)
const tgLastSent = new Map<string, { hash: string; at: number }>();
const TG_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

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
        description: `You hold ${bal} ${scan.symbol}. This token blocks sells — you cannot exit this position.`,
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

  return alerts;
}

// ─── AI Summary via Groq ─────────────────────────────────────
async function generateAiSummary(
  alerts: Alert[],
  scans: TokenScan[],
  holdings: WalletToken[],
  bnbBalance: string,
): Promise<string> {
  if (!GROQ_KEY) return "";

  const critCount = alerts.filter((a) => a.severity === "critical").length;
  const warnCount = alerts.filter((a) => a.severity === "warning").length;

  const holdingsSummary = holdings
    .map((h) => `${h.symbol}: ${Number(h.balance).toLocaleString()} tokens`)
    .join(", ");

  const scanSummary = scans
    .map(
      (s) =>
        `${s.symbol} (risk: ${s.riskScore}/100, ${s.recommendation}, tax: ${s.buyTax}/${s.sellTax}%, liq: $${s.liquidityUsd.toFixed(0)}, ${s.flags.join(", ")})`
    )
    .join("\n");

  const safeCount = scans.filter((s) => s.riskScore < 20).length;
  const cautionCount = scans.filter((s) => s.riskScore >= 20 && s.riskScore < 40).length;
  const dangerCount = scans.filter((s) => s.riskScore >= 40).length;

  const prompt = `You are Aegis Shield AI, a senior DeFi security analyst on BNB Chain.
Your job is to give a balanced, accurate portfolio risk assessment.

IMPORTANT RULES:
- A risk score of 0-19 is SAFE — do NOT raise concern about safe tokens.
- A risk score of 20-39 is CAUTION — minor flags, mention them briefly but do not panic.
- A risk score of 40-69 is RISKY — clearly warn the user about these.
- A risk score of 70-100 is CRITICAL — urgent action needed on these.
- If most tokens are safe, the overall wallet IS safe. Do not inflate risk.
- Never recommend selling a token just because it has a proxy or minor flags.
- UNIQ is the Aegis Protocol utility token — treat it as a known project token, not suspicious.
- Focus your warnings on the genuinely dangerous tokens (40+ risk), not the safe ones.

WALLET DATA:
- BNB Balance: ${bnbBalance}
- Holdings: ${holdingsSummary}
- Breakdown: ${safeCount} safe, ${cautionCount} caution, ${dangerCount} risky/critical
- Critical alerts: ${critCount}, Warnings: ${warnCount}

TOKEN SCANS:
${scanSummary}

Write a 3-5 sentence security briefing. Structure it as:
1. Overall wallet health (Safe / Caution / At Risk / Dangerous) based on the WORST token, not the average.
2. If any tokens are 40+ risk, name them and explain what to do.
3. If all tokens are below 40, reassure the user their wallet looks healthy.
4. One actionable tip.
Be precise and proportional — don't overreact to low-risk findings.`;

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
        max_tokens: 300,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    }
  } catch { /* Groq unavailable */ }
  return "";
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
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("address");

  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
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

    // 3. Scan each token for risk (max 10 to stay fast)
    const tokensToScan = holdings.slice(0, 10);
    const scanPromises = tokensToScan.map(async (token) => {
      try {
        const scanRes = await fetch(
          `${origin}/api/scan?address=${encodeURIComponent(token.address)}`,
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

    // 5. AI summary — Gold tier only
    const aiSummary = tier === "Gold"
      ? await generateAiSummary(alerts, scanResults, holdings, bnbBalance)
      : "";

    // 6. Overall risk level
    const hasCritical = alerts.some((a) => a.severity === "critical");
    const hasWarning = alerts.some((a) => a.severity === "warning");
    const overallRisk = hasCritical ? "DANGEROUS" : hasWarning ? "AT_RISK" : "SAFE";

    const maxRiskScore = scanResults.length > 0
      ? Math.max(...scanResults.map((s) => s.riskScore))
      : 0;

    // 7. Fire-and-forget: send Telegram alerts if subscribed (throttled — 1hr or new alerts)
    if (hasCritical || hasWarning) {
      const actionAlerts = alerts.filter((a) => a.severity === "critical" || a.severity === "warning");
      const alertHash = actionAlerts.map((a) => a.id).sort().join(",");
      const prev = tgLastSent.get(walletAddress.toLowerCase());
      const now = Date.now();
      const isNew = !prev || prev.hash !== alertHash || (now - prev.at > TG_COOLDOWN_MS);
      if (isNew) {
        tgLastSent.set(walletAddress.toLowerCase(), { hash: alertHash, at: now });
        fetch(`${origin}/api/telegram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send",
            address: walletAddress,
            alerts: actionAlerts,
          }),
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      address: walletAddress,
      bnbBalance,
      holdings,
      scans: scanResults,
      alerts,
      overallRisk,
      maxRiskScore,
      aiSummary,
      tier,
      uniqBalance,
      tokenCount: holdings.length,
      alertCount: alerts.length,
      scannedAt: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Guardian scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
