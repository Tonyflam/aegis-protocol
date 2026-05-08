// ─── Aegis Strategy Engine (advisory mode) ───────────────────────
//
// Inspired by RIQD's volatility-adaptive allocation engine, but adapted
// for our off-chain AI-advisor architecture. The engine:
//
//   1. Reads BNB price history from CoinGecko, computes realised
//      volatility on a 24h hourly window.
//   2. Classifies the market into 4 regimes (CALM/MODERATE/HIGH/EXTREME)
//      using the same thresholds as RIQD (20 / 50 / 100 % annualised).
//   3. Fetches live yield + risk for every adapter.
//   4. Scores each strategy under the current regime (Sharpe-style).
//   5. Computes a regime-aware target allocation across the strategy set.
//   6. Compares against the current on-chain allocation and flags drift.
//
// The output drives the UI's Strategy Engine panel: shown live to users
// as the AI's continuous reasoning loop. No trades are executed; on-chain
// rebalancing across multi-strategy is the Phase 6 contract upgrade.

import {
  ALL_ADAPTERS,
} from "./adapters";
import type {
  AllocationProfile,
  MarketRegime,
  RegimeReading,
  StrategyEngineResult,
  StrategyEvaluation,
  StrategyLiveData,
  StrategyMeta,
  StrategyScore,
} from "./types";

// ─── Regime detection ─────────────────────────────────────────────

const COINGECKO_CHART = "https://api.coingecko.com/api/v3/coins/binancecoin/market_chart?vs_currency=usd&days=2&interval=hourly";

interface PriceHistory {
  prices: number[];
  asOf: number;
}

let priceCache: { data: PriceHistory; ts: number } | null = null;
const PRICE_TTL_MS = 5 * 60_000; // 5 minutes

async function loadBnbHourly(): Promise<PriceHistory> {
  if (priceCache && Date.now() - priceCache.ts < PRICE_TTL_MS) {
    return priceCache.data;
  }
  try {
    const res = await fetch(COINGECKO_CHART, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error("cg " + res.status);
    const json = await res.json();
    const series: [number, number][] = json.prices ?? [];
    const prices = series.slice(-48).map((p) => p[1]);
    const data = { prices, asOf: Math.floor(Date.now() / 1000) };
    priceCache = { data, ts: Date.now() };
    return data;
  } catch {
    return priceCache?.data ?? { prices: [], asOf: 0 };
  }
}

// Realised volatility on hourly log returns, annualised.
// vol_annualised = stdev(log r_i) * sqrt(24 * 365)
function realisedVolPct(prices: number[]): number {
  if (prices.length < 4) return 30;
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const r = Math.log(prices[i] / prices[i - 1]);
    if (Number.isFinite(r)) returns.push(r);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + (r - mean) * (r - mean), 0) / Math.max(1, returns.length - 1);
  const stdev = Math.sqrt(variance);
  return stdev * Math.sqrt(24 * 365) * 100;
}

function drawdownBps(prices: number[]): number {
  if (prices.length === 0) return 0;
  let peak = prices[0];
  let maxDd = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    const dd = (peak - p) / peak;
    if (dd > maxDd) maxDd = dd;
  }
  return Math.round(maxDd * 10_000);
}

function classifyRegime(volPct: number): MarketRegime {
  if (volPct < 20) return "CALM";
  if (volPct < 50) return "MODERATE";
  if (volPct < 100) return "HIGH";
  return "EXTREME";
}

function regimeNarrative(regime: MarketRegime, vol: number, dd: number): string {
  const v = vol.toFixed(1);
  const d = (dd / 100).toFixed(2);
  switch (regime) {
    case "CALM":
      return `BNB realised volatility at ${v}% with ${d}% 24h drawdown. The AI is leaning into yield, accepting moderate IL exposure where the risk-adjusted return is best.`;
    case "MODERATE":
      return `Volatility at ${v}%, drawdown ${d}%. Conditions are normal. Allocation balances yield, peg-stable LSTs, and lending base.`;
    case "HIGH":
      return `Elevated volatility at ${v}%. The AI is reducing concentrated LP exposure and rotating capital toward lending and liquid staking.`;
    case "EXTREME":
      return `Volatility at ${v}% with ${d}% drawdown. The AI is in defensive mode: lending dominates the portfolio, LP exposure is minimised.`;
  }
}

async function readRegime(): Promise<RegimeReading> {
  const hist = await loadBnbHourly();
  const vol = realisedVolPct(hist.prices);
  const dd = drawdownBps(hist.prices);
  const regime = classifyRegime(vol);
  // Confidence rises with sample size and falls in regime boundaries.
  const sampleConf = Math.min(100, (hist.prices.length / 48) * 100);
  const distance = Math.min(
    Math.abs(vol - 20),
    Math.abs(vol - 50),
    Math.abs(vol - 100),
  );
  const boundaryConf = Math.min(100, distance * 4);
  const confidence = Math.round(Math.min(sampleConf, boundaryConf));
  return {
    regime,
    realisedVolPct: vol,
    confidence: Math.max(40, confidence),
    drawdownBps: dd,
    narrative: regimeNarrative(regime, vol, dd),
    asOf: hist.asOf || Math.floor(Date.now() / 1000),
  };
}

// ─── Strategy scoring ────────────────────────────────────────────
//
// score = w_yield * yieldScore - w_risk * riskScore - w_il * ilPenalty
//
// where weights shift per regime. In CALM yield dominates; in EXTREME,
// risk dominates and IL exposure is heavily penalised.

const REGIME_WEIGHTS: Record<MarketRegime, { yield: number; risk: number; il: number; liquidity: number }> = {
  CALM:     { yield: 0.55, risk: 0.15, il: 0.15, liquidity: 0.15 },
  MODERATE: { yield: 0.45, risk: 0.20, il: 0.20, liquidity: 0.15 },
  HIGH:     { yield: 0.30, risk: 0.30, il: 0.30, liquidity: 0.10 },
  EXTREME:  { yield: 0.15, risk: 0.40, il: 0.40, liquidity: 0.05 },
};

const RISK_FREE_APY = 2.5; // crude proxy: stable USDT lending base.

function scoreStrategy(
  meta: StrategyMeta,
  live: StrategyLiveData,
  regime: MarketRegime,
  volPct: number,
): StrategyScore {
  const w = REGIME_WEIGHTS[regime];

  // Normalised yield: cap at 30% so headline numbers don't dominate.
  const yieldScore = Math.min(100, (live.apy / 30) * 100);
  const riskScore = live.protocolRisk;
  const ilPenalty = live.ilExposure * (regime === "EXTREME" ? 1.3 : regime === "HIGH" ? 1.15 : 1);

  const composite =
    w.yield * yieldScore -
    w.risk * riskScore -
    w.il * ilPenalty +
    w.liquidity * live.liquidityScore;

  const score = Math.max(0, Math.min(100, Math.round(composite + 50)));

  // Sharpe-style: (apy - rf) / vol_attribution. Lending uses macro vol;
  // LP attributes higher vol from IL, LST a small premium for peg risk.
  const volAttribution =
    meta.kind === "lp-concentrated" ? Math.max(15, volPct) :
    meta.kind === "lst" ? Math.max(8, volPct * 0.4) :
    Math.max(5, volPct * 0.2);
  const sharpe = Math.max(0, (live.apy - RISK_FREE_APY) / volAttribution);

  return {
    score,
    sharpe: Number(sharpe.toFixed(2)),
    recommendedWeight: 0, // filled in by allocateWeights below
    rationale: rationaleFor(meta, live, regime),
  };
}

function rationaleFor(meta: StrategyMeta, live: StrategyLiveData, regime: MarketRegime): string {
  if (meta.kind === "lending") {
    if (regime === "EXTREME") return "Lending anchors capital during extreme volatility. Zero IL, instant liquidity.";
    if (regime === "HIGH") return "Stable yield with no impermanent loss. Preferred while volatility is elevated.";
    return `Stable ${live.apy.toFixed(2)}% APY with no IL risk. The yield floor of the portfolio.`;
  }
  if (meta.kind === "lst") {
    if (regime === "EXTREME") return "Liquid staking is held back when peg risk could compound a market crash.";
    return `Native staking yield (${live.apy.toFixed(2)}%) plus DeFi composability. Minor peg risk monitored.`;
  }
  if (meta.kind === "lp-concentrated") {
    if (regime === "EXTREME") return "Concentrated LP is minimised during extreme volatility to avoid IL drag.";
    if (regime === "HIGH") return "LP exposure is reduced; the AI prefers wider ranges or non-LP yield.";
    return `${live.apy.toFixed(1)}% APR from fees plus CAKE rewards. Returns are degraded by IL when prices diverge.`;
  }
  return `${live.apy.toFixed(2)}% APY across stable LP. Low IL, modest yield.`;
}

// ─── Allocation engine ────────────────────────────────────────────
//
// Weight strategies by their composite score within their tone bucket,
// then enforce regime-driven caps that mirror RIQD's allocation matrix.
//
//   regime   |  lending  |  lst   |  lp
//   ─────────┼───────────┼────────┼──────
//   CALM     |   40%     |  35%   |  25%
//   MODERATE |   50%     |  30%   |  20%
//   HIGH     |   65%     |  25%   |  10%
//   EXTREME  |   85%     |  12%   |   3%

const REGIME_BUCKETS: Record<MarketRegime, { lending: number; lst: number; lp: number }> = {
  CALM:     { lending: 0.40, lst: 0.35, lp: 0.25 },
  MODERATE: { lending: 0.50, lst: 0.30, lp: 0.20 },
  HIGH:     { lending: 0.65, lst: 0.25, lp: 0.10 },
  EXTREME:  { lending: 0.85, lst: 0.12, lp: 0.03 },
};

function bucketOf(meta: StrategyMeta): "lending" | "lst" | "lp" {
  if (meta.kind === "lending") return "lending";
  if (meta.kind === "lst") return "lst";
  return "lp";
}

function allocateWeights(
  evaluations: StrategyEvaluation[],
  regime: MarketRegime,
): AllocationProfile {
  const buckets = REGIME_BUCKETS[regime];
  const weights: Record<string, number> = {};

  for (const bucket of ["lending", "lst", "lp"] as const) {
    const cohort = evaluations.filter((e) => bucketOf(e.meta) === bucket);
    if (cohort.length === 0) continue;
    const totalScore = cohort.reduce((acc, e) => acc + Math.max(1, e.score.score), 0);
    for (const e of cohort) {
      const share = (Math.max(1, e.score.score) / totalScore) * buckets[bucket];
      weights[e.meta.id] = share;
    }
  }

  // Normalise: rounding can drift; renormalise to exactly 1.
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (const k of Object.keys(weights)) weights[k] = weights[k] / sum;
  }

  const reason = (() => {
    switch (regime) {
      case "CALM":     return "Calm market. AI maximises blended yield while respecting liquidity caps.";
    case "MODERATE": return "Normal conditions. Allocation balances stable lending with diversified yield sources.";
      case "HIGH":     return "Elevated volatility. AI rotates toward lending, trims concentrated LP exposure.";
      case "EXTREME":  return "Defensive posture. Lending dominates, LP capped at 3%, peg-sensitive LSTs reduced.";
    }
  })();

  return { weights, reason };
}

function driftBetween(target: AllocationProfile, current: AllocationProfile): number {
  const ids = new Set([...Object.keys(target.weights), ...Object.keys(current.weights)]);
  let sum = 0;
  for (const id of ids) {
    sum += Math.abs((target.weights[id] ?? 0) - (current.weights[id] ?? 0));
  }
  return Math.round(sum * 10_000); // basis points (sum of abs diffs)
}

function blendedApyOf(evaluations: StrategyEvaluation[], allocation: AllocationProfile): number {
  let apy = 0;
  for (const e of evaluations) {
    const w = allocation.weights[e.meta.id] ?? 0;
    apy += w * e.live.apy;
  }
  return Number(apy.toFixed(2));
}

function portfolioScoreOf(evaluations: StrategyEvaluation[], allocation: AllocationProfile): number {
  let score = 0;
  for (const e of evaluations) {
    const w = allocation.weights[e.meta.id] ?? 0;
    score += w * e.score.score;
  }
  return Math.round(score);
}

// ─── Public entry ─────────────────────────────────────────────────

export async function runStrategyEngine(): Promise<StrategyEngineResult> {
  const regime = await readRegime();

  // Fetch all adapters in parallel; each is hardened against failure.
  const live = await Promise.all(ALL_ADAPTERS.map(async (a) => ({ adapter: a, data: await a.fetchLive() })));

  const evaluations: StrategyEvaluation[] = live.map(({ adapter, data }) => {
    const score = scoreStrategy(adapter.meta, data, regime.regime, regime.realisedVolPct);
    return { meta: adapter.meta, live: data, score };
  });

  const allocation = allocateWeights(evaluations, regime.regime);
  // Stamp the recommendedWeight back onto each strategy.
  for (const e of evaluations) {
    e.score.recommendedWeight = allocation.weights[e.meta.id] ?? 0;
  }

  // Current on-chain reality: 100% Venus (the deployed vault routes there).
  const currentAllocation: AllocationProfile = {
    weights: { "venus-bnb": 1 },
    reason: "On-chain vault currently routes 100% to Venus BNB lending.",
  };

  const drift = driftBetween(allocation, currentAllocation);

  return {
    regime,
    strategies: evaluations,
    allocation,
    currentAllocation,
    driftBps: drift,
    rebalanceRecommended: drift > 300, // RIQD threshold: 3%
    portfolioScore: portfolioScoreOf(evaluations, allocation),
    blendedApy: blendedApyOf(evaluations, allocation),
    asOf: Math.floor(Date.now() / 1000),
  };
}
