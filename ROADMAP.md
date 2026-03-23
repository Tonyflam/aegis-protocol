# AEGIS PROTOCOL — DETAILED LAUNCH ROADMAP
## Uniq Minds | From Hackathon Winner to Production DeFi Protocol

**Last Updated**: March 19, 2026
**Status**: Phase 2 — IN PROGRESS 🔧

---

## CURRENT STATE

| Component | Status | Details |
|-----------|--------|---------|
| Smart Contracts | ✅ BSC Testnet | 4 contracts (+ AegisTokenGate), Sourcify verified |
| Tests | ✅ 150/150 passing | Registry (38), Vault (55), Logger (23), TokenGate (34) |
| Frontend | ✅ Live on Vercel | aegis-protocol-1.vercel.app |
| Agent Engine | ✅ Functional | Groq + OpenAI + heuristic fallback, 1,422 LOC |
| $UNIQ Token | ✅ Launched | 0xdd5f...7777, 1B supply, renounced, 3% tax |
| On-chain Demo | ✅ 13 TXs verified | Full threat lifecycle demonstrated |

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
- [x] 170 total tests passing (target was 110+)
- [ ] Token utility announcement thread posted
- [x] Updated contracts verified on testnet

---

# PHASE 3: SECURITY & BSC MAINNET LAUNCH (Week 4-8)

> **Goal**: Battle-test everything, audit, and deploy to mainnet with real money.

## 3.1 — Security Audit Preparation (Week 4-5)

- [ ] **Internal audit checklist** — Go through every function:
  - Reentrancy protection on all external calls ✓ (ReentrancyGuard)
  - Access control on all state-changing functions
  - Integer overflow/underflow (Solidity 0.8.24 handles, but verify)
  - Front-running vectors on `executeProtection()`
  - Oracle manipulation resistance (PancakeSwap cross-check)
  - Emergency pause mechanism tested
  - Fee calculation precision (no rounding exploits)

- [ ] **Static analysis**
  - Run `slither` on all contracts
  - Run `mythril` for symbolic execution
  - Fix all high/medium findings
  - Document accepted low findings with justification

- [ ] **External audit** (options by budget)
  - **Budget option**: Code4rena competitive audit (~$5K-15K)
  - **Mid option**: Hacken or CertiK lite (~$10K-30K)
  - **Premium option**: Trail of Bits, OpenZeppelin (~$50K+)
  - Alternative: Apply for BNB Chain MVB grants (may cover audit costs)

- [ ] **Bug bounty program**
  - Set up on Immunefi (BSC ecosystem standard)
  - Tiered rewards: Low ($100) → Critical ($5,000)
  - Scope: All 4 contracts (Registry, Vault, Logger, TokenGate)

## 3.2 — Mainnet Infrastructure (Week 5-6)

- [ ] **Multisig wallet** — Gnosis Safe on BSC
  - 2-of-3 initially (can expand to 3-of-5 later)
  - Owner of all contracts transferred to multisig
  - Fee collection address = multisig
  - Document all signers and key management

- [ ] **Mainnet RPC setup**
  - Primary: Ankr or QuickNode (paid, reliable)
  - Fallback: Public BSC RPC (free, rate-limited)
  - Add to `hardhat.config.ts`:
    ```typescript
    bscMainnet: {
      url: process.env.BSC_MAINNET_RPC || "https://bsc-dataseed1.binance.org",
      chainId: 56,
      accounts: [process.env.PRIVATE_KEY!],
      gasPrice: 3000000000, // 3 gwei (BSC is cheap)
    }
    ```

- [ ] **Monitoring & alerting**
  - Set up Tenderly for transaction monitoring
  - Configure alerts: failed TXs, large withdrawals, unusual gas
  - Agent health dashboard (uptime, response times)
  - Set up PagerDuty/Discord webhook for critical alerts

- [ ] **Backend hosting for Agent**
  - Option A: Railway.app (easy, $5/mo)
  - Option B: AWS EC2 t3.micro (free tier eligible)
  - Option C: VPS (Hetzner, $4/mo)
  - Must run 24/7 with auto-restart on crash
  - `DRY_RUN=false` in production

## 3.3 — Mainnet Deployment (Week 6-7)

- [ ] **Deploy script update** — `scripts/deploy-mainnet.ts`
  ```
  1. Deploy AegisRegistry
  2. Deploy AegisVault (ref: Registry)
  3. Deploy DecisionLogger
  4. Deploy AegisTokenGate (ref: $UNIQ token address)
  5. Set permissions:
     - Vault authorized in Registry
     - Operator authorized in Vault
     - Logger authorized in DecisionLogger
     - TokenGate set in Vault + Registry
  6. Transfer ownership to Gnosis Safe multisig
  7. Verify all on BSCScan
  ```

- [ ] **Frontend mainnet switch**
  - File: `frontend/src/lib/constants.ts`
  - Update `CHAIN_ID` to 56 (BSC Mainnet)
  - Update all contract addresses
  - Update RPC URL
  - Add mainnet/testnet toggle (keep testnet for demos)

- [ ] **Agent mainnet config**
  - Update contract addresses in `.env`
  - Set `DRY_RUN=false`
  - Configure mainnet RPC
  - Test with small amounts first

## 3.4 — Soft Launch (Week 7-8)

- [ ] **Invite-only launch**
  - Whitelist: Top $UNIQ holders + active community members
  - Limits: Max $1,000 per user, $10,000 total protocol TVL
  - Duration: 1-2 weeks of monitoring

- [ ] **Monitoring checklist** during soft launch:
  - [ ] All deposits tracked correctly
  - [ ] Risk assessments logging to DecisionLogger
  - [ ] Fee calculations accurate
  - [ ] $UNIQ discounts applying correctly
  - [ ] Emergency withdrawal works on mainnet
  - [ ] Agent making sensible decisions (not false positives)
  - [ ] Gas costs within expected range

- [ ] **Public launch prep**
  - Remove whitelist (or raise limits)
  - Gradual cap increases: $10K → $50K → $100K → uncapped
  - Announcement thread + AMA
  - Dashboard: Add "Mainnet LIVE" indicator

### Phase 3 Deliverables
- [ ] Security audit report (internal + external)
- [ ] Bug bounty live on Immunefi
- [ ] Gnosis Safe multisig controlling all contracts
- [ ] All 4 contracts deployed + verified on BSC Mainnet
- [ ] Frontend pointing to mainnet with toggle
- [ ] Agent running 24/7 with monitoring
- [ ] Soft launch completed with real users + real funds
- [ ] Public launch announcement

---

# PHASE 4: MULTI-PROTOCOL SUPPORT (Month 2)

> **Goal**: Protect more than just BNB — support lending, LP positions, and any BSC token.

## 4.1 — PancakeSwap V3 Integration

- [ ] **New adapter**: `agent/src/adapters/pancakeswap-v3.ts`
  - Concentrated liquidity position tracking
  - Range-based risk analysis (out-of-range detection)
  - Impermanent loss calculation
  - Auto-rebalance suggestions

- [ ] **Contract update**: Add V3 position types to Vault
  - NFT-based positions (PancakeSwap V3 uses NFTs for LP)
  - Range tracking in risk profiles

## 4.2 — Venus Protocol Integration (Lending)

- [ ] **New adapter**: `agent/src/adapters/venus.ts`
  - Track supply/borrow positions
  - Monitor health factor in real-time
  - Liquidation threshold alerts
  - Auto-repay or auto-withdraw on health factor drop

- [ ] **Contract update**: Add lending action types
  - `ActionType.RepayDebt` — Auto-repay to avoid liquidation
  - `ActionType.WithdrawCollateral` — Pull collateral before liquidation

## 4.3 — Arbitrary BSC Token Monitoring

- [ ] **Token scanner**: `agent/src/adapters/token-scanner.ts`
  - Auto-detect all BSC tokens in user's wallet
  - Per-token risk profile configuration
  - Honeypot detection (simulate sell on PancakeSwap)
  - Liquidity depth check
  - Contract verification status check

- [ ] **Frontend: Multi-token dashboard**
  - Portfolio view: All tokens with risk scores
  - Per-token protection settings
  - One-click "protect all" configuration

## 4.4 — Adapter Architecture

Refactor agent to support pluggable protocol adapters:

```
agent/src/
├── adapters/
│   ├── base-adapter.ts         # Interface all adapters implement
│   ├── pancakeswap-v2.ts       # Existing (refactor from pancakeswap.ts)
│   ├── pancakeswap-v3.ts       # New
│   ├── venus.ts                # New
│   └── token-scanner.ts        # New
├── index.ts                    # Core loop (unchanged)
├── ai-engine.ts                # Enhanced with adapter data
└── analyzer.ts                 # Enhanced with protocol-specific risk
```

### Phase 4 Deliverables
- [ ] PancakeSwap V3 positions tracked and protected
- [ ] Venus lending positions monitored with liquidation protection
- [ ] Any BSC token auto-detected and risk-scored
- [ ] Adapter architecture documented for future integrations
- [ ] 140+ tests passing

---

# PHASE 5: STAKING & REVENUE SHARE (Month 3)

> **Goal**: Create sustainable tokenomics — stake $UNIQ, earn from protocol activity.

## 5.1 — New Contract: AegisStaking.sol

```solidity
// contracts/AegisStaking.sol
contract AegisStaking is ReentrancyGuard, Ownable {
    IERC20 public uniqToken;

    struct StakeInfo {
        uint256 amount;
        uint256 stakeTimestamp;
        uint256 lastClaimTimestamp;
        uint256 accumulatedRewards;
    }

    // Stake $UNIQ → earn share of protocol fees
    function stake(uint256 amount) external;
    function unstake(uint256 amount) external; // 7-day cooldown
    function emergencyUnstake() external;       // Instant, 10% penalty
    function claimRewards() external;
    function compound() external;               // Reinvest rewards

    // Revenue distribution
    function distributeRevenue() external;      // Called by Vault on fee collection
}
```

**Revenue Split**:
| Destination | Share | Purpose |
|-------------|-------|---------|
| Stakers | 30% | Revenue share rewards |
| Treasury | 30% | Development fund (multisig) |
| Buyback | 20% | Buy $UNIQ from market → burn or redistribute |
| Operations | 20% | Servers, APIs, team costs |

## 5.2 — AegisVault Revenue Integration

- [ ] Modify fee collection to route to AegisStaking
- [ ] Add `distributeRevenue()` call after each fee collection
- [ ] Track total fees collected (new public counter)
- [ ] Track total fees distributed to stakers

## 5.3 — Frontend: Staking Dashboard

- [ ] **Staking page** (new route or tab)
  - Stake/unstake $UNIQ with amount input
  - Current APY display (calculated from fee volume)
  - Your staked amount + pending rewards
  - Claim / compound buttons
  - Cooldown timer display
  - Protocol-wide stats: Total staked, TVP, fee volume

## 5.4 — Governance (Lightweight)

- [ ] **Snapshot.org integration** for off-chain voting
  - Space: aegis-protocol.eth (or .bnb)
  - Strategy: $UNIQ balance + staked $UNIQ
  - Initial proposals: Fee adjustments, new chain selection, feature priorities

### Phase 5 Deliverables
- [ ] AegisStaking.sol deployed and audited
- [ ] Revenue distribution flowing to stakers
- [ ] Staking dashboard live on frontend
- [ ] Snapshot governance space active
- [ ] 160+ tests passing

---

# PHASE 6: MULTI-CHAIN EXPANSION (Month 4+)

> **Goal**: Bring Aegis protection to every major EVM chain.

## 6.1 — Target Chains (Priority Order)

| Chain | TVL | DEX | Lending | Priority |
|-------|-----|-----|---------|----------|
| **Ethereum** | $50B+ | Uniswap V3 | Aave V3 | High |
| **Arbitrum** | $3B+ | Uniswap V3, Camelot | Aave V3, Radiant | High |
| **Base** | $2B+ | Aerodrome | Moonwell | Medium |
| **Polygon** | $1B+ | QuickSwap | Aave V3 | Medium |

## 6.2 — Cross-Chain Architecture

- [ ] **Unified deploy script** — Same contracts, chain-specific configs
- [ ] **Chain-specific adapters** — Each chain gets its own DEX/lending adapter
- [ ] **Single frontend** — Chain selector dropdown, aggregated portfolio view
- [ ] **$UNIQ bridge** — LayerZero OFT or Wormhole for cross-chain $UNIQ
  - Native on BSC
  - Bridged version on other chains
  - Staking remains on BSC (canonical)

## 6.3 — Per-Chain Agent Instances

Each chain gets its own agent instance:
```
Agent (BSC)      → Monitors BSC positions    → Executes on BSC
Agent (Ethereum) → Monitors ETH positions    → Executes on ETH
Agent (Arbitrum) → Monitors ARB positions    → Executes on ARB
```

Unified dashboard aggregates all.

### Phase 6 Deliverables
- [ ] Aegis live on 2+ chains
- [ ] Cross-chain portfolio dashboard
- [ ] $UNIQ bridged to at least 1 additional chain
- [ ] Chain-specific adapters for top DEX/lending per chain

---

# GROWTH & MARKETING TIMELINE

| Week | Action |
|------|--------|
| **Week 0** | Win AMA, announce roadmap, update branding |
| **Week 1** | $UNIQ utility announcement thread, token integration begins |
| **Week 2** | "Hold $UNIQ, pay less fees" campaign, testnet demo with token |
| **Week 3** | Security audit begins, bug bounty launch |
| **Week 4** | Audit progress update, community AMA #2 |
| **Week 5** | Mainnet deployment prep, infrastructure setup |
| **Week 6** | Soft launch (invite-only), first real protection on mainnet |
| **Week 7** | Soft launch monitoring, gather feedback |
| **Week 8** | PUBLIC MAINNET LAUNCH, PR push |
| **Month 2** | Multi-protocol integrations, partnership announcements |
| **Month 3** | Staking launch, governance activation |
| **Month 4+** | Multi-chain expansion begins |

---

# RISK REGISTER

| Risk | Impact | Mitigation |
|------|--------|------------|
| Smart contract exploit | Critical | Audit + bug bounty + gradual TVL caps |
| AI makes wrong call | High | Emergency withdrawal always available, dry-run first |
| Low adoption | Medium | $UNIQ incentives, reduced fees, community marketing |
| $UNIQ price collapse | Medium | Real utility drives demand, buyback mechanism |
| Competitor launches first | Medium | Focus on UX + transparency, not just tech |
| BNB Chain issues | Low | Multi-chain roadmap diversifies |
| API rate limits (Groq/CoinGecko) | Low | Heuristic fallback, multiple providers |

---

# KEY METRICS TO TRACK

| Metric | Phase 2 Target | Phase 3 Target | Phase 5 Target |
|--------|---------------|---------------|---------------|
| $UNIQ Holders | 500 | 1,000 | 5,000 |
| Twitter Followers | 500 | 2,000 | 10,000 |
| Total Value Protected | $0 (testnet) | $50,000 | $500,000 |
| Active Agents | 5 (testnet) | 25 | 200 |
| Tests Passing | 110+ | 130+ | 160+ |
| Protocol Revenue | $0 | First fees | $5,000/mo |
| Staked $UNIQ | N/A | N/A | 50M+ |

---

# IMMEDIATE NEXT STEPS (This Week)

1. **Today**: Host Win Recap AMA
2. **Tomorrow**: Post AMA recording + summary thread
3. **Day 3-4**: README rebrand + frontend branding update
4. **Day 5-6**: Set up CI/CD pipeline + begin gas optimization
5. **Day 7**: Begin `AegisTokenGate.sol` development (Phase 2 kickoff)

---

*This is a living document. Updated as milestones are reached.*
*Track progress: Each [ ] becomes [x] as completed.*
