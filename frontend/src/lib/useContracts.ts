"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACTS, CHAIN_CONFIG } from "./constants";
import { REGISTRY_ABI, VAULT_ABI, LOGGER_ABI } from "./abis";

interface PublicContractData {
  isLive: boolean;
  isLoading: boolean;
  error: string | null;
  agentCount: number;
  totalBnbDeposited: string;
  totalActionsExecuted: number;
  totalValueProtected: string;
  totalDecisions: number;
  totalThreats: number;
  totalProtections: number;
  totalScans: number;
}

const INITIAL: PublicContractData = {
  isLive: false,
  isLoading: true,
  error: null,
  agentCount: 0,
  totalBnbDeposited: "0",
  totalActionsExecuted: 0,
  totalValueProtected: "0",
  totalDecisions: 0,
  totalThreats: 0,
  totalProtections: 0,
  totalScans: 0,
};

/**
 * Reads public on-chain data using BSC Testnet RPC.
 * No wallet required — uses read-only provider.
 */
export function usePublicContractData(): PublicContractData {
  const [data, setData] = useState<PublicContractData>(INITIAL);

  const fetchData = useCallback(async () => {
    try {
      const provider = new ethers.JsonRpcProvider(CHAIN_CONFIG.bscTestnet.rpcUrls[0]);

      const registry = new ethers.Contract(CONTRACTS.REGISTRY, REGISTRY_ABI, provider);
      const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, provider);
      const logger = new ethers.Contract(CONTRACTS.DECISION_LOGGER, LOGGER_ABI, provider);

      const [agentCount, vaultStats, loggerStats] = await Promise.allSettled([
        registry.getAgentCount(),
        vault.getVaultStats(),
        logger.getStats(),
      ]);

      setData({
        isLive: true,
        isLoading: false,
        error: null,
        agentCount: agentCount.status === "fulfilled" ? Number(agentCount.value) : 0,
        totalBnbDeposited: vaultStats.status === "fulfilled" ? ethers.formatEther(vaultStats.value[0]) : "0",
        totalActionsExecuted: vaultStats.status === "fulfilled" ? Number(vaultStats.value[1]) : 0,
        totalValueProtected: vaultStats.status === "fulfilled" ? ethers.formatEther(vaultStats.value[2]) : "0",
        totalDecisions: loggerStats.status === "fulfilled" ? Number(loggerStats.value[0]) : 0,
        totalThreats: loggerStats.status === "fulfilled" ? Number(loggerStats.value[1]) : 0,
        totalProtections: loggerStats.status === "fulfilled" ? Number(loggerStats.value[2]) : 0,
        totalScans: 0,
      });
    } catch (err) {
      setData((prev) => ({
        ...prev,
        isLive: false,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to read contracts",
      }));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60000); // Refresh every 60s
    return () => clearInterval(id);
  }, [fetchData]);

  return data;
}
