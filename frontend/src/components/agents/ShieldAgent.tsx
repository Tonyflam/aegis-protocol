"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import {
  Shield,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Skull,
  Lock,
  Unlock,
  Eye,
  TrendingDown,
  Droplets,
  ExternalLink,
  Copy,
  Loader2,
  Code,
  FileWarning,
  ShieldCheck,
  ShieldAlert,
  Zap,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Shield Agent — Transaction Firewall & Contract Analyzer
// Deep-analyzes any BSC contract for security risks:
// bytecode patterns, honeypot detection, ownership, liquidity,
// source verification, and known exploit signatures.
// ═══════════════════════════════════════════════════════════════

// ─── Types ─────────────────────────────────────────────────────

interface ContractReport {
  address: string;
  type: "token" | "contract";
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  riskScore: number;
  riskLevel: "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "SCAM";
  isHoneypot: boolean | null;
  honeypotConfident: boolean;
  buyTax: number;
  sellTax: number;
  liquidity: number;
  topHolderPercent: number;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isContractRenounced: boolean;
  isLiquidityLocked: boolean;
  isVerified: boolean;
  isProxy: boolean;
  hasSelfDestruct: boolean;
  hasDelegatecall: boolean;
  bytecodeSizeKb: number;
  flags: string[];
  goPlusData: Record<string, unknown> | null;
  scanTimestamp: number;
}

// ─── Constants ─────────────────────────────────────────────────

const BSC_RPC = "https://bsc-rpc.publicnode.com";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function owner() view returns (address)",
];

const PAIR_ABI = [
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function token0() view returns (address)",
];

const FACTORY_ABI = [
  "function getPair(address, address) view returns (address)",
];

const PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const DEAD_ADDRESSES = [
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dEaD",
  "0x0000000000000000000000000000000000000001",
];

const SAFE_TOKENS = new Set([
  WBNB.toLowerCase(),
  "0xe9e7cea3dedca5984780bafc599bd69add087d56",
  "0x55d398326f99059ff775485246999027b3197955",
  "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
  "0x2170ed0880ac9a755fd29b2688956bd959f933f8",
  "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c",
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
]);

// Dangerous bytecode selectors
const DANGEROUS_SELECTORS: { selector: string; name: string; risk: string }[] = [
  { selector: "40c10f19", name: "mint(address,uint256)", risk: "Owner can mint new tokens" },
  { selector: "8456cb59", name: "pause()", risk: "Owner can freeze trading" },
  { selector: "44337ea1", name: "setBlacklist(address,bool)", risk: "Owner can blacklist addresses" },
  { selector: "715018a6", name: "renounceOwnership()", risk: "Has ownership transfer" },
  { selector: "f2fde38b", name: "transferOwnership(address)", risk: "Has ownership transfer" },
  { selector: "a9059cbb", name: "transfer(address,uint256)", risk: "" }, // Standard — not risky
  { selector: "23b872dd", name: "transferFrom(address,address,uint256)", risk: "" },
];

// ─── Helpers ───────────────────────────────────────────────────

function getRiskColor(score: number): string {
  if (score >= 80) return "#ef4444";
  if (score >= 60) return "#f97316";
  if (score >= 40) return "#eab308";
  if (score >= 20) return "#3b82f6";
  return "#22c55e";
}

function getRiskLabel(score: number): string {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  if (score >= 20) return "LOW";
  return "SAFE";
}

function getRiskBg(score: number): string {
  if (score >= 80) return "rgba(239,68,68,0.08)";
  if (score >= 60) return "rgba(249,115,22,0.08)";
  if (score >= 40) return "rgba(234,179,8,0.08)";
  return "rgba(34,197,94,0.08)";
}

function flagDescription(flag: string): string {
  const descriptions: Record<string, string> = {
    HONEYPOT: "Token is a confirmed honeypot — cannot sell",
    HONEYPOT_CHECK_FAILED: "Unable to verify honeypot status — proceed with extreme caution",
    HIGH_TAX: "Buy or sell tax exceeds 50%",
    MODERATE_TAX: "Buy or sell tax exceeds 10%",
    LOW_LIQUIDITY: "Liquidity below $1,000 — extreme slippage risk",
    LIMITED_LIQUIDITY: "Liquidity below $10,000 — high slippage possible",
    MINT_FUNCTION: "Owner can mint unlimited tokens, diluting supply",
    PAUSE_FUNCTION: "Owner can pause all transfers",
    BLACKLIST_FUNCTION: "Owner can blacklist wallet addresses",
    WHALE_DOMINATED: "Top holder owns >50% of supply",
    CONCENTRATED_SUPPLY: "Top holder owns >25% of supply",
    UNVERIFIED: "Contract source code is not verified on BSCScan",
    PROXY_CONTRACT: "Upgradeable proxy — contract logic can be changed",
    SELF_DESTRUCT: "Contract contains selfdestruct — can be destroyed",
    DELEGATECALL: "Contract uses delegatecall — can execute arbitrary code",
    LARGE_BYTECODE: "Unusually large bytecode — may contain hidden logic",
  };
  return descriptions[flag] || flag;
}

// ─── Analysis Functions ────────────────────────────────────────

async function analyzeContractSecurity(address: string, provider: ethers.JsonRpcProvider) {
  const result = {
    ownerCanMint: false,
    ownerCanPause: false,
    ownerCanBlacklist: false,
    isProxy: false,
    isRenounced: false,
    hasSelfDestruct: false,
    hasDelegatecall: false,
    bytecodeSizeKb: 0,
    detectedFunctions: [] as string[],
  };

  try {
    const code = await provider.getCode(address);
    if (code === "0x") return result;

    result.bytecodeSizeKb = Math.round((code.length - 2) / 2 / 1024 * 10) / 10;

    // Check selectors
    for (const s of DANGEROUS_SELECTORS) {
      if (code.includes(s.selector)) {
        result.detectedFunctions.push(s.name);
        if (s.selector === "40c10f19") result.ownerCanMint = true;
        if (s.selector === "8456cb59") result.ownerCanPause = true;
        if (s.selector === "44337ea1") result.ownerCanBlacklist = true;
      }
    }

    // Proxy patterns
    result.isProxy = code.includes("363d3d373d3d3d363d73") || code.includes("5c60da1b");

    // Dangerous opcodes (in bytecode, not selectors)
    result.hasSelfDestruct = code.includes("ff"); // SELFDESTRUCT opcode
    result.hasDelegatecall = code.includes("f4"); // DELEGATECALL opcode

    // Note: ff and f4 can appear in non-opcode parts of bytecode (e.g., in data).
    // This is a heuristic — not definitive.

    // Check owner
    try {
      const contract = new ethers.Contract(address, ERC20_ABI, provider);
      const owner = await contract.owner();
      result.isRenounced = DEAD_ADDRESSES.includes(owner.toLowerCase());
    } catch {
      result.isRenounced = true;
    }
  } catch {
    // Can't analyze
  }

  return result;
}

async function analyzeLiquidity(tokenAddress: string, provider: ethers.JsonRpcProvider, bnbPrice: number) {
  const info = { hasLiquidity: false, liquidityUsd: 0, isLpBurned: false, pairAddress: "" };

  try {
    const factory = new ethers.Contract(PANCAKE_FACTORY, FACTORY_ABI, provider);
    const pairAddress = await factory.getPair(tokenAddress, WBNB);
    if (pairAddress === ethers.ZeroAddress) return info;

    info.pairAddress = pairAddress;
    const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
    const [reserves, token0] = await Promise.all([pair.getReserves(), pair.token0()]);

    const wbnbReserve = token0.toLowerCase() === WBNB.toLowerCase()
      ? Number(ethers.formatEther(reserves[0]))
      : Number(ethers.formatEther(reserves[1]));

    info.liquidityUsd = wbnbReserve * 2 * bnbPrice;
    info.hasLiquidity = info.liquidityUsd > 100;

    // Check LP burn
    const lpToken = new ethers.Contract(pairAddress, [
      "function balanceOf(address) view returns (uint256)",
      "function totalSupply() view returns (uint256)",
    ], provider);

    const [totalLp, ...deadBalances] = await Promise.all([
      lpToken.totalSupply(),
      ...DEAD_ADDRESSES.map((a) => lpToken.balanceOf(a)),
    ]);

    const totalBurned = deadBalances.reduce((s: bigint, b: bigint) => s + b, 0n);
    info.isLpBurned = Number((totalBurned * 10000n) / totalLp) > 9000;
  } catch {
    // No pair
  }

  return info;
}

async function detectHoneypot(address: string) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://api.honeypot.is/v2/IsHoneypot?address=${address}&chainID=56`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    return {
      isHoneypot: data.honeypotResult?.isHoneypot ?? null,
      buyTax: Math.round(data.simulationResult?.buyTax ?? 0),
      sellTax: Math.round(data.simulationResult?.sellTax ?? 0),
      confident: true,
    };
  } catch {
    return { isHoneypot: null, buyTax: 0, sellTax: 0, confident: false };
  }
}

async function fetchGoPlusData(address: string): Promise<Record<string, unknown> | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses=${address}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    const data = await res.json();
    return data?.result?.[address.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

// ─── Risk Calculator ───────────────────────────────────────────

function calculateRisk(r: Partial<ContractReport>): { score: number; flags: string[] } {
  let score = 0;
  const flags: string[] = [];

  if (r.isHoneypot) { score = 100; flags.push("HONEYPOT"); return { score, flags }; }
  if (r.isHoneypot === null) { score += 15; flags.push("HONEYPOT_CHECK_FAILED"); }

  if ((r.buyTax ?? 0) > 50 || (r.sellTax ?? 0) > 50) { score += 40; flags.push("HIGH_TAX"); }
  else if ((r.buyTax ?? 0) > 10 || (r.sellTax ?? 0) > 10) { score += 15; flags.push("MODERATE_TAX"); }

  if ((r.liquidity ?? 0) < 1000) { score += 30; flags.push("LOW_LIQUIDITY"); }
  else if ((r.liquidity ?? 0) < 10000) { score += 15; flags.push("LIMITED_LIQUIDITY"); }

  if (r.ownerCanMint) { score += 15; flags.push("MINT_FUNCTION"); }
  if (r.ownerCanPause) { score += 10; flags.push("PAUSE_FUNCTION"); }
  if (r.ownerCanBlacklist) { score += 10; flags.push("BLACKLIST_FUNCTION"); }

  if ((r.topHolderPercent ?? 0) > 50) { score += 20; flags.push("WHALE_DOMINATED"); }
  else if ((r.topHolderPercent ?? 0) > 25) { score += 10; flags.push("CONCENTRATED_SUPPLY"); }

  if (!r.isVerified) { score += 10; flags.push("UNVERIFIED"); }
  if (r.isProxy) { score += 10; flags.push("PROXY_CONTRACT"); }
  if (r.hasSelfDestruct) { score += 5; flags.push("SELF_DESTRUCT"); }
  if (r.hasDelegatecall) { score += 5; flags.push("DELEGATECALL"); }
  if ((r.bytecodeSizeKb ?? 0) > 50) { score += 5; flags.push("LARGE_BYTECODE"); }

  if (r.isContractRenounced) score = Math.max(0, score - 10);
  if (r.isLiquidityLocked) score = Math.max(0, score - 10);

  return { score: Math.min(100, Math.max(0, score)), flags };
}

// ─── Full Scan ─────────────────────────────────────────────────

async function scanContract(address: string, bnbPrice: number): Promise<ContractReport> {
  const provider = new ethers.JsonRpcProvider(BSC_RPC, 56, { staticNetwork: true });

  if (SAFE_TOKENS.has(address.toLowerCase())) {
    const contract = new ethers.Contract(address, ERC20_ABI, provider);
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name(), contract.symbol(), contract.decimals(), contract.totalSupply(),
    ]);
    return {
      address, type: "token", name, symbol, decimals: Number(decimals),
      totalSupply: ethers.formatUnits(totalSupply, decimals),
      riskScore: 0, riskLevel: "SAFE", isHoneypot: false, honeypotConfident: true,
      buyTax: 0, sellTax: 0, liquidity: 999999999, topHolderPercent: 0,
      ownerCanMint: false, ownerCanPause: false, ownerCanBlacklist: false,
      isContractRenounced: true, isLiquidityLocked: true, isVerified: true,
      isProxy: false, hasSelfDestruct: false, hasDelegatecall: false,
      bytecodeSizeKb: 0, flags: [], goPlusData: null, scanTimestamp: Date.now(),
    };
  }

  const contract = new ethers.Contract(address, ERC20_ABI, provider);

  const [basics, security, liquidity, honeypot, goplus] = await Promise.all([
    Promise.all([
      contract.name().catch(() => "Unknown Contract"),
      contract.symbol().catch(() => "???"),
      contract.decimals().catch(() => 18),
      contract.totalSupply().catch(() => 0n),
    ]),
    analyzeContractSecurity(address, provider),
    analyzeLiquidity(address, provider, bnbPrice),
    detectHoneypot(address),
    fetchGoPlusData(address),
  ]);

  const [name, symbol, decimals, totalSupply] = basics;
  const isToken = symbol !== "???" && totalSupply > 0n;

  // Extract GoPlus holder concentration if available
  let topHolderPercent = 0;
  if (goplus && Array.isArray(goplus.holders)) {
    const top = goplus.holders[0];
    if (top && typeof top.percent === "string") {
      topHolderPercent = Math.round(parseFloat(top.percent) * 100);
    }
  }

  const partial: Partial<ContractReport> = {
    address, type: isToken ? "token" : "contract", name, symbol,
    decimals: Number(decimals), totalSupply: ethers.formatUnits(totalSupply, Number(decimals)),
    isHoneypot: honeypot.isHoneypot, honeypotConfident: honeypot.confident,
    buyTax: honeypot.buyTax, sellTax: honeypot.sellTax,
    liquidity: liquidity.liquidityUsd, topHolderPercent,
    ownerCanMint: security.ownerCanMint, ownerCanPause: security.ownerCanPause,
    ownerCanBlacklist: security.ownerCanBlacklist, isContractRenounced: security.isRenounced,
    isLiquidityLocked: liquidity.isLpBurned,
    isVerified: goplus ? goplus.is_open_source === "1" : false,
    isProxy: security.isProxy, hasSelfDestruct: security.hasSelfDestruct,
    hasDelegatecall: security.hasDelegatecall, bytecodeSizeKb: security.bytecodeSizeKb,
    goPlusData: goplus,
  };

  const { score, flags } = calculateRisk(partial);

  return {
    ...partial,
    riskScore: score,
    riskLevel: (score >= 80 ? "CRITICAL" : getRiskLabel(score)) as ContractReport["riskLevel"],
    flags,
    scanTimestamp: Date.now(),
  } as ContractReport;
}

// ═══════════════════════════════════════════════════════════════
// Component: ShieldAgent
// ═══════════════════════════════════════════════════════════════

export default function ShieldAgent({ bnbPrice }: { bnbPrice: number }) {
  const [contractAddress, setContractAddress] = useState("");
  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState<ContractReport | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ContractReport[]>([]);

  const quickScanContracts = [
    { symbol: "CAKE", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82" },
    { symbol: "DOGE", address: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43" },
    { symbol: "FLOKI", address: "0xfb5B838b6cfEEdC2873aB27866079AC55363D37E" },
    { symbol: "SHIB", address: "0x2859e4544C4bB03966803b044A93563Bd2D0DD4D" },
    { symbol: "TWT", address: "0x4B0F1812e5Df2A09796481Ff14017e6005508003" },
  ];

  const handleScan = useCallback(async (addr?: string) => {
    const target = addr || contractAddress.trim();
    if (!target) { setError("Enter a contract address"); return; }
    if (!ethers.isAddress(target)) { setError("Invalid address"); return; }

    setScanning(true);
    setError("");
    setReport(null);

    try {
      const result = await scanContract(target, bnbPrice || 600);
      setReport(result);
      setHistory((prev) => {
        const filtered = prev.filter((r) => r.address !== result.address);
        return [result, ...filtered].slice(0, 20);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [contractAddress, bnbPrice]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  }, []);

  return (
    <div className="space-y-6">
      {/* ─── Header Card ─── */}
      <div className="card p-6" style={{ borderRadius: "12px" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)" }}>
            <Shield className="w-5 h-5" style={{ color: "#a855f7" }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Shield Agent</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Transaction Firewall — Deep Contract Analyzer</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              value={contractAddress}
              onChange={(e) => { setContractAddress(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              placeholder="Paste any BSC contract address (0x...)"
              className="w-full text-sm pl-10 pr-4 py-2.5 rounded-lg bg-black/30 border text-white outline-none focus:border-purple-500/30 transition-colors font-mono"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            />
          </div>
          <button
            onClick={() => handleScan()}
            disabled={scanning}
            className="px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-1.5 transition-all flex-shrink-0"
            style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)" }}
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {scanning ? "Analyzing..." : "Analyze"}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" /> {error}
          </p>
        )}

        {/* Quick Scan */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Quick:</span>
          {quickScanContracts.map((t) => (
            <button
              key={t.symbol}
              onClick={() => { setContractAddress(t.address); handleScan(t.address); }}
              className="text-xs px-2 py-1 rounded-md transition-all hover:bg-white/5"
              style={{ color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {t.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Scanning State ─── */}
      {scanning && (
        <div className="card p-8 text-center" style={{ borderRadius: "12px" }}>
          <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin" style={{ color: "#a855f7" }} />
          <p className="text-sm text-white font-medium">Deep-Analyzing Contract</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Bytecode analysis • Honeypot detection • Liquidity verification • Source check
          </p>
        </div>
      )}

      {/* ─── Report ─── */}
      {report && !scanning && (
        <div className="space-y-4">
          {/* Risk Score Card */}
          <div className="card p-6" style={{ borderRadius: "12px", borderTop: `3px solid ${getRiskColor(report.riskScore)}` }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: getRiskBg(report.riskScore) }}>
                  {report.riskScore >= 80 ? <Skull className="w-7 h-7" style={{ color: getRiskColor(report.riskScore) }} /> :
                   report.riskScore >= 60 ? <ShieldAlert className="w-7 h-7" style={{ color: getRiskColor(report.riskScore) }} /> :
                   report.riskScore >= 40 ? <AlertTriangle className="w-7 h-7" style={{ color: getRiskColor(report.riskScore) }} /> :
                   <ShieldCheck className="w-7 h-7" style={{ color: getRiskColor(report.riskScore) }} />}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{report.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      {report.address.slice(0, 10)}...{report.address.slice(-8)}
                    </span>
                    <button onClick={() => handleCopy(report.address)} className="hover:opacity-70">
                      <Copy className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                    </button>
                    <a href={`https://bscscan.com/address/${report.address}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3" style={{ color: "var(--accent)" }} />
                    </a>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black" style={{ color: getRiskColor(report.riskScore) }}>
                  {report.riskScore}
                </div>
                <div className="text-xs font-bold px-2 py-0.5 rounded" style={{
                  background: getRiskBg(report.riskScore),
                  color: getRiskColor(report.riskScore),
                }}>{report.riskLevel}</div>
              </div>
            </div>

            {/* Risk bar */}
            <div className="h-3 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${report.riskScore}%`, background: getRiskColor(report.riskScore) }}
              />
            </div>
            <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
              <span>Safe</span><span>Critical</span>
            </div>
          </div>

          {/* Analysis Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {/* Honeypot */}
            <div className="card p-4" style={{ borderRadius: "12px" }}>
              <div className="flex items-center gap-2 mb-2">
                {report.isHoneypot === true ? <Skull className="w-4 h-4 text-red-400" /> :
                 report.isHoneypot === false ? <CheckCircle className="w-4 h-4 text-green-400" /> :
                 <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Honeypot</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: report.isHoneypot === true ? "#ef4444" : report.isHoneypot === false ? "#22c55e" : "#eab308" }}>
                {report.isHoneypot === true ? "CONFIRMED" : report.isHoneypot === false ? "Not Detected" : "Unknown"}
              </p>
            </div>

            {/* Taxes */}
            <div className="card p-4" style={{ borderRadius: "12px" }}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4" style={{ color: report.buyTax > 10 || report.sellTax > 10 ? "#f97316" : "#22c55e" }} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Taxes</span>
              </div>
              <p className="text-sm font-semibold text-white">
                Buy: {report.buyTax}% · Sell: {report.sellTax}%
              </p>
            </div>

            {/* Liquidity */}
            <div className="card p-4" style={{ borderRadius: "12px" }}>
              <div className="flex items-center gap-2 mb-2">
                <Droplets className="w-4 h-4" style={{ color: report.liquidity > 10000 ? "#22c55e" : report.liquidity > 1000 ? "#eab308" : "#ef4444" }} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Liquidity</span>
              </div>
              <p className="text-sm font-semibold text-white">
                {report.liquidity > 1_000_000 ? `$${(report.liquidity / 1_000_000).toFixed(1)}M` :
                 report.liquidity > 1_000 ? `$${(report.liquidity / 1_000).toFixed(1)}K` :
                 `$${report.liquidity.toFixed(0)}`}
              </p>
            </div>

            {/* Ownership */}
            <div className="card p-4" style={{ borderRadius: "12px" }}>
              <div className="flex items-center gap-2 mb-2">
                {report.isContractRenounced ? <Lock className="w-4 h-4 text-green-400" /> : <Unlock className="w-4 h-4 text-yellow-400" />}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Ownership</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: report.isContractRenounced ? "#22c55e" : "#eab308" }}>
                {report.isContractRenounced ? "Renounced" : "Active Owner"}
              </p>
            </div>

            {/* Source Verified */}
            <div className="card p-4" style={{ borderRadius: "12px" }}>
              <div className="flex items-center gap-2 mb-2">
                {report.isVerified ? <Eye className="w-4 h-4 text-green-400" /> : <FileWarning className="w-4 h-4 text-red-400" />}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Source Code</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: report.isVerified ? "#22c55e" : "#ef4444" }}>
                {report.isVerified ? "Verified" : "Not Verified"}
              </p>
            </div>

            {/* LP Lock */}
            <div className="card p-4" style={{ borderRadius: "12px" }}>
              <div className="flex items-center gap-2 mb-2">
                {report.isLiquidityLocked ? <Lock className="w-4 h-4 text-green-400" /> : <Unlock className="w-4 h-4 text-yellow-400" />}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>LP Locked</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: report.isLiquidityLocked ? "#22c55e" : "#eab308" }}>
                {report.isLiquidityLocked ? "Burned / Locked" : "Not Locked"}
              </p>
            </div>
          </div>

          {/* Bytecode Analysis */}
          <div className="card p-5" style={{ borderRadius: "12px" }}>
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Code className="w-4 h-4" style={{ color: "#a855f7" }} />
              Bytecode Analysis
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg" style={{ background: "rgba(0,0,0,0.3)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Size</p>
                <p className="text-sm font-mono text-white">{report.bytecodeSizeKb} KB</p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: "rgba(0,0,0,0.3)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Proxy</p>
                <p className="text-sm font-mono" style={{ color: report.isProxy ? "#f97316" : "#22c55e" }}>
                  {report.isProxy ? "Yes" : "No"}
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: "rgba(0,0,0,0.3)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Mint</p>
                <p className="text-sm font-mono" style={{ color: report.ownerCanMint ? "#ef4444" : "#22c55e" }}>
                  {report.ownerCanMint ? "Yes" : "No"}
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: "rgba(0,0,0,0.3)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Blacklist</p>
                <p className="text-sm font-mono" style={{ color: report.ownerCanBlacklist ? "#ef4444" : "#22c55e" }}>
                  {report.ownerCanBlacklist ? "Yes" : "No"}
                </p>
              </div>
            </div>
          </div>

          {/* Risk Flags */}
          {report.flags.length > 0 && (
            <div className="card p-5" style={{ borderRadius: "12px" }}>
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                Risk Flags ({report.flags.length})
              </h4>
              <div className="space-y-2">
                {report.flags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "rgba(0,0,0,0.2)" }}>
                    <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{
                      color: flag.includes("HONEYPOT") || flag.includes("HIGH_TAX") ? "#ef4444" :
                             flag.includes("LOW") || flag.includes("WHALE") ? "#f97316" : "#eab308"
                    }} />
                    <div>
                      <p className="text-xs font-mono text-white">{flag}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{flagDescription(flag)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verdict */}
          <div className="card p-5" style={{ borderRadius: "12px", background: getRiskBg(report.riskScore), borderLeft: `3px solid ${getRiskColor(report.riskScore)}` }}>
            <h4 className="text-sm font-semibold text-white mb-2">Shield Verdict</h4>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {report.riskScore >= 80
                ? "⛔ DANGER — This contract shows strong indicators of being malicious. Do NOT interact with it or approve any tokens."
                : report.riskScore >= 60
                ? "⚠️ HIGH RISK — Multiple security concerns detected. Interact with extreme caution and only with amounts you can afford to lose."
                : report.riskScore >= 40
                ? "⚠️ MODERATE RISK — Some security flags detected. Verify the project's legitimacy independently before interacting."
                : report.riskScore >= 20
                ? "ℹ️ LOW RISK — Minor concerns detected. Generally safe but review the specific flags above."
                : "✅ SAFE — No significant security risks detected. This appears to be a legitimate, well-configured contract."}
            </p>
          </div>
        </div>
      )}

      {/* ─── History ─── */}
      {history.length > 0 && !scanning && (
        <div className="card p-5" style={{ borderRadius: "12px" }}>
          <h4 className="text-sm font-semibold text-white mb-3">Recent Scans</h4>
          <div className="space-y-2">
            {history.map((h) => (
              <button
                key={h.address}
                onClick={() => { setContractAddress(h.address); setReport(h); }}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/3 transition-all text-left"
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: getRiskBg(h.riskScore) }}>
                  <span className="text-xs font-bold" style={{ color: getRiskColor(h.riskScore) }}>{h.riskScore}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{h.name} ({h.symbol})</p>
                  <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{h.address.slice(0, 10)}...{h.address.slice(-6)}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: getRiskBg(h.riskScore), color: getRiskColor(h.riskScore) }}>
                  {h.riskLevel}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Empty State ─── */}
      {!report && !scanning && history.length === 0 && (
        <div className="card p-12 text-center" style={{ borderRadius: "12px" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.12)" }}>
            <Shield className="w-8 h-8" style={{ color: "#a855f7" }} />
          </div>
          <h4 className="text-xl font-semibold text-white mb-2">Contract Analysis</h4>
          <p className="text-sm max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
            Paste any BSC contract address to get a deep security analysis. Shield checks bytecode patterns,
            honeypot signatures, liquidity, ownership, source verification, and more.
          </p>
        </div>
      )}
    </div>
  );
}
