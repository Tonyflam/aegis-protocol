# AEGIS PROTOCOL — SECURITY ORACLE NETWORK ROADMAP
## Uniq Minds | The On-Chain Security Data Layer for BNB Chain

**Last Updated**: April 2026
**Vision**: Transform Aegis from a DeFi vault guardian into the **BNB Chain Security Oracle Network** — the programmatically-queryable, on-chain security data layer that every protocol, wallet, and agent consults before executing.
**Status**: Phase 1-2 COMPLETE ✅ | Phase 3 — NEXT 🔧 | Mainnet Target — Phase 5 🚀

---

## THE THESIS

No on-chain, programmatically-queryable security data layer exists on BNB Chain today. GoPlus, De.Fi, and TokenSniffer are off-chain APIs — they can go down, censor, or change terms. The AegisScanner contract already stores risk data on-chain. This is the seed of something much bigger than a vault.

**The shift**: Aegis is not a vault with an AI watcher. It is **a decentralized security intelligence network** where:
- AI agents continuously scan, score, and attest token risk on-chain
- Any smart contract can query `IAegisScanner.getTokenRisk()` before executing a swap
- Any wallet can check `isTokenSafe()` before approving a token
- Agents stake $UNIQ to participate, earn fees when their data is queried
- The vault becomes ONE consumer of this data layer, not the whole product

---

## CURRENT STATE

| Component | Status | Details |
|-----------|--------|---------|
| Smart Contracts | ✅ BSC Testnet | 5 contracts (Registry, Vault, Logger, TokenGate, Scanner), Sourcify verified |
| Tests | ✅ 198/198 passing | Registry (52), Vault (59), Logger (25), TokenGate (34), Scanner (28) |
| Frontend | ✅ Live on Vercel | aegisguardian.xyz — 6-page professional UI |
| Agent Engine | ✅ Functional | Groq + OpenAI + heuristic fallback, 3,236 LOC |
| Token Scanner | ✅ Live | Multi-source honeypot/rug pull/whale risk analysis |
| Whale Alerts | ✅ Live | Real-time BSC Transfer event monitoring |
| $UNIQ Token | ✅ Launched | 0xdd5f...7777, 1B supply, renounced, 3% tax |
| $UNIQ Integration | ✅ On-chain | AegisTokenGate deployed, holder tiers + fee discounts live |
| On-chain Demo | ✅ 13 TXs verified | Full threat lifecycle demonstrated |
| Production Audit | ✅ Complete | All fake/simulated data removed |
| AegisScanner | ✅ Deployed | On-chain token risk registry — **the Oracle seed** |

---

# PHASE 1: FOUNDATION & BRANDING (This Week)

> **Goal**: Unify branding, clean up repo, solidify the base before building on it.

## 1.1 — Branding Update

- [x] **README overhaul** — Rebrand to "Aegis Protocol by Uniq Minds"
  - File: `README.md`
  - Add Uniq Minds logo/banner
  - Add $UNIQ token section with contract address
  - Add winners badge/link to BNB Chain blog
  - Update all links (dashboard, Twitter, token)

- [x] **Frontend branding** — Add "by Uniq Minds" + $UNIQ references
  - File: `frontend/src/app/page.tsx`
  - Add Uniq Minds branding to header/footer
  - Add $UNIQ token link in sidebar or navbar
  - Add hackathon winner badge/banner

- [x] **Social profile alignment** ✅
  - Twitter bio: "AI-powered DeFi guardian on BNB Chain (hackathon top-10) $UNIQ + dashboard link"
  - Pinned tweet: DeFi Hacks thread — real stories, real risks, $UNIQ protection

## 1.2 — Repo Cleanup

- [x] **Remove dev artifacts**
  - Clean up `cache/` directory (add to .gitignore if not already)
  - Verify `artifacts/` is in .gitignore
  - Remove any leftover test files or temp scripts

- [x] **Documentation consolidation**
  - Verify `ARCHITECTURE.md` is current
  - Ensure `AI_BUILD_LOG.md` is up to date
  - Add `CONTRIBUTING.md` (basic for now — issue templates, PR guidelines)

- [x] **Environment config**
  - Verify `.env.example` has all required vars documented
  - Add mainnet RPC vars to `.env.example` for future use
  - Document `DRY_RUN` toggle clearly

## 1.3 — Technical Foundation

- [x] **Gas optimization pass** on AegisVault.sol
  - `contracts/AegisVault.sol` — 19 custom errors replacing string requires (~200 gas/revert saved)
  - `contracts/AegisVault.sol` — Unchecked loop increments in emergencyWithdraw() and _getUserTokenCount()
  - `contracts/AegisVault.sol` — Cached array lengths before loops
  - Result: ~15-20% gas reduction on revert paths

- [x] **Expand test coverage** — 98 tests (was 54)
  - Added 25 Vault tests: deposit pausing, position guards, constructor validation, admin functions, StopLoss/AlertOnly execution, auto-withdraw denial, sequential actions, action history
  - Added 10 Registry tests: empty name, max agents, decommissioned status, tier downgrade, score range, unauthorized vault, zero address
  - Added 9 Logger tests: confidence bounds, invalid risk params, empty history, decision types, multi-logger, multi-agent
  - Target: 80+ ✅ (achieved 98)

- [x] **CI/CD pipeline** — Enhanced 3-job workflow
  - File: `.github/workflows/ci.yml`
  - Job 1: Compile + Run 98 tests + contract size check
  - Job 2: Lint & TypeScript checking
  - Job 3: Frontend build with ABI generation
  - Runs on push to main + all PRs

### Phase 1 Deliverables
- [x] Updated README with Uniq Minds branding + $UNIQ
- [x] Frontend shows "Aegis Protocol by Uniq Minds"
- [x] CI pipeline runs tests on every PR (3-job workflow)
- [x] 98 tests passing (was 54)
- [x] Gas optimization: custom errors + unchecked loops on AegisVault.sol

---

# PHASE 2: $UNIQ TOKEN INTEGRATION (Week 1-2)

> **Goal**: Give $UNIQ real on-chain utility — not just a token, a protocol key.

## 2.1 — New Contract: AegisTokenGate.sol

Create a new contract that bridges $UNIQ into the protocol:

```solidity
// contracts/AegisTokenGate.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AegisTokenGate is Ownable {
    IERC20 public uniqToken;

    // Tier thresholds (hold X $UNIQ for tier benefits)
    uint256 public constant BRONZE_THRESHOLD  = 10_000 * 1e18;   // 10K $UNIQ
    uint256 public constant SILVER_THRESHOLD  = 100_000 * 1e18;  // 100K $UNIQ
    uint256 public constant GOLD_THRESHOLD    = 1_000_000 * 1e18; // 1M $UNIQ

    // Fee discounts per tier (basis points reduction)
    uint256 public constant BRONZE_DISCOUNT = 10; // 0.10% off
    uint256 public constant SILVER_DISCOUNT = 25; // 0.25% off
    uint256 public constant GOLD_DISCOUNT   = 40; // 0.40% off (nearly free)

    enum HolderTier { None, Bronze, Silver, Gold }

    function getHolderTier(address user) public view returns (HolderTier);
    function getFeeDiscount(address user) public view returns (uint256);
    function isHolder(address user) public view returns (bool);
}
```

**Key design decisions**:
- Read-only — no staking/locking in Phase 2, just balance checks
- Thresholds adjustable by owner (can tune based on market)
- Clean interface that AegisVault can call

## 2.2 — AegisVault Upgrade: Token-Gated Fees

Modify `AegisVault.sol` to integrate with `AegisTokenGate`:

```
Current: protocolFeeBps = 50 (0.5% flat for everyone)
New:     protocolFeeBps = 50 - holderDiscount (dynamic per user)
```

Changes to `contracts/AegisVault.sol`:
- [x] Add `AegisTokenGate` reference (settable by owner)
- [x] Modify `executeProtection()` to check holder tier before applying fee
- [x] Add `registerAgentWithUNIQ()` — pay registration fee in $UNIQ instead of BNB
- [x] Add view function `getEffectiveFee(address user)` for frontend

## 2.3 — AegisRegistry Upgrade: Holder Badge

Changes to `contracts/AegisRegistry.sol`:
- [x] Add `AegisTokenGate` reference
- [x] Add `holderBadge` field to agent metadata
- [x] Holders get priority tier upgrade consideration (lower threshold)
- [x] Add `isUNIQHolder()` view function

## 2.4 — Frontend: $UNIQ Dashboard Integration

Changes to `frontend/src/app/page.tsx` and supporting files:

- [x] **$UNIQ Balance Display**
  - Read user's $UNIQ balance via ERC-20 `balanceOf()`
  - Show holder tier (Bronze/Silver/Gold/None)
  - Display fee discount applied

- [x] **$UNIQ Stats Section**
  - Current price (from PancakeSwap on-chain or flap.sh)
  - Total holders count
  - Market cap
  - Your holdings + tier

- [x] **Registration with $UNIQ**
  - "Register Agent with $UNIQ" button (discounted/free)
  - ERC-20 approve + register flow
  - Transaction confirmation UI

- [x] **Holder Benefits Panel**
  - Tier thresholds (Bronze 10K / Silver 100K / Gold 1M)
  - Fee discounts per tier (0.10% / 0.25% / 0.40%)
  - BSCScan token link

## 2.5 — Agent Engine: $UNIQ Awareness

Changes to `agent/src/`:
- [x] Add $UNIQ price monitoring to market provider
  - File: `agent/src/market-provider.ts`
  - Fetch $UNIQ/BNB price from PancakeSwap V2
  - Include in market snapshot data

- [x] Add $UNIQ holder check in executor
  - File: `agent/src/executor.ts`
  - Log whether user is a $UNIQ holder when executing protections
  - Use discounted fee path when applicable

## 2.6 — Tests for Token Integration

- [x] AegisTokenGate tests (34 tests — target was 15+)
  - Tier classification at exact thresholds
  - Fee discount calculation
  - Zero balance → None tier
  - Threshold updates by owner
  - Non-owner rejected
  - Tier changes on transfer

- [x] AegisVault integration tests (10 tests — target was 10+)
  - Fee discount applied correctly for each tier
  - No discount when TokenGate not set
  - Edge: user sells tokens mid-protection
  - TokenGate enable/disable

- [x] AegisRegistry integration tests (8 tests — target was 5+)
  - Holder badge assigned correctly
  - Badge updates when tier changes
  - HolderBadgeUpdated event emission

### Phase 2 Deliverables
- [x] `AegisTokenGate.sol` deployed to testnet
- [x] Vault + Registry upgraded with token integration
- [x] Frontend shows $UNIQ holder benefits panel + tier constants
- [x] 198 total tests passing (target was 110+)
- [ ] Token utility announcement thread posted
- [x] Updated contracts verified on testnet
- [x] AegisScanner.sol deployed — on-chain token risk registry
- [x] Token Scanner UI — multi-source honeypot/rug pull/whale risk analysis
- [x] Whale Alerts — real-time BSC Transfer event monitoring
- [x] Multi-page professional frontend (6 routes with navbar/footer)
- [x] Production safety audit — all fake/simulated data removed
- [x] CSS design system with custom properties

---

# PHASE 3: SECURITY ORACLE FOUNDATION (Weeks 1-6) — BSC TESTNET

> **Goal**: Upgrade AegisScanner into a full oracle, build the auto-scan pipeline, and publish the `IAegisScanner` interface — all battle-tested on BSC Testnet before touching mainnet.

## 3.1 — AegisScanner Oracle Upgrade (Week 1-2)

- [ ] **Upgrade AegisScanner.sol** for production oracle role
  - Add `IAegisScanner` public interface (EIP-165 compliant):
    ```solidity
    interface IAegisScanner {
        function getTokenRisk(address token) external view returns (
            uint8 riskScore,        // 0-100
            uint256 lastUpdated,    // timestamp
            address attestedBy,     // agent that submitted
            bytes32 reasoningHash   // IPFS hash of full analysis
        );
        function isTokenSafe(address token) external view returns (bool);
        function getTokenFlags(address token) external view returns (
            bool isHoneypot,
            bool hasHighTax,
            bool isUnverified,
            bool hasConcentratedOwnership,
            bool hasLowLiquidity
        );
    }
    ```
  - Add staleness check — `isTokenSafe()` returns `false` if data older than 24h
  - Add batch query: `getTokenRiskBatch(address[] tokens)` for gas efficiency
  - Add event: `TokenRiskUpdated(address indexed token, uint8 riskScore, address indexed agent)`
  - Emit `OracleQueried(address indexed querier, address indexed token)` for fee tracking
  - Deploy upgraded Scanner to BSC Testnet, verify on Sourcify + BSCScan

- [ ] **Vault V2**: Upgrade to consume Scanner oracle data
  - Before any protection execution, vault checks `getTokenRisk()` for involved tokens
  - Risk-adjusted fee: riskier positions pay higher fees (incentivizes safe tokens)
  - Auto-protection: vault automatically increases vigilance when Oracle flags new threats
  - Multi-token vault: protect any BSC token, not just BNB

- [ ] **Test expansion** — Target: 240+ tests
  - IAegisScanner interface tests (batch queries, staleness, flags)
  - Vault V2 oracle integration tests
  - End-to-end: agent scans → oracle stores → vault consumes

## 3.2 — Auto-Scan Agent Pipeline (Week 2-4)

- [ ] **New agent module**: `agent/src/auto-scanner.ts`
  - Monitor PancakeSwap Factory for `PairCreated` events
  - On every new pair: trigger full risk analysis pipeline
  - Pipeline: honeypot.is check → GoPlusLabs verification → liquidity depth → holder concentration → LLM reasoning
  - Submit result to `AegisScanner.submitRisk()` on-chain
  - Target: scan every new BSC token within 60 seconds of pair creation

- [ ] **Scan queue & rate management**
  - Priority queue: new pairs first, then periodic re-scans of existing tokens
  - Re-scan interval: high-risk tokens every 1h, medium every 6h, low every 24h
  - API rate management across honeypot.is, GoPlusLabs, CoinGecko
  - Fallback: heuristic-only scan if all APIs are down

- [ ] **IPFS reasoning attestation**
  - Full AI analysis (prompt + response + data sources) stored on IPFS
  - `reasoningHash` stored on-chain via DecisionLogger
  - Anyone can verify WHY a token was scored the way it was
  - This is the transparency moat — no other scanner shows their work

## 3.3 — Oracle Query Interface (Week 4-5)

- [ ] **Developer documentation**
  - `docs/integration-guide.md` — How to integrate IAegisScanner
  - Example: PancakeSwap router wrapper that checks `isTokenSafe()` before swap
  - Example: Wallet guard contract that blocks approval of flagged tokens
  - NPM package: `@aegis-protocol/scanner-sdk` with ABI + TypeScript types

- [ ] **Query fee mechanism** (deployed to testnet)
  - Free tier: 100 queries/day per address (encourage adoption)
  - Paid tier: Unlimited queries, pay in $UNIQ per query (micro-fees)
  - Protocol integrations: flat monthly $UNIQ fee for unlimited access
  - Fees route to: 40% agent rewards, 30% stakers, 20% treasury, 10% buyback

## 3.4 — Frontend: Oracle Dashboard (Week 5-6)

- [ ] **Public Scanner page upgrade**
  - Real-time feed: "Token X just scanned → Risk Score: 87/100 🔴"
  - Searchable database of all scanned tokens
  - Full scan report with IPFS-linked reasoning
  - Shareable scan URLs: `aegisguardian.xyz/scan/0x...`
  - Embed widget code for other sites

- [ ] **Oracle stats dashboard**
  - Total tokens scanned (lifetime)
  - Scans in last 24h
  - Threats detected before rug pull
  - Query volume graph
  - "Testnet" badge — visible indicator this is testnet data

### Phase 3 Deliverables
- [ ] AegisScanner upgraded with `IAegisScanner` interface on BSC Testnet
- [ ] Vault V2 consuming oracle data on BSC Testnet
- [ ] Auto-scan pipeline catching every new BSC pair within 60 seconds
- [ ] IPFS reasoning attestation for full transparency
- [ ] Developer integration guide + NPM SDK
- [ ] Query fee mechanism tested on testnet
- [ ] Public oracle dashboard with shareable scan reports
- [ ] 240+ tests passing

---

# PHASE 4: AGENT NETWORK & INTEGRATION SDK (Weeks 7-12) — BSC TESTNET

> **Goal**: Open the network to third-party agents. Multiple agents scan → consensus scoring → higher accuracy → stronger oracle. Everything tested on testnet before mainnet.

## 4.1 — Multi-Agent Consensus Protocol

- [ ] **Agent staking** — Upgrade AegisRegistry
  - Agents must stake $UNIQ to submit scan results (skin in the game)
  - Stake tiers: Scout (10K $UNIQ) → Guardian (100K) → Sentinel (500K) → Archon (1M)
  - Higher stake = more weight in consensus scoring
  - Slashing: agents that submit provably wrong data lose stake

- [ ] **Consensus mechanism**
  - Minimum 3 agent attestations before a token risk score is finalized
  - Weighted average by agent reputation + stake amount
  - Outlier detection: if one agent deviates >30 points from median, flag for review
  - Dispute resolution: any agent can challenge a score by staking additional $UNIQ

- [ ] **Agent rewards**
  - Scanner query fees distributed proportionally to contributing agents
  - Bonus for first-to-scan (incentivizes speed)
  - Monthly accuracy bonus: agents whose scores are validated by post-hoc events
  - Penalty for inactivity: agents must submit ≥100 scans/month to earn rewards

## 4.2 — Third-Party Agent Registration

- [ ] **Open registration flow**
  - Anyone can register an agent via AegisRegistry
  - Minimum $UNIQ stake required
  - Initial probation period: 30 days, reduced weight in consensus
  - Graduated trust: reputation score increases with accurate scans over time

- [ ] **Agent SDK**: `@aegis-protocol/agent-sdk`
  - TypeScript SDK for building custom scanner agents
  - Standard interfaces: `IScanner`, `IAnalyzer`, `ISubmitter`
  - Pre-built adapters: honeypot.is, GoPlusLabs, De.Fi, custom
  - Docker template for quick deployment
  - Example agents: basic scanner, whale watcher, LP monitor

- [ ] **Agent leaderboard**
  - Ranked by: accuracy, speed, volume, uptime
  - Public profiles with scan history
  - Reputation NFTs for top performers
  - Frontend page: `/agents` — browse all registered agents

## 4.3 — Protocol Integration SDK

- [ ] **Smart contract integration patterns**
  ```solidity
  // Any DEX router can add this modifier:
  modifier aegisSafe(address token) {
      require(
          IAegisScanner(AEGIS_SCANNER).isTokenSafe(token),
          "Aegis: token flagged as unsafe"
      );
      _;
  }

  function swap(address tokenIn, address tokenOut, uint256 amount)
      external aegisSafe(tokenOut) {
      // ... normal swap logic
  }
  ```

- [ ] **Integration partnerships** (testnet demos)
  - PancakeSwap: risk badge on token pages
  - BNB Chain ecosystem wallets: pre-swap safety check
  - Telegram trading bots: inline risk score before buy
  - DEX aggregators: route avoidance for flagged tokens

- [ ] **Security Certification NFTs**
  - Tokens that pass continuous scanning earn "Aegis Certified" NFT
  - Revocable: if risk score increases, certification is burned
  - Projects can display certification badge
  - Certification fee: paid in $UNIQ → treasury

### Phase 4 Deliverables
- [ ] Multi-agent consensus protocol tested on BSC Testnet
- [ ] Third-party agent registration open with SDK
- [ ] Agent leaderboard on frontend
- [ ] Protocol integration SDK with smart contract examples
- [ ] Security Certification NFT system tested on testnet
- [ ] Vault V2 + Oracle + Agent Network fully integrated on testnet
- [ ] Integration partnership MOUs signed (testnet demos delivered)
- [ ] 280+ tests passing
- [ ] **All contracts finalized and frozen** — ready for audit

---

# PHASE 5: SECURITY AUDIT & BSC MAINNET LAUNCH (Weeks 13-18)

> **Goal**: Audit everything built in Phase 3-4, deploy the complete Aegis Security Oracle Network to BSC Mainnet. Beta first, then public launch. This is the big announcement: **"Aegis is LIVE on mainnet."**

## 5.1 — Security Audit (Week 13-15)

- [ ] **Internal audit checklist** — Go through every contract function:
  - Reentrancy protection on all external calls (ReentrancyGuard)
  - Access control on all state-changing functions
  - Integer overflow/underflow (Solidity 0.8.24 handles, but verify edge cases)
  - Front-running vectors on `executeProtection()` and `submitRisk()`
  - Oracle manipulation resistance (multi-agent consensus mitigates)
  - Emergency pause mechanism on every contract
  - Fee calculation precision (no rounding exploits)
  - Staleness check correctness on `isTokenSafe()`
  - Slashing logic edge cases in agent staking

- [ ] **Static analysis**
  - Run `slither` on all contracts (AegisScanner V2, Vault V2, Registry V2, Logger, TokenGate)
  - Run `mythril` for symbolic execution
  - Fix all high/medium findings
  - Document accepted low findings with justification

- [ ] **External audit** (by budget)
  - Budget option: Code4rena competitive audit (~$5K-15K)
  - Mid option: Hacken or CertiK lite (~$10K-30K)
  - Apply for BNB Chain MVB grants (may cover audit costs)
  - Scope: ALL contracts including new oracle, staking, and consensus logic

- [ ] **Bug bounty program**
  - Set up on Immunefi (BSC ecosystem standard)
  - Tiered rewards: Low ($100) → Critical ($5,000)
  - Scope: All contracts + Scanner oracle interface
  - Launch bug bounty BEFORE mainnet deployment

## 5.2 — Mainnet Infrastructure (Week 15-16)

- [ ] **Multisig wallet** — Gnosis Safe on BSC
  - 2-of-3 initially (can expand to 3-of-5 later)
  - Owner of all contracts transferred to multisig
  - Fee collection address = multisig
  - Document all signers and key management

- [ ] **Mainnet RPC setup**
  - Primary: Ankr or QuickNode (paid, reliable)
  - Fallback: PublicNode BSC RPC
  - Agent requires 24/7 RPC with no rate limits

- [ ] **Monitoring & alerting**
  - Set up Tenderly for transaction monitoring
  - Configure alerts: failed TXs, large withdrawals, unusual gas, oracle manipulation attempts
  - Agent health dashboard (uptime, response times, scan throughput)
  - Discord/Telegram webhook for critical alerts

- [ ] **Backend hosting for Agent**
  - Option A: Railway.app (easy, $5/mo)
  - Option B: AWS EC2 t3.micro (free tier eligible)
  - Option C: VPS (Hetzner, $4/mo)
  - Must run 24/7 with auto-restart on crash
  - `DRY_RUN=false` in production environment

## 5.3 — Mainnet Deployment (Week 16-17)

- [ ] **Deploy script** — `scripts/deploy-mainnet.ts`
  ```
  1. Deploy AegisRegistry V2 (with agent staking + consensus)
  2. Deploy AegisScanner V2 (IAegisScanner oracle interface)
  3. Deploy AegisVault V2 (oracle-consuming, multi-token)
  4. Deploy DecisionLogger
  5. Deploy AegisTokenGate (ref: $UNIQ mainnet address)
  6. Set permissions:
     - Scanner authorized agents
     - Vault linked to Scanner oracle
     - Operator authorized in Vault
     - Logger authorized in DecisionLogger
     - TokenGate set in Vault + Registry
  7. Transfer ownership to Gnosis Safe multisig
  8. Verify ALL contracts on BSCScan
  ```

- [ ] **Frontend mainnet switch**
  - Update `CHAIN_ID` to 56 (BSC Mainnet) in `constants.ts`
  - Update all contract addresses
  - Update RPC URL
  - Add mainnet/testnet toggle (keep testnet for demos)
  - "MAINNET LIVE" badge on dashboard

- [ ] **Agent mainnet config**
  - Update contract addresses in `.env`
  - Set `DRY_RUN=false`
  - Configure mainnet RPC
  - Start auto-scan pipeline pointing at mainnet PancakeSwap Factory

## 5.4 — Beta Launch (Week 17)

- [ ] **Invite-only beta** — Controlled rollout
  - Whitelist: Top $UNIQ holders + active community members + testnet power users
  - Limits: Max $1,000 deposit per user, $10,000 total protocol TVL
  - Duration: 1-2 weeks of monitoring
  - Feedback channel: dedicated Discord/Telegram group

- [ ] **Beta monitoring checklist**:
  - [ ] All deposits tracked correctly on mainnet
  - [ ] Oracle scans producing accurate results on real tokens
  - [ ] Risk assessments logging to DecisionLogger
  - [ ] Fee calculations accurate + $UNIQ discounts applying
  - [ ] Emergency withdrawal works on mainnet
  - [ ] Agent making sensible decisions (no false positives on mainnet tokens)
  - [ ] Gas costs within expected range on BSC (should be ~$0.03-0.10/tx)
  - [ ] Auto-scan catching new PancakeSwap pairs in real time
  - [ ] IPFS attestations accessible and verifiable
  - [ ] No security incidents

## 5.5 — Public Mainnet Launch (Week 18)

- [ ] **Remove limits + go public**
  - Remove whitelist
  - Gradual cap increases: $10K → $50K → $100K → uncapped
  - Enable third-party agent registration on mainnet
  - Enable oracle query fees (paid tier)

- [ ] **Launch announcement** 🚀
  - Twitter thread: "Aegis Protocol is LIVE on BSC Mainnet"
  - Include: contract addresses, what's new (oracle, auto-scan, agent network)
  - First integration announcements (any partnerships from Phase 4)
  - Community AMA: live walkthrough of mainnet features
  - CoinGecko/CMC listing update for $UNIQ (add utility description)

- [ ] **First integration targets** (mainnet)
  - Telegram bots calling `getTokenRisk()` via mainnet RPC
  - Wallet providers embedding safety check
  - DEX aggregators adding risk flags
  - Co-marketing with integration partners

### Phase 5 Deliverables
- [ ] Security audit report (internal + external) with all findings resolved
- [ ] Bug bounty live on Immunefi
- [ ] Gnosis Safe multisig controlling all contracts
- [ ] ALL contracts deployed + verified on BSC Mainnet (Scanner V2, Vault V2, Registry V2, Logger, TokenGate)
- [ ] Agent running 24/7 on mainnet with auto-scan pipeline
- [ ] Beta completed successfully with real users + real funds
- [ ] Public mainnet launch with announcement + first integrations
- [ ] Frontend pointing to mainnet with toggle
- [ ] 300+ tests passing

---

# PHASE 6: DATA MARKETPLACE & PREMIUM TIERS (Weeks 19-24)

> **Goal**: Monetize the live mainnet security data layer. Free tier drives adoption, premium tier drives revenue. Launch staking for $UNIQ holders.

## 6.1 — Tiered Data Access

| Tier | Access | Price | Target |
|------|--------|-------|--------|
| **Public** | `isTokenSafe()` — boolean only | Free (100/day) | Wallets, small bots |
| **Standard** | Full risk score + flags + last updated | 1 $UNIQ/query | DEX aggregators, trading bots |
| **Premium** | Full analysis + reasoning + historical data | 10 $UNIQ/query | Institutional, analytics platforms |
| **Enterprise** | Unlimited + webhook alerts + custom feeds | 1M $UNIQ/month flat | Exchanges, large protocols |

- [ ] **On-chain access control**
  - PayPerQuery contract: deduct $UNIQ per query based on tier
  - Subscription contract: monthly $UNIQ lockup for unlimited access
  - Free tier: rate-limited by address, no $UNIQ required

- [ ] **Premium data feeds**
  - Historical risk score changes over time (track token degradation)
  - Whale movement correlation with risk events
  - Liquidity drain velocity (predict rug in progress)
  - Cross-token pattern analysis (same deployer, same code = same risk)

## 6.2 — Staking & Revenue Share

- [ ] **New contract: AegisStaking.sol**
  ```solidity
  contract AegisStaking is ReentrancyGuard, Ownable {
      IERC20 public uniqToken;

      struct StakeInfo {
          uint256 amount;
          uint256 stakeTimestamp;
          uint256 lastClaimTimestamp;
          uint256 accumulatedRewards;
      }

      function stake(uint256 amount) external;
      function unstake(uint256 amount) external; // 7-day cooldown
      function emergencyUnstake() external;       // Instant, 10% penalty
      function claimRewards() external;
      function compound() external;

      function distributeRevenue() external;
  }
  ```

- [ ] **Revenue distribution model**

  | Source | Amount | Distribution |
  |--------|--------|-------------|
  | Scanner query fees | Per query | 40% agents, 30% stakers, 20% treasury, 10% buyback |
  | Vault protection fees | 0.5% per protection | 30% stakers, 30% treasury, 20% buyback, 20% ops |
  | Agent registration fees | One-time $UNIQ | 50% treasury, 50% burn |
  | Certification NFT fees | Per certification | 40% stakers, 40% treasury, 20% burn |
  | Enterprise subscriptions | Monthly $UNIQ | 30% stakers, 30% agents, 20% treasury, 20% ops |

## 6.3 — Frontend: Data Marketplace

- [ ] **Marketplace page** (new route: `/marketplace`)
  - Browse available data tiers
  - Purchase queries or subscribe
  - API key management for off-chain integrations
  - Usage dashboard: queries consumed, cost breakdown

- [ ] **Staking page** (new route: `/staking`)
  - Stake/unstake $UNIQ
  - Real-time APY based on protocol revenue
  - Pending rewards + claim/compound buttons
  - Cooldown timer display
  - Protocol stats: total staked, TVL, fee volume

## 6.4 — Governance

- [ ] **Snapshot.org integration** for off-chain voting
  - Strategy: $UNIQ balance + staked $UNIQ weight
  - Proposal types: fee adjustments, new chain selection, slashing parameters, treasury allocation
  - Minimum proposal threshold: 100K staked $UNIQ

### Phase 6 Deliverables
- [ ] Tiered data access live on mainnet with PayPerQuery + Subscription contracts
- [ ] Premium data feeds available (historical, whale, cross-token)
- [ ] AegisStaking.sol deployed to mainnet with revenue distribution
- [ ] Staking dashboard + marketplace UI live
- [ ] Governance via Snapshot active
- [ ] Protocol generating sustainable revenue
- [ ] 340+ tests passing

---

# PHASE 7: AUTONOMOUS SECURITY NETWORK (Weeks 25+)

> **Goal**: Full decentralization. Aegis becomes the security standard for all EVM chains — a network, not a product.

## 7.1 — Multi-Chain Expansion

| Chain | TVL | Priority | Oracle Use Case |
|-------|-----|----------|-----------------|
| **Ethereum** | $50B+ | High | UniSwap token safety, MEV protection data |
| **Arbitrum** | $3B+ | High | Camelot token risk, bridge safety |
| **Base** | $2B+ | Medium | Emerging tokens, high rug-pull rate |
| **Polygon** | $1B+ | Medium | QuickSwap token screening |

- [ ] **Cross-chain Scanner deployment**
  - Same `IAegisScanner` interface on every chain
  - Chain-specific agent instances monitoring local DEXs
  - Canonical staking remains on BSC, cross-chain rewards via LayerZero

- [ ] **$UNIQ bridge** — LayerZero OFT or Wormhole
  - Native on BSC
  - Bridged version on expansion chains
  - Query fees payable in bridged $UNIQ on any chain

## 7.2 — Predictive Security Intelligence

- [ ] **Rug pull prediction engine**
  - Pattern matching: deployer history, code similarity, liquidity patterns
  - Pre-emptive alerts BEFORE the rug happens (not after)
  - Public "Aegis Predicted This" dashboard — tracks predictions vs outcomes
  - This is the viral loop: every correct prediction is a marketing event

- [ ] **Risk contagion mapping**
  - If token A rugs and deployer also deployed token B, auto-flag token B
  - Shared liquidity pool analysis: if LP is pulled from A, what else is affected?
  - Network graph visualization of connected risk

## 7.3 — Full Decentralization

- [ ] **On-chain governance** — Replace Snapshot with Governor contract
  - $UNIQ voting with time-weighted staking multiplier
  - Govern: fee parameters, slashing thresholds, chain expansion, treasury
  - Timelock on all parameter changes (48h delay)

- [ ] **Permissionless agent registration**
  - Remove owner-required approval
  - Reputation-only gatekeeping: low-rep agents have reduced weight
  - Community can vote to ban malicious agents

- [ ] **Treasury diversification**
  - Protocol-owned liquidity (POL) on PancakeSwap
  - Treasury yield strategies (Venus, Alpaca)
  - Grants program for ecosystem builders

## 7.4 — The Endgame Vision

```
┌──────────────────── AEGIS SECURITY ORACLE NETWORK ────────────────────┐
│                                                                        │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────────┐      │
│  │ Agent Network│───▶│ AegisScanner │───▶│ On-Chain Risk Data    │      │
│  │ (100+ agents)│    │ (Oracle Core)│    │ (queryable by anyone) │      │
│  └─────────────┘    └──────────────┘    └──────────┬───────────┘      │
│                                                     │                  │
│    ┌────────────────────────────────────────────────┤                  │
│    │                    │                 │          │                  │
│    ▼                    ▼                 ▼          ▼                  │
│  ┌──────┐    ┌──────────────┐   ┌──────────┐  ┌──────────┐           │
│  │Wallets│    │DEX Aggregators│   │ Protocols│  │AegisVault│           │
│  │(check │    │(route around  │   │(pre-swap │  │(auto-     │           │
│  │before │    │flagged tokens)│   │ safety)  │  │protect)  │           │
│  │approve│    └──────────────┘   └──────────┘  └──────────┘           │
│  └──────┘                                                              │
│                                                                        │
│  Revenue: Query fees + Vault fees + Certifications + Enterprise subs   │
│  Security: Multi-agent consensus + Staking + Slashing + Governance     │
│  Token: $UNIQ = work token (stake to participate) + fee medium         │
└────────────────────────────────────────────────────────────────────────┘
```

### Phase 7 Deliverables
- [ ] Aegis Scanner live on 2+ EVM chains
- [ ] Cross-chain $UNIQ bridge operational
- [ ] Rug pull prediction engine with public track record
- [ ] On-chain governance replacing Snapshot
- [ ] Permissionless agent registration
- [ ] Network processing 10,000+ queries/day
- [ ] 380+ tests passing

---

# $UNIQ TOKEN — WORK TOKEN MODEL

$UNIQ is no longer just a fee-discount token. It is a **work token** — required to participate in the network at every level:

| Use Case | $UNIQ Required | Mechanism |
|----------|---------------|-----------|
| **Agent staking** | 10K-1M per agent | Stake to submit scan data, earn query fees |
| **Query payment** | 1-10 per query | Pay to access risk data (Standard/Premium) |
| **Enterprise access** | 1M/month flat | Unlimited queries for protocols |
| **Certification** | Per token | Projects pay for "Aegis Certified" badge |
| **Governance** | Staked $UNIQ | Vote on protocol parameters |
| **Vault fee discount** | 10K-1M held | Original utility preserved (Bronze/Silver/Gold) |
| **Agent registration** | One-time fee | Price of entry to the agent network |

**Demand drivers**: Every new agent, every query, every integration, every certification = $UNIQ demand.
**Supply pressure**: Buyback from revenue, burn from registration fees, staking lockup.

---

# COMPETITIVE MOATS

| Moat | Description | Why Others Can't Copy |
|------|-------------|----------------------|
| **Data network effect** | More scans → better data → more integrations → more scans | First-mover on BSC on-chain security data |
| **Agent network effect** | More agents → better consensus → more trust → more agents | Staking + reputation makes switching costly |
| **Integration lock-in** | Protocols embed `IAegisScanner` in their contracts | Smart contract integration is permanent |
| **$UNIQ necessity** | Can't participate without the token | Work token model creates structural demand |
| **Transparency moat** | IPFS-linked reasoning — anyone can verify | GoPlus/De.Fi are black boxes |
| **Decision audit trail** | DecisionLogger stores immutable on-chain decisions | No competitor has this |

---

# RISK REGISTER

| Risk | Impact | Mitigation |
|------|--------|------------|
| Smart contract exploit | Critical | Audit + bug bounty + gradual TVL caps |
| AI makes wrong risk score | High | Multi-agent consensus, slashing for bad data |
| Low agent participation | High | $UNIQ rewards + first-mover incentives |
| Oracle data staleness | High | 24h expiry + re-scan queue + staleness flag |
| $UNIQ price collapse | Medium | Real utility (work token), buyback from revenue |
| Low integration adoption | Medium | Free tier + integration SDK + first partnerships |
| Competitor launches on-chain oracle | Medium | Network effects + integration lock-in |
| BNB Chain issues | Low | Multi-chain roadmap diversifies |
| API rate limits (Groq/CoinGecko) | Low | Heuristic fallback, multiple providers |

---

# KEY METRICS

| Metric | Phase 3 (Testnet) | Phase 4 (Testnet) | Phase 5 (Mainnet Launch) | Phase 6 (Marketplace) | Phase 7 (Multi-Chain) |
|--------|-------------------|-------------------|--------------------------|----------------------|----------------------|
| Tokens Scanned | 500 (testnet) | 2,000 (testnet) | 5,000 (mainnet) | 50,000 | 200,000 |
| Oracle Queries/Day | 50 (testnet) | 200 (testnet) | 1,000 | 5,000 | 10,000+ |
| Active Agents | 1 (Aegis core) | 3-5 (testnet) | 5-10 (mainnet) | 25+ | 100+ |
| Protocol Integrations | 0 | 1-2 (testnet MOUs) | 2-3 (mainnet live) | 10+ | 25+ |
| $UNIQ Staked (agents) | 0 | 100K (testnet) | 500K | 5M | 50M+ |
| $UNIQ Staked (holders) | N/A | N/A | N/A | 10M | 100M+ |
| Protocol Revenue/Month | $0 | $0 | First real fees | $10,000 | $50,000+ |
| Total Value Protected | $0 | $0 | $50,000 (beta+public) | $500,000 | $2M+ |
| Tests Passing | 240+ | 280+ | 300+ | 340+ | 380+ |
| Chains Live | 0 (testnet only) | 0 (testnet only) | 1 (BSC Mainnet) | 1-2 | 3+ |

---

# GROWTH & ADOPTION STRATEGY

| Phase | Trigger | Retention | Viral Loop |
|-------|---------|-----------|------------|
| **Phase 3** | Public testnet scan reports for trending tokens | Free oracle queries drive habitual checking | Shareable scan URLs → Twitter embeds |
| **Phase 4** | Agent SDK launch → developer community buzz | Integration SDK → protocols start building on Aegis | Every testnet integration demo = co-marketing |
| **Phase 5** | **MAINNET LAUNCH** → "Aegis is LIVE" announcement | Real money protection → sticky users | Beta users become evangelists, first rug prediction goes viral |
| **Phase 6** | Premium data + staking APY → institutional attention | Revenue share → diamond hands stakers | Staking APY attracts yield seekers |
| **Phase 7** | Correct rug prediction → massive PR | Multi-chain coverage → can't leave | "Aegis predicted this" becomes meme |

**The killer adoption trigger**: Aegis publicly calls a token unsafe → that token rugs 48 hours later → screenshot goes viral → everyone asks "which tokens has Aegis flagged?" → adoption spike. Every rug pull we predict correctly is a marketing event we don't pay for.

---

# DEVELOPMENT TIMELINE OVERVIEW

```
Phase 1   ████████████████ COMPLETE ✅ (Foundation & Branding)
Phase 2   ████████████████ COMPLETE ✅ ($UNIQ Token Integration)
Phase 3   ░░░░░░░░░░░░░░░░ Weeks 1-6   (Oracle Foundation — TESTNET)
Phase 4   ░░░░░░░░░░░░░░░░ Weeks 7-12  (Agent Network — TESTNET)
Phase 5   ░░░░░░░░░░░░░░░░ Weeks 13-18 (AUDIT → BETA → MAINNET LAUNCH 🚀)
Phase 6   ░░░░░░░░░░░░░░░░ Weeks 19-24 (Data Marketplace & Staking)
Phase 7   ░░░░░░░░░░░░░░░░ Weeks 25+   (Multi-Chain & Decentralization)
```

**Key milestone**: Phase 5, Week 18 — **Public BSC Mainnet Launch**
Everything before Week 18 is building + testing. Everything after is growth.

---

# IMMEDIATE NEXT STEPS

1. **This week**: Upgrade AegisScanner.sol with `IAegisScanner` interface + batch queries (testnet)
2. **Next week**: Build auto-scan agent pipeline (PancakeSwap Factory listener on testnet)
3. **Week 3**: IPFS reasoning attestation integration
4. **Week 4**: Vault V2 oracle integration + developer docs
5. **Week 5-6**: Oracle dashboard frontend + query fee testing on testnet

---

*This is a living document. Updated as milestones are reached.*
*Track progress: Each [ ] becomes [x] as completed.*
