"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DayQuadrants, QuadrantEntry } from "@/lib/calendar";
import { HALF_LABELS, type Half, type Office } from "@/lib/types";
import { formatShort } from "@/lib/date";

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

// Quadrant layout: RUQ = Bethesda AM, LUQ = Germantown AM, RLQ = Bethesda PM,
// LLQ = Germantown PM. Rendered as [GT | BT] columns x [AM | PM] rows so BT
// stays on the right and GT on the left in both rows, matching the naming.
const QUADRANTS: { office: Office; half: Half; label: string }[][] = [
  [
    { office: "GERMANTOWN", half: "AM", label: "GT" },
    { office: "BETHESDA", half: "AM", label: "BT" },
  ],
  [
    { office: "GERMANTOWN", half: "PM", label: "GT" },
    { office: "BETHESDA", half: "PM", label: "BT" },
  ],
];

export default function CalendarBoard({ days }: { days: DayQuadrants[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());
  const [error, setError] = useState<string | null>(null);

  async function toggle(providerId: string, date: string, half: Half, entry: QuadrantEntry) {
    setError(null);
    try {
      if (entry.present) {
        await postJSON("/api/absences/provider", "POST", {
          providerId,
          startDate: date,
          endDate: date,
          half,
          reason: "",
        });
      } else if (entry.absenceId) {
        await postJSON(`/api/absences/provider/${entry.absenceId}`, "DELETE");
      }
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}
      {days.map((day) => (
        <div key={day.date} className="accent-border-soft rounded-2xl border-2 p-3 sm:p-4">
          <h3 className="mb-2 font-extrabold tracking-tight">
            {day.weekdayLabel} <span className="opacity-40">· {formatShort(day.date)}</span>
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {QUADRANTS.flat().map(({ office, half, label }) => (
              <div key={`${office}-${half}`} className="accent-border-soft rounded-xl border-2 p-2">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-40">
                  {label} · {HALF_LABELS[half]}
                </div>
                {day.cells[office][half].length === 0 ? (
                  <div className="text-sm font-bold opacity-25">—</div>
                ) : (
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    {day.cells[office][half].map((entry) => (
                      <button
                        key={entry.providerId}
                        onClick={() => toggle(entry.providerId, day.date, half, entry)}
                        title={entry.present ? `Mark ${entry.name} absent` : `Mark ${entry.name} present`}
                        className={
                          entry.present
                            ? "text-base font-extrabold text-[#579669] sm:text-lg"
                            : "text-base font-normal text-slate-400 sm:text-lg"
                        }
                      >
                        {entry.initials}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
