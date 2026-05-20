// ─── Protector Hunt — Campaign Store (Redis-backed) ─────────
// Keeps per-wallet campaign state (scans, referrals, social claims,
// Threat-of-the-Day winners) in Upstash Redis.
// Falls back to in-memory Map when Redis isn't configured.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

// ─── Campaign timing (UTC) ───────────────────────────────────
// Lock these at deploy time so client + server agree on the window.
export const CAMPAIGN = {
  // Snapshot opens — entries before this date still count (holders, scans)
  // but we publicly mark the campaign as "live" from this moment.
  START_UNIX_MS: Date.parse("2026-05-21T12:00:00Z"),
  END_UNIX_MS:   Date.parse("2026-05-31T12:00:00Z"),
  DRAW_UNIX_MS:  Date.parse("2026-06-01T16:00:00Z"),
  POOL_UNIQ:     25_000_000,
  TOTAL_WINNERS: 141, // 1 grand + 5 top + 25 silver-rung + 100 random (Open Bounty up to +10, not guaranteed)
};

// ─── Entry weights ───────────────────────────────────────────
// Holding tier is *exclusive* (you get the highest one), all other
// tiers stack additively. Referrals cap at 10 (50 entries).
export const ENTRY_WEIGHTS = {
  SOCIAL: 1,         // Tier 1: follow + RT + reply + tag
  SCAN_EACH: 1,      // Tier 2: per unique scan, cap 5
  SCAN_MAX: 5,
  GUARDIAN: 3,       // Tier 3: connect Guardian Shield
  TELEGRAM: 2,       // Tier 4: link Telegram chat ID
  HOLD_TIER5: 5,     // Tier 5: ≥ 10,000 $UNIQ
  HOLD_BRONZE: 10,   // Tier 6: ≥ 50,000 $UNIQ  (Bronze pass)
  HOLD_SILVER: 25,   // Tier 7: ≥ 100,000 $UNIQ (Silver pass)
  REF_EACH: 5,       // ★ per qualified referral, cap 10
  REF_MAX: 10,
};

export const HOLD_THRESHOLDS = {
  TIER5:  10_000n,
  BRONZE: 50_000n,
  SILVER: 100_000n,
};

// ─── Redis keys ──────────────────────────────────────────────
const K = {
  scans:        (w: string) => `aegis:campaign:scans:${w.toLowerCase()}`,           // SET of token addresses
  social:       (w: string) => `aegis:campaign:social:${w.toLowerCase()}`,          // JSON {handle,rtUrl,replyUrl,verifiedAt}
  refOf:        (w: string) => `aegis:campaign:ref:${w.toLowerCase()}`,             // STRING referrer address
  refList:      (r: string) => `aegis:campaign:reflist:${r.toLowerCase()}`,         // SET of referred addresses
  refQualified: (r: string) => `aegis:campaign:refqualified:${r.toLowerCase()}`,    // SET subset that fulfilled ≥2 paid tiers
  totd:         (d: string) => `aegis:campaign:totd:${d}`,                          // STRING token address for date YYYY-MM-DD
  totdClaims:   (d: string) => `aegis:campaign:totdclaims:${d}`,                    // LIST of wallet addresses (first 10)
  totdRank:     (d: string) => `aegis:campaign:totdrank:${d}`,                      // INCR counter for atomic ranking
  disqualified: () => `aegis:campaign:disqualified`,                                 // SET of bad wallets
  leaderboard:  () => `aegis:campaign:leaderboard`,                                  // ZSET wallet → entry count
  seenWallets:  () => `aegis:campaign:seenwallets`,                                  // SET of wallets that ever opened /campaign
};

// ─── In-memory fallback ──────────────────────────────────────
interface MemState {
  scans: Map<string, Set<string>>;
  social: Map<string, string>;
  refOf: Map<string, string>;
  refList: Map<string, Set<string>>;
  refQualified: Map<string, Set<string>>;
  totd: Map<string, string>;
  totdClaims: Map<string, string[]>;
  disqualified: Set<string>;
  leaderboard: Map<string, number>;
  seenWallets: Set<string>;
  sybilChecked: Set<string>;
}
const mem: MemState = {
  scans: new Map(),
  social: new Map(),
  refOf: new Map(),
  refList: new Map(),
  refQualified: new Map(),
  totd: new Map(),
  totdClaims: new Map(),
  disqualified: new Set(),
  leaderboard: new Map(),
  seenWallets: new Set(),
  sybilChecked: new Set(),
};

export function isCampaignRedisConfigured(): boolean {
  return !!(UPSTASH_URL && UPSTASH_TOKEN);
}

async function redis<T = unknown>(args: (string | number)[]): Promise<T | null> {
  if (!isCampaignRedisConfigured()) return null;
  try {
    const res = await fetch(UPSTASH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args.map(String)),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result as T;
  } catch {
    return null;
  }
}

// ─── Scans (tier 2) ──────────────────────────────────────────

export async function trackCampaignScan(wallet: string, tokenAddress: string): Promise<number> {
  const w = wallet.toLowerCase();
  const t = tokenAddress.toLowerCase();
  if (isCampaignRedisConfigured()) {
    await redis(["SADD", K.scans(w), t]);
    const count = await redis<number>(["SCARD", K.scans(w)]);
    return Math.min(count ?? 0, ENTRY_WEIGHTS.SCAN_MAX);
  }
  const set = mem.scans.get(w) ?? new Set<string>();
  set.add(t);
  mem.scans.set(w, set);
  return Math.min(set.size, ENTRY_WEIGHTS.SCAN_MAX);
}

export async function getCampaignScanCount(wallet: string): Promise<number> {
  const w = wallet.toLowerCase();
  if (isCampaignRedisConfigured()) {
    const count = await redis<number>(["SCARD", K.scans(w)]);
    return Math.min(count ?? 0, ENTRY_WEIGHTS.SCAN_MAX);
  }
  return Math.min(mem.scans.get(w)?.size ?? 0, ENTRY_WEIGHTS.SCAN_MAX);
}

export async function getCampaignScanList(wallet: string): Promise<string[]> {
  const w = wallet.toLowerCase();
  if (isCampaignRedisConfigured()) {
    const arr = await redis<string[]>(["SMEMBERS", K.scans(w)]);
    return arr ?? [];
  }
  return [...(mem.scans.get(w) ?? new Set())];
}

// ─── Social claim (tier 1) ───────────────────────────────────

export interface SocialClaim {
  handle: string;
  rtUrl: string;
  replyUrl: string;
  submittedAt: number;
  verifiedAt?: number;
}

export async function setSocialClaim(wallet: string, claim: SocialClaim): Promise<void> {
  const w = wallet.toLowerCase();
  if (isCampaignRedisConfigured()) {
    await redis(["SET", K.social(w), JSON.stringify(claim)]);
    return;
  }
  mem.social.set(w, JSON.stringify(claim));
}

export async function getSocialClaim(wallet: string): Promise<SocialClaim | null> {
  const w = wallet.toLowerCase();
  let raw: string | null = null;
  if (isCampaignRedisConfigured()) {
    raw = await redis<string>(["GET", K.social(w)]);
  } else {
    raw = mem.social.get(w) ?? null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SocialClaim;
  } catch {
    return null;
  }
}

// ─── Referrals (★ bonus) ─────────────────────────────────────

export async function setReferrer(wallet: string, referrer: string): Promise<boolean> {
  const w = wallet.toLowerCase();
  const r = referrer.toLowerCase();
  if (w === r) return false;
  if (isCampaignRedisConfigured()) {
    // SETNX — only set if not already attributed (first referrer wins)
    const ok = await redis<number>(["SETNX", K.refOf(w), r]);
    if (ok === 1) {
      await redis(["SADD", K.refList(r), w]);
      return true;
    }
    return false;
  }
  if (mem.refOf.has(w)) return false;
  mem.refOf.set(w, r);
  const set = mem.refList.get(r) ?? new Set<string>();
  set.add(w);
  mem.refList.set(r, set);
  return true;
}

export async function getReferrer(wallet: string): Promise<string | null> {
  const w = wallet.toLowerCase();
  if (isCampaignRedisConfigured()) {
    return (await redis<string>(["GET", K.refOf(w)])) ?? null;
  }
  return mem.refOf.get(w) ?? null;
}

export async function markReferralQualified(wallet: string): Promise<void> {
  const ref = await getReferrer(wallet);
  if (!ref) return;
  const w = wallet.toLowerCase();
  if (isCampaignRedisConfigured()) {
    await redis(["SADD", K.refQualified(ref), w]);
    return;
  }
  const set = mem.refQualified.get(ref) ?? new Set<string>();
  set.add(w);
  mem.refQualified.set(ref, set);
}

export async function getQualifiedReferralCount(referrer: string): Promise<number> {
  const r = referrer.toLowerCase();
  if (isCampaignRedisConfigured()) {
    const c = await redis<number>(["SCARD", K.refQualified(r)]);
    return Math.min(c ?? 0, ENTRY_WEIGHTS.REF_MAX);
  }
  return Math.min(mem.refQualified.get(r)?.size ?? 0, ENTRY_WEIGHTS.REF_MAX);
}

export async function getReferralList(referrer: string): Promise<string[]> {
  const r = referrer.toLowerCase();
  if (isCampaignRedisConfigured()) {
    return (await redis<string[]>(["SMEMBERS", K.refList(r)])) ?? [];
  }
  return [...(mem.refList.get(r) ?? new Set())];
}

// ─── Threat of the Day (daily side-game) ─────────────────────

export function todayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

export async function setTOTD(date: string, tokenAddress: string): Promise<void> {
  if (isCampaignRedisConfigured()) {
    await redis(["SET", K.totd(date), tokenAddress.toLowerCase()]);
    await redis(["SET", K.totdRank(date), "0"]);
    return;
  }
  mem.totd.set(date, tokenAddress.toLowerCase());
  mem.totdClaims.set(date, []);
}

export async function getTOTD(date: string = todayKey()): Promise<string | null> {
  if (isCampaignRedisConfigured()) {
    return await redis<string>(["GET", K.totd(date)]);
  }
  return mem.totd.get(date) ?? null;
}

// Atomic first-10 claim. Returns rank (1-10) or null if full / already claimed.
export async function claimTOTD(date: string, wallet: string): Promise<number | null> {
  const w = wallet.toLowerCase();
  if (isCampaignRedisConfigured()) {
    // Atomically increment rank counter
    const rank = await redis<number>(["INCR", K.totdRank(date)]);
    if (rank == null || rank > 10) return null;
    // Add wallet to claims list (RPUSH preserves order)
    await redis(["RPUSH", K.totdClaims(date), w]);
    return rank;
  }
  const list = mem.totdClaims.get(date) ?? [];
  if (list.includes(w)) return null;
  if (list.length >= 10) return null;
  list.push(w);
  mem.totdClaims.set(date, list);
  return list.length;
}

export async function getTOTDClaimers(date: string = todayKey()): Promise<string[]> {
  if (isCampaignRedisConfigured()) {
    const list = await redis<string[]>(["LRANGE", K.totdClaims(date), 0, 9]);
    return list ?? [];
  }
  return mem.totdClaims.get(date) ?? [];
}

// ─── Leaderboard (computed once per /entries call) ──────────

export async function updateLeaderboard(wallet: string, entries: number): Promise<void> {
  const w = wallet.toLowerCase();
  if (isCampaignRedisConfigured()) {
    await redis(["ZADD", K.leaderboard(), entries, w]);
    return;
  }
  mem.leaderboard.set(w, entries);
}

export interface LeaderRow { wallet: string; entries: number; }

export async function getLeaderboard(limit = 50): Promise<LeaderRow[]> {
  if (isCampaignRedisConfigured()) {
    // ZREVRANGE key 0 limit-1 WITHSCORES
    const raw = await redis<string[]>([
      "ZREVRANGE",
      K.leaderboard(),
      0,
      limit - 1,
      "WITHSCORES",
    ]);
    const rows: LeaderRow[] = [];
    if (Array.isArray(raw)) {
      for (let i = 0; i < raw.length; i += 2) {
        rows.push({ wallet: raw[i], entries: Number(raw[i + 1]) });
      }
    }
    return rows;
  }
  return [...mem.leaderboard.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([wallet, entries]) => ({ wallet, entries }));
}

// ─── Disqualification ────────────────────────────────────────

export async function disqualify(wallet: string, reason: string): Promise<void> {
  const w = wallet.toLowerCase();
  if (isCampaignRedisConfigured()) {
    await redis(["SADD", K.disqualified(), w]);
    await redis(["HSET", "aegis:campaign:disqualified:reasons", w, reason]);
    return;
  }
  mem.disqualified.add(w);
  void reason;
}

export async function isDisqualified(wallet: string): Promise<boolean> {
  const w = wallet.toLowerCase();
  if (isCampaignRedisConfigured()) {
    const r = await redis<number>(["SISMEMBER", K.disqualified(), w]);
    return r === 1;
  }
  return mem.disqualified.has(w);
}

// Has this wallet already been through the live anti-sybil pass?
// Used to dedupe expensive on-chain reads per wallet across page-loads.
const SYBIL_CHECKED_KEY = "aegis:campaign:sybilchecked";
export async function isSybilChecked(wallet: string): Promise<boolean> {
  const w = wallet.toLowerCase();
  if (isCampaignRedisConfigured()) {
    const r = await redis<number>(["SISMEMBER", SYBIL_CHECKED_KEY, w]);
    return r === 1;
  }
  return mem.sybilChecked.has(w);
}
export async function markSybilChecked(wallet: string): Promise<void> {
  const w = wallet.toLowerCase();
  if (isCampaignRedisConfigured()) {
    await redis(["SADD", SYBIL_CHECKED_KEY, w]);
    return;
  }
  if (!mem.sybilChecked) mem.sybilChecked = new Set();
  mem.sybilChecked.add(w);
}

// ─── Seen wallets (for cron resilience) ──────────────────────

export async function markSeen(wallet: string): Promise<void> {
  const w = wallet.toLowerCase();
  if (isCampaignRedisConfigured()) {
    await redis(["SADD", K.seenWallets(), w]);
    return;
  }
  mem.seenWallets.add(w);
}

export async function getSeenWallets(): Promise<string[]> {
  if (isCampaignRedisConfigured()) {
    return (await redis<string[]>(["SMEMBERS", K.seenWallets()])) ?? [];
  }
  return [...mem.seenWallets];
}
