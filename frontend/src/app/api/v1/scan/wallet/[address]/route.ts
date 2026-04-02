import { NextRequest, NextResponse } from "next/server";

const BSCSCAN_API = "https://api.bscscan.com/api";
const API_KEY = process.env.BSCSCAN_API_KEY || "";

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  const addr = address.toLowerCase();

  try {
    // Fetch BNB balance from BSCScan
    const balRes = await fetchWithTimeout(
      `${BSCSCAN_API}?module=account&action=balance&address=${addr}&tag=latest&apikey=${API_KEY}`
    );
    const balData = await balRes.json();
    const bnbWei = balData?.result || "0";
    const bnbBalance = (parseFloat(bnbWei) / 1e18).toFixed(6);

    // Fetch token transfers to discover tokens held
    const txRes = await fetchWithTimeout(
      `${BSCSCAN_API}?module=account&action=tokentx&address=${addr}&page=1&offset=50&sort=desc&apikey=${API_KEY}`
    );
    const txData = await txRes.json();

    // Unique tokens from recent transfers
    const tokenMap = new Map<string, { symbol: string; name: string; address: string }>();
    if (Array.isArray(txData?.result)) {
      for (const tx of txData.result) {
        if (!tokenMap.has(tx.contractAddress?.toLowerCase())) {
          tokenMap.set(tx.contractAddress?.toLowerCase(), {
            symbol: tx.tokenSymbol || "???",
            name: tx.tokenName || "Unknown",
            address: tx.contractAddress?.toLowerCase(),
          });
        }
        if (tokenMap.size >= 20) break;
      }
    }

    const tokens = Array.from(tokenMap.values()).map((t) => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      balance: "0",
      balanceUsd: 0,
      riskScore: 0,
      isHoneypot: false,
    }));

    return NextResponse.json({
      wallet: addr,
      bnbBalance,
      bnbValueUsd: parseFloat(bnbBalance) * 600, // approximate
      tokens,
      totalValueUsd: parseFloat(bnbBalance) * 600,
      overallRisk: 0,
      scannedAt: Date.now(),
    });
  } catch {
    return NextResponse.json({
      wallet: addr,
      bnbBalance: "0",
      bnbValueUsd: 0,
      tokens: [],
      totalValueUsd: 0,
      overallRisk: 0,
      scannedAt: Date.now(),
    });
  }
}
