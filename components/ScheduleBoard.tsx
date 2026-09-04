"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DaySchedule, FreeStaffMember, HalfSlot, ProviderCell } from "@/lib/schedule";
import { HALVES, HALF_LABELS, OFFICES, OFFICE_LABELS, type Half } from "@/lib/types";
import { useWhoAmI } from "@/lib/whoami";

type Props = {
  date: string;
  day: DaySchedule;
  freeStaff: Record<Half, FreeStaffMember[]>;
};

function lateTag(lateMinutes: number | null) {
  return lateMinutes ? ` (${lateMinutes}m late)` : "";
}

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
                reassignable={day.reassignable[half]}
                onChanged={refresh}
              />
            ))}
          </div>
          {day.unassigned[half].length > 0 && (
            <p className="mt-3 text-xs font-bold opacity-50">
              Not assigned to a location: {day.unassigned[half].map((s) => s.name).join(", ")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function OfficeHalfCell({
  date,
  slot,
  free,
  reassignable,
  onChanged,
}: {
  date: string;
  slot: HalfSlot;
  free: FreeStaffMember[];
  reassignable: { id: string; name: string }[];
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
  const columnCount = Math.max(slot.providers.length, 1);

  const balanceClass =
    slot.balance === "GOOD"
      ? "border-emerald-200 bg-emerald-50"
      : slot.balance === "NEEDS_HELP"
        ? "border-red-200 bg-red-50"
        : "accent-border-soft";

  return (
    <div className={`rounded-2xl border-2 p-3 transition-colors sm:p-4 ${balanceClass}`}>
      <h3 className="mb-3 font-extrabold tracking-tight">{OFFICE_LABELS[slot.office]}</h3>

      {error && <p className="mb-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}

      {slot.providers.length === 0 ? (
        <p className="mb-3 text-sm font-bold italic opacity-40">No provider scheduled here.</p>
      ) : (
        <div className="grid gap-x-3 gap-y-2" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
          {slot.providers.map((cell) => (
            <ProviderColumn
              key={cell.provider.id}
              date={date}
              half={slot.half}
              cell={cell}
              scribeEligible={scribeEligible}
              reassignable={reassignable}
              onChanged={onChanged}
              run={run}
              office={slot.office}
            />
          ))}
        </div>
      )}

      <RoleGroup
        title="Support / rooming"
        cells={slot.rooming}
        onRemove={(id) => run(() => postJSON(`/api/assignments/${id}`, "DELETE"))}
        onChangeAuto={(staffId) => run(() => postJSON("/api/auto-override", "POST", { staffId, date, half: slot.half }))}
      >
        <TakeRoleButton
          options={free}
          reassignable={reassignable}
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
        onChangeAuto={(staffId) => run(() => postJSON("/api/auto-override", "POST", { staffId, date, half: slot.half }))}
      >
        <TakeRoleButton
          options={slot.xrayEligible}
          reassignable={reassignable}
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

function ProviderColumn({
  date,
  half,
  office,
  cell,
  scribeEligible,
  reassignable,
  onChanged,
  run,
}: {
  date: string;
  half: Half;
  office: HalfSlot["office"];
  cell: ProviderCell;
  scribeEligible: FreeStaffMember[];
  reassignable: { id: string; name: string }[];
  onChanged: () => void;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <div className="min-w-0">
      <div className="accent-border-soft border-b-2 pb-2">
        <div className="truncate text-sm font-extrabold tracking-tight sm:text-base">
          {cell.provider.name}
          {cell.provider.lateMinutes && <span className="font-bold text-amber-700">{lateTag(cell.provider.lateMinutes)}</span>}
        </div>
        <PatientCountInput date={date} half={half} providerId={cell.provider.id} value={cell.patientCount} onSaved={onChanged} />
      </div>

      <div className="accent-border-soft border-b-2 py-2">
        <div className="text-[10px] font-bold uppercase tracking-wide opacity-40">Scribe</div>
        {cell.scribe ? (
          <div className="flex items-center justify-between gap-1">
            <span className={`truncate text-xs font-bold sm:text-sm ${cell.scribe.substitute ? "text-amber-700" : ""}`}>
              {cell.scribe.name}
              {cell.scribe.substitute ? " (sub)" : ""}
              {lateTag(cell.scribe.lateMinutes)}
            </span>
            <button
              onClick={() =>
                cell.scribe!.assignmentId
                  ? run(() => postJSON(`/api/assignments/${cell.scribe!.assignmentId}`, "DELETE"))
                  : run(() => postJSON("/api/auto-override", "POST", { staffId: cell.scribe!.staffId, date, half }))
              }
              className="shrink-0 text-[10px] font-bold text-red-500 opacity-70 hover:opacity-100"
            >
              remove
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-xs font-bold text-red-600 sm:text-sm">OPEN</div>
            <TakeRoleButton
              compact
              options={scribeEligible}
              reassignable={reassignable}
              onAssign={(staffId) =>
                run(() =>
                  postJSON("/api/assignments", "POST", {
                    date,
                    half,
                    office,
                    role: "SCRIBE",
                    staffId,
                    providerId: cell.provider.id,
                  })
                )
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RoleGroup({
  title,
  cells,
  onRemove,
  onChangeAuto,
  children,
}: {
  title: string;
  cells: { id: string; name: string; staffId: string; providerName: string | null; auto?: boolean; lateMinutes?: number | null }[];
  onRemove: (id: string) => void;
  onChangeAuto: (staffId: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="accent-border-soft mt-3 border-t-2 pt-3">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide opacity-40">{title}</div>
      {cells.length === 0 && <p className="text-sm font-bold opacity-40">None yet</p>}
      <ul className="mb-2 space-y-1">
        {cells.map((c) => (
          <li key={c.id} className="flex items-center justify-between text-sm font-bold">
            <span className={c.auto ? "opacity-70" : ""}>
              {c.name}
              {c.providerName ? ` — supporting ${c.providerName}` : ""}
              {c.auto ? " (default)" : ""}
              {lateTag(c.lateMinutes ?? null)}
            </span>
            <button
              onClick={() => (c.auto ? onChangeAuto(c.staffId) : onRemove(c.id))}
              className="text-xs font-bold text-red-500 opacity-70 hover:opacity-100"
            >
              remove
            </button>
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

// Self-service by default: shows "Add yourself" when the current person is
// one of the eligible/free options for this slot, nothing otherwise — no
// picking someone else. Two exceptions: a person flagged addableByAnyone
// (e.g. Lester, a floating backup without his own regular login habit) gets
// their own always-visible "Add <name>" button; and a manager (Joanna),
// logged in as herself, can add ANY eligible option here, not just herself —
// but only options who are `reassignable` this half. Someone already
// scribing a doctor or doing x-ray elsewhere doesn't show up for the
// manager to add elsewhere — she has to remove them first, so she never
// accidentally pulls someone away from a real commitment. Generic rooming
// support doesn't count as a commitment, so it doesn't block reassignment.
function TakeRoleButton({
  options,
  reassignable,
  onAssign,
  compact,
}: {
  options: FreeStaffMember[];
  reassignable: { id: string; name: string }[];
  onAssign: (staffId: string) => void;
  compact?: boolean;
}) {
  const { current } = useWhoAmI();
  const btnClass = `accent-border rounded-full border-2 font-bold transition active:scale-95 ${
    compact ? "w-full px-2 py-1 text-[11px]" : "px-4 py-1 text-xs"
  }`;

  if (current?.isManager) {
    const reassignableIds = new Set(reassignable.map((u) => u.id));
    const managerOptions = options.filter((o) => reassignableIds.has(o.id));
    if (managerOptions.length === 0) return null;
    return (
      <div className={compact ? "flex flex-col gap-1" : "flex flex-wrap gap-2"}>
        {managerOptions.map((o) => (
          <button key={o.id} onClick={() => onAssign(o.id)} className={btnClass}>
            Add {o.id === current.id ? "yourself" : o.name}
          </button>
        ))}
      </div>
    );
  }

  const self = current && options.some((o) => o.id === current.id) ? current : null;
  const anyoneOptions = options.filter((o) => o.addableByAnyone && o.id !== self?.id);

  if (!self && anyoneOptions.length === 0) return null;

  return (
    <div className={compact ? "flex flex-col gap-1" : "flex flex-wrap gap-2"}>
      {self && (
        <button onClick={() => onAssign(self.id)} className={btnClass}>
          Add yourself
        </button>
      )}
      {anyoneOptions.map((o) => (
        <button key={o.id} onClick={() => onAssign(o.id)} className={btnClass}>
          Add {o.name}
        </button>
      ))}
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
