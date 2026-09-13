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
    <div className="flex gap-2 text-sm font-bold">
      <Link href={prevHref} className="skew-btn accent-border border-2 px-4 py-2">
        <span className="skew-label">← {prevLabel}</span>
      </Link>
      <Link href={nextHref} className="skew-btn accent-border border-2 px-4 py-2">
        <span className="skew-label">{nextLabel} →</span>
      </Link>
    </div>
  );
}
