// ─── Aegis Strategy Adapter Interface ───────────────────────────────
//
// Every yield source the AI can allocate to implements this interface.
// The pattern is inspired by ERC-4626 vault adapters: each strategy
// exposes the data needed for autonomous scoring (live APY, risk vector,
// IL exposure) plus the metadata needed for user-facing transparency.
//
// IMPORTANT: this is an "advisory mode" implementation. The recommended
// allocation is computed off-chain and surfaced to the user. The on-chain
// AegisVault currently routes capital to Venus only; the multi-strategy
// router contract is on the Phase 6 roadmap.

export type StrategyKind =
  | "lending"          // Venus, Aave-like, no IL, directional yield
  | "lst"              // Liquid staking (slisBNB), price-pegged with peg risk
  | "lp-concentrated"  // PancakeSwap V3 CAKE-BNB, high APR with IL
  | "lp-stable";       // Stable LP, low IL

export type RiskTone = "conservative" | "balanced" | "aggressive";

export type MarketRegime = "CALM" | "MODERATE" | "HIGH" | "EXTREME";

// Per-strategy live data fetched at scoring time.
export interface StrategyLiveData {
  apy: number;              // Annualised, percent (e.g. 4.7 = 4.7%)
  tvlUsd: number;
  // 0..100 — composite risk surface: smart-contract age, audit count,
  // protocol concentration, integration depth.
  protocolRisk: number;
  // 0..100 — expected impermanent loss exposure given current vol regime.
  // 0 for lending and 1:1 LST. Climbs with concentrated LP width.
  ilExposure: number;
  // 0..100 — liquidity depth quality. 0 = thin, 100 = deep.
  liquidityScore: number;
  // Optional supplementary metric: peg deviation (LSTs) in bps.
  pegDeviationBps?: number;
  // Last update epoch seconds.
  asOf: number;
}

export interface StrategyMeta {
  id: string;                     // stable id, used as map key
  name: string;                   // display name
  protocol: string;               // "Venus Protocol", "Lista DAO", "PancakeSwap V3"
  kind: StrategyKind;
  tone: RiskTone;
  underlying: string;             // BNB, slisBNB, CAKE-BNB LP, etc.
  description: string;            // single-sentence positioning
  contractAddress?: string;       // for BSCScan deeplinks
  docUrl?: string;
  // True only for strategies the on-chain vault can currently route to.
  onChainAvailable: boolean;
}

export interface StrategyScore {
  // 0..100 composite. Weighted blend of yield, risk, liquidity, regime fit.
  score: number;
  // Sharpe-like metric: (apy - riskFreeRate) / volatilityScore.
  // Computed on-chain in RIQD; here approximated from live data.
  sharpe: number;
  // Recommended weight for this strategy under the current regime, 0..1.
  recommendedWeight: number;
  // Human-readable rationale, one short sentence.
  rationale: string;
}

export interface StrategyEvaluation {
  meta: StrategyMeta;
  live: StrategyLiveData;
  score: StrategyScore;
}

export interface RegimeReading {
  regime: MarketRegime;
  // BNB realised volatility, annualised %.
  realisedVolPct: number;
  // 0..100 confidence in the regime classification.
  confidence: number;
  // Last 24h drawdown from peak, basis points (10000 = 100%).
  drawdownBps: number;
  // Plain-English description of what AI sees.
  narrative: string;
  asOf: number;
}

export interface AllocationProfile {
  // Total must sum to 1.0 (within 1e-6 tolerance).
  weights: Record<string, number>;
  // Why this profile was chosen, one sentence.
  reason: string;
}

export interface StrategyEngineResult {
  regime: RegimeReading;
  strategies: StrategyEvaluation[];
  // AI's recommended allocation across the strategy set.
  allocation: AllocationProfile;
  // What the on-chain vault is doing right now (Venus-only today).
  currentAllocation: AllocationProfile;
  // Difference between recommended and current, abs sum, basis points.
  // Above 300 bps (3%) the AI flags a rebalance opportunity.
  driftBps: number;
  // True when drift exceeds the rebalance threshold.
  rebalanceRecommended: boolean;
  // Aggregated portfolio score under the recommended allocation.
  portfolioScore: number;
  // Aggregated APY under the recommended allocation.
  blendedApy: number;
  asOf: number;
}

// Adapter contract every strategy implements.
export interface StrategyAdapter {
  meta: StrategyMeta;
  // Return live yield + risk metrics. Must not throw; on failure return
  // a fallback with `asOf = 0` so the engine can detect staleness.
  fetchLive(): Promise<StrategyLiveData>;
}
