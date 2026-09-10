"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StaffCalendarRow, StaffDayStatus } from "@/lib/calendar";
import { weekdayIndex } from "@/lib/date";
import { useWhoAmI } from "@/lib/whoami";

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
// present/absent; the Absences page still handles half-day/reason/lateness
// detail.
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

  // table-layout: fixed + w-full stretches the columns to fill the
  // container instead of hugging the content — no more empty gutter on
  // wide screens (dense/month), and on a phone (week) each day column, and
  // the box inside it, gets real width instead of a tiny centered square.
  const boxHeight = dense ? "h-6" : "h-14";
  const cellPad = dense ? "p-1" : "p-1";
  const labelWidthClass = dense ? "w-24" : "w-28";

  return (
    <div className="space-y-3">
      {error && <p className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold opacity-60">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ background: STATUS_COLOR.PRESENT }} /> Present
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ background: STATUS_COLOR.ABSENT }} /> Absent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ background: STATUS_COLOR.PARTIAL }} /> Partial / running late
        </span>
        {current && <span className="opacity-70">— tap a box in your own row to toggle it{current.isManager ? " (you can toggle anyone's)" : ""}</span>}
      </div>

      <div className="accent-border-soft overflow-x-auto rounded-2xl border-2">
        <table
          className="w-full border-collapse text-sm"
          style={{ tableLayout: "fixed", minWidth: dense ? "800px" : undefined }}
        >
          <thead>
            <tr>
              <th
                className={`accent-border-soft sticky left-0 z-10 border-b-2 border-r-2 bg-white px-3 py-2 text-left font-extrabold tracking-tight ${labelWidthClass}`}
              >
                Staff
              </th>
              {dates.map((date) => {
                const day = Number(date.slice(-2));
                const wd = weekdayIndex(date)!;
                return (
                  <th
                    key={date}
                    className={`accent-border-soft border-b-2 text-center font-bold opacity-50 ${dense ? "px-1 py-2 text-[10px]" : "px-1 py-2 text-sm"}`}
                  >
                    <div>{WEEKDAY_LETTERS[wd]}</div>
                    <div>{day}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isMe = current?.id === row.staffId;
              const editable = Boolean(current) && (current!.isManager || isMe);
              return (
                <tr key={row.staffId} className={isMe ? "accent-bg-softer" : ""}>
                  <td className="accent-border-soft sticky left-0 z-10 truncate border-r-2 bg-white px-3 py-1.5 font-bold">
                    {row.name}
                    {isMe && <span className="ml-1 accent-text">(you)</span>}
                  </td>
                  {dates.map((date) => {
                    const status = row.days[date];
                    const key = `${row.staffId}:${date}`;
                    const label = `${row.name} — ${date}: ${STATUS_LABEL[status]}`;
                    return (
                      <td key={date} className={`${cellPad} text-center`}>
                        {editable ? (
                          <button
                            type="button"
                            onClick={() => toggle(row.staffId, date, status)}
                            disabled={pending === key}
                            aria-label={`${label} (tap to toggle)`}
                            title={`${label} (tap to toggle)`}
                            className={`block w-full ${boxHeight} rounded-lg transition active:scale-95 disabled:opacity-40`}
                            style={{ background: STATUS_COLOR[status] }}
                          />
                        ) : (
                          <span className={`block w-full ${boxHeight} rounded-lg opacity-80`} style={{ background: STATUS_COLOR[status] }} title={label} />
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
    </div>
  );
}
