import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  getTOTD,
  getTOTDClaimers,
  setTOTD,
  todayKey,
} from "@/lib/campaign-store";

export const dynamic = "force-dynamic";

const ADMIN_TOKEN = process.env.CAMPAIGN_ADMIN_TOKEN || "";

// GET — public, returns today's threat token + how many spots remain.
export async function GET(): Promise<NextResponse> {
  const date = todayKey();
  const token = await getTOTD(date);
  const claimers = await getTOTDClaimers(date);
  return NextResponse.json({
    date,
    token,                                  // null if not posted yet
    claimsCount: claimers.length,
    claimsRemaining: Math.max(0, 10 - claimers.length),
    claimers,                               // ordered first → last
  });
}

// POST — admin sets today's threat. Auth via x-admin-token header.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const hdr = req.headers.get("x-admin-token") || "";
  if (!ADMIN_TOKEN || hdr !== ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { token?: string; date?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { token, date } = body;
  if (!token || !ethers.isAddress(token)) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }
  const useDate = date || todayKey();
  await setTOTD(useDate, token);
  return NextResponse.json({ ok: true, date: useDate, token: token.toLowerCase() });
}
