// ─── Strategy adapters: live data fetchers ────────────────────────
// Each adapter knows how to fetch live APY + risk for one yield source.
// All fetches use public APIs (DefiLlama, CoinGecko, Pancake) so the
// frontend can refresh without on-chain RPC pressure.
//
// On any failure we return a conservative fallback so the engine can
// continue operating with stale data, never crash.

import type { StrategyAdapter, StrategyLiveData } from "./types";

const LLAMA_POOLS_URL = "https://yields.llama.fi/pools";

interface LlamaPool {
  pool: string;
  project: string;
  symbol: string;
  chain: string;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  tvlUsd: number;
  ilRisk: string;       // "no" | "yes"
  exposure: string;     // "single" | "multi"
  predictions?: { predictedClass?: string; predictedProbability?: number };
}

let cachedPools: { pools: LlamaPool[]; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

async function getLlamaPools(): Promise<LlamaPool[]> {
  if (cachedPools && Date.now() - cachedPools.ts < CACHE_TTL_MS) {
    return cachedPools.pools;
  }
  try {
    const res = await fetch(LLAMA_POOLS_URL, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error("llama " + res.status);
    const json = await res.json();
    const pools: LlamaPool[] = (json.data || []) as LlamaPool[];
    cachedPools = { pools, ts: Date.now() };
    return pools;
  } catch {
    return cachedPools?.pools ?? [];
  }
}

function findPool(pools: LlamaPool[], project: string, symbolMatch: RegExp, chain = "BSC"): LlamaPool | undefined {
  return pools.find(
    (p) =>
      p.chain === chain &&
      p.project.toLowerCase() === project.toLowerCase() &&
      symbolMatch.test(p.symbol)
  );
}

const SAFE_FALLBACK = {
  apy: 0,
  tvlUsd: 0,
  protocolRisk: 50,
  ilExposure: 0,
  liquidityScore: 0,
  asOf: 0,
};

// ─── 1. Venus BNB lending ─────────────────────────────────────────
export const venusBnbAdapter: StrategyAdapter = {
  meta: {
    id: "venus-bnb",
    name: "Venus BNB Supply",
    protocol: "Venus Protocol",
    kind: "lending",
    tone: "conservative",
    underlying: "BNB",
    description:
      "Money-market supply on Venus. Stable, non-directional yield with zero impermanent loss.",
    contractAddress: "0xA07c5b74C9B40447a954e1466938b865b6BBea36",
    docUrl: "https://venus.io/markets",
    onChainAvailable: true,
  },
  async fetchLive(): Promise<StrategyLiveData> {
    const pools = await getLlamaPools();
    const p = findPool(pools, "venus-core-pool", /^BNB$/i);
    if (!p) return { ...SAFE_FALLBACK, apy: 2.0, tvlUsd: 50_000_000, asOf: 0 };
    return {
      apy: p.apy ?? p.apyBase ?? 0,
      tvlUsd: p.tvlUsd,
      // Venus is one of BSC's longest-running lending protocols, deep TVL.
      protocolRisk: 18,
      ilExposure: 0,
      liquidityScore: Math.min(100, Math.log10(Math.max(1, p.tvlUsd)) * 12),
      asOf: Math.floor(Date.now() / 1000),
    };
  },
};

// ─── 2. Lista slisBNB (liquid staked BNB) ─────────────────────────
export const listaSlisBnbAdapter: StrategyAdapter = {
  meta: {
    id: "lista-slisbnb",
    name: "Lista slisBNB",
    protocol: "Lista DAO",
    kind: "lst",
    tone: "balanced",
    underlying: "slisBNB",
    description:
      "Liquid-staked BNB earning native staking rewards plus DeFi composability. Carries minor peg risk.",
    contractAddress: "0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B",
    docUrl: "https://lista.org/liquid-staking",
    onChainAvailable: false,
  },
  async fetchLive(): Promise<StrategyLiveData> {
    const pools = await getLlamaPools();
    const p = findPool(pools, "lista-dao", /slisBNB|slisbnb|listed-bnb/i);
    if (!p) return { ...SAFE_FALLBACK, apy: 4.2, tvlUsd: 80_000_000, protocolRisk: 28, asOf: 0 };
    return {
      apy: p.apy ?? p.apyBase ?? 4.2,
      tvlUsd: p.tvlUsd,
      // Newer protocol, but liquid staking primitive is well understood.
      protocolRisk: 28,
      // Peg deviation drives effective IL for an LST.
      ilExposure: 5,
      liquidityScore: Math.min(100, Math.log10(Math.max(1, p.tvlUsd)) * 12),
      pegDeviationBps: 0,
      asOf: Math.floor(Date.now() / 1000),
    };
  },
};

// ─── 3. PancakeSwap V3 CAKE-BNB (concentrated LP) ─────────────────
export const pancakeCakeBnbAdapter: StrategyAdapter = {
  meta: {
    id: "pancake-cake-bnb",
    name: "PancakeSwap CAKE-BNB",
    protocol: "PancakeSwap V3",
    kind: "lp-concentrated",
    tone: "aggressive",
    underlying: "CAKE/BNB LP",
    description:
      "Concentrated liquidity on the CAKE-BNB pair. High fee capture and CAKE rewards, exposed to impermanent loss in volatile regimes.",
    contractAddress: "0x133B3D95bAD5405d14d53473671200e9342896BF",
    docUrl: "https://pancakeswap.finance/liquidity/pools",
    onChainAvailable: false,
  },
  async fetchLive(): Promise<StrategyLiveData> {
    const pools = await getLlamaPools();
    const p =
      findPool(pools, "pancakeswap-amm-v3", /CAKE[-/_]?BNB|BNB[-/_]?CAKE/i) ||
      findPool(pools, "pancakeswap-amm", /CAKE[-/_]?BNB|BNB[-/_]?CAKE/i);
    if (!p) return { ...SAFE_FALLBACK, apy: 18.5, tvlUsd: 4_500_000, protocolRisk: 22, ilExposure: 45, asOf: 0 };
    return {
      apy: p.apy ?? p.apyBase ?? 18.5,
      tvlUsd: p.tvlUsd,
      protocolRisk: 22,
      // CAKE-BNB is correlated but volatile; concentrated LP amplifies IL.
      ilExposure: p.ilRisk === "yes" ? 45 : 25,
      liquidityScore: Math.min(100, Math.log10(Math.max(1, p.tvlUsd)) * 12),
      asOf: Math.floor(Date.now() / 1000),
    };
  },
};

export const ALL_ADAPTERS: StrategyAdapter[] = [
  venusBnbAdapter,
  listaSlisBnbAdapter,
  pancakeCakeBnbAdapter,
];
