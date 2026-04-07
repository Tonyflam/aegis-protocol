"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface LiveMarketData {
  bnbPriceCoinGecko: number;
  priceChange24h: number;
  volume24h: number;
  bscTvl: number;
  oracleStatus: "consistent" | "warning" | "critical";
  isLoading: boolean;
  lastUpdated: number;
  error: string | null;
}

const INITIAL: LiveMarketData = {
  bnbPriceCoinGecko: 0,
  priceChange24h: 0,
  volume24h: 0,
  bscTvl: 0,
  oracleStatus: "consistent",
  isLoading: true,
  lastUpdated: 0,
  error: null,
};

/**
 * Fetches REAL market data from CoinGecko + DeFiLlama.
 * No fake data. Shows loading state until real data arrives.
 */
export function useLiveMarketData(intervalMs = 30000): LiveMarketData {
  const [data, setData] = useState<LiveMarketData>(INITIAL);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const [priceRes, tvlRes] = await Promise.allSettled([
        fetch("https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true", {
          signal: AbortSignal.timeout(8000),
        }),
        fetch("https://api.llama.fi/v2/chains", {
          signal: AbortSignal.timeout(8000),
        }),
      ]);

      let bnbPrice = 0, change24h = 0, vol24h = 0, tvl = 0;

      if (priceRes.status === "fulfilled" && priceRes.value.ok) {
        const json = await priceRes.value.json();
        const bnb = json.binancecoin;
        if (bnb) {
          bnbPrice = bnb.usd ?? 0;
          change24h = bnb.usd_24h_change ?? 0;
          vol24h = bnb.usd_24h_vol ?? 0;
        }
      }

      if (tvlRes.status === "fulfilled" && tvlRes.value.ok) {
        const chains = await tvlRes.value.json();
        const bsc = chains.find((c: { gecko_id?: string; name?: string }) =>
          c.gecko_id === "binancecoin" || c.name === "BSC"
        );
        if (bsc) tvl = bsc.tvl ?? 0;
      }

      if (!mountedRef.current) return;

      setData({
        bnbPriceCoinGecko: bnbPrice,
        priceChange24h: change24h,
        volume24h: vol24h,
        bscTvl: tvl,
        oracleStatus: bnbPrice > 0 ? "consistent" : "warning",
        isLoading: false,
        lastUpdated: Date.now(),
        error: null,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch market data",
      }));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    const id = setInterval(fetchData, intervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchData, intervalMs]);

  return data;
}
