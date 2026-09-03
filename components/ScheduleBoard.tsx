"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AssignmentCell, DaySchedule, FreeStaffMember, HalfSlot, ProviderCell } from "@/lib/schedule";
import { HALVES, HALF_LABELS, OFFICES, OFFICE_LABELS, type Half } from "@/lib/types";
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
              aidCells={slot.subScribes.filter((s) => s.providerId === cell.provider.id)}
              onRemoveAid={(id) => run(() => postJSON(`/api/assignments/${id}`, "DELETE"))}
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
      >
        <TakeRoleButton
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
        <TakeRoleButton
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

function ProviderColumn({
  date,
  half,
  office,
  cell,
  scribeEligible,
  aidCells,
  onRemoveAid,
  onChanged,
  run,
}: {
  date: string;
  half: Half;
  office: HalfSlot["office"];
  cell: ProviderCell;
  scribeEligible: FreeStaffMember[];
  aidCells: AssignmentCell[];
  onRemoveAid: (id: string) => void;
  onChanged: () => void;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <div className="min-w-0">
      <div className="accent-border-soft border-b-2 pb-2">
        <div className="truncate text-sm font-extrabold tracking-tight sm:text-base">{cell.provider.name}</div>
        <PatientCountInput date={date} half={half} providerId={cell.provider.id} value={cell.patientCount} onSaved={onChanged} />
      </div>

      <div className="accent-border-soft border-b-2 py-2">
        <div className="text-[10px] font-bold uppercase tracking-wide opacity-40">Scribe</div>
        {cell.scribe ? (
          <div className={`truncate text-xs font-bold sm:text-sm ${cell.scribe.substitute ? "text-amber-700" : ""}`}>
            {cell.scribe.name}
            {cell.scribe.substitute ? " (sub)" : ""}
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-xs font-bold text-red-600 sm:text-sm">OPEN</div>
            <TakeRoleButton
              compact
              options={scribeEligible}
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

      <div className="py-2">
        <div className="text-[10px] font-bold uppercase tracking-wide opacity-40">Aid</div>
        {aidCells.length === 0 ? (
          <p className="text-xs font-bold opacity-40">None yet</p>
        ) : (
          <ul className="mb-1 space-y-1">
            {aidCells.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-1 text-xs font-bold sm:text-sm">
                <span className="truncate">{c.name}</span>
                <button onClick={() => onRemoveAid(c.id)} className="shrink-0 text-[10px] text-red-500 opacity-70 hover:opacity-100">
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <TakeRoleButton
          compact
          options={scribeEligible}
          onAssign={(staffId) =>
            run(() =>
              postJSON("/api/assignments", "POST", {
                date,
                half,
                office,
                role: "SUB_SCRIBE",
                staffId,
                providerId: cell.provider.id,
              })
            )
          }
        />
      </div>
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
  cells: { id: string; name: string; providerName: string | null; auto?: boolean }[];
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
            <span className={c.auto ? "opacity-70" : ""}>
              {c.name}
              {c.providerName ? ` — supporting ${c.providerName}` : ""}
              {c.auto ? " (default)" : ""}
            </span>
            {c.auto ? (
              <span className="text-xs font-bold opacity-40" title="Mark them absent to open this up for a substitute">
                auto
              </span>
            ) : (
              <button onClick={() => onRemove(c.id)} className="text-xs font-bold text-red-500 opacity-70 hover:opacity-100">
                remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

// Self-service only: shows a single "Add yourself" button when the current
// person is one of the eligible/free options for this slot, nothing
// otherwise. Replaces a name-picker dropdown — nobody assigns anyone but
// themselves, so there's nothing to pick.
function TakeRoleButton({
  options,
  onAssign,
  compact,
}: {
  options: FreeStaffMember[];
  onAssign: (staffId: string) => void;
  compact?: boolean;
}) {
  const { current } = useWhoAmI();
  if (!current || !options.some((o) => o.id === current.id)) return null;

  return (
    <button
      onClick={() => onAssign(current.id)}
      className={`accent-border rounded-full border-2 font-bold transition active:scale-95 ${
        compact ? "w-full px-2 py-1 text-[11px]" : "px-4 py-1 text-xs"
      }`}
    >
      Add yourself
    </button>
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
