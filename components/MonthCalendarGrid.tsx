"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DayQuadrants, QuadrantEntry } from "@/lib/calendar";
import type { Half } from "@/lib/types";
import { monthGridWeeks } from "@/lib/date";
import DayQuadrantCard from "@/components/DayQuadrantCard";

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

const WEEKDAY_HEADS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function daySummary(day: DayQuadrants) {
  const byProvider = new Map<string, { initials: string; present: boolean }>();
  for (const office of ["BETHESDA", "GERMANTOWN"] as const) {
    for (const half of ["AM", "PM"] as const) {
      for (const entry of day.cells[office][half]) {
        const existing = byProvider.get(entry.providerId);
        if (!existing) byProvider.set(entry.providerId, { initials: entry.initials, present: entry.present });
        else if (entry.present) existing.present = true;
      }
    }
  }
  return [...byProvider.values()];
}

export default function MonthCalendarGrid({
  month,
  days,
  todayDate,
}: {
  month: string;
  days: DayQuadrants[];
  todayDate: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());
  const [error, setError] = useState<string | null>(null);

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const weeks = useMemo(() => monthGridWeeks(month), [month]);
  const [selected, setSelected] = useState<string | null>(byDate.has(todayDate) ? todayDate : (days[0]?.date ?? null));

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

  const selectedDay = selected ? (byDate.get(selected) ?? null) : null;

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}

      <div className="accent-border-soft overflow-hidden rounded-2xl border-2">
        <div className="accent-border-soft grid grid-cols-5 border-b-2">
          {WEEKDAY_HEADS.map((w) => (
            <div key={w} className="py-1.5 text-center text-[11px] font-bold uppercase tracking-wide opacity-50 sm:text-xs">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5">
          {weeks.flatMap((week, wi) =>
            week.map((date, di) => {
              if (!date) {
                return <div key={`${wi}-${di}`} className="accent-border-soft border-b border-r" />;
              }
              const day = byDate.get(date);
              const dayNum = Number(date.slice(-2));
              const isToday = date === todayDate;
              const isSelected = date === selected;
              const summary = day ? daySummary(day) : [];
              return (
                <button
                  key={date}
                  onClick={() => setSelected(date)}
                  className={`accent-border-soft flex min-h-[60px] flex-col items-start gap-0.5 border-b border-r p-1 text-left sm:min-h-[84px] sm:p-1.5 ${
                    isSelected ? "accent-bg-soft" : ""
                  }`}
                >
                  <span className={`text-[11px] font-bold sm:text-sm ${isToday ? "accent-text" : "opacity-60"}`}>{dayNum}</span>
                  <div className="flex flex-wrap gap-x-1 leading-tight">
                    {summary.map((s) => (
                      <span
                        key={s.initials}
                        className={
                          s.present
                            ? "text-[10px] font-extrabold text-[#579669] sm:text-xs"
                            : "text-[10px] font-normal text-slate-400 sm:text-xs"
                        }
                      >
                        {s.initials}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {selectedDay && <DayQuadrantCard day={selectedDay} onToggle={toggle} />}
    </div>
  );
}
