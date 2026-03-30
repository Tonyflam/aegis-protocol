"use client";

import { useState, useEffect } from "react";
import { useWalletContext } from "../../lib/WalletContext";
import { useContractData, useContractWrite } from "../../lib/useContracts";
import { CONTRACTS, HOLDER_TIER_COLORS, HOLDER_TIER_THRESHOLDS } from "../../lib/constants";
import toast from "react-hot-toast";
import {
  Shield, Wallet, Bot, Eye, ExternalLink,
} from "lucide-react";

export default function PositionsPage() {
  const { address, isConnected, connect, provider, signer } = useWalletContext();
  const contractData = useContractData(provider);
  const contractWrite = useContractWrite(signer);
  const [depositAmount, setDepositAmount] = useState("");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isConnected && provider) contractData.fetchAll(address ?? undefined); }, [isConnected, provider, address]);
  useEffect(() => {
    if (!isConnected || !provider) return;
    const interval = setInterval(() => contractData.fetchAll(address ?? undefined), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, provider, address]);

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) { toast.error("Enter a valid amount"); return; }
    try {
      toast.loading("Depositing...", { id: "deposit" });
      await contractWrite.deposit(depositAmount);
      toast.success(`Deposited ${depositAmount} BNB`, { id: "deposit" });
      setDepositAmount("");
      contractData.fetchAll(address ?? undefined);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Deposit failed", { id: "deposit" }); }
  };

  const handleAuthorize = async () => {
    try {
      toast.loading("Authorizing agent...", { id: "auth" });
      await contractWrite.authorizeAgent(0);
      toast.success("Agent #0 authorized!", { id: "auth" });
      contractData.fetchAll(address ?? undefined);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Authorization failed", { id: "auth" }); }
  };

  const userPosition = contractData.userPosition;
  const { uniqBalance, uniqTier, effectiveFeeBps } = contractData;

  return (
    <div className="min-h-screen relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Eye className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Positions
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Manage your vault deposits, agent authorization, and $UNIQ benefits
            </p>
          </div>
          {contractData.isLive && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5" style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)" }}>
              <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} /> Connected
            </span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        <div className="space-y-4">
          {/* Connect Prompt */}
          {!isConnected && (
            <div className="card p-10 text-center">
              <Shield className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--accent)" }} />
              <h2 className="text-xl font-semibold text-white mb-2">Protect Your DeFi Position</h2>
              <p className="text-sm max-w-md mx-auto mb-6" style={{ color: "var(--text-secondary)" }}>
                Connect your wallet to deposit BNB, authorize your AI guardian, and protect your assets 24/7.
              </p>
              <button onClick={connect} className="btn-primary flex items-center gap-2 mx-auto">
                <Wallet className="w-4 h-4" /> Connect Wallet
              </button>
            </div>
          )}

          {/* Your Position */}
          {isConnected && contractData.isDeployed && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Wallet className="w-4 h-4" style={{ color: "var(--accent)" }} /> Your Position
                </h3>
                {contractData.isLive && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)" }}>LIVE</span>}
              </div>
              {userPosition?.isActive ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Balance", value: `${userPosition.bnbBalance} BNB` },
                      { label: "Agent", value: userPosition.agentAuthorized ? `#${userPosition.authorizedAgentId}` : "None" },
                      { label: "Stop-Loss", value: `${userPosition.riskProfile.stopLossThreshold / 100}%` },
                      { label: "Auto-Withdraw", value: userPosition.riskProfile.allowAutoWithdraw ? "Enabled" : "Disabled" },
                    ].map((s, i) => (
                      <div key={i} className="p-3 rounded-lg" style={{ background: "var(--bg-base)" }}>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                        <p className="text-sm font-semibold text-white">{s.value}</p>
                      </div>
                    ))}
                  </div>
                  {!userPosition.agentAuthorized && (
                    <button onClick={handleAuthorize} className="btn-primary flex items-center gap-2 text-xs">
                      <Bot className="w-3.5 h-3.5" /> Authorize Guardian Agent #0
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>No active position. Deposit BNB to get started.</p>
                  <div className="flex items-center gap-2 max-w-sm mx-auto">
                    <input type="number" step="0.01" placeholder="Amount (BNB)" value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none" style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }} />
                    <button onClick={handleDeposit} className="btn-primary flex items-center gap-1.5 text-xs">
                      <Wallet className="w-3.5 h-3.5" /> Deposit
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* $UNIQ Benefits */}
          {isConnected && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                <Eye className="w-4 h-4" style={{ color: "var(--accent)" }} /> $UNIQ Holder Benefits
              </h3>

              <div className="mb-5 p-4 rounded-lg" style={{ background: "var(--bg-base)" }}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-white">💎 $UNIQ Token Gate</h4>
                  <a href={`https://bscscan.com/token/${CONTRACTS.UNIQ_TOKEN}`} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center gap-1" style={{ color: "var(--accent)" }}>View <ExternalLink className="w-2.5 h-2.5" /></a>
                </div>

                {parseFloat(uniqBalance) > 0 && (
                  <div className="mb-3 p-3 rounded-md flex items-center justify-between" style={{ background: "var(--bg-elevated)", border: `1px solid ${HOLDER_TIER_COLORS[uniqTier]}20` }}>
                    <div>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Balance</p>
                      <p className="text-xs font-semibold" style={{ color: HOLDER_TIER_COLORS[uniqTier] || "#fff" }}>{parseFloat(uniqBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })} $UNIQ</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Tier</p>
                      <p className="text-xs font-semibold" style={{ color: HOLDER_TIER_COLORS[uniqTier] || "var(--text-muted)" }}>{["None", "Bronze", "Silver", "Gold"][uniqTier] || "None"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Fee</p>
                      <p className="text-xs font-mono" style={{ color: "var(--green)" }}>
                        {(effectiveFeeBps / 100).toFixed(2)}%
                        {effectiveFeeBps < 50 && <span className="ml-1 text-[10px]">(-{((50 - effectiveFeeBps) / 100).toFixed(2)}%)</span>}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {(["Bronze", "Silver", "Gold"] as const).map((tier, i) => (
                    <div key={tier} className="p-2.5 rounded-md text-center" style={{
                      background: uniqTier === i + 1 ? `${HOLDER_TIER_COLORS[i + 1]}08` : "var(--bg-elevated)",
                      borderLeft: `2px solid ${HOLDER_TIER_COLORS[i + 1]}`,
                    }}>
                      <p className="text-[10px] font-semibold" style={{ color: HOLDER_TIER_COLORS[i + 1] }}>{tier} {uniqTier === i + 1 && "✓"}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{HOLDER_TIER_THRESHOLDS[tier].toLocaleString()}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{i === 0 ? "-0.10%" : i === 1 ? "-0.25%" : "-0.40%"}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center py-8">
                <Shield className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  No protected positions yet. Deposit BNB and authorize an agent to get started.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
