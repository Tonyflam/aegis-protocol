# AEGIS PROTOCOL — DETAILED LAUNCH ROADMAP
## Uniq Minds | From Hackathon Winner to Production DeFi Protocol

**Last Updated**: April 9, 2026
**Status**: Phase 3 — COMPLETE ✅ | Phase 4 — NEXT 🔧

---

## CURRENT STATE

| Component | Status | Details |
|-----------|--------|---------|
| Smart Contracts | ✅ BSC Testnet | 7 contracts (Registry, Vault, Logger, TokenGate, Scanner, Venus, USDT) |
| Tests | ✅ 184/184 passing | Vault (Venus + stop-loss), TokenGate, Scanner, Logger |
| Frontend | ✅ Live on Vercel | aegis-protocol-1.vercel.app — Scanner, Guardian Shield, Vault |
| Agent Engine | ✅ Functional | 11 modules: AI, risk, Venus monitor, stop-loss monitor (3,473 LOC) |
| Venus Yield | ✅ Integrated | Vault deploys BNB to Venus vBNB, auto-harvesting, per-user yield tracking |
| Stop-Loss | ✅ Integrated | Per-user BNB→USDT via PancakeSwap V2, agent-monitored |
| Token Scanner | ✅ Live | Multi-source honeypot/rug pull/whale risk analysis |
| Guardian Shield | ✅ Live | Full wallet scan, AI analysis, risk-sorted token display |
| Telegram Bot | ✅ Functional | Tier-gated alerts: scans, whales, vault, price (554 LOC) |
| $UNIQ Token | ✅ Launched | 0xdd5f...7777, 1B supply, renounced, 3% tax |
| $UNIQ Integration | ✅ On-chain | AegisTokenGate: holder tiers + fee discounts |
| Mainnet Addresses | ✅ Configured | Venus, USDT, PancakeSwap, WBNB mainnet addresses ready |
| Total LOC | 14,245 | Contracts 2,660 + Agent 3,473 + Bot 554 + Frontend 5,241 + Tests 2,317 |

---

# PHASE 1: FOUNDATION & BRANDING ✅ COMPLETE

- [x] README overhaul — Aegis Protocol by Uniq Minds branding
- [x] Frontend branding — Uniq Minds + $UNIQ references
- [x] Social profile alignment
- [x] Repo cleanup — artifacts, docs, env config
- [x] Gas optimization — 19 custom errors, unchecked loops (~15-20% savings)
- [x] Test expansion — 54 → 98 tests
- [x] CI/CD pipeline — 3-job workflow

---

# PHASE 2: $UNIQ TOKEN INTEGRATION ✅ COMPLETE

- [x] AegisTokenGate.sol — holder tiers (Bronze/Silver/Gold), fee discounts
- [x] AegisVault upgrade — token-gated fee discounts, $UNIQ registration path
- [x] AegisRegistry upgrade — holder badge, priority tier consideration
- [x] AegisScanner.sol — on-chain token risk registry
- [x] Frontend $UNIQ integration — balance, tier display, benefits panel
- [x] Token Scanner — multi-source honeypot/rug pull/whale risk analysis
- [x] Agent $UNIQ awareness — price monitoring, discount paths
- [x] Production safety audit — all fake/simulated data removed
- [x] 198 total tests passing
- [x] Multi-page professional frontend (6 routes)

---

# PHASE 3: VENUS PROTOCOL + STOP-LOSS + TELEGRAM ✅ COMPLETE

> **Goal**: Real DeFi yield, automated protection, push notifications.

## 3.1 — Venus Protocol Integration ✅

- [x] AegisVault upgraded with Venus vBNB lending integration
  - `supplyToVenus()` — Deploy BNB to Venus lending market
  - `redeemFromVenus()` — Withdraw from Venus
  - `harvestVenusYield()` — Distribute yield to depositors
  - `getVenusInfo()` — Deployed amount, current value, pending yield, allocation
  - Configurable allocation (default 80% of vault to Venus)
  - Per-user yield tracking with performance fee (15%)
- [x] IVenusBNB.sol interface — mint, redeem, balanceOfUnderlying, exchangeRateCurrent
- [x] MockVenusBNB.sol — testnet simulator with realistic exchange rate mechanics
- [x] Venus monitor agent module (`agent/src/venus-monitor.ts`, 152 LOC)
- [x] Frontend vault page — Venus yield display, pending yield, APY estimate

## 3.2 — Automated Stop-Loss ✅

- [x] AegisVault stop-loss via PancakeSwap V2
  - `executeStopLoss()` — Swap BNB→USDT via PancakeSwap Router
  - `getStablecoinBalance()` / `withdrawStablecoin()` — USDT management
  - Per-user risk profile: `stopLossThreshold`, `allowAutoSwap`
  - Slippage protection built-in
- [x] IPancakeRouter.sol interface — swapExactETHForTokens
- [x] Stop-loss monitor agent module (`agent/src/stop-loss.ts`, 196 LOC)
  - BNB price monitoring via CoinGecko
  - Auto-trigger when threshold breached
  - Dry-run safety mode
- [x] Frontend vault page — stop-loss status, USDT balance, threshold config

## 3.3 — Telegram Bot ✅

- [x] Full Telegram bot (`bot/src/index.ts`, 554 LOC)
  - `/start` — Register with auto $UNIQ tier detection
  - `/scan <address>` — Token risk scan
  - `/vault` — Position, Venus yield, stop-loss status
  - `/alerts` — Subscribe to whale/price/vault alerts
  - `/price` — Live BNB price
- [x] Tier-gated features (Gold = all alerts, Bronze = basics)
- [x] On-chain event listening for vault deposits/withdrawals

## 3.4 — Frontend Redesign ✅

- [x] Guardian page rewritten as "Guardian Shield" — 24/7 continuous wallet monitoring
  - Auto-refresh every 60 seconds, monitoring status badge
  - Token-centric display: risky tokens as alert cards, safe tokens as compact rows
  - AI analysis card inline
  - Journey CTAs: Vault ("Your BNB Is Earning 0%") + $UNIQ/Telegram
- [x] Scanner page — dual mode: "Scan a Token" + "Scan Your Wallet"
  - Token mode: paste address → full risk report with shareable links
  - Wallet mode: connect wallet → scan ALL holdings → flag dangerous tokens
  - Journey CTAs: cross-sell to Guardian Shield + Vault
- [x] Navbar updated: Scanner, Guardian Shield, Vault
- [x] Homepage updated: 3-product flow (Scanner → Shield → Vault)

## 3.5 — Mainnet Preparation ✅

- [x] Real mainnet protocol addresses configured:
  - Venus vBNB: `0xA07c5b74C9B40447a954e1466938b865b6BBea36`
  - USDT: `0x55d398326f99059fF775485246999027B3197955`
  - PancakeSwap V2 Router: `0x10ED43C718714eb63d5aA57B78B54704E256024E`
  - WBNB: `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`
- [x] Constants renamed: MOCK_VENUS → VENUS_VBNB, MOCK_USDT → USDT
- [x] Deploy script cleaned of mock naming
- [x] Hardhat config: BSC Mainnet network ready (chainId 56)

### Phase 3 Deliverables
- [x] Venus Protocol yield integration (supply, redeem, harvest, per-user tracking)
- [x] Automated stop-loss via PancakeSwap V2 (BNB→USDT swap)
- [x] Telegram bot with tier-gated features
- [x] Venus monitor + stop-loss monitor agent modules
- [x] Frontend redesign: Guardian Shield, journey flow, vault yield display
- [x] Mainnet protocol addresses configured
- [x] 184 tests passing
- [x] 14,245 total LOC

---

# PHASE 4: SECURITY & BSC MAINNET LAUNCH 🔧 NEXT

> **Goal**: Audit, deploy to mainnet with real money.

## 4.1 — Security Audit (Week 1-2)

- [ ] **Static analysis**
  - Run Slither on all contracts
  - Run Mythril for symbolic execution
  - Fix all high/medium findings
  - Document accepted low findings

- [ ] **Internal audit checklist**
  - Reentrancy protection on all external calls ✓ (ReentrancyGuard)
  - Access control on all state-changing functions
  - Front-running vectors on executeProtection() / executeStopLoss()
  - Oracle manipulation resistance (PancakeSwap cross-check)
  - Venus integration edge cases (exchange rate manipulation, reentrancy)
  - Fee calculation precision (no rounding exploits)

- [ ] **External audit** (options by budget)
  - Budget: Code4rena competitive audit (~$5K-15K)
  - Mid: Hacken or CertiK lite (~$10K-30K)
  - Premium: Trail of Bits, OpenZeppelin (~$50K+)
  - Alternative: Apply for BNB Chain MVB grants

- [ ] **Bug bounty program**
  - Immunefi (BSC ecosystem standard)
  - Tiered: Low ($100) → Critical ($5,000)
  - Scope: All 5 production contracts

## 4.2 — Mainnet Infrastructure (Week 2-3)

- [ ] **Multisig wallet** — Gnosis Safe on BSC (2-of-3 initially)
  - Owner of all contracts transferred to multisig
  - Fee collection address = multisig

- [ ] **Mainnet RPC** — Ankr or QuickNode (paid, reliable)
  - Fallback: Public BSC RPC

- [ ] **Monitoring** — Tenderly for transaction monitoring
  - Alerts: failed TXs, large withdrawals, unusual gas
  - Agent health dashboard

- [ ] **Agent hosting** — 24/7 uptime
  - Railway.app / AWS EC2 / VPS
  - `DRY_RUN=false` in production
  - Auto-restart on crash

## 4.3 — Mainnet Deployment (Week 3-4)

- [ ] **Deploy script** (`scripts/deploy-mainnet.ts`)
  - Deploy: Registry, Vault, Logger, TokenGate, Scanner
  - Configure Venus with real vBNB address
  - Configure PancakeSwap Router for stop-loss
  - Set USDT as stablecoin
  - Register initial agent
  - Transfer ownership to Gnosis Safe
  - Verify all on BSCScan

- [ ] **Frontend mainnet switch**
  - Update CHAIN_ID to 56
  - Update all contract addresses
  - Add mainnet/testnet toggle

- [ ] **Agent mainnet config**
  - Update contract addresses
  - Set `DRY_RUN=false`
  - Configure mainnet RPC

## 4.4 — Soft Launch (Week 4-6)

- [ ] Invite-only: top $UNIQ holders + active community
- [ ] Limits: Max $1,000/user, $10,000 total TVL
- [ ] Monitor 1-2 weeks: deposits, risk assessments, fee calculations, Venus yield, stop-loss execution
- [ ] Gradual cap increases: $10K → $50K → $100K → uncapped
- [ ] Public launch announcement

### Phase 4 Deliverables
- [ ] Security audit report (internal + external)
- [ ] Bug bounty live on Immunefi
- [ ] Gnosis Safe multisig controlling all contracts
- [ ] All contracts deployed + verified on BSC Mainnet (Chain ID 56)
- [ ] Frontend with mainnet toggle
- [ ] Agent running 24/7 with monitoring
- [ ] Soft launch completed → public launch

---

# PHASE 5: MULTI-PROTOCOL EXPANSION (Month 2)

> **Goal**: PancakeSwap V3, additional lending, multi-token monitoring.

- [ ] PancakeSwap V3 adapter — concentrated liquidity, impermanent loss
- [ ] Additional lending protocols — Alpaca Finance, Radiant
- [ ] Arbitrary BSC token auto-detection — scan all tokens in wallet
- [ ] Adapter architecture — pluggable protocol adapters
- [ ] 200+ tests

---

# PHASE 6: STAKING & REVENUE SHARE (Month 3)

> **Goal**: Sustainable tokenomics — stake $UNIQ, earn from protocol activity.

- [ ] AegisStaking.sol — stake $UNIQ, earn share of protocol fees
- [ ] Revenue split: 30% stakers, 30% treasury, 20% buyback, 20% operations
- [ ] Frontend staking dashboard — APY, stake/unstake, claim rewards
- [ ] Snapshot.org governance — $UNIQ + staked $UNIQ voting

---

# PHASE 7: MULTI-CHAIN EXPANSION (Month 4+)

> **Goal**: Bring Aegis protection to every major EVM chain.

| Chain | DEX | Lending | Priority |
|-------|-----|---------|----------|
| Ethereum | Uniswap V3 | Aave V3 | High |
| Arbitrum | Uniswap V3, Camelot | Aave V3, Radiant | High |
| Base | Aerodrome | Moonwell | Medium |
| Polygon | QuickSwap | Aave V3 | Medium |

- [ ] Unified deploy script — same contracts, chain-specific configs
- [ ] Chain-specific adapters
- [ ] Single frontend with chain selector
- [ ] $UNIQ bridge — LayerZero OFT or Wormhole

---

# RISK REGISTER

| Risk | Impact | Mitigation |
|------|--------|------------|
| Smart contract exploit | Critical | Audit + bug bounty + gradual TVL caps |
| Venus integration risk | High | Exchange rate monitoring, emergency redeem |
| AI makes wrong call | High | Emergency withdrawal, dry-run mode, stop-loss caps |
| PancakeSwap stop-loss slippage | Medium | Configurable slippage tolerance, min output checks |
| Low adoption | Medium | $UNIQ incentives, reduced fees, Telegram outreach |
| $UNIQ price collapse | Medium | Real utility drives demand, buyback mechanism |
| API rate limits (Groq/CoinGecko) | Low | Heuristic fallback, multiple providers |

---

# KEY METRICS

| Metric | Phase 3 (Now) | Phase 4 Target | Phase 6 Target |
|--------|--------------|---------------|---------------|
| $UNIQ Holders | 500 | 1,000 | 5,000 |
| Total Value Protected | $0 (testnet) | $50,000 | $500,000 |
| Active Agents | testnet only | 25 | 200 |
| Tests Passing | 184 ✅ | 200+ | 260+ |
| Total LOC | 14,245 | 16,000+ | 20,000+ |
| Protocol Revenue | $0 | First fees | $5,000/mo |
| Venus Yield Distributed | testnet only | First yield | $1,000/mo |
| Stop-Loss Executions | testnet only | First protection | Continuous |

---

# IMMEDIATE NEXT STEPS

1. **Deploy mainnet script** — `scripts/deploy-mainnet.ts` with real Venus/PancakeSwap/USDT
2. **Run Slither** — Static analysis on all 5 production contracts
3. **Set up Gnosis Safe** — 2-of-3 multisig on BSC Mainnet
4. **Mainnet RPC** — QuickNode or Ankr for reliability
5. **Soft launch planning** — Whitelist, TVL caps, monitoring checklist
