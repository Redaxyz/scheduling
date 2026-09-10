"use client";

import { useCallback, useEffect, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import type { DaySchedule, FreeStaffMember, HalfSlot, PositionRef, ProviderCell } from "@/lib/schedule";
import type { SwapRequestView } from "@/lib/swap";
import { HALVES, HALF_LABELS, OFFICES, OFFICE_LABELS, type Half, type Office, type Role } from "@/lib/types";
import { useWhoAmI } from "@/lib/whoami";
import { SwapIcon } from "@/components/icons";
import AutoRefresh from "@/components/AutoRefresh";

const SWAP_POLL_MS = 8000;
const DRAG_MIME = "application/x-cfa-position";

type Props = {
  date: string;
  day: DaySchedule;
  freeStaff: Record<Half, FreeStaffMember[]>;
};

type DropTarget = { role: Role; office: Office; providerId: string | null };

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

// Drag-and-drop a manager's way of reassigning someone: delete their old
// real assignment (if they had one — a computed default just gets silently
// superseded once the new one exists, see getDaySchedule's isStaffAssigned
// checks), then create the new one. A drop back onto the exact slot it came
// from is a no-op rather than a pointless delete+recreate round-trip.
async function moveStaff(date: string, half: Half, source: PositionRef, target: DropTarget) {
  if (source.role === target.role && source.office === target.office && source.providerId === target.providerId) return;
  if (source.assignmentId) {
    await postJSON(`/api/assignments/${source.assignmentId}`, "DELETE");
  }
  await postJSON("/api/assignments", "POST", {
    date,
    half,
    office: target.office,
    role: target.role,
    staffId: source.staffId,
    providerId: target.providerId ?? undefined,
  });
}

function readDragPosition(e: DragEvent): PositionRef | null {
  const raw = e.dataTransfer.getData(DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PositionRef;
  } catch {
    return null;
  }
}

export default function ScheduleBoard({ date, day, freeStaff }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { current } = useWhoAmI();
  const currentId = current?.id ?? null;
  const isManager = current?.isManager ?? false;
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
                isManager={isManager}
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
  isManager,
  swapRequests,
}: {
  date: string;
  slot: HalfSlot;
  free: FreeStaffMember[];
  reassignable: { id: string; name: string }[];
  onChanged: () => void;
  currentId: string | null;
  isManager: boolean;
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

  function dropOnto(target: DropTarget) {
    return (source: PositionRef) => run(() => moveStaff(date, slot.half, source, target));
  }

  const scribeEligible = free.filter((s) => s.canScribe);
  const columnCount = Math.max(slot.providers.length, 1);

  // Bethesda/Germantown always get the same office-identity color everywhere
  // in the app (see lib/colors.ts) — white for Bethesda, near-black for
  // Germantown, which is why the dark card needs its own light text below.
  const dark = slot.office === "GERMANTOWN";
  const officeClass = dark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-300 bg-white";

  return (
    <div className={`rounded-2xl border-2 p-3 transition-colors sm:p-4 ${officeClass}`}>
      <h3 className="mb-3 font-extrabold tracking-tight">{OFFICE_LABELS[slot.office]}</h3>

      {error && <p className="mb-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}

      {slot.providers.length === 0 ? (
        <p className={`mb-3 text-sm font-bold italic ${dark ? "text-white/40" : "opacity-40"}`}>No provider scheduled here.</p>
      ) : (
        <div className="grid gap-x-3 gap-y-2" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
          {slot.providers.map((cell) => (
            <ProviderColumn
              key={cell.provider.id}
              date={date}
              half={slot.half}
              office={slot.office}
              cell={cell}
              scribeEligible={scribeEligible}
              reassignable={reassignable}
              run={run}
              currentId={currentId}
              isManager={isManager}
              dark={dark}
              swapRequests={swapRequests}
              onToggleSwap={toggleSwap}
              onRespondSwap={respondSwap}
              onDropStaff={dropOnto({ role: "SCRIBE", office: slot.office, providerId: cell.provider.id })}
            />
          ))}
        </div>
      )}

      <RoleGroup
        title="Support / rooming"
        role="ROOMING"
        office={slot.office}
        half={slot.half}
        cells={slot.rooming}
        onRemove={(id) => run(() => postJSON(`/api/assignments/${id}`, "DELETE"))}
        onChangeAuto={(staffId) => run(() => postJSON("/api/auto-override", "POST", { staffId, date, half: slot.half }))}
        currentId={currentId}
        isManager={isManager}
        dark={dark}
        swapRequests={swapRequests}
        onToggleSwap={toggleSwap}
        onRespondSwap={respondSwap}
        onDropStaff={dropOnto({ role: "ROOMING", office: slot.office, providerId: null })}
      >
        <TakeRoleButton
          dark={dark}
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
        office={slot.office}
        half={slot.half}
        cells={slot.xray}
        onRemove={(id) => run(() => postJSON(`/api/assignments/${id}`, "DELETE"))}
        onChangeAuto={(staffId) => run(() => postJSON("/api/auto-override", "POST", { staffId, date, half: slot.half }))}
        currentId={currentId}
        isManager={isManager}
        dark={dark}
        swapRequests={swapRequests}
        onToggleSwap={toggleSwap}
        onRespondSwap={respondSwap}
        onDropStaff={dropOnto({ role: "XRAY", office: slot.office, providerId: null })}
      >
        <TakeRoleButton
          dark={dark}
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

// A colored name chip — every person gets one, everywhere, using their own
// Staff.color (matching the picker, calendars, etc.). Only a manager's pills
// are draggable; everyone else just sees a clean, static chip. `onRemove`
// (manager-only — see canRemove below) adds a small × built into the chip's
// right edge instead of a separate "remove" link.
function Pill({
  name,
  color,
  lateMinutes,
  substitute,
  draggable,
  position,
  onRemove,
}: {
  name: string;
  color: string;
  lateMinutes?: number | null;
  substitute?: boolean;
  draggable?: boolean;
  position?: PositionRef;
  onRemove?: () => void;
}) {
  function onDragStart(e: DragEvent) {
    if (!position) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(position));
  }

  return (
    <span
      draggable={draggable}
      onDragStart={onDragStart}
      title={draggable ? `Drag ${name} to move them` : name}
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-full py-1 text-xs font-bold text-slate-700 ${
        onRemove ? "py-0.5 pl-2.5 pr-0.5" : "px-2.5"
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${substitute ? "ring-2 ring-amber-500 ring-offset-1" : ""}`}
      style={{ background: color }}
    >
      <span className="truncate">{name}</span>
      {lateMinutes ? <span className="shrink-0 opacity-70">{lateTag(lateMinutes)}</span> : null}
      {onRemove && (
        <button
          type="button"
          draggable={false}
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          title={`Remove ${name}`}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full leading-none text-slate-700/70 transition hover:bg-black/10 hover:text-slate-900"
        >
          ×
        </button>
      )}
    </span>
  );
}

// Drop target wrapper: a manager dragging a pill here reassigns them, with a
// dashed highlight while something's hovering over it. No-op for anyone
// else — their pills were never draggable in the first place.
function DropZone({
  active,
  onDrop,
  className,
  children,
}: {
  active: boolean;
  onDrop: (source: PositionRef) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);

  if (!active) return <div className={className}>{children}</div>;

  return (
    <div
      className={`rounded-xl transition ${over ? "bg-white/70 ring-2 ring-dashed ring-slate-400" : ""} ${className ?? ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const source = readDragPosition(e);
        if (source) onDrop(source);
      }}
    >
      {children}
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
  isManager,
  dark,
  swapRequests,
  onToggleSwap,
  onRespondSwap,
  onDropStaff,
}: {
  date: string;
  half: Half;
  office: Office;
  cell: ProviderCell;
  scribeEligible: FreeStaffMember[];
  reassignable: { id: string; name: string }[];
  run: (action: () => Promise<unknown>) => Promise<void>;
  currentId: string | null;
  isManager: boolean;
  dark: boolean;
  swapRequests: SwapRequestView[];
  onToggleSwap: (position: { role: Role; providerId: string | null; staffId: string }) => void;
  onRespondSwap: (requestId: string, accept: boolean) => void;
  onDropStaff: (source: PositionRef) => void;
}) {
  const canRemove = cell.scribe && (isManager || cell.scribe.staffId === currentId);
  const removeScribe = () =>
    cell.scribe!.assignmentId
      ? run(() => postJSON(`/api/assignments/${cell.scribe!.assignmentId}`, "DELETE"))
      : run(() => postJSON("/api/auto-override", "POST", { staffId: cell.scribe!.staffId, date, half }));
  const borderClass = dark ? "border-white/20" : "accent-border-soft";

  return (
    <div className="min-w-0">
      <div className={`border-b-2 pb-2 ${borderClass}`}>
        <div className="truncate text-sm font-extrabold tracking-tight sm:text-base">
          {cell.provider.name}
          {cell.provider.lateMinutes && (
            <span className={`font-bold ${dark ? "text-amber-400" : "text-amber-700"}`}>{lateTag(cell.provider.lateMinutes)}</span>
          )}
        </div>
      </div>

      <DropZone active={isManager} onDrop={onDropStaff} className="py-2">
        <div className={`border-b-2 pb-2 ${borderClass}`}>
          <div className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${dark ? "text-white/40" : "opacity-40"}`}>Scribe</div>
          {cell.scribe ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill
                name={cell.scribe.name}
                color={cell.scribe.color}
                lateMinutes={cell.scribe.lateMinutes}
                substitute={cell.scribe.substitute}
                draggable={isManager}
                position={{ office, half, role: "SCRIBE", providerId: cell.provider.id, staffId: cell.scribe.staffId, assignmentId: cell.scribe.assignmentId }}
                onRemove={isManager && canRemove ? removeScribe : undefined}
              />
              <span className="flex shrink-0 items-center gap-1.5">
                {!isManager && (
                  <SwapControl
                    position={{ role: "SCRIBE", providerId: cell.provider.id, staffId: cell.scribe.staffId }}
                    positionName={cell.scribe.name}
                    currentId={currentId}
                    dark={dark}
                    swapRequests={swapRequests}
                    onToggleSwap={onToggleSwap}
                    onRespondSwap={onRespondSwap}
                  />
                )}
                {canRemove && !isManager && (
                  <button onClick={removeScribe} className="text-[10px] font-bold text-red-500 opacity-70 hover:opacity-100">
                    remove
                  </button>
                )}
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className={`text-xs font-bold sm:text-sm ${dark ? "text-red-400" : "text-red-600"}`}>OPEN</div>
              <TakeRoleButton
                compact
                dark={dark}
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
      </DropZone>
    </div>
  );
}

function RoleGroup({
  title,
  role,
  office,
  half,
  cells,
  onRemove,
  onChangeAuto,
  currentId,
  isManager,
  dark,
  swapRequests,
  onToggleSwap,
  onRespondSwap,
  onDropStaff,
  children,
}: {
  title: string;
  role: Role;
  office: Office;
  half: Half;
  cells: { id: string; name: string; color: string; staffId: string; providerName: string | null; auto?: boolean; lateMinutes?: number | null }[];
  onRemove: (id: string) => void;
  onChangeAuto: (staffId: string) => void;
  currentId: string | null;
  isManager: boolean;
  dark: boolean;
  swapRequests: SwapRequestView[];
  onToggleSwap: (position: { role: Role; providerId: string | null; staffId: string }) => void;
  onRespondSwap: (requestId: string, accept: boolean) => void;
  onDropStaff: (source: PositionRef) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`mt-3 border-t-2 pt-3 ${dark ? "border-white/20" : "accent-border-soft"}`}>
      <div className={`mb-1 text-xs font-bold uppercase tracking-wide ${dark ? "text-white/40" : "opacity-40"}`}>{title}</div>
      <DropZone active={isManager} onDrop={onDropStaff} className="min-h-8 p-1 -m-1">
        {cells.length === 0 && <p className={`text-sm font-bold ${dark ? "text-white/40" : "opacity-40"}`}>None yet</p>}
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {cells.map((c) => {
            const canRemove = isManager || c.staffId === currentId;
            const removeThis = () => (c.auto ? onChangeAuto(c.staffId) : onRemove(c.id));
            return (
              <li key={c.id} className="flex items-center gap-1">
                <Pill
                  name={c.providerName ? `${c.name} — ${c.providerName}` : c.name}
                  color={c.color}
                  lateMinutes={c.lateMinutes}
                  draggable={isManager}
                  position={{ office, half, role, providerId: null, staffId: c.staffId, assignmentId: c.auto ? null : c.id }}
                  onRemove={isManager && canRemove ? removeThis : undefined}
                />
                {!isManager && (
                  <SwapControl
                    position={{ role, providerId: null, staffId: c.staffId }}
                    positionName={c.name}
                    currentId={currentId}
                    dark={dark}
                    swapRequests={swapRequests}
                    onToggleSwap={onToggleSwap}
                    onRespondSwap={onRespondSwap}
                  />
                )}
                {canRemove && !isManager && (
                  <button onClick={removeThis} className="text-xs font-bold text-red-500 opacity-70 hover:opacity-100">
                    remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {children}
      </DropZone>
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
  dark,
}: {
  options: FreeStaffMember[];
  reassignable: { id: string; name: string }[];
  onAssign: (staffId: string) => void;
  compact?: boolean;
  dark?: boolean;
}) {
  const { current } = useWhoAmI();
  const btnClass = `rounded-full border-2 font-bold transition active:scale-95 ${
    compact ? "w-full px-2 py-1 text-[11px]" : "px-4 py-1 text-xs"
  } ${dark ? "border-white/30 text-white" : "accent-border"}`;

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
// accept/deny — accepting trades your current position for theirs. Hidden
// entirely for managers, who can just drag/remove people directly instead.
function SwapControl({
  position,
  positionName,
  currentId,
  dark,
  swapRequests,
  onToggleSwap,
  onRespondSwap,
}: {
  position: { role: Role; providerId: string | null; staffId: string };
  positionName: string;
  currentId: string | null;
  dark?: boolean;
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
        <span className={`text-[10px] font-bold ${dark ? "text-white" : "accent-text"}`}>{incomingToMe.requestedByStaffName} wants to swap</span>
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
      {tag && (
        <span className={`text-[9px] font-bold uppercase tracking-wide ${dark ? "text-white/80" : "accent-text opacity-80"}`}>{tag}</span>
      )}
      <button
        onClick={() => onToggleSwap(position)}
        aria-label={label}
        title={label}
        className={`rounded-full p-0.5 transition ${
          active ? (dark ? "text-white" : "accent-text opacity-100") : dark ? "text-white/50 hover:text-white/80" : "opacity-40 hover:opacity-80"
        }`}
      >
        <SwapIcon className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
