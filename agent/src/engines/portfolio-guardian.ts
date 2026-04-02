// ═══════════════════════════════════════════════════════════════
// Aegis Security OS — Portfolio Guardian Engine
// Monitors portfolio-wide DeFi exposure, tracks value changes,
// detects portfolio-level threats (concentration, de-peg, etc.)
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";
import {
  PortfolioSnapshot, PortfolioToken, SecurityScore, EngineResult,
} from "../types";
import { PersistenceLayer } from "../persistence";
import { RPCProviderManager } from "../providers/rpc";
import { WalletScannerEngine } from "./wallet-scanner";
import { ApprovalRiskEngine } from "./approval-risk";

export class PortfolioGuardianEngine {
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
    console.log("[PortfolioGuardian] Engine initialized");
  }

  /**
   * Full portfolio health check — scans tokens + approvals + computes score
   */
  async fullHealthCheck(walletAddress: string): Promise<EngineResult<{
    portfolio: PortfolioSnapshot;
    securityScore: SecurityScore;
    alerts: string[];
  }>> {
    const start = Date.now();
    const addr = walletAddress.toLowerCase();

    try {
      // Run wallet scan and approval scan in parallel
      const [portfolioResult, approvalResult] = await Promise.all([
        this.scanner.scanWallet(addr),
        this.approvals.scanApprovals(addr),
      ]);

      if (!portfolioResult.success || !portfolioResult.data) {
        throw new Error(portfolioResult.error || "Portfolio scan failed");
      }

      const portfolio = portfolioResult.data;
      const approvalData = approvalResult.data;

      // Generate alerts based on portfolio analysis
      const alerts: string[] = [];

      // Check for honeypots
      if (portfolio.honeypotCount > 0) {
        alerts.push(`${portfolio.honeypotCount} honeypot token(s) detected in portfolio`);
      }

      // Check for high-risk tokens
      if (portfolio.highRiskCount > 0) {
        alerts.push(`${portfolio.highRiskCount} high-risk token(s) found`);
      }

      // Check concentration risk
      const concentrationAlert = this.checkConcentration(portfolio);
      if (concentrationAlert) alerts.push(concentrationAlert);

      // Check approval risks
      if (approvalData && approvalData.criticalCount > 0) {
        alerts.push(`${approvalData.criticalCount} critical approval(s) need immediate attention`);
      }
      if (approvalData && approvalData.highRiskCount > 0) {
        alerts.push(`${approvalData.highRiskCount} high-risk approval(s) detected`);
      }

      // Compute security score
      const securityScore = this.computeSecurityScore(addr, portfolio, approvalData);

      // Persist score
      this.db.saveSecurityScore({
        address: addr,
        addressType: "wallet",
        overallScore: securityScore.overallScore,
        tokenSafety: securityScore.breakdown.tokenSafety,
        approvalHygiene: securityScore.breakdown.approvalHygiene,
        transactionPatterns: securityScore.breakdown.transactionPatterns,
        exposureRisk: securityScore.breakdown.exposureRisk,
        historicalBehavior: securityScore.breakdown.historicalBehavior,
        riskFactors: securityScore.riskFactors,
        lastUpdated: Date.now(),
      });

      this.db.logEngineRun("portfolio-guardian", addr, true, Date.now() - start);

      return {
        success: true,
        data: { portfolio, securityScore, alerts },
        error: null,
        duration: Date.now() - start,
        timestamp: Date.now(),
        cached: false,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.db.logEngineRun("portfolio-guardian", addr, false, Date.now() - start, msg);
      return { success: false, data: null, error: msg, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    }
  }

  /**
   * Quick portfolio check — uses cached data when available
   */
  async quickCheck(walletAddress: string): Promise<EngineResult<SecurityScore>> {
    const start = Date.now();
    const addr = walletAddress.toLowerCase();

    const cached = this.db.getSecurityScore(addr);
    if (cached) {
      const age = Date.now() - (cached.last_updated as number);
      if (age < 5 * 60 * 1000) { // 5 minute cache
        return {
          success: true,
          data: {
            address: addr,
            addressType: "wallet",
            overallScore: cached.overall_score as number,
            breakdown: {
              tokenSafety: cached.token_safety as number,
              approvalHygiene: cached.approval_hygiene as number,
              transactionPatterns: cached.transaction_patterns as number,
              exposureRisk: cached.exposure_risk as number,
              historicalBehavior: cached.historical_behavior as number,
            },
            riskFactors: cached.risk_factors as string[],
            lastUpdated: cached.last_updated as number,
          },
          error: null,
          duration: Date.now() - start,
          timestamp: Date.now(),
          cached: true,
        };
      }
    }

    // Cache miss — do full check
    const fullResult = await this.fullHealthCheck(addr);
    if (fullResult.success && fullResult.data) {
      return { ...fullResult, data: fullResult.data.securityScore };
    }
    return { success: false, data: null, error: fullResult.error, duration: Date.now() - start, timestamp: Date.now(), cached: false };
  }

  // ─── Internals ──────────────────────────────────────────────

  private checkConcentration(portfolio: PortfolioSnapshot): string | null {
    if (portfolio.totalValueUsd === 0 || portfolio.tokens.length <= 1) return null;

    // Check if any single token is >80% of portfolio
    for (const token of portfolio.tokens) {
      const pct = (token.valueUsd / portfolio.totalValueUsd) * 100;
      if (pct > 80 && token.token.symbol !== "BNB") {
        return `Extreme concentration: ${token.token.symbol} is ${pct.toFixed(1)}% of portfolio`;
      }
    }
    return null;
  }

  private computeSecurityScore(
    address: string,
    portfolio: PortfolioSnapshot,
    approvalData: { totalApprovals: number; highRiskCount: number; criticalCount: number } | null,
  ): SecurityScore {
    const riskFactors: string[] = [];

    // Token Safety (0-100): based on risk scores of held tokens
    let tokenSafety = 100;
    if (portfolio.tokens.length > 0) {
      const avgRisk = portfolio.tokens.reduce((sum, t) => sum + t.riskScore, 0) / portfolio.tokens.length;
      tokenSafety = Math.max(0, Math.round(100 - avgRisk));
    }
    if (portfolio.honeypotCount > 0) {
      tokenSafety = Math.max(0, tokenSafety - portfolio.honeypotCount * 15);
      riskFactors.push(`${portfolio.honeypotCount} honeypot(s) in wallet`);
    }
    if (portfolio.highRiskCount > 0) {
      riskFactors.push(`${portfolio.highRiskCount} high-risk token(s)`);
    }

    // Approval Hygiene (0-100): based on approval risk
    let approvalHygiene = 100;
    if (approvalData) {
      approvalHygiene -= approvalData.criticalCount * 20;
      approvalHygiene -= approvalData.highRiskCount * 10;
      approvalHygiene -= Math.min(20, approvalData.totalApprovals * 2); // Penalty for many approvals
      approvalHygiene = Math.max(0, approvalHygiene);
      if (approvalData.criticalCount > 0) {
        riskFactors.push(`${approvalData.criticalCount} critical approval(s)`);
      }
    }

    // Transaction Patterns (0-100): placeholder — would need tx history analysis
    const transactionPatterns = 75; // Default baseline

    // Exposure Risk (0-100): based on portfolio concentration
    let exposureRisk = 100;
    if (portfolio.tokens.length <= 1) {
      exposureRisk = 60; // Single asset = higher risk
      riskFactors.push("No diversification");
    } else if (portfolio.tokens.length <= 3) {
      exposureRisk = 75;
    }

    // Historical Behavior (0-100): placeholder — would need historical data
    const historicalBehavior = 80;

    // Overall: weighted average
    const overallScore = Math.round(
      tokenSafety * 0.30 +
      approvalHygiene * 0.25 +
      transactionPatterns * 0.15 +
      exposureRisk * 0.15 +
      historicalBehavior * 0.15
    );

    return {
      address,
      addressType: "wallet",
      overallScore: Math.max(0, Math.min(100, overallScore)),
      breakdown: {
        tokenSafety,
        approvalHygiene,
        transactionPatterns,
        exposureRisk,
        historicalBehavior,
      },
      riskFactors,
      lastUpdated: Date.now(),
    };
  }
}
