"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DaySchedule, FreeStaffMember, HalfSlot, PositionRef, ProviderCell } from "@/lib/schedule";
import type { SwapRequestView } from "@/lib/swap";
import { HALVES, HALF_LABELS, OFFICES, OFFICE_LABELS, type Half, type Office, type Role } from "@/lib/types";
import { useWhoAmI } from "@/lib/whoami";
import AutoRefresh from "@/components/AutoRefresh";
import { DropZone, Pill, SwapControl, TakeRoleButton, lateTag, moveStaff, postJSON, type DropTarget } from "@/components/scheduleShared";

const SWAP_POLL_MS = 8000;

type Props = {
  date: string;
  day: DaySchedule;
  freeStaff: Record<Half, FreeStaffMember[]>;
};

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
