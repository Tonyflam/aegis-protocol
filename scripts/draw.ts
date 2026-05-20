/**
 * scripts/draw.ts — Protector Hunt deterministic winner draw.
 *
 * Input:
 *   - snapshots/<label>.json (from scripts/snapshot.ts)
 *   - DRAW_BLOCK env var = a future BSC block number whose hash will seed RNG
 *
 * Output:
 *   - draws/<label>.json — full audit trail (rng seed, every roll, every winner)
 *   - frontend/public/winners.json — minimal claim-API payload (root + winners + amounts)
 *
 * Determinism guarantee:
 *   Given the same snapshot + the same DRAW_BLOCK + the same prize table, this
 *   script produces byte-identical output. Anyone can re-run and verify.
 *
 * Prize tiers (matches CAMPAIGN_PROTECTOR_HUNT.md):
 *   - 1   grand        × 5,000,000 $UNIQ + Silver pass
 *   - 5   top          × 1,000,000 $UNIQ + Bronze pass
 *   - 25  silver-rung  × 200,000   $UNIQ
 *   - 100 random       × 100,000   $UNIQ
 *   - up to 10 bounty  × 50,000    $UNIQ (NOT awarded here — manual via bounty CLI)
 *
 * Total guaranteed: 25,000,000 $UNIQ across 131 winners. 10 bounty slots
 * (5,000,000 $UNIQ) reserved + awarded by hand → 141 max via this script,
 * +10 manual bounty = 151 max total winners.
 *
 * Selection rule:
 *   Build a weighted ticket pool where each wallet appears `totalEntries` times.
 *   The grand prize is drawn first, then 5 top, then 25 silver-rung, then 100
 *   random — each wallet wins at most once across all tiers in this script.
 *
 * Usage:
 *   DRAW_BLOCK=51999999 npx ts-node scripts/draw.ts day0
 */

import { ethers } from "ethers";
import { promises as fs } from "fs";
import path from "path";

const BSC_RPC = process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org";

interface SnapshotEntry {
  wallet: string;
  totalEntries: number;
  disqualified: boolean;
}
interface SnapshotFile {
  label: string;
  snapshotBlock: number;
  snapshotBlockHash: string;
  totalEligibleWallets: number;
  totalEntries: number;
  entries: SnapshotEntry[];
}

type Tier = "grand" | "top" | "silver-rung" | "random";

interface Winner {
  address: string;
  tier: Tier;
  amount: string;   // wei
  amountWhole: number;
  rollIndex: number;
}

interface DrawFile {
  label: string;
  snapshotBlock: number;
  snapshotBlockHash: string;
  drawBlock: number;
  drawBlockHash: string;
  drawTimestamp: number;
  rngSeed: string;
  totalTicketsBeforeDraw: number;
  merkleRoot: string;
  winners: Winner[];
}

const PRIZE_TABLE: { tier: Tier; count: number; uniq: number }[] = [
  { tier: "grand",       count: 1,   uniq: 5_000_000 },
  { tier: "top",         count: 5,   uniq: 1_000_000 },
  { tier: "silver-rung", count: 25,  uniq: 200_000   },
  { tier: "random",      count: 100, uniq: 100_000   },
];

// ─── Deterministic RNG (xorshift128+, seeded from keccak) ───
function makeRng(seedHex: string) {
  const seed = BigInt(seedHex);
  let s0 = seed & ((1n << 64n) - 1n);
  let s1 = (seed >> 64n) & ((1n << 64n) - 1n);
  if (s0 === 0n) s0 = 1n;
  if (s1 === 0n) s1 = 2n;
  const MASK = (1n << 64n) - 1n;
  return function next(maxExclusive: bigint): bigint {
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= (x << 23n) & MASK;
    s1 = (x ^ y ^ (x >> 17n) ^ (y >> 26n)) & MASK;
    const out = (s1 + y) & MASK;
    return out % maxExclusive;
  };
}

// ─── Merkle tree (matches AegisCampaignClaim.sol leaf hash) ─
function leafOf(address: string, amount: bigint): Buffer {
  return Buffer.from(
    ethers.solidityPackedKeccak256(["address", "uint256"], [address, amount]).slice(2),
    "hex",
  );
}
function hashPair(a: Buffer, b: Buffer): Buffer {
  const [lo, hi] = a.compare(b) < 0 ? [a, b] : [b, a];
  return Buffer.from(
    ethers.keccak256(ethers.concat([lo, hi])).slice(2),
    "hex",
  );
}
function merkleRoot(leaves: Buffer[]): string {
  if (leaves.length === 0) return ethers.ZeroHash;
  let layer = leaves;
  while (layer.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const a = layer[i];
      const b = i + 1 < layer.length ? layer[i + 1] : layer[i];
      next.push(hashPair(a, b));
    }
    layer = next;
  }
  return "0x" + layer[0].toString("hex");
}

async function main() {
  const label = process.argv[2];
  if (!label) throw new Error("Usage: npx ts-node scripts/draw.ts <label>");

  const snapPath = path.join(process.cwd(), "snapshots", `${label}.json`);
  const snap = JSON.parse(await fs.readFile(snapPath, "utf8")) as SnapshotFile;

  // ─── Get draw block hash ───────────────────────────────────
  const drawBlockNum = Number(process.env.DRAW_BLOCK);
  if (!Number.isFinite(drawBlockNum) || drawBlockNum <= snap.snapshotBlock) {
    throw new Error(`DRAW_BLOCK env required and must be > snapshot block ${snap.snapshotBlock}`);
  }
  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const drawBlock = await provider.getBlock(drawBlockNum);
  if (!drawBlock || !drawBlock.hash) throw new Error(`Draw block ${drawBlockNum} not yet finalized`);

  // ─── Seed = keccak(snapshotBlockHash || drawBlockHash) ────
  const seedHex = ethers.keccak256(
    ethers.concat([snap.snapshotBlockHash, drawBlock.hash]),
  );
  const rng = makeRng(seedHex);

  console.log(`🎲 Draw "${label}"`);
  console.log(`   snapshot block: ${snap.snapshotBlock} (${snap.snapshotBlockHash})`);
  console.log(`   draw block:     ${drawBlockNum} (${drawBlock.hash})`);
  console.log(`   rng seed:       ${seedHex}`);

  // ─── Build ticket pool ────────────────────────────────────
  // Use cumulative weights instead of expanding the array — O(log n) per draw.
  const eligible = snap.entries.filter((e) => !e.disqualified && e.totalEntries > 0);
  const cumWeights: bigint[] = [];
  let acc = 0n;
  for (const e of eligible) {
    acc += BigInt(e.totalEntries);
    cumWeights.push(acc);
  }
  const totalTickets = acc;
  console.log(`   eligible wallets: ${eligible.length}`);
  console.log(`   total tickets:    ${totalTickets.toString()}`);

  if (totalTickets === 0n) throw new Error("No eligible tickets");

  // Binary search a cumulative-weights array
  function pickTicket(): number {
    const roll = rng(totalTickets);
    let lo = 0, hi = cumWeights.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (roll < cumWeights[mid]) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  // ─── Draw winners tier-by-tier, no duplicates ─────────────
  const winners: Winner[] = [];
  const taken = new Set<number>();
  let rollIndex = 0;
  for (const tier of PRIZE_TABLE) {
    for (let i = 0; i < tier.count; ++i) {
      // Re-roll on collision (rare — needs total wallets >> total winners)
      let idx = pickTicket();
      let guard = 0;
      while (taken.has(idx)) {
        idx = pickTicket();
        if (++guard > 10_000) throw new Error("Cannot find unique winner — pool too thin");
      }
      taken.add(idx);
      const w = eligible[idx];
      const amtWei = BigInt(tier.uniq) * 10n ** 18n;
      winners.push({
        address: ethers.getAddress(w.wallet), // checksummed
        tier: tier.tier,
        amount: amtWei.toString(),
        amountWhole: tier.uniq,
        rollIndex: rollIndex++,
      });
    }
  }

  // ─── Build Merkle tree (sorted by lowercase address — must match API + contract) ─
  const sortedWinners = [...winners].sort((a, b) =>
    a.address.toLowerCase().localeCompare(b.address.toLowerCase()),
  );
  const leaves = sortedWinners.map((w) => leafOf(w.address, BigInt(w.amount)));
  const root = merkleRoot(leaves);

  console.log(`   merkle root:      ${root}`);
  console.log(`   winners:          ${winners.length}`);

  // ─── Write draws/<label>.json (full audit) ─────────────────
  const drawOut: DrawFile = {
    label,
    snapshotBlock: snap.snapshotBlock,
    snapshotBlockHash: snap.snapshotBlockHash,
    drawBlock: drawBlockNum,
    drawBlockHash: drawBlock.hash,
    drawTimestamp: Number(drawBlock.timestamp),
    rngSeed: seedHex,
    totalTicketsBeforeDraw: Number(totalTickets),
    merkleRoot: root,
    winners,
  };
  const drawDir = path.join(process.cwd(), "draws");
  await fs.mkdir(drawDir, { recursive: true });
  await fs.writeFile(path.join(drawDir, `${label}.json`), JSON.stringify(drawOut, null, 2));

  // ─── Write public/winners.json (claim-API payload) ────────
  const publicOut = {
    drawnAtBlock: drawBlockNum,
    drawnAtTimestamp: Number(drawBlock.timestamp),
    merkleRoot: root,
    winners: sortedWinners.map((w) => ({
      address: w.address,
      amount: w.amount,
      tier: w.tier,
    })),
  };
  const publicPath = path.join(process.cwd(), "frontend", "public", "winners.json");
  await fs.writeFile(publicPath, JSON.stringify(publicOut, null, 2));

  console.log(`\n✅ draws/${label}.json`);
  console.log(`✅ frontend/public/winners.json`);
  console.log(`\nNext: AegisCampaignClaim.setMerkleRoot("${root}")`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
