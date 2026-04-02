import { NextRequest, NextResponse } from "next/server";

// ─── External API endpoints ───────────────────────────────────
const HONEYPOT_API = "https://api.honeypot.is/v2/IsHoneypot";
const GOPLUS_API = "https://api.gopluslabs.io/api/v1/token_security/56";

const SAFE_TOKENS = new Set([
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WBNB
  "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
  "0x55d398326f99059ff775485246999027b3197955", // USDT
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
  "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", // CAKE
  "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // ETH
  "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", // BTCB
]);

interface TokenRiskReport {
  address: string;
  name: string;
  symbol: string;
  riskScore: number;
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  isVerified: boolean;
  hasProxy: boolean;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isRenounced: boolean;
  liquidityUsd: number;
  liquidityLocked: boolean;
  holderCount: number;
  topHolderPercent: number;
  flags: string[];
  scannedAt: number;
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHoneypot(address: string) {
  try {
    const res = await fetchWithTimeout(`${HONEYPOT_API}?address=${address}&chainID=56`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchGoPlus(address: string) {
  try {
    const res = await fetchWithTimeout(`${GOPLUS_API}?contract_addresses=${address}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result?.[address.toLowerCase()] || null;
  } catch {
    return null;
  }
}

function computeRiskScore(report: Partial<TokenRiskReport>): number {
  let score = 0;
  if (report.isHoneypot) score += 40;
  if ((report.buyTax || 0) > 10 || (report.sellTax || 0) > 10) score += 15;
  if (!report.isVerified) score += 10;
  if ((report.liquidityUsd || 0) < 10000) score += 15;
  if ((report.topHolderPercent || 0) > 30) score += 12;
  if (report.ownerCanMint) score += 5;
  if (report.ownerCanPause) score += 3;
  if (report.ownerCanBlacklist) score += 3;
  if (report.hasProxy) score += 5;
  return Math.min(score, 100);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  const addr = address.toLowerCase();

  // Safe tokens get a quick pass
  if (SAFE_TOKENS.has(addr)) {
    const report: TokenRiskReport = {
      address: addr,
      name: addr === "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c" ? "Wrapped BNB" :
            addr === "0xe9e7cea3dedca5984780bafc599bd69add087d56" ? "BUSD" :
            addr === "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82" ? "PancakeSwap Token" : "Safe Token",
      symbol: addr === "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c" ? "WBNB" :
              addr === "0xe9e7cea3dedca5984780bafc599bd69add087d56" ? "BUSD" :
              addr === "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82" ? "CAKE" : "TOKEN",
      riskScore: 0,
      isHoneypot: false,
      buyTax: 0,
      sellTax: 0,
      isVerified: true,
      hasProxy: false,
      ownerCanMint: false,
      ownerCanPause: false,
      ownerCanBlacklist: false,
      isRenounced: true,
      liquidityUsd: 10_000_000,
      liquidityLocked: true,
      holderCount: 100_000,
      topHolderPercent: 5,
      flags: [],
      scannedAt: Date.now(),
    };
    return NextResponse.json(report);
  }

  // Fetch from external APIs in parallel
  const [honeypot, goplus] = await Promise.all([
    fetchHoneypot(addr),
    fetchGoPlus(addr),
  ]);

  const report: TokenRiskReport = {
    address: addr,
    name: honeypot?.token?.name || goplus?.token_name || "Unknown",
    symbol: honeypot?.token?.symbol || goplus?.token_symbol || "???",
    isHoneypot: honeypot?.honeypotResult?.isHoneypot ?? false,
    buyTax: parseFloat(honeypot?.simulationResult?.buyTax ?? goplus?.buy_tax ?? "0") * 100,
    sellTax: parseFloat(honeypot?.simulationResult?.sellTax ?? goplus?.sell_tax ?? "0") * 100,
    isVerified: goplus?.is_open_source === "1",
    hasProxy: goplus?.is_proxy === "1",
    ownerCanMint: goplus?.is_mintable === "1",
    ownerCanPause: goplus?.can_take_back_ownership === "1" || goplus?.trading_cooldown === "1",
    ownerCanBlacklist: goplus?.is_blacklisted === "1" || goplus?.is_whitelisted === "1",
    isRenounced: goplus?.owner_address === "0x0000000000000000000000000000000000000000" ||
                 goplus?.owner_address === "" ||
                 goplus?.can_take_back_ownership === "0",
    liquidityUsd: parseFloat(honeypot?.pair?.liquidity ?? "0"),
    liquidityLocked: goplus?.lp_holders?.some((h: { is_locked: number }) => h.is_locked === 1) ?? false,
    holderCount: parseInt(goplus?.holder_count ?? "0", 10),
    topHolderPercent: parseFloat(goplus?.holders?.[0]?.percent ?? "0") * 100,
    riskScore: 0,
    flags: [],
    scannedAt: Date.now(),
  };

  // Build flags
  if (report.isHoneypot) report.flags.push("HONEYPOT");
  if (report.buyTax > 10) report.flags.push("HIGH_BUY_TAX");
  if (report.sellTax > 10) report.flags.push("HIGH_SELL_TAX");
  if (!report.isVerified) report.flags.push("UNVERIFIED");
  if (report.hasProxy) report.flags.push("PROXY_CONTRACT");
  if (report.ownerCanMint) report.flags.push("MINTABLE");
  if (report.ownerCanBlacklist) report.flags.push("BLACKLIST");
  if (report.liquidityUsd < 10000) report.flags.push("LOW_LIQUIDITY");
  if (report.topHolderPercent > 30) report.flags.push("WHALE_DOMINATED");

  report.riskScore = computeRiskScore(report);

  return NextResponse.json(report);
}
