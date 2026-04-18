# BNB Chain Launch Plan — Aegis Protocol

> Your complete action plan from Walter's BD call to mainnet launch on April 28, 2026.
> Everything in one place. Follow it step by step.

---

## Table of Contents

1. [Walter's Q1-Q12 — Ready-to-Send Answers](#1-walters-q1-q12--ready-to-send-answers)
2. [Day-by-Day Timeline (April 17-28)](#2-day-by-day-timeline-april-17-28)
3. [Audit Strategy (Fast + Cheap)](#3-audit-strategy-fast--cheap)
4. [Dappbay Listing Walkthrough](#4-dappbay-listing-walkthrough)
5. [The Launch Tweet (Draft)](#5-the-launch-tweet-draft)
6. [Binance Wallet SDK Integration](#6-binance-wallet-sdk-integration)
7. [YZi Labs / MVB Application](#7-yzi-labs--mvb-application)
8. [BNB Chain Welcome Post Strategy](#8-bnb-chain-welcome-post-strategy)
9. [Binance Alpha — Long-term Play](#9-binance-alpha--long-term-play)
10. [Critical Blockers Before April 28](#10-critical-blockers-before-april-28)

---

## 1. Walter's Q1-Q12 — Ready-to-Send Answers

Copy-paste these answers and send to Walter. Items marked **[ACTION NEEDED]** require you to fill in or confirm before sending.

---

### Q1. Draft tweet info and link

> See [Section 5](#5-the-launch-tweet-draft) for the full draft. Share the draft with Walter for review before posting.

---

### Q2. Dappbay profile link

> **[ACTION NEEDED]** You need to register first at https://dappbay.bnbchain.org/submit-dapp
> After submission, your profile will be at: `https://dappbay.bnbchain.org/detail/aegis-protocol` (or similar)
> Share the link with Walter once submitted. See [Section 4](#4-dappbay-listing-walkthrough) for step-by-step.

---

### Q3. What are the transactions shown on Dappbay (on-chain payments? etc)

**Answer to send Walter:**

> The transactions on Dappbay will include:
> - **Vault deposits/withdrawals** — Users deposit BNB into the Aegis Vault smart contract to earn Venus Protocol yield with AI protection
> - **Venus Protocol interactions** — The vault auto-deploys 80% of deposits to Venus lending (supply/redeem BNB)
> - **Stop-loss executions** — Automated BNB→USDT swaps via PancakeSwap V2 when AI detects risk
> - **Agent registrations** — AI agents register as ERC-721 NFTs via AegisRegistry
> - **On-chain decision logging** — Every AI decision is immutably logged via DecisionLogger contract
> - **Token scanner writes** — Risk scores for scanned tokens stored on-chain via AegisScanner
>
> Primary revenue-generating transaction: Vault deposits (0.5% protocol fee) + yield harvesting (15% performance fee on Venus yield)

---

### Q4. Project's X link

> https://x.com/uniq_minds

---

### Q5. Project's Website

> https://aegisguardian.xyz

---

### Q6. Github Core Repo link

> https://github.com/Tonyflam/aegis-protocol

**[ACTION NEEDED]** Make sure the repo is **public** before sending to Walter. Currently on branch `aegis-security-os` — merge to `main` first.

---

### Q7. Audit Report / Bug Bounty / Public Security doc links

> **[ACTION NEEDED]** — This is your biggest gap right now. Options:
>
> **Immediate (before April 28):**
> - Get a fast audit from one of the firms in [Section 3](#3-audit-strategy-fast--cheap)
> - Set up a bug bounty on Immunefi (free to create, you set the rewards)
>
> **What to tell Walter now:**
> "We are currently in the process of engaging an audit firm (targeting QuillAudits or Hashdit). We have 207 passing tests including mainnet hardening tests (operator timelock, Venus slippage validation, stop-loss cooldowns). We plan to launch a bug bounty on Immunefi alongside mainnet launch. Audit report will be shared as soon as available."

---

### Q8. TGE details

**Answer to send Walter:**

> **Yes, the project has TGE'd.**
> - **Token:** $UNIQ
> - **Contract:** `0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777`
> - **Chain:** BNB Smart Chain (BSC Mainnet)
> - **Supply:** 1,000,000,000 (1B)
> - **Tax:** 3%
> - **Ownership:** Renounced
> - **LP:** Locked
> - **Utility:** On-chain fee discounts (10-40%), tier-gated features (Bronze/Silver/Gold), Telegram alerts, agent registration
> - **Links:** [BSCScan](https://bscscan.com/token/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777) · [flap.sh](https://flap.sh/bnb/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777)

---

### Q9. Date of main smart contract deployment on BNB Chain

**Answer to send Walter:**

> - **$UNIQ Token:** Already live on BSC Mainnet (`0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777`)
> - **Protocol contracts (Vault, Registry, Scanner, etc.):** Currently on BSC Testnet (deployed April 9, 2026). Mainnet deployment targeted for **April 27-28, 2026.**

---

### Q10. Target date for launch post and BNB Chain's welcome X post

**Answer to send Walter:**

> - **Smart contract mainnet deployment:** April 27, 2026
> - **Launch post on X:** April 28, 2026
> - **Preferred BNB Chain welcome post:** April 28-30, 2026 (ideally same week as our launch tweet)
>
> **[ACTION NEEDED]** Confirm with Walter if this timeline works for the welcome post inclusion.

---

### Q11. Team background information

**[ACTION NEEDED]** — You need to provide this. Template:

> **Founder: [Your Name]**
> - Role: Founder & Lead Developer
> - Background: [Your education, experience — even if it's self-taught, list your skills]
> - LinkedIn: [Your LinkedIn URL]
> - Notable: Won Top 10 (6th/200 teams) at Good Vibes Only: OpenClaw Edition hackathon on BNB Chain
> - Built entire protocol solo: 7 smart contracts (2,660 LOC), AI agent engine (3,473 LOC), Next.js frontend, Telegram bot
>
> **[If you have any team members, list them here with their LinkedIn profiles]**

---

### Q12. Details of raise if any, who are the investors

**Answer to send Walter:**

> No external raise to date. The project is fully bootstrapped/self-funded. We are applying to the YZi Labs / BNB Chain MVB program and are open to discussing strategic investment opportunities.
>
> **Referral:** Walter from BNB Chain BD (per his invitation to use his name as referral)

---

## 2. Day-by-Day Timeline (April 17-28)

### April 17 (TODAY)
- [ ] **Send Walter Q1-Q12 answers** (fill in [ACTION NEEDED] items first)
- [ ] **Submit to Dappbay** — https://dappbay.bnbchain.org/submit-dapp (takes 3-7 business days to review)
- [ ] **Request audit quotes** — Email QuillAudits, Hashdit, and SlowMist TODAY (see Section 3)
- [ ] **Create Immunefi bug bounty listing** — https://immunefi.com/ (free to set up)
- [ ] **Make GitHub repo public** (or confirm it's public)

### April 18-19
- [ ] **Choose audit firm** based on who responds fastest with best price
- [ ] **Start Binance Wallet SDK integration** (see Section 6)
- [ ] **Prepare YZi Labs application** (see Section 7)
- [ ] **Begin daily X posting** — build activity before launch tweet

### April 20-22
- [ ] **Audit in progress** (fast-track with chosen firm)
- [ ] **Complete Binance Wallet SDK integration + self-testing**
- [ ] **Submit YZi Labs / MVB application**
- [ ] **Deploy contracts to mainnet staging** (test with small amounts)

### April 23-25
- [ ] **Receive audit report** (or preliminary findings)
- [ ] **Fix any critical findings from audit**
- [ ] **Submit Binance Wallet self-listing application**
- [ ] **Finalize launch tweet** — share draft with Walter for approval
- [ ] **Update aegisguardian.xyz** — ensure mainnet is default, testnet banner removed

### April 26-27
- [ ] **Deploy all contracts to BSC Mainnet** — `npx hardhat run scripts/deploy-mainnet.ts --network bscMainnet`
- [ ] **Update Vercel env vars** with mainnet contract addresses
- [ ] **Update Dappbay** with mainnet contract addresses
- [ ] **Final smoke test** — deposit, withdraw, scan, guardian — all on mainnet
- [ ] **Set up agent on production server** (VPS with pm2 or similar)

### April 28 — LAUNCH DAY
- [ ] **Post launch tweet** (mentioning @BNBCHAIN) — see Section 5
- [ ] **DM Walter**: "Launch tweet is live, Dappbay profile updated with mainnet contracts. Here's the tweet link: [link]"
- [ ] **Share tweet in all communities** — Telegram, Discord, Reddit
- [ ] **Monitor everything** — vault, agent, website uptime

### April 29-30
- [ ] **Engage with BNB Chain welcome post** when/if it goes live
- [ ] **Retweet and amplify** the welcome post
- [ ] **Push follow-up content** riding the welcome post momentum

---

## 3. Audit Strategy (Fast + Cheap)

Walter said the funds from YZi Labs can't come in time for April 28. Here are your realistic options ranked by speed and cost:

### Option A: AI-Assisted Audit (Cheapest + Fastest) — $0-500

| Tool | Cost | Speed | Credibility |
|------|------|-------|-------------|
| **Aderyn (Cyfrin)** | Free | Instant | Low (automated only) |
| **Slither** | Free | Instant | Low (automated only) |
| **QuillShield AI** | Free/Low | Same day | Medium (AI + automated) |

**What to do:** Run all three tools, publish the reports on GitHub, and tell Walter:
> "We have automated security scans from Slither, Aderyn, and QuillShield. Full manual audit engagement is in progress with [firm]. Bug bounty live on Immunefi."

This is the minimum viable security story for launch.

### Option B: Budget Manual Audit — $2,000-5,000

| Firm | Est. Cost | Turnaround | Contact |
|------|-----------|------------|---------|
| **QuillAudits** | $3,000-6,000 | 5-7 days (fast-track) | https://www.quillaudits.com/smart-contract-audit — Request a Quote |
| **SlowMist** | $3,000-8,000 | 5-10 days | https://www.slowmist.com/ — DM on X @SlowMist_Team |
| **Hashdit** (BNB Chain native) | $2,000-5,000 | 3-7 days | https://www.hashdit.io/ — contact via their site |
| **Verichains** | $2,000-5,000 | 5-7 days | Listed on BNB Chain dev tools page |
| **SolidProof** | $1,500-4,000 | 3-5 days | https://solidproof.io/ |
| **InterFi** | $1,000-3,000 | 2-5 days | https://www.interfi.network/ |

**Best bet for your timeline:** Contact **all of them TODAY** with this message:

> Subject: Fast-Track Audit Request — Aegis Protocol (BNB Chain, launching April 28)
>
> Hi team,
>
> We're Aegis Protocol, a BNB Chain hackathon winner (Top 10, Good Vibes Only: OpenClaw Edition). We're launching on mainnet April 28 and need a fast-track audit.
>
> Scope: 5 Solidity contracts (~2,660 LOC total), main contract is AegisVault.sol (1,164 LOC) — a DeFi vault with Venus Protocol yield + PancakeSwap stop-loss.
>
> We already have 207 passing tests including mainnet hardening tests. GitHub: https://github.com/Tonyflam/aegis-protocol
>
> Can you provide a quote and earliest possible delivery? We're happy to pay for expedited review.
>
> Thank you,
> [Your Name]
> Founder, Aegis Protocol / Uniq Minds
> X: @uniq_minds

### Option C: Competitive Audit Platform — $1,000-3,000

| Platform | Model | Speed | How it works |
|----------|-------|-------|-------------|
| **Code4rena** | Contest | 3-7 days | Multiple auditors compete to find bugs |
| **Sherlock** | Contest | 5-7 days | Similar to Code4rena |
| **Hats Finance** | Bug bounty style | Ongoing | Pay per bug found |

### Recommended Approach (What I'd Do):

1. **TODAY:** Run Slither + Aderyn automated scans (free, instant)
2. **TODAY:** Email QuillAudits, Hashdit, and InterFi for fast-track quotes
3. **TODAY:** Create Immunefi bug bounty listing
4. **Pick the fastest responder** and get audit started by April 19
5. **Even if audit isn't done by April 28**, you can launch with: automated scan reports + bug bounty + "manual audit in progress"

### Running Slither (Free, Do It Now):

```bash
# In the project root
pip3 install slither-analyzer
slither contracts/AegisVault.sol --hardhat-ignore-compile
slither contracts/AegisRegistry.sol --hardhat-ignore-compile
# Save output as slither-report.txt and publish to GitHub
```

### Running Aderyn (Free, Do It Now):

```bash
# Install
curl -L https://raw.githubusercontent.com/Cyfrin/aderyn/dev/cyfrinup/install | bash
cyfrinup
# Run
aderyn .
# Produces report.md automatically
```

---

## 4. Dappbay Listing Walkthrough

### Step 1: Go to https://dappbay.bnbchain.org/submit-dapp

### Step 2: Fill in the form with this info:

| Field | Value |
|-------|-------|
| **Project Name** | Aegis Protocol |
| **Category** | DeFi (or "AI" if available) |
| **Short Description** | AI-powered DeFi guardian — autonomous vault with Venus yield, stop-loss protection, token scanning, and 24/7 wallet monitoring on BNB Chain |
| **Website** | https://aegisguardian.xyz |
| **Logo** | Upload your Aegis logo (SVG or PNG, square) |
| **X/Twitter** | https://x.com/uniq_minds |
| **GitHub** | https://github.com/Tonyflam/aegis-protocol |

### Step 3: Add Smart Contract Addresses

**For testnet (submit now, update to mainnet after April 27):**

| Contract | Address | Network |
|----------|---------|---------|
| AegisVault | `0xfa80515136Fc8CB2db3b25C317A1c9a04bcD3536` | BSC Testnet |
| AegisRegistry | `0x806677bAb187157Ba567820e857e321c92E6C1EF` | BSC Testnet |
| DecisionLogger | `0x978308DF80FE3AEDf228D58c3625db49e50FE51B` | BSC Testnet |
| AegisScanner | `0x8fa659D8edeffF0bBdEC37cB2c16C2f85491C840` | BSC Testnet |
| AegisTokenGate | `0x0F998bb1B3866B73CAaBc54B7A84156b8F9f7543` | BSC Testnet |
| $UNIQ Token | `0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777` | **BSC Mainnet** |

### Step 4: Submit and wait 3-7 business days

### Step 5: Check status at https://dappbay.bnbchain.org/my-projects

### Step 6: After mainnet deployment (April 27), update ALL addresses to mainnet versions

**IMPORTANT:** Walter said the BNB Chain team tracks **Daily Active Unique Users** and **Transactions** on Dappbay. Keep your Dappbay profile updated — this is how they decide whether to give you more marketing support.

---

## 5. The Launch Tweet (Draft)

### Main Launch Tweet (Thread Starter)

```
🛡️ Aegis Protocol is LIVE on @BNBCHAIN 🔶

The first AI-powered DeFi guardian on BNB Chain.

✅ Deposit BNB → earn Venus Protocol yield
✅ AI agent monitors your position 24/7
✅ Automated stop-loss via PancakeSwap
✅ Scan any token for rug pulls instantly
✅ Every AI decision logged on-chain

Built for safety. Powered by intelligence.

🔗 aegisguardian.xyz
```

### Thread Reply 1:

```
How it works:

1️⃣ Deposit BNB into the Aegis Vault
2️⃣ 80% auto-deployed to Venus Protocol for yield
3️⃣ AI agent analyzes risk every 30 seconds
4️⃣ If danger detected → auto-swaps to USDT via PancakeSwap
5️⃣ Your funds stay protected. Always.

No keys surrendered. Emergency exit always available. 🔐
```

### Thread Reply 2:

```
But that's not all.

🔍 Token Scanner — paste any BSC address, get instant risk score
🛡️ Guardian Shield — 24/7 wallet monitoring with real-time alerts
📊 On-chain audit trail — every AI decision recorded immutably

Free to scan. Free to monitor. Vault for serious protection.
```

### Thread Reply 3:

```
The numbers:

• 7 smart contracts, 2,660 lines of Solidity
• 207 passing tests
• 3,473 lines of AI agent code
• Top 10 winner at @BNBCHAIN Good Vibes Only hackathon (6th/200)
• $UNIQ token live on BSC (renounced, LP locked)

We built this to protect DeFi users. Now it's live. 🛡️

Try it → aegisguardian.xyz
```

### Notes for Walter:
- **Share the draft** with Walter for his review BEFORE posting
- **Time the post** for when BNB Chain community is most active (typically 8-10 AM UTC or 2-4 PM UTC)
- **After posting**, immediately DM Walter the tweet link so he can coordinate the welcome post

---

## 6. Binance Wallet SDK Integration

This is important for Dappbay visibility and Binance Alpha consideration. Walter specifically mentioned it.

### What You Need To Do:

**Step 1: Read the docs**
- SDK Introduction: https://developers.binance.com/docs/binance-w3w/introduction
- Self-testing guide: https://developers.binance.com/docs/w3w_web3_dapp/self-testing
- Self-listing guide: https://developers.binance.com/docs/w3w_web3_dapp/self-listing

**Step 2: Install the SDK**

The Binance Wallet SDK works similarly to MetaMask/WalletConnect. It adds Binance Wallet as a connection option in your dApp.

```bash
cd frontend
npm install @aspect-build/binance-w3w-sdk
# OR check the latest package name in their docs
```

**Step 3: Add to WalletContext.tsx**

Your current WalletContext uses `window.ethereum` (MetaMask). You need to add Binance Wallet alongside it. The SDK typically provides its own provider that you detect like:

```typescript
// Detect Binance Wallet
const isBinanceWallet = window.BinanceChain !== undefined;
```

**Step 4: Self-test on iOS and Android**
- Test transaction signing on both platforms
- Verify wallet shows correctly next to MetaMask option

**Step 5: Submit self-listing application**
- https://developers.binance.com/docs/w3w_web3_dapp/self-listing
- Review takes 5-7 business days

### Success Criteria (from Walter):
1. ✅ Binance Wallet shown as wallet option alongside MetaMask
2. ✅ Can properly sign transactions on iOS AND Android

### Timeline:
- Start integration: April 18-19
- Self-testing: April 20-21
- Submit self-listing: April 22
- Expected approval: April 27-29

---

## 7. YZi Labs / MVB Application

This is the $1B Builders' Fund. Walter said to use his name as referral.

### Apply here:
- https://www.yzilabs.com/ → "BNB Chain MVB"
- Direct form: https://forms.monday.com/forms/849b09d8df07fce1b6ded57b4f54334d?r=apse2

### What to include (from Walter's pointers):

#### 1. Product Info / Pitch
> Aegis Protocol is the first AI-powered DeFi guardian on BNB Chain. It combines autonomous AI agents with smart contract automation to protect DeFi users from rug pulls, flash crashes, and yield losses.
>
> **Three products:**
> - **Token Scanner** — instant rug pull detection for any BSC token
> - **Guardian Shield** — 24/7 wallet monitoring with AI-powered threat analysis
> - **Protected Vault** — BNB deposits earning Venus Protocol yield with automated stop-loss via PancakeSwap
>
> **Demo:** https://aegisguardian.xyz
> **Demo Video:** https://youtu.be/zEeFEduh6eg

#### 2. Team Background
> **[Fill in your actual background]**
> - Won 6th place out of 200 teams at Good Vibes Only: OpenClaw Edition hackathon
> - Built entire protocol solo: 7 smart contracts, AI agent, frontend, Telegram bot
> - [Your education/experience]

#### 3. GTM Strategy on BNB Chain
> - Token Scanner is free → viral acquisition loop (shareable scan results on X)
> - Guardian Shield is freemium → converts scanners to monitored users
> - Vault is paid → generates revenue from protocol fees + performance fees on yield
> - $UNIQ token provides holder tiers with fee discounts → incentivizes holding
> - Dappbay listing + BNB Chain welcome post for initial community exposure
> - Binance Wallet integration for BNB Chain native user acquisition
> - Educational content on X about DeFi security → builds organic following

#### 4. Roadmap on BNB Chain
> - **April 2026:** BSC Mainnet launch, Dappbay listing, audit
> - **May 2026:** Binance Wallet integration, Telegram bot expansion
> - **June 2026:** Multi-vault support (BNB + stablecoins), opBNB deployment
> - **Q3 2026:** Governance, expanded AI models, institutional vaults
> - **Q4 2026:** Cross-chain expansion (starting with opBNB)

#### 5. Competitor Analysis
> | Competitor | What they do | How Aegis is different |
> |-----------|-------------|----------------------|
> | DeFi Saver | Automated DeFi management (Ethereum) | Aegis adds AI reasoning + BNB Chain native |
> | Gauntlet | Risk modeling for protocols | Aegis protects individual users, not protocols |
> | Chainalysis | Blockchain analytics | Aegis is real-time + autonomous execution |
> | Token Sniffer | Token scanning | Aegis adds AI analysis + vault protection + monitoring |
>
> **No direct competitor** combines AI agent + vault + stop-loss + scanner on BNB Chain.

#### 6. Revenue Model
> - **Protocol fee:** 0.5% on vault deposits
> - **Performance fee:** 15% on Venus yield generated
> - **Token utility:** $UNIQ fee discounts drive demand (3% tax on transfers)
> - **Sustainable:** Revenue grows with TVL, not dependent on token price

#### 7. Referral
> Referred by **Walter from BNB Chain BD** (per discussion on April 16, 2026)

---

## 8. BNB Chain Welcome Post Strategy

Walter explained the funnel:
1. **You launch on mainnet + post deployment tweet mentioning @BNBCHAIN**
2. **Dappbay verification happens** (3-7 days)
3. **BNB Chain MAY feature you in a welcome post** on X (like [this example](https://x.com/BNBCHAIN/status/2021418939931295881))
4. **If you gain traction**, you get more support: spaces, features, community intros

### How to Maximize Your Chances of Getting the Welcome Post:

**Before the welcome post:**
- Have your Dappbay profile complete and verified
- Have real on-chain transactions (even small test amounts)
- Have an active X account with regular posts
- Have the launch tweet performing well (likes, retweets, comments)

**When the welcome post drops:**
- **React INSTANTLY** — retweet, quote tweet, thank BNB Chain
- **Have content ready to go** — a blog post, a video, a thread explaining your product
- **Tell your community** to engage with the welcome post (likes, retweets, replies)
- **Run a promotion** tied to the welcome post (e.g., "First 100 users get X")

**After the welcome post:**
- **Track the metrics** — new users, new deposits, new scans
- **Post follow-up content** — "Thank you @BNBCHAIN for featuring us! Here's what we're building next..."
- **Keep the momentum** — don't go quiet after the boost

### Walter's Key Insight:
> "We strongly suggest the project to tweak the marketing/GTM strategies to revolve about reacting to the time that the welcome tweet is posted"

This means: **Have ALL your marketing content pre-loaded and ready to fire the moment BNB Chain posts about you.** Don't scramble to create content after the fact.

### Pre-Load These:
- [ ] 5 tweet threads explaining different features
- [ ] 1 blog post / Medium article about Aegis
- [ ] Video demo (you already have: https://youtu.be/zEeFEduh6eg)
- [ ] Infographics showing how the vault/scanner/guardian works
- [ ] "Getting started" guide for new users

---

## 9. Binance Alpha — Long-term Play

This is NOT for launch day. This is for AFTER you have traction.

### The Path (from Walter):

```
Launch on BNB Chain
        ↓
Get Dappbay traction (users, transactions)
        ↓
BNB Chain team notices your growth
        ↓
BNB Chain sends recommendation to Binance Alpha
        ↓
Binance Alpha evaluates
        ↓
If accepted: $UNIQ gets listed on Binance Alpha (Binance Wallet)
        ↓
Strong performance on Alpha → potential Binance Futures/Spot listing
```

### What You Need for Binance Alpha:
- Strong on-chain traction on BNB Chain (tracked via Dappbay)
- Growing daily active users
- Meaningful transaction volume
- Good security profile (audit, bug bounty)
- Binance Wallet SDK integration

### You Can Also Apply Directly:
- https://www.binance.com/en/my/coin-apply
- But Walter said BNB Chain's recommendation carries more weight

### Don't Rush This:
Focus on launch → traction → organic growth first. Binance Alpha is a 3-6 month target, not a launch day target.

---

## 10. Critical Blockers Before April 28

### Must-Do (No Launch Without These):

| # | Task | Status | Deadline |
|---|------|--------|----------|
| 1 | Deploy contracts to BSC Mainnet | ❌ Not done | April 27 |
| 2 | Set Vercel env vars for mainnet | ❌ Not done | April 27 |
| 3 | Fund deployer wallet with BNB for gas | ❌ Not done | April 26 |
| 4 | Agent running on reliable server | ❌ Not done | April 27 |
| 5 | At least automated security scan (Slither) | ❌ Not done | April 18 |
| 6 | Dappbay submitted | ❌ Not done | April 17 (TODAY) |
| 7 | GitHub repo public | ❌ Verify | April 17 (TODAY) |
| 8 | Smoke test all features on mainnet | ❌ Not done | April 27 |

### Should-Do (Strongly Recommended):

| # | Task | Status | Deadline |
|---|------|--------|----------|
| 9 | Professional audit started | ❌ Not done | April 19 |
| 10 | Immunefi bug bounty | ❌ Not done | April 18 |
| 11 | Binance Wallet SDK | ❌ Not done | April 22 |
| 12 | YZi Labs application | ❌ Not done | April 20 |
| 13 | Launch tweet approved by Walter | ❌ Not done | April 25 |

### Nice-to-Have (Can Follow After Launch):

| # | Task | Notes |
|---|------|-------|
| 14 | Trust Wallet integration | Walter mentioned Trust Wallet too |
| 15 | Blog post on Medium/Mirror | Content for welcome post momentum |
| 16 | Telegram community group | For user support |
| 17 | Documentation site | Gitbook or similar |

---

### Vercel Environment Variables You Need Set:

```
# Mainnet contract addresses (after deployment)
NEXT_PUBLIC_VAULT_ADDRESS=<mainnet vault address>
NEXT_PUBLIC_REGISTRY_ADDRESS=<mainnet registry address>
NEXT_PUBLIC_LOGGER_ADDRESS=<mainnet logger address>
NEXT_PUBLIC_SCANNER_ADDRESS=<mainnet scanner address>
NEXT_PUBLIC_TOKEN_GATE_ADDRESS=<mainnet tokengate address>
NEXT_PUBLIC_CHAIN_ID=56

# Already should be set:
UPSTASH_REDIS_REST_URL=<your upstash url>
UPSTASH_REDIS_REST_TOKEN=<your upstash token>
GROQ_API_KEY=<your groq key>
TELEGRAM_BOT_TOKEN=<your telegram bot token>
CRON_SECRET=<a random secret string>
```

### Agent Hosting:

The AI agent needs to run 24/7. Options:

| Service | Cost | Setup |
|---------|------|-------|
| **Railway.app** | ~$5/mo | Easy deploy from GitHub |
| **Render.com** | ~$7/mo | Background worker service |
| **DigitalOcean Droplet** | $6/mo | VPS + pm2 process manager |
| **Hetzner VPS** | €4/mo | Cheapest reliable VPS |

Recommended: **Railway** or **Render** for simplicity. Use pm2 on a VPS if you want more control.

```bash
# On a VPS with pm2:
npm install -g pm2
cd agent
pm2 start src/index.ts --name aegis-agent --interpreter ts-node
pm2 save
pm2 startup  # auto-restart on reboot
```

---

## Quick Reference — All Links Walter Sent

| Resource | Link |
|----------|------|
| **Dappbay Submit** | https://dappbay.bnbchain.org/ |
| **Dappbay Guide (PDF)** | https://drive.google.com/file/d/1A1ujH9ipP9MN8Xtkec9UAxF07ba8kKhS/view |
| **My Projects (check status)** | https://dappbay.bnbchain.org/my-projects |
| **BNB Chain Brand Guidelines** | https://www.bnbchain.org/en/brand-guidelines |
| **Welcome Post Example** | https://x.com/BNBCHAIN/status/2021418939931295881 |
| **Binance Wallet SDK** | https://developers.binance.com/docs/binance-w3w/introduction |
| **SDK Self-Testing** | https://developers.binance.com/docs/w3w_web3_dapp/self-testing |
| **SDK Self-Listing** | https://developers.binance.com/docs/w3w_web3_dapp/self-listing |
| **Binance Alpha Apply** | https://www.binance.com/en/my/coin-apply |
| **Alpha Growth Stats** | https://x.com/binance/status/1978429250735677766 |
| **YZi Labs Website** | https://www.yzilabs.com/ |
| **MVB Application Form** | https://forms.monday.com/forms/849b09d8df07fce1b6ded57b4f54334d?r=apse2 |
| **$1B Fund Blog** | https://www.bnbchain.org/en/blog/1b-builder-fund-to-empower-builders-backed-by-yzi-labs-and-bnb-chain |

---

**Bottom line:** Submit Dappbay TODAY, email audit firms TODAY, send Walter Q1-Q12 TODAY. Everything else follows from there. You have 11 days — it's tight but doable if you start now.
