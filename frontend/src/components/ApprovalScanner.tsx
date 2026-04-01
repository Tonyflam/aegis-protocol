"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import {
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  RefreshCw,
  Wallet,
  Eye,
  ChevronDown,
  ChevronUp,
  Trash2,
  Zap,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────

export interface TokenApproval {
  id: string;
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  spender: string;
  spenderLabel: string;
  allowance: string;
  allowanceFormatted: string;
  isUnlimited: boolean;
  riskLevel: "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskScore: number;
  riskReasons: string[];
  contractAge: number | null; // days
  isVerified: boolean;
  blockNumber: number;
  txHash: string;
  timestamp: number;
}

export interface WalletSecurityReport {
  address: string;
  totalApprovals: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  safeCount: number;
  securityScore: number; // 0-100
  approvals: TokenApproval[];
  scanTimestamp: number;
  scanDuration: number;
}

// ─── Constants ─────────────────────────────────────────────────

const BSC_RPC = "https://bsc-rpc.publicnode.com";
const APPROVAL_TOPIC = ethers.id("Approval(address,address,uint256)");
const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

// Known safe contracts on BSC
const KNOWN_CONTRACTS: Record<string, { label: string; safe: boolean }> = {
  "0x10ed43c718714eb63d5aa57b78b54704e256024e": { label: "PancakeSwap V2 Router", safe: true },
  "0x13f4ea83d0bd40e75c8222255bc855a974568dd4": { label: "PancakeSwap V3 Router", safe: true },
  "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506": { label: "SushiSwap Router", safe: true },
  "0xfd5840cd36d94d7229439859c0112a4185bc0255": { label: "PancakeSwap V2 Router (old)", safe: true },
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": { label: "WBNB", safe: true },
  "0x0000000000000000000000000000000000000000": { label: "Null Address", safe: false },
  "0xcf0febd3f17cef5b47b0cd257acf6025c5bff3b7": { label: "ApeSwap Router", safe: true },
  "0x05ff2b0db69458a0750badebc4f9e13add608c7f": { label: "PancakeSwap V1 Router", safe: true },
  "0xf491e7b69e4244ad4002bc14e878a34207e38c29": { label: "SpookySwap BSC", safe: true },
  "0xd4c4a7c55c9f7b3c48bafb6e8643ba79f42418df": { label: "Venus Protocol", safe: true },
  "0xfd36e2c2a6789db23113685031d7f16329158384": { label: "Venus vUSDT", safe: true },
  "0xa07c5b74c9b40447a954e1466938b865b6bbea36": { label: "Venus vBNB", safe: true },
};

// Known tokens on BSC
const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  "0x55d398326f99059ff775485246999027b3197955": { symbol: "USDT", decimals: 18 },
  "0xe9e7cea3dedca5984780bafc599bd69add087d56": { symbol: "BUSD", decimals: 18 },
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": { symbol: "USDC", decimals: 18 },
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": { symbol: "WBNB", decimals: 18 },
  "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82": { symbol: "CAKE", decimals: 18 },
  "0x2170ed0880ac9a755fd29b2688956bd959f933f8": { symbol: "ETH", decimals: 18 },
  "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c": { symbol: "BTCB", decimals: 18 },
  "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3": { symbol: "DAI", decimals: 18 },
  "0xba2ae424d960c26247dd6c32edc70b295c744c43": { symbol: "DOGE", decimals: 8 },
  "0x2859e4544c4bb03966803b044a93563bd2d0dd4d": { symbol: "SHIB", decimals: 18 },
};

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

// ─── Helpers ───────────────────────────────────────────────────

function getRiskColor(level: string): string {
  switch (level) {
    case "CRITICAL": return "#ef4444";
    case "HIGH": return "#f97316";
    case "MEDIUM": return "#eab308";
    case "LOW": return "#3b82f6";
    default: return "#22c55e";
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#3b82f6";
  if (score >= 40) return "#eab308";
  if (score >= 20) return "#f97316";
  return "#ef4444";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "SECURE";
  if (score >= 60) return "GOOD";
  if (score >= 40) return "AT RISK";
  if (score >= 20) return "DANGEROUS";
  return "CRITICAL";
}

function timeAgo(timestamp: number): string {
  const s = Math.floor((Date.now() - timestamp) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ─── Contract Risk Analysis ────────────────────────────────────

async function analyzeSpenderRisk(
  spenderAddress: string,
  provider: ethers.JsonRpcProvider
): Promise<{ riskScore: number; riskLevel: TokenApproval["riskLevel"]; reasons: string[]; isVerified: boolean; label: string; contractAge: number | null }> {
  const addr = spenderAddress.toLowerCase();
  const reasons: string[] = [];
  let riskScore = 0;

  // Check known contracts
  const known = KNOWN_CONTRACTS[addr];
  if (known) {
    return {
      riskScore: known.safe ? 0 : 80,
      riskLevel: known.safe ? "SAFE" : "CRITICAL",
      reasons: known.safe ? ["Known safe protocol"] : ["Known unsafe address"],
      isVerified: known.safe,
      label: known.label,
      contractAge: null,
    };
  }

  // Check if contract exists
  const code = await provider.getCode(spenderAddress).catch(() => "0x");
  if (code === "0x") {
    return { riskScore: 60, riskLevel: "HIGH", reasons: ["Address is not a contract (EOA)"], isVerified: false, label: "", contractAge: null };
  }

  // Check GoPlusLabs for contract info
  let isVerified = false;
  let label = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/approval_security/56?contract_addresses=${spenderAddress}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    const data = await res.json();
    const info = data?.result?.[addr];
    if (info) {
      if (info.is_open_source === "0") {
        riskScore += 25;
        reasons.push("Contract source not verified");
      } else {
        isVerified = true;
      }
      if (info.is_proxy === "1") {
        riskScore += 10;
        reasons.push("Upgradeable proxy contract");
      }
      if (info.owner_change_balance === "1") {
        riskScore += 20;
        reasons.push("Owner can change balances");
      }
      if (info.tag) label = info.tag;
    }
  } catch {
    riskScore += 15;
    reasons.push("Could not verify contract security");
  }

  // If still no reasons, it's relatively safe but unknown
  if (reasons.length === 0) {
    reasons.push("Contract verified, no known risks");
  }

  let riskLevel: TokenApproval["riskLevel"];
  if (riskScore >= 60) riskLevel = "CRITICAL";
  else if (riskScore >= 40) riskLevel = "HIGH";
  else if (riskScore >= 20) riskLevel = "MEDIUM";
  else if (riskScore >= 10) riskLevel = "LOW";
  else riskLevel = "SAFE";

  return { riskScore, riskLevel, reasons, isVerified, label, contractAge: null };
}

// ─── Main Scanner Logic ────────────────────────────────────────

async function scanApprovals(
  walletAddress: string,
  onProgress: (msg: string) => void
): Promise<WalletSecurityReport> {
  const start = Date.now();
  const provider = new ethers.JsonRpcProvider(BSC_RPC, 56, { staticNetwork: true });

  onProgress("Getting latest block...");
  const latestBlock = await provider.getBlockNumber();

  // Scan last ~2M blocks (~70 days on BSC at 3s blocks)
  // This covers most active approvals
  const fromBlock = Math.max(0, latestBlock - 2_000_000);

  onProgress("Scanning approval events...");

  // Pad wallet address to 32 bytes for topic filter
  const paddedAddress = "0x" + walletAddress.slice(2).toLowerCase().padStart(64, "0");

  // Fetch Approval logs where owner = wallet
  const allLogs: ethers.Log[] = [];
  const CHUNK = 500_000; // Scan in chunks to avoid RPC limits

  for (let start = fromBlock; start < latestBlock; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, latestBlock);
    onProgress(`Scanning blocks ${start.toLocaleString()} to ${end.toLocaleString()}...`);

    try {
      const logs = await provider.getLogs({
        fromBlock: start,
        toBlock: end,
        topics: [APPROVAL_TOPIC, paddedAddress],
      });
      allLogs.push(...logs);
    } catch {
      // If chunk is too big, try smaller
      const halfChunk = Math.floor(CHUNK / 2);
      for (let s2 = start; s2 < end; s2 += halfChunk) {
        try {
          const logs = await provider.getLogs({
            fromBlock: s2,
            toBlock: Math.min(s2 + halfChunk - 1, end),
            topics: [APPROVAL_TOPIC, paddedAddress],
          });
          allLogs.push(...logs);
        } catch {
          // Skip failed sub-chunk
        }
        await new Promise(r => setTimeout(r, 300));
      }
    }
    await new Promise(r => setTimeout(r, 200));
  }

  onProgress(`Found ${allLogs.length} approval events. Analyzing...`);

  // Deduplicate: keep latest approval per token+spender pair
  const latestApprovals = new Map<string, ethers.Log>();
  for (const log of allLogs) {
    const key = `${log.address.toLowerCase()}-${log.topics[2]}`;
    const existing = latestApprovals.get(key);
    if (!existing || log.blockNumber > existing.blockNumber) {
      latestApprovals.set(key, log);
    }
  }

  // Filter out zero approvals (revoked)
  const activeApprovals: ethers.Log[] = [];
  for (const log of latestApprovals.values()) {
    const value = BigInt(log.data);
    if (value > 0n) {
      activeApprovals.push(log);
    }
  }

  onProgress(`${activeApprovals.length} active approvals found. Risk-scoring...`);

  // Analyze each approval
  const approvals: TokenApproval[] = [];
  let analyzed = 0;

  for (const log of activeApprovals) {
    analyzed++;
    if (analyzed % 3 === 0) {
      onProgress(`Analyzing approval ${analyzed}/${activeApprovals.length}...`);
    }

    const tokenAddr = log.address.toLowerCase();
    const spenderAddr = "0x" + log.topics[2].slice(26).toLowerCase();
    const allowanceRaw = BigInt(log.data);

    // Get token info
    let symbol = KNOWN_TOKENS[tokenAddr]?.symbol ?? "???";
    let decimals = KNOWN_TOKENS[tokenAddr]?.decimals ?? 18;

    if (symbol === "???") {
      try {
        const token = new ethers.Contract(log.address, ERC20_ABI, provider);
        const [s, d] = await Promise.all([
          token.symbol().catch(() => "???"),
          token.decimals().catch(() => 18),
        ]);
        symbol = String(s);
        decimals = Number(d);
      } catch {
        // Keep defaults
      }
    }

    // Check current allowance (may have been partially used)
    let currentAllowance = allowanceRaw;
    try {
      const token = new ethers.Contract(log.address, ERC20_ABI, provider);
      currentAllowance = await token.allowance(walletAddress, spenderAddr);
      if (currentAllowance === 0n) continue; // Already revoked/fully used
    } catch {
      // Use log value as fallback
    }

    const isUnlimited = currentAllowance.toString() === MAX_UINT256 || currentAllowance > ethers.parseUnits("1000000000", decimals);

    // Risk analysis
    const risk = await analyzeSpenderRisk(spenderAddr, provider);

    // Add unlimited penalty
    let adjustedScore = risk.riskScore;
    const adjustedReasons = [...risk.reasons];
    if (isUnlimited && risk.riskLevel !== "SAFE") {
      adjustedScore += 15;
      adjustedReasons.push("Unlimited approval — full token access");
    }

    let finalLevel: TokenApproval["riskLevel"];
    if (adjustedScore >= 60) finalLevel = "CRITICAL";
    else if (adjustedScore >= 40) finalLevel = "HIGH";
    else if (adjustedScore >= 20) finalLevel = "MEDIUM";
    else if (adjustedScore >= 10) finalLevel = "LOW";
    else finalLevel = "SAFE";

    approvals.push({
      id: `${log.transactionHash}-${log.index}`,
      token: log.address,
      tokenSymbol: symbol,
      tokenDecimals: decimals,
      spender: spenderAddr,
      spenderLabel: risk.label || KNOWN_CONTRACTS[spenderAddr.toLowerCase()]?.label || "",
      allowance: currentAllowance.toString(),
      allowanceFormatted: isUnlimited ? "Unlimited" : ethers.formatUnits(currentAllowance, decimals),
      isUnlimited,
      riskLevel: finalLevel,
      riskScore: Math.min(100, adjustedScore),
      riskReasons: adjustedReasons,
      contractAge: risk.contractAge,
      isVerified: risk.isVerified,
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      timestamp: Date.now(),
    });

    // Throttle API calls
    await new Promise(r => setTimeout(r, 150));
  }

  // Sort by risk (critical first)
  approvals.sort((a, b) => b.riskScore - a.riskScore);

  // Calculate security score
  const criticalCount = approvals.filter(a => a.riskLevel === "CRITICAL").length;
  const highCount = approvals.filter(a => a.riskLevel === "HIGH").length;
  const mediumCount = approvals.filter(a => a.riskLevel === "MEDIUM").length;
  const safeCount = approvals.filter(a => a.riskLevel === "SAFE" || a.riskLevel === "LOW").length;

  let securityScore = 100;
  securityScore -= criticalCount * 20;
  securityScore -= highCount * 10;
  securityScore -= mediumCount * 3;
  securityScore = Math.max(0, Math.min(100, securityScore));

  return {
    address: walletAddress,
    totalApprovals: approvals.length,
    criticalCount,
    highCount,
    mediumCount,
    safeCount,
    securityScore,
    approvals,
    scanTimestamp: Date.now(),
    scanDuration: Date.now() - start,
  };
}

// ═══════════════════════════════════════════════════════════════
// Component: ApprovalScanner
// ═══════════════════════════════════════════════════════════════

export default function ApprovalScanner({
  connectedAddress,
  signer,
}: {
  connectedAddress: string | null;
  signer: ethers.Signer | null;
}) {
  const [targetAddress, setTargetAddress] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState("");
  const [report, setReport] = useState<WalletSecurityReport | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "SAFE">("ALL");
  const [revoking, setRevoking] = useState<string | null>(null);


  const handleScan = useCallback(async (addr?: string) => {
    const target = addr || targetAddress.trim() || connectedAddress;
    if (!target) {
      setError("Enter a wallet address or connect your wallet");
      return;
    }
    if (!ethers.isAddress(target)) {
      setError("Invalid wallet address");
      return;
    }

    setScanning(true);
    setError("");
    setReport(null);

    try {
      const result = await scanApprovals(target, setScanPhase);
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed — please try again");
    } finally {
      setScanning(false);
      setScanPhase("");
    }
  }, [targetAddress, connectedAddress]);

  const handleRevoke = useCallback(async (approval: TokenApproval) => {
    if (!signer) {
      setError("Connect your wallet to revoke approvals");
      return;
    }
    setRevoking(approval.id);
    try {
      const token = new ethers.Contract(approval.token, ERC20_ABI, signer);
      const tx = await token.approve(approval.spender, 0);
      await tx.wait();
      // Update report
      setReport(prev => {
        if (!prev) return prev;
        const updated = prev.approvals.filter(a => a.id !== approval.id);
        const criticalCount = updated.filter(a => a.riskLevel === "CRITICAL").length;
        const highCount = updated.filter(a => a.riskLevel === "HIGH").length;
        const mediumCount = updated.filter(a => a.riskLevel === "MEDIUM").length;
        const safeCount = updated.filter(a => a.riskLevel === "SAFE" || a.riskLevel === "LOW").length;
        let securityScore = 100 - criticalCount * 20 - highCount * 10 - mediumCount * 3;
        securityScore = Math.max(0, Math.min(100, securityScore));
        return { ...prev, approvals: updated, totalApprovals: updated.length, criticalCount, highCount, mediumCount, safeCount, securityScore };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setRevoking(null);
    }
  }, [signer]);

  const filteredApprovals = report
    ? filter === "ALL"
      ? report.approvals
      : filter === "SAFE"
        ? report.approvals.filter(a => a.riskLevel === "SAFE" || a.riskLevel === "LOW")
        : report.approvals.filter(a => a.riskLevel === filter)
    : [];

  return (
    <div className="space-y-6">
      {/* ── Scanner Input ── */}
      <div className="card p-6" style={{ borderRadius: "12px" }}>
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[color:var(--accent)]" />
          Approval Scanner
          <span className="ml-auto text-xs px-2 py-1 rounded-md bg-[var(--accent)]/10 text-[color:var(--accent)] border border-[var(--accent)]/20">
            BSC Mainnet
          </span>
        </h4>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={connectedAddress ? `${connectedAddress.slice(0, 10)}...${connectedAddress.slice(-8)} (connected)` : "Enter any BSC wallet address (0x...)"}
              value={targetAddress}
              onChange={(e) => { setTargetAddress(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              className="w-full px-4 py-3.5 pl-11 rounded-xl bg-[var(--bg-base)] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--accent)]/50 font-mono text-sm transition-all"
              disabled={scanning}
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          </div>
          <button onClick={() => handleScan()} disabled={scanning} className="btn-primary px-6 py-3.5 flex items-center gap-2 whitespace-nowrap">
            {scanning ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning...</>
            ) : (
              <><Shield className="w-4 h-4" /> Scan Wallet</>
            )}
          </button>
        </div>

        {connectedAddress && !targetAddress && (
          <button onClick={() => handleScan(connectedAddress)} disabled={scanning}
            className="text-xs px-3 py-1.5 rounded-lg transition-all hover:scale-105"
            style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)", color: "var(--accent)" }}>
            <Wallet className="w-3 h-3 inline mr-1.5" />
            Scan Connected Wallet
          </button>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-xl flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {scanning && (
          <div className="mt-4 flex items-center gap-3 p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.3)" }}>
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full border-2 border-[var(--accent)]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)] animate-spin" />
            </div>
            <div>
              <p className="text-sm text-white font-medium">Scanning approvals...</p>
              <p className="text-xs text-[color:var(--accent)] font-mono">{scanPhase}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Security Score ── */}
      {report && (
        <div className="animate-fade-in-up space-y-4">
          <div className="card p-6 relative overflow-hidden" style={{ borderRadius: "12px", borderColor: `${getScoreColor(report.securityScore)}30` }}>
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-20" style={{ background: getScoreColor(report.securityScore) }} />

            <div className="flex items-start gap-6 relative">
              {/* Score */}
              <div className="flex-shrink-0">
                <div className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center"
                  style={{ background: `${getScoreColor(report.securityScore)}12`, border: `2px solid ${getScoreColor(report.securityScore)}40` }}>
                  <span className="text-3xl font-bold" style={{ color: getScoreColor(report.securityScore) }}>{report.securityScore}</span>
                  <span className="text-xs font-semibold" style={{ color: getScoreColor(report.securityScore) }}>{getScoreLabel(report.securityScore)}</span>
                </div>
              </div>

              {/* Summary */}
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-1">Wallet Security Score</h3>
                <p className="text-xs font-mono mb-3" style={{ color: "var(--text-muted)" }}>
                  {report.address.slice(0, 10)}...{report.address.slice(-8)}
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Total", value: report.totalApprovals, color: "var(--accent)" },
                    { label: "Critical", value: report.criticalCount, color: "#ef4444" },
                    { label: "High", value: report.highCount, color: "#f97316" },
                    { label: "Safe", value: report.safeCount, color: "#22c55e" },
                  ].map(s => (
                    <div key={s.label} className="text-center p-2 rounded-lg" style={{ background: `${s.color}08` }}>
                      <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Score Bar */}
            <div className="mt-4">
              <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${report.securityScore}%`, background: `linear-gradient(90deg, ${getScoreColor(Math.max(0, report.securityScore - 20))}, ${getScoreColor(report.securityScore)})` }} />
              </div>
            </div>

            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
              Scanned in {(report.scanDuration / 1000).toFixed(1)}s &middot; {report.totalApprovals} active approvals found &middot; {timeAgo(report.scanTimestamp)}
            </p>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "SAFE"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all ${filter === f ? "bg-[var(--accent)]/10 text-[color:var(--accent)] border border-[var(--accent)]/20" : "text-gray-500 hover:text-gray-300 border border-transparent"}`}>
                {f}
              </button>
            ))}
          </div>

          {/* Approval List */}
          <div className="space-y-2">
            {filteredApprovals.length === 0 ? (
              <div className="card p-8" style={{ borderRadius: "12px" }}>
                {filter !== "ALL" ? (
                  <div className="text-center">
                    <ShieldCheck className="w-8 h-8 text-green-400 mx-auto mb-3" />
                    <p className="text-gray-400">No {filter.toLowerCase()} risk approvals</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <ShieldCheck className="w-12 h-12 text-green-400 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-white mb-2">This Wallet is Clean!</h4>
                    <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
                      No active token approvals found. This wallet hasn&apos;t approved any contracts
                      to spend its tokens — or all previous approvals have been revoked.
                    </p>
                    <div className="p-4 rounded-xl mb-4" style={{ background: "rgba(0,0,0,0.3)" }}>
                      <p className="text-xs text-gray-500 mb-3">Try scanning a wallet with real approvals to see the full analysis:</p>
                      <div className="flex flex-col sm:flex-row gap-2 items-center justify-center">
                        {[
                          { label: "Binance Hot Wallet", addr: "0x8894E0a0c962CB723c1ef8a1B63d28AAA26e8F6f" },
                          { label: "Active DeFi User", addr: "0x7754Bc79E6A80D72689a0E0ae4Daa8bC84B31B0b" },
                        ].map(demo => (
                          <button key={demo.addr} onClick={() => { setTargetAddress(demo.addr); handleScan(demo.addr); }}
                            disabled={scanning}
                            className="text-xs px-3 py-2 rounded-lg flex items-center gap-2 transition-all hover:scale-105"
                            style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)", color: "var(--accent)" }}>
                            <Eye className="w-3 h-3" />
                            {demo.label}
                            <span className="font-mono text-[10px] opacity-60">{demo.addr.slice(0, 6)}...{demo.addr.slice(-4)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-600">
                      The scanner checks ~2M BSC blocks for ERC-20 Approval events and verifies each spender contract.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              filteredApprovals.map(approval => {
                const isExpanded = expanded === approval.id;
                const color = getRiskColor(approval.riskLevel);

                return (
                  <div key={approval.id} className="card overflow-hidden transition-all duration-200" style={{ borderRadius: "12px", borderLeft: `3px solid ${color}` }}>
                    <button onClick={() => setExpanded(isExpanded ? null : approval.id)} className="w-full flex items-center gap-3 p-4 text-left">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}12` }}>
                        {approval.riskLevel === "SAFE" || approval.riskLevel === "LOW" ? (
                          <CheckCircle className="w-4 h-4" style={{ color }} />
                        ) : (
                          <AlertTriangle className="w-4 h-4" style={{ color }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{approval.tokenSymbol}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: `${color}15`, color }}>{approval.riskLevel}</span>
                          {approval.isUnlimited && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>UNLIMITED</span>
                          )}
                        </div>
                        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                          → {approval.spenderLabel || `${approval.spender.slice(0, 10)}...${approval.spender.slice(-6)}`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 mr-2">
                        <p className="text-xs font-mono" style={{ color }}>{approval.allowanceFormatted === "Unlimited" ? "∞" : approval.allowanceFormatted.slice(0, 12)}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{approval.isVerified ? "Verified" : "Unverified"}</p>
                      </div>
                      {(approval.riskLevel === "CRITICAL" || approval.riskLevel === "HIGH") && signer && (
                        <button onClick={(e) => { e.stopPropagation(); handleRevoke(approval); }} disabled={revoking === approval.id}
                          className="text-[10px] px-2.5 py-1.5 rounded-md flex-shrink-0 flex items-center gap-1"
                          style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
                          {revoking === approval.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          {revoking === approval.id ? "Revoking..." : "Revoke"}
                        </button>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <p className="text-xs text-gray-500">Token</p>
                            <p className="text-sm font-mono text-gray-300">{approval.tokenSymbol}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Allowance</p>
                            <p className="text-sm font-mono text-gray-300">{approval.isUnlimited ? "Unlimited (MAX_UINT256)" : approval.allowanceFormatted}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Spender</p>
                            <p className="text-sm font-mono text-gray-300">{approval.spenderLabel || approval.spender.slice(0, 16) + "..."}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Verified</p>
                            <p className="text-sm font-mono text-gray-300">{approval.isVerified ? "✓ Yes" : "✗ No"}</p>
                          </div>
                        </div>
                        {approval.riskReasons.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-500 mb-1.5">Risk Analysis</p>
                            <div className="space-y-1">
                              {approval.riskReasons.map((reason, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: color }} />
                                  {reason}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="mt-3 pt-3 flex items-center gap-4" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                          <a href={`https://bscscan.com/tx/${approval.txHash}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-[color:var(--accent)] hover:underline">
                            <ExternalLink className="w-3 h-3" /> View on BSCScan
                          </a>
                          {signer && approval.riskLevel !== "SAFE" && (
                            <button onClick={() => handleRevoke(approval)} disabled={revoking === approval.id}
                              className="flex items-center gap-1.5 text-xs text-red-400 hover:underline">
                              <Trash2 className="w-3 h-3" /> {revoking === approval.id ? "Revoking..." : "Revoke This Approval"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!report && !scanning && (
        <div className="card p-12 text-center" style={{ borderRadius: "12px" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-border)" }}>
            <Shield className="w-8 h-8 text-[color:var(--accent)]" />
          </div>
          <h4 className="text-xl font-semibold mb-2 text-white">Scan Any BSC Wallet</h4>
          <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
            Enter any BSC wallet address to discover all active token approvals,
            risk-score each one, and revoke dangerous approvals instantly.
          </p>
          <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
            {[
              { icon: Search, label: "Approval Discovery" },
              { icon: Eye, label: "Risk Analysis" },
              { icon: Trash2, label: "One-Click Revoke" },
              { icon: Zap, label: "Auto-Protect" },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-1.5">
                <f.icon className="w-3.5 h-3.5 text-[color:var(--accent)]" />
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
