/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACTS } from "./constants";
import { REGISTRY_ABI, VAULT_ABI, LOGGER_ABI, ERC20_ABI, TOKEN_GATE_ABI } from "./abis";

// ─── Types ────────────────────────────────────────────────────

export interface AgentInfo {
  name: string;
  operator: string;
  tier: number;
  status: number;
  totalDecisions: number;
  successfulActions: number;
  totalValueProtected: string; // formatted BNB
  registeredAt: number;
}

export interface VaultStats {
  totalBnbDeposited: string;
  totalActionsExecuted: number;
  totalValueProtected: string;
}

export interface UserPosition {
  bnbBalance: string;
  isActive: boolean;
  agentAuthorized: boolean;
  authorizedAgentId: number;
  depositTimestamp: number;
  riskProfile: {
    maxSlippage: number;
    stopLossThreshold: number;
    maxSingleActionValue: string;
    allowAutoWithdraw: boolean;
    allowAutoSwap: boolean;
  };
}

export interface Decision {
  agentId: number;
  targetUser: string;
  decisionType: number;
  riskLevel: number;
  confidence: number;
  timestamp: number;
  actionTaken: boolean;
}

export interface LoggerStats {
  totalDecisions: number;
  totalThreats: number;
  totalProtections: number;
}

export interface RiskSnapshot {
  overallRisk: number;
  liquidationRisk: number;
  volatilityScore: number;
  protocolRisk: number;
  smartContractRisk: number;
}

// ─── Contract Data Hook ──────────────────────────────────────

export function useContractData(provider: ethers.BrowserProvider | null) {
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loggerStats, setLoggerStats] = useState<LoggerStats | null>(null);
  const [riskSnapshot, setRiskSnapshot] = useState<RiskSnapshot | null>(null);
  const [reputation, setReputation] = useState<number>(0);
  const [successRate, setSuccessRate] = useState<number>(0);
  const [agentCount, setAgentCount] = useState<number>(0);
  const [uniqBalance, setUniqBalance] = useState<string>("0");
  const [uniqTier, setUniqTier] = useState<number>(0);
  const [effectiveFeeBps, setEffectiveFeeBps] = useState<number>(50);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const isDeployed = CONTRACTS.REGISTRY !== "0x0000000000000000000000000000000000000000";

  const fetchAll = useCallback(async (userAddress?: string) => {
    if (!provider || !isDeployed) return;
    
    setLoading(true);
    try {
      const readProvider = provider;
      
      const registry = new ethers.Contract(CONTRACTS.REGISTRY, REGISTRY_ABI, readProvider);
      const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, readProvider);
      const logger = new ethers.Contract(CONTRACTS.DECISION_LOGGER, LOGGER_ABI, readProvider);

      // Fetch all data in parallel for speed
      const results = await Promise.allSettled([
        registry.getAgent(0),
        registry.getAgentCount(),
        registry.getReputationScore(0),
        registry.getSuccessRate(0),
        vault.getVaultStats(),
        logger.getStats(),
        logger.getRecentDecisions(10),
        userAddress ? vault.getPosition(userAddress) : Promise.resolve(null),
        userAddress ? logger.getLatestRisk(userAddress) : Promise.resolve(null),
        // $UNIQ balance + tier
        userAddress && CONTRACTS.UNIQ_TOKEN ? new ethers.Contract(CONTRACTS.UNIQ_TOKEN, ERC20_ABI, readProvider).balanceOf(userAddress) : Promise.resolve(null),
        userAddress && CONTRACTS.TOKEN_GATE ? new ethers.Contract(CONTRACTS.TOKEN_GATE, TOKEN_GATE_ABI, readProvider).getHolderTier(userAddress).catch(() => null) : Promise.resolve(null),
        userAddress ? vault.getEffectiveFee(userAddress).catch(() => null) : Promise.resolve(null),
      ]);

      // Parse agent info
      if (results[0].status === "fulfilled" && results[0].value) {
        const a = results[0].value;
        setAgentInfo({
          name: a.name,
          operator: a.operator,
          tier: Number(a.tier),
          status: Number(a.status),
          totalDecisions: Number(a.totalDecisions),
          successfulActions: Number(a.successfulActions),
          totalValueProtected: ethers.formatEther(a.totalValueProtected),
          registeredAt: Number(a.registeredAt),
        });
      }

      // Agent count
      if (results[1].status === "fulfilled") {
        setAgentCount(Number(results[1].value));
      }

      // Reputation
      if (results[2].status === "fulfilled") {
        setReputation(Number(results[2].value) / 100); // scaled by 100
      }

      // Success rate
      if (results[3].status === "fulfilled") {
        setSuccessRate(Number(results[3].value) / 100); // basis points to %
      }

      // Vault stats
      if (results[4].status === "fulfilled") {
        const v = results[4].value;
        setVaultStats({
          totalBnbDeposited: ethers.formatEther(v[0]),
          totalActionsExecuted: Number(v[1]),
          totalValueProtected: ethers.formatEther(v[2]),
        });
      }

      // Logger stats
      if (results[5].status === "fulfilled") {
        const s = results[5].value;
        setLoggerStats({
          totalDecisions: Number(s[0]),
          totalThreats: Number(s[1]),
          totalProtections: Number(s[2]),
        });
      }

      // Recent decisions
      if (results[6].status === "fulfilled") {
        const raw = results[6].value as any[];
        setDecisions(raw.map((d: any) => ({
          agentId: Number(d.agentId),
          targetUser: d.targetUser,
          decisionType: Number(d.decisionType),
          riskLevel: Number(d.riskLevel),
          confidence: Number(d.confidence) / 100,
          timestamp: Number(d.timestamp),
          actionTaken: d.actionTaken,
        })));
      }

      // User position
      if (results[7].status === "fulfilled" && results[7].value) {
        const p = results[7].value;
        setUserPosition({
          bnbBalance: ethers.formatEther(p.bnbBalance),
          isActive: p.isActive,
          agentAuthorized: p.agentAuthorized,
          authorizedAgentId: Number(p.authorizedAgentId),
          depositTimestamp: Number(p.depositTimestamp),
          riskProfile: {
            maxSlippage: Number(p.riskProfile.maxSlippage),
            stopLossThreshold: Number(p.riskProfile.stopLossThreshold),
            maxSingleActionValue: ethers.formatEther(p.riskProfile.maxSingleActionValue),
            allowAutoWithdraw: p.riskProfile.allowAutoWithdraw,
            allowAutoSwap: p.riskProfile.allowAutoSwap,
          },
        });
      }

      // Risk snapshot
      if (results[8].status === "fulfilled" && results[8].value) {
        const r = results[8].value;
        if (Number(r.timestamp) > 0) {
          setRiskSnapshot({
            overallRisk: Number(r.overallRisk),
            liquidationRisk: Number(r.liquidationRisk) / 100,
            volatilityScore: Number(r.volatilityScore) / 100,
            protocolRisk: Number(r.protocolRisk) / 100,
            smartContractRisk: Number(r.smartContractRisk) / 100,
          });
        }
      }

      // $UNIQ balance
      if (results[9].status === "fulfilled" && results[9].value != null) {
        setUniqBalance(ethers.formatEther(results[9].value));
      }

      // $UNIQ holder tier
      if (results[10].status === "fulfilled" && results[10].value != null) {
        setUniqTier(Number(results[10].value));
      }

      // Effective fee
      if (results[11].status === "fulfilled" && results[11].value != null) {
        setEffectiveFeeBps(Number(results[11].value));
      }

      setIsLive(true);
    } catch (err: any) {
      console.warn("Contract data fetch failed:", err.message);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, [provider, isDeployed]);

  return {
    agentInfo,
    vaultStats,
    userPosition,
    decisions,
    loggerStats,
    riskSnapshot,
    reputation,
    successRate,
    agentCount,
    uniqBalance,
    uniqTier,
    effectiveFeeBps,
    loading,
    isLive,
    isDeployed,
    fetchAll,
  };
}

// ─── Public Read-Only Hook (no wallet needed) ─────────────────

export function usePublicContractData() {
  const [agentCount, setAgentCount] = useState<number>(0);
  const [totalDecisions, setTotalDecisions] = useState<number>(0);
  const [totalThreats, setTotalThreats] = useState<number>(0);
  const [totalProtections, setTotalProtections] = useState<number>(0);
  const [totalDeposited, setTotalDeposited] = useState<string>("0");
  const [totalValueProtected, setTotalValueProtected] = useState<string>("0");
  const [totalActionsExecuted, setTotalActionsExecuted] = useState<number>(0);
  const [agentName, setAgentName] = useState<string>("");
  const [agentTier, setAgentTier] = useState<number>(0);
  const [agentOperator, setAgentOperator] = useState<string>("");
  const [agentTotalDecisions, setAgentTotalDecisions] = useState<number>(0);
  const [agentSuccessfulActions, setAgentSuccessfulActions] = useState<number>(0);
  const [agentTotalValueProtected, setAgentTotalValueProtected] = useState<string>("0");
  const [agentRegisteredAt, setAgentRegisteredAt] = useState<number>(0);
  const [agentReputation, setAgentReputation] = useState<number>(0);
  const [agentSuccessRate, setAgentSuccessRate] = useState<number>(0);
  const [recentDecisions, setRecentDecisions] = useState<Decision[]>([]);
  const [publicRiskSnapshot, setPublicRiskSnapshot] = useState<RiskSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const isDeployed = CONTRACTS.REGISTRY !== "0x0000000000000000000000000000000000000000";

  const fetchPublicData = useCallback(async () => {
    if (!isDeployed) return;
    try {
      const rpc = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545");
      const registry = new ethers.Contract(CONTRACTS.REGISTRY, REGISTRY_ABI, rpc);
      const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, rpc);
      const logger = new ethers.Contract(CONTRACTS.DECISION_LOGGER, LOGGER_ABI, rpc);

      // Deployer address — used for public risk snapshot reads
      const DEPLOYER = "0xA3eAFfed353EF86c08919552Fd4F7cCB061192d3";

      const results = await Promise.allSettled([
        registry.getAgentCount(),
        registry.getAgent(0),
        registry.getReputationScore(0),
        registry.getSuccessRate(0),
        vault.getVaultStats(),
        logger.getStats(),
        logger.getRecentDecisions(10),
        logger.getLatestRisk(DEPLOYER),
      ]);

      if (results[0].status === "fulfilled") setAgentCount(Number(results[0].value));
      if (results[1].status === "fulfilled") {
        const a = results[1].value;
        setAgentName(a.name);
        setAgentTier(Number(a.tier));
        setAgentOperator(a.operator);
        setAgentTotalDecisions(Number(a.totalDecisions));
        setAgentSuccessfulActions(Number(a.successfulActions));
        setAgentTotalValueProtected(ethers.formatEther(a.totalValueProtected));
        setAgentRegisteredAt(Number(a.registeredAt));
      }
      if (results[2].status === "fulfilled") setAgentReputation(Number(results[2].value) / 100);
      if (results[3].status === "fulfilled") setAgentSuccessRate(Number(results[3].value) / 100);
      if (results[4].status === "fulfilled") {
        const v = results[4].value;
        setTotalDeposited(ethers.formatEther(v[0]));
        setTotalActionsExecuted(Number(v[1]));
        setTotalValueProtected(ethers.formatEther(v[2]));
      }
      if (results[5].status === "fulfilled") {
        const s = results[5].value;
        setTotalDecisions(Number(s[0]));
        setTotalThreats(Number(s[1]));
        setTotalProtections(Number(s[2]));
      }
      if (results[6].status === "fulfilled") {
        const raw = results[6].value as any[];
        setRecentDecisions(raw.map((d: any) => ({
          agentId: Number(d.agentId),
          targetUser: d.targetUser,
          decisionType: Number(d.decisionType),
          riskLevel: Number(d.riskLevel),
          confidence: Number(d.confidence) / 100,
          timestamp: Number(d.timestamp),
          actionTaken: d.actionTaken,
        })));
      }
      if (results[7].status === "fulfilled" && results[7].value) {
        const r = results[7].value;
        if (Number(r.timestamp) > 0) {
          setPublicRiskSnapshot({
            overallRisk: Number(r.overallRisk),
            liquidationRisk: Number(r.liquidationRisk) / 100,
            volatilityScore: Number(r.volatilityScore) / 100,
            protocolRisk: Number(r.protocolRisk) / 100,
            smartContractRisk: Number(r.smartContractRisk) / 100,
          });
        }
      }

      setIsLive(true);
      setLoaded(true);
    } catch (err: any) {
      console.warn("Public RPC fetch failed:", err.message);
      setIsLive(false);
      setLoaded(true);
    }
  }, [isDeployed]);

  return {
    agentCount, totalDecisions, totalThreats, totalProtections,
    totalDeposited, totalValueProtected, totalActionsExecuted,
    agentName, agentTier, agentOperator,
    agentTotalDecisions, agentSuccessfulActions, agentTotalValueProtected, agentRegisteredAt,
    agentReputation, agentSuccessRate,
    recentDecisions, publicRiskSnapshot, loaded, isLive, fetchPublicData,
  };
}

// ─── Contract Write Hook ─────────────────────────────────────

export function useContractWrite(signer: ethers.Signer | null) {
  const isDeployed = CONTRACTS.REGISTRY !== "0x0000000000000000000000000000000000000000";

  const deposit = useCallback(async (amountBNB: string) => {
    if (!signer || !isDeployed) throw new Error("Not connected");
    const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
    const tx = await vault.deposit({ value: ethers.parseEther(amountBNB) });
    return tx.wait();
  }, [signer, isDeployed]);

  const withdraw = useCallback(async (amountBNB: string) => {
    if (!signer || !isDeployed) throw new Error("Not connected");
    const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
    const amount = amountBNB === "0" ? BigInt(0) : ethers.parseEther(amountBNB);
    const tx = await vault.withdraw(amount);
    return tx.wait();
  }, [signer, isDeployed]);

  const authorizeAgent = useCallback(async (agentId: number) => {
    if (!signer || !isDeployed) throw new Error("Not connected");
    const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
    const tx = await vault.authorizeAgent(agentId);
    return tx.wait();
  }, [signer, isDeployed]);

  const emergencyWithdraw = useCallback(async () => {
    if (!signer || !isDeployed) throw new Error("Not connected");
    const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
    const tx = await vault.emergencyWithdraw();
    return tx.wait();
  }, [signer, isDeployed]);

  const giveFeedback = useCallback(async (agentId: number, score: number, comment: string) => {
    if (!signer || !isDeployed) throw new Error("Not connected");
    const registry = new ethers.Contract(CONTRACTS.REGISTRY, REGISTRY_ABI, signer);
    const tx = await registry.giveFeedback(agentId, score, comment);
    return tx.wait();
  }, [signer, isDeployed]);

  const registerAgentWithUNIQ = useCallback(async (name: string, agentURI: string, tier: number, uniqFee: bigint) => {
    if (!signer || !isDeployed) throw new Error("Not connected");
    // Step 1: Approve $UNIQ spend
    const uniq = new ethers.Contract(CONTRACTS.UNIQ_TOKEN, ERC20_ABI, signer);
    const approveTx = await uniq.approve(CONTRACTS.REGISTRY, uniqFee);
    await approveTx.wait();
    // Step 2: Register with $UNIQ
    const registry = new ethers.Contract(CONTRACTS.REGISTRY, REGISTRY_ABI, signer);
    const tx = await registry.registerAgentWithUNIQ(name, agentURI, tier);
    return tx.wait();
  }, [signer, isDeployed]);

  return { deposit, withdraw, authorizeAgent, emergencyWithdraw, giveFeedback, registerAgentWithUNIQ, isDeployed };
}
