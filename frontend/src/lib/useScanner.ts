"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACTS, CHAIN_CONFIG } from "./constants";
import { SCANNER_ABI } from "./abis";

// ─── Types ────────────────────────────────────────────────────

export interface TokenScan {
  token: string;
  riskScore: number;
  liquidity: string;
  holderCount: number;
  topHolderPercent: number;
  buyTax: number;
  sellTax: number;
  isHoneypot: boolean;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isContractRenounced: boolean;
  isLiquidityLocked: boolean;
  isVerified: boolean;
  scanTimestamp: number;
  scannedBy: string;
  flags: string;
  reasoningHash: string;
  scanVersion: number;
}

export interface TokenRiskData {
  riskScore: number;
  lastUpdated: number;
  attestedBy: string;
  reasoningHash: string;
}

export interface TokenFlags {
  isHoneypot: boolean;
  hasHighTax: boolean;
  isUnverified: boolean;
  hasConcentratedOwnership: boolean;
  hasLowLiquidity: boolean;
}

export interface ScannerStats {
  totalScans: number;
  totalHoneypots: number;
  totalRugRisks: number;
  totalTokens: number;
}

// ─── RPC Provider ────────────────────────────────────────────

let rpcIndex = 0;

function getReadProvider(): ethers.JsonRpcProvider {
  const urls = CHAIN_CONFIG.bscTestnet.rpcUrls;
  const url = urls[rpcIndex % urls.length];
  return new ethers.JsonRpcProvider(url, undefined, { staticNetwork: true });
}

function rotateRpc(): void {
  rpcIndex = (rpcIndex + 1) % CHAIN_CONFIG.bscTestnet.rpcUrls.length;
}

function getScannerContract(provider: ethers.JsonRpcProvider | ethers.BrowserProvider): ethers.Contract | null {
  if (CONTRACTS.SCANNER === "0x0000000000000000000000000000000000000000") return null;
  return new ethers.Contract(CONTRACTS.SCANNER, SCANNER_ABI, provider);
}

// ─── Parse helpers ───────────────────────────────────────────

function parseScan(raw: ethers.Result): TokenScan {
  return {
    token: raw[0],
    riskScore: Number(raw[1]),
    liquidity: ethers.formatEther(raw[2]),
    holderCount: Number(raw[3]),
    topHolderPercent: Number(raw[4]),
    buyTax: Number(raw[5]),
    sellTax: Number(raw[6]),
    isHoneypot: raw[7],
    ownerCanMint: raw[8],
    ownerCanPause: raw[9],
    ownerCanBlacklist: raw[10],
    isContractRenounced: raw[11],
    isLiquidityLocked: raw[12],
    isVerified: raw[13],
    scanTimestamp: Number(raw[14]),
    scannedBy: raw[15],
    flags: raw[16],
    reasoningHash: raw[17],
    scanVersion: Number(raw[18]),
  };
}

function parseRiskData(raw: ethers.Result): TokenRiskData {
  return {
    riskScore: Number(raw[0]),
    lastUpdated: Number(raw[1]),
    attestedBy: raw[2],
    reasoningHash: raw[3],
  };
}

function parseFlags(raw: ethers.Result): TokenFlags {
  return {
    isHoneypot: raw[0],
    hasHighTax: raw[1],
    isUnverified: raw[2],
    hasConcentratedOwnership: raw[3],
    hasLowLiquidity: raw[4],
  };
}

// ─── Scanner Data Hook (public read-only) ────────────────────

export function useScannerData() {
  const [stats, setStats] = useState<ScannerStats | null>(null);
  const [recentScans, setRecentScans] = useState<TokenScan[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const provider = getReadProvider();
      const scanner = getScannerContract(provider);
      if (!scanner) { setLoading(false); return; }

      const results = await Promise.allSettled([
        scanner.getScannerStats(),
        scanner.getRecentScans(20),
        scanner.stalenessThreshold(),
      ]);

      if (results[0].status === "fulfilled") {
        const s = results[0].value;
        setStats({
          totalScans: Number(s[0]),
          totalHoneypots: Number(s[1]),
          totalRugRisks: Number(s[2]),
          totalTokens: Number(s[3]),
        });
      }

      if (results[1].status === "fulfilled") {
        setRecentScans(results[1].value.map(parseScan));
      }

      // Only mark live if at least the stats call succeeded
      const anySucceeded = results.some(r => r.status === "fulfilled");
      setIsLive(anySucceeded);
    } catch {
      rotateRpc();
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, recentScans, loading, isLive, fetchStats };
}

// ─── Token Lookup Hook ───────────────────────────────────────

// ─── GoPlusLabs Live Scan ────────────────────────────────────

async function goplusLiveScan(token: string): Promise<TokenScan | null> {
  try {
    // Query BSC Testnet (97) first, fall back to BSC Mainnet (56)
    for (const chainId of [97, 56]) {
      const resp = await fetch(
        `https://api.gopluslabs.com/api/v1/token_security/${chainId}?contract_addresses=${token}`,
        { signal: AbortSignal.timeout(20000) }
      );
      if (!resp.ok) continue;
      const json = await resp.json();
      const data = json?.result?.[token.toLowerCase()];
      if (!data) continue;

      const buyTax = Math.round(parseFloat(data.buy_tax || "0") * 10000);
      const sellTax = Math.round(parseFloat(data.sell_tax || "0") * 10000);
      const isHoneypot = data.is_honeypot === "1";
      const isOpenSource = data.is_open_source === "1";
      const ownerCanChange = data.owner_change_balance === "1";
      const hiddenOwner = data.hidden_owner === "1";

      let riskScore = 30;
      if (isHoneypot) riskScore = 100;
      if (buyTax > 1000) riskScore = Math.min(100, riskScore + 20);
      if (sellTax > 1000) riskScore = Math.min(100, riskScore + 20);
      if (!isOpenSource) riskScore = Math.min(100, riskScore + 15);
      if (ownerCanChange) riskScore = Math.min(100, riskScore + 25);
      if (hiddenOwner) riskScore = Math.min(100, riskScore + 10);
      if (!isHoneypot && isOpenSource && buyTax < 500 && sellTax < 500 && !ownerCanChange && !hiddenOwner) {
        riskScore = Math.max(0, riskScore - 20);
      }

      return {
        token,
        riskScore,
        liquidity: "0",
        holderCount: parseInt(data.holder_count || "0"),
        topHolderPercent: 0,
        buyTax,
        sellTax,
        isHoneypot,
        ownerCanMint: false,
        ownerCanPause: false,
        ownerCanBlacklist: false,
        isContractRenounced: data.can_take_back_ownership !== "1",
        isLiquidityLocked: false,
        isVerified: isOpenSource,
        scanTimestamp: Math.floor(Date.now() / 1000),
        scannedBy: "0x0000000000000000000000000000000000000000",
        flags: "LIVE_SCAN",
        reasoningHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        scanVersion: 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function useTokenLookup() {
  const [scan, setScan] = useState<TokenScan | null>(null);
  const [riskData, setRiskData] = useState<TokenRiskData | null>(null);
  const [flags, setFlags] = useState<TokenFlags | null>(null);
  const [safe, setSafe] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLiveScan, setIsLiveScan] = useState(false);

  const lookup = useCallback(async (tokenAddress: string) => {
    if (!ethers.isAddress(tokenAddress)) {
      setError("Invalid address");
      return;
    }
    setLoading(true);
    setError(null);
    setScan(null);
    setRiskData(null);
    setFlags(null);
    setSafe(null);
    setIsLiveScan(false);

    try {
      const provider = getReadProvider();
      const scanner = getScannerContract(provider);

      // Try on-chain oracle first
      if (scanner) {
        try {
          const scanned = await scanner.isScanned(tokenAddress);
          if (scanned) {
            const results = await Promise.allSettled([
              scanner.getTokenScan(tokenAddress),
              scanner.getTokenRisk(tokenAddress),
              scanner.getTokenFlags(tokenAddress),
              scanner.isTokenSafe(tokenAddress),
            ]);
            if (results[0].status === "fulfilled") setScan(parseScan(results[0].value));
            if (results[1].status === "fulfilled") setRiskData(parseRiskData(results[1].value));
            if (results[2].status === "fulfilled") setFlags(parseFlags(results[2].value));
            if (results[3].status === "fulfilled") setSafe(results[3].value);
            setLoading(false);
            return;
          }
        } catch {
          rotateRpc();
          // Oracle read failed — fall through to live scan
        }
      }

      // Fall back to GoPlusLabs live scan
      const liveScan = await goplusLiveScan(tokenAddress);
      if (liveScan) {
        setScan(liveScan);
        setIsLiveScan(true);
      } else {
        setError("Token not found — not on oracle or GoPlusLabs");
      }
    } catch {
      setError("Failed to fetch scan data");
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setScan(null);
    setRiskData(null);
    setFlags(null);
    setSafe(null);
    setError(null);
    setIsLiveScan(false);
  }, []);

  return { scan, riskData, flags, safe, loading, error, isLiveScan, lookup, clear };
}
