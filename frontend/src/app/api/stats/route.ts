import { NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  isRedisConfigured,
  redisGetAnalytics,
  redisGetScanCount,
} from "@/lib/redis-store";
import { getAnalytics } from "@/lib/scan-tracker";
import { getSubCount } from "@/lib/telegram-store";

// ─── Aegis Public Stats ──────────────────────────────────────
// Aggregates real, current numbers for the landing page so we never
// have to hard-code vanity stats.
//
//   totalScans         → user-initiated scans counted by scan-tracker
//   monitoredWallets   → wallets subscribed to Guardian Telegram alerts
//   totalActions       → on-chain vault actions executed
//   totalProtected     → BNB total value protected by the vault
//   uniqHolders        → cached holder count for $UNIQ
//   contractsDeployed  → count of canonical mainnet contracts
//   network            → "mainnet" | "testnet"
//   latestDecisionAt   → unix seconds — proves the AI is alive

export const dynamic = "force-dynamic";
export const revalidate = 60;

const IS_MAINNET = process.env.NEXT_PUBLIC_CHAIN_ID === "56";
const RPC_URL =
  process.env.BSC_RPC ||
  (IS_MAINNET
    ? "https://bsc-dataseed1.binance.org"
    : "https://bsc-testnet-dataseed.bnbchain.org");

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || "";
const LOGGER_ADDRESS = process.env.NEXT_PUBLIC_LOGGER_ADDRESS || "";

const VAULT_ABI = [
  "function getVaultStats() view returns (uint256 totalBnbDeposited, uint256 totalActionsExecuted, uint256 totalValueProtected)",
];
const LOGGER_ABI = [
  "function getStats() view returns (uint256 totalDecisions, uint256 totalThreats, uint256 totalProtections)",
  "function getDecisionCount() view returns (uint256)",
  "function getDecision(uint256 decisionId) view returns (tuple(uint256 agentId, address targetUser, uint8 decisionType, uint8 riskLevel, uint256 confidence, bytes32 analysisHash, bytes32 dataHash, uint256 timestamp, bool actionTaken, uint256 actionId))",
];

export async function GET() {
  try {
    // Scan + Guardian-sub counts (Redis if configured, else in-memory fallback)
    let totalScans = 0;
    if (isRedisConfigured()) {
      // Prefer the precomputed analytics call when available.
      try {
        const a = await redisGetAnalytics({ includeGuardian: false });
        totalScans = a.totalScans ?? (await redisGetScanCount());
      } catch {
        totalScans = await redisGetScanCount();
      }
    } else {
      totalScans = getAnalytics().totalScans;
    }

    let monitoredWallets = 0;
    try {
      monitoredWallets = await getSubCount();
    } catch {
      monitoredWallets = 0;
    }

    // On-chain numbers (best-effort; never throw out of stats)
    let totalActions = 0;
    let totalProtectedBnb = "0";
    let latestDecisionAt: number | null = null;
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      if (VAULT_ADDRESS) {
        const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
        const [, totalActionsExecuted, totalValueProtected] = await vault
          .getVaultStats()
          .catch(() => [0n, 0n, 0n]);
        totalActions = Number(totalActionsExecuted);
        totalProtectedBnb = ethers.formatEther(totalValueProtected);
      }
      if (LOGGER_ADDRESS) {
        const logger = new ethers.Contract(LOGGER_ADDRESS, LOGGER_ABI, provider);
        const decisionCount = Number(
          await logger.getDecisionCount().catch(() => 0n)
        );
        if (decisionCount > 0) {
          const last = await logger
            .getDecision(decisionCount - 1)
            .catch(() => null);
          if (last) latestDecisionAt = Number(last.timestamp);
        }
      }
    } catch {
      // Tolerate RPC outage — return whatever we have.
    }

    return NextResponse.json({
      totalScans,
      monitoredWallets,
      totalActions,
      totalProtectedBnb,
      uniqHolders: 160, // last verified count; refresh via cron in a future patch
      contractsDeployed: 5,
      network: IS_MAINNET ? "mainnet" : "testnet",
      latestDecisionAt,
      generatedAt: Math.floor(Date.now() / 1000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "stats error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
