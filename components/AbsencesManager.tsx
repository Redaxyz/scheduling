"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { todayStr } from "@/lib/date";
import { useWhoAmI } from "@/lib/whoami";

type Person = { id: string; name: string };
type AbsenceRow = {
  id: string;
  date: string;
  half: string;
  reason: string | null;
  lateMinutes: number | null;
  name: string;
  ownerId: string;
};

function halfLabel(r: Pick<AbsenceRow, "half" | "lateMinutes">) {
  if (r.half === "ALL") return "all day";
  if (r.half === "CUSTOM") return `${r.lateMinutes}m late`;
  return r.half;
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

export default function AbsencesManager({
  providers,
  staffAbsences,
  providerAbsences,
}: {
  providers: Person[];
  staffAbsences: AbsenceRow[];
  providerAbsences: AbsenceRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());
  const { current, staffList } = useWhoAmI();

  // Managers (e.g. Joanna) see and log time off for anyone on staff; everyone
  // else only ever sees/logs their own.
  const myStaffAbsences = current
    ? current.isManager
      ? staffAbsences
      : staffAbsences.filter((a) => a.ownerId === current.id)
    : [];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {current?.isManager ? (
        <AbsenceSection
          title="Staff absences"
          people={staffList}
          rows={myStaffAbsences}
          peoplePickerHint="As the manager, you can log time off for any staff member."
          onSubmit={(body) => postJSON("/api/absences/staff", "POST", body).then(refresh)}
          onUpdate={(id, body) => postJSON(`/api/absences/staff/${id}`, "PATCH", body).then(refresh)}
          onRemove={(id) => postJSON(`/api/absences/staff/${id}`, "DELETE").then(refresh)}
          idField="staffId"
        />
      ) : (
        <StaffAbsenceSection
          rows={myStaffAbsences}
          onSubmit={(body) => postJSON("/api/absences/staff", "POST", body).then(refresh)}
          onUpdate={(id, body) => postJSON(`/api/absences/staff/${id}`, "PATCH", body).then(refresh)}
          onRemove={(id) => postJSON(`/api/absences/staff/${id}`, "DELETE").then(refresh)}
        />
      )}
      <AbsenceSection
        title="Doctor absences"
        people={providers}
        rows={providerAbsences}
        peoplePickerHint="Doctors don't use this app — anyone can set their time off here on their behalf."
        onSubmit={(body) => postJSON("/api/absences/provider", "POST", body).then(refresh)}
        onUpdate={(id, body) => postJSON(`/api/absences/provider/${id}`, "PATCH", body).then(refresh)}
        onRemove={(id) => postJSON(`/api/absences/provider/${id}`, "DELETE").then(refresh)}
        idField="providerId"
      />
    </div>
  );
}

function StaffAbsenceSection({
  rows,
  onSubmit,
  onUpdate,
  onRemove,
}: {
  rows: AbsenceRow[];
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, body: Record<string, unknown>) => Promise<void>;
  onRemove: (id: string) => void;
}) {
  const { current } = useWhoAmI();
  const today = todayStr();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [half, setHalf] = useState("ALL");
  const [lateMinutes, setLateMinutes] = useState("30");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setEditingId(null);
    setStartDate(today);
    setEndDate(today);
    setHalf("ALL");
    setLateMinutes("30");
    setReason("");
    setError(null);
  }

  function startEdit(r: AbsenceRow) {
    setEditingId(r.id);
    setStartDate(r.date);
    setEndDate(r.date);
    setHalf(r.half);
    setLateMinutes(r.lateMinutes ? String(r.lateMinutes) : "30");
    setReason(r.reason ?? "");
    setError(null);
  }

  async function submit() {
    if (!current) return;
    setError(null);
    setBusy(true);
    try {
      if (editingId) {
        await onUpdate(editingId, { date: startDate, half, reason, lateMinutes: Number(lateMinutes) });
        resetForm();
      } else {
        await onSubmit({ staffId: current.id, startDate, endDate, half, reason, lateMinutes: Number(lateMinutes) });
        setReason("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="accent-border-soft rounded-2xl border-2 p-4">
      <h2 className="mb-1 text-lg font-extrabold tracking-tight">Your absences</h2>
      <p className="mb-3 text-xs font-bold opacity-50">
        {current ? `Logging time off for ${current.name}. Each person can only log their own.` : "Pick your name (top right) to log time off."}
      </p>

      {current && (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="font-bold opacity-60">
              {editingId ? "Date" : "From"}
              <input
                type="date"
                className="accent-border-soft mt-0.5 block w-full border-b-2 bg-transparent py-1 font-extrabold text-slate-700 outline-none"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            {!editingId && (
              <label className="font-bold opacity-60">
                To
                <input
                  type="date"
                  className="accent-border-soft mt-0.5 block w-full border-b-2 bg-transparent py-1 font-extrabold text-slate-700 outline-none"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>
            )}
            <label className="col-span-2 font-bold opacity-60">
              Which half
              <select
                className="accent-border-soft mt-0.5 block w-full border-b-2 bg-transparent py-1 font-extrabold text-slate-700 outline-none"
                value={half}
                onChange={(e) => setHalf(e.target.value)}
              >
                <option value="ALL">All day</option>
                <option value="AM">Morning only</option>
                <option value="PM">Afternoon only</option>
                <option value="CUSTOM">Custom (running late)</option>
              </select>
            </label>
            {half === "CUSTOM" && (
              <label className="col-span-2 font-bold opacity-60">
                Minutes late
                <input
                  type="number"
                  min={15}
                  step={15}
                  max={480}
                  className="accent-border-soft mt-0.5 block w-full border-b-2 bg-transparent py-1 font-extrabold text-slate-700 outline-none"
                  value={lateMinutes}
                  onChange={(e) => setLateMinutes(e.target.value)}
                />
              </label>
            )}
            <label className="col-span-2 font-bold opacity-60">
              Reason (optional)
              <input
                type="text"
                className="accent-border-soft mt-0.5 block w-full border-b-2 bg-transparent py-1 font-extrabold text-slate-700 outline-none"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </div>

          {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={submit}
              disabled={busy}
              className="accent-border rounded-full border-2 px-4 py-1.5 text-sm font-bold transition active:scale-95 disabled:opacity-40"
            >
              {editingId ? "Save changes" : "Mark absent"}
            </button>
            {editingId && (
              <button onClick={resetForm} className="text-xs font-bold opacity-60 hover:opacity-100">
                Cancel edit
              </button>
            )}
          </div>
        </>
      )}

      <div className="accent-border-soft mt-4 border-t-2 pt-3">
        <div className="mb-1 text-xs font-bold uppercase tracking-wide opacity-40">Upcoming</div>
        {rows.length === 0 && <p className="text-sm font-bold opacity-40">None scheduled</p>}
        <ul className="space-y-1 text-sm font-bold">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between">
              <span>
                {r.date} ({halfLabel(r)}
                {r.reason ? `, ${r.reason}` : ""})
              </span>
              <span className="flex shrink-0 gap-2">
                <button onClick={() => startEdit(r)} className="text-xs font-bold opacity-60 hover:opacity-100">
                  edit
                </button>
                <button onClick={() => onRemove(r.id)} className="text-xs font-bold text-red-500 opacity-70 hover:opacity-100">
                  cancel
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AbsenceSection({
  title,
  people,
  rows,
  peoplePickerHint,
  onSubmit,
  onUpdate,
  onRemove,
  idField,
}: {
  title: string;
  people: Person[];
  rows: AbsenceRow[];
  peoplePickerHint: string;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, body: Record<string, unknown>) => Promise<void>;
  onRemove: (id: string) => void;
  idField: "staffId" | "providerId";
}) {
  const today = todayStr();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [half, setHalf] = useState("ALL");
  const [lateMinutes, setLateMinutes] = useState("30");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setEditingId(null);
    setStartDate(today);
    setEndDate(today);
    setHalf("ALL");
    setLateMinutes("30");
    setReason("");
    setError(null);
  }

  function startEdit(r: AbsenceRow) {
    setEditingId(r.id);
    setStartDate(r.date);
    setEndDate(r.date);
    setHalf(r.half);
    setLateMinutes(r.lateMinutes ? String(r.lateMinutes) : "30");
    setReason(r.reason ?? "");
    setError(null);
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (editingId) {
        await onUpdate(editingId, { date: startDate, half, reason, lateMinutes: Number(lateMinutes) });
        resetForm();
      } else {
        await onSubmit({ [idField]: personId, startDate, endDate, half, reason, lateMinutes: Number(lateMinutes) });
        setReason("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="accent-border-soft rounded-2xl border-2 p-4">
      <h2 className="mb-1 text-lg font-extrabold tracking-tight">{title}</h2>
      <p className="mb-3 text-xs font-bold opacity-50">{peoplePickerHint}</p>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {!editingId && (
          <label className="col-span-2 font-bold opacity-60">
            Who
            <select
              className="accent-border-soft mt-0.5 block w-full border-b-2 bg-transparent py-1 font-extrabold text-slate-700 outline-none"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="font-bold opacity-60">
          {editingId ? "Date" : "From"}
          <input
            type="date"
            className="accent-border-soft mt-0.5 block w-full border-b-2 bg-transparent py-1 font-extrabold text-slate-700 outline-none"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        {!editingId && (
          <label className="font-bold opacity-60">
            To
            <input
              type="date"
              className="accent-border-soft mt-0.5 block w-full border-b-2 bg-transparent py-1 font-extrabold text-slate-700 outline-none"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        )}
        <label className="font-bold opacity-60">
          Which half
          <select
            className="accent-border-soft mt-0.5 block w-full border-b-2 bg-transparent py-1 font-extrabold text-slate-700 outline-none"
            value={half}
            onChange={(e) => setHalf(e.target.value)}
          >
            <option value="ALL">All day</option>
            <option value="AM">Morning only</option>
            <option value="PM">Afternoon only</option>
            <option value="CUSTOM">Custom (running late)</option>
          </select>
        </label>
        {half === "CUSTOM" && (
          <label className="font-bold opacity-60">
            Minutes late
            <input
              type="number"
              min={15}
              step={15}
              max={480}
              className="accent-border-soft mt-0.5 block w-full border-b-2 bg-transparent py-1 font-extrabold text-slate-700 outline-none"
              value={lateMinutes}
              onChange={(e) => setLateMinutes(e.target.value)}
            />
          </label>
        )}
        <label className="font-bold opacity-60">
          Reason (optional)
          <input
            type="text"
            className="accent-border-soft mt-0.5 block w-full border-b-2 bg-transparent py-1 font-extrabold text-slate-700 outline-none"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={busy || (!editingId && !personId)}
          className="accent-border rounded-full border-2 px-4 py-1.5 text-sm font-bold transition active:scale-95 disabled:opacity-40"
        >
          {editingId ? "Save changes" : "Mark absent"}
        </button>
        {editingId && (
          <button onClick={resetForm} className="text-xs font-bold opacity-60 hover:opacity-100">
            Cancel edit
          </button>
        )}
      </div>

      <div className="accent-border-soft mt-4 border-t-2 pt-3">
        <div className="mb-1 text-xs font-bold uppercase tracking-wide opacity-40">Upcoming</div>
        {rows.length === 0 && <p className="text-sm font-bold opacity-40">None scheduled</p>}
        <ul className="space-y-1 text-sm font-bold">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between">
              <span>
                {r.name} — {r.date} ({halfLabel(r)}
                {r.reason ? `, ${r.reason}` : ""})
              </span>
              <span className="flex shrink-0 gap-2">
                <button onClick={() => startEdit(r)} className="text-xs font-bold opacity-60 hover:opacity-100">
                  edit
                </button>
                <button onClick={() => onRemove(r.id)} className="text-xs font-bold text-red-500 opacity-70 hover:opacity-100">
                  cancel
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
