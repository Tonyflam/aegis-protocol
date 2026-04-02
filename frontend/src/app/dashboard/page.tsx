"use client";

import { useEffect } from "react";
import { useWalletContext } from "../../lib/WalletContext";
import { useContractData, usePublicContractData } from "../../lib/useContracts";
import { useLiveMarketData } from "../../lib/useLiveMarket";
import { RISK_LEVELS, RISK_COLORS, CONTRACTS } from "../../lib/constants";
import {
  Shield, Activity, AlertTriangle, CheckCircle, Bot,
  BarChart3, Zap, ExternalLink, Cpu, ArrowRight,
} from "lucide-react";

const FALLBACK_STATS = {
  totalValueProtected: "0", activeAgents: 0, threatsDetected: 0,
  protectionRate: "0", totalDecisions: 0, totalDeposited: "0",
};
const DECISION_TYPES = ["Risk Assessment", "Threat Detected", "Protection Triggered", "All Clear", "Market Analysis", "Position Review"];

export default function DashboardPage() {
  const { address, isConnected, provider } = useWalletContext();
  const contractData = useContractData(provider);
  const publicData = usePublicContractData();
  const liveMarket = useLiveMarketData(30000);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { publicData.fetchPublicData(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isConnected && provider) contractData.fetchAll(address ?? undefined); }, [isConnected, provider, address]);
  useEffect(() => {
    if (!isConnected || !provider) return;
    const interval = setInterval(() => contractData.fetchAll(address ?? undefined), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, provider, address]);

  const stats = {
    totalValueProtected: contractData.vaultStats?.totalValueProtected ?? (publicData.isLive ? publicData.totalValueProtected : FALLBACK_STATS.totalValueProtected),
    activeAgents: contractData.agentCount || publicData.agentCount || FALLBACK_STATS.activeAgents,
    threatsDetected: contractData.loggerStats?.totalThreats ?? (publicData.isLive ? publicData.totalThreats : FALLBACK_STATS.threatsDetected),
    protectionRate: contractData.successRate > 0 ? contractData.successRate.toFixed(1) : publicData.isLive && publicData.agentSuccessRate > 0 ? publicData.agentSuccessRate.toFixed(1) : FALLBACK_STATS.protectionRate,
    totalDecisions: contractData.loggerStats?.totalDecisions ?? (publicData.isLive ? publicData.totalDecisions : FALLBACK_STATS.totalDecisions),
    totalDeposited: contractData.vaultStats?.totalBnbDeposited ?? (publicData.isLive ? publicData.totalDeposited : FALLBACK_STATS.totalDeposited),
  };

  const isLive = contractData.isLive || publicData.isLive;
  const decisions = contractData.decisions.length > 0 ? contractData.decisions : publicData.recentDecisions;
  const riskSnapshot = contractData.riskSnapshot ?? publicData.publicRiskSnapshot;

  const riskBars = riskSnapshot ? [
    { label: "Liquidation Risk", value: riskSnapshot.liquidationRisk, color: riskSnapshot.liquidationRisk > 50 ? "var(--red)" : riskSnapshot.liquidationRisk > 25 ? "var(--yellow)" : "var(--green)" },
    { label: "Volatility", value: riskSnapshot.volatilityScore, color: riskSnapshot.volatilityScore > 50 ? "#f97316" : riskSnapshot.volatilityScore > 25 ? "var(--yellow)" : "var(--green)" },
    { label: "Protocol Risk", value: riskSnapshot.protocolRisk, color: riskSnapshot.protocolRisk > 50 ? "var(--red)" : "var(--green)" },
    { label: "Smart Contract", value: riskSnapshot.smartContractRisk, color: riskSnapshot.smartContractRisk > 30 ? "var(--yellow)" : "var(--green)" },
  ] : [
    { label: "Liquidation Risk", value: 0, color: "var(--text-muted)" },
    { label: "Volatility", value: 0, color: "var(--text-muted)" },
    { label: "Protocol Risk", value: 0, color: "var(--text-muted)" },
    { label: "Smart Contract", value: 0, color: "var(--text-muted)" },
  ];

  const displayDecisions = decisions.slice(0, 6).map((d, i) => ({
    id: i + 1, type: DECISION_TYPES[d.decisionType] || "Unknown", risk: d.riskLevel,
    confidence: d.confidence,
    user: `${d.targetUser.slice(0, 5)}...${d.targetUser.slice(-3)}`,
    time: new Date(d.timestamp * 1000).toLocaleTimeString(), action: d.actionTaken,
  }));

  return (
    <div className="min-h-screen relative z-10">
      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Protocol overview and real-time risk monitoring</p>
          </div>
          {isLive && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5" style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)" }}>
              <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} /> Live Data
            </span>
          )}
        </div>
      </div>

      {/* Market Banner */}
      {!liveMarket.isLoading && liveMarket.bnbPriceCoinGecko > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: "BNB/USD", value: `$${liveMarket.bnbPriceCoinGecko.toFixed(2)}`, extra: `${liveMarket.priceChange24h >= 0 ? "+" : ""}${liveMarket.priceChange24h.toFixed(2)}%`, extraColor: liveMarket.priceChange24h >= 0 ? "var(--green)" : "var(--red)", live: true },
              { label: "Volume 24h", value: `$${(liveMarket.volume24h / 1e9).toFixed(2)}B` },
              { label: "BSC TVL", value: `$${(liveMarket.bscTvl / 1e9).toFixed(2)}B` },
              { label: "Oracle", value: liveMarket.oracleStatus === "consistent" ? "Consistent" : liveMarket.oracleStatus === "warning" ? "Divergence" : "Critical", valueColor: liveMarket.oracleStatus === "consistent" ? "var(--green)" : liveMarket.oracleStatus === "warning" ? "var(--yellow)" : "var(--red)" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}>
                {item.live && <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} />}
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{item.label}</span>
                <span className="text-xs font-mono font-medium" style={{ color: item.valueColor || "var(--text-primary)" }}>{item.value}</span>
                {item.extra && <span className="text-[11px] font-mono" style={{ color: item.extraColor }}>{item.extra}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Value Protected", value: `${stats.totalValueProtected} BNB`, icon: Shield },
            { label: "Total Decisions", value: stats.totalDecisions.toString(), icon: Activity },
            { label: "Active Agents", value: stats.activeAgents.toString(), icon: Bot },
            { label: "Threats Detected", value: stats.threatsDetected.toString(), icon: AlertTriangle },
            { label: "Total Deposited", value: `${stats.totalDeposited} BNB`, icon: Zap },
            { label: "Protection Rate", value: `${stats.protectionRate}%`, icon: CheckCircle },
          ].map((stat, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{stat.label}</span>
              </div>
              <p className="text-lg font-semibold tracking-tight text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Risk Overview */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4" style={{ color: "var(--accent)" }} /> Risk Overview
              </h3>
            </div>
            <div className="space-y-3">
              {riskBars.map((risk, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: "var(--text-secondary)" }}>{risk.label}</span>
                    <span className="font-mono font-medium" style={{ color: risk.color }}>{risk.value}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-base)" }}>
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${risk.value}%`, background: risk.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4" style={{ color: "var(--accent)" }} /> Recent Activity
            </h3>
            <div className="space-y-2">
              {displayDecisions.length > 0 ? displayDecisions.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "var(--bg-base)" }}>
                  <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: `${RISK_COLORS[d.risk]}10` }}>
                    {d.risk >= 3 ? <AlertTriangle className="w-3.5 h-3.5" style={{ color: RISK_COLORS[d.risk] }} /> : <CheckCircle className="w-3.5 h-3.5" style={{ color: RISK_COLORS[d.risk] }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{d.type}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{d.user} · {d.time}</p>
                  </div>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${RISK_COLORS[d.risk]}10`, color: RISK_COLORS[d.risk] }}>
                    {RISK_LEVELS[d.risk]}
                  </span>
                </div>
              )) : (
                <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                  <Activity className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-xs">{isLive ? "No decisions logged yet." : "Connecting to BSC Testnet..."}</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Intelligence */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4" style={{ color: "var(--purple)" }} /> AI Analysis
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: "rgba(167,139,250,0.08)", color: "var(--purple)", border: "1px solid rgba(167,139,250,0.15)" }}>
                {liveMarket.bnbPriceCoinGecko > 0 ? "Live" : "Offline"}
              </span>
            </div>
            <div className="p-3 rounded-lg mb-4 text-xs font-mono leading-relaxed" style={{ background: "var(--bg-base)", color: "var(--text-secondary)" }}>
              {liveMarket.bnbPriceCoinGecko > 0
                ? `BNB @ $${liveMarket.bnbPriceCoinGecko.toFixed(2)} | ${liveMarket.priceChange24h >= 0 ? "+" : ""}${liveMarket.priceChange24h.toFixed(2)}% 24h | Vol $${(liveMarket.volume24h / 1e9).toFixed(2)}B | Delta ${liveMarket.priceDelta.toFixed(3)}%`
                : `Waiting for market data...`}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Sentiment", value: liveMarket.priceChange24h < -5 ? "Bearish" : liveMarket.priceChange24h > 5 ? "Bullish" : "Neutral", color: liveMarket.priceChange24h < -5 ? "var(--red)" : liveMarket.priceChange24h > 5 ? "var(--green)" : "var(--purple)" },
                { label: "Risk Score", value: `${Math.min(100, Math.round(Math.abs(liveMarket.priceChange24h) * 4 + (liveMarket.priceDelta > 1 ? 30 : 0)))}/100`, color: Math.abs(liveMarket.priceChange24h) > 10 ? "var(--red)" : Math.abs(liveMarket.priceChange24h) > 3 ? "var(--yellow)" : "var(--green)" },
                { label: "Confidence", value: `${liveMarket.bnbPriceCoinGecko > 0 ? Math.max(60, Math.round(100 - Math.abs(liveMarket.priceChange24h) * 2 - liveMarket.priceDelta * 10)) : "—"}%`, color: "var(--accent)" },
                { label: "Threats", value: liveMarket.priceDelta > 5 ? "Oracle Attack" : liveMarket.priceDelta > 1 ? "Divergence" : "None", color: liveMarket.priceDelta > 1 ? "var(--red)" : "var(--green)" },
              ].map((m, i) => (
                <div key={i} className="p-2.5 rounded-lg" style={{ background: "var(--bg-base)" }}>
                  <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                  <p className="text-xs font-semibold" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* PancakeSwap Oracle */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4" style={{ color: "var(--bnb)" }} /> PancakeSwap V2 Oracle
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: "rgba(240,185,11,0.08)", color: "var(--bnb)", border: "1px solid rgba(240,185,11,0.15)" }}>BSC Mainnet</span>
            </div>
            <div className="space-y-2 p-3 rounded-lg mb-4" style={{ background: "var(--bg-base)" }}>
              {[
                { label: "CoinGecko (API)", value: `$${liveMarket.bnbPriceCoinGecko > 0 ? liveMarket.bnbPriceCoinGecko.toFixed(2) : "—"}` },
                { label: "PancakeSwap (On-chain)", value: `$${liveMarket.bnbPricePancakeSwap > 0 ? liveMarket.bnbPricePancakeSwap.toFixed(2) : "—"}` },
              ].map((row, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span style={{ color: "var(--text-muted)" }}>{row.label}</span>
                  <span className="font-mono" style={{ color: "var(--text-primary)" }}>{row.value}</span>
                </div>
              ))}
              <div className="divider my-1" />
              <div className="flex justify-between text-xs">
                <span style={{ color: "var(--text-muted)" }}>Delta</span>
                <span className="font-mono font-semibold" style={{ color: liveMarket.priceDelta > 1 ? "var(--yellow)" : "var(--green)" }}>
                  {liveMarket.bnbPriceCoinGecko > 0 ? liveMarket.priceDelta.toFixed(3) : "—"}% {liveMarket.priceDelta > 1 ? "⚠" : "✓"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {["WBNB", "BUSD", "USDT", "CAKE", "ETH", "BTCB", "USDC", "XRP"].map((t) => (
                <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(240,185,11,0.06)", color: "var(--bnb)", border: "1px solid rgba(240,185,11,0.1)" }}>{t}</span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg" style={{ background: "var(--bg-base)" }}>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>Status</p>
                <p className="text-xs font-semibold" style={{ color: liveMarket.oracleStatus === "consistent" ? "var(--green)" : liveMarket.oracleStatus === "warning" ? "var(--yellow)" : "var(--red)" }}>
                  {liveMarket.oracleStatus === "loading" ? "Loading..." : liveMarket.oracleStatus === "consistent" ? "Consistent" : liveMarket.oracleStatus === "warning" ? "Divergence" : "CRITICAL"}
                </p>
              </div>
              <div className="p-2.5 rounded-lg" style={{ background: "var(--bg-base)" }}>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>Source</p>
                <p className="text-xs font-semibold" style={{ color: "var(--bnb)" }}>{liveMarket.bnbPricePancakeSwap > 0 ? "Live On-Chain" : "On-Chain"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* $UNIQ Token + Decision Log */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="grid lg:grid-cols-3 gap-4">
          {/* $UNIQ */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">💎 $UNIQ Token</h3>
            <div className="space-y-2">
              {[
                { label: "Total Supply", value: "1,000,000,000", accent: "var(--bnb)" },
                { label: "Chain", value: "BNB Chain", accent: "var(--accent)" },
                { label: "Tax", value: "3%", accent: "var(--purple)" },
                { label: "Contract", value: "Renounced", accent: "var(--green)" },
              ].map((t, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: "var(--bg-base)", borderLeft: `2px solid ${t.accent}` }}>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t.label}</p>
                  <p className="text-sm font-semibold text-white">{t.value}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
              <a href={`https://bscscan.com/token/${CONTRACTS.UNIQ_TOKEN}`} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1" style={{ color: "var(--accent)" }}>BSCScan <ExternalLink className="w-2.5 h-2.5" /></a>
              <span>·</span>
              <a href="https://flap.sh/bsc/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1" style={{ color: "var(--accent)" }}>Trade <ExternalLink className="w-2.5 h-2.5" /></a>
            </div>
          </div>

          {/* Decision Log */}
          <div className="card overflow-hidden lg:col-span-2">
            <div className="p-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4" style={{ color: "var(--accent)" }} /> AI Decision Log
                <span className="text-[10px] font-normal" style={{ color: "var(--text-muted)" }}>(On-chain)</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
                    <th className="px-4 py-2.5 text-left font-medium">Type</th>
                    <th className="px-4 py-2.5 text-left font-medium">Risk</th>
                    <th className="px-4 py-2.5 text-left font-medium">Confidence</th>
                    <th className="px-4 py-2.5 text-left font-medium">User</th>
                    <th className="px-4 py-2.5 text-left font-medium">Time</th>
                    <th className="px-4 py-2.5 text-left font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayDecisions.length > 0 ? displayDecisions.map((d) => (
                    <tr key={d.id} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td className="px-4 py-3"><span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>{d.type}</span></td>
                      <td className="px-4 py-3"><span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${RISK_COLORS[d.risk]}10`, color: RISK_COLORS[d.risk] }}>{RISK_LEVELS[d.risk]}</span></td>
                      <td className="px-4 py-3 text-xs font-mono text-white">{d.confidence}%</td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-muted)" }}>{d.user}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{d.time}</td>
                      <td className="px-4 py-3">
                        {d.action ? <span className="flex items-center gap-1 text-xs" style={{ color: "var(--green)" }}><CheckCircle className="w-3 h-3" /> Executed</span>
                          : <span className="text-xs" style={{ color: "var(--text-muted)" }}>Monitor</span>}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                      {isLive ? "No decisions logged on-chain yet." : "Connecting to BSC Testnet RPC..."}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Loop */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Agent Decision Loop <span className="font-normal" style={{ color: "var(--text-muted)" }}>— 30s cycles</span></h3>
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
    </div>
  );
}
