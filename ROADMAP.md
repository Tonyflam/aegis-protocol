# AEGIS — PRODUCT ROADMAP

**Last Updated**: April 2026
**Product**: BNB Chain Token Safety Scanner
**Team**: Uniq Minds
**Status**: Phase 1 SHIPPED

---

## The Product

Aegis is a token safety scanner for BNB Chain. Paste any token address, get a safety report: honeypot detection, tax analysis, liquidity checks, ownership audit. Results are stored on-chain and queryable by any smart contract.

**One sentence**: *Aegis scans any BNB Chain token and tells you if it's a scam.*

---

## PHASE 1: TOKEN SCANNER — SHIPPED ✅

> The core product. Free tool that scans tokens and returns safety reports.

### What's Built

- [x] **AegisScanner contract** — On-chain token risk registry with `isTokenSafe()`, `getTokenRisk()`, `getTokenFlags()` interface
- [x] **Scanner agent** — PancakeSwap listener that auto-scans new tokens + GoPlus API integration
- [x] **Manual scan** — HTTP API to scan any token on demand
- [x] **Frontend** — Scanner page, token reports, stats dashboard, developer docs
- [x] **356 tests passing** — Full test coverage across 8 contracts
- [x] **BSC Testnet deployment** — All contracts deployed and verified
- [x] **BNB Chain Hackathon** — #6 of 200 projects

### Infrastructure (Built, Not User-Facing)

These contracts are built, tested, and deployed but are backend infrastructure for future phases:

| Contract | Purpose | Status |
|----------|---------|--------|
| AegisScanner | Token risk oracle (the product) | ✅ Live |
| AegisRegistry | Agent identity (ERC-721) | ✅ Deployed |
| AegisStaking | Agent staking ($UNIQ) | ✅ Deployed |
| AegisConsensus | Multi-agent voting | ✅ Deployed |
| AegisCertification | Safety cert NFTs | ✅ Deployed |
| AegisVault | Protocol treasury | ✅ Deployed |
| DecisionLogger | Audit trail | ✅ Deployed |
| AegisTokenGate | $UNIQ holder tiers | ✅ Deployed |

---

## PHASE 2: API & GROWTH — NEXT

> Get users. Monetize. Ship to mainnet.

### 2.1 — Public API

- [ ] REST API for token safety lookups (`GET /api/v1/scan/{address}`)
- [ ] Rate-limited free tier (100 queries/day)
- [ ] API key system for paid tiers
- [ ] Webhook notifications for new high-risk tokens

### 2.2 — Distribution

- [ ] Telegram bot — `/scan 0x...` returns safety report
- [ ] Twitter bot — auto-reply when tokens are mentioned
- [ ] Browser extension — warning overlay on DEX pages
- [ ] PancakeSwap integration proposal

### 2.3 — Mainnet

- [ ] BSC mainnet deployment
- [ ] Production RPC (Quicknode/Alchemy)
- [ ] Auto-scan all new PancakeSwap pairs (mainnet)
- [ ] Uptime monitoring and alerting

### 2.4 — Revenue

- [ ] API subscriptions (per-query pricing for bots/protocols)
- [ ] Premium scanner features (real-time alerts, portfolio scanning)
- [ ] $UNIQ holder benefits (free API tier, priority scanning)

---

## PHASE 3: DECENTRALIZATION — PLANNED

> Multiple independent agents scanning and voting on token safety.

### 3.1 — Agent Network

- [ ] Open agent registration (stake $UNIQ to participate)
- [ ] Multiple scanner agents running independently
- [ ] Consensus voting on scan results (AegisConsensus)
- [ ] Reputation scoring based on accuracy

### 3.2 — Token Economy

- [ ] Agent rewards from API fees
- [ ] Staking tiers unlock higher consensus weight
- [ ] Slashing for consistently inaccurate scans
- [ ] Safety certification NFTs (AegisCertification)

### 3.3 — Governance

- [ ] Community proposals for scanner parameters
- [ ] $UNIQ-weighted voting on protocol changes
- [ ] Agent onboarding approval process

---

## Key Metrics to Track

| Metric | Phase 1 Target | Phase 2 Target |
|--------|---------------|---------------|
| Tokens scanned | 100+ | 10,000+ |
| Daily active users | — | 500+ |
| API queries/day | — | 5,000+ |
| Scanner uptime | Testnet | 99.9% mainnet |
| Revenue | $0 | First paying customer |

---

## What We're NOT Doing (Yet)

- ~~Vault deposits/withdrawals UI~~ → Phase 2+ (backend only)
- ~~Agent registration UI~~ → Phase 3 (when multi-agent is live)
- ~~Staking UI~~ → Phase 3
- ~~Certification minting~~ → Phase 3
- ~~DEX aggregation~~ → Not our product

The product is the scanner. Everything else supports it.
