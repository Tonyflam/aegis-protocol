"use client";
import { ReactNode, HTMLAttributes } from "react";

type Variant = "default" | "elevated" | "interactive" | "glow";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padded?: boolean;
  children: ReactNode;
}

// Phase 4 primitive. Wraps the existing `.card` base class with named
// variants so pages don't have to memorize hover/elevation classnames.
export function Card({
  variant = "default",
  padded = true,
  className = "",
  children,
  ...rest
}: CardProps) {
  const variantClass =
    variant === "interactive" ? "card card-action card-hover-lift"
    : variant === "elevated" ? "card-elevated"
    : variant === "glow" ? "card card-hover-glow"
    : "card";
  const padClass = padded ? "p-6" : "";
  return (
    <div className={`${variantClass} ${padClass} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
