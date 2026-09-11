"use client";

import Link from "next/link";
import { useThemeMode } from "@/lib/theme";

// Prev/next controls for the calendar tab's week and month views. Classic
// keeps the original wide text-label pills; modern swaps them for the same
// small circular gradient arrow buttons already established by the Home
// page's day nav (ScheduleDateNav) — same interaction, same hrefs, just a
// less chrome-heavy shell.
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
  const { active: modern } = useThemeMode();

  if (modern) {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href={prevHref}
          aria-label={prevLabel}
          title={prevLabel}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-95"
          style={{ background: "linear-gradient(135deg, var(--cao-blue,#1878b4), var(--cao-blue-light,#4fb3e8))" }}
        >
          ←
        </Link>
        <Link
          href={nextHref}
          aria-label={nextLabel}
          title={nextLabel}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-95"
          style={{ background: "linear-gradient(135deg, var(--cao-blue,#1878b4), var(--cao-blue-light,#4fb3e8))" }}
        >
          →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex gap-2 text-sm font-bold">
      <Link href={prevHref} className="accent-border rounded-full border-2 px-4 py-1.5">
        ← {prevLabel}
      </Link>
      <Link href={nextHref} className="accent-border rounded-full border-2 px-4 py-1.5">
        {nextLabel} →
      </Link>
    </div>
  );
}
