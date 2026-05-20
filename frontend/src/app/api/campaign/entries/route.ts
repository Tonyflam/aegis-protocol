import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { CONTRACTS } from "@/lib/constants";
import { ERC20_ABI } from "@/lib/abis";
import { getSub } from "@/lib/telegram-store";
import { getSnapshot } from "@/lib/guardian-snapshot";
import {
  ENTRY_WEIGHTS,
  HOLD_THRESHOLDS,
  getCampaignScanCount,
  getSocialClaim,
  getQualifiedReferralCount,
  setReferrer,
  markReferralQualified,
  updateLeaderboard,
  markSeen,
  isDisqualified,
} from "@/lib/campaign-store";

export const dynamic = "force-dynamic";

const BSC_RPC = process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org";

interface EntryBreakdown {
  social: number;
  scan: number;
  guardian: number;
  telegram: number;
  hold: number;
  referral: number;
}

interface EntriesResponse {
  address: string;
  disqualified: boolean;
  socialClaimed: boolean;
  scanCount: number;
  guardianConnected: boolean;
  telegramLinked: boolean;
  uniqBalance: string;          // human-readable, e.g. "12345.67"
  uniqBalanceWei: string;       // raw wei as string
  holderTier: "None" | "Tier 5" | "Bronze" | "Silver";
  referralCount: number;        // qualified referrals
  paidTiersCompleted: number;   // how many of the 4 paid (non-social) tiers user did — used by referrer-qualify logic
  totalEntries: number;
  breakdown: EntryBreakdown;
}

async function getUniqBalance(wallet: string): Promise<bigint> {
  try {
    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    const token = new ethers.Contract(CONTRACTS.UNIQ_TOKEN, ERC20_ABI, provider);
    const bal: bigint = await token.balanceOf(wallet);
    return bal;
  } catch {
    return 0n;
  }
}

function tierFor(balanceWhole: bigint): { name: EntriesResponse["holderTier"]; entries: number } {
  if (balanceWhole >= HOLD_THRESHOLDS.SILVER) return { name: "Silver", entries: ENTRY_WEIGHTS.HOLD_SILVER };
  if (balanceWhole >= HOLD_THRESHOLDS.BRONZE) return { name: "Bronze", entries: ENTRY_WEIGHTS.HOLD_BRONZE };
  if (balanceWhole >= HOLD_THRESHOLDS.TIER5)  return { name: "Tier 5", entries: ENTRY_WEIGHTS.HOLD_TIER5 };
  return { name: "None", entries: 0 };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const refParam = searchParams.get("ref"); // optional incoming referrer

  if (!address || !ethers.isAddress(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
  const wallet = address.toLowerCase();

  // Optionally record referrer (first-wins). Self-refs and bad addresses are ignored.
  if (refParam && ethers.isAddress(refParam) && refParam.toLowerCase() !== wallet) {
    setReferrer(wallet, refParam.toLowerCase()).catch(() => {});
  }

  markSeen(wallet).catch(() => {});

  const disq = await isDisqualified(wallet);

  // Parallel reads
  const [social, scanCount, sub, snapshot, balanceWei] = await Promise.all([
    getSocialClaim(wallet),
    getCampaignScanCount(wallet),
    getSub(wallet),
    getSnapshot(wallet),
    getUniqBalance(wallet),
  ]);

  const socialClaimed = !!social;
  const telegramLinked = !!sub;
  const guardianConnected = !!snapshot;

  const balanceWhole = balanceWei / 10n ** 18n;
  const tier = tierFor(balanceWhole);

  const referralCount = await getQualifiedReferralCount(wallet);

  const breakdown: EntryBreakdown = {
    social: socialClaimed ? ENTRY_WEIGHTS.SOCIAL : 0,
    scan: Math.min(scanCount, ENTRY_WEIGHTS.SCAN_MAX) * ENTRY_WEIGHTS.SCAN_EACH,
    guardian: guardianConnected ? ENTRY_WEIGHTS.GUARDIAN : 0,
    telegram: telegramLinked ? ENTRY_WEIGHTS.TELEGRAM : 0,
    hold: tier.entries,
    referral: Math.min(referralCount, ENTRY_WEIGHTS.REF_MAX) * ENTRY_WEIGHTS.REF_EACH,
  };

  const totalEntries = disq
    ? 0
    : breakdown.social + breakdown.scan + breakdown.guardian +
      breakdown.telegram + breakdown.hold + breakdown.referral;

  // Count paid-tier completions (non-social tiers). When user crosses ≥2,
  // mark them as a "qualified referral" for whoever invited them.
  const paidTiersCompleted =
    (scanCount >= 1 ? 1 : 0) +
    (guardianConnected ? 1 : 0) +
    (telegramLinked ? 1 : 0) +
    (tier.name !== "None" ? 1 : 0);

  if (paidTiersCompleted >= 2 && !disq) {
    markReferralQualified(wallet).catch(() => {});
  }

  // Persist into leaderboard ZSET (deduped per-wallet score)
  updateLeaderboard(wallet, totalEntries).catch(() => {});

  const resp: EntriesResponse = {
    address: wallet,
    disqualified: disq,
    socialClaimed,
    scanCount,
    guardianConnected,
    telegramLinked,
    uniqBalance: ethers.formatUnits(balanceWei, 18),
    uniqBalanceWei: balanceWei.toString(),
    holderTier: tier.name,
    referralCount,
    paidTiersCompleted,
    totalEntries,
    breakdown,
  };

  return NextResponse.json(resp, {
    headers: { "Cache-Control": "no-store" },
  });
}
