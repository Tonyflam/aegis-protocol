"use client";

import { useLiveMarketData } from "../../lib/useLiveMarket";
import TokenScanner from "../../components/TokenScanner";
import { Search } from "lucide-react";

export default function ScannerPage() {
  const liveMarket = useLiveMarketData(30000);

  return (
    <div className="min-h-screen relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Search className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Token Scanner
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Scan any BSC token for honeypots, rug pulls, whale risks, and contract security
            </p>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-md" style={{ background: "rgba(240,185,11,0.08)", color: "var(--bnb)" }}>
            BSC Mainnet
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        <TokenScanner bnbPrice={liveMarket.bnbPriceCoinGecko} />
      </div>
    </div>
  );
}
