import { NextRequest, NextResponse } from "next/server";

// Approvals scan — lightweight version without persistent backend
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  // Approval scanning requires indexing historical approve() transactions.
  // Without persistent backend, return empty result.
  return NextResponse.json({
    wallet: address.toLowerCase(),
    approvals: [],
    totalApprovals: 0,
    riskyApprovals: 0,
    scannedAt: Date.now(),
  });
}
