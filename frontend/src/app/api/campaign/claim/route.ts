import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { promises as fs } from "fs";
import path from "path";
import { CONTRACTS } from "@/lib/constants";
import { CAMPAIGN_CLAIM_ABI } from "@/lib/abis";

export const dynamic = "force-dynamic";

const BSC_RPC = process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org";

interface WinnerEntry {
  address: string;
  amount: string; // base-units (wei) as decimal string
  tier: "grand" | "top" | "silver-rung" | "random" | "bounty";
}
interface WinnersFile {
  drawnAtBlock: number | null;
  drawnAtTimestamp: number | null;
  merkleRoot: string | null;
  winners: WinnerEntry[];
}

interface ClaimStatusResponse {
  // Phase: where in the lifecycle we are
  phase: "pre-draw" | "drawn-not-deployed" | "ready" | "winner" | "not-winner";
  contractAddress: string | null;
  drawnAtTimestamp: number | null;
  // Winner-specific
  amount: string | null;         // total prize (wei)
  amountHuman: string | null;    // human-readable $UNIQ
  tier: WinnerEntry["tier"] | null;
  proof: string[] | null;        // Merkle proof for claim()
  // On-chain state (only when contract deployed + winner)
  claimed: boolean;
  releasable: string | null;     // wei
  releasableHuman: string | null;
  vesting: {
    lockedTotal: string;
    released: string;
    startTs: number;
    fullyVestsAt: number;
  } | null;
}

// ─── Merkle helpers (must match contract verification) ───────
function leafOf(address: string, amount: bigint): Buffer {
  return Buffer.from(
    ethers.solidityPackedKeccak256(["address", "uint256"], [address, amount]).slice(2),
    "hex",
  );
}

function buildTree(leaves: Buffer[]): Buffer[][] {
  const layers: Buffer[][] = [leaves];
  while (layers[layers.length - 1].length > 1) {
    const prev = layers[layers.length - 1];
    const next: Buffer[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const a = prev[i];
      const b = i + 1 < prev.length ? prev[i + 1] : prev[i]; // duplicate last on odd
      const [lo, hi] = a.compare(b) < 0 ? [a, b] : [b, a];
      next.push(
        Buffer.from(
          ethers.keccak256(ethers.concat([lo, hi])).slice(2),
          "hex",
        ),
      );
    }
    layers.push(next);
  }
  return layers;
}

function proofFor(layers: Buffer[][], leafIndex: number): string[] {
  const proof: string[] = [];
  let idx = leafIndex;
  for (let l = 0; l < layers.length - 1; l++) {
    const layer = layers[l];
    const sibling = idx ^ 1; // pair index
    if (sibling < layer.length) {
      proof.push("0x" + layer[sibling].toString("hex"));
    }
    idx = Math.floor(idx / 2);
  }
  return proof;
}

async function loadWinners(): Promise<WinnersFile> {
  try {
    const p = path.join(process.cwd(), "public", "winners.json");
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw);
    return {
      drawnAtBlock: parsed.drawnAtBlock ?? null,
      drawnAtTimestamp: parsed.drawnAtTimestamp ?? null,
      merkleRoot: parsed.merkleRoot ?? null,
      winners: Array.isArray(parsed.winners) ? parsed.winners : [],
    };
  } catch {
    return { drawnAtBlock: null, drawnAtTimestamp: null, merkleRoot: null, winners: [] };
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address || !ethers.isAddress(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
  const wallet = address.toLowerCase();

  const file = await loadWinners();
  const contractDeployed = !!CONTRACTS.CAMPAIGN_CLAIM;
  const drawDone = file.winners.length > 0 && !!file.merkleRoot;

  // ─── Phase 1: pre-draw (no winners yet) ────────────────────
  if (!drawDone) {
    const resp: ClaimStatusResponse = {
      phase: contractDeployed ? "drawn-not-deployed" : "pre-draw",
      contractAddress: CONTRACTS.CAMPAIGN_CLAIM || null,
      drawnAtTimestamp: null,
      amount: null,
      amountHuman: null,
      tier: null,
      proof: null,
      claimed: false,
      releasable: null,
      releasableHuman: null,
      vesting: null,
    };
    return NextResponse.json(resp, { headers: { "Cache-Control": "no-store" } });
  }

  // ─── Phase 2: draw is done, look up winner ─────────────────
  const idx = file.winners.findIndex((w) => w.address.toLowerCase() === wallet);
  if (idx === -1) {
    const resp: ClaimStatusResponse = {
      phase: "not-winner",
      contractAddress: CONTRACTS.CAMPAIGN_CLAIM || null,
      drawnAtTimestamp: file.drawnAtTimestamp,
      amount: null,
      amountHuman: null,
      tier: null,
      proof: null,
      claimed: false,
      releasable: null,
      releasableHuman: null,
      vesting: null,
    };
    return NextResponse.json(resp, { headers: { "Cache-Control": "no-store" } });
  }

  const entry = file.winners[idx];
  // Build proof. Sort entries by address (must match draw.ts ordering).
  const sorted = [...file.winners].sort((a, b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()));
  const sortedIdx = sorted.findIndex((w) => w.address.toLowerCase() === wallet);
  const leaves = sorted.map((w) => leafOf(w.address, BigInt(w.amount)));
  const layers = buildTree(leaves);
  const proof = proofFor(layers, sortedIdx);

  // ─── On-chain reads ────────────────────────────────────────
  let claimed = false;
  let releasable: bigint = 0n;
  let vesting: ClaimStatusResponse["vesting"] = null;

  if (contractDeployed) {
    try {
      const provider = new ethers.JsonRpcProvider(BSC_RPC);
      const claim = new ethers.Contract(CONTRACTS.CAMPAIGN_CLAIM, CAMPAIGN_CLAIM_ABI, provider);
      const [c, r, v] = await Promise.all([
        claim.claimed(wallet),
        claim.releasable(wallet),
        claim.vesting(wallet),
      ]);
      claimed = !!c;
      releasable = BigInt(r);
      const startTs = Number(v.startTs);
      if (claimed && startTs > 0) {
        vesting = {
          lockedTotal: v.lockedTotal.toString(),
          released: v.released.toString(),
          startTs,
          fullyVestsAt: startTs + 14 * 24 * 60 * 60,
        };
      }
    } catch {
      // RPC blip — leave defaults
    }
  }

  const resp: ClaimStatusResponse = {
    phase: contractDeployed ? "winner" : "drawn-not-deployed",
    contractAddress: CONTRACTS.CAMPAIGN_CLAIM || null,
    drawnAtTimestamp: file.drawnAtTimestamp,
    amount: entry.amount,
    amountHuman: ethers.formatUnits(BigInt(entry.amount), 18),
    tier: entry.tier,
    proof,
    claimed,
    releasable: releasable.toString(),
    releasableHuman: ethers.formatUnits(releasable, 18),
    vesting,
  };
  return NextResponse.json(resp, { headers: { "Cache-Control": "no-store" } });
}
