"use client";

import { useState, useEffect, useCallback } from "react";

import { CONTRACTS, CHAIN_CONFIG, AGENT_TIERS, AGENT_STATUSES, RISK_LEVELS, RISK_COLORS } from "../../lib/constants";
import { REGISTRY_ABI, LOGGER_ABI } from "../../lib/abis";
import { ethers } from "ethers";
import {
  Bot, Shield, Activity, AlertTriangle,
  Loader2, ExternalLink, Zap, Target,
  Info,
} from "lucide-react";

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
  reputationScore: number;
  successRate: number;
}

interface Decision {
  agentId: number;
  targetUser: string;
  decisionType: number;
  riskLevel: number;
  confidence: number;
  timestamp: number;
  actionTaken: boolean;
}

export default function AgentPage() {
  // wallet context available for future personalization

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [stats, setStats] = useState({ totalDecisions: 0, totalThreats: 0, totalProtections: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const rpc = new ethers.JsonRpcProvider(CHAIN_CONFIG.bscTestnet.rpcUrls[0]);
      const registry = new ethers.Contract(CONTRACTS.REGISTRY, REGISTRY_ABI, rpc);
      const logger = new ethers.Contract(CONTRACTS.DECISION_LOGGER, LOGGER_ABI, rpc);

      // Fetch stats and agent count in parallel
      const [agentCountResult, statsResult] = await Promise.allSettled([
        registry.getAgentCount(),
        logger.getStats(),
      ]);

      const agentCount = agentCountResult.status === "fulfilled" ? Number(agentCountResult.value) : 0;

      if (statsResult.status === "fulfilled") {
        setStats({
          totalDecisions: Number(statsResult.value[0]),
          totalThreats: Number(statsResult.value[1]),
          totalProtections: Number(statsResult.value[2]),
        });
      }

      // Fetch all agents
      const agentPromises = [];
      for (let i = 1; i <= agentCount; i++) {
        agentPromises.push(
          Promise.allSettled([
            registry.getAgent(i),
            registry.getReputationScore(i),
            registry.getSuccessRate(i),
          ]).then(([agentRes, repRes, srRes]) => {
            if (agentRes.status !== "fulfilled") return null;
            const a = agentRes.value;
            return {
              id: i,
              name: a.name,
              agentURI: a.agentURI,
              operator: a.operator,
              registeredAt: Number(a.registeredAt),
              totalDecisions: Number(a.totalDecisions),
              successfulActions: Number(a.successfulActions),
              totalValueProtected: ethers.formatEther(a.totalValueProtected),
              status: Number(a.status),
              tier: Number(a.tier),
              reputationScore: repRes.status === "fulfilled" ? Number(repRes.value) : 0,
              successRate: srRes.status === "fulfilled" ? Number(srRes.value) : 0,
            } as AgentInfo;
          })
        );
      }

      const agentResults = await Promise.all(agentPromises);
      const validAgents = agentResults.filter(Boolean) as AgentInfo[];
      setAgents(validAgents);

      if (validAgents.length > 0) {
        setSelectedAgent(validAgents[0]);
      }

      // Fetch recent decisions
      try {
        const recentDecisions = await logger.getRecentDecisions(20);
        setDecisions(
          recentDecisions.map((d: { agentId: bigint; targetUser: string; decisionType: bigint; riskLevel: bigint; confidence: bigint; timestamp: bigint; actionTaken: boolean }) => ({
            agentId: Number(d.agentId),
            targetUser: d.targetUser,
            decisionType: Number(d.decisionType),
            riskLevel: Number(d.riskLevel),
            confidence: Number(d.confidence),
            timestamp: Number(d.timestamp),
            actionTaken: d.actionTaken,
          }))
        );
      } catch {
        // No decisions yet
      }
    } catch {
      // Contract read errors are expected on fresh deployments
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const decisionTypeNames = ["Emergency Withdraw", "Rebalance", "Alert Only", "Stop Loss", "Take Profit"];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(0,212,245,0.08)", border: "1px solid rgba(0,212,245,0.15)" }}
          >
            <Bot className="w-5 h-5" style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Agents</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Registered agents and their decision history on BSC Testnet
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 space-y-6">
        {/* Loading */}
        {isLoading && (
          <div className="card p-10 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: "var(--accent)" }} />
            <p className="text-sm font-medium text-white mb-1">Reading Contracts...</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Querying AegisRegistry and DecisionLogger on BSC Testnet
            </p>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Protocol-Wide Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-4 text-center">
                <Zap className="w-5 h-5 mx-auto mb-2" style={{ color: "var(--accent)" }} />
                <p className="text-lg font-semibold text-white">{stats.totalDecisions}</p>
                <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                  Total Decisions
                </p>
              </div>
              <div className="card p-4 text-center">
                <AlertTriangle className="w-5 h-5 mx-auto mb-2" style={{ color: "var(--red)" }} />
                <p className="text-lg font-semibold text-white">{stats.totalThreats}</p>
                <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                  Threats Detected
                </p>
              </div>
              <div className="card p-4 text-center">
                <Shield className="w-5 h-5 mx-auto mb-2" style={{ color: "var(--green)" }} />
                <p className="text-lg font-semibold text-white">{stats.totalProtections}</p>
                <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                  Protections Triggered
                </p>
              </div>
            </div>

            {/* Agent List */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                Registered Agents ({agents.length})
              </h2>

              {agents.length === 0 ? (
                <div className="card p-8 text-center">
                  <Bot className="w-10 h-10 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
                  <h3 className="text-lg font-semibold text-white mb-2">No Agents Registered</h3>
                  <p className="text-sm max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
                    No AI agents have been registered on the AegisRegistry yet.
                    Agents can be registered by operators through the smart contract.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent)}
                      className={`card w-full text-left p-4 transition-all duration-200 ${
                        selectedAgent?.id === agent.id ? "!border-[var(--accent)]" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: agent.status === 0 ? "rgba(52,211,153,0.08)" : "rgba(239,68,68,0.08)",
                            border: `1px solid ${agent.status === 0 ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)"}`,
                          }}
                        >
                          <Bot className="w-5 h-5" style={{ color: agent.status === 0 ? "var(--green)" : "var(--red)" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-white">
                              {agent.name || `Agent #${agent.id}`}
                            </span>
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{
                                background: agent.status === 0 ? "rgba(52,211,153,0.1)" : "rgba(239,68,68,0.1)",
                                color: agent.status === 0 ? "#34d399" : "#f87171",
                              }}
                            >
                              {AGENT_STATUSES[agent.status] || "Unknown"}
                            </span>
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: "rgba(167,139,250,0.1)", color: "var(--purple)" }}
                            >
                              {AGENT_TIERS[agent.tier] || "Unknown"}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
                            <span>{agent.totalDecisions} decisions</span>
                            <span>{agent.successRate}% success</span>
                            <span>Rep: {agent.reputationScore}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                            {agent.operator.slice(0, 6)}...{agent.operator.slice(-4)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Agent Detail */}
            {selectedAgent && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  {selectedAgent.name || `Agent #${selectedAgent.id}`} — Details
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>ID</p>
                    <p className="text-white font-semibold mt-0.5">#{selectedAgent.id}</p>
                  </div>
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>Tier</p>
                    <p className="font-semibold mt-0.5" style={{ color: "var(--purple)" }}>
                      {AGENT_TIERS[selectedAgent.tier] || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>Success Rate</p>
                    <p className="text-white font-semibold mt-0.5">{selectedAgent.successRate}%</p>
                  </div>
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>Value Protected</p>
                    <p className="text-white font-semibold mt-0.5">
                      {parseFloat(selectedAgent.totalValueProtected).toFixed(4)} BNB
                    </p>
                  </div>
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>Reputation</p>
                    <p className="text-white font-semibold mt-0.5">{selectedAgent.reputationScore}</p>
                  </div>
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>Decisions</p>
                    <p className="text-white font-semibold mt-0.5">{selectedAgent.totalDecisions}</p>
                  </div>
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>Successful</p>
                    <p className="text-white font-semibold mt-0.5">{selectedAgent.successfulActions}</p>
                  </div>
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>Registered</p>
                    <p className="text-white font-semibold mt-0.5">
                      {selectedAgent.registeredAt > 0
                        ? new Date(selectedAgent.registeredAt * 1000).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <a
                    href={`https://testnet.bscscan.com/address/${selectedAgent.operator}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium inline-flex items-center gap-1"
                    style={{ color: "var(--accent)" }}
                  >
                    View operator on BSCScan <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Recent Decisions */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                Recent Decisions
              </h2>

              {decisions.length === 0 ? (
                <div className="card p-6 text-center">
                  <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm text-white mb-1">No Decisions Yet</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Decision history will appear here once agents begin operating.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {decisions.map((d, i) => (
                    <div key={i} className="card px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: RISK_COLORS[d.riskLevel] || "#6b7280" }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-white font-medium">
                              Agent #{d.agentId}
                            </span>
                            <span style={{ color: RISK_COLORS[d.riskLevel] || "var(--text-muted)" }}>
                              {RISK_LEVELS[d.riskLevel] || "None"} Risk
                            </span>
                            <span style={{ color: "var(--text-muted)" }}>•</span>
                            <span style={{ color: "var(--text-muted)" }}>
                              {decisionTypeNames[d.decisionType] || "Unknown"}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
                            Target: {d.targetUser.slice(0, 10)}...{d.targetUser.slice(-6)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px]" style={{ color: d.actionTaken ? "var(--green)" : "var(--text-muted)" }}>
                            {d.actionTaken ? "Action Taken" : "Alert Only"}
                          </p>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {d.confidence}% conf
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Info banner */}
        <div className="flex items-start gap-2 px-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            All agent data is read directly from the AegisRegistry and DecisionLogger contracts on BSC Testnet.
            Reputation scores and decision histories are immutable on-chain records.
          </p>
        </div>
      </section>
    </div>
  );
}
