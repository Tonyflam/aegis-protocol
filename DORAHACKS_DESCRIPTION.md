# 🛡️ Aegis Protocol — AI-Powered Autonomous DeFi Guardian on BNB Chain

https://youtu.be/zEeFEduh6eg

---

## The Problem

**DeFi users lose billions annually** to rug pulls, flash loan attacks, liquidity drains, and price crashes. These losses happen when users aren't watching — overnight, during work, or because market conditions change faster than humans can react. Existing tools offer basic price alerts but no autonomous protection.

---

## The Solution

**Aegis Protocol** is an autonomous AI agent that monitors your DeFi positions on BNB Chain **24/7**, detects threats in real-time using **LLM reasoning + on-chain DEX verification**, and executes protective transactions — all without human intervention and fully verifiable on-chain.

Every 30 seconds, the agent runs a 6-phase decision loop:

| Phase | What Happens | Data Source |
|-------|-------------|-------------|
| **OBSERVE** | Fetch live market prices, volume, liquidity | CoinGecko + DeFiLlama |
| **ANALYZE** | 5-vector weighted risk scoring | Heuristic engine (price, liquidity, volume, holders, momentum) |
| **AI REASON** | LLM-powered threat analysis | Groq (Llama 3.3 70B) or OpenAI (GPT-4o) |
| **DEX VERIFY** | Cross-check API price vs on-chain price | PancakeSwap V2 Router (BSC Mainnet) |
| **DECIDE** | Threat classification + confidence score | Combined heuristic + AI reasoning |
| **EXECUTE** | Autonomous stop-loss, withdrawal, rebalance | On-chain transactions on BNB Chain |

---

## Key Features

- **LLM-Powered AI Reasoning** — Real natural language market analysis via Groq or OpenAI, not just rule-based alerts
- **PancakeSwap V2 Oracle Verification** — Cross-references CoinGecko prices against on-chain DEX reserves to detect oracle manipulation (delta > 1% triggers warning, > 5% triggers critical alert)
- **Non-Custodial Vault** — Users keep full control. Set max slippage, stop-loss thresholds, and action limits. Emergency withdrawal always available
- **ERC-721 Agent NFTs** — Each guardian is a verifiable on-chain identity with 4 tiers (Scout → Sentinel → Guardian → Archon), reputation scoring (1-5), and performance metrics
- **On-Chain Decision Attestation** — Every AI decision is hashed (keccak256 of reasoning text) and stored immutably on-chain via DecisionLogger
- **Per-User Risk Profiles** — Customizable slippage tolerance, stop-loss threshold, auto-withdraw permissions per depositor

---

## Smart Contracts — Deployed & Verified

3 contracts, **1,326 lines of Solidity**, deployed on BSC Testnet and verified via Sourcify:

| Contract | Address | Verified |
|----------|---------|----------|
| **AegisRegistry** (ERC-721) | [`0xac77139C2856788b7EEff767969353adF95D335e`](https://testnet.bscscan.com/address/0xac77139C2856788b7EEff767969353adF95D335e) | [Sourcify ✓](https://repo.sourcify.dev/contracts/full_match/97/0xac77139C2856788b7EEff767969353adF95D335e/) |
| **AegisVault** (Non-Custodial) | [`0x73CE32Ece5d21836824C55c5EDB9d09b07F3a56E`](https://testnet.bscscan.com/address/0x73CE32Ece5d21836824C55c5EDB9d09b07F3a56E) | [Sourcify ✓](https://repo.sourcify.dev/contracts/full_match/97/0x73CE32Ece5d21836824C55c5EDB9d09b07F3a56E/) |
| **DecisionLogger** (Audit Trail) | [`0xEbfb45d0c075d8BdabD6421bdFB9A4b9570219ea`](https://testnet.bscscan.com/address/0xEbfb45d0c075d8BdabD6421bdFB9A4b9570219ea) | [Sourcify ✓](https://repo.sourcify.dev/contracts/full_match/97/0xEbfb45d0c075d8BdabD6421bdFB9A4b9570219ea/) |

---

## On-Chain Proof — 13 Verified Transactions

Full threat lifecycle demonstrated on BSC Testnet — from normal monitoring through threat escalation, autonomous protection, and recovery:

| # | Phase | Action | Risk | TX |
|---|-------|--------|------|-----|
| 1 | Setup | Vault Deposit (0.005 tBNB) | — | [`0x3602f8...`](https://testnet.bscscan.com/tx/0x3602f865ec5df8b7bcb389f0caea337cdbe7bd5da699bfe373d1176894216c7a) |
| 2 | Config | Risk Profile (Conservative) | — | [`0x4e2ddc...`](https://testnet.bscscan.com/tx/0x4e2ddc3e04bee004d185574497b746ac5cc561ab1da362e1eb64f207bd126989) |
| 3 | Normal | AI Analysis → All Clear (92%) | NONE | [`0xf0922a...`](https://testnet.bscscan.com/tx/0xf0922ad8ff51553d014ebad35c04b7b72e0ec2b216325d652f557e988765dbfb) |
| 4 | Normal | Risk Snapshot (15/100) | LOW | [`0xcd7429...`](https://testnet.bscscan.com/tx/0xcd74298263c839ce58dd65d453dea8a88776fb5bb34029ad972eccd1ca584618) |
| 5 | Escalation | Volatility Warning (-4.2%) | LOW | [`0xeed6b6...`](https://testnet.bscscan.com/tx/0xeed6b6541031012209d9318fad7851db395304f1e2a2978ae3a98f91b02500ef) |
| 6 | Escalation | Risk Snapshot (38/100) | MEDIUM | [`0x60e7f3...`](https://testnet.bscscan.com/tx/0x60e7f39ebc63a4e585684f1d0fe21ab22d52a14700aa5e4ead21fc766441ddf4) |
| 7 | **Threat** | **Abnormal Volume (+350%)** | **HIGH** | [`0x8e8e1f...`](https://testnet.bscscan.com/tx/0x8e8e1f31f29ab36d60d3cec4be03db00919abbded5ed54e48702d5658ba7d97d) |
| 8 | Defense | Aggressive Profile (0.3% slip) | — | [`0x7b7546...`](https://testnet.bscscan.com/tx/0x7b7546b846181312fde544b2f89ee8e7e53ffd0002bada657a8c10848e0b6021) |
| 9 | Defense | Risk Snapshot (68/100) | HIGH | [`0x2a8c0b...`](https://testnet.bscscan.com/tx/0x2a8c0b20cedebb1af168b5545f46911d79b98feeaa05d0e4e647055eb8c402d3) |
| 10 | **Protection** | **Stop-Loss Triggered (95%)** | **CRITICAL** | [`0xea98d4...`](https://testnet.bscscan.com/tx/0xea98d417b4ae7aaf6d568f85bf2ba6fa1cb1b1ee5c30f08d59959aa69228ae11) |
| 11 | Recovery | Market Stabilized | LOW | [`0xbbc362...`](https://testnet.bscscan.com/tx/0xbbc362118ad2040c44b6a680bc789a6b82f52227bb0a82f4511d525f69d4912c) |
| 12 | Recovery | Risk Normalized (18/100) | LOW | [`0x530f57...`](https://testnet.bscscan.com/tx/0x530f57e3d88c15d34fc5e57f3bf3788f0eeceec5df82ab7c2243baa4565b3eb6) |
| 13 | Review | Position Review (98%) | NONE | [`0x226c18...`](https://testnet.bscscan.com/tx/0x226c18891d7b6edfba75cde1701dc807b9cd42d6c697309b72ac524754fdfbab) |

Every transaction is clickable and verifiable on BSCScan.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Solidity 0.8.24, Hardhat, 54 passing tests |
| **AI Engine** | Groq (Llama 3.3 70B) / OpenAI (GPT-4o), heuristic fallback |
| **DEX Integration** | PancakeSwap V2 Router + Factory (BSC Mainnet on-chain reads) |
| **Market Data** | CoinGecko API, DeFiLlama API (real-time, no API key needed) |
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS, ethers.js v6 |
| **Blockchain** | BNB Smart Chain Testnet (Chain ID 97) |
| **Verification** | Sourcify (full match on all 3 contracts) |
| **Hosting** | Vercel (auto-deploy from GitHub) |
| **CI/CD** | GitHub Actions (test + build on every push) |

---

## Testing

**54 / 54 tests passing** across all 3 contracts:

- **AegisRegistry** — 20 tests (deployment, registration, reputation, stats, admin)
- **AegisVault** — 20 tests (deposits, withdrawals, authorization, risk profiles, protection execution)
- **DecisionLogger** — 14 tests (logging, risk snapshots, views, admin)

---

## What Makes Aegis Different

1. **Real AI, not just alerts** — LLM inference produces natural language threat analysis with structured JSON output, not template strings
2. **On-chain proof of reasoning** — Every AI decision is hashed and stored immutably, creating a verifiable audit trail
3. **DEX price verification** — PancakeSwap V2 on-chain reserve reads catch oracle manipulation that API-only tools miss
4. **Non-custodial by design** — Users set their own risk tolerance; emergency withdrawal is always available
5. **Agent identity as NFT** — ERC-721 agent tokens with reputation scoring create accountability and trust
6. **Fully deployed & verifiable** — Not a mockup. 3 contracts, 13 transactions, all on BSCScan right now
