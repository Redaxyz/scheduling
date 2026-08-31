"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WEEKDAY_LABELS } from "@/lib/types";

type Slot = { weekday: number; half: string; office: string | null };
type Provider = { id: string; name: string; slots: Slot[] };

async function putJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
}

export default function TemplateEditor({ providers }: { providers: Provider[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  async function update(providerId: string, weekday: number, half: "AM" | "PM", office: string) {
    await putJSON("/api/templates", { providerId, weekday, half, office: office === "OFF" ? null : office });
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      {providers.map((p) => (
        <div key={p.id} className="accent-border-soft rounded-2xl border-2 p-4">
          <h2 className="mb-2 font-extrabold tracking-tight">{p.name}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-bold opacity-50">
                <th className="py-1 pr-2 font-bold">Day</th>
                <th className="py-1 pr-2 font-bold">Morning</th>
                <th className="py-1 pr-2 font-bold">Afternoon</th>
              </tr>
            </thead>
            <tbody>
              {WEEKDAY_LABELS.map((label, weekday) => (
                <tr key={weekday} className="accent-border-soft border-t-2">
                  <td className="py-1.5 pr-2 font-bold opacity-70">{label}</td>
                  {(["AM", "PM"] as const).map((half) => {
                    const slot = p.slots.find((s) => s.weekday === weekday && s.half === half);
                    const value = slot?.office ?? "OFF";
                    return (
                      <td key={half} className="py-1.5 pr-2">
                        <select
                          className="accent-border-soft border-b-2 bg-transparent py-1 font-extrabold text-slate-700 outline-none"
                          defaultValue={value}
                          onChange={(e) => update(p.id, weekday, half, e.target.value)}
                        >
                          <option value="OFF">Off</option>
                          <option value="BETHESDA">Bethesda</option>
                          <option value="GERMANTOWN">Germantown</option>
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
