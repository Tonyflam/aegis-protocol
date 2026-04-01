"use client";

import { useLiveMarketData } from "../../lib/useLiveMarket";
import RescueAgent from "../../components/agents/RescueAgent";
import { Siren } from "lucide-react";

export default function RescuePage() {
  const liveMarket = useLiveMarketData(30000);

  return (
    <div className="min-h-screen relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Siren className="w-6 h-6" style={{ color: "#ef4444" }} />
              Rescue Agent
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Emergency extraction — evacuate all assets to your safe wallet instantly
            </p>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-md" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
            Emergency Ready
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        <RescueAgent bnbPrice={liveMarket.bnbPriceCoinGecko} />
      </div>
    </div>
  );
}
