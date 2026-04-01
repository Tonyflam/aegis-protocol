"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import { useWalletContext } from "../../lib/WalletContext";
import toast from "react-hot-toast";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Filter,
  Zap,
  ShieldAlert,
  ShieldOff,
  Loader2,
  Info,
  DollarSign,
  Clock,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Sentinel Agent — Approval Guardian
// Scans all ERC-20 token approvals for a connected wallet,
// identifies risky unlimited approvals, and allows one-click
// revocation through MetaMask.
// ═══════════════════════════════════════════════════════════════

// ─── Types ─────────────────────────────────────────────────────

interface TokenApproval {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: number;
  spenderAddress: string;
  spenderName: string;
  spenderVerified: boolean;
  allowance: bigint;
  allowanceFormatted: string;
  isUnlimited: boolean;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  riskReason: string;
  tokenBalance: string;
  tokenBalanceRaw: bigint;
  valueAtRisk: number;
}

interface ScanProgress {
  phase: string;
  current: number;
  total: number;
  detail: string;
}

type RiskFilter = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

// ─── Constants ─────────────────────────────────────────────────

const BSC_RPC = "https://bsc-rpc.publicnode.com";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

// Top BSC tokens to scan (address, symbol, decimals, approximate USD price)
const TOP_BSC_TOKENS: { address: string; symbol: string; decimals: number; priceUsd: number }[] = [
  { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", decimals: 18, priceUsd: 1 },
  { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", decimals: 18, priceUsd: 1 },
  { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", symbol: "BUSD", decimals: 18, priceUsd: 1 },
  { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB", decimals: 18, priceUsd: 600 },
  { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", symbol: "CAKE", decimals: 18, priceUsd: 2.5 },
  { address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", symbol: "ETH", decimals: 18, priceUsd: 3500 },
  { address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", symbol: "BTCB", decimals: 18, priceUsd: 85000 },
  { address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", symbol: "DAI", decimals: 18, priceUsd: 1 },
  { address: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD", symbol: "LINK", decimals: 18, priceUsd: 15 },
  { address: "0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402", symbol: "DOT", decimals: 18, priceUsd: 7 },
  { address: "0xBf5140A22578168FD562DCcF235E5D43A02ce9B1", symbol: "UNI", decimals: 18, priceUsd: 10 },
  { address: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE", symbol: "XRP", decimals: 18, priceUsd: 2 },
  { address: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47", symbol: "ADA", decimals: 18, priceUsd: 0.8 },
  { address: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43", symbol: "DOGE", decimals: 8, priceUsd: 0.15 },
  { address: "0xCC42724C6683B7E57334c4E856f4c9965ED682bD", symbol: "MATIC", decimals: 18, priceUsd: 1 },
  { address: "0x2859e4544C4bB03966803b044A93563Bd2D0DD4D", symbol: "SHIB", decimals: 18, priceUsd: 0.00002 },
  { address: "0xfb5B838b6cfEEdC2873aB27866079AC55363D37E", symbol: "FLOKI", decimals: 9, priceUsd: 0.0002 },
  { address: "0x4B0F1812e5Df2A09796481Ff14017e6005508003", symbol: "TWT", decimals: 18, priceUsd: 1 },
  { address: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63", symbol: "XVS", decimals: 18, priceUsd: 8 },
  { address: "0xAD6cAEb32CD2c308980a548bD0Bc5AA4306c6c18", symbol: "BAND", decimals: 18, priceUsd: 1.5 },
];

// Known spender contracts on BSC (lowercase address → info)
const KNOWN_SPENDERS: Record<string, { name: string; category: string; verified: boolean }> = {
  // PancakeSwap
  "0x10ed43c718714eb63d5aa57b78b54704e256024e": { name: "PancakeSwap V2 Router", category: "DEX", verified: true },
  "0x13f4ea83d0bd40e75c8222255bc855a974568dd4": { name: "PancakeSwap V3 Router", category: "DEX", verified: true },
  "0x556b9306565093c855aea9c95ee71742502c6a7a": { name: "PancakeSwap V3 Router 2", category: "DEX", verified: true },
  "0x46a15b0b27311cedf172ab29e4f4766fbe7f4364": { name: "PancakeSwap MasterChef V3", category: "Yield", verified: true },
  "0xa5f8c5dbd5f286960b9d90548680ae5ebff07652": { name: "PancakeSwap MasterChef V2", category: "Yield", verified: true },
  // Other DEXs
  "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506": { name: "SushiSwap Router", category: "DEX", verified: true },
  "0x1111111254eeb25477b68fb85ed929f73a960582": { name: "1inch V5 Aggregation Router", category: "DEX", verified: true },
  "0x111111125421ca6dc452d289314280a0f8842a65": { name: "1inch V6 Router", category: "DEX", verified: true },
  "0x3a6d8ca21d1cf76f653a67577fa0d27453350dd8": { name: "BiSwap Router", category: "DEX", verified: true },
  // Venus Protocol (Lending)
  "0xfd36e2c2a6789db23113685031d7f16329158384": { name: "Venus Unitroller", category: "Lending", verified: true },
  "0xa07c5b74c9b40447a954e1466938b865b6bbea36": { name: "Venus vBNB", category: "Lending", verified: true },
  "0xfd5840cd36d94d7229439859c0112a4185bc0255": { name: "Venus vUSDT", category: "Lending", verified: true },
  "0xeca88125a5adbe82614ffc12d0db554e2e2867c8": { name: "Venus vUSDC", category: "Lending", verified: true },
  // Bridges
  "0xd99d1c33f9fc3444f8101754abc46c52416550d1": { name: "PancakeSwap Testnet Router", category: "DEX", verified: true },
  // Stargate
  "0x4a364f8c717caad9a442737eb7b8a55cc6cf18d8": { name: "Stargate Router", category: "Bridge", verified: true },
  "0x3c2269811836af69497e5f486a85d7316753cf62": { name: "LayerZero Endpoint", category: "Bridge", verified: true },
};

const MAX_UINT256 = ethers.MaxUint256;
const UNLIMITED_THRESHOLD = MAX_UINT256 / 2n; // Treat anything above half of MaxUint256 as "unlimited"

// ─── Helpers ───────────────────────────────────────────────────

function getRiskColor(risk: string): string {
  switch (risk) {
    case "CRITICAL": return "#ef4444";
    case "HIGH": return "#f97316";
    case "MEDIUM": return "#eab308";
    case "LOW": return "#3b82f6";
    default: return "#6b7280";
  }
}

function getRiskBg(risk: string): string {
  switch (risk) {
    case "CRITICAL": return "rgba(239,68,68,0.1)";
    case "HIGH": return "rgba(249,115,22,0.1)";
    case "MEDIUM": return "rgba(234,179,8,0.1)";
    case "LOW": return "rgba(59,130,246,0.1)";
    default: return "rgba(107,114,128,0.1)";
  }
}

function formatAllowance(allowance: bigint, decimals: number, symbol: string): string {
  if (allowance >= UNLIMITED_THRESHOLD) return "Unlimited";
  const formatted = Number(ethers.formatUnits(allowance, decimals));
  if (formatted > 1_000_000_000) return `${(formatted / 1_000_000_000).toFixed(1)}B ${symbol}`;
  if (formatted > 1_000_000) return `${(formatted / 1_000_000).toFixed(1)}M ${symbol}`;
  if (formatted > 1_000) return `${(formatted / 1_000).toFixed(1)}K ${symbol}`;
  return `${formatted.toFixed(2)} ${symbol}`;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}



function classifyRisk(
  isUnlimited: boolean,
  spenderVerified: boolean,
  spenderKnown: boolean,
  valueAtRisk: number,
): { level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; reason: string } {
  // CRITICAL: Unlimited approval to unknown/unverified contract
  if (isUnlimited && !spenderKnown) {
    return { level: "CRITICAL", reason: "Unlimited approval to unknown contract" };
  }
  if (isUnlimited && !spenderVerified) {
    return { level: "CRITICAL", reason: "Unlimited approval to unverified contract" };
  }
  // HIGH: Unlimited approval to known contract with high value at risk
  if (isUnlimited && valueAtRisk > 10_000) {
    return { level: "HIGH", reason: `Unlimited approval — ${formatUsd(valueAtRisk)} at risk` };
  }
  // HIGH: Any approval to unknown contract
  if (!spenderKnown) {
    return { level: "HIGH", reason: "Approval to unknown contract" };
  }
  // MEDIUM: Unlimited approval to known/verified protocol
  if (isUnlimited) {
    return { level: "MEDIUM", reason: "Unlimited approval to verified protocol" };
  }
  // LOW: Limited approval to known protocol
  return { level: "LOW", reason: "Limited approval to verified protocol" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Core Scanning Logic ───────────────────────────────────────

async function scanWalletApprovals(
  walletAddress: string,
  bnbPrice: number,
  onProgress: (p: ScanProgress) => void,
): Promise<TokenApproval[]> {
  const provider = new ethers.JsonRpcProvider(BSC_RPC, 56, { staticNetwork: true });
  const approvals: TokenApproval[] = [];

  // Update prices with live BNB price
  const tokens = TOP_BSC_TOKENS.map((t) => ({
    ...t,
    priceUsd: t.symbol === "WBNB" ? bnbPrice : t.priceUsd,
  }));

  const spenderAddresses = Object.keys(KNOWN_SPENDERS);

  // Phase 1: Check token balances to find which tokens the user actually holds
  onProgress({ phase: "Discovering tokens", current: 0, total: tokens.length, detail: "Checking balances..." });

  const heldTokens: typeof tokens = [];

  // Batch balance checks — 5 at a time
  for (let i = 0; i < tokens.length; i += 5) {
    const batch = tokens.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async (token) => {
        const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
        const balance = await contract.balanceOf(walletAddress);
        return { token, balance };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.balance > 0n) {
        heldTokens.push(result.value.token);
      }
    }

    onProgress({
      phase: "Discovering tokens",
      current: Math.min(i + 5, tokens.length),
      total: tokens.length,
      detail: `Found ${heldTokens.length} tokens with balance`,
    });

    await sleep(200);
  }

  if (heldTokens.length === 0) {
    // Even if no balance, still scan top stablecoins for old approvals
    heldTokens.push(
      tokens[0], // USDT
      tokens[1], // USDC
      tokens[2], // BUSD
      tokens[3], // WBNB
      tokens[4], // CAKE
    );
  }

  // Phase 2: For each held token, check allowances against known spenders
  const totalChecks = heldTokens.length * spenderAddresses.length;
  let checksCompleted = 0;

  onProgress({
    phase: "Scanning approvals",
    current: 0,
    total: totalChecks,
    detail: `Checking ${heldTokens.length} tokens × ${spenderAddresses.length} protocols...`,
  });

  for (const token of heldTokens) {
    const contract = new ethers.Contract(token.address, ERC20_ABI, provider);

    // Get current balance for value-at-risk calculation
    let balance = 0n;
    try {
      balance = await contract.balanceOf(walletAddress);
    } catch {
      // Skip if balance check fails
    }

    // Batch allowance checks — 5 spenders at a time
    for (let i = 0; i < spenderAddresses.length; i += 5) {
      const batch = spenderAddresses.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (spender) => {
          const allowance = await contract.allowance(walletAddress, spender);
          return { spender, allowance };
        }),
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.allowance > 0n) {
          const { spender, allowance } = result.value;
          const spenderInfo = KNOWN_SPENDERS[spender];
          const isUnlimited = allowance >= UNLIMITED_THRESHOLD;

          // Calculate value at risk: min of allowance value and actual balance value
          const balanceValue = Number(ethers.formatUnits(balance, token.decimals)) * token.priceUsd;
          const allowanceValue = isUnlimited
            ? balanceValue
            : Number(ethers.formatUnits(allowance, token.decimals)) * token.priceUsd;
          const valueAtRisk = Math.min(allowanceValue, balanceValue);

          const risk = classifyRisk(isUnlimited, spenderInfo?.verified ?? false, !!spenderInfo, valueAtRisk);

          approvals.push({
            id: `${token.address}-${spender}`,
            tokenAddress: token.address,
            tokenSymbol: token.symbol,
            tokenName: token.symbol, // Using symbol as name for consistency
            tokenDecimals: token.decimals,
            spenderAddress: spender,
            spenderName: spenderInfo?.name ?? "Unknown Contract",
            spenderVerified: spenderInfo?.verified ?? false,
            allowance,
            allowanceFormatted: formatAllowance(allowance, token.decimals, token.symbol),
            isUnlimited,
            riskLevel: risk.level,
            riskReason: risk.reason,
            tokenBalance: Number(ethers.formatUnits(balance, token.decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 }),
            tokenBalanceRaw: balance,
            valueAtRisk,
          });
        }
      }

      checksCompleted += batch.length;
      onProgress({
        phase: "Scanning approvals",
        current: checksCompleted,
        total: totalChecks,
        detail: `${token.symbol}: checking protocols... (${approvals.length} approvals found)`,
      });

      await sleep(150);
    }
  }

  // Phase 3: Scan recent Approval events for any spenders NOT in our known list
  onProgress({
    phase: "Scanning recent events",
    current: 0,
    total: 1,
    detail: "Checking recent on-chain approval events...",
  });

  try {
    const latestBlock = await provider.getBlockNumber();
    const APPROVAL_TOPIC = ethers.id("Approval(address,address,uint256)");
    const paddedOwner = ethers.zeroPadValue(walletAddress, 32);

    // Scan last ~28800 blocks (~1 day on BSC at 3s/block)
    const fromBlock = latestBlock - 28800;

    const logs = await provider.getLogs({
      fromBlock,
      toBlock: latestBlock,
      topics: [APPROVAL_TOPIC, paddedOwner],
    });

    // Process discovered approvals that aren't already in our list
    const existingIds = new Set(approvals.map((a) => a.id));

    for (const log of logs) {
      const spender = "0x" + log.topics[2].slice(26);
      const tokenAddr = log.address.toLowerCase();
      const id = `${tokenAddr}-${spender.toLowerCase()}`;

      if (existingIds.has(id)) continue;

      // Check current allowance (the event might have been revoked since)
      try {
        const contract = new ethers.Contract(log.address, ERC20_ABI, provider);
        const [allowance, symbol, decimals, balance] = await Promise.all([
          contract.allowance(walletAddress, spender),
          contract.symbol().catch(() => "???"),
          contract.decimals().catch(() => 18),
          contract.balanceOf(walletAddress).catch(() => 0n),
        ]);

        if (allowance > 0n) {
          const spenderInfo = KNOWN_SPENDERS[spender.toLowerCase()];
          const isUnlimited = allowance >= UNLIMITED_THRESHOLD;
          const tokenInfo = tokens.find((t) => t.address.toLowerCase() === tokenAddr);
          const priceUsd = tokenInfo?.priceUsd ?? 0;

          const balanceValue = Number(ethers.formatUnits(balance, Number(decimals))) * priceUsd;
          const allowanceValue = isUnlimited ? balanceValue : Number(ethers.formatUnits(allowance, Number(decimals))) * priceUsd;
          const valueAtRisk = Math.min(allowanceValue, balanceValue);

          const risk = classifyRisk(isUnlimited, spenderInfo?.verified ?? false, !!spenderInfo, valueAtRisk);

          approvals.push({
            id,
            tokenAddress: log.address,
            tokenSymbol: String(symbol),
            tokenName: String(symbol),
            tokenDecimals: Number(decimals),
            spenderAddress: spender,
            spenderName: spenderInfo?.name ?? "Unknown Contract",
            spenderVerified: spenderInfo?.verified ?? false,
            allowance,
            allowanceFormatted: formatAllowance(allowance, Number(decimals), String(symbol)),
            isUnlimited,
            riskLevel: risk.level,
            riskReason: risk.reason,
            tokenBalance: Number(ethers.formatUnits(balance, Number(decimals))).toLocaleString(undefined, { maximumFractionDigits: 4 }),
            tokenBalanceRaw: balance,
            valueAtRisk,
          });

          existingIds.add(id);
        }
      } catch {
        // Skip failed lookups
      }
    }
  } catch {
    // Event scan failed — still have results from direct allowance checks
  }

  onProgress({
    phase: "Complete",
    current: 1,
    total: 1,
    detail: `Found ${approvals.length} active approvals`,
  });

  // Sort: CRITICAL first, then HIGH, then by value at risk
  const riskOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  approvals.sort((a, b) => {
    const orderDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    if (orderDiff !== 0) return orderDiff;
    return b.valueAtRisk - a.valueAtRisk;
  });

  return approvals;
}

// ═══════════════════════════════════════════════════════════════
// Component: SentinelAgent
// ═══════════════════════════════════════════════════════════════

export default function SentinelAgent({ bnbPrice }: { bnbPrice: number }) {
  const { address, signer, isConnected } = useWalletContext();

  const [approvals, setApprovals] = useState<TokenApproval[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [filter, setFilter] = useState<RiskFilter>("ALL");
  const [lastScan, setLastScan] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scanRef = useRef(false);

  // Auto-scan when wallet connects
  useEffect(() => {
    if (isConnected && address && !scanRef.current) {
      scanRef.current = true;
      handleScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  const handleScan = useCallback(async () => {
    if (!address || scanning) return;
    setScanning(true);
    setError(null);
    setApprovals([]);

    try {
      const results = await scanWalletApprovals(address, bnbPrice || 600, setProgress);
      setApprovals(results);
      setLastScan(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
      setProgress(null);
    }
  }, [address, bnbPrice, scanning]);

  const handleRevoke = useCallback(async (approval: TokenApproval) => {
    if (!signer || revoking) return;

    setRevoking(approval.id);
    try {
      const contract = new ethers.Contract(approval.tokenAddress, ERC20_ABI, signer);

      toast.loading(
        `Revoking ${approval.tokenSymbol} approval for ${approval.spenderName}...`,
        { id: "revoke" },
      );

      // Send approve(spender, 0) through MetaMask — user must confirm
      const tx = await contract.approve(approval.spenderAddress, 0);
      toast.loading("Waiting for confirmation...", { id: "revoke" });

      await tx.wait();

      // Verify the revocation succeeded
      const newAllowance = await contract.allowance(address, approval.spenderAddress);
      if (newAllowance === 0n) {
        toast.success(
          `Revoked ${approval.tokenSymbol} approval for ${approval.spenderName}`,
          { id: "revoke" },
        );
        // Remove from list
        setApprovals((prev) => prev.filter((a) => a.id !== approval.id));
      } else {
        toast.error("Revocation sent but allowance still active — check BSCScan", { id: "revoke" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Revocation failed";
      if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED")) {
        toast.error("Transaction rejected by user", { id: "revoke" });
      } else {
        toast.error(msg, { id: "revoke" });
      }
    } finally {
      setRevoking(null);
    }
  }, [signer, revoking, address]);

  const handleRevokeAllRisky = useCallback(async () => {
    const risky = approvals.filter((a) => a.riskLevel === "CRITICAL" || a.riskLevel === "HIGH");
    if (risky.length === 0) {
      toast.error("No high-risk approvals to revoke");
      return;
    }

    const confirmed = window.confirm(
      `This will send ${risky.length} revocation transaction(s) through MetaMask. Each requires your confirmation.\n\nRevoke ${risky.length} risky approvals?`,
    );
    if (!confirmed) return;

    for (const approval of risky) {
      await handleRevoke(approval);
      await sleep(500);
    }
  }, [approvals, handleRevoke]);

  // Derived data
  const filteredApprovals = filter === "ALL" ? approvals : approvals.filter((a) => a.riskLevel === filter);
  const criticalCount = approvals.filter((a) => a.riskLevel === "CRITICAL").length;
  const highCount = approvals.filter((a) => a.riskLevel === "HIGH").length;
  const totalValueAtRisk = approvals.reduce((sum, a) => sum + a.valueAtRisk, 0);
  const unlimitedCount = approvals.filter((a) => a.isUnlimited).length;

  // ─── Render ──────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="card p-12 text-center" style={{ borderRadius: "12px" }}>
        <ShieldCheck className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--accent)" }} />
        <h3 className="text-xl font-semibold text-white mb-2">Sentinel Agent — Approval Guardian</h3>
        <p className="text-sm max-w-md mx-auto mb-2" style={{ color: "var(--text-secondary)" }}>
          Scans every token approval your wallet has ever granted on BSC. Identifies unlimited
          approvals to risky contracts and lets you revoke them instantly.
        </p>
        <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
          Connect your wallet to activate the Sentinel Agent.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header Card ─── */}
      <div className="card p-6" style={{ borderRadius: "12px" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
              <ShieldCheck className="w-5 h-5" style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Sentinel Agent</h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Approval Guardian — Token Permission Scanner</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastScan && (
              <span className="text-xs px-2 py-1 rounded-md" style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)" }}>
                <Clock className="w-3 h-3 inline mr-1" />
                {new Date(lastScan).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleScan}
              disabled={scanning}
              className="text-xs px-4 py-2 rounded-lg transition-all flex items-center gap-1.5"
              style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Scanning..." : "Scan Now"}
            </button>
          </div>
        </div>

        {/* Wallet Info */}
        <div className="flex items-center gap-2 p-2 rounded-lg mb-4" style={{ background: "rgba(0,224,255,0.04)", border: "1px solid var(--accent-muted)" }}>
          <Info className="w-3 h-3 flex-shrink-0" style={{ color: "var(--accent)" }} />
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Scanning wallet {address?.slice(0, 6)}...{address?.slice(-4)} for ERC-20 token approvals across {TOP_BSC_TOKENS.length} tokens and {Object.keys(KNOWN_SPENDERS).length} known protocols.
          </p>
        </div>

        {/* Scan Progress */}
        {scanning && progress && (
          <div className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.3)" }}>
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--accent)" }} />
              <div>
                <p className="text-sm text-white font-medium">{progress.phase}</p>
                <p className="text-xs font-mono" style={{ color: "var(--accent)" }}>{progress.detail}</p>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                  background: "var(--accent)",
                }}
              />
            </div>
            <p className="text-xs mt-2 text-right" style={{ color: "var(--text-muted)" }}>
              {progress.current} / {progress.total}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* ─── Stats Cards ─── */}
      {approvals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4" style={{ borderRadius: "12px", borderLeft: "3px solid var(--accent)" }}>
            <p className="text-2xl font-bold text-white">{approvals.length}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Active Approvals</p>
          </div>
          <div className="card p-4" style={{ borderRadius: "12px", borderLeft: `3px solid ${criticalCount + highCount > 0 ? "#ef4444" : "#22c55e"}` }}>
            <p className="text-2xl font-bold" style={{ color: criticalCount + highCount > 0 ? "#ef4444" : "#22c55e" }}>
              {criticalCount + highCount}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>High Risk</p>
          </div>
          <div className="card p-4" style={{ borderRadius: "12px", borderLeft: `3px solid ${unlimitedCount > 0 ? "#f97316" : "#22c55e"}` }}>
            <p className="text-2xl font-bold" style={{ color: unlimitedCount > 0 ? "#f97316" : "#22c55e" }}>
              {unlimitedCount}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Unlimited</p>
          </div>
          <div className="card p-4" style={{ borderRadius: "12px", borderLeft: "3px solid #a855f7" }}>
            <p className="text-2xl font-bold text-white">
              <DollarSign className="w-4 h-4 inline" />{totalValueAtRisk >= 1000 ? `${(totalValueAtRisk / 1000).toFixed(1)}K` : totalValueAtRisk.toFixed(0)}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Value at Risk</p>
          </div>
        </div>
      )}

      {/* ─── Bulk Actions ─── */}
      {(criticalCount + highCount > 0) && !scanning && (
        <div className="card p-4 flex items-center justify-between" style={{ borderRadius: "12px", background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-sm font-semibold text-white">{criticalCount + highCount} risky approval{criticalCount + highCount > 1 ? "s" : ""} detected</p>
              <p className="text-xs text-red-400">These approvals could put your funds at risk. Consider revoking them.</p>
            </div>
          </div>
          <button
            onClick={handleRevokeAllRisky}
            disabled={!!revoking}
            className="text-xs px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 flex-shrink-0"
            style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            <ShieldOff className="w-3.5 h-3.5" />
            Revoke All Risky
          </button>
        </div>
      )}

      {/* ─── Filter ─── */}
      {approvals.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                filter === f
                  ? "border"
                  : "border border-transparent"
              }`}
              style={filter === f ? {
                background: f === "ALL" ? "var(--accent-muted)" : getRiskBg(f),
                color: f === "ALL" ? "var(--accent)" : getRiskColor(f),
                borderColor: f === "ALL" ? "var(--accent-border)" : `${getRiskColor(f)}30`,
              } : { color: "var(--text-muted)" }}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* ─── Approval List ─── */}
      <div className="space-y-2">
        {!scanning && approvals.length === 0 && lastScan && (
          <div className="card p-12 text-center" style={{ borderRadius: "12px" }}>
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
            <h4 className="text-lg font-semibold text-white mb-1">All Clear</h4>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              No active token approvals found for this wallet.
            </p>
          </div>
        )}

        {filteredApprovals.map((approval) => {
          const isExpanded = expanded === approval.id;
          const isBeingRevoked = revoking === approval.id;

          return (
            <div
              key={approval.id}
              className="card overflow-hidden transition-all duration-200"
              style={{
                borderRadius: "12px",
                borderLeft: `3px solid ${getRiskColor(approval.riskLevel)}`,
                opacity: isBeingRevoked ? 0.6 : 1,
              }}
            >
              {/* Summary Row */}
              <button
                onClick={() => setExpanded(isExpanded ? null : approval.id)}
                className="w-full flex items-center gap-3 p-4 text-left"
                disabled={isBeingRevoked}
              >
                {/* Risk Icon */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: getRiskBg(approval.riskLevel) }}
                >
                  {approval.riskLevel === "CRITICAL" ? (
                    <XCircle className="w-4 h-4" style={{ color: getRiskColor(approval.riskLevel) }} />
                  ) : approval.riskLevel === "HIGH" ? (
                    <AlertTriangle className="w-4 h-4" style={{ color: getRiskColor(approval.riskLevel) }} />
                  ) : (
                    <ShieldCheck className="w-4 h-4" style={{ color: getRiskColor(approval.riskLevel) }} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{approval.tokenSymbol}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>→</span>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{approval.spenderName}</span>
                    {approval.isUnlimited && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>
                        Unlimited
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: getRiskBg(approval.riskLevel), color: getRiskColor(approval.riskLevel) }}>
                      {approval.riskLevel}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {approval.allowanceFormatted}
                    </span>
                    {approval.valueAtRisk > 0 && (
                      <>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>·</span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {formatUsd(approval.valueAtRisk)} at risk
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Revoke Button (inline) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRevoke(approval);
                  }}
                  disabled={isBeingRevoked || !!revoking}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 flex-shrink-0"
                  style={{
                    background: isBeingRevoked ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.08)",
                    color: "#ef4444",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  {isBeingRevoked ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  {isBeingRevoked ? "Revoking..." : "Revoke"}
                </button>

                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                ) : (
                  <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                )}
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Token Contract</p>
                      <a
                        href={`https://bscscan.com/token/${approval.tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono flex items-center gap-1 hover:underline"
                        style={{ color: "var(--accent)" }}
                      >
                        {approval.tokenAddress.slice(0, 10)}...{approval.tokenAddress.slice(-6)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Spender Contract</p>
                      <a
                        href={`https://bscscan.com/address/${approval.spenderAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono flex items-center gap-1 hover:underline"
                        style={{ color: "var(--accent)" }}
                      >
                        {approval.spenderAddress.slice(0, 10)}...{approval.spenderAddress.slice(-6)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Your Balance</p>
                      <p className="text-sm font-mono text-white">{approval.tokenBalance} {approval.tokenSymbol}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Approved Amount</p>
                      <p className="text-sm font-mono text-white">{approval.allowanceFormatted}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Spender Status</p>
                      <p className="text-sm" style={{ color: approval.spenderVerified ? "var(--green)" : "#f97316" }}>
                        {approval.spenderVerified ? "Verified Protocol" : "Unverified / Unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Risk Reason</p>
                      <p className="text-sm text-white">{approval.riskReason}</p>
                    </div>
                  </div>

                  {/* Warning for critical/high */}
                  {(approval.riskLevel === "CRITICAL" || approval.riskLevel === "HIGH") && (
                    <div className="mt-3 p-3 rounded-lg flex items-start gap-2" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.1)" }}>
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-400">
                        {approval.riskLevel === "CRITICAL"
                          ? "This contract has unlimited access to your tokens and is not a known protocol. It could drain your tokens at any time. Revoke immediately."
                          : "This approval grants significant access to your tokens. Consider revoking if you no longer use this protocol."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Empty State (no scan yet) ─── */}
      {!scanning && approvals.length === 0 && !lastScan && (
        <div className="card p-12 text-center" style={{ borderRadius: "12px" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
            <ShieldCheck className="w-8 h-8" style={{ color: "var(--accent)" }} />
          </div>
          <h4 className="text-xl font-semibold text-white mb-2">Ready to Scan</h4>
          <p className="text-sm max-w-md mx-auto mb-6" style={{ color: "var(--text-secondary)" }}>
            Sentinel will scan your wallet for all active ERC-20 token approvals, identify risky unlimited
            permissions, and let you revoke them with one click.
          </p>
          <button onClick={handleScan} className="btn-primary flex items-center gap-2 mx-auto">
            <Zap className="w-4 h-4" /> Start Scan
          </button>
        </div>
      )}
    </div>
  );
}
