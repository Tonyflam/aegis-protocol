"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWalletContext } from "../lib/WalletContext";
import {
  Shield, Wallet, Activity, Users, Code2, Menu, X,
} from "lucide-react";
import { useState, useEffect } from "react";

const NAV_LINKS = [
  { href: "/oracle", label: "Oracle", icon: Activity },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/integrate", label: "Integrate", icon: Code2 },
];

export default function Navbar() {
  const pathname = usePathname();
  const { address, isConnected, connect, disconnect, isConnecting, switchToBsc, chainId } = useWalletContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <nav className="sticky top-0 z-50 border-b backdrop-blur-xl" style={{ borderColor: "var(--border-subtle)", background: "rgba(9,9,11,0.85)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Shield className="w-7 h-7" style={{ color: "var(--accent)" }} />
            <div className="leading-tight">
              <span className="text-base font-semibold tracking-tight text-white">Aegis</span>
              <span className="text-base font-light tracking-tight text-white ml-0.5">Scanner</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1 ml-8">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                    isActive ? "nav-link-active" : ""
                  }`}
                >
                  <link.icon className="w-3.5 h-3.5" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2.5">
            {/* Network badge */}
            <span className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium"
              style={{ background: "rgba(0,212,245,0.08)", color: "var(--accent)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
              BSC Testnet
            </span>

            {/* Wallet */}
            {isConnected ? (
              <div className="flex items-center gap-2">
                {chainId !== 97 && (
                  <button onClick={switchToBsc} className="text-[11px] font-medium px-2 py-1 rounded-md" style={{ color: "var(--yellow)", background: "rgba(251,191,36,0.08)" }}>
                    Switch to BSC
                  </button>
                )}
                <span className="text-[11px] font-mono px-2.5 py-1.5 rounded-lg" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                <button onClick={disconnect} className="text-[11px] transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>
                  Disconnect
                </button>
              </div>
            ) : (
              <button onClick={connect} disabled={isConnecting} className="btn-primary flex items-center gap-1.5 text-xs !px-4 !py-2">
                <Wallet className="w-3.5 h-3.5" />
                {isConnecting ? "Connecting..." : "Connect"}
              </button>
            )}

            {/* Mobile menu toggle */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-1.5 rounded-md" style={{ color: "var(--text-muted)" }}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t px-4 pb-4 pt-2" style={{ borderColor: "var(--border-subtle)", background: "rgba(9,9,11,0.95)" }}>
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "nav-link-active" : ""
                  }`}
                  style={!isActive ? { color: "var(--text-muted)" } : undefined}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
