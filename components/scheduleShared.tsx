"use client";

import { useState, type DragEvent } from "react";
import type { PositionRef } from "@/lib/schedule";
import type { SwapRequestView } from "@/lib/swap";
import { type Half, type Office, type Role } from "@/lib/types";
import { useWhoAmI } from "@/lib/whoami";
import { SwapIcon } from "@/components/icons";

// Shared building blocks for the Home page's schedule board — the classic
// card-grid layout (ScheduleBoard) and the modern split-screen redesign
// (ModernScheduleBoard, Reda-only) both use these, so drag-and-drop,
// removal, and the swap-request flow only exist in one place.

export const DRAG_MIME = "application/x-cfa-position";

export type FreeStaffMemberLike = { id: string; name: string; addableByAnyone: boolean };
export type DropTarget = { role: Role; office: Office; providerId: string | null };

export function lateTag(lateMinutes: number | null) {
  return lateMinutes ? ` (${lateMinutes}m late)` : "";
}

export async function postJSON(url: string, method: string, body?: unknown) {
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
export async function moveStaff(date: string, half: Half, source: PositionRef, target: DropTarget) {
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

export function readDragPosition(e: DragEvent): PositionRef | null {
  const raw = e.dataTransfer.getData(DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PositionRef;
  } catch {
    return null;
  }
}

// A colored name chip — every person gets one, everywhere, using their own
// Staff.color (matching the picker, calendars, etc.). Only a manager's pills
// are draggable; everyone else just sees a clean, static chip. `onRemove`
// adds a small × built into the chip's right edge instead of a separate
// "remove" link. `size` lets the modern board ask for a bigger, roomier
// pill to match its lower-density layout.
export function Pill({
  name,
  color,
  lateMinutes,
  substitute,
  draggable,
  position,
  onRemove,
  size = "sm",
}: {
  name: string;
  color: string;
  lateMinutes?: number | null;
  substitute?: boolean;
  draggable?: boolean;
  position?: PositionRef;
  onRemove?: () => void;
  size?: "sm" | "md";
}) {
  function onDragStart(e: DragEvent) {
    if (!position) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(position));
  }

  const sizeClass = size === "md" ? "text-sm py-1.5" : "text-xs py-1";

  return (
    <span
      draggable={draggable}
      onDragStart={onDragStart}
      title={draggable ? `Drag ${name} to move them` : name}
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-full font-bold text-slate-700 ${sizeClass} ${
        onRemove ? "pl-2.5 pr-0.5" : "px-2.5"
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
// highlight while something's hovering over it. No-op for anyone else —
// their pills were never draggable in the first place. `hoverClassName`
// lets a dark background ask for a ring-only highlight instead of the
// default light background wash, which would otherwise look like a pale
// smudge over black.
export function DropZone({
  active,
  onDrop,
  className,
  hoverClassName,
  children,
}: {
  active: boolean;
  onDrop: (source: PositionRef) => void;
  className?: string;
  hoverClassName?: string;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);

  if (!active) return <div className={className}>{children}</div>;

  return (
    <div
      className={`rounded-xl transition ${over ? (hoverClassName ?? "bg-white/70 ring-2 ring-dashed ring-slate-400") : ""} ${className ?? ""}`}
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
export function TakeRoleButton({
  options,
  reassignable,
  onAssign,
  compact,
  dark,
  btnClassName,
}: {
  options: FreeStaffMemberLike[];
  reassignable: { id: string; name: string }[];
  onAssign: (staffId: string) => void;
  compact?: boolean;
  dark?: boolean;
  btnClassName?: string;
}) {
  const { current } = useWhoAmI();
  const btnClass =
    btnClassName ??
    `rounded-full border-2 font-bold transition active:scale-95 ${
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
export function SwapControl({
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
