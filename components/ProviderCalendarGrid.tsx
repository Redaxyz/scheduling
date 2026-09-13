"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProviderCalendarRow, ProviderHalfCell } from "@/lib/calendar";
import { mondayOf, todayStr, weekdayIndex } from "@/lib/date";
import { federalHolidayName, HOLIDAY_COLOR } from "@/lib/holidays";
import { getBottomNavHeight } from "@/lib/bottomNav";
import { HALVES, HALF_LABELS, OFFICE_LABELS, type Half, type Office } from "@/lib/types";
import { useWhoAmI } from "@/lib/whoami";
import { SURGERY_COLOR, OFF_COLOR, OFFICE_COLOR } from "@/lib/colors";

// PRESENT isn't one fixed color anymore — it's whichever office the weekly
// template has them at that half (white for Bethesda, near-black for
// Germantown; see lib/colors.ts). A PRESENT half with no template office at
// all is "off duty" — a gap in the template, not a real absence — shown in
// neutral gray.
const OFF_DUTY_COLOR = "#cbd5e1";
const STATUS_LABEL = { PRESENT: "present", ABSENT: "absent", SURGERY: "in surgery" } as const;
// Click cycles office -> absent -> surgery -> back to office. Coming back to
// "office" never asks which one — a provider's office for a given weekday
// half comes from the template and doesn't change week to week, so there's
// nothing to cycle between Bethesda and Germantown.
const NEXT_STATUS = { PRESENT: "ABSENT", ABSENT: "SURGERY", SURGERY: "PRESENT" } as const;
const OFFICE_LETTER: Record<Office, string> = { BETHESDA: "B", GERMANTOWN: "G" };

// A holiday wins over everything else — office, absence, even a usual
// surgery day — so a holiday column reads as one uniform "nobody's here"
// color at a glance instead of a mix of red/blue/office depending on what
// each provider's template happened to say for that weekday.
function cellColor(cell: ProviderHalfCell, holiday: boolean): string {
  if (holiday) return HOLIDAY_COLOR;
  if (cell.status === "ABSENT") return OFF_COLOR;
  if (cell.status === "SURGERY") return SURGERY_COLOR;
  return cell.office ? OFFICE_COLOR[cell.office] : OFF_DUTY_COLOR;
}

// White-on-Bethesda (and the washed-out holiday purple) are the fills light
// enough to need dark text instead of white.
function cellTextClass(cell: ProviderHalfCell, holiday: boolean): string {
  if (holiday) return "text-slate-700";
  return cell.status === "PRESENT" && cell.office === "BETHESDA" ? "text-slate-700" : "text-white/90";
}

const WEEKDAY_LETTERS = ["M", "T", "W", "R", "F"];

// Rendered by the page itself, alongside the title/toggle/nav row, instead
// of inside the grid — see StaffLegend for why.
export function ProviderLegend() {
  const { current } = useWhoAmI();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-bold opacity-60">
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full border border-slate-300" style={{ background: OFFICE_COLOR.BETHESDA }} /> Bethesda
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: OFFICE_COLOR.GERMANTOWN }} /> Germantown
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: OFF_COLOR }} /> Absent
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SURGERY_COLOR }} /> Surgery
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: OFF_DUTY_COLOR }} /> Off duty
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: HOLIDAY_COLOR }} /> Holiday
      </span>
      {current && <span className="hidden opacity-70 lg:inline">tap AM/PM to cycle office → absent → surgery</span>}
    </div>
  );
}

async function postJSON(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json().catch(() => ({}));
}

// Same clean click-to-toggle table as the staff calendar, but split into an
// AM and PM box per date — providers don't log in themselves (so there's no
// "own row" to restrict to, anyone signed in can toggle anyone's half), and
// there are few enough of them that the extra AM/PM column doesn't get
// unreadable the way it would for the much longer staff list.
export default function ProviderCalendarGrid({
  dates,
  rows,
  dense = true,
}: {
  dates: string[];
  rows: ProviderCalendarRow[];
  dense?: boolean;
}) {
  const { current } = useWhoAmI();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const today = todayStr();
  const currentWeekMonday = mondayOf(today);

  // Rows grow to actually use whatever vertical space the window has
  // instead of sitting fixed-size with dead space below on a tall screen —
  // measured at runtime (window height down to the floating bottom nav,
  // minus the header block) and divided across the provider rows, same
  // "measure, don't guess" approach as FullHeightFrame elsewhere. Never
  // shrinks below the old fixed sizing, only grows past it.
  const containerRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const [rowPx, setRowPx] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current || rows.length === 0) return;

    function compute() {
      if (!containerRef.current || rows.length === 0) return;
      const top = containerRef.current.getBoundingClientRect().top;
      const bottomNavHeight = getBottomNavHeight();
      const headerHeight = theadRef.current?.getBoundingClientRect().height ?? 0;
      // A much bigger safety margin than a single-row measurement needs,
      // plus the same proportional shrink used for the Me tab's
      // FullHeightFrame (heightScale) — real screens still left the last
      // row peeking out from under the footer with just a fixed buffer, so
      // this trades a little unused space at the bottom for a hard
      // guarantee nothing ever sits under the nav.
      const available = (window.innerHeight - top - bottomNavHeight - headerHeight - 66) * 0.94;
      // Each <td>'s own p-1 padding (8px top+bottom) adds real height on
      // top of the button inside it — with several providers that padding
      // alone can add up to a real chunk of unaccounted-for height, so it
      // has to come out of the division, not just the button's own share.
      const rowPadPx = 8;
      setRowPx(available / rows.length - rowPadPx);
    }
    compute();

    // A plain "resize" listener only catches the window actually changing
    // size — it misses the bottom nav's own height changing for other
    // reasons. A ResizeObserver on the nav itself catches that regardless
    // of effect ordering. Deliberately NOT observing containerRef itself —
    // this effect is what sets its rows' heights, so watching it would
    // just observe its own writes and loop forever.
    const bottomNav = document.getElementById("bottom-nav");
    const ro = bottomNav ? new ResizeObserver(compute) : null;
    ro?.observe(bottomNav!);
    window.addEventListener("resize", compute);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [rows.length, dense]);

  // Matches StaffCalendarGrid's row sizes for visual consistency. Not a
  // hard floor: rows grow past this when there's spare room, and shrink
  // below it (down to a tiny tappable sliver) when there isn't quite
  // enough, so the whole roster always fits without a scrollbar.
  const niceRowPx = dense ? 20 : 34;
  const dynamicRowHeight = Math.max(2, rowPx ?? niceRowPx);

  async function toggle(providerId: string, date: string, half: Half, cell: ProviderHalfCell) {
    const key = `${providerId}:${date}:${half}`;
    const next = NEXT_STATUS[cell.status];
    setError(null);
    setPending(key);
    try {
      await postJSON("/api/absences/provider/half", "POST", { providerId, date, half, status: next });
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(null);
    }
  }

  const labelWidthClass = dense ? "w-28" : "w-24";

  return (
    <div ref={containerRef} className="accent-border-soft overflow-x-auto rounded-2xl border-2">
      {error && <p className="m-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}
      <table className="w-full border-collapse text-sm" style={{ tableLayout: "fixed", minWidth: dense ? "900px" : undefined }}>
        <thead ref={theadRef}>
          <tr>
            <th
              rowSpan={2}
              className={`accent-border-soft sticky left-0 z-10 border-b-2 border-r-2 bg-white px-3 py-2 text-left align-bottom font-extrabold tracking-tight ${labelWidthClass}`}
            >
              Provider
            </th>
            {dates.map((date) => {
              const day = Number(date.slice(-2));
              const wd = weekdayIndex(date)!;
              const holiday = federalHolidayName(date);
              const isToday = date === today;
              const inCurrentWeek = mondayOf(date) === currentWeekMonday;
              return (
                <th
                  key={date}
                  colSpan={2}
                  className={`accent-border-soft border-b-2 border-l-2 text-center font-bold ${holiday ? "" : "opacity-50"} ${dense ? "px-1 py-1 text-[10px]" : "px-1 py-1.5 text-sm"} ${
                    inCurrentWeek ? "cal-current-week" : ""
                  } ${isToday ? "cal-today-header" : ""}`}
                  style={holiday ? { color: HOLIDAY_COLOR } : undefined}
                  title={holiday ?? (isToday ? "Today" : undefined)}
                >
                  <div className="h-[10px] text-[8px] normal-case leading-[10px] opacity-80">{holiday ? "holiday" : " "}</div>
                  <div>{WEEKDAY_LETTERS[wd]}</div>
                  <div>{day}</div>
                </th>
              );
            })}
          </tr>
          <tr>
            {dates.flatMap((date) => {
              const inCurrentWeek = mondayOf(date) === currentWeekMonday;
              return HALVES.map((half) => (
                <th
                  key={`${date}-${half}`}
                  className={`accent-border-soft border-b-2 text-center text-[9px] font-bold uppercase tracking-wide opacity-40 ${half === "AM" ? "border-l-2" : ""} ${
                    inCurrentWeek ? "cal-current-week" : ""
                  }`}
                >
                  {half}
                </th>
              ));
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.providerId}>
              <td className="accent-border-soft sticky left-0 z-10 truncate border-r-2 bg-white px-3 py-1.5 font-bold">{row.name}</td>
              {dates.flatMap((date) =>
                HALVES.map((half) => {
                  const cell = row.days[date][half];
                  const key = `${row.providerId}:${date}:${half}`;
                  const officeName = cell.office ? OFFICE_LABELS[cell.office] : null;
                  const holiday = federalHolidayName(date);
                  const inCurrentWeek = mondayOf(date) === currentWeekMonday;
                  const label = holiday
                    ? `${row.name} — ${date} ${HALF_LABELS[half]}: ${holiday}`
                    : `${row.name} — ${date} ${HALF_LABELS[half]}: ${
                        cell.status === "PRESENT" && !officeName ? "off duty" : STATUS_LABEL[cell.status]
                      }${officeName ? ` at ${officeName}` : ""}${cell.fromTemplate ? " (usual surgery day)" : ""}`;
                  return (
                    <td
                      key={key}
                      className={`p-1 text-center ${half === "AM" ? "border-l-2 accent-border-soft" : ""} ${inCurrentWeek ? "cal-current-week" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(row.providerId, date, half, cell)}
                        disabled={pending === key}
                        aria-label={`${label} (tap to toggle)`}
                        title={`${label} (tap to toggle)`}
                        className="relative block w-full rounded-lg border border-slate-900/10 transition active:scale-95 disabled:opacity-40"
                        style={{ background: cellColor(cell, Boolean(holiday)), boxShadow: cell.fromTemplate ? "inset 0 0 0 2px rgba(255,255,255,0.6)" : undefined }}
                      >
                        <span
                          className={`flex w-full items-center justify-center font-extrabold ${cellTextClass(cell, Boolean(holiday))} ${dense ? "text-[9px]" : "text-xs"}`}
                          style={{ height: dynamicRowHeight }}
                        >
                          {cell.status === "PRESENT" && cell.office && !holiday ? OFFICE_LETTER[cell.office] : ""}
                        </span>
                      </button>
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
