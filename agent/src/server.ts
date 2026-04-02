// ═══════════════════════════════════════════════════════════════
// Aegis Security OS — API Server
// HTTP endpoints for all security engines
// Serves the frontend and external B2B consumers
// ═══════════════════════════════════════════════════════════════

import express from "express";
import * as dotenv from "dotenv";
import { PersistenceLayer } from "./persistence";
import { RPCProviderManager } from "./providers/rpc";
import {
  WalletScannerEngine,
  ApprovalRiskEngine,
  PortfolioGuardianEngine,
  ThreatIntelligenceEngine,
  TransactionFirewallEngine,
  SecurityScoreOracle,
} from "./engines";

dotenv.config({ path: "../.env" });

// ─── Initialize ───────────────────────────────────────────────

const PORT = parseInt(process.env.API_PORT || "3001", 10);
const db = new PersistenceLayer();
const rpc = new RPCProviderManager("mainnet");

// Initialize engines
const walletScanner = new WalletScannerEngine(rpc, db);
const approvalRisk = new ApprovalRiskEngine(rpc, db);
const portfolioGuardian = new PortfolioGuardianEngine(rpc, db, walletScanner, approvalRisk);
const threatIntel = new ThreatIntelligenceEngine(rpc, db);
const txFirewall = new TransactionFirewallEngine(rpc, db);
const securityScore = new SecurityScoreOracle(rpc, db, walletScanner, approvalRisk);

// ─── Express App ──────────────────────────────────────────────

const app = express();
app.use(express.json());

// CORS for frontend
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// ─── Timeout + Error Safety ───────────────────────────────────

const REQUEST_TIMEOUT = 30_000; // 30s max per request

app.use((_req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: "Request timeout" });
    }
  }, REQUEST_TIMEOUT);
  res.on("finish", () => clearTimeout(timer));
  next();
});

function asyncHandler(fn: (req: express.Request, res: express.Response) => Promise<void>) {
  return (req: express.Request, res: express.Response) => {
    fn(req, res).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Internal server error";
      console.error(`[Aegis API] Error on ${req.method} ${req.path}:`, message);
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      }
    });
  };
}

function getAddr(req: express.Request): string {
  return String(req.params.address || "");
}

// ─── Routes ───────────────────────────────────────────────────

// Health check
app.get("/health", (_req, res) => {
  const stats = db.getStats();
  res.json({
    status: "ok",
    version: "2.0.0",
    engines: ["wallet-scanner", "approval-risk", "portfolio-guardian", "threat-intel", "tx-firewall", "security-score"],
    persistence: stats,
    rpcStatus: rpc.getStatus(),
    uptime: process.uptime(),
  });
});

// ─── Token Scanner ────────────────────────────────────────────

app.get("/api/v1/scan/token/:address", asyncHandler(async (req, res) => {
  const address = getAddr(req);
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid token address" });
    return;
  }
  const result = await walletScanner.scanToken(address);
  res.json(result);
}));

// ─── Wallet Scanner ───────────────────────────────────────────

app.get("/api/v1/scan/wallet/:address", asyncHandler(async (req, res) => {
  const address = getAddr(req);
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }
  const result = await walletScanner.scanWallet(address);
  res.json(result);
}));

// ─── Approval Scanner ─────────────────────────────────────────

app.get("/api/v1/approvals/:address", asyncHandler(async (req, res) => {
  const address = getAddr(req);
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }
  const result = await approvalRisk.scanApprovals(address);
  res.json(result);
}));

// ─── Portfolio Guardian ───────────────────────────────────────

app.get("/api/v1/portfolio/:address", asyncHandler(async (req, res) => {
  const address = getAddr(req);
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }
  const result = await portfolioGuardian.fullHealthCheck(address);
  res.json(result);
}));

// ─── Security Score ───────────────────────────────────────────

app.get("/api/v1/score/wallet/:address", asyncHandler(async (req, res) => {
  const address = getAddr(req);
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }
  const result = await securityScore.getWalletScore(address);
  res.json(result);
}));

app.get("/api/v1/score/token/:address", asyncHandler(async (req, res) => {
  const address = getAddr(req);
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid token address" });
    return;
  }
  const result = await securityScore.getTokenScore(address);
  res.json(result);
}));

// ─── Threat Intelligence ──────────────────────────────────────

app.get("/api/v1/threats/recent", (_req, res) => {
  const limit = parseInt(_req.query.limit as string || "50", 10);
  const alerts = threatIntel.getRecentAlerts(Math.min(limit, 200));
  res.json({ success: true, data: alerts, count: alerts.length });
});

app.get("/api/v1/threats/token/:address", asyncHandler(async (req, res) => {
  const address = getAddr(req);
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid token address" });
    return;
  }
  const result = await threatIntel.scanToken(address, 600); // Use $600 as default BNB price
  res.json(result);
}));

// ─── Transaction Firewall ─────────────────────────────────────

app.post("/api/v1/simulate", asyncHandler(async (req, res) => {
  const { to, from, data, value } = req.body;
  if (!to || !from) {
    res.status(400).json({ error: "Missing required fields: to, from" });
    return;
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(to) || !/^0x[a-fA-F0-9]{40}$/.test(from)) {
    res.status(400).json({ error: "Invalid address format" });
    return;
  }
  const result = await txFirewall.simulate({ to, from, data: data || "0x", value: value || "0" });
  res.json(result);
}));

// ─── Engine Stats ─────────────────────────────────────────────

app.get("/api/v1/stats", (_req, res) => {
  const engines = [
    "wallet-scanner", "wallet-scanner-portfolio", "approval-risk",
    "portfolio-guardian", "threat-intel", "threat-intel-bnb",
    "tx-firewall", "security-score", "security-score-token",
  ];
  const stats: Record<string, unknown> = {};
  for (const engine of engines) {
    stats[engine] = db.getEngineStats(engine);
  }
  res.json({ engines: stats, persistence: db.getStats() });
});

// ─── Start Server ─────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   Aegis Security OS — API Server v2.0                         ║
║   DeFi Security Operating System for BNB Chain                ║
║                                                               ║
║   Engines: 6 active                                           ║
║   Port: ${PORT}                                                  ║
║   Persistence: SQLite (WAL mode)                              ║
║                                                               ║
║   GET  /api/v1/scan/token/:address                            ║
║   GET  /api/v1/scan/wallet/:address                           ║
║   GET  /api/v1/approvals/:address                             ║
║   GET  /api/v1/portfolio/:address                             ║
║   GET  /api/v1/score/wallet/:address                          ║
║   GET  /api/v1/score/token/:address                           ║
║   GET  /api/v1/threats/recent                                 ║
║   GET  /api/v1/threats/token/:address                         ║
║   POST /api/v1/simulate                                       ║
║   GET  /api/v1/stats                                          ║
║   GET  /health                                                ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Aegis] Shutting down...");
  db.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n[Aegis] Terminated.");
  db.close();
  process.exit(0);
});
