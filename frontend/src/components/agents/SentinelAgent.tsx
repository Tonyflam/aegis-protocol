"use client";

// ═══════════════════════════════════════════════════════════════
// Sentinel Agent — Autonomous Approval Guardian
// THINKS: Uses LLM to analyze which approvals are dangerous
// OBSERVES: Continuously scans token approvals on BSC
// DECIDES: Recommends revoking risky unlimited approvals
// ACTS: Executes revocations through MetaMask with user approval
// ═══════════════════════════════════════════════════════════════

import { useMemo } from "react";
import { ethers } from "ethers";
import { useWalletContext } from "../../lib/WalletContext";
import { useAgentLoop, type AgentTool } from "../../lib/agents/useAgentLoop";
import AgentShell from "../../lib/agents/AgentShell";
import { createAction, type PendingAction } from "../../lib/agents/brain";
import { ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ──────────────────────────────────────────────────

interface TokenApproval {
  tokenAddress: string;
  tokenSymbol: string;
  spenderAddress: string;
  spenderName: string;
  spenderVerified: boolean;
  allowance: bigint;
  isUnlimited: boolean;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  riskReason: string;
  valueAtRisk: number;
  tokenBalance: string;
}

interface SentinelObservation {
  approvals: TokenApproval[];
  totalValueAtRisk: number;
  criticalCount: number;
  highCount: number;
  unlimitedCount: number;
  scannedTokens: number;
  walletAddress: string;
}

// ─── Constants ──────────────────────────────────────────────

const BSC_RPC = "https://bsc-rpc.publicnode.com";

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

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

const KNOWN_SPENDERS: Record<string, { name: string; verified: boolean }> = {
  "0x10ed43c718714eb63d5aa57b78b54704e256024e": { name: "PancakeSwap V2 Router", verified: true },
  "0x13f4ea83d0bd40e75c8222255bc855a974568dd4": { name: "PancakeSwap V3 Router", verified: true },
  "0x556b9306565093c855aea9c95ee71742502c6a7a": { name: "PancakeSwap V3 Router 2", verified: true },
  "0x46a15b0b27311cedf172ab29e4f4766fbe7f4364": { name: "PancakeSwap MasterChef V3", verified: true },
  "0xa5f8c5dbd5f286960b9d90548680ae5ebff07652": { name: "PancakeSwap MasterChef V2", verified: true },
  "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506": { name: "SushiSwap Router", verified: true },
  "0x1111111254eeb25477b68fb85ed929f73a960582": { name: "1inch V5 Router", verified: true },
  "0x111111125421ca6dc452d289314280a0f8842a65": { name: "1inch V6 Router", verified: true },
  "0x3a6d8ca21d1cf76f653a67577fa0d27453350dd8": { name: "BiSwap Router", verified: true },
  "0xfd36e2c2a6789db23113685031d7f16329158384": { name: "Venus Unitroller", verified: true },
  "0xa07c5b74c9b40447a954e1466938b865b6bbea36": { name: "Venus vBNB", verified: true },
  "0xfd5840cd36d94d7229439859c0112a4185bc0255": { name: "Venus vUSDT", verified: true },
  "0xeca88125a5adbe82614ffc12d0db554e2e2867c8": { name: "Venus vUSDC", verified: true },
  "0x4a364f8c717caad9a442737eb7b8a55cc6cf18d8": { name: "Stargate Router", verified: true },
  "0x3c2269811836af69497e5f486a85d7316753cf62": { name: "LayerZero Endpoint", verified: true },
};

const UNLIMITED_THRESHOLD = ethers.MaxUint256 / 2n;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function formatUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

// ─── Agent Tool Definition ─────────────────────────────────

function createSentinelTool(bnbPrice: number): AgentTool<SentinelObservation> {
  return {
    name: "Sentinel",
    interval: 60000,

    systemPrompt: `You are the Sentinel Agent — an autonomous approval guardian for BNB Smart Chain wallets.

Your job: Analyze token approvals and decide which ones are dangerous and should be revoked.

Rules:
- Unlimited approvals to UNKNOWN contracts = ALWAYS recommend revoke (CRITICAL)
- Unlimited approvals to UNVERIFIED contracts = recommend revoke (HIGH)
- Unlimited approvals to verified protocols = WARN only, don't revoke unless value > $10K
- Limited approvals to known protocols = LOW risk, note but don't act

Respond with ONLY valid JSON:
{
  "summary": "One sentence overall assessment",
  "threats": ["threat1", "threat2"],
  "actions": [
    {
      "type": "revoke_approval",
      "tokenAddress": "0x...",
      "spenderAddress": "0x...",
      "reason": "Why",
      "risk": "CRITICAL|HIGH|MEDIUM|LOW",
      "description": "Revoke TOKEN approval for SPENDER"
    }
  ]
}

If wallet is clean: { "summary": "...", "threats": [], "actions": [] }`,

    observe: async (address: string | null): Promise<SentinelObservation> => {
      if (!address) {
        return { approvals: [], totalValueAtRisk: 0, criticalCount: 0, highCount: 0, unlimitedCount: 0, scannedTokens: 0, walletAddress: "" };
      }

      const provider = new ethers.JsonRpcProvider(BSC_RPC, 56, { staticNetwork: true });
      const approvals: TokenApproval[] = [];
      const tokens = TOP_BSC_TOKENS.map((t) => ({
        ...t,
        priceUsd: t.symbol === "WBNB" ? (bnbPrice || 600) : t.priceUsd,
      }));
      const spenderAddresses = Object.keys(KNOWN_SPENDERS);

      // Discover held tokens
      const heldTokens: typeof tokens = [];
      for (let i = 0; i < tokens.length; i += 5) {
        const batch = tokens.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(async (token) => {
            const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
            const balance = await contract.balanceOf(address);
            return { token, balance };
          }),
        );
        for (const result of results) {
          if (result.status === "fulfilled" && result.value.balance > 0n) {
            heldTokens.push(result.value.token);
          }
        }
        await sleep(200);
      }

      if (heldTokens.length === 0) heldTokens.push(...tokens.slice(0, 5));

      // Check allowances
      for (const token of heldTokens) {
        const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
        let balance = 0n;
        try { balance = await contract.balanceOf(address); } catch { /* skip */ }

        for (let i = 0; i < spenderAddresses.length; i += 5) {
          const batch = spenderAddresses.slice(i, i + 5);
          const results = await Promise.allSettled(
            batch.map(async (spender) => {
              const allowance = await contract.allowance(address, spender);
              return { spender, allowance };
            }),
          );
          for (const r of results) {
            if (r.status === "fulfilled" && r.value.allowance > 0n) {
              const { spender, allowance } = r.value;
              const info = KNOWN_SPENDERS[spender];
              const isUnlimited = allowance >= UNLIMITED_THRESHOLD;
              const balVal = Number(ethers.formatUnits(balance, token.decimals)) * token.priceUsd;
              const risk: TokenApproval["riskLevel"] = isUnlimited && !info ? "CRITICAL"
                : isUnlimited && !info?.verified ? "HIGH"
                : isUnlimited ? "MEDIUM" : "LOW";

              approvals.push({
                tokenAddress: token.address, tokenSymbol: token.symbol,
                spenderAddress: spender, spenderName: info?.name ?? "Unknown Contract",
                spenderVerified: info?.verified ?? false, allowance, isUnlimited,
                riskLevel: risk, riskReason: isUnlimited ? `Unlimited approval to ${info?.name || "unknown"}` : "Limited approval",
                valueAtRisk: balVal, tokenBalance: Number(ethers.formatUnits(balance, token.decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 }),
              });
            }
          }
          await sleep(150);
        }
      }

      // Scan recent Approval events for unknown spenders
      try {
        const latestBlock = await provider.getBlockNumber();
        const logs = await provider.getLogs({
          fromBlock: latestBlock - 28800, toBlock: latestBlock,
          topics: [ethers.id("Approval(address,address,uint256)"), ethers.zeroPadValue(address, 32)],
        });
        const existingIds = new Set(approvals.map((a) => `${a.tokenAddress.toLowerCase()}-${a.spenderAddress.toLowerCase()}`));
        for (const log of logs.slice(0, 20)) {
          const spender = "0x" + log.topics[2].slice(26);
          const id = `${log.address.toLowerCase()}-${spender.toLowerCase()}`;
          if (existingIds.has(id)) continue;
          try {
            const contract = new ethers.Contract(log.address, ERC20_ABI, provider);
            const [allowance, symbol, decimals, balance] = await Promise.all([
              contract.allowance(address, spender), contract.symbol().catch(() => "???"),
              contract.decimals().catch(() => 18), contract.balanceOf(address).catch(() => 0n),
            ]);
            if (allowance > 0n) {
              const isUnlimited = allowance >= UNLIMITED_THRESHOLD;
              const spInfo = KNOWN_SPENDERS[spender.toLowerCase()];
              const tokenInfo = tokens.find((t) => t.address.toLowerCase() === log.address.toLowerCase());
              approvals.push({
                tokenAddress: log.address, tokenSymbol: String(symbol),
                spenderAddress: spender, spenderName: spInfo?.name ?? "Unknown Contract",
                spenderVerified: spInfo?.verified ?? false, allowance, isUnlimited,
                riskLevel: isUnlimited && !spInfo ? "CRITICAL" : isUnlimited ? "MEDIUM" : "LOW",
                riskReason: "Discovered via on-chain event",
                valueAtRisk: Number(ethers.formatUnits(balance, Number(decimals))) * (tokenInfo?.priceUsd ?? 0),
                tokenBalance: Number(ethers.formatUnits(balance, Number(decimals))).toLocaleString(undefined, { maximumFractionDigits: 4 }),
              });
              existingIds.add(id);
            }
          } catch { /* skip */ }
        }
      } catch { /* skip event scan */ }

      approvals.sort((a, b) => {
        const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return order[a.riskLevel] - order[b.riskLevel] || b.valueAtRisk - a.valueAtRisk;
      });

      return {
        approvals, totalValueAtRisk: approvals.reduce((s, a) => s + a.valueAtRisk, 0),
        criticalCount: approvals.filter((a) => a.riskLevel === "CRITICAL").length,
        highCount: approvals.filter((a) => a.riskLevel === "HIGH").length,
        unlimitedCount: approvals.filter((a) => a.isUnlimited).length,
        scannedTokens: heldTokens.length, walletAddress: address,
      };
    },

    buildPrompt: (obs: SentinelObservation): string => {
      if (obs.approvals.length === 0) {
        return `Wallet ${obs.walletAddress} has 0 active approvals across ${obs.scannedTokens} tokens. Report status.`;
      }
      const list = obs.approvals.slice(0, 30).map((a) =>
        `- ${a.tokenSymbol} → ${a.spenderName} (${a.spenderAddress.slice(0, 10)}...) | ${a.isUnlimited ? "UNLIMITED" : "limited"} | verified=${a.spenderVerified} | risk=${a.riskLevel} | value=${formatUsd(a.valueAtRisk)}`
      ).join("\n");
      return `Wallet: ${obs.walletAddress}\nApprovals: ${obs.approvals.length} (Critical: ${obs.criticalCount}, High: ${obs.highCount})\nTotal value at risk: ${formatUsd(obs.totalValueAtRisk)}\n\n${list}\n\nAnalyze and recommend actions.`;
    },

    parseActions: (llmResponse: string, obs: SentinelObservation): PendingAction[] => {
      const actions: PendingAction[] = [];
      try {
        const parsed = JSON.parse(llmResponse);
        if (parsed.actions && Array.isArray(parsed.actions)) {
          for (const a of parsed.actions) {
            if (a.type === "revoke_approval" && a.tokenAddress && a.spenderAddress) {
              const match = obs.approvals.find(
                (ap) => ap.tokenAddress.toLowerCase() === a.tokenAddress.toLowerCase() && ap.spenderAddress.toLowerCase() === a.spenderAddress.toLowerCase(),
              );
              if (match) {
                actions.push(createAction("revoke_approval", a.description || `Revoke ${match.tokenSymbol} approval for ${match.spenderName}`,
                  (a.risk as PendingAction["risk"]) || match.riskLevel,
                  { tokenAddress: match.tokenAddress, spenderAddress: match.spenderAddress, tokenSymbol: match.tokenSymbol }, a.reason || match.riskReason));
              }
            }
          }
        }
      } catch { /* LLM unavailable */ }
      // Fallback: flag CRITICAL approvals
      if (actions.length === 0) {
        for (const a of obs.approvals.filter((x) => x.riskLevel === "CRITICAL")) {
          actions.push(createAction("revoke_approval", `Revoke ${a.tokenSymbol} approval for ${a.spenderName}`, "CRITICAL",
            { tokenAddress: a.tokenAddress, spenderAddress: a.spenderAddress, tokenSymbol: a.tokenSymbol }, a.riskReason));
        }
      }
      return actions;
    },

    execute: async (action: PendingAction, signer: unknown): Promise<{ txHash?: string; error?: string }> => {
      if (!signer) return { error: "No signer" };
      const { tokenAddress, spenderAddress, tokenSymbol } = action.params as { tokenAddress: string; spenderAddress: string; tokenSymbol: string };
      try {
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer as ethers.Signer);
        toast.loading(`Revoking ${tokenSymbol} approval...`, { id: "sentinel" });
        const tx = await contract.approve(spenderAddress, 0);
        toast.loading("Confirming...", { id: "sentinel" });
        const receipt = await tx.wait();
        toast.success(`Revoked ${tokenSymbol}`, { id: "sentinel" });
        return { txHash: receipt.hash };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed";
        toast.error(msg.includes("rejected") ? "Rejected by user" : msg, { id: "sentinel" });
        return { error: msg };
      }
    },
  };
}

// ─── Observation Panel ─────────────────────────────────────

function SentinelObservationPanel({ obs }: { obs: SentinelObservation | null }) {
  if (!obs || obs.approvals.length === 0) {
    return <p className="text-xs" style={{ color: "var(--text-muted)" }}>{obs ? `Scanned ${obs.scannedTokens} tokens — no approvals found.` : "Waiting for first scan..."}</p>;
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)" }}>
          <p className="text-lg font-bold" style={{ color: "#ef4444" }}>{obs.criticalCount + obs.highCount}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Risky Approvals</p>
        </div>
        <div className="p-2 rounded-lg" style={{ background: "rgba(249,115,22,0.08)" }}>
          <p className="text-lg font-bold" style={{ color: "#f59e0b" }}>{formatUsd(obs.totalValueAtRisk)}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Value at Risk</p>
        </div>
      </div>
      <div className="space-y-1 max-h-[280px] overflow-y-auto">
        {obs.approvals.slice(0, 20).map((a, i) => {
          const c = a.riskLevel === "CRITICAL" ? "#ef4444" : a.riskLevel === "HIGH" ? "#f97316" : a.riskLevel === "MEDIUM" ? "#eab308" : "#3b82f6";
          return (
            <div key={i} className="flex items-center gap-2 p-2 rounded text-xs" style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
              <span className="font-medium text-white">{a.tokenSymbol}</span>
              <span style={{ color: "var(--text-muted)" }}>→</span>
              <span className="truncate" style={{ color: "var(--text-secondary)" }}>{a.spenderName}</span>
              <span className="ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${c}15`, color: c }}>
                {a.isUnlimited ? "∞" : "LTD"} {a.riskLevel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export default function SentinelAgent({ bnbPrice }: { bnbPrice: number }) {
  const { address, signer, isConnected } = useWalletContext();
  const tool = useMemo(() => createSentinelTool(bnbPrice), [bnbPrice]);
  const agent = useAgentLoop<SentinelObservation>(tool, address, signer);

  return (
    <AgentShell
      name="Sentinel"
      icon={<ShieldCheck className="w-5 h-5" style={{ color: "#00d4f5" }} />}
      color="#00d4f5"
      state={agent.state}
      onStart={agent.start}
      onStop={agent.stop}
      onRunOnce={agent.runOnce}
      onApprove={agent.approveAction}
      onReject={agent.rejectAction}
      onClear={agent.clearThoughts}
      walletConnected={isConnected}
      observationPanel={<SentinelObservationPanel obs={agent.observations} />}
    />
  );
}
