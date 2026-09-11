"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StaffCalendarRow, StaffDayStatus } from "@/lib/calendar";
import { todayStr, weekdayIndex } from "@/lib/date";
import { useWhoAmI } from "@/lib/whoami";
import { useThemeMode } from "@/lib/theme";
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
  const { active: modern } = useThemeMode();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [lateMinutes, setLateMinutes] = useState(String(LATE_MINUTE_OPTIONS[1]));
  const [markingLate, setMarkingLate] = useState(false);

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

  // table-layout: fixed + w-full stretches the columns to fill the
  // container instead of hugging the content — no more empty gutter on
  // wide screens (dense/month), and on a phone (week) each day column, and
  // the box inside it, gets real width instead of a tiny centered square.
  const boxHeight = dense ? "h-6" : "h-14";
  // Everyone but you is reference-only for most viewers (a manager can still
  // edit them, just via a smaller target) — shrinking their rows down to
  // thin bars is what actually gets the whole week's staff list, plus the
  // "running late" box below it, onto one screen with nothing to scroll.
  const otherBoxHeight = dense ? "h-1.5" : "h-2";
  const otherCellPad = "p-px";
  const cellPad = dense ? "p-1" : "p-1";
  const labelWidthClass = dense ? "w-24" : "w-28";

  // Your own row first — no hunting for your name in an alphabetical list —
  // then everyone else in their existing order.
  const sortedRows = current
    ? [...rows].sort((a, b) => (a.staffId === current.id ? -1 : b.staffId === current.id ? 1 : 0))
    : rows;

  const legend = (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold opacity-60">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full" style={{ background: STATUS_COLOR.PRESENT }} /> Present
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full" style={{ background: STATUS_COLOR.ABSENT }} /> Absent
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full" style={{ background: STATUS_COLOR.PARTIAL }} /> Partial / running late
      </span>
      {current && (
        <span className="hidden opacity-70 sm:inline">
          — tap a box in your own row to toggle it{current.isManager ? " (you can toggle anyone's)" : ""}
        </span>
      )}
    </div>
  );

  const lateBox = current && (
    <div className="accent-border-soft flex flex-wrap items-center gap-2 rounded-2xl border-2 p-2 text-sm">
      <span className="font-bold opacity-70">Running late this morning?</span>
      <select
        value={lateMinutes}
        onChange={(e) => setLateMinutes(e.target.value)}
        className="accent-border-soft rounded-full border-2 bg-transparent px-3 py-0.5 font-bold outline-none"
      >
        {LATE_MINUTE_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {m} min
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
      <span className="hidden text-xs font-bold opacity-40 sm:inline">Turns your box for today orange — tap it again to clear.</span>
    </div>
  );

  // Modern: no bordered card around the grid, no table chrome — a full-bleed
  // heatmap where every cell is a tap target and the gaps between them are
  // the only "lines" in the whole thing.
  if (modern) {
    const gridCols = `${dense ? "88px" : "104px"} repeat(${dates.length}, minmax(0, 1fr))`;
    const modernBoxHeight = dense ? "h-7" : "h-14";
    const modernOtherBoxHeight = dense ? "h-2" : "h-3";
    return (
      <div className="relative left-1/2 w-screen -translate-x-1/2">
        <div className="mx-auto max-w-6xl space-y-3 px-4 py-3 sm:px-8">
          {error && <p className="rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-500">{error}</p>}
          {legend}

          <div className="overflow-x-auto">
            <div style={{ minWidth: dense ? "760px" : undefined }}>
              <div className="grid items-end pb-1" style={{ gridTemplateColumns: gridCols }}>
                <div />
                {dates.map((date) => {
                  const wd = weekdayIndex(date)!;
                  return (
                    <div key={date} className="text-center text-[10px] font-black uppercase tracking-wide opacity-40">
                      <div>{WEEKDAY_LETTERS[wd]}</div>
                      <div>{Number(date.slice(-2))}</div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-[3px]">
                {sortedRows.map((row) => {
                  const isMe = current?.id === row.staffId;
                  const isManagerView = current?.isManager ?? false;
                  const editable = Boolean(current) && (isManagerView || isMe);
                  const isBig = isMe || isManagerView;
                  const rowBoxHeight = isBig ? modernBoxHeight : modernOtherBoxHeight;
                  return (
                    <div key={row.staffId} className="grid items-center gap-x-[3px]" style={{ gridTemplateColumns: gridCols }}>
                      <div
                        className={`truncate pr-2 text-right font-bold ${isBig ? "text-xs" : "text-[9px] opacity-40"}`}
                        style={isMe ? { color: "var(--cao-blue, inherit)" } : undefined}
                      >
                        {row.name}
                      </div>
                      {dates.map((date) => {
                        const status = row.days[date];
                        const key = `${row.staffId}:${date}`;
                        const label = `${row.name} — ${date}: ${STATUS_LABEL[status]}`;
                        return editable ? (
                          <button
                            key={date}
                            type="button"
                            onClick={() => toggle(row.staffId, date, status)}
                            disabled={pending === key}
                            aria-label={`${label} (tap to toggle)`}
                            title={`${label} (tap to toggle)`}
                            className={`block w-full ${rowBoxHeight} transition active:scale-95 disabled:opacity-40`}
                            style={{ background: STATUS_COLOR[status] }}
                          />
                        ) : (
                          <span
                            key={date}
                            className={`block w-full ${rowBoxHeight} opacity-80`}
                            style={{ background: STATUS_COLOR[status] }}
                            title={label}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {lateBox}
          <MyAbsencesList />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}

      {legend}

      <div className="accent-border-soft overflow-x-auto rounded-2xl border-2">
        <table
          className="w-full border-collapse text-sm"
          style={{ tableLayout: "fixed", minWidth: dense ? "800px" : undefined }}
        >
          <thead>
            <tr>
              <th
                className={`accent-border-soft sticky left-0 z-10 border-b-2 border-r-2 bg-white px-3 py-1 text-left font-extrabold tracking-tight ${labelWidthClass}`}
              >
                Staff
              </th>
              {dates.map((date) => {
                const day = Number(date.slice(-2));
                const wd = weekdayIndex(date)!;
                return (
                  <th
                    key={date}
                    className={`accent-border-soft border-b-2 text-center font-bold opacity-50 ${dense ? "px-1 py-1 text-[10px]" : "px-1 py-1 text-sm"}`}
                  >
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
              const isManagerView = current?.isManager ?? false;
              const editable = Boolean(current) && (isManagerView || isMe);
              // A manager can adjust anyone's row, so nobody's is "just for
              // reference" the way it is for everyone else — keep every row
              // full-size for her instead of shrinking everyone but herself.
              const isBig = isMe || isManagerView;
              const rowBoxHeight = isBig ? boxHeight : otherBoxHeight;
              const rowCellPad = isBig ? cellPad : otherCellPad;
              return (
                <tr key={row.staffId} className={isMe ? "accent-bg-softer" : ""}>
                  <td
                    className={`accent-border-soft sticky left-0 z-10 truncate border-r-2 bg-white px-3 font-bold ${
                      isBig ? "py-1.5" : "py-0 text-[10px] leading-tight opacity-60"
                    }`}
                  >
                    {row.name}
                    {isMe && <span className="ml-1 accent-text">(you)</span>}
                  </td>
                  {dates.map((date) => {
                    const status = row.days[date];
                    const key = `${row.staffId}:${date}`;
                    const label = `${row.name} — ${date}: ${STATUS_LABEL[status]}`;
                    return (
                      <td key={date} className={`${rowCellPad} text-center`}>
                        {editable ? (
                          <button
                            type="button"
                            onClick={() => toggle(row.staffId, date, status)}
                            disabled={pending === key}
                            aria-label={`${label} (tap to toggle)`}
                            title={`${label} (tap to toggle)`}
                            className={`block w-full ${rowBoxHeight} rounded-lg transition active:scale-95 disabled:opacity-40`}
                            style={{ background: STATUS_COLOR[status] }}
                          />
                        ) : (
                          <span className={`block w-full ${rowBoxHeight} rounded-lg opacity-80`} style={{ background: STATUS_COLOR[status] }} title={label} />
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

      {lateBox}

      <MyAbsencesList />
    </div>
  );
}
