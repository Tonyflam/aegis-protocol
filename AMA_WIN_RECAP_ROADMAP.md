# 🛡️ AEGIS PROTOCOL — WIN RECAP & ROADMAP
## Uniq Minds AMA Session | 30-60 Minutes

---

# PART 1: THE WIN RECAP

---

## 🏆 THE HACKATHON

**Good Vibes Only: OpenClaw Edition**
- **Prize Pool**: $100,000 USD
- **Chain**: BNB Smart Chain
- **Track**: AI Agent x On-Chain Actions
- **Result**: We were selected as one of the **10 standout winners (ranked #6)** in the Good Vibes Only: OpenClaw Edition by @BNBCHAIN! Among **200 projects and 600 builders**, Aegis stood out for its real on-chain AI execution. 🎉

**Official announcement**: https://www.bnbchain.org/en/blog/good-vibes-only-openclaw-edition-winners

*(See the full list—huge congrats to all top projects like Zhentan, Strike, and ShieldBot!)*

---

## 💡 WHAT IS AEGIS PROTOCOL?

**One-liner**: An autonomous AI agent that protects your DeFi positions 24/7, detects threats in real-time, and executes protection — all on-chain, all verifiable.

### The Problem We Solve

DeFi users lose **billions every year** to:
- Rug pulls
- Flash loan attacks  
- Liquidity drains
- Price crashes
- Oracle manipulation

**Why?** Because these happen when you're:
- Sleeping
- At work
- Not watching the charts

Traditional tools give you price alerts. That's it. By the time you see the alert, react, open your wallet, and sign a transaction — it's too late.

### Our Solution

Aegis is an **autonomous AI guardian** that:
1. **Monitors** your positions every 30 seconds
2. **Analyzes** using 5-vector risk scoring + LLM AI
3. **Verifies** prices against PancakeSwap on-chain (catches oracle attacks)
4. **Executes** stop-loss, emergency withdrawal, rebalance — automatically

**You set your risk tolerance. Aegis handles the rest.**

---

## 🔧 WHAT WE BUILT (Technical Deep-Dive)

### Smart Contracts — 1,326 Lines of Solidity

| Contract | What It Does |
|----------|-------------|
| **AegisRegistry** | ERC-721 NFT agent identity system. Each guardian is a token with 4 tiers (Scout → Sentinel → Guardian → Archon), reputation scoring (1-5 stars), and on-chain performance metrics. |
| **AegisVault** | Non-custodial vault where users deposit BNB/tokens. Each user sets their own risk profile: max slippage, stop-loss threshold, auto-actions. Emergency withdrawal always available. |
| **DecisionLogger** | Immutable audit trail of every AI decision. Stores risk snapshots, threat detections, protection actions, and a keccak256 hash of the AI reasoning text — so you can verify what the AI was "thinking" on-chain. |

### AI Engine — Real LLM Integration

This is NOT a chatbot wrapper. The agent makes real API calls to:
- **Groq** (Llama 3.3 70B Versatile) — Fast, free tier
- **OpenAI** (GPT-4o) — Premium fallback

The AI receives structured market data and outputs structured JSON:
```json
{
  "reasoning": "BNB trading at $595.80 with -0.7% 24h movement...",
  "riskScore": 18,
  "confidence": 94,
  "threats": [],
  "suggestedActions": ["continue_monitoring"]
}
```

If no API key? Falls back to rule-based heuristics. Zero downtime.

### PancakeSwap V2 On-Chain Integration

Most DeFi tools just read CoinGecko. That's an API — it can be manipulated.

Aegis reads **on-chain reserves** directly from PancakeSwap V2:
- Compare CoinGecko price vs DEX price
- If delta > 1% → Warning (potential manipulation)
- If delta > 5% → CRITICAL (oracle attack likely)

This catches attacks that API-only tools miss.

### Live Market Data

Real-time data from:
- **CoinGecko** — Prices, volume, market cap
- **DeFiLlama** — BSC TVL, protocol liquidity
- **PancakeSwap** — On-chain prices, pair data

No API keys needed for any of these.

---

## 📜 ON-CHAIN PROOF

**Not mockups. Not testnet dust. Real transactions.**

All 3 contracts deployed on BSC Testnet and verified via Sourcify:

| Contract | Address |
|----------|---------|
| AegisRegistry | `0xac77139C2856788b7EEff767969353adF95D335e` |
| AegisVault | `0x73CE32Ece5d21836824C55c5EDB9d09b07F3a56E` |
| DecisionLogger | `0xEbfb45d0c075d8BdabD6421bdFB9A4b9570219ea` |

### 13 Verified Transactions — Full Threat Lifecycle

We demonstrated the complete flow:

1. **Setup** — Deposited 0.005 tBNB
2. **Normal Operations** — AI analyzed, all clear (92% confidence)
3. **Escalation** — Volatility warning detected (-4.2%)
4. **Threat Detection** — Abnormal volume (+350%) flagged HIGH risk
5. **Defense Mode** — Switched to aggressive risk profile
6. **Protection Triggered** — Stop-loss executed at 95% confidence
7. **Recovery** — Market stabilized, risk normalized
8. **Review** — Position reviewed, 98% confidence all clear

**Every single transaction is on BSCScan. Click and verify.**

---

## ✅ WHY WE WERE SELECTED AS A TOP PROJECT

| Criteria | What We Delivered |
|---------|------------------|
| **Real AI** | LLM integration, not template strings |
| **On-chain Proof** | 13 verifiable transactions, not screenshots |
| **Novel Architecture** | DEX price verification catches oracle attacks |
| **Non-custodial** | Users keep control, emergency exit always works |
| **Production-Ready** | 54/54 tests passing, clean build, live dashboard |
| **Transparency** | AI reasoning hashed and stored on-chain |
| **Competitive Field** | Recognized alongside 9 other innovative AI/on-chain projects in a field of 200 submissions |

---

## 📊 CURRENT STATS

- **Smart Contract LOC**: 1,326
- **Tests**: 54/54 passing
- **On-chain TXs**: 13 verified
- **Dashboard**: Live on Vercel
- **Contracts**: Sourcify verified
- **Recognition**: Featured in official BNB Chain winners blog (Feb 22, 2026)

---

# PART 2: THE ROADMAP

---

## 🗺️ ROADMAP OVERVIEW

| Phase | Timeline | Focus |
|-------|----------|-------|
| **Phase 1** | Now | Foundation & Branding |
| **Phase 2** | Week 1-2 | $UNIQ Token Integration |
| **Phase 3** | Week 4-8 | BSC Mainnet Launch |
| **Phase 4** | Month 2 | Multi-Protocol Support |
| **Phase 5** | Month 3 | Staking & Revenue Share |
| **Phase 6** | Month 4+ | Multi-Chain Expansion |

---

## PHASE 1: FOUNDATION (This Week)

### Branding & Presence

- [x] Win the hackathon ✓
- [x] Launch $UNIQ token (community launched on flap.sh) ✓
- [x] Twitter @uniq_minds active ✓
- [ ] Host Win Recap AMA (this session)
- [ ] Update all branding → "Aegis Protocol by Uniq Minds"
- [ ] Add $UNIQ to dashboard
- [ ] Announce token utility

### Technical

- [ ] Internal security audit (comprehensive code review)
- [ ] Automated testing expansion (fuzz tests, invariant tests)
- [ ] Gas optimization pass
- [ ] Prepare mainnet deployment scripts

### Deliverables

- Updated README with Uniq Minds branding
- $UNIQ price display on dashboard
- Announcement thread on Twitter

---

## PHASE 2: $UNIQ TOKEN INTEGRATION (Week 1-2)

### Token Utility v1

| Utility | Description |
|---------|-------------|
| **Registration Fee** | Register agents using $UNIQ instead of BNB (discount) |
| **Holder Benefits** | Hold $UNIQ → reduced protocol fees (50 bps → 25 bps) |
| **Premium Badge** | Visible "UNIQ Holder" badge on dashboard |
| **Early Access** | New features released to holders first |

### Contract Updates

- Add $UNIQ token address to contracts
- Add `registerAgentWithUNIQ()` function
- Add holder verification on frontend
- Deploy updated contracts to testnet

### Marketing

- Token utility announcement
- Partnership outreach begins
- Community challenges/competitions

---

## PHASE 3: BSC MAINNET LAUNCH (Week 4-8)

### Funding & Security

- Leverage hackathon recognition to apply for **BNB Chain MVB grants** or ecosystem support
- External security audit (4-6 weeks typical for DeFi projects post-hackathon)
- Bug bounty program setup

### Pre-Launch Checklist

- [ ] Final security review complete
- [ ] Multisig wallet setup (Gnosis Safe)
- [ ] Launch parameters finalized
- [ ] Emergency procedures documented
- [ ] Monitoring infrastructure ready

### Launch Strategy

**Soft Launch (Invite-Only)**
- Max total deposits: $10,000 USD equivalent
- Max per user: $1,000 USD
- Whitelisted addresses only (early community)
- Close monitoring, rapid iteration

**Public Launch (Week 6-8)**
- Increase caps gradually
- Full documentation live
- Support channels active
- Coordinate with BNB Chain ecosystem for co-marketing

### Contracts on Mainnet

Same architecture, mainnet deployment:
- AegisRegistry (mainnet)
- AegisVault (mainnet)
- DecisionLogger (mainnet)

All verified on BSCScan + Sourcify.

---

## PHASE 4: MULTI-PROTOCOL SUPPORT (Month 2)

### Protocol Integrations

| Protocol | Type | Status |
|----------|------|--------|
| **PancakeSwap V2** | DEX | ✅ Done |
| **PancakeSwap V3** | DEX (Concentrated Liquidity) | 🔄 Priority |
| **Venus Protocol** | Lending | 🔄 Priority |
| **Alpaca Finance** | Leveraged Yield | Planned |
| **BNB Liquid Staking** | ankrBNB, stkBNB | Planned |

### What This Means

Users can protect:
- DEX LP positions
- Lending positions (liquidation protection)
- Leveraged positions
- Staking positions

Single dashboard, multiple protocols.

### Token Protection

- Monitor any BSC token in your wallet
- Auto-detect holdings
- Set per-token risk profiles
- Cross-token correlation analysis

---

## PHASE 5: STAKING & REVENUE SHARE (Month 3)

### $UNIQ Staking System

| Feature | Description |
|---------|-------------|
| **Stake $UNIQ** | Lock tokens for rewards |
| **Agent Boost** | Stakers get faster tier progression |
| **Revenue Share** | Protocol fees → staking rewards |
| **Governance** | Stakers vote on protocol parameters |

### Revenue Model

**Protocol Fees** (default 50 bps)
- 30% → Stakers (revenue share)
- 30% → Treasury (development)
- 20% → Buyback (support token price)
- 20% → Operations (servers, APIs, team)

### AegisStaking Contract

New contract:
- Stake $UNIQ for xUNIQ (receipt token)
- Time-weighted rewards
- Compound option
- Emergency unstake (penalty)

---

## PHASE 6: MULTI-CHAIN EXPANSION (Month 4+)

### Target Chains

| Chain | Priority | Why |
|-------|----------|-----|
| **Ethereum** | High | Largest DeFi TVL |
| **Arbitrum** | High | Fast, cheap, growing DeFi |
| **Base** | Medium | Coinbase ecosystem |
| **Polygon** | Medium | Large user base |
| **Optimism** | Medium | Strong DeFi protocols |

### Cross-Chain Architecture

- Unified dashboard (view all chains)
- Chain-specific agents
- Cross-chain position aggregation
- Single $UNIQ token (BSC native, bridged to others)

---

## 📈 GROWTH STRATEGY

### Community

| Channel | Purpose |
|---------|---------|
| **Twitter/X** | Announcements, engagement, alpha |
| **Telegram** | Community chat, support |
| **Discord** | Technical discussion, contributor hub |

### Marketing

- Hackathon win PR
- DeFi influencer outreach
- Protocol partnership announcements
- Educational content (threads, videos)
- **BNB Chain ecosystem exposure** (potential retweets/co-marketing from @BNBCHAIN)

### Metrics to Track

- Total Value Protected (TVP)
- Active agents
- Threats detected
- Protections triggered
- $UNIQ holder growth
- Community engagement

---

## 🎯 SUCCESS METRICS (90-Day Goals)

| Metric | Target |
|--------|--------|
| **Total Value Protected** | $100,000+ |
| **Active Agents** | 50+ |
| **$UNIQ Holders** | 1,000+ |
| **Twitter Followers** | 5,000+ |
| **Telegram Members** | 2,000+ |
| **Threats Detected** | 100+ |
| **Protections Executed** | 25+ |
| **BNB Chain Ecosystem Engagement** | Featured in ecosystem updates |

---

## 💬 Q&A TOPICS TO PREPARE FOR

### Technical Questions

1. "How is this different from a stop-loss on an exchange?"
2. "What happens if the AI makes a wrong decision?"
3. "How do you prevent front-running?"
4. "Is my wallet safe? What permissions do I grant?"
5. "Why BSC and not Ethereum?"

### Token Questions

1. "What is the utility of $UNIQ?"
2. "Is there a max supply? Burn mechanism?"
3. "How does staking work?"
4. "Roadmap for token?"
5. "How does revenue sharing work?"

### Business Questions

1. "Who is the team behind this?"
   - *Answer: Solo founder building with community input, open to contributors. Real builder, not a marketing team.*
2. "What's your revenue model?"
3. "How are you funded?"
4. "What's the competitive landscape?"
5. "Plans for VC funding?"
6. "How much did you win / prize details?"
   - *Answer: The $100K prize pool was split across the 10 selected projects—exact amounts aren't public, but the recognition and visibility are the real win. We're focused on building utility for $UNIQ holders long-term.*

---

## 📌 KEY LINKS TO SHARE

| Link | URL |
|------|-----|
| **Live Dashboard** | https://aegis-protocol-1.vercel.app/ |
| **Demo Video** | https://youtu.be/zEeFEduh6eg |
| **GitHub** | https://github.com/Tonyflam/rs |
| **Twitter** | https://x.com/uniq_minds |
| **$UNIQ Token** | https://flap.sh/bnb/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777 |
| **BSCScan (Token)** | https://bscscan.com/token/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777 |
| **Registry Contract** | https://testnet.bscscan.com/address/0xac77139C2856788b7EEff767969353adF95D335e |
| **🏆 Winners Announcement** | https://www.bnbchain.org/en/blog/good-vibes-only-openclaw-edition-winners |

---

## 🎤 SUGGESTED AMA FLOW (60 mins)

| Time | Segment | Description |
|------|---------|-------------|
| 0:00-5:00 | **Intro** | Welcome, who we are, what we'll cover |
| 5:00-15:00 | **Win Recap** | Hackathon, what we built, why we were selected as a top project |
| 15:00-25:00 | **Live Demo** | Walk through the dashboard, show on-chain TXs |
| 25:00-35:00 | **Roadmap** | Phase by phase breakdown |
| 35:00-45:00 | **$UNIQ Token** | Utility, integration plans, staking |
| 45:00-60:00 | **Q&A** | Community questions |

---

## 🔥 KEY MESSAGES TO EMPHASIZE

1. **"We're real builders, not hype"** — 54 tests, 1,300+ LOC, 13 on-chain TXs
2. **"Non-custodial, always"** — Your keys, your coins, emergency exit always works
3. **"AI that proves itself"** — Reasoning hashed on-chain, verifiable
4. **"$UNIQ has real utility"** — Not speculation, powers the protocol
5. **"Community first"** — Fair launch, LP locked, ownership renounced
6. **"Official top-10 recognition from @BNBCHAIN"** — Among 200 projects, proof we're delivering value in the AI agent space

---

## ✅ POST-AMA ACTION ITEMS

- [ ] Post recording to YouTube
- [ ] Tweet thread summary
- [ ] Update roadmap based on feedback
- [ ] Begin Phase 2 implementation
- [ ] Schedule next community call (1 week)
