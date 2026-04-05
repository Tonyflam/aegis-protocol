# Aegis Protocol — Mainnet Production Architecture

## How Everything Works on BSC Mainnet (Chain ID 56)

This document explains every component, every flow, and every interaction in the
Aegis Protocol system when running in full production on BNB Smart Chain Mainnet.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Smart Contract Layer (8 Contracts)](#2-smart-contract-layer)
   - [AegisScanner — The Security Oracle](#21-aegisscanner--the-security-oracle)
   - [AegisStaking — Agent Staking & Slashing](#22-aegisstaking--agent-staking--slashing)
   - [AegisConsensus — Multi-Agent Consensus](#23-aegisconsensus--multi-agent-consensus)
   - [AegisCertification — Soulbound Safety NFTs](#24-aegiscertification--soulbound-safety-nfts)
   - [AegisRegistry — Agent Identity NFTs](#25-aegisregistry--agent-identity-nfts)
   - [AegisVault — User Protection Vault](#26-aegisvault--user-protection-vault)
   - [DecisionLogger — Immutable Audit Trail](#27-decisionlogger--immutable-audit-trail)
   - [AegisTokenGate — $UNIQ Access Tiers](#28-aegistokengate--uniq-access-tiers)
3. [Off-Chain Agent Layer](#3-off-chain-agent-layer)
   - [Scan Service — PancakeSwap Listener](#31-scan-service--pancakeswap-listener)
   - [AI Agent Engine — Threat Detection & Protection](#32-ai-agent-engine--threat-detection--protection)
   - [Agent SDK — Third-Party Agent Plugin System](#33-agent-sdk--third-party-agent-plugin-system)
4. [Frontend Layer](#4-frontend-layer)
5. [The Complete Mainnet Flow (End to End)](#5-the-complete-mainnet-flow-end-to-end)
6. [Mainnet Migration Checklist](#6-mainnet-migration-checklist)
7. [Economic Model](#7-economic-model)
8. [Security Architecture](#8-security-architecture)
9. [Failure Modes & Recovery](#9-failure-modes--recovery)

---

## 1. System Overview

Aegis Protocol is a **decentralized security oracle network** for BNB Smart Chain.
It answers one question for every token on BSC: **"Is this token safe to buy?"**

```
┌──────────────────────────────────────────────────────────────────┐
│                       BSC MAINNET (Chain 56)                     │
│                                                                  │
│  PancakeSwap V2 Factory                                          │
│  0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73                      │
│       │                                                          │
│       │ PairCreated(token0, token1, pair)                         │
│       ▼                                                          │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐      │
│  │ Scan Service │───▶│ AegisScanner │◀───│ AegisConsensus  │      │
│  │ (off-chain)  │    │ (oracle)     │    │ (multi-agent)   │      │
│  └──────┬──────┘    └──────┬───────┘    └────────┬────────┘      │
│         │                  │                     │               │
│         │           ┌──────┴──────┐        ┌─────┴──────┐        │
│         │           │ Anyone can  │        │ 3+ staked  │        │
│         │           │ query:      │        │ agents     │        │
│         │           │ isTokenSafe │        │ attest     │        │
│         │           │ getTokenRisk│        └────────────┘        │
│         │           └─────────────┘                              │
│    ┌────┴────┐                                                   │
│    │ GoPlus  │  External security API                            │
│    │ Labs    │  (honeypot, tax, ownership)                       │
│    └─────────┘                                                   │
│                                                                  │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────┐       │
│  │ AegisStaking  │  │ AegisVault   │  │ AegisCertification│      │
│  │ ($UNIQ stake) │  │ (user funds) │  │ (safety NFTs)     │      │
│  └───────────────┘  └──────────────┘  └──────────────────┘       │
│                                                                  │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────┐       │
│  │ AegisRegistry │  │ DecisionLogger│ │ AegisTokenGate   │      │
│  │ (agent NFTs)  │  │ (audit trail) │ │ ($UNIQ tiers)    │      │
│  └───────────────┘  └──────────────┘  └──────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

**What happens on mainnet that doesn't happen on testnet:**

| Aspect | Testnet (now) | Mainnet (production) |
|--------|---------------|---------------------|
| PairCreated events | Rare (low activity) | Hundreds per day |
| GoPlus data | Often empty/unavailable | Full coverage for BSC tokens |
| $UNIQ token | Mock ERC-20 | Real deployed $UNIQ on BSC |
| Staking | Simulated | Real $UNIQ at stake, real slashing |
| Consensus | Single-agent bypass | Requires 3+ independent agents |
| Gas costs | Free tBNB | Real BNB (~$0.02–0.10 per tx) |
| Vault deposits | Test BNB | Real user funds |
| Protection actions | Logged only | Actual emergency withdrawals triggered |

---

## 2. Smart Contract Layer

### 2.1 AegisScanner — The Security Oracle

**Purpose:** The central on-chain database of token risk scores. Any smart contract
on BSC can call `isTokenSafe(token)` before allowing a swap/deposit/approval.

**How it works on mainnet:**

1. Authorized scanner agents call `submitScan()` to write risk data on-chain
2. Any DeFi protocol calls `isTokenSafe()` / `getTokenRisk()` to check a token
3. Batch queries via `isTokenSafeBatch()` for DEX aggregators processing multiple tokens

**Data stored per token:**

```
TokenScan {
    token:           address     // The BEP-20 token address
    riskScore:       uint256     // 0 (safe) to 100 (dangerous)
    liquidityUSD:    uint256     // Total liquidity in USD (wei precision)
    holderCount:     uint256     // Number of unique holders
    topHolderPct:    uint256     // Top holder's share in basis points (e.g., 5000 = 50%)
    buyTaxBps:       uint256     // Buy tax in basis points (e.g., 1000 = 10%)
    sellTaxBps:      uint256     // Sell tax in basis points
    honeypot:        bool        // Cannot sell after buying
    canMint:         bool        // Owner can mint new tokens
    canPause:        bool        // Owner can pause transfers
    canBlacklist:    bool        // Owner can blacklist addresses
    renounced:       bool        // Ownership renounced
    lpLocked:        bool        // Liquidity pool locked
    verified:        bool        // Contract source verified on BSCScan
    scannedAt:       uint256     // Block timestamp of last scan
    scannedBy:       address     // Agent that submitted this scan
    flags:           string      // Comma-separated: "HONEYPOT,HIGH_TAX,UNVERIFIED"
    reasoningHash:   bytes32     // Keccak256 of the AI reasoning text
    blockNumber:     uint256     // Block number when scanned
}
```

**Key thresholds:**

| Parameter | Value | Meaning |
|-----------|-------|---------|
| `RISK_THRESHOLD` | 70 | Score ≥ 70 = unsafe. `isTokenSafe()` returns `false`. |
| `stalenessThreshold` | 24 hours | Scans older than this are considered stale. |
| `MAX_RECENT_SCANS` | 100 | Rolling buffer of recent scan entries for UI display. |

**Who can write:**
- Only addresses granted `authorizedScanners[addr] = true` by the contract owner
- On mainnet, these are the agent wallets that have staked in AegisStaking

**Who can read (free, no gas for view calls):**
- **Any smart contract:** `IAegisScanner(oracle).isTokenSafe(token)`
- **Any wallet:** Direct ethers.js / web3 calls
- **Any frontend:** Via RPC provider

**Integration pattern for other DeFi protocols:**

```solidity
import "./interfaces/IAegisScanner.sol";

contract MyDEX {
    IAegisScanner public aegis;

    modifier aegisSafe(address token) {
        require(aegis.isTokenSafe(token), "Aegis: token flagged as unsafe");
        _;
    }

    function swap(address tokenIn, address tokenOut, uint256 amount)
        external
        aegisSafe(tokenIn)
        aegisSafe(tokenOut)
    {
        // Safe to proceed — both tokens passed Aegis screening
    }
}
```

---

### 2.2 AegisStaking — Agent Staking & Slashing

**Purpose:** Agents must lock $UNIQ tokens to participate in the oracle network.
The more they stake, the higher their tier, and the more weight their scans carry.
If an agent submits provably incorrect data, their stake is slashed.

**Tier system:**

| Tier | $UNIQ Required | Consensus Weight | What It Means |
|------|---------------|-----------------|---------------|
| **Scout** | 10,000 | 1× (10,000 bps) | Entry-level. Can scan, low influence on consensus. |
| **Guardian** | 100,000 | 3× (30,000 bps) | Trusted scanner. Moderate consensus influence. |
| **Sentinel** | 500,000 | 8× (80,000 bps) | Senior agent. High influence, faster finalization. |
| **Archon** | 1,000,000 | 20× (200,000 bps) | Maximum tier. Dominant consensus weight. |

**Mainnet staking lifecycle:**

```
Agent stakes 100,000 $UNIQ
       │
       ▼
  ┌────────────┐
  │ Guardian   │──── Agent can now submit attestations
  │ Tier       │     with 3× consensus weight
  └─────┬──────┘
        │
        │   (Agent submits wrong data)
        ▼
  ┌────────────┐
  │ SLASHED    │──── Owner calls slash(agent, amount)
  │ -50K UNIQ  │     Slashed tokens sent to treasury
  └─────┬──────┘
        │
        │   (Agent drops below 100K)
        ▼
  ┌────────────┐
  │ Scout Tier │──── Downgraded, weight drops to 1×
  └─────┬──────┘
        │
        │   (Agent requests unstake)
        ▼
  ┌────────────┐
  │ COOLDOWN   │──── 7-day waiting period
  │ (7 days)   │     Cannot scan during cooldown
  └─────┬──────┘
        │
        ▼
  ┌────────────┐
  │ WITHDRAWN  │──── Agent receives remaining $UNIQ back
  └────────────┘
```

**Key functions:**

| Function | Who Calls | What It Does |
|----------|-----------|-------------|
| `stake(amount)` | Agent | Lock $UNIQ, get tier assignment |
| `requestUnstake()` | Agent | Start 7-day cooldown |
| `completeUnstake()` | Agent | Withdraw after cooldown |
| `slash(agent, amount)` | Owner only | Penalize bad data submission |
| `getStakeTier(agent)` | Anyone (view) | Returns current tier enum |
| `getConsensusWeight(agent)` | Consensus contract | Returns weight multiplier |

---

### 2.3 AegisConsensus — Multi-Agent Consensus

**Purpose:** No single agent's word is trusted. Multiple staked agents must independently
scan the same token. Their results are aggregated using stake-weighted averaging and
outlier detection to produce a final "consensus" score.

**This is the core decentralization mechanism of Aegis Protocol.**

**Consensus flow on mainnet:**

```
Step 1: Agent A (Sentinel, 8×) scans token X → submits attestation (score: 72)
Step 2: Agent B (Guardian, 3×) scans token X → submits attestation (score: 68)
Step 3: Agent C (Scout, 1×)    scans token X → submits attestation (score: 95)
                                                                ▲
                                                          outlier detected
                                                          (>30 from median)

Step 4: Anyone calls finalizeConsensus(tokenX)

Finalization computes:
  1. Median risk score: 72 (middle of [68, 72, 95])
  2. Outlier check: Agent C's 95 deviates 23 points from median 72
       → 23 > OUTLIER_SD_THRESHOLD (30)? No → not flagged
     (If it were 105 or higher, Agent C would be flagged as outlier)
  3. Weighted average: (72×80000 + 68×30000 + 95×10000) / (80000+30000+10000)
     = (5,760,000 + 2,040,000 + 950,000) / 120,000
     = 72.9 → final score: 73
  4. Boolean flag voting (honeypot, canMint, etc.):
     Each flag resolved by weighted majority.
     If agents with >50% of total weight voted "true" → flag = true

Step 5: Result submitted to AegisScanner.submitScan(tokenX, 73, ...)
         → Token X now has a consensus-backed risk score on-chain
```

**Dispute mechanism:**

Any staked agent who disagrees with a finalized consensus score can challenge it:

1. Challenger locks 50,000 $UNIQ as dispute stake
2. Dispute period opens — other agents can submit additional attestations
3. Protocol owner (or future DAO) resolves the dispute:
   - **Upheld:** Challenger wins, gets dispute stake back + reward from slashed agents
   - **Rejected:** Challenger loses their 50,000 $UNIQ dispute stake

**Key parameters:**

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `MIN_ATTESTATIONS` | 3 | Minimum independent scans before finalization |
| `MAX_ATTESTATIONS` | 20 | Cap per consensus round |
| `OUTLIER_SD_THRESHOLD` | 30 | Points deviation from median to flag outlier |
| `DISPUTE_STAKE` | 50,000 $UNIQ | Cost to challenge a consensus result |

---

### 2.4 AegisCertification — Soulbound Safety NFTs

**Purpose:** Token projects that continuously pass Aegis security scanning can earn
a non-transferable "Aegis Certified" NFT. This is a visible trust signal for users.

**Mainnet certification lifecycle:**

```
1. Token project calls certify(tokenAddress)
   └── Pays certification fee: 100,000 $UNIQ
   └── Contract checks:
       ├── AegisScanner.isScanned(token) == true? ✓
       └── AegisScanner.isTokenSafe(token) == true? ✓

2. ERC-721 NFT minted to the project's address
   └── SOULBOUND: cannot be transferred (overrides transferFrom to revert)
   └── Contains: token address, certified-at timestamp, risk score at certification

3. Continuous monitoring:
   └── If the token's risk score EVER rises above 70 (RISK_THRESHOLD):
       └── ANYONE can call revokeCertification(tokenAddress)
       └── NFT is burned
       └── Project must re-certify (and pay again)
```

**Why it matters on mainnet:**
- DeFi protocol UIs can display "Aegis Certified ✓" badge
- Smart contracts can check `isCertified(token)` for an extra trust layer
- Projects have financial incentive (100K $UNIQ) to maintain clean code

---

### 2.5 AegisRegistry — Agent Identity NFTs

**Purpose:** Every AI agent in the network is registered as an ERC-721 NFT. This
gives each agent a verifiable on-chain identity with performance history.

**Agent metadata stored on-chain:**

```
AgentInfo {
    name:                 string    // "AegisScout-Alpha"
    agentURI:             string    // IPFS URI for off-chain metadata
    operator:             address   // Wallet that controls this agent
    registeredAt:         uint256   // Registration timestamp
    totalDecisions:       uint256   // How many decisions this agent has made
    successfulActions:    uint256   // How many were successful
    totalValueProtected:  uint256   // Total USD value this agent has protected
    status:               uint8     // 0=Active, 1=Paused, 2=Deactivated
    tier:                 uint8     // 0=Scout, 1=Guardian, 2=Sentinel, 3=Archon
}
```

**Mainnet registration flow:**

1. Agent operator calls `registerAgent(name, uri)` + pays 0.001 BNB fee
2. ERC-721 NFT minted — agent ID = token ID
3. $UNIQ holders get fee discounts via AegisTokenGate tier
4. Agent's performance metrics update as it submits scans/decisions
5. Other agents can leave reputation reviews (1–5 rating)

**Key limits:**
- Maximum 10,000 agents total (hard cap)
- Each operator can register multiple agents
- Agent NFTs are transferable (agent ownership can change)

---

### 2.6 AegisVault — User Protection Vault

**Purpose:** Users deposit BNB or BEP-20 tokens and authorize specific AI agents
to execute protective actions on their portfolio. The agents can protect but **cannot steal** — only specific security actions are allowed.

**How it works on mainnet:**

```
User deposits 10 BNB into AegisVault
       │
       ▼ 
  ┌──────────────────────────────────────────┐
  │ User sets Risk Profile:                  │
  │   maxSlippageBps: 300 (3%)               │
  │   stopLossBps: 1500 (15%)                │
  │   autoWithdrawOnThreat: true             │
  │   maxProtectionAmount: 5 BNB             │
  └──────────┬───────────────────────────────┘
             │
             │  User calls authorizeAgent(agentId)
             ▼
  ┌──────────────────────────────────────────┐
  │ Agent monitors user's positions          │
  │ via off-chain AI engine                  │
  └──────────┬───────────────────────────────┘
             │
             │  Agent detects threat (price crash, rug pull)
             ▼
  ┌──────────────────────────────────────────┐
  │ Agent calls executeProtection():         │
  │                                          │
  │ Allowed actions:                         │
  │  0 - EmergencyWithdraw                   │
  │  1 - Rebalance                           │
  │  2 - AlertOnly (log, no fund movement)   │
  │  3 - StopLoss                            │
  │  4 - TakeProfit                          │
  │                                          │
  │ Constraints:                             │
  │  - Cannot exceed maxProtectionAmount     │
  │  - Must match user's risk profile        │
  │  - All actions logged to DecisionLogger  │
  └──────────────────────────────────────────┘
```

**Protocol fees:**
- Base fee: 50 basis points (0.50%) on deposits
- $UNIQ holders get discounts:
  - Bronze (10K $UNIQ): 0.10% discount → effective 0.40%
  - Silver (100K $UNIQ): 0.25% discount → effective 0.25%
  - Gold (1M $UNIQ): 0.40% discount → effective 0.10%
- Minimum deposit: 0.001 BNB

---

### 2.7 DecisionLogger — Immutable Audit Trail

**Purpose:** Every decision made by every AI agent is permanently recorded on-chain.
This creates a transparent, auditable history that proves agents are acting correctly.

**What gets logged:**

```
Decision {
    decisionId:     uint256     // Sequential ID
    timestamp:      uint256     // When the decision was made
    agentId:        uint256     // Which agent made it
    targetUser:     address     // Who it was about (or token address for scans)
    decisionType:   uint8       // 0=RiskAssessment, 1=ThreatDetected,
                                // 2=ProtectionTriggered, 3=AlertIssued
    riskLevel:      uint8       // 1=Low, 2=Medium, 3=High, 4=Critical
    confidence:     uint256     // 0–10000 (basis points, 10000 = 100%)
    analysisHash:   bytes32     // Keccak256 of full analysis text
    dataHash:       bytes32     // Keccak256 of input data used
    actionTaken:    bool        // Was a protection action executed?
    actionId:       uint256     // Which protection action
}
```

**Why it matters on mainnet:**
- Users can verify their agent isn't acting maliciously
- Slashing decisions can reference DecisionLogger entries as evidence
- Reputation scores in AegisRegistry are backed by real decision logs
- Regulatory compliance — full audit trail for automated financial actions

---

### 2.8 AegisTokenGate — $UNIQ Access Tiers

**Purpose:** Holding $UNIQ unlocks fee discounts and premium features across
every contract in the protocol.

**Tier structure:**

| Tier | $UNIQ Balance | Fee Discount | Access Granted |
|------|--------------|-------------|----------------|
| None | < 10,000 | 0 | Basic oracle queries |
| **Bronze** | 10,000+ | 10 bps (0.10%) | Reduced vault fees, basic API |
| **Silver** | 100,000+ | 25 bps (0.25%) | Priority scanning, agent dashboard |
| **Gold** | 1,000,000+ | 40 bps (0.40%) | Maximum discounts, governance voting |

**Used by:**
- AegisVault: Fee discounts on deposits
- AegisRegistry: Fee discounts on agent registration
- AegisStaking: (Future) Bonus staking rewards for $UNIQ holders

---

## 3. Off-Chain Agent Layer

### 3.1 Scan Service — PancakeSwap Listener

**File:** `agent/src/scan-service.ts` (~730 lines)

**Purpose:** Standalone Node.js process running 24/7 that watches PancakeSwap V2 Factory
for new token pair listings and scans each new token automatically.

**Mainnet configuration:**

| Parameter | Testnet Value | Mainnet Value |
|-----------|--------------|---------------|
| RPC URL | `bsc-testnet-rpc.publicnode.com` | `bsc-dataseed1.binance.org` |
| Chain ID | 97 | 56 |
| Factory | `0xB7926C0430...` | `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` |
| GoPlus chain | `97` | `56` |
| Poll interval | 15s | 12s (aligned with BSC block time) |
| Lookback blocks | 5,000 | 10,000 |
| Gas price | 10 Gwei | 3 Gwei |

**Complete scan pipeline (what happens every 12 seconds on mainnet):**

```
TICK START
  │
  ├── 1. Get current block number from BSC RPC
  │
  ├── 2. Query PancakeSwap Factory for PairCreated events
  │      Range: lastBlock → currentBlock (max 50 blocks per query)
  │
  ├── 3. For each PairCreated event:
  │      ├── Extract token0, token1, pair addresses from event args
  │      ├── Filter out base tokens (WBNB, BUSD, USDT, USDC)
  │      ├── Check in-memory set: already scanned this session?
  │      └── Check on-chain: scanner.isScanned(token)?
  │
  ├── 4. For each new token, run scanAndSubmit():
  │      │
  │      ├── 4a. Get token basics (name, symbol, decimals via ERC-20)
  │      │
  │      ├── 4b. Query GoPlus Labs API:
  │      │        URL: api.gopluslabs.com/api/v1/token_security/56?contract_addresses=0x...
  │      │        Returns: is_honeypot, buy_tax, sell_tax, is_open_source,
  │      │                 holder_count, owner_change_balance, hidden_owner,
  │      │                 can_take_back_ownership
  │      │        Retry: 3× exponential backoff (2s, 4s, 8s) on 429 or failure
  │      │
  │      ├── 4c. Compute risk score:
  │      │        Base score: 30 (unknown token baseline)
  │      │          +100 if honeypot (caps at 100)
  │      │          +20  if buy tax > 10%
  │      │          +20  if sell tax > 10%
  │      │          +15  if contract unverified
  │      │          +25  if owner can change balances
  │      │          +10  if hidden owner
  │      │          +15  if can take back ownership
  │      │          -20  if GoPlus confirms fully clean
  │      │        Final: clamped to 0–100
  │      │
  │      ├── 4d. Build reasoning text and hash it:
  │      │        "Token: XYZ (0x...)
  │      │         Score: 85/100
  │      │         Honeypot: true
  │      │         Buy Tax: 99.0% | Sell Tax: 99.0%
  │      │         Holders: 3
  │      │         Flags: HONEYPOT,HIGH_TAX,HIGH_SELL_TAX
  │      │         Scan: 2026-04-04T12:00:00Z"
  │      │        reasoningHash = keccak256(reasoning)
  │      │
  │      ├── 4e. Submit on-chain:
  │      │        scanner.submitScan(
  │      │          token, riskScore, liquidityUSD, holderCount,
  │      │          topHolderPctBps, buyTaxBps, sellTaxBps,
  │      │          [honeypot, canMint, canPause, canBlacklist,
  │      │           renounced, lpLocked, verified],
  │      │          "HONEYPOT,HIGH_TAX",
  │      │          reasoningHash
  │      │        )
  │      │        Gas: ~200K–350K gas per submitScan
  │      │        Cost: ~$0.02–0.05 at 3 Gwei + BSC gas prices
  │      │
  │      └── 4f. Log to DecisionLogger:
  │               logger.logDecision(agentId, token, RiskAssessment,
  │                 riskLevel, confidence, analysisHash, dataHash,
  │                 actionTaken=true, actionId=0)
  │
  ├── 5. Low-activity check:
  │      If 5+ consecutive empty polls → warn "low liquidity activity"
  │      (Unlikely on mainnet — PancakeSwap sees dozens of new pairs daily)
  │
  └── 6. Every 20 ticks: print stats (pairs detected, scans submitted, etc.)

TICK END → sleep 12s → TICK START
```

**RPC fallback strategy:**

```
Primary:   bsc-dataseed1.binance.org (Binance official)
Fallback1: bsc-rpc.publicnode.com (Publicnode)
Fallback2: bsc-dataseed2.binance.org (Binance backup)

On RPC failure:
  1. Increment failure counter
  2. Try next RPC in rotation
  3. Validate new RPC responds (getBlockNumber)
  4. Rebuild all contract instances on new provider
  5. Wait 3s before resuming
```

**Manual scan HTTP server (runs alongside the listener):**

```
POST http://localhost:3001/scan
  Body: {"token": "0x..."}
  Response: {"success": true, "message": "Scan submitted to oracle", "riskScore": 42}

GET http://localhost:3001/status
  Response: {
    "running": true,
    "uptime": 86400,
    "pairsDetected": 147,
    "scansSubmitted": 89,
    "scansFailed": 3,
    "honeypotsFound": 12,
    "manualScans": 5,
    "rpcFailures": 2,
    "tokensTracked": 94,
    "lastBlock": 48123456
  }
```

---

### 3.2 AI Agent Engine — Threat Detection & Protection

**File:** `agent/src/index.ts`

**Purpose:** Full autonomous agent that monitors user positions in AegisVault
and executes protective actions when threats are detected. Uses LLM reasoning
to analyze market conditions.

**Execution cycle (every 30 seconds on mainnet):**

```
┌──────────────────────────────────────────────────────────┐
│ PHASE 1: OBSERVE                                         │
│                                                          │
│ Fetch market data for monitored tokens:                  │
│   - Current price (CoinGecko/DexScreener)                │
│   - 24h volume                                           │
│   - Total liquidity                                      │
│   - Holder count                                         │
│   - Price change (1h, 24h)                               │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│ PHASE 2: ANALYZE                                         │
│                                                          │
│ Multi-factor risk assessment:                            │
│   - Price volatility score                               │
│   - Liquidity adequacy score                             │
│   - Holder concentration score                           │
│   - Smart contract risk score (from AegisScanner)        │
│   - Combined weighted risk snapshot                      │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│ PHASE 2.5: AI REASONING (LLM)                           │
│                                                          │
│ Send to Groq (llama-3.3-70b) or OpenAI (gpt-4o-mini):   │
│                                                          │
│ Prompt: "You are a DeFi security agent. Analyze:         │
│   {price, volume, liquidity, holders, riskScore}         │
│   Respond in JSON: {                                     │
│     reasoning: string,                                   │
│     riskScore: 0-100,                                    │
│     threats: ['PRICE_CRASH', 'RUG_PULL'...],             │
│     suggestedActions: ['ALERT', 'EMERGENCY_WITHDRAW'],   │
│     marketSentiment: 'bearish'                           │
│   }"                                                     │
│                                                          │
│ Fallback: If LLM unavailable, use heuristic scoring      │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│ PHASE 2.7: DEX VERIFICATION                             │
│                                                          │
│ Query PancakeSwap on-chain:                              │
│   - Verify token price matches oracle data               │
│   - Check LP pool reserves for manipulation              │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│ PHASE 3: DECIDE                                          │
│                                                          │
│ Threat detection rules:                                  │
│   PRICE_CRASH:     Price dropped >30% in 1 hour          │
│   LIQUIDITY_DRAIN: Liquidity dropped >50% suddenly       │
│   RUG_PULL:        LP removed + honeypot flags           │
│   WHALE_DUMP:      Top holder selling >10% of supply     │
│   CONTRACT_RISK:   AegisScanner score ≥ 70               │
│                                                          │
│ Severity: LOW → MEDIUM → HIGH → CRITICAL                 │
│ Only HIGH+ triggers automatic protection actions         │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│ PHASE 4: EXECUTE                                         │
│                                                          │
│ If severity ≥ HIGH and user has autoWithdrawOnThreat:    │
│   1. Call AegisVault.executeProtection(userId, action)    │
│   2. Log decision to DecisionLogger                      │
│   3. Update agent stats in AegisRegistry                 │
│                                                          │
│ If severity < HIGH:                                      │
│   1. Log AlertOnly decision to DecisionLogger            │
│   2. Frontend can display the alert                      │
└──────────────────────────────────────────────────────────┘
```

**Parallel subsystems running in the agent:**

| Subsystem | Interval | What It Does |
|-----------|----------|-------------|
| PositionMonitor | 30s | Watches vault for user deposits/withdrawals |
| RiskAnalyzer | 30s | Multi-factor risk scoring |
| AIReasoningEngine | 30s | LLM threat analysis |
| PancakeSwapProvider | 30s | On-chain price verification |
| OnChainExecutor | On demand | Submits decisions + executes protections |
| AutoScanner | 30s | Parallel token scanning (uses auto-scanner.ts) |

---

### 3.3 Agent SDK — Third-Party Agent Plugin System

**Package:** `agent-sdk/`

**Purpose:** Allows third-party developers to build their own Aegis-compatible scanning
agents using a plugin architecture.

**Plugin interfaces:**

```typescript
// Anyone can write a custom scanner
interface IScanner {
    name: string;
    scan(token: string): Promise<ScanResult>;
}

// Custom analysis logic
interface IAnalyzer {
    name: string;
    analyze(token: string, scans: ScanResult[]): Promise<AnalysisResult>;
}

// Custom on-chain submission
interface ISubmitter {
    submit(attestation: Attestation): Promise<string>; // returns tx hash
}
```

**Example: Building a custom agent for mainnet:**

```typescript
import { AegisAgent } from "@aegis-protocol/agent-sdk";

const agent = new AegisAgent({
    privateKey: process.env.PRIVATE_KEY,
    rpcUrl: "https://bsc-dataseed1.binance.org",
    contracts: {
        scanner: "0x...",    // Mainnet AegisScanner address
        staking: "0x...",    // Mainnet AegisStaking address
        consensus: "0x...",  // Mainnet AegisConsensus address
    },
});

// Add custom scanners (run in parallel)
agent.addScanner(new HoneypotIsScanner());
agent.addScanner(new TokenSnifferScanner());
agent.addScanner(new ManualBytecodeScanner());

// Custom analysis merges all scanner results
agent.addAnalyzer(new WorstCaseMerger());

// Submit to consensus
const txHash = await agent.scanAndAttest("0xTokenAddress...");
```

---

## 4. Frontend Layer

**Framework:** Next.js 14 (App Router) — deployed as a static/SSR web application.

**Positioning:** AegisScanner is the primary product surface. The homepage is the scanner itself — like Chainlink for token safety on BNB Chain. Vault, Certification, TokenGate, and DecisionLogger are hidden from navigation and UI.

**Pages and what they do on mainnet:**

| Route | Purpose | Data Source |
|-------|---------|-------------|
| `/` | **Scanner homepage** — token risk lookup, live scan feed, "Request Scan" button, how-it-works, integration code sample | AegisScanner contract (view calls) + scan-service HTTP API |
| `/scan/[address]` | Detailed scan results for a specific token | `getTokenScan()`, `getTokenRisk()`, `getTokenFlags()`, `isTokenSafe()` |
| `/oracle` | Oracle dashboard — contract statuses, live metrics, interface spec | `getScannerStats()` + contract bytecode checks |
| `/agents` | Browse registered AI agents with reputation data | AegisRegistry `getAgent(i)` for first 20 agents |
| `/integrate` | Developer docs — code snippets for integrating the safety oracle | Static with copy-paste examples |
| `/scanner` | Redirect to `/` (backward compatibility) | — |
| `/api/scan` | Backend proxy for manual scan requests | Forwards to `scan-service:3001/scan` |

**Data flow for a user looking up a token:**

```
User pastes 0x... in homepage scanner input
       │
       ▼
useTokenLookup() hook:
  1. getTokenScan(0x...) → Full scan data struct
  2. getTokenRisk(0x...) → Risk score (uint256)
  3. getTokenFlags(0x...) → Comma-separated flags
  4. isTokenSafe(0x...) → true/false
       │
       ▼
Display: Risk gauge (0-100), safety badge,
  individual flags, scan timestamp, scanner agent
       │
       │ If token NOT scanned yet:
       ▼
"Request Scan" button → POST /api/scan {token: "0x..."}
  → Proxied to scan-service:3001/scan
  → Immediate scan + on-chain submission
  → User re-queries in a few seconds → sees results
```

---

## 5. The Complete Mainnet Flow (End to End)

Here is everything that happens when a new token launches on PancakeSwap:

```
MINUTE 0:00 — Token launches
══════════════════════════════════════════════════════════════

   Token deployer creates LP on PancakeSwap V2
       │
       ▼
   PancakeSwap Factory emits:
   PairCreated(token0=NEW_TOKEN, token1=WBNB, pair=0xLP...)

MINUTE 0:12 — Automatic detection
══════════════════════════════════════════════════════════════

   Scan Service (scan-service.ts) picks up PairCreated event
       │
       ├── Filters: NEW_TOKEN is not a base token (WBNB/BUSD/etc)
       ├── Filters: NEW_TOKEN not already scanned
       │
       ▼
   Scan Service queries GoPlus Labs API for NEW_TOKEN
       │
       Returns: {
         is_honeypot: "1",
         buy_tax: "0.99",
         sell_tax: "0.99",
         is_open_source: "0",
         holder_count: "3",
         hidden_owner: "1"
       }

MINUTE 0:15 — Risk assessment
══════════════════════════════════════════════════════════════

   Risk score computed:
     Base:          30
     + HONEYPOT:   +70 (→ 100, capped)
     + HIGH_TAX:   +20 (already at 100)
     + SELL_TAX:   +20 (already at 100)
     + UNVERIFIED: +15 (already at 100)
     + HIDDEN_OWNER: +10 (already at 100)
     ─────────────
     Final:        100/100 — MAXIMUM RISK

   Flags: "HONEYPOT,HIGH_TAX,HIGH_SELL_TAX,UNVERIFIED,HIDDEN_OWNER"

MINUTE 0:16 — On-chain submission
══════════════════════════════════════════════════════════════

   scanner.submitScan(NEW_TOKEN, 100, 0, 3, 0, 9900, 9900,
     [true, false, false, false, false, false, false],
     "HONEYPOT,HIGH_TAX,...",
     0x_reasoningHash)

   Transaction confirmed. Gas: ~250K. Cost: ~$0.03

   AegisScanner now stores:
     tokenScans[NEW_TOKEN] = { riskScore: 100, honeypot: true, ... }

MINUTE 0:17 — Oracle is live
══════════════════════════════════════════════════════════════

   Any smart contract on BSC can now call:

     IAegisScanner(oracle).isTokenSafe(NEW_TOKEN)
     → returns FALSE

     IAegisScanner(oracle).getTokenRisk(NEW_TOKEN)
     → returns 100

   Any DEX using Aegis will BLOCK trades of this token:

     modifier aegisSafe(token) {
       require(aegis.isTokenSafe(token)); // ← REVERTS for NEW_TOKEN
     }

MINUTE 0:20 — Multi-agent consensus (Phase 2)
══════════════════════════════════════════════════════════════

   Three additional staked agents independently scan NEW_TOKEN:

   Agent A (Archon, 20×): score 98, flags=[HONEYPOT, HIGH_TAX]
   Agent B (Sentinel, 8×): score 100, flags=[HONEYPOT, HIGH_TAX, HIDDEN_OWNER]
   Agent C (Guardian, 3×): score 95, flags=[HONEYPOT]

   → AegisConsensus.finalizeConsensus(NEW_TOKEN)
   → Weighted average: (98×200K + 100×80K + 95×30K) / 310K = 98.2 → 98
   → Consensus result pushed to AegisScanner: score=98, honeypot=true

MINUTE 0:25 — User checks on frontend
══════════════════════════════════════════════════════════════

   User visits aegisprotocol.com/scanner → enters NEW_TOKEN address

   Frontend reads from AegisScanner contract:
     Risk Score: 98/100 (CRITICAL)
     Honeypot: YES ⚠
     Buy Tax: 99%
     Sell Tax: 99%
     Flags: HONEYPOT, HIGH_TAX, HIDDEN_OWNER, UNVERIFIED
     Status: UNSAFE ❌
     Scanned: 2 minutes ago
     Consensus: 3 agents, weighted score

   User decides NOT to buy. Funds protected.

MEANWHILE — Protection for existing vault users
══════════════════════════════════════════════════════════════

   If a vault user held a position in a token whose score spiked:

   AI Agent Engine (index.ts) detects:
     Token risk score jumped from 25 to 85 (AegisScanner read)
     → THREAT: CONTRACT_RISK (severity: CRITICAL)
     → User has autoWithdrawOnThreat: true

   Agent executes:
     AegisVault.executeProtection(userId, EmergencyWithdraw)
     DecisionLogger.logDecision(agentId, user, ProtectionTriggered, ...)

   User's funds are safely withdrawn before damage.
```

---

## 6. Mainnet Migration Checklist

Everything needed to go from testnet → mainnet:

### 6.1 Contract Deployment

| Step | Action | Details |
|------|--------|---------|
| 1 | Deploy $UNIQ token | Real BEP-20 on BSC mainnet (or use existing) |
| 2 | Deploy AegisTokenGate | Constructor: `uniqToken` address |
| 3 | Deploy AegisRegistry | Constructor: `registrationFee`, `maxAgents`, `tokenGate` |
| 4 | Deploy AegisVault | Constructor: `registry`, `tokenGate`, `protocolFeeBps` |
| 5 | Deploy DecisionLogger | Constructor: `registry` |
| 6 | Deploy AegisScanner | Constructor: owner wallet |
| 7 | Deploy AegisStaking | Constructor: `uniqToken` |
| 8 | Deploy AegisConsensus | Constructor: `staking`, `scanner`, `uniqToken` |
| 9 | Deploy AegisCertification | Constructor: `scanner`, `uniqToken`, `certificationFee` |
| 10 | Authorize agents | `scanner.addAuthorizedScanner(agentWallet)` |
| 11 | Register agents | `registry.registerAgent(name, uri)` from each agent wallet |
| 12 | Verify all on BSCScan | `npx hardhat verify --network bscMainnet <address> <args>` |

### 6.2 Configuration Changes

```env
# .env for mainnet
BSC_RPC=https://bsc-dataseed1.binance.org
CHAIN_ID=56

# PancakeSwap V2 Factory (mainnet)
PANCAKE_FACTORY=0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73

# All new mainnet contract addresses
SCANNER_ADDRESS=0x...   # Newly deployed mainnet addresses
REGISTRY_ADDRESS=0x...
VAULT_ADDRESS=0x...
LOGGER_ADDRESS=0x...
STAKING_ADDRESS=0x...
CONSENSUS_ADDRESS=0x...
CERTIFICATION_ADDRESS=0x...
TOKEN_GATE_ADDRESS=0x...

# Production LLM key
GROQ_API_KEY=gsk_...

# Agent config
AGENT_ID=0
DRY_RUN=false
AUTO_SCAN=true
POLL_INTERVAL=12000        # 12s = BSC block time
LOOKBACK_BLOCKS=10000
```

### 6.3 Code Changes for Mainnet

| File | Change |
|------|--------|
| `scan-service.ts` | Update `RPC_FALLBACKS` to mainnet RPCs |
| `scan-service.ts` | Update `BASE_TOKENS` to mainnet WBNB/BUSD/USDT/USDC addresses |
| `scan-service.ts` | Change GoPlus chain ID from `97` to `56` |
| `scan-service.ts` | Chain ID validation: `97` → `56` |
| `constants.ts` | Update all contract addresses to mainnet |
| `hardhat.config.ts` | Already configured for `bscMainnet` network |

### 6.4 Infrastructure

| Component | Testnet | Mainnet |
|-----------|---------|---------|
| Scan Service | Single process in codespace | Docker container, auto-restart, monitoring |
| AI Agent | Manual start | PM2 / systemd managed, health checks |
| Frontend | `next dev` | Vercel / AWS deployment, CDN |
| RPC | Free public RPCs | Dedicated RPC (QuickNode, Ankr, or BSC self-hosted) |
| Monitoring | Console logs | Grafana + Prometheus, PagerDuty alerts |
| Backup | None | Multi-region, hot standby agent |

---

## 7. Economic Model

### Revenue Streams

| Source | Fee | Recipient |
|--------|-----|-----------|
| Vault deposits | 0.50% (minus $UNIQ discounts) | Protocol treasury |
| Agent registration | 0.001 BNB | Protocol treasury |
| Certification | 100,000 $UNIQ | Protocol treasury (burned or locked) |
| Consensus disputes | 50,000 $UNIQ (loser pays) | Winner + treasury |

### Cost Structure (per agent, per day on mainnet)

| Operation | Frequency | Gas Cost | Daily Cost (est.) |
|-----------|-----------|----------|--------------------|
| `submitScan` | ~50–200 tokens/day | ~250K gas | $1.50–6.00 |
| `logDecision` | ~50–200/day | ~150K gas | $0.90–3.60 |
| `submitAttestation` | ~50–200/day | ~200K gas | $1.20–4.80 |
| RPC calls (view) | ~10,000/day | Free | $0 |
| GoPlus API | ~200/day | Free tier | $0 |
| LLM (Groq) | ~2,880/day (every 30s) | Free tier / $10/mo | ~$0.30 |
| **Total per agent** | | | **~$4–15/day** |

### Sustainability

- Protocol fees from vault deposits cover agent operational costs
- $UNIQ staking creates token demand (agents must hold to participate)
- Certification fees create burn/lock pressure on $UNIQ supply
- As TVL in vaults grows, fee revenue scales proportionally

---

## 8. Security Architecture

### Smart Contract Security

| Protection | Implementation |
|-----------|----------------|
| Reentrancy | `ReentrancyGuard` on all state-changing functions |
| Access control | `Ownable` + `authorizedScanners` mapping |
| Integer overflow | Solidity 0.8.24 built-in checks |
| Flash loan resistance | Timestamp-based staleness, not block-by-block |
| Pausability | `Pausable` on Scanner, Consensus |
| Fee limits | `MAX_FEE_BPS = 500` (5% hard cap in Vault) |
| Upgrade safety | Non-upgradeable (no proxy pattern) — immutable security |

### Agent Security

| Risk | Mitigation |
|------|-----------|
| Agent submits false data | Staking + slashing (lose $UNIQ) |
| Single agent manipulation | Consensus requires 3+ independent attestations |
| Outlier manipulation | Median-based outlier detection (±30 points) |
| Agent collusion | Stake-weighted voting prevents low-stake Sybil attacks |
| RPC manipulation | Multiple RPC fallbacks, on-chain verification |
| Private key exposure | Key loaded from env, never logged or transmitted |

### Oracle Security

| Attack Vector | Defense |
|---------------|---------|
| Stale data | 24-hour staleness threshold, `scannedAt` checked |
| Data poisoning | Consensus aggregation + outlier removal |
| Front-running | Data is public, no MEV advantage from risk scores |
| Oracle downtime | Multiple independent agents, no single point of failure |

---

## 9. Failure Modes & Recovery

### If the Scan Service crashes

```
Process dies → PM2/systemd auto-restarts within 5 seconds
  → On restart: reads lastBlock from provider.getBlockNumber()
  → Looks back 10,000 blocks to catch anything missed
  → Duplicate detection prevents double-submissions
  → No data is lost; at most a ~2 minute gap in scanning
```

### If an RPC endpoint goes down

```
Primary RPC fails → catch error → try Fallback 1
  → Fallback 1 fails → try Fallback 2
  → Fallback 2 fails → try Fallback 3
  → All fail → wait 30s → retry from Primary
  → Log all failures for monitoring/alerting
```

### If GoPlus API is unavailable

```
GoPlus request fails →  retry with exponential backoff (2s, 4s, 8s)
  → All 3 retries fail → submit scan with PARTIAL_SCAN flag
  → Risk score = 40 (elevated baseline due to incomplete data)
  → Token can be rescanned later when API recovers
```

### If no PairCreated events are detected

```
5 consecutive empty polls → log warning
  → Manual scans still available via HTTP endpoint
  → Service continues polling (doesn't exit)
  → On mainnet, this is extremely unlikely (BSC has hundreds of new pairs daily)
```

### If an agent's wallet runs out of BNB

```
submitScan tx fails with "insufficient funds"
  → Error logged, scan marked as failed
  → Stats track failed scans
  → Monitoring alerts team to top up agent wallet
  → Other agents continue operating (no single point of failure)
```

### If consensus cannot be reached

```
< 3 attestations for a token →  finalization blocked
  → Token retains most recent single-agent scan (or no data)
  → Any agent can still submit individual scans to AegisScanner directly
  → Consensus adds a layer of trust, but the oracle works without it
```

---

## Summary

On mainnet, the system operates as a continuous, autonomous security pipeline:

1. **Detection** — Scan Service watches PancakeSwap 24/7 for every new token listing
2. **Analysis** — GoPlus API + bytecode analysis + AI reasoning assess each token
3. **Scoring** — Risk score (0–100) computed from 8+ security signals
4. **Consensus** — 3+ staked agents independently verify, weighted aggregation finalizes
5. **Oracle** — Permanent on-chain record: any contract calls `isTokenSafe()` before swaps
6. **Protection** — AI agents auto-protect vault user funds when threats are detected
7. **Certification** — Safe tokens earn soulbound NFTs; unsafe tokens get certificates revoked
8. **Accountability** — Every decision immutably logged; bad agents get their $UNIQ slashed

The entire system is designed to be **permissionless** (anyone can run an agent),
**transparent** (all decisions on-chain), and **self-sustaining** (protocol fees
fund operations, $UNIQ staking aligns incentives).
