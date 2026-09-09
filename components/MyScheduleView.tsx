"use client";

import { useWhoAmI } from "@/lib/whoami";
import type { MyScheduleRow } from "@/lib/schedule";
import { HALVES, HALF_LABELS, OFFICE_LABELS, WEEKDAY_LABELS, type Role } from "@/lib/types";
import { formatShort, todayStr } from "@/lib/date";

const ROLE_LABEL: Record<Role, string> = {
  SCRIBE: "Scribe",
  ROOMING: "Rooming",
  XRAY: "X-ray",
};

// Only ever renders the signed-in person's own row — nobody else's schedule
// is reachable from this view, by design (see getWeekScheduleForAllStaff).
export default function MyScheduleView({ rows }: { rows: MyScheduleRow[] }) {
  const { current, ready } = useWhoAmI();

  if (!ready) return null;

  if (!current) {
    return (
      <p className="accent-border-soft rounded-2xl border-2 p-4 font-bold opacity-50">
        Pick your name (top right) to see your schedule.
      </p>
    );
  }

  const row = rows.find((r) => r.staffId === current.id);
  if (!row) {
    return (
      <p className="accent-border-soft rounded-2xl border-2 p-4 font-bold opacity-50">
        No schedule data found for {current.name}.
      </p>
    );
  }

  const today = todayStr();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
      {row.days.map((day) => (
        <div
          key={day.date}
          className={`rounded-2xl border-2 p-3 ${day.date === today ? "border-amber-300 accent-bg-softer" : "accent-border-soft"}`}
        >
          <div className="mb-2 text-center">
            <div className="text-sm font-extrabold tracking-tight">{WEEKDAY_LABELS[day.weekday]}</div>
            <div className="text-xs font-bold opacity-40">{formatShort(day.date)}</div>
          </div>
          <div className="space-y-2">
            {HALVES.map((half) => {
              const cell = day.halves[half];
              return (
                <div key={half} className="accent-border-soft rounded-xl border-2 p-2">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-40">{HALF_LABELS[half]}</div>
                  {cell.office && cell.role ? (
                    <div className="text-sm">
                      <div className="font-extrabold">{OFFICE_LABELS[cell.office]}</div>
                      <div className="font-bold opacity-70">
                        {cell.role === "SCRIBE" ? `Scribe for ${cell.providerName}` : ROLE_LABEL[cell.role]}
                        {cell.lateMinutes ? ` (${cell.lateMinutes}m late)` : ""}
                      </div>
                      {cell.isOut && (
                        <div className="mt-1 text-xs font-bold text-amber-700">You&apos;re out — covered by {cell.coveringName}</div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-bold opacity-25">—</div>
                      {cell.isOut && <div className="text-xs font-bold text-red-500">Out</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
