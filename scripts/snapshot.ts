/**
 * scripts/snapshot.ts — Protector Hunt entrant snapshot.
 *
 * What it does:
 *   1. Pulls every wallet from the live leaderboard ZSET (Upstash Redis).
 *   2. For each wallet, queries on-chain $UNIQ balance at a SPECIFIC BSC block.
 *   3. Re-derives entry counts using the published formula (no soft-state read).
 *   4. Writes snapshots/<label>.json — the canonical input to draw.ts.
 *
 * The output is fully deterministic: anyone with the same block + the same
 * ENTRY_WEIGHTS + the same off-chain entries (which are public, also in Redis)
 * can reproduce it byte-for-byte.
 *
 * Usage:
 *   BSC_RPC_URL=...  UPSTASH_REDIS_REST_URL=...  UPSTASH_REDIS_REST_TOKEN=...  \
 *   SNAPSHOT_BLOCK=51234567  \
 *   npx ts-node scripts/snapshot.ts day0
 *
 *   (omit SNAPSHOT_BLOCK to use the latest block)
 */

import { ethers } from "ethers";
import { promises as fs } from "fs";
import path from "path";

// ─── Config (mirrors frontend/src/lib/campaign-store.ts) ────
const UNIQ_TOKEN = "0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777";
const BSC_RPC = process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org";
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

const HOLD_THRESHOLDS = {
  TIER5:  10_000n,
  BRONZE: 50_000n,
  SILVER: 100_000n,
};
const ENTRY_WEIGHTS = {
  HOLD_TIER5: 5,
  HOLD_BRONZE: 10,
  HOLD_SILVER: 25,
};

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

interface SnapshotEntry {
  wallet: string;
  offchainEntries: number;   // entries from Redis (social/scan/tg/guardian/refs)
  uniqBalance: string;       // wei, at snapshotBlock
  uniqWhole: string;         // whole tokens (18 decimals)
  holdEntries: number;       // entries from hold tier (recomputed from balance)
  totalEntries: number;      // offchainEntries + holdEntries
  disqualified: boolean;
}

interface SnapshotFile {
  label: string;
  snapshotBlock: number;
  snapshotBlockHash: string;
  snapshotTimestamp: number;
  uniqToken: string;
  totalWallets: number;
  totalEligibleWallets: number;
  totalEntries: number;
  entries: SnapshotEntry[];
}

async function redis<T = unknown>(args: (string | number)[]): Promise<T | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error("UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN required");
  }
  const res = await fetch(UPSTASH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args.map(String)),
  });
  if (!res.ok) throw new Error(`Redis ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { result: T };
  return json.result ?? null;
}

function holdEntriesFor(balanceWhole: bigint): number {
  if (balanceWhole >= HOLD_THRESHOLDS.SILVER) return ENTRY_WEIGHTS.HOLD_SILVER;
  if (balanceWhole >= HOLD_THRESHOLDS.BRONZE) return ENTRY_WEIGHTS.HOLD_BRONZE;
  if (balanceWhole >= HOLD_THRESHOLDS.TIER5)  return ENTRY_WEIGHTS.HOLD_TIER5;
  return 0;
}

async function main() {
  const label = process.argv[2] || `snapshot-${Date.now()}`;
  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 56) {
    throw new Error(`Expected BSC mainnet (56), got chainId ${network.chainId}`);
  }

  // 1. Resolve snapshot block
  const targetBlock = process.env.SNAPSHOT_BLOCK
    ? Number(process.env.SNAPSHOT_BLOCK)
    : await provider.getBlockNumber();
  const block = await provider.getBlock(targetBlock);
  if (!block) throw new Error(`Block ${targetBlock} not found`);

  console.log(`\n📸 Snapshot @ block ${targetBlock} (${new Date(Number(block.timestamp) * 1000).toISOString()})`);

  // 2. Pull leaderboard ZSET (wallet → offchain entries)
  const raw = (await redis<string[]>([
    "ZREVRANGE",
    "aegis:campaign:leaderboard",
    0,
    -1,
    "WITHSCORES",
  ])) ?? [];

  const wallets: { wallet: string; offchainEntries: number }[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    wallets.push({ wallet: raw[i].toLowerCase(), offchainEntries: Number(raw[i + 1]) });
  }
  console.log(`📋 ${wallets.length} wallets in leaderboard`);

  // 3. Disqualified set
  const dqList = (await redis<string[]>(["SMEMBERS", "aegis:campaign:disqualified"])) ?? [];
  const dqSet = new Set(dqList.map((w) => w.toLowerCase()));
  console.log(`🚫 ${dqSet.size} disqualified wallets`);

  // 4. Batch balance reads at the snapshot block
  const uniq = new ethers.Contract(UNIQ_TOKEN, ERC20_ABI, provider);
  const entries: SnapshotEntry[] = [];
  const BATCH = 25;
  for (let i = 0; i < wallets.length; i += BATCH) {
    const slice = wallets.slice(i, i + BATCH);
    const balances = await Promise.all(
      slice.map((w) =>
        uniq.balanceOf(w.wallet, { blockTag: targetBlock }).catch(() => 0n),
      ),
    );
    slice.forEach((w, k) => {
      const balWei = BigInt(balances[k]);
      const balWhole = balWei / 10n ** 18n;
      const hold = holdEntriesFor(balWhole);
      entries.push({
        wallet: w.wallet,
        offchainEntries: w.offchainEntries,
        uniqBalance: balWei.toString(),
        uniqWhole: balWhole.toString(),
        holdEntries: hold,
        totalEntries: w.offchainEntries + hold,
        disqualified: dqSet.has(w.wallet),
      });
    });
    process.stdout.write(`\r  read ${Math.min(i + BATCH, wallets.length)}/${wallets.length} balances`);
  }
  process.stdout.write("\n");

  // 5. Compose output
  const eligible = entries.filter((e) => !e.disqualified && e.totalEntries > 0);
  const out: SnapshotFile = {
    label,
    snapshotBlock: targetBlock,
    snapshotBlockHash: block.hash || "",
    snapshotTimestamp: Number(block.timestamp),
    uniqToken: UNIQ_TOKEN,
    totalWallets: entries.length,
    totalEligibleWallets: eligible.length,
    totalEntries: eligible.reduce((s, e) => s + e.totalEntries, 0),
    entries: entries.sort((a, b) => a.wallet.localeCompare(b.wallet)), // canonical sort
  };

  const outDir = path.join(process.cwd(), "snapshots");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${label}.json`);
  await fs.writeFile(outPath, JSON.stringify(out, null, 2));

  console.log(`\n✅ ${outPath}`);
  console.log(`   wallets: ${out.totalWallets} (${out.totalEligibleWallets} eligible)`);
  console.log(`   total entries: ${out.totalEntries.toLocaleString()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
