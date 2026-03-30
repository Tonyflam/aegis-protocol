"use client";

import { useLiveMarketData } from "../../lib/useLiveMarket";
import WhaleAlerts from "../../components/WhaleAlerts";
import { Bell } from "lucide-react";

export default function AlertsPage() {
  const liveMarket = useLiveMarketData(30000);

  return (
    <div className="min-h-screen relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Bell className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Whale Alerts
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Real-time monitoring of large transfers and whale movements on BSC
            </p>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5" style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)" }}>
            <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} /> Live Monitoring
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        <WhaleAlerts bnbPrice={liveMarket.bnbPriceCoinGecko} />
      </div>
    </div>
  );
}
