"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CONTRACTS } from "../lib/constants";
import {
  Shield, Search, ArrowRight, ExternalLink,
  Code2, CheckCircle, AlertTriangle, Activity,
  Zap,
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState("");

  function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const addr = tokenInput.trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      router.push(`/scan/${addr}`);
    } else if (addr.length > 0) {
      router.push(`/scanner?q=${encodeURIComponent(addr)}`);
    } else {
      router.push("/scanner");
    }
  }

  return (
    <div className="min-h-screen relative z-10 flex flex-col overflow-hidden">

      {/* ── HERO ── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-20 w-full">
        <div className="hero-glow" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 backdrop-blur-sm animate-fade-in"
          style={{ background: "rgba(0,212,245,0.06)", border: "1px solid rgba(0,212,245,0.15)", color: "var(--accent)" }}>
          <Shield className="w-3.5 h-3.5" />
          BNB Chain Hackathon Winner &middot; #6 of 200 projects
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6 animate-fade-in">
          <span className="text-white">Is that token</span>
          <br />
          <span className="text-shimmer">a scam?</span>
        </h1>

        <p className="text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl animate-fade-in" style={{ color: "var(--text-secondary)" }}>
          Aegis scans any BNB Chain token and tells you if it&apos;s safe — honeypot detection,
          tax analysis, liquidity checks, ownership flags. Results stored on-chain, queryable by any smart contract.
        </p>

        {/* Inline scanner */}
        <form onSubmit={handleScan} className="max-w-xl mb-10 animate-fade-in">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste token address (0x...)"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm font-mono bg-transparent outline-none"
                style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              />
            </div>
            <button type="submit" className="btn-primary flex items-center gap-2 text-base px-6 py-3.5">
              Scan
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Status bar */}
        <div className="flex items-center gap-3 flex-wrap animate-fade-in">
          {[
            { label: "Network", value: "BSC Testnet", live: true },
            { label: "Scanner", value: "Live" },
            { label: "Tests", value: "356 Passing" },
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

      {/* ── WHAT WE CHECK ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--accent)" }}>Safety Checks</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            What Aegis <span className="text-gradient">Scans For</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: AlertTriangle, title: "Honeypot Detection", desc: "Simulates buy and sell transactions to detect tokens that trap your funds and prevent selling.", color: "var(--red)" },
            { icon: Activity, title: "Tax Analysis", desc: "Measures actual buy and sell tax rates. Flags tokens with hidden fees or dynamically changing taxes.", color: "var(--yellow)" },
            { icon: Shield, title: "Ownership Audit", desc: "Checks if the contract is renounced, if the owner can mint, pause transfers, or blacklist addresses.", color: "var(--accent)" },
            { icon: Zap, title: "Liquidity Check", desc: "Verifies liquidity pool size and whether LP tokens are locked. Low or unlocked liquidity = high rug risk.", color: "var(--green)" },
            { icon: Search, title: "Holder Analysis", desc: "Scans token distribution — top holder concentration, whale wallets, and supply manipulation risks.", color: "var(--purple)" },
            { icon: CheckCircle, title: "Contract Verification", desc: "Checks whether the source code is verified on BSCScan. Unverified contracts are a major red flag.", color: "var(--green)" },
          ].map((item, i) => (
            <div key={i} className="card p-6 hover:border-[var(--border-hover)] transition-all duration-300">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `color-mix(in srgb, ${item.color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${item.color} 15%, transparent)` }}>
                <item.icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── HOW IT WORKS ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--accent)" }}>Simple</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            How It <span className="text-gradient">Works</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { num: "01", title: "Paste Address", desc: "Enter any BNB Chain token contract address. New tokens from PancakeSwap are also scanned automatically.", color: "var(--accent)" },
            { num: "02", title: "Get Risk Score", desc: "Aegis analyzes the contract across multiple security vectors and returns a risk score from 0 (safe) to 100 (dangerous).", color: "var(--purple)" },
            { num: "03", title: "Stored On-Chain", desc: "Every scan result is written to the AegisScanner smart contract. Any DeFi protocol can query it before executing a swap.", color: "var(--green)" },
          ].map((step, i) => (
            <div key={i} className="group relative card p-8 hover:border-[var(--border-hover)] transition-all duration-300">
              <span className="text-[80px] font-bold leading-none absolute top-4 right-6 select-none"
                style={{ color: "rgba(255,255,255,0.02)" }}>{step.num}</span>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: `color-mix(in srgb, ${step.color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${step.color} 15%, transparent)` }}>
                <span className="text-lg font-bold" style={{ color: step.color }}>{step.num}</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── FOR DEVELOPERS ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--accent)" }}>For Developers</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-5">
              One Line of <span className="text-gradient">Solidity</span>
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
              Any DEX, wallet, or trading bot can check token safety before executing.
              If a token is flagged as unsafe, the transaction reverts automatically.
            </p>

            <div className="space-y-4 mb-8">
              {[
                { label: "isTokenSafe(address)", desc: "Returns true only if scanned and below risk threshold" },
                { label: "getTokenRisk(address)", desc: "Full risk data — score, timestamp, attester, reasoning hash" },
                { label: "getTokenFlags(address)", desc: "Specific flags — honeypot, high tax, unverified, concentrated ownership" },
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
              API &amp; Integration Docs
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
    // swap only executes if token is safe
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="text-center relative">
          <div className="absolute inset-0 -z-10"
            style={{ background: "radial-gradient(ellipse at center, rgba(0,212,245,0.04) 0%, transparent 60%)" }} />

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-5">
            Don&apos;t get <span className="text-gradient">rugged</span>.
          </h2>
          <p className="text-base max-w-lg mx-auto mb-10" style={{ color: "var(--text-secondary)" }}>
            Check any BSC token before you buy. Free. Open source. On-chain.
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
