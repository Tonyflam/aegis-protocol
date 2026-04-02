# Aegis Security OS — Architecture

> DeFi Security Operating System for BNB Chain Wallets

## System Overview

Aegis Security OS is a modular, engine-based architecture that provides comprehensive DeFi security for BNB Chain wallets. It scans tokens, monitors approvals, tracks whale movements, simulates transactions, and computes wallet/token security scores — all backed by persistent SQLite storage and exposed via a REST API.

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 14)                    │
│   /scanner  /alerts  /positions  /dashboard  /agent          │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (port 3001)
┌──────────────────────────▼──────────────────────────────────┐
│                    API Server (Express)                       │
│          server.ts — routes, CORS, error handling            │
└──────────────────────────┬──────────────────────────────────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
┌───▼───┐  ┌──────────────▼────────────┐  ┌──────▼──────┐
│ Types │  │       6 Engines            │  │ Persistence │
│       │  │                            │  │  (SQLite)   │
│index.ts│ │ wallet-scanner.ts          │  │  index.ts   │
│       │  │ approval-risk.ts           │  └─────────────┘
│       │  │ portfolio-guardian.ts       │
│       │  │ threat-intelligence.ts      │
│       │  │ transaction-firewall.ts     │
│       │  │ security-score.ts           │
│       │  └────────────────────────────┘
│       │              │
│       │       ┌──────▼──────┐
│       │       │     RPC     │
│       │       │  Provider   │
│       │       │  (rotation) │
│       │       └─────────────┘
└───────┘

┌─────────────────────────────────────────────────────────────┐
│                  Smart Contracts (BSC Testnet)                │
│   AegisVault · AegisRegistry · DecisionLogger                │
│   AegisTokenGate · AegisScanner · MockERC20                  │
└─────────────────────────────────────────────────────────────┘
```

## Engines

### 1. Wallet Scanner (`engines/wallet-scanner.ts`)
**Methods:** `scanToken(address)` → `TokenRiskReport`, `scanWallet(address)` → `PortfolioSnapshot`

Scans individual tokens and entire wallets for risk. Data sources:
- **Honeypot.is API** — honeypot detection, buy/sell tax
- **GoPlus Labs API** — contract verification, owner functions, proxy detection
- **PancakeSwap V2** — on-chain liquidity measurement
- **BSCScan API** — token discovery for wallet scans

Risk scoring: honeypot (+40), high tax (+15), unverified (+10), low liquidity (+15), whale dominated (+12), mint/pause/blacklist functions.

5-minute cache via SQLite. Safe tokens (WBNB, BUSD, USDT, CAKE, etc.) skip deep scanning.

### 2. Approval Risk Engine (`engines/approval-risk.ts`)
**Methods:** `scanApprovals(walletAddress)` → `ApprovalScanResult`

Discovers all ERC-20 token approvals via BSCScan transfer history, checks on-chain allowance against known DEX routers and exchanges.

Risk levels: SAFE → LOW → MEDIUM → HIGH → CRITICAL based on unlimited status and spender reputation.

### 3. Portfolio Guardian (`engines/portfolio-guardian.ts`)
**Methods:** `fullHealthCheck(address)` → `{portfolio, securityScore, alerts}`, `quickCheck(address)` → `SecurityScore`

Orchestrates Wallet Scanner + Approval Risk engines for comprehensive portfolio health assessment. Computes weighted security score:
- Token Safety (30%)
- Approval Hygiene (25%)
- Transaction Patterns (15%)
- Exposure Risk (15%)
- Historical Behavior (15%)

### 4. Threat Intelligence (`engines/threat-intelligence.ts`)
**Methods:** `scanToken(tokenAddress, bnbPrice, blockRange)` → `ThreatAlert[]`, `scanBNBWhales(bnbPrice, blockRange)` → `ThreatAlert[]`, `getRecentAlerts()` → `ThreatAlert[]`

Real-time whale and threat monitoring. Detects:
- `WHALE_SELL` — Large sells to DEX routers (>0.5% supply)
- `EXCHANGE_DEPOSIT` — Whale deposits to known exchanges
- `LARGE_TRANSFER` — Transfers >1% of supply

Incremental scanning via last-scanned-block tracking per token.

### 5. Transaction Firewall (`engines/transaction-firewall.ts`)
**Methods:** `simulate(tx)` → `TransactionSimulation`

Pre-sign transaction simulation and risk assessment. Decodes calldata for approve, transfer, and swap functions. Assesses risk:
- Unknown contract (+15)
- Unknown function (+10)
- Unlimited approval to unknown (+30)
- Large BNB transfer (+15)

### 6. Security Score Oracle (`engines/security-score.ts`)
**Methods:** `getWalletScore(address)` → `SecurityScore`, `getTokenScore(address)` → `SecurityScore`

B2B-ready security score API. 10-minute cache TTL. Persists to SQLite.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + engine status |
| GET | `/api/v1/scan/token/:address` | Scan a token for risks |
| GET | `/api/v1/scan/wallet/:address` | Scan all tokens in a wallet |
| GET | `/api/v1/approvals/:address` | Get all token approvals |
| GET | `/api/v1/portfolio/:address` | Full portfolio health check |
| GET | `/api/v1/score/wallet/:address` | Wallet security score |
| GET | `/api/v1/score/token/:address` | Token security score |
| GET | `/api/v1/threats/recent` | Recent threat alerts |
| GET | `/api/v1/threats/token/:address` | Scan token for whale activity |
| POST | `/api/v1/simulate` | Simulate a transaction |
| GET | `/api/v1/stats` | Engine run statistics |

## Persistence

SQLite with WAL mode via `better-sqlite3`. Tables:
- `token_scans` — Cached token risk reports
- `approval_scans` — Token approval records
- `portfolio_snapshots` — Portfolio history
- `threat_alerts` — Detected threats
- `tx_simulations` — Transaction simulation results
- `security_scores` — Cached security scores
- `engine_runs` — Engine execution log (timing, errors)

## Infrastructure

### RPC Provider (`providers/rpc.ts`)
5 BSC mainnet + 3 testnet endpoints with automatic rotation on failure. `withRetry<T>(fn, maxRetries=3)` for transparent failover.

### Smart Contracts (BSC Testnet)
| Contract | Address |
|----------|---------|
| AegisRegistry | `0x7908c25C63AbAB47cb82bE50DBD874ED807EE8fF` |
| AegisVault | `0x15Ef23024c2b90beA81E002349C70f0C2A09433F` |
| DecisionLogger | `0x874d78947bd660665de237b16Ca05cd39b7feF6f` |
| AegisTokenGate | `0x672c5cC370085c3c6B5bcf2870e1A0Aa62Ff3D69` |

### $UNIQ Token
`0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777` (BSC Mainnet)

Tiered access: Bronze (10K), Silver (100K), Gold (1M) $UNIQ

## Testing

- **198 smart contract tests** (Hardhat + Chai)
- **26 engine tests** (Jest + ts-jest)
  - Persistence layer: CRUD for all tables
  - Type constants: Exchange/DEX/dead address validation
  - RPC provider: Initialization and endpoint management

## Running

```bash
# Smart contract tests
npx hardhat test

# Engine tests
cd agent && npm test

# API server
cd agent && npm run server

# TypeScript check
cd agent && npx tsc --noEmit
```

## Frontend Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page — product overview |
| `/dashboard` | Protocol stats, risk monitoring |
| `/scanner` | Token risk scanner |
| `/alerts` | Threat intelligence feed |
| `/positions` | Portfolio health + approvals |
| `/agent` | AI agent details + simulation |

## Directory Structure

```
agent/src/
├── engines/              # 6 security engines
│   ├── wallet-scanner.ts
│   ├── approval-risk.ts
│   ├── portfolio-guardian.ts
│   ├── threat-intelligence.ts
│   ├── transaction-firewall.ts
│   ├── security-score.ts
│   └── index.ts          # barrel export
├── persistence/
│   └── index.ts          # SQLite layer
├── providers/
│   └── rpc.ts            # RPC rotation
├── types/
│   └── index.ts          # shared types + constants
├── __tests__/
│   ├── persistence.test.ts
│   ├── types.test.ts
│   └── rpc.test.ts
├── server.ts             # Express API server
├── index.ts              # Original agent loop
├── analyzer.ts           # Risk analyzer (original)
├── executor.ts           # On-chain executor (original)
├── ai-engine.ts          # LLM reasoning (original)
├── market-provider.ts    # CoinGecko/DeFiLlama (original)
├── pancakeswap.ts        # DEX oracle (original)
├── token-scanner.ts      # Token scanner (original)
├── whale-tracker.ts      # Whale tracker (original)
└── monitor.ts            # Position monitor (original)

frontend/src/
├── app/
│   ├── page.tsx          # Landing
│   ├── dashboard/page.tsx
│   ├── scanner/page.tsx  # Token scanner UI
│   ├── alerts/page.tsx   # Threat feed UI
│   ├── positions/page.tsx# Portfolio + approvals
│   ├── agent/page.tsx    # Agent simulation
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── ClientLayout.tsx
│   └── AgentSimulation.tsx
└── lib/
    ├── api.ts            # API client for engine endpoints
    ├── WalletContext.tsx  # Wallet provider
    ├── useLiveMarket.ts  # Market data hook
    ├── useContracts.ts   # Contract interaction hooks
    ├── useScrollReveal.ts
    ├── constants.ts
    └── abis.ts

contracts/
├── AegisVault.sol
├── AegisRegistry.sol
├── DecisionLogger.sol
├── AegisTokenGate.sol
├── AegisScanner.sol
└── MockERC20.sol
```
