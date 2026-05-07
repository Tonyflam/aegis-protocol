"use client";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface StatTileProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: string;
  // Color of icon + value emphasis. Pass any CSS color or var().
  color?: string;
  // Optional pulsing dot to suggest "live" data.
  live?: boolean;
  className?: string;
}

// Phase 4 primitive. The standardized stat tile that appears across hero
// metric rows, vault Yield Projection, analytics dashboards. Replaces the
// recurring inline `<div className="card p-4 text-center">` pattern.
export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  color = "var(--text-primary)",
  live = false,
  className = "",
}: StatTileProps) {
  return (
    <div className={`card p-4 ${className}`.trim()}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />}
        <span className="t-caption" style={{ color: "var(--text-muted)" }}>{label}</span>
        {live && (
          <span
            className="ml-auto inline-block w-1.5 h-1.5 rounded-full pulse-live"
            style={{ background: color === "var(--text-primary)" ? "var(--sem-success)" : color }}
          />
        )}
      </div>
      <div className="text-lg font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      {hint && (
        <div className="t-caption mt-0.5" style={{ color: "var(--text-muted)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}
