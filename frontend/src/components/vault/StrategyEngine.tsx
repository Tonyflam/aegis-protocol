"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Cpu,
  Loader2,
  Shield,
  Sparkles,
  TrendingUp,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import type {
  StrategyEngineResult,
  StrategyEvaluation,
  MarketRegime,
} from "@/lib/strategies/types";
import { Card } from "@/components/ui";

// Refresh cadence: 60s aligns with the API cache horizon.
const REFRESH_MS = 60_000;

// ─── Helpers ─────────────────────────────────────────────────────

const REGIME_LABEL: Record<MarketRegime, string> = {
  CALM: "Calm",
  MODERATE: "Moderate",
  HIGH: "Elevated",
  EXTREME: "Defensive",
};

// All four regimes share the monochrome palette. The dot intensity is
// the only visual cue, in line with the rest of the redesign.
const REGIME_DOT: Record<MarketRegime, string> = {
  CALM: "var(--text-muted)",
  MODERATE: "var(--text-secondary)",
  HIGH: "var(--text-primary)",
  EXTREME: "var(--accent)",
};

function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

function formatTvl(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd.toFixed(0)}`;
}

function ageString(asOf: number, now: number): string {
  const delta = Math.max(0, now - asOf);
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  return `${Math.floor(delta / 3600)}h ago`;
}

// ─── Animated number (smooth APY/score transitions) ───────────────
function AnimatedNumber({ value, decimals = 2 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const start = useRef(value);
  const target = useRef(value);
  const startTs = useRef<number>(0);

  useEffect(() => {
    start.current = display;
    target.current = value;
    startTs.current = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTs.current) / 600);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(start.current + (target.current - start.current) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{display.toFixed(decimals)}</>;
}

// ─── Allocation bar with twin tracks (current vs target) ─────────
function AllocationBar({
  current,
  target,
  delay = 0,
}: {
  current: number;
  target: number;
  delay?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(id);
  }, [delay]);

  const cur = mounted ? Math.max(0, Math.min(1, current)) : 0;
  const tgt = mounted ? Math.max(0, Math.min(1, target)) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] tracking-[0.08em] uppercase" style={{ color: "var(--text-muted)" }}>
        <span>Current {pct(current, 0)}</span>
        <span>Target {pct(target, 0)}</span>
      </div>
      <div className="relative h-[6px] rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        {/* current */}
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
          style={{ width: `${cur * 100}%`, background: "var(--text-secondary)" }}
        />
        {/* target marker */}
        <div
          className="absolute top-0 bottom-0 w-[2px] transition-[left] duration-700 ease-out"
          style={{ left: `calc(${tgt * 100}% - 1px)`, background: "var(--accent)" }}
        />
      </div>
    </div>
  );
}

// ─── Strategy row ────────────────────────────────────────────────
function StrategyRow({
  ev,
  current,
  index,
}: {
  ev: StrategyEvaluation;
  current: number;
  index: number;
}) {
  const target = ev.score.recommendedWeight;
  const drift = target - current;
  return (
    <div className="grid grid-cols-12 gap-4 py-5 border-t" style={{ borderColor: "var(--border)" }}>
      {/* Identity */}
      <div className="col-span-12 md:col-span-4">
        <div className="flex items-baseline gap-2">
          <span className="t-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="t-h3" style={{ color: "var(--text-primary)" }}>{ev.meta.name}</div>
        </div>
        <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {ev.meta.protocol} · {ev.meta.kind.replace("-", " ")}
        </div>
        <p className="mt-2 t-body" style={{ color: "var(--text-secondary)" }}>
          {ev.score.rationale}
        </p>
        {ev.meta.contractAddress ? (
          <a
            href={`https://bscscan.com/address/${ev.meta.contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs"
            style={{ color: "var(--accent)" }}
          >
            <ExternalLink className="w-3 h-3" />
            BscScan
          </a>
        ) : null}
      </div>

      {/* Metrics */}
      <div className="col-span-12 md:col-span-4 grid grid-cols-3 gap-4">
        <div>
          <div className="text-[10px] tracking-[0.1em] uppercase" style={{ color: "var(--text-muted)" }}>APY</div>
          <div className="t-mono text-2xl" style={{ color: "var(--text-primary)" }}>
            <AnimatedNumber value={ev.live.apy} decimals={2} />%
          </div>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.1em] uppercase" style={{ color: "var(--text-muted)" }}>TVL</div>
          <div className="t-mono text-2xl" style={{ color: "var(--text-primary)" }}>
            {formatTvl(ev.live.tvlUsd)}
          </div>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.1em] uppercase" style={{ color: "var(--text-muted)" }}>Score</div>
          <div className="t-mono text-2xl" style={{ color: "var(--text-primary)" }}>
            <AnimatedNumber value={ev.score.score} decimals={0} />
          </div>
        </div>
      </div>

      {/* Allocation */}
      <div className="col-span-12 md:col-span-4 space-y-2">
        <AllocationBar current={current} target={target} delay={index * 80} />
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
          <span>Sharpe {ev.score.sharpe.toFixed(2)}</span>
          <span aria-hidden>·</span>
          <span>IL {ev.live.ilExposure.toFixed(0)}</span>
          {Math.abs(drift) > 0.01 ? (
            <>
              <span aria-hidden>·</span>
              <span style={{ color: drift > 0 ? "var(--accent)" : "var(--text-secondary)" }}>
                {drift > 0 ? "+" : ""}{(drift * 100).toFixed(1)}% drift
              </span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────
export function StrategyEngine() {
  const [data, setData] = useState<StrategyEngineResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(REFRESH_MS / 1000);

  async function load() {
    try {
      setError(null);
      const res = await fetch("/api/vault/strategies", { cache: "no-store" });
      if (!res.ok) throw new Error(`engine ${res.status}`);
      const json = (await res.json()) as StrategyEngineResult;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "engine offline");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const tickRefresh = setInterval(load, REFRESH_MS);
    const tickClock = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
      setSecondsUntilRefresh((s) => (s <= 1 ? REFRESH_MS / 1000 : s - 1));
    }, 1000);
    return () => {
      clearInterval(tickRefresh);
      clearInterval(tickClock);
    };
  }, []);

  if (loading && !data) {
    return (
      <Card padded>
        <div className="flex items-center gap-3 t-body" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          Booting strategy engine, fetching live yields and BNB volatility.
        </div>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card padded>
        <div className="flex items-center gap-3 t-body" style={{ color: "var(--text-muted)" }}>
          <Activity className="w-4 h-4" />
          Strategy engine is temporarily offline. Retry in a moment.
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const sortedStrategies = [...data.strategies].sort(
    (a, b) => b.score.recommendedWeight - a.score.recommendedWeight,
  );

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="section-eyebrow flex items-center gap-2">
            <Cpu className="w-3 h-3" />
            <span>Strategy Engine</span>
          </div>
          <h2 className="t-h1 mt-2" style={{ color: "var(--text-primary)" }}>
            The AI is allocating capital.
          </h2>
          <p className="t-body mt-2 max-w-2xl" style={{ color: "var(--text-secondary)" }}>
            {data.regime.narrative}
          </p>
        </div>

        <div className="flex items-center gap-3 t-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
          <span className="relative inline-flex w-2 h-2">
            <span
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: "var(--accent)", opacity: 0.5 }}
            />
            <span
              className="relative rounded-full w-2 h-2"
              style={{ background: "var(--accent)" }}
            />
          </span>
          <span>Live</span>
          <span aria-hidden>·</span>
          <span>Next read in {secondsUntilRefresh}s</span>
          <button
            onClick={load}
            className="ml-1 inline-flex items-center gap-1 hover:text-[var(--text-secondary)]"
            aria-label="Refresh strategy engine"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Regime + portfolio metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x" style={{ borderColor: "var(--border)" }}>
        <div className="px-6 first:pl-0">
          <div className="text-[10px] tracking-[0.1em] uppercase" style={{ color: "var(--text-muted)" }}>Regime</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: REGIME_DOT[data.regime.regime] }} />
            <span className="t-h2" style={{ color: "var(--text-primary)" }}>
              {REGIME_LABEL[data.regime.regime]}
            </span>
          </div>
          <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {data.regime.realisedVolPct.toFixed(1)}% vol · conf {data.regime.confidence}
          </div>
        </div>

        <div className="px-6">
          <div className="text-[10px] tracking-[0.1em] uppercase" style={{ color: "var(--text-muted)" }}>Blended APY</div>
          <div className="mt-2 t-h2 t-mono" style={{ color: "var(--text-primary)" }}>
            <AnimatedNumber value={data.blendedApy} decimals={2} />%
          </div>
          <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Weighted across all strategies
          </div>
        </div>

        <div className="px-6">
          <div className="text-[10px] tracking-[0.1em] uppercase" style={{ color: "var(--text-muted)" }}>Portfolio Score</div>
          <div className="mt-2 t-h2 t-mono" style={{ color: "var(--text-primary)" }}>
            <AnimatedNumber value={data.portfolioScore} decimals={0} />
          </div>
          <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Risk-adjusted, 0 to 100
          </div>
        </div>

        <div className="px-6">
          <div className="text-[10px] tracking-[0.1em] uppercase" style={{ color: "var(--text-muted)" }}>Drift vs On-Chain</div>
          <div className="mt-2 t-h2 t-mono" style={{ color: data.rebalanceRecommended ? "var(--accent)" : "var(--text-primary)" }}>
            {(data.driftBps / 100).toFixed(2)}%
          </div>
          <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {data.rebalanceRecommended ? "Above 3% threshold" : "Within tolerance"}
          </div>
        </div>
      </div>

      {/* Strategy rows */}
      <div>
        <div className="grid grid-cols-12 gap-4 pb-3 text-[10px] tracking-[0.1em] uppercase" style={{ color: "var(--text-muted)" }}>
          <div className="col-span-12 md:col-span-4">Strategy</div>
          <div className="col-span-12 md:col-span-4">Live metrics</div>
          <div className="col-span-12 md:col-span-4">Allocation drift</div>
        </div>
        {sortedStrategies.map((ev, i) => (
          <StrategyRow
            key={ev.meta.id}
            ev={ev}
            current={data.currentAllocation.weights[ev.meta.id] ?? 0}
            index={i}
          />
        ))}
      </div>

      {/* Allocation rationale */}
      <Card padded>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="section-eyebrow flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              AI Rationale
            </div>
            <p className="t-body-lg mt-3" style={{ color: "var(--text-primary)" }}>
              {data.allocation.reason}
            </p>
            <p className="t-caption mt-2">
              Recommendation generated {ageString(data.asOf, now)} from BNB volatility
              telemetry, live yield feeds, and per-strategy risk vectors.
            </p>
          </div>
          <div>
            <div className="section-eyebrow flex items-center gap-2">
              <Shield className="w-3 h-3" />
              Execution Status
            </div>
            <p className="t-body mt-3" style={{ color: "var(--text-secondary)" }}>
              The on-chain vault routes 100% to Venus today. Multi-strategy
              execution requires the Phase 6 router contract; until then this
              panel runs in advisory mode and the AI surfaces drift the moment
              it crosses 3%.
            </p>
            {data.rebalanceRecommended ? (
              <div className="mt-3 flex items-center gap-2 t-body" style={{ color: "var(--accent)" }}>
                <TrendingUp className="w-4 h-4" />
                Rebalance window is open. Allocation drift exceeds the 3% threshold.
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 t-body" style={{ color: "var(--text-muted)" }}>
                <Activity className="w-4 h-4" />
                Holding steady. No rebalance action required at this time.
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
