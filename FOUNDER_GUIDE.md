# AEGIS PROTOCOL — FOUNDER GUIDE

**Last Updated**: April 9, 2026
**Version**: 2.0 — Post-Venus Integration, Mainnet-Ready

---

## ELEVATOR PITCH

Aegis Protocol is an  **AI-powered DeFi guardian** on BNB Chain. Users scan tokens for rug pulls, scan their entire wallet for hidden threats, deposit BNB into a protected vault that earns Venus Protocol yield, and set automated stop-loss orders — all managed by an autonomous AI agent that monitors 24/7.


**One sentence**: *Scan it, protect it, earn on it — the AI guardian for your BNB.*

---

## THE PRODUCT (What Users Actually Do)

### Three Products, One Platform

| Product | Type | What It Does | Revenue |
|---------|------|-------------|----------|
| **Token Scanner** | Free | Scan any token OR your entire wallet for honeypots, rug pulls, hidden taxes. Shareable results. | User acquisition |
| **Guardian Shield** | Freemium | Always-on 24/7 wallet monitoring. Auto-refreshes every 60s. Real-time alerts for rug pulls, whale dumps, liquidity pulls. | $UNIQ tier upgrades |
| **Protected Vault** | Paid | Deposit BNB → Venus/PancakeSwap yield → AI auto-protects. Performance fee on yield. | 10-20% performance fee |

### User Journey

```
1. SCAN A TOKEN       →  Paste any BSC address, get instant risk score (FREE)
2. SCAN YOUR WALLET   →  Connect wallet, scan ALL tokens, find dangerous ones (FREE)
3. GUARDIAN SHIELD     →  Activate 24/7 monitoring with real-time alerts (FREEMIUM)
4. DEPOSIT BNB         →  Protected vault, earning Venus Protocol yield (PAID)
5. HOLD $UNIQ          →  Reduced fees, priority alerts, Telegram, AI analysis
```

### Frontend Routes (Live)

| Route | Purpose | Description |
|-------|---------|-------------|
| `/` | Landing | Hero, features, journey flow, contract proof |
| `/scanner` | Token Scanner | Paste any BSC token address → instant honeypot/rug pull/whale risk analysis |
| `/guardian` | Guardian Shield | Connect wallet → AI monitors every token for rug pulls, whale dumps, liquidity pulls |
| `/vault` | Protected Vault | Deposit BNB → Venus yield + stop-loss + AI monitoring |
| `/scan/[address]` | Token Details | Deep dive on a specific token's risk profile |

**Live**: [aegis-protocol-1.vercel.app](https://aegis-protocol-1.vercel.app/)

---

## WHAT'S BUILT (April 2026)

### Smart Contracts — 7 contracts, 2,660 LOC Solidity

| Contract | LOC | What It Does |
|----------|-----|-------------|
| **AegisVault** | 1,164 | BNB/token deposits, Venus yield integration, stop-loss via PancakeSwap, per-user risk profiles, agent authorization, performance fees with $UNIQ discounts |
| **AegisRegistry** | 557 | ERC-721 agent NFT identity, 4 tiers (Scout → Archon), reputation scoring, $UNIQ holder badges |
| **DecisionLogger** | 337 | Immutable audit trail: every AI decision hashed and stored on-chain |
| **AegisScanner** | 181 | On-chain token risk registry (0-100 score), risk flags, honeypot/rug detection |
| **AegisTokenGate** | 200 | $UNIQ holder tiers (Bronze/Silver/Gold), fee discounts (0.10%–0.40%) |
| **MockVenusBNB** | 130 | Testnet Venus simulator |
| **MockERC20** | 19 | Testnet token helper |

### AI Agent Engine — 11 modules, 3,473 LOC TypeScript

| Module | LOC | Purpose |
|--------|-----|---------|
| **token-scanner.ts** | 522 | Multi-source honeypot/rug pull/whale risk scanning |
| **analyzer.ts** | 448 | 5-vector weighted risk scoring engine |
| **index.ts** | 406 | Main loop: OBSERVE → ANALYZE → AI REASON → DEX VERIFY → DECIDE → EXECUTE |
| **ai-engine.ts** | 380 | LLM-powered threat analysis (Groq Llama 3.3 70B / OpenAI GPT-4o) |
| **whale-tracker.ts** | 328 | Real-time BSC large transfer monitoring |
| **pancakeswap.ts** | 299 | On-chain DEX price verification via PancakeSwap V2 |
| **executor.ts** | 260 | On-chain transaction execution (protection actions) |
| **market-provider.ts** | 252 | CoinGecko + DeFiLlama live data feeds |
| **monitor.ts** | 230 | Position & market data monitor |
| **stop-loss.ts** | 196 | BNB price monitoring → auto stop-loss swap via PancakeSwap |
| **venus-monitor.ts** | 152 | Venus vBNB yield harvesting monitor |

### Telegram Bot — 554 LOC
 
- `/start` — Subscriber registration with $UNIQ tier detection
- `/scan <address>` — Token risk scan
- `/vault` — Your vault position, Venus yield, stop-loss status
- `/alerts` — Subscribe to whale/price/vault alerts
- `/price` — Live BNB price
- Tier-gated features: Gold gets all alerts, Bronze gets basics

### Frontend — Next.js 14, 5,241 LOC

- 4 user-facing pages + 1 dynamic route + 4 API routes
- Real-time market data (CoinGecko + PancakeSwap)
- Wallet connection (MetaMask) or read-only mode (public BSC RPC)
- Journey flow: Scanner → Guardian Shield → Vault
- Live on Vercel with BSC Testnet

### Tests — 184 passing, 2,317 LOC

```
AegisVault:      ~89 tests (Venus, stop-loss, deposits, fees, risk profiles)
AegisTokenGate:  ~36 tests (tiers, discounts, threshold updates)
AegisScanner:    ~31 tests (scan submission, risk tracking, authorization)
DecisionLogger:  ~28 tests (decision logging, risk snapshots, edge cases)
```

---

## TOTAL LOC

| Component | Lines of Code |
|-----------|--------------|
| Smart Contracts | 2,660 |
| AI Agent Engine | 3,473 |
| Telegram Bot | 554 |
| Frontend (Next.js) | 5,241 |
| Tests | 2,317 |
| **Total** | **14,245** |

---

## DEPLOYED CONTRACTS (BSC Testnet — Chain ID 97)

Deployed April 9, 2026.

| Contract | Address |
|----------|---------|
| AegisRegistry | [`0x806677bAb187157Ba567820e857e321c92E6C1EF`](https://testnet.bscscan.com/address/0x806677bAb187157Ba567820e857e321c92E6C1EF) |
| AegisVault | [`0xfa80515136Fc8CB2db3b25C317A1c9a04bcD3536`](https://testnet.bscscan.com/address/0xfa80515136Fc8CB2db3b25C317A1c9a04bcD3536) |
| DecisionLogger | [`0x978308DF80FE3AEDf228D58c3625db49e50FE51B`](https://testnet.bscscan.com/address/0x978308DF80FE3AEDf228D58c3625db49e50FE51B) |
| AegisScanner | [`0x8fa659D8edeffF0bBdEC37cB2c16C2f85491C840`](https://testnet.bscscan.com/address/0x8fa659D8edeffF0bBdEC37cB2c16C2f85491C840) |
| AegisTokenGate | [`0x0F998bb1B3866B73CAaBc54B7A84156b8F9f7543`](https://testnet.bscscan.com/address/0x0F998bb1B3866B73CAaBc54B7A84156b8F9f7543) |
| Venus vBNB (testnet) | [`0xb3798541B08916528e37457259Eb723DB662d77E`](https://testnet.bscscan.com/address/0xb3798541B08916528e37457259Eb723DB662d77E) |
| USDT (testnet) | [`0x6a3654cb5ae1D1377831714aA2fBF30794e836BE`](https://testnet.bscscan.com/address/0x6a3654cb5ae1D1377831714aA2fBF30794e836BE) |

**Configuration**:
- Registration fee: 0.001 BNB
- Protocol fee: 0.5% (50 bps) — reduced by $UNIQ tier
- Performance fee: 15% (1,500 bps) on Venus yield
- Min deposit: 0.001 BNB
- Max agents: 10,000

---

## $UNIQ TOKEN

| Property | Value |
|----------|-------|
| Contract | [`0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777`](https://bscscan.com/token/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777) |
| Chain | BNB Smart Chain (BSC Mainnet) |
| Supply | 1,000,000,000 (1B) |
| Tax | 3% |
| Ownership | Renounced |
| LP | Locked |

### Holder Tiers (On-Chain via AegisTokenGate)

| Tier | $UNIQ Required | Fee Discount | Benefits |
|------|---------------|--------------|----------|
| Free | 0 | 0% | Basic token scanner, public whale alerts |
| Bronze | 10,000 (~$30) | 10% | Wallet monitoring, personal whale alerts |
| Silver | 100,000 (~$300) | 25% | Priority alerts, Telegram notifications |
| Gold | 1,000,000 (~$3,000) | 40% | AI risk explanations, custom stop-loss, early access |

### Token Utility

1. **Fee discounts** — Hold more $UNIQ, pay less on vault operations
2. **Agent registration** — Register agents with $UNIQ at discounted rates
3. **Tier-gated features** — Telegram bot commands, alert types, priority
4. **Reputation boost** — $UNIQ holders get holder badge on agent NFTs
5. **Future**: Staking rewards from protocol fee revenue, governance voting

**Links**: [BSCScan](https://bscscan.com/token/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777) · [flap.sh](https://flap.sh/bnb/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777) · [Twitter](https://x.com/uniq_minds)

---

## KEY FEATURES — DETAILED

### 1. Token Scanner (Free — User Acquisition)

Two modes on one page:
- **Scan a Token** — Paste any BSC token address → instant honeypot/rug pull/whale risk report, shareable via X/Telegram
- **Scan Your Wallet** — Connect wallet → scan ALL tokens you hold → flag dangerous ones

Risk score: 0-100 with severity levels (LOW / MEDIUM / HIGH / CRITICAL).

### 2. Guardian Shield (Freemium — Retention)

Connect your wallet and Guardian Shield monitors continuously:
- Auto-refreshes every 60 seconds (always-on, not a one-time scan)
- Real-time alerts: rug pull signals, whale dumps, liquidity pulls, dev wallet movements
- Alert severity tiers: Critical / Warning / Info
- AI generates overall portfolio risk analysis
- Free tier: Basic alerts
- $UNIQ tier: Priority alerts, Telegram notifications, AI risk explanations

### 3. Protected Vault with Venus Yield

Deposit BNB into the Aegis Vault:
- **Venus Protocol integration** — Vault deploys BNB to Venus vBNB lending market
- **Configurable allocation** — Owner sets % of vault supplied to Venus (default 80%)
- **Yield harvesting** — Agent monitors and harvests Venus yield periodically
- **Performance fee** — 15% on yield earned (reduced by $UNIQ tier)
- **Per-user yield tracking** — Each depositor sees their share of yield earned
- **Emergency withdraw** — Always available, bypasses agent authorization

### 4. Automated Stop-Loss

Per-user stop-loss protection:
- User sets `stopLossThreshold` in their risk profile (e.g., 1000 bps = 10% drop)
- User enables `allowAutoSwap` flag
- Agent monitors BNB price via CoinGecko
- When price drops past threshold: auto-swaps BNB → USDT via PancakeSwap V2 Router
- USDT held in vault, withdrawable anytime
- Slippage protection built-in

### 5. AI Agent (Autonomous)

The guardian agent runs a continuous loop:

```
OBSERVE → ANALYZE → AI REASON → DEX VERIFY → DECIDE → EXECUTE
```

- **5-vector risk scoring**: Price (30%), Liquidity (25%), Volume (15%), Holders (15%), Momentum (15%)
- **LLM reasoning**: Groq (Llama 3.3 70B) or OpenAI (GPT-4o) for natural language threat analysis
- **DEX verification**: Cross-references CoinGecko prices against PancakeSwap V2 on-chain reserves
- **On-chain attestation**: Every decision hashed (keccak256) and stored in DecisionLogger
- **Heuristic fallback**: Works without API keys using rule-based analysis

### 6. Telegram Bot

Push alerts to Telegram:
- Token scan alerts — rug pull warnings
- Whale movement alerts — large BSC transfers
- Vault position updates — deposits, withdrawals, yield
- Stop-loss triggers — when protection fires
- BNB price feeds
- All tier-gated by $UNIQ balance

---

## ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                       USER JOURNEY                              │
│                                                                 │
│  Scan Token → Scan Wallet → Deposit BNB → Set Stop-Loss        │
│       ↓            ↓             ↓             ↓                │
│   /scanner    /guardian       /vault        Risk Profile        │
└──────┬────────────┬─────────────┬──────────────┬────────────────┘
       │            │             │              │
┌──────▼────────────▼─────────────▼──────────────▼────────────────┐
│                    SMART CONTRACTS (BSC)                         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────┐   │
│  │ Aegis    │  │ Aegis    │  │ Decision  │  │ AegisToken   │   │
│  │ Scanner  │  │ Vault    │  │ Logger    │  │ Gate ($UNIQ) │   │
│  │          │  │          │  │           │  │              │   │
│  │ Risk     │  │ Venus    │  │ AI Hash   │  │ Tiers +      │   │
│  │ Registry │  │ Yield    │  │ Audit     │  │ Discounts    │   │
│  │          │  │ StopLoss │  │ Trail     │  │              │   │
│  └──────────┘  └────┬─────┘  └───────────┘  └──────────────┘   │
│                      │                                          │
│              ┌───────▼────────┐  ┌────────────────┐             │
│              │  Venus vBNB    │  │  PancakeSwap   │             │
│              │  (Lending)     │  │  V2 Router     │             │
│              │                │  │  (Stop-Loss)   │             │
│              └────────────────┘  └────────────────┘             │
│                                                                 │
│  ┌──────────────┐                                               │
│  │AegisRegistry │  ERC-721 Agent NFTs + Reputation              │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────────────┐
│                    AI AGENT ENGINE                               │
│                                                                 │
│  Market Data ──▶ Risk Analysis ──▶ LLM Reasoning ──▶ Execute    │
│  (CoinGecko)    (5-vector)        (Groq/OpenAI)    (On-chain)  │
│  (DeFiLlama)                                                    │
│  (PancakeSwap)   Venus Monitor ──▶ Yield Harvest                │
│                  StopLoss Monitor ──▶ BNB→USDT Swap             │
└─────────────────────────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────────────┐
│                    TELEGRAM BOT                                  │
│                                                                 │
│  Scan alerts · Whale alerts · Vault updates · Price feeds       │
│  Tier-gated by $UNIQ balance                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## TECH STACK

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.24, OpenZeppelin 5.6.1, Hardhat 2.22.17 |
| AI Reasoning | Groq (Llama 3.3 70B) / OpenAI (GPT-4o) + heuristic fallback |
| DeFi Integrations | Venus Protocol (lending/yield), PancakeSwap V2 (stop-loss swaps, price oracle) |
| Risk Engine | 5-vector weighted scoring, per-user configurable thresholds |
| Live Data | CoinGecko (price/volume), DeFiLlama (TVL/liquidity), PancakeSwap (on-chain reserves) |
| Frontend | Next.js 14, Tailwind CSS, ethers.js v6, Vercel |
| Telegram | node-telegram-bot-api, tier-gated commands |
| Blockchain | BNB Smart Chain (BSC Testnet → Mainnet) |
| Testing | Hardhat + Chai, 184 tests |

---

## SECURITY

| Feature | Implementation |
|---------|---------------|
| Non-custodial | Users retain full control — emergency withdrawal always available |
| Agent authorization | Users explicitly authorize which agents can act |
| Risk profiles | Per-user configurable limits (slippage, stop-loss, action caps) |
| On-chain audit trail | Every AI decision hashed (keccak256) and stored in DecisionLogger |
| ReentrancyGuard | All fund-moving functions protected |
| OpenZeppelin | Battle-tested contract libraries (v5.6.1) |
| Dual-source price verification | CoinGecko + PancakeSwap on-chain cross-reference |
| Custom errors | Gas-optimized revert messages (19 custom errors) |
| Unchecked loop increments | Gas optimization on non-overflow paths |

---

## MAINNET READINESS

### What's Done
- [x] All contracts deployed and tested on BSC Testnet
- [x] 184 tests passing (zero failures)
- [x] Venus Protocol integration with real yield mechanics
- [x] Stop-loss with PancakeSwap V2 Router
- [x] Frontend live on Vercel
- [x] Telegram bot with tier-gated features
- [x] Real mainnet protocol addresses configured:
  - Venus vBNB: `0xA07c5b74C9B40447a954e1466938b865b6BBea36`
  - USDT: `0x55d398326f99059fF775485246999027B3197955`
  - PancakeSwap V2 Router: `0x10ED43C718714eb63d5aA57B78B54704E256024E`
  - WBNB: `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`

### What's Needed for Mainnet
- [ ] Security audit (Slither + Mythril at minimum, external audit recommended)
- [ ] Gnosis Safe multisig for contract ownership
- [ ] Mainnet RPC (Ankr or QuickNode for reliability)
- [ ] Agent hosting (24/7 uptime — Railway, AWS, or VPS)
- [ ] Deploy script for mainnet (`scripts/deploy-mainnet.ts`)
- [ ] Frontend chain switch (testnet → mainnet toggle)
- [ ] Soft launch with TVL caps
- [ ] Bug bounty program (Immunefi)

---

## COMPETITIVE ADVANTAGES

| Advantage | Detail |
|-----------|--------|
| **Full journey** | Scan → Protect → Earn. Not just monitoring, not just a vault — the complete path. |
| **AI-native** | Real LLM reasoning (Groq/OpenAI), not just threshold alerts |
| **Venus yield** | Idle BNB earns lending yield automatically |
| **Automated stop-loss** | On-chain BNB→USDT swap, no manual intervention needed |
| **Non-custodial** | Emergency withdraw always available, user retains full control |
| **On-chain proof** | Every AI decision hashed and stored immutably |
| **$UNIQ utility** | Real on-chain utility: fee discounts, tier gating, holder badges |
| **Telegram integration** | Push alerts — users don't need to check a dashboard |
| **BSC-native** | Low gas, fast blocks, massive DeFi ecosystem |

---

## BUSINESS MODEL

### Revenue Streams

| Source | Fee | Description |
|--------|-----|-------------|
| Protocol fee | 0.5% | On protection actions (reduced by $UNIQ tier) |
| Performance fee | 15% | On Venus yield earned |
| Agent registration | 0.001 BNB | Optional $UNIQ payment path |

### Fee Discount Schedule ($UNIQ Holders)

| Tier | Holding | Fee Discount |
|------|---------|-------------|
| Free | 0 | 0% (full fee) |
| Bronze | 10K $UNIQ | 10% off |
| Silver | 100K $UNIQ | 25% off |
| Gold | 1M $UNIQ | 40% off |

### Future Revenue (Roadmap)
- Staking rewards distribution (30% of fees to stakers)
- Multi-chain deployment fees
- Premium agent features

---

## PROJECT STRUCTURE

```
aegis-protocol/
├── contracts/                             # Solidity (2,660 LOC)
│   ├── AegisRegistry.sol                  # ERC-721 agent identity & reputation
│   ├── AegisVault.sol                     # Vault + Venus yield + stop-loss
│   ├── DecisionLogger.sol                 # On-chain decision audit log
│   ├── AegisScanner.sol                   # Token risk registry
│   ├── AegisTokenGate.sol                 # $UNIQ holder tiers & fee discounts
│   ├── interfaces/
│   │   ├── IVenusBNB.sol                  # Venus Protocol interface
│   │   └── IPancakeRouter.sol             # PancakeSwap V2 interface
│   └── mocks/
│       ├── MockVenusBNB.sol               # Testnet Venus simulator
│       └── MockERC20.sol                  # Testnet token helper
│
├── agent/                                 # AI Agent Engine (3,473 LOC)
│   └── src/
│       ├── index.ts                       # Main guardian loop
│       ├── ai-engine.ts                   # LLM reasoning (Groq/OpenAI)
│       ├── analyzer.ts                    # 5-vector risk scoring
│       ├── executor.ts                    # On-chain TX execution
│       ├── market-provider.ts             # CoinGecko + DeFiLlama feeds
│       ├── monitor.ts                     # Position & market monitor
│       ├── pancakeswap.ts                 # On-chain DEX price feeds
│       ├── token-scanner.ts              # Multi-source token risk scanner
│       ├── whale-tracker.ts               # Whale transfer monitoring
│       ├── venus-monitor.ts               # Venus yield harvesting
│       └── stop-loss.ts                   # BNB stop-loss via PancakeSwap
│
├── bot/                                   # Telegram Bot (554 LOC)
│   └── src/index.ts                       # Alert bot with tier-gated features
│
├── frontend/                              # Next.js 14 (5,241 LOC)
│   └── src/
│       ├── app/
│       │   ├── page.tsx                   # Landing page
│       │   ├── scanner/page.tsx           # Token scanner
│       │   ├── guardian/page.tsx           # Portfolio security (wallet scan)
│       │   ├── vault/page.tsx             # Protected vault + Venus + stop-loss
│       │   ├── scan/[address]/page.tsx    # Token detail page
│       │   └── api/                       # Backend API routes
│       │       ├── guardian/route.ts      # Wallet scan API
│       │       ├── scan/route.ts          # Token scan API
│       │       ├── vault/route.ts         # Vault data API
│       │       └── wallet/route.ts        # Wallet data API
│       ├── components/
│       │   ├── Navbar.tsx                 # Nav: Scanner, Guardian Shield, Vault
│       │   ├── Footer.tsx                 # Contract links, social
│       │   └── ClientLayout.tsx           # Wallet provider wrapper
│       └── lib/
│           ├── constants.ts               # Contract addresses, chain config
│           ├── WalletContext.tsx           # Wallet connection context
│           ├── abis.ts                    # Contract ABIs
│           ├── useContracts.ts            # Contract read/write hooks
│           ├── useLiveMarket.ts           # Live market data hook
│           └── useScrollReveal.ts         # Scroll animation hook
│
├── test/                                  # 184 tests (2,317 LOC)
│   ├── AegisVault.test.ts                 # Vault + Venus + stop-loss tests
│   ├── AegisTokenGate.test.ts             # Tier & discount tests
│   ├── AegisScanner.test.ts               # Scanner tests
│   └── DecisionLogger.test.ts             # Logger tests
│
├── scripts/
│   ├── deploy.ts                          # BSC Testnet deployment
│   ├── demo-e2e.ts                        # Local Hardhat E2E demo
│   ├── demo-onchain.ts                    # BSC Testnet demo (6 TXs)
│   └── demo-comprehensive.ts             # Full 15-phase threat lifecycle demo
│
├── hardhat.config.ts                      # BSC Testnet + Mainnet + opBNB config
├── deployment.json                        # Current deployed addresses
├── ROADMAP.md                             # 6-phase launch roadmap
├── FOUNDER_GUIDE.md                       # This file
└── README.md                              # Project documentation
```

---

## COMMANDS

```bash
# Install
npm install --legacy-peer-deps

# Run all 184 tests
npx hardhat test

# Compile contracts
npx hardhat compile

# Deploy to BSC Testnet
npx hardhat run scripts/deploy.ts --network bscTestnet

# Start AI agent
cd agent && npm install && npx ts-node src/index.ts

# Start Telegram bot
cd bot && npm install && npx ts-node src/index.ts

# Start frontend
cd frontend && npm install && npm run dev

# Build frontend for production
cd frontend && npm run build
```

---

## LINKS

| Resource | URL |
|----------|-----|
| Live Dashboard | [aegis-protocol-1.vercel.app](https://aegis-protocol-1.vercel.app/) |
| GitHub | [github.com/Tonyflam/aegis-protocol](https://github.com/Tonyflam/aegis-protocol) |
| $UNIQ Token | [BSCScan](https://bscscan.com/token/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777) |
| $UNIQ Chart | [flap.sh](https://flap.sh/bnb/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777) |
| Twitter | [@uniq_minds](https://x.com/uniq_minds) |
| Demo Video | [YouTube](https://youtu.be/zEeFEduh6eg) |
| Contracts (Testnet) | [BSCScan](https://testnet.bscscan.com/address/0xfa80515136Fc8CB2db3b25C317A1c9a04bcD3536) |

---

## MILESTONES

| Phase | Status | What Shipped |
|-------|--------|-------------|
| 1. Foundation | ✅ Complete | 5 contracts, 98 tests, CI/CD, gas optimization, branding |
| 2. $UNIQ Integration | ✅ Complete | AegisTokenGate, holder tiers, fee discounts, scanner, whale alerts |
| 3. Venus + Stop-Loss | ✅ Complete | Venus yield, PancakeSwap stop-loss, Telegram bot, 184 tests |
| 4. Multi-Protocol | Planned | PancakeSwap V3, additional lending protocols |
| 5. Staking | Planned | AegisStaking.sol, revenue share, governance |
| 6. Multi-Chain | Planned | Ethereum, Arbitrum, Base, Polygon |

**Next**: Security audit → Mainnet deployment → Soft launch with TVL caps.

---

## THE STORY

Aegis Protocol won **#6 out of 200 projects** in the BNB Chain "Good Vibes Only: OpenClaw Edition" hackathon. Since the hackathon:

- Rewrote the vault with Venus Protocol yield integration
- Added automated stop-loss via PancakeSwap
- Built a Telegram alert bot with tier-gated features
- Redesigned the frontend journey (Scanner → Guardian Shield → Vault)
- Expanded from 98 to 184 passing tests
- Prepared mainnet deployment tooling with real protocol addresses

The protocol is testnet-live, fully functional, and preparing for BSC Mainnet deployment.

---

*Aegis Protocol by [Uniq Minds](https://x.com/uniq_minds)*
*Your DeFi positions deserve a guardian that never sleeps.*
