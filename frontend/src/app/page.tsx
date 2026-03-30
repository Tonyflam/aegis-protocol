"use client";

import Link from "next/link";
import { usePublicContractData } from "../lib/useContracts";
import { useLiveMarketData } from "../lib/useLiveMarket";
import { useWalletContext } from "../lib/WalletContext";
import { CONTRACTS } from "../lib/constants";
import {
  Shield, AlertTriangle, CheckCircle, Bot,
  Zap, ArrowRight, ExternalLink,
  Lock, Search, Bell, Skull, Droplets,
} from "lucide-react";

export default function Home() {
  const { isConnected } = useWalletContext();
  const publicData = usePublicContractData();
  const liveMarket = useLiveMarketData(30000);

  const stats = {
    totalValueProtected: publicData.isLive ? publicData.totalValueProtected : "0",
    activeAgents: publicData.agentCount || 0,
    threatsDetected: publicData.isLive ? publicData.totalThreats : 0,
    protectionRate: publicData.isLive && publicData.agentSuccessRate > 0 ? publicData.agentSuccessRate.toFixed(1) : "0",
  };

  return (
    <div className="min-h-screen relative z-10 flex flex-col">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-14 w-full">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-6" style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)", color: "var(--accent)" }}>
            <Zap className="w-3 h-3" />
            Top 10 — Good Vibes Only Hackathon · BNB Chain
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
            <span className="text-white">Scan. Detect.</span>
            <br />
            <span className="text-gradient">Protect.</span>
          </h1>

          <p className="text-base sm:text-lg leading-relaxed mb-8 max-w-xl" style={{ color: "var(--text-secondary)" }}>
            Scan any BSC token for honeypots, rug pulls, and whale risks in seconds.
            Real-time alerts on whale movements. AI-powered portfolio protection.
          </p>

          <div className="flex items-center gap-3 mb-14">
            <Link href="/scanner" className="btn-primary flex items-center gap-2">
              <Search className="w-4 h-4" />
              Scan a Token
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href={isConnected ? "/positions" : "/dashboard"} className="btn-secondary flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {isConnected ? "My Positions" : "Dashboard"}
            </Link>
          </div>
        </div>

        {/* Market Ticker */}
        {!liveMarket.isLoading && liveMarket.bnbPriceCoinGecko > 0 && (
          <div className="flex items-center gap-3 flex-wrap mb-10">
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
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Value Protected", value: `${stats.totalValueProtected} BNB`, icon: Shield },
            { label: "Active Agents", value: stats.activeAgents.toString(), icon: Bot },
            { label: "Threats Detected", value: stats.threatsDetected.toString(), icon: AlertTriangle },
            { label: "Protection Rate", value: `${stats.protectionRate}%`, icon: CheckCircle },
          ].map((stat, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{stat.label}</span>
              </div>
              <p className="text-xl font-semibold tracking-tight text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20 w-full">
        <h2 className="text-2xl font-bold tracking-tight mb-8 text-white">How Aegis Protects You</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Skull, title: "Honeypot Detection", desc: "Simulates sells and analyzes bytecode to find traps that prevent selling — before you buy.", href: "/scanner" },
            { icon: Search, title: "Token Risk Scanner", desc: "Comprehensive risk report: contract security, liquidity, whale concentration, tax rates, and rug pull indicators.", href: "/scanner" },
            { icon: Bell, title: "Whale Alerts", desc: "Real-time monitoring of large transfers, exchange deposits, and liquidity changes on BSC Mainnet.", href: "/alerts" },
            { icon: Shield, title: "AI Portfolio Guardian", desc: "Autonomous agent monitors DeFi positions 24/7 and executes protective transactions using LLM reasoning.", href: "/agent" },
            { icon: Droplets, title: "Liquidity Analysis", desc: "PancakeSwap LP reserve depth, burn status, and real-time monitoring to detect rug pulls.", href: "/scanner" },
            { icon: Lock, title: "Non-Custodial Vault", desc: "Your funds, your control. Set stop-losses, max slippage, and action limits. $UNIQ holders get fee discounts.", href: "/positions" },
          ].map((f, i) => (
            <Link key={i} href={f.href} className="card p-5 group hover:border-[var(--border-hover)] transition-colors">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: "var(--accent-muted)" }}>
                <f.icon className="w-4.5 h-4.5" style={{ color: "var(--accent)" }} />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Contracts */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20 w-full">
        <h2 className="text-2xl font-bold tracking-tight mb-2 text-white">Smart Contracts</h2>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>Deployed on BNB Chain Testnet. Verified via Sourcify for full source transparency.</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { name: "AegisRegistry", address: CONTRACTS.REGISTRY, desc: "ERC-721 agent identity NFTs with 4-tier system", color: "var(--accent)", lines: "415 LOC" },
            { name: "AegisVault", address: CONTRACTS.VAULT, desc: "Non-custodial vault with agent authorization", color: "var(--purple)", lines: "573 LOC" },
            { name: "DecisionLogger", address: CONTRACTS.DECISION_LOGGER, desc: "Immutable AI decision audit trail", color: "var(--green)", lines: "338 LOC" },
            { name: "AegisScanner", address: CONTRACTS.SCANNER, desc: "On-chain token risk registry for BSC tokens", color: "#f97316", lines: "180 LOC" },
          ].map((c, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                <span className="font-mono text-xs font-semibold" style={{ color: c.color }}>{c.name}</span>
                <span className="ml-auto text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{c.lines}</span>
              </div>
              <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>{c.desc}</p>
              <p className="font-mono text-[10px] break-all mb-3 p-2 rounded" style={{ background: "var(--bg-base)", color: "var(--text-muted)" }}>{c.address}</p>
              <div className="flex gap-2">
                <a href={`https://testnet.bscscan.com/address/${c.address}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded transition-colors" style={{ color: "var(--accent)", background: "var(--accent-muted)" }}>
                  <ExternalLink className="w-2.5 h-2.5" /> BSCScan
                </a>
                <a href={`https://repo.sourcify.dev/contracts/full_match/97/${c.address}/`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded transition-colors" style={{ color: "var(--green)", background: "rgba(52,211,153,0.06)" }}>
                  <CheckCircle className="w-2.5 h-2.5" /> Verified
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Solidity Tests", value: "170+", color: "var(--green)" },
            { label: "Smart Contracts", value: "5 Deployed", color: "var(--accent)" },
            { label: "AI Engine", value: "LLM + Scanner", color: "var(--purple)" },
            { label: "DEX Integration", value: "PancakeSwap", color: "var(--bnb)" },
          ].map((b, i) => (
            <div key={i} className="px-4 py-3 rounded-lg" style={{ background: "var(--bg-raised)", borderLeft: `2px solid ${b.color}` }}>
              <p className="text-sm font-semibold" style={{ color: b.color }}>{b.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{b.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
