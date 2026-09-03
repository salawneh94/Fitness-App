import { useEffect, useRef, useState } from 'react';

/**
 * Tracks a container's rendered pixel width so charts can draw in real coordinates.
 *
 * Drawing into a fixed viewBox and letting the browser scale it would be simpler, but it
 * stretches strokes and text non-uniformly. Measuring instead keeps line weights and labels
 * crisp at any width.
 */
export function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      // Ignore sub-pixel churn; re-rendering on every fractional change is wasted work.
      setWidth((prev) => (Math.abs(prev - next) > 1 ? next : prev));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
