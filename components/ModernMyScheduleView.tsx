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

// Same office-identity fill as the modern Home page, carried down to a
// single person's week: a half you're at Bethesda for is a literal white
// panel, Germantown a literal near-black one, edge to edge — no card, no
// padding gutter, no empty space. A half with nothing at all still gets a
// filled (just neutral) panel instead of a blank hole in the layout.
function HalfPanel({ half, cell }: { half: (typeof HALVES)[number]; cell: MyScheduleCell }) {
  const dark = cell.office === "GERMANTOWN";
  const light = cell.office === "BETHESDA";
  const blank = !cell.office;

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col justify-center gap-1 px-4 py-3 sm:px-8 ${dark ? "text-white" : light ? "text-slate-900" : "text-slate-400"}`}
      style={{ background: cell.office ? OFFICE_COLOR[cell.office] : "#eef1f3" }}
    >
      <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${dark ? "text-white/40" : light ? "text-slate-400" : "text-slate-400"}`}>
        {HALF_LABELS[half]}
      </div>
      {cell.isProvider && cell.office ? (
        <>
          <div className="text-lg font-black uppercase tracking-tight sm:text-xl">{OFFICE_LABELS[cell.office]}</div>
          <div className={`text-xs font-bold sm:text-sm ${dark ? "text-white/70" : "opacity-70"}`}>
            Seeing patients{cell.scribeName ? ` — ${cell.scribeName} scribing` : ""}
          </div>
          {cell.lateMinutes ? (
            <div className={`text-xs font-bold ${dark ? "text-amber-400" : "text-amber-700"}`}>{cell.lateMinutes}m late</div>
          ) : null}
        </>
      ) : cell.office && cell.role ? (
        <>
          <div className="text-lg font-black uppercase tracking-tight sm:text-xl">{OFFICE_LABELS[cell.office]}</div>
          <div className={`text-xs font-bold sm:text-sm ${dark ? "text-white/70" : "opacity-70"}`}>
            {cell.role === "SCRIBE" ? `Scribe for ${cell.providerName}` : ROLE_LABEL[cell.role]}
          </div>
          {cell.lateMinutes ? (
            <div className={`text-xs font-bold ${dark ? "text-amber-400" : "text-amber-700"}`}>{cell.lateMinutes}m late</div>
          ) : null}
          {cell.isOut && cell.coveringName && (
            <div className={`text-xs font-bold ${dark ? "text-amber-400" : "text-amber-700"}`}>You&apos;re out — covered by {cell.coveringName}</div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold opacity-30">—</span>
          {cell.isOut && <span className="text-xs font-bold text-red-500">Out</span>}
        </div>
      )}
    </div>
  );
}

// Full-bleed, edge-to-edge weekly strip — same "no boxes, no wasted space"
// language as the modern Home page. Each day is a full-width row (its own
// slim navy label gutter, then two color-filled AM/PM panels); rows are
// flex-1 so all 5 always exactly fill whatever height FullHeightFrame hands
// down, same guarantee the classic view makes.
export default function ModernMyScheduleView({ rows }: { rows: MyScheduleRow[] }) {
  const { current, ready } = useWhoAmI();

  if (!ready) return null;

  if (!current) {
    return <p className="p-4 text-sm font-bold opacity-50">Pick your name (top right) to see your schedule.</p>;
  }

  const row = rows.find((r) => r.staffId === current.id);
  if (!row) {
    return <p className="p-4 text-sm font-bold opacity-50">No schedule data found for {current.name}.</p>;
  }

  const today = todayStr();

  // No escape-the-container trick needed here — the switcher that renders
  // this already wraps it in a full-bleed parent (see
  // MyScheduleViewSwitcher), so this just fills whatever width it's given.
  return (
    <div className="flex h-full min-h-0 flex-col">
      {row.days.map((day) => {
        const isToday = day.date === today;
        return (
          <div key={day.date} className={`flex min-h-0 flex-1 items-stretch ${isToday ? "ring-2 ring-inset ring-[var(--cao-orange,#f5871f)]" : ""}`}>
            <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 bg-[var(--cao-navy,#333f4c)] text-center text-white sm:w-24">
              <div className="text-xs font-black uppercase tracking-wide sm:text-sm">{WEEKDAY_LABELS[weekdayIndex(day.date)!].slice(0, 3)}</div>
              <div className="text-[10px] font-bold text-white/50 sm:text-xs">{formatShort(day.date)}</div>
            </div>
            <div className="flex min-h-0 flex-1">
              {HALVES.map((half) => (
                <HalfPanel key={half} half={half} cell={day.halves[half]} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
