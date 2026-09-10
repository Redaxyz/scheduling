import { prisma } from "./prisma";
import { weekDates, weekdayIndex } from "./date";
import { HALVES, OFFICES, SCRIBE_PRIORITY, type Half, type Office, type Role } from "./types";

export type ProviderCell = {
  provider: { id: string; name: string; initials: string; lateMinutes: number | null };
  // assignmentId is set only for an explicit substitute (a real Assignment
  // row, removable via DELETE); null for a computed default (dedicated or
  // fallback), removable instead via an AutoOverride.
  scribe: { staffId: string; name: string; color: string; substitute: boolean; assignmentId: string | null; lateMinutes: number | null } | null;
};

export type AssignmentCell = {
  id: string;
  role: string;
  staffId: string;
  name: string;
  color: string;
  providerId: string | null;
  providerName: string | null;
  lateMinutes: number | null;
  // true for a computed default placement (scribe fallback / dedicated aid)
  // rather than a manually-created Assignment row — not removable via the UI.
  auto: boolean;
  // true if this placement is a specific commitment (scribing a doctor,
  // doing x-ray, or a standing default-rooming duty) that should block
  // manager reassignment until removed; false for generic/ad-hoc rooming,
  // which stays freely reassignable (see `reassignable` on DaySchedule).
  hardCommitment: boolean;
};

export type HalfSlot = {
  office: Office;
  half: Half;
  providers: ProviderCell[];
  rooming: AssignmentCell[];
  xray: AssignmentCell[];
  // Backup x-ray techs eligible right now for this office+half (their
  // designated primary is out) — distinct from the generic free-staff list
  // since eligibility here is conditional, not just "not otherwise busy".
  xrayEligible: FreeStaffMember[];
  staffCount: number;
};

export type DaySchedule = {
  date: string;
  weekday: number | null;
  halves: Record<Half, Record<Office, HalfSlot>>;
  // Active staff, per half, who are present (not absent) but currently
  // placed nowhere — not a scribe, not in rooming, not doing x-ray, at
  // either office. Includes x-ray techs (unlike the generic free-staff
  // pool, which excludes them since they can't self-place into other
  // roles). Excludes no-login resources (e.g. Lester) and PA-C staff
  // shadow-records that share a name with a Provider — those are tracked
  // as providers, not via staff role placement.
  unassigned: Record<Half, { id: string; name: string }[]>;
  // Like `unassigned`, but generic rooming/support doesn't count as a
  // placement — only being someone's scribe or doing x-ray does. Used to
  // gate the manager's "add anyone" picker: someone just doing rooming is
  // still offerable elsewhere without an explicit remove-first step, since
  // rooming isn't a specific commitment the way scribing or x-ray is.
  reassignable: Record<Half, { id: string; name: string }[]>;
};

export type FreeStaffMember = {
  id: string;
  name: string;
  kind: string;
  canScribe: boolean;
  homeOffice: Office | null;
  dedicatedProviderName: string | null;
  reason: string;
  // If true, anyone can add this person (not just themselves) — e.g. Lester.
  addableByAnyone: boolean;
};

function absenceMatches(half: Half, absenceHalf: string) {
  return absenceHalf === "ALL" || absenceHalf === half;
}

function scribeRank(name: string) {
  const i = SCRIBE_PRIORITY.indexOf(name);
  return i === -1 ? SCRIBE_PRIORITY.length : i;
}

type ScheduleSlotRow = { providerId: string; half: string; office: string | null; surgery: boolean };
type ProviderAbsenceRow = { providerId: string; half: string };
type ProviderAutoOverrideRow = { providerId: string; half: string };
type ScribeFallbackRow = {
  staffId: string;
  weekday: number;
  half: string;
  office: string;
  conditionalProviderId: string | null;
  conditionalRequireActive: boolean | null;
  targetProviderId: string | null;
};
type XrayBackupStaffRow = {
  id: string;
  name: string;
  kind: string;
  canScribe: boolean;
  homeOffice: string | null;
  addableByAnyone: boolean;
  defaultXrayOffice: string | null;
  xrayBackupAs: { primaryStaffId: string }[];
};

// Who's eligible to self-add as X-ray for `office`+`half` right now: the
// office's own default tech, if they're free but not currently placed there
// (e.g. they changed away and want back in); or a backup whose designated
// primary (or, for a floating backup like Lester, any one of several) is
// absent this half. Nobody is office-locked — a backup can help at either
// office. Nobody here who's themselves absent/already assigned.
function computeXrayEligible(
  office: Office,
  half: Half,
  staff: XrayBackupStaffRow[],
  isStaffAbsent: (staffId: string, half: Half) => boolean,
  isStaffAssigned: (staffId: string, half: Half) => boolean,
  isOverridden: (staffId: string, half: Half) => boolean
): FreeStaffMember[] {
  const nameById = new Map(staff.map((s) => [s.id, s.name]));
  const result: FreeStaffMember[] = [];
  for (const s of staff) {
    if (isStaffAbsent(s.id, half) || isStaffAssigned(s.id, half)) continue;

    if (s.defaultXrayOffice === office && isOverridden(s.id, half)) {
      result.push({
        id: s.id,
        name: s.name,
        kind: s.kind,
        canScribe: s.canScribe,
        homeOffice: (s.homeOffice as Office | null) ?? null,
        dedicatedProviderName: null,
        reason: "Your usual spot",
        addableByAnyone: s.addableByAnyone,
      });
      continue;
    }

    if (s.xrayBackupAs.length === 0) continue;

    const outPrimaries = s.xrayBackupAs.filter((b) => isStaffAbsent(b.primaryStaffId, half));
    if (outPrimaries.length === 0) continue;

    const primaryNames = outPrimaries.map((b) => nameById.get(b.primaryStaffId) ?? "someone").join(" or ");
    result.push({
      id: s.id,
      name: s.name,
      kind: s.kind,
      canScribe: s.canScribe,
      homeOffice: (s.homeOffice as Office | null) ?? null,
      dedicatedProviderName: null,
      reason: `Backing up ${primaryNames}`,
      addableByAnyone: s.addableByAnyone,
    });
  }
  return result;
}

// Shared "who's actually working, and where" logic for a day's recurring
// template + one-off absences — used by both exports below. A provider
// counts as absent either from an explicit ProviderAbsence row, or (absent
// that too) from their own template defaulting to surgery this weekday+half
// (see ProviderScheduleSlot.surgery) unless a ProviderAutoOverride opts this
// specific date back to present.
function buildActivity(
  scheduleSlots: ScheduleSlotRow[],
  providerAbsences: ProviderAbsenceRow[],
  providerAutoOverrides: ProviderAutoOverrideRow[] = []
) {
  const isOverridden = (providerId: string, half: Half) =>
    providerAutoOverrides.some((o) => o.providerId === providerId && o.half === half);

  const defaultsToSurgery = (providerId: string, half: Half) =>
    scheduleSlots.some((s) => s.providerId === providerId && s.half === half && s.surgery);

  const isAbsent = (providerId: string, half: Half) => {
    if (providerAbsences.some((a) => a.providerId === providerId && absenceMatches(half, a.half))) return true;
    return !isOverridden(providerId, half) && defaultsToSurgery(providerId, half);
  };

  const isActive = (providerId: string, half: Half) =>
    scheduleSlots.some((s) => s.providerId === providerId && s.half === half && s.office !== null) &&
    !isAbsent(providerId, half);

  const activeOffice = (providerId: string, half: Half): Office | null => {
    const slot = scheduleSlots.find((s) => s.providerId === providerId && s.half === half && s.office !== null);
    if (!slot || isAbsent(providerId, half)) return null;
    return slot.office as Office;
  };

  return { isAbsent, isActive, activeOffice };
}

// Resolve a scribe's fallback row for a weekday+half, evaluating any
// cross-provider condition (and, for a provider-targeted row, that the
// target provider is actually active this half) against real activity.
// Returns null if nothing applies.
function resolveFallback(
  fallbacks: ScribeFallbackRow[],
  staffId: string,
  weekday: number,
  half: Half,
  isActive: (providerId: string, half: Half) => boolean
): ScribeFallbackRow | null {
  const rows = fallbacks.filter((f) => f.staffId === staffId && f.weekday === weekday && f.half === half);
  return (
    rows.find((r) => {
      if (r.conditionalProviderId && isActive(r.conditionalProviderId, half) !== r.conditionalRequireActive) return false;
      if (r.targetProviderId && !isActive(r.targetProviderId, half)) return false;
      return true;
    }) ?? null
  );
}

export async function getDaySchedule(date: string): Promise<DaySchedule> {
  const weekday = weekdayIndex(date);

  const [
    scheduleSlots,
    providerAbsences,
    providerAutoOverrides,
    staff,
    staffAbsences,
    assignments,
    scribeFallbacks,
    autoOverrides,
    allProviders,
    staffTemplateSlots,
    optedInRows,
  ] = await Promise.all([
    weekday === null
      ? Promise.resolve([])
      : prisma.providerScheduleSlot.findMany({
          where: { weekday },
          include: { provider: true },
        }),
    prisma.providerAbsence.findMany({ where: { date } }),
    prisma.providerAutoOverride.findMany({ where: { date } }),
    prisma.staff.findMany({
      where: { active: true },
      include: { dedicatedProvider: true, xrayBackupAs: true },
    }),
    // A PENDING day-off request doesn't block anything until Joanna approves
    // it — see the StaffAbsence schema comment.
    prisma.staffAbsence.findMany({ where: { date, status: "APPROVED" } }),
    prisma.assignment.findMany({ where: { date }, include: { staff: true, provider: true } }),
    weekday === null ? Promise.resolve([]) : prisma.scribeFallback.findMany({ where: { weekday } }),
    prisma.autoOverride.findMany({ where: { date } }),
    prisma.provider.findMany({ where: { active: true }, select: { name: true } }),
    weekday === null ? Promise.resolve([]) : prisma.staffScheduleSlot.findMany({ where: { weekday }, include: { provider: true } }),
    // Opted-in status is per PERSON, not per weekday — someone with a
    // template row on any other day has still fully switched over, even if
    // today happens to be a gap (= off duty) in what they filled in.
    prisma.staffScheduleSlot.findMany({ select: { staffId: true }, distinct: ["staffId"] }),
  ]);
  const providerNames = new Set(allProviders.map((p) => p.name));
  const optedInStaffIds = new Set(optedInRows.map((r) => r.staffId));
  const templateSlotFor = (staffId: string, half: Half) => staffTemplateSlots.find((t) => t.staffId === staffId && t.half === half);

  const { isAbsent: isProviderAbsent, isActive: isProviderActive } = buildActivity(scheduleSlots, providerAbsences, providerAutoOverrides);

  const isStaffAbsent = (staffId: string, half: Half) =>
    staffAbsences.some((a) => a.staffId === staffId && absenceMatches(half, a.half));
  const isStaffAssigned = (staffId: string, half: Half) => assignments.some((a) => a.staffId === staffId && a.half === half);
  // Staff who opted OUT of one of their own computed defaults for this half
  // (see AutoOverride) — they're treated as not-defaulted, free to self-place.
  const isOverridden = (staffId: string, half: Half) => autoOverrides.some((o) => o.staffId === staffId && o.half === half);
  // A CUSTOM absence doesn't block anything (see absenceMatches) — it's just
  // a running-late note, surfaced next to the person's name in the UI.
  const lateStaffMinutes = (staffId: string) =>
    staffAbsences.find((a) => a.staffId === staffId && a.half === "CUSTOM")?.lateMinutes ?? null;
  const lateProviderMinutes = (providerId: string) =>
    providerAbsences.find((a) => a.providerId === providerId && a.half === "CUSTOM")?.lateMinutes ?? null;

  // A scribe whose own doctor doesn't need them this half, but who has a
  // fallback row naming `providerId` as their target — e.g. Reda defaults to
  // Brian on Friday PM whenever Christo doesn't need her. Opted-in staff
  // (see StaffScheduleSlot) skip this legacy path entirely — their personal
  // template is the only source of truth once they have one.
  const resolveTargetScribe = (providerId: string, half: Half) => {
    if (weekday === null) return null;
    for (const s of staff) {
      if (optedInStaffIds.has(s.id)) continue;
      if (!s.dedicatedProviderId || isProviderActive(s.dedicatedProviderId, half)) continue;
      if (isStaffAbsent(s.id, half) || isStaffAssigned(s.id, half) || isOverridden(s.id, half)) continue;
      const row = resolveFallback(scribeFallbacks, s.id, weekday, half, isProviderActive);
      if (row?.targetProviderId === providerId) return { staffId: s.id, name: s.name, color: s.color };
    }
    return null;
  };

  // A staff member's own weekly template naming `providerId` as who they
  // scribe for this exact weekday+half — the self-service replacement for
  // dedicatedProviderId, checked only for staff who've opted in.
  const resolveTemplateScribe = (providerId: string, half: Half) => {
    for (const s of staff) {
      if (!optedInStaffIds.has(s.id)) continue;
      if (isStaffAbsent(s.id, half) || isStaffAssigned(s.id, half) || isOverridden(s.id, half)) continue;
      const slot = templateSlotFor(s.id, half);
      if (slot?.role === "SCRIBE" && slot.providerId === providerId) return { staffId: s.id, name: s.name, color: s.color };
    }
    return null;
  };

  const halves = {} as Record<Half, Record<Office, HalfSlot>>;
  const unassigned = {} as Record<Half, { id: string; name: string }[]>;
  const reassignable = {} as Record<Half, { id: string; name: string }[]>;

  for (const half of HALVES) {
    halves[half] = {} as Record<Office, HalfSlot>;
    for (const office of OFFICES) {
      const activeSlots = scheduleSlots.filter(
        (s) => s.office === office && s.half === half && !isProviderAbsent(s.providerId, half)
      );

      const providers: ProviderCell[] = activeSlots.map((s) => {
        const dedicated = staff.find((st) => st.dedicatedProviderId === s.providerId && !optedInStaffIds.has(st.id));
        const explicitSub = assignments.find(
          (a) => a.role === "SCRIBE" && a.providerId === s.providerId && a.half === half
        );
        const dedicatedAbsent = dedicated ? isStaffAbsent(dedicated.id, half) : true;
        const templateScribe = resolveTemplateScribe(s.providerId, half);

        let scribe: ProviderCell["scribe"] = null;
        if (explicitSub) {
          scribe = {
            staffId: explicitSub.staffId,
            name: explicitSub.staff.name,
            color: explicitSub.staff.color,
            substitute: true,
            assignmentId: explicitSub.id,
            lateMinutes: lateStaffMinutes(explicitSub.staffId),
          };
        } else if (templateScribe) {
          scribe = {
            staffId: templateScribe.staffId,
            name: templateScribe.name,
            color: templateScribe.color,
            substitute: false,
            assignmentId: null,
            lateMinutes: lateStaffMinutes(templateScribe.staffId),
          };
        } else if (dedicated && !dedicatedAbsent && !isOverridden(dedicated.id, half) && !isStaffAssigned(dedicated.id, half)) {
          scribe = {
            staffId: dedicated.id,
            name: dedicated.name,
            color: dedicated.color,
            substitute: false,
            assignmentId: null,
            lateMinutes: lateStaffMinutes(dedicated.id),
          };
        } else {
          const target = resolveTargetScribe(s.providerId, half);
          if (target) {
            scribe = {
              staffId: target.staffId,
              name: target.name,
              color: target.color,
              substitute: false,
              assignmentId: null,
              lateMinutes: lateStaffMinutes(target.staffId),
            };
          }
        }

        return {
          provider: {
            id: s.providerId,
            name: s.provider.name,
            initials: s.provider.initials,
            lateMinutes: lateProviderMinutes(s.providerId),
          },
          scribe,
        };
      });

      const officeAssignments = assignments.filter((a) => a.office === office && a.half === half);
      const toCell = (a: (typeof officeAssignments)[number]): AssignmentCell => ({
        id: a.id,
        role: a.role,
        staffId: a.staffId,
        name: a.staff.name,
        color: a.staff.color,
        providerId: a.providerId ?? null,
        providerName: a.provider?.name ?? null,
        lateMinutes: lateStaffMinutes(a.staffId),
        auto: false,
        hardCommitment: a.role === "XRAY",
      });

      // Computed default presence: a dedicated scribe falling back to this
      // office as generic support (own doctor not active this half) goes in
      // the office-wide rooming list. Can be opted out of via AutoOverride,
      // which also frees them up elsewhere.
      const autoRoomingEntries: AssignmentCell[] = [];
      if (weekday !== null) {
        for (const s of staff) {
          if (optedInStaffIds.has(s.id)) continue;
          if (isStaffAbsent(s.id, half) || isStaffAssigned(s.id, half) || isOverridden(s.id, half)) continue;
          if (!s.dedicatedProviderId || isProviderActive(s.dedicatedProviderId, half)) continue;

          const fallbackRow = resolveFallback(scribeFallbacks, s.id, weekday, half, isProviderActive);
          // Provider-targeted rows (e.g. Reda -> Brian) render as that
          // provider's scribe above, not a generic office-support entry.
          if (fallbackRow && !fallbackRow.targetProviderId && fallbackRow.office === office) {
            autoRoomingEntries.push({
              id: `auto:${s.id}`,
              role: "ROOMING",
              staffId: s.id,
              name: s.name,
              color: s.color,
              providerId: null,
              providerName: null,
              lateMinutes: lateStaffMinutes(s.id),
              auto: true,
              hardCommitment: false,
            });
          }
        }
      }

      // Default Support/rooming for this office (e.g. JB AND Mark in
      // Bethesda, Charlie AND Jenish in Germantown — more than one person
      // can share a default office), unless absent or opted out — a
      // standing duty, so it's a hard commitment (unlike the soft scribe-
      // fallback rooming above).
      const autoDefaultRoomingEntries: AssignmentCell[] = staff
        .filter(
          (s) =>
            !optedInStaffIds.has(s.id) &&
            s.defaultRoomingOffice === office &&
            !isStaffAbsent(s.id, half) &&
            !isStaffAssigned(s.id, half) &&
            !isOverridden(s.id, half)
        )
        .map((s) => ({
          id: `auto:${s.id}`,
          role: "ROOMING",
          staffId: s.id,
          name: s.name,
          color: s.color,
          providerId: null,
          providerName: null,
          lateMinutes: lateStaffMinutes(s.id),
          auto: true,
          hardCommitment: true,
        }));

      // A staff member's own weekly template putting them at this office for
      // ROOMING or XRAY this exact weekday+half — the self-service
      // replacement for defaultRoomingOffice/defaultXrayOffice, checked only
      // for opted-in staff (see StaffScheduleSlot). Both count as a hard
      // commitment, same as the legacy standing defaults they replace.
      const autoTemplateEntries: AssignmentCell[] = staff
        .filter((s) => optedInStaffIds.has(s.id) && !isStaffAbsent(s.id, half) && !isStaffAssigned(s.id, half) && !isOverridden(s.id, half))
        .flatMap((s) => {
          const slot = templateSlotFor(s.id, half);
          if (!slot || slot.office !== office || (slot.role !== "ROOMING" && slot.role !== "XRAY")) return [];
          return [
            {
              id: `auto:${s.id}`,
              role: slot.role,
              staffId: s.id,
              name: s.name,
              color: s.color,
              providerId: null,
              providerName: null,
              lateMinutes: lateStaffMinutes(s.id),
              auto: true,
              hardCommitment: true,
            },
          ];
        });

      // Default x-ray tech for this office (e.g. Cindy in Bethesda), unless
      // absent or opted out — same "auto" treatment as the scribe/aid defaults.
      const defaultXrayStaff = staff.find((s) => !optedInStaffIds.has(s.id) && s.defaultXrayOffice === office);
      const autoXrayEntries: AssignmentCell[] =
        defaultXrayStaff &&
        !isStaffAbsent(defaultXrayStaff.id, half) &&
        !isStaffAssigned(defaultXrayStaff.id, half) &&
        !isOverridden(defaultXrayStaff.id, half)
          ? [
              {
                id: `auto:${defaultXrayStaff.id}`,
                role: "XRAY",
                staffId: defaultXrayStaff.id,
                name: defaultXrayStaff.name,
                color: defaultXrayStaff.color,
                providerId: null,
                providerName: null,
                lateMinutes: lateStaffMinutes(defaultXrayStaff.id),
                auto: true,
                hardCommitment: true,
              },
            ]
          : [];

      // Backup-xray eligibility needs each person's EFFECTIVE default xray
      // office — the legacy field for anyone still on it, or their personal
      // template's XRAY office (if any) once opted in — so "your usual spot"
      // still resolves correctly after switching over.
      const xrayEligibilityStaff = staff.map((s) => ({
        ...s,
        defaultXrayOffice: optedInStaffIds.has(s.id) ? (templateSlotFor(s.id, half)?.role === "XRAY" ? templateSlotFor(s.id, half)!.office : null) : s.defaultXrayOffice,
      }));
      const xrayEligible =
        weekday === null ? [] : computeXrayEligible(office, half, xrayEligibilityStaff, isStaffAbsent, isStaffAssigned, isOverridden);

      const rooming = [
        ...officeAssignments.filter((a) => a.role === "ROOMING").map(toCell),
        ...autoRoomingEntries,
        ...autoDefaultRoomingEntries,
        ...autoTemplateEntries.filter((e) => e.role === "ROOMING"),
      ];
      const xray = [
        ...officeAssignments.filter((a) => a.role === "XRAY").map(toCell),
        ...autoXrayEntries,
        ...autoTemplateEntries.filter((e) => e.role === "XRAY"),
      ];
      const staffCount = providers.filter((p) => p.scribe).length + rooming.length + xray.length;

      halves[half][office] = {
        office,
        half,
        providers,
        rooming,
        xray,
        xrayEligible,
        staffCount,
      };
    }

    // Who's present this half but placed nowhere — a scribe, rooming, or
    // x-ray slot at either office. committedStaffIds is the narrower "hard
    // commitment" subset (see AssignmentCell.hardCommitment) used to gate
    // manager reassignment — generic/ad-hoc rooming doesn't count.
    const placedStaffIds = new Set<string>();
    const committedStaffIds = new Set<string>();
    for (const office of OFFICES) {
      for (const p of halves[half][office].providers) {
        if (p.scribe) {
          placedStaffIds.add(p.scribe.staffId);
          committedStaffIds.add(p.scribe.staffId);
        }
      }
      for (const r of halves[half][office].rooming) {
        placedStaffIds.add(r.staffId);
        if (r.hardCommitment) committedStaffIds.add(r.staffId);
      }
      for (const x of halves[half][office].xray) {
        placedStaffIds.add(x.staffId);
        committedStaffIds.add(x.staffId);
      }
    }
    const stillPresent = (s: (typeof staff)[number]) =>
      s.usesApp && !providerNames.has(s.name) && !isStaffAbsent(s.id, half);
    unassigned[half] = staff.filter((s) => stillPresent(s) && !placedStaffIds.has(s.id)).map((s) => ({ id: s.id, name: s.name }));
    reassignable[half] = staff
      .filter((s) => stillPresent(s) && !committedStaffIds.has(s.id))
      .map((s) => ({ id: s.id, name: s.name }));
  }

  return { date, weekday, halves, unassigned, reassignable };
}

// Which staff are free to self-place, per half. Anyone not absent, not
// already placed elsewhere this half, and using the app at all is eligible
// for ROOMING/SCRIBE — being someone's dedicated scribe or the default
// x-ray tech no longer blocks self-placing elsewhere; picking a NEW slot
// naturally supersedes a computed default (see getDaySchedule, which
// already backs off a default once its holder has a real Assignment).
// X-ray techs (kind XRAY) are excluded here entirely — they only ever
// self-place via getXrayEligible, never into a non-x-ray role.
// Scribe-eligible entries are ordered by experience (SCRIBE_PRIORITY) so
// substitute pickers suggest the most experienced available scribe first.
export async function getFreeStaff(date: string): Promise<Record<Half, FreeStaffMember[]>> {
  const [staff, staffAbsences, assignments] = await Promise.all([
    prisma.staff.findMany({ where: { active: true } }),
    prisma.staffAbsence.findMany({ where: { date, status: "APPROVED" } }),
    prisma.assignment.findMany({ where: { date } }),
  ]);

  const result: Record<Half, FreeStaffMember[]> = { AM: [], PM: [] };

  for (const half of HALVES) {
    for (const s of staff) {
      if (!s.usesApp) continue; // e.g. Lester — never in the generic pool
      if (s.kind === "XRAY") continue; // x-ray techs only self-place via getXrayEligible

      const isAbsent = staffAbsences.some((a) => a.staffId === s.id && absenceMatches(half, a.half));
      if (isAbsent) continue;

      const alreadyAssigned = assignments.some((a) => a.staffId === s.id && a.half === half);
      if (alreadyAssigned) continue;

      result[half].push({
        id: s.id,
        name: s.name,
        kind: s.kind,
        canScribe: s.canScribe,
        homeOffice: (s.homeOffice as Office | null) ?? null,
        dedicatedProviderName: null,
        reason: "Available",
        addableByAnyone: s.addableByAnyone,
      });
    }

    result[half].sort((a, b) => scribeRank(a.name) - scribeRank(b.name));
  }

  return result;
}

// Who's eligible for the X-ray role at a specific office+half right now:
// backup techs whose primary is out (see computeXrayEligible). Used by the
// assignments API to validate an XRAY-role request without hardcoding kind.
export async function getXrayEligible(date: string, office: Office, half: Half): Promise<FreeStaffMember[]> {
  const weekday = weekdayIndex(date);
  if (weekday === null) return [];

  const [staff, staffAbsences, assignments, autoOverrides, templateSlots, optedInRows] = await Promise.all([
    prisma.staff.findMany({ where: { active: true }, include: { xrayBackupAs: true } }),
    prisma.staffAbsence.findMany({ where: { date, status: "APPROVED" } }),
    prisma.assignment.findMany({ where: { date } }),
    prisma.autoOverride.findMany({ where: { date } }),
    prisma.staffScheduleSlot.findMany({ where: { weekday, half } }),
    prisma.staffScheduleSlot.findMany({ select: { staffId: true }, distinct: ["staffId"] }),
  ]);

  const isStaffAbsent = (staffId: string, h: Half) =>
    staffAbsences.some((a) => a.staffId === staffId && absenceMatches(h, a.half));
  const isStaffAssigned = (staffId: string, h: Half) => assignments.some((a) => a.staffId === staffId && a.half === h);
  const isOverridden = (staffId: string, h: Half) => autoOverrides.some((o) => o.staffId === staffId && o.half === h);

  // Same effective-office adaptation as getDaySchedule: once someone has any
  // personal template row at all (any weekday/half — opted-in status isn't
  // specific to this one), their template's XRAY office for THIS half (if
  // any) is what "your usual spot" means now, not the legacy field.
  const optedInStaffIds = new Set(optedInRows.map((r) => r.staffId));
  const xrayEligibilityStaff = staff.map((s) => ({
    ...s,
    defaultXrayOffice: optedInStaffIds.has(s.id)
      ? (templateSlots.find((t) => t.staffId === s.id)?.role === "XRAY" ? (templateSlots.find((t) => t.staffId === s.id)!.office ?? null) : null)
      : s.defaultXrayOffice,
  }));

  return computeXrayEligible(office, half, xrayEligibilityStaff, isStaffAbsent, isStaffAssigned, isOverridden);
}

// Where a staff member currently sits for one half — office/role/providerId
// describe the slot shape (enough to recreate it for someone else);
// assignmentId is the real Assignment row backing it, or null if it's a
// computed default (dedicated scribe, default x-ray/rooming) with nothing to
// delete — freeing that spot instead means an AutoOverride. Used by the swap
// feature to resolve both sides of a trade live off the current schedule,
// rather than trusting a stale snapshot from whenever the request was made.
export type PositionRef = {
  office: Office;
  half: Half;
  role: Role;
  providerId: string | null;
  staffId: string;
  assignmentId: string | null;
};

export function findStaffPosition(day: DaySchedule, half: Half, staffId: string): PositionRef | null {
  for (const office of OFFICES) {
    const slot = day.halves[half][office];
    for (const p of slot.providers) {
      if (p.scribe?.staffId === staffId) {
        return { office, half, role: "SCRIBE", providerId: p.provider.id, staffId, assignmentId: p.scribe.assignmentId };
      }
    }
    const room = slot.rooming.find((r) => r.staffId === staffId);
    if (room) {
      return { office, half, role: "ROOMING", providerId: null, staffId, assignmentId: room.id.startsWith("auto:") ? null : room.id };
    }
    const xr = slot.xray.find((x) => x.staffId === staffId);
    if (xr) {
      return { office, half, role: "XRAY", providerId: null, staffId, assignmentId: xr.id.startsWith("auto:") ? null : xr.id };
    }
  }
  return null;
}

// One half-day cell of a staff member's own week ("My Schedule"). When
// they're actually working, office/role/providerName describe it directly.
// When they're out, those same fields describe what they NORMALLY would be
// doing (as if present) so the UI can show it — but only alongside
// coveringName, the specific person actually filling that slot right now.
// If nobody has, office/role/providerName are all null (render blank) —
// there's nothing useful to show for a slot nobody stepped into.
// isProvider is set instead of role for a PA-C who logs in as staff but is
// actually scheduled as a Provider (a shadow Staff record sharing their
// name) — office describes where they're seeing patients, and scribeName
// (if any) is who's scribing for them, rather than a role placement of
// their own.
export type MyScheduleCell = {
  office: Office | null;
  role: Role | null;
  providerName: string | null;
  isOut: boolean;
  lateMinutes: number | null;
  coveringName: string | null;
  isProvider: boolean;
  scribeName: string | null;
};

export type MyScheduleDay = {
  date: string;
  weekday: number;
  halves: Record<Half, MyScheduleCell>;
};

export type MyScheduleRow = {
  staffId: string;
  name: string;
  color: string;
  days: MyScheduleDay[];
};

function blankCell(isOut: boolean, lateMinutes: number | null): MyScheduleCell {
  return { office: null, role: null, providerName: null, isOut, lateMinutes, coveringName: null, isProvider: false, scribeName: null };
}

// Every active app-using staff member's schedule for the Mon-Fri week
// starting `mondayStr` — what they're doing each half, or (if they're out)
// who's covering their normal slot, if anyone. Computed for everyone at once
// since it shares the same underlying day schedules regardless of whose
// view you're building (see components/MyScheduleView, which then picks out
// just the signed-in person's own row — nobody else's is ever shown).
export async function getWeekScheduleForAllStaff(mondayStr: string): Promise<MyScheduleRow[]> {
  const dates = weekDates(mondayStr);

  const [staff, allScheduleSlots, providerAbsences, providerAutoOverrides, staffAbsences, scribeFallbacks, providers, allStaffTemplateSlots, days] =
    await Promise.all([
      prisma.staff.findMany({ where: { active: true, usesApp: true }, orderBy: { name: "asc" } }),
      prisma.providerScheduleSlot.findMany(),
      prisma.providerAbsence.findMany({ where: { date: { in: dates } } }),
      prisma.providerAutoOverride.findMany({ where: { date: { in: dates } } }),
      // A PENDING day-off request shouldn't show you as "out" until Joanna
      // approves it — see the StaffAbsence schema comment.
      prisma.staffAbsence.findMany({ where: { date: { in: dates }, status: "APPROVED" } }),
      prisma.scribeFallback.findMany(),
      prisma.provider.findMany({ where: { active: true }, select: { id: true, name: true } }),
      prisma.staffScheduleSlot.findMany(),
      Promise.all(dates.map((date) => getDaySchedule(date))),
    ]);
  const optedInStaffIds = new Set(allStaffTemplateSlots.map((t) => t.staffId));

  // A PA-C (or similar) who logs in as staff but is actually scheduled as a
  // Provider — a shadow Staff record sharing their exact name (see Staff.kind
  // doc comment). Their "my schedule" reflects their own provider slot, not
  // a role placement, since they're never staffed into one.
  const providerIdByStaffName = new Map(providers.map((p) => [p.name, p.id]));

  return staff.map((s) => ({
    staffId: s.id,
    name: s.name,
    color: s.color,
    days: dates.map((date, i) => {
      const weekday = weekdayIndex(date)!; // weekDates only ever returns Mon-Fri
      const day = days[i];
      const halves = {} as Record<Half, MyScheduleCell>;

      for (const half of HALVES) {
        const isOut = staffAbsences.some((a) => a.staffId === s.id && a.date === date && absenceMatches(half, a.half));
        const lateMinutes =
          staffAbsences.find((a) => a.staffId === s.id && a.date === date && a.half === "CUSTOM")?.lateMinutes ?? null;

        // Where are they actually placed right now, per the real computed
        // day (covers present-and-working, and also a present person who's
        // opted out of their default and self-placed somewhere else)?
        let found: { office: Office; role: Role; providerName: string | null } | null = null;
        for (const office of OFFICES) {
          const slot = day.halves[half][office];
          const scribeHit = slot.providers.find((p) => p.scribe?.staffId === s.id);
          if (scribeHit) found = { office, role: "SCRIBE", providerName: scribeHit.provider.name };
          if (slot.rooming.some((r) => r.staffId === s.id)) found = { office, role: "ROOMING", providerName: null };
          if (slot.xray.some((x) => x.staffId === s.id)) found = { office, role: "XRAY", providerName: null };
        }

        if (found) {
          halves[half] = { ...found, isOut: false, lateMinutes, coveringName: null, isProvider: false, scribeName: null };
          continue;
        }

        const shadowProviderId = providerIdByStaffName.get(s.name);
        if (shadowProviderId) {
          let providerHit: { office: Office; scribeName: string | null; lateMinutes: number | null } | null = null;
          for (const office of OFFICES) {
            const hit = day.halves[half][office].providers.find((p) => p.provider.id === shadowProviderId);
            if (hit) {
              providerHit = { office, scribeName: hit.scribe?.name ?? null, lateMinutes: hit.provider.lateMinutes };
              break;
            }
          }
          halves[half] = providerHit
            ? {
                office: providerHit.office,
                role: null,
                providerName: null,
                isOut: false,
                lateMinutes: providerHit.lateMinutes,
                coveringName: null,
                isProvider: true,
                scribeName: providerHit.scribeName,
              }
            : blankCell(false, null);
          continue;
        }

        if (!isOut) {
          halves[half] = blankCell(false, lateMinutes);
          continue;
        }

        // They're out and nowhere in the real schedule — figure out what
        // they'd normally be doing (ignoring only their own absence), then
        // check who's actually in that exact slot instead. Only SCRIBE
        // (tied to one provider) and XRAY (one default tech per office) are
        // real 1:1 slots a specific substitute can be said to fill; default
        // rooming is an uncounted shared list, so there's no single sub to
        // name there — stays blank, same as having no duty at all.
        const weekdaySlots = allScheduleSlots.filter((row) => row.weekday === weekday);
        const dateProviderAbsences = providerAbsences.filter((a) => a.date === date);
        const dateProviderAutoOverrides = providerAutoOverrides.filter((o) => o.date === date);
        const { isActive } = buildActivity(weekdaySlots, dateProviderAbsences, dateProviderAutoOverrides);

        let duty: { office: Office; role: Role; providerId: string | null } | null = null;

        if (optedInStaffIds.has(s.id)) {
          // Personal template is the only source once opted in — see
          // getDaySchedule for the matching logic this mirrors.
          const templateSlot = allStaffTemplateSlots.find((t) => t.staffId === s.id && t.weekday === weekday && t.half === half);
          if (templateSlot?.role === "SCRIBE" && templateSlot.providerId && isActive(templateSlot.providerId, half)) {
            const slot = weekdaySlots.find((row) => row.providerId === templateSlot.providerId && row.half === half);
            if (slot?.office) duty = { office: slot.office as Office, role: "SCRIBE", providerId: templateSlot.providerId };
          } else if (templateSlot?.role === "XRAY" && templateSlot.office) {
            duty = { office: templateSlot.office as Office, role: "XRAY", providerId: null };
          }
        } else {
          if (s.dedicatedProviderId && isActive(s.dedicatedProviderId, half)) {
            const slot = weekdaySlots.find((row) => row.providerId === s.dedicatedProviderId && row.half === half);
            if (slot?.office) duty = { office: slot.office as Office, role: "SCRIBE", providerId: s.dedicatedProviderId };
          } else {
            const fallbackRow = resolveFallback(scribeFallbacks, s.id, weekday, half, isActive);
            if (fallbackRow?.targetProviderId) {
              const slot = weekdaySlots.find((row) => row.providerId === fallbackRow.targetProviderId && row.half === half);
              if (slot?.office) duty = { office: slot.office as Office, role: "SCRIBE", providerId: fallbackRow.targetProviderId };
            }
          }
          if (!duty && s.defaultXrayOffice) {
            duty = { office: s.defaultXrayOffice as Office, role: "XRAY", providerId: null };
          }
        }

        if (!duty) {
          halves[half] = blankCell(true, lateMinutes);
          continue;
        }

        const dutySlot = day.halves[half][duty.office];
        const coveringName =
          duty.role === "SCRIBE"
            ? (dutySlot.providers.find((pc) => pc.provider.id === duty!.providerId)?.scribe?.name ?? null)
            : (dutySlot.xray[0]?.name ?? null);

        // Nobody has actually stepped into the slot — blank, per spec,
        // rather than describing a duty nobody is covering.
        halves[half] = coveringName
          ? {
              office: duty.office,
              role: duty.role,
              providerName: duty.role === "SCRIBE" ? (dutySlot.providers.find((pc) => pc.provider.id === duty!.providerId)?.provider.name ?? null) : null,
              isOut: true,
              lateMinutes,
              coveringName,
              isProvider: false,
              scribeName: null,
            }
          : blankCell(true, lateMinutes);
      }

      return { date, weekday, halves };
    }),
  }));
}
