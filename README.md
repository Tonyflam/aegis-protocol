<div align="center">

# 🛡️ Aegis Protocol

### On-Chain Security Oracle & Agent Network for BNB Chain

[![Built for BNB Chain](https://img.shields.io/badge/Built_for-BNB_Chain-F0B90B?style=for-the-badge&logo=binance)](https://www.bnbchain.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org/)
[![Tests](https://img.shields.io/badge/Tests-356%2F356_Passing-22c55e?style=for-the-badge)](./test/)
[![Deployed](https://img.shields.io/badge/BSC_Testnet-Deployed_%26_Verified-F0B90B?style=for-the-badge)](https://testnet.bscscan.com/address/0x7908c25C63AbAB47cb82bE50DBD874ED807EE8fF)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](./LICENSE)

*A decentralized security oracle that scans tokens, flags risks on-chain, and lets any DeFi protocol query token safety before execution — powered by an AI agent network on BNB Chain.*

**🌐 [Live App](https://aegis-protocol-1.vercel.app/) · 🎥 [Demo Video](https://youtu.be/zEeFEduh6eg) · 📜 [Verified Contracts](https://testnet.bscscan.com/address/0x7908c25C63AbAB47cb82bE50DBD874ED807EE8fF) · 🤖 [AI Build Log](./AI_BUILD_LOG.md)**

[Architecture](#-architecture) · [Oracle Interface](#-oracle-interface) · [Smart Contracts](#%EF%B8%8F-smart-contracts) · [Agent Network](#-agent-network) · [Agent SDK](#-agent-sdk) · [Frontend](#%EF%B8%8F-frontend) · [Quick Start](#-quick-start)

</div>

---

## 🎯 The Problem

DeFi users interact with thousands of tokens daily with no reliable way to check if a token is safe before swapping. Rug pulls, honeypots, and tax traps drain billions annually — and the data is always siloed in off-chain APIs that protocols can't query at execution time.

| Gap | Current State | Aegis Solution |
|-----|--------------|----------------|
| Token Safety | Off-chain APIs, not composable | On-chain oracle — any contract can call `isTokenSafe()` |
| Risk Data | Centralized, single-source | Decentralized agent network with multi-source scanning |
| Composability | DeFi can't check safety at swap time | `IAegisScanner` interface — integrate in one line |
| Accountability | Anonymous scanners | ERC-721 agent identity with on-chain reputation |
| Consensus | Trust one provider | Multi-agent consensus with stake-weighted voting |
| History | No audit trail | Every scan result immutably stored on-chain |

---

## 💡 What Aegis Does

Aegis is an **on-chain security oracle** with three layers:

```
SCAN → ATTEST → QUERY
```

1. **🔍 SCAN** — AI agents analyze tokens across multiple data sources (honeypot detection, liquidity analysis, holder concentration, tax simulation)
2. **📝 ATTEST** — Scan results are written on-chain to the AegisScanner contract with risk scores, flags, and metadata
3. **🛡️ QUERY** — Any DeFi protocol calls `isTokenSafe(address)` or `getTokenRisk(address)` before executing a swap

### The Oracle Modifier Pattern

```solidity
import { IAegisScanner } from "./interfaces/IAegisScanner.sol";

contract MyDEX {
    IAegisScanner public oracle;

    modifier aegisSafe(address token) {
        require(oracle.isTokenSafe(token), "Token flagged by Aegis Oracle");
        _;
    }

    function swap(address token, uint256 amount) external aegisSafe(token) {
        // Swap executes only if Aegis oracle confirms token is safe
    }
}
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     AEGIS SECURITY ORACLE                            │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────┐      │
│   │                    AGENT NETWORK                          │      │
│   │                                                          │      │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │      │
│   │  │ Agent #1 │  │ Agent #2 │  │ Agent #N │  ...          │      │
│   │  │ (AI+LLM) │  │ (Rules)  │  │ (Hybrid) │              │      │
│   │  └────┬─────┘  └────┬─────┘  └────┬─────┘              │      │
│   │       │              │              │                    │      │
│   │       └──────────────┼──────────────┘                    │      │
│   │                      ▼                                   │      │
│   │            ┌─────────────────┐                           │      │
│   │            │ AegisConsensus  │ ← stake-weighted voting   │      │
│   │            └────────┬────────┘                           │      │
│   └─────────────────────┼────────────────────────────────────┘      │
│                         ▼                                           │
│   ┌──────────────────────────────────────────────────────────┐      │
│   │                   ON-CHAIN ORACLE                         │      │
│   │                                                          │      │
│   │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │      │
│   │  │AegisScanner  │  │AegisRegistry │  │ AegisStaking  │ │      │
│   │  │ (Risk Data)  │  │  (ERC-721    │  │ ($UNIQ Stake) │ │      │
│   │  │ isTokenSafe()│  │  Agent IDs)  │  │ Tier Weights  │ │      │
│   │  │ getTokenRisk│  │  Reputation  │  │ Scout→Archon  │ │      │
│   │  └──────────────┘  └──────────────┘  └───────────────┘ │      │
│   │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │      │
│   │  │AegisCertify  │  │AegisTokenGate│  │DecisionLogger │ │      │
│   │  │ (NFT Certs)  │  │ ($UNIQ Tiers)│  │ (Audit Trail) │ │      │
│   │  │ Safe Badges  │  │ Fee Discounts│  │ AI Hashes     │ │      │
│   │  └──────────────┘  └──────────────┘  └───────────────┘ │      │
│   └──────────────────────────────────────────────────────────┘      │
│                         ▼                                           │
│   ┌──────────────────────────────────────────────────────────┐      │
│   │              DeFi PROTOCOL INTEGRATIONS                   │      │
│   │  DEX.swap(token) → require(oracle.isTokenSafe(token))    │      │
│   │  Wallet.send(token) → oracle.getTokenRisk(token)         │      │
│   └──────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🔮 Oracle Interface

The `IAegisScanner` interface is the public API that any smart contract can call:

```solidity
interface IAegisScanner {
    // Core queries — call these from your contracts
    function isTokenSafe(address token) external view returns (bool);
    function getTokenRisk(address token) external view returns (uint8 riskScore, bool isHoneypot, bool isRugPull);
    function getTokenFlags(address token) external view returns (string[] memory flags);
    function getTokenScan(address token) external view returns (TokenScan memory);

    // Scanner stats
    function getScannerStats() external view returns (uint256 totalScans, uint256 tokensTracked, uint256 honeypots, uint256 rugPulls);
    function getRecentScans(uint256 count) external view returns (TokenScan[] memory);

    // Agent write (authorized agents only)
    function submitScan(address token, uint8 riskScore, bool isHoneypot, bool isRugPull, string[] calldata flags, string calldata metadata) external;
    function updateScannerVersion(uint256 newVersion) external;
}
```

### Integration Examples

**AegisSafeSwap** — DEX that rejects unsafe tokens:
```solidity
modifier aegisSafe(address token) {
    require(scanner.isTokenSafe(token), "Token flagged unsafe");
    _;
}
```

**AegisWalletGuard** — Wallet that warns before sending to risky tokens:
```solidity
function assessTransfer(address token) external view returns (uint8 risk, string memory warning) {
    (uint8 riskScore, bool isHoneypot,) = scanner.getTokenRisk(token);
    // Return risk data to wallet UI
}
```

Both examples are shipped in [`contracts/examples/`](./contracts/examples/).

---

## ⛓️ Smart Contracts

### Contract Architecture (8 Contracts + Mock, 3,289 LOC)

| Contract | LOC | Purpose | Key Features |
|----------|-----|---------|--------------|
| **AegisScanner** | 379 | On-chain token risk oracle | `isTokenSafe()`, `getTokenRisk()`, `getTokenFlags()`, agent-submitted scans, stats tracking |
| **AegisRegistry** | 557 | Agent identity & reputation | ERC-721 NFTs, 4 tiers (Scout→Archon), 1-5 reputation scoring, $UNIQ registration |
| **AegisStaking** | 207 | Agent stake management | $UNIQ staking, tier thresholds (10K/100K/500K/1M), stake-weighted authority |
| **AegisConsensus** | 463 | Multi-agent consensus | Proposal/vote/finalize flow, stake-weighted voting, quorum thresholds, dispute resolution |
| **AegisCertification** | 213 | Safety certification NFTs | Mint ERC-721 certificates for tokens that pass consensus, revocable |
| **AegisVault** | 677 | Non-custodial asset protection | BNB/ERC20 deposits, per-user risk profiles, agent authorization, token-gated fees |
| **DecisionLogger** | 337 | On-chain decision audit trail | Immutable records, risk snapshots, reasoning hashes (keccak256 of AI analysis) |
| **AegisTokenGate** | 200 | $UNIQ token utility | Holder tier system (Bronze/Silver/Gold), fee discounts, balance-based gating |
| **IAegisScanner** | 108 | Oracle interface | Public interface for third-party integrations |

**Example integrations** (in `contracts/examples/`):
| Contract | LOC | Purpose |
|----------|-----|---------|
| AegisSafeSwap | 69 | DEX with `aegisSafe` modifier |
| AegisWalletGuard | 60 | Wallet risk assessment |

---

## 🤖 Agent Network

Agents are autonomous programs that scan tokens and submit results to the oracle. Each agent holds an ERC-721 identity NFT and earns reputation based on scan accuracy.

### Agent Tiers

| Tier | Name | $UNIQ Stake | Consensus Weight | Description |
|------|------|-------------|------------------|-------------|
| 0 | Scout | 10,000 | 1x | Entry-level, limited scans |
| 1 | Guardian | 100,000 | 2x | Standard operations |
| 2 | Sentinel | 500,000 | 4x | High authority, complex analysis |
| 3 | Archon | 1,000,000 | 8x | Maximum trust, governance participation |

### Agent Pipeline

```
Agent registers (ERC-721 mint) → Stakes $UNIQ → Gets tier assignment
    → Scans tokens (AI + heuristics + on-chain data)
    → Submits scan to AegisScanner contract
    → Other agents vote via AegisConsensus
    → Consensus reached → Result finalized on-chain
    → Reputation updated based on accuracy
```

### AI Engine

The agent AI engine (`agent/src/ai-engine.ts`) integrates with **Groq** (Llama 3.3 70B) or **OpenAI** (GPT-4o-mini) for threat analysis:

| Capability | Method | Description |
|-----------|--------|-------------|
| **Token Risk Scan** | `analyzeToken()` | Per-token risk flags: rug pull, honeypot, wash trading, whale manipulation |
| **Market Analysis** | `analyzeMarket()` | Full market snapshot with structured risk assessment |
| **Threat Reports** | `generateThreatReport()` | Executive summary of active threats |
| **Heuristic Fallback** | Automatic | Falls back to rule-based analysis when no API key is configured |

### On-Chain AI Attestation

Every AI decision is hashed and stored on-chain:

```typescript
const combinedReasoning = `${heuristicReasoning} | AI: ${llmAnalysis.reasoning}`;
const reasoningHash = keccak256(toUtf8Bytes(combinedReasoning));
// → Stored in DecisionLogger as immutable proof
```

---

## 📦 Agent SDK

The `agent-sdk/` package provides a TypeScript SDK for building Aegis-compatible scanner agents:

```typescript
import { AegisAgent } from "@aegis-protocol/agent-sdk";

const agent = new AegisAgent({
  privateKey: process.env.AGENT_KEY,
  scannerAddress: "0x...",
  registryAddress: "0x...",
  rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
});

// Scan a token and submit results on-chain
const result = await agent.scanToken("0xTokenAddress");
await agent.submitScan(result);
```

**SDK modules:**
- `agent.ts` — Core agent class with scan/submit lifecycle
- `interfaces.ts` — TypeScript types matching Solidity structs
- `abi.ts` — Contract ABIs for scanner and registry
- `adapters/goplus.ts` — GoPlus Security API adapter for external data

---

## 🧪 Tests (356/356 Passing)

```
  AegisScanner (28 → expanded)
    ✓ Scanner Authorization, Scan Submission
    ✓ View Functions, Stats, Risk Tracking

  AegisRegistry (52 tests)
    ✓ Deployment, Agent Registration, Agent Management
    ✓ Reputation System, Agent Stats, Admin Functions

  AegisVault (59 tests)
    ✓ Deployment, BNB Deposits, BNB Withdrawals
    ✓ Agent Authorization, Risk Profile
    ✓ Protection Execution, Emergency & Admin

  DecisionLogger (25 tests)
    ✓ Decision Logging, Risk Snapshots
    ✓ View Functions, Admin Functions

  AegisTokenGate (34 tests)
    ✓ Tier Classification, Fee Discounts
    ✓ Threshold Updates, Holder Checks

  AegisStaking
    ✓ Staking, Unstaking, Tier Assignment
    ✓ Threshold Management, Emergency Functions

  AegisConsensus
    ✓ Proposal Creation, Voting, Finalization
    ✓ Quorum Thresholds, Dispute Resolution

  AegisCertification
    ✓ Certificate Minting, Revocation
    ✓ Validity Checks, Admin Functions

  356 passing
```

---

## 🔍 On-Chain Proof

> **Contracts deployed, verified, and tested on BSC Testnet (Chain ID 97)**

### Deployed Contracts

| Contract | Address | Links |
|----------|---------|-------|
| **AegisRegistry** | `0x7908c25C63AbAB47cb82bE50DBD874ED807EE8fF` | [BSCScan](https://testnet.bscscan.com/address/0x7908c25C63AbAB47cb82bE50DBD874ED807EE8fF) · [Sourcify](https://repo.sourcify.dev/contracts/full_match/97/0x7908c25C63AbAB47cb82bE50DBD874ED807EE8fF/) |
| **AegisVault** | `0x15Ef23024c2b90beA81E002349C70f0C2A09433F` | [BSCScan](https://testnet.bscscan.com/address/0x15Ef23024c2b90beA81E002349C70f0C2A09433F) · [Sourcify](https://repo.sourcify.dev/contracts/full_match/97/0x15Ef23024c2b90beA81E002349C70f0C2A09433F/) |
| **DecisionLogger** | `0x874d78947bd660665de237b16Ca05cd39b7feF6f` | [BSCScan](https://testnet.bscscan.com/address/0x874d78947bd660665de237b16Ca05cd39b7feF6f) · [Sourcify](https://repo.sourcify.dev/contracts/full_match/97/0x874d78947bd660665de237b16Ca05cd39b7feF6f/) |
| **AegisTokenGate** | `0x672c5cC370085c3c6B5bcf2870e1A0Aa62Ff3D69` | [BSCScan](https://testnet.bscscan.com/address/0x672c5cC370085c3c6B5bcf2870e1A0Aa62Ff3D69) · [Sourcify](https://repo.sourcify.dev/contracts/full_match/97/0x672c5cC370085c3c6B5bcf2870e1A0Aa62Ff3D69/) |

> AegisScanner, AegisStaking, AegisConsensus, and AegisCertification are tested locally (356/356 passing) — testnet deployment pending for Phase 5.

---

## 🖥️ Frontend

**Security Oracle dashboard** built with Next.js 14, reading real contract data via ethers v6.

### Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Security Oracle landing — protocol identity, architecture, contract grid |
| `/scanner` | Scanner | Token scan interface — search any address, view risk score, live scan feed |
| `/scan/:address` | Scan Report | Public permalink for any token's scan results — risk hero, flags, metrics |
| `/oracle` | Oracle | Oracle statistics — scanner stats, interface spec, protocol status timeline |
| `/agents` | Agents | Agent registry explorer — reads AegisRegistry contract, staking tier info |
| `/integrate` | Integrate | Developer docs — IAegisScanner interface, code samples, contract addresses |

### Design Principles

- **Real data only** — every stat reads from BSC Testnet contracts or shows honest "awaiting deployment" state
- **Zero mock data** — no fake numbers, no simulated feeds, no placeholder stats
- **Scan-first UX** — the scanner is the primary surface, not a dashboard
- **Oracle identity** — every page reinforces "Security Oracle" positioning

---

## 📂 Project Structure

```
aegis-protocol/
├── contracts/                           # Solidity smart contracts (3,289 LOC)
│   ├── AegisScanner.sol                 # On-chain token risk oracle (379 LOC)
│   ├── AegisRegistry.sol                # ERC-721 agent identity & reputation (557 LOC)
│   ├── AegisStaking.sol                 # $UNIQ staking & tier management (207 LOC)
│   ├── AegisConsensus.sol               # Multi-agent consensus voting (463 LOC)
│   ├── AegisCertification.sol           # Safety certification NFTs (213 LOC)
│   ├── AegisVault.sol                   # Non-custodial vault & protection (677 LOC)
│   ├── DecisionLogger.sol               # On-chain decision audit log (337 LOC)
│   ├── AegisTokenGate.sol               # $UNIQ holder tiers & fee discounts (200 LOC)
│   ├── interfaces/
│   │   └── IAegisScanner.sol            # Public oracle interface (108 LOC)
│   ├── examples/
│   │   ├── AegisSafeSwap.sol            # DEX integration example (69 LOC)
│   │   └── AegisWalletGuard.sol         # Wallet guard example (60 LOC)
│   └── mocks/MockERC20.sol              # Test helper (19 LOC)
│
├── agent/                               # AI Scanner Agent Engine
│   └── src/
│       ├── index.ts                     # Main agent loop
│       ├── ai-engine.ts                 # LLM reasoning — Groq/OpenAI
│       ├── token-scanner.ts             # Multi-source token risk scanner
│       ├── auto-scanner.ts              # Automated scan pipeline
│       ├── scan-queue.ts                # Scan queue management
│       ├── analyzer.ts                  # 5-vector weighted risk analysis
│       ├── pancakeswap.ts               # PancakeSwap V2 on-chain price feeds
│       ├── market-provider.ts           # CoinGecko + DeFiLlama data feeds
│       ├── monitor.ts                   # Position & market data monitor
│       ├── executor.ts                  # On-chain transaction executor
│       └── whale-tracker.ts             # Whale movement tracking
│
├── agent-sdk/                           # TypeScript SDK for building agents
│   └── src/
│       ├── index.ts                     # Package entry
│       ├── agent.ts                     # Core AegisAgent class
│       ├── interfaces.ts                # Type definitions
│       ├── types.ts                     # Shared types
│       ├── abi.ts                       # Contract ABIs
│       └── adapters/goplus.ts           # GoPlus Security adapter
│
├── test/                                # 356 comprehensive tests (4,540 LOC)
│   ├── AegisScanner.test.ts             # Scanner oracle tests
│   ├── AegisRegistry.test.ts            # Agent registry tests
│   ├── AegisStaking.test.ts             # Staking tier tests
│   ├── AegisConsensus.test.ts           # Consensus voting tests
│   ├── AegisCertification.test.ts       # Certification NFT tests
│   ├── AegisVault.test.ts               # Vault protection tests
│   ├── DecisionLogger.test.ts           # Decision log tests
│   └── AegisTokenGate.test.ts           # Token gate tests
│
├── frontend/                            # Next.js 14 Security Oracle UI
│   └── src/
│       ├── app/
│       │   ├── page.tsx                 # Home — oracle identity landing
│       │   ├── scanner/page.tsx         # Token scan interface + live feed
│       │   ├── scan/[address]/page.tsx  # Public scan report (permalink)
│       │   ├── oracle/page.tsx          # Oracle statistics & protocol status
│       │   ├── agents/page.tsx          # Agent registry explorer
│       │   ├── integrate/page.tsx       # Developer integration docs
│       │   ├── layout.tsx               # Root layout with OG metadata
│       │   └── globals.css              # CSS design system
│       ├── components/
│       │   ├── Navbar.tsx               # Scanner/Oracle/Agents/Integrate nav
│       │   ├── Footer.tsx               # Contract links, BSCScan, GitHub
│       │   └── ClientLayout.tsx         # WalletProvider + layout wrapper
│       └── lib/
│           ├── useScanner.ts            # Real contract hooks (useScannerData, useTokenLookup)
│           ├── constants.ts             # Contract addresses & chain config
│           ├── abis.ts                  # Scanner + Registry + ERC20 + TokenGate ABIs
│           └── WalletContext.tsx         # MetaMask wallet context
│
├── scripts/
│   ├── deploy.ts                        # Multi-contract BSC deployment
│   ├── demo-e2e.ts                      # Local Hardhat E2E demo
│   ├── demo-onchain.ts                  # BSC Testnet demo
│   └── demo-comprehensive.ts            # Full threat lifecycle demo
│
├── hardhat.config.ts                    # BSC Testnet + Sourcify verification
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js v18+
- npm
- MetaMask (optional — frontend reads data without wallet)

### 1. Clone & Install

```bash
git clone https://github.com/Tonyflam/aegis-protocol.git
cd aegis-protocol
npm install --legacy-peer-deps
```

### 2. Run Tests

```bash
export NODE_OPTIONS="--no-experimental-require-module"
npx hardhat test
# 356 passing ✓
```

### 3. Start the Frontend

```bash
cd frontend && npm install && npm run dev
# Open http://localhost:3000
```

### 4. Start the AI Agent

```bash
cd agent && npm install

# Optional: Add LLM API key for AI reasoning
# export GROQ_API_KEY=your_key  (or OPENAI_API_KEY)

npx ts-node src/index.ts
```

### 5. Deploy to BSC Testnet

```bash
npx hardhat run scripts/deploy.ts --network bscTestnet
```

---

## 💰 $UNIQ Token

**$UNIQ** is the utility token powering the Aegis Protocol ecosystem.

| Property | Details |
|----------|---------|
| **Contract** | [`0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777`](https://bscscan.com/token/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777) |
| **Chain** | BNB Smart Chain (BSC) |
| **Supply** | 1,000,000,000 (1B) |
| **Ownership** | Renounced |
| **LP** | Locked |

**On-Chain Utility:**
- **Agent staking** — Stake $UNIQ to register as a scanner agent (tier-based: 10K → 1M)
- **Consensus weight** — Higher stake = more influence in multi-agent voting
- **Fee discounts** — Hold $UNIQ for reduced protocol fees (Bronze/Silver/Gold tiers)
- **Certification** — Staked agents can mint safety certification NFTs

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Solidity 0.8.24, OpenZeppelin, Hardhat |
| **Oracle Interface** | IAegisScanner — composable on-chain API |
| **Agent Engine** | TypeScript, Groq/OpenAI LLM, heuristic fallback |
| **Agent SDK** | TypeScript package with GoPlus adapter |
| **Frontend** | Next.js 14, Tailwind CSS, ethers.js v6 |
| **Blockchain** | BNB Smart Chain (BSC Testnet), Sourcify verification |
| **Testing** | Hardhat + Chai (356 tests, 4,540 LOC) |

---

## 🔒 Security

- **Non-Custodial**: Users retain full control — emergency withdrawal always available
- **ReentrancyGuard**: All fund-moving functions protected
- **OpenZeppelin**: Battle-tested contract libraries throughout
- **On-Chain Attestation**: Every AI decision permanently logged with reasoning hash
- **Multi-Agent Consensus**: No single agent can finalize a result unilaterally
- **Stake-at-Risk**: Agents stake $UNIQ — malicious behavior risks slashing

---

## 📋 Development Status

| Phase | Status | Contracts |
|-------|--------|-----------|
| **Phase 1** — Core Protocol | ✅ Complete | AegisRegistry, AegisVault, DecisionLogger |
| **Phase 2** — Token Economy | ✅ Complete | AegisTokenGate, AegisScanner |
| **Phase 3** — Security Oracle | ✅ Complete | AegisScanner V2, IAegisScanner interface |
| **Phase 4** — Agent Network | ✅ Complete | AegisStaking, AegisConsensus, AegisCertification |
| **Phase 5** — Mainnet & Scale | 🔜 Next | Full testnet deployment, mainnet migration, public agent onboarding |

---

<div align="center">

**Aegis Protocol by [Uniq Minds](https://x.com/uniq_minds)**

*The on-chain security oracle for BNB Chain.*

[Live App](https://aegis-protocol-1.vercel.app/) · [BSCScan](https://testnet.bscscan.com/address/0x7908c25C63AbAB47cb82bE50DBD874ED807EE8fF) · [$UNIQ Token](https://bscscan.com/token/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777) · [Twitter](https://x.com/uniq_minds)

</div>
