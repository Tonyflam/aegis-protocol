"use client";

import { useEffect } from "react";
import { useScannerData } from "../../lib/useScanner";
import { CONTRACTS } from "../../lib/constants";
import {
  Activity, Shield, AlertTriangle, Database,
  ExternalLink, Layers, Cpu, CheckCircle,
} from "lucide-react";

export default function OraclePage() {
  const { stats, loading, isLive, fetchStats } = useScannerData();

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [isLive, fetchStats]);

  const scannerDeployed = CONTRACTS.SCANNER !== "0x0000000000000000000000000000000000000000";

  return (
    <div className="min-h-screen relative z-10">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Scanner Stats
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Live metrics from the AegisScanner contract on BSC Testnet
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLive ? (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5"
                style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)" }}>
                <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} /> Live
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-md"
                style={{ background: "rgba(0,212,245,0.08)", color: "var(--accent)" }}>
                BSC Testnet
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Oracle Status Card */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="card p-6 relative overflow-hidden">
          <div className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at top right, rgba(0,212,245,0.03) 0%, transparent 60%)" }} />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
                <Database className="w-5 h-5" style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">AegisScanner</h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  On-chain token risk registry &middot; BSC Testnet
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Contract", value: scannerDeployed ? "Deployed" : "Not Deployed", color: scannerDeployed ? "var(--green)" : "var(--yellow)" },
                { label: "Network", value: "BSC Testnet (97)", color: "var(--accent)" },
                { label: "Data Feed", value: isLive ? "Active" : "Offline", color: isLive ? "var(--green)" : "var(--text-muted)" },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{item.label}</p>
                  <p className="text-sm font-semibold" style={{ color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>

            {scannerDeployed && (
              <div className="mt-4 flex items-center gap-4">
                <a href={`https://testnet.bscscan.com/address/${CONTRACTS.SCANNER}`} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] flex items-center gap-1 hover:underline" style={{ color: "var(--accent)" }}>
                  Scanner on BSCScan <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        {stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Scans", value: stats.totalScans.toLocaleString(), icon: Activity, color: "var(--accent)", desc: "Tokens scanned by agents" },
              { label: "Tokens Tracked", value: stats.totalTokens.toLocaleString(), icon: Layers, color: "var(--green)", desc: "Unique tokens in registry" },
              { label: "Honeypots Found", value: stats.totalHoneypots.toLocaleString(), icon: AlertTriangle, color: "var(--red)", desc: "Confirmed honeypot contracts" },
              { label: "Rug Risks", value: stats.totalRugRisks.toLocaleString(), icon: Shield, color: "var(--yellow)", desc: "Tokens with rug-pull indicators" },
            ].map((s, i) => (
              <div key={i} className="card p-6 text-center">
                <s.icon className="w-5 h-5 mx-auto mb-3" style={{ color: s.color }} />
                <p className="text-3xl font-bold tracking-tight mb-1" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs font-medium text-white mb-0.5">{s.label}</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {["Total Scans", "Tokens Tracked", "Honeypots Found", "Rug Risks"].map((label, i) => (
              <div key={i} className="card p-6 text-center">
                <p className="text-3xl font-bold tracking-tight mb-1" style={{ color: "var(--text-muted)" }}>—</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  {loading ? "Loading..." : "Awaiting deployment"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Oracle Interface Spec */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4" style={{ color: "var(--accent)" }} />
            On-Chain API
          </h3>
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
            Any smart contract can call these view functions for free (zero gas for reads).
          </p>
          <div className="space-y-0">
            {[
              { fn: "isTokenSafe(address) → bool", desc: "Returns true if scanned and below risk threshold" },
              { fn: "getTokenRisk(address) → RiskData", desc: "Score, timestamp, attester address, reasoning hash" },
              { fn: "getTokenFlags(address) → Flags", desc: "Honeypot, high tax, unverified, concentrated, low liquidity" },
              { fn: "getTokenScan(address) → TokenScan", desc: "Full scan record: all metrics, flags, scanner ID, version" },
              { fn: "getScannerStats() → Stats", desc: "Global counters: total scans, honeypots, rug risks" },
              { fn: "getRecentScans(uint256) → TokenScan[]", desc: "Latest N scan records" },
            ].map((item, i) => (
              <div key={i} className="flex items-start justify-between py-3 gap-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <code className="text-xs font-mono shrink-0" style={{ color: "var(--accent)" }}>{item.fn}</code>
                <span className="text-[11px] text-right" style={{ color: "var(--text-muted)" }}>{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Project Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" style={{ color: "var(--green)" }} />
            Project Status
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Tests", value: "356 Passing", color: "var(--green)" },
              { label: "Contracts", value: "8 Deployed", color: "var(--accent)" },
              { label: "Hackathon", value: "#6 of 200", color: "var(--purple)" },
              { label: "Network", value: "BSC Testnet", color: "var(--bnb)" },
            ].map((s, i) => (
              <div key={i} className="p-3 rounded-lg text-center" style={{ background: "var(--bg-elevated)" }}>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
