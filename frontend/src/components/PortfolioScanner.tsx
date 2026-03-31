"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import {
  Search,
  Shield,
  AlertTriangle,
  CheckCircle,
  Skull,
  RefreshCw,
  ExternalLink,
  XCircle,
  Eye,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────

interface PortfolioToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balanceFormatted: string;
  riskScore: number;
  riskLevel: string;
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  isOpenSource: boolean;
  isMintable: boolean;
  isProxy: boolean;
  ownerCanChangeBalance: boolean;
  hasHiddenOwner: boolean;
  flags: string[];
}

// ─── Constants ─────────────────────────────────────────────────

const BSC_PROVIDER = new ethers.JsonRpcProvider(
  "https://bsc-rpc.publicnode.com", 56, { staticNetwork: true }
);

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

const POPULAR_TOKENS = [
  { symbol: "WBNB",  address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" },
  { symbol: "CAKE",  address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82" },
  { symbol: "USDT",  address: "0x55d398326f99059fF775485246999027B3197955" },
  { symbol: "BUSD",  address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" },
  { symbol: "USDC",  address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" },
  { symbol: "ETH",   address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8" },
  { symbol: "BTCB",  address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c" },
  { symbol: "DOGE",  address: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43" },
  { symbol: "XRP",   address: "0x1D2F0da169ceB9fC7B3144828DB6a6BBf89F6c6C" },
  { symbol: "ADA",   address: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47" },
  { symbol: "DOT",   address: "0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402" },
  { symbol: "MATIC", address: "0xCC42724C6683B7E57334c4E856f4c9965ED682bD" },
  { symbol: "SHIB",  address: "0x2859e4544C4bB03966803b044A93563Bd2D0DD4D" },
  { symbol: "FLOKI", address: "0xfb5B838b6cfEEdC2873aB27866079AC55363D37E" },
  { symbol: "UNIQ",  address: "0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777" },
];

// ─── GoPlusLabs Batch Security Check ───────────────────────────

interface GoPlusTokenData {
  is_honeypot?: string;
  buy_tax?: string;
  sell_tax?: string;
  is_open_source?: string;
  is_mintable?: string;
  is_proxy?: string;
  owner_change_balance?: string;
  hidden_owner?: string;
  can_take_back_ownership?: string;
  transfer_pausable?: string;
  token_name?: string;
  token_symbol?: string;
}

async function batchCheckSecurity(
  addresses: string[]
): Promise<Record<string, GoPlusTokenData>> {
  try {
    const joined = addresses.map((a) => a.toLowerCase()).join(",");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses=${joined}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    const data = await res.json();
    return data?.result ?? {};
  } catch {
    return {};
  }
}

// ─── Risk Scoring ──────────────────────────────────────────────

function scoreToken(sec: GoPlusTokenData): { score: number; flags: string[] } {
  let score = 0;
  const flags: string[] = [];

  if (sec.is_honeypot === "1") {
    return { score: 100, flags: ["HONEYPOT"] };
  }

  const buyTax = parseFloat(sec.buy_tax || "0") * 100;
  const sellTax = parseFloat(sec.sell_tax || "0") * 100;

  if (buyTax > 50 || sellTax > 50) {
    score += 40; flags.push("EXTREME_TAX");
  } else if (buyTax > 10 || sellTax > 10) {
    score += 15; flags.push("HIGH_TAX");
  } else if (buyTax > 5 || sellTax > 5) {
    score += 5; flags.push("MODERATE_TAX");
  }

  if (sec.is_open_source !== "1") {
    score += 15; flags.push("UNVERIFIED");
  }
  if (sec.is_mintable === "1") {
    score += 10; flags.push("MINTABLE");
  }
  if (sec.is_proxy === "1") {
    score += 10; flags.push("PROXY");
  }
  if (sec.owner_change_balance === "1") {
    score += 20; flags.push("OWNER_CONTROLS_BALANCE");
  }
  if (sec.hidden_owner === "1") {
    score += 15; flags.push("HIDDEN_OWNER");
  }
  if (sec.can_take_back_ownership === "1") {
    score += 10; flags.push("RECLAIMABLE");
  }
  if (sec.transfer_pausable === "1") {
    score += 5; flags.push("PAUSABLE");
  }

  return { score: Math.min(100, score), flags };
}

function getRiskLabel(score: number): string {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  if (score >= 20) return "LOW";
  return "SAFE";
}

function getRiskColor(score: number): string {
  if (score >= 80) return "#ef4444";
  if (score >= 60) return "#f97316";
  if (score >= 40) return "#eab308";
  if (score >= 20) return "#22c55e";
  return "#10b981";
}

function getRiskBg(score: number): string {
  if (score >= 60) return "rgba(239,68,68,0.08)";
  if (score >= 40) return "rgba(234,179,8,0.08)";
  return "rgba(34,197,94,0.06)";
}

// ─── Portfolio Scan ────────────────────────────────────────────

async function scanPortfolio(walletAddress: string): Promise<PortfolioToken[]> {
  // Step 1: Check balances in parallel
  const balanceChecks = POPULAR_TOKENS.map(async (token) => {
    try {
      const contract = new ethers.Contract(token.address, ERC20_ABI, BSC_PROVIDER);
      const [balance, decimals] = await Promise.all([
        contract.balanceOf(walletAddress),
        contract.decimals().catch(() => 18),
      ]);
      return { address: token.address, symbol: token.symbol, balance, decimals: Number(decimals) };
    } catch {
      return null;
    }
  });

  const results = await Promise.allSettled(balanceChecks);
  const holdings = results
    .filter(
      (r): r is PromiseFulfilledResult<{ address: string; symbol: string; balance: bigint; decimals: number }> =>
        r.status === "fulfilled" && r.value !== null && r.value.balance > BigInt(0)
    )
    .map((r) => r.value);

  if (holdings.length === 0) return [];

  // Step 2: Batch security check
  const securityData = await batchCheckSecurity(holdings.map((h) => h.address));

  // Step 3: Build portfolio
  const portfolio: PortfolioToken[] = [];
  for (const h of holdings) {
    const sec = securityData[h.address.toLowerCase()] || {};
    const { score, flags } = scoreToken(sec);
    const balStr = ethers.formatUnits(h.balance, h.decimals);

    portfolio.push({
      address: h.address,
      symbol: sec.token_symbol || h.symbol,
      name: sec.token_name || h.symbol,
      decimals: h.decimals,
      balanceFormatted: parseFloat(balStr).toLocaleString(undefined, { maximumFractionDigits: 4 }),
      riskScore: score,
      riskLevel: getRiskLabel(score),
      isHoneypot: sec.is_honeypot === "1",
      buyTax: parseFloat(sec.buy_tax || "0") * 100,
      sellTax: parseFloat(sec.sell_tax || "0") * 100,
      isOpenSource: sec.is_open_source === "1",
      isMintable: sec.is_mintable === "1",
      isProxy: sec.is_proxy === "1",
      ownerCanChangeBalance: sec.owner_change_balance === "1",
      hasHiddenOwner: sec.hidden_owner === "1",
      flags,
    });
  }

  // Sort by risk score descending
  portfolio.sort((a, b) => b.riskScore - a.riskScore);
  return portfolio;
}

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export default function PortfolioScanner({
  walletAddress,
}: {
  walletAddress?: string | null;
}) {
  const [address, setAddress] = useState(walletAddress || "");
  const [portfolio, setPortfolio] = useState<PortfolioToken[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState("");

  if (walletAddress && walletAddress !== address && !scanning) {
    setAddress(walletAddress);
  }

  const handleScan = useCallback(async () => {
    const target = address.trim();
    if (!ethers.isAddress(target)) {
      setError("Enter a valid BSC address");
      return;
    }
    setScanning(true);
    setError("");
    setPortfolio([]);
    try {
      const results = await scanPortfolio(target);
      setPortfolio(results);
      setScanned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan portfolio");
    } finally {
      setScanning(false);
    }
  }, [address]);

  const overallHealth = portfolio.length > 0
    ? Math.round(100 - portfolio.reduce((sum, t) => sum + t.riskScore, 0) / portfolio.length)
    : 100;
  const dangerTokens = portfolio.filter((t) => t.riskScore >= 60);
  const honeypots = portfolio.filter((t) => t.isHoneypot);

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="card p-5" style={{ borderRadius: "12px" }}>
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5 text-[color:var(--accent)]" />
          <h4 className="text-base font-semibold text-white">Portfolio Risk Scanner</h4>
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[color:var(--accent)] border border-[var(--accent)]/20">
            BSC Mainnet
          </span>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          Scan any wallet to detect honeypots, scam tokens, high-tax tokens, and contract vulnerabilities.
          Powered by GoPlusLabs security intelligence.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Wallet address (0x...)"
            value={address}
            onChange={(e) => { setAddress(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--bg-base)] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--accent)]/50 font-mono text-sm"
            disabled={scanning}
          />
          <button
            onClick={handleScan}
            disabled={scanning}
            className="btn-primary px-5 py-2.5 flex items-center gap-2 text-sm whitespace-nowrap"
          >
            {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {scanning ? "Scanning..." : "Scan"}
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2 rounded-lg flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)" }}>
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400">{error}</span>
          </div>
        )}
      </div>

      {/* Scanning */}
      {scanning && (
        <div className="card p-8 text-center" style={{ borderRadius: "12px" }}>
          <RefreshCw className="w-8 h-8 text-[color:var(--accent)] mx-auto mb-3 animate-spin" />
          <p className="text-sm text-gray-300">Scanning {POPULAR_TOKENS.length} tokens for holdings...</p>
          <p className="text-xs text-gray-500 mt-1">Checking balances + running security analysis via GoPlusLabs</p>
        </div>
      )}

      {/* Results */}
      {scanned && !scanning && (
        <>
          {/* Health Overview */}
          <div className="card p-5" style={{ borderRadius: "12px" }}>
            <div className="flex items-center gap-6">
              {/* Health Score */}
              <div
                className="w-20 h-20 rounded-xl flex flex-col items-center justify-center shrink-0"
                style={{ background: getRiskBg(100 - overallHealth), border: `2px solid ${getRiskColor(100 - overallHealth)}40` }}
              >
                <span className="text-2xl font-bold" style={{ color: getRiskColor(100 - overallHealth) }}>
                  {overallHealth}
                </span>
                <span className="text-[10px]" style={{ color: getRiskColor(100 - overallHealth) }}>HEALTH</span>
              </div>

              <div className="flex-1">
                <h4 className="text-white font-semibold mb-2">Wallet Health</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <p className="text-lg font-bold text-white">{portfolio.length}</p>
                    <p className="text-xs text-gray-500">Tokens Held</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold" style={{ color: honeypots.length > 0 ? "#ef4444" : "#22c55e" }}>
                      {honeypots.length}
                    </p>
                    <p className="text-xs text-gray-500">Honeypots</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold" style={{ color: dangerTokens.length > 0 ? "#f97316" : "#22c55e" }}>
                      {dangerTokens.length}
                    </p>
                    <p className="text-xs text-gray-500">High Risk</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-400">{portfolio.length - dangerTokens.length}</p>
                    <p className="text-xs text-gray-500">Safe</p>
                  </div>
                </div>
              </div>
            </div>

            {honeypots.length > 0 && (
              <div className="mt-3 p-3 rounded-lg flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <Skull className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">
                  {honeypots.length} honeypot token{honeypots.length > 1 ? "s" : ""} detected! These cannot be sold. Do NOT buy more.
                </p>
              </div>
            )}
          </div>

          {/* Token List */}
          {portfolio.length === 0 ? (
            <div className="card p-8 text-center" style={{ borderRadius: "12px" }}>
              <Shield className="w-10 h-10 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">No token holdings found</p>
              <p className="text-xs text-gray-500 mt-1">This wallet may not hold any of the {POPULAR_TOKENS.length} tracked BSC tokens.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {portfolio.map((t) => (
                <div
                  key={t.address}
                  className="card p-4"
                  style={{
                    borderRadius: "12px",
                    borderLeft: `3px solid ${getRiskColor(t.riskScore)}`,
                    background: t.isHoneypot ? "rgba(239,68,68,0.03)" : undefined,
                  }}
                >
                  <div className="flex items-center gap-4">
                    {/* Risk Score */}
                    <div
                      className="w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0"
                      style={{ background: getRiskBg(t.riskScore), border: `1px solid ${getRiskColor(t.riskScore)}30` }}
                    >
                      <span className="text-sm font-bold" style={{ color: getRiskColor(t.riskScore) }}>{t.riskScore}</span>
                      <span className="text-[8px]" style={{ color: getRiskColor(t.riskScore) }}>{t.riskLevel}</span>
                    </div>

                    {/* Token Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-white">{t.symbol}</span>
                        <span className="text-xs text-gray-500 truncate">{t.name}</span>
                        {t.isHoneypot && (
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            <Skull className="w-2.5 h-2.5" /> HONEYPOT
                          </span>
                        )}
                      </div>
                      {t.flags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {t.flags.slice(0, 4).map((f) => (
                            <span
                              key={f}
                              className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                              style={{ background: "rgba(234,179,8,0.08)", color: "#eab308" }}
                            >
                              {f.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Balance + Tax */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono text-white">{t.balanceFormatted}</p>
                      {(t.buyTax > 0 || t.sellTax > 0) && (
                        <p className="text-[10px] text-gray-500">
                          Tax: {t.buyTax.toFixed(1)}% / {t.sellTax.toFixed(1)}%
                        </p>
                      )}
                    </div>

                    {/* Status + BSCScan */}
                    <div className="flex items-center gap-2 shrink-0">
                      {t.riskScore < 20 ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : t.riskScore < 60 ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      ) : (
                        <Skull className="w-4 h-4 text-red-400" />
                      )}
                      <a
                        href={`https://bscscan.com/token/${t.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!scanned && !scanning && (
        <div className="card p-10 text-center" style={{ borderRadius: "12px" }}>
          <Eye className="w-12 h-12 text-[color:var(--accent)] mx-auto mb-4 opacity-50" />
          <h4 className="text-lg font-semibold text-white mb-2">Scan Any Wallet&apos;s Portfolio</h4>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Paste any BSC address to instantly check all holdings for honeypots, scam tokens,
            high-tax tokens, unverified contracts, and more.
          </p>
        </div>
      )}
    </div>
  );
}
