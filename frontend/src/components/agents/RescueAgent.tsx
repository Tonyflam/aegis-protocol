"use client";

import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { useWalletContext } from "../../lib/WalletContext";
import toast from "react-hot-toast";
import {
  Siren,
  Shield,
  AlertTriangle,
  CheckCircle,
  Wallet,
  RefreshCw,
  ExternalLink,
  Loader2,
  Copy,
  Settings,
  Trash2,
  Zap,
  XCircle,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Rescue Agent — Emergency Extraction
// Pre-configure a safe wallet. In an emergency, one-click
// batch-transfers all tokens and BNB to your safe address.
// ═══════════════════════════════════════════════════════════════

// ─── Types ─────────────────────────────────────────────────────

interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  balanceFormatted: string;
  valueUsd: number;
  transferStatus: "pending" | "sending" | "confirmed" | "failed" | "skipped";
  txHash?: string;
}

interface RescueConfig {
  safeAddress: string;
  savedAt: number;
}

// ─── Constants ─────────────────────────────────────────────────

const BSC_RPC = "https://bsc-rpc.publicnode.com";
const CONFIG_KEY = "aegis_rescue_config";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

// Tokens to scan for balances (same list as Sentinel, with prices)
const SCAN_TOKENS: { address: string; symbol: string; decimals: number; priceUsd: number }[] = [
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
  { address: "0xfb5B838b6cfEEdC2873aB27866079AC55363D37E", symbol: "FLOKI", decimals: 9, priceUsd: 0.0002 },
  { address: "0x4B0F1812e5Df2A09796481Ff14017e6005508003", symbol: "TWT", decimals: 18, priceUsd: 1 },
  { address: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63", symbol: "XVS", decimals: 18, priceUsd: 8 },
  { address: "0xAD6cAEb32CD2c308980a548bD0Bc5AA4306c6c18", symbol: "BAND", decimals: 18, priceUsd: 1.5 },
  { address: "0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777", symbol: "UNIQ", decimals: 18, priceUsd: 0.001 },
];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function formatUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

// ─── Config Persistence ────────────────────────────────────────

function loadConfig(): RescueConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveConfig(config: RescueConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function clearConfig(): void {
  localStorage.removeItem(CONFIG_KEY);
}

// ═══════════════════════════════════════════════════════════════
// Component: RescueAgent
// ═══════════════════════════════════════════════════════════════

export default function RescueAgent({ bnbPrice }: { bnbPrice: number }) {
  const { address, signer, isConnected } = useWalletContext();

  const [config, setConfig] = useState<RescueConfig | null>(null);
  const [safeInput, setSafeInput] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [bnbBalance, setBnbBalance] = useState<bigint>(0n);
  const [scanning, setScanning] = useState(false);
  const [evacuating, setEvacuating] = useState(false);
  const [evacuationProgress, setEvacuationProgress] = useState({ done: 0, total: 0 });
  const [lastScan, setLastScan] = useState<number | null>(null);

  // Load config on mount
  useEffect(() => {
    const c = loadConfig();
    if (c) setConfig(c);
  }, []);

  // Auto-scan when wallet connects
  useEffect(() => {
    if (isConnected && address && config) {
      scanBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  // ─── Config ──────────────────────────────────────────────────

  const handleSetSafeWallet = useCallback(() => {
    const trimmed = safeInput.trim();
    if (!ethers.isAddress(trimmed)) {
      toast.error("Invalid BSC address");
      return;
    }
    if (address && trimmed.toLowerCase() === address.toLowerCase()) {
      toast.error("Safe wallet cannot be the same as your current wallet");
      return;
    }
    const c: RescueConfig = { safeAddress: ethers.getAddress(trimmed), savedAt: Date.now() };
    saveConfig(c);
    setConfig(c);
    setSafeInput("");
    setShowConfig(false);
    toast.success("Safe wallet configured");
  }, [safeInput, address]);

  const handleClearConfig = useCallback(() => {
    if (!window.confirm("Remove safe wallet configuration?")) return;
    clearConfig();
    setConfig(null);
    toast.success("Safe wallet removed");
  }, []);

  // ─── Scan Balances ───────────────────────────────────────────

  const scanBalances = useCallback(async () => {
    if (!address || scanning) return;
    setScanning(true);
    setTokens([]);

    try {
      const provider = new ethers.JsonRpcProvider(BSC_RPC, 56, { staticNetwork: true });

      // Get BNB balance
      const bnbBal = await provider.getBalance(address);
      setBnbBalance(bnbBal);

      const updatedTokens = SCAN_TOKENS.map((t) => ({
        ...t,
        priceUsd: t.symbol === "WBNB" ? (bnbPrice || 600) : t.priceUsd,
      }));

      const found: TokenBalance[] = [];

      // Batch balance checks
      for (let i = 0; i < updatedTokens.length; i += 5) {
        const batch = updatedTokens.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(async (t) => {
            const contract = new ethers.Contract(t.address, ERC20_ABI, provider);
            const balance = await contract.balanceOf(address);
            return { ...t, balance };
          }),
        );

        for (const r of results) {
          if (r.status === "fulfilled" && r.value.balance > 0n) {
            const { address: addr, symbol, decimals, balance, priceUsd } = r.value;
            const formatted = Number(ethers.formatUnits(balance, decimals));
            found.push({
              address: addr,
              symbol,
              name: symbol,
              decimals,
              balance,
              balanceFormatted: formatted.toLocaleString(undefined, { maximumFractionDigits: 6 }),
              valueUsd: formatted * priceUsd,
              transferStatus: "pending",
            });
          }
        }

        await sleep(200);
      }

      // Sort by USD value descending
      found.sort((a, b) => b.valueUsd - a.valueUsd);
      setTokens(found);
      setLastScan(Date.now());
    } catch {
      toast.error("Failed to scan balances");
    } finally {
      setScanning(false);
    }
  }, [address, scanning, bnbPrice]);

  // ─── Emergency Evacuation ────────────────────────────────────

  const handleEvacuate = useCallback(async () => {
    if (!signer || !config || !address || evacuating) return;

    const tokensToTransfer = tokens.filter((t) => t.balance > 0n);

    if (tokensToTransfer.length === 0 && bnbBalance <= ethers.parseEther("0.001")) {
      toast.error("No assets to evacuate");
      return;
    }

    const totalValue = tokens.reduce((s, t) => s + t.valueUsd, 0) +
      Number(ethers.formatEther(bnbBalance)) * (bnbPrice || 600);

    const confirmed = window.confirm(
      `⚠ EMERGENCY EVACUATION ⚠\n\n` +
      `This will transfer ALL assets to your safe wallet:\n` +
      `${config.safeAddress}\n\n` +
      `Assets to transfer:\n` +
      `• ${tokensToTransfer.length} ERC-20 token(s)\n` +
      `• ${Number(ethers.formatEther(bnbBalance)).toFixed(4)} BNB\n` +
      `• Total value: ~${formatUsd(totalValue)}\n\n` +
      `Each transfer requires MetaMask confirmation.\n\n` +
      `PROCEED WITH EVACUATION?`,
    );
    if (!confirmed) return;

    setEvacuating(true);
    const total = tokensToTransfer.length + (bnbBalance > ethers.parseEther("0.002") ? 1 : 0);
    setEvacuationProgress({ done: 0, total });

    // Transfer ERC-20 tokens first (need BNB for gas)
    for (let i = 0; i < tokensToTransfer.length; i++) {
      const token = tokensToTransfer[i];

      setTokens((prev) =>
        prev.map((t) => (t.address === token.address ? { ...t, transferStatus: "sending" } : t)),
      );

      try {
        const contract = new ethers.Contract(token.address, ERC20_ABI, signer);
        toast.loading(`Transferring ${token.symbol}...`, { id: `rescue-${i}` });

        const tx = await contract.transfer(config.safeAddress, token.balance);
        await tx.wait();

        setTokens((prev) =>
          prev.map((t) =>
            t.address === token.address
              ? { ...t, transferStatus: "confirmed", txHash: tx.hash }
              : t,
          ),
        );

        toast.success(`${token.symbol} transferred`, { id: `rescue-${i}` });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED")) {
          toast.error(`${token.symbol} transfer rejected`, { id: `rescue-${i}` });
          setTokens((prev) =>
            prev.map((t) =>
              t.address === token.address ? { ...t, transferStatus: "skipped" } : t,
            ),
          );
        } else {
          toast.error(`${token.symbol} transfer failed`, { id: `rescue-${i}` });
          setTokens((prev) =>
            prev.map((t) =>
              t.address === token.address ? { ...t, transferStatus: "failed" } : t,
            ),
          );
        }
      }

      setEvacuationProgress({ done: i + 1, total });
      await sleep(300);
    }

    // Transfer BNB last (keep small amount for any remaining gas)
    if (bnbBalance > ethers.parseEther("0.002")) {
      try {
        toast.loading("Transferring BNB...", { id: "rescue-bnb" });

        // Leave 0.001 BNB for any remaining gas
        const sendAmount = bnbBalance - ethers.parseEther("0.001");

        const tx = await signer.sendTransaction({
          to: config.safeAddress,
          value: sendAmount,
        });
        await tx.wait();

        toast.success("BNB transferred", { id: "rescue-bnb" });
        setBnbBalance(ethers.parseEther("0.001"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED")) {
          toast.error("BNB transfer rejected", { id: "rescue-bnb" });
        } else {
          toast.error("BNB transfer failed", { id: "rescue-bnb" });
        }
      }
    }

    setEvacuationProgress({ done: total, total });
    setEvacuating(false);
    toast.success("Evacuation complete");

    // Re-scan to update balances
    await sleep(2000);
    scanBalances();
  }, [signer, config, address, evacuating, tokens, bnbBalance, bnbPrice, scanBalances]);

  // ─── Derived ─────────────────────────────────────────────────

  const totalTokenValue = tokens.reduce((s, t) => s + t.valueUsd, 0);
  const bnbValue = Number(ethers.formatEther(bnbBalance)) * (bnbPrice || 600);
  const totalValue = totalTokenValue + bnbValue;
  const transferredCount = tokens.filter((t) => t.transferStatus === "confirmed").length;

  // ─── Render ──────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="card p-12 text-center" style={{ borderRadius: "12px" }}>
        <Siren className="w-16 h-16 mx-auto mb-4" style={{ color: "#ef4444" }} />
        <h3 className="text-xl font-semibold text-white mb-2">Rescue Agent — Emergency Extraction</h3>
        <p className="text-sm max-w-md mx-auto mb-2" style={{ color: "var(--text-secondary)" }}>
          Pre-configure a safe wallet. In an emergency, instantly evacuate all tokens and BNB
          to your safe address with one click.
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Connect your wallet to configure the Rescue Agent.
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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
              <Siren className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Rescue Agent</h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Emergency Extraction — Panic Button</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="text-xs px-3 py-2 rounded-lg transition-all flex items-center gap-1.5"
              style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Settings className="w-3.5 h-3.5" />
              Configure
            </button>
            <button
              onClick={scanBalances}
              disabled={scanning}
              className="text-xs px-3 py-2 rounded-lg transition-all flex items-center gap-1.5"
              style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Scanning..." : "Scan Inventory"}
            </button>
          </div>
        </div>

        {/* Safe Wallet Config */}
        {config ? (
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.1)" }}>
            <Shield className="w-4 h-4 flex-shrink-0" style={{ color: "var(--green)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs" style={{ color: "var(--green)" }}>Safe Wallet Configured</p>
              <p className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                {config.safeAddress.slice(0, 10)}...{config.safeAddress.slice(-8)}
              </p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(config.safeAddress);
                toast.success("Copied");
              }}
              className="p-1.5 rounded-md hover:bg-white/5"
            >
              <Copy className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            </button>
            <button
              onClick={handleClearConfig}
              className="p-1.5 rounded-md hover:bg-white/5"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.12)" }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--yellow)" }} />
            <p className="text-xs" style={{ color: "var(--yellow)" }}>
              No safe wallet configured. Set up a safe wallet to enable emergency extraction.
            </p>
          </div>
        )}

        {/* Config Panel */}
        {showConfig && (
          <div className="mt-4 p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.3)" }}>
            <h4 className="text-sm font-semibold text-white mb-3">Configure Safe Wallet</h4>
            <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
              Enter the BSC address where your assets will be transferred in an emergency.
              This should be a wallet you control — ideally a hardware wallet or a separate secure address.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={safeInput}
                onChange={(e) => setSafeInput(e.target.value)}
                placeholder="0x... BSC safe wallet address"
                className="flex-1 text-sm px-4 py-2.5 rounded-lg bg-black/30 border text-white outline-none focus:border-cyan-500/30 transition-colors font-mono"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
              />
              <button
                onClick={handleSetSafeWallet}
                className="text-xs px-4 py-2.5 rounded-lg font-medium flex items-center gap-1.5 flex-shrink-0"
                style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
            <div className="mt-3 p-2 rounded-lg flex items-start gap-2" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.08)" }}>
              <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">
                Double-check the address. Tokens sent to a wrong address cannot be recovered.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Asset Overview Cards ─── */}
      {lastScan && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4" style={{ borderRadius: "12px", borderLeft: "3px solid var(--accent)" }}>
            <p className="text-2xl font-bold text-white">{formatUsd(totalValue)}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total Value</p>
          </div>
          <div className="card p-4" style={{ borderRadius: "12px", borderLeft: "3px solid var(--bnb)" }}>
            <p className="text-2xl font-bold text-white">{Number(ethers.formatEther(bnbBalance)).toFixed(4)}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>BNB Balance</p>
          </div>
          <div className="card p-4" style={{ borderRadius: "12px", borderLeft: "3px solid #a855f7" }}>
            <p className="text-2xl font-bold text-white">{tokens.length}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tokens Found</p>
          </div>
          <div className="card p-4" style={{ borderRadius: "12px", borderLeft: `3px solid ${config ? "#22c55e" : "#eab308"}` }}>
            <p className="text-2xl font-bold" style={{ color: config ? "#22c55e" : "#eab308" }}>{config ? "Ready" : "Setup"}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Rescue Status</p>
          </div>
        </div>
      )}

      {/* ─── Panic Button ─── */}
      {config && lastScan && tokens.length > 0 && (
        <div className="card p-6 text-center relative overflow-hidden" style={{
          borderRadius: "12px",
          background: evacuating
            ? "rgba(239,68,68,0.08)"
            : "linear-gradient(135deg, rgba(239,68,68,0.04), rgba(249,115,22,0.04))",
          border: "1px solid rgba(239,68,68,0.15)",
        }}>
          {evacuating && (
            <div className="absolute inset-0 animate-pulse" style={{ background: "rgba(239,68,68,0.03)" }} />
          )}

          {!evacuating ? (
            <>
              <h4 className="text-lg font-bold text-white mb-2">Emergency Evacuation</h4>
              <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
                Transfer all {tokens.length} token(s) + BNB to your safe wallet ({config.safeAddress.slice(0, 6)}...{config.safeAddress.slice(-4)})
              </p>
              <button
                onClick={handleEvacuate}
                className="px-8 py-3 rounded-xl font-bold text-lg transition-all flex items-center gap-2 mx-auto hover:scale-105 active:scale-95"
                style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "2px solid rgba(239,68,68,0.3)" }}
              >
                <Siren className="w-5 h-5" />
                EVACUATE ALL ASSETS
              </button>
              <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                Each transfer requires MetaMask confirmation. BNB is transferred last.
              </p>
            </>
          ) : (
            <>
              <h4 className="text-lg font-bold text-red-400 mb-3">Evacuation In Progress</h4>
              <div className="h-3 rounded-full overflow-hidden mx-auto max-w-md mb-2" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${evacuationProgress.total > 0 ? (evacuationProgress.done / evacuationProgress.total) * 100 : 0}%`,
                    background: "#ef4444",
                  }}
                />
              </div>
              <p className="text-xs text-red-400">
                {evacuationProgress.done} / {evacuationProgress.total} transfers complete
              </p>
            </>
          )}
        </div>
      )}

      {/* ─── Token Inventory ─── */}
      {lastScan && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Wallet className="w-4 h-4" style={{ color: "var(--accent)" }} />
              Token Inventory
            </h4>
            {transferredCount > 0 && (
              <span className="text-xs px-2 py-1 rounded-md" style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)" }}>
                {transferredCount} transferred
              </span>
            )}
          </div>

          {/* BNB Row */}
          <div className="card p-4 flex items-center gap-3" style={{ borderRadius: "12px", borderLeft: "3px solid var(--bnb)" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(243,186,47,0.1)" }}>
              <span className="text-sm font-bold" style={{ color: "var(--bnb)" }}>B</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">BNB (Native)</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {Number(ethers.formatEther(bnbBalance)).toFixed(6)} BNB
              </p>
            </div>
            <p className="text-sm font-mono text-white">{formatUsd(bnbValue)}</p>
          </div>

          {/* ERC-20 Token Rows */}
          {tokens.map((token) => (
            <div
              key={token.address}
              className="card p-4 flex items-center gap-3 transition-all"
              style={{
                borderRadius: "12px",
                borderLeft: `3px solid ${
                  token.transferStatus === "confirmed" ? "#22c55e" :
                  token.transferStatus === "failed" ? "#ef4444" :
                  token.transferStatus === "sending" ? "#f97316" :
                  "rgba(255,255,255,0.06)"
                }`,
                opacity: token.transferStatus === "confirmed" ? 0.5 : 1,
              }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                <span className="text-xs font-bold text-white">{token.symbol.slice(0, 3)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">{token.symbol}</p>
                  {token.transferStatus === "sending" && <Loader2 className="w-3 h-3 animate-spin text-orange-400" />}
                  {token.transferStatus === "confirmed" && <CheckCircle className="w-3 h-3 text-green-400" />}
                  {token.transferStatus === "failed" && <XCircle className="w-3 h-3 text-red-400" />}
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{token.balanceFormatted}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-white">{formatUsd(token.valueUsd)}</p>
                {token.txHash && (
                  <a
                    href={`https://bscscan.com/tx/${token.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs flex items-center gap-1 justify-end"
                    style={{ color: "var(--accent)" }}
                  >
                    View <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          ))}

          {tokens.length === 0 && bnbBalance <= 0n && (
            <div className="card p-8 text-center" style={{ borderRadius: "12px" }}>
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400" />
              <p className="text-sm text-white">No ERC-20 tokens found in this wallet.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Initial State ─── */}
      {!lastScan && !scanning && (
        <div className="card p-12 text-center" style={{ borderRadius: "12px" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
            <Siren className="w-8 h-8 text-red-400" />
          </div>
          <h4 className="text-xl font-semibold text-white mb-2">Emergency Ready</h4>
          <p className="text-sm max-w-md mx-auto mb-6" style={{ color: "var(--text-secondary)" }}>
            {config
              ? "Scan your wallet to see all assets that would be evacuated in an emergency."
              : "Configure a safe wallet first, then scan your assets to prepare for emergency extraction."}
          </p>
          <div className="flex items-center gap-3 justify-center">
            {!config && (
              <button
                onClick={() => setShowConfig(true)}
                className="text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"
                style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <Settings className="w-3.5 h-3.5" />
                Set Safe Wallet
              </button>
            )}
            <button onClick={scanBalances} className="btn-primary flex items-center gap-2">
              <Zap className="w-4 h-4" /> Scan Assets
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
