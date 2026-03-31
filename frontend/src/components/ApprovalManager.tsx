"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  ExternalLink,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Types ─────────────────────────────────────────────────────

interface ApprovalEntry {
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  spenderAddress: string;
  spenderName: string;
  allowance: bigint;
  displayAllowance: string;
  isUnlimited: boolean;
  riskLevel: "SAFE" | "LOW" | "MEDIUM" | "HIGH";
  isKnownProtocol: boolean;
}

// ─── Constants ─────────────────────────────────────────────────

const BSC_PROVIDER = new ethers.JsonRpcProvider(
  "https://bsc-rpc.publicnode.com", 56, { staticNetwork: true }
);

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

// Top BSC tokens to check approvals for
const TOKENS = [
  { symbol: "USDT",  address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
  { symbol: "USDC",  address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
  { symbol: "BUSD",  address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", decimals: 18 },
  { symbol: "WBNB",  address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", decimals: 18 },
  { symbol: "CAKE",  address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", decimals: 18 },
  { symbol: "ETH",   address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", decimals: 18 },
  { symbol: "BTCB",  address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", decimals: 18 },
  { symbol: "DOGE",  address: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43", decimals: 8 },
  { symbol: "XRP",   address: "0x1D2F0da169ceB9fC7B3144828DB6a6BBf89F6c6C", decimals: 18 },
  { symbol: "DAI",   address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", decimals: 18 },
];

// Known BSC protocol routers/contracts
const KNOWN_PROTOCOLS: Record<string, { name: string; safe: boolean }> = {
  "0x10ed43c718714eb63d5aa57b78b54704e256024e": { name: "PancakeSwap V2 Router", safe: true },
  "0x13f4ea83d0bd40e75c8222255bc855a974568dd4": { name: "PancakeSwap V3 SmartRouter", safe: true },
  "0x1a0a18ac4becddbd6389559687d1a73d8927e416": { name: "PancakeSwap Universal Router", safe: true },
  "0x05ff2b0db69458a0750badebc4f9e13add608c7f": { name: "PancakeSwap V1 Router (Old)", safe: true },
  "0x1111111254eeb25477b68fb85ed929f73a960582": { name: "1inch V5 Router", safe: true },
  "0x1111111254fb6c44bac0bed2854e76f90643097d": { name: "1inch V4 Router", safe: true },
  "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506": { name: "SushiSwap Router", safe: true },
  "0x3a6d8ca21d1cf76f653a67577fa0d27453350dd8": { name: "Biswap Router", safe: true },
  "0xdef171fe48cf0115b1d80b88dc8eab59176fee57": { name: "ParaSwap V5", safe: true },
  "0x6352a56caadc4f1e25cd6c75970fa768a3304e64": { name: "OpenOcean Exchange", safe: true },
  "0xcf0febd3f17cef5b47b0cd257acf6025c5bff3b7": { name: "ApeSwap Router", safe: true },
  "0x325e343f1de602396e256b67efd1f61c3a6b38bd": { name: "Thena Router", safe: true },
};

const SPENDER_ADDRS = Object.keys(KNOWN_PROTOCOLS);
const UNLIMITED_THRESHOLD = BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

// ─── Helpers ───────────────────────────────────────────────────

function classifyRisk(isUnlimited: boolean, isKnown: boolean): ApprovalEntry["riskLevel"] {
  if (!isKnown && isUnlimited) return "HIGH";
  if (!isKnown) return "MEDIUM";
  if (isUnlimited && isKnown) return "LOW";
  return "SAFE";
}

function getRiskColor(risk: string): string {
  switch (risk) {
    case "HIGH": return "#ef4444";
    case "MEDIUM": return "#eab308";
    case "LOW": return "#3b82f6";
    default: return "#22c55e";
  }
}

function getRiskBg(risk: string): string {
  switch (risk) {
    case "HIGH": return "rgba(239,68,68,0.1)";
    case "MEDIUM": return "rgba(234,179,8,0.1)";
    case "LOW": return "rgba(59,130,246,0.1)";
    default: return "rgba(34,197,94,0.1)";
  }
}

// ─── Scanning Logic ────────────────────────────────────────────

async function scanApprovals(walletAddress: string): Promise<ApprovalEntry[]> {
  const approvals: ApprovalEntry[] = [];

  for (const token of TOKENS) {
    const contract = new ethers.Contract(token.address, ERC20_ABI, BSC_PROVIDER);

    // Check all known spenders in parallel for this token
    const checks = SPENDER_ADDRS.map(async (spenderAddr) => {
      try {
        const allowance: bigint = await contract.allowance(walletAddress, spenderAddr);
        if (allowance > BigInt(0)) {
          const info = KNOWN_PROTOCOLS[spenderAddr];
          const isUnlimited = allowance >= UNLIMITED_THRESHOLD;
          return {
            tokenAddress: token.address,
            tokenSymbol: token.symbol,
            tokenDecimals: token.decimals,
            spenderAddress: spenderAddr,
            spenderName: info?.name ?? `Unknown (${spenderAddr.slice(0, 6)}...${spenderAddr.slice(-4)})`,
            allowance,
            displayAllowance: isUnlimited
              ? "Unlimited \u221E"
              : parseFloat(ethers.formatUnits(allowance, token.decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 }),
            isUnlimited,
            riskLevel: classifyRisk(isUnlimited, info?.safe ?? false),
            isKnownProtocol: info?.safe ?? false,
          } as ApprovalEntry;
        }
      } catch {
        // Skip failed checks
      }
      return null;
    });

    const results = await Promise.allSettled(checks);
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        approvals.push(r.value);
      }
    }

    // Brief delay between tokens to be nice to RPC
    await new Promise((r) => setTimeout(r, 250));
  }

  // Sort: HIGH risk first
  const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, SAFE: 3 };
  approvals.sort((a, b) => (order[a.riskLevel] ?? 9) - (order[b.riskLevel] ?? 9));

  return approvals;
}

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export default function ApprovalManager({
  walletAddress,
  signer,
  chainId,
}: {
  walletAddress?: string | null;
  signer?: ethers.Signer | null;
  chainId?: number | null;
}) {
  const [address, setAddress] = useState(walletAddress || "");
  const [approvals, setApprovals] = useState<ApprovalEntry[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Sync wallet address from context
  if (walletAddress && walletAddress !== address && !scanning) {
    setAddress(walletAddress);
  }

  const handleScan = useCallback(async () => {
    const target = address.trim();
    if (!ethers.isAddress(target)) {
      setError("Enter a valid BSC address");
      return;
    }
    setScanning(true);
    setError("");
    setApprovals([]);
    try {
      const results = await scanApprovals(target);
      setApprovals(results);
      setScanned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan approvals");
    } finally {
      setScanning(false);
    }
  }, [address]);

  const handleRevoke = useCallback(async (approval: ApprovalEntry) => {
    if (!signer) {
      toast.error("Connect your wallet to revoke approvals");
      return;
    }
    if (chainId !== 56) {
      try {
        await (window as any).ethereum?.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x38" }],
        });
        toast("Switched to BSC Mainnet — click Revoke again");
        return;
      } catch {
        toast.error("Switch to BSC Mainnet (chain 56) in MetaMask to revoke");
        return;
      }
    }

    const id = `${approval.tokenAddress}-${approval.spenderAddress}`;
    setRevoking(id);
    try {
      const token = new ethers.Contract(approval.tokenAddress, ERC20_ABI, signer);
      toast.loading(`Revoking ${approval.tokenSymbol} approval...`, { id: "revoke" });
      const tx = await token.approve(approval.spenderAddress, 0);
      await tx.wait();
      toast.success(`Revoked ${approval.spenderName} for ${approval.tokenSymbol}`, { id: "revoke" });
      setApprovals((prev) =>
        prev.filter(
          (a) => !(a.tokenAddress === approval.tokenAddress && a.spenderAddress === approval.spenderAddress)
        )
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Revoke failed", { id: "revoke" });
    } finally {
      setRevoking(null);
    }
  }, [signer, chainId]);

  const highRisk = approvals.filter((a) => a.riskLevel === "HIGH");
  const medRisk = approvals.filter((a) => a.riskLevel === "MEDIUM");

  return (
    <div className="space-y-4">
      {/* Scanner Input */}
      <div className="card p-5" style={{ borderRadius: "12px" }}>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-[color:var(--accent)]" />
          <h4 className="text-base font-semibold text-white">Token Approval Scanner</h4>
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[color:var(--accent)] border border-[var(--accent)]/20">
            BSC Mainnet
          </span>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          Every DEX swap creates a token approval. Unlimited approvals to unknown contracts are a top way funds get stolen on BSC.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Wallet address (0x...)"
            value={address}
            onChange={(e) => { setAddress(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--bg-base)] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--accent)]/50 font-mono text-sm"
            disabled={scanning}
          />
          <button
            onClick={handleScan}
            disabled={scanning}
            className="btn-primary px-5 py-2.5 flex items-center gap-2 text-sm whitespace-nowrap"
          >
            {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {scanning ? "Scanning..." : "Scan"}
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2 rounded-lg flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)" }}>
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400">{error}</span>
          </div>
        )}
      </div>

      {/* Scanning Progress */}
      {scanning && (
        <div className="card p-8 text-center" style={{ borderRadius: "12px" }}>
          <RefreshCw className="w-8 h-8 text-[color:var(--accent)] mx-auto mb-3 animate-spin" />
          <p className="text-sm text-gray-300">Scanning {TOKENS.length} tokens across {SPENDER_ADDRS.length} protocols...</p>
          <p className="text-xs text-gray-500 mt-1">Checking active approvals on BSC Mainnet</p>
        </div>
      )}

      {/* Results */}
      {scanned && !scanning && (
        <>
          {/* Summary */}
          <div className="card p-5" style={{ borderRadius: "12px" }}>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", borderLeft: "3px solid #ef4444" }}>
                <p className="text-xl font-bold text-red-400">{highRisk.length}</p>
                <p className="text-xs text-gray-500">High Risk</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(234,179,8,0.06)", borderLeft: "3px solid #eab308" }}>
                <p className="text-xl font-bold text-yellow-400">{medRisk.length}</p>
                <p className="text-xs text-gray-500">Medium Risk</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(34,197,94,0.06)", borderLeft: "3px solid #22c55e" }}>
                <p className="text-xl font-bold text-green-400">{approvals.length - highRisk.length - medRisk.length}</p>
                <p className="text-xs text-gray-500">Safe</p>
              </div>
            </div>

            {highRisk.length > 0 && (
              <div className="mt-3 p-3 rounded-lg flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">
                  {highRisk.length} unlimited approval{highRisk.length > 1 ? "s" : ""} to unknown contracts. Revoke immediately.
                </p>
              </div>
            )}
          </div>

          {/* Approval List */}
          {approvals.length === 0 ? (
            <div className="card p-8 text-center" style={{ borderRadius: "12px" }}>
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-white font-medium">No Active Approvals Found</p>
              <p className="text-xs text-gray-500 mt-1">
                This wallet has no active token approvals to the {SPENDER_ADDRS.length} checked protocols. You&apos;re clean!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {approvals.map((a) => {
                const id = `${a.tokenAddress}-${a.spenderAddress}`;
                const isCurrentlyRevoking = revoking === id;
                return (
                  <div
                    key={id}
                    className="card p-4 flex items-center gap-4"
                    style={{ borderRadius: "12px", borderLeft: `3px solid ${getRiskColor(a.riskLevel)}` }}
                  >
                    {/* Token + Spender */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white">{a.tokenSymbol}</span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-mono"
                          style={{ background: getRiskBg(a.riskLevel), color: getRiskColor(a.riskLevel) }}
                        >
                          {a.riskLevel}
                        </span>
                        {a.isUnlimited && (
                          <span className="text-[10px] text-yellow-500">Unlimited</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {a.isKnownProtocol ? (
                          <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                        )}
                        <span className="text-xs text-gray-400 truncate">{a.spenderName}</span>
                      </div>
                    </div>

                    {/* Allowance */}
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-xs text-gray-500">Allowance</p>
                      <p className="text-sm font-mono text-gray-300">{a.displayAllowance}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`https://bscscan.com/address/${a.spenderAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
                      </a>
                      <button
                        onClick={() => handleRevoke(a)}
                        disabled={isCurrentlyRevoking || !signer}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: "rgba(239,68,68,0.1)",
                          color: "#ef4444",
                          border: "1px solid rgba(239,68,68,0.2)",
                          opacity: !signer || isCurrentlyRevoking ? 0.5 : 1,
                        }}
                        title={!signer ? "Connect wallet to revoke" : "Revoke this approval"}
                      >
                        {isCurrentlyRevoking ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        Revoke
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!scanned && !scanning && (
        <div className="card p-10 text-center" style={{ borderRadius: "12px" }}>
          <Shield className="w-12 h-12 text-[color:var(--accent)] mx-auto mb-4 opacity-50" />
          <h4 className="text-lg font-semibold text-white mb-2">Check Your Token Approvals</h4>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Every time you use a DEX, you approve it to spend your tokens. Old or unlimited
            approvals to unknown contracts are the #1 way funds get stolen on BSC.
          </p>
        </div>
      )}
    </div>
  );
}
