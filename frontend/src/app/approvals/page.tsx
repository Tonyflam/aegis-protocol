"use client";

import { useWalletContext } from "../../lib/WalletContext";
import ApprovalScanner from "../../components/ApprovalScanner";
import { ShieldAlert } from "lucide-react";

export default function ApprovalsPage() {
  const { address, signer } = useWalletContext();

  return (
    <div className="min-h-screen relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Token Approvals
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Scan, analyze, and revoke token approvals on BNB Chain
            </p>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-md" style={{ background: "rgba(240,185,11,0.08)", color: "var(--bnb)" }}>
            BSC Mainnet
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        <ApprovalScanner connectedAddress={address} signer={signer} />
      </div>
    </div>
  );
}
