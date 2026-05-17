// ─── Guardian Snapshot Store (Redis-backed) ─────────────────
// Persists the most-recent Guardian scan result per wallet so the UI
// can show alerts that the cron found while the page was closed.
//
// Key layout:
//   aegis:guardian:snap:<addr>     -> JSON string (full scan response)
//   aegis:guardian:tg:<addr>       -> JSON string ({sentIds: string[], at: number})
//   aegis:guardian:hist:<addr>     -> JSON string (AlertHistory — first-seen, last severity, scan count)
//
// In-memory fallback is used when Upstash is not configured. Snapshots
// in fallback mode are ephemeral (cleared on cold start) — Redis is the
// source of truth in production.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

const SNAPSHOT_TTL_SECONDS = 60 * 60 * 24; // keep 24h
const TG_DEDUP_TTL_SECONDS = 60 * 60 * 24; // 24h sliding window
const HISTORY_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days — survives long monitoring silences

type SnapshotEnvelope = { at: number; data: unknown };
type TgSentRecord = { sentIds: string[]; at: number };

export type AlertHistory = {
  // First time we observed each alert id (epoch ms)
  firstSeen: Record<string, number>;
  // Last severity we recorded for each id — used to detect escalations
  lastSeverity: Record<string, "critical" | "warning" | "info">;
  // The exact id set from the last scan — used to detect resolved alerts
  lastIds: string[];
  // Monotonic scan counter — included in TG messages for transparency
  scanCount: number;
  // Last cron scan timestamp (epoch ms)
  lastScanAt: number;
};

// In-memory fallback maps (per serverless instance)
const memSnapshots = new Map<string, SnapshotEnvelope>();
const memTgSent = new Map<string, TgSentRecord>();
const memHistory = new Map<string, AlertHistory>();

async function redisCmd(args: string[]): Promise<unknown> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(UPSTASH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.result;
  } catch {
    return null;
  }
}

function snapKey(addr: string) {
  return `aegis:guardian:snap:${addr.toLowerCase()}`;
}
function tgKey(addr: string) {
  return `aegis:guardian:tg:${addr.toLowerCase()}`;
}
function histKey(addr: string) {
  return `aegis:guardian:hist:${addr.toLowerCase()}`;
}

// ─── Snapshot ────────────────────────────────────────────────

export async function saveSnapshot(addr: string, data: unknown): Promise<void> {
  const env: SnapshotEnvelope = { at: Date.now(), data };
  const payload = JSON.stringify(env);
  memSnapshots.set(addr.toLowerCase(), env);
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    await redisCmd(["SET", snapKey(addr), payload, "EX", String(SNAPSHOT_TTL_SECONDS)]);
  }
}

export async function getSnapshot(addr: string): Promise<SnapshotEnvelope | null> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const raw = await redisCmd(["GET", snapKey(addr)]);
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as SnapshotEnvelope;
      } catch { /* fall through */ }
    }
  }
  return memSnapshots.get(addr.toLowerCase()) || null;
}

// ─── Telegram dedup (alert-id set) ───────────────────────────

export async function getTgSent(addr: string): Promise<TgSentRecord | null> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const raw = await redisCmd(["GET", tgKey(addr)]);
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as TgSentRecord;
      } catch { /* fall through */ }
    }
  }
  return memTgSent.get(addr.toLowerCase()) || null;
}

export async function setTgSent(addr: string, record: TgSentRecord): Promise<void> {
  memTgSent.set(addr.toLowerCase(), record);
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    await redisCmd([
      "SET",
      tgKey(addr),
      JSON.stringify(record),
      "EX",
      String(TG_DEDUP_TTL_SECONDS),
    ]);
  }
}

// ─── Alert history (for diff-aware Telegram messages) ────────

export async function getAlertHistory(addr: string): Promise<AlertHistory | null> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const raw = await redisCmd(["GET", histKey(addr)]);
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as AlertHistory;
      } catch { /* fall through */ }
    }
  }
  return memHistory.get(addr.toLowerCase()) || null;
}

export async function setAlertHistory(addr: string, history: AlertHistory): Promise<void> {
  memHistory.set(addr.toLowerCase(), history);
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    await redisCmd([
      "SET",
      histKey(addr),
      JSON.stringify(history),
      "EX",
      String(HISTORY_TTL_SECONDS),
    ]);
  }
}
