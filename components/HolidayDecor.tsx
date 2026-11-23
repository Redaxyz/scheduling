"use client";

import { useHoliday } from "@/components/HolidayProvider";

// Festive touches for the holiday themes (lib/holidayTheme.ts), purely
// decorative: they never take taps or space from the page.
//
// HolidayGarland: a strand across the top of every screen (autumn leaves at
// Thanksgiving, twinkling lights at Christmas).
// HolidayIcon: a small turkey or tree, placed beside a heading.

const UNITS = 64; // enough strand for the widest screen; the rest is clipped

const LEAF_COLORS = ["#c2410c", "#d97706", "#b91c1c", "#ca8a04"];
const BULB_COLORS = ["#ef4444", "#22c55e", "#facc15", "#3b82f6", "#f97316"];

function LeafUnit({ i }: { i: number }) {
  const color = LEAF_COLORS[i % LEAF_COLORS.length];
  const tilt = i % 2 === 0 ? -18 : 22;
  return (
    <svg width="34" height="18" viewBox="0 0 34 18" className="shrink-0" aria-hidden>
      {/* the twine, sagging a little between leaves */}
      <path d="M0 3 Q17 9 34 3" fill="none" stroke="#7c4a1e" strokeWidth="1.2" />
      {/* a simple maple-ish leaf hanging from the middle */}
      <g transform={`translate(17 7) rotate(${tilt})`}>
        <path d="M0 0 L-5 4 L-3 5 L-6 9 L-2 8 L0 12 L2 8 L6 9 L3 5 L5 4 Z" fill={color} />
        <path d="M0 0 L0 11" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
      </g>
    </svg>
  );
}

function BulbUnit({ i }: { i: number }) {
  const color = BULB_COLORS[i % BULB_COLORS.length];
  return (
    <svg width="30" height="18" viewBox="0 0 30 18" className="shrink-0" aria-hidden>
      <path d="M0 3 Q15 9 30 3" fill="none" stroke="#1f2937" strokeWidth="1.2" />
      <rect x="13" y="5" width="4" height="3" rx="0.6" fill="#374151" />
      <ellipse
        cx="15"
        cy="12"
        rx="3.6"
        ry="5"
        fill={color}
        className="holiday-bulb"
        style={{ animationDelay: `${(i * 0.37) % 2.4}s`, filter: `drop-shadow(0 0 3px ${color})` }}
      />
    </svg>
  );
}

export function HolidayGarland() {
  const holiday = useHoliday();
  if (!holiday) return null;
  const Unit = holiday === "christmas" ? BulbUnit : LeafUnit;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 z-30 flex overflow-hidden"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      {Array.from({ length: UNITS }, (_, i) => (
        <Unit key={i} i={i} />
      ))}
    </div>
  );
}

function Turkey({ className }: { className?: string }) {
  const feathers = ["#b91c1c", "#d97706", "#ca8a04", "#c2410c", "#92400e"];
  return (
    <svg viewBox="0 0 40 36" className={className} aria-hidden>
      {/* tail fan */}
      {feathers.map((c, i) => (
        <ellipse key={i} cx="20" cy="9" rx="4.2" ry="10" fill={c} transform={`rotate(${(i - 2) * 32} 20 20)`} />
      ))}
      {/* body and head */}
      <ellipse cx="20" cy="24" rx="9" ry="9.5" fill="#7c4a1e" />
      <circle cx="20" cy="14" r="5" fill="#8b5a2b" />
      <circle cx="18.2" cy="13" r="1" fill="#111" />
      <circle cx="21.8" cy="13" r="1" fill="#111" />
      <path d="M18.6 15.2 L21.4 15.2 L20 17.4 Z" fill="#f59e0b" />
      <path d="M21 16.6 q1.6 1.2 0.6 3.4 q-1.4 -1 -0.6 -3.4 Z" fill="#dc2626" />
      {/* feet */}
      <path d="M16.5 33 l-1 2.5 M16.5 33 l0.8 2.6 M23.5 33 l-0.8 2.6 M23.5 33 l1 2.5" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function Tree({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" className={className} aria-hidden>
      <path d="M16 4 L26 18 L21 18 L29 29 L3 29 L11 18 L6 18 Z" fill="#15803d" stroke="#14532d" strokeWidth="1" strokeLinejoin="round" />
      <rect x="13.5" y="29" width="5" height="6" fill="#7c4a1e" />
      <path d="M16 0.5 l1.4 2.9 3.1 0.4 -2.3 2.1 0.6 3.1 -2.8 -1.5 -2.8 1.5 0.6 -3.1 -2.3 -2.1 3.1 -0.4 Z" fill="#facc15" />
      <circle cx="13" cy="14" r="1.5" fill="#ef4444" />
      <circle cx="19" cy="21" r="1.5" fill="#facc15" />
      <circle cx="11" cy="24" r="1.5" fill="#3b82f6" />
      <circle cx="22" cy="26" r="1.5" fill="#ef4444" />
      <circle cx="16" cy="19" r="1.3" fill="#f8fafc" />
    </svg>
  );
}

export function HolidayIcon({ className = "h-8 w-8" }: { className?: string }) {
  const holiday = useHoliday();
  if (holiday === "thanksgiving") return <Turkey className={className} />;
  if (holiday === "christmas") return <Tree className={className} />;
  return null;
}
