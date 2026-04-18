import { NextRequest, NextResponse } from "next/server";

// ─── Simple In-Memory Rate Limiter ──────────────────────────
// Limits requests per IP per window. Resets on redeploy.
// For Vercel serverless: provides basic abuse protection.

const store = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries periodically
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, val] of store) {
    if (now > val.resetAt) store.delete(key);
  }
}

export function rateLimit(
  request: NextRequest,
  { maxRequests = 30, windowMs = 60_000 }: { maxRequests?: number; windowMs?: number } = {},
): NextResponse | null {
  cleanup();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const path = new URL(request.url).pathname;
  const key = `${ip}:${path}`;
  const now = Date.now();

  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return null; // allowed
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      },
    );
  }

  return null; // allowed
}
