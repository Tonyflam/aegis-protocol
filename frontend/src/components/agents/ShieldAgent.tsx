"use client";

// ═══════════════════════════════════════════════════════════════
// Shield Agent — Autonomous Contract Firewall
// THINKS: Uses LLM to reason about contract security analysis
// OBSERVES: Analyzes bytecode, honeypots, liquidity, ownership
// DECIDES: Warns user about dangerous contracts they've interacted with
// ACTS: Can block interactions by revoking related approvals
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from "react";
import { ethers } from "ethers";
import { useWalletContext } from "../../lib/WalletContext";
import { useAgentLoop, type AgentTool } from "../../lib/agents/useAgentLoop";
import AgentShell from "../../lib/agents/AgentShell";
import { createAction, type PendingAction } from "../../lib/agents/brain";
import { Shield, Search } from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ──────────────────────────────────────────────────

interface ContractAnalysis {
  address: string;
  name: string;
  symbol: string;
  riskScore: number;
  riskLevel: "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "SCAM";
  isHoneypot: boolean | null;
  buyTax: number;
  sellTax: number;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isProxy: boolean;
  hasSelfDestruct: boolean;
  hasDelegatecall: boolean;
  isVerified: boolean;
  flags: string[];
  liquidity: number;
}

interface ShieldObservation {
  recentInteractions: string[];
  analyses: ContractAnalysis[];
  dangerousContracts: number;
  walletAddress: string;
  manualTarget: string | null;
}

// ─── Constants ──────────────────────────────────────────────

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

const FACTORY_ABI = ["function getPair(address, address) view returns (address)"];
const PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

const DANGEROUS_SELECTORS = [
  { selector: "40c10f19", name: "mint(address,uint256)", flag: "Owner can mint tokens" },
  { selector: "8456cb59", name: "pause()", flag: "Owner can freeze trading" },
  { selector: "44337ea1", name: "setBlacklist(address,bool)", flag: "Owner can blacklist" },
];



const SAFE_TOKENS = new Set([
  WBNB.toLowerCase(),
  "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
  "0x55d398326f99059ff775485246999027b3197955", // USDT
  "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", // CAKE
  "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // ETH
  "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", // BTCB
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
]);

// ─── Analysis Engine ────────────────────────────────────────

async function analyzeContract(addr: string, bnbPrice: number): Promise<ContractAnalysis> {
  const provider = new ethers.JsonRpcProvider(BSC_RPC, 56, { staticNetwork: true });
  const flags: string[] = [];
  let riskScore = 0;

  // Basic token info
  const contract = new ethers.Contract(addr, ERC20_ABI, provider);
  const [name, symbol, totalSupply, bytecode] = await Promise.all([
    contract.name().catch(() => "Unknown"),
    contract.symbol().catch(() => "???"),
    contract.totalSupply().catch(() => 0n),
    provider.getCode(addr),
  ]);

  const isToken = symbol !== "???" && totalSupply > 0n;

  // Bytecode analysis
  const code = bytecode.toLowerCase().slice(2);
  let ownerCanMint = false, ownerCanPause = false, ownerCanBlacklist = false;
  let hasSelfDestruct = false, hasDelegatecall = false, isProxy = false;

  for (const sel of DANGEROUS_SELECTORS) {
    if (code.includes(sel.selector)) {
      flags.push(sel.flag);
      if (sel.selector === "40c10f19") { ownerCanMint = true; riskScore += 15; }
      if (sel.selector === "8456cb59") { ownerCanPause = true; riskScore += 20; }
      if (sel.selector === "44337ea1") { ownerCanBlacklist = true; riskScore += 25; }
    }
  }

  if (code.includes("ff")) { hasSelfDestruct = true; flags.push("Has selfdestruct"); riskScore += 30; }
  if (code.includes("f4")) { hasDelegatecall = true; }
  if (code.includes("363d3d373d3d3d363d73") || code.includes("5155f3")) { isProxy = true; flags.push("Proxy contract"); riskScore += 10; }
  if (code.length < 100) { flags.push("Minimal bytecode"); riskScore += 20; }

  // Honeypot check
  let isHoneypot: boolean | null = null;
  let buyTax = 0, sellTax = 0;
  if (isToken) {
    try {
      const hpRes = await fetch(`https://api.honeypot.is/v2/IsHoneypot?address=${addr}&chainID=56`);
      if (hpRes.ok) {
        const hp = await hpRes.json();
        isHoneypot = hp.honeypotResult?.isHoneypot ?? null;
        buyTax = (hp.simulationResult?.buyTax ?? 0) * 100;
        sellTax = (hp.simulationResult?.sellTax ?? 0) * 100;
        if (isHoneypot) { flags.push("HONEYPOT DETECTED"); riskScore += 50; }
        if (buyTax > 10) { flags.push(`High buy tax: ${buyTax.toFixed(1)}%`); riskScore += 15; }
        if (sellTax > 10) { flags.push(`High sell tax: ${sellTax.toFixed(1)}%`); riskScore += 15; }
      }
    } catch { /* skip */ }
  }

  // Liquidity check via PancakeSwap
  let liquidity = 0;
  if (isToken) {
    try {
      const factory = new ethers.Contract(PANCAKE_FACTORY, FACTORY_ABI, provider);
      const pairAddr = await factory.getPair(addr, WBNB);
      if (pairAddr !== ethers.ZeroAddress) {
        const pair = new ethers.Contract(pairAddr, PAIR_ABI, provider);
        const [reserves, token0] = await Promise.all([pair.getReserves(), pair.token0()]);
        const bnbReserve = token0.toLowerCase() === WBNB.toLowerCase()
          ? Number(ethers.formatEther(reserves[0]))
          : Number(ethers.formatEther(reserves[1]));
        liquidity = bnbReserve * 2 * (bnbPrice || 600);
      }
    } catch { /* skip */ }
    if (liquidity < 5000) { flags.push("Very low liquidity"); riskScore += 20; }
  }

  // GoPlusLabs security
  let isVerified = false;
  if (isToken) {
    try {
      const gpRes = await fetch(`https://api.gopluslabs.com/api/v1/token_security/56?contract_addresses=${addr}`);
      if (gpRes.ok) {
        const gp = await gpRes.json();
        const info = gp.result?.[addr.toLowerCase()];
        if (info) {
          isVerified = info.is_open_source === "1";
          if (info.is_open_source !== "1") { flags.push("Unverified source code"); riskScore += 10; }
          if (info.owner_change_balance === "1") { flags.push("Owner can change balances"); riskScore += 25; }
          if (info.hidden_owner === "1") { flags.push("Hidden owner"); riskScore += 20; }
          if (info.can_take_back_ownership === "1") { flags.push("Recoverable ownership"); riskScore += 15; }
        }
      }
    } catch { /* skip */ }
  }

  // Safe token override
  if (SAFE_TOKENS.has(addr.toLowerCase())) riskScore = Math.min(riskScore, 5);

  riskScore = Math.min(100, riskScore);
  const riskLevel: ContractAnalysis["riskLevel"] = riskScore >= 80 ? "SCAM" : riskScore >= 60 ? "CRITICAL" : riskScore >= 40 ? "HIGH" : riskScore >= 20 ? "MEDIUM" : riskScore >= 10 ? "LOW" : "SAFE";

  return {
    address: addr, name: String(name), symbol: String(symbol), riskScore, riskLevel,
    isHoneypot, buyTax, sellTax, ownerCanMint, ownerCanPause, ownerCanBlacklist,
    isProxy, hasSelfDestruct, hasDelegatecall, isVerified, flags, liquidity,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Agent Tool ─────────────────────────────────────────────

let pendingManualTarget: string | null = null;

function createShieldTool(bnbPrice: number): AgentTool<ShieldObservation> {
  return {
    name: "Shield",
    interval: 90000,

    systemPrompt: `You are the Shield Agent — an autonomous contract security firewall for BNB Smart Chain.

Your job: Analyze smart contracts the user interacts with and identify dangers.

For each contract analyzed, you evaluate:
- Honeypot status (can't sell tokens after buying)
- Buy/sell taxes (anything over 5% is suspicious)
- Owner powers (mint, pause, blacklist = red flags)
- Proxy patterns (upgradeable = potential rug)
- Self-destruct capability (contract can vanish with funds)
- Liquidity depth (low liquidity = easy manipulation)
- Source verification (unverified = suspicious)

Respond with ONLY valid JSON:
{
  "summary": "Overall security assessment",
  "threats": ["list of threats"],
  "actions": [
    {
      "type": "warn_contract",
      "contractAddress": "0x...",
      "reason": "Why this is dangerous",
      "risk": "CRITICAL|HIGH|MEDIUM|LOW",
      "description": "Warning about CONTRACT_NAME"
    }
  ]
}`,

    observe: async (address: string | null): Promise<ShieldObservation> => {
      const analyses: ContractAnalysis[] = [];
      const recentInteractions: string[] = [];

      // Manual target analysis (user pasted an address)
      const manualTarget = pendingManualTarget;
      pendingManualTarget = null;

      if (manualTarget) {
        try {
          const report = await analyzeContract(manualTarget, bnbPrice);
          analyses.push(report);
        } catch { /* skip */ }
      }

      // Auto-discover: scan recent transactions for contract interactions
      if (address) {
        try {
          const provider = new ethers.JsonRpcProvider(BSC_RPC, 56, { staticNetwork: true });
          const latestBlock = await provider.getBlockNumber();
          const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
          const paddedAddr = ethers.zeroPadValue(address, 32);

          // Find tokens received recently (potential new interactions)
          const logs = await provider.getLogs({
            fromBlock: latestBlock - 7200, // ~6 hours
            toBlock: latestBlock,
            topics: [TRANSFER_TOPIC, null, paddedAddr],
          });

          const seenContracts = new Set(analyses.map((a) => a.address.toLowerCase()));
          const uniqueTokens = [...new Set(logs.map((l) => l.address.toLowerCase()))]
            .filter((a) => !SAFE_TOKENS.has(a) && !seenContracts.has(a))
            .slice(0, 3); // Analyze up to 3 new contracts per cycle

          for (const tokenAddr of uniqueTokens) {
            try {
              const report = await analyzeContract(tokenAddr, bnbPrice);
              analyses.push(report);
              recentInteractions.push(tokenAddr);
              await sleep(500);
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }

      return {
        recentInteractions,
        analyses,
        dangerousContracts: analyses.filter((a) => a.riskScore >= 40).length,
        walletAddress: address || "",
        manualTarget,
      };
    },

    buildPrompt: (obs: ShieldObservation): string => {
      if (obs.analyses.length === 0) {
        return `No contracts to analyze this cycle. Wallet ${obs.walletAddress} has no new interactions detected.`;
      }
      const reports = obs.analyses.map((a) => {
        return `CONTRACT: ${a.name} (${a.symbol}) — ${a.address}
  Risk: ${a.riskScore}/100 (${a.riskLevel})
  Honeypot: ${a.isHoneypot === true ? "YES" : a.isHoneypot === false ? "No" : "Unknown"}
  Buy Tax: ${a.buyTax.toFixed(1)}% | Sell Tax: ${a.sellTax.toFixed(1)}%
  Mint: ${a.ownerCanMint} | Pause: ${a.ownerCanPause} | Blacklist: ${a.ownerCanBlacklist}
  Proxy: ${a.isProxy} | SelfDestruct: ${a.hasSelfDestruct} | DelegateCall: ${a.hasDelegatecall}
  Verified: ${a.isVerified} | Liquidity: $${a.liquidity.toLocaleString()}
  Flags: ${a.flags.join(", ") || "None"}`;
      }).join("\n\n");

      return `Analyze these BSC contracts:\n\n${reports}\n\nFor each dangerous contract, recommend a warn_contract action.`;
    },

    parseActions: (llmResponse: string, obs: ShieldObservation): PendingAction[] => {
      const actions: PendingAction[] = [];
      try {
        const parsed = JSON.parse(llmResponse);
        if (parsed.actions && Array.isArray(parsed.actions)) {
          for (const a of parsed.actions) {
            if (a.type === "warn_contract" && a.contractAddress) {
              actions.push(createAction("warn_contract",
                a.description || `Warning: dangerous contract ${a.contractAddress.slice(0, 10)}...`,
                (a.risk as PendingAction["risk"]) || "HIGH",
                { contractAddress: a.contractAddress }, a.reason || "Flagged as risky"));
            }
          }
        }
      } catch { /* skip */ }
      // Fallback: auto-flag honeypots and scams
      if (actions.length === 0) {
        for (const a of obs.analyses.filter((x) => x.riskLevel === "SCAM" || x.riskLevel === "CRITICAL" || x.isHoneypot)) {
          actions.push(createAction("warn_contract",
            `⚠️ ${a.name} (${a.symbol}) — ${a.riskLevel}${a.isHoneypot ? " HONEYPOT" : ""}`,
            a.riskLevel === "SCAM" ? "CRITICAL" : "HIGH",
            { contractAddress: a.address }, a.flags.slice(0, 3).join(", ")));
        }
      }
      return actions;
    },

    execute: async (action: PendingAction): Promise<{ txHash?: string; error?: string }> => {
      // Shield warnings are informational — no tx needed
      toast.success(`Acknowledged: ${action.description}`, { duration: 5000 });
      return {};
    },
  };
}

// ─── Observation Panel ─────────────────────────────────────

function ShieldObservationPanel({ obs }: { obs: ShieldObservation | null }) {
  if (!obs || obs.analyses.length === 0) {
    return <p className="text-xs" style={{ color: "var(--text-muted)" }}>No contracts analyzed yet. Start the agent or enter an address below.</p>;
  }
  return (
    <div className="space-y-2 max-h-[350px] overflow-y-auto">
      {obs.analyses.map((a, i) => {
        const color = a.riskScore >= 60 ? "#ef4444" : a.riskScore >= 40 ? "#f97316" : a.riskScore >= 20 ? "#eab308" : "#22c55e";
        return (
          <div key={i} className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", borderLeft: `3px solid ${color}` }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-white">{a.name} ({a.symbol})</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: `${color}15`, color }}>
                {a.riskScore}/100 {a.riskLevel}
              </span>
            </div>
            <p className="text-[10px] font-mono mb-2" style={{ color: "var(--text-muted)" }}>{a.address}</p>
            <div className="flex flex-wrap gap-1.5">
              {a.isHoneypot && <Tag color="#ef4444">HONEYPOT</Tag>}
              {a.ownerCanMint && <Tag color="#f97316">Can Mint</Tag>}
              {a.ownerCanPause && <Tag color="#f97316">Can Pause</Tag>}
              {a.ownerCanBlacklist && <Tag color="#ef4444">Can Blacklist</Tag>}
              {a.hasSelfDestruct && <Tag color="#ef4444">SelfDestruct</Tag>}
              {a.isProxy && <Tag color="#eab308">Proxy</Tag>}
              {a.sellTax > 5 && <Tag color="#f97316">{a.sellTax.toFixed(0)}% Sell Tax</Tag>}
              {a.liquidity > 0 && a.liquidity < 10000 && <Tag color="#eab308">Low Liquidity</Tag>}
              {a.isVerified && <Tag color="#22c55e">Verified</Tag>}
              {!a.isVerified && <Tag color="#f97316">Unverified</Tag>}
              {a.riskLevel === "SAFE" && <Tag color="#22c55e">SAFE</Tag>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color }}>{children}</span>;
}

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export default function ShieldAgent({ bnbPrice }: { bnbPrice: number }) {
  const { address, signer, isConnected } = useWalletContext();
  const [manualInput, setManualInput] = useState("");

  const tool = useMemo(() => createShieldTool(bnbPrice), [bnbPrice]);
  const agent = useAgentLoop<ShieldObservation>(tool, address, signer);

  const handleManualScan = useCallback(() => {
    const trimmed = manualInput.trim();
    if (!ethers.isAddress(trimmed)) {
      toast.error("Invalid BSC address");
      return;
    }
    pendingManualTarget = trimmed;
    agent.runOnce();
    setManualInput("");
  }, [manualInput, agent]);

  const extraControls = (
    <div className="card p-4" style={{ borderRadius: "12px" }}>
      <p className="text-xs font-medium text-white mb-2 flex items-center gap-2">
        <Search className="w-3.5 h-3.5" style={{ color: "#a855f7" }} />
        Analyze a specific contract
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleManualScan()}
          placeholder="Paste BSC contract address (0x...)"
          className="flex-1 px-3 py-2 rounded-lg text-xs bg-transparent outline-none"
          style={{ border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
        />
        <button
          onClick={handleManualScan}
          className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
          style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7" }}
        >
          Analyze
        </button>
      </div>
    </div>
  );

  return (
    <AgentShell
      name="Shield"
      icon={<Shield className="w-5 h-5" style={{ color: "#a855f7" }} />}
      color="#a855f7"
      state={agent.state}
      onStart={agent.start}
      onStop={agent.stop}
      onRunOnce={agent.runOnce}
      onApprove={agent.approveAction}
      onReject={agent.rejectAction}
      onClear={agent.clearThoughts}
      walletConnected={isConnected}
      observationPanel={<ShieldObservationPanel obs={agent.observations} />}
      extraControls={extraControls}
    />
  );
}
