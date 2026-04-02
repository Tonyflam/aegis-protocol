import { NextRequest, NextResponse } from "next/server";

// Threat scan for a specific token — lightweight version without persistent backend.
// Returns empty since whale monitoring requires continuous block scanning.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  return NextResponse.json([]);
}
