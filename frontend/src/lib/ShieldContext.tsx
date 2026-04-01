"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { ethers } from "ethers";

// ─── Types ─────────────────────────────────────────────────────

export interface GuardianEvent {
  id: string;
  type: "approval_detected" | "threat_blocked" | "risk_alert" | "scan_complete" | "monitoring";
  severity: "info" | "warning" | "danger" | "success";
  title: string;
  description: string;
  timestamp: number;
  txHash?: string;
  metadata?: { contract?: string; token?: string; riskScore?: number };
}

interface ShieldState {
  monitoring: boolean;
  connected: boolean;
  lastBlock: number | null;
  events: GuardianEvent[];
  dangerCount: number;
  warningCount: number;
  startMonitoring: (address: string) => Promise<void>;
  stopMonitoring: () => void;
}

const ShieldContext = createContext<ShieldState | null>(null);

// ─── Constants ─────────────────────────────────────────────────

const BSC_RPC = "https://bsc-rpc.publicnode.com";
const APPROVAL_TOPIC = ethers.id("Approval(address,address,uint256)");
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

// ─── Provider ──────────────────────────────────────────────────

export function ShieldProvider({ children }: { children: ReactNode }) {
  const [monitoring, setMonitoring] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastBlock, setLastBlock] = useState<number | null>(null);
  const [events, setEvents] = useState<GuardianEvent[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const providerRef = useRef<ethers.JsonRpcProvider | null>(null);
  const addressRef = useRef<string | null>(null);
  const lastBlockRef = useRef<number | null>(null);

  // Keep lastBlockRef in sync
  useEffect(() => { lastBlockRef.current = lastBlock; }, [lastBlock]);

  const addEvent = useCallback((event: Omit<GuardianEvent, "id" | "timestamp">) => {
    setEvents(prev => [{
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    }, ...prev].slice(0, 50));
  }, []);

  const poll = useCallback(async () => {
    const addr = addressRef.current;
    const provider = providerRef.current;
    if (!addr || !provider) return;

    try {
      const currentBlock = await provider.getBlockNumber();
      const prevBlock = lastBlockRef.current;

      if (prevBlock && currentBlock > prevBlock) {
        const paddedAddr = "0x" + addr.slice(2).toLowerCase().padStart(64, "0");

        // Check for new approvals
        try {
          const approvalLogs = await provider.getLogs({
            fromBlock: prevBlock + 1,
            toBlock: currentBlock,
            topics: [APPROVAL_TOPIC, paddedAddr],
          });

          for (const log of approvalLogs) {
            const spender = "0x" + log.topics[2].slice(26);
            const value = BigInt(log.data);
            const isUnlimited = value.toString() === "115792089237316195423570985008687907853269984665640564039457584007913129639935";
            const isRevoke = value === 0n;

            if (isRevoke) {
              addEvent({
                type: "scan_complete",
                severity: "success",
                title: "Approval Revoked",
                description: `Token ${log.address.slice(0, 10)}... approval to ${spender.slice(0, 10)}... was revoked`,
                txHash: log.transactionHash,
              });
            } else {
              addEvent({
                type: "approval_detected",
                severity: isUnlimited ? "warning" : "info",
                title: isUnlimited ? "⚠ Unlimited Approval Detected" : "New Token Approval",
                description: `Token ${log.address.slice(0, 10)}... approved to ${spender.slice(0, 10)}...${isUnlimited ? " with UNLIMITED access" : ""}`,
                txHash: log.transactionHash,
                metadata: { contract: spender, token: log.address },
              });
            }
          }
        } catch {
          // Log fetch may fail
        }

        // Check for outgoing transfers (potential drains)
        try {
          const transferLogs = await provider.getLogs({
            fromBlock: prevBlock + 1,
            toBlock: currentBlock,
            topics: [TRANSFER_TOPIC, paddedAddr],
          });

          if (transferLogs.length > 3) {
            addEvent({
              type: "risk_alert",
              severity: "danger",
              title: "⚠ Unusual Transfer Activity",
              description: `${transferLogs.length} outgoing transfers detected in ${currentBlock - prevBlock} blocks. Monitor for drain attack.`,
            });
          }
        } catch {
          // Ignore
        }
      }

      setLastBlock(currentBlock);
    } catch {
      // RPC error — retry next cycle
    }
  }, [addEvent]);

  const startMonitoring = useCallback(async (address: string) => {
    // Don't restart if already monitoring same address
    if (monitoring && addressRef.current === address) return;

    // Clean up existing
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    addressRef.current = address;
    providerRef.current = new ethers.JsonRpcProvider(BSC_RPC, 56, { staticNetwork: true });

    try {
      const block = await providerRef.current.getBlockNumber();
      setLastBlock(block);
      setConnected(true);
      setMonitoring(true);

      addEvent({
        type: "monitoring",
        severity: "success",
        title: "Guardian Activated",
        description: `Monitoring wallet ${address.slice(0, 8)}...${address.slice(-6)} from block #${block.toLocaleString()}`,
      });

      intervalRef.current = setInterval(poll, 6000);
    } catch {
      addEvent({
        type: "monitoring",
        severity: "danger",
        title: "Connection Failed",
        description: "Could not connect to BSC network. Try again.",
      });
    }
  }, [monitoring, addEvent, poll]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    addressRef.current = null;
    providerRef.current = null;
    setMonitoring(false);
    setConnected(false);

    addEvent({
      type: "monitoring",
      severity: "info",
      title: "Guardian Paused",
      description: "Real-time monitoring stopped. Your wallet is unprotected.",
    });
  }, [addEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const dangerCount = events.filter(e => e.severity === "danger").length;
  const warningCount = events.filter(e => e.severity === "warning").length;

  return (
    <ShieldContext.Provider value={{
      monitoring, connected, lastBlock, events,
      dangerCount, warningCount,
      startMonitoring, stopMonitoring,
    }}>
      {children}
    </ShieldContext.Provider>
  );
}

export function useShieldContext() {
  const ctx = useContext(ShieldContext);
  if (!ctx) throw new Error("useShieldContext must be used within ShieldProvider");
  return ctx;
}
