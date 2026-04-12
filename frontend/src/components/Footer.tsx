"use client";

import Image from "next/image";
import { CONTRACTS } from "../lib/constants";

export default function Footer() {
  return (
    <footer className="border-t mt-auto" style={{ borderColor: "var(--border-subtle)", background: "rgba(9,9,11,0.6)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Aegis Protocol" width={20} height={20} className="h-5 w-5 object-contain" />
            <span className="text-sm font-medium text-white">Aegis Protocol</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>by Uniq Minds</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://x.com/uniq_minds" target="_blank" rel="noopener noreferrer"
              className="text-xs transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>Twitter</a>
            <a href="https://github.com/Tonyflam/aegis-protocol" target="_blank" rel="noopener noreferrer"
              className="text-xs transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>GitHub</a>
            <a href={`https://bscscan.com/token/${CONTRACTS.UNIQ_TOKEN}`} target="_blank" rel="noopener noreferrer"
              className="text-xs transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>$UNIQ</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
