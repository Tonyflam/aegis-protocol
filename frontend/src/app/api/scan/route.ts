import { NextRequest, NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Token Scan API
// Uses REAL data from: GoPlusLabs, honeypot.is, BSC RPC
// NEVER returns fake or simulated data.
// ═══════════════════════════════════════════════════════════════

const BSC_RPC = "https://bsc-dataseed1.binance.org";

// ─── Types ───────────────────────────────────────────────────

export interface TokenScanResult {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  riskScore: number;
  recommendation: "SAFE" | "CAUTION" | "AVOID" | "SCAM";
  flags: string[];

  // Honeypot
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;

  // Contract security
  isOpenSource: boolean;
  isProxy: boolean;
  isRenounced: boolean;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  canTakeBackOwnership: boolean;
  hasHiddenOwner: boolean;

  // Holder data
  ownerAddress: string;
  creatorAddress: string;
  holderCount: number;
  topHolderPercent: number;

  // Liquidity
  liquidityUsd: number;
  lpHolderCount: number;
  lpTotalLocked: number;
  isLpLocked: boolean;

  // Data sources
  sources: { name: string; status: "ok" | "failed"; detail?: string }[];
  scanTimestamp: number;
  scanDuration: number;
}

// ─── Validate BSC address ────────────────────────────────────

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

// ─── GoPlusLabs API ──────────────────────────────────────────
// Free, no key needed. Primary source for BSC token security.

interface GoPlusTokenData {
  is_honeypot?: string;
  buy_tax?: string;
  sell_tax?: string;
  is_open_source?: string;
  is_proxy?: string;
  is_mintable?: string;
  can_take_back_ownership?: string;
  owner_change_balance?: string;
  hidden_owner?: string;
  selfdestruct?: string;
  external_call?: string;
  is_blacklisted?: string;
  is_whitelisted?: string;
  transfer_pausable?: string;
  trading_cooldown?: string;
  is_anti_whale?: string;
  anti_whale_modifiable?: string;
  cannot_buy?: string;
  cannot_sell_all?: string;
  slippage_modifiable?: string;
  personal_slippage_modifiable?: string;
  owner_address?: string;
  creator_address?: string;
  token_name?: string;
  token_symbol?: string;
  total_supply?: string;
  holder_count?: string;
  lp_holder_count?: string;
  lp_total_supply?: string;
  holders?: { address: string; balance: string; percent: string; is_locked?: number; is_contract?: number }[];
  lp_holders?: { address: string; balance: string; percent: string; is_locked?: number; is_contract?: number; NFT_list?: unknown }[];
  dex?: { name: string; liquidity: string; pair: string }[];
}

async function fetchGoPlusData(address: string): Promise<{ data: GoPlusTokenData | null; error: string | null }> {
  try {
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses=${address}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
    const json = await res.json();
    const tokenData = json?.result?.[address.toLowerCase()];
    if (!tokenData) return { data: null, error: "Token not found in GoPlusLabs" };
    return { data: tokenData, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "GoPlusLabs request failed" };
  }
}

// ─── Honeypot.is API ─────────────────────────────────────────
// Free, no key needed. Secondary validation for honeypot status.

interface HoneypotIsData {
  honeypotResult?: { isHoneypot?: boolean };
  simulationResult?: { buyTax?: number; sellTax?: number; buyGas?: string; sellGas?: string };
  pair?: { pair?: string; chainId?: string; reserves0?: string; reserves1?: string; liquidity?: number };
  token?: { name?: string; symbol?: string; decimals?: number; totalSupply?: number };
}

async function fetchHoneypotIs(address: string): Promise<{ data: HoneypotIsData | null; error: string | null }> {
  try {
    const res = await fetch(
      `https://api.honeypot.is/v2/IsHoneypot?address=${address}&chainID=56`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
    const json = await res.json();
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "honeypot.is request failed" };
  }
}

// ─── BSC RPC call helper ─────────────────────────────────────

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(BSC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function getTokenBasics(address: string): Promise<{
  name: string; symbol: string; decimals: number; totalSupply: string;
} | null> {
  try {
    const nameData = "0x06fdde03"; // name()
    const symbolData = "0x95d89b41"; // symbol()
    const decimalsData = "0x313ce567"; // decimals()
    const totalSupplyData = "0x18160ddd"; // totalSupply()

    const [nameRes, symbolRes, decimalsRes, supplyRes] = await Promise.allSettled([
      rpcCall("eth_call", [{ to: address, data: nameData }, "latest"]),
      rpcCall("eth_call", [{ to: address, data: symbolData }, "latest"]),
      rpcCall("eth_call", [{ to: address, data: decimalsData }, "latest"]),
      rpcCall("eth_call", [{ to: address, data: totalSupplyData }, "latest"]),
    ]);

    const decodeString = (hex: string): string => {
      if (!hex || hex === "0x") return "Unknown";
      try {
        // Try ABI-encoded string: offset (32 bytes) + length (32 bytes) + data
        const stripped = hex.slice(2);
        if (stripped.length >= 128) {
          const len = parseInt(stripped.slice(64, 128), 16);
          const bytes = Buffer.from(stripped.slice(128, 128 + len * 2), "hex");
          const decoded = bytes.toString("utf8").replace(/\0/g, "");
          if (decoded.length > 0) return decoded;
        }
        // Try raw bytes32 string
        const bytes = Buffer.from(stripped, "hex");
        return bytes.toString("utf8").replace(/\0/g, "").trim() || "Unknown";
      } catch {
        return "Unknown";
      }
    };

    const name = nameRes.status === "fulfilled" ? decodeString(nameRes.value as string) : "Unknown";
    const symbol = symbolRes.status === "fulfilled" ? decodeString(symbolRes.value as string) : "???";
    const decimals = decimalsRes.status === "fulfilled" ? parseInt(decimalsRes.value as string, 16) : 18;
    const rawSupply = supplyRes.status === "fulfilled" ? BigInt(supplyRes.value as string) : BigInt(0);

    // Format total supply with decimals
    const supplyStr = rawSupply.toString();
    const supplyFormatted = decimals > 0 && supplyStr.length > decimals
      ? supplyStr.slice(0, supplyStr.length - decimals) + "." + supplyStr.slice(supplyStr.length - decimals, supplyStr.length - decimals + 2)
      : supplyStr;

    return { name, symbol, decimals, totalSupply: supplyFormatted };
  } catch {
    return null;
  }
}

// ─── Risk Calculation ────────────────────────────────────────
// Deterministic scoring from verified data points.

function calculateRisk(
  goplus: GoPlusTokenData | null,
  honeypot: HoneypotIsData | null,
): { score: number; flags: string[]; recommendation: "SAFE" | "CAUTION" | "AVOID" | "SCAM" } {
  let score = 0;
  const flags: string[] = [];

  // ── HONEYPOT (both sources) ──
  const gpHoneypot = goplus?.is_honeypot === "1";
  const hpHoneypot = honeypot?.honeypotResult?.isHoneypot === true;

  if (gpHoneypot || hpHoneypot) {
    flags.push("HONEYPOT");
    return { score: 100, flags, recommendation: "SCAM" };
  }

  // Cannot sell all tokens
  if (goplus?.cannot_sell_all === "1") {
    score += 30;
    flags.push("CANNOT_SELL_ALL");
  }

  // ── TAX ANALYSIS ──
  const buyTax = parseFloat(goplus?.buy_tax ?? "0") * 100;
  const sellTax = parseFloat(goplus?.sell_tax ?? "0") * 100;
  // Cross-reference with honeypot.is
  const hpBuyTax = (honeypot?.simulationResult?.buyTax ?? 0) * 100;
  const hpSellTax = (honeypot?.simulationResult?.sellTax ?? 0) * 100;
  // Use the higher of the two sources for safety
  const effectiveBuyTax = Math.max(buyTax, hpBuyTax);
  const effectiveSellTax = Math.max(sellTax, hpSellTax);

  if (effectiveBuyTax > 50 || effectiveSellTax > 50) {
    score += 35;
    flags.push("EXTREME_TAX");
  } else if (effectiveBuyTax > 10 || effectiveSellTax > 10) {
    score += 20;
    flags.push("HIGH_TAX");
  } else if (effectiveBuyTax > 5 || effectiveSellTax > 5) {
    score += 8;
    flags.push("MODERATE_TAX");
  }

  // Slippage modifiable = owner can change tax
  if (goplus?.slippage_modifiable === "1") {
    score += 10;
    flags.push("TAX_MODIFIABLE");
  }

  // ── CONTRACT SECURITY ──
  if (goplus?.is_mintable === "1") {
    score += 12;
    flags.push("MINTABLE");
  }
  if (goplus?.transfer_pausable === "1") {
    score += 8;
    flags.push("PAUSABLE");
  }
  if (goplus?.is_blacklisted === "1") {
    score += 8;
    flags.push("BLACKLIST");
  }
  if (goplus?.can_take_back_ownership === "1") {
    score += 12;
    flags.push("RECLAIM_OWNERSHIP");
  }
  if (goplus?.hidden_owner === "1") {
    score += 10;
    flags.push("HIDDEN_OWNER");
  }
  if (goplus?.is_proxy === "1") {
    score += 6;
    flags.push("PROXY_CONTRACT");
  }
  if (goplus?.selfdestruct === "1") {
    score += 15;
    flags.push("SELF_DESTRUCT");
  }
  if (goplus?.external_call === "1") {
    score += 5;
    flags.push("EXTERNAL_CALL");
  }

  // Positive: open source → reduce risk
  if (goplus?.is_open_source === "1") {
    score -= 5;
  } else if (goplus?.is_open_source === "0") {
    score += 10;
    flags.push("NOT_OPEN_SOURCE");
  }

  // ── LIQUIDITY ──
  const totalLiquidity = (goplus?.dex ?? []).reduce((sum, d) => sum + parseFloat(d.liquidity || "0"), 0);
  if (totalLiquidity < 1000) {
    score += 25;
    flags.push("NO_LIQUIDITY");
  } else if (totalLiquidity < 10000) {
    score += 15;
    flags.push("LOW_LIQUIDITY");
  } else if (totalLiquidity < 50000) {
    score += 5;
  }

  // Check LP lock status
  const lpHolders = goplus?.lp_holders ?? [];
  const totalLpLocked = lpHolders.reduce((sum, h) => sum + (h.is_locked === 1 ? parseFloat(h.percent || "0") : 0), 0);
  // Check if LP is burned (sent to dead address)
  const lpBurned = lpHolders.some(
    (h) => h.address?.toLowerCase() === "0x000000000000000000000000000000000000dead" && parseFloat(h.percent || "0") > 50
  );

  if (!lpBurned && totalLpLocked < 50 && totalLiquidity > 0) {
    score += 10;
    flags.push("LP_NOT_LOCKED");
  }

  // ── HOLDER CONCENTRATION ──
  const holders = goplus?.holders ?? [];
  if (holders.length > 0) {
    // Get top non-contract, non-dead holder
    const topHolder = holders
      .filter((h) => !h.address?.toLowerCase().includes("dead") && h.address !== "0x0000000000000000000000000000000000000000")
      .sort((a, b) => parseFloat(b.percent || "0") - parseFloat(a.percent || "0"))[0];

    const topPercent = topHolder ? parseFloat(topHolder.percent || "0") * 100 : 0;
    if (topPercent > 50) {
      score += 20;
      flags.push("WHALE_DOMINATED");
    } else if (topPercent > 30) {
      score += 10;
      flags.push("HIGH_CONCENTRATION");
    }
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  let recommendation: "SAFE" | "CAUTION" | "AVOID" | "SCAM";
  if (score >= 70) recommendation = "SCAM";
  else if (score >= 40) recommendation = "AVOID";
  else if (score >= 20) recommendation = "CAUTION";
  else recommendation = "SAFE";

  return { score, flags, recommendation };
}

// ─── POST Handler ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  let body: { address?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const address = body.address?.trim();
  if (!address || !isValidAddress(address)) {
    return NextResponse.json({ error: "Invalid BSC token address. Must be 0x followed by 40 hex characters." }, { status: 400 });
  }

  // Check if it's actually a contract
  try {
    const code = await rpcCall("eth_getCode", [address, "latest"]);
    if (code === "0x" || code === "0x0") {
      return NextResponse.json({ error: "Address is not a smart contract (EOA or empty)." }, { status: 400 });
    }
  } catch {
    // Can't verify — proceed anyway
  }

  const sources: { name: string; status: "ok" | "failed"; detail?: string }[] = [];

  // Fetch data from all sources in parallel
  const [goplusResult, honeypotResult, basicsResult] = await Promise.allSettled([
    fetchGoPlusData(address),
    fetchHoneypotIs(address),
    getTokenBasics(address),
  ]);

  const goplus = goplusResult.status === "fulfilled" ? goplusResult.value : { data: null, error: "Request failed" };
  const honeypot = honeypotResult.status === "fulfilled" ? honeypotResult.value : { data: null, error: "Request failed" };
  const basics = basicsResult.status === "fulfilled" ? basicsResult.value : null;

  sources.push({ name: "GoPlusLabs", status: goplus.data ? "ok" : "failed", detail: goplus.error ?? undefined });
  sources.push({ name: "honeypot.is", status: honeypot.data ? "ok" : "failed", detail: honeypot.error ?? undefined });
  sources.push({ name: "BSC RPC", status: basics ? "ok" : "failed" });

  // If BOTH security APIs failed, we can't give reliable data
  if (!goplus.data && !honeypot.data) {
    return NextResponse.json({
      error: "Unable to scan token — both security APIs (GoPlusLabs, honeypot.is) are unavailable. Try again in a moment.",
      sources,
    }, { status: 503 });
  }

  // Calculate risk from real data
  const { score, flags, recommendation } = calculateRisk(goplus.data, honeypot.data);

  // Build result from real data only
  const gp = goplus.data;
  const hp = honeypot.data;

  const buyTax = Math.max(
    parseFloat(gp?.buy_tax ?? "0") * 100,
    (hp?.simulationResult?.buyTax ?? 0) * 100
  );
  const sellTax = Math.max(
    parseFloat(gp?.sell_tax ?? "0") * 100,
    (hp?.simulationResult?.sellTax ?? 0) * 100
  );

  const totalLiquidity = (gp?.dex ?? []).reduce((sum, d) => sum + parseFloat(d.liquidity || "0"), 0)
    || hp?.pair?.liquidity || 0;

  const lpHolders = gp?.lp_holders ?? [];
  const totalLpLocked = lpHolders.reduce((sum, h) => sum + (h.is_locked === 1 ? parseFloat(h.percent || "0") : 0), 0);

  // Top holder percent (non-contract, non-dead)
  const holders = gp?.holders ?? [];
  const realHolders = holders.filter(
    (h) => !h.address?.toLowerCase().includes("dead") && h.address !== "0x0000000000000000000000000000000000000000"
  );
  const topHolderPercent = realHolders.length > 0
    ? parseFloat(realHolders.sort((a, b) => parseFloat(b.percent || "0") - parseFloat(a.percent || "0"))[0].percent || "0") * 100
    : 0;

  const result: TokenScanResult = {
    address,
    name: gp?.token_name || hp?.token?.name || basics?.name || "Unknown",
    symbol: gp?.token_symbol || hp?.token?.symbol || basics?.symbol || "???",
    decimals: hp?.token?.decimals ?? basics?.decimals ?? 18,
    totalSupply: gp?.total_supply || basics?.totalSupply || "0",
    riskScore: score,
    recommendation,
    flags,
    isHoneypot: gp?.is_honeypot === "1" || hp?.honeypotResult?.isHoneypot === true,
    buyTax: Math.round(buyTax * 100) / 100,
    sellTax: Math.round(sellTax * 100) / 100,
    isOpenSource: gp?.is_open_source === "1",
    isProxy: gp?.is_proxy === "1",
    isRenounced: gp?.owner_address === "0x0000000000000000000000000000000000000000",
    ownerCanMint: gp?.is_mintable === "1",
    ownerCanPause: gp?.transfer_pausable === "1",
    ownerCanBlacklist: gp?.is_blacklisted === "1",
    canTakeBackOwnership: gp?.can_take_back_ownership === "1",
    hasHiddenOwner: gp?.hidden_owner === "1",
    ownerAddress: gp?.owner_address || "",
    creatorAddress: gp?.creator_address || "",
    holderCount: parseInt(gp?.holder_count || "0", 10),
    topHolderPercent: Math.round(topHolderPercent * 100) / 100,
    liquidityUsd: Math.round(totalLiquidity * 100) / 100,
    lpHolderCount: parseInt(gp?.lp_holder_count || "0", 10),
    lpTotalLocked: Math.round(totalLpLocked * 10000) / 100,
    isLpLocked: totalLpLocked > 50,
    sources,
    scanTimestamp: Date.now(),
    scanDuration: Date.now() - startTime,
  };

  return NextResponse.json(result);
}
