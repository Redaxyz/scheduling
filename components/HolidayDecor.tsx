"use client";

import { useEffect, useState, type ReactElement } from "react";
import { useHoliday } from "@/components/HolidayProvider";
import { holidayTheme } from "@/lib/holidayTheme";
import type { Office } from "@/lib/types";

// Festive touches for the holiday themes (lib/holidayTheme.ts, which picks
// each holiday's garland and icons), purely
// decorative: they never take taps or space from the page.
//
// HolidayGarland: a strand across the top of every screen: autumn leaves,
// twinkling lights, or a string of emoji (eggs, hearts, lanterns...).
// HolidayIcon: a small icon beside each office's heading, cycling through a
// few that fit the holiday.

const UNITS = 64; // enough strand for the widest screen; the rest is clipped

const LEAF_COLORS = ["#c2410c", "#d97706", "#b91c1c", "#ca8a04"];

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

function BulbUnit({ i, colors }: { i: number; colors: string[] }) {
  const color = colors[i % colors.length];
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

// A small emoji hanging from the twine (Easter eggs, hearts, lanterns...).
function EmojiUnit({ i, items }: { i: number; items: string[] }) {
  return (
    <span className="relative block h-[22px] w-[34px] shrink-0">
      <svg width="34" height="22" viewBox="0 0 34 22" className="absolute inset-0" aria-hidden>
        <path d="M0 3 Q17 9 34 3" fill="none" stroke="#7c6a58" strokeWidth="1.2" />
      </svg>
      <span className="absolute left-1/2 top-[4px] -translate-x-1/2 text-[13px] leading-none" style={{ transform: `translateX(-50%) rotate(${i % 2 ? 8 : -8}deg)` }}>
        {items[i % items.length]}
      </span>
    </span>
  );
}

export function HolidayGarland() {
  const holiday = useHoliday();
  if (!holiday) return null;
  const garland = holidayTheme(holiday).garland;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 z-30 flex overflow-hidden"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      {Array.from({ length: UNITS }, (_, i) =>
        garland.kind === "lights" ? (
          <BulbUnit key={i} i={i} colors={garland.colors} />
        ) : garland.kind === "emoji" ? (
          <EmojiUnit key={i} i={i} items={garland.items} />
        ) : (
          <LeafUnit key={i} i={i} />
        ),
      )}
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

function Pumpkin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 36" className={className} aria-hidden>
      <path d="M20 9 q-1 -5 3 -7" fill="none" stroke="#4d7c0f" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M22 5 q6 -3 9 1 q-5 2 -9 -1 Z" fill="#65a30d" />
      <ellipse cx="11" cy="22" rx="8" ry="11" fill="#ea580c" />
      <ellipse cx="29" cy="22" rx="8" ry="11" fill="#ea580c" />
      <ellipse cx="20" cy="22" rx="8.5" ry="12" fill="#f97316" />
      <path d="M20 10.5 v23 M14 12 q-3 10 0 21 M26 12 q3 10 0 21" fill="none" stroke="#c2410c" strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

function Snowflake({ className }: { className?: string }) {
  const arm = "M20 20 V3 M20 8 l-4 -4 M20 8 l4 -4 M20 13 l-3 -3 M20 13 l3 -3";
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <g stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <path key={a} d={arm} transform={`rotate(${a} 20 20)`} />
        ))}
      </g>
      <circle cx="20" cy="20" r="2.4" fill="#e0f2fe" />
    </svg>
  );
}

// The drawn icons a theme can name as "svg:..." (lib/holidayTheme.ts).
const DRAWN: Record<string, (props: { className?: string }) => ReactElement> = {
  "svg:turkey": Turkey,
  "svg:pumpkin": Pumpkin,
  "svg:tree": Tree,
  "svg:snowflake": Snowflake,
};

const CYCLE_MS = 4000;

// A small holiday icon beside an office's heading, fading through that
// office's set every few seconds (Germantown half a beat after Bethesda).
// Holds on the first one for anyone whose phone asks for less motion.
export function HolidayIcon({ office, className = "h-8 w-8" }: { office: Office; className?: string }) {
  const holiday = useHoliday();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!holiday || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let interval = 0;
    const start = window.setTimeout(
      () => {
        setStep((n) => n + 1);
        interval = window.setInterval(() => setStep((n) => n + 1), CYCLE_MS);
      },
      office === "GERMANTOWN" ? CYCLE_MS * 1.5 : CYCLE_MS,
    );
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [holiday, office]);

  if (!holiday) return null;
  const glyphs = holidayTheme(holiday).icons[office];
  const active = step % glyphs.length;
  return (
    <span aria-hidden className={`relative inline-block shrink-0 ${className}`}>
      {glyphs.map((glyph, i) => {
        const Drawn = DRAWN[glyph];
        return (
          <span
            key={i}
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-700"
            style={{ opacity: i === active ? 1 : 0 }}
          >
            {Drawn ? <Drawn className="h-full w-full" /> : <span className="text-[1.6rem] leading-none sm:text-[1.8rem]">{glyph}</span>}
          </span>
        );
      })}
    </span>
  );
}
