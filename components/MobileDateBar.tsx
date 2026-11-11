"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  calendarMonthOf,
  easternToday,
  firstOfMonth,
  formatMonthLabel,
  mondayOf,
  nearestBusinessDayOnOrAfter,
  weekDates,
} from "@/lib/date";

// What a date picked from the calendar gets rounded to before navigating:
// the day itself (Home), the Monday of its week, or the 1st of its month.
type Snap = "day" | "week" | "month";

function snapDate(picked: string, snap: Snap): string {
  if (snap === "month") return calendarMonthOf(nearestBusinessDayOnOrAfter(picked));
  const day = nearestBusinessDayOnOrAfter(picked);
  return snap === "week" ? mondayOf(day) : day;
}

// Mon–Fri rows covering every weekday of the calendar month.
function monthRows(month: string): string[][] {
  const last = addDays(addMonths(month, 1), -1);
  const rows: string[][] = [];
  for (let monday = mondayOf(nearestBusinessDayOnOrAfter(month)); monday <= last; monday = addDays(monday, 7)) {
    rows.push(weekDates(monday));
  }
  return rows;
}

// The date as stacked lines for the Duo's side strip: "11/9", "–", "11/13"
// for a week; "11/11" for a day; "11/26" (month/year) for a month.
function numeric(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d}`;
}
function stripLabel(value: string, snap: Snap): string[] {
  if (snap === "day") return [numeric(value)];
  if (snap === "week") {
    const monday = mondayOf(nearestBusinessDayOnOrAfter(value));
    return [numeric(monday), "–", numeric(addDays(monday, 4))];
  }
  const [y, m] = value.split("-");
  return [`${Number(m)}/${y.slice(2)}`];
}

const PANEL_GAP = 8;
const PANEL_MAX_WIDTH = 320;

// The app's own month calendar, opening upward from the date bar. The
// phone's native date picker anchors itself below whatever opened it, which
// down here put it off the bottom of the screen.
function CalendarPanel({ value, snap, anchor, onPick, onClose }: { value: string; snap: Snap; anchor: HTMLElement; onPick: (date: string) => void; onClose: () => void }) {
  const [month, setMonth] = useState(firstOfMonth(value));
  const [position, setPosition] = useState<{ left: number; bottom: number; width: number } | null>(null);
  const today = easternToday();
  const valueWeek = mondayOf(nearestBusinessDayOnOrAfter(value));

  useLayoutEffect(() => {
    function place() {
      const rect = anchor.getBoundingClientRect();
      if (document.documentElement.dataset.dock === "side") {
        // Up in the Duo's side strip: open to its left, bottoms lined up.
        const width = Math.min(PANEL_MAX_WIDTH, rect.left - 2 * PANEL_GAP);
        setPosition({ left: rect.left - PANEL_GAP - width, bottom: Math.max(PANEL_GAP, window.innerHeight - rect.bottom), width });
        return;
      }
      const width = Math.min(PANEL_MAX_WIDTH, window.innerWidth - 2 * PANEL_GAP);
      const left = Math.min(Math.max(PANEL_GAP, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - PANEL_GAP);
      setPosition({ left, bottom: window.innerHeight - rect.top + PANEL_GAP, width });
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const monthArrow = "flex h-9 w-9 items-center justify-center rounded-full text-base font-bold hover:bg-slate-900/5 active:bg-slate-900/10";

  return createPortal(
    // The backdrop catches a tap anywhere else, closing the calendar
    // instead of pressing whatever is underneath.
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {position && (
        <div
          role="dialog"
          aria-label="Choose a date"
          onClick={(e) => e.stopPropagation()}
          className="nav-surface accent-border fixed rounded-2xl border-2 p-3 text-slate-800"
          style={{ left: position.left, bottom: position.bottom, width: position.width }}
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))} className={monthArrow}>
              ←
            </button>
            <span className="text-sm font-extrabold">{formatMonthLabel(month)}</span>
            <button type="button" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))} className={monthArrow}>
              →
            </button>
          </div>
          <div className="grid grid-cols-5 gap-1 text-center">
            {["M", "T", "W", "Th", "F"].map((d) => (
              <span key={d} className="pb-1 text-[10px] font-bold uppercase tracking-wider opacity-40">
                {d}
              </span>
            ))}
            {monthRows(month).map((row) =>
              row.map((date) => {
                const inMonth = firstOfMonth(date) === month;
                const selected = snap === "day" ? date === value : snap === "week" && mondayOf(date) === valueWeek;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => onPick(date)}
                    aria-current={date === today ? "date" : undefined}
                    className={`h-10 rounded-lg text-sm font-bold transition-colors ${
                      selected ? "bg-slate-900 text-white" : "hover:bg-[color-mix(in_srgb,var(--theme-accent)_18%,white)]"
                    } ${inMonth ? "" : "opacity-35"} ${date === today && !selected ? "accent-border border-2" : ""}`}
                  >
                    {Number(date.slice(8))}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

// The date navigation at the bottom of the screen: ← the current
// day/week/month (tap it to pick any date) →, in the same slanted-trapezoid
// buttons as the rest of the app's date controls (.skew-btn in
// globals.css). On a phone it sits directly on top of the dock; on a
// computer and the unfolded iPhone Duo it sits beside the dock in one row
// (see BottomNav). Tablets keep the controls in each page's header instead,
// so this renders nothing visible there.
//
// It doesn't position itself: it portals into the slot BottomNav keeps next
// to the dock, so the two are laid out — and measured by everything that
// sizes itself to the space above them — as a single block.
export default function MobileDateBar({
  label,
  value,
  basePath,
  snap,
  prevHref,
  nextHref,
  prevLabel,
  nextLabel,
}: {
  label: string;
  // The date the picker opens on (YYYY-MM-DD).
  value: string;
  // A picked date is appended to this, e.g. "/calendar/staff/week/".
  basePath: string;
  snap: Snap;
  prevHref: string;
  nextHref: string;
  prevLabel: string;
  nextLabel: string;
}) {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => setSlot(document.getElementById("date-nav-slot")), []);

  if (!slot) return null;

  // One slanted track split into three — ← | date | → — on the same
  // frosted surface, with the same accent border and height as the dock,
  // so the two read as a matched pair. A press lights a segment with the
  // same tint the dock uses for its active tab.
  const segClass = "skew-seg transition-colors active:bg-[color-mix(in_srgb,var(--theme-accent)_30%,white)]";
  const arrowClass = `${segClass} w-12 shrink-0 text-base side-dock:h-11 side-dock:w-full side-dock:text-lg hover:bg-[color-mix(in_srgb,var(--theme-accent)_14%,white)]`;
  const divider = <span aria-hidden className="my-2.5 w-0.5 shrink-0 rounded-full side-dock:mx-2.5 side-dock:my-0 side-dock:h-0.5 side-dock:w-auto bg-[color-mix(in_srgb,var(--theme-accent)_40%,#cbd5e1)]" />;

  // The outer wrapper is a transparent "buffer zone": a band a bit taller
  // than the buttons that swallows taps. A near-miss lands here and does
  // nothing, instead of falling through to whatever cell is scrolled
  // underneath.
  return createPortal(
    <div
      className="hidden px-2 pb-1.5 pt-3 phone:block dockrow:block dockrow:px-0 dockrow:py-2.5 side-dock:flex side-dock:min-h-0 side-dock:justify-center side-dock:p-0"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={trackRef}
        className="skew-track nav-surface accent-border mx-auto flex h-11 w-full max-w-md items-stretch border-2 font-bold text-slate-800 dockrow:h-12 side-dock:h-auto side-dock:min-h-0 side-dock:w-[calc(100%-0.375rem)] side-dock:flex-col side-dock:rounded-xl side-dock:[transform:none]"
      >
        <Link href={prevHref} aria-label={prevLabel} title={prevLabel} className={arrowClass}>
          <span className="skew-label">←</span>
        </Link>
        {divider}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`${segClass} min-w-0 flex-1 side-dock:min-h-0 side-dock:overflow-hidden side-dock:py-2 hover:bg-[color-mix(in_srgb,var(--theme-accent)_14%,white)]`}
        >
          {/* .skew-label sets display itself, so the row layout lives on an
              inner span. */}
          <span className="skew-label min-w-0 px-3 text-sm side-dock:hidden">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate">{label}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0 opacity-40 side-dock:hidden">
                <path d="m6 9.5 6 6 6-6" />
              </svg>
            </span>
          </span>
          {/* In the Duo's narrow side strip: just the numbers, stacked. */}
          <span className="hidden flex-col items-center text-sm leading-tight side-dock:flex">
            {stripLabel(value, snap).map((line, i) => (
              <span key={i}>{line}</span>
            ))}
          </span>
        </button>

        {divider}
        <Link href={nextHref} aria-label={nextLabel} title={nextLabel} className={arrowClass}>
          <span className="skew-label">→</span>
        </Link>
      </div>
      {open && trackRef.current && (
        <CalendarPanel
          value={value}
          snap={snap}
          anchor={trackRef.current}
          onClose={() => setOpen(false)}
          onPick={(date) => {
            setOpen(false);
            router.push(`${basePath}${snapDate(date, snap)}`);
          }}
        />
      )}
    </div>,
    slot
  );
}
