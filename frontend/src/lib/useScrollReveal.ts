"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Intersection Observer hook for scroll-reveal animations.
 * Returns a ref to attach to the element and a boolean indicating visibility.
 */
export function useScrollReveal(options?: {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}) {
  const { threshold = 0.15, rootMargin = "0px 0px -40px 0px", once = true } = options || {};
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, isVisible };
}

/**
 * Staggered children animation — use on a container.
 * Each child gets a CSS variable --stagger-delay based on index.
 */
export function useStaggerReveal(count: number, baseDelay = 80) {
  const { ref, isVisible } = useScrollReveal();

  const getDelay = useCallback(
    (index: number) => ({
      transitionDelay: `${index * baseDelay}ms`,
    }),
    [baseDelay]
  );

  return { ref, isVisible, getDelay };
}
