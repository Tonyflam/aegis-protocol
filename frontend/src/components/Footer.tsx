"use client";

import Link from "next/link";
import { Shield, ExternalLink } from "lucide-react";
import { CONTRACTS } from "../lib/constants";

export default function Footer() {
  return (
    <footer className="border-t mt-auto" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid sm:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5" style={{ color: "var(--accent)" }} />
              <span className="text-sm font-semibold text-white">Aegis Protocol</span>
            </Link>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              AI-powered DeFi security on BNB Chain.
              <br />Built by Uniq Minds.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>Product</p>
            <div className="flex flex-col gap-1.5">
              {[
                { href: "/scanner", label: "Token Scanner" },
                { href: "/alerts", label: "Whale Alerts" },
                { href: "/dashboard", label: "Dashboard" },
              ].map((l) => (
                <Link key={l.href} href={l.href} className="text-xs transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>Links</p>
            <div className="flex flex-col gap-1.5">
              {[
                { href: "https://x.com/uniq_minds", label: "Twitter" },
                { href: "https://github.com/Tonyflam/aegis-protocol", label: "GitHub" },
                { href: `https://bscscan.com/token/${CONTRACTS.UNIQ_TOKEN}`, label: "$UNIQ on BSCScan" },
              ].map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1 transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>
                  {l.label}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="divider mb-4" />

        <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
          &copy; {new Date().getFullYear()} Aegis Protocol by Uniq Minds. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
