"use client";

import { useRouter } from "next/navigation";
import { nearestBusinessDayOnOrAfter, nextBusinessDay, previousBusinessDay } from "@/lib/date";

export default function ScheduleDateNav({ date }: { date: string }) {
  const router = useRouter();

  function go(d: string) {
    router.push(`/schedule/${d}`);
  }

  // Same slanted-trapezoid button family as the calendar tab's nav
  // controls (see .skew-btn/.skew-label in globals.css) — one shared
  // visual language for "go to a different day/week" everywhere.
  const btnClass = "skew-btn accent-border h-8 w-9 border-2 font-bold transition active:scale-95";

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => go(previousBusinessDay(date))} aria-label="Previous day" title="Previous day" className={btnClass}>
        <span className="skew-label">←</span>
      </button>
      {/* A native <input type="date"> can't have its own background/border
          skewed without also slanting the text/icon rendered inside it —
          so the trapezoid shape lives on this wrapper (matching the arrow
          buttons) and the input itself counter-skews back upright, same
          trick as .skew-label everywhere else. */}
      <div className="skew-btn accent-border border-2">
        <input
          type="date"
          value={date}
          onChange={(e) => {
            // The native picker has no way to disable Saturdays/Sundays
            // outright, so a weekend pick is rounded forward to the Monday
            // after it instead of just letting the clinic-closed page load.
            if (e.target.value) go(nearestBusinessDayOnOrAfter(e.target.value));
          }}
          className="skew-label bg-transparent px-4 py-1.5 text-sm font-bold outline-none"
        />
      </div>
      <button type="button" onClick={() => go(nextBusinessDay(date))} aria-label="Next day" title="Next day" className={btnClass}>
        <span className="skew-label">→</span>
      </button>
    </div>
  );
}
