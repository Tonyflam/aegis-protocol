# Aegis Protocol · Protector Hunt Campaign Playbook

> The complete day-by-day execution plan. Every post, every image prompt, every metric, every Telegram message. Designed to be run **solo** with zero KOL outreach. Built so that copy-paste is the entire workflow.

---

## 0 · Campaign at a glance

| Field | Value |
|---|---|
| **Name** | Protector Hunt — Aegis Origins |
| **Tagline** | *Protect a wallet. Earn $UNIQ. The more you protect, the more you earn.* |
| **Build phase** | Mon May 18 → Wed May 20 (3 days) |
| **Tease phase** | Mon May 18 → Wed May 20 (overlaps build) |
| **Campaign live** | Thu May 21, 12:00 UTC → Sat May 31, 12:00 UTC (10 days) |
| **Draw + winners** | Mon Jun 1, 16:00 UTC |
| **Total $UNIQ pool** | 6,000,000 (~0.6% of supply) |
| **Anti-dump** | Winners claim by depositing into Aegis Vault, 50% unlock day 1 / 50% day 14 |
| **Channels (owned only)** | X (@aegis_protocol), Telegram bot + group, in-product banner, DappBay listing, GitHub README, whitepaper |
| **Total winners** | up to 281 (1 grand + 5 top + 25 silver-rung + 140 random + up to 10 Open Bounty) |

### Success bar (what "insane traction" means)

| Metric | Today (May 18) | Target by Jun 1 | Multiple |
|---|---|---|---|
| Token scans | 379 | **5,000+** | 13× |
| Guardian wallets monitored | 40 | **800+** | 20× |
| $UNIQ holders | 160 | **750+** | 4.7× |
| Telegram group members | unknown | **1,200+** | — |
| X followers | unknown | **3,500+** | — |
| Vault TVL (BNB) | track | **+25 BNB net new** | — |

---

## 1 · Entry mechanics (the public rules)

7 stackable tiers. A user doing everything earns up to **51 entries**. A pure social farmer gets **1**.

| # | Action | Entries | How we verify |
|---|---|---|---|
| 1 | Follow @aegis_protocol on X + RT pinned + reply with a wallet/token they scanned + tag 2 BSC friends | **1** | Form submission + manual spot-check on top 50 leaderboard wallets only |
| 2 | Scan a unique BSC token at aegis-protocol.xyz/scanner (cap 5 unique tokens) | **1 each, max 5** | Redis `scan-tracker` by wallet address |
| 3 | Connect wallet to Guardian Shield with ≥ 0.05 BNB worth of tokens held | **3** | `/api/guardian` snapshot |
| 4 | Link Telegram chat ID via @aegis_protocol_bot | **2** | `telegram-store` registry |
| 5 | Hold ≥ 10,000 $UNIQ at snapshot | **5** | `ERC20.balanceOf` |
| 6 | Hold ≥ 50,000 $UNIQ (Bronze tier) | **10** | TokenGate contract |
| 7 | Hold ≥ 100,000 $UNIQ (Silver tier) | **25** | TokenGate contract |
| ★ | Referral: a wallet you referred completes any 2 paid tiers (cap 10 referrals) | **+5 each** | Redis `aegis:campaign:ref` keyed map |

### Open Bounty — "Find a real one"

We **dropped the daily 14:00 ritual.** Real malicious BSC tokens don't ship on a schedule, and we won't manufacture fake ones for engagement.

Instead, an **Open Bounty** runs the entire campaign window:

> If you find a verifiably malicious BSC token (rugpull, honeypot, drainer, hidden-mint) that our scanner correctly flags as high-risk, scan it on aegis-protocol.xyz, then quote-tweet your scan-result page with `#AegisCaught` and a one-line breakdown of why it's bad.
>
> Each confirmed catch earns the wallet **10,000 $UNIQ**. **Hard cap: 10 winners across the campaign.** Hand-judged by the team; decision is final.

- No daily quota, no FOMO timer, no fake threats.
- One wallet can win at most twice (no whales sweeping the bounty).
- Catches must be public on X before May 31 23:59 UTC.
- The token must be live on BSC mainnet and have at least one victim transaction — we're not paying for theoretical scams.

### Prize table

| Place | Count | $UNIQ | Bonus |
|---|---|---|---|
| Grand Prize | 1 | 1,500,000 | "Founder's Shield" OG role · lifetime Silver tier · custom NFT |
| Top 2-6 | 5 | 300,000 each | Lifetime Bronze tier |
| Top 7-31 | 25 | 50,000 each | OG role |
| Random draw (provably fair) | 140 | 17,500 each | — |
| Open Bounty (hand-judged) | up to 10 | 10,000 each | — |

### Anti-sybil + fairness

1. Wallets that received $UNIQ < 24 h before snapshot **and** dump > 50 % during campaign are auto-disqualified
2. Every entrant wallet is scanned by Aegis Scanner itself. If it flags (drainer history, sanctioned, honeypot deployer) → out. *This is also the marketing — we openly disqualify bad actors.*
3. Final randomness = blockhash of BSC block **#PUBLISHED-IN-ADVANCE** ≈ 16:00 UTC Jun 1. Code is open-sourced in `/scripts/draw.ts` before draw day so anyone can re-run it.
4. Holding tiers require holding **continuously** from snapshot start (lock detected via `Transfer` event scan) — no flash-loan tier-buying.

---

## 2 · Build phase (May 18-20) — what we ship daily

### 🛠 Day -3 · Monday May 18 (today)

**Build target:** the campaign page + entry API.

| Task | File / artifact | DoD |
|---|---|---|
| `GET /api/campaign/entries?address=` returns full entry breakdown | `frontend/src/app/api/campaign/entries/route.ts` | Returns `{ socialClaimed, scanCount, guardianConnected, telegramLinked, uniqBalance, tier, referralCount, totalEntries, breakdown }` |
| Redis schema for: `campaign:social:<wallet>`, `campaign:ref:<wallet>` (referrer), `campaign:ref:list:<referrer>` (set), `campaign:tod:<date>:<rank>` (TOTD winners) | `frontend/src/lib/campaign-store.ts` | Read/write functions exported, in-memory fallback for local |
| `GET /api/campaign/leaderboard` returns top 50 wallets by entries, cached 60 s | same dir | JSON list ordered desc |
| `GET /api/campaign/bounty` returns the current Open Bounty target (if any) | `frontend/src/app/api/campaign/totd/route.ts` | Reads `aegis:campaign:totd:<YYYY-MM-DD>` from Redis, treated as ad-hoc bounty target rather than daily |
| `POST /api/campaign/totd/claim` recorded "I caught it" claim, manual review | same | Returns rank or 409 if full |
| `/campaign` page (client component) | `frontend/src/app/campaign/page.tsx` | Hero + entry checklist with live ✓/✗ + leaderboard table + referral copier + countdown |
| Footer/nav link to `/campaign` | `frontend/src/app/layout.tsx` or nav component | Visible site-wide |

**Time budget:** 4-6 hours coding. Test locally, push to `aegis-security-os`, Vercel preview, smoke-test on mainnet.

### 🛠 Day -2 · Tuesday May 19

| Task | DoD |
|---|---|
| Twitter form for tier 1 social claim (Tally or Typeform free tier) | Public URL ready, fields: wallet, X handle, RT link, reply link |
| Wire form → Redis via webhook or manual sync script | `scripts/sync-social-claims.ts` cron-able |
| Telegram bot `/campaign` command returns user's current entries + leaderboard rank | `frontend/src/app/api/telegram/webhook/route.ts` extended |
| Pin announcement images (5 total — see § 8 below) generated and saved to `public/campaign/` | All `.webp` < 200 KB each |
| Whitepaper page gets a "Campaign live" banner | `frontend/src/app/whitepaper/page.tsx` |
| Landing page hero gets a non-dismissible top strip "🎁 Protector Hunt live — 6M $UNIQ" linking to /campaign | `frontend/src/app/page.tsx` |
| Anti-sybil scan-self pipeline | `scripts/disqualify-bad-wallets.ts` runs nightly, writes `campaign:disqualified` set |

### 🛠 Day -1 · Wednesday May 20

| Task | DoD |
|---|---|
| `scripts/draw.ts` — provably fair winner picker, weighted by entries, deterministic from blockhash | Open-sourced, ready to run |
| `scripts/distribute-winners.ts` — batch `vault.deposit()` on behalf of winners after they sign tier-up acknowledgement | Dry-run tested |
| Snapshot script that locks holder balances + scan counts | `scripts/snapshot.ts day0` outputs JSON |
| Full smoke-test of `/campaign` page on Vercel production with 3 real wallets at different tier mixes | ✅ |
| Telegram group: pin the campaign rules post (will draft below) | Pinned |
| Final hype tweet scheduled for D0 12:00 UTC | Scheduled in TweetDeck/Buffer |

---

## 3 · Pre-launch content (May 18-20)

> Brand voice: serious-but-witty, no emoji spam, no WAGMI, credibility-first. We are a security protocol — every post must reinforce that we ship.

### 📅 Monday May 18

#### 🕘 09:00 UTC — X · Soft tease (no campaign mention yet)

```
The most expensive thing in crypto isn't gas.

It's the alert you didn't get because nobody was monitoring your wallet.

Something is coming. Tomorrow.

🛡️ aegis-protocol.xyz
```

🖼️ **Image 1 — "The cost of silence"** *(see prompt §8.1)*

#### 🕗 20:00 UTC — Telegram (pinned)

```
gm hunters 👋

This week we launch the biggest community moment Aegis has ever run.
No airdrop farming. No bots. Real users only.

If you've ever scanned a token with us or held $UNIQ — you're early.

Tomorrow morning, watch the X account 👀
```

---

### 📅 Tuesday May 19

#### 🕘 09:00 UTC — X · Reveal-of-reveal

```
We're giving back to the people who actually use this protocol.

6,000,000 $UNIQ. 271 winners. No engagement-farming bullshit.

Every entry = one real action that makes BSC safer.

Full rules drop tomorrow, 12:00 UTC.

🛡️ aegis-protocol.xyz
```

🖼️ **Image 2 — "6,000,000 $UNIQ"** *(see prompt §8.2)*

#### 🕓 16:00 UTC — X · Credibility post

> Hard-numbers post to build pre-launch trust. Pull the latest numbers from `/api/stats` before posting.

```
Before we hand out 6,000,000 $UNIQ, here's what Aegis Protocol actually is:

• 5 contracts deployed on BSC Mainnet, Sourcify-verified
• [X] real token scans run by users
• [Y] wallets under Guardian Shield monitoring
• [Z] holders of $UNIQ on-chain
• AI decisions logged immutably via DecisionLogger

We ship in public.

🛡️ aegis-protocol.xyz
```

🖼️ **Image 3 — "Live numbers card"** *(see prompt §8.3)*

#### 🕖 19:00 UTC — Telegram

```
👀 Update for tomorrow:

12:00 UTC sharp, full Protector Hunt rules drop on X + here.

If you've ever wanted to be deep-OG in an actual security protocol (not the 47th memecoin) — this is the window.

A heads-up only people in this group will get: holding $UNIQ during the campaign multiplies your entries. Highest tier hits a 25× multiplier.

Do with that what you will.
```

---

### 📅 Wednesday May 20

#### 🕛 12:00 UTC — X · **THE BIG REVEAL THREAD (8 posts)**

> Post as a thread. Replies stitched. Pin the first one. Schedule via TweetDeck for exact 12:00 UTC.

**Post 1/8 (the hero — image attached)**

```
🛡️ Protector Hunt is live in 24 hours.

6,000,000 $UNIQ to the BSC users who actually protect wallets with Aegis.

No follow-RT-tag-3-friends garbage. No bots winning.

Every entry = one real, verifiable on-chain action.

10 days. 271 winners. Provably fair on-chain draw.

🧵👇
```

🖼️ **Image 4 — "Protector Hunt hero"** *(see §8.4)*

**Post 2/8 — Why this is different**

```
2/ Most BSC giveaways reward bots.

We're a security protocol — our giveaway literally screens entrants through our own scanner. If your wallet flags as a drainer, sanctioned, or honeypot deployer, you're out.

We disqualify in public. That's the marketing.
```

**Post 3/8 — The 7 tiers**

```
3/ How to enter (stackable — do all 7, get up to 51 entries):

1. Follow + RT + reply w/ a scan link + tag 2 BSC friends → 1
2. Scan 1-5 unique BSC tokens at aegis-protocol.xyz → 1 each (max 5)
3. Connect wallet to Guardian Shield → 3
4. Link Telegram chat ID → 2
5. Hold 10k $UNIQ at snapshot → 5
6. Hold 50k $UNIQ (Bronze) → 10
7. Hold 100k $UNIQ (Silver) → 25
```

🖼️ **Image 5 — "7 stackable tiers"** *(see §8.5)*

**Post 4/8 — Open Bounty**

```
4/ Open Bounty:

Real scams don't ship on a schedule. So we're not faking daily "threats."

Find a real malicious BSC token. Scan it on aegis-protocol.xyz. Quote-tweet your result + #AegisCaught.

We hand-verify. Each confirmed catch = 10,000 $UNIQ. Cap: 10 winners.
```

**Post 5/8 — Prize table**

```
5/ The pool:

🥇 Grand Prize × 1 → 1,500,000 $UNIQ + Founder's Shield OG role + lifetime Silver
🥈 Top 2-6 → 300,000 each + lifetime Bronze
🥉 Top 7-31 → 50,000 each + OG role
🎟️ 140 random → 17,500 each
⚔️ Open Bounty → 10,000 × up to 10 confirmed catches
```

🖼️ **Image 6 — "Prize stack"** *(see §8.6)*

**Post 6/8 — Anti-dump**

```
6/ Anti-dump (this matters):

Winners don't get cash to dump.

You claim by depositing your prize into the Aegis Vault.
50% unlocks day 1. 50% unlocks day 14.

You earn Venus yield on it the whole time. We protect the chart. You get protected yield. Win-win.
```

**Post 7/8 — On-chain randomness**

```
7/ Provably fair:

Final draw randomness = blockhash of a pre-announced BSC block at 16:00 UTC on Jun 1.

Draw script is open-sourced 24h before draw. Anyone can re-run it locally and verify.

No trust required. That's the whole point of this protocol.
```

**Post 8/8 — CTA**

```
8/ Starts tomorrow, Thursday May 21, 12:00 UTC.
Ends Saturday May 31, 12:00 UTC.

Be early. The leaderboard goes live with the campaign.

🛡️ aegis-protocol.xyz/campaign

RT post 1 to enter tier 1.
```

#### 🕐 13:00 UTC — Telegram (pinned, replaces previous)

> Copy the thread above into a single Telegram pinned post. Format:

```
🛡️ PROTECTOR HUNT — full rules

Starts: Thursday May 21, 12:00 UTC
Ends: Saturday May 31, 12:00 UTC
Pool: 6,000,000 $UNIQ
Winners: 271
Draw: Mon Jun 1, 16:00 UTC (provably fair, on-chain)

How to enter (stackable):
1. Follow + RT + reply w/ scan link + tag 2 friends → 1 entry
2. Scan 1-5 unique BSC tokens at aegis-protocol.xyz/scanner → 1 each (max 5)
3. Connect Guardian Shield → 3 entries
4. Link Telegram chat ID → 2 entries
5. Hold 10k $UNIQ → 5 entries
6. Hold 50k $UNIQ → 10 entries
7. Hold 100k $UNIQ → 25 entries

🎁 Open Bounty (no daily side-game):
Find a real malicious BSC token, scan it on aegis-protocol.xyz, quote-tweet your result with #AegisCaught. Each confirmed catch = 10,000 $UNIQ. Cap: 10 winners across the whole campaign. Hand-judged.

Prizes:
🥇 1 winner — 1,500,000 $UNIQ + Founder's Shield + lifetime Silver
🥈 5 winners — 300,000 each + lifetime Bronze
🥉 25 winners — 50,000 each
🎟️ 140 random — 17,500 each
⚔️ up to 10 Open Bounty winners — 10,000 each

Winners claim via vault deposit (50% day 1, 50% day 14).

Track entries live: aegis-protocol.xyz/campaign
Type /campaign here for your live tally.

Good luck hunters.
```

#### 🕖 19:00 UTC — X · Final tease

```
24 hours.

Holders, scanners, Guardian users — your existing actions already count as entries when we snapshot tomorrow.

You don't have to start from zero.

aegis-protocol.xyz/campaign goes live 12:00 UTC.
```

---

## 4 · Launch day · Thursday May 21

> Treat this like a product launch, not a tweet. You'll be hands-on for 6 hours.

### 🕙 10:00 UTC — Pre-flight (your checklist)

- [ ] Run `npm run build` locally, push if anything pending
- [ ] Confirm Vercel production deploy is green on commit X
- [ ] Visit `/campaign` from a logged-out wallet — confirm copy + countdown
- [ ] Visit `/campaign` from your wallet — confirm entry counter ✓
- [ ] Run `node scripts/snapshot.ts day0` and commit `snapshots/day0.json`
- [ ] Verify Telegram bot `/campaign` command returns numbers
- [ ] Today's TOTD token loaded into Redis: `SET campaign:totd:2026-05-21 0x...`
- [ ] Threat-of-the-Day image generated for today

### 🕛 12:00 UTC — **LAUNCH**

#### X · Launch post (standalone, NOT a thread reply)

```
The hunt is live.

6,000,000 $UNIQ. 271 winners. 10 days. Zero engagement-farming.

Check your live entries → aegis-protocol.xyz/campaign

If you've ever scanned a token or held $UNIQ, you already have entries.
```

🖼️ **Image 7 — "Hunt is live"** *(see §8.7)*

#### X · Pinned (quote-tweet the reveal thread)

```
↑ Full rules.
Pinning this for 10 days.
Type /campaign in our Telegram for your live entry count.
```

#### Telegram · Drop in main group

```
🟢 LIVE.

aegis-protocol.xyz/campaign

DM @aegis_protocol_bot → /campaign to see your live entry count and leaderboard rank.

Open Bounty is live: find a real malicious BSC token, scan it, QT with #AegisCaught. Up to 10 catches × 10k $UNIQ.
```

*Day 1 has no scheduled "threat reveal" — the bounty stays open the whole campaign. We're not faking threats on a timer.*

### 🕖 19:00 UTC — Leaderboard pulse #1

> Pull live numbers from `/api/campaign/leaderboard` 7h into the campaign.

#### X

```
7 hours in.

[N] hunters entered.
[M] tokens scanned today.
[K] guardian shields activated.

Current top wallet: 0xabcd...wxyz with [E] entries.

Leaderboard updates live: aegis-protocol.xyz/campaign

It's day 1. Plenty of room.
```

#### Telegram

```
🟢 7 hours in:

✓ [N] hunters
✓ [M] scans today
✓ [K] Guardian shields up

Top wallet: 0xabcd...wxyz ([E] entries).

You're not too late. /campaign for your number.
```

### 🕘 21:00 UTC — Daily wrap (X only)

```
Day 1 done.

TOTD #1 winners (10 wallets, 10,000 $UNIQ each, paid Jun 1):
1. 0xabc...
2. 0xdef...
...
10. 0xjkl...

Day 2 TOTD drops tomorrow 14:00 UTC.

Snipe carefully.
```

🖼️ **Image 9 — "TOTD winners card"** *(see §8.9)*

---

## 5 · Daily playbook (May 22 - May 30)

> 9 days of repeatable rhythm. **No daily Threat-of-the-Day ritual** — the Open Bounty stays passively open the whole window. If we organically spot a real bad token mid-campaign, we can announce it ad-hoc via `POST /api/campaign/totd` (the endpoint stays).

### Daily rhythm template

| UTC | Action | Effort |
|---|---|---|
| 09:00 | Morning post (theme-of-the-day, see § below) | 5 min |
| 14:00 | *(skipped — no scheduled threat reveal)* | 0 min |
| 19:00 | Leaderboard pulse + 1 user spotlight | 10 min |
| 21:00 | Daily wrap (numbers + any bounty catches verified that day) | 20 min |
| Telegram | 4-6 messages spread organically through the day | 20 min |

### Themes-of-the-day (drives content variety)

| Day | Date | Theme | Morning angle |
|---|---|---|---|
| 2 | Fri May 22 | **Why Guardian Shield** | Demo: a real rugpull alert Telegram screenshot |
| 3 | Sat May 23 | **Why $UNIQ tiers matter** | Compare Bronze/Silver/Gold benefits, weekend spike |
| 4 | Sun May 24 | **Hunter spotlight** | Interview the current #1 wallet (or pseudonymous) |
| 5 | Mon May 25 | **Halfway! Big numbers reveal** | Pulse: total scans / shields / followers vs Day 0 |
| 6 | Tue May 26 | **Vault yield math** | Show real Venus APY + how winners stack yield |
| 7 | Wed May 27 | **Threat post-mortems** | Recap the worst tokens caught so far |
| 8 | Thu May 28 | **Anti-sybil announcement** | Drop the disqualified-wallet list. Public. Brutal. |
| 9 | Fri May 29 | **Last weekend warning** | Holding-tier snapshot is Saturday — buy now or lose multiplier |
| 10 | Sat May 30 | **Final 24h countdown** | Hourly leaderboard updates |

### Morning post templates

#### Day 2 (Fri May 22) · "Why Guardian Shield"

```
24 hours ago, wallet 0x...xxxx held a token that lost 40% in 6 hours.

Guardian Shield pinged them via Telegram before the dump. They exited at -3%.

That's the product.

Connect your wallet → aegis-protocol.xyz/guardian
+3 entries to Protector Hunt.
```

🖼️ Image: real Telegram alert screenshot (mask wallet) — see §8.10

#### Day 3 (Sat May 23) · "$UNIQ tiers"

```
The single best leverage in Protector Hunt isn't activity. It's the holding multiplier.

10,000 $UNIQ → 5 entries
50,000 $UNIQ (Bronze) → 10 entries + AI Gold scans + fee discount
100,000 $UNIQ (Silver) → 25 entries + Telegram alerts + 40% fee discount

Snapshot ends Saturday May 30. Eight days to compound.

aegis-protocol.xyz/campaign
```

#### Day 4 (Sun May 24) · "Hunter spotlight"

```
Hunter Spotlight: 0xab...cd

• 4 unique tokens scanned (including a $87 risk-score one)
• Guardian Shield active on 12 holdings
• 51,000 $UNIQ held
• Currently 19 entries · #4 on leaderboard

This is exactly the user we built this for.

aegis-protocol.xyz/campaign
```

#### Day 5 (Mon May 25) · "Halfway numbers"

> Pull from `/api/stats` and `/api/campaign/leaderboard` at 08:55 UTC.

```
Halfway pulse:

📊 [X] hunters entered
🔍 [Y] tokens scanned during campaign
🛡️ [Z] new Guardian wallets
💎 [W] $UNIQ holders gained
🪙 [V] BNB net new in vault

Five days left. The leaderboard's top 6 is still moving every hour.

aegis-protocol.xyz/campaign
```

🖼️ **Image 10 — "Halfway pulse card"** *(see §8.10)*

#### Day 6 (Tue May 26) · "Vault yield math"

```
Why Protector Hunt winners claim through the vault:

• Venus supply APY today: ~[X]%
• Your prize earns yield from day 1
• 50% unlocks day 1, 50% unlocks day 14
• AI guards your position the whole time

A 100,000 $UNIQ prize doesn't just sit. It compounds.

aegis-protocol.xyz/vault
```

#### Day 7 (Wed May 27) · "Threat post-mortems"

```
The 5 worst tokens Aegis caught this week:

1. $XXX — risk 94/100 · honeypot pattern matched
2. $YYY — risk 91/100 · LP rug 6h after launch
3. $ZZZ — risk 88/100 · ownership not renounced
4. $AAA — risk 87/100 · 41% supply in deployer wallet
5. $BBB — risk 85/100 · contract upgraded mid-trade

Scan before you ape. aegis-protocol.xyz
```

🖼️ Image: a 5-row leaderboard of red-flagged tokens — see §8.11

#### Day 8 (Thu May 28) · "Anti-sybil"

```
Public housekeeping.

The following [N] wallets are disqualified from Protector Hunt:

[list of wallet addresses + reason: "drainer history", "honeypot deployer", "<24h funded + dumped 80%"]

We scan our entrants with our own scanner. We built this to filter exactly this.

Real users only.
```

🖼️ Image: a clean redaction-style screenshot of the disqualified list — see §8.12

#### Day 9 (Fri May 29) · "Last weekend"

```
Holding-tier snapshot starts in 24h.

If you want the 5× / 10× / 25× entry multiplier on your $UNIQ, buy and HODL through Saturday May 30, 12:00 UTC.

Flash buys won't count — we snapshot Transfer events.

aegis-protocol.xyz/campaign
```

#### Day 10 (Sat May 30) · "Final 24h"

```
24 hours left.

Top of the leaderboard right now:
🥇 0xa...x · [E] entries
🥈 0xb...y · [E] entries
🥉 0xc...z · [E] entries

Top 6 win 300k+ $UNIQ each. Two are within reach if you act today.

aegis-protocol.xyz/campaign
```

> Then post leaderboard updates **every 3 hours** on Day 10 (15:00, 18:00, 21:00, 00:00, 03:00, 06:00, 09:00). Same template, different numbers. This is the urgency engine.

### Daily wrap template (every night 21:00 UTC)

```
Day [N] of 10 done.

Today's numbers:
✓ [X] new scans
✓ [Y] new Guardian wallets
✓ [Z] new TG members
✓ [W] new holders

TOTD #[N] winners (10k $UNIQ each):
1. 0x...
2. 0x...
…
10. 0x...

Leaderboard top 3:
🥇 0x...x · [E] entries
🥈 0x...y · [E] entries
🥉 0x...z · [E] entries

aegis-protocol.xyz/campaign
```

### Threat of the Day template (every day 14:00 UTC, May 21-30)

> 10 TOTDs to ship. Pre-pick all 10 on Day -1 (May 20) and keep them in a private note. Each must have risk score ≥ 75/100 and at least mild trading activity (so participants actually see a real result).

```
⚔️ Threat of the Day #[N]

Token: $[SYMBOL]
Address: 0x...
Risk score: [X]/100

First 10 wallets to scan + quote-tweet with #AegisCaught win 10,000 $UNIQ each.

aegis-protocol.xyz/scan/0x...

GO.
```

### Telegram daily cadence (organic, throughout day)

Spread 4-6 messages per day. Examples to rotate:

- *gm hunters · [N] entries already in today*
- *anyone else seeing TOTD #[N] is going to be brutal? scan it carefully, the contract is sneaky*
- *current top 3 in protector hunt: [list] · gap to #1 is only [X] entries*
- *quick reminder: holding 50k $UNIQ = 10 entries. that's not nothing.*
- *just disqualified 3 wallets for sybil — see today's X post*
- *leaderboard moved hard in the last hour. open /campaign in the bot to check yourself.*
- *vault is now at [X] BNB TVL. winners will earn Venus yield on prizes from day 1.*

---

## 6 · Final day · Saturday May 31

### 🕛 12:00 UTC — Snapshot closes

#### Action (your hands)
1. Run `node scripts/snapshot.ts final` → outputs `snapshots/final.json` with all 7 tier states locked
2. Run `node scripts/disqualify-bad-wallets.ts` one final pass
3. Commit & push: `git add snapshots/ && git commit -m "campaign: final snapshot" && git push`

#### X · Snapshot tweet

```
Snapshot taken.

[N] eligible wallets · [E] total entries · top 6 within 8 entries of each other.

Provably fair draw runs Monday Jun 1, 16:00 UTC.
Block #[ANNOUNCE] will provide randomness.
Draw script open-sourced now: github.com/Tonyflam/aegis-protocol/blob/main/scripts/draw.ts

48 hours until winners.
```

🖼️ **Image 13 — "Snapshot taken"** *(see §8.13)*

#### Telegram (pinned, replaces rules pin)

```
📸 Snapshot taken.

[N] eligible wallets.
[E] total entries.

Provably fair draw: Monday Jun 1, 16:00 UTC
Randomness source: BSC block #[ANNOUNCED-IN-ADVANCE] hash
Draw script: github.com/Tonyflam/aegis-protocol/blob/main/scripts/draw.ts

You can clone the script now and confirm the algorithm yourself.

Winners post in this group + on X at 17:00 UTC Monday.
```

### 🕕 18:00 UTC — Hype build

```
36 hours.

Run the draw script locally if you want to be early:
git clone github.com/Tonyflam/aegis-protocol
cd aegis-protocol/scripts
ts-node draw.ts --snapshot ../snapshots/final.json --block [#]

The block hash doesn't exist yet — but the algorithm does. That's the whole point.
```

---

## 7 · Draw day · Monday Jun 1

### 🕓 16:00 UTC — Draw

#### Action
1. Wait for BSC block #[ANNOUNCED] to be finalized
2. Run `ts-node scripts/draw.ts --snapshot snapshots/final.json --block [#]` live (record screen)
3. Output `winners.json` and commit
4. Begin `scripts/distribute-winners.ts` dry-run, then real run

#### X · Live draw thread (10 posts)

**1/10**
```
🛡️ The Protector Hunt draw is live.

Block #[X] finalized at 16:00 UTC.
Hash: 0x[FULL_HASH]

Running scripts/draw.ts now. Screen recording linked at end.

Winners thread 🧵👇
```

**2/10 — Grand Prize**
```
🥇 GRAND PRIZE — 1,500,000 $UNIQ + Founder's Shield + lifetime Silver

Winner: 0x[ADDRESS]
Entries: [E]

Verify: tx [link to block explorer]

Welcome to the founders' table.
```

**3/10 — Top 6**
```
🥈 TOP 6 — 300,000 $UNIQ + lifetime Bronze each

2. 0x[ADDR]
3. 0x[ADDR]
4. 0x[ADDR]
5. 0x[ADDR]
6. 0x[ADDR]

Five winners just earned lifetime fee discounts.
```

**4/10 — Top 31 (the 25 silver-rung)**
```
🥉 PLACES 7-31 — 50,000 $UNIQ each

[list of 25 wallets]

These are the consistent hunters. Every one of them scanned tokens, ran guardian, and held.
```

**5/10 — Random 100 (split in 2 tweets)**
```
🎟️ RANDOM DRAW (1-50) — 17,500 $UNIQ each

[50 wallets]
```

**6/10**
```
🎟️ RANDOM DRAW (51-100) — 17,500 $UNIQ each

[50 wallets]
```

**7/10 — TOTD winners aggregate**
```
⚔️ THREAT OF THE DAY WINNERS

100 wallets earned 10,000 $UNIQ each across 10 days of hunts.

Full list: aegis-protocol.xyz/campaign/winners
```

**8/10 — Distribution mechanics**
```
🪙 How prizes ship:

Each winner gets a one-time signed claim page at aegis-protocol.xyz/campaign/claim?w=[wallet].

Sign once → 50% of prize deposits into your vault position immediately, 50% locks for 14 days, both earn Venus yield from block 1.

Claim window: 7 days.
```

**9/10 — Disqualified**
```
🚫 Disqualified wallets (transparent log):

[N] wallets removed for: drainer history, honeypot deployer history, sub-24h funding + dump > 50%.

Full list with reasons: aegis-protocol.xyz/campaign/disqualified

This is the standard. No tantrum DMs.
```

**10/10 — Wrap + next**
```
🛡️ Protector Hunt closed.

Final numbers vs Day 0:
• [X] new scans
• [Y] new Guardian wallets
• [Z] new $UNIQ holders
• [W] BNB TVL added
• [V] new Telegram members

This was the warm-up. The next move ships in 30 days.

Stay sharp.
```

#### Telegram

```
🛡️ WINNERS POSTED ON X.

Grand prize: 0x[ADDR] — 1,500,000 $UNIQ + Founder's Shield 👑

Top 6: see thread.
Top 31: see thread.
Random 100: see thread.
TOTD 100: see thread.

Every winner gets a DM here with a personal claim link in the next hour.

GG hunters.
```

### 🕔 17:00 UTC — Personal DMs (Telegram bot)

> Build into bot: iterate winners.json, send personal message to each linked chat_id:

```
gm 0xABCD...WXYZ

You won [PLACE] in Aegis Protector Hunt.

Prize: [AMOUNT] $UNIQ
Claim: aegis-protocol.xyz/campaign/claim?w=[WALLET]&t=[SIGNED_TOKEN]

You have 7 days. After claim, 50% drops into your vault position immediately, 50% locks for 14 days. Both earn yield from block 1.

Welcome to the inside.
```

---

## 8 · Image prompt library (for Google's best image model — Imagen 4 / Nano Banana)

> Aegis brand:
> - Dark theme: pure black background `#0A0A0B`
> - Primary text: near-white `#F5F5F7`
> - Accent: warm yellow `#FACC15`
> - Card surface: `#141416`
> - Type: clean geometric sans (think Geist / Inter)
> - Style direction: editorial minimalism, generous negative space, never crypto-bro neon

### 8.1 · "The cost of silence" (May 18 tease)

```
Editorial dark-mode poster, 16:9. Pure black background. A single tiny pixel-perfect padlock icon centered, drawn in warm yellow (#FACC15), rendered as if half-erased — left edge slightly fading into the black void. Above the lock in light grey text, a single word: "silence." Below the lock in smaller dim text: "is the most expensive thing in crypto." Bottom-right corner: tiny "aegis" wordmark in white. No other elements. Mood: still, ominous, premium. Style references: Apple keynote stills, Linear product pages, Stripe Press book covers. Aspect ratio 16:9.
```

### 8.2 · "6,000,000 $UNIQ" (May 19 reveal)

```
Bold minimalist poster, 1:1 square. Pure black background. Center: the number "6,000,000" rendered enormous in solid warm yellow (#FACC15), heavy geometric sans-serif, slight letter-spacing. Directly below in smaller pure-white text: "$UNIQ". Bottom of the canvas, in 14pt dim grey: "for the BSC users who actually protect wallets." Top-left corner: small Aegis shield logo in white, max 32px tall. No gradients, no glow, no particle effects. Pure typography. Aspect ratio 1:1.
```

### 8.3 · "Live numbers card" (May 19 credibility)

```
Dark editorial dashboard card mockup, 1.91:1. Pure black background (#0A0A0B). Four equal stat tiles arranged in a single row, each tile is a flat #141416 card with 1px hairline border in #2A2A2D, padding 24px. Each tile contains: small uppercase label in dim grey 11pt at top ("TOKEN SCANS" / "GUARDIAN WALLETS" / "UNIQ HOLDERS" / "VERIFIED CONTRACTS"), large pure-white number 48pt below ("379" / "40" / "160" / "5"), and a tiny yellow dot indicator. Below the row, single line of dim grey 14pt text: "Live on BSC Mainnet." Top-left small "Aegis Protocol" wordmark in white. Style references: Vercel dashboard, Linear status page. No charts, no decoration. Just numbers. Aspect ratio 1.91:1.
```

### 8.4 · "Protector Hunt hero" (May 20 thread post 1)

```
Cinematic dark editorial poster, 1.91:1 landscape. Pure black background. Left two-thirds: enormous text block in pure white geometric sans, three lines stacked tight: "PROTECTOR" / "HUNT" / "is live." The word "live." is in warm yellow (#FACC15). Right one-third: a vertical stack of four small flat dark cards, each showing a tier as text only — "1×" / "3×" / "10×" / "25×" with tiny labels under each ("scan" / "guardian" / "bronze" / "silver"). Bottom strip, full-width, dim grey 14pt: "6,000,000 $UNIQ · 271 winners · 10 days · provably fair." Top-right corner: Aegis shield logo small in white. Style: Apple TV+ show poster, Linear changelog hero. No emoji, no glow. Aspect ratio 1.91:1.
```

### 8.5 · "7 stackable tiers" (May 20 thread post 3)

```
Minimalist infographic poster, 1:1 square, pure black background (#0A0A0B). A vertical numbered list of 7 rows from top to bottom. Each row is a thin flat horizontal card #141416 with 1px hairline border, padding 16px, containing on the left: a circular number badge 1-7 (white digit on yellow #FACC15 circle, 32px), in the middle: row label in white 14pt ("Follow + RT + reply" / "Scan 1-5 tokens" / "Connect Guardian Shield" / "Link Telegram" / "Hold 10k UNIQ" / "Hold 50k UNIQ" / "Hold 100k UNIQ"), on the right: entry count in yellow 18pt ("1" / "1-5" / "3" / "2" / "5" / "10" / "25"). Rows separated by 8px gap. Above the rows in small uppercase dim text: "STACKABLE ENTRIES — DO ALL 7 FOR 51 ENTRIES." Bottom: tiny "aegis-protocol.xyz/campaign" wordmark. Aspect ratio 1:1.
```

### 8.6 · "Prize stack" (May 20 thread post 5)

```
Dark editorial prize-table poster, 4:5 portrait. Pure black background. Five horizontal rows stacked, each is a #141416 flat card 1px border in #2A2A2D, padding 18px, containing on the far left a medal emoji or simple yellow gradient indicator (🥇 gold / 🥈 silver / 🥉 bronze / 🎟️ neutral / ⚔️ red-edged), in the center a number in large white 24pt ("1,500,000" / "300,000" / "50,000" / "17,500" / "10,000"), the word "$UNIQ" in dim grey 12pt below, and on the right the winner count in yellow 14pt ("× 1" / "× 5" / "× 25" / "× 100" / "× ~100"). Top of canvas in small uppercase grey: "THE POOL — 6,000,000 $UNIQ TOTAL". Bottom: tiny shield logo. No gloss, no particles, no shine. Aspect ratio 4:5.
```

### 8.7 · "Hunt is live" (May 21 launch)

```
Dark cinematic announcement, 16:9. Pure black background. Centered three-line text block: "the hunt" in white 80pt thin sans / "is" tiny 24pt grey on its own line / "live." in warm yellow #FACC15 120pt heavy sans. To the right of "live.", a tiny pulsing dot in yellow (single solid circle 12px). Bottom-left: small URL "aegis-protocol.xyz/campaign" in 14pt white. Bottom-right: shield logo small in white. No other elements. Mood: declarative, calm, premium. Aspect ratio 16:9.
```

### 8.8 · "Threat of the Day card" (template, regenerate daily May 21-30)

```
Dark threat-detection card mockup, 1.91:1. Pure black background. Single centered flat card #141416 1px border #2A2A2D, 800px wide. Top-left of card: small uppercase yellow tag "THREAT OF THE DAY #[N]". Below in large white 36pt: "$[SYMBOL]" token name. Below in mono dim grey 14pt: "0x[REDACTED ADDRESS]". Below in red text 18pt: "RISK SCORE [X]/100" with a small red triangle warning icon. Bottom of card, single-line uppercase grey 11pt: "FIRST 10 TO SCAN + QT WITH #AegisCaught WIN 10,000 $UNIQ". Outside card top-right corner of canvas: tiny shield logo white. Aspect ratio 1.91:1.
```

> Regenerate this template with new [N], [SYMBOL], [ADDRESS], [X] each day. Save as `public/campaign/totd-day-[N].webp`.

### 8.9 · "TOTD winners card" (template, daily 21:00 UTC)

```
Dark editorial leaderboard card, 1.91:1. Pure black background. Top-left of canvas in small uppercase yellow: "TOTD #[N] WINNERS". Vertical numbered list of 10 rows. Each row is a thin horizontal strip with: circular number badge 1-10 (white on dark grey circle, 24px), wallet address truncated middle "0xabcd…wxyz" in mono white 16pt, time-of-claim in dim grey mono 12pt on far right. Rows separated by 1px hairline #2A2A2D. Bottom of canvas: text in dim grey 12pt: "10 × 10,000 $UNIQ paid out Jun 1." Top-right corner: shield logo small white. Aspect ratio 1.91:1.
```

### 8.10 · "Halfway pulse card" (May 25)

```
Dark editorial statistics poster, 1:1 square, pure black background. Centered grid 2×2 of four flat dark cards #141416, 1px border #2A2A2D, padding 28px. Each card contains: a large arrow-up icon in yellow #FACC15 32px in top-left corner, a small uppercase label in dim grey 11pt below the arrow ("SCANS" / "GUARDIAN WALLETS" / "UNIQ HOLDERS" / "BNB IN VAULT"), and a huge number in pure white 56pt at the bottom showing the delta (e.g. "+1,247"). Below the 2x2 grid: single line uppercase grey 14pt "HALFWAY PULSE — DAY 5 OF 10". Top-left corner of full canvas: small "Aegis Protocol" wordmark white. Aspect ratio 1:1.
```

### 8.11 · "Top 5 caught threats" (May 27)

```
Dark editorial leaderboard, 4:5 portrait, pure black background. Title at top in small uppercase yellow: "FIVE WORST TOKENS AEGIS CAUGHT THIS WEEK". Below, five thin horizontal cards stacked, each with: rank number 1-5 in yellow circle on the left, token symbol in white 22pt next to it ($XXX), risk score on the right in red 18pt with red warning triangle (94/100, 91/100, 88/100, 87/100, 85/100), and one-line reason in dim grey 12pt below the symbol ("honeypot pattern matched", "LP rug 6h after launch", "ownership not renounced", "41% supply in deployer wallet", "contract upgraded mid-trade"). Rows separated by 8px gap. Bottom: dim grey wordmark "scan before you ape · aegis-protocol.xyz". Aspect ratio 4:5.
```

### 8.12 · "Disqualified list" (May 28)

```
Dark editorial brutal-honesty poster, 1.91:1. Pure black background. Centered title in small uppercase yellow: "DISQUALIFIED — [N] WALLETS". Below, a vertical list of 6-8 wallet rows in mono grey, each truncated middle "0xabcd…wxyz", with a small uppercase red-text reason tag right of each address ("DRAINER HISTORY" / "HONEYPOT DEPLOYER" / "SUB-24H DUMP" / "SYBIL CLUSTER"). Rows separated by 1px hairline. Bottom dim grey 12pt: "we scan our entrants with our own scanner. that's the standard." Top-right shield logo. Aspect ratio 1.91:1.
```

### 8.13 · "Snapshot taken" (May 31)

```
Dark cinematic still, 16:9. Pure black background. Centered single line in pure-white 80pt geometric sans: "snapshot taken." Below in 18pt dim grey: "[N] eligible wallets · [E] total entries · top 6 within 8 entries." Bottom of canvas in small uppercase yellow: "DRAW — MONDAY JUN 1 · 16:00 UTC · BLOCK #[X]". Top-left tiny shield logo. No other elements. Mood: locked, irreversible, premium. Aspect ratio 16:9.
```

### 8.14 · "Winners" (Jun 1)

```
Dark editorial winners poster, 1.91:1. Pure black background. Top centered: small uppercase yellow "PROTECTOR HUNT · WINNERS". Below in 80pt pure white: "271." Below in 18pt dim grey: "real users. real scans. real protected wallets." Below that, a thin yellow horizontal divider 200px wide. Below the divider in 14pt grey: "draw verified · block #[X] · script open-sourced". Bottom-left shield logo white. Bottom-right: "aegis-protocol.xyz/campaign/winners" in 12pt dim grey. Aspect ratio 1.91:1.
```

### 8.15 · Optional bonus — "Founder's Shield NFT" (Jun 1 grand prize)

```
Premium token-art piece, 1:1 square, 2048×2048 hi-res. Pure black background. Centered: a single hand-drawn shield outline rendered in warm yellow (#FACC15) thick stroke, no fill, with the word "FOUNDER" in tiny serif white inside the top of the shield and a sequence number "#001" in mono grey at the bottom. Around the shield, ultra-faint geometric circles forming a guard pattern, barely visible 5% opacity white. Below shield in 18pt grey: "Aegis Protector Hunt · May 2026". Style references: certificate of authenticity, vintage stock certificate, minimalist NFT poster. Aspect ratio 1:1.
```

---

## 9 · Resource checklist (what you need on hand)

### 🧰 Tools
- [ ] X (Twitter) account with scheduled-posts feature (TweetDeck native or Buffer/Typefully free tier)
- [ ] Image generator: Google Imagen 4 or Nano Banana via Gemini app (prompts above are tuned for Imagen 4)
- [ ] Tally.so or Typeform (free tier) — single form for tier 1 social claim submissions
- [ ] Screen recorder (OBS or QuickTime) — to record the draw live on Jun 1
- [ ] Telegram bot already wired (@aegis_protocol_bot)
- [ ] Redis (already configured)
- [ ] Vercel CLI for production deploys

### 🔗 URLs to lock in advance
- [ ] `aegis-protocol.xyz/campaign` — main hub
- [ ] `aegis-protocol.xyz/campaign/claim?w=...` — winner claim page
- [ ] `aegis-protocol.xyz/campaign/winners` — public winners ledger
- [ ] `aegis-protocol.xyz/campaign/disqualified` — public sybil ledger
- [ ] `github.com/Tonyflam/aegis-protocol/blob/main/scripts/draw.ts` — open-source randomness

### 📁 Local artifacts to commit
- [ ] `snapshots/day0.json` (May 21)
- [ ] `snapshots/day5.json` (May 25) — for halfway pulse credibility
- [ ] `snapshots/final.json` (May 31)
- [ ] `winners.json` (Jun 1)
- [ ] `public/campaign/totd-day-1.webp` through `totd-day-10.webp`
- [ ] `public/campaign/hero.webp`, `prize-stack.webp`, `tiers.webp`, `winners.webp`

### 📝 Pre-pick on May 20 (block out 1 hour)
- [ ] 10 real BSC tokens with risk score ≥ 75/100 for TOTD #1-10 (store in private note + commit to private file)
- [ ] The BSC block number that will provide draw randomness (~Jun 1 16:00 UTC, that's roughly block `[CURRENT + ~430,000]`) — announce in launch thread
- [ ] Founder's Shield NFT artwork (or commit "art TBD by Jun 8")

### 🔐 Security pre-flight
- [ ] Treasury wallet for distribution has ≥ 6,500,000 $UNIQ (6M prizes + 500k buffer for gas/edge cases)
- [ ] Multi-sig the treasury so no single key risk during the campaign
- [ ] `scripts/distribute-winners.ts` runs in dry-run mode by default; flip with `--execute` only on Jun 1
- [ ] All endpoints rate-limited to prevent scraping leaderboard

---

## 10 · Risk register (and what to do)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sybil farm builds 50 wallets, each hits social tier | High | Medium | Anti-sybil scan + manual top-50 vetting · social tier is only 1 entry, so 50 sybils = 50 entries = barely meaningful next to a Silver holder's 25 |
| $UNIQ price pumps then dumps during campaign | Medium | Medium | Anti-dump claim mechanism (vault-locked 14d) keeps winner sell pressure off · communicate the lock loudly in every prize-related post |
| Vercel cron miss → leaderboard stale | Low | Medium | `/api/campaign/entries` is computed-on-read, not stored · leaderboard cache 60s · degrades gracefully |
| Off-chain agent dies mid-campaign | Medium | High (trust-killing) | Agent heartbeat already surfaced in `/api/vault` since last commit · if it goes red we communicate immediately, never hide it |
| Draw randomness block reorganizes | Very low | High | Use a block confirmed > 60 confirmations · BSC has never had a reorg deeper than 15 blocks in production |
| Winner doesn't claim within 7 days | Medium | Low | Tokens roll to a "second chance" pool · announce day 8 |
| RPC outage during snapshot | Low | High | Multi-RPC with fallback in `scripts/snapshot.ts` (use bsc-dataseed1, bsc-dataseed2, ankr) |
| Some viral hater says it's a scam | Medium | Low | Code is open · draw script is verifiable · ignore noise, let on-chain math reply |

---

## 11 · Post-campaign (Jun 2 onwards)

| Day | Action |
|---|---|
| Jun 2 | Compile testimonials from 5 winners (DM ask) for next-campaign social proof |
| Jun 3 | Public "campaign retrospective" thread — what worked, what didn't, what's next |
| Jun 4 | Newsletter / blog post version of the retrospective (LinkedIn or Mirror.xyz) |
| Jun 5-7 | Buffer week. Do not launch anything. Let the wins compound. |
| Jun 8 | Announce Phase 2: either a feature drop or a Protector Hunt season 2 with raised bar |

---

## 12 · The one rule

Every post we ship during this campaign must pass two checks:
1. **Would a security professional respect this?** (no shilling, no engagement-bait language, no fake hype)
2. **Does the action it asks for make BSC safer for someone?** (scan, monitor, hold, learn)

If yes to both → post. If no to either → rewrite or kill.

That's the campaign.
