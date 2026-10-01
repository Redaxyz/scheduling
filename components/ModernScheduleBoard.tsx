"use client";

import { Fragment, useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DaySchedule, FreeStaffMember, PositionRef, ProviderCell } from "@/lib/schedule";
import type { SwapRequestView } from "@/lib/swap";
import { effectiveScheduleDate, formatLong } from "@/lib/date";
import { HALVES, HALF_LABELS, OFFICES, OFFICE_LABELS, WEEKDAY_LABELS, type Half, type Office, type Role } from "@/lib/types";
import { useWhoAmI } from "@/lib/whoami";
import AutoRefresh from "@/components/AutoRefresh";
import ScheduleDateNav from "@/components/ScheduleDateNav";
import { DropZone, Pill, SwapControl, TakeRoleButton, lateTag, moveStaff, postJSON, type DropTarget } from "@/components/scheduleShared";

const SWAP_POLL_MS = 8000;

type Props = {
  date: string;
  day: DaySchedule;
  freeStaff: Record<Half, FreeStaffMember[]>;
};

// The modern Home page: literally half the screen per office instead of a
// grid of bordered cards — Bethesda white, Germantown black, edge to edge.
// Same data, same interactions (drag-to-reassign, remove, swap-request) as
// the classic ScheduleBoard, just laid out as a continuous, low-chrome
// column of names and dividers instead of a card per provider/role.
export default function ModernScheduleBoard({ date, day, freeStaff }: Props) {
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

  // Unlike the classic board (which lists this per half), the modern layout
  // folds AM and PM into one summary line — so anyone unassigned for both
  // halves needs deduping here, or they'd otherwise print twice.
  const unassignedLine = Array.from(new Map(HALVES.flatMap((half) => day.unassigned[half]).map((s) => [s.id, s.name])).values());

  // On a phone the two offices stack, so whichever one is actually "yours"
  // should land on top instead of always defaulting to Bethesda-then-
  // Germantown — that ordering only matters once flex-col kicks in, so it's
  // undone again at the lg breakpoint where the two sit side by side anyway.
  const mobileFirst: Office = current?.homeOffice === "GERMANTOWN" ? "GERMANTOWN" : "BETHESDA";

  const weekdayLabel = day.weekday !== null ? WEEKDAY_LABELS[day.weekday] : "Weekend";
  const isToday = date === effectiveScheduleDate();

  return (
    // -mt-4/-mb-28 cancel <main>'s own py-4/pb-28 (see app/layout.tsx) so
    // this reaches the true top and bottom of the viewport instead of
    // stopping at the edge of that padding — min-h-dvh (not a JS
    // measurement) is what makes the split run the full screen height even
    // on a short day, growing further on its own if content needs more.
    <div className="relative left-1/2 -mt-4 -mb-28 min-h-dvh w-screen -translate-x-1/2">
      <AutoRefresh intervalMs={20000} stale={{ kind: "day", period: date }} />

      {/* Floats over the split instead of sitting in its own bar above it —
          title stays on the left (over Bethesda/white), date-nav on the
          right (over Germantown/black, so it needs light-friendly text). */}
      <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-3 px-6 py-4 sm:px-10">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            {weekdayLabel} — {formatLong(date)}
          </h1>
          {!isToday && (
            <Link href={`/schedule/${effectiveScheduleDate()}`} className="accent-text text-sm font-bold hover:underline">
              Jump to today
            </Link>
          )}
        </div>
        <div className="text-white">
          <ScheduleDateNav date={date} />
        </div>
      </div>

      <div className="flex min-h-dvh flex-col lg:flex-row lg:items-stretch">
        {OFFICES.map((office) => (
          <OfficeHalf
            key={office}
            date={date}
            office={office}
            day={day}
            freeStaff={freeStaff}
            currentId={currentId}
            isManager={isManager}
            swapRequests={swapRequests}
            onChanged={refresh}
            mobileOrderClass={office === mobileFirst ? "order-1 lg:order-none" : "order-2 lg:order-none"}
          />
        ))}
      </div>

      {unassignedLine.length > 0 && (
        // Each half is exactly 50% wide so the label and the names meet
        // right at the Bethesda/Germantown seam instead of sitting out at
        // the screen's outer edges.
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex">
          <div className="flex w-1/2 justify-end pr-3 sm:pr-4">
            <span className="pointer-events-auto text-[11px] font-bold uppercase tracking-widest text-slate-900/70">Not assigned yet</span>
          </div>
          <div className="flex w-1/2 justify-start pl-3 sm:pl-4">
            <span className="pointer-events-auto text-[11px] font-bold uppercase tracking-widest text-white/80">
              {unassignedLine.join(", ")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function OfficeHalf({
  date,
  office,
  day,
  freeStaff,
  currentId,
  isManager,
  swapRequests,
  onChanged,
  mobileOrderClass,
}: {
  date: string;
  office: Office;
  day: DaySchedule;
  freeStaff: Record<Half, FreeStaffMember[]>;
  currentId: string | null;
  isManager: boolean;
  swapRequests: SwapRequestView[];
  onChanged: () => void;
  mobileOrderClass: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const dark = office === "GERMANTOWN";

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  function toggleSwap(half: Half, position: { role: Role; providerId: string | null; staffId: string }) {
    if (!currentId) return;
    run(() =>
      postJSON("/api/swap-requests", "POST", {
        date,
        half,
        office,
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

  function dropOnto(half: Half, target: DropTarget, displaced?: PositionRef | null) {
    return (source: PositionRef) => run(() => moveStaff(date, half, source, target, displaced));
  }

  return (
    <div
      className={`flex-1 px-6 pb-24 pt-20 sm:px-10 sm:pb-28 sm:pt-24 ${mobileOrderClass} ${dark ? "bg-[#0b0f14] text-white" : "bg-white text-slate-900"}`}
    >
      <div className={`mb-8 flex items-baseline justify-between border-b pb-4 ${dark ? "border-white/10" : "border-slate-200"}`}>
        <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">{OFFICE_LABELS[office]}</h2>
        <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${dark ? "text-white/30" : "text-slate-400"}`}>
          {office === "BETHESDA" ? "BT" : "GT"}
        </span>
      </div>

      {error && <p className="mb-4 rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400">{error}</p>}

      <div className="relative">
        <div className={dark ? "modern-half-divider bg-white/10" : "modern-half-divider bg-slate-200"} />
        <div className="modern-half-grid">
          {HALVES.map((half) => {
            const slot = day.halves[half][office];
            const free = freeStaff[half];
            const scribeEligible = free.filter((s) => s.canScribe);
            const reassignable = day.reassignable[half];
            const prefix = half.toLowerCase();

            return (
              <Fragment key={half}>
                <div data-cell={`${prefix}-label`} className={`text-[10px] font-bold uppercase tracking-[0.2em] ${dark ? "text-white/40" : "text-slate-400"}`}>
                  {HALF_LABELS[half]}
                </div>

                <div data-cell={`${prefix}-providers`}>
                  {slot.providers.length === 0 ? (
                    <p className={`text-sm font-bold italic ${dark ? "text-white/30" : "text-slate-400"}`}>No provider scheduled here.</p>
                  ) : (
                    <div className="space-y-3">
                      {slot.providers.map((cell) => (
                        <ProviderRow
                          key={cell.provider.id}
                          date={date}
                          half={half}
                          office={office}
                          cell={cell}
                          scribeEligible={scribeEligible}
                          reassignable={reassignable}
                          run={run}
                          currentId={currentId}
                          isManager={isManager}
                          dark={dark}
                          swapRequests={swapRequests}
                          onToggleSwap={(p) => toggleSwap(half, p)}
                          onRespondSwap={respondSwap}
                          onDropStaff={dropOnto(
                            half,
                            { role: "SCRIBE", office, providerId: cell.provider.id },
                            cell.scribe
                              ? {
                                  office,
                                  half,
                                  role: "SCRIBE",
                                  providerId: cell.provider.id,
                                  staffId: cell.scribe.staffId,
                                  assignmentId: cell.scribe.assignmentId,
                                }
                              : null
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div data-cell={`${prefix}-rooming`}>
                  <RoleSection
                    title="Rooming"
                    role="ROOMING"
                    date={date}
                    half={half}
                    office={office}
                    cells={slot.rooming}
                    free={free}
                    reassignable={reassignable}
                    run={run}
                    currentId={currentId}
                    isManager={isManager}
                    dark={dark}
                    swapRequests={swapRequests}
                    onToggleSwap={(p) => toggleSwap(half, p)}
                    onRespondSwap={respondSwap}
                    onDropStaff={dropOnto(half, { role: "ROOMING", office, providerId: null })}
                  />
                </div>

                <div data-cell={`${prefix}-xray`}>
                  <RoleSection
                    title="X-ray"
                    role="XRAY"
                    date={date}
                    half={half}
                    office={office}
                    cells={slot.xray}
                    free={slot.xrayEligible}
                    reassignable={reassignable}
                    run={run}
                    currentId={currentId}
                    isManager={isManager}
                    dark={dark}
                    swapRequests={swapRequests}
                    onToggleSwap={(p) => toggleSwap(half, p)}
                    onRespondSwap={respondSwap}
                    onDropStaff={dropOnto(half, { role: "XRAY", office, providerId: null })}
                  />
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProviderRow({
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

  const hoverClass = "ring-2 ring-[var(--theme-accent)]";

  return (
    <DropZone active={isManager} onDrop={onDropStaff} hoverClassName={hoverClass} className={`flex flex-wrap items-center gap-2 py-1 ${dark ? "border-b border-white/10" : "border-b border-slate-100"}`}>
      <span className="truncate text-sm font-extrabold">
        {cell.provider.name}
        {cell.provider.lateMinutes && (
          <span className={`ml-1 font-bold ${dark ? "text-amber-400" : "text-amber-600"}`}>{lateTag(cell.provider.lateMinutes)}</span>
        )}
      </span>

      {cell.scribe ? (
        <span className="flex flex-wrap items-center gap-1.5">
          <Pill
            name={cell.scribe.name}
            color={cell.scribe.color}
            lateMinutes={cell.scribe.lateMinutes}
            substitute={cell.scribe.substitute}
            draggable={isManager}
            position={{ office, half, role: "SCRIBE", providerId: cell.provider.id, staffId: cell.scribe.staffId, assignmentId: cell.scribe.assignmentId }}
            onRemove={canRemove ? removeScribe : undefined}
            leading={
              !isManager && (
                <SwapControl
                  position={{ role: "SCRIBE", providerId: cell.provider.id, staffId: cell.scribe.staffId }}
                  positionName={cell.scribe.name}
                  currentId={currentId}
                  swapRequests={swapRequests}
                  onToggleSwap={onToggleSwap}
                  onRespondSwap={onRespondSwap}
                />
              )
            }
          />
        </span>
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-bold ${dark ? "text-red-400" : "text-red-600"}`}>OPEN</span>
          <TakeRoleButton
            dark={dark}
            options={scribeEligible}
            reassignable={reassignable}
            btnClassName={`rounded-full px-2 py-0.5 text-[10px] font-bold transition active:scale-95 ${
              dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
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
        </span>
      )}
    </DropZone>
  );
}

function RoleSection({
  title,
  role,
  date,
  half,
  office,
  cells,
  free,
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
  title: string;
  role: Role;
  date: string;
  half: Half;
  office: Office;
  cells: {
    id: string;
    name: string;
    color: string;
    staffId: string;
    providerName: string | null;
    auto?: boolean;
    lateMinutes?: number | null;
    addableByAnyone?: boolean;
  }[];
  free: FreeStaffMember[];
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
  const hoverClass = "ring-2 ring-[var(--theme-accent)]";
  const addBtnClass = `rounded-full px-3 py-1 text-[11px] font-bold transition active:scale-95 ${
    dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
  }`;

  // No top margin here — each RoleSection is its own grid cell now (see
  // .modern-half-grid in globals.css), so the grid's row-gap handles the
  // spacing above it instead of a margin baked into the section itself.
  return (
    <div>
      <div className={`mb-2 text-[10px] font-bold uppercase tracking-[0.2em] ${dark ? "text-white/30" : "text-slate-400"}`}>{title}</div>
      <DropZone active={isManager} onDrop={onDropStaff} hoverClassName={hoverClass} className="min-h-8 rounded-lg p-1 -m-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {cells.map((c) => {
            const canRemove = isManager || c.staffId === currentId || c.addableByAnyone;
            const doRemove = () =>
              c.auto
                ? run(() => postJSON("/api/auto-override", "POST", { staffId: c.staffId, date, half }))
                : run(() => postJSON(`/api/assignments/${c.id}`, "DELETE"));
            return (
              <span key={c.id} className="flex items-center gap-1">
                <Pill
                  name={c.providerName ? `${c.name} — ${c.providerName}` : c.name}
                  color={c.color}
                  lateMinutes={c.lateMinutes}
                  draggable={isManager}
                  position={{ office, half, role, providerId: null, staffId: c.staffId, assignmentId: c.auto ? null : c.id }}
                  onRemove={canRemove ? doRemove : undefined}
                  leading={
                    !isManager && (
                      <SwapControl
                        position={{ role, providerId: null, staffId: c.staffId }}
                        positionName={c.name}
                        currentId={currentId}
                        swapRequests={swapRequests}
                        onToggleSwap={onToggleSwap}
                        onRespondSwap={onRespondSwap}
                      />
                    )
                  }
                />
              </span>
            );
          })}
          <TakeRoleButton
            dark={dark}
            options={free}
            reassignable={reassignable}
            btnClassName={addBtnClass}
            onAssign={(staffId) =>
              run(() =>
                postJSON("/api/assignments", "POST", {
                  date,
                  half,
                  office,
                  role,
                  staffId,
                })
              )
            }
          />
        </div>
      </DropZone>
    </div>
  );
}
