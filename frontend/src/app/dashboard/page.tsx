"use client";

import { useWalletContext } from "../../lib/WalletContext";
import { usePublicContractData } from "../../lib/useContracts";
import { useLiveMarketData } from "../../lib/useLiveMarket";
import Link from "next/link";
import {
  BarChart3, Shield, Search, Bell, TrendingUp, TrendingDown,
  Wallet, Activity, Layers, ChevronRight, ExternalLink,
  AlertTriangle, Zap, Bot, Eye,
} from "lucide-react";

function formatNum(n: number, decimals = 1): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(decimals)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(decimals)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(decimals)}K`;
  return `$${n.toFixed(0)}`;
}

export default function DashboardPage() {
  const { isConnected, address } = useWalletContext();
  const contracts = usePublicContractData();
  const market = useLiveMarketData(30000);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}
          >
            <BarChart3 className="w-5 h-5" style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {isConnected
                ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}`
                : "Protocol overview — connect wallet for personalized data"}
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 space-y-6">
        {/* Market Overview */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
            BSC Market
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="BNB Price"
              value={market.isLoading ? "..." : `$${market.bnbPriceCoinGecko.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
              sub={
                market.isLoading
                  ? undefined
                  : `${market.priceChange24h >= 0 ? "+" : ""}${market.priceChange24h.toFixed(2)}% 24h`
              }
              subColor={market.priceChange24h >= 0 ? "var(--green)" : "var(--red)"}
              icon={market.priceChange24h >= 0 ? TrendingUp : TrendingDown}
              iconColor="var(--bnb)"
              source="CoinGecko"
            />
            <StatCard
              label="BSC TVL"
              value={market.isLoading ? "..." : formatNum(market.bscTvl)}
              icon={Layers}
              iconColor="var(--purple)"
              source="DeFiLlama"
            />
            <StatCard
              label="BNB 24h Volume"
              value={market.isLoading ? "..." : formatNum(market.volume24h)}
              icon={Activity}
              iconColor="var(--accent)"
              source="CoinGecko"
            />
            <StatCard
              label="Oracle Status"
              value={
                market.isLoading
                  ? "..."
                  : market.oracleStatus === "consistent"
                  ? "Consistent"
                  : "Warning"
              }
              valueColor={
                market.oracleStatus === "consistent" ? "var(--green)" : "var(--yellow)"
              }
              icon={Shield}
              iconColor="var(--green)"
            />
          </div>
        </div>

        {/* Protocol Stats (on-chain) */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
            Protocol Stats
            <span className="ml-2 text-[10px] font-normal normal-case" style={{ color: "var(--accent)" }}>
              BSC Testnet — Live
            </span>
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="AI Agents"
              value={contracts.isLoading ? "..." : String(contracts.agentCount)}
              icon={Bot}
              iconColor="var(--purple)"
              source="On-chain"
            />
            <StatCard
              label="Vault Deposited"
              value={
                contracts.isLoading
                  ? "..."
                  : `${parseFloat(contracts.totalBnbDeposited).toFixed(4)} BNB`
              }
              icon={Wallet}
              iconColor="var(--bnb)"
              source="On-chain"
            />
            <StatCard
              label="Threats Detected"
              value={contracts.isLoading ? "..." : String(contracts.totalThreats)}
              icon={AlertTriangle}
              iconColor="var(--red)"
              source="On-chain"
            />
            <StatCard
              label="AI Decisions"
              value={contracts.isLoading ? "..." : String(contracts.totalDecisions)}
              icon={Zap}
              iconColor="var(--accent)"
              source="On-chain"
            />
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
            Quick Actions
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <ActionCard
              href="/scanner"
              icon={Search}
              iconColor="var(--accent)"
              title="Token Scanner"
              description="Scan any BSC token for honeypots, rug pulls, and security risks using real API data"
            />
            <ActionCard
              href="/alerts"
              icon={Bell}
              iconColor="var(--purple)"
              title="Whale Alerts"
              description="Live large BNB transfers on BSC mainnet with exchange flow detection"
            />
            <ActionCard
              href="/positions"
              icon={Eye}
              iconColor="var(--green)"
              title="Vault Positions"
              description="Deposit BNB and authorize AI agents to protect your portfolio"
            />
          </div>
        </div>

        {/* Smart Contracts */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
            Smart Contracts
          </h2>
          <div className="space-y-2">
            {[
              { name: "AegisRegistry", addr: "0x7908c25C63AbAB47cb82bE50DBD874ED807EE8fF" },
              { name: "AegisVault", addr: "0x15Ef23024c2b90beA81E002349C70f0C2A09433F" },
              { name: "DecisionLogger", addr: "0x874d78947bd660665de237b16Ca05cd39b7feF6f" },
              { name: "TokenGate", addr: "0x672c5cC370085c3c6B5bcf2870e1A0Aa62Ff3D69" },
            ].map((c) => (
              <div key={c.addr} className="card px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{c.name}</p>
                  <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                    {c.addr.slice(0, 10)}...{c.addr.slice(-8)}
                  </p>
                </div>
                <a
                  href={`https://testnet.bscscan.com/address/${c.addr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium flex items-center gap-1"
                  style={{ color: "var(--accent)" }}
                >
                  BSCScan <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── Stat Card ─── */

function StatCard({
  label, value, sub, subColor, icon: Icon, iconColor, valueColor, source,
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconColor: string;
  valueColor?: string;
  source?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
      </div>
      <p className="text-lg font-semibold" style={{ color: valueColor || "var(--text-primary)" }}>
        {value}
      </p>
      {sub && (
        <p className="text-[11px] mt-1" style={{ color: subColor || "var(--text-muted)" }}>{sub}</p>
      )}
      {source && (
        <p className="text-[9px] mt-2 font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Source: {source}
        </p>
      )}
    </div>
  );
}

/* ─── Action Card ─── */

function ActionCard({
  href, icon: Icon, iconColor, title, description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconColor: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="card p-5 group block hover:border-[var(--border-hover)] transition-all duration-200">
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${iconColor}14`, border: `1px solid ${iconColor}22` }}
        >
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }} />
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {description}
      </p>
    </Link>
  );
}
