"use client";

import { useLiveMarketData } from "../../lib/useLiveMarket";
import SentinelAgent from "../../components/agents/SentinelAgent";
import { ShieldCheck } from "lucide-react";

export default function SentinelPage() {
  const liveMarket = useLiveMarketData(30000);

  return (
    <div className="min-h-screen relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Sentinel Agent
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Scan and revoke risky token approvals — protect your wallet from unlimited permissions
            </p>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5" style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)" }}>
            <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} /> Active
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        <SentinelAgent bnbPrice={liveMarket.bnbPriceCoinGecko} />
      </div>
    </div>
  );
}
