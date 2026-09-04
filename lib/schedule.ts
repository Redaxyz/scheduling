import { prisma } from "./prisma";
import { weekdayIndex } from "./date";
import { HALVES, OFFICES, SCRIBE_PRIORITY, type Half, type Office } from "./types";

export type ProviderCell = {
  provider: { id: string; name: string; initials: string; lateMinutes: number | null };
  // assignmentId is set only for an explicit substitute (a real Assignment
  // row, removable via DELETE); null for a computed default (dedicated or
  // fallback), removable instead via an AutoOverride.
  scribe: { staffId: string; name: string; substitute: boolean; assignmentId: string | null; lateMinutes: number | null } | null;
  patientCount: number | null;
};

export type AssignmentCell = {
  id: string;
  role: string;
  staffId: string;
  name: string;
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

// "GOOD" = fewer patients than the other office this half but more staff
// covering it (comparatively over-staffed); "NEEDS_HELP" = the mirror case
// (more patients, fewer staff); "NEUTRAL" = no such mismatch.
export type OfficeBalance = "GOOD" | "NEEDS_HELP" | "NEUTRAL";

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
  patientTotal: number;
  staffCount: number;
  balance: OfficeBalance;
};

export type DaySchedule = {
  date: string;
  weekday: number | null;
  halves: Record<Half, Record<Office, HalfSlot>>;
  officeTotals: Record<Office, number>;
  needsMoreStaffing: Office | null;
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

type ScheduleSlotRow = { providerId: string; half: string; office: string | null };
type ProviderAbsenceRow = { providerId: string; half: string };
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
// template + one-off absences — used by both exports below.
function buildActivity(scheduleSlots: ScheduleSlotRow[], providerAbsences: ProviderAbsenceRow[]) {
  const isAbsent = (providerId: string, half: Half) =>
    providerAbsences.some((a) => a.providerId === providerId && absenceMatches(half, a.half));

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

  const [scheduleSlots, providerAbsences, staff, staffAbsences, patientCounts, assignments, scribeFallbacks, autoOverrides, allProviders] =
    await Promise.all([
      weekday === null
        ? Promise.resolve([])
        : prisma.providerScheduleSlot.findMany({
            where: { weekday },
            include: { provider: true },
          }),
      prisma.providerAbsence.findMany({ where: { date } }),
      prisma.staff.findMany({
        where: { active: true },
        include: { dedicatedProvider: true, xrayBackupAs: true },
      }),
      prisma.staffAbsence.findMany({ where: { date } }),
      prisma.patientCount.findMany({ where: { date } }),
      prisma.assignment.findMany({ where: { date }, include: { staff: true, provider: true } }),
      weekday === null ? Promise.resolve([]) : prisma.scribeFallback.findMany({ where: { weekday } }),
      prisma.autoOverride.findMany({ where: { date } }),
      prisma.provider.findMany({ where: { active: true }, select: { name: true } }),
    ]);
  const providerNames = new Set(allProviders.map((p) => p.name));

  const { isAbsent: isProviderAbsent, isActive: isProviderActive } = buildActivity(scheduleSlots, providerAbsences);

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
  // Brian on Friday PM whenever Christo doesn't need her.
  const resolveTargetScribe = (providerId: string, half: Half) => {
    if (weekday === null) return null;
    for (const s of staff) {
      if (!s.dedicatedProviderId || isProviderActive(s.dedicatedProviderId, half)) continue;
      if (isStaffAbsent(s.id, half) || isStaffAssigned(s.id, half) || isOverridden(s.id, half)) continue;
      const row = resolveFallback(scribeFallbacks, s.id, weekday, half, isProviderActive);
      if (row?.targetProviderId === providerId) return { staffId: s.id, name: s.name };
    }
    return null;
  };

  const halves = {} as Record<Half, Record<Office, HalfSlot>>;
  const officeTotals: Record<Office, number> = { BETHESDA: 0, GERMANTOWN: 0 };
  const unassigned = {} as Record<Half, { id: string; name: string }[]>;
  const reassignable = {} as Record<Half, { id: string; name: string }[]>;

  for (const half of HALVES) {
    halves[half] = {} as Record<Office, HalfSlot>;
    for (const office of OFFICES) {
      const activeSlots = scheduleSlots.filter(
        (s) => s.office === office && s.half === half && !isProviderAbsent(s.providerId, half)
      );

      const providers: ProviderCell[] = activeSlots.map((s) => {
        const dedicated = staff.find((st) => st.dedicatedProviderId === s.providerId);
        const explicitSub = assignments.find(
          (a) => a.role === "SCRIBE" && a.providerId === s.providerId && a.half === half
        );
        const dedicatedAbsent = dedicated ? isStaffAbsent(dedicated.id, half) : true;

        let scribe: ProviderCell["scribe"] = null;
        if (explicitSub) {
          scribe = {
            staffId: explicitSub.staffId,
            name: explicitSub.staff.name,
            substitute: true,
            assignmentId: explicitSub.id,
            lateMinutes: lateStaffMinutes(explicitSub.staffId),
          };
        } else if (dedicated && !dedicatedAbsent && !isOverridden(dedicated.id, half) && !isStaffAssigned(dedicated.id, half)) {
          scribe = {
            staffId: dedicated.id,
            name: dedicated.name,
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
              substitute: false,
              assignmentId: null,
              lateMinutes: lateStaffMinutes(target.staffId),
            };
          }
        }

        const pc = patientCounts.find((p) => p.providerId === s.providerId && p.half === half);

        return {
          provider: {
            id: s.providerId,
            name: s.provider.name,
            initials: s.provider.initials,
            lateMinutes: lateProviderMinutes(s.providerId),
          },
          scribe,
          patientCount: pc ? pc.count : null,
        };
      });

      const officeAssignments = assignments.filter((a) => a.office === office && a.half === half);
      const toCell = (a: (typeof officeAssignments)[number]): AssignmentCell => ({
        id: a.id,
        role: a.role,
        staffId: a.staffId,
        name: a.staff.name,
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
          providerId: null,
          providerName: null,
          lateMinutes: lateStaffMinutes(s.id),
          auto: true,
          hardCommitment: true,
        }));

      // Default x-ray tech for this office (e.g. Cindy in Bethesda), unless
      // absent or opted out — same "auto" treatment as the scribe/aid defaults.
      const defaultXrayStaff = staff.find((s) => s.defaultXrayOffice === office);
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
                providerId: null,
                providerName: null,
                lateMinutes: lateStaffMinutes(defaultXrayStaff.id),
                auto: true,
                hardCommitment: true,
              },
            ]
          : [];

      const xrayEligible =
        weekday === null ? [] : computeXrayEligible(office, half, staff, isStaffAbsent, isStaffAssigned, isOverridden);

      const patientTotal = providers.reduce((sum, p) => sum + (p.patientCount ?? 0), 0);
      officeTotals[office] += patientTotal;

      const rooming = [
        ...officeAssignments.filter((a) => a.role === "ROOMING").map(toCell),
        ...autoRoomingEntries,
        ...autoDefaultRoomingEntries,
      ];
      const xray = [...officeAssignments.filter((a) => a.role === "XRAY").map(toCell), ...autoXrayEntries];
      const staffCount = providers.filter((p) => p.scribe).length + rooming.length + xray.length;

      halves[half][office] = {
        office,
        half,
        providers,
        rooming,
        xray,
        xrayEligible,
        patientTotal,
        staffCount,
        balance: "NEUTRAL",
      };
    }

    // Compare Bethesda vs Germantown for this half: whichever has fewer
    // patients but more staff covering it is comparatively over-staffed
    // ("GOOD"); the other is comparatively under-staffed ("NEEDS_HELP").
    const bt = halves[half].BETHESDA;
    const gt = halves[half].GERMANTOWN;
    if (bt.patientTotal < gt.patientTotal && bt.staffCount > gt.staffCount) {
      bt.balance = "GOOD";
      gt.balance = "NEEDS_HELP";
    } else if (gt.patientTotal < bt.patientTotal && gt.staffCount > bt.staffCount) {
      gt.balance = "GOOD";
      bt.balance = "NEEDS_HELP";
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

  let needsMoreStaffing: Office | null = null;
  if (officeTotals.BETHESDA !== officeTotals.GERMANTOWN) {
    needsMoreStaffing = officeTotals.BETHESDA > officeTotals.GERMANTOWN ? "BETHESDA" : "GERMANTOWN";
  }

  return { date, weekday, halves, officeTotals, needsMoreStaffing, unassigned, reassignable };
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
    prisma.staffAbsence.findMany({ where: { date } }),
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

  const [staff, staffAbsences, assignments, autoOverrides] = await Promise.all([
    prisma.staff.findMany({ where: { active: true }, include: { xrayBackupAs: true } }),
    prisma.staffAbsence.findMany({ where: { date } }),
    prisma.assignment.findMany({ where: { date } }),
    prisma.autoOverride.findMany({ where: { date } }),
  ]);

  const isStaffAbsent = (staffId: string, h: Half) =>
    staffAbsences.some((a) => a.staffId === staffId && absenceMatches(h, a.half));
  const isStaffAssigned = (staffId: string, h: Half) => assignments.some((a) => a.staffId === staffId && a.half === h);
  const isOverridden = (staffId: string, h: Half) => autoOverrides.some((o) => o.staffId === staffId && o.half === h);

  return computeXrayEligible(office, half, staff, isStaffAbsent, isStaffAssigned, isOverridden);
}
