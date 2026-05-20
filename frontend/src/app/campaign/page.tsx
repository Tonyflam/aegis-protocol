"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import { useWalletContext } from "../../lib/WalletContext";
import { useSearchParams } from "next/navigation";

interface EntryBreakdown {
  social: number;
  scan: number;
  guardian: number;
  telegram: number;
  hold: number;
  referral: number;
}

interface EntriesResponse {
  address: string;
  disqualified: boolean;
  socialClaimed: boolean;
  scanCount: number;
  guardianConnected: boolean;
  telegramLinked: boolean;
  uniqBalance: string;
  holderTier: "None" | "Tier 5" | "Bronze" | "Silver";
  referralCount: number;
  totalEntries: number;
  breakdown: EntryBreakdown;
}

interface LeaderRow { wallet: string; entries: number; rank: number; }

interface TotdResponse {
  date: string;
  token: string | null;
  claimsCount: number;
  claimsRemaining: number;
  claimers: string[];
}

// ─── Timing (mirrors campaign-store.ts) ──────────────────────
const CAMPAIGN_START = Date.parse("2026-05-21T12:00:00Z");
const CAMPAIGN_END   = Date.parse("2026-05-31T12:00:00Z");
const CAMPAIGN_DRAW  = Date.parse("2026-06-01T16:00:00Z");
const POOL_UNIQ = 25_000_000;
const TOTAL_WINNERS = 141; // plus up to 10 Open Bounty

function fmt(n: number, pad = 2): string {
  return String(n).padStart(pad, "0");
}

function useCountdown(target: number): { label: string; d: number; h: number; m: number; s: number; done: boolean } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = target - now;
  if (diff <= 0) return { label: "00:00:00:00", d: 0, h: 0, m: 0, s: 0, done: true };
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { label: `${fmt(d)}:${fmt(h)}:${fmt(m)}:${fmt(s)}`, d, h, m, s, done: false };
}

// ─── Tier checklist row ──────────────────────────────────────
function TierRow({
  done, title, points, sub, action,
}: {
  done: boolean; title: string; points: string; sub: string; action?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-start gap-4 p-4 rounded-lg"
      style={{
        background: done ? "rgba(0, 212, 245, 0.06)" : "var(--bg-raised)",
        border: `1px solid ${done ? "var(--accent-border)" : "var(--border-subtle)"}`,
      }}
    >
      <div
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
        style={{
          background: done ? "var(--accent)" : "var(--bg-elevated)",
          color: done ? "var(--bg-base)" : "var(--text-muted)",
          border: `1px solid ${done ? "var(--accent)" : "var(--border-subtle)"}`,
        }}
      >
        {done ? "✓" : ""}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-semibold text-sm sm:text-base">{title}</div>
          <div className="text-xs whitespace-nowrap" style={{ color: done ? "var(--accent)" : "var(--text-muted)" }}>
            {points}
          </div>
        </div>
        <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sub}</div>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

function CampaignPageInner() {
  const { address, isConnected, connect, isConnecting } = useWalletContext();
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get("ref");

  const [entries, setEntries] = useState<EntriesResponse | null>(null);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [totd, setTotd] = useState<TotdResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Social-claim form state
  const [handle, setHandle] = useState("");
  const [rtUrl, setRtUrl] = useState("");
  const [replyUrl, setReplyUrl] = useState("");
  const [socialMsg, setSocialMsg] = useState<string>("");
  const [socialBusy, setSocialBusy] = useState(false);

  // TOTD claim form
  const [tweetUrl, setTweetUrl] = useState("");
  const [totdMsg, setTotdMsg] = useState<string>("");
  const [totdBusy, setTotdBusy] = useState(false);

  // ─── Countdowns ────────────────────────────────────────────
  const preStart = useCountdown(CAMPAIGN_START);
  const preEnd   = useCountdown(CAMPAIGN_END);
  const preDraw  = useCountdown(CAMPAIGN_DRAW);

  const phase = useMemo<"pre" | "live" | "audit" | "drawn">(() => {
    const now = Date.now();
    if (now < CAMPAIGN_START) return "pre";
    if (now < CAMPAIGN_END)   return "live";
    if (now < CAMPAIGN_DRAW)  return "audit";
    return "drawn";
  }, [preStart.done, preEnd.done, preDraw.done]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Data fetchers ─────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ address });
      if (refFromUrl) q.set("ref", refFromUrl);
      const res = await fetch(`/api/campaign/entries?${q.toString()}`);
      if (res.ok) setEntries(await res.json());
    } finally {
      setLoading(false);
    }
  }, [address, refFromUrl]);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/campaign/leaderboard");
      if (res.ok) {
        const data = await res.json();
        setLeaders(data.leaders || []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadTotd = useCallback(async () => {
    try {
      const res = await fetch("/api/campaign/totd");
      if (res.ok) setTotd(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (address) loadEntries(); }, [address, loadEntries]);
  useEffect(() => { loadLeaderboard(); loadTotd(); }, [loadLeaderboard, loadTotd]);
  useEffect(() => {
    const id = setInterval(() => { loadLeaderboard(); loadTotd(); }, 60_000);
    return () => clearInterval(id);
  }, [loadLeaderboard, loadTotd]);

  // ─── Actions ───────────────────────────────────────────────
  const submitSocial = async () => {
    if (!address) return;
    setSocialBusy(true);
    setSocialMsg("");
    try {
      const res = await fetch("/api/campaign/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, handle, rtUrl, replyUrl }),
      });
      const data = await res.json();
      if (!res.ok) { setSocialMsg(data.error || "Failed"); }
      else { setSocialMsg("Submitted — your entry is locked in."); loadEntries(); }
    } finally {
      setSocialBusy(false);
    }
  };

  const submitTotdClaim = async () => {
    if (!address) return;
    setTotdBusy(true);
    setTotdMsg("");
    try {
      const res = await fetch("/api/campaign/totd/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, tweetUrl }),
      });
      const data = await res.json();
      if (!res.ok) { setTotdMsg(data.error || "Failed"); }
      else { setTotdMsg(`Claimed rank #${data.rank} — +10 bonus entries.`); loadTotd(); }
    } finally {
      setTotdBusy(false);
    }
  };

  // ─── Referral link ─────────────────────────────────────────
  const referralLink = address
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/campaign?ref=${address}`
    : "";
  const copyRef = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  // ─── Phase banner ──────────────────────────────────────────
  const phaseBanner = useMemo(() => {
    if (phase === "pre") {
      return {
        title: "Campaign launches in",
        sub: "Entries before launch still count — get a head start.",
        timer: preStart.label,
        color: "var(--accent)",
      };
    }
    if (phase === "live") {
      return { title: "Snapshot closes in", sub: "Every entry locked at this moment.", timer: preEnd.label, color: "var(--green)" };
    }
    if (phase === "audit") {
      return { title: "Audit in progress", sub: "Sybil & wash filtering. Draw on June 1.", timer: preDraw.label, color: "var(--yellow)" };
    }
    return { title: "Winners drawn", sub: "Check the leaderboard. Payouts within 48h.", timer: "—", color: "var(--text-secondary)" };
  }, [phase, preStart.label, preEnd.label, preDraw.label]);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* ─── Hero ─── */}
      <section className="relative pt-24 pb-12 px-6 sm:px-10 max-w-6xl mx-auto">
        <Link href="/" className="inline-block text-xs uppercase tracking-widest mb-6 hover:opacity-80" style={{ color: "var(--text-muted)" }}>
          ← Aegis Protocol
        </Link>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-4"
          style={{ background: "rgba(0, 212, 245, 0.08)", border: "1px solid var(--accent-border)", color: "var(--accent)" }}>
          <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--accent)" }} />
          PROTECTOR HUNT · BSC MAINNET
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-4">
          25,000,000 <span style={{ color: "var(--accent)" }}>$UNIQ</span>
          <br />for up to 151 protectors.
        </h1>
        <p className="text-base sm:text-lg leading-relaxed max-w-2xl mb-8" style={{ color: "var(--text-secondary)" }}>
          The first community hunt for Aegis Protocol — BSC&apos;s autonomous security layer. Earn entries by actually using the protocol. No emoji spam, no copy-paste raids. Sybil wallets are filtered with our own scanner and disqualified publicly. Prizes ship through an open-source Merkle claim contract: 25% instant, 75% linear vest over 14 days.
        </p>

        {/* Countdown card */}
        <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-center p-5 rounded-xl mb-8"
          style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}>
          <div>
            <div className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{phaseBanner.title}</div>
            <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{phaseBanner.sub}</div>
          </div>
          <div className="text-3xl sm:text-4xl font-mono font-bold tracking-tight tabular-nums"
            style={{ color: phaseBanner.color }}>
            {phaseBanner.timer}
          </div>
        </div>

        {/* Live stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Pool", value: `${(POOL_UNIQ / 1_000_000).toFixed(0)}M $UNIQ` },
            { label: "Winners", value: `up to ${TOTAL_WINNERS + 10}` },
            { label: "Min entry", value: "1 social" },
            { label: "Max stack", value: "51 entries" },
          ].map((s, i) => (
            <div key={i} className="p-3 rounded-lg" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
              <div className="text-sm font-semibold">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Wallet gate ─── */}
      <section className="px-6 sm:px-10 max-w-6xl mx-auto pb-12">
        {!isConnected ? (
          <div className="p-8 rounded-xl text-center"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}>
            <h2 className="text-xl font-bold mb-2">Connect to see your entries</h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              We never ask for a signature or a token approval to check your standing. Read-only.
            </p>
            <button
              onClick={connect}
              disabled={isConnecting}
              className="px-6 py-2.5 rounded-lg font-semibold disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--bg-base)" }}
            >
              {isConnecting ? "Connecting…" : "Connect Wallet"}
            </button>
            {refFromUrl && (
              <p className="text-xs mt-4" style={{ color: "var(--accent)" }}>
                Referred by {refFromUrl.slice(0, 6)}…{refFromUrl.slice(-4)} — your wallet will be linked on connect.
              </p>
            )}
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
            {/* ─── Entry checklist ─── */}
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-2xl font-bold">Your entries</h2>
                {entries && (
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total</div>
                    <div className="text-3xl font-bold tabular-nums" style={{ color: "var(--accent)" }}>
                      {entries.totalEntries}
                    </div>
                  </div>
                )}
              </div>

              {entries?.disqualified && (
                <div className="p-4 rounded-lg mb-4 text-sm"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--red, #ef4444)" }}>
                  This wallet has been flagged for sybil / wash behavior and removed from the draw.
                </div>
              )}

              {loading && !entries ? (
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>
              ) : entries ? (
                <div className="space-y-3">
                  {/* Tier 1 — social */}
                  <TierRow
                    done={entries.socialClaimed}
                    title="1. Follow + RT + Reply"
                    points="+1 entry"
                    sub="Follow @AegisProtocol, retweet the pinned hunt post, reply with your favorite token to scan."
                    action={!entries.socialClaimed && (
                      <div className="space-y-2">
                        <input type="text" placeholder="@your_x_handle" value={handle} onChange={(e) => setHandle(e.target.value)}
                          className="w-full px-3 py-2 rounded text-sm" style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
                        <input type="url" placeholder="https://x.com/.../status/... (retweet)" value={rtUrl} onChange={(e) => setRtUrl(e.target.value)}
                          className="w-full px-3 py-2 rounded text-sm" style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
                        <input type="url" placeholder="https://x.com/.../status/... (your reply)" value={replyUrl} onChange={(e) => setReplyUrl(e.target.value)}
                          className="w-full px-3 py-2 rounded text-sm" style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
                        <button onClick={submitSocial} disabled={socialBusy}
                          className="px-4 py-1.5 rounded text-xs font-semibold disabled:opacity-50"
                          style={{ background: "var(--accent)", color: "var(--bg-base)" }}>
                          {socialBusy ? "Submitting…" : "Submit"}
                        </button>
                        {socialMsg && <div className="text-xs" style={{ color: socialMsg.includes("Submitted") ? "var(--green)" : "var(--red, #ef4444)" }}>{socialMsg}</div>}
                      </div>
                    )}
                  />

                  {/* Tier 2 — scans */}
                  <TierRow
                    done={entries.scanCount >= 1}
                    title={`2. Scan tokens (${entries.scanCount}/5 unique)`}
                    points={`+${entries.breakdown.scan} entries`}
                    sub="1 entry per unique BSC token you scan with the connected wallet. Cap 5."
                    action={
                      <Link href="/scanner" className="text-xs underline" style={{ color: "var(--accent)" }}>
                        Open Scanner →
                      </Link>
                    }
                  />

                  {/* Tier 3 — guardian */}
                  <TierRow
                    done={entries.guardianConnected}
                    title="3. Connect Guardian Shield"
                    points="+3 entries"
                    sub="Let the Aegis vault watch one wallet for real-time risk."
                    action={!entries.guardianConnected && (
                      <Link href="/guardian" className="text-xs underline" style={{ color: "var(--accent)" }}>
                        Open Guardian →
                      </Link>
                    )}
                  />

                  {/* Tier 4 — telegram */}
                  <TierRow
                    done={entries.telegramLinked}
                    title="4. Link Telegram alerts"
                    points="+2 entries"
                    sub="Receive Guardian alerts on Telegram (the bot only sends — never receives commands from your account)."
                    action={!entries.telegramLinked && (
                      <Link href="/guardian" className="text-xs underline" style={{ color: "var(--accent)" }}>
                        Link in Guardian →
                      </Link>
                    )}
                  />

                  {/* Tier 5/6/7 — holder */}
                  <TierRow
                    done={entries.holderTier !== "None"}
                    title={`5. Hold $UNIQ — ${entries.holderTier === "None" ? "no tier" : entries.holderTier}`}
                    points={`+${entries.breakdown.hold} entries`}
                    sub={`Balance: ${Number(entries.uniqBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })} $UNIQ · 10K (+5) · 50K (+10) · 100K (+25) — snapshot at draw block`}
                  />

                  {/* Referral */}
                  <TierRow
                    done={entries.referralCount >= 1}
                    title={`★ Refer protectors (${entries.referralCount}/10 qualified)`}
                    points={`+${entries.breakdown.referral} entries`}
                    sub="A referral 'qualifies' when they complete at least 2 paid tiers (scan, guardian, telegram, or hold). +5 each, cap 10."
                    action={
                      <div className="flex gap-2 items-center">
                        <input readOnly value={referralLink}
                          className="flex-1 px-3 py-1.5 rounded text-xs font-mono"
                          style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }} />
                        <button onClick={copyRef}
                          className="px-3 py-1.5 rounded text-xs font-semibold"
                          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--accent)" }}>
                          {copied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    }
                  />
                </div>
              ) : null}
            </div>

            {/* ─── Right column: TOTD + Leaderboard ─── */}
            <div className="space-y-6">
              {/* Open Bounty (formerly daily Threat of the Day) */}
              <div className="p-5 rounded-xl"
                style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-lg font-bold">Open Bounty</h3>
                  <div className="text-xs uppercase tracking-wider" style={{ color: "var(--accent)" }}>50k $UNIQ · cap 10</div>
                </div>
                {totd?.token ? (
                  <>
                    <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>We just flagged a live one</div>
                    <div className="font-mono text-xs break-all mb-3" style={{ color: "var(--accent)" }}>{totd.token}</div>
                    <div className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                      Scan this token, then quote-tweet your result with <span style={{ color: "var(--accent)" }}>#AegisCaught</span>. First 10 verified catches earn 50,000 $UNIQ each.
                      <br /><strong>{totd.claimsRemaining}/10 spots left.</strong>
                    </div>
                    <Link href={`/scanner?address=${totd.token}`} className="inline-block text-xs px-3 py-1.5 rounded mb-3"
                      style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)", color: "var(--accent)" }}>
                      Scan this token →
                    </Link>
                    {totd.claimsRemaining > 0 && (
                      <div className="space-y-2">
                        <input type="url" placeholder="Your quote-tweet URL" value={tweetUrl} onChange={(e) => setTweetUrl(e.target.value)}
                          className="w-full px-3 py-2 rounded text-xs" style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
                        <button onClick={submitTotdClaim} disabled={totdBusy}
                          className="w-full px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50"
                          style={{ background: "var(--accent)", color: "var(--bg-base)" }}>
                          {totdBusy ? "Claiming…" : "Claim spot"}
                        </button>
                        {totdMsg && <div className="text-xs" style={{ color: totdMsg.includes("Claimed") ? "var(--green)" : "var(--red, #ef4444)" }}>{totdMsg}</div>}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs space-y-2" style={{ color: "var(--text-secondary)" }}>
                    <p>
                      No daily ritual &mdash; real scams don&apos;t ship on a schedule.
                    </p>
                    <p>
                      <strong>If you find a malicious BSC token in the wild</strong> (rugpull, honeypot, drainer, hidden-mint), scan it on Aegis and quote-tweet your scan link with <span style={{ color: "var(--accent)" }}>#AegisCaught</span>.
                    </p>
                    <p style={{ color: "var(--text-muted)" }}>
                      Hand-judged. Each confirmed catch = 50,000 $UNIQ. Cap: 10 winners across the campaign.
                    </p>
                  </div>
                )}
              </div>

              {/* Leaderboard */}
              <div className="p-5 rounded-xl"
                style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}>
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="text-lg font-bold">Top 50</h3>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>updated every 60s</div>
                </div>
                {leaders.length === 0 ? (
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>No protectors yet. Be first.</div>
                ) : (
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {leaders.map((l) => (
                      <div key={l.rank} className="flex items-center justify-between text-xs py-1.5 px-2 rounded"
                        style={{ background: l.rank <= 3 ? "var(--accent-muted)" : "transparent" }}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono w-6" style={{ color: "var(--text-muted)" }}>#{l.rank}</span>
                          <span className="font-mono" style={{ color: l.rank <= 3 ? "var(--accent)" : "var(--text-secondary)" }}>{l.wallet}</span>
                        </div>
                        <span className="font-semibold tabular-nums">{l.entries}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ─── Rules footer ─── */}
      <section className="px-6 sm:px-10 max-w-6xl mx-auto pb-16">
        <div className="p-5 rounded-xl text-xs leading-relaxed"
          style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
          <strong className="block mb-2" style={{ color: "var(--text-primary)" }}>Rules · Audit · Anti-sybil · Anti-dump</strong>
          • Snapshot freezes at a single BSC block, announced 24h ahead. Winners drawn Jun 1, 16:00 UTC from a future block hash.<br />
          • Anti-sybil: every entrant wallet is scanned by Aegis itself. Drainer / sanctioned / honeypot-deployer wallets are disqualified. Full list published May 28.<br />
          • Anti-dump: 25% of each prize claimable instantly at draw time, 75% vests linearly over 14 days through the open-source <a href="https://github.com/Tonyflam/aegis-protocol/blob/main/contracts/AegisCampaignClaim.sol" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>AegisCampaignClaim</a> contract. Self-custody, no team key.<br />
          • Holder tier reads $UNIQ balance at the snapshot block only. No continuous-holding scan, no last-minute cap.<br />
          • Pool funded from the Aegis treasury — transparent on-chain proof posted before launch. No team allocation, no dilution.<br />
          • Disputes: open a ticket in our Telegram before June 3.
        </div>
      </section>
    </main>
  );
}

export default function CampaignPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" style={{ background: "var(--bg)" }} />}>
      <CampaignPageInner />
    </Suspense>
  );
}
