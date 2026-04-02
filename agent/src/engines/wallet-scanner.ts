// ═══════════════════════════════════════════════════════════════
// Aegis Security OS — Wallet Scanner Engine
// Scans any BSC wallet for token holdings, risk, and honeypots
// Uses: Honeypot.is, GoPlusLabs, PancakeSwap on-chain, BSCScan
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";
import {
  TokenInfo, TokenRiskReport, PortfolioToken, PortfolioSnapshot,
  EngineResult, SAFE_TOKENS, BSC_TOKENS,
} from "../types";
import { PersistenceLayer } from "../persistence";
import { RPCProviderManager } from "../providers/rpc";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function owner() view returns (address)",
];

const PAIR_ABI = [
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
];

const FACTORY_ABI = [
  "function getPair(address, address) view returns (address)",
];

const PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const WBNB = BSC_TOKENS.WBNB;
const BUSD = BSC_TOKENS.BUSD;
const USDT = BSC_TOKENS.USDT;

const SCAN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class WalletScannerEngine {
  private rpc: RPCProviderManager;
  private db: PersistenceLayer;

  constructor(rpc: RPCProviderManager, db: PersistenceLayer) {
    this.rpc = rpc;
    this.db = db;
    console.log("[WalletScanner] Engine initialized");
  }

  /**
   * Scan a single token for risk
   */
  async scanToken(tokenAddress: string): Promise<EngineResult<TokenRiskReport>> {
    const start = Date.now();
    const addr = tokenAddress.toLowerCase();

    // Check cache
    const cacheAge = this.db.getTokenScanAge(addr);
    if (cacheAge !== null && cacheAge < SCAN_CACHE_TTL) {
      const cached = this.db.getTokenScan(addr);
      if (cached) {
        return {
          success: true,
          data: this.rowToReport(cached),
          error: null,
          duration: Date.now() - start,
          timestamp: Date.now(),
          cached: true,
        };
      }
    }

    try {
      // Safe token shortcut
      if (SAFE_TOKENS.has(addr)) {
        const report = await this.scanSafeToken(addr);
        this.persistReport(report);
        this.db.logEngineRun("wallet-scanner", addr, true, Date.now() - start);
        return { success: true, data: report, error: null, duration: Date.now() - start, timestamp: Date.now(), cached: false };
      }

      // Full scan: on-chain + APIs in parallel
      const [onChainData, honeypotData, goplusData] = await Promise.allSettled([
        this.fetchOnChainData(addr),
        this.fetchHoneypotData(addr),
        this.fetchGoPlusData(addr),
      ]);

      const onChain = onChainData.status === "fulfilled" ? onChainData.value : null;
      const honeypot = honeypotData.status === "fulfilled" ? honeypotData.value : null;
      const goplus = goplusData.status === "fulfilled" ? goplusData.value : null;

      if (!onChain) {
        throw new Error("Failed to fetch on-chain token data");
      }

      const report = this.buildReport(addr, onChain, honeypot, goplus);
      this.persistReport(report);
      this.db.logEngineRun("wallet-scanner", addr, true, Date.now() - start);

      return { success: true, data: report, error: null, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.db.logEngineRun("wallet-scanner", addr, false, Date.now() - start, msg);
      return { success: false, data: null, error: msg, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    }
  }

  /**
   * Scan an entire wallet's holdings
   */
  async scanWallet(walletAddress: string): Promise<EngineResult<PortfolioSnapshot>> {
    const start = Date.now();
    const addr = walletAddress.toLowerCase();

    try {
      // Get wallet's token list from BSCScan API
      const tokens = await this.discoverWalletTokens(addr);

      // Scan each token (with concurrency limit)
      const portfolioTokens: PortfolioToken[] = [];
      const BATCH_SIZE = 5;

      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (t) => {
            const scanResult = await this.scanToken(t.address);
            const balanceResult = await this.getTokenBalance(addr, t.address, t.decimals);

            return {
              token: t,
              balance: balanceResult.raw,
              balanceFormatted: balanceResult.formatted,
              valueUsd: balanceResult.valueUsd,
              riskScore: scanResult.data?.riskScore ?? 50,
              recommendation: scanResult.data?.recommendation ?? "CAUTION",
              flags: scanResult.data?.flags ?? [],
              isHoneypot: scanResult.data?.isHoneypot ?? false,
            } satisfies PortfolioToken;
          })
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            portfolioTokens.push(result.value);
          }
        }
      }

      // Add native BNB balance
      const bnbBalance = await this.rpc.withRetry(async (provider) => {
        return provider.getBalance(addr);
      });
      const bnbFormatted = ethers.formatEther(bnbBalance);
      const bnbPrice = await this.getBNBPrice();

      portfolioTokens.unshift({
        token: { address: "0x0000000000000000000000000000000000000000", symbol: "BNB", name: "BNB", decimals: 18 },
        balance: bnbBalance.toString(),
        balanceFormatted: parseFloat(bnbFormatted).toFixed(4),
        valueUsd: parseFloat(bnbFormatted) * bnbPrice,
        riskScore: 0,
        recommendation: "SAFE",
        flags: [],
        isHoneypot: false,
      });

      const snapshot: PortfolioSnapshot = {
        walletAddress: addr,
        tokens: portfolioTokens,
        totalValueUsd: portfolioTokens.reduce((sum, t) => sum + t.valueUsd, 0),
        highRiskCount: portfolioTokens.filter(t => t.riskScore >= 70).length,
        honeypotCount: portfolioTokens.filter(t => t.isHoneypot).length,
        healthScore: this.calculateHealthScore(portfolioTokens),
        scanTimestamp: Date.now(),
      };

      // Persist
      this.db.savePortfolioSnapshot({
        walletAddress: addr,
        totalValueUsd: snapshot.totalValueUsd,
        highRiskCount: snapshot.highRiskCount,
        honeypotCount: snapshot.honeypotCount,
        healthScore: snapshot.healthScore,
        tokensJson: JSON.stringify(portfolioTokens),
        scanTimestamp: snapshot.scanTimestamp,
      });
      this.db.logEngineRun("wallet-scanner-portfolio", addr, true, Date.now() - start);

      return { success: true, data: snapshot, error: null, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.db.logEngineRun("wallet-scanner-portfolio", addr, false, Date.now() - start, msg);
      return { success: false, data: null, error: msg, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    }
  }

  // ─── Internal Methods ───────────────────────────────────────

  private async fetchOnChainData(tokenAddress: string): Promise<{
    name: string; symbol: string; decimals: number; totalSupply: string;
    owner: string | null; liquidityUsd: number;
  }> {
    return this.rpc.withRetry(async (provider) => {
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        token.name().catch(() => "Unknown"),
        token.symbol().catch(() => "???"),
        token.decimals().catch(() => 18),
        token.totalSupply().catch(() => BigInt(0)),
      ]);

      let owner: string | null = null;
      try { owner = await token.owner(); } catch { /* no owner function */ }

      // Get liquidity from PancakeSwap
      const liquidityUsd = await this.getLiquidityUsd(provider, tokenAddress);

      return {
        name: String(name),
        symbol: String(symbol),
        decimals: Number(decimals),
        totalSupply: totalSupply.toString(),
        owner,
        liquidityUsd,
      };
    });
  }

  private async getLiquidityUsd(provider: ethers.JsonRpcProvider, tokenAddress: string): Promise<number> {
    const factory = new ethers.Contract(PANCAKE_FACTORY, FACTORY_ABI, provider);

    // Try WBNB pair first, then BUSD, then USDT
    for (const quoteToken of [WBNB, BUSD, USDT]) {
      try {
        const pairAddress = await factory.getPair(tokenAddress, quoteToken);
        if (pairAddress === ethers.ZeroAddress) continue;

        const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
        const [reserves, token0] = await Promise.all([
          pair.getReserves(),
          pair.token0(),
        ]);

        const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
        const quoteReserve = isToken0 ? reserves[1] : reserves[0];

        if (quoteToken === WBNB) {
          const bnbPrice = await this.getBNBPrice();
          return parseFloat(ethers.formatEther(quoteReserve)) * bnbPrice * 2;
        } else {
          return parseFloat(ethers.formatEther(quoteReserve)) * 2;
        }
      } catch { continue; }
    }
    return 0;
  }

  private async fetchHoneypotData(tokenAddress: string): Promise<{
    isHoneypot: boolean; buyTax: number; sellTax: number;
  } | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const url = `https://api.honeypot.is/v2/IsHoneypot?address=${encodeURIComponent(tokenAddress)}&chainID=56`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;

      const data = await res.json() as {
        honeypotResult?: { isHoneypot?: boolean };
        simulationResult?: { buyTax?: number; sellTax?: number };
      };

      return {
        isHoneypot: data.honeypotResult?.isHoneypot ?? false,
        buyTax: data.simulationResult?.buyTax ?? 0,
        sellTax: data.simulationResult?.sellTax ?? 0,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchGoPlusData(tokenAddress: string): Promise<{
    isVerified: boolean; isProxy: boolean; ownerCanMint: boolean;
    ownerCanPause: boolean; ownerCanBlacklist: boolean;
    isRenounced: boolean; holderCount: number; topHolderPercent: number;
  } | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const url = `https://api.gopluslabs.com/api/v1/token_security/56?contract_addresses=${encodeURIComponent(tokenAddress)}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;

      const json = await res.json() as {
        result?: Record<string, {
          is_open_source?: string;
          is_proxy?: string;
          is_mintable?: string;
          can_take_back_ownership?: string;
          owner_change_balance?: string;
          hidden_owner?: string;
          transfer_pausable?: string;
          is_blacklisted?: string;
          holder_count?: string;
          holders?: Array<{ percent: string }>;
        }>;
      };

      const data = json.result?.[tokenAddress.toLowerCase()];
      if (!data) return null;

      const topHolder = data.holders?.[0]?.percent ? parseFloat(data.holders[0].percent) * 100 : 0;

      return {
        isVerified: data.is_open_source === "1",
        isProxy: data.is_proxy === "1",
        ownerCanMint: data.is_mintable === "1",
        ownerCanPause: data.transfer_pausable === "1",
        ownerCanBlacklist: data.is_blacklisted === "1",
        isRenounced: data.can_take_back_ownership === "0" && data.hidden_owner === "0",
        holderCount: parseInt(data.holder_count || "0", 10),
        topHolderPercent: topHolder,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildReport(
    address: string,
    onChain: { name: string; symbol: string; decimals: number; totalSupply: string; owner: string | null; liquidityUsd: number },
    honeypot: { isHoneypot: boolean; buyTax: number; sellTax: number } | null,
    goplus: { isVerified: boolean; isProxy: boolean; ownerCanMint: boolean; ownerCanPause: boolean; ownerCanBlacklist: boolean; isRenounced: boolean; holderCount: number; topHolderPercent: number } | null,
  ): TokenRiskReport {
    let riskScore = 0;
    const flags: string[] = [];

    // Honeypot check
    const isHoneypot = honeypot?.isHoneypot ?? false;
    if (isHoneypot) { riskScore += 40; flags.push("HONEYPOT"); }

    // Tax check
    const buyTax = honeypot?.buyTax ?? 0;
    const sellTax = honeypot?.sellTax ?? 0;
    if (buyTax > 10 || sellTax > 10) { riskScore += 15; flags.push("HIGH_TAX"); }
    else if (buyTax > 5 || sellTax > 5) { riskScore += 8; flags.push("MODERATE_TAX"); }

    // Ownership check
    const isRenounced = goplus?.isRenounced ?? false;
    if (!isRenounced && onChain.owner && onChain.owner !== ethers.ZeroAddress) {
      riskScore += 5;
    }

    // Mint/pause/blacklist
    if (goplus?.ownerCanMint) { riskScore += 10; flags.push("MINT_FUNCTION"); }
    if (goplus?.ownerCanPause) { riskScore += 5; flags.push("PAUSE_FUNCTION"); }
    if (goplus?.ownerCanBlacklist) { riskScore += 8; flags.push("BLACKLIST_FUNCTION"); }

    // Proxy
    if (goplus?.isProxy) { riskScore += 5; flags.push("PROXY_CONTRACT"); }

    // Verification
    if (goplus && !goplus.isVerified) { riskScore += 10; flags.push("UNVERIFIED"); }

    // Liquidity
    if (onChain.liquidityUsd < 1000) { riskScore += 15; flags.push("LOW_LIQUIDITY"); }
    else if (onChain.liquidityUsd < 10000) { riskScore += 8; flags.push("THIN_LIQUIDITY"); }

    // Whale concentration
    if (goplus && goplus.topHolderPercent > 50) { riskScore += 12; flags.push("WHALE_DOMINATED"); }
    else if (goplus && goplus.topHolderPercent > 30) { riskScore += 6; flags.push("HIGH_CONCENTRATION"); }

    riskScore = Math.min(100, riskScore);

    const recommendation: TokenRiskReport["recommendation"] =
      riskScore >= 80 ? "SCAM" :
      riskScore >= 50 ? "AVOID" :
      riskScore >= 25 ? "CAUTION" : "SAFE";

    return {
      token: { address, symbol: onChain.symbol, name: onChain.name, decimals: onChain.decimals },
      riskScore,
      recommendation,
      flags,
      totalSupply: onChain.totalSupply,
      holderCount: goplus?.holderCount ?? 0,
      topHolderPercent: goplus?.topHolderPercent ?? 0,
      ownerBalance: 0,
      liquidityUsd: onChain.liquidityUsd,
      isLiquidityLocked: false,
      lpTokenBurned: false,
      isVerified: goplus?.isVerified ?? false,
      isRenounced: goplus?.isRenounced ?? false,
      ownerCanMint: goplus?.ownerCanMint ?? false,
      ownerCanPause: goplus?.ownerCanPause ?? false,
      ownerCanBlacklist: goplus?.ownerCanBlacklist ?? false,
      isProxy: goplus?.isProxy ?? false,
      isHoneypot,
      buyTax,
      sellTax,
      scanTimestamp: Date.now(),
      scanDuration: 0,
    };
  }

  private async scanSafeToken(address: string): Promise<TokenRiskReport> {
    const info = await this.rpc.withRetry(async (provider) => {
      const token = new ethers.Contract(address, ERC20_ABI, provider);
      const [name, symbol, decimals] = await Promise.all([
        token.name().catch(() => "Unknown"),
        token.symbol().catch(() => "???"),
        token.decimals().catch(() => 18),
      ]);
      return { name: String(name), symbol: String(symbol), decimals: Number(decimals) };
    });

    return {
      token: { address, symbol: info.symbol, name: info.name, decimals: info.decimals },
      riskScore: 0,
      recommendation: "SAFE",
      flags: ["ESTABLISHED_TOKEN"],
      totalSupply: "0",
      holderCount: 0,
      topHolderPercent: 0,
      ownerBalance: 0,
      liquidityUsd: 0,
      isLiquidityLocked: true,
      lpTokenBurned: false,
      isVerified: true,
      isRenounced: true,
      ownerCanMint: false,
      ownerCanPause: false,
      ownerCanBlacklist: false,
      isProxy: false,
      isHoneypot: false,
      buyTax: 0,
      sellTax: 0,
      scanTimestamp: Date.now(),
      scanDuration: 0,
    };
  }

  private async discoverWalletTokens(walletAddress: string): Promise<TokenInfo[]> {
    // Use BSCScan API to get BEP-20 token transfers for this wallet
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const apiKey = process.env.BSCSCAN_API_KEY || "";
      const baseUrl = apiKey
        ? `https://api.bscscan.com/api?module=account&action=tokentx&address=${encodeURIComponent(walletAddress)}&startblock=0&endblock=999999999&sort=desc&apikey=${encodeURIComponent(apiKey)}`
        : `https://api.bscscan.com/api?module=account&action=tokentx&address=${encodeURIComponent(walletAddress)}&startblock=0&endblock=999999999&sort=desc`;

      const res = await fetch(baseUrl, { signal: controller.signal });
      if (!res.ok) return this.fallbackTokenDiscovery(walletAddress);

      const json = await res.json() as {
        status: string;
        result: Array<{
          contractAddress: string;
          tokenSymbol: string;
          tokenName: string;
          tokenDecimal: string;
        }>;
      };

      if (json.status !== "1" || !Array.isArray(json.result)) {
        return this.fallbackTokenDiscovery(walletAddress);
      }

      // Deduplicate tokens
      const seen = new Set<string>();
      const tokens: TokenInfo[] = [];

      for (const tx of json.result) {
        const addr = tx.contractAddress.toLowerCase();
        if (seen.has(addr)) continue;
        seen.add(addr);
        tokens.push({
          address: tx.contractAddress,
          symbol: tx.tokenSymbol,
          name: tx.tokenName,
          decimals: parseInt(tx.tokenDecimal, 10) || 18,
        });
        if (tokens.length >= 50) break; // Limit to top 50 tokens
      }

      return tokens;
    } catch {
      return this.fallbackTokenDiscovery(walletAddress);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fallbackTokenDiscovery(walletAddress: string): Promise<TokenInfo[]> {
    // Check balances of well-known tokens
    const knownTokens = Object.entries(BSC_TOKENS);
    const results: TokenInfo[] = [];

    await this.rpc.withRetry(async (provider) => {
      for (const [symbol, address] of knownTokens) {
        try {
          const token = new ethers.Contract(address, ERC20_ABI, provider);
          const balance = await token.balanceOf(walletAddress);
          if (balance > 0n) {
            const [name, decimals] = await Promise.all([
              token.name().catch(() => symbol),
              token.decimals().catch(() => 18),
            ]);
            results.push({ address, symbol, name: String(name), decimals: Number(decimals) });
          }
        } catch { /* skip */ }
      }
    });

    return results;
  }

  private async getTokenBalance(walletAddress: string, tokenAddress: string, decimals: number): Promise<{
    raw: string; formatted: string; valueUsd: number;
  }> {
    try {
      return await this.rpc.withRetry(async (provider) => {
        const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const balance = await token.balanceOf(walletAddress);
        const formatted = ethers.formatUnits(balance, decimals);
        return { raw: balance.toString(), formatted, valueUsd: 0 }; // Price lookup happens in portfolio
      });
    } catch {
      return { raw: "0", formatted: "0", valueUsd: 0 };
    }
  }

  private async getBNBPrice(): Promise<number> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd",
          { signal: controller.signal }
        );
        const data = await res.json() as { binancecoin?: { usd?: number } };
        return data.binancecoin?.usd ?? 600;
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return 600; // Fallback estimate
    }
  }

  private calculateHealthScore(tokens: PortfolioToken[]): number {
    if (tokens.length === 0) return 100;

    const totalValue = tokens.reduce((sum, t) => sum + t.valueUsd, 0);
    if (totalValue === 0) return 100;

    // Weighted average of (100 - riskScore) by value
    let weightedSafety = 0;
    for (const t of tokens) {
      const weight = totalValue > 0 ? t.valueUsd / totalValue : 1 / tokens.length;
      weightedSafety += (100 - t.riskScore) * weight;
    }

    // Penalty for honeypots
    const honeypotCount = tokens.filter(t => t.isHoneypot).length;
    const honeypotPenalty = Math.min(30, honeypotCount * 10);

    return Math.max(0, Math.min(100, Math.round(weightedSafety - honeypotPenalty)));
  }

  private persistReport(report: TokenRiskReport): void {
    this.db.saveTokenScan({
      address: report.token.address,
      symbol: report.token.symbol,
      name: report.token.name,
      decimals: report.token.decimals,
      riskScore: report.riskScore,
      recommendation: report.recommendation,
      flags: report.flags,
      totalSupply: report.totalSupply,
      holderCount: report.holderCount,
      topHolderPercent: report.topHolderPercent,
      ownerBalance: report.ownerBalance,
      liquidityUsd: report.liquidityUsd,
      isLiquidityLocked: report.isLiquidityLocked,
      lpTokenBurned: report.lpTokenBurned,
      isVerified: report.isVerified,
      isRenounced: report.isRenounced,
      ownerCanMint: report.ownerCanMint,
      ownerCanPause: report.ownerCanPause,
      ownerCanBlacklist: report.ownerCanBlacklist,
      isProxy: report.isProxy,
      isHoneypot: report.isHoneypot,
      buyTax: report.buyTax,
      sellTax: report.sellTax,
      scanTimestamp: report.scanTimestamp,
      scanDuration: report.scanDuration,
    });
  }

  private rowToReport(row: Record<string, unknown>): TokenRiskReport {
    return {
      token: {
        address: row.address as string,
        symbol: row.symbol as string,
        name: row.name as string,
        decimals: row.decimals as number,
      },
      riskScore: row.risk_score as number,
      recommendation: row.recommendation as TokenRiskReport["recommendation"],
      flags: row.flags as string[],
      totalSupply: (row.total_supply as string) || "0",
      holderCount: (row.holder_count as number) || 0,
      topHolderPercent: (row.top_holder_percent as number) || 0,
      ownerBalance: (row.owner_balance as number) || 0,
      liquidityUsd: (row.liquidity_usd as number) || 0,
      isLiquidityLocked: !!(row.is_liquidity_locked),
      lpTokenBurned: !!(row.lp_token_burned),
      isVerified: !!(row.is_verified),
      isRenounced: !!(row.is_renounced),
      ownerCanMint: !!(row.owner_can_mint),
      ownerCanPause: !!(row.owner_can_pause),
      ownerCanBlacklist: !!(row.owner_can_blacklist),
      isProxy: !!(row.is_proxy),
      isHoneypot: !!(row.is_honeypot),
      buyTax: (row.buy_tax as number) || 0,
      sellTax: (row.sell_tax as number) || 0,
      scanTimestamp: row.scan_timestamp as number,
      scanDuration: (row.scan_duration as number) || 0,
    };
  }
}
