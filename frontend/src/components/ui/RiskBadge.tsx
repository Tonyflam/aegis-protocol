"use client";
import { ReactNode } from "react";

export type RiskLevel =
  | "SAFE"
  | "INFO"
  | "CAUTION"
  | "WARNING"
  | "AT_RISK"
  | "DANGEROUS"
  | "CRITICAL"
  | "NEUTRAL";

interface RiskBadgeProps {
  level: RiskLevel | string;
  children?: ReactNode;
  className?: string;
  // When true, renders a tiny dot prefix instead of a tag.
  dot?: boolean;
}

// Maps any informal severity string from the API to one of the four
// semantic colour roles used by `.badge-*` classes in globals.css.
function levelClass(level: string): string {
  const v = level.toUpperCase();
  if (v === "SAFE" || v === "OK" || v === "GOOD") return "badge-safe";
  if (v === "INFO" || v === "MONITORING") return "badge-info";
  if (v === "CAUTION" || v === "WARNING" || v === "MEDIUM" || v === "LOW") return "badge-caution";
  if (
    v === "DANGEROUS" || v === "CRITICAL" || v === "AT_RISK" ||
    v === "AT-RISK" || v === "HIGH" || v === "SCAM" || v === "AVOID"
  ) return "badge-danger";
  return "badge-neutral";
}

// Phase 4 primitive. Replaces the dozens of inline severity pills using
// hand-rolled `style={{ background: ..., color: ... }}` across the app.
export function RiskBadge({ level, children, className = "", dot = false }: RiskBadgeProps) {
  const cls = levelClass(level);
  const text = (children ?? level).toString();
  if (dot) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls}`} aria-hidden />
        <span className="t-caption" style={{ color: "var(--text-secondary)" }}>{text}</span>
      </span>
    );
  }
  return <span className={`badge ${cls} ${className}`.trim()}>{text}</span>;
}
