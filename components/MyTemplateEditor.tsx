"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWhoAmI } from "@/lib/whoami";
import { WEEKDAY_LABELS, HALVES, HALF_LABELS, OFFICES, OFFICE_LABELS, type Half, type Role } from "@/lib/types";

type Slot = { weekday: number; half: string; role: string | null; office: string | null; providerId: string | null };
type Provider = { id: string; name: string };
type Edit = { role: string | null; office: string | null; providerId: string | null };

function editKey(weekday: number, half: Half) {
  return `${weekday}:${half}`;
}

async function putJSON(url: string, body: unknown) {
  const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
}

// Self-service weekly template — the staff equivalent of the doctors'
// template on the Templates page, but each person only ever sees and edits
// their own: there's no picker for anyone else's row here at all, unlike
// the manager-facing provider editor. Once someone sets even one slot,
// getDaySchedule uses this instead of their old admin-set defaults
// (dedicatedProviderId / ScribeFallback / defaultRoomingOffice /
// defaultXrayOffice) for every half — see the StaffScheduleSlot schema
// comment. Picks only edit local state; nothing hits the server until Save.
export default function MyTemplateEditor() {
  const { current } = useWhoAmI();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !current) return;
    setLoading(true);
    Promise.all([fetch(`/api/staff-template?staffId=${current.id}`).then((r) => r.json()), fetch("/api/providers").then((r) => r.json())])
      .then(([slotsData, providersData]) => {
        setSlots(Array.isArray(slotsData) ? slotsData : []);
        setEdits({});
        setProviders(Array.isArray(providersData) ? providersData : []);
      })
      .catch(() => setError("Couldn't load your template"))
      .finally(() => setLoading(false));
  }, [open, current]);

  useEffect(() => {
    if (savedAt === null) return;
    const id = window.setTimeout(() => setSavedAt(null), 4000);
    return () => window.clearTimeout(id);
  }, [savedAt]);

  if (!current) return null;

  function slotFor(weekday: number, half: Half) {
    return slots.find((s) => s.weekday === weekday && s.half === half);
  }

  function choose(weekday: number, half: Half, edit: Edit) {
    setSavedAt(null);
    setEdits((prev) => ({ ...prev, [editKey(weekday, half)]: edit }));
  }

  const dirtyCount = Object.keys(edits).length;

  async function save() {
    if (!current) return;
    setError(null);
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(edits).map(([key, edit]) => {
          const [weekdayStr, half] = key.split(":");
          return putJSON("/api/staff-template", { staffId: current.id, weekday: Number(weekdayStr), half, ...edit });
        })
      );
      const res = await fetch(`/api/staff-template?staffId=${current.id}`);
      setSlots(await res.json());
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
    <div className="accent-border-soft rounded-2xl border-2 p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
        <h2 className="text-sm font-extrabold tracking-tight">My weekly template</h2>
        <span className="shrink-0 text-sm font-bold accent-text">{open ? "Hide" : "Edit"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {error && <p className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}
          {loading ? (
            <p className="text-sm font-bold opacity-40">Loading…</p>
          ) : (
            <>
              {WEEKDAY_LABELS.map((label, weekday) => (
                <div key={weekday} className="accent-border-soft rounded-xl border-2 p-3">
                  <h3 className="mb-2 font-extrabold tracking-tight">{label}</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {HALVES.map((half) => {
                      const slot = slotFor(weekday, half);
                      const edit = edits[editKey(weekday, half)];
                      const effective = edit ?? slot ?? { role: null, office: null, providerId: null };
                      const role = effective.role ?? "";
                      return (
                        <div key={half} className="space-y-1.5">
                          <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide opacity-40">
                            {HALF_LABELS[half]}
                            {edit && <span className="normal-case accent-text">• unsaved</span>}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <select
                              value={role}
                              onChange={(e) => {
                                const nextRole = e.target.value;
                                if (nextRole === "SCRIBE") choose(weekday, half, { role: "SCRIBE", office: null, providerId: providers[0]?.id ?? null });
                                else if (nextRole === "ROOMING" || nextRole === "XRAY")
                                  choose(weekday, half, { role: nextRole, office: "BETHESDA", providerId: null });
                                else choose(weekday, half, { role: null, office: null, providerId: null });
                              }}
                              className="accent-border-soft rounded-full border-2 bg-transparent px-2 py-1 text-xs font-bold outline-none"
                            >
                              <option value="">Off duty</option>
                              {current.canScribe && <option value="SCRIBE">Scribe</option>}
                              <option value="ROOMING">Rooming</option>
                              {current.kind === "XRAY" && <option value="XRAY">X-ray</option>}
                            </select>

                            {role === "SCRIBE" && (
                              <select
                                value={effective.providerId ?? ""}
                                onChange={(e) => choose(weekday, half, { role: "SCRIBE", office: null, providerId: e.target.value })}
                                className="accent-border-soft rounded-full border-2 bg-transparent px-2 py-1 text-xs font-bold outline-none"
                              >
                                {providers.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            )}

                            {(role === "ROOMING" || role === "XRAY") && (
                              <select
                                value={effective.office ?? "BETHESDA"}
                                onChange={(e) => choose(weekday, half, { role: role as Role, office: e.target.value, providerId: null })}
                                className="accent-border-soft rounded-full border-2 bg-transparent px-2 py-1 text-xs font-bold outline-none"
                              >
                                {OFFICES.map((o) => (
                                  <option key={o} value={o}>
                                    {OFFICE_LABELS[o]}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="accent-border-soft flex items-center gap-3 rounded-xl border-2 p-3">
                {dirtyCount > 0 && <span className="text-xs font-bold opacity-60">{dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}</span>}
                {dirtyCount === 0 && savedAt && <span className="text-xs font-bold text-emerald-600">✓ Saved</span>}
                {dirtyCount === 0 && !savedAt && <span className="text-xs font-bold opacity-40">Up to date</span>}
                <button
                  type="button"
                  onClick={save}
                  disabled={dirtyCount === 0 || saving}
                  className="accent-border ml-auto rounded-full border-2 px-4 py-1.5 text-sm font-bold transition active:scale-95 disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
