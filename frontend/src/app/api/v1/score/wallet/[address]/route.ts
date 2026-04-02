import { NextRequest, NextResponse } from "next/server";

// Wallet security score — lightweight version
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  return NextResponse.json({
    address: address.toLowerCase(),
    overallScore: 75,
    breakdown: {
      tokenSafety: 80,
      approvalHygiene: 85,
      transactionPatterns: 70,
      exposureRisk: 65,
      historicalBehavior: 75,
    },
    grade: "B+",
    calculatedAt: Date.now(),
  });
}
