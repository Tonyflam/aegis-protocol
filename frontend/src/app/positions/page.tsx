"use client";

import { useState, useEffect, useCallback } from "react";
import { useWalletContext } from "../../lib/WalletContext";
import { usePublicContractData } from "../../lib/useContracts";
import { CONTRACTS } from "../../lib/constants";
import { VAULT_ABI, TOKEN_GATE_ABI } from "../../lib/abis";
import { ethers } from "ethers";
import {
  Eye, Wallet, Shield, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle, Loader2,
  Lock, Unlock, Settings, Info,
} from "lucide-react";
import toast from "react-hot-toast";

interface UserPosition {
  bnbBalance: string;
  isActive: boolean;
  authorizedAgentId: number;
  agentAuthorized: boolean;
  depositTimestamp: number;
  lastActionTimestamp: number;
  riskProfile: {
    maxSlippage: number;
    stopLossThreshold: number;
    maxSingleActionValue: string;
    allowAutoWithdraw: boolean;
    allowAutoSwap: boolean;
  };
}

export default function PositionsPage() {
  const { isConnected, address, provider, signer, chainId } = useWalletContext();
  const contracts = usePublicContractData();
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [holderTier, setHolderTier] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const isCorrectChain = chainId === 97;

  const fetchPosition = useCallback(async () => {
    if (!isConnected || !provider || !address || !isCorrectChain) return;
    setIsLoading(true);
    try {
      const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, provider);
      const tokenGate = new ethers.Contract(CONTRACTS.TOKEN_GATE, TOKEN_GATE_ABI, provider);

      const [pos, tier] = await Promise.allSettled([
        vault.getPosition(address),
        tokenGate.getHolderTier(address),
      ]);

      if (pos.status === "fulfilled") {
        const p = pos.value;
        setPosition({
          bnbBalance: ethers.formatEther(p.bnbBalance),
          isActive: p.isActive,
          authorizedAgentId: Number(p.authorizedAgentId),
          agentAuthorized: p.agentAuthorized,
          depositTimestamp: Number(p.depositTimestamp),
          lastActionTimestamp: Number(p.lastActionTimestamp),
          riskProfile: {
            maxSlippage: Number(p.riskProfile.maxSlippage),
            stopLossThreshold: Number(p.riskProfile.stopLossThreshold),
            maxSingleActionValue: ethers.formatEther(p.riskProfile.maxSingleActionValue),
            allowAutoWithdraw: p.riskProfile.allowAutoWithdraw,
            allowAutoSwap: p.riskProfile.allowAutoSwap,
          },
        });
      }

      if (tier.status === "fulfilled") {
        setHolderTier(Number(tier.value));
      }
    } catch {
      // Position may not exist yet
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, provider, address, isCorrectChain]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  const handleDeposit = async () => {
    if (!signer || !depositAmount) return;
    setIsDepositing(true);
    try {
      const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
      const tx = await vault.deposit({ value: ethers.parseEther(depositAmount) });
      toast.loading("Depositing...", { id: "deposit" });
      await tx.wait();
      toast.success("Deposit successful!", { id: "deposit" });
      setDepositAmount("");
      fetchPosition();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Deposit failed";
      toast.error(msg.length > 100 ? msg.slice(0, 100) + "..." : msg, { id: "deposit" });
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!signer || !withdrawAmount) return;
    setIsWithdrawing(true);
    try {
      const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
      const tx = await vault.withdraw(ethers.parseEther(withdrawAmount));
      toast.loading("Withdrawing...", { id: "withdraw" });
      await tx.wait();
      toast.success("Withdrawal successful!", { id: "withdraw" });
      setWithdrawAmount("");
      fetchPosition();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Withdrawal failed";
      toast.error(msg.length > 100 ? msg.slice(0, 100) + "..." : msg, { id: "withdraw" });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const tierNames = ["None", "Bronze", "Silver", "Gold"];
  const tierColors = ["#6b7280", "#cd7f32", "#c0c0c0", "#ffd700"];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.15)" }}
          >
            <Eye className="w-5 h-5" style={{ color: "var(--green)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Vault Positions</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Deposit BNB to the Aegis Vault and authorize AI agents
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 space-y-6">
        {/* Not Connected */}
        {!isConnected && (
          <div className="card p-10 text-center">
            <Wallet className="w-10 h-10 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h3 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h3>
            <p className="text-sm max-w-md mx-auto mb-4" style={{ color: "var(--text-secondary)" }}>
              Connect your wallet to view your vault position, deposit BNB, and authorize AI agents to protect your assets.
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Requires BSC Testnet (Chain ID 97)
            </p>
          </div>
        )}

        {/* Wrong Chain */}
        {isConnected && !isCorrectChain && (
          <div
            className="flex items-start gap-3 p-4 rounded-xl"
            style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--yellow)" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--yellow)" }}>Wrong Network</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                Switch to BSC Testnet to interact with the vault. Use the &quot;Switch to BSC&quot; button in the navbar.
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {isConnected && isCorrectChain && isLoading && (
          <div className="card p-10 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: "var(--green)" }} />
            <p className="text-sm text-white">Loading vault position...</p>
          </div>
        )}

        {/* Connected + Correct Chain */}
        {isConnected && isCorrectChain && !isLoading && (
          <>
            {/* Vault Overview */}
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="card p-4">
                <p className="text-[11px] font-medium mb-2" style={{ color: "var(--text-muted)" }}>Your Balance</p>
                <p className="text-xl font-semibold text-white">
                  {position ? `${parseFloat(position.bnbBalance).toFixed(6)} BNB` : "0 BNB"}
                </p>
                <p className="text-[9px] mt-1 font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  In Aegis Vault
                </p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] font-medium mb-2" style={{ color: "var(--text-muted)" }}>$UNIQ Tier</p>
                <p className="text-xl font-semibold" style={{ color: tierColors[holderTier] }}>
                  {tierNames[holderTier]}
                </p>
                <p className="text-[9px] mt-1 font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Holder Status
                </p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] font-medium mb-2" style={{ color: "var(--text-muted)" }}>Agent Status</p>
                <div className="flex items-center gap-2">
                  {position?.agentAuthorized ? (
                    <>
                      <CheckCircle className="w-5 h-5" style={{ color: "var(--green)" }} />
                      <span className="text-sm font-semibold" style={{ color: "var(--green)" }}>
                        Agent #{position.authorizedAgentId}
                      </span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                      <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                        No Agent
                      </span>
                    </>
                  )}
                </div>
                <p className="text-[9px] mt-1 font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Protection
                </p>
              </div>
            </div>

            {/* Deposit / Withdraw */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Deposit */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4" style={{ color: "var(--green)" }} />
                  Deposit BNB
                </h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0.0 BNB"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  />
                  <button
                    onClick={handleDeposit}
                    disabled={isDepositing || !depositAmount || parseFloat(depositAmount) <= 0}
                    className="btn-primary !px-4 !py-2 text-xs flex items-center gap-1.5"
                  >
                    {isDepositing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                    Deposit
                  </button>
                </div>
              </div>

              {/* Withdraw */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4" style={{ color: "var(--red)" }} />
                  Withdraw BNB
                </h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0.0 BNB"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  />
                  <button
                    onClick={handleWithdraw}
                    disabled={isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                    className="btn-secondary !px-4 !py-2 text-xs flex items-center gap-1.5"
                  >
                    {isWithdrawing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                    Withdraw
                  </button>
                </div>
              </div>
            </div>

            {/* Risk Profile */}
            {position?.isActive && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Settings className="w-4 h-4" style={{ color: "var(--purple)" }} />
                  Risk Profile
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>Max Slippage</p>
                    <p className="text-white font-semibold mt-0.5">
                      {position.riskProfile.maxSlippage / 100}%
                    </p>
                  </div>
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>Stop Loss</p>
                    <p className="text-white font-semibold mt-0.5">
                      {position.riskProfile.stopLossThreshold / 100}%
                    </p>
                  </div>
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>Auto Withdraw</p>
                    <p className="font-semibold mt-0.5" style={{ color: position.riskProfile.allowAutoWithdraw ? "var(--green)" : "var(--text-muted)" }}>
                      {position.riskProfile.allowAutoWithdraw ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>Auto Swap</p>
                    <p className="font-semibold mt-0.5" style={{ color: position.riskProfile.allowAutoSwap ? "var(--green)" : "var(--text-muted)" }}>
                      {position.riskProfile.allowAutoSwap ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Protocol Totals */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Vault Totals</h3>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p style={{ color: "var(--text-muted)" }}>Total Deposited</p>
                  <p className="text-white font-semibold mt-0.5">
                    {contracts.isLoading ? "..." : `${parseFloat(contracts.totalBnbDeposited).toFixed(4)} BNB`}
                  </p>
                </div>
                <div>
                  <p style={{ color: "var(--text-muted)" }}>Actions Executed</p>
                  <p className="text-white font-semibold mt-0.5">
                    {contracts.isLoading ? "..." : contracts.totalActionsExecuted}
                  </p>
                </div>
                <div>
                  <p style={{ color: "var(--text-muted)" }}>Value Protected</p>
                  <p className="text-white font-semibold mt-0.5">
                    {contracts.isLoading ? "..." : `${parseFloat(contracts.totalValueProtected).toFixed(4)} BNB`}
                  </p>
                </div>
              </div>
              <p className="text-[9px] mt-3 font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Source: On-chain · BSC Testnet
              </p>
            </div>
          </>
        )}

        {/* Info banner */}
        <div className="flex items-start gap-2 px-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            The Aegis Vault operates on BSC Testnet. Deposit tBNB and authorize an AI agent to monitor and protect your position.
            All vault data is read directly from smart contracts — no cached or simulated data.
          </p>
        </div>
      </section>
    </div>
  );
}
