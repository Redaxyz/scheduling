"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WEEKDAY_LABELS, HALVES, HALF_LABELS, type Half } from "@/lib/types";
import { OFFICE_COLOR, SURGERY_COLOR, OFF_COLOR } from "@/lib/colors";

type Slot = { weekday: number; half: string; office: string | null; surgery: boolean };
type Provider = { id: string; name: string; slots: Slot[] };
type Edit = { office: string | null; surgery: boolean };

type OptionKey = "OFF" | "BETHESDA" | "GERMANTOWN" | "SURGERY";

const OPTIONS: {
  key: OptionKey;
  label: string;
  title: string;
  office: string | null;
  surgery: boolean;
  activeColor: string;
  activeTextColor: string;
  activeBorder?: string;
}[] = [
  { key: "OFF", label: "Off", title: "Off", office: null, surgery: false, activeColor: OFF_COLOR, activeTextColor: "#fff" },
  {
    key: "BETHESDA",
    label: "BT",
    title: "Bethesda",
    office: "BETHESDA",
    surgery: false,
    activeColor: OFFICE_COLOR.BETHESDA,
    // White on white needs its own dark text + a visible edge, unlike the
    // other three options, which are all saturated enough to read white text
    // and stand out from the page on their own.
    activeTextColor: "#334155",
    activeBorder: "1.5px solid #94a3b8",
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

function keyFor(slot: Slot | Edit | undefined): OptionKey {
  if (slot?.surgery) return "SURGERY";
  if (slot?.office === "BETHESDA") return "BETHESDA";
  if (slot?.office === "GERMANTOWN") return "GERMANTOWN";
  return "OFF";
}

function editKey(providerId: string, weekday: number, half: Half) {
  return `${providerId}:${weekday}:${half}`;
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
// who's away every other week). Clicks only edit local state; nothing hits
// the server until Save, so a string of taps across many providers/days
// stays cheap and reads back a single clear "Saved" moment.
export default function TemplateEditor({ providers }: { providers: Provider[] }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (savedAt === null) return;
    const id = window.setTimeout(() => setSavedAt(null), 4000);
    return () => window.clearTimeout(id);
  }, [savedAt]);

  const dirtyCount = Object.keys(edits).length;

  function choose(providerId: string, weekday: number, half: Half, opt: (typeof OPTIONS)[number]) {
    setSavedAt(null);
    setEdits((prev) => ({ ...prev, [editKey(providerId, weekday, half)]: { office: opt.office, surgery: opt.surgery } }));
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(edits).map(([key, edit]) => {
          const [providerId, weekdayStr, half] = key.split(":");
          return putJSON("/api/templates", { providerId, weekday: Number(weekdayStr), half, office: edit.office, surgery: edit.surgery });
        })
      );
      setEdits({});
      setSavedAt(Date.now());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-20">
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
                    const edit = edits[editKey(p.id, weekday, half)];
                    const active = keyFor(edit ?? slot);
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold">
                          {p.name}
                          {edit && <span className="ml-1 accent-text">•</span>}
                        </span>
                        <div className="accent-border inline-flex shrink-0 rounded-full border-2 p-0.5 text-[10px] font-extrabold">
                          {OPTIONS.map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              title={opt.title}
                              onClick={() => choose(p.id, weekday, half, opt)}
                              className="rounded-full px-2 py-1 transition"
                              style={
                                active === opt.key
                                  ? { background: opt.activeColor, color: opt.activeTextColor, border: opt.activeBorder }
                                  : { opacity: 0.5 }
                              }
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

      <div
        className="fixed inset-x-0 z-30 flex justify-center px-4"
        style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="accent-border flex items-center gap-3 rounded-full border-2 bg-white px-4 py-2 shadow-lg">
          {error && <span className="text-xs font-bold text-red-600">{error}</span>}
          {!error && dirtyCount > 0 && <span className="text-xs font-bold opacity-60">{dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}</span>}
          {!error && dirtyCount === 0 && savedAt && <span className="text-xs font-bold text-emerald-600">✓ Saved</span>}
          {!error && dirtyCount === 0 && !savedAt && <span className="text-xs font-bold opacity-40">Up to date</span>}
          <button
            type="button"
            onClick={save}
            disabled={dirtyCount === 0 || saving}
            className="accent-border rounded-full border-2 px-4 py-1 text-sm font-bold transition active:scale-95 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
