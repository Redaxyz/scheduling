"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProviderCalendarRow, ProviderHalfCell } from "@/lib/calendar";
import { weekdayIndex } from "@/lib/date";
import { HALVES, HALF_LABELS, type Half } from "@/lib/types";
import { useWhoAmI } from "@/lib/whoami";
import { SURGERY_COLOR, OFF_COLOR } from "@/lib/colors";

const STATUS_COLOR = { PRESENT: "#579669", ABSENT: OFF_COLOR, SURGERY: SURGERY_COLOR } as const;
const STATUS_LABEL = { PRESENT: "present", ABSENT: "absent", SURGERY: "in surgery" } as const;
// Click cycles PRESENT -> ABSENT -> SURGERY -> PRESENT.
const NEXT_STATUS = { PRESENT: "ABSENT", ABSENT: "SURGERY", SURGERY: "PRESENT" } as const;

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

  const boxHeight = dense ? "h-6" : "h-14";
  const labelWidthClass = dense ? "w-28" : "w-24";

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
          <span className="inline-block h-3 w-3 rounded" style={{ background: STATUS_COLOR.SURGERY }} /> In surgery
        </span>
        <span className="flex items-center gap-1.5">
          <span className="relative inline-block h-3 w-3 rounded bg-slate-300">
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
          </span>
          Running late
        </span>
        {current && (
          <span className="opacity-70">
            — tap AM or PM to cycle present → absent → in surgery (a soft white ring marks a usual surgery day from the weekly template)
          </span>
        )}
      </div>

      <div className="accent-border-soft overflow-x-auto rounded-2xl border-2">
        <table
          className="w-full border-collapse text-sm"
          style={{ tableLayout: "fixed", minWidth: dense ? "900px" : undefined }}
        >
          <thead>
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
                return (
                  <th
                    key={date}
                    colSpan={2}
                    className={`accent-border-soft border-b-2 border-l-2 text-center font-bold opacity-50 ${dense ? "px-1 py-1 text-[10px]" : "px-1 py-1.5 text-sm"}`}
                  >
                    <div>{WEEKDAY_LETTERS[wd]}</div>
                    <div>{day}</div>
                  </th>
                );
              })}
            </tr>
            <tr>
              {dates.flatMap((date) =>
                HALVES.map((half) => (
                  <th
                    key={`${date}-${half}`}
                    className={`accent-border-soft border-b-2 text-center text-[9px] font-bold uppercase tracking-wide opacity-40 ${half === "AM" ? "border-l-2" : ""}`}
                  >
                    {half}
                  </th>
                ))
              )}
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
                    const label = `${row.name} — ${date} ${HALF_LABELS[half]}: ${STATUS_LABEL[cell.status]}${cell.fromTemplate ? " (usual surgery day)" : ""}${cell.late ? " (running late)" : ""}`;
                    return (
                      <td key={key} className={`p-1 text-center ${half === "AM" ? "border-l-2 accent-border-soft" : ""}`}>
                        <button
                          type="button"
                          onClick={() => toggle(row.providerId, date, half, cell)}
                          disabled={pending === key}
                          aria-label={`${label} (tap to toggle)`}
                          title={`${label} (tap to toggle)`}
                          className="relative block w-full rounded-lg transition active:scale-95 disabled:opacity-40"
                          style={{ background: STATUS_COLOR[cell.status], boxShadow: cell.fromTemplate ? "inset 0 0 0 2px rgba(255,255,255,0.6)" : undefined }}
                        >
                          <span className={`block w-full ${boxHeight}`} />
                          {cell.late && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white bg-amber-500" />}
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
    </div>
  );
}
