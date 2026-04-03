"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useTokenLookup } from "../../../lib/useScanner";
import Link from "next/link";
import {
  Shield, AlertTriangle, CheckCircle, ExternalLink,
  Copy, ArrowLeft, Activity, XCircle,
} from "lucide-react";

function riskColor(score: number): string {
  if (score >= 70) return "var(--red)";
  if (score >= 40) return "var(--yellow)";
  return "var(--green)";
}

function riskLabel(score: number): string {
  if (score >= 70) return "High Risk";
  if (score >= 40) return "Medium Risk";
  return "Low Risk";
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function FlagRow({ active, label, goodLabel, badLabel }: { active: boolean; label: string; goodLabel: string; badLabel: string }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="flex items-center gap-1.5">
        {active ? (
          <>
            <XCircle className="w-3 h-3" style={{ color: "var(--red)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--red)" }}>{badLabel}</span>
          </>
        ) : (
          <>
            <CheckCircle className="w-3 h-3" style={{ color: "var(--green)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--green)" }}>{goodLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function ScanReportPage() {
  const params = useParams();
  const address = params.address as string;
  const { scan, riskData, flags, safe, loading, error, lookup } = useTokenLookup();

  useEffect(() => {
    if (address && address.length === 42 && address.startsWith("0x")) {
      lookup(address);
    }
  }, [address, lookup]);

  return (
    <div className="min-h-screen relative z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-10">

        {/* Back */}
        <Link href="/scanner" className="inline-flex items-center gap-1.5 text-xs mb-6 hover:underline" style={{ color: "var(--text-muted)" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Scanner
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--accent)" }}>Scan Report</p>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-lg text-white">{shortAddr(address)}</h1>
              <button onClick={() => copyToClipboard(address)} className="opacity-40 hover:opacity-100 transition-opacity">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{address}</p>
          </div>
          <a href={`https://testnet.bscscan.com/token/${address}`} target="_blank" rel="noopener noreferrer"
            className="btn-secondary text-xs flex items-center gap-1.5 !px-3 !py-1.5">
            BSCScan <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Loading */}
        {loading && (
          <div className="card p-16 text-center">
            <Activity className="w-6 h-6 mx-auto mb-3 animate-pulse" style={{ color: "var(--accent)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Querying oracle contract...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="card p-12 text-center">
            <Shield className="w-6 h-6 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm mb-2" style={{ color: "var(--red)" }}>{error}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              This token has not been scanned by the oracle yet, or the scanner contract is not deployed.
            </p>
          </div>
        )}

        {/* Results */}
        {scan && !loading && (
          <div className="space-y-4 animate-fade-in">

            {/* Risk score hero */}
            <div className="card p-8 text-center relative overflow-hidden">
              <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, color-mix(in srgb, ${riskColor(scan.riskScore)} 4%, transparent) 0%, transparent 70%)` }} />
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: `color-mix(in srgb, ${riskColor(scan.riskScore)} 10%, transparent)`, border: `2px solid color-mix(in srgb, ${riskColor(scan.riskScore)} 20%, transparent)` }}>
                  {scan.riskScore >= 70 ? <AlertTriangle className="w-8 h-8" style={{ color: riskColor(scan.riskScore) }} /> :
                   scan.riskScore >= 40 ? <Shield className="w-8 h-8" style={{ color: riskColor(scan.riskScore) }} /> :
                   <CheckCircle className="w-8 h-8" style={{ color: riskColor(scan.riskScore) }} />}
                </div>
                <p className="text-5xl font-bold mb-1" style={{ color: riskColor(scan.riskScore) }}>{scan.riskScore}</p>
                <p className="text-sm font-medium" style={{ color: riskColor(scan.riskScore) }}>{riskLabel(scan.riskScore)}</p>
                {safe !== null && (
                  <p className="text-xs mt-3 font-mono"
                    style={{ color: safe ? "var(--green)" : "var(--red)" }}>
                    isTokenSafe() → {safe ? "true" : "false"}
                  </p>
                )}
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Holders", value: scan.holderCount.toLocaleString(), color: "var(--accent)" },
                { label: "Top Holder %", value: `${(scan.topHolderPercent / 100).toFixed(1)}%`, color: scan.topHolderPercent > 5000 ? "var(--red)" : "var(--green)" },
                { label: "Liquidity", value: `${parseFloat(scan.liquidity).toFixed(2)} BNB`, color: "var(--accent)" },
                { label: "Buy Tax", value: `${(scan.buyTax / 100).toFixed(1)}%`, color: scan.buyTax > 1000 ? "var(--red)" : "var(--green)" },
                { label: "Sell Tax", value: `${(scan.sellTax / 100).toFixed(1)}%`, color: scan.sellTax > 1000 ? "var(--red)" : "var(--green)" },
                { label: "Scan Version", value: `v${scan.scanVersion}`, color: "var(--text-secondary)" },
              ].map((m, i) => (
                <div key={i} className="card p-4">
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                  <p className="text-lg font-bold font-mono" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Security Flags */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Security Flags</h3>
              <FlagRow active={scan.isHoneypot} label="Honeypot Detection" goodLabel="Not detected" badLabel="Honeypot detected" />
              <FlagRow active={scan.ownerCanMint} label="Owner Can Mint" goodLabel="No mint function" badLabel="Mintable" />
              <FlagRow active={scan.ownerCanPause} label="Transfer Pausable" goodLabel="Not pausable" badLabel="Can pause transfers" />
              <FlagRow active={scan.ownerCanBlacklist} label="Blacklist Function" goodLabel="No blacklist" badLabel="Can blacklist addresses" />
              <FlagRow active={!scan.isContractRenounced} label="Ownership" goodLabel="Renounced" badLabel="Not renounced" />
              <FlagRow active={!scan.isLiquidityLocked} label="Liquidity Lock" goodLabel="Locked" badLabel="Unlocked" />
              <FlagRow active={!scan.isVerified} label="Source Verification" goodLabel="Verified" badLabel="Unverified" />
            </div>

            {/* Oracle Flags (structured) */}
            {flags && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-1">Oracle Flags</h3>
                <p className="text-[10px] mb-3" style={{ color: "var(--text-muted)" }}>
                  Returned by <span className="font-mono">IAegisScanner.getTokenFlags()</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { label: "Honeypot", active: flags.isHoneypot },
                    { label: "High Tax", active: flags.hasHighTax },
                    { label: "Unverified", active: flags.isUnverified },
                    { label: "Concentrated", active: flags.hasConcentratedOwnership },
                    { label: "Low Liquidity", active: flags.hasLowLiquidity },
                  ].map((f, i) => (
                    <div key={i} className="p-2.5 rounded-lg text-center" style={{
                      background: f.active ? "rgba(248,113,113,0.06)" : "rgba(52,211,153,0.06)",
                      border: `1px solid ${f.active ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.15)"}`,
                    }}>
                      <p className="text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>{f.label}</p>
                      <p className="text-xs font-bold" style={{ color: f.active ? "var(--red)" : "var(--green)" }}>
                        {f.active ? "YES" : "NO"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Oracle attestation data */}
            {riskData && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-1">Attestation Data</h3>
                <p className="text-[10px] mb-3" style={{ color: "var(--text-muted)" }}>
                  Returned by <span className="font-mono">IAegisScanner.getTokenRisk()</span>
                </p>
                <div className="space-y-0">
                  {[
                    { label: "Risk Score", value: riskData.riskScore.toString() },
                    { label: "Last Updated", value: riskData.lastUpdated > 0 ? new Date(riskData.lastUpdated * 1000).toLocaleString() : "—" },
                    { label: "Attested By", value: riskData.attestedBy },
                    { label: "Reasoning Hash", value: riskData.reasoningHash },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between py-2.5 text-xs" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ color: "var(--text-muted)" }}>{item.label}</span>
                      <span className="font-mono text-white max-w-[60%] truncate text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scan metadata */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Scan Metadata</h3>
              <div className="space-y-0">
                {[
                  { label: "Scanned At", value: scan.scanTimestamp > 0 ? new Date(scan.scanTimestamp * 1000).toLocaleString() : "—" },
                  { label: "Scanned By", value: scan.scannedBy },
                  { label: "Flags String", value: scan.flags || "(none)" },
                  { label: "Reasoning Hash", value: scan.reasoningHash },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between py-2.5 text-xs" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <span style={{ color: "var(--text-muted)" }}>{item.label}</span>
                    <span className="font-mono text-white max-w-[60%] truncate text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
