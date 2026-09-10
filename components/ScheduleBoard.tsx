"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DaySchedule, FreeStaffMember, HalfSlot, ProviderCell } from "@/lib/schedule";
import type { SwapRequestView } from "@/lib/swap";
import { HALVES, HALF_LABELS, OFFICES, OFFICE_LABELS, type Half, type Role } from "@/lib/types";
import { useWhoAmI } from "@/lib/whoami";
import { SwapIcon } from "@/components/icons";
import AutoRefresh from "@/components/AutoRefresh";

const SWAP_POLL_MS = 8000;

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
  const { current } = useWhoAmI();
  const currentId = current?.id ?? null;
  const [swapRequests, setSwapRequests] = useState<SwapRequestView[]>([]);

  const loadSwapRequests = useCallback(() => {
    const params = new URLSearchParams({ date });
    if (currentId) params.set("viewerId", currentId);
    fetch(`/api/swap-requests?${params}`)
      .then((r) => r.json())
      .then((data: SwapRequestView[]) => setSwapRequests(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [date, currentId]);

  useEffect(() => {
    loadSwapRequests();
    const id = window.setInterval(loadSwapRequests, SWAP_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadSwapRequests]);

  function refresh() {
    startTransition(() => router.refresh());
    loadSwapRequests();
  }

  return (
    <div className="space-y-8">
      <AutoRefresh intervalMs={20000} />

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
                currentId={currentId}
                swapRequests={swapRequests}
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
  currentId,
  swapRequests,
}: {
  date: string;
  slot: HalfSlot;
  free: FreeStaffMember[];
  reassignable: { id: string; name: string }[];
  onChanged: () => void;
  currentId: string | null;
  swapRequests: SwapRequestView[];
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

  function toggleSwap(position: { role: Role; providerId: string | null; staffId: string }) {
    if (!currentId) return;
    run(() =>
      postJSON("/api/swap-requests", "POST", {
        date,
        half: slot.half,
        office: slot.office,
        role: position.role,
        providerId: position.providerId,
        positionStaffId: position.staffId,
        requestedByStaffId: currentId,
      })
    );
  }

  function respondSwap(requestId: string, accept: boolean) {
    if (!currentId) return;
    run(() => postJSON(`/api/swap-requests/${requestId}`, "POST", { staffId: currentId, accept }));
  }

  const scribeEligible = free.filter((s) => s.canScribe);
  const columnCount = Math.max(slot.providers.length, 1);

  // Bethesda/Germantown always get the same office-identity color everywhere
  // in the app (see lib/colors.ts) — green for Bethesda, a soft dark/slate
  // tone standing in for Germantown's black.
  const officeClass = slot.office === "BETHESDA" ? "border-emerald-200 bg-emerald-50" : "border-slate-300 bg-slate-100";

  return (
    <div className={`rounded-2xl border-2 p-3 transition-colors sm:p-4 ${officeClass}`}>
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
              run={run}
              office={slot.office}
              currentId={currentId}
              swapRequests={swapRequests}
              onToggleSwap={toggleSwap}
              onRespondSwap={respondSwap}
            />
          ))}
        </div>
      )}

      <RoleGroup
        title="Support / rooming"
        role="ROOMING"
        cells={slot.rooming}
        onRemove={(id) => run(() => postJSON(`/api/assignments/${id}`, "DELETE"))}
        onChangeAuto={(staffId) => run(() => postJSON("/api/auto-override", "POST", { staffId, date, half: slot.half }))}
        currentId={currentId}
        swapRequests={swapRequests}
        onToggleSwap={toggleSwap}
        onRespondSwap={respondSwap}
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
        role="XRAY"
        cells={slot.xray}
        onRemove={(id) => run(() => postJSON(`/api/assignments/${id}`, "DELETE"))}
        onChangeAuto={(staffId) => run(() => postJSON("/api/auto-override", "POST", { staffId, date, half: slot.half }))}
        currentId={currentId}
        swapRequests={swapRequests}
        onToggleSwap={toggleSwap}
        onRespondSwap={respondSwap}
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
  run,
  currentId,
  swapRequests,
  onToggleSwap,
  onRespondSwap,
}: {
  date: string;
  half: Half;
  office: HalfSlot["office"];
  cell: ProviderCell;
  scribeEligible: FreeStaffMember[];
  reassignable: { id: string; name: string }[];
  run: (action: () => Promise<unknown>) => Promise<void>;
  currentId: string | null;
  swapRequests: SwapRequestView[];
  onToggleSwap: (position: { role: Role; providerId: string | null; staffId: string }) => void;
  onRespondSwap: (requestId: string, accept: boolean) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="accent-border-soft border-b-2 pb-2">
        <div className="truncate text-sm font-extrabold tracking-tight sm:text-base">
          {cell.provider.name}
          {cell.provider.lateMinutes && <span className="font-bold text-amber-700">{lateTag(cell.provider.lateMinutes)}</span>}
        </div>
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
            <span className="flex shrink-0 items-center gap-1.5">
              <SwapControl
                position={{ role: "SCRIBE", providerId: cell.provider.id, staffId: cell.scribe.staffId }}
                positionName={cell.scribe.name}
                currentId={currentId}
                swapRequests={swapRequests}
                onToggleSwap={onToggleSwap}
                onRespondSwap={onRespondSwap}
              />
              <button
                onClick={() =>
                  cell.scribe!.assignmentId
                    ? run(() => postJSON(`/api/assignments/${cell.scribe!.assignmentId}`, "DELETE"))
                    : run(() => postJSON("/api/auto-override", "POST", { staffId: cell.scribe!.staffId, date, half }))
                }
                className="text-[10px] font-bold text-red-500 opacity-70 hover:opacity-100"
              >
                remove
              </button>
            </span>
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
  role,
  cells,
  onRemove,
  onChangeAuto,
  currentId,
  swapRequests,
  onToggleSwap,
  onRespondSwap,
  children,
}: {
  title: string;
  role: Role;
  cells: { id: string; name: string; staffId: string; providerName: string | null; auto?: boolean; lateMinutes?: number | null }[];
  onRemove: (id: string) => void;
  onChangeAuto: (staffId: string) => void;
  currentId: string | null;
  swapRequests: SwapRequestView[];
  onToggleSwap: (position: { role: Role; providerId: string | null; staffId: string }) => void;
  onRespondSwap: (requestId: string, accept: boolean) => void;
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
              {lateTag(c.lateMinutes ?? null)}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <SwapControl
                position={{ role, providerId: null, staffId: c.staffId }}
                positionName={c.name}
                currentId={currentId}
                swapRequests={swapRequests}
                onToggleSwap={onToggleSwap}
                onRespondSwap={onRespondSwap}
              />
              <button
                onClick={() => (c.auto ? onChangeAuto(c.staffId) : onRemove(c.id))}
                className="text-xs font-bold text-red-500 opacity-70 hover:opacity-100"
              >
                remove
              </button>
            </span>
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


// The two-arrows swap control shown next to a position's remove button.
// Clicking it on your own position broadcasts that you're open to swap it
// (visible to everyone, click again to retract); clicking it on someone
// else's position sends a direct proposal that only they can see and
// accept/deny — accepting trades your current position for theirs.
function SwapControl({
  position,
  positionName,
  currentId,
  swapRequests,
  onToggleSwap,
  onRespondSwap,
}: {
  position: { role: Role; providerId: string | null; staffId: string };
  positionName: string;
  currentId: string | null;
  swapRequests: SwapRequestView[];
  onToggleSwap: (position: { role: Role; providerId: string | null; staffId: string }) => void;
  onRespondSwap: (requestId: string, accept: boolean) => void;
}) {
  if (!currentId) return null;

  const forThis = swapRequests.filter(
    (r) => r.positionStaffId === position.staffId && r.role === position.role && r.providerId === position.providerId
  );
  const isOwner = currentId === position.staffId;
  const incomingToMe = isOwner ? forThis.find((r) => !r.isBroadcast) : undefined;
  const myOutgoing = !isOwner ? forThis.find((r) => !r.isBroadcast && r.requestedByStaffId === currentId) : undefined;
  const broadcast = forThis.find((r) => r.isBroadcast);

  if (incomingToMe) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <span className="text-[10px] font-bold accent-text">{incomingToMe.requestedByStaffName} wants to swap</span>
        <button
          onClick={() => onRespondSwap(incomingToMe.id, true)}
          aria-label="Accept swap"
          title="Accept swap"
          className="rounded-full px-1 text-xs font-extrabold text-emerald-600 hover:opacity-70"
        >
          ✓
        </button>
        <button
          onClick={() => onRespondSwap(incomingToMe.id, false)}
          aria-label="Deny swap"
          title="Deny swap"
          className="rounded-full px-1 text-xs font-extrabold text-red-500 hover:opacity-70"
        >
          ✕
        </button>
      </span>
    );
  }

  let tag: string | null = null;
  let active = false;
  if (myOutgoing) {
    tag = "swap pending";
    active = true;
  } else if (broadcast) {
    tag = "open to swap";
    active = isOwner;
  }

  const label = myOutgoing
    ? "Cancel your swap request"
    : isOwner
      ? broadcast
        ? "Cancel your open-to-swap offer"
        : "Offer to swap this position"
      : `Propose a swap with ${positionName}`;

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {tag && <span className="text-[9px] font-bold uppercase tracking-wide accent-text opacity-80">{tag}</span>}
      <button
        onClick={() => onToggleSwap(position)}
        aria-label={label}
        title={label}
        className={`rounded-full p-0.5 transition ${active ? "accent-text opacity-100" : "opacity-40 hover:opacity-80"}`}
      >
        <SwapIcon className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
