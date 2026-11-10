"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { calendarMonthOf, mondayOf, nearestBusinessDayOnOrAfter } from "@/lib/date";

// What a date picked from the calendar gets rounded to before navigating:
// the day itself (Home), the Monday of its week, or the 1st of its month.
// Weekends roll forward to Monday first, same as everywhere else — the
// native picker can't disable them.
type Snap = "day" | "week" | "month";

function snapDate(picked: string, snap: Snap): string {
  if (snap === "month") return calendarMonthOf(nearestBusinessDayOnOrAfter(picked));
  const day = nearestBusinessDayOnOrAfter(picked);
  return snap === "week" ? mondayOf(day) : day;
}

// The date navigation at the bottom of the screen: ← the current
// day/week/month (tap it to pick any date) →, in the same slanted-trapezoid
// buttons as the rest of the app's date controls (.skew-btn in
// globals.css). On a phone it sits directly on top of the dock; on a
// computer and the unfolded iPhone Duo it sits beside the dock in one row
// (see BottomNav). Tablets keep the controls in each page's header instead,
// so this renders nothing visible there.
//
// It doesn't position itself: it portals into the slot BottomNav keeps next
// to the dock, so the two are laid out — and measured by everything that
// sizes itself to the space above them — as a single block.
export default function MobileDateBar({
  label,
  value,
  basePath,
  snap,
  prevHref,
  nextHref,
  prevLabel,
  nextLabel,
}: {
  label: string;
  // The date the picker opens on (YYYY-MM-DD).
  value: string;
  // A picked date is appended to this, e.g. "/calendar/staff/week/".
  basePath: string;
  snap: Snap;
  prevHref: string;
  nextHref: string;
  prevLabel: string;
  nextLabel: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => setSlot(document.getElementById("date-nav-slot")), []);

  if (!slot) return null;

  // One slanted track split into three — ← | date | → — on the same
  // frosted surface, with the same accent border and height as the dock,
  // so the two read as a matched pair. A press lights a segment with the
  // same tint the dock uses for its active tab.
  const segClass = "skew-seg transition-colors active:bg-[color-mix(in_srgb,var(--theme-accent)_30%,white)]";
  const arrowClass = `${segClass} w-12 shrink-0 text-base hover:bg-[color-mix(in_srgb,var(--theme-accent)_14%,white)]`;
  const divider = <span aria-hidden className="my-2.5 w-0.5 shrink-0 rounded-full bg-[color-mix(in_srgb,var(--theme-accent)_40%,#cbd5e1)]" />;

  // The outer wrapper is a transparent "buffer zone": a band a bit taller
  // than the buttons that swallows taps. A near-miss lands here and does
  // nothing, instead of falling through to whatever cell is scrolled
  // underneath.
  return createPortal(
    <div
      className="hidden px-2 pb-1.5 pt-3 phone:block dockrow:block dockrow:shrink-0 dockrow:px-0 dockrow:py-2.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="skew-track nav-surface accent-border mx-auto flex h-11 w-full max-w-md items-stretch border-2 font-bold text-slate-800 dockrow:h-12 dockrow:w-80">
        <Link href={prevHref} aria-label={prevLabel} title={prevLabel} className={arrowClass}>
          <span className="skew-label">←</span>
        </Link>
        {divider}

        {/* The label is the button. The real control is a native date input
            stretched invisibly over it: tapping it is what opens the
            picker on iOS. Browsers that only open theirs from the little
            calendar icon get an explicit showPicker() instead. */}
        <div className={`${segClass} relative min-w-0 flex-1 hover:bg-[color-mix(in_srgb,var(--theme-accent)_14%,white)]`}>
          {/* .skew-label sets display itself, so the row layout lives on an
              inner span. */}
          <span className="skew-label min-w-0 px-3 text-sm">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate">{label}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0 opacity-40">
                <path d="m6 9.5 6 6 6-6" />
              </svg>
            </span>
          </span>
          <input
            ref={inputRef}
            type="date"
            value={value}
            aria-label="Choose a date"
            onClick={() => {
              try {
                inputRef.current?.showPicker?.();
              } catch {
                // Already open, or not allowed here — the native tap handles it.
              }
            }}
            onChange={(e) => {
              if (e.target.value) router.push(`${basePath}${snapDate(e.target.value, snap)}`);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
          />
        </div>

        {divider}
        <Link href={nextHref} aria-label={nextLabel} title={nextLabel} className={arrowClass}>
          <span className="skew-label">→</span>
        </Link>
      </div>
    </div>,
    slot
  );
}
