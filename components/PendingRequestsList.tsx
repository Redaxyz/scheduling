"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useWhoAmI } from "@/lib/whoami";
import { formatShort, nextBusinessDay } from "@/lib/date";

type AbsenceRow = {
  id: string;
  staffId: string;
  date: string;
  half: string;
  reason: string | null;
  status: string;
  staff: { name: string };
};

type Group = {
  ids: string[];
  staffId: string;
  staffName: string;
  half: string;
  reason: string | null;
  startDate: string;
  endDate: string;
};

// Consecutive-day requests from the same person read as one approval, not
// one per calendar tap — a weekend doesn't break the streak (Thu+Fri+Mon+Tue
// is one continuous request), but a business day gap does (Thu+Fri then
// Tue+Wed, skipping Monday, is two).
function groupPending(rows: AbsenceRow[]): Group[] {
  const byKey = new Map<string, AbsenceRow[]>();
  for (const r of rows) {
    const key = `${r.staffId}:${r.half}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(r);
  }

  const groups: Group[] = [];
  for (const entries of byKey.values()) {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    let run: AbsenceRow[] = [];
    for (const row of sorted) {
      if (run.length > 0 && nextBusinessDay(run[run.length - 1].date) !== row.date) {
        groups.push(toGroup(run));
        run = [];
      }
      run.push(row);
    }
    if (run.length > 0) groups.push(toGroup(run));
  }
  return groups.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function toGroup(rows: AbsenceRow[]): Group {
  return {
    ids: rows.map((r) => r.id),
    staffId: rows[0].staffId,
    staffName: rows[0].staff.name,
    half: rows[0].half,
    reason: rows.find((r) => r.reason)?.reason ?? null,
    startDate: rows[0].date,
    endDate: rows[rows.length - 1].date,
  };
}

function dateRangeLabel(g: Group) {
  return g.startDate === g.endDate ? formatShort(g.startDate) : `${formatShort(g.startDate)} – ${formatShort(g.endDate)}`;
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
}

// The day-off requests still awaiting a decision — see the StaffAbsence
// schema comment. Sits above the general absences/lateness list so what
// actually needs action doesn't get lost among everything already settled.
// Everyone sees (and can withdraw) their own; Joanna sees everyone's and can
// approve or decline any of them.
export default function PendingRequestsList() {
  const { current } = useWhoAmI();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState<AbsenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function load() {
    fetch("/api/absences/staff")
      .then((r) => r.json())
      .then((data: AbsenceRow[]) => setRows(Array.isArray(data) ? data.filter((r) => r.status === "PENDING") : []))
      .catch(() => setError("Couldn't load requests"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  if (!current) return null;

  const groups = groupPending(rows).filter((g) => current.isManager || g.staffId === current.id);

  async function respond(group: Group, action: "approve" | "decline") {
    setBusyKey(group.ids.join(","));
    setError(null);
    try {
      await Promise.all(
        group.ids.map((id) =>
          action === "approve"
            ? postJSON(`/api/absences/staff/${id}`, "PATCH", { approvedByStaffId: current!.id })
            : postJSON(`/api/absences/staff/${id}`, "DELETE")
        )
      );
      load();
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusyKey(null);
    }
  }

  if (!loading && groups.length === 0) return null;

  return (
    <div className="accent-border-soft rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-3">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-700">
        {current.isManager ? "Requests awaiting your approval" : "Your requests awaiting approval"}
      </div>
      {error && <p className="mb-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm font-bold opacity-40">Loading…</p>
      ) : (
        <ul className="space-y-1 text-sm font-bold">
          {groups.map((g) => {
            const key = g.ids.join(",");
            return (
              <li key={key} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {current.isManager ? `${g.staffName} — ` : ""}
                  {dateRangeLabel(g)}
                  {g.reason ? ` (${g.reason})` : ""}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {current.isManager && (
                    <button
                      onClick={() => respond(g, "approve")}
                      disabled={busyKey === key}
                      className="text-xs font-bold text-emerald-600 opacity-70 hover:opacity-100 disabled:opacity-30"
                    >
                      approve
                    </button>
                  )}
                  <button
                    onClick={() => respond(g, "decline")}
                    disabled={busyKey === key}
                    className="text-xs font-bold text-red-500 opacity-70 hover:opacity-100 disabled:opacity-30"
                  >
                    {current.isManager ? "decline" : "withdraw"}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
