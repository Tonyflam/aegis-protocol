import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/campaign-store";

export const dynamic = "force-dynamic";

interface CachedLB {
  data: { wallet: string; entries: number; rank: number }[];
  expires: number;
}
let cache: CachedLB | null = null;
const CACHE_TTL = 60_000;

function maskWallet(w: string): string {
  if (w.length < 10) return w;
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

export async function GET(): Promise<NextResponse> {
  if (cache && cache.expires > Date.now()) {
    return NextResponse.json({ leaders: cache.data, cached: true });
  }
  const raw = await getLeaderboard(50);
  const data = raw.map((r, i) => ({
    wallet: maskWallet(r.wallet),
    entries: r.entries,
    rank: i + 1,
  }));
  cache = { data, expires: Date.now() + CACHE_TTL };
  return NextResponse.json({ leaders: data, cached: false });
}
