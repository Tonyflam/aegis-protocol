import { NextResponse } from "next/server";
import { runStrategyEngine } from "@/lib/strategies/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/vault/strategies
// Returns the live AI strategy engine output: market regime, per-strategy
// scores, recommended allocation, drift from current on-chain allocation.
//
// Cached for 60s at the edge to keep CoinGecko + DefiLlama load reasonable.
export async function GET() {
  try {
    const result = await runStrategyEngine();
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "engine failure";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
