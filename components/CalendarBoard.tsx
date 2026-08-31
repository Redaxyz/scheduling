"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DayQuadrants, QuadrantEntry } from "@/lib/calendar";
import type { Half } from "@/lib/types";
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
        <DayQuadrantCard key={day.date} day={day} onToggle={toggle} />
      ))}
    </div>
  );
}
