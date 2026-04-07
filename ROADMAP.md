# AEGIS PROTOCOL — PRODUCT ROADMAP
## Your AI-Powered DeFi Security Layer on BNB Chain

**Last Updated**: April 6, 2026
**Status**: Phase 1 building — Scanner & Guardian

---

## THE PROBLEM

$2.3B lost to DeFi exploits in 2025. Rug pulls, honeypot tokens, whale dumps, flash loan attacks — and regular users have zero protection. They buy a token, hope for the best, and find out they got scammed only after their money is gone.

**Aegis Protocol fixes this.** Three products, one mission: never let a user lose money to a preventable DeFi attack.

---

## WHAT WE'VE BUILT (Foundation)

| Component | Status | Details |
|-----------|--------|---------|
| Smart Contracts | ✅ BSC Testnet | 5 contracts verified (Registry, Vault, Logger, TokenGate, Scanner) |
| Test Suite | ✅ 198 passing | Full coverage across all contracts |
| AI Agent Engine | ✅ Functional | Groq llama-3.3-70b + heuristic fallback, 3,200+ LOC |
| Token Scanner | ✅ Live | Honeypot detection, rug pull analysis, whale concentration |
| Whale Alerts | ✅ Live | Real-time BSC large transfer monitoring |
| $UNIQ Token | ✅ Launched | 0xdd5f...7777 on BSC Mainnet, 1B supply, renounced, 3% tax |
| Frontend | ✅ Live | aegisguardian.xyz on Vercel |
| CI/CD | ✅ Active | 3-job GitHub Actions pipeline |

---

## THE THREE PRODUCTS

```
┌─────────────────────────────────────────────────────────┐
│                    AEGIS PROTOCOL                        │
│                                                         │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │  SCANNER  │   │   GUARDIAN    │   │  SHIELD VAULT  │  │
│  │  (Free)   │──▶│  (Freemium)  │──▶│   (Premium)    │  │
│  └──────────┘   └──────────────┘   └────────────────┘  │
│                                                         │
│  Scan any       AI watches your     Deposit + earn      │
│  token or       wallet 24/7.        yield. AI auto-     │
│  wallet.        Alerts on threats.  protects your       │
│  Instant risk   Personal whale &    funds in real       │
│  score.         rug pull warnings.  time.               │
└─────────────────────────────────────────────────────────┘
```

### Product 1: Aegis Scanner (Free)
> *"Paste any token. Know if it's safe in 2 seconds."*

- Scan any BSC token address → instant risk score (0-100)
- Honeypot detection (simulated buy+sell)
- Rug pull risk (ownership, mint functions, lock status)
- Whale concentration (top holders %)
- Liquidity depth and lock analysis
- Source code verification status
- **Wallet Scanner**: Connect wallet → auto-scan every token you hold → portfolio risk overview

### Product 2: Aegis Guardian (Freemium / $UNIQ)
> *"AI watches your wallet so you don't have to."*

- Connect wallet → Guardian monitors your actual token holdings
- Real-time alerts when something changes:
  - Liquidity removal on a token you hold
  - Whale dumping a token you hold
  - Contract upgrade or ownership change
  - Sudden price crash (-20%+)
- Personalized whale alerts (tracks YOUR tokens, not generic ones)
- Alert history with AI-generated threat explanations
- **$UNIQ holders**: Priority alerts, Telegram notifications, AI explanations

### Product 3: Aegis Shield Vault (Premium)
> *"Deposit BNB. Earn yield. AI protects you automatically."*

- Deposit BNB → funds earn 3-8% APY via Venus Protocol lending
- AI agent monitors market conditions 24/7
- Automatic protection triggers:
  - **Stop-Loss**: Market crashes → auto-withdraw to safety
  - **Emergency Exit**: Protocol exploit detected → instant withdrawal
  - **Rebalance**: Shift between lending pools for optimal yield
- Full audit trail on-chain (DecisionLogger)
- Per-user risk profiles (conservative / moderate / aggressive)
- **Revenue**: 0.5% management fee + 10% performance fee on yield

---

## $UNIQ TOKEN UTILITY

$UNIQ is the access key to Aegis Protocol. Hold more → unlock more.

| Tier | $UNIQ Required | Benefits |
|------|---------------|----------|
| **Free** | 0 | Token Scanner (unlimited scans) |
| **Bronze** | 10,000 | + Wallet Scanner + 10% fee discount |
| **Silver** | 100,000 | + Priority alerts + Telegram bot + 25% fee discount |
| **Gold** | 1,000,000 | + AI threat explanations + custom stop-loss + 40% fee discount |

**On-chain integration**: AegisTokenGate.sol reads your $UNIQ balance — no staking or locking required. Just hold.

---

# PHASE 1: SCANNER & GUARDIAN (Current)

> **Goal**: Ship the two free/freemium products that bring users in.

## 1.1 — Wallet Scanner

Connect wallet → instantly scan all tokens in the portfolio.

- [ ] **BSC token detection** — Read all BEP-20 balances for connected wallet
- [ ] **Batch risk scoring** — Score every token simultaneously
- [ ] **Portfolio risk dashboard** — Aggregate score, per-token breakdown, red flags
- [ ] **Scan history** — Save past scans, show changes over time
- [ ] **Shareable reports** — "My wallet scored 87/100" link for social sharing

**Frontend**: `/scanner` route — the primary entry point for new users.

## 1.2 — Personal Guardian Alerts

Replace generic market monitoring with per-user intelligence.

- [ ] **Wallet token tracking** — Agent reads connected wallet's holdings
- [ ] **Per-token monitoring** — Watch liquidity, holder changes, contract events for tokens the user actually owns
- [ ] **Alert engine** — Push alerts to dashboard when threats are detected:
  - Liquidity removed (>25%) on a held token
  - Top holder dumps (>5% of supply)
  - Contract ownership transferred
  - Price crash (>20% in 1hr)
- [ ] **Alert dashboard** — `/alerts` route with real-time feed, severity levels, AI explanations
- [ ] **Notification preferences** — Choose which alert types matter to you

## 1.3 — Frontend Build-Out

Ship the actual product pages (currently only landing page exists).

- [ ] **`/scanner`** — Token input + wallet scanner + risk results
- [ ] **`/alerts`** — Personal alert feed with severity & AI explanations
- [ ] **`/dashboard`** — Overview: your tokens, risk score, active alerts, Guardian status
- [ ] **Mobile-responsive** — Most BSC users are on mobile
- [ ] **Onboarding flow** — First-time UX: connect wallet → see your risks → activate Guardian

## 1.4 — $UNIQ Tier Gating (Frontend)

- [ ] Read user's $UNIQ balance on connect
- [ ] Display current tier (Free / Bronze / Silver / Gold)
- [ ] Gate Wallet Scanner behind Bronze tier
- [ ] Gate Telegram alerts behind Silver tier
- [ ] Show upgrade prompts with "Buy $UNIQ" links

### Phase 1 Deliverables
- [ ] Wallet Scanner live — connect wallet, see all token risks
- [ ] Personal Guardian alerts for connected wallets
- [ ] 3 frontend routes functional (`/scanner`, `/alerts`, `/dashboard`)
- [ ] $UNIQ tier gating active
- [ ] First real users scanning tokens and getting alerts

---

# PHASE 2: SHIELD VAULT — YIELD + PROTECTION (Next)

> **Goal**: The revenue engine. Users deposit BNB, earn yield, get AI protection.

## 2.1 — Venus Protocol Integration

Turn idle vault BNB into yield-generating capital.

- [ ] **Venus adapter** — `agent/src/adapters/venus.ts`
  - Supply BNB to Venus Protocol (vBNB market)
  - Track supply APY in real-time
  - Monitor health factor and utilization rate
- [ ] **Vault upgrade** — AegisVault deposits route through Venus
  - `deposit()` → supply to Venus → earn interest
  - `withdraw()` → redeem from Venus → return to user
  - Track yield per user
- [ ] **Yield display** — Dashboard shows real-time earnings

## 2.2 — Per-User AI Protection

Make the AI agent actually protect individual positions.

- [ ] **User position indexer** — Agent tracks each user's vault deposit + yield
- [ ] **Personal stop-loss** — Each user sets their own threshold (default 10%)
- [ ] **Automated actions** — Agent executes on per-user basis:
  - `StopLoss` → Withdraw from Venus + return to user when threshold hit
  - `EmergencyWithdraw` → Full exit on protocol-level threat
  - `Rebalance` → Move between Venus markets for better APY
- [ ] **Risk profiles** — Conservative (2% stop-loss) / Moderate (10%) / Aggressive (25%)
- [ ] **Action history** — On-chain log of every AI decision per user

## 2.3 — Revenue Model

- [ ] **Management fee**: 0.5% annual on deposited assets (taken from yield)
- [ ] **Performance fee**: 10% of yield generated (only on profits)
- [ ] **$UNIQ discounts**: Bronze -10%, Silver -25%, Gold -40% on all fees
- [ ] **Fee dashboard** — Transparent fee breakdown for every user

## 2.4 — Frontend: Vault Experience

- [ ] **`/vault`** — Deposit/withdraw BNB, see yield, set risk profile
- [ ] **`/positions`** — Active positions with P&L, protection status, action history
- [ ] **Yield calculator** — "If you deposit X BNB, you'll earn Y/month"
- [ ] **Protection log** — Every AI decision with reasoning, timestamped on-chain

### Phase 2 Deliverables
- [ ] Venus Protocol yield integration live
- [ ] Per-user AI protection with stop-loss
- [ ] Revenue flowing from management + performance fees
- [ ] `/vault` and `/positions` routes live
- [ ] First paying users generating protocol revenue

---

# PHASE 3: SECURITY & MAINNET (Month 2)

> **Goal**: Audit, harden, deploy to BSC Mainnet with real money.

## 3.1 — Security

- [ ] Internal audit of all contracts (slither + mythril)
- [ ] External audit (Code4rena or Hacken)
- [ ] Bug bounty on Immunefi
- [ ] Gradual TVL caps ($10K → $50K → $100K → uncapped)

## 3.2 — Mainnet Deployment

- [ ] Gnosis Safe multisig (2-of-3) as contract owner
- [ ] Paid RPC (QuickNode/Ankr) + fallback
- [ ] Deploy all contracts to BSC Mainnet
- [ ] Agent running 24/7 with `DRY_RUN=false`
- [ ] Tenderly monitoring + Discord alerts

## 3.3 — Soft Launch

- [ ] Invite-only: top $UNIQ holders first
- [ ] Max $1,000/user, $10,000 total TVL
- [ ] 2-week monitoring period
- [ ] Public launch after clean soft launch

### Phase 3 Deliverables
- [ ] All contracts on BSC Mainnet, verified
- [ ] Audit report published
- [ ] Bug bounty live
- [ ] First mainnet deposits earning yield + protected by AI

---

# PHASE 4: GROWTH & EXPANSION (Month 3+)

> **Goal**: Scale users, scale revenue, scale to more chains.

## 4.1 — Telegram Bot

- [ ] `/scan <token>` — Instant risk score in Telegram
- [ ] Real-time alert forwarding for Silver+ holders
- [ ] `/portfolio` — Quick wallet risk overview
- [ ] Viral loop: users share scan results in group chats

## 4.2 — $UNIQ Staking & Revenue Share

- [ ] **AegisStaking.sol** — Stake $UNIQ, earn share of protocol fees
- [ ] Revenue split: 30% stakers / 30% treasury / 20% buyback / 20% operations
- [ ] Staking dashboard on frontend

## 4.3 — Multi-Chain

- [ ] Ethereum (Uniswap + Aave)
- [ ] Arbitrum (Camelot + Radiant)
- [ ] Base (Aerodrome + Moonwell)
- [ ] Same product, chain-specific adapters
- [ ] $UNIQ bridged via LayerZero OFT

## 4.4 — Advanced Features

- [ ] PancakeSwap V3 LP position monitoring
- [ ] Impermanent loss protection
- [ ] Token launch sniping protection (warn before buying newly launched scams)
- [ ] API access for other protocols to use Aegis risk scores
- [ ] Shareable risk reports with social cards

### Phase 4 Deliverables
- [ ] Telegram bot live
- [ ] $UNIQ staking with revenue share
- [ ] Live on 2+ chains
- [ ] 5,000+ users, $500K+ TVP

---

# REVENUE PROJECTIONS

| Phase | Users | TVP | Monthly Revenue | Source |
|-------|-------|-----|-----------------|--------|
| **Phase 1** | 500+ | $0 | $0 | Free — acquire users |
| **Phase 2** | 1,000+ | $100K | $500-800 | Management + performance fees |
| **Phase 3** | 2,500+ | $500K | $2,500-4,000 | Mainnet fees at scale |
| **Phase 4** | 10,000+ | $2M+ | $10,000-15,000 | Multi-chain + staking |

**Revenue formula**: `(TVP × 0.5% annual mgmt fee) + (yield × 10% performance fee) — $UNIQ discounts`

At $2M TVP with 5% average yield:
- Management: $2M × 0.5% = $10,000/year ($833/mo)
- Performance: $100K yield × 10% = $10,000/year ($833/mo)
- Total: ~$1,666/mo base, scaling linearly with TVP

---

# USER JOURNEY

```
Day 1:  Visit aegisguardian.xyz → see landing page
        → "Scan a Token" → paste address → instant risk score
        → "That was useful, let me connect my wallet"

Day 2:  Connect wallet → Wallet Scanner shows all tokens
        → "Oh wow, 2 of my tokens are high risk"
        → Gets first alert: "Liquidity removed on $SCAM"

Week 1: Checks alerts daily → trusts the AI
        → Buys $UNIQ for Bronze tier → unlocks Wallet Scanner
        → Shares risk report on Twitter

Week 2: Sees Shield Vault → "3-8% APY + AI protection?"
        → Deposits 1 BNB to test
        → Watches yield grow, sees AI monitoring status

Month 1: Deposits more → tells friends → $UNIQ demand grows
         → Upgrades to Silver for Telegram alerts
         → Protocol revenue starts flowing
```

---

# RISK REGISTER

| Risk | Impact | Mitigation |
|------|--------|------------|
| Venus Protocol exploit | Critical | Max allocation limits, diversify lending, insurance fund |
| AI false positive (bad withdrawal) | High | User-set stop-loss, dry-run testing, manual override |
| Smart contract vulnerability | Critical | Audit + bounty + gradual TVL caps + multisig |
| Low adoption | Medium | Free Scanner drives organic traffic, $UNIQ incentives |
| $UNIQ price collapse | Medium | Real utility drives demand, buyback from fees |
| API rate limits | Low | Multiple providers, heuristic fallback, caching |

---

# KEY METRICS

| Metric | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|--------|---------|---------|---------|---------|
| Unique Scanners | 500 | 1,000 | 2,500 | 10,000 |
| Connected Wallets | 100 | 500 | 1,500 | 5,000 |
| Active Guardians | 50 | 300 | 1,000 | 3,000 |
| Vault Deposits | 0 | $100K | $500K | $2M+ |
| $UNIQ Holders | 200 | 500 | 1,500 | 5,000 |
| Monthly Revenue | $0 | $800 | $4,000 | $15,000 |
| Tests Passing | 198 | 220+ | 250+ | 280+ |

---

# WHAT'S NEXT (This Week)

1. Build the Wallet Scanner — connect wallet, scan all tokens, show portfolio risk
2. Build `/scanner` page — the primary product entry point
3. Wire personal whale alerts to user's actual token holdings
4. Build `/alerts` page — real-time alert feed
5. Build `/dashboard` page — overview with risk score + Guardian status

---

*This is a living document. Updated as milestones are reached.*
*Track progress: Each [ ] becomes [x] as completed.*
