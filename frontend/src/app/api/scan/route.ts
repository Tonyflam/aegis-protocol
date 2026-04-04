import { NextRequest, NextResponse } from "next/server";

const SCAN_SERVICE_URL = process.env.SCAN_SERVICE_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body?.token;

    if (!token || typeof token !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(token)) {
      return NextResponse.json(
        { success: false, message: "Invalid token address" },
        { status: 400 }
      );
    }

    const resp = await fetch(`${SCAN_SERVICE_URL}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json(
      { success: false, message: "Scan service unavailable — is scan-service running?" },
      { status: 503 }
    );
  }
}
