"use client";

import { useEffect } from "react";
import { useWalletContext } from "../../lib/WalletContext";
import { useContractData, usePublicContractData } from "../../lib/useContracts";
import { useLiveMarketData } from "../../lib/useLiveMarket";
import { AGENT_TIERS } from "../../lib/constants";
import AgentSimulation from "../../components/AgentSimulation";
import {
  Bot, BarChart3, CheckCircle, ArrowRight,
} from "lucide-react";

export default function AgentPage() {
  const { address, isConnected, provider } = useWalletContext();
  const contractData = useContractData(provider);
  const publicData = usePublicContractData();
  const liveMarket = useLiveMarketData(30000);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { publicData.fetchPublicData(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isConnected && provider) contractData.fetchAll(address ?? undefined); }, [isConnected, provider, address]);

  const isLive = contractData.isLive || publicData.isLive;
  const agentInfo = contractData.agentInfo;
  const agent = agentInfo ?? (publicData.isLive ? {
    name: publicData.agentName || "Agent #0", operator: publicData.agentOperator || "—", tier: publicData.agentTier,
    totalDecisions: publicData.agentTotalDecisions, successfulActions: publicData.agentSuccessfulActions,
    totalValueProtected: publicData.agentTotalValueProtected, registeredAt: publicData.agentRegisteredAt,
  } : { name: "Agent #0", operator: "—", tier: 0, totalDecisions: 0, successfulActions: 0, totalValueProtected: "0", registeredAt: 0 });

  const reputation = contractData.reputation || publicData.agentReputation;
  const successRate = contractData.successRate || publicData.agentSuccessRate;
  const displayReputation = reputation > 0 ? reputation.toFixed(2) : "0.00";
  const displaySuccessRate = successRate > 0 ? `${successRate.toFixed(1)}%` : "0%";

  return (
    <div className="min-h-screen relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Bot className="w-6 h-6" style={{ color: "var(--accent)" }} />
              AI Agent
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Guardian agent details, performance, and live simulation
            </p>
          </div>
          {isLive && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5" style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)" }}>
              <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} /> Live Data
            </span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Agent Info */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-muted)" }}>
                <Bot className="w-6 h-6" style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">{agent.name}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>{AGENT_TIERS[agent.tier]}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1" style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)" }}>
                    <span className="w-1 h-1 rounded-full pulse-live" style={{ background: "var(--green)" }} /> Active
                  </span>
                  {isLive && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(96,165,250,0.08)", color: "#60a5fa" }}>LIVE</span>}
                </div>
              </div>
            </div>
            <div className="space-y-0">
              {[
                { label: "Agent ID", value: "#0 (ERC-721 NFT)" },
                { label: "Operator", value: typeof agent.operator === "string" && agent.operator.length > 10 ? `${agent.operator.slice(0, 8)}...${agent.operator.slice(-4)}` : agent.operator },
                { label: "Registered", value: new Date(agent.registeredAt * 1000).toLocaleDateString() },
                { label: "Total Decisions", value: agent.totalDecisions.toLocaleString() },
                { label: "Successful Actions", value: agent.successfulActions.toString() },
                { label: "Success Rate", value: displaySuccessRate },
                { label: "Value Protected", value: `${agent.totalValueProtected} BNB` },
              ].map((item, i) => (
                <div key={i} className="flex justify-between py-2.5 text-xs" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{item.label}</span>
                  <span className="font-mono text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Performance */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4" style={{ color: "var(--accent)" }} /> Performance
            </h3>
            <div className="text-center mb-5 p-5 rounded-lg" style={{ background: "var(--bg-base)" }}>
              <p className="text-4xl font-bold" style={{ color: "var(--accent)" }}>{displayReputation}</p>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Reputation Score</p>
              <div className="flex justify-center gap-0.5 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="text-sm" style={{ color: star <= Math.round(parseFloat(displayReputation)) ? "var(--yellow)" : "rgba(251,191,36,0.2)" }}>★</span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Capabilities</h4>
              {[
                "Real-time DeFi monitoring (30s cycles)",
                "LLM reasoning (Groq Llama 3.3 70B / GPT-4o)",
                "PancakeSwap V2 on-chain price verification",
                "CoinGecko + DeFiLlama live feeds",
                "5-vector risk analysis engine",
                "Autonomous stop-loss & emergency withdrawal",
                "On-chain decision attestation (keccak256 hash)",
              ].map((cap, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: "var(--accent)" }} />
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{cap}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contract Architecture */}
          <div className="card p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-white mb-4">Contract Architecture</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { name: "AegisRegistry", desc: "ERC-721 agent identity with 4-tier permissions and reputation scoring.", color: "var(--accent)" },
                { name: "AegisVault", desc: "Non-custodial vault for BNB/ERC-20 with agent authorization and risk profiles.", color: "var(--purple)" },
                { name: "DecisionLogger", desc: "Immutable audit trail — risk snapshots, threats, and reasoning hashes.", color: "var(--green)" },
                { name: "AegisScanner", desc: "On-chain token risk registry. Agents push scans, users query before interacting.", color: "#f97316" },
              ].map((c, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: "var(--bg-base)", borderLeft: `2px solid ${c.color}` }}>
                  <h4 className="font-mono text-xs font-semibold mb-1" style={{ color: c.color }}>{c.name}</h4>
                  <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Agent Decision Loop */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Decision Loop <span className="font-normal" style={{ color: "var(--text-muted)" }}>— 30s cycles</span></h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              { label: "OBSERVE", sub: "CoinGecko + DeFiLlama", color: "var(--accent)" },
              { label: "ANALYZE", sub: "5-Vector Risk", color: "var(--purple)" },
              { label: "REASON", sub: "LLM (Groq/OpenAI)", color: "#f97316" },
              { label: "VERIFY", sub: "PancakeSwap V2", color: "var(--bnb)" },
              { label: "DECIDE", sub: "Threat + Confidence", color: "var(--red)" },
              { label: "EXECUTE", sub: "On-Chain TX", color: "var(--green)" },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="px-3 py-2 rounded-md text-center" style={{ background: `${step.color}08`, border: `1px solid ${step.color}18` }}>
                  <p className="font-semibold" style={{ color: step.color }}>{step.label}</p>
                  <p className="mt-0.5" style={{ color: "var(--text-muted)" }}>{step.sub}</p>
                </div>
                {i < 5 && <ArrowRight className="w-3 h-3 hidden md:block" style={{ color: "var(--text-muted)" }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Simulation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        <h2 className="text-lg font-bold tracking-tight mb-2 text-white">Live Agent Simulation</h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Watch a complete 6-phase decision cycle using real market data — the same loop that runs autonomously every 30 seconds.
        </p>
        <AgentSimulation market={liveMarket} />
      </div>
    </div>
  );
}
