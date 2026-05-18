import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  claimTOTD,
  getTOTD,
  isDisqualified,
  todayKey,
} from "@/lib/campaign-store";

export const dynamic = "force-dynamic";

// Basic Twitter/X status URL check. Keeps things permissive — final
// verification happens during winner audit, not here.
function isPlausibleTweetUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/^(www\.|mobile\.)?(twitter|x)\.com$/.test(u.hostname)) return false;
    return /\/status\/\d+/.test(u.pathname);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { wallet?: string; tweetUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { wallet, tweetUrl } = body;

  if (!wallet || !ethers.isAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }
  if (!tweetUrl || !isPlausibleTweetUrl(tweetUrl)) {
    return NextResponse.json({ error: "Provide a public x.com/twitter.com status URL" }, { status: 400 });
  }

  if (await isDisqualified(wallet)) {
    return NextResponse.json({ error: "Wallet disqualified" }, { status: 403 });
  }

  const date = todayKey();
  const todd = await getTOTD(date);
  if (!todd) {
    return NextResponse.json({ error: "No threat posted today yet" }, { status: 404 });
  }

  const rank = await claimTOTD(date, wallet);
  if (rank == null) {
    return NextResponse.json({ error: "All 10 spots claimed for today" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    date,
    rank,
    token: todd,
    bonusEntries: 10,                       // reward for first-10 quote-tweet
    tweetUrl,                               // echoed back so client can store/display
  });
}
