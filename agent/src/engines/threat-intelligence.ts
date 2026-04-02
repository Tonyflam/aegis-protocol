// ═══════════════════════════════════════════════════════════════
// Aegis Security OS — Threat Intelligence Engine
// Real-time monitoring of whale movements, liquidity events,
// and suspicious on-chain activity for any BSC token
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";
import {
  ThreatAlert, ThreatAlertType, EngineResult,
  KNOWN_EXCHANGES, KNOWN_DEX_ROUTERS, DEAD_ADDRESSES,
} from "../types";
import { PersistenceLayer } from "../persistence";
import { RPCProviderManager } from "../providers/rpc";

const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const LP_ABI = [
  "event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)",
];

// Severity thresholds (USD)
const THRESHOLDS = {
  whaleSell: 50_000,
  largeTransfer: 100_000,
  liquidityRemove: 25_000,
  criticalSell: 500_000,
};

export class ThreatIntelligenceEngine {
  private rpc: RPCProviderManager;
  private db: PersistenceLayer;
  private lastScannedBlock: Map<string, number> = new Map();

  constructor(rpc: RPCProviderManager, db: PersistenceLayer) {
    this.rpc = rpc;
    this.db = db;
    console.log("[ThreatIntel] Engine initialized");
  }

  /**
   * Scan recent blocks for whale/threat activity on a token
   */
  async scanToken(tokenAddress: string, bnbPrice: number, blockRange = 200): Promise<EngineResult<ThreatAlert[]>> {
    const start = Date.now();
    const addr = tokenAddress.toLowerCase();

    try {
      const alerts = await this.rpc.withRetry(async (provider) => {
        const currentBlock = await provider.getBlockNumber();
        const lastScanned = this.lastScannedBlock.get(addr) || (currentBlock - blockRange);
        const fromBlock = Math.max(lastScanned + 1, currentBlock - blockRange);

        if (fromBlock >= currentBlock) return [];

        const token = new ethers.Contract(addr, ERC20_ABI, provider);
        const [totalSupply, symbol, decimals] = await Promise.all([
          token.totalSupply().catch(() => BigInt(0)),
          token.symbol().catch(() => "???"),
          token.decimals().catch(() => 18),
        ]);

        // Get Transfer events
        const filter = token.filters.Transfer();
        const events = await token.queryFilter(filter, fromBlock, currentBlock);

        const newAlerts: ThreatAlert[] = [];

        for (const event of events) {
          if (!("args" in event) || !event.args) continue;

          const from = event.args[0] as string;
          const to = event.args[1] as string;
          const value = event.args[2] as bigint;

          const fromLower = from.toLowerCase();
          const toLower = to.toLowerCase();

          // Skip mint/burn events
          if (DEAD_ADDRESSES.has(fromLower) || DEAD_ADDRESSES.has(toLower)) continue;

          const amountFormatted = ethers.formatUnits(value, decimals);
          const amount = parseFloat(amountFormatted);

          // Calculate percentage of supply
          const pctOfSupply = totalSupply > 0n
            ? Number((value * 10000n) / totalSupply) / 100
            : 0;

          // Estimate USD value (rough: use BNB price as base, adjust by supply)
          const estimatedUsd = amount * (bnbPrice / 100); // Very rough estimate

          // Detect whale sells to DEX
          if (KNOWN_DEX_ROUTERS[toLower] && pctOfSupply > 0.5) {
            const severity = estimatedUsd > THRESHOLDS.criticalSell ? "CRITICAL"
              : estimatedUsd > THRESHOLDS.whaleSell ? "HIGH"
              : pctOfSupply > 2 ? "HIGH" : "MEDIUM";

            newAlerts.push({
              id: `${event.transactionHash}-${event.index}`,
              type: ThreatAlertType.WHALE_SELL,
              severity,
              title: `Whale Sell: ${amount.toFixed(2)} ${String(symbol)} (${pctOfSupply.toFixed(2)}% of supply)`,
              description: `Large sell to ${KNOWN_DEX_ROUTERS[toLower] || "DEX"}`,
              tokenAddress: addr,
              tokenSymbol: String(symbol),
              from,
              to,
              amount: amountFormatted,
              amountUsd: estimatedUsd,
              txHash: event.transactionHash,
              blockNumber: event.blockNumber,
              timestamp: Date.now(),
            });
          }

          // Detect exchange deposits (pre-sell signals)
          if (KNOWN_EXCHANGES[toLower] && pctOfSupply > 1) {
            newAlerts.push({
              id: `${event.transactionHash}-${event.index}`,
              type: ThreatAlertType.EXCHANGE_DEPOSIT,
              severity: pctOfSupply > 5 ? "HIGH" : "MEDIUM",
              title: `Exchange Deposit: ${amount.toFixed(2)} ${String(symbol)} → ${KNOWN_EXCHANGES[toLower]}`,
              description: `${pctOfSupply.toFixed(2)}% of supply moved to exchange`,
              tokenAddress: addr,
              tokenSymbol: String(symbol),
              from,
              to,
              amount: amountFormatted,
              amountUsd: estimatedUsd,
              txHash: event.transactionHash,
              blockNumber: event.blockNumber,
              timestamp: Date.now(),
            });
          }

          // Detect large transfers between unknown wallets
          if (pctOfSupply > 3 && !KNOWN_DEX_ROUTERS[toLower] && !KNOWN_EXCHANGES[toLower]) {
            newAlerts.push({
              id: `${event.transactionHash}-${event.index}`,
              type: ThreatAlertType.LARGE_TRANSFER,
              severity: pctOfSupply > 10 ? "HIGH" : "MEDIUM",
              title: `Large Transfer: ${pctOfSupply.toFixed(2)}% of ${String(symbol)} supply moved`,
              description: `${amount.toFixed(2)} ${String(symbol)} from ${from.slice(0, 8)}... to ${to.slice(0, 8)}...`,
              tokenAddress: addr,
              tokenSymbol: String(symbol),
              from,
              to,
              amount: amountFormatted,
              amountUsd: estimatedUsd,
              txHash: event.transactionHash,
              blockNumber: event.blockNumber,
              timestamp: Date.now(),
            });
          }
        }

        this.lastScannedBlock.set(addr, currentBlock);
        return newAlerts;
      });

      // Persist alerts
      for (const alert of alerts) {
        this.db.saveThreatAlert(alert);
      }

      this.db.logEngineRun("threat-intel", addr, true, Date.now() - start);
      return { success: true, data: alerts, error: null, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.db.logEngineRun("threat-intel", addr, false, Date.now() - start, msg);
      return { success: false, data: null, error: msg, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    }
  }

  /**
   * Monitor BNB (native) whale movements
   */
  async scanBNBWhales(bnbPrice: number, blockRange = 100): Promise<EngineResult<ThreatAlert[]>> {
    const start = Date.now();

    try {
      const alerts = await this.rpc.withRetry(async (provider) => {
        const currentBlock = await provider.getBlockNumber();
        const lastScanned = this.lastScannedBlock.get("bnb-native") || (currentBlock - blockRange);
        const fromBlock = Math.max(lastScanned + 1, currentBlock - blockRange);

        if (fromBlock >= currentBlock) return [];

        const newAlerts: ThreatAlert[] = [];

        // Scan recent blocks for large native BNB transfers
        for (let blockNum = fromBlock; blockNum <= Math.min(fromBlock + 10, currentBlock); blockNum++) {
          try {
            const block = await provider.getBlock(blockNum, true);
            if (!block || !block.prefetchedTransactions) continue;

            for (const tx of block.prefetchedTransactions) {
              if (!tx.value || tx.value === 0n) continue;

              const valueInBnb = parseFloat(ethers.formatEther(tx.value));
              const valueUsd = valueInBnb * bnbPrice;

              if (valueUsd >= THRESHOLDS.largeTransfer) {
                const toLower = (tx.to || "").toLowerCase();
                const isExchangeDeposit = KNOWN_EXCHANGES[toLower];

                newAlerts.push({
                  id: `${tx.hash}-0`,
                  type: isExchangeDeposit ? ThreatAlertType.EXCHANGE_DEPOSIT : ThreatAlertType.LARGE_TRANSFER,
                  severity: valueUsd > 1_000_000 ? "CRITICAL" : valueUsd > 500_000 ? "HIGH" : "MEDIUM",
                  title: `Large BNB Transfer: ${valueInBnb.toFixed(2)} BNB ($${(valueUsd / 1000).toFixed(0)}K)`,
                  description: isExchangeDeposit
                    ? `${valueInBnb.toFixed(2)} BNB deposited to ${isExchangeDeposit}`
                    : `${valueInBnb.toFixed(2)} BNB transferred`,
                  tokenAddress: null,
                  tokenSymbol: "BNB",
                  from: tx.from,
                  to: tx.to || "",
                  amount: valueInBnb.toString(),
                  amountUsd: valueUsd,
                  txHash: tx.hash,
                  blockNumber: blockNum,
                  timestamp: Date.now(),
                });
              }
            }
          } catch { continue; }
        }

        this.lastScannedBlock.set("bnb-native", currentBlock);
        return newAlerts;
      });

      for (const alert of alerts) {
        this.db.saveThreatAlert(alert);
      }

      this.db.logEngineRun("threat-intel-bnb", "bnb", true, Date.now() - start);
      return { success: true, data: alerts, error: null, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.db.logEngineRun("threat-intel-bnb", "bnb", false, Date.now() - start, msg);
      return { success: false, data: null, error: msg, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    }
  }

  /**
   * Get recent alerts from persistence
   */
  getRecentAlerts(limit = 50): ThreatAlert[] {
    const rows = this.db.getRecentAlerts(limit);
    return rows.map(r => ({
      id: r.id as string,
      type: r.type as ThreatAlertType,
      severity: r.severity as ThreatAlert["severity"],
      title: r.title as string,
      description: r.description as string,
      tokenAddress: r.token_address as string | null,
      tokenSymbol: r.token_symbol as string | null,
      from: r.from_address as string,
      to: r.to_address as string,
      amount: r.amount as string,
      amountUsd: r.amount_usd as number,
      txHash: r.tx_hash as string,
      blockNumber: r.block_number as number,
      timestamp: r.timestamp as number,
    }));
  }
}
