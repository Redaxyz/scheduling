"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useWhoAmI } from "@/lib/whoami";

type AbsenceRow = {
  id: string;
  staffId: string;
  date: string;
  half: string;
  reason: string | null;
  lateMinutes: number | null;
  staff: { name: string };
};

function halfLabel(r: Pick<AbsenceRow, "half" | "lateMinutes">) {
  if (r.half === "ALL") return "all day";
  if (r.half === "CUSTOM") return `${r.lateMinutes}m late`;
  return r.half;
}

async function del(url: string) {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
}

// Reintroduces the removable absences/lateness list the old standalone
// Absences page had, now living under the Schedule tab's staff view instead
// (that page's create-with-reason form is gone — the calendar's click-to-
// toggle and "running late" box cover creating these now; this is just the
// list-and-cancel half of it). Everyone sees and can cancel their own;
// Joanna (manager) sees and can cancel everyone's.
export default function MyAbsencesList() {
  const { current } = useWhoAmI();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState<AbsenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetch("/api/absences/staff")
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setError("Couldn't load your absences"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  if (!current) return null;

  const visible = current.isManager ? rows : rows.filter((r) => r.staffId === current.id);

  async function cancel(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await del(`/api/absences/staff/${id}`);
      load();
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="accent-border-soft rounded-2xl border-2 p-3">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide opacity-40">
        {current.isManager ? "Everyone's absences & lateness" : "Your absences & lateness"}
      </div>
      {error && <p className="mb-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm font-bold opacity-40">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm font-bold opacity-40">None scheduled</p>
      ) : (
        <ul className="space-y-1 text-sm font-bold">
          {visible.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2">
              <span className="truncate">
                {current.isManager ? `${r.staff.name} — ` : ""}
                {r.date} ({halfLabel(r)}
                {r.reason ? `, ${r.reason}` : ""})
              </span>
              <button
                onClick={() => cancel(r.id)}
                disabled={busyId === r.id}
                className="shrink-0 text-xs font-bold text-red-500 opacity-70 hover:opacity-100 disabled:opacity-30"
              >
                cancel
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
