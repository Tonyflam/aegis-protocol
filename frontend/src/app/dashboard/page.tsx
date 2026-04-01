"use client";

import { useWalletContext } from "../../lib/WalletContext";
import Link from "next/link";
import {
  Shield,
  ShieldAlert,
  Search,
  Activity,
  ArrowRight,
  Eye,
  Bot,
  Trash2,
  Wallet,
} from "lucide-react";
import ApprovalScanner from "../../components/ApprovalScanner";

export default function DashboardPage() {
  const { address, isConnected, connect, signer } = useWalletContext();

  return (
    <div className="min-h-screen relative z-10">
      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Shield className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Security Dashboard
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Scan your wallet for dangerous token approvals on BNB Chain
            </p>
          </div>
          <Link
            href="/shield"
            className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all hover:scale-105"
            style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)", color: "var(--accent)" }}
          >
            <Activity className="w-3 h-3" /> Live Shield <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        {/* Not Connected State */}
        {!isConnected && (
          <div className="space-y-6">
            <div className="card p-10 text-center" style={{ borderRadius: "12px" }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
                <ShieldAlert className="w-8 h-8 text-[color:var(--accent)]" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Check Your Wallet Security</h2>
              <p className="text-sm max-w-lg mx-auto mb-8" style={{ color: "var(--text-secondary)" }}>
                Connect your wallet to instantly scan all your token approvals on BNB Chain.
                Discover hidden risks, revoke dangerous permissions, and protect your assets.
              </p>
              <button onClick={connect} className="btn-primary flex items-center gap-2 mx-auto text-base px-8 py-3">
                <Wallet className="w-5 h-5" /> Connect Wallet to Scan
              </button>
            </div>

            {/* Feature Cards */}
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Search,
                  title: "Approval Scanner",
                  desc: "Scans BSC for all ERC-20 approval events from your wallet. Finds every contract you've granted token access to.",
                  color: "var(--accent)",
                },
                {
                  icon: Eye,
                  title: "AI Risk Analysis",
                  desc: "Each approved contract is risk-scored using GoPlusLabs API, on-chain analysis, and contract verification checks.",
                  color: "#a78bfa",
                },
                {
                  icon: Trash2,
                  title: "One-Click Revoke",
                  desc: "Revoke dangerous approvals instantly. Remove unlimited permissions from unverified, proxy, or high-risk contracts.",
                  color: "#ef4444",
                },
              ].map(f => (
                <div key={f.title} className="card p-5" style={{ borderRadius: "12px" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${f.color}10`, border: `1px solid ${f.color}20` }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{f.title}</h3>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Or scan any address */}
            <div className="card p-6" style={{ borderRadius: "12px" }}>
              <h3 className="text-sm font-semibold text-white mb-1">Or Scan Any Wallet</h3>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                You can scan any BSC wallet address without connecting — just enter an address below.
              </p>
              <ApprovalScanner connectedAddress={null} signer={null} />
            </div>
          </div>
        )}

        {/* Connected State */}
        {isConnected && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { icon: Search, label: "Scan Approvals", desc: "Find all active permissions", href: "/approvals", color: "var(--accent)" },
                { icon: Activity, label: "Live Shield", desc: "Real-time threat monitoring", href: "/shield", color: "#22c55e" },
                { icon: Bot, label: "AI Guardian", desc: "Autonomous protection agent", href: "/agent", color: "#a78bfa" },
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

            {/* Main Scanner */}
            <ApprovalScanner connectedAddress={address} signer={signer} />
          </div>
        )}
      </div>
    </div>
  );
}
