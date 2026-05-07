"use client";
import { ReactNode } from "react";

interface SectionProps {
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  // When true, the header sits on the same row as the action on sm+ screens
  // and stacks on mobile.
  inline?: boolean;
}

// Phase 4 primitive. Page-level section header + content slot. Provides
// consistent spacing and the small uppercase eyebrow used across the
// landing/vault/analytics pages.
export function Section({
  eyebrow,
  title,
  description,
  action,
  children,
  className = "",
  inline = true,
}: SectionProps) {
  return (
    <section className={`mb-10 ${className}`.trim()}>
      {(eyebrow || title || description || action) && (
        <div
          className={
            inline
              ? "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5"
              : "mb-5"
          }
        >
          <div className="min-w-0">
            {eyebrow && <div className="section-eyebrow mb-2">{eyebrow}</div>}
            {title && <h2 className="t-h2 text-white">{title}</h2>}
            {description && (
              <p className="t-body mt-1.5" style={{ color: "var(--text-secondary)" }}>
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
