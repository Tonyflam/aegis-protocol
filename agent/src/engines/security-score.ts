// ═══════════════════════════════════════════════════════════════
// Aegis Security OS — Security Score Oracle Engine
// Computes wallet/token security scores for on-chain publishing
// B2B API: other protocols can query Aegis scores
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";
import { SecurityScore, EngineResult } from "../types";
import { PersistenceLayer } from "../persistence";
import { RPCProviderManager } from "../providers/rpc";
import { WalletScannerEngine } from "./wallet-scanner";
import { ApprovalRiskEngine } from "./approval-risk";

const SCORE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export class SecurityScoreOracle {
  private rpc: RPCProviderManager;
  private db: PersistenceLayer;
  private scanner: WalletScannerEngine;
  private approvals: ApprovalRiskEngine;

  constructor(
    rpc: RPCProviderManager,
    db: PersistenceLayer,
    scanner: WalletScannerEngine,
    approvals: ApprovalRiskEngine,
  ) {
    this.rpc = rpc;
    this.db = db;
    this.scanner = scanner;
    this.approvals = approvals;
    console.log("[SecurityScore] Oracle initialized");
  }

  /**
   * Get security score for a wallet address
   */
  async getWalletScore(walletAddress: string): Promise<EngineResult<SecurityScore>> {
    const start = Date.now();
    const addr = walletAddress.toLowerCase();

    // Check cache
    const cached = this.db.getSecurityScore(addr);
    if (cached && (Date.now() - (cached.last_updated as number)) < SCORE_CACHE_TTL) {
      return {
        success: true,
        data: this.rowToScore(cached),
        error: null,
        duration: Date.now() - start,
        timestamp: Date.now(),
        cached: true,
      };
    }

    try {
      // Run scans in parallel
      const [portfolioResult, approvalResult] = await Promise.allSettled([
        this.scanner.scanWallet(addr),
        this.approvals.scanApprovals(addr),
      ]);

      const portfolio = portfolioResult.status === "fulfilled" ? portfolioResult.value.data : null;
      const approvalData = approvalResult.status === "fulfilled" ? approvalResult.value.data : null;

      // Compute token safety score
      let tokenSafety = 100;
      if (portfolio && portfolio.tokens.length > 0) {
        const avgRisk = portfolio.tokens.reduce((s, t) => s + t.riskScore, 0) / portfolio.tokens.length;
        tokenSafety = Math.max(0, Math.round(100 - avgRisk));
        if (portfolio.honeypotCount > 0) tokenSafety = Math.max(0, tokenSafety - portfolio.honeypotCount * 15);
      }

      // Compute approval hygiene score
      let approvalHygiene = 100;
      if (approvalData) {
        approvalHygiene -= approvalData.criticalCount * 20;
        approvalHygiene -= approvalData.highRiskCount * 10;
        approvalHygiene -= Math.min(20, approvalData.totalApprovals * 2);
        approvalHygiene = Math.max(0, approvalHygiene);
      }

      // Transaction patterns (basic: based on portfolio diversity)
      const transactionPatterns = portfolio && portfolio.tokens.length > 3 ? 80 : 65;

      // Exposure risk (concentration)
      let exposureRisk = 85;
      if (portfolio && portfolio.totalValueUsd > 0) {
        for (const t of portfolio.tokens) {
          if (t.valueUsd / portfolio.totalValueUsd > 0.9 && t.token.symbol !== "BNB") {
            exposureRisk = 40;
            break;
          }
        }
      }

      const historicalBehavior = 75;

      const riskFactors: string[] = [];
      if (tokenSafety < 50) riskFactors.push("High-risk tokens in portfolio");
      if (approvalHygiene < 50) riskFactors.push("Dangerous token approvals");
      if (exposureRisk < 60) riskFactors.push("Extreme portfolio concentration");
      if (portfolio?.honeypotCount) riskFactors.push("Honeypot tokens detected");

      const overallScore = Math.round(
        tokenSafety * 0.30 + approvalHygiene * 0.25 +
        transactionPatterns * 0.15 + exposureRisk * 0.15 + historicalBehavior * 0.15
      );

      const score: SecurityScore = {
        address: addr,
        addressType: "wallet",
        overallScore: Math.max(0, Math.min(100, overallScore)),
        breakdown: { tokenSafety, approvalHygiene, transactionPatterns, exposureRisk, historicalBehavior },
        riskFactors,
        lastUpdated: Date.now(),
      };

      // Persist
      this.db.saveSecurityScore({
        address: addr,
        addressType: "wallet",
        overallScore: score.overallScore,
        tokenSafety, approvalHygiene, transactionPatterns, exposureRisk, historicalBehavior,
        riskFactors,
        lastUpdated: Date.now(),
      });

      this.db.logEngineRun("security-score", addr, true, Date.now() - start);
      return { success: true, data: score, error: null, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.db.logEngineRun("security-score", addr, false, Date.now() - start, msg);
      return { success: false, data: null, error: msg, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    }
  }

  /**
   * Get security score for a token
   */
  async getTokenScore(tokenAddress: string): Promise<EngineResult<SecurityScore>> {
    const start = Date.now();
    const addr = tokenAddress.toLowerCase();

    const cached = this.db.getSecurityScore(addr);
    if (cached && (Date.now() - (cached.last_updated as number)) < SCORE_CACHE_TTL) {
      return {
        success: true,
        data: this.rowToScore(cached),
        error: null,
        duration: Date.now() - start,
        timestamp: Date.now(),
        cached: true,
      };
    }

    try {
      const scanResult = await this.scanner.scanToken(addr);
      if (!scanResult.success || !scanResult.data) {
        throw new Error(scanResult.error || "Token scan failed");
      }

      const scan = scanResult.data;

      const tokenSafety = Math.max(0, 100 - scan.riskScore);
      const approvalHygiene = scan.isRenounced ? 90 : scan.ownerCanMint ? 30 : 70;
      const transactionPatterns = scan.liquidityUsd > 100000 ? 80 : scan.liquidityUsd > 10000 ? 60 : 30;
      const exposureRisk = scan.topHolderPercent > 50 ? 20 : scan.topHolderPercent > 30 ? 50 : 80;
      const historicalBehavior = scan.isVerified ? 80 : 40;

      const riskFactors = [...scan.flags];
      const overallScore = Math.round(
        tokenSafety * 0.35 + approvalHygiene * 0.20 +
        transactionPatterns * 0.15 + exposureRisk * 0.15 + historicalBehavior * 0.15
      );

      const score: SecurityScore = {
        address: addr,
        addressType: "token",
        overallScore: Math.max(0, Math.min(100, overallScore)),
        breakdown: { tokenSafety, approvalHygiene, transactionPatterns, exposureRisk, historicalBehavior },
        riskFactors,
        lastUpdated: Date.now(),
      };

      this.db.saveSecurityScore({
        address: addr, addressType: "token", overallScore: score.overallScore,
        tokenSafety, approvalHygiene, transactionPatterns, exposureRisk, historicalBehavior,
        riskFactors, lastUpdated: Date.now(),
      });

      this.db.logEngineRun("security-score-token", addr, true, Date.now() - start);
      return { success: true, data: score, error: null, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.db.logEngineRun("security-score-token", addr, false, Date.now() - start, msg);
      return { success: false, data: null, error: msg, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    }
  }

  private rowToScore(row: Record<string, unknown>): SecurityScore {
    return {
      address: row.address as string,
      addressType: row.address_type as "wallet" | "token",
      overallScore: row.overall_score as number,
      breakdown: {
        tokenSafety: row.token_safety as number,
        approvalHygiene: row.approval_hygiene as number,
        transactionPatterns: row.transaction_patterns as number,
        exposureRisk: row.exposure_risk as number,
        historicalBehavior: row.historical_behavior as number,
      },
      riskFactors: row.risk_factors as string[],
      lastUpdated: row.last_updated as number,
    };
  }
}
