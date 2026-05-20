"use client";

import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWalletContext } from "@/lib/WalletContext";
import { CAMPAIGN_CLAIM_ABI } from "@/lib/abis";

interface ClaimStatus {
  phase: "pre-draw" | "drawn-not-deployed" | "ready" | "winner" | "not-winner";
  contractAddress: string | null;
  drawnAtTimestamp: number | null;
  amount: string | null;
  amountHuman: string | null;
  tier: "grand" | "top" | "silver-rung" | "random" | "bounty" | null;
  proof: string[] | null;
  claimed: boolean;
  releasable: string | null;
  releasableHuman: string | null;
  vesting: {
    lockedTotal: string;
    released: string;
    startTs: number;
    fullyVestsAt: number;
  } | null;
}

const TIER_LABEL: Record<NonNullable<ClaimStatus["tier"]>, string> = {
  grand: "Grand Prize",
  top: "Top 2-6",
  "silver-rung": "Top 7-31",
  random: "Random draw",
  bounty: "Open Bounty",
};

function formatUniq(human: string | null): string {
  if (!human) return "—";
  const n = Number(human);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function VestingBar({ vest }: { vest: NonNullable<ClaimStatus["vesting"]> }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 5000);
    return () => clearInterval(id);
  }, []);
  const total = 14 * 24 * 60 * 60;
  const elapsed = Math.min(Math.max(now - vest.startTs, 0), total);
  const pct = (elapsed / total) * 100;
  const remainingSec = Math.max(vest.fullyVestsAt - now, 0);
  const days = Math.floor(remainingSec / 86400);
  const hours = Math.floor((remainingSec % 86400) / 3600);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px]" style={{ color: "var(--text-muted)" }}>
        <span>Vesting</span>
        <span>
          {remainingSec === 0 ? "fully vested" : `${days}d ${hours}h remaining`}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <div
          className="h-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--accent), var(--accent))",
          }}
        />
      </div>
    </div>
  );
}

export default function ClaimPanel() {
  const { address, isConnected, signer } = useWalletContext();
  const [status, setStatus] = useState<ClaimStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");

  const loadStatus = useCallback(async () => {
    if (!address) {
      setStatus(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/campaign/claim?address=${address}`, { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const onClaim = async () => {
    if (!signer || !status?.contractAddress || !status.amount || !status.proof) return;
    setBusy(true);
    setMsg("");
    setTxHash("");
    try {
      const c = new ethers.Contract(status.contractAddress, CAMPAIGN_CLAIM_ABI, signer);
      const tx = await c.claim(status.amount, status.proof);
      setTxHash(tx.hash);
      setMsg("Submitted — waiting for confirmation…");
      await tx.wait();
      setMsg("Done. 25% landed in your wallet. Remaining 75% vests over 14 days.");
      loadStatus();
    } catch (err) {
      const m = err instanceof Error ? err.message : "Transaction failed";
      setMsg(m.length > 140 ? m.slice(0, 140) + "…" : m);
    } finally {
      setBusy(false);
    }
  };

  const onRelease = async () => {
    if (!signer || !status?.contractAddress) return;
    setBusy(true);
    setMsg("");
    setTxHash("");
    try {
      const c = new ethers.Contract(status.contractAddress, CAMPAIGN_CLAIM_ABI, signer);
      const tx = await c.release();
      setTxHash(tx.hash);
      setMsg("Releasing vested $UNIQ…");
      await tx.wait();
      setMsg("Released. Funds in your wallet.");
      loadStatus();
    } catch (err) {
      const m = err instanceof Error ? err.message : "Transaction failed";
      setMsg(m.length > 140 ? m.slice(0, 140) + "…" : m);
    } finally {
      setBusy(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────
  return (
    <section className="px-6 sm:px-10 max-w-6xl mx-auto pb-8" id="claim">
      <div
        className="p-6 rounded-xl"
        style={{
          background: "var(--bg-raised)",
          border: "1px solid var(--accent-border)",
        }}
      >
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-2xl font-bold">Claim</h2>
          <div className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Open-source · Merkle · 25% instant / 75% 14-day vest
          </div>
        </div>

        {/* Not connected ─────────────────────────────────────── */}
        {!isConnected && (
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Connect your wallet above to check your claim status. Prizes ship through{" "}
            <a
              href="https://github.com/Tonyflam/aegis-protocol/blob/main/contracts/AegisCampaignClaim.sol"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)" }}
            >
              AegisCampaignClaim.sol
            </a>
            . 25% claimable on first signature, remaining 75% releases linearly over 14 days.
          </div>
        )}

        {/* Connected & loading ───────────────────────────────── */}
        {isConnected && loading && !status && (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>Checking your claim status…</div>
        )}

        {/* Pre-draw — contract not deployed yet ──────────────── */}
        {status?.phase === "pre-draw" && (
          <div className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            <div className="mb-2">
              <span className="inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider mr-2"
                style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
                Phase
              </span>
              The hunt is still running. The claim contract deploys on May 21. Winners are drawn Jun 1, 16:00 UTC.
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              When the draw is done, this panel will activate. You don&apos;t need to do anything in advance — just keep the
              same wallet connected.
            </div>
          </div>
        )}

        {/* Drawn but contract address still pending ──────────── */}
        {status?.phase === "drawn-not-deployed" && (
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Draw is complete. Pushing the Merkle root to the on-chain claim contract now — claim button activates within the next few minutes.
          </div>
        )}

        {/* Not a winner ──────────────────────────────────────── */}
        {status?.phase === "not-winner" && (
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            This wallet wasn&apos;t drawn this time. <strong style={{ color: "var(--text-primary)" }}>{leaderTotal()}</strong> wallets won across the 5 prize tiers.
            See the public winners list and the open-source draw script in the repo. Stay sharp — season 2 will run.
          </div>
        )}

        {/* Winner ────────────────────────────────────────────── */}
        {status?.phase === "winner" && status.amountHuman && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <Stat label="Tier" value={status.tier ? TIER_LABEL[status.tier] : "—"} />
              <Stat label="Prize" value={`${formatUniq(status.amountHuman)} $UNIQ`} accent />
              <Stat
                label={status.claimed ? "Releasable now" : "Instant on claim (25%)"}
                value={
                  status.claimed
                    ? `${formatUniq(status.releasableHuman)} $UNIQ`
                    : `${formatUniq(
                        status.amountHuman ? (Number(status.amountHuman) * 0.25).toString() : null,
                      )} $UNIQ`
                }
              />
            </div>

            {!status.claimed ? (
              <div className="space-y-2">
                <button
                  onClick={onClaim}
                  disabled={busy}
                  className="px-5 py-2.5 rounded font-semibold text-sm disabled:opacity-50 w-full sm:w-auto"
                  style={{ background: "var(--accent)", color: "var(--bg-base)" }}
                >
                  {busy ? "Confirming…" : "Claim 25% now"}
                </button>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Calling{" "}
                  <a
                    href={`https://bscscan.com/address/${status.contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)" }}
                  >
                    {status.contractAddress?.slice(0, 6)}…{status.contractAddress?.slice(-4)}
                  </a>{" "}
                  · 25 % transferred immediately · remaining 75 % locked into a 14-day linear vest you control.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {status.vesting && <VestingBar vest={status.vesting} />}
                <button
                  onClick={onRelease}
                  disabled={busy || !status.releasable || status.releasable === "0"}
                  className="px-5 py-2.5 rounded font-semibold text-sm disabled:opacity-50 w-full sm:w-auto"
                  style={{ background: "var(--accent)", color: "var(--bg-base)" }}
                >
                  {busy
                    ? "Confirming…"
                    : status.releasable && status.releasable !== "0"
                      ? `Release ${formatUniq(status.releasableHuman)} $UNIQ`
                      : "Nothing to release yet"}
                </button>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Vested $UNIQ accrues per second. Click any time — gas-only. Already released:{" "}
                  {status.vesting
                    ? formatUniq(ethers.formatUnits(BigInt(status.vesting.released), 18))
                    : "0"}{" "}
                  $UNIQ.
                </div>
              </div>
            )}

            {msg && (
              <div
                className="text-xs p-2 rounded"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  color: msg.toLowerCase().includes("done") || msg.toLowerCase().includes("released")
                    ? "var(--green)"
                    : "var(--text-secondary)",
                }}
              >
                {msg}
                {txHash && (
                  <>
                    {" · "}
                    <a
                      href={`https://bscscan.com/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--accent)" }}
                    >
                      tx
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="p-3 rounded-lg"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div
        className="text-lg font-bold tabular-nums"
        style={{ color: accent ? "var(--accent)" : "var(--text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

function leaderTotal(): string {
  return "151";
}
