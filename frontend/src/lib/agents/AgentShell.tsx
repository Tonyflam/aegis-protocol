"use client";

// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Agent Shell UI
// Shared layout for all autonomous agents: status bar,
// live thought stream, pending action cards, observation panel.
// ═══════════════════════════════════════════════════════════════

import { useRef, useEffect, type ReactNode } from "react";
import {
  Play,
  Pause,
  RotateCw,
  Trash2,
  Brain,
  Eye,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Clock,
  ChevronRight,
} from "lucide-react";
import type { AgentState, PendingAction, ThoughtEntry } from "./brain";

// ─── Types ──────────────────────────────────────────────────

interface AgentShellProps {
  name: string;
  icon: ReactNode;
  color: string;
  state: AgentState;
  onStart: () => void;
  onStop: () => void;
  onRunOnce: () => Promise<void>;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => void;
  onClear: () => void;
  /** Custom observation panel rendered by each agent */
  observationPanel?: ReactNode;
  /** Custom controls rendered above the thought stream */
  extraControls?: ReactNode;
  walletConnected: boolean;
}

// ─── Phase Colors ──────────────────────────────────────────

const PHASE_COLORS: Record<ThoughtEntry["phase"], string> = {
  OBSERVE: "#3b82f6",
  THINK: "#a855f7",
  DECIDE: "#f59e0b",
  ACT: "#22c55e",
  ERROR: "#ef4444",
  IDLE: "#6b7280",
};

const PHASE_ICONS: Record<ThoughtEntry["phase"], ReactNode> = {
  OBSERVE: <Eye className="w-3 h-3" />,
  THINK: <Brain className="w-3 h-3" />,
  DECIDE: <Zap className="w-3 h-3" />,
  ACT: <CheckCircle className="w-3 h-3" />,
  ERROR: <AlertTriangle className="w-3 h-3" />,
  IDLE: <Clock className="w-3 h-3" />,
};

const STATUS_LABELS: Record<AgentState["status"], string> = {
  idle: "Idle",
  thinking: "Thinking...",
  observing: "Observing...",
  deciding: "Deciding...",
  acting: "Executing...",
  paused: "Paused",
  error: "Error",
};

const RISK_COLORS: Record<PendingAction["risk"], string> = {
  LOW: "#3b82f6",
  MEDIUM: "#f59e0b",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

// ─── Helpers ────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ─── Component ──────────────────────────────────────────────

export default function AgentShell({
  name,
  icon,
  color,
  state,
  onStart,
  onStop,
  onRunOnce,
  onApprove,
  onReject,
  onClear,
  observationPanel,
  extraControls,
  walletConnected,
}: AgentShellProps) {
  const thoughtsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest thought
  useEffect(() => {
    thoughtsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.thoughts.length]);

  const isActive = state.status !== "idle" && state.status !== "paused" && state.status !== "error";
  const pendingActions = state.pendingActions.filter((a) => a.status === "pending");
  const executedActions = state.pendingActions.filter(
    (a) => a.status === "completed" || a.status === "failed" || a.status === "rejected",
  );

  if (!walletConnected) {
    return (
      <div className="card p-12 text-center" style={{ borderRadius: "12px" }}>
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">{icon}</div>
        <h3 className="text-xl font-semibold text-white mb-2">{name} Agent</h3>
        <p className="text-sm max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
          Connect your wallet to activate the {name} agent. It will autonomously monitor your wallet and recommend actions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Agent Status Bar ──────────────────────────────── */}
      <div
        className="card p-4"
        style={{ borderRadius: "12px", borderLeft: `3px solid ${color}` }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: `${color}15` }}
            >
              {icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                {name} Agent
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: state.isRunning ? "rgba(34,197,94,0.15)" : "rgba(107,114,128,0.15)",
                    color: state.isRunning ? "#22c55e" : "#6b7280",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: state.isRunning ? "#22c55e" : "#6b7280",
                      animation: state.isRunning ? "pulse 2s infinite" : "none",
                    }}
                  />
                  {state.isRunning ? "LIVE" : "STOPPED"}
                </span>
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {STATUS_LABELS[state.status]}
                {state.cycleCount > 0 && ` · ${state.cycleCount} cycles`}
                {state.lastCycle && ` · last ${timeAgo(state.lastCycle)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!state.isRunning ? (
              <button
                onClick={onStart}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: `${color}20`, color }}
              >
                <Play className="w-3.5 h-3.5" /> Start Agent
              </button>
            ) : (
              <button
                onClick={onStop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}
              >
                <Pause className="w-3.5 h-3.5" /> Stop
              </button>
            )}
            <button
              onClick={onRunOnce}
              disabled={isActive}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)" }}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isActive ? "animate-spin" : ""}`} /> Run Once
            </button>
          </div>
        </div>
      </div>

      {/* ── Extra Controls ────────────────────────────────── */}
      {extraControls}

      {/* ── Pending Actions (require approval) ────────────── */}
      {pendingActions.length > 0 && (
        <div className="card p-4 space-y-3" style={{ borderRadius: "12px", border: "1px solid rgba(249,115,22,0.3)" }}>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: "#f59e0b" }} />
            Recommended Actions ({pendingActions.length})
          </h3>
          {pendingActions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onApprove={() => onApprove(action.id)}
              onReject={() => onReject(action.id)}
            />
          ))}
        </div>
      )}

      {/* ── Main Layout: Observations + Thought Stream ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Observation Panel */}
        <div className="card p-4" style={{ borderRadius: "12px" }}>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4" style={{ color: "#3b82f6" }} />
            Observations
          </h3>
          {observationPanel || (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Start the agent to begin collecting observations.
            </p>
          )}
        </div>

        {/* Live Thought Stream */}
        <div className="card p-4" style={{ borderRadius: "12px" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Brain className="w-4 h-4" style={{ color: "#a855f7" }} />
              Agent Thoughts
              {isActive && <Loader2 className="w-3 h-3 animate-spin" style={{ color }} />}
            </h3>
            {state.thoughts.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs flex items-center gap-1 px-2 py-1 rounded"
                style={{ color: "var(--text-muted)" }}
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <div
            className="space-y-1 overflow-y-auto pr-1"
            style={{ maxHeight: "400px" }}
          >
            {state.thoughts.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No thoughts yet. Start the agent to see its reasoning live.
              </p>
            ) : (
              state.thoughts.map((t) => <ThoughtLine key={t.id} thought={t} />)
            )}
            <div ref={thoughtsEndRef} />
          </div>
        </div>
      </div>

      {/* ── Action History ────────────────────────────────── */}
      {executedActions.length > 0 && (
        <div className="card p-4" style={{ borderRadius: "12px" }}>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" style={{ color: "#22c55e" }} />
            Action History ({executedActions.length})
          </h3>
          <div className="space-y-2">
            {executedActions.slice(-10).reverse().map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 text-xs p-2 rounded"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                {a.status === "completed" && <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: "#22c55e" }} />}
                {a.status === "failed" && <XCircle className="w-3 h-3 flex-shrink-0" style={{ color: "#ef4444" }} />}
                {a.status === "rejected" && <XCircle className="w-3 h-3 flex-shrink-0" style={{ color: "#6b7280" }} />}
                <span style={{ color: "var(--text-secondary)" }}>{a.description}</span>
                {a.txHash && (
                  <a
                    href={`https://bscscan.com/tx/${a.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs underline"
                    style={{ color }}
                  >
                    TX
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────

function ThoughtLine({ thought }: { thought: ThoughtEntry }) {
  const color = PHASE_COLORS[thought.phase];
  return (
    <div className="flex items-start gap-2 py-1 px-1 rounded text-xs hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-1 shrink-0 mt-0.5" style={{ color }}>
        {PHASE_ICONS[thought.phase]}
        <span className="font-mono text-[10px] opacity-70">{thought.phase.slice(0, 3)}</span>
      </div>
      <span style={{ color: "var(--text-secondary)" }}>{thought.content}</span>
      <span className="ml-auto shrink-0 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
        {new Date(thought.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}

function ActionCard({
  action,
  onApprove,
  onReject,
}: {
  action: PendingAction;
  onApprove: () => void;
  onReject: () => void;
}) {
  const riskColor = RISK_COLORS[action.risk];
  return (
    <div
      className="p-3 rounded-lg"
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${riskColor}30` }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <ChevronRight className="w-3 h-3" style={{ color: riskColor }} />
            <span className="text-sm font-medium text-white">{action.description}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{ background: `${riskColor}20`, color: riskColor }}
            >
              {action.risk}
            </span>
          </div>
          <p className="text-xs mt-1 ml-5" style={{ color: "var(--text-muted)" }}>
            {action.reasoning}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-5">
        <button
          onClick={onApprove}
          className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-all"
          style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
        >
          <CheckCircle className="w-3 h-3" /> Approve & Execute
        </button>
        <button
          onClick={onReject}
          className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-all"
          style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
        >
          <XCircle className="w-3 h-3" /> Reject
        </button>
      </div>
    </div>
  );
}
