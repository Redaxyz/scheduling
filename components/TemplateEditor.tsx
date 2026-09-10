"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { WEEKDAY_LABELS, HALVES, HALF_LABELS, type Half } from "@/lib/types";
import { OFFICE_COLOR, SURGERY_COLOR, OFF_COLOR } from "@/lib/colors";

type Slot = { weekday: number; half: string; office: string | null; surgery: boolean };
type Provider = { id: string; name: string; slots: Slot[] };

type OptionKey = "OFF" | "BETHESDA" | "GERMANTOWN" | "SURGERY";

const OPTIONS: { key: OptionKey; label: string; title: string; office: string | null; surgery: boolean; activeColor: string; activeTextColor: string }[] = [
  { key: "OFF", label: "Off", title: "Off", office: null, surgery: false, activeColor: OFF_COLOR, activeTextColor: "#fff" },
  {
    key: "BETHESDA",
    label: "BT",
    title: "Bethesda",
    office: "BETHESDA",
    surgery: false,
    activeColor: OFFICE_COLOR.BETHESDA,
    activeTextColor: "#fff",
  },
  {
    key: "GERMANTOWN",
    label: "GT",
    title: "Germantown",
    office: "GERMANTOWN",
    surgery: false,
    activeColor: OFFICE_COLOR.GERMANTOWN,
    activeTextColor: "#fff",
  },
  { key: "SURGERY", label: "Surgery", title: "In surgery", office: null, surgery: true, activeColor: SURGERY_COLOR, activeTextColor: "#0c4a6e" },
];

function keyFor(slot: Slot | undefined): OptionKey {
  if (slot?.surgery) return "SURGERY";
  if (slot?.office === "BETHESDA") return "BETHESDA";
  if (slot?.office === "GERMANTOWN") return "GERMANTOWN";
  return "OFF";
}

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

// Organized by day: a big box per weekday, split into Morning/Afternoon,
// each listing every provider with a 4-way pill (Bethesda / Germantown /
// Surgery / Off) — Off is rarely used since most providers are somewhere
// every half, but it's there for the occasional exception (e.g. a provider
// who's away every other week).
export default function TemplateEditor({ providers }: { providers: Provider[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  async function setSlot(providerId: string, weekday: number, half: Half, office: string | null, surgery: boolean) {
    await putJSON("/api/templates", { providerId, weekday, half, office, surgery });
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold opacity-40">
        Bethesda / Germantown set where a provider normally is; Surgery marks their usual surgery half (excluded from clinic
        staffing automatically, every week); Off means not normally working that half at all.
      </p>

      {WEEKDAY_LABELS.map((label, weekday) => (
        <div key={weekday} className="accent-border-soft rounded-2xl border-2 p-4">
          <h2 className="mb-3 text-lg font-extrabold tracking-tight">{label}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:divide-x sm:divide-slate-200">
            {HALVES.map((half) => (
              <div key={half} className="sm:pl-4 first:sm:pl-0">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide opacity-40">{HALF_LABELS[half]}</div>
                <div className="space-y-1.5">
                  {providers.map((p) => {
                    const slot = p.slots.find((s) => s.weekday === weekday && s.half === half);
                    const active = keyFor(slot);
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold">{p.name}</span>
                        <div className="accent-border inline-flex shrink-0 rounded-full border-2 p-0.5 text-[10px] font-extrabold">
                          {OPTIONS.map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              title={opt.title}
                              onClick={() => setSlot(p.id, weekday, half, opt.office, opt.surgery)}
                              className="rounded-full px-2 py-1 transition"
                              style={active === opt.key ? { background: opt.activeColor, color: opt.activeTextColor } : { opacity: 0.5 }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
