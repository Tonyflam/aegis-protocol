import { NextRequest, NextResponse } from "next/server";

const HONEYPOT_API = "https://api.honeypot.is/v2/IsHoneypot";
const GOPLUS_API = "https://api.gopluslabs.io/api/v1/token_security/56";

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
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  const addr = address.toLowerCase();

  try {
    const [honeypotRes, goplusRes] = await Promise.all([
      fetchWithTimeout(`${HONEYPOT_API}?address=${addr}&chainID=56`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetchWithTimeout(`${GOPLUS_API}?contract_addresses=${addr}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);

    const goplus = goplusRes?.result?.[addr] || null;
    const isHoneypot = honeypotRes?.honeypotResult?.isHoneypot ?? false;
    const isVerified = goplus?.is_open_source === "1";

    let score = 50; // neutral baseline
    if (isHoneypot) score -= 40;
    if (!isVerified) score -= 10;
    if (goplus?.is_proxy === "1") score -= 5;
    if (goplus?.is_mintable === "1") score -= 5;
    score = Math.max(0, Math.min(100, score));

    return NextResponse.json({
      address: addr,
      overallScore: score,
      breakdown: {
        tokenSafety: score,
        approvalHygiene: 50,
        transactionPatterns: 50,
        exposureRisk: 50,
        historicalBehavior: 50,
      },
      grade: score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D",
      calculatedAt: Date.now(),
    });
  } catch {
    return NextResponse.json({
      address: addr,
      overallScore: 50,
      breakdown: {
        tokenSafety: 50,
        approvalHygiene: 50,
        transactionPatterns: 50,
        exposureRisk: 50,
        historicalBehavior: 50,
      },
      grade: "C",
      calculatedAt: Date.now(),
    });
  }
}
