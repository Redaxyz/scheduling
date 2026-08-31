"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { todayStr } from "@/lib/date";
import { useWhoAmI } from "@/lib/whoami";

type Person = { id: string; name: string };
type AbsenceRow = { id: string; date: string; half: string; reason: string | null; name: string };

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
  staff,
  providers,
  staffAbsences,
  providerAbsences,
}: {
  staff: Person[];
  providers: Person[];
  staffAbsences: AbsenceRow[];
  providerAbsences: AbsenceRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <AbsenceSection
        title="Staff absences"
        people={staff}
        rows={staffAbsences}
        peoplePickerHint="Mark yourself (or a coworker) out."
        onSubmit={(body) => postJSON("/api/absences/staff", "POST", body).then(refresh)}
        onRemove={(id) => postJSON(`/api/absences/staff/${id}`, "DELETE").then(refresh)}
        idField="staffId"
        defaultToSelf
      />
      <AbsenceSection
        title="Doctor absences"
        people={providers}
        rows={providerAbsences}
        peoplePickerHint="Doctors don't use this app — set their time off here on their behalf."
        onSubmit={(body) => postJSON("/api/absences/provider", "POST", body).then(refresh)}
        onRemove={(id) => postJSON(`/api/absences/provider/${id}`, "DELETE").then(refresh)}
        idField="providerId"
      />
    </div>
  );
}

function AbsenceSection({
  title,
  people,
  rows,
  peoplePickerHint,
  onSubmit,
  onRemove,
  idField,
  defaultToSelf,
}: {
  title: string;
  people: Person[];
  rows: AbsenceRow[];
  peoplePickerHint: string;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  onRemove: (id: string) => void;
  idField: "staffId" | "providerId";
  defaultToSelf?: boolean;
}) {
  const { currentId } = useWhoAmI();
  const [personId, setPersonId] = useState(defaultToSelf && currentId ? currentId : people[0]?.id ?? "");
  const today = todayStr();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [half, setHalf] = useState("ALL");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await onSubmit({ [idField]: personId, startDate, endDate, half, reason });
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <h2 className="mb-1 text-lg font-semibold text-slate-700">{title}</h2>
      <p className="mb-3 text-xs text-slate-500">{peoplePickerHint}</p>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="col-span-2">
          Who
          <select
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
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
        <label>
          From
          <input
            type="date"
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <label>
          Which half
          <select
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
            value={half}
            onChange={(e) => setHalf(e.target.value)}
          >
            <option value="ALL">All day</option>
            <option value="AM">Morning only</option>
            <option value="PM">Afternoon only</option>
          </select>
        </label>
        <label>
          Reason (optional)
          <input
            type="text"
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>}

      <button
        onClick={submit}
        disabled={busy || !personId}
        className="mt-3 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Mark absent
      </button>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Upcoming</div>
        {rows.length === 0 && <p className="text-sm text-slate-400">None scheduled</p>}
        <ul className="space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between">
              <span>
                {r.name} — {r.date} ({r.half === "ALL" ? "all day" : r.half}
                {r.reason ? `, ${r.reason}` : ""})
              </span>
              <button onClick={() => onRemove(r.id)} className="text-xs text-red-500 hover:underline">
                cancel
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
