"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProviderCalendarRow, ProviderHalfCell } from "@/lib/calendar";
import { weekdayIndex } from "@/lib/date";
import { HALVES, HALF_LABELS, OFFICE_LABELS, type Half, type Office } from "@/lib/types";
import { useWhoAmI } from "@/lib/whoami";
import { useThemeMode } from "@/lib/theme";
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

function cellColor(cell: ProviderHalfCell): string {
  if (cell.status === "ABSENT") return OFF_COLOR;
  if (cell.status === "SURGERY") return SURGERY_COLOR;
  return cell.office ? OFFICE_COLOR[cell.office] : OFF_DUTY_COLOR;
}

// White-on-Bethesda is the one combination dark text instead of white.
function cellTextClass(cell: ProviderHalfCell): string {
  return cell.status === "PRESENT" && cell.office === "BETHESDA" ? "text-slate-700" : "text-white/90";
}

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
  const { active: modern } = useThemeMode();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  // Rows grow to actually use whatever vertical space the window has
  // instead of sitting fixed-size with dead space below on a tall screen —
  // measured at runtime (window height down to the floating bottom nav,
  // minus the header block) and divided across the provider rows, same
  // "measure, don't guess" approach as FullHeightFrame elsewhere. Never
  // shrinks below the old fixed sizing, only grows past it.
  const containerRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const modernHeaderRef = useRef<HTMLDivElement>(null);
  const [rowPx, setRowPx] = useState<number | null>(null);

  useEffect(() => {
    function compute() {
      if (!containerRef.current || rows.length === 0) return;
      const top = containerRef.current.getBoundingClientRect().top;
      const bottomNav = document.getElementById("bottom-nav");
      const bottomNavHeight = bottomNav?.getBoundingClientRect().height ?? 0;
      const headerHeight = (theadRef.current ?? modernHeaderRef.current)?.getBoundingClientRect().height ?? 0;
      const available = window.innerHeight - top - bottomNavHeight - headerHeight - 16;
      setRowPx(available / rows.length);
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [rows.length, modern, dense]);

  const minRowPx = dense ? (modern ? 28 : 24) : 56;
  const dynamicRowHeight = Math.max(minRowPx, rowPx ?? minRowPx);

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

  const legend = (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold opacity-60">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full border border-slate-300" style={{ background: OFFICE_COLOR.BETHESDA }} /> Bethesda
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full" style={{ background: OFFICE_COLOR.GERMANTOWN }} /> Germantown
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full" style={{ background: OFF_COLOR }} /> Absent
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full" style={{ background: SURGERY_COLOR }} /> In surgery
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full" style={{ background: OFF_DUTY_COLOR }} /> Off duty
      </span>
      {current && (
        <span className="opacity-70">
          — tap AM or PM to cycle office → absent → in surgery (office always comes back as wherever the weekly template has them; a
          soft white ring marks a usual surgery day)
        </span>
      )}
    </div>
  );

  // Modern: same office-identity fills as everywhere else in the modern
  // theme, but as a full-bleed grid of AM/PM tiles instead of a bordered
  // table — no card, no row lines, the gap between tiles is the only
  // structure left.
  if (modern) {
    const cols = dates.length * 2;
    const gridCols = `${dense ? "104px" : "128px"} repeat(${cols}, minmax(0, 1fr))`;
    return (
      <div className="relative left-1/2 w-screen -translate-x-1/2">
        <div className="mx-auto max-w-6xl space-y-3 px-4 py-3 sm:px-8">
          {error && <p className="rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-500">{error}</p>}
          {legend}

          <div ref={containerRef} className="overflow-x-auto">
            <div style={{ minWidth: dense ? "860px" : undefined }}>
              <div ref={modernHeaderRef}>
                <div className="grid items-end" style={{ gridTemplateColumns: gridCols }}>
                  <div />
                  {dates.map((date) => {
                    const wd = weekdayIndex(date)!;
                    return (
                      <div key={date} className="col-span-2 pb-0.5 text-center text-[10px] font-black uppercase tracking-wide opacity-40">
                        <div>{WEEKDAY_LETTERS[wd]}</div>
                        <div>{Number(date.slice(-2))}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="grid pb-1" style={{ gridTemplateColumns: gridCols }}>
                  <div />
                  {dates.flatMap((date) =>
                    HALVES.map((half) => (
                      <div key={`${date}-${half}`} className="text-center text-[8px] font-bold uppercase tracking-widest opacity-30">
                        {half}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-[3px]">
                {rows.map((row) => (
                  <div key={row.providerId} className="grid items-center gap-x-[3px]" style={{ gridTemplateColumns: gridCols }}>
                    <div className="truncate pr-2 text-right text-xs font-bold">{row.name}</div>
                    {dates.flatMap((date) =>
                      HALVES.map((half) => {
                        const cell = row.days[date][half];
                        const key = `${row.providerId}:${date}:${half}`;
                        const officeName = cell.office ? OFFICE_LABELS[cell.office] : null;
                        const label = `${row.name} — ${date} ${HALF_LABELS[half]}: ${
                          cell.status === "PRESENT" && !officeName ? "off duty" : STATUS_LABEL[cell.status]
                        }${officeName ? ` at ${officeName}` : ""}${cell.fromTemplate ? " (usual surgery day)" : ""}`;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggle(row.providerId, date, half, cell)}
                            disabled={pending === key}
                            aria-label={`${label} (tap to toggle)`}
                            title={`${label} (tap to toggle)`}
                            className={`relative flex w-full items-center justify-center font-extrabold transition active:scale-95 disabled:opacity-40 ${cellTextClass(cell)} ${dense ? "text-[9px]" : "text-xs"}`}
                            style={{
                              height: dynamicRowHeight,
                              background: cellColor(cell),
                              boxShadow: cell.fromTemplate ? "inset 0 0 0 2px rgba(255,255,255,0.6)" : undefined,
                            }}
                          >
                            {cell.status === "PRESENT" && cell.office ? OFFICE_LETTER[cell.office] : ""}
                          </button>
                        );
                      })
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}

      {legend}

      <div ref={containerRef} className="accent-border-soft overflow-x-auto rounded-2xl border-2">
        <table
          className="w-full border-collapse text-sm"
          style={{ tableLayout: "fixed", minWidth: dense ? "900px" : undefined }}
        >
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
                    const officeName = cell.office ? OFFICE_LABELS[cell.office] : null;
                    const label = `${row.name} — ${date} ${HALF_LABELS[half]}: ${
                      cell.status === "PRESENT" && !officeName ? "off duty" : STATUS_LABEL[cell.status]
                    }${officeName ? ` at ${officeName}` : ""}${cell.fromTemplate ? " (usual surgery day)" : ""}`;
                    return (
                      <td key={key} className={`p-1 text-center ${half === "AM" ? "border-l-2 accent-border-soft" : ""}`}>
                        <button
                          type="button"
                          onClick={() => toggle(row.providerId, date, half, cell)}
                          disabled={pending === key}
                          aria-label={`${label} (tap to toggle)`}
                          title={`${label} (tap to toggle)`}
                          className="relative block w-full rounded-lg border border-slate-900/10 transition active:scale-95 disabled:opacity-40"
                          style={{ background: cellColor(cell), boxShadow: cell.fromTemplate ? "inset 0 0 0 2px rgba(255,255,255,0.6)" : undefined }}
                        >
                          <span
                            className={`flex w-full items-center justify-center font-extrabold ${cellTextClass(cell)} ${dense ? "text-[9px]" : "text-xs"}`}
                            style={{ height: dynamicRowHeight }}
                          >
                            {cell.status === "PRESENT" && cell.office ? OFFICE_LETTER[cell.office] : ""}
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
    </div>
  );
}
