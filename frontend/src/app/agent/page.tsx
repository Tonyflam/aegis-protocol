"use client";

import { useWalletContext } from "../../lib/WalletContext";
import { useShieldContext } from "../../lib/ShieldContext";
import Link from "next/link";
import {
  Bot,
  Shield,
  Activity,
  ArrowRight,
  Search,
  Eye,
  Zap,
  AlertTriangle,
  Trash2,
  Brain,
  Cpu,
} from "lucide-react";

export default function AgentPage() {
  const { address, isConnected } = useWalletContext();
  const shield = useShieldContext();

  return (
    <div className="min-h-screen relative z-10">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Bot className="w-6 h-6" style={{ color: "var(--accent)" }} />
              AI Guardian Agent
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Autonomous AI that protects your wallet on BNB Chain
            </p>
          </div>
          {shield.monitoring && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5" style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)" }}>
              <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} /> Shield Active
            </span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-14 space-y-6">

        {/* ── Agent Status Card ── */}
        <div className="card p-6 relative overflow-hidden" style={{ borderRadius: "12px" }}>
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] opacity-10" style={{ background: "var(--accent)" }} />

          <div className="flex items-center gap-5 relative">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--accent-muted)", border: "2px solid var(--accent-border)" }}>
              <Bot className="w-10 h-10" style={{ color: "var(--accent)" }} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-1">Aegis Guardian Agent</h3>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Autonomous AI security agent for BNB Chain wallets
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                  v1.0
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1"
                  style={{ background: shield.monitoring ? "rgba(52,211,153,0.08)" : "rgba(239,68,68,0.08)", color: shield.monitoring ? "var(--green)" : "#ef4444" }}>
                  <span className={`w-1 h-1 rounded-full ${shield.monitoring ? "pulse-live" : ""}`}
                    style={{ background: shield.monitoring ? "var(--green)" : "#ef4444" }} />
                  {shield.monitoring ? "Monitoring" : "Idle"}
                </span>
                {isConnected && (
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-muted)" }}>
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                )}
              </div>
            </div>
            {!shield.monitoring && isConnected && (
              <button onClick={() => address && shield.startMonitoring(address)}
                className="btn-primary flex items-center gap-2 px-5 py-2.5">
                <Zap className="w-4 h-4" /> Activate
              </button>
            )}
          </div>
        </div>

        {/* ── What The Agent Does ── */}
        <div className="card p-6" style={{ borderRadius: "12px" }}>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-5">
            <Brain className="w-4 h-4" style={{ color: "var(--accent)" }} />
            How The AI Agent Protects You
          </h3>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Search,
                title: "Approval Scanning",
                desc: "Scans BSC for every ERC-20 Approval event from your wallet. Discovers all contracts you've granted token access to — even ones you forgot about.",
                color: "var(--accent)",
              },
              {
                icon: Eye,
                title: "Contract Risk Analysis",
                desc: "Each spender contract is analyzed: source verification, proxy detection, owner permissions, deployer history. Uses GoPlusLabs API + on-chain bytecode analysis.",
                color: "#a78bfa",
              },
              {
                icon: AlertTriangle,
                title: "Threat Detection",
                desc: "Identifies critical risks: unverified contracts, unlimited approvals, proxy contracts with mutable logic, contracts where owner can change balances.",
                color: "#f97316",
              },
              {
                icon: Activity,
                title: "Real-Time Monitoring",
                desc: "Watches every new BSC block for approval events and transfers involving your wallet. Detects suspicious patterns like rapid multiple transfers (drain attacks).",
                color: "#22c55e",
              },
              {
                icon: Trash2,
                title: "One-Click Revoke",
                desc: "Revoke dangerous approvals with a single click. Sends approve(spender, 0) on-chain to remove the contract's permission to move your tokens.",
                color: "#ef4444",
              },
              {
                icon: Shield,
                title: "Continuous Protection",
                desc: "Shield persists while you browse. Navigate between pages freely — your guardian keeps watching. No need to stay on one screen.",
                color: "var(--accent)",
              },
            ].map(f => (
              <div key={f.title} className="p-4 rounded-xl" style={{ background: "var(--bg-base)" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `${f.color}10` }}>
                  <f.icon className="w-4 h-4" style={{ color: f.color }} />
                </div>
                <h5 className="text-sm font-semibold text-white mb-1.5">{f.title}</h5>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Decision Pipeline ── */}
        <div className="card p-6" style={{ borderRadius: "12px" }}>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-5">
            <Cpu className="w-4 h-4" style={{ color: "var(--accent)" }} />
            Agent Decision Pipeline
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { step: "01", label: "SCAN", desc: "Fetch Approval logs from BSC RPC", color: "var(--accent)" },
              { step: "02", label: "DEDUPLICATE", desc: "Keep latest per token+spender pair", color: "#a78bfa" },
              { step: "03", label: "VERIFY", desc: "Check current allowance on-chain", color: "#3b82f6" },
              { step: "04", label: "ANALYZE", desc: "GoPlusLabs API + bytecode check", color: "#f97316" },
              { step: "05", label: "SCORE", desc: "Calculate risk score (0-100)", color: "#ef4444" },
              { step: "06", label: "ACT", desc: "Flag, alert, or auto-revoke", color: "#22c55e" },
            ].map((s, i) => (
              <div key={s.step} className="relative">
                <div className="p-3 rounded-xl text-center" style={{ background: `${s.color}06`, border: `1px solid ${s.color}15` }}>
                  <span className="text-2xl font-black block mb-1" style={{ color: s.color, opacity: 0.2 }}>{s.step}</span>
                  <p className="text-xs font-bold mb-0.5" style={{ color: s.color }}>{s.label}</p>
                  <p className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>{s.desc}</p>
                </div>
                {i < 5 && (
                  <ArrowRight className="absolute top-1/2 -right-3 w-3 h-3 -translate-y-1/2 hidden lg:block" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Tech Stack ── */}
        <div className="card p-6" style={{ borderRadius: "12px" }}>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4" style={{ color: "var(--accent)" }} />
            Technology Stack
          </h3>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
            {[
              { label: "Blockchain", value: "BNB Smart Chain (Mainnet — Chain ID 56)" },
              { label: "RPC Provider", value: "PublicNode BSC (bsc-rpc.publicnode.com)" },
              { label: "Security API", value: "GoPlusLabs Approval Security API" },
              { label: "On-Chain", value: "ethers.js v6 — getLogs, Contract, Signer" },
              { label: "Scan Range", value: "~2M blocks (~70 days of BSC history)" },
              { label: "Event Signature", value: "Approval(address,address,uint256)" },
              { label: "Risk Factors", value: "Source verification, proxy, owner permissions" },
              { label: "Monitoring", value: "6-second polling (every 2 BSC blocks)" },
              { label: "Revoke Method", value: "ERC-20 approve(spender, 0) — on-chain tx" },
              { label: "Frontend", value: "Next.js 14 + React 18 + Tailwind CSS" },
            ].map(t => (
              <div key={t.label} className="flex justify-between py-2 text-xs" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ color: "var(--text-muted)" }}>{t.label}</span>
                <span className="font-mono text-right" style={{ color: "var(--text-secondary)" }}>{t.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { icon: Search, label: "Scan Approvals", desc: "Discover all token permissions", href: "/approvals", color: "var(--accent)" },
            { icon: Activity, label: "Activate Shield", desc: "Real-time threat monitoring", href: "/shield", color: "#22c55e" },
            { icon: Shield, label: "Dashboard", desc: "Security overview & scan", href: "/dashboard", color: "#a78bfa" },
          ].map(a => (
            <Link key={a.href} href={a.href} className="card p-4 flex items-center gap-3 transition-all hover:scale-[1.02]" style={{ borderRadius: "12px" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${a.color}10` }}>
                <a.icon className="w-5 h-5" style={{ color: a.color }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{a.label}</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{a.desc}</p>
              </div>
              <ArrowRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
