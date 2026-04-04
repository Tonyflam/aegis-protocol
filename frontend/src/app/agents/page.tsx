"use client";

import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACTS, CHAIN_CONFIG, AGENT_TIERS, AGENT_TIER_THRESHOLDS } from "../../lib/constants";
import { REGISTRY_ABI } from "../../lib/abis";
import {
  Users, Shield, ExternalLink, Award, Activity,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────

interface AgentInfo {
  id: number;
  name: string;
  agentURI: string;
  operator: string;
  registeredAt: number;
  totalDecisions: number;
  successfulActions: number;
  totalValueProtected: string;
  status: number;
  tier: number;
}

// ─── Hooks ───────────────────────────────────────────────────

function useAgentRegistry() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);

  let rpcIdx = 0;

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const urls = CHAIN_CONFIG.bscTestnet.rpcUrls;
      const provider = new ethers.JsonRpcProvider(urls[rpcIdx % urls.length], undefined, { staticNetwork: true });
      const registry = new ethers.Contract(CONTRACTS.REGISTRY, REGISTRY_ABI, provider);

      const agentCount = Number(await registry.getAgentCount());
      setCount(agentCount);

      if (agentCount === 0) {
        setIsLive(true);
        setLoading(false);
        return;
      }

      const fetched: AgentInfo[] = [];
      const batchSize = Math.min(agentCount, 20);

      for (let i = 0; i < batchSize; i++) {
        try {
          const raw = await registry.getAgent(i);
          fetched.push({
            id: i,
            name: raw[0],
            agentURI: raw[1],
            operator: raw[2],
            registeredAt: Number(raw[3]),
            totalDecisions: Number(raw[4]),
            successfulActions: Number(raw[5]),
            totalValueProtected: ethers.formatEther(raw[6]),
            status: Number(raw[7]),
            tier: Number(raw[8]),
          });
        } catch {
          break;
        }
      }

      setAgents(fetched);
      setIsLive(true);
    } catch {
      rpcIdx++;
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  return { agents, count, loading, isLive, fetchAgents };
}

// ─── Page ────────────────────────────────────────────────────

const TIER_COLORS: Record<number, string> = {
  0: "var(--text-secondary)",
  1: "var(--accent)",
  2: "var(--purple)",
  3: "var(--yellow)",
};

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function AgentsPage() {
  const { agents, count, loading, isLive, fetchAgents } = useAgentRegistry();

  useEffect(() => { fetchAgents(); }, [fetchAgents]);
  useEffect(() => {
    const interval = setInterval(fetchAgents, 30000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const registryDeployed = CONTRACTS.REGISTRY !== "0x0000000000000000000000000000000000000000";

  return (
    <div className="min-h-screen relative z-10">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Users className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Agent Registry
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Registered oracle agents on the AegisRegistry contract
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLive ? (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5"
                style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)" }}>
                <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} /> Live
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-md"
                style={{ background: "rgba(0,212,245,0.08)", color: "var(--accent)" }}>
                BSC Testnet
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Registered Agents", value: isLive ? count.toString() : "—", icon: Users, color: "var(--accent)" },
            { label: "Active Agents", value: isLive ? agents.filter(a => a.status === 1).length.toString() : "—", icon: Activity, color: "var(--green)" },
            { label: "Registry Contract", value: registryDeployed ? "Deployed" : "Pending", icon: Shield, color: registryDeployed ? "var(--green)" : "var(--yellow)" },
            { label: "Network", value: "BSC Testnet", icon: Shield, color: "var(--accent)" },
          ].map((s, i) => (
            <div key={i} className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${s.color} 8%, transparent)` }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{s.value}</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        {loading && (
          <div className="card p-12 text-center">
            <Activity className="w-6 h-6 mx-auto mb-3 animate-pulse" style={{ color: "var(--accent)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading agent registry from BSC Testnet...</p>
          </div>
        )}

        {!loading && isLive && agents.length > 0 && (
          <div className="card overflow-hidden">
            <div className="hidden md:grid grid-cols-[50px_1fr_120px_100px_100px_80px] gap-2 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
              <span>ID</span>
              <span>Agent</span>
              <span>Operator</span>
              <span className="text-right">Decisions</span>
              <span className="text-right">Success</span>
              <span className="text-right">Tier</span>
            </div>

            {agents.map((agent) => (
              <div key={agent.id}
                className="grid grid-cols-1 md:grid-cols-[50px_1fr_120px_100px_100px_80px] gap-2 px-4 py-3 items-center hover:bg-white/[0.02] transition-colors"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>#{agent.id}</span>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: `color-mix(in srgb, ${TIER_COLORS[agent.tier] || "var(--text-muted)"} 12%, transparent)`, color: TIER_COLORS[agent.tier] || "var(--text-muted)" }}>
                    {agent.name.charAt(0) || "A"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{agent.name || `Agent #${agent.id}`}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {agent.registeredAt > 0 ? new Date(agent.registeredAt * 1000).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>

                <div className="hidden md:block">
                  <a href={`https://testnet.bscscan.com/address/${agent.operator}`} target="_blank" rel="noopener noreferrer"
                    className="font-mono text-[11px] hover:underline flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                    {shortAddr(agent.operator)} <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>

                <p className="text-xs font-mono text-right text-white hidden md:block">
                  {agent.totalDecisions.toLocaleString()}
                </p>

                <p className="text-xs font-mono text-right hidden md:block"
                  style={{ color: agent.totalDecisions > 0 ? "var(--green)" : "var(--text-muted)" }}>
                  {agent.totalDecisions > 0
                    ? `${((agent.successfulActions / agent.totalDecisions) * 100).toFixed(1)}%`
                    : "—"}
                </p>

                <div className="hidden md:flex justify-end">
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium"
                    style={{
                      background: `color-mix(in srgb, ${TIER_COLORS[agent.tier] || "var(--text-muted)"} 12%, transparent)`,
                      color: TIER_COLORS[agent.tier] || "var(--text-muted)",
                    }}>
                    {AGENT_TIERS[agent.tier] || "Unknown"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && isLive && agents.length === 0 && (
          <div className="card p-12 text-center">
            <Users className="w-6 h-6 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm mb-1 text-white">No agents registered yet</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Agents register via AegisRegistry on BSC Testnet. The agent SDK and staking contracts
              are fully tested and ready for deployment.
            </p>
          </div>
        )}

        {!loading && !isLive && (
          <div className="card p-12 text-center">
            <Shield className="w-6 h-6 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>Unable to reach registry contract</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              The AegisRegistry is deployed at{" "}
              <a href={`https://testnet.bscscan.com/address/${CONTRACTS.REGISTRY}`} target="_blank" rel="noopener noreferrer"
                className="font-mono hover:underline" style={{ color: "var(--accent)" }}>
                {shortAddr(CONTRACTS.REGISTRY)}
              </a>
            </p>
          </div>
        )}
      </div>

      {/* Staking Tiers Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <h3 className="text-sm font-semibold text-white mb-3">Agent Staking Tiers</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {AGENT_TIERS.map((tier, i) => {
            const color = TIER_COLORS[i] || "var(--text-muted)";
            const threshold = AGENT_TIER_THRESHOLDS[tier as keyof typeof AGENT_TIER_THRESHOLDS];
            const weights = ["1×", "3×", "8×", "20×"];
            return (
              <div key={tier} className="card p-4" style={{ borderLeft: `3px solid ${color}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4" style={{ color }} />
                  <span className="text-sm font-semibold" style={{ color }}>{tier}</span>
                </div>
                <p className="font-mono text-xs text-white mb-1">{threshold.toLocaleString()} $UNIQ</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Consensus Weight: <span className="font-semibold text-white">{weights[i]}</span>
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-4 rounded-lg" style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="font-semibold text-white">Development note:</span>{" "}
            Agent leaderboards and ranking will be enabled once multiple agents are actively scanning on testnet.
            Rankings will be based on real accuracy, speed, volume, and uptime metrics from on-chain data.
          </p>
        </div>
      </div>
    </div>
  );
}
