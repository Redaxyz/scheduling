"use client";

import { useRouter } from "next/navigation";
import { nearestBusinessDayOnOrAfter, nextBusinessDay, previousBusinessDay } from "@/lib/date";

export default function ScheduleDateNav({ date }: { date: string }) {
  const router = useRouter();

  function go(d: string) {
    router.push(`/schedule/${d}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => go(previousBusinessDay(date))}
        aria-label="Previous day"
        title="Previous day"
        className="accent-border flex h-8 w-8 items-center justify-center rounded-full border-2 font-bold transition active:scale-95"
      >
        ←
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => {
          // The native picker has no way to disable Saturdays/Sundays
          // outright, so a weekend pick is rounded forward to the Monday
          // after it instead of just letting the clinic-closed page load.
          if (e.target.value) go(nearestBusinessDayOnOrAfter(e.target.value));
        }}
        className="accent-border rounded-full border-2 bg-transparent px-4 py-1.5 text-sm font-bold outline-none"
      />
      <button
        type="button"
        onClick={() => go(nextBusinessDay(date))}
        aria-label="Next day"
        title="Next day"
        className="accent-border flex h-8 w-8 items-center justify-center rounded-full border-2 font-bold transition active:scale-95"
      >
        →
      </button>
    </div>
  );
}
