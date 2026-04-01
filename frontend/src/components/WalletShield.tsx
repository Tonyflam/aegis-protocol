"use client";

import { useShieldContext } from "../lib/ShieldContext";
import {
  ShieldCheck,
  ShieldAlert,
  Activity,
  AlertTriangle,
  Eye,
  Zap,
  Bot,
  Wifi,
  WifiOff,
  ExternalLink,
  Bell,
  Lock,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function getSeverityColor(s: string): string {
  switch (s) {
    case "danger": return "#ef4444";
    case "warning": return "#f97316";
    case "success": return "#22c55e";
    default: return "var(--accent)";
  }
}

function getSeverityIcon(s: string) {
  switch (s) {
    case "danger": return ShieldAlert;
    case "warning": return AlertTriangle;
    case "success": return ShieldCheck;
    default: return Activity;
  }
}

// ═══════════════════════════════════════════════════════════════
// Component: WalletShield — uses ShieldContext for persistence
// ═══════════════════════════════════════════════════════════════

export default function WalletShield({ connectedAddress }: { connectedAddress: string | null }) {
  const shield = useShieldContext();

  return (
    <div className="space-y-6">
      {/* ── Shield Status ── */}
      <div className="card p-6 relative overflow-hidden" style={{ borderRadius: "12px" }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] opacity-10"
          style={{ background: shield.monitoring ? "#22c55e" : "#ef4444" }} />

        <div className="flex items-center gap-5 relative">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500 ${shield.monitoring ? "animate-pulse" : ""}`}
            style={{
              background: shield.monitoring ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
              border: `2px solid ${shield.monitoring ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.2)"}`,
            }}>
            {shield.monitoring ? (
              <ShieldCheck className="w-10 h-10 text-green-400" />
            ) : (
              <ShieldAlert className="w-10 h-10 text-red-400" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-white">
                {shield.monitoring ? "Guardian Active" : "Guardian Offline"}
              </h3>
              <span className={`w-2.5 h-2.5 rounded-full ${shield.monitoring ? "pulse-live" : ""}`}
                style={{ background: shield.monitoring ? "#22c55e" : "#ef4444" }} />
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {shield.monitoring
                ? `Monitoring ${connectedAddress?.slice(0, 8)}...${connectedAddress?.slice(-6)} in real-time`
                : "Start the guardian to monitor your wallet for threats"}
            </p>
            {shield.monitoring && shield.lastBlock && (
              <p className="text-xs font-mono mt-1" style={{ color: "var(--text-muted)" }}>
                Watching from block #{shield.lastBlock.toLocaleString()} &middot; Persists across pages
              </p>
            )}
          </div>

          <button
            onClick={shield.monitoring ? shield.stopMonitoring : () => connectedAddress && shield.startMonitoring(connectedAddress)}
            disabled={!connectedAddress}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
              shield.monitoring
                ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                : "btn-primary"
            }`}
          >
            {shield.monitoring ? (
              <><WifiOff className="w-4 h-4" /> Stop</>
            ) : (
              <><Zap className="w-4 h-4" /> Activate</>
            )}
          </button>
        </div>

        {/* Quick Stats */}
        {shield.monitoring && (
          <div className="grid grid-cols-4 gap-3 mt-5 pt-5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            {[
              { label: "Status", value: shield.connected ? "Connected" : "Disconnected", color: shield.connected ? "#22c55e" : "#ef4444", icon: shield.connected ? Wifi : WifiOff },
              { label: "Threats", value: shield.dangerCount.toString(), color: shield.dangerCount > 0 ? "#ef4444" : "#22c55e", icon: ShieldAlert },
              { label: "Warnings", value: shield.warningCount.toString(), color: shield.warningCount > 0 ? "#f97316" : "#22c55e", icon: AlertTriangle },
              { label: "Events", value: shield.events.length.toString(), color: "var(--accent)", icon: Activity },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: `${s.color}08` }}>
                <s.icon className="w-4 h-4 flex-shrink-0" style={{ color: s.color }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Not Connected Warning ── */}
      {!connectedAddress && (
        <div className="card p-8 text-center" style={{ borderRadius: "12px" }}>
          <Lock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <h4 className="text-lg font-semibold text-white mb-2">Connect Wallet to Activate Shield</h4>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            The Guardian Shield monitors your wallet in real-time for unauthorized approvals,
            suspicious transfers, and potential drain attacks on BSC.
          </p>
        </div>
      )}

      {/* ── Event Feed ── */}
      {shield.events.length > 0 && (
        <div className="card p-5" style={{ borderRadius: "12px" }}>
          <h4 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-[color:var(--accent)]" />
            Guardian Activity Feed
            <span className="ml-auto text-xs font-normal" style={{ color: "var(--text-muted)" }}>
              {shield.events.length} events
            </span>
          </h4>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
            {shield.events.map(event => {
              const color = getSeverityColor(event.severity);
              const Icon = getSeverityIcon(event.severity);
              return (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg transition-all hover:bg-white/[0.02]"
                  style={{ borderLeft: `2px solid ${color}` }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${color}12` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-white">{event.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${color}12`, color }}>{event.severity.toUpperCase()}</span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{event.description}</p>
                    {event.txHash && (
                      <a href={`https://bscscan.com/tx/${event.txHash}`} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] mt-1 inline-flex items-center gap-1 hover:underline" style={{ color: "var(--accent)" }}>
                        <ExternalLink className="w-2.5 h-2.5" /> View TX
                      </a>
                    )}
                  </div>
                  <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>{timeAgo(event.timestamp)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── How Shield Works ── */}
      <div className="card p-6" style={{ borderRadius: "12px" }}>
        <h4 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <Bot className="w-4 h-4 text-[color:var(--accent)]" />
          How Guardian Shield Works
        </h4>

        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: Eye,
              title: "Real-Time Monitoring",
              desc: "Scans every new BSC block for approval events and transfers involving your wallet. Never stops, never sleeps.",
            },
            {
              icon: ShieldAlert,
              title: "Threat Detection",
              desc: "Flags unlimited approvals, unusual transfer patterns, and known exploit signatures the moment they appear.",
            },
            {
              icon: Zap,
              title: "Instant Alerts",
              desc: "Notifies you immediately when suspicious activity is detected. Shield persists even when you navigate between pages.",
            },
          ].map(f => (
            <div key={f.title} className="p-4 rounded-xl" style={{ background: "var(--bg-base)" }}>
              <f.icon className="w-5 h-5 mb-3 text-[color:var(--accent)]" />
              <h5 className="text-sm font-semibold text-white mb-1">{f.title}</h5>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
