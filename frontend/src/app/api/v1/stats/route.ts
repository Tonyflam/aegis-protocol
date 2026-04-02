import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    token_scans: 0,
    approval_scans: 0,
    portfolio_snapshots: 0,
    threat_alerts: 0,
    security_scores: 0,
    engine_runs: 0,
  });
}
