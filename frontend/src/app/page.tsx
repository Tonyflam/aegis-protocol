"use client";

import Link from "next/link";
import { useWalletContext } from "../lib/WalletContext";
import { useScrollReveal, useStaggerReveal } from "../lib/useScrollReveal";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Search,
  ArrowRight,
  Zap,
  Lock,
  Unlock,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Wallet,
  Activity,
  Bot,
  FileWarning,
  Timer,
} from "lucide-react";

// ─── Scroll Reveal Wrapper ───────────────────────────────────
function RevealSection({ children, className = "", direction = "up" }: {
  children: React.ReactNode; className?: string; direction?: "up" | "left" | "right" | "scale";
}) {
  const { ref, isVisible } = useScrollReveal();
  const cls = direction === "left" ? "reveal-left" : direction === "right" ? "reveal-right" : direction === "scale" ? "reveal-scale" : "reveal";
  return <div ref={ref} className={`${cls} ${isVisible ? "visible" : ""} ${className}`}>{children}</div>;
}

export default function Home() {
  const { isConnected } = useWalletContext();

  const stepsStagger = useStaggerReveal(3, 120);
  const featuresStagger = useStaggerReveal(6, 100);
  const statsStagger = useStaggerReveal(4, 100);
  const techStagger = useStaggerReveal(6, 80);

  return (
    <div className="min-h-screen relative z-10 flex flex-col overflow-hidden">

      {/* ── HERO ── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-20 w-full">
        <div className="hero-glow" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 backdrop-blur-sm animate-fade-in"
          style={{ background: "rgba(0, 212, 245, 0.06)", border: "1px solid rgba(0, 212, 245, 0.15)", color: "var(--accent)" }}>
          <ShieldCheck className="w-3.5 h-3.5" />
          AI-Powered Wallet Security for BNB Chain
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6 animate-fade-in">
          <span className="text-white">Your Wallet&apos;s</span>
          <br />
          <span className="text-shimmer">AI Bodyguard.</span>
        </h1>

        <p className="text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl animate-fade-in" style={{ color: "var(--text-secondary)" }}>
          Every DeFi interaction leaves an open door to your tokens. Aegis Guardian scans
          your approvals, detects threats in real-time, and auto-revokes before attackers strike.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-16 animate-fade-in">
          <Link href={isConnected ? "/dashboard" : "/dashboard"} className="btn-primary flex items-center gap-2 text-base px-7 py-3">
            <Shield className="w-4 h-4" />
            Scan My Wallet
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/approvals" className="btn-secondary flex items-center gap-2 text-base px-7 py-3">
            <Search className="w-4 h-4" />
            View Approvals
          </Link>
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in">
          {[
            { label: "Avg Approvals per Wallet", value: "47", icon: FileWarning, color: "#f97316" },
            { label: "BSC Hacks in 2025", value: "120+", icon: ShieldAlert, color: "#ef4444" },
            { label: "Total DeFi Losses", value: "$15.8B", icon: AlertTriangle, color: "#eab308" },
            { label: "Avg Response Time", value: "<3s", icon: Timer, color: "#22c55e" },
          ].map((stat) => (
            <div key={stat.label} className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <stat.icon className="w-4 h-4 mb-2" style={{ color: stat.color }} />
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── THE PROBLEM ── */}
      <RevealSection>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
          <div className="text-center mb-14">
            <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--accent)" }}>The Hidden Danger</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
              Your Wallet Is Already Exposed
            </h2>
            <p className="text-base max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>
              Every time you swap on PancakeSwap, lend on Venus, or mint an NFT — you grant
              <strong className="text-white"> unlimited token access</strong> to a smart contract.
              If that contract gets exploited, your tokens are gone.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Unlock,
                title: "Unlimited Approvals",
                desc: "Most dApps request MAX_UINT256 approval — infinite access to your tokens. One compromised contract = total drain.",
                color: "#ef4444",
                stat: "92% of approvals are unlimited",
              },
              {
                icon: XCircle,
                title: "Forgotten Contracts",
                desc: "You approved a contract 6 months ago and forgot about it. That contract just got exploited. Your USDT is gone.",
                color: "#f97316",
                stat: "Avg wallet: 47 active approvals",
              },
              {
                icon: AlertTriangle,
                title: "Weekly BSC Exploits",
                desc: "BSC protocols get hacked every week. If you ever approved any of them, your tokens are at risk right now.",
                color: "#eab308",
                stat: "2+ BSC hacks per week in 2025",
              },
            ].map((item, i) => (
              <div key={i} className="card p-6 relative overflow-hidden group hover:translate-y-[-2px] transition-all duration-300"
                style={{ borderLeft: `3px solid ${item.color}` }}>
                <item.icon className="w-8 h-8 mb-4" style={{ color: item.color }} />
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>{item.desc}</p>
                <span className="text-xs font-mono px-2 py-1 rounded-md" style={{ background: `${item.color}15`, color: item.color }}>
                  {item.stat}
                </span>
              </div>
            ))}
          </div>
        </section>
      </RevealSection>

      <div className="section-divider" />

      {/* ── HOW IT WORKS ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
        <RevealSection>
          <div className="text-center mb-14">
            <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--accent)" }}>How It Works</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
              Three Steps to Total Protection
            </h2>
          </div>
        </RevealSection>

        <div ref={stepsStagger.ref} className={`grid md:grid-cols-3 gap-8 stagger-parent ${stepsStagger.isVisible ? "visible" : ""}`}>
          {[
            {
              step: "01",
              icon: Wallet,
              title: "Connect Wallet",
              desc: "Connect your BSC wallet. Aegis instantly scans all your token approvals across every contract you've ever interacted with.",
            },
            {
              step: "02",
              icon: Eye,
              title: "AI Analysis",
              desc: "Our AI agent risk-scores every approval: contract age, verification status, deployer history, exploit patterns, and more.",
            },
            {
              step: "03",
              icon: ShieldCheck,
              title: "Auto-Protect",
              desc: "Dangerous approvals are flagged for one-click revoke. Enable Guardian Mode and the AI auto-revokes threats before attackers strike.",
            },
          ].map((item, i) => (
            <div key={i} className="stagger-child relative" style={stepsStagger.getDelay(i)}>
              <div className="card p-8 h-full text-center group hover:translate-y-[-4px] transition-all duration-300">
                <span className="text-5xl font-black mb-6 block" style={{ color: "var(--accent)", opacity: 0.15 }}>
                  {item.step}
                </span>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
                  <item.icon className="w-6 h-6" style={{ color: "var(--accent)" }} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── LIVE DEMO: APPROVAL RISK ── */}
      <RevealSection>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left: Description */}
            <div>
              <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--accent)" }}>Core Feature</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-5">
                See Every Approval.<br />Know Every Risk.
              </h2>
              <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
                Aegis scans your entire approval history on BSC. Each approval is analyzed by our AI
                for contract risk, exploit probability, and exposure amount.
              </p>
              <div className="space-y-4">
                {[
                  { icon: CheckCircle, text: "Scans all ERC-20 Approval events on BSC", color: "#22c55e" },
                  { icon: CheckCircle, text: "Risk-scores contracts: age, verification, deployer", color: "#22c55e" },
                  { icon: CheckCircle, text: "Shows exact dollar exposure per approval", color: "#22c55e" },
                  { icon: CheckCircle, text: "One-click revoke or batch revoke all risky ones", color: "#22c55e" },
                  { icon: CheckCircle, text: "Auto-revoke mode: AI handles it for you", color: "#22c55e" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 flex-shrink-0" style={{ color: item.color }} />
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Mock UI */}
            <div className="card p-6 relative overflow-hidden" style={{ borderColor: "rgba(0,212,245,0.1)" }}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10" style={{ background: "var(--accent)" }} />

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5" style={{ color: "var(--accent)" }} />
                  <span className="text-sm font-semibold text-white">Approval Scanner</span>
                </div>
                <span className="text-xs px-2 py-1 rounded-md" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                  3 Critical
                </span>
              </div>

              {/* Mock Approvals */}
              {[
                { token: "USDT", spender: "Unverified: 0x7a3...f9d2", risk: "CRITICAL", color: "#ef4444", amount: "$12,450 exposed", age: "2 days old" },
                { token: "BUSD", spender: "PancakeSwap V2 Router", risk: "LOW", color: "#22c55e", amount: "Unlimited", age: "Verified" },
                { token: "WBNB", spender: "Unknown: 0xde4...8bc1", risk: "HIGH", color: "#f97316", amount: "$8,200 exposed", age: "No source code" },
                { token: "CAKE", spender: "Venus Protocol", risk: "SAFE", color: "#22c55e", amount: "Unlimited", age: "Audited" },
                { token: "USDC", spender: "Suspended: 0x91c...4e7a", risk: "CRITICAL", color: "#ef4444", amount: "$5,800 exposed", age: "Contract paused" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg mb-2 transition-colors hover:bg-white/[0.02]"
                  style={{ background: "rgba(0,0,0,0.2)", borderLeft: `3px solid ${item.color}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{item.token}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: `${item.color}15`, color: item.color }}>
                        {item.risk}
                      </span>
                    </div>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{item.spender}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-mono" style={{ color: item.color }}>{item.amount}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{item.age}</p>
                  </div>
                  {(item.risk === "CRITICAL" || item.risk === "HIGH") && (
                    <button className="text-[10px] px-2 py-1 rounded-md flex-shrink-0" style={{ background: `${item.color}15`, color: item.color, border: `1px solid ${item.color}30` }}>
                      Revoke
                    </button>
                  )}
                </div>
              ))}

              {/* Security Score */}
              <div className="mt-4 p-4 rounded-lg text-center" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.1)" }}>
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Wallet Security Score</p>
                <p className="text-3xl font-bold" style={{ color: "#ef4444" }}>32</p>
                <p className="text-xs" style={{ color: "#ef4444" }}>CRITICAL — 3 dangerous approvals detected</p>
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      <div className="section-divider" />

      {/* ── FEATURES GRID ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
        <RevealSection>
          <div className="text-center mb-14">
            <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--accent)" }}>Features</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
              Complete Wallet Security Suite
            </h2>
            <p className="text-base max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>
              Not just a scanner — a fully autonomous AI agent that protects your wallet 24/7.
            </p>
          </div>
        </RevealSection>

        <div ref={featuresStagger.ref} className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-parent ${featuresStagger.isVisible ? "visible" : ""}`}>
          {[
            {
              icon: Search,
              title: "Approval Scanner",
              desc: "Deep scan of every ERC-20 approval on BSC. See who has access to your tokens, how much, and since when.",
              color: "var(--accent)",
            },
            {
              icon: Bot,
              title: "AI Risk Analysis",
              desc: "LLM-powered contract intelligence. Analyzes bytecode, deployer history, audit status, and exploit patterns.",
              color: "#a855f7",
            },
            {
              icon: ShieldCheck,
              title: "Auto-Revoke",
              desc: "Guardian Mode: When a protocol gets exploited, the AI detects it and revokes your approval in seconds.",
              color: "#22c55e",
            },
            {
              icon: Activity,
              title: "Real-time Monitoring",
              desc: "24/7 watch on all approved contracts. Alerts on suspicious activity, ownership changes, or exploit signals.",
              color: "#f97316",
            },
            {
              icon: Lock,
              title: "On-chain Decisions",
              desc: "Every AI decision is logged on-chain via DecisionLogger. Full transparency — verify what the AI did and why.",
              color: "#3b82f6",
            },
            {
              icon: Zap,
              title: "$UNIQ Token Utility",
              desc: "Hold $UNIQ for premium features: auto-revoke, priority monitoring, reduced guardian fees, and governance.",
              color: "#eab308",
            },
          ].map((item, i) => (
            <div key={i} className="stagger-child" style={featuresStagger.getDelay(i)}>
              <div className="card p-6 h-full group hover:translate-y-[-3px] transition-all duration-300">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${item.color}12`, border: `1px solid ${item.color}25` }}>
                  <item.icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── STATS ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
        <div ref={statsStagger.ref} className={`grid sm:grid-cols-2 lg:grid-cols-4 gap-5 stagger-parent ${statsStagger.isVisible ? "visible" : ""}`}>
          {[
            { value: "198", label: "Tests Passing", sub: "Smart Contracts", color: "#22c55e" },
            { value: "5", label: "Smart Contracts", sub: "BSC Testnet", color: "var(--accent)" },
            { value: "9,300+", label: "Lines of Code", sub: "Production-Ready", color: "#a855f7" },
            { value: "#6", label: "of Top 10", sub: "BNB Hackathon · 200 Projects", color: "#eab308" },
          ].map((stat, i) => (
            <div key={i} className="stagger-child" style={statsStagger.getDelay(i)}>
              <div className="card p-6 text-center">
                <p className="text-4xl font-bold stat-glow mb-1" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-sm font-medium text-white">{stat.label}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{stat.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── $UNIQ TOKEN ── */}
      <RevealSection>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
          <div className="text-center mb-14">
            <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "#eab308" }}>Token Utility</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
              $UNIQ — Fuel Your Guardian
            </h2>
            <p className="text-base max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>
              Hold $UNIQ to unlock premium protection tiers and reduced fees.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { tier: "Basic", amount: "0 UNIQ", features: ["Manual approval scan", "Risk score view", "Self-revoke"], color: "var(--text-muted)", bg: "rgba(255,255,255,0.02)" },
              { tier: "Guardian", amount: "10,000+ UNIQ", features: ["Auto-revoke mode", "Real-time monitoring", "Priority alerts", "25% fee reduction"], color: "var(--accent)", bg: "rgba(0,212,245,0.04)" },
              { tier: "Sentinel", amount: "100,000+ UNIQ", features: ["All Guardian features", "Instant response (<1s)", "Multi-wallet guardian", "50% fee reduction", "Governance voting"], color: "#eab308", bg: "rgba(234,179,8,0.04)" },
            ].map((tier, i) => (
              <div key={i} className="card p-6 h-full" style={{ background: tier.bg, borderColor: `${tier.color}20` }}>
                <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: tier.color }}>{tier.tier}</p>
                <p className="text-xl font-bold text-white mb-4">{tier.amount}</p>
                <ul className="space-y-2.5">
                  {tier.features.map((f, fi) => (
                    <li key={fi} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tier.color }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </RevealSection>

      <div className="section-divider" />

      {/* ── POWERED BY ── */}
      <RevealSection>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 w-full">
          <p className="text-center text-xs font-medium uppercase tracking-widest mb-8" style={{ color: "var(--text-muted)" }}>
            Powered By
          </p>
          <div ref={techStagger.ref} className={`flex flex-wrap justify-center items-center gap-8 sm:gap-14 stagger-parent ${techStagger.isVisible ? "visible" : ""}`}>
            {[
              { name: "BNB Chain", color: "#F0B90B" },
              { name: "Groq AI", color: "#F55036" },
              { name: "GoPlusLabs", color: "#00D4F5" },
              { name: "Honeypot.is", color: "#22c55e" },
              { name: "OpenZeppelin", color: "#4E5EE4" },
              { name: "PancakeSwap", color: "#D1884F" },
            ].map((t, i) => (
              <span key={i} className="stagger-child text-sm font-medium tracking-wide" style={{ color: t.color, opacity: 0.7, ...techStagger.getDelay(i) }}>
                {t.name}
              </span>
            ))}
          </div>
        </section>
      </RevealSection>

      <div className="section-divider" />

      {/* ── CTA ── */}
      <RevealSection>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
          <div className="card p-10 sm:p-14 text-center relative overflow-hidden" style={{ borderColor: "rgba(0,212,245,0.1)" }}>
            <div className="absolute inset-0 hero-glow opacity-30" />
            <div className="relative">
              <Shield className="w-12 h-12 mx-auto mb-6 animate-float" style={{ color: "var(--accent)" }} />
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Stop Trusting. Start Verifying.
              </h2>
              <p className="text-base max-w-xl mx-auto mb-8" style={{ color: "var(--text-secondary)" }}>
                Your wallet has dozens of open approvals right now.
                Connect and find out which ones are putting your tokens at risk.
              </p>
              <Link href="/dashboard" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3.5">
                <Shield className="w-4 h-4" />
                Protect My Wallet
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </RevealSection>

    </div>
  );
}
