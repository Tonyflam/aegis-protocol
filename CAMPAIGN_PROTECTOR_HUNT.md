# 🛡️ Aegis Protector Hunt — Playbook v2

> One file. Day-by-day. Every day has its build tasks, post copy, and image prompts in the same place.
> Old fragmented version archived in `CAMPAIGN_PROTECTOR_HUNT.md.bak`.

---

## 0 · The campaign in one screen

| | |
|---|---|
| **Name** | Aegis Protector Hunt |
| **Window** | Thu **May 21** 12:00 UTC → Sat **May 31** 12:00 UTC (10 full days) |
| **Snapshot block** | One BSC block at draw time — no continuous-hold scanning, no "buy and hold for 10 days" nonsense |
| **Draw** | Mon **Jun 1** 16:00 UTC · provably fair · open-source script · seeded by a pre-announced BSC block hash |
| **Prize pool** | **25,000,000 $UNIQ** (was 6M — bumped to reflect real-world value) |
| **Winners** | up to **151** (1 grand · 5 top · 25 silver-rung · 100 random · up to 10 Open Bounty) |
| **Anti-dump** | **Merkle claim contract with 25% instant / 75% linear vesting over 14 days.** No "deposit into vault" — vault only accepts BNB/USDT. Contract deploys May 27, address published Day -1. |
| **Funding source** | Treasury wallet `0xTODO-fill-on-may-26` — transparent on-chain proof posted before launch. |
| **Channels** | X (@aegis_protocol), Telegram bot + group, in-product banner, DappBay, GitHub README, whitepaper |
| **Voice** | Serious-but-witty. No WAGMI. No fake hype. Every post passes the two checks in §12. |

### What "insane traction" means

By draw day we want:

- ✅ Token scans during campaign: **+5,000 net new** (baseline ~380)
- ✅ New Guardian-Shield wallets: **+500**
- ✅ New verified $UNIQ holders: **+1,500**
- ✅ Telegram group: **2× members** vs Day 0
- ✅ Net BNB into vault: **+50 BNB**
- ✅ Followers on X: **+10,000**

If we hit half of these, this was the best ROI of any growth move we'll ever make.

---

## 1 · Public rules (this is what entrants see)

### 1.1 Seven stackable entry tiers

| # | Action | Entries | How we verify |
|---|---|---|---|
| 1 | Follow @aegis_protocol · RT pinned · reply with a wallet/token you scanned · tag 2 BSC friends | **1** | Form submission + spot-check top 50 leaderboard wallets |
| 2 | Scan a unique BSC token at aegis-protocol.xyz/scanner (cap 5 unique tokens) | **1 each, max 5** | Redis scan log keyed by wallet |
| 3 | Connect wallet to Guardian Shield (any non-zero monitored value) | **3** | `/api/guardian` snapshot |
| 4 | Link Telegram chat ID via @aegis_protocol_bot | **2** | `telegram-store` registry |
| 5 | Hold ≥ 10,000 $UNIQ at draw block | **5** | `ERC20.balanceOf` at snapshot block |
| 6 | Hold ≥ 50,000 $UNIQ (Bronze) at draw block | **10** | Same |
| 7 | Hold ≥ 100,000 $UNIQ (Silver) at draw block | **25** | Same |
| ★ | Referral: a wallet you referred completes any 2 of tiers 2-7 (cap 10 referrals) | **+5 each** | Redis ref map |

**Max for one wallet: 51 entries** (1 + 5 + 3 + 2 + 25 + 50 referrals).

### 1.2 Open Bounty — "Find a real one"

> No daily ritual. Real scams don't ship on a schedule.

If you find a verifiably malicious BSC token (rugpull, honeypot, drainer, hidden-mint), scan it on aegis-protocol.xyz, then quote-tweet your scan-result page with `#AegisCaught` + a one-line breakdown of why it's bad.

- Each confirmed catch earns the wallet **50,000 $UNIQ**.
- **Hard cap: 10 winners across the campaign.** Hand-judged. Decision is final.
- Catches must be public on X before May 31 23:59 UTC.
- The token must be live on BSC mainnet with at least one victim transaction.

### 1.3 Prize table (25,000,000 $UNIQ)

| Place | Count | $UNIQ each | Bonus |
|---|---|---|---|
| Grand Prize | 1 | 5,000,000 | **Founder's Shield** soulbound NFT · permanent Silver-tier Aegis Pass · custom 1/1 art |
| Top 2-6 | 5 | 1,000,000 | Permanent Bronze-tier Aegis Pass |
| Top 7-31 | 25 | 200,000 | "OG Protector" Telegram role + 40 % fee discount for 1 year |
| Random draw (provably fair) | 100 | 100,000 | — |
| Open Bounty (hand-judged) | up to 10 | 50,000 | — |
| **TOTAL** | **up to 141 + 10** | **25.5M committed** | |

> **Permanent tier passes** ship as a soulbound ERC-721 (`AegisPass.sol`, ~50 LOC). `TokenGate` honors the NFT as a tier override regardless of $UNIQ balance. Contract reviewed and deployed Day -1.

### 1.4 Anti-sybil + fairness

1. Wallets that received $UNIQ < 24 h before snapshot **and** sold > 50 % of received supply during the campaign are auto-disqualified.
2. Every entrant wallet is scanned by Aegis Scanner itself. If it flags (drainer, sanctioned, honeypot deployer) → out. *That's the marketing — we openly disqualify bad actors.*
3. Final randomness = hash of BSC block **#PUBLISHED-IN-ADVANCE** at ≈ 16:00 UTC Jun 1. Draw script open-sourced at `/scripts/draw.ts` before draw day.
4. Holding tier read at **a single snapshot block**, not continuously. Simple, gas-fair, hard to game with continuous-hold heuristics.

---

## 2 · Daily playbook

> Each section below contains: **🛠 Build** (what code/infra ships), **📣 Posts** (X + Telegram copy verbatim), **🖼 Images** (prompts ready for Imagen 4 / Nano Banana). Brand: dark `#0A0A0B`, accent yellow `#FACC15`, type Geist / Inter.

---

### 🗓 Day -3 · Monday May 18 — Build only, no posts (DONE)

**🛠 Build**
- [x] `frontend/src/lib/campaign-store.ts` — Redis schema + in-memory fallback
- [x] `/api/campaign/entries`, `/leaderboard`, `/social`, `/totd`, `/totd/claim`
- [x] `/campaign` page (hero · 7-tier checklist · referral copier · leaderboard · Open Bounty panel)
- [x] Navbar link to `/campaign`
- [x] Scanner page passes `&by=<wallet>` so per-wallet scan dedupe works

**Status:** shipped on branch `aegis-security-os` · commits `74e3181` → `bab9bdf`.

---

### 🗓 Day -2 · Tuesday May 19 — Polish + first warm-up post

**🛠 Build (3 tasks only — don't pile on)**

1. **Landing-page top strip** — non-dismissible yellow ribbon on `frontend/src/app/page.tsx`:
   > 🎁 Protector Hunt launches Thu May 21 · **25,000,000 $UNIQ** · 10 days · zero engagement-farming → /campaign
2. **Extend Telegram bot `/campaign` command** in `frontend/src/app/api/telegram/webhook/route.ts` — lookup linked wallet via `telegram-store`, fetch `/api/campaign/entries?address=`, reply with tally + leaderboard rank.
3. **Anti-sybil scan** baked into `/api/campaign/leaderboard` — when computing entries, also call Aegis Scanner on each wallet; if score ≤ 20 (drainer/sanctioned/etc.) call `disqualify()` from campaign-store before scoring. *No separate cron — single pipeline.*

**📣 Posts**

**09:00 UTC · X — Reveal-of-reveal**

```
We're giving back to the people who actually use this protocol.

25,000,000 $UNIQ. Up to 151 winners. No engagement-farming. No daily quotas.

Every entry = one real action that makes BSC safer.

Full rules drop tomorrow, 12:00 UTC.

🛡️ aegis-protocol.xyz
```
🖼️ *Use image 2.A below.*

**16:00 UTC · X — Credibility post (pull live numbers from `/api/stats` first)**

```
Quietly, on BSC:

🔍 [N] tokens scanned by real users
🛡️ [M] wallets under Guardian protection
💎 [K] $UNIQ holders
🤖 [L] autonomous AI decisions logged on-chain

Built by a 1-dev team. Live. Auditable.

aegis-protocol.xyz
```
🖼️ *Use image 2.B below.*

**20:00 UTC · Telegram (pinned)**

```
gm hunters 👋

Tomorrow 12:00 UTC we drop the full rules of the biggest community moment Aegis has ever run.

25,000,000 $UNIQ. Up to 151 real winners. Zero airdrop farming.

If you've ever scanned a token with us or held $UNIQ — you're already in. Watch X tomorrow.
```

**🖼 Images**

**Image 2.A · "25,000,000 $UNIQ" (square, X reveal)**

```
Cinematic editorial poster, 1:1 square, IMAX-grade detail. Set inside an obsidian-black void at #0A0A0B with subtle volumetric haze drifting from below. Camera: anamorphic 35mm, shallow depth-of-field, lens flare from a single off-frame golden light source rim-lighting the type from upper-right at 35°. Centerpiece: the number "25,000,000" rendered in heavy custom geometric sans, brushed-gold material #FACC15 with micro-imperfections, slight chromatic separation on the edges, casting a soft warm glow into the surrounding fog. Directly below in matte pure-white 18pt: "$UNIQ". A thin yellow horizontal divider 240px wide below the wordmark, slightly off-center. Below the divider in 13pt dim grey letter-spaced uppercase: "FOR THE PEOPLE WHO ACTUALLY PROTECT WALLETS." Bottom-right corner: small Aegis shield logo in white, half-occluded by the haze. Mood: high-end whisky ad meets Apple keynote. References: Blade Runner 2049 production stills, Apple Vision Pro reveal, Dune 2 typography posters. No emojis, no glow effects, no particles other than the natural atmospheric haze. Aspect ratio 1:1, 4096×4096.
```

**Image 2.B · "Quietly, on BSC" (16:9, credibility)**

```
Cinematic dashboard hero, 16:9 landscape. Set in a cavernous dark editorial space, pure black backdrop with depth — distant out-of-focus golden bokeh on the right edge suggesting a city at night. Camera: full-frame, 50mm, dramatic chiaroscuro lighting from a single yellow rim light at upper-left. Four floating glass-morphism stat cards arranged in a single row, each card is 320×420px, semi-transparent #141416 surface with a 1px hairline border that subtly catches the rim light, soft cast shadow underneath, gentle parallax depth between them. Each card contains: tiny uppercase yellow #FACC15 11pt label at top with a small dot indicator ("TOKENS SCANNED" / "GUARDIAN WALLETS" / "UNIQ HOLDERS" / "AI DECISIONS"), then an enormous pure-white 72pt number, then a 13pt dim grey sublabel ("real users only" / "live monitoring" / "on-chain verified" / "logged on-chain"). The cards have a subtle tilt-shift effect — the outer two slightly out of focus. Below the cards, single line of dim grey 16pt letter-spaced: "LIVE ON BSC MAINNET — aegis-protocol.xyz". Top-left in white: small "Aegis Protocol" wordmark. References: Linear product page hero, Vercel Edge product film, Apple Vision Pro stage stills. Aspect ratio 1.91:1.
```

---

### 🗓 Day -1 · Wednesday May 20 — Reveal thread + claim contract ships

**🛠 Build (3 tasks)**

1. **Deploy `AegisCampaignClaim.sol`** — Merkle-distributor with 25 % instant unlock + 75 % linear vesting over 14 days. Contract is ~120 LOC, well-trodden pattern, fork from Uniswap Merkle Distributor + add vesting. Deploy to BSC mainnet. Address goes in next-day's launch thread.
2. **Deploy `AegisPass.sol`** — soulbound ERC-721, owner-only `mint(address to, uint8 tier)` where tier ∈ {1=Bronze, 2=Silver}. Update `TokenGate.getHolderTier()` to read pass first and return that tier if held.
3. **`scripts/snapshot.ts`** + `scripts/draw.ts` — snapshot at draw block reads `balanceOf` for every entrant + computes entries; draw is deterministic from `keccak256(snapshotJSON || blockHash)`. Both committed to repo today.

**📣 Posts**

**12:00 UTC · X — THE BIG REVEAL THREAD (6 posts, not 8)**

**1/6**
```
🛡️ Protector Hunt is live tomorrow.

25,000,000 $UNIQ.
Up to 151 winners.
10 days. Zero engagement-farming. Zero airdrop bots.

Every entry comes from one action that makes BSC safer.

Thread 👇
```
🖼️ *image 3.A*

**2/6 — Window**
```
2/ Window:

Opens Thu May 21 · 12:00 UTC
Closes Sat May 31 · 12:00 UTC
Snapshot taken at one BSC block, announced 24h in advance.

Provably fair draw runs Mon Jun 1 · 16:00 UTC.
Randomness from a BSC block hash that doesn't exist yet.
Draw script open-sourced today: github.com/Tonyflam/aegis-protocol/blob/main/scripts/draw.ts
```

**3/6 — Tiers**
```
3/ Seven stackable tiers:

1. Follow + RT + reply w/ a scan link + tag 2 BSC friends → 1
2. Scan 1-5 unique BSC tokens at aegis-protocol.xyz → 1 each (cap 5)
3. Connect Guardian Shield → 3
4. Link Telegram chat ID → 2
5. Hold 10k $UNIQ → 5
6. Hold 50k $UNIQ (Bronze) → 10
7. Hold 100k $UNIQ (Silver) → 25

+ Referrals: any wallet you bring who finishes 2 of tiers 2-7 = +5 (cap 10).
```
🖼️ *image 3.B*

**4/6 — Open Bounty**
```
4/ Open Bounty (no daily side-game):

Real scams don't ship on a schedule. So we won't fake "threats" on a timer.

Find a real malicious BSC token. Scan it on aegis-protocol.xyz. Quote-tweet your scan link + #AegisCaught + a one-line breakdown.

We hand-verify. Each confirmed catch = 50,000 $UNIQ. Cap: 10 winners.
```

**5/6 — The pool**
```
5/ The pool — 25,000,000 $UNIQ:

🥇 1 winner — 5,000,000 + Founder's Shield + permanent Silver pass NFT
🥈 5 winners — 1,000,000 each + permanent Bronze pass NFT
🥉 25 winners — 200,000 each + OG role + 40 % fee discount 1 year
🎟️ 100 random — 100,000 each
⚔️ up to 10 Open Bounty — 50,000 each
```
🖼️ *image 3.C*

**6/6 — Anti-dump, anti-sybil, claim mechanic**
```
6/ Anti-dump · anti-sybil · how you claim:

🔒 Claim contract deploys today (BSC mainnet, audited Merkle distributor): 0xCLAIM
   → 25% of your prize claimable immediately at draw
   → 75% vests linearly over 14 days
   → you self-custody, no team gatekeeping

🚫 Every entrant gets scanned by our own scanner. Drainer · sanctioned · honeypot-deployer → disqualified. Public list on Day 8.

🛡️ Permanent tier passes ship as soulbound NFTs. No expiry, no cliff.

🎯 Check your live entries: aegis-protocol.xyz/campaign
```
🖼️ *image 3.D*

**13:00 UTC · Telegram (pinned, replaces tease)** — same content, condensed to 6 messages.

**19:00 UTC · X · Final tease**

```
T-minus 17 hours.

Claim contract live: 0xCLAIM (verifiable on bscscan)
Pass NFT live: 0xPASS
Draw block announced tomorrow 12:00 UTC in the launch tweet.

If you've ever used Aegis, you start at 1+ entries.

aegis-protocol.xyz/campaign
```

**🖼 Images**

**Image 3.A · "Protector Hunt is live" (16:9 hero, post 1)**

```
Cinematic hero poster, 1.91:1, IMAX-detail. Pure black void #0A0A0B with deep atmospheric haze and faint warm rim light pouring from upper-right at 30°. Left two-thirds of the frame: enormous text block stacked tight in heavy white geometric sans-serif — "PROTECTOR" / "HUNT" / "is live." — the word "live." rendered in molten gold #FACC15 with subtle anisotropic reflection and a single off-frame light source making the type's right edge glow. Subtle particulate dust in the air catching the light. Right third: a single hand-drawn shield silhouette rendered in thick warm yellow stroke, no fill, with ultra-faint geometric guard pattern radiating outward at 4% opacity. Bottom strip, full-width, 14pt letter-spaced dim grey: "25,000,000 $UNIQ · UP TO 151 WINNERS · 10 DAYS · PROVABLY FAIR · BSC MAINNET". Top-right corner: Aegis wordmark small in matte white. Camera: anamorphic 35mm, slight horizontal lens flare across the gold. References: Dune part two posters, Apple Vision Pro reveal, Foundation season 2 key art. Aspect ratio 1.91:1, 4096×2150.
```

**Image 3.B · "Seven stackable tiers" (1:1 square, post 3)**

```
Editorial infographic poster, 1:1 square, cinematic atmospheric lighting in a pure-black room with soft volumetric haze. Camera: slight 5° tilt-down perspective, mild depth-of-field where lower rows are crisper than upper. A vertical numbered list of 7 floating cards stacked top to bottom, each card is 1100×120 px floating in mid-air with subtle drop shadows and a 1px hairline of brushed gold #FACC15 catching a rim light from upper-right. Each card contains, left-to-right: a circular badge 1-7 (white digit on glowing yellow disk, with faint radial bloom), the row label in pure white 22pt sans ("Follow + RT + reply" / "Scan 1-5 tokens" / "Connect Guardian Shield" / "Link Telegram" / "Hold 10k UNIQ" / "Hold 50k UNIQ" / "Hold 100k UNIQ"), and on the right the entry count in heavy yellow 28pt ("1" / "1-5" / "3" / "2" / "5" / "10" / "25"). Cards are perfectly aligned vertically with 12px gaps. Above them in 13pt letter-spaced dim grey uppercase: "STACK ALL SEVEN → 51 ENTRIES." Below the cards: thin yellow divider then tiny "aegis-protocol.xyz/campaign" in matte white. No emoji, no plastic gloss. References: Linear changelog hero, Stripe Press, Apple HIG. Aspect ratio 1:1, 4096×4096.
```

**Image 3.C · "The 25M pool" (4:5 portrait, post 5)**

```
Cinematic prize-table poster, 4:5 portrait, IMAX detail. Set in an obsidian void with deep atmospheric haze and a single warm gold rim light pouring from upper-left at 20°, casting soft falloff across the canvas. Five stacked horizontal cards, each is a #141416 surface with 1px brushed-gold border that catches the rim light, casting a soft warm shadow on the row below. Each card has: a metallic badge on the far left (gold for grand, silver for top 5, bronze for top 25, neutral for random, red-edged tactical for bounty — rendered as small physical 3D objects with realistic reflections), in the center a huge pure-white 56pt number ("5,000,000" / "1,000,000" / "200,000" / "100,000" / "50,000"), the word "$UNIQ" in dim 14pt grey below, and on the right the winner count in yellow 20pt ("× 1" / "× 5" / "× 25" / "× 100" / "× up to 10"). Above the stack in small uppercase letter-spaced grey 13pt: "THE POOL — 25,000,000 $UNIQ". Below the stack: thin yellow divider then 12pt dim grey "draw verified · block announced in advance · script open-source". Bottom-right: small shield logo in white catching faint rim light. References: Apple Vision Pro pricing layout, Tag Heuer editorial spread, IWC watch print campaign. Aspect ratio 4:5, 4096×5120.
```

**Image 3.D · "Anti-dump, anti-sybil, claim" (16:9, post 6)**

```
Cinematic split-frame, 1.91:1 landscape, IMAX detail, pure black void. Three vertical translucent panels separated by faint gold dividers, each panel reads top-to-bottom: panel 1 has a glowing yellow padlock icon at top (hand-rendered minimalist line art), label "VESTING" in 22pt white below, sublabel "25% INSTANT / 75% 14-DAY LINEAR" in 13pt dim grey; panel 2 has a small radar-sweep graphic in yellow at top, label "ANTI-SYBIL" in 22pt white, sublabel "EVERY ENTRANT SCANNED · DISQUALIFIED LIST PUBLISHED MAY 28" in 13pt dim grey; panel 3 has a hand-drawn shield outline in yellow at top, label "PERMANENT PASS" in 22pt white, sublabel "SOULBOUND ERC-721 · NO EXPIRY" in 13pt dim grey. Each panel is lit by its own subtle off-frame light source for depth. Bottom strip: dim grey 13pt centered "aegis-protocol.xyz/campaign". Mood: serious, engineering-grade, premium. References: Stripe security page hero, Linear product film, Apple Privacy page editorial. Aspect ratio 1.91:1.
```

---

### 🚀 Day 0 · Thursday May 21 — LAUNCH

**🛠 Build (pre-flight only — no new code)**

- [ ] `npm run build` clean, Vercel production green
- [ ] Visit `/campaign` logged-out → countdown gone, "LIVE" state shows
- [ ] Run `node scripts/snapshot.ts day0` → commit `snapshots/day0.json`
- [ ] Confirm Telegram bot `/campaign` returns numbers for a test wallet
- [ ] Treasury wallet funded with ≥ 25.5M $UNIQ (visible on bscscan, tweet it)
- [ ] Claim contract + Pass contract verified on bscscan with sources

**📣 Posts**

**12:00 UTC · X (standalone, NOT a thread reply)**

```
The hunt is live.

25,000,000 $UNIQ. Up to 151 winners. 10 days. Zero engagement-farming.

Check your live entries → aegis-protocol.xyz/campaign

If you've ever scanned a token or held $UNIQ, you already have entries.

Draw block: BSC #[ANNOUNCE BLOCK NUMBER, ~JUN 1 16:00 UTC]
Claim contract: bscscan.com/address/0xCLAIM
Treasury proof: bscscan.com/address/0xTREASURY (25.5M $UNIQ visible)
```
🖼️ *image 0.A*

**12:05 UTC · X (pinned — quote-tweet the reveal thread)**

```
↑ Full rules.
Pinning this for 10 days.
Type /campaign in our Telegram for your live entry count.
```

**12:10 UTC · Telegram (main group)**

```
🟢 LIVE.

aegis-protocol.xyz/campaign

DM @aegis_protocol_bot → /campaign for your live entry count and leaderboard rank.

Open Bounty is open. Find a real one, QT with #AegisCaught. Up to 10 catches × 50k $UNIQ.
```

**19:00 UTC · X — 7-hour pulse**

```
7 hours in.

[N] hunters entered.
[M] tokens scanned today.
[K] Guardian shields activated.

Current top wallet: 0xabcd…wxyz with [E] entries.

aegis-protocol.xyz/campaign — leaderboard updates every 60s.
It's day 1. Plenty of room.
```

**21:00 UTC · X — daily wrap**

```
Day 1 done.

[N] hunters entered.
[M] BSC tokens scanned by Aegis users today.
[K] new Guardian shields.

Open Bounty live the whole window. Find a real one, QT with #AegisCaught.

Day 2 starts in ~12h.
```

**🖼 Images**

**Image 0.A · "The hunt is live" (16:9 launch hero)**

```
Cinematic launch still, 1.91:1 landscape, IMAX hyper-detail. Pure obsidian void with deep volumetric haze and a single anamorphic gold light streak across the upper-third. Center-left: three-line text block stacked tight — "the hunt" in pure-white 110pt thin geometric sans / a tiny floating "is" in 28pt grey on its own line / "live." in molten yellow #FACC15 160pt heavy sans with subtle metallic micro-reflection and a faint warm bloom into the haze. To the immediate right of "live." a single pulsing solid yellow disk 16px with a subtle radial glow suggesting heartbeat. Bottom-left: small URL "aegis-protocol.xyz/campaign" in matte white 16pt. Bottom-right: Aegis shield small in white catching faint rim light. Mood: declarative, calm, irreversibly underway. References: Dune part two key art, Apple Vision Pro launch stills, Foundation s2 finale poster. Aspect ratio 1.91:1, 4096×2150.
```

---

### 🗓 Day 1 · Friday May 22 — "Why Guardian Shield"

**🛠 Build:** none (campaign runs itself today).

**📣 Posts**

**09:00 UTC · X**

```
24 hours ago, a wallet held 4 BNB worth of $XYZ.
That token's contract was upgraded mid-trade and lost 41% in 6 hours.

If they had Guardian Shield on, they'd have gotten a Telegram ping the moment the upgrade hit. Most don't.

Free. 3 entries to Protector Hunt.
aegis-protocol.xyz/guardian
```
🖼️ *image 1.A — see below*

**14:00 / 19:00 / 21:00** — leaderboard pulse template (see end of §2).

**🖼 Image 1.A · "Guardian alert ping"**

```
Cinematic dark device mockup, 4:5 portrait, IMAX hyper-detail. A single iPhone-style device floating in obsidian black at a 15° tilt, screen-on, showing a Telegram chat interface with one alert bubble visible. The bubble is from "@aegis_protocol_bot" and reads in pure white 14pt: "⚠️ ALERT — Token in your wallet just had its contract upgraded. Risk score jumped 23→81. Suggested: exit position." Below the bubble, a small yellow timestamp "07:42 UTC". The device is lit by warm gold rim light from upper-right and cool blue fill from lower-left, screen glow softly illuminating a thin atmospheric haze around it. Around the device, in the void, faint floating ticker text in mono dim grey showing partial token addresses and decreasing price percentages, slightly out of focus. Bottom strip: dim grey 14pt "Guardian Shield — free. Live. aegis-protocol.xyz/guardian". Top-left tiny Aegis logo. References: Apple iPhone launch stills, Bloomberg Terminal cinematic, Severance show stills. Aspect ratio 4:5.
```

---

### 🗓 Day 2 · Saturday May 23 — "Why $UNIQ tiers matter"

**📣 09:00 UTC · X**

```
Best leverage in Protector Hunt isn't activity. It's the multiplier.

10k $UNIQ → 5 entries
50k $UNIQ (Bronze pass) → 10 entries + AI Gold scans + fee discount
100k $UNIQ (Silver pass) → 25 entries + Telegram priority alerts + 40% fee discount

Snapshot is one block, announced 24h ahead. Weekend's a good time to compound.
aegis-protocol.xyz/campaign
```
🖼️ *image 2.C below*

**🖼 Image 2.C · "Tier ladder"**

```
Editorial 3-step ladder visualization, 1:1 square, IMAX detail. Pure black void with warm gold rim light from upper-right. Three floating physical tiers rendered as thick glass-and-metal plinths receding into shallow depth — bronze on the left (lowest, copper-warm material), silver in the middle (cool brushed material, slightly taller), gold on the right (tallest, warm molten material catching the most light). Each plinth has its label floating above in 18pt white sans ("10K" / "50K · BRONZE PASS" / "100K · SILVER PASS") and entry-count number on the plinth face in molten yellow 36pt ("5" / "10" / "25"). Subtle atmospheric haze around the bases. References: Olympic medal photography, IWC editorial campaign, F1 podium stills. Aspect ratio 1:1.
```

---

### 🗓 Day 3 · Sunday May 24 — "Hunter spotlight"

**📣 09:00 UTC · X (pull from leaderboard at 08:55 UTC)**

```
Hunter Spotlight: 0xab…cd

✓ 4 unique tokens scanned (one had risk score 87)
✓ Guardian Shield on 12 holdings
✓ 51,000 $UNIQ held (Bronze pass)
✓ Currently 19 entries · #4 on leaderboard

This is exactly who we built this for.
aegis-protocol.xyz/campaign
```

**Image:** generated from a real wallet card screenshot — no fresh prompt needed.

---

### 🗓 Day 4 · Monday May 25 — Halfway pulse + claim contract reminder

**🛠 Build:** quick smoke-test of `AegisCampaignClaim.sol` on testnet with 3 test wallets (catch any vesting math bugs while there's still time).

**📣 09:00 UTC · X**

```
Halfway pulse:

📊 [X] hunters entered
🔍 [Y] tokens scanned during campaign (vs baseline +[Δ])
🛡️ [Z] new Guardian wallets
💎 [W] new $UNIQ holders
🪙 [V] BNB net new in vault

Five days left. Top 6 spots are still moving every hour.
aegis-protocol.xyz/campaign
```
🖼️ *image 4.A*

**21:00 UTC · X (quote-tweet your launch thread)**

```
Reminder: every prize ships through our open-source Merkle claim contract.
25% claimable instantly at draw. 75% vests linearly over 14 days.
No team gatekeeping. No "deposit into a vault you don't control."
0xCLAIM — verified on bscscan.
```

**🖼 Image 4.A · "Halfway pulse"**

```
Cinematic statistical poster, 1:1 square, IMAX detail. Pure black void with deep atmospheric haze and warm gold rim light from upper-left. A 2×2 grid of four floating glass-morphism cards, each card #141416 surface with 1px brushed-gold hairline, soft drop shadow, gentle parallax depth between them. Each card contains: a large arrow-up icon in molten yellow #FACC15 36pt in top-left, a small uppercase 12pt grey letter-spaced label below the arrow ("SCANS" / "GUARDIAN WALLETS" / "UNIQ HOLDERS" / "BNB IN VAULT"), and an enormous pure-white 72pt delta number at bottom ("+1,247" / "+312" / "+486" / "+38"). Below the grid in centered 16pt dim grey letter-spaced: "HALFWAY PULSE — DAY 5 OF 10". Top-left small Aegis wordmark white. References: Linear product page hero, Vercel analytics film stills, Apple keynote slide. Aspect ratio 1:1.
```

---

### 🗓 Day 5 · Tuesday May 26 — "The claim mechanic explained"

**🛠 Build:** ship `AegisCampaignClaim.sol` to **mainnet**. Verify source. Tweet address.

**📣 09:00 UTC · X**

```
How prizes ship (mechanically):

1. Mon Jun 1 16:00 UTC — we run scripts/draw.ts live
2. winners.json + Merkle root → committed to repo
3. Each winner gets a personalized claim URL: aegis-protocol.xyz/campaign/claim?w=…
4. Sign once → 25% lands in your wallet immediately
5. 75% unlocks linearly over 14 days through 0xCLAIM

You self-custody the whole way. No team key, no admin pause.
```

**21:00 UTC · X**

```
Claim contract live on mainnet:
bscscan.com/address/0xCLAIM

Source verified. 119 lines. Standard Merkle distributor + linear vesting.
Audited internally. We're a 1-dev team — you should diff it before draw day.
```

---

### 🗓 Day 6 · Wednesday May 27 — "Threats we caught this week"

**📣 09:00 UTC · X**

```
The 5 worst tokens Aegis Scanner caught this week:

1. $XXX — risk 94 · honeypot pattern matched
2. $YYY — risk 91 · LP rugged 6h after launch
3. $ZZZ — risk 88 · ownership renounced to dead address but proxy upgradeable
4. $AAA — risk 87 · 41% supply in one wallet
5. $BBB — risk 85 · contract upgraded mid-trade

Scan before you ape.
aegis-protocol.xyz
```
🖼️ *image 6.A*

**🖼 Image 6.A · "Caught threats" (4:5)**

```
Cinematic dark leaderboard, 4:5 portrait, IMAX detail. Pure black void with subtle blood-red rim light from upper-right at 15° (very subdued, not horror — surgical). Centered title at top in small uppercase letter-spaced yellow 14pt: "FIVE WORST TOKENS AEGIS CAUGHT THIS WEEK". Below, five thin horizontal cards stacked, each is #141416 with a 1px gold hairline that catches the rim light. Each card row, left-to-right: a metallic rank badge 1-5 in yellow, the token symbol in pure white 26pt ($XXX, $YYY, …), one-line dim-grey reason in 13pt directly below the symbol ("honeypot pattern matched", etc.), and on the right a large red 22pt risk score "94/100" with a small red warning triangle icon. The triangles have a faint red glow into the surrounding haze. Bottom strip: dim grey 14pt "scan before you ape — aegis-protocol.xyz". References: Bloomberg Terminal cinematic, Severance corporate UI, Mr. Robot interface stills. Aspect ratio 4:5.
```

---

### 🗓 Day 7 · Thursday May 28 — "Disqualified" (the brutal-honesty post)

**🛠 Build:** export current disqualified set to `public/campaign/disqualified-may28.json` and link.

**📣 09:00 UTC · X**

```
Public housekeeping.

The following [N] wallets are disqualified from Protector Hunt:

[wallet 1] — drainer history
[wallet 2] — honeypot deployer
[wallet 3] — sub-24h funded + dumped 80%
[wallet 4] — sybil cluster
[…]

We scan our entrants with our own scanner. We built this to filter exactly this.
Real users only. Full list: aegis-protocol.xyz/campaign/disqualified
```
🖼️ *image 7.A*

**🖼 Image 7.A · "Disqualified list"**

```
Cinematic brutal-honesty editorial poster, 1.91:1 landscape, IMAX detail. Pure black void with subtle cold-grey atmospheric haze, no warm tones. Centered title in small uppercase letter-spaced yellow 14pt: "DISQUALIFIED — [N] WALLETS". Below, vertical list of 6-8 wallet rows. Each row: monospace wallet address truncated middle ("0xabcd…wxyz") in 18pt cool-grey white, on the right a small uppercase red 12pt tag in a thin red-bordered pill ("DRAINER HISTORY" / "HONEYPOT DEPLOYER" / "SUB-24H DUMP" / "SYBIL CLUSTER" / "SANCTIONED"). Rows separated by 1px hairline #2A2A2D. Subtle red rim glow on the tags but no other warmth. Bottom dim grey 13pt italic: "we scan our entrants with our own scanner. that's the standard." Top-right small shield logo. References: declassified document aesthetic, Severance corporate notice, brutalist editorial. Aspect ratio 1.91:1.
```

---

### 🗓 Day 8 · Friday May 29 — "Last weekend, snapshot countdown"

**📣 09:00 UTC · X**

```
Snapshot block is in 48h.

If you want the 5× / 10× / 25× multiplier on your $UNIQ, hold through the snapshot block (announced 12h ahead, on May 30 21:00 UTC).

We read balanceOf at one block. Single-block snapshot. No "continuously held for 10 days" gotcha — but also no flash-buy at minute -1.

aegis-protocol.xyz/campaign
```

---

### 🗓 Day 9 · Saturday May 30 — "Final 24h — leaderboard ticks every 3h"

**🛠 Build:** at **21:00 UTC sharp**, post the snapshot block number (use `getBlockNumber()` + ~10800 = expected block at May 31 12:00 UTC).

**📣 Post the leaderboard every 3 hours starting 15:00 UTC.**

**Template:**
```
[H] hours left.

🥇 0xa…x · [E] entries
🥈 0xb…y · [E] entries
🥉 0xc…z · [E] entries
[next 3 wallets]

Top 6 wins ≥ 1,000,000 $UNIQ each. Two are within reach if you act in the next [H] hours.
aegis-protocol.xyz/campaign
```

**21:00 UTC · X & Telegram pinned**

```
Snapshot block: BSC #[X]
Expected timestamp: May 31 · 12:00 UTC ± 30s

Holdings checked at that block.
You can verify by querying bscscan at that block height.

Final hours.
```

---

### 🏁 Day 10 · Saturday May 31 — Snapshot closes

**🛠 Build**

- [ ] At expected block — run `node scripts/snapshot.ts final --block <X>` → commits `snapshots/final.json`
- [ ] Run final disqualification pass
- [ ] Compute Merkle root → commit
- [ ] Push to GitHub

**📣 12:00 UTC · X**

```
Snapshot taken at BSC #[X].

[N] eligible wallets · [E] total entries · top 6 within [Δ] entries of each other.

Provably fair draw runs Mon Jun 1 · 16:00 UTC.
Block #[ANNOUNCE] provides randomness.
Draw script: github.com/Tonyflam/aegis-protocol/blob/main/scripts/draw.ts
Snapshot: github.com/Tonyflam/aegis-protocol/blob/main/snapshots/final.json
Merkle root: 0xMERKLE

48 hours.
```
🖼️ *image 10.A*

**🖼 Image 10.A · "Snapshot locked"**

```
Cinematic still, 16:9 landscape, IMAX detail. Pure obsidian black void with quiet atmospheric haze and a single warm gold key light from upper-center revealing dust particles in the air. Centered single line in pure-white heavy geometric sans 96pt: "snapshot taken." Below in 20pt dim grey letter-spaced: "[N] eligible wallets · [E] total entries · top 6 within [Δ] entries". A thin gold horizontal divider 280px below. Below the divider in 14pt letter-spaced uppercase yellow: "DRAW · MON JUN 1 · 16:00 UTC · BLOCK #[X]". Bottom corners: tiny shield logo lower-left, "aegis-protocol.xyz/campaign" lower-right in 12pt dim grey. Mood: locked, irreversible, premium. References: Dune part two ending stills, Foundation s2 finale poster. Aspect ratio 1.91:1.
```

---

### 🏆 Draw Day · Monday June 1 — 16:00 UTC

**🛠 Build**

1. Wait for BSC block `#[ANNOUNCED]` finalized → confirm hash on bscscan
2. **Record screen.** Run `ts-node scripts/draw.ts --snapshot snapshots/final.json --block <X>`
3. Commit `winners.json` + Merkle proof per winner
4. Update claim contract Merkle root via owner tx (one-time)
5. Personal Telegram DMs go out (bot iterates winners.json)

**📣 16:00 UTC · X — live thread (8 posts, condensed from 10)**

**1/8**
```
🛡️ The Protector Hunt draw is live.

Block #[X] finalized. Hash: 0x[FULL].
Running scripts/draw.ts now — screen recording linked in final post.

Winners 🧵👇
```

**2/8 — Grand**
```
🥇 GRAND PRIZE — 5,000,000 $UNIQ + Founder's Shield + permanent Silver pass

Winner: 0x[ADDRESS]
Entries: [E]
Verify: [bscscan link to balance]

Welcome to the founders' table.
```

**3/8 — Top 6**
```
🥈 TOP 6 — 1,000,000 $UNIQ each + permanent Bronze pass

2. 0x[ADDR]
3. 0x[ADDR]
4. 0x[ADDR]
5. 0x[ADDR]
6. 0x[ADDR]
```

**4/8 — Top 31**
```
🥉 PLACES 7-31 — 200,000 $UNIQ each + OG role + 40% fee discount for 1 year

[25 wallets]
```

**5/8 + 6/8 — Random 100 (50 + 50)**
```
🎟️ RANDOM 1-50 — 100,000 $UNIQ each
[50 wallets]
```
```
🎟️ RANDOM 51-100 — 100,000 $UNIQ each
[50 wallets]
```

**7/8 — Open Bounty + disqualified**
```
⚔️ OPEN BOUNTY WINNERS — 50,000 $UNIQ each

[up to 10 wallets, each linked to the catch QT]

🚫 [N] disqualified — list: aegis-protocol.xyz/campaign/disqualified
```

**8/8 — Claim + wrap**
```
🪙 Claim is live: aegis-protocol.xyz/campaign/claim?w=<your wallet>

25% drops to your wallet on first signature.
75% vests linearly over 14 days through 0xCLAIM.
7-day claim window.

Final numbers vs Day 0:
• [X] new scans · [Y] Guardian wallets · [Z] holders · [W] BNB into vault · [V] new TG members

This was the warm-up.
Stay sharp.
```
🖼️ *image D.A*

**🖼 Image D.A · "Up to 151 winners"**

```
Cinematic winners poster, 1.91:1, IMAX hyper-detail. Pure obsidian void with warm rim light from below the horizon, like sunrise just outside the frame, casting soft gold glow up into the haze. Top centered in small uppercase yellow letter-spaced 14pt: "PROTECTOR HUNT · WINNERS". Below in 140pt pure-white heavy geometric sans: "151." Below in 22pt dim grey: "real users · real scans · real protected wallets". A thin yellow horizontal divider 280px below. Below the divider in 14pt letter-spaced grey: "draw verified · block #[X] · script open-source · contract self-custody". Bottom-left tiny shield logo. Bottom-right: "aegis-protocol.xyz/campaign/winners" in 12pt dim grey. References: Dune part two final stills, Apple Vision Pro launch, Foundation finale. Aspect ratio 1.91:1.
```

---

## 3 · Repeatable templates

### 3.1 Daily wrap (every 21:00 UTC, Day 1-9)

```
Day [N] of 10 done.

✓ [X] new scans today
✓ [Y] new Guardian wallets
✓ [Z] new TG members
✓ [W] new holders

Leaderboard top 3:
🥇 0x…x · [E]
🥈 0x…y · [E]
🥉 0x…z · [E]

aegis-protocol.xyz/campaign
```

### 3.2 Telegram cadence (4-6 messages/day, rotate)

- *gm hunters · [N] entries already in today*
- *current top 3: [list] · gap to #1 is only [X] entries*
- *quick reminder: holding 50k $UNIQ at snapshot = 10 entries. that's not nothing.*
- *just disqualified 3 wallets for sybil — see today's X*
- *leaderboard moved hard in the last hour. /campaign in the bot for your number.*
- *vault TVL update: [X] BNB. you can deposit BNB for Venus yield — separate from the campaign.*

---

## 4 · Resources you need on hand

### Tools
- X account with scheduled posts (TweetDeck or Buffer/Typefully free tier)
- Imagen 4 / Nano Banana via Gemini app — prompts above are tuned for it
- Screen recorder (OBS / QuickTime) for the live draw on Jun 1
- Telegram bot already wired
- Redis already configured
- Vercel CLI

### URLs to lock in advance
- `aegis-protocol.xyz/campaign` — hub
- `aegis-protocol.xyz/campaign/claim?w=…` — winner claim
- `aegis-protocol.xyz/campaign/winners` — public ledger
- `aegis-protocol.xyz/campaign/disqualified` — public sybil ledger
- `github.com/Tonyflam/aegis-protocol/blob/main/scripts/draw.ts`
- `bscscan.com/address/0xCLAIM` — claim contract (set Day -1)
- `bscscan.com/address/0xPASS` — soulbound pass contract (set Day -1)
- `bscscan.com/address/0xTREASURY` — funded with 25.5M $UNIQ (set Day 0)

### Local artifacts to commit
- `snapshots/day0.json` (May 21)
- `snapshots/day5.json` (May 25)
- `snapshots/final.json` (May 31)
- `winners.json` (Jun 1)

### Pre-pick on Day -1 (block out 30 min)
- 3-5 candidate BSC tokens you suspect will get reported during the campaign (so you can fast-verify the first Open Bounty submissions)
- The BSC block number that will provide draw randomness (~Jun 1 16:00 UTC, ≈ current block + 430,000) — announce in launch thread
- Founder's Shield NFT artwork (or commit "art TBD, mints by Jun 8")

### Security pre-flight
- Treasury has ≥ 25,500,000 $UNIQ (25M prizes + 500k buffer for gas/edge)
- Treasury multi-sig'd before campaign opens
- `scripts/distribute-winners.ts` runs dry-run by default; live run only after draw
- Rate-limit `/api/campaign/leaderboard` to prevent scraping

---

## 5 · Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sybil farm of 50 wallets each hits social tier | High | Medium | Anti-sybil scanner + manual top-50 vet · social tier is only 1 entry, so 50 sybils = 50 entries (≈ 2 Silver holders) |
| $UNIQ price pumps then dumps during campaign | Medium | Medium | Merkle claim contract enforces 75% / 14-day vesting · communicated loudly · onchain-enforced, not vibes |
| Vercel cron miss → stale leaderboard | Low | Medium | `/api/campaign/entries` is computed-on-read · 60s cache · degrades gracefully |
| AI agent dies mid-campaign | Medium | High (trust-killing) | Heartbeat already on `/api/vault` · if red, communicate immediately, never hide |
| Draw block reorgs | Very low | High | Wait > 60 confirmations · BSC has never reorg'd deeper than ~15 blocks |
| Winner doesn't claim within 7 days | Medium | Low | Unclaimed rolls to a "second chance" pool announced Jun 8 |
| RPC outage during snapshot | Low | High | `scripts/snapshot.ts` uses 3-RPC fallback (bsc-dataseed1, bsc-dataseed2, ankr) |
| Someone calls it a scam on X | Medium | Low | Claim contract is open + self-custody · draw script open-source · ignore noise, let math reply |
| Claim contract bug | Low | Catastrophic | Diff against Uniswap Merkle distributor · testnet smoke-test on Day 4 · internal review before Day 5 mainnet ship |
| Founder's Shield art isn't ready by Jun 1 | Medium | Low | Commit "art ships by Jun 8" in the launch thread — placeholder PFP given immediately |

---

## 6 · Post-campaign (Jun 2 onwards)

| Day | Action |
|---|---|
| Jun 2 | DM 5 winners — ask for one-line testimonial each, save for season 2 |
| Jun 3 | Retrospective thread on X — what worked, what didn't, what's next |
| Jun 4 | Blog/Mirror post version of the retrospective |
| Jun 5-7 | Buffer week. Do not launch anything. Let the wins compound. |
| Jun 8 | Announce Phase 2 — either a feature drop or Protector Hunt season 2 |
| Jun 15 | Final vesting payout completes (14 days from claim) — celebratory wrap tweet |

---

## 7 · The one rule

Every post we ship during this campaign must pass two checks:

1. **Would a security professional respect this?** (no shilling, no engagement-bait, no fake hype)
2. **Does the action it asks for make BSC safer for someone?** (scan, monitor, hold, learn)

If yes to both → post. If no to either → rewrite or kill.

That's the campaign.
