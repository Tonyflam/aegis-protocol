"use client";

import Link from "next/link";
import { CONTRACTS } from "../lib/constants";
import {
  Shield, Search, ArrowRight, ExternalLink,
  Code2, CheckCircle, Layers, Activity,
  Globe, Database, Cpu, Users,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen relative z-10 flex flex-col overflow-hidden">

      {/* ── HERO ── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-20 w-full">
        <div className="hero-glow" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 backdrop-blur-sm animate-fade-in"
          style={{ background: "rgba(0,212,245,0.06)", border: "1px solid rgba(0,212,245,0.15)", color: "var(--accent)" }}>
          <Shield className="w-3.5 h-3.5" />
          On-Chain Security Oracle &middot; BNB Chain
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6 animate-fade-in">
          <span className="text-white">The Security</span>
          <br />
          <span className="text-shimmer">Data Layer.</span>
        </h1>

        <p className="text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl animate-fade-in" style={{ color: "var(--text-secondary)" }}>
          A programmable, on-chain security oracle for BNB Chain.
          Any smart contract can call <span className="font-mono text-white">isTokenSafe()</span> before
          executing. Multi-agent consensus. Immutable risk data.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-16 animate-fade-in">
          <Link href="/scanner" className="btn-primary flex items-center gap-2 text-base px-7 py-3">
            <Search className="w-4 h-4" />
            Scan a Token
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/integrate" className="btn-secondary flex items-center gap-2 text-base px-7 py-3">
            <Code2 className="w-4 h-4" />
            Integration Docs
          </Link>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-3 flex-wrap animate-fade-in">
          {[
            { label: "Network", value: "BSC Testnet", live: true },
            { label: "Contracts", value: "10 Deployed" },
            { label: "Tests", value: "356 Passing" },
            { label: "Phase", value: "4 / 5" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-3.5 py-2 rounded-lg" style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}>
              {item.live && <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} />}
              <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{item.label}</span>
              <span className="text-xs font-mono font-semibold text-white">{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── WHAT IS AEGIS ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--accent)" }}>Architecture</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            How the <span className="text-gradient">Oracle Works</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { num: "01", icon: Search, title: "Agents Scan", desc: "Decentralized scanner agents analyze token contracts — honeypot traps, tax rates, liquidity locks, whale concentration, mint/pause functions. Results are scored 0–100.", color: "var(--accent)" },
            { num: "02", icon: Users, title: "Consensus Finalizes", desc: "Minimum 3 agent attestations required. Weighted by stake tier. Outliers flagged. Disputes resolved on-chain. The median score becomes the oracle truth.", color: "var(--purple)" },
            { num: "03", icon: Database, title: "Contracts Query", desc: "Any smart contract calls isTokenSafe(address) or getTokenRisk(address). DEX routers, wallets, and bots integrate the oracle with a single line of Solidity.", color: "var(--green)" },
          ].map((step, i) => (
            <div key={i} className="group relative card p-8 hover:border-[var(--border-hover)] transition-all duration-300">
              <span className="text-[80px] font-bold leading-none absolute top-4 right-6 select-none"
                style={{ color: "rgba(255,255,255,0.02)" }}>{step.num}</span>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: `color-mix(in srgb, ${step.color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${step.color} 15%, transparent)` }}>
                <step.icon className="w-5 h-5" style={{ color: step.color }} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── ORACLE INTERFACE ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--accent)" }}>Integration</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-5">
              One Line of <span className="text-gradient">Solidity</span>
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
              Any DEX router, wallet contract, or trading bot can gate actions behind the oracle.
              If a token hasn&apos;t been scanned or is flagged as unsafe, the transaction reverts.
            </p>

            <div className="space-y-4 mb-8">
              {[
                { label: "isTokenSafe(address)", desc: "Boolean — returns true only if scanned and below risk threshold" },
                { label: "getTokenRisk(address)", desc: "Full risk data — score, timestamp, attester, reasoning hash" },
                { label: "getTokenFlags(address)", desc: "Structured flags — honeypot, high tax, unverified, concentrated ownership" },
                { label: "isTokenSafeBatch(address[])", desc: "Batch check — verify entire token lists in a single call" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--green)" }} />
                  <div>
                    <p className="text-sm font-mono font-medium text-white">{item.label}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/integrate" className="btn-primary inline-flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              View Integration Guide
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Code sample */}
          <div className="card p-6 relative overflow-hidden">
            <div className="absolute inset-0 opacity-30"
              style={{ background: "radial-gradient(ellipse at top right, rgba(0,212,245,0.06) 0%, transparent 60%)" }} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-mono px-2 py-1 rounded" style={{ background: "var(--bg-elevated)", color: "var(--accent)" }}>
                  Solidity
                </span>
              </div>
              <pre className="text-xs font-mono leading-relaxed overflow-x-auto" style={{ color: "var(--text-secondary)" }}>
                <code>{`interface IAegisScanner {
    function isTokenSafe(address token)
        external view returns (bool);
}

// Any DEX router can add this:
modifier aegisSafe(address token) {
    require(
        IAegisScanner(AEGIS_SCANNER)
            .isTokenSafe(token),
        "Aegis: token flagged unsafe"
    );
    _;
}

function swap(
    address tokenOut,
    uint256 amount
) external aegisSafe(tokenOut) {
    // normal swap logic
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── CONTRACT ARCHITECTURE ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--accent)" }}>On-Chain</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Protocol <span className="text-gradient">Architecture</span>
          </h2>
          <p className="text-base mt-4 max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
            10 smart contracts deployed on BSC Testnet. Source-verified. All decisions immutable.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            { name: "AegisScanner", desc: "On-chain token risk registry. Oracle interface: isTokenSafe(), getTokenRisk(), getTokenFlags().", color: "var(--accent)", layer: "Oracle" },
            { name: "AegisConsensus", desc: "Multi-agent attestation rounds. Weighted scoring, outlier detection, dispute resolution.", color: "var(--purple)", layer: "Consensus" },
            { name: "AegisStaking", desc: "$UNIQ staking for agent participation. 4 tiers: Scout → Archon. Slashing for bad data.", color: "var(--green)", layer: "Staking" },
            { name: "AegisCertification", desc: "Soulbound ERC-721 'Aegis Certified' NFT. Revocable if risk score increases.", color: "#f97316", layer: "Certification" },
            { name: "AegisRegistry", desc: "ERC-721 agent identity NFTs. 4-tier reputation system. On-chain agent profiles.", color: "var(--bnb)", layer: "Identity" },
            { name: "AegisTokenGate", desc: "$UNIQ holder tiers. Fee discounts for token holders. Protocol access control.", color: "var(--text-secondary)", layer: "Access" },
          ].map((c, i) => (
            <div key={i} className="card p-5 group hover:border-[var(--border-hover)] transition-all duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                <span className="font-mono text-xs font-semibold" style={{ color: c.color }}>{c.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded ml-auto" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>{c.layer}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── KEY METRICS ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="card p-10 sm:p-14 text-center relative overflow-hidden">
          <div className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at center, rgba(0,212,245,0.03) 0%, transparent 70%)" }} />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-8" style={{ color: "var(--accent)" }}>
              Protocol Status
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-12">
              {[
                { value: "356", label: "Tests Passing", icon: CheckCircle },
                { value: "10", label: "Smart Contracts", icon: Layers },
                { value: "4", label: "Oracle Phases Done", icon: Cpu },
                { value: "#6", label: "of 200 Projects", icon: Activity },
              ].map((stat, i) => (
                <div key={i} className="flex flex-col items-center">
                  <stat.icon className="w-5 h-5 mb-3" style={{ color: "var(--accent)" }} />
                  <span className="text-3xl sm:text-4xl font-bold text-white stat-glow tracking-tight">{stat.value}</span>
                  <span className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── POWERED BY ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>Built On</p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {[
            { name: "BNB Chain", icon: Globe, color: "var(--bnb)" },
            { name: "OpenZeppelin", icon: Shield, color: "var(--text-primary)" },
            { name: "Hardhat", icon: Cpu, color: "var(--accent)" },
            { name: "GoPlusLabs", icon: Shield, color: "var(--purple)" },
            { name: "Solidity 0.8.24", icon: Code2, color: "var(--green)" },
          ].map((tech, i) => (
            <div key={i} className="flex items-center gap-2.5 px-5 py-3 rounded-lg transition-colors duration-200 hover:border-[var(--border-hover)]"
              style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}>
              <tech.icon className="w-4 h-4" style={{ color: tech.color }} />
              <span className="text-sm font-medium text-white">{tech.name}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="text-center relative">
          <div className="absolute inset-0 -z-10"
            style={{ background: "radial-gradient(ellipse at center, rgba(0,212,245,0.04) 0%, transparent 60%)" }} />

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-5">
            Query the <span className="text-gradient">Oracle</span>
          </h2>
          <p className="text-base max-w-lg mx-auto mb-10" style={{ color: "var(--text-secondary)" }}>
            Scan any BSC token. Check risk scores on-chain. Integrate the oracle into your contracts.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/scanner" className="btn-primary flex items-center gap-2 text-base px-8 py-3.5">
              <Search className="w-5 h-5" />
              Launch Scanner
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a href={`https://testnet.bscscan.com/address/${CONTRACTS.SCANNER}`} target="_blank" rel="noopener noreferrer"
              className="btn-secondary flex items-center gap-2 text-base px-8 py-3.5">
              <ExternalLink className="w-5 h-5" />
              View on BSCScan
            </a>
          </div>

          <div className="flex items-center justify-center gap-6 mt-10">
            <a href="https://x.com/uniq_minds" target="_blank" rel="noopener noreferrer"
              className="text-sm transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>Twitter</a>
            <a href="https://github.com/Tonyflam/aegis-protocol" target="_blank" rel="noopener noreferrer"
              className="text-sm transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>GitHub</a>
            <a href={`https://bscscan.com/token/${CONTRACTS.UNIQ_TOKEN}`} target="_blank" rel="noopener noreferrer"
              className="text-sm transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>$UNIQ</a>
          </div>
        </div>
      </section>
    </div>
  );
}
