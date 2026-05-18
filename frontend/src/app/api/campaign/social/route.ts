import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getSocialClaim, setSocialClaim } from "@/lib/campaign-store";

export const dynamic = "force-dynamic";

function isPlausibleStatusUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/^(www\.|mobile\.)?(twitter|x)\.com$/.test(u.hostname)) return false;
    return /\/status\/\d+/.test(u.pathname);
  } catch {
    return false;
  }
}

// GET — return existing social claim (if any) for a wallet.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  if (!address || !ethers.isAddress(address)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }
  const claim = await getSocialClaim(address.toLowerCase());
  return NextResponse.json({ claim });
}

// POST — user submits handle + retweet URL + reply URL. We store, mark
// the social tier complete (1 entry), and queue for later manual / API
// verification in the audit pass.
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { wallet?: string; handle?: string; rtUrl?: string; replyUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { wallet, handle, rtUrl, replyUrl } = body;

  if (!wallet || !ethers.isAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }
  if (!handle || handle.replace("@", "").length < 2) {
    return NextResponse.json({ error: "Provide your X handle" }, { status: 400 });
  }
  if (!rtUrl || !isPlausibleStatusUrl(rtUrl)) {
    return NextResponse.json({ error: "Provide your retweet URL (x.com/.../status/...)" }, { status: 400 });
  }
  if (!replyUrl || !isPlausibleStatusUrl(replyUrl)) {
    return NextResponse.json({ error: "Provide your reply URL (x.com/.../status/...)" }, { status: 400 });
  }

  await setSocialClaim(wallet.toLowerCase(), {
    handle: handle.startsWith("@") ? handle.slice(1) : handle,
    rtUrl,
    replyUrl,
    submittedAt: Date.now(),
  });

  return NextResponse.json({ ok: true });
}
