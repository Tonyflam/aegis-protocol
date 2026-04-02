import { NextRequest, NextResponse } from "next/server";

// Recent threats — returns empty since there's no persistent backend on Vercel.
// The Express API server provides real-time monitoring; this is the fallback.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  void limit; // acknowledged but no persistent store

  return NextResponse.json({
    success: true,
    data: [],
    count: 0,
    note: "Real-time threat monitoring requires the Aegis API server. Deploy to Railway/Render for persistent monitoring.",
  });
}
