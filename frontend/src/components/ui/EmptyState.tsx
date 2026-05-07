"use client";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  // Tone affects icon tint; defaults to muted.
  tone?: "neutral" | "info" | "warning" | "danger";
  className?: string;
}

const TONE_COLOR: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  neutral: "var(--text-muted)",
  info:    "var(--sem-info)",
  warning: "var(--sem-warning)",
  danger:  "var(--sem-danger)",
};

// Phase 4 primitive. Standardized "no data yet" / "connect wallet first"
// state used across Guardian, Vault, Scanner. Replaces ad-hoc inline
// `<div>` blocks with inconsistent spacing.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`card p-10 text-center flex flex-col items-center ${className}`.trim()}
    >
      {Icon && (
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
        >
          <Icon className="w-5 h-5" style={{ color: TONE_COLOR[tone] }} />
        </div>
      )}
      <div className="t-h3 text-white mb-1.5">{title}</div>
      {description && (
        <p className="t-body max-w-md" style={{ color: "var(--text-secondary)" }}>
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
