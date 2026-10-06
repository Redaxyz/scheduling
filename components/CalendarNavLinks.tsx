"use client";

import Link from "next/link";

// Prev/next controls for the calendar tab's week and month views — the
// same slanted-trapezoid family as CalendarWhoToggle's toggles (see
// .skew-btn/.skew-label in globals.css).
export default function CalendarNavLinks({
  prevHref,
  nextHref,
  prevLabel,
  nextLabel,
}: {
  prevHref: string;
  nextHref: string;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="flex shrink-0 gap-1.5 text-xs font-bold lg:gap-2 lg:text-sm">
      <Link href={prevHref} className="skew-btn accent-border border-2 px-3 py-2 lg:px-4">
        <span className="skew-label">
          ← <span className="lg:hidden">Previous</span>
          <span className="max-lg:hidden">{prevLabel}</span>
        </span>
      </Link>
      <Link href={nextHref} className="skew-btn accent-border border-2 px-3 py-2 lg:px-4">
        <span className="skew-label">
          <span className="lg:hidden">Next</span>
          <span className="max-lg:hidden">{nextLabel}</span> →
        </span>
      </Link>
    </div>
  );
}
