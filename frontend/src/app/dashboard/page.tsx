"use client";

import Link from "next/link";
import { useLiveMarketData } from "../../lib/useLiveMarket";
import { useWalletContext } from "../../lib/WalletContext";
import {
  ShieldCheck, Shield, Siren, Eye, Activity, ArrowRight,
  Wallet,
} from "lucide-react";

const AGENTS = [
  {
    name: "Sentinel",
    description: "Scans token approvals and revokes risky unlimited permissions",
    href: "/sentinel",
    icon: ShieldCheck,
    color: "#00d4f5",
    gradient: "from-cyan-500/10 to-blue-500/10",
    features: ["Approval Scanner", "Risk Scoring", "One-Click Revoke"],
  },
  {
    name: "Shield",
    description: "Deep contract analysis with bytecode scanning and honeypot detection",
    href: "/shield",
    icon: Shield,
    color: "#a855f7",
    gradient: "from-purple-500/10 to-pink-500/10",
    features: ["Bytecode Analysis", "Honeypot Detection", "Security Scoring"],
  },
  {
    name: "Rescue",
    description: "Emergency extraction — evacuate all assets to your safe wallet",
    href: "/rescue",
    icon: Siren,
    color: "#ef4444",
    gradient: "from-red-500/10 to-orange-500/10",
    features: ["Safe Wallet Config", "Token Inventory", "Panic Button"],
  },
  {
    name: "Watchdog",
    description: "Monitors BSC DeFi protocol health, TVL changes, and risk",
    href: "/watchdog",
    icon: Eye,
    color: "#3b82f6",
    gradient: "from-blue-500/10 to-indigo-500/10",
    features: ["TVL Monitoring", "Health Scoring", "Danger Alerts"],
  },
];

export default function DashboardPage() {
  const { isConnected, connect } = useWalletContext();
  const liveMarket = useLiveMarketData(30000);

  return (
    <div className="min-h-screen relative z-10">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Agent Command Center</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Deploy autonomous security agents to protect your BSC wallet
            </p>
          </div>
          {isConnected && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5" style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)" }}>
              <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} /> Connected
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
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}>
                {item.live && <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} />}
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{item.label}</span>
                <span className="text-xs font-mono font-medium" style={{ color: "var(--text-primary)" }}>{item.value}</span>
                {item.extra && <span className="text-[11px] font-mono" style={{ color: item.extraColor }}>{item.extra}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connect Prompt */}
      {!isConnected && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
          <div className="card p-6 flex items-center justify-between" style={{ borderRadius: "12px", background: "linear-gradient(135deg, rgba(0,212,245,0.04), rgba(168,85,247,0.04))", border: "1px solid rgba(0,212,245,0.1)" }}>
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5" style={{ color: "var(--accent)" }} />
              <div>
                <p className="text-sm font-semibold text-white">Connect Wallet to Activate Agents</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Sentinel and Rescue agents require a connected wallet to scan and protect your assets.</p>
              </div>
            </div>
            <button onClick={connect} className="btn-primary text-xs !px-4 !py-2 flex items-center gap-1.5 flex-shrink-0">
              <Wallet className="w-3.5 h-3.5" /> Connect
            </button>
          </div>
        </div>
      )}

      {/* Agent Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="grid md:grid-cols-2 gap-4">
          {AGENTS.map((agent) => (
            <Link
              key={agent.name}
              href={agent.href}
              className="card p-6 group hover:scale-[1.01] transition-all duration-200 block"
              style={{ borderRadius: "12px", borderLeft: `3px solid ${agent.color}` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${agent.color}12`, border: `1px solid ${agent.color}20` }}>
                    <agent.icon className="w-5 h-5" style={{ color: agent.color }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white group-hover:text-white/90">{agent.name} Agent</h3>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{agent.description}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: agent.color }} />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {agent.features.map((f) => (
                  <span key={f} className="text-xs px-2 py-1 rounded-md" style={{ background: `${agent.color}08`, color: `${agent.color}`, border: `1px solid ${agent.color}15` }}>
                    {f}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        {/* How It Works */}
        <div className="card p-6 mt-6" style={{ borderRadius: "12px" }}>
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: "var(--accent)" }} />
            How Aegis Agents Work
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-[11px]">
            {[
              { step: "1", label: "Connect Wallet", sub: "MetaMask", color: "var(--accent)" },
              { step: "2", label: "Deploy Agent", sub: "Choose Protection", color: "#a855f7" },
              { step: "3", label: "Scan & Analyze", sub: "Real-Time BSC Data", color: "#3b82f6" },
              { step: "4", label: "Execute Actions", sub: "MetaMask Confirm", color: "var(--green)" },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold" style={{ background: `${s.color}10`, color: s.color, border: `1px solid ${s.color}20` }}>
                  {s.step}
                </div>
                <div>
                  <p className="font-semibold text-white">{s.label}</p>
                  <p style={{ color: "var(--text-muted)" }}>{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
