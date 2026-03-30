// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Live Market Data Provider
// Fetches REAL market data from CoinGecko, DeFiLlama, and BSC
// ═══════════════════════════════════════════════════════════════

import { MarketData } from "./analyzer";

interface CoinGeckoResponse {
  binancecoin: {
    usd: number;
    usd_24h_change: number;
    usd_24h_vol: number;
    usd_market_cap: number;
  };
}

interface DeFiLlamaProtocol {
  tvl: number;
  change_1d: number;
}

/**
 * Fetches real BNB market data from public APIs (no API key needed)
 * Uses CoinGecko for price/volume and DeFiLlama for TVL/liquidity
 */
export class LiveMarketProvider {
  private lastData: MarketData | null = null;
  private lastFetchTime = 0;
  private cacheDurationMs = 15000; // 15s cache to avoid rate limits

  /**
   * Get real BNB market data from live APIs
   */
  async fetchLiveData(): Promise<MarketData> {
    // Use cached data if fresh enough
    if (this.lastData && Date.now() - this.lastFetchTime < this.cacheDurationMs) {
      return this.lastData;
    }

    const [priceData, tvlData] = await Promise.allSettled([
      this.fetchCoinGeckoData(),
      this.fetchDeFiLlamaData(),
    ]);

    const price = priceData.status === "fulfilled" ? priceData.value : null;
    const tvl = tvlData.status === "fulfilled" ? tvlData.value : null;

    const data: MarketData = {
      price: price?.price ?? 580,
      priceChange24h: price?.priceChange24h ?? 0,
      volume24h: price?.volume24h ?? 500_000_000,
      volumeChange: this.calculateVolumeChange(price?.volume24h),
      liquidity: tvl?.tvl ?? 2_000_000_000,
      liquidityChange: tvl?.change1d ?? 0,
      holders: 1_520_000, // Estimate — BSCScan API requires paid key for holder count
      topHolderPercent: 8.5, // Binance hot wallet — well known approximate value
    };

    const sources: string[] = [];
    if (!price) sources.push("price:fallback");
    if (!tvl) sources.push("tvl:fallback");
    sources.push("holders:estimate", "topHolder:estimate");

    this.lastData = data;
    this.lastFetchTime = Date.now();

    console.log(`[LiveMarket] Fetched: BNB=$${data.price.toFixed(2)}, 24h=${data.priceChange24h > 0 ? '+' : ''}${data.priceChange24h.toFixed(2)}%, vol=$${(data.volume24h / 1e6).toFixed(0)}M [${sources.join(", ")}]`);
    return data;
  }

  /**
   * CoinGecko free API — BNB price, 24h change, volume
   */
  private async fetchCoinGeckoData(): Promise<{
    price: number;
    priceChange24h: number;
    volume24h: number;
  }> {
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true";
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });

      if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
      
      const json = (await res.json()) as CoinGeckoResponse;
      const bnb = json.binancecoin;

      return {
        price: bnb.usd,
        priceChange24h: bnb.usd_24h_change,
        volume24h: bnb.usd_24h_vol,
      };
    } catch (err: any) {
      console.warn(`[LiveMarket] CoinGecko failed: ${err.message}`);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * DeFiLlama free API — BNB Chain TVL (proxy for liquidity depth)
   */
  private async fetchDeFiLlamaData(): Promise<{
    tvl: number;
    change1d: number;
  }> {
    const url = "https://api.llama.fi/v2/chains";
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });

      if (!res.ok) throw new Error(`DeFiLlama HTTP ${res.status}`);

      const chains = (await res.json()) as any[];
      const bsc = chains.find((c: any) => c.gecko_id === "binancecoin" || c.name === "BSC");

      if (!bsc) throw new Error("BSC chain data not found");

      return {
        tvl: bsc.tvl ?? 2_000_000_000,
        change1d: bsc.change_1d ?? 0,
      };
    } catch (err: any) {
      console.warn(`[LiveMarket] DeFiLlama failed: ${err.message}`);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Calculate volume change relative to typical BNB daily volume
   */
  private calculateVolumeChange(currentVolume?: number): number {
    if (!currentVolume) return 0;
    // BNB typical daily volume is ~$500M–$1B
    const typicalVolume = 750_000_000;
    return ((currentVolume - typicalVolume) / typicalVolume) * 100;
  }
}

/**
 * BSC on-chain data provider using public RPC
 * Fetches gas prices, block times, $UNIQ data, and pending tx data
 */
export class BSCOnChainProvider {
  private rpcUrl: string;

  /** $UNIQ token address on BNB Chain */
  static readonly UNIQ_TOKEN = "0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777";

  constructor(rpcUrl: string = "https://data-seed-prebsc-1-s1.bnbchain.org:8545") {
    this.rpcUrl = rpcUrl;
  }

  /**
   * Get $UNIQ balance for an address (uses ERC-20 balanceOf)
   * @param holder Address to check
   * @returns Balance in wei (18 decimals)
   */
  async getUniqBalance(holder: string): Promise<bigint> {
    try {
      // balanceOf(address) selector = 0x70a08231
      const paddedAddr = holder.toLowerCase().replace("0x", "").padStart(64, "0");
      const data = `0x70a08231${paddedAddr}`;

      const res = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [{ to: BSCOnChainProvider.UNIQ_TOKEN, data }, "latest"],
          id: 2,
        }),
      });

      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      return BigInt(json.result || "0x0");
    } catch (err: any) {
      console.warn(`[BSCOnChain] $UNIQ balance check failed: ${err.message}`);
      return BigInt(0);
    }
  }

  /**
   * Check if address is a $UNIQ holder (balance > 0)
   */
  async isUniqHolder(holder: string): Promise<boolean> {
    const balance = await this.getUniqBalance(holder);
    return balance > BigInt(0);
  }

  /**
   * Get current BSC gas price (indicator of network congestion)
   */
  async getGasPrice(): Promise<bigint> {
    try {
      const res = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_gasPrice",
          params: [],
          id: 1,
        }),
      });
      const json = await res.json() as any;
      return BigInt(json.result);
    } catch {
      return 5000000000n; // 5 gwei default
    }
  }

  /**
   * Get latest block number
   */
  async getBlockNumber(): Promise<number> {
    try {
      const res = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        }),
      });
      const json = await res.json() as any;
      return parseInt(json.result, 16);
    } catch {
      return 0;
    }
  }
}
