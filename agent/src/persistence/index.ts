// ═══════════════════════════════════════════════════════════════
// Aegis Security OS — Persistence Layer
// SQLite-backed storage for all engine results and state
// ═══════════════════════════════════════════════════════════════

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

export class PersistenceLayer {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || path.join(process.cwd(), "data", "aegis.db");
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(resolvedPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initSchema();
    console.log(`[Persistence] SQLite initialized at ${resolvedPath}`);
  }

  private initSchema(): void {
    this.db.exec(`
      -- Token scan results
      CREATE TABLE IF NOT EXISTS token_scans (
        address TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        decimals INTEGER NOT NULL DEFAULT 18,
        risk_score INTEGER NOT NULL,
        recommendation TEXT NOT NULL,
        flags TEXT NOT NULL DEFAULT '[]',
        total_supply TEXT,
        holder_count INTEGER DEFAULT 0,
        top_holder_percent REAL DEFAULT 0,
        owner_balance REAL DEFAULT 0,
        liquidity_usd REAL DEFAULT 0,
        is_liquidity_locked INTEGER DEFAULT 0,
        lp_token_burned INTEGER DEFAULT 0,
        is_verified INTEGER DEFAULT 0,
        is_renounced INTEGER DEFAULT 0,
        owner_can_mint INTEGER DEFAULT 0,
        owner_can_pause INTEGER DEFAULT 0,
        owner_can_blacklist INTEGER DEFAULT 0,
        is_proxy INTEGER DEFAULT 0,
        is_honeypot INTEGER DEFAULT 0,
        buy_tax REAL DEFAULT 0,
        sell_tax REAL DEFAULT 0,
        scan_timestamp INTEGER NOT NULL,
        scan_duration INTEGER DEFAULT 0
      );

      -- Approval scan results
      CREATE TABLE IF NOT EXISTS approval_scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_address TEXT NOT NULL,
        token_address TEXT NOT NULL,
        token_symbol TEXT NOT NULL,
        spender TEXT NOT NULL,
        spender_label TEXT DEFAULT '',
        allowance TEXT NOT NULL,
        allowance_formatted TEXT NOT NULL,
        is_unlimited INTEGER DEFAULT 0,
        risk_level TEXT NOT NULL,
        risk_reasons TEXT NOT NULL DEFAULT '[]',
        scan_timestamp INTEGER NOT NULL,
        UNIQUE(wallet_address, token_address, spender)
      );

      -- Portfolio snapshots
      CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_address TEXT NOT NULL,
        total_value_usd REAL DEFAULT 0,
        high_risk_count INTEGER DEFAULT 0,
        honeypot_count INTEGER DEFAULT 0,
        health_score INTEGER DEFAULT 100,
        tokens_json TEXT NOT NULL DEFAULT '[]',
        scan_timestamp INTEGER NOT NULL
      );

      -- Threat alerts
      CREATE TABLE IF NOT EXISTS threat_alerts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        token_address TEXT,
        token_symbol TEXT,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        amount TEXT NOT NULL,
        amount_usd REAL DEFAULT 0,
        tx_hash TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      );

      -- Transaction simulations
      CREATE TABLE IF NOT EXISTS tx_simulations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_to TEXT NOT NULL,
        tx_from TEXT NOT NULL,
        tx_data TEXT NOT NULL,
        tx_value TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        success INTEGER NOT NULL,
        revert_reason TEXT,
        balance_changes_json TEXT NOT NULL DEFAULT '[]',
        approval_changes_json TEXT NOT NULL DEFAULT '[]',
        risk_score INTEGER DEFAULT 0,
        warnings_json TEXT NOT NULL DEFAULT '[]',
        timestamp INTEGER NOT NULL
      );

      -- Security scores
      CREATE TABLE IF NOT EXISTS security_scores (
        address TEXT PRIMARY KEY,
        address_type TEXT NOT NULL,
        overall_score INTEGER NOT NULL,
        token_safety INTEGER DEFAULT 0,
        approval_hygiene INTEGER DEFAULT 0,
        transaction_patterns INTEGER DEFAULT 0,
        exposure_risk INTEGER DEFAULT 0,
        historical_behavior INTEGER DEFAULT 0,
        risk_factors TEXT NOT NULL DEFAULT '[]',
        last_updated INTEGER NOT NULL
      );

      -- Engine run log
      CREATE TABLE IF NOT EXISTS engine_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        engine TEXT NOT NULL,
        target TEXT NOT NULL,
        success INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        error TEXT,
        timestamp INTEGER NOT NULL
      );

      -- Create indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_token_scans_risk ON token_scans(risk_score);
      CREATE INDEX IF NOT EXISTS idx_approvals_wallet ON approval_scans(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_portfolio_wallet ON portfolio_snapshots(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_threats_severity ON threat_alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_threats_timestamp ON threat_alerts(timestamp);
      CREATE INDEX IF NOT EXISTS idx_engine_runs_engine ON engine_runs(engine);
    `);
  }

  // ─── Token Scans ────────────────────────────────────────────

  saveTokenScan(scan: {
    address: string; symbol: string; name: string; decimals: number;
    riskScore: number; recommendation: string; flags: string[];
    totalSupply?: string; holderCount?: number; topHolderPercent?: number;
    ownerBalance?: number; liquidityUsd?: number; isLiquidityLocked?: boolean;
    lpTokenBurned?: boolean; isVerified?: boolean; isRenounced?: boolean;
    ownerCanMint?: boolean; ownerCanPause?: boolean; ownerCanBlacklist?: boolean;
    isProxy?: boolean; isHoneypot?: boolean; buyTax?: number; sellTax?: number;
    scanTimestamp: number; scanDuration?: number;
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO token_scans (
        address, symbol, name, decimals, risk_score, recommendation, flags,
        total_supply, holder_count, top_holder_percent, owner_balance,
        liquidity_usd, is_liquidity_locked, lp_token_burned,
        is_verified, is_renounced, owner_can_mint, owner_can_pause,
        owner_can_blacklist, is_proxy, is_honeypot, buy_tax, sell_tax,
        scan_timestamp, scan_duration
      ) VALUES (
        @address, @symbol, @name, @decimals, @riskScore, @recommendation, @flags,
        @totalSupply, @holderCount, @topHolderPercent, @ownerBalance,
        @liquidityUsd, @isLiquidityLocked, @lpTokenBurned,
        @isVerified, @isRenounced, @ownerCanMint, @ownerCanPause,
        @ownerCanBlacklist, @isProxy, @isHoneypot, @buyTax, @sellTax,
        @scanTimestamp, @scanDuration
      )
    `);

    stmt.run({
      address: scan.address.toLowerCase(),
      symbol: scan.symbol,
      name: scan.name,
      decimals: scan.decimals,
      riskScore: scan.riskScore,
      recommendation: scan.recommendation,
      flags: JSON.stringify(scan.flags),
      totalSupply: scan.totalSupply || "0",
      holderCount: scan.holderCount || 0,
      topHolderPercent: scan.topHolderPercent || 0,
      ownerBalance: scan.ownerBalance || 0,
      liquidityUsd: scan.liquidityUsd || 0,
      isLiquidityLocked: scan.isLiquidityLocked ? 1 : 0,
      lpTokenBurned: scan.lpTokenBurned ? 1 : 0,
      isVerified: scan.isVerified ? 1 : 0,
      isRenounced: scan.isRenounced ? 1 : 0,
      ownerCanMint: scan.ownerCanMint ? 1 : 0,
      ownerCanPause: scan.ownerCanPause ? 1 : 0,
      ownerCanBlacklist: scan.ownerCanBlacklist ? 1 : 0,
      isProxy: scan.isProxy ? 1 : 0,
      isHoneypot: scan.isHoneypot ? 1 : 0,
      buyTax: scan.buyTax || 0,
      sellTax: scan.sellTax || 0,
      scanTimestamp: scan.scanTimestamp,
      scanDuration: scan.scanDuration || 0,
    });
  }

  getTokenScan(address: string): Record<string, unknown> | undefined {
    const row = this.db.prepare("SELECT * FROM token_scans WHERE address = ?").get(address.toLowerCase()) as Record<string, unknown> | undefined;
    if (row && typeof row.flags === "string") {
      row.flags = JSON.parse(row.flags);
    }
    return row;
  }

  getTokenScanAge(address: string): number | null {
    const row = this.db.prepare("SELECT scan_timestamp FROM token_scans WHERE address = ?").get(address.toLowerCase()) as { scan_timestamp: number } | undefined;
    return row ? Date.now() - row.scan_timestamp : null;
  }

  // ─── Approval Scans ────────────────────────────────────────

  saveApproval(approval: {
    walletAddress: string; tokenAddress: string; tokenSymbol: string;
    spender: string; spenderLabel: string; allowance: string;
    allowanceFormatted: string; isUnlimited: boolean; riskLevel: string;
    riskReasons: string[]; scanTimestamp: number;
  }): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO approval_scans (
        wallet_address, token_address, token_symbol, spender, spender_label,
        allowance, allowance_formatted, is_unlimited, risk_level, risk_reasons,
        scan_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      approval.walletAddress.toLowerCase(),
      approval.tokenAddress.toLowerCase(),
      approval.tokenSymbol,
      approval.spender.toLowerCase(),
      approval.spenderLabel,
      approval.allowance,
      approval.allowanceFormatted,
      approval.isUnlimited ? 1 : 0,
      approval.riskLevel,
      JSON.stringify(approval.riskReasons),
      approval.scanTimestamp,
    );
  }

  getApprovals(walletAddress: string): Record<string, unknown>[] {
    const rows = this.db.prepare("SELECT * FROM approval_scans WHERE wallet_address = ? ORDER BY risk_level DESC")
      .all(walletAddress.toLowerCase()) as Record<string, unknown>[];
    return rows.map(r => ({
      ...r,
      risk_reasons: typeof r.risk_reasons === "string" ? JSON.parse(r.risk_reasons) : r.risk_reasons,
    }));
  }

  // ─── Portfolio Snapshots ────────────────────────────────────

  savePortfolioSnapshot(snapshot: {
    walletAddress: string; totalValueUsd: number; highRiskCount: number;
    honeypotCount: number; healthScore: number; tokensJson: string;
    scanTimestamp: number;
  }): void {
    this.db.prepare(`
      INSERT INTO portfolio_snapshots (
        wallet_address, total_value_usd, high_risk_count, honeypot_count,
        health_score, tokens_json, scan_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      snapshot.walletAddress.toLowerCase(),
      snapshot.totalValueUsd,
      snapshot.highRiskCount,
      snapshot.honeypotCount,
      snapshot.healthScore,
      snapshot.tokensJson,
      snapshot.scanTimestamp,
    );
  }

  getLatestPortfolio(walletAddress: string): Record<string, unknown> | undefined {
    return this.db.prepare(
      "SELECT * FROM portfolio_snapshots WHERE wallet_address = ? ORDER BY scan_timestamp DESC LIMIT 1"
    ).get(walletAddress.toLowerCase()) as Record<string, unknown> | undefined;
  }

  // ─── Threat Alerts ──────────────────────────────────────────

  saveThreatAlert(alert: {
    id: string; type: string; severity: string; title: string;
    description: string; tokenAddress: string | null; tokenSymbol: string | null;
    from: string; to: string; amount: string; amountUsd: number;
    txHash: string; blockNumber: number; timestamp: number;
  }): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO threat_alerts (
        id, type, severity, title, description, token_address, token_symbol,
        from_address, to_address, amount, amount_usd, tx_hash, block_number, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      alert.id, alert.type, alert.severity, alert.title, alert.description,
      alert.tokenAddress?.toLowerCase() ?? null, alert.tokenSymbol, alert.from, alert.to,
      alert.amount, alert.amountUsd, alert.txHash, alert.blockNumber, alert.timestamp,
    );
  }

  getRecentAlerts(limit = 50): Record<string, unknown>[] {
    return this.db.prepare(
      "SELECT * FROM threat_alerts ORDER BY timestamp DESC LIMIT ?"
    ).all(limit) as Record<string, unknown>[];
  }

  getAlertsByToken(tokenAddress: string, limit = 50): Record<string, unknown>[] {
    return this.db.prepare(
      "SELECT * FROM threat_alerts WHERE token_address = ? ORDER BY timestamp DESC LIMIT ?"
    ).all(tokenAddress.toLowerCase(), limit) as Record<string, unknown>[];
  }

  // ─── Security Scores ───────────────────────────────────────

  saveSecurityScore(score: {
    address: string; addressType: string; overallScore: number;
    tokenSafety: number; approvalHygiene: number; transactionPatterns: number;
    exposureRisk: number; historicalBehavior: number;
    riskFactors: string[]; lastUpdated: number;
  }): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO security_scores (
        address, address_type, overall_score, token_safety, approval_hygiene,
        transaction_patterns, exposure_risk, historical_behavior,
        risk_factors, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      score.address.toLowerCase(), score.addressType, score.overallScore,
      score.tokenSafety, score.approvalHygiene, score.transactionPatterns,
      score.exposureRisk, score.historicalBehavior,
      JSON.stringify(score.riskFactors), score.lastUpdated,
    );
  }

  getSecurityScore(address: string): Record<string, unknown> | undefined {
    const row = this.db.prepare("SELECT * FROM security_scores WHERE address = ?")
      .get(address.toLowerCase()) as Record<string, unknown> | undefined;
    if (row && typeof row.risk_factors === "string") {
      row.risk_factors = JSON.parse(row.risk_factors);
    }
    return row;
  }

  // ─── Engine Run Logging ─────────────────────────────────────

  logEngineRun(engine: string, target: string, success: boolean, durationMs: number, error?: string): void {
    this.db.prepare(`
      INSERT INTO engine_runs (engine, target, success, duration_ms, error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(engine, target, success ? 1 : 0, durationMs, error || null, Date.now());
  }

  getEngineStats(engine: string): { total: number; successful: number; avgDuration: number } {
    const row = this.db.prepare(`
      SELECT COUNT(*) as total, SUM(success) as successful, AVG(duration_ms) as avg_duration
      FROM engine_runs WHERE engine = ?
    `).get(engine) as { total: number; successful: number; avg_duration: number };
    return {
      total: row.total || 0,
      successful: row.successful || 0,
      avgDuration: Math.round(row.avg_duration || 0),
    };
  }

  // ─── Utility ────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }

  getStats(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const table of ["token_scans", "approval_scans", "portfolio_snapshots", "threat_alerts", "security_scores", "engine_runs"]) {
      const row = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
      counts[table] = row.count;
    }
    return counts;
  }
}
