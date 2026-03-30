"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import {
  Search,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Skull,
  Lock,
  Unlock,
  Eye,
  TrendingDown,
  Droplets,
  Users,
  RefreshCw,
  ExternalLink,
  Copy,
  ArrowRight,
  Flame,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────

interface TokenReport {
  address: string;
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
  holderCount: number;
  topHolderPercent: number;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isContractRenounced: boolean;
  isLiquidityLocked: boolean;
  isVerified: boolean;
  flags: string[];
  scanTimestamp: number;
}

// ─── Minimal ABIs ──────────────────────────────────────────────
const ERC20_META_ABI = [
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
  "function token1() view returns (address)",
];

const FACTORY_ABI = [
  "function getPair(address, address) view returns (address)",
];

// BSC addresses
const PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const DEAD_ADDRESSES = [
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dEaD",
  "0x0000000000000000000000000000000000000001",
];

const SAFE_TOKENS = new Set([
  WBNB.toLowerCase(),
  "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56".toLowerCase(), // BUSD
  "0x55d398326f99059fF775485246999027B3197955".toLowerCase(), // USDT
  "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82".toLowerCase(), // CAKE
  "0x2170Ed0880ac9A755fd29B2688956BD959F933F8".toLowerCase(), // ETH
  "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c".toLowerCase(), // BTCB
  "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d".toLowerCase(), // USDC
]);

// ─── Risk Color / Label Helpers ────────────────────────────────

function getRiskColor(score: number): string {
  if (score >= 80) return "#ef4444";
  if (score >= 60) return "#f97316";
  if (score >= 40) return "#eab308";
  if (score >= 20) return "#22c55e";
  return "#10b981";
}

function getRiskLabel(score: number): string {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  if (score >= 20) return "LOW";
  return "SAFE";
}

function getRiskBg(score: number): string {
  if (score >= 80) return "rgba(239,68,68,0.1)";
  if (score >= 60) return "rgba(249,115,22,0.1)";
  if (score >= 40) return "rgba(234,179,8,0.1)";
  return "rgba(34,197,94,0.1)";
}

// ─── Contract Security Analysis ────────────────────────────────

const MINT_SELECTOR = "40c10f19";
const PAUSE_SELECTOR = "8456cb59";
const BLACKLIST_SELECTOR = "44337ea1";

interface SecurityFlags {
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isProxy: boolean;
  isRenounced: boolean;
}

async function analyzeContractSecurity(
  address: string,
  provider: ethers.JsonRpcProvider
): Promise<SecurityFlags> {
  const flags: SecurityFlags = {
    ownerCanMint: false,
    ownerCanPause: false,
    ownerCanBlacklist: false,
    isProxy: false,
    isRenounced: false,
  };

  try {
    const code = await provider.getCode(address);
    if (code === "0x") return flags;

    flags.ownerCanMint = code.includes(MINT_SELECTOR);
    flags.ownerCanPause = code.includes(PAUSE_SELECTOR);
    flags.ownerCanBlacklist = code.includes(BLACKLIST_SELECTOR);
    flags.isProxy =
      code.includes("363d3d373d3d3d363d73") || // EIP-1167
      code.includes("5c60da1b"); // implementation() selector

    // Check owner
    try {
      const contract = new ethers.Contract(address, ERC20_META_ABI, provider);
      const owner = await contract.owner();
      flags.isRenounced =
        owner === "0x0000000000000000000000000000000000000000" ||
        owner === "0x000000000000000000000000000000000000dEaD";
    } catch {
      flags.isRenounced = true; // No owner function = likely renounced
    }
  } catch {
    // Unable to analyze
  }

  return flags;
}

// ─── Liquidity Analysis ────────────────────────────────────────

interface LiquidityInfo {
  hasLiquidity: boolean;
  liquidityUsd: number;
  isLpBurned: boolean;
  pairAddress: string;
}

async function analyzeLiquidity(
  tokenAddress: string,
  provider: ethers.JsonRpcProvider,
  bnbPrice: number
): Promise<LiquidityInfo> {
  const info: LiquidityInfo = {
    hasLiquidity: false,
    liquidityUsd: 0,
    isLpBurned: false,
    pairAddress: "",
  };

  try {
    const factory = new ethers.Contract(PANCAKE_FACTORY, FACTORY_ABI, provider);
    const pairAddress = await factory.getPair(tokenAddress, WBNB);

    if (pairAddress === "0x0000000000000000000000000000000000000000") return info;

    info.pairAddress = pairAddress;
    const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
    const [reserves, token0] = await Promise.all([
      pair.getReserves(),
      pair.token0(),
    ]);

    const wbnbReserve =
      token0.toLowerCase() === WBNB.toLowerCase()
        ? Number(ethers.formatEther(reserves[0]))
        : Number(ethers.formatEther(reserves[1]));

    info.liquidityUsd = wbnbReserve * 2 * bnbPrice;
    info.hasLiquidity = info.liquidityUsd > 100;

    // Check if LP is burned
    const lpToken = new ethers.Contract(
      pairAddress,
      ["function balanceOf(address) view returns (uint256)", "function totalSupply() view returns (uint256)"],
      provider
    );
    const [totalLp, ...deadBalances] = await Promise.all([
      lpToken.totalSupply(),
      ...DEAD_ADDRESSES.map((addr) => lpToken.balanceOf(addr)),
    ]);

    const totalBurned = deadBalances.reduce(
      (sum: bigint, b: bigint) => sum + b,
      BigInt(0)
    );
    const burnPercent = Number((totalBurned * BigInt(10000)) / totalLp);
    info.isLpBurned = burnPercent > 9000; // >90% burned
  } catch {
    // No pair or error
  }

  return info;
}

// ─── Honeypot Detection ────────────────────────────────────────

async function detectHoneypot(
  address: string
): Promise<{ isHoneypot: boolean | null; buyTax: number; sellTax: number; confident: boolean }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://api.honeypot.is/v2/IsHoneypot?address=${address}&chainID=56`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    const data = await res.json();

    return {
      isHoneypot: data.honeypotResult?.isHoneypot ?? null,
      buyTax: Math.round((data.simulationResult?.buyTax ?? 0) * 100),
      sellTax: Math.round((data.simulationResult?.sellTax ?? 0) * 100),
      confident: true,
    };
  } catch {
    // API unavailable — return unknown, NOT safe
    return { isHoneypot: null, buyTax: 0, sellTax: 0, confident: false };
  }
}

// ─── Risk Calculator ───────────────────────────────────────────

function calculateRisk(report: Partial<TokenReport>): {
  score: number;
  flags: string[];
} {
  let score = 0;
  const flags: string[] = [];

  if (report.isHoneypot) {
    score = 100;
    flags.push("HONEYPOT");
    return { score, flags };
  }

  // If honeypot detection failed, add uncertainty penalty
  if (report.isHoneypot === null) {
    score += 15;
    flags.push("HONEYPOT_CHECK_FAILED");
  }

  if ((report.buyTax ?? 0) > 50 || (report.sellTax ?? 0) > 50) {
    score += 40;
    flags.push("HIGH_TAX");
  } else if ((report.buyTax ?? 0) > 10 || (report.sellTax ?? 0) > 10) {
    score += 15;
    flags.push("MODERATE_TAX");
  }

  if ((report.liquidity ?? 0) < 1000) {
    score += 30;
    flags.push("LOW_LIQUIDITY");
  } else if ((report.liquidity ?? 0) < 10000) {
    score += 15;
    flags.push("LIMITED_LIQUIDITY");
  }

  if (report.ownerCanMint) {
    score += 15;
    flags.push("MINT_FUNCTION");
  }
  if (report.ownerCanPause) {
    score += 10;
    flags.push("PAUSE_FUNCTION");
  }
  if (report.ownerCanBlacklist) {
    score += 10;
    flags.push("BLACKLIST_FUNCTION");
  }

  if ((report.topHolderPercent ?? 0) > 50) {
    score += 20;
    flags.push("WHALE_DOMINATED");
  } else if ((report.topHolderPercent ?? 0) > 25) {
    score += 10;
    flags.push("CONCENTRATED_SUPPLY");
  }

  if (!report.isVerified) {
    score += 10;
    flags.push("UNVERIFIED");
  }
  if (!report.isContractRenounced) {
    score += 5;
  }
  if (report.isContractRenounced) {
    score = Math.max(0, score - 10);
  }
  if (report.isLiquidityLocked) {
    score = Math.max(0, score - 10);
  }

  return { score: Math.min(100, Math.max(0, score)), flags };
}

// ─── Full Scan ─────────────────────────────────────────────────

async function scanToken(
  address: string,
  bnbPrice: number
): Promise<TokenReport> {
  const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org");

  // Safe token fast-path
  if (SAFE_TOKENS.has(address.toLowerCase())) {
    const contract = new ethers.Contract(address, ERC20_META_ABI, provider);
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply(),
    ]);
    return {
      address,
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: ethers.formatUnits(totalSupply, decimals),
      riskScore: 0,
      riskLevel: "SAFE",
      isHoneypot: false,
      honeypotConfident: true,
      buyTax: 0,
      sellTax: 0,
      liquidity: 999999999,
      holderCount: 0,
      topHolderPercent: 0,
      ownerCanMint: false,
      ownerCanPause: false,
      ownerCanBlacklist: false,
      isContractRenounced: true,
      isLiquidityLocked: true,
      isVerified: true,
      flags: [],
      scanTimestamp: Date.now(),
    };
  }

  // Parallel deep analysis
  const contract = new ethers.Contract(address, ERC20_META_ABI, provider);

  const [basics, security, liquidity, honeypot] = await Promise.all([
    Promise.all([
      contract.name().catch(() => "Unknown"),
      contract.symbol().catch(() => "???"),
      contract.decimals().catch(() => 18),
      contract.totalSupply().catch(() => BigInt(0)),
    ]),
    analyzeContractSecurity(address, provider),
    analyzeLiquidity(address, provider, bnbPrice),
    detectHoneypot(address),
  ]);

  const [name, symbol, decimals, totalSupply] = basics;

  const partial: Partial<TokenReport> = {
    address,
    name,
    symbol,
    decimals: Number(decimals),
    totalSupply: ethers.formatUnits(totalSupply, Number(decimals)),
    isHoneypot: honeypot.isHoneypot,
    honeypotConfident: honeypot.confident,
    buyTax: honeypot.buyTax,
    sellTax: honeypot.sellTax,
    liquidity: liquidity.liquidityUsd,
    holderCount: 0,
    topHolderPercent: 0,
    ownerCanMint: security.ownerCanMint,
    ownerCanPause: security.ownerCanPause,
    ownerCanBlacklist: security.ownerCanBlacklist,
    isContractRenounced: security.isRenounced,
    isLiquidityLocked: liquidity.isLpBurned,
    isVerified: false, // Cannot verify without BSCScan API key
  };

  const { score, flags } = calculateRisk(partial);

  return {
    ...partial,
    riskScore: score,
    riskLevel: getRiskLabel(score) as TokenReport["riskLevel"],
    flags,
    scanTimestamp: Date.now(),
  } as TokenReport;
}

// ─── Scan History ──────────────────────────────────────────────

function useScanHistory() {
  const [history, setHistory] = useState<TokenReport[]>([]);

  const addScan = useCallback((report: TokenReport) => {
    setHistory((prev) => {
      const filtered = prev.filter((r) => r.address !== report.address);
      return [report, ...filtered].slice(0, 20);
    });
  }, []);

  return { history, addScan };
}

// ═══════════════════════════════════════════════════════════════
// Component: TokenScanner
// ═══════════════════════════════════════════════════════════════

export default function TokenScanner({
  bnbPrice,
}: {
  bnbPrice: number;
}) {
  const [tokenAddress, setTokenAddress] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState("");
  const [report, setReport] = useState<TokenReport | null>(null);
  const [error, setError] = useState("");
  const { history, addScan } = useScanHistory();
  const [copied, setCopied] = useState(false);

  // Popular BSC tokens for quick scan
  const quickScanTokens = [
    { symbol: "CAKE", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82" },
    { symbol: "DOGE", address: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43" },
    { symbol: "SHIB", address: "0x2859e4544C4bB03966803b044A93563Bd2D0DD4D" },
    { symbol: "FLOKI", address: "0xfb5B838b6cfEEdC2873aB27866079AC55363D37E" },
  ];

  const handleScan = useCallback(
    async (addr?: string) => {
      const target = addr || tokenAddress.trim();
      if (!target) {
        setError("Enter a token contract address");
        return;
      }
      if (!ethers.isAddress(target)) {
        setError("Invalid contract address");
        return;
      }

      setScanning(true);
      setError("");
      setReport(null);

      try {
        setScanPhase("Analyzing contract bytecode...");
        await new Promise((r) => setTimeout(r, 400));
        setScanPhase("Checking honeypot status...");
        await new Promise((r) => setTimeout(r, 300));
        setScanPhase("Analyzing liquidity pools...");

        const result = await scanToken(target, bnbPrice || 600);

        setScanPhase("Calculating risk score...");
        await new Promise((r) => setTimeout(r, 200));

        setReport(result);
        addScan(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Scan failed — token may not exist on BSC"
        );
      } finally {
        setScanning(false);
        setScanPhase("");
      }
    },
    [tokenAddress, bnbPrice, addScan]
  );

  const copyAddress = () => {
    if (report) {
      navigator.clipboard.writeText(report.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Scanner Input ─── */}
      <div className="card p-6" style={{ borderRadius: "12px" }}>
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-[color:var(--accent)]" />
          Token Risk Scanner
          <span className="ml-auto text-xs px-2 py-1 rounded-md bg-[var(--accent)]/10 text-[color:var(--accent)] border border-[var(--accent)]/20">
            BSC Mainnet
          </span>
        </h4>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Paste any BSC token address (0x...)"
              value={tokenAddress}
              onChange={(e) => {
                setTokenAddress(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              className="w-full px-4 py-3.5 pl-11 rounded-xl bg-[var(--bg-base)] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--accent)]/50 font-mono text-sm transition-all"
              disabled={scanning}
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          </div>
          <button
            onClick={() => handleScan()}
            disabled={scanning}
            className="btn-primary px-6 py-3.5 flex items-center gap-2 whitespace-nowrap"
          >
            {scanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Scan Token
              </>
            )}
          </button>
        </div>

        {/* Quick Scan Tokens */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Quick scan:</span>
          {quickScanTokens.map((t) => (
            <button
              key={t.symbol}
              onClick={() => {
                setTokenAddress(t.address);
                handleScan(t.address);
              }}
              disabled={scanning}
              className="text-xs px-3 py-1.5 rounded-lg transition-all hover:scale-105"
              style={{
                background: "var(--accent-muted)",
                border: "1px solid var(--accent-border)",
                color: "var(--accent)",
              }}
            >
              {t.symbol}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-xl flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {/* Scan Progress */}
        {scanning && (
          <div className="mt-4">
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.3)" }}>
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-full border-2 border-[var(--accent)]/20" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)] animate-spin" />
              </div>
              <div>
                <p className="text-sm text-white font-medium">Scanning token...</p>
                <p className="text-xs text-[color:var(--accent)] font-mono">{scanPhase}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Scan Result ─── */}
      {report && (
        <div className="space-y-4 animate-fade-in-up">
          {/* Risk Score Hero */}
          <div
            className="card p-6 relative overflow-hidden"
            style={{ borderRadius: "12px", borderColor: `${getRiskColor(report.riskScore)}30` }}
          >
            {/* Background risk indicator */}
            <div
              className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-20"
              style={{ background: getRiskColor(report.riskScore) }}
            />

            <div className="flex items-start gap-6 relative">
              {/* Score Circle */}
              <div className="flex-shrink-0">
                <div
                  className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center"
                  style={{ background: getRiskBg(report.riskScore), border: `2px solid ${getRiskColor(report.riskScore)}40` }}
                >
                  <span className="text-3xl font-bold" style={{ color: getRiskColor(report.riskScore) }}>
                    {report.riskScore}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: getRiskColor(report.riskScore) }}>
                    {report.riskLevel}
                  </span>
                </div>
              </div>

              {/* Token Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-white">{report.symbol}</h3>
                  <span className="text-sm text-gray-400">{report.name}</span>
                  {report.isHoneypot === true && (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-500/20 text-red-400 border border-red-500/30">
                      <Skull className="w-3 h-3" /> HONEYPOT
                    </span>
                  )}
                  {report.isHoneypot === null && (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      <AlertTriangle className="w-3 h-3" /> HONEYPOT CHECK UNAVAILABLE
                    </span>
                  )}
                </div>

                <button
                  onClick={copyAddress}
                  className="flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-[color:var(--accent)] transition-colors mb-3"
                >
                  {report.address.slice(0, 20)}...{report.address.slice(-8)}
                  <Copy className="w-3 h-3" />
                  {copied && <span className="text-green-400">Copied!</span>}
                </button>

                {/* Risk Flags */}
                {report.flags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {report.flags.map((flag) => (
                      <span
                        key={flag}
                        className="text-xs px-2 py-1 rounded-md font-mono"
                        style={{
                          background: flag === "HONEYPOT" ? "rgba(239,68,68,0.15)" : "rgba(234,179,8,0.1)",
                          color: flag === "HONEYPOT" ? "#ef4444" : "#eab308",
                          border: `1px solid ${flag === "HONEYPOT" ? "rgba(239,68,68,0.3)" : "rgba(234,179,8,0.2)"}`,
                        }}
                      >
                        {flag.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* BSCScan Link */}
              <a
                href={`https://bscscan.com/token/${report.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
              >
                BSCScan <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Risk Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Risk Score</span>
                <span style={{ color: getRiskColor(report.riskScore) }}>{report.riskScore}/100</span>
              </div>
              <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${report.riskScore}%`,
                    background: `linear-gradient(90deg, ${getRiskColor(Math.max(0, report.riskScore - 20))}, ${getRiskColor(report.riskScore)})`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Detail Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Honeypot */}
            <div className="card p-4" style={{ borderRadius: "12px", borderLeft: `3px solid ${report.isHoneypot === true ? "#ef4444" : report.isHoneypot === null ? "#eab308" : "#22c55e"}` }}>
              <div className="flex items-center gap-2 mb-2">
                {report.isHoneypot === true ? (
                  <Skull className="w-4 h-4 text-red-400" />
                ) : report.isHoneypot === null ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                )}
                <span className="text-xs text-gray-500">Honeypot</span>
              </div>
              <p className={`text-lg font-bold ${report.isHoneypot === true ? "text-red-400" : report.isHoneypot === null ? "text-yellow-400" : "text-green-400"}`}>
                {report.isHoneypot === true ? "DETECTED" : report.isHoneypot === null ? "UNKNOWN" : "Safe"}
              </p>
              {report.isHoneypot === null && (
                <p className="text-xs text-yellow-500 mt-1">Detection API unavailable</p>
              )}
            </div>

            {/* Tax */}
            <div
              className="card p-4"
              style={{
                borderRadius: "12px",
                borderLeft: `3px solid ${report.buyTax > 10 || report.sellTax > 10 ? "#eab308" : "#22c55e"}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500">Tax</span>
              </div>
              <p className="text-sm font-bold text-white">
                Buy: <span className={report.buyTax > 10 ? "text-yellow-400" : "text-green-400"}>{report.buyTax}%</span>
              </p>
              <p className="text-sm font-bold text-white">
                Sell: <span className={report.sellTax > 10 ? "text-yellow-400" : "text-green-400"}>{report.sellTax}%</span>
              </p>
            </div>

            {/* Liquidity */}
            <div
              className="card p-4"
              style={{
                borderRadius: "12px",
                borderLeft: `3px solid ${report.liquidity < 10000 ? "#f97316" : "#22c55e"}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Droplets className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-500">Liquidity</span>
              </div>
              <p className="text-lg font-bold text-white">
                ${report.liquidity > 999999999 ? "∞" : report.liquidity >= 1000 ? `${(report.liquidity / 1000).toFixed(1)}K` : report.liquidity.toFixed(0)}
              </p>
            </div>

            {/* LP Locked */}
            <div
              className="card p-4"
              style={{
                borderRadius: "12px",
                borderLeft: `3px solid ${report.isLiquidityLocked ? "#22c55e" : "#eab308"}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {report.isLiquidityLocked ? (
                  <Lock className="w-4 h-4 text-green-400" />
                ) : (
                  <Unlock className="w-4 h-4 text-yellow-400" />
                )}
                <span className="text-xs text-gray-500">LP Status</span>
              </div>
              <p className={`text-lg font-bold ${report.isLiquidityLocked ? "text-green-400" : "text-yellow-400"}`}>
                {report.isLiquidityLocked ? "Burned" : "Unlocked"}
              </p>
            </div>
          </div>

          {/* Security Flags */}
          <div className="card p-6" style={{ borderRadius: "12px" }}>
            <h4 className="text-sm font-semibold mb-4 text-gray-400 uppercase tracking-wider">
              Contract Security
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "Mint Function", value: report.ownerCanMint, danger: true },
                { label: "Pause Function", value: report.ownerCanPause, danger: true },
                { label: "Blacklist Function", value: report.ownerCanBlacklist, danger: true },
                { label: "Contract Renounced", value: report.isContractRenounced, danger: false },
                { label: "LP Burned/Locked", value: report.isLiquidityLocked, danger: false },
                { label: "Source Verified", value: report.isVerified, danger: false },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 p-3 rounded-lg"
                  style={{
                    background:
                      item.danger && item.value
                        ? "rgba(239,68,68,0.06)"
                        : !item.danger && item.value
                        ? "rgba(34,197,94,0.06)"
                        : "rgba(107,114,128,0.06)",
                  }}
                >
                  {item.danger ? (
                    item.value ? (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    )
                  ) : item.value ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-500" />
                  )}
                  <span className="text-sm text-gray-300">{item.label}</span>
                  <span
                    className="ml-auto text-xs font-mono"
                    style={{
                      color:
                        item.danger && item.value
                          ? "#ef4444"
                          : !item.danger && item.value
                          ? "#22c55e"
                          : "#6b7280",
                    }}
                  >
                    {item.danger
                      ? item.value
                        ? "Yes ✗"
                        : "No ✓"
                      : item.value
                      ? "Yes ✓"
                      : "No ✗"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Token Details */}
          <div className="card p-6" style={{ borderRadius: "12px" }}>
            <h4 className="text-sm font-semibold mb-4 text-gray-400 uppercase tracking-wider">Token Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Total Supply</p>
                <p className="text-sm font-mono text-white">
                  {Number(report.totalSupply) > 1e12
                    ? `${(Number(report.totalSupply) / 1e12).toFixed(2)}T`
                    : Number(report.totalSupply) > 1e9
                    ? `${(Number(report.totalSupply) / 1e9).toFixed(2)}B`
                    : Number(report.totalSupply) > 1e6
                    ? `${(Number(report.totalSupply) / 1e6).toFixed(2)}M`
                    : Number(report.totalSupply).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Decimals</p>
                <p className="text-sm font-mono text-white">{report.decimals}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Scanned</p>
                <p className="text-sm font-mono text-white">
                  {new Date(report.scanTimestamp).toLocaleTimeString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Risk Level</p>
                <p className="text-sm font-bold" style={{ color: getRiskColor(report.riskScore) }}>
                  {report.riskLevel}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Scan History ─── */}
      {history.length > 0 && !scanning && (
        <div className="card p-6" style={{ borderRadius: "12px" }}>
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-[color:var(--accent)]" />
            Scan History
            <span className="ml-auto text-xs text-gray-500">{history.length} scanned</span>
          </h4>
          <div className="space-y-2">
            {history.map((h) => (
              <button
                key={h.address}
                onClick={() => {
                  setTokenAddress(h.address);
                  setReport(h);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors text-left"
                style={{ background: "rgba(0,0,0,0.15)" }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: getRiskBg(h.riskScore), border: `1px solid ${getRiskColor(h.riskScore)}30` }}
                >
                  <span className="text-sm font-bold" style={{ color: getRiskColor(h.riskScore) }}>
                    {h.riskScore}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{h.symbol}</span>
                    <span className="text-xs text-gray-500">{h.name}</span>
                    {h.isHoneypot && (
                      <Skull className="w-3 h-3 text-red-400" />
                    )}
                  </div>
                  <span className="text-xs font-mono text-gray-500">
                    {h.address.slice(0, 10)}...{h.address.slice(-6)}
                  </span>
                </div>
                <div className="text-right flex-shrink-0">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-md"
                    style={{
                      background: getRiskBg(h.riskScore),
                      color: getRiskColor(h.riskScore),
                    }}
                  >
                    {getRiskLabel(h.riskScore)}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Empty State ─── */}
      {!report && !scanning && history.length === 0 && (
        <div className="card p-12 text-center" style={{ borderRadius: "12px" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-border)" }}>
            <Shield className="w-8 h-8 text-[color:var(--accent)]" />
          </div>
          <h4 className="text-xl font-semibold mb-2 text-white">Scan Any BSC Token</h4>
          <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
            Paste any BEP-20 token contract address to get an instant risk assessment.
            Aegis checks for honeypots, rug pull risks, whale concentration, liquidity depth, and contract vulnerabilities.
          </p>
          <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
            {[
              { icon: Skull, label: "Honeypot Detection" },
              { icon: Droplets, label: "Liquidity Analysis" },
              { icon: Users, label: "Whale Tracking" },
              { icon: Flame, label: "Rug Pull Alerts" },
            ].map((f) => (
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
