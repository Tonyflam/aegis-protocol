"use client";

interface SkeletonProps {
  className?: string;
  // Convenience helpers \u2014 if neither width nor height is set, the parent
  // container's dimensions are used (typical w-full h-N from Tailwind).
  width?: number | string;
  height?: number | string;
  rounded?: "sm" | "md" | "lg" | "full";
}

// Phase 4 primitive. Pulsing shimmer placeholder. Backed by `.skeleton` in
// globals.css. Use to replace `<Loader2 />` blocks during initial load so
// the page already has structure before data arrives.
export function Skeleton({
  className = "",
  width,
  height,
  rounded = "md",
}: SkeletonProps) {
  const radiusMap = { sm: "6px", md: "10px", lg: "12px", full: "999px" };
  return (
    <div
      className={`skeleton ${className}`.trim()}
      style={{
        width,
        height,
        borderRadius: radiusMap[rounded],
      }}
    />
  );
}

interface SkeletonRowProps { count?: number; lineHeight?: number; className?: string; }
// Convenience: render N stacked text-line skeletons.
export function SkeletonLines({ count = 3, lineHeight = 12, className = "" }: SkeletonRowProps) {
  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={i === count - 1 ? "60%" : "100%"}
        />
      ))}
    </div>
  );
}

// Convenience: a card-shaped skeleton roughly the size of a stat tile.
export function SkeletonStat({ className = "" }: { className?: string }) {
  return (
    <div className={`card p-4 ${className}`.trim()}>
      <Skeleton height={10} width="40%" className="mb-2" />
      <Skeleton height={20} width="70%" />
    </div>
  );
}
