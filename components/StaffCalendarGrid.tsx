"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StaffCalendarRow, StaffDayStatus } from "@/lib/calendar";
import { effectiveMonday, effectiveScheduleDate, mondayOf, nearestBusinessDayOnOrAfter, todayStr, weekdayIndex } from "@/lib/date";
import { federalHolidayName, HOLIDAY_COLOR } from "@/lib/holidays";
import { getBottomNavHeight } from "@/lib/bottomNav";
import { useWhoAmI } from "@/lib/whoami";
import { formatLateDuration } from "@/lib/lateDuration";
import MyAbsencesList from "@/components/MyAbsencesList";

const LATE_MINUTE_OPTIONS = [15, 30, 45, 60, 90, 120];

const STATUS_COLOR: Record<StaffDayStatus, string> = {
  PRESENT: "#579669",
  ABSENT: "#dc2626",
  PARTIAL: "#d97706",
};

const STATUS_LABEL: Record<StaffDayStatus, string> = {
  PRESENT: "present",
  ABSENT: "absent",
  PARTIAL: "partial / running late",
};

const WEEKDAY_LETTERS = ["M", "T", "W", "R", "F"];

// Rendered by the page itself, alongside the title/toggle/nav row, instead
// of inside the grid — keeping it out of the grid's own vertical stack is
// what lets the page compress the whole header area into one thin band
// instead of title, then toggle/nav, then this on a third line.
export function StaffLegend() {
  const { current } = useWhoAmI();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-bold opacity-60">
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR.PRESENT }} /> Present
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR.ABSENT }} /> Absent
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR.PARTIAL }} /> Partial
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: HOLIDAY_COLOR }} /> Holiday
      </span>
      {current && (
        <span className="hidden opacity-70 lg:inline">
          tap your row to toggle{current.isManager ? " (or anyone's)" : ""}
        </span>
      )}
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

// dense=true (month view): compact boxes across many columns, built for a
// wide screen. dense=false (week view): fewer columns, larger tap targets,
// built for a thumb. Either way, a green box is a single click/tap away
// from red for whoever's allowed to touch that row — a manager can edit
// anyone's, everyone else only their own — which just flips the whole day
// present/absent. Marking yourself late (below the grid) is the only way to
// land on the third, orange state; tapping that orange box clears it the
// same way tapping a red one does.
export default function StaffCalendarGrid({
  dates,
  rows,
  dense = true,
}: {
  dates: string[];
  rows: StaffCalendarRow[];
  dense?: boolean;
}) {
  const { current } = useWhoAmI();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [lateMinutes, setLateMinutes] = useState(String(LATE_MINUTE_OPTIONS[1]));
  // Same "what day does this actually mean right now" rule used everywhere
  // else in the app (rolls to the next business day after 5pm, and treats
  // the whole weekend as Monday) — not the literal calendar day, so the
  // marker lines up with whatever the Calendar tab already defaults to.
  const today = effectiveScheduleDate();
  const currentWeekMonday = effectiveMonday();
  const [markingLate, setMarkingLate] = useState(false);
  const [showAnotherDay, setShowAnotherDay] = useState(false);
  const [anotherDate, setAnotherDate] = useState(todayStr());
  const [schedulingAnother, setSchedulingAnother] = useState(false);

  async function toggle(staffId: string, date: string, status: StaffDayStatus) {
    const key = `${staffId}:${date}`;
    setError(null);
    setPending(key);
    try {
      if (status === "PRESENT") {
        await postJSON("/api/absences/staff", "POST", { staffId, startDate: date, endDate: date, half: "ALL", reason: "" });
      } else {
        await postJSON(`/api/absences/staff/day?staffId=${staffId}&date=${date}`, "DELETE");
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(null);
    }
  }

  async function markLate() {
    if (!current) return;
    setError(null);
    setMarkingLate(true);
    try {
      await postJSON("/api/absences/staff", "POST", {
        staffId: current.id,
        startDate: todayStr(),
        endDate: todayStr(),
        half: "CUSTOM",
        lateMinutes: Number(lateMinutes),
        reason: "",
      });
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setMarkingLate(false);
    }
  }

  // Same as markLate, but for a picked date instead of always today —
  // covers a planned tardiness (a school drop-off morning, say) known
  // ahead of time rather than a same-day surprise.
  async function scheduleAnotherDay() {
    if (!current) return;
    setError(null);
    setSchedulingAnother(true);
    try {
      await postJSON("/api/absences/staff", "POST", {
        staffId: current.id,
        startDate: anotherDate,
        endDate: anotherDate,
        half: "CUSTOM",
        lateMinutes: Number(lateMinutes),
        reason: "",
      });
      setShowAnotherDay(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSchedulingAnother(false);
    }
  }

  // table-layout: fixed + w-full stretches the columns to fill the
  // container instead of hugging the content — no more empty gutter on
  // wide screens (dense/month), and on a phone (week) each day column, and
  // the box inside it, gets real width instead of a tiny centered square.
  // Box heights themselves are set inline (see dynamicBigHeight/
  // dynamicThinHeight above) rather than via fixed Tailwind classes.
  const otherCellPad = "p-px";
  const cellPad = dense ? "p-1" : "p-1";
  const labelWidthClass = dense ? "w-24" : "w-28";

  // Your own row first — no hunting for your name in an alphabetical list —
  // then everyone else in their existing order.
  const sortedRows = current
    ? [...rows].sort((a, b) => (a.staffId === current.id ? -1 : b.staffId === current.id ? 1 : 0))
    : rows;

  // Rows grow to actually use whatever vertical space the window has,
  // same runtime-measured approach as ProviderCalendarGrid — but here two
  // different row sizes coexist (a manager's own or full-roster "big" rows
  // vs everyone else's thin reference bars for a regular viewer), so extra
  // space beyond the old fixed sizing is handed out proportionally to each
  // size's existing share instead of splitting evenly across every row.
  // That keeps a non-manager's own row dramatically bigger than everyone
  // else's, exactly like today, just without the dead space below the
  // table on a tall screen.
  const containerRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const trailingRef = useRef<HTMLDivElement>(null);
  const [dynamicHeights, setDynamicHeights] = useState<{ big: number; thin: number } | null>(null);
  // On desktop the late-box/absences sidebar sits beside the grid instead
  // of below it, so it never contributes to the ROWS budget above — but a
  // manager's absences list has no natural length limit (it's everyone's,
  // not just her own) and nothing else caps its height, so it can still
  // grow taller than the viewport and force the whole page to scroll even
  // though the grid itself now fits perfectly. Capping the sidebar at the
  // same available height and letting IT scroll internally keeps the page
  // itself scroll-free either way.
  const [sidebarMaxHeight, setSidebarMaxHeight] = useState<number | null>(null);

  // Matches Tailwind's `lg` breakpoint, where the late box/absences list
  // moves from below the grid to a sidebar beside it (see the layout
  // below) — only when it's actually stacked below does its height need
  // to be budgeted out of the rows' available space.
  const DESKTOP_BREAKPOINT = 1024;

  // "Nice" target sizes — used as-is when there's room to spare (any extra
  // space beyond this gets handed out on top), but no longer a hard floor:
  // if available space is tighter than this, rows scale DOWN to exactly
  // fit instead of forcing a scrollbar. The whole point is fitting the
  // header, every row, and (on a phone, where it's stacked below) the late
  // box and absences list on one screen with nothing left to scroll.
  const niceBig = dense ? 20 : 34;
  const niceThin = dense ? 6 : 8;
  // Each <td>'s own padding (cellPad/otherCellPad below) adds real height
  // on top of the button/span inside it — for a manager, where every one
  // of 15 rows uses the bigger p-1 padding (4px top + 4px bottom), that's
  // ~120px this budget was silently missing entirely, which is exactly
  // the overflow that kept showing up. Baked into the row-height math
  // below instead of just padding the safety margin, so it scales
  // correctly regardless of how many staff there are.
  const bigPadPx = 8; // p-1 = 0.25rem top+bottom
  const thinPadPx = 2; // p-px = 1px top+bottom
  const isManagerView = current?.isManager ?? false;
  // A manager's every row is "big"; everyone else only has their own —
  // computed here (not inside the effect) so the effect can depend on
  // these two plain numbers instead of closing over the sortedRows array,
  // which is a fresh reference every render.
  const bigCount = isManagerView ? sortedRows.length : sortedRows.some((r) => r.staffId === current?.id) ? 1 : 0;
  const thinCount = sortedRows.length - bigCount;

  useEffect(() => {
    if (!containerRef.current || bigCount + thinCount === 0) return;

    function compute() {
      if (!containerRef.current) return;
      const top = containerRef.current.getBoundingClientRect().top;
      const bottomNavHeight = getBottomNavHeight();
      const headerHeight = theadRef.current?.getBoundingClientRect().height ?? 0;
      const isDesktopLayout = window.innerWidth >= DESKTOP_BREAKPOINT;
      const trailingHeight = isDesktopLayout ? 0 : (trailingRef.current?.getBoundingClientRect().height ?? 0);
      // A much bigger safety margin than a single-row measurement needs,
      // plus the same proportional shrink used for the Me tab's
      // FullHeightFrame (heightScale) — real screens still left the last
      // row peeking out from under the footer with just a fixed buffer, so
      // this trades a little unused space at the bottom for a hard
      // guarantee nothing ever sits under the nav.
      const available = (window.innerHeight - top - bottomNavHeight - headerHeight - trailingHeight - 66) * 0.94;

      // The sidebar spans the same vertical range as the grid+header
      // together (it has no header row of its own to subtract), only on
      // desktop where it's actually a sidebar rather than stacked content.
      setSidebarMaxHeight(isDesktopLayout ? available + headerHeight : null);

      // "Total" here means the whole row's footprint (button + its cell's
      // own padding) — that's what actually has to sum to `available`, not
      // just the button heights on their own.
      const niceBigTotal = niceBig + bigPadPx;
      const niceThinTotal = niceThin + thinPadPx;
      const naturalTotal = bigCount * niceBigTotal + thinCount * niceThinTotal;
      if (naturalTotal <= 0) return;
      if (available >= naturalTotal) {
        const extra = available - naturalTotal;
        setDynamicHeights({
          big: niceBig + (extra * niceBigTotal) / naturalTotal,
          thin: niceThin + (extra * niceThinTotal) / naturalTotal,
        });
      } else {
        // Not enough room even at the nice sizes — scale every row's
        // total footprint down by the same factor so the whole roster
        // still fits in one screen, floored just enough to stay a
        // visible, tappable sliver (padding included in the floor, so a
        // button height can legitimately hit 0 once the row itself is
        // basically just its padding).
        const scale = Math.max(0, available) / naturalTotal;
        setDynamicHeights({
          big: Math.max(2, niceBigTotal * scale - bigPadPx),
          thin: Math.max(2, niceThinTotal * scale - thinPadPx),
        });
      }
    }
    compute();

    // Re-measure whenever the bottom nav OR the trailing content (the late
    // box, and especially MyAbsencesList — its own async-loaded height
    // isn't known at mount time) changes size, not just on window resize.
    const bottomNav = document.getElementById("bottom-nav");
    const ro = new ResizeObserver(compute);
    if (bottomNav) ro.observe(bottomNav);
    if (trailingRef.current) ro.observe(trailingRef.current);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [bigCount, thinCount, niceBig, niceThin]);

  const dynamicBigHeight = dynamicHeights?.big ?? niceBig;
  const dynamicThinHeight = dynamicHeights?.thin ?? niceThin;

  const lateBox = current && (
    <div className="accent-border-soft flex flex-col gap-2 rounded-2xl border-2 p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold opacity-70">Running late?</span>
        <select
          value={lateMinutes}
          onChange={(e) => setLateMinutes(e.target.value)}
          className="accent-border-soft rounded-full border-2 bg-transparent px-3 py-0.5 font-bold outline-none"
        >
          {LATE_MINUTE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m < 60 ? `${m} min` : formatLateDuration(m)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={markLate}
          disabled={markingLate}
          className="accent-border rounded-full border-2 px-4 py-0.5 font-bold transition active:scale-95 disabled:opacity-40"
        >
          Mark me late today
        </button>
        <button
          type="button"
          onClick={() => setShowAnotherDay((v) => !v)}
          className="accent-border-soft rounded-full border-2 px-4 py-0.5 font-bold opacity-70 transition hover:opacity-100"
        >
          Another day
        </button>
        <span className="hidden text-xs font-bold opacity-40 sm:inline">Turns your box for today orange — tap it again to clear.</span>
      </div>

      {/* A planned tardiness (school drop-off, say) isn't always today's —
          this schedules the same CUSTOM running-late note for any picked
          weekday instead of only right now. */}
      {showAnotherDay && (
        <div className="accent-border-soft flex flex-wrap items-center gap-2 border-t-2 pt-2">
          <input
            type="date"
            value={anotherDate}
            onChange={(e) => {
              if (e.target.value) setAnotherDate(nearestBusinessDayOnOrAfter(e.target.value));
            }}
            className="accent-border-soft rounded-full border-2 bg-transparent px-3 py-0.5 text-xs font-bold outline-none"
          />
          <button
            type="button"
            onClick={scheduleAnotherDay}
            disabled={schedulingAnother}
            className="accent-border rounded-full border-2 px-4 py-0.5 font-bold transition active:scale-95 disabled:opacity-40"
          >
            Schedule
          </button>
        </div>
      )}
    </div>
  );

  // No full-bleed wrapper of its own — the page wraps its whole header
  // (title/toggle/nav/legend) AND this grid together in one full-bleed
  // block, so they expand to use the wide desktop screen in lockstep
  // instead of a full-width grid sitting under a narrower header. Grid and
  // the late-box/absences sidebar sit side by side once there's room
  // (lg:), stacked with the sidebar below on a phone.
  return (
    <>
      {error && <p className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div ref={containerRef} className="accent-border-soft overflow-x-auto rounded-2xl border-2 lg:flex-1">
            <table
              className="w-full border-collapse text-sm"
              style={{ tableLayout: "fixed", minWidth: dense ? "800px" : undefined }}
            >
              <thead ref={theadRef} className="sticky top-0 z-20">
                <tr>
                  <th
                    className={`accent-border-soft sticky left-0 z-30 border-b-2 border-r-2 bg-white px-3 py-1 text-left font-extrabold tracking-tight ${labelWidthClass}`}
                  >
                    Staff
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
                        className={`accent-border-soft border-b-2 text-center font-bold ${holiday ? "" : "opacity-50"} ${dense ? "px-1 py-1 text-[10px]" : "px-1 py-1 text-sm"} ${
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
              </thead>
              <tbody>
                {sortedRows.map((row) => {
                  const isMe = current?.id === row.staffId;
                  const editable = Boolean(current) && (isManagerView || isMe);
                  // A manager can adjust anyone's row, so nobody's is "just for
                  // reference" the way it is for everyone else — keep every row
                  // full-size for her instead of shrinking everyone but herself.
                  const isBig = isMe || isManagerView;
                  const rowBoxHeight = isBig ? dynamicBigHeight : dynamicThinHeight;
                  const rowCellPad = isBig ? cellPad : otherCellPad;
                  return (
                    <tr key={row.staffId} className={isMe ? "accent-bg-softer" : ""}>
                      <td
                        className={`accent-border-soft sticky left-0 z-10 truncate border-r-2 bg-white px-3 font-bold ${
                          isBig ? "py-1.5 text-base" : "py-0 text-[10px] leading-tight opacity-60"
                        }`}
                      >
                        {row.name}
                        {isMe && <span className="ml-1 accent-text">(you)</span>}
                      </td>
                      {dates.map((date) => {
                        const cell = row.days[date];
                        const key = `${row.staffId}:${date}`;
                        const holiday = federalHolidayName(date);
                        const fill = holiday ? HOLIDAY_COLOR : STATUS_COLOR[cell.status];
                        const durationText = !holiday && cell.status === "PARTIAL" && cell.lateMinutes ? formatLateDuration(cell.lateMinutes) : null;
                        const label = `${row.name} — ${date}: ${holiday ?? (durationText ? `${STATUS_LABEL[cell.status]} (${durationText})` : STATUS_LABEL[cell.status])}`;
                        const inCurrentWeek = mondayOf(date) === currentWeekMonday;
                        return (
                          <td key={date} className={`${rowCellPad} text-center ${inCurrentWeek ? "cal-current-week" : ""}`}>
                            {editable ? (
                              <button
                                type="button"
                                onClick={() => toggle(row.staffId, date, cell.status)}
                                disabled={pending === key}
                                aria-label={`${label} (tap to toggle)`}
                                title={`${label} (tap to toggle)`}
                                className="flex w-full items-center justify-center rounded-lg transition active:scale-95 disabled:opacity-40"
                                style={{ height: rowBoxHeight, background: fill }}
                              >
                                {isBig && durationText && <span className="text-[9px] font-extrabold text-white/90">{durationText}</span>}
                              </button>
                            ) : (
                              <span
                                className="flex w-full items-center justify-center rounded-lg opacity-80"
                                style={{ height: rowBoxHeight, background: fill }}
                                title={label}
                              >
                                {isBig && durationText && <span className="text-[9px] font-extrabold text-white/90">{durationText}</span>}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        <div
          ref={trailingRef}
          className="space-y-2 lg:w-72 lg:flex-shrink-0 lg:overflow-y-auto"
          style={sidebarMaxHeight != null ? { maxHeight: sidebarMaxHeight } : undefined}
        >
          {lateBox}
          <MyAbsencesList />
        </div>
      </div>
    </>
  );
}
