import { NextRequest, NextResponse } from "next/server";
import { getAllScans, getTokenHistory, getUniqueTokens, getAnalytics } from "@/lib/scan-tracker";

// ─── Analytics API ───────────────────────────────────────────
// GET /api/analytics                — full dashboard analytics
// GET /api/analytics?view=tokens    — all unique tokens scanned
// GET /api/analytics?view=recent    — last 50 scans
// GET /api/analytics?view=token&address=0x... — history for one token
// GET /api/analytics?view=export    — export all data as JSON

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "dashboard";

  switch (view) {
    case "dashboard": {
      const analytics = getAnalytics();
      return NextResponse.json(analytics);
    }

    case "tokens": {
      const tokens = getUniqueTokens();
      return NextResponse.json({ tokens, count: tokens.length });
    }

    case "recent": {
      const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
      const all = getAllScans();
      return NextResponse.json({ scans: all.slice(0, limit), total: all.length });
    }

    case "token": {
      const address = searchParams.get("address");
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return NextResponse.json({ error: "Invalid address" }, { status: 400 });
      }
      const history = getTokenHistory(address);
      return NextResponse.json({
        address: address.toLowerCase(),
        scans: history,
        count: history.length,
        latestRisk: history[0]?.riskScore ?? null,
        riskTrend: history.length >= 2
          ? history[0].riskScore - history[history.length - 1].riskScore
          : 0,
      });
    }

    case "export": {
      const all = getAllScans();
      return new NextResponse(JSON.stringify(all, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="aegis-scan-data-${Date.now()}.json"`,
        },
      });
    }

    default:
      return NextResponse.json({ error: "Unknown view. Use: dashboard, tokens, recent, token, export" }, { status: 400 });
  }
}
