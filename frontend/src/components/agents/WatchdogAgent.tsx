"use client";

// ═══════════════════════════════════════════════════════════════
// Watchdog Agent — Autonomous Protocol Health Monitor
// THINKS: Uses LLM to analyze protocol health trends and anomalies
// OBSERVES: Monitors BSC DeFi protocols via DeFiLlama for TVL changes
// DECIDES: Recommends watchlist additions or danger alerts
// ACTS: Maintains watchlist, alerts on critical protocol events
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from "react";
import { ethers } from "ethers";
import { useWalletContext } from "../../lib/WalletContext";
import { useAgentLoop, type AgentTool } from "../../lib/agents/useAgentLoop";
import AgentShell from "../../lib/agents/AgentShell";
import { createAction, type PendingAction, type ThoughtEntry } from "../../lib/agents/brain";
import { Eye, Plus, X, TrendingDown, TrendingUp, AlertTriangle, Star } from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ──────────────────────────────────────────────────

interface ProtocolData {
  name: string;
  slug: string;
  tvl: number;
  change1d: number;
  change7d: number;
  category: string;
  chains: string[];
  url: string;
  healthScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

interface WatchdogObservation {
  protocols: ProtocolData[];
  watchlist: string[];
  watchlistProtocols: ProtocolData[];
  userPositions: ProtocolData[];
  totalBscTvl: number;
  avgHealthScore: number;
  criticalCount: number;
}

// ─── Constants ──────────────────────────────────────────────

const WATCHLIST_KEY = "aegis_watchdog_watchlist";
const BSC_RPC = "https://bsc-rpc.publicnode.com";

const PROTOCOL_TOKENS: { protocol: string; tokens: string[] }[] = [
  { protocol: "pancakeswap", tokens: ["0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"] },
  { protocol: "venus", tokens: ["0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63"] },
  { protocol: "alpaca-finance", tokens: ["0x8F0528cE5eF7B51152A59745bEfDD91D97091d2F"] },
  { protocol: "biswap", tokens: ["0x965F527D9159dCe6288a2219DB51fc6Eef120dD1"] },
  { protocol: "thena", tokens: ["0xF4C8E32EaDEC4BFe97E0F595AdD0f4450a863a11"] },
  { protocol: "radiant-v2", tokens: ["0xd4d42F0b6DEF4CE0383636770eF773390d85c61A"] },
  { protocol: "wombat-exchange", tokens: ["0xAD6742A35fB341A9Cc6ad674738Dd8da98b94Fb1"] },
];

let pendingManualAdd: string | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function formatTvl(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function computeHealthScore(tvl: number, change1d: number, change7d: number): { score: number; risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" } {
  let score = 70;

  // TVL size factor
  if (tvl > 100_000_000) score += 15;
  else if (tvl > 10_000_000) score += 10;
  else if (tvl > 1_000_000) score += 5;
  else score -= 10;

  // 1d change
  if (change1d < -20) score -= 30;
  else if (change1d < -10) score -= 20;
  else if (change1d < -5) score -= 10;
  else if (change1d > 5) score += 5;

  // 7d change
  if (change7d < -30) score -= 25;
  else if (change7d < -15) score -= 15;
  else if (change7d < -5) score -= 5;
  else if (change7d > 10) score += 5;

  score = Math.max(0, Math.min(100, score));
  const risk = score >= 70 ? "LOW" : score >= 50 ? "MEDIUM" : score >= 30 ? "HIGH" : "CRITICAL";
  return { score, risk };
}

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveWatchlist(list: string[]): void {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
}

// ─── Agent Tool ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createWatchdogTool(_bPrice: number): AgentTool<WatchdogObservation> {
  return {
    name: "Watchdog",
    interval: 120000,

    systemPrompt: `You are the Watchdog Agent — an autonomous DeFi protocol health monitor for BNB Smart Chain.

Your job: Periodically check protocol health metrics and alert on dangerous trends.

You watch for:
1. Sudden TVL drops (>10% in 24h = concerning, >20% = dangerous)
2. Sustained weekly TVL decline (>15% in 7d)
3. Very small TVL protocols that user interacts with (high risk)
4. Healthy growing protocols worthy of monitoring

Respond with ONLY valid JSON:
{
  "summary": "Overall BSC DeFi health assessment",
  "threats": ["list of concerning trends"],
  "highlights": ["positive noteworthy events"],
  "actions": [
    {
      "type": "alert_danger",
      "protocolSlug": "protocol-name",
      "protocolName": "Display Name",
      "reason": "Why this is dangerous",
      "risk": "HIGH|CRITICAL",
      "description": "Alert: Protocol in danger"
    },
    {
      "type": "watch_protocol",
      "protocolSlug": "protocol-name",
      "protocolName": "Display Name",
      "reason": "Why to add to watchlist",
      "risk": "MEDIUM",
      "description": "Add Protocol to watchlist"
    }
  ]
}

If everything looks healthy: { "summary": "...", "threats": [], "highlights": [...], "actions": [] }`,

    observe: async (address: string | null): Promise<WatchdogObservation> => {
      const watchlist = loadWatchlist();
      const protocols: ProtocolData[] = [];

      // Fetch BSC protocols from DeFiLlama
      try {
        const resp = await fetch("https://api.llama.fi/protocols");
        if (resp.ok) {
          const data = await resp.json();
          const bscProtos = data
            .filter((p: Record<string, unknown>) => {
              const chains = p.chains as string[] | undefined;
              return chains && chains.includes("BSC") && typeof p.tvl === "number" && (p.tvl as number) > 100_000;
            })
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.tvl as number) - (a.tvl as number))
            .slice(0, 50);

          for (const p of bscProtos) {
            const change1d = typeof p.change_1d === "number" ? p.change_1d : 0;
            const change7d = typeof p.change_7d === "number" ? p.change_7d : 0;
            const { score, risk } = computeHealthScore(p.tvl as number, change1d, change7d);
            protocols.push({
              name: p.name as string, slug: p.slug as string,
              tvl: p.tvl as number, change1d, change7d,
              category: (p.category as string) || "Unknown",
              chains: (p.chains as string[]) || [], url: p.url as string || "",
              healthScore: score, riskLevel: risk,
            });
          }
        }
      } catch { /* DeFiLlama may be rate-limited */ }
      await sleep(200);

      // Handle manual watchlist add
      if (pendingManualAdd) {
        const slug = pendingManualAdd;
        pendingManualAdd = null;
        if (!watchlist.includes(slug)) {
          watchlist.push(slug);
          saveWatchlist(watchlist);
        }
      }

      // Detect user positions
      const userPositions: ProtocolData[] = [];
      if (address) {
        const provider = new ethers.JsonRpcProvider(BSC_RPC, 56, { staticNetwork: true });
        for (const pt of PROTOCOL_TOKENS) {
          try {
            const iface = new ethers.Interface(["function balanceOf(address) view returns (uint256)"]);
            for (const tokenAddr of pt.tokens) {
              const contract = new ethers.Contract(tokenAddr, iface, provider);
              const balance = await contract.balanceOf(address);
              if (balance > 0n) {
                const match = protocols.find((p) => p.slug === pt.protocol);
                if (match && !userPositions.find((u) => u.slug === match.slug)) {
                  userPositions.push(match);
                }
              }
            }
          } catch { /* skip */ }
        }
      }

      const watchlistProtocols = protocols.filter((p) => watchlist.includes(p.slug));
      const totalBscTvl = protocols.reduce((s, p) => s + p.tvl, 0);
      const avgHealthScore = protocols.length > 0 ? protocols.reduce((s, p) => s + p.healthScore, 0) / protocols.length : 0;
      const criticalCount = protocols.filter((p) => p.riskLevel === "CRITICAL" || p.riskLevel === "HIGH").length;

      return { protocols, watchlist, watchlistProtocols, userPositions, totalBscTvl, avgHealthScore, criticalCount };
    },

    buildPrompt: (obs: WatchdogObservation, history: ThoughtEntry[]): string => {
      const topByRisk = obs.protocols.filter((p) => p.riskLevel !== "LOW").slice(0, 10)
        .map((p) => `  ${p.name}: TVL ${formatTvl(p.tvl)}, 1d ${p.change1d > 0 ? "+" : ""}${p.change1d.toFixed(1)}%, 7d ${p.change7d > 0 ? "+" : ""}${p.change7d.toFixed(1)}%, score ${p.healthScore} [${p.riskLevel}]`).join("\n");

      const positions = obs.userPositions.map((p) => `  ${p.name}: TVL ${formatTvl(p.tvl)}, 1d ${p.change1d > 0 ? "+" : ""}${p.change1d.toFixed(1)}%, score ${p.healthScore} [${p.riskLevel}]`).join("\n");

      const watched = obs.watchlistProtocols.map((p) => `  ${p.name}: TVL ${formatTvl(p.tvl)}, 1d ${p.change1d > 0 ? "+" : ""}${p.change1d.toFixed(1)}%, 7d ${p.change7d > 0 ? "+" : ""}${p.change7d.toFixed(1)}%, score ${p.healthScore} [${p.riskLevel}]`).join("\n");

      const prevCycles = history.filter((h) => h.phase === "THINK").length;

      return `BSC DeFi Health Report:
Total BSC TVL: ${formatTvl(obs.totalBscTvl)}
Average Health Score: ${obs.avgHealthScore.toFixed(0)}/100
Protocols tracked: ${obs.protocols.length}
At-risk protocols: ${obs.criticalCount}

Risky Protocols:\n${topByRisk || "  (none)"}

User Positions:\n${positions || "  (none detected)"}

Watchlist:\n${watched || "  (empty)"}

Previous analysis cycles: ${prevCycles}

Analyze health trends and recommend actions.`;
    },

    parseActions: (llmResponse: string, obs: WatchdogObservation): PendingAction[] => {
      const actions: PendingAction[] = [];
      try {
        const parsed = JSON.parse(llmResponse);
        if (parsed.actions && Array.isArray(parsed.actions)) {
          for (const a of parsed.actions) {
            if (a.type === "alert_danger" && a.protocolSlug) {
              actions.push(createAction("alert_danger",
                a.description || `DANGER: ${a.protocolName}`,
                (a.risk as PendingAction["risk"]) || "HIGH",
                { protocolSlug: a.protocolSlug, protocolName: a.protocolName },
                a.reason || "Protocol health declining"));
            } else if (a.type === "watch_protocol" && a.protocolSlug) {
              if (!obs.watchlist.includes(a.protocolSlug)) {
                actions.push(createAction("watch_protocol",
                  a.description || `Watch ${a.protocolName}`,
                  "MEDIUM",
                  { protocolSlug: a.protocolSlug, protocolName: a.protocolName },
                  a.reason || "Worth monitoring"));
              }
            }
          }
        }
      } catch { /* skip */ }

      // Fallback: auto-flag critical user positions
      if (actions.length === 0) {
        for (const p of obs.userPositions) {
          if (p.riskLevel === "CRITICAL") {
            actions.push(createAction("alert_danger",
              `YOUR POSITION: ${p.name} health is critical (${p.healthScore}/100)`,
              "CRITICAL",
              { protocolSlug: p.slug, protocolName: p.name },
              `TVL dropped ${p.change1d.toFixed(1)}% in 24h, ${p.change7d.toFixed(1)}% in 7d`));
          }
        }
      }

      return actions;
    },

    execute: async (action: PendingAction): Promise<{ txHash?: string; error?: string }> => {
      const { protocolSlug, protocolName } = action.params as { protocolSlug: string; protocolName: string };

      if (action.type === "watch_protocol") {
        const wl = loadWatchlist();
        if (!wl.includes(protocolSlug)) {
          wl.push(protocolSlug);
          saveWatchlist(wl);
        }
        toast.success(`${protocolName} added to watchlist`);
        return {};
      }

      if (action.type === "alert_danger") {
        toast.error(`⚠️ ${protocolName} — ${action.reasoning}`, { duration: 8000 });
        return {};
      }

      return {};
    },
  };
}

// ─── Observation Panel ─────────────────────────────────────

function WatchdogObservationPanel({ obs }: { obs: WatchdogObservation | null }) {
  if (!obs) return <p className="text-xs" style={{ color: "var(--text-muted)" }}>Fetching protocol data...</p>;

  const riskColor = (r: string) => r === "CRITICAL" ? "#ef4444" : r === "HIGH" ? "#f97316" : r === "MEDIUM" ? "#eab308" : "#22c55e";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 rounded-lg text-center" style={{ background: "rgba(59,130,246,0.08)" }}>
          <p className="text-sm font-bold text-white">{formatTvl(obs.totalBscTvl)}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>BSC TVL</p>
        </div>
        <div className="p-2 rounded-lg text-center" style={{ background: "rgba(34,197,94,0.08)" }}>
          <p className="text-sm font-bold" style={{ color: obs.avgHealthScore >= 60 ? "#22c55e" : "#ef4444" }}>
            {obs.avgHealthScore.toFixed(0)}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Avg Score</p>
        </div>
        <div className="p-2 rounded-lg text-center" style={{ background: obs.criticalCount > 0 ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)" }}>
          <p className="text-sm font-bold" style={{ color: obs.criticalCount > 0 ? "#ef4444" : "#22c55e" }}>{obs.criticalCount}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>At Risk</p>
        </div>
      </div>

      {obs.userPositions.length > 0 && (
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Your Positions</p>
          {obs.userPositions.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded" style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="font-medium text-white truncate">{p.name}</span>
              <span className="ml-auto flex items-center gap-1" style={{ color: p.change1d >= 0 ? "#22c55e" : "#ef4444" }}>
                {p.change1d >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {p.change1d > 0 ? "+" : ""}{p.change1d.toFixed(1)}%
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: riskColor(p.riskLevel), background: riskColor(p.riskLevel) + "15" }}>
                {p.healthScore}
              </span>
            </div>
          ))}
        </div>
      )}

      {obs.watchlistProtocols.length > 0 && (
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Watchlist</p>
          {obs.watchlistProtocols.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded" style={{ background: "rgba(255,255,255,0.02)" }}>
              <Star className="w-3 h-3" style={{ color: "var(--bnb)" }} />
              <span className="font-medium text-white truncate">{p.name}</span>
              <span className="ml-auto" style={{ color: "var(--text-muted)" }}>{formatTvl(p.tvl)}</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: riskColor(p.riskLevel), background: riskColor(p.riskLevel) + "15" }}>
                {p.healthScore}
              </span>
            </div>
          ))}
        </div>
      )}

      {obs.protocols.filter((p) => p.riskLevel === "HIGH" || p.riskLevel === "CRITICAL").slice(0, 5).length > 0 && (
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: "#ef4444" }}>
            <AlertTriangle className="inline w-3 h-3 mr-1" />At-Risk Protocols
          </p>
          {obs.protocols.filter((p) => p.riskLevel === "HIGH" || p.riskLevel === "CRITICAL").slice(0, 5).map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded" style={{ background: "rgba(239,68,68,0.04)" }}>
              <span className="font-medium text-white truncate">{p.name}</span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{p.category}</span>
              <span className="ml-auto" style={{ color: "#ef4444" }}>
                {p.change1d > 0 ? "+" : ""}{p.change1d.toFixed(1)}%
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: riskColor(p.riskLevel), background: riskColor(p.riskLevel) + "15" }}>
                {p.healthScore}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export default function WatchdogAgent({ bnbPrice }: { bnbPrice: number }) {
  const { address, signer, isConnected } = useWalletContext();
  const [manualSlug, setManualSlug] = useState("");

  const tool = useMemo(() => createWatchdogTool(bnbPrice), [bnbPrice]);
  const agent = useAgentLoop<WatchdogObservation>(tool, address, signer);

  const handleAddToWatchlist = useCallback(() => {
    const slug = manualSlug.trim().toLowerCase();
    if (!slug) { toast.error("Enter a protocol slug"); return; }
    pendingManualAdd = slug;
    setManualSlug("");
    agent.runOnce();
    toast.success(`Adding ${slug} on next cycle`);
  }, [manualSlug, agent]);

  const handleRemoveFromWatchlist = useCallback((slug: string) => {
    const wl = loadWatchlist().filter((s) => s !== slug);
    saveWatchlist(wl);
    toast.success("Removed from watchlist");
    agent.runOnce();
  }, [agent]);

  const extraControls = (
    <div className="card p-4" style={{ borderRadius: "12px" }}>
      <p className="text-xs font-medium text-white mb-2">Add to Watchlist</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={manualSlug}
          onChange={(e) => setManualSlug(e.target.value)}
          placeholder="Protocol slug (e.g. pancakeswap)"
          className="flex-1 px-3 py-2 rounded-lg text-xs bg-transparent outline-none"
          style={{ border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
          onKeyDown={(e) => e.key === "Enter" && handleAddToWatchlist()}
        />
        <button onClick={handleAddToWatchlist} className="px-3 py-2 rounded-lg text-xs font-medium" style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7" }}>
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {agent.observations?.watchlist && agent.observations.watchlist.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.observations.watchlist.map((slug) => (
            <span key={slug} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]" style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7" }}>
              {slug}
              <button onClick={() => handleRemoveFromWatchlist(slug)}><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <AgentShell
      name="Watchdog"
      icon={<Eye className="w-5 h-5" style={{ color: "#a855f7" }} />}
      color="#a855f7"
      state={agent.state}
      onStart={agent.start}
      onStop={agent.stop}
      onRunOnce={agent.runOnce}
      onApprove={agent.approveAction}
      onReject={agent.rejectAction}
      onClear={agent.clearThoughts}
      walletConnected={isConnected}
      observationPanel={<WatchdogObservationPanel obs={agent.observations} />}
      extraControls={extraControls}
    />
  );
}
