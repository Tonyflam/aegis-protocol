"use client";

import { useRef, useState, useEffect, type CSSProperties } from "react";

/**
 * Reveals an element when it enters the viewport.
 * Uses IntersectionObserver — no fake data, no external deps.
 */
export function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

/**
 * Staggered reveal for a group of children.
 * Returns a ref for the parent + delay style generators.
 */
export function useStaggerReveal(childCount: number, delayMs = 100) {
  const { ref, isVisible } = useScrollReveal(0.1);

  const getDelay = (index: number): CSSProperties => ({
    transitionDelay: `${index * delayMs}ms`,
  });

  return { ref, isVisible, getDelay, childCount };
}
