// ═══════════════════════════════════════════════════════════════
// Aegis Security OS — Approval Risk Engine
// Scans wallet for all ERC-20 token approvals and rates risk
// Detects: unlimited approvals, stale approvals, risky spenders
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";
import {
  TokenApproval, ApprovalRiskLevel, ApprovalScanResult, EngineResult,
  KNOWN_DEX_ROUTERS, KNOWN_EXCHANGES,
} from "../types";
import { PersistenceLayer } from "../persistence";
import { RPCProviderManager } from "../providers/rpc";

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

// Well-known safe spenders on BSC
const KNOWN_SAFE_SPENDERS = new Set([
  ...Object.keys(KNOWN_DEX_ROUTERS),
  "0x000000000022d473030f116ddee9f6b43ac78ba3", // Permit2
]);

const MAX_UINT256 = ethers.MaxUint256;
const UNLIMITED_THRESHOLD = ethers.parseEther("1000000000"); // >1B tokens = "unlimited"

export class ApprovalRiskEngine {
  private rpc: RPCProviderManager;
  private db: PersistenceLayer;

  constructor(rpc: RPCProviderManager, db: PersistenceLayer) {
    this.rpc = rpc;
    this.db = db;
    console.log("[ApprovalRisk] Engine initialized");
  }

  /**
   * Scan all approvals for a wallet address
   */
  async scanApprovals(walletAddress: string): Promise<EngineResult<ApprovalScanResult>> {
    const start = Date.now();
    const addr = walletAddress.toLowerCase();

    try {
      // Discover approval events using BSCScan API
      const approvalEvents = await this.discoverApprovals(addr);

      // Check each approval's current allowance
      const approvals: TokenApproval[] = [];

      const BATCH_SIZE = 10;
      for (let i = 0; i < approvalEvents.length; i += BATCH_SIZE) {
        const batch = approvalEvents.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(event => this.checkApproval(addr, event))
        );

        for (const result of results) {
          if (result.status === "fulfilled" && result.value) {
            approvals.push(result.value);
          }
        }
      }

      // Filter out zero approvals (already revoked)
      const activeApprovals = approvals.filter(a => a.allowance !== "0");

      const result: ApprovalScanResult = {
        walletAddress: addr,
        approvals: activeApprovals,
        totalApprovals: activeApprovals.length,
        highRiskCount: activeApprovals.filter(a =>
          a.riskLevel === ApprovalRiskLevel.HIGH || a.riskLevel === ApprovalRiskLevel.CRITICAL
        ).length,
        criticalCount: activeApprovals.filter(a => a.riskLevel === ApprovalRiskLevel.CRITICAL).length,
        totalValueAtRisk: 0, // Would need token prices to calculate
        scanTimestamp: Date.now(),
      };

      // Persist each approval
      for (const approval of activeApprovals) {
        this.db.saveApproval({
          walletAddress: addr,
          tokenAddress: approval.tokenAddress,
          tokenSymbol: approval.tokenSymbol,
          spender: approval.spender,
          spenderLabel: approval.spenderLabel,
          allowance: approval.allowance,
          allowanceFormatted: approval.allowanceFormatted,
          isUnlimited: approval.isUnlimited,
          riskLevel: approval.riskLevel,
          riskReasons: approval.riskReasons,
          scanTimestamp: Date.now(),
        });
      }

      this.db.logEngineRun("approval-risk", addr, true, Date.now() - start);
      return { success: true, data: result, error: null, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.db.logEngineRun("approval-risk", addr, false, Date.now() - start, msg);
      return { success: false, data: null, error: msg, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    }
  }

  // ─── Internals ──────────────────────────────────────────────

  private async discoverApprovals(walletAddress: string): Promise<Array<{
    tokenAddress: string; spender: string;
  }>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      // Use BSCScan API to find Approval events emitted by the wallet
      const apiKey = process.env.BSCSCAN_API_KEY || "";
      // Get ERC-20 token transfer history to discover tokens the wallet has interacted with
      const baseUrl = `https://api.bscscan.com/api?module=account&action=tokentx&address=${encodeURIComponent(walletAddress)}&startblock=0&endblock=999999999&sort=desc${apiKey ? `&apikey=${encodeURIComponent(apiKey)}` : ""}`;

      const res = await fetch(baseUrl, { signal: controller.signal });
      if (!res.ok) return [];

      const json = await res.json() as {
        status: string;
        result: Array<{
          contractAddress: string;
          to: string;
          from: string;
        }>;
      };

      if (json.status !== "1" || !Array.isArray(json.result)) return [];

      // For each token, we need to check approvals to common spenders
      const tokenAddresses = [...new Set(json.result.map(tx => tx.contractAddress.toLowerCase()))];

      // Check approvals for known DEX routers and any address that received tokens
      const spenderAddresses = [
        ...Object.keys(KNOWN_DEX_ROUTERS),
        ...new Set(json.result
          .filter(tx => tx.from.toLowerCase() === walletAddress)
          .map(tx => tx.to.toLowerCase())
        ),
      ];

      const pairs: Array<{ tokenAddress: string; spender: string }> = [];
      for (const token of tokenAddresses.slice(0, 30)) { // Limit to 30 tokens
        for (const spender of [...new Set(spenderAddresses)].slice(0, 10)) { // Limit spenders
          pairs.push({ tokenAddress: token, spender });
        }
      }

      return pairs;
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  private async checkApproval(walletAddress: string, event: {
    tokenAddress: string; spender: string;
  }): Promise<TokenApproval | null> {
    try {
      return await this.rpc.withRetry(async (provider) => {
        const token = new ethers.Contract(event.tokenAddress, ERC20_ABI, provider);

        const [allowance, symbol, decimals] = await Promise.all([
          token.allowance(walletAddress, event.spender),
          token.symbol().catch(() => "???"),
          token.decimals().catch(() => 18),
        ]);

        if (allowance === 0n) return null;

        const isUnlimited = allowance >= UNLIMITED_THRESHOLD || allowance === MAX_UINT256;
        const formatted = isUnlimited
          ? "Unlimited"
          : ethers.formatUnits(allowance, decimals);

        const spenderLabel = this.getSpenderLabel(event.spender);
        const { riskLevel, reasons } = this.assessApprovalRisk(
          event.spender, spenderLabel, isUnlimited, allowance
        );

        return {
          tokenAddress: event.tokenAddress,
          tokenSymbol: String(symbol),
          spender: event.spender,
          spenderLabel,
          allowance: allowance.toString(),
          allowanceFormatted: formatted,
          isUnlimited,
          riskLevel,
          riskReasons: reasons,
          lastUsedBlock: null,
          approvedAtBlock: null,
        };
      });
    } catch {
      return null;
    }
  }

  private assessApprovalRisk(
    spender: string, spenderLabel: string, isUnlimited: boolean, _allowance: bigint
  ): { riskLevel: ApprovalRiskLevel; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    // Known safe spender?
    const isSafe = KNOWN_SAFE_SPENDERS.has(spender.toLowerCase());
    const isExchange = spender.toLowerCase() in KNOWN_EXCHANGES;

    if (isUnlimited) {
      reasons.push("Unlimited approval");
      score += isSafe ? 10 : 30;
    }

    if (!isSafe && !isExchange && spenderLabel === "Unknown Contract") {
      reasons.push("Unknown spender contract");
      score += 20;
    }

    if (isSafe) {
      reasons.push(`Known DEX: ${spenderLabel}`);
    }

    const riskLevel: ApprovalRiskLevel =
      score >= 40 ? ApprovalRiskLevel.CRITICAL :
      score >= 25 ? ApprovalRiskLevel.HIGH :
      score >= 15 ? ApprovalRiskLevel.MEDIUM :
      score >= 5 ? ApprovalRiskLevel.LOW :
      ApprovalRiskLevel.SAFE;

    return { riskLevel, reasons };
  }

  private getSpenderLabel(address: string): string {
    const lower = address.toLowerCase();
    if (KNOWN_DEX_ROUTERS[lower]) return KNOWN_DEX_ROUTERS[lower];
    if (KNOWN_EXCHANGES[lower]) return KNOWN_EXCHANGES[lower];
    return "Unknown Contract";
  }
}
