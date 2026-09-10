"use client";

import { useEffect, useRef, useState } from "react";

// Measures the real remaining space below wherever this frame starts (i.e.
// below the page's own header) down to the top of the fixed bottom nav, and
// pins the frame to exactly that height. Runtime measurement rather than a
// guessed calc() — safe-area insets, header wrapping, and font-size changes
// all shift these numbers, and this stays correct regardless. `reserveBelow`
// carves a fixed extra slice off the bottom for something else that needs
// to stay visible right under the frame (e.g. a collapsed section's own
// header) — a static amount, not measured, since it's sized for a fixed
// piece of UI rather than variable content. `heightScale` (e.g. 0.95) then
// shrinks that result by a flat percentage — since flex-1 children split
// this height evenly, that's an easy way to make each of them a bit
// shorter across the board without touching their own padding/gaps.
export default function FullHeightFrame({
  children,
  className,
  reserveBelow = 0,
  heightScale = 1,
}: {
  children: React.ReactNode;
  className?: string;
  reserveBelow?: number;
  heightScale?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    function compute() {
      if (!ref.current) return;
      const top = ref.current.getBoundingClientRect().top;
      const bottomNav = document.getElementById("bottom-nav");
      const bottomNavHeight = bottomNav?.getBoundingClientRect().height ?? 0;
      const available = (window.innerHeight - top - bottomNavHeight - reserveBelow) * heightScale;
      setHeight(Math.max(0, available));
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [reserveBelow, heightScale]);

  return (
    <div ref={ref} className={`flex min-h-0 flex-col overflow-hidden ${className ?? ""}`} style={height != null ? { height } : undefined}>
      {children}
    </div>
  );
}
