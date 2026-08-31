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
        <div key={p.id} className="rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold text-slate-800">{p.name}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1 pr-2">Day</th>
                <th className="py-1 pr-2">Morning</th>
                <th className="py-1 pr-2">Afternoon</th>
              </tr>
            </thead>
            <tbody>
              {WEEKDAY_LABELS.map((label, weekday) => (
                <tr key={weekday} className="border-t border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-600">{label}</td>
                  {(["AM", "PM"] as const).map((half) => {
                    const slot = p.slots.find((s) => s.weekday === weekday && s.half === half);
                    const value = slot?.office ?? "OFF";
                    return (
                      <td key={half} className="py-1.5 pr-2">
                        <select
                          className="rounded border border-slate-300 px-2 py-1"
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
