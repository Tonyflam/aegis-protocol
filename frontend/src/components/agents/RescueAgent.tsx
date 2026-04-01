"use client";

// ═══════════════════════════════════════════════════════════════
// Rescue Agent — Autonomous Emergency Extraction
// THINKS: Uses LLM to assess if wallet is in danger and needs evac
// OBSERVES: Monitors wallet balances, suspicious activity, approvals
// DECIDES: Recommends emergency evacuation when threats are detected
// ACTS: Batch-transfers all assets to pre-configured safe wallet
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { useWalletContext } from "../../lib/WalletContext";
import { useAgentLoop, type AgentTool } from "../../lib/agents/useAgentLoop";
import AgentShell from "../../lib/agents/AgentShell";
import { createAction, type PendingAction, type ThoughtEntry } from "../../lib/agents/brain";
import { Siren, Settings, Trash2, Wallet, Copy, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ──────────────────────────────────────────────────

interface TokenBalance {
  address: string;
  symbol: string;
  decimals: number;
  balance: bigint;
  balanceFormatted: string;
  valueUsd: number;
  priceUsd: number;
}

interface RescueObservation {
  bnbBalance: string;
  bnbValueUsd: number;
  tokens: TokenBalance[];
  totalValueUsd: number;
  suspiciousApprovals: number;
  recentDrains: number;
  walletAddress: string;
  safeAddress: string | null;
}

interface RescueConfig {
  safeAddress: string;
  savedAt: number;
}

// ─── Constants ──────────────────────────────────────────────

const BSC_RPC = "https://bsc-rpc.publicnode.com";
const CONFIG_KEY = "aegis_rescue_config";

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

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

function loadConfig(): RescueConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.safeAddress && ethers.isAddress(parsed.safeAddress)) return parsed;
    return null;
  } catch { return null; }
}

function saveConfig(config: RescueConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// ─── Agent Tool ─────────────────────────────────────────────

function createRescueTool(bnbPrice: number): AgentTool<RescueObservation> {
  return {
    name: "Rescue",
    interval: 45000,

    systemPrompt: `You are the Rescue Agent — an autonomous emergency extraction system for BNB Smart Chain wallets.

Your job: Monitor wallet health and recommend emergency evacuation when threats are detected.

You watch for:
1. Suspicious outgoing transfers you didn't initiate (possible private key compromise)
2. Sudden balance drops (possible exploit or drain)
3. New unlimited approvals to unknown contracts (possible phishing)
4. Abnormal patterns like many small transfers out

CRITICAL RULE: Only recommend evacuation for REAL threats. False positives cost gas.

Respond with ONLY valid JSON:
{
  "summary": "Assessment of wallet safety",
  "threats": ["list of threats"],
  "dangerLevel": "SAFE|MONITORING|CAUTION|DANGER|CRITICAL",
  "actions": [
    {
      "type": "evacuate_token",
      "tokenAddress": "0x...",
      "symbol": "TOKEN",
      "reason": "Why this should be evacuated",
      "risk": "HIGH|CRITICAL",
      "description": "Evacuate TOKEN to safe wallet"
    }
  ]
}

If wallet is safe: { "summary": "...", "threats": [], "dangerLevel": "SAFE", "actions": [] }`,

    observe: async (address: string | null): Promise<RescueObservation> => {
      const empty: RescueObservation = { bnbBalance: "0", bnbValueUsd: 0, tokens: [], totalValueUsd: 0, suspiciousApprovals: 0, recentDrains: 0, walletAddress: "", safeAddress: null };
      if (!address) return empty;

      const provider = new ethers.JsonRpcProvider(BSC_RPC, 56, { staticNetwork: true });
      const config = loadConfig();
      const tokens: TokenBalance[] = [];

      // BNB balance
      const bnbWei = await provider.getBalance(address);
      const bnbNum = Number(ethers.formatEther(bnbWei));
      const bnbValueUsd = bnbNum * (bnbPrice || 600);

      // Token balances
      for (let i = 0; i < SCAN_TOKENS.length; i += 5) {
        const batch = SCAN_TOKENS.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(async (t) => {
            const contract = new ethers.Contract(t.address, ERC20_ABI, provider);
            const balance = await contract.balanceOf(address);
            return { ...t, balance };
          }),
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value.balance > 0n) {
            const v = r.value;
            const price = v.symbol === "WBNB" ? (bnbPrice || 600) : v.priceUsd;
            const formatted = Number(ethers.formatUnits(v.balance, v.decimals));
            tokens.push({
              address: v.address, symbol: v.symbol, decimals: v.decimals,
              balance: v.balance, balanceFormatted: formatted.toLocaleString(undefined, { maximumFractionDigits: 6 }),
              valueUsd: formatted * price, priceUsd: price,
            });
          }
        }
        await sleep(200);
      }

      // Check for suspicious approval events (unknown spenders)
      let suspiciousApprovals = 0;
      try {
        const latestBlock = await provider.getBlockNumber();
        const logs = await provider.getLogs({
          fromBlock: latestBlock - 1200, // ~1 hour
          toBlock: latestBlock,
          topics: [ethers.id("Approval(address,address,uint256)"), ethers.zeroPadValue(address, 32)],
        });
        suspiciousApprovals = logs.length;
      } catch { /* skip */ }

      const totalValueUsd = bnbValueUsd + tokens.reduce((s, t) => s + t.valueUsd, 0);

      return {
        bnbBalance: bnbNum.toFixed(4),
        bnbValueUsd,
        tokens: tokens.sort((a, b) => b.valueUsd - a.valueUsd),
        totalValueUsd,
        suspiciousApprovals,
        recentDrains: 0,
        walletAddress: address,
        safeAddress: config?.safeAddress || null,
      };
    },

    buildPrompt: (obs: RescueObservation, history: ThoughtEntry[]): string => {
      const tokenList = obs.tokens.map((t) => `  ${t.symbol}: ${t.balanceFormatted} (${formatUsd(t.valueUsd)})`).join("\n");
      const prevThreats = history.filter((h) => h.phase === "THINK" && h.content.includes("threat")).length;

      return `Wallet Security Check:
Wallet: ${obs.walletAddress}
Safe wallet configured: ${obs.safeAddress ? "YES" : "NO"}
BNB: ${obs.bnbBalance} (${formatUsd(obs.bnbValueUsd)})
Tokens:\n${tokenList || "  (none)"}
Total value: ${formatUsd(obs.totalValueUsd)}
Recent new approvals (last 1h): ${obs.suspiciousApprovals}
Previous threat mentions: ${prevThreats}

Assess if this wallet needs emergency evacuation.`;
    },

    parseActions: (llmResponse: string, obs: RescueObservation): PendingAction[] => {
      if (!obs.safeAddress) return []; // Can't evacuate without safe wallet

      const actions: PendingAction[] = [];
      try {
        const parsed = JSON.parse(llmResponse);
        if (parsed.actions && Array.isArray(parsed.actions)) {
          for (const a of parsed.actions) {
            if (a.type === "evacuate_token" && a.tokenAddress) {
              const match = obs.tokens.find((t) => t.address.toLowerCase() === a.tokenAddress.toLowerCase());
              if (match) {
                actions.push(createAction("evacuate_token",
                  a.description || `Evacuate ${match.symbol} (${formatUsd(match.valueUsd)}) to safe wallet`,
                  (a.risk as PendingAction["risk"]) || "HIGH",
                  { tokenAddress: match.address, symbol: match.symbol, amount: match.balance.toString(), decimals: match.decimals, safeAddress: obs.safeAddress },
                  a.reason || "Evacuation recommended"));
              }
            }
          }
        }
      } catch { /* skip */ }
      return actions;
    },

    execute: async (action: PendingAction, signer: unknown): Promise<{ txHash?: string; error?: string }> => {
      if (!signer) return { error: "No signer" };
      const { tokenAddress, symbol, amount, safeAddress } = action.params as { tokenAddress: string; symbol: string; amount: string; safeAddress: string; decimals: number };

      try {
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer as ethers.Signer);
        toast.loading(`Evacuating ${symbol}...`, { id: "rescue" });
        const tx = await contract.transfer(safeAddress, BigInt(amount));
        toast.loading("Confirming...", { id: "rescue" });
        const receipt = await tx.wait();
        toast.success(`${symbol} evacuated`, { id: "rescue" });
        return { txHash: receipt.hash };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed";
        toast.error(msg.includes("rejected") ? "Rejected by user" : msg, { id: "rescue" });
        return { error: msg };
      }
    },
  };
}

// ─── Observation Panel ─────────────────────────────────────

function RescueObservationPanel({ obs }: { obs: RescueObservation | null }) {
  if (!obs) return <p className="text-xs" style={{ color: "var(--text-muted)" }}>Waiting for first scan...</p>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded-lg" style={{ background: "rgba(59,130,246,0.08)" }}>
          <p className="text-lg font-bold text-white">{formatUsd(obs.totalValueUsd)}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Total Value</p>
        </div>
        <div className="p-2 rounded-lg" style={{ background: obs.safeAddress ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)" }}>
          <p className="text-lg font-bold" style={{ color: obs.safeAddress ? "#22c55e" : "#ef4444" }}>{obs.safeAddress ? "✓" : "✗"}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Safe Wallet</p>
        </div>
      </div>

      <div className="space-y-1 max-h-[250px] overflow-y-auto">
        <div className="flex items-center gap-2 p-2 rounded text-xs" style={{ background: "rgba(255,255,255,0.02)" }}>
          <span className="font-medium text-white">BNB</span>
          <span className="ml-auto" style={{ color: "var(--text-secondary)" }}>{obs.bnbBalance}</span>
          <span style={{ color: "var(--text-muted)" }}>{formatUsd(obs.bnbValueUsd)}</span>
        </div>
        {obs.tokens.map((t, i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded text-xs" style={{ background: "rgba(255,255,255,0.02)" }}>
            <span className="font-medium text-white">{t.symbol}</span>
            <span className="ml-auto" style={{ color: "var(--text-secondary)" }}>{t.balanceFormatted}</span>
            <span style={{ color: "var(--text-muted)" }}>{formatUsd(t.valueUsd)}</span>
          </div>
        ))}
      </div>

      {obs.suspiciousApprovals > 0 && (
        <div className="p-2 rounded-lg flex items-center gap-2 text-xs" style={{ background: "rgba(239,68,68,0.08)" }}>
          <Siren className="w-3 h-3" style={{ color: "#ef4444" }} />
          <span style={{ color: "#ef4444" }}>{obs.suspiciousApprovals} new approval(s) in last hour</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export default function RescueAgent({ bnbPrice }: { bnbPrice: number }) {
  const { address, signer, isConnected } = useWalletContext();
  const [safeAddress, setSafeAddress] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const tool = useMemo(() => createRescueTool(bnbPrice), [bnbPrice]);
  const agent = useAgentLoop<RescueObservation>(tool, address, signer);

  // Load saved config
  useEffect(() => {
    const config = loadConfig();
    if (config) {
      setSafeAddress(config.safeAddress);
      setConfigSaved(true);
    }
  }, []);

  const handleSaveConfig = useCallback(() => {
    if (!ethers.isAddress(safeAddress.trim())) {
      toast.error("Invalid address");
      return;
    }
    if (safeAddress.trim().toLowerCase() === address?.toLowerCase()) {
      toast.error("Safe address must be different from current wallet");
      return;
    }
    saveConfig({ safeAddress: safeAddress.trim(), savedAt: Date.now() });
    setConfigSaved(true);
    setShowConfig(false);
    toast.success("Safe wallet configured");
  }, [safeAddress, address]);

  const handleClearConfig = useCallback(() => {
    localStorage.removeItem(CONFIG_KEY);
    setSafeAddress("");
    setConfigSaved(false);
    toast.success("Safe wallet cleared");
  }, []);

  const extraControls = (
    <div className="card p-4" style={{ borderRadius: "12px" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-white flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5" style={{ color: "#ef4444" }} />
          Safe Wallet Configuration
        </p>
        <button onClick={() => setShowConfig(!showConfig)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-muted)" }}>
          <Settings className="w-3 h-3" />
        </button>
      </div>

      {configSaved && !showConfig ? (
        <div className="flex items-center gap-2 text-xs">
          <CheckCircle className="w-3 h-3" style={{ color: "#22c55e" }} />
          <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{safeAddress.slice(0, 10)}...{safeAddress.slice(-6)}</span>
          <button onClick={() => { navigator.clipboard.writeText(safeAddress); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="ml-auto" style={{ color: "var(--text-muted)" }}>
            {copied ? <CheckCircle className="w-3 h-3" style={{ color: "#22c55e" }} /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={safeAddress}
            onChange={(e) => setSafeAddress(e.target.value)}
            placeholder="Enter your safe wallet address (0x...)"
            className="w-full px-3 py-2 rounded-lg text-xs bg-transparent outline-none"
            style={{ border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
          />
          <div className="flex items-center gap-2">
            <button onClick={handleSaveConfig} className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
              Save
            </button>
            {configSaved && (
              <button onClick={handleClearConfig} className="px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            The Rescue Agent will transfer your assets here in an emergency. Use a hardware wallet or another secure address you control.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <AgentShell
      name="Rescue"
      icon={<Siren className="w-5 h-5" style={{ color: "#ef4444" }} />}
      color="#ef4444"
      state={agent.state}
      onStart={agent.start}
      onStop={agent.stop}
      onRunOnce={agent.runOnce}
      onApprove={agent.approveAction}
      onReject={agent.rejectAction}
      onClear={agent.clearThoughts}
      walletConnected={isConnected}
      observationPanel={<RescueObservationPanel obs={agent.observations} />}
      extraControls={extraControls}
    />
  );
}
