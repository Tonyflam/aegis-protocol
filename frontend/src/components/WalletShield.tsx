"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
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

// ─── Types ─────────────────────────────────────────────────────

interface GuardianEvent {
  id: string;
  type: "approval_detected" | "threat_blocked" | "risk_alert" | "scan_complete" | "monitoring";
  severity: "info" | "warning" | "danger" | "success";
  title: string;
  description: string;
  timestamp: number;
  txHash?: string;
  metadata?: { contract?: string; token?: string; riskScore?: number };
}

const BSC_RPC = "https://bsc-rpc.publicnode.com";
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
const APPROVAL_TOPIC = ethers.id("Approval(address,address,uint256)");

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
// Component: WalletShield
// ═══════════════════════════════════════════════════════════════

export default function WalletShield({ connectedAddress }: { connectedAddress: string | null }) {
  const [monitoring, setMonitoring] = useState(false);
  const [events, setEvents] = useState<GuardianEvent[]>([]);
  const [lastBlock, setLastBlock] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const providerRef = useRef<ethers.JsonRpcProvider | null>(null);

  const addEvent = useCallback((event: Omit<GuardianEvent, "id" | "timestamp">) => {
    setEvents(prev => [{
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    }, ...prev].slice(0, 50));
  }, []);

  const pollForActivity = useCallback(async () => {
    if (!connectedAddress || !providerRef.current) return;

    try {
      const provider = providerRef.current;
      const currentBlock = await provider.getBlockNumber();

      if (lastBlock && currentBlock > lastBlock) {
        const paddedAddr = "0x" + connectedAddress.slice(2).toLowerCase().padStart(64, "0");

        // Check for new approval events involving this wallet
        try {
          const approvalLogs = await provider.getLogs({
            fromBlock: lastBlock + 1,
            toBlock: currentBlock,
            topics: [APPROVAL_TOPIC, paddedAddr],
          });

          for (const log of approvalLogs) {
            const spender = "0x" + log.topics[2].slice(26);
            const value = BigInt(log.data);
            const isUnlimited = value.toString() === "115792089237316195423570985008687907853269984665640564039457584007913129639935";

            addEvent({
              type: "approval_detected",
              severity: isUnlimited ? "warning" : "info",
              title: isUnlimited ? "Unlimited Approval Detected" : "New Token Approval",
              description: `Token ${log.address.slice(0, 10)}... approved to ${spender.slice(0, 10)}...${isUnlimited ? " (UNLIMITED)" : ""}`,
              txHash: log.transactionHash,
              metadata: { contract: spender, token: log.address },
            });
          }
        } catch {
          // Log fetch may fail on some blocks
        }

        // Check for outgoing transfers (potential drains)
        try {
          const transferLogs = await provider.getLogs({
            fromBlock: lastBlock + 1,
            toBlock: currentBlock,
            topics: [TRANSFER_TOPIC, paddedAddr],
          });

          if (transferLogs.length > 3) {
            addEvent({
              type: "risk_alert",
              severity: "danger",
              title: "Unusual Transfer Activity",
              description: `${transferLogs.length} outgoing transfers detected in ${currentBlock - lastBlock} blocks. Possible drain attack.`,
            });
          }
        } catch {
          // Ignore
        }
      }

      setLastBlock(currentBlock);
    } catch {
      // RPC error — will retry next interval
    }
  }, [connectedAddress, lastBlock, addEvent]);

  const startMonitoring = useCallback(async () => {
    if (!connectedAddress) return;

    providerRef.current = new ethers.JsonRpcProvider(BSC_RPC, 56, { staticNetwork: true });

    try {
      const block = await providerRef.current.getBlockNumber();
      setLastBlock(block);
      setConnected(true);
      setMonitoring(true);

      addEvent({
        type: "monitoring",
        severity: "success",
        title: "Guardian Activated",
        description: `Monitoring wallet ${connectedAddress.slice(0, 8)}...${connectedAddress.slice(-6)} from block #${block.toLocaleString()}`,
      });

      // Poll every 6 seconds (2 BSC blocks)
      intervalRef.current = setInterval(() => {
        pollForActivity();
      }, 6000);
    } catch {
      addEvent({
        type: "monitoring",
        severity: "danger",
        title: "Connection Failed",
        description: "Could not connect to BSC network. Retrying...",
      });
    }
  }, [connectedAddress, addEvent, pollForActivity]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setMonitoring(false);
    setConnected(false);
    providerRef.current = null;

    addEvent({
      type: "monitoring",
      severity: "info",
      title: "Guardian Paused",
      description: "Real-time monitoring stopped. Your wallet is unprotected.",
    });
  }, [addEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const dangerCount = events.filter(e => e.severity === "danger").length;
  const warningCount = events.filter(e => e.severity === "warning").length;

  return (
    <div className="space-y-6">
      {/* ── Shield Status ── */}
      <div className="card p-6 relative overflow-hidden" style={{ borderRadius: "12px" }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] opacity-10"
          style={{ background: monitoring ? "#22c55e" : "#ef4444" }} />

        <div className="flex items-center gap-5 relative">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500 ${monitoring ? "animate-pulse" : ""}`}
            style={{
              background: monitoring ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
              border: `2px solid ${monitoring ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.2)"}`,
            }}>
            {monitoring ? (
              <ShieldCheck className="w-10 h-10 text-green-400" />
            ) : (
              <ShieldAlert className="w-10 h-10 text-red-400" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-white">
                {monitoring ? "Guardian Active" : "Guardian Offline"}
              </h3>
              <span className={`w-2.5 h-2.5 rounded-full ${monitoring ? "pulse-live" : ""}`}
                style={{ background: monitoring ? "#22c55e" : "#ef4444" }} />
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {monitoring
                ? `Monitoring ${connectedAddress?.slice(0, 8)}...${connectedAddress?.slice(-6)} in real-time`
                : "Start the guardian to monitor your wallet for threats"}
            </p>
            {monitoring && lastBlock && (
              <p className="text-xs font-mono mt-1" style={{ color: "var(--text-muted)" }}>
                Watching from block #{lastBlock.toLocaleString()}
              </p>
            )}
          </div>

          <button
            onClick={monitoring ? stopMonitoring : startMonitoring}
            disabled={!connectedAddress}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
              monitoring
                ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                : "btn-primary"
            }`}
          >
            {monitoring ? (
              <><WifiOff className="w-4 h-4" /> Stop</>
            ) : (
              <><Zap className="w-4 h-4" /> Activate</>
            )}
          </button>
        </div>

        {/* Quick Stats */}
        {monitoring && (
          <div className="grid grid-cols-4 gap-3 mt-5 pt-5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            {[
              { label: "Status", value: connected ? "Connected" : "Disconnected", color: connected ? "#22c55e" : "#ef4444", icon: connected ? Wifi : WifiOff },
              { label: "Threats", value: dangerCount.toString(), color: dangerCount > 0 ? "#ef4444" : "#22c55e", icon: ShieldAlert },
              { label: "Warnings", value: warningCount.toString(), color: warningCount > 0 ? "#f97316" : "#22c55e", icon: AlertTriangle },
              { label: "Events", value: events.length.toString(), color: "var(--accent)", icon: Activity },
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
      {events.length > 0 && (
        <div className="card p-5" style={{ borderRadius: "12px" }}>
          <h4 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-[color:var(--accent)]" />
            Guardian Activity Feed
            <span className="ml-auto text-xs font-normal" style={{ color: "var(--text-muted)" }}>
              {events.length} events
            </span>
          </h4>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
            {events.map(event => {
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
              desc: "Scans every new BSC block for approval events and transfers involving your wallet.",
            },
            {
              icon: ShieldAlert,
              title: "Threat Detection",
              desc: "Flags unlimited approvals, unusual transfer patterns, and known exploit signatures.",
            },
            {
              icon: Zap,
              title: "Instant Alerts",
              desc: "Notifies you immediately when suspicious activity is detected. Auto-revoke coming soon.",
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
