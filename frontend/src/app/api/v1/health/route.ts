import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: "2.0.0",
    mode: "serverless",
    engines: ["wallet-scanner", "token-scanner", "security-score"],
    note: "Running as Next.js API routes on Vercel. Some engines require the full Aegis API server.",
  });
}
