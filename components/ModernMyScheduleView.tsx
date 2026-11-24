"use client";

import { useWhoAmI } from "@/lib/whoami";
import type { MyScheduleCell, MyScheduleRow } from "@/lib/schedule";
import { HALVES, HALF_LABELS, OFFICE_LABELS, WEEKDAY_LABELS, type Role } from "@/lib/types";
import { OFFICE_COLOR } from "@/lib/colors";
import { useHoliday } from "@/components/HolidayProvider";
import { officeIsDark } from "@/lib/holidayTheme";
import { BIRTHDAY_CAKE, BIRTHDAY_FILL, isBirthday } from "@/lib/birthdays";
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
function HalfPanel({ half, cell, birthday }: { half: (typeof HALVES)[number]; cell: MyScheduleCell; birthday: boolean }) {
  // Which offices are dark depends on the holiday theme (lib/holidayTheme.ts);
  // on your birthday your working halves are pink and blue (lib/birthdays.ts).
  const holiday = useHoliday();
  const party = birthday && Boolean(cell.office);
  const dark = cell.office && !party ? officeIsDark(holiday, cell.office) : false;
  const light = Boolean(cell.office) && !dark;
  const blank = !cell.office;

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col justify-center gap-1 px-4 py-3 sm:px-8 ${dark ? "text-white" : light ? "text-slate-900" : "text-slate-400"} ${
        // On the iPhone Duo the afternoon column meets the status bar strip.
        half === "PM" && cell.office ? (dark ? "strip-dark-beside" : "strip-light-beside") : ""
      }`}
      style={{
        backgroundColor: cell.office ? OFFICE_COLOR[cell.office] : "var(--off-bg)",
        // A holiday theme's texture over the office color (lib/holidayTheme.ts),
        // or the birthday colors with confetti.
        backgroundImage: party
          ? `var(--bday-pattern, none), ${BIRTHDAY_FILL}`
          : cell.office
            ? `var(--${cell.office === "GERMANTOWN" ? "gt" : "bt"}-pattern, none)`
            : undefined,
      }}
    >
      {cell.isProvider && cell.office ? (
        <>
          <div className="text-lg font-black uppercase tracking-tight sm:text-xl">
            {OFFICE_LABELS[cell.office]}
            {party && <span aria-label="your birthday"> {BIRTHDAY_CAKE}</span>}
          </div>
          <div className={`text-xs font-bold sm:text-sm ${dark ? "text-white/70" : "opacity-70"}`}>
            Seeing patients{cell.scribeName ? ` — ${cell.scribeName} scribing` : ""}
          </div>
          {cell.lateMinutes ? (
            <div className={`text-xs font-bold ${dark ? "text-amber-400" : "text-amber-700"}`}>{cell.lateMinutes}m late</div>
          ) : null}
        </>
      ) : cell.office && cell.role ? (
        <>
          <div className="text-lg font-black uppercase tracking-tight sm:text-xl">
            {OFFICE_LABELS[cell.office]}
            {party && <span aria-label="your birthday"> {BIRTHDAY_CAKE}</span>}
          </div>
          <div className={`text-xs font-bold sm:text-sm ${dark ? "text-white/70" : "opacity-70"}`}>
            {cell.role === "SCRIBE" ? `Scribe for ${cell.providerName}` : ROLE_LABEL[cell.role]}
          </div>
          {cell.timing ? (
            <div className={`text-xs font-bold ${dark ? "text-amber-400" : "text-amber-700"}`}>{cell.timing}</div>
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
      {/* Morning over the left column, Afternoon over the right, once for
          the whole week rather than inside every panel. */}
      <div className="flex shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
        <div className="w-16 shrink-0 sm:w-24" />
        {HALVES.map((half) => (
          <div key={half} className="flex-1 px-4 pb-1.5 sm:px-8">
            {HALF_LABELS[half]}
          </div>
        ))}
      </div>
      {row.days.map((day) => {
        const isToday = day.date === today;
        return (
          <div key={day.date} className={`flex min-h-0 flex-1 items-stretch ${isToday ? "ring-2 ring-inset ring-[var(--theme-accent)]" : ""}`}>
            <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 bg-slate-700 text-center text-white sm:w-24">
              <div className="text-xs font-black uppercase tracking-wide sm:text-sm">{WEEKDAY_LABELS[weekdayIndex(day.date)!].slice(0, 3)}</div>
              <div className="text-[10px] font-bold text-white/50 sm:text-xs">{formatShort(day.date)}</div>
            </div>
            <div className="flex min-h-0 flex-1">
              {HALVES.map((half) => (
                <HalfPanel key={half} half={half} cell={day.halves[half]} birthday={isBirthday(current.name, day.date)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
