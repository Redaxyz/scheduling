"use client";

import { useWhoAmI } from "@/lib/whoami";
import type { MyScheduleCell, MyScheduleRow } from "@/lib/schedule";
import { HALVES, HALF_LABELS, OFFICE_LABELS, WEEKDAY_LABELS, type Role } from "@/lib/types";
import { OFFICE_COLOR } from "@/lib/colors";
import { formatShort, todayStr, weekdayIndex } from "@/lib/date";

const ROLE_LABEL: Record<Role, string> = {
  SCRIBE: "Scribe",
  ROOMING: "Rooming",
  XRAY: "X-ray",
};

// Germantown's near-black background needs light text throughout; Bethesda
// stays white with the page's normal dark text (plus a border, since white
// on white would otherwise vanish).
function HalfBox({ half, cell }: { half: (typeof HALVES)[number]; cell: MyScheduleCell }) {
  const dark = cell.office === "GERMANTOWN";
  const light = cell.office === "BETHESDA";

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg p-1.5 text-center ${light ? "border border-slate-300" : ""} ${dark ? "text-white" : ""}`}
      style={cell.office ? { background: OFFICE_COLOR[cell.office] } : undefined}
    >
      <div className={`text-[10px] font-bold uppercase tracking-wide ${dark ? "text-white/50" : "opacity-40"}`}>{HALF_LABELS[half]}</div>
      {cell.isProvider && cell.office ? (
        <>
          <div className="text-sm font-extrabold sm:text-base">{OFFICE_LABELS[cell.office]}</div>
          <div className={`text-xs font-bold sm:text-sm ${dark ? "text-white/70" : "opacity-70"}`}>
            Seeing patients{cell.scribeName ? ` — ${cell.scribeName} scribing` : ""}
          </div>
          {cell.lateMinutes ? (
            <div className={`text-xs font-bold ${dark ? "text-amber-400" : "text-amber-700"}`}>{cell.lateMinutes}m late</div>
          ) : null}
        </>
      ) : cell.office && cell.role ? (
        <>
          <div className="text-sm font-extrabold sm:text-base">{OFFICE_LABELS[cell.office]}</div>
          <div className={`text-xs font-bold sm:text-sm ${dark ? "text-white/70" : "opacity-70"}`}>
            {cell.role === "SCRIBE" ? `Scribe for ${cell.providerName}` : ROLE_LABEL[cell.role]}
          </div>
          {cell.lateMinutes ? (
            <div className={`text-xs font-bold ${dark ? "text-amber-400" : "text-amber-700"}`}>{cell.lateMinutes}m late</div>
          ) : null}
          {cell.isOut && cell.coveringName && (
            <div className={`text-xs font-bold ${dark ? "text-amber-400" : "text-amber-700"}`}>
              You&apos;re out — covered by {cell.coveringName}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold opacity-25">—</span>
          {cell.isOut && <span className="text-xs font-bold text-red-500">Out</span>}
        </div>
      )}
    </div>
  );
}

// Only ever renders the signed-in person's own row — nobody else's schedule
// is reachable from this view, by design (see getWeekScheduleForAllStaff).
// The 5 day-rows are flex-1, so together they always exactly fill whatever
// height FullHeightFrame (in the page) hands down — no more, no less, no
// scrolling either way.
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
    <div className="flex h-full min-h-0 flex-col gap-1">
      {row.days.map((day) => (
        <div
          key={day.date}
          className={`flex min-h-0 flex-1 items-stretch gap-1.5 rounded-xl border-2 p-1 ${
            day.date === today ? "border-amber-300 accent-bg-softer" : "accent-border-soft"
          }`}
        >
          <div className="flex w-12 shrink-0 flex-col items-center justify-center text-center">
            <div className="text-xs font-extrabold tracking-tight">{WEEKDAY_LABELS[weekdayIndex(day.date)!].slice(0, 3)}</div>
            <div className="text-[10px] font-bold opacity-40">{formatShort(day.date)}</div>
          </div>
          <div className="flex min-h-0 flex-1 gap-1">
            {HALVES.map((half) => (
              <HalfBox key={half} half={half} cell={day.halves[half]} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
