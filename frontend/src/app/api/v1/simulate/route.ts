import { NextRequest, NextResponse } from "next/server";

// Transaction simulation — lightweight version
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.to || !body?.from) {
    return NextResponse.json({ error: "Missing required fields: to, from" }, { status: 400 });
  }

  if (!/^0x[a-fA-F0-9]{40}$/i.test(body.to) || !/^0x[a-fA-F0-9]{40}$/i.test(body.from)) {
    return NextResponse.json({ error: "Invalid address format" }, { status: 400 });
  }

  // Without full on-chain simulation, return a basic risk assessment
  const isLargeValue = parseFloat(body.value || "0") > 1e18; // > 1 BNB
  const hasData = body.data && body.data !== "0x" && body.data.length > 2;

  return NextResponse.json({
    safe: !isLargeValue,
    riskScore: isLargeValue ? 30 : hasData ? 15 : 5,
    warnings: isLargeValue ? ["Large BNB transfer detected"] : [],
    balanceChanges: [],
    approvalChanges: [],
    gasEstimate: "21000",
    decodedFunction: hasData ? "Unknown function" : "Native transfer",
    simulatedAt: Date.now(),
  });
}
