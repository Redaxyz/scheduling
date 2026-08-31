"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DaySchedule, FreeStaffMember, HalfSlot } from "@/lib/schedule";
import { HALVES, HALF_LABELS, OFFICES, OFFICE_LABELS, type Half, type Office } from "@/lib/types";
import { useWhoAmI } from "@/lib/whoami";

type Props = {
  date: string;
  day: DaySchedule;
  freeStaff: Record<Half, FreeStaffMember[]>;
};

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

export default function ScheduleBoard({ date, day, freeStaff }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(() => router.refresh());
  }

  const totalGap = Math.abs(day.officeTotals.BETHESDA - day.officeTotals.GERMANTOWN);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        {OFFICES.map((office) => (
          <div
            key={office}
            className={`rounded-2xl border-2 p-4 ${
              day.needsMoreStaffing === office ? "border-amber-300 accent-bg-softer" : "accent-border-soft"
            }`}
          >
            <div className="text-sm font-bold opacity-60">{OFFICE_LABELS[office]} — patients today</div>
            <div className="text-2xl font-extrabold tracking-tight">{day.officeTotals[office]}</div>
            {day.needsMoreStaffing === office && (
              <div className="mt-1 text-xs font-bold text-amber-700">
                Needs more staffing (+{totalGap} vs. {OFFICE_LABELS[office === "BETHESDA" ? "GERMANTOWN" : "BETHESDA"]})
              </div>
            )}
          </div>
        ))}
      </div>

      {HALVES.map((half) => (
        <div key={half}>
          <h2 className="mb-2 text-lg font-extrabold tracking-tight opacity-80">{HALF_LABELS[half]}</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {OFFICES.map((office) => (
              <OfficeHalfCell
                key={office}
                date={date}
                slot={day.halves[half][office]}
                free={freeStaff[half]}
                onChanged={refresh}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OfficeHalfCell({
  date,
  slot,
  free,
  onChanged,
}: {
  date: string;
  slot: HalfSlot;
  free: FreeStaffMember[];
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  const scribeEligible = free.filter((s) => s.canScribe);
  const xrayEligible = free.filter((s) => s.kind === "XRAY");

  return (
    <div className="accent-border-soft rounded-2xl border-2 p-4">
      <h3 className="mb-3 font-extrabold tracking-tight">{OFFICE_LABELS[slot.office]}</h3>

      {error && <p className="mb-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}

      {slot.providers.length === 0 && (
        <p className="mb-3 text-sm font-bold italic opacity-40">No provider scheduled here.</p>
      )}

      <div className="space-y-1">
        {slot.providers.map((p) => (
          <div key={p.provider.id} className="accent-border-soft border-b-2 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-extrabold tracking-tight">{p.provider.name}</span>
              <PatientCountInput
                date={date}
                half={slot.half}
                providerId={p.provider.id}
                value={p.patientCount}
                onSaved={onChanged}
              />
            </div>
            <div className="mt-1 text-sm">
              {p.scribe ? (
                <span className={`font-bold ${p.scribe.substitute ? "text-amber-700" : "opacity-70"}`}>
                  Scribe: {p.scribe.name} {p.scribe.substitute && "(sub)"}
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-red-600">Scribe: OPEN — needs a sub-scribe</span>
                  <AssignPicker
                    label="Fill in"
                    options={scribeEligible}
                    onAssign={(staffId) =>
                      run(() =>
                        postJSON("/api/assignments", "POST", {
                          date,
                          half: slot.half,
                          office: slot.office,
                          role: "SCRIBE",
                          staffId,
                          providerId: p.provider.id,
                        })
                      )
                    }
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <RoleGroup
        title="Sub-scribes"
        cells={slot.subScribes}
        onRemove={(id) => run(() => postJSON(`/api/assignments/${id}`, "DELETE"))}
      >
        <AssignPicker
          label="Add sub-scribe"
          options={scribeEligible}
          onAssign={(staffId) =>
            run(() =>
              postJSON("/api/assignments", "POST", {
                date,
                half: slot.half,
                office: slot.office,
                role: "SUB_SCRIBE",
                staffId,
              })
            )
          }
        />
      </RoleGroup>

      <RoleGroup
        title="Support / rooming"
        cells={slot.rooming}
        onRemove={(id) => run(() => postJSON(`/api/assignments/${id}`, "DELETE"))}
      >
        <AssignPicker
          label="Add support"
          options={free}
          onAssign={(staffId) =>
            run(() =>
              postJSON("/api/assignments", "POST", {
                date,
                half: slot.half,
                office: slot.office,
                role: "ROOMING",
                staffId,
              })
            )
          }
        />
      </RoleGroup>

      <RoleGroup
        title="X-ray"
        cells={slot.xray}
        onRemove={(id) => run(() => postJSON(`/api/assignments/${id}`, "DELETE"))}
      >
        <AssignPicker
          label="Add x-ray"
          options={xrayEligible}
          onAssign={(staffId) =>
            run(() =>
              postJSON("/api/assignments", "POST", {
                date,
                half: slot.half,
                office: slot.office,
                role: "XRAY",
                staffId,
              })
            )
          }
        />
      </RoleGroup>
    </div>
  );
}

function RoleGroup({
  title,
  cells,
  onRemove,
  children,
}: {
  title: string;
  cells: { id: string; name: string; providerName: string | null }[];
  onRemove: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="accent-border-soft mt-3 border-t-2 pt-3">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide opacity-40">{title}</div>
      {cells.length === 0 && <p className="text-sm font-bold opacity-40">None yet</p>}
      <ul className="mb-2 space-y-1">
        {cells.map((c) => (
          <li key={c.id} className="flex items-center justify-between text-sm font-bold">
            <span>
              {c.name}
              {c.providerName ? ` — supporting ${c.providerName}` : ""}
            </span>
            <button onClick={() => onRemove(c.id)} className="text-xs font-bold text-red-500 opacity-70 hover:opacity-100">
              remove
            </button>
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

function AssignPicker({
  label,
  options,
  onAssign,
}: {
  label: string;
  options: FreeStaffMember[];
  onAssign: (staffId: string) => void;
}) {
  const { currentId } = useWhoAmI();
  const defaultOption = options.find((o) => o.id === currentId) ? currentId! : options[0]?.id ?? "";
  const [selected, setSelected] = useState(defaultOption);

  if (options.length === 0) {
    return <p className="text-xs font-bold opacity-40">No one free for this role right now</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="accent-border-soft border-b-2 bg-transparent py-1 text-sm font-bold outline-none"
        value={selected || options[0].id}
        onChange={(e) => setSelected(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {o.id === currentId ? " (me)" : ""}
          </option>
        ))}
      </select>
      <button
        onClick={() => onAssign(selected || options[0].id)}
        className="accent-border rounded-full border-2 px-4 py-1 text-xs font-bold transition active:scale-95"
      >
        {label}
      </button>
    </div>
  );
}

function PatientCountInput({
  date,
  half,
  providerId,
  value,
  onSaved,
}: {
  date: string;
  half: Half;
  providerId: string;
  value: number | null;
  onSaved: () => void;
}) {
  const [local, setLocal] = useState(value === null ? "" : String(value));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (local === "") return;
    setSaving(true);
    try {
      await postJSON("/api/patient-counts", "PUT", { providerId, date, half, count: Number(local) });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5 text-xs font-bold opacity-60">
      patients
      <input
        type="number"
        min={0}
        className="accent-border-soft w-12 border-b-2 bg-transparent text-right text-sm font-extrabold text-slate-700 opacity-100 outline-none"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={save}
      />
      {saving && <span>…</span>}
    </div>
  );
}
