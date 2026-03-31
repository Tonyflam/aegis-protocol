"use client";

import { useState } from "react";
import { useWalletContext } from "../../lib/WalletContext";
import ApprovalManager from "../../components/ApprovalManager";
import PortfolioScanner from "../../components/PortfolioScanner";
import { ShieldCheck, Eye, Lock, Wallet } from "lucide-react";

type Tab = "portfolio" | "approvals";

export default function WalletSecurityPage() {
  const { address, isConnected, signer, chainId, connect } = useWalletContext();
  const [activeTab, setActiveTab] = useState<Tab>("portfolio");

  return (
    <div className="min-h-screen relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Wallet Security
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Scan any wallet for risky tokens, honeypots, and dangerous approvals on BSC
            </p>
          </div>
          {!isConnected && (
            <button onClick={connect} className="btn-primary flex items-center gap-2 text-xs">
              <Wallet className="w-3.5 h-3.5" />
              Connect for Auto-Scan
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 p-1 rounded-lg w-fit" style={{ background: "var(--bg-elevated)" }}>
          <button
            onClick={() => setActiveTab("portfolio")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "portfolio"
                ? "bg-[var(--accent)]/10 text-[color:var(--accent)]"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Eye className="w-4 h-4" />
            Portfolio Risk
          </button>
          <button
            onClick={() => setActiveTab("approvals")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "approvals"
                ? "bg-[var(--accent)]/10 text-[color:var(--accent)]"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Lock className="w-4 h-4" />
            Approvals
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "portfolio" && (
          <PortfolioScanner walletAddress={isConnected ? address : null} />
        )}
        {activeTab === "approvals" && (
          <ApprovalManager
            walletAddress={isConnected ? address : null}
            signer={signer}
            chainId={chainId}
          />
        )}
      </div>
    </div>
  );
}
