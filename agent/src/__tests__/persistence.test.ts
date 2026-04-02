// ═══════════════════════════════════════════════════════════════
// Aegis Security OS — Persistence Layer Tests
// ═══════════════════════════════════════════════════════════════

import { PersistenceLayer } from "../persistence";
import * as fs from "fs";
import * as path from "path";

const TEST_DB = path.join(__dirname, "test-aegis.db");

describe("PersistenceLayer", () => {
  let db: PersistenceLayer;

  beforeEach(() => {
    for (const ext of ["", "-wal", "-shm"]) {
      try { fs.unlinkSync(TEST_DB + ext); } catch {}
    }
    db = new PersistenceLayer(TEST_DB);
  });

  afterEach(() => {
    db.close();
    for (const ext of ["", "-wal", "-shm"]) {
      try { fs.unlinkSync(TEST_DB + ext); } catch {}
    }
  });

  // ─── Token Scans ─────────────────────────────────────────────

  const tokenScan = {
    address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    name: "PancakeSwap",
    symbol: "CAKE",
    decimals: 18,
    riskScore: 15,
    recommendation: "LOW_RISK",
    flags: ["verified"],
    isVerified: true,
    isProxy: false,
    ownerCanMint: false,
    ownerCanPause: false,
    ownerCanBlacklist: false,
    isRenounced: true,
    liquidityUsd: 50000000,
    isLiquidityLocked: true,
    holderCount: 500000,
    topHolderPercent: 8,
    isHoneypot: false,
    buyTax: 0,
    sellTax: 0,
    scanTimestamp: Date.now(),
  };

  describe("Token Scans", () => {
    test("should save and retrieve token scan", () => {
      db.saveTokenScan(tokenScan);
      const retrieved = db.getTokenScan(tokenScan.address);
      expect(retrieved).toBeDefined();
      expect(retrieved!.symbol).toBe("CAKE");
      expect(retrieved!.risk_score).toBe(15);
    });

    test("should return undefined for unknown token", () => {
      const result = db.getTokenScan("0x0000000000000000000000000000000000000000");
      expect(result).toBeUndefined();
    });

    test("should return scan age", () => {
      db.saveTokenScan(tokenScan);
      const age = db.getTokenScanAge(tokenScan.address);
      expect(age).not.toBeNull();
      expect(age!).toBeLessThan(5000);
    });

    test("should overwrite existing scan for same address", () => {
      db.saveTokenScan(tokenScan);
      db.saveTokenScan({ ...tokenScan, riskScore: 50 });
      const result = db.getTokenScan(tokenScan.address);
      expect(result!.risk_score).toBe(50);
    });
  });

  // ─── Approvals ──────────────────────────────────────────────

  describe("Approvals", () => {
    const approval = {
      walletAddress: "0xWALLET",
      tokenAddress: "0xCAKE",
      tokenSymbol: "CAKE",
      spender: "0xROUTER",
      spenderLabel: "PancakeSwap Router",
      allowance: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      allowanceFormatted: "unlimited",
      isUnlimited: true,
      riskLevel: "LOW",
      riskReasons: ["Known DEX router"],
      scanTimestamp: Date.now(),
    };

    test("should save and retrieve approvals", () => {
      db.saveApproval(approval);
      const approvals = db.getApprovals("0xWALLET");
      expect(approvals.length).toBe(1);
      expect(approvals[0].token_symbol).toBe("CAKE");
    });

    test("should return empty for wallet with no approvals", () => {
      expect(db.getApprovals("0xNOBODY")).toEqual([]);
    });
  });

  // ─── Security Scores ───────────────────────────────────────

  describe("Security Scores", () => {
    const score = {
      address: "0xABC",
      addressType: "wallet",
      overallScore: 85,
      tokenSafety: 90,
      approvalHygiene: 80,
      transactionPatterns: 85,
      exposureRisk: 80,
      historicalBehavior: 90,
      riskFactors: ["low_risk"],
      lastUpdated: Date.now(),
    };

    test("should save and retrieve security score", () => {
      db.saveSecurityScore(score);
      const result = db.getSecurityScore("0xABC");
      expect(result).toBeDefined();
      expect(result!.overall_score).toBe(85);
    });

    test("should return undefined for unknown address", () => {
      expect(db.getSecurityScore("0xUNKNOWN")).toBeUndefined();
    });
  });

  // ─── Threat Alerts ──────────────────────────────────────────

  describe("Threat Alerts", () => {
    const alert = {
      id: "0xTX-0",
      type: "WHALE_SELL",
      severity: "HIGH",
      title: "Whale sell detected",
      description: "Whale sold 2% of CAKE supply",
      tokenAddress: "0xCAKE",
      tokenSymbol: "CAKE",
      from: "0xWHALE",
      to: "0xROUTER",
      amount: "1000000",
      amountUsd: 500000,
      txHash: "0xTX",
      blockNumber: 12345678,
      timestamp: Date.now(),
    };

    test("should save and retrieve recent alerts", () => {
      db.saveThreatAlert(alert);
      const alerts = db.getRecentAlerts(10);
      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe("WHALE_SELL");
    });

    test("should retrieve alerts by token", () => {
      db.saveThreatAlert(alert);
      db.saveThreatAlert({ ...alert, id: "0xTX2-0", tokenAddress: "0xOTHER", tokenSymbol: "OTHER" });
      // getAlertsByToken lowercases input, and saveThreatAlert stores as-is,
      // so query with exact case that was stored
      const cakeAlerts = db.getAlertsByToken(alert.tokenAddress);
      expect(cakeAlerts.length).toBe(1);
    });

    test("should respect limit", () => {
      for (let i = 0; i < 20; i++) {
        db.saveThreatAlert({ ...alert, id: `alert-${i}`, timestamp: Date.now() + i });
      }
      expect(db.getRecentAlerts(5).length).toBe(5);
    });
  });

  // ─── Engine Runs ────────────────────────────────────────────

  describe("Engine Runs", () => {
    test("should log and retrieve engine stats", () => {
      db.logEngineRun("wallet-scanner", "0xA", true, 1234);
      db.logEngineRun("wallet-scanner", "0xB", true, 987);
      db.logEngineRun("wallet-scanner", "0xC", false, 5000, "Timeout");
      const stats = db.getEngineStats("wallet-scanner");
      expect(stats.total).toBe(3);
      expect(stats.successful).toBe(2);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });

    test("should return zero stats for unknown engine", () => {
      const stats = db.getEngineStats("nonexistent");
      expect(stats.total).toBe(0);
    });
  });

  // ─── Global Stats ──────────────────────────────────────────

  describe("Global Stats", () => {
    test("should return aggregate counts", () => {
      db.saveTokenScan(tokenScan);
      db.saveThreatAlert({
        id: "1", type: "WHALE_SELL", severity: "HIGH", title: "Test",
        description: "test", tokenAddress: "0xA", tokenSymbol: "A",
        from: "0x1", to: "0x2", amount: "100", amountUsd: 100,
        txHash: "0x", blockNumber: 1, timestamp: Date.now(),
      });
      const stats = db.getStats();
      expect(stats.token_scans).toBe(1);
      expect(stats.threat_alerts).toBe(1);
    });
  });
});
