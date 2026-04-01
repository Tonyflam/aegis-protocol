"use client";

import { useLiveMarketData } from "../../lib/useLiveMarket";
import WatchdogAgent from "../../components/agents/WatchdogAgent";
import { Eye } from "lucide-react";

export default function WatchdogPage() {
  const liveMarket = useLiveMarketData(30000);

  return (
    <div className="min-h-screen relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Eye className="w-6 h-6" style={{ color: "#3b82f6" }} />
              Watchdog Agent
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Monitor BSC DeFi protocol health, TVL changes, and risk indicators in real-time
            </p>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5" style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)" }}>
            <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} /> Live
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        <WatchdogAgent bnbPrice={liveMarket.bnbPriceCoinGecko} />
      </div>
    </div>
  );
}
