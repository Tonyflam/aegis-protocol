"use client";

import Link from "next/link";
import { CONTRACTS } from "../../lib/constants";
import {
  Code2, CheckCircle, ExternalLink, ArrowRight,
  Shield, Database, Layers,
} from "lucide-react";
import { useState } from "react";

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-[10px] px-2 py-0.5 rounded transition-colors"
      style={{ background: "var(--bg-elevated)", color: copied ? "var(--green)" : "var(--text-muted)" }}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function IntegratePage() {
  return (
    <div className="min-h-screen relative z-10">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Code2 className="w-6 h-6" style={{ color: "var(--accent)" }} />
              API &amp; Integration
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Add token safety checks to your smart contracts with one line of Solidity
            </p>
          </div>
          <a href="https://github.com/Tonyflam/aegis-protocol" target="_blank" rel="noopener noreferrer"
            className="btn-secondary text-xs flex items-center gap-1.5 !px-3 !py-1.5">
            GitHub <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Quick Start */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-6">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-white mb-2">Quick Start</h2>
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
            Add the Aegis oracle check to any smart contract with a single modifier.
            If a token hasn&apos;t been scanned or is flagged as unsafe, the transaction reverts.
          </p>

          <div className="relative p-4 rounded-lg mb-4" style={{ background: "var(--bg-elevated)" }}>
            <div className="absolute top-3 right-3">
              <CopyButton text={`interface IAegisScanner {
    function isTokenSafe(address token) external view returns (bool);
    function getTokenRisk(address token) external view returns (uint8 riskScore, uint48 lastUpdated, address attestedBy, bytes32 reasoningHash);
    function getTokenFlags(address token) external view returns (bool isHoneypot, bool hasHighTax, bool isUnverified, bool hasConcentratedOwnership, bool hasLowLiquidity);
}

contract MyDex {
    IAegisScanner constant AEGIS = IAegisScanner(${CONTRACTS.SCANNER});

    modifier aegisSafe(address token) {
        require(AEGIS.isTokenSafe(token), "Aegis: token flagged unsafe");
        _;
    }

    function swap(address tokenOut, uint256 amount) external aegisSafe(tokenOut) {
        // normal swap logic
    }
}`} />
            </div>
            <pre className="text-xs font-mono leading-relaxed overflow-x-auto" style={{ color: "var(--text-secondary)" }}>
              <code>{`interface IAegisScanner {
    function isTokenSafe(address token)
        external view returns (bool);
}

contract MyDex {
    IAegisScanner constant AEGIS =
        IAegisScanner(${CONTRACTS.SCANNER === "0x0000000000000000000000000000000000000000" ? "SCANNER_ADDRESS" : CONTRACTS.SCANNER});

    modifier aegisSafe(address token) {
        require(
            AEGIS.isTokenSafe(token),
            "Aegis: token flagged unsafe"
        );
        _;
    }

    function swap(
        address tokenOut,
        uint256 amount
    ) external `}<span style={{ color: "var(--accent)" }}>aegisSafe(tokenOut)</span>{` {
        // normal swap logic
    }
}`}</code>
            </pre>
          </div>

          <div className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5" style={{ color: "var(--green)" }} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Zero gas cost for view calls — oracle queries are free to read
            </span>
          </div>
        </div>
      </div>

      {/* Oracle Interface */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-6">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
            <Database className="w-4 h-4" style={{ color: "var(--accent)" }} />
            IAegisScanner Interface
          </h2>
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
            All public view functions available on-chain. Import the interface or call these functions directly.
          </p>

          <div className="space-y-4">
            {[
              {
                name: "isTokenSafe",
                sig: "function isTokenSafe(address token) external view returns (bool)",
                desc: "Returns true only if the token has been scanned and its risk score is below the protocol threshold. This is the simplest integration point.",
                returns: "bool — true if safe, false if flagged or unscanned",
              },
              {
                name: "getTokenRisk",
                sig: "function getTokenRisk(address token) external view returns (uint8 riskScore, uint48 lastUpdated, address attestedBy, bytes32 reasoningHash)",
                desc: "Returns the full risk attestation data for a token. Use this when you need the actual score, not just a boolean.",
                returns: "RiskData struct — score (0–100), update timestamp, attester address, reasoning hash",
              },
              {
                name: "getTokenFlags",
                sig: "function getTokenFlags(address token) external view returns (bool isHoneypot, bool hasHighTax, bool isUnverified, bool hasConcentratedOwnership, bool hasLowLiquidity)",
                desc: "Returns structured flag booleans. Use this to check specific risk factors individually.",
                returns: "5 boolean flags — honeypot, high tax, unverified, concentrated ownership, low liquidity",
              },
              {
                name: "isTokenSafeBatch",
                sig: "function isTokenSafeBatch(address[] tokens) external view returns (bool[])",
                desc: "Batch safety check for multiple tokens in a single call. Efficient for DEX aggregators checking entire swap paths.",
                returns: "bool[] — safety status for each token in the input array",
              },
              {
                name: "getTokenRiskBatch",
                sig: "function getTokenRiskBatch(address[] tokens) external view returns (RiskData[])",
                desc: "Batch risk data retrieval. One call to get scores for an entire token list.",
                returns: "RiskData[] — full risk records for each token",
              },
              {
                name: "getTokenScan",
                sig: "function getTokenScan(address token) external view returns (TokenScan)",
                desc: "Returns the complete scan record: all numeric metrics, boolean flags, scanner ID, flags string, and reasoning hash.",
                returns: "TokenScan struct — 19 fields covering all scan data",
              },
            ].map((fn, i) => (
              <div key={i} className="p-4 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <code className="text-xs font-mono font-semibold" style={{ color: "var(--accent)" }}>{fn.name}()</code>
                  <CopyButton text={fn.sig} />
                </div>
                <p className="text-[11px] mb-2" style={{ color: "var(--text-secondary)" }}>{fn.desc}</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <span className="font-semibold">Returns:</span> {fn.returns}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Integration Examples */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-6">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
            <Layers className="w-4 h-4" style={{ color: "var(--purple)" }} />
            Integration Examples
          </h2>
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
            Ready-to-use smart contract patterns. Source code available in{" "}
            <code className="font-mono" style={{ color: "var(--accent)" }}>contracts/examples/</code>.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                name: "AegisSafeSwap",
                desc: "DEX router with aegisSafe modifier. Reverts swaps to flagged tokens. Drop-in pattern for PancakeSwap-style routers.",
                file: "contracts/examples/AegisSafeSwap.sol",
                useCase: "DEX Routers & Aggregators",
              },
              {
                name: "AegisWalletGuard",
                desc: "Wallet-level protection. Checks token safety before approvals and transfers. Guards against honeypot interactions.",
                file: "contracts/examples/AegisWalletGuard.sol",
                useCase: "Smart Contract Wallets",
              },
            ].map((ex, i) => (
              <div key={i} className="p-4 rounded-lg" style={{ background: "var(--bg-elevated)", borderLeft: "3px solid var(--purple)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs font-semibold" style={{ color: "var(--purple)" }}>{ex.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(167,139,250,0.08)", color: "var(--purple)" }}>
                    {ex.useCase}
                  </span>
                </div>
                <p className="text-[11px] mb-2" style={{ color: "var(--text-secondary)" }}>{ex.desc}</p>
                <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{ex.file}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contract Addresses */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-6">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: "var(--green)" }} />
            Contract Addresses (BSC Testnet)
          </h2>
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
            All contracts are deployed and source-verified on BSC Testnet (Chain ID 97).
          </p>

          <div className="space-y-0">
            {[
              { name: "AegisScanner", address: CONTRACTS.SCANNER, primary: true },
              { name: "$UNIQ Token", address: CONTRACTS.UNIQ_TOKEN, primary: false },
            ].map((c, i) => (
              <div key={i} className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold" style={{ color: c.primary ? "var(--accent)" : "var(--text-secondary)" }}>
                    {c.name}
                  </span>
                  {c.primary && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>Primary Oracle</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {c.address === "0x0000000000000000000000000000000000000000" ? "Pending deployment" : c.address}
                  </span>
                  {c.address !== "0x0000000000000000000000000000000000000000" && (
                    <a href={`https://testnet.bscscan.com/address/${c.address}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
        <div className="card p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at center, rgba(0,212,245,0.03) 0%, transparent 70%)" }} />
          <div className="relative">
            <h3 className="text-xl font-bold text-white mb-2">Ready to Integrate?</h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              Start scanning tokens or plug the oracle into your contracts.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/scanner" className="btn-primary flex items-center gap-2">
                Try the Scanner <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="https://github.com/Tonyflam/aegis-protocol" target="_blank" rel="noopener noreferrer" className="btn-secondary flex items-center gap-2">
                View Source <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
