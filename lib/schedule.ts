import { prisma } from "./prisma";
import { weekdayIndex } from "./date";
import { HALVES, OFFICES, SCRIBE_PRIORITY, type Half, type Office } from "./types";

export type ProviderCell = {
  provider: { id: string; name: string; initials: string };
  scribe: { staffId: string; name: string; substitute: boolean } | null;
  patientCount: number | null;
};

export type AssignmentCell = {
  id: string;
  role: string;
  staffId: string;
  name: string;
  providerId: string | null;
  providerName: string | null;
  // true for a computed default placement (scribe fallback / dedicated aid)
  // rather than a manually-created Assignment row — not removable via the UI.
  auto: boolean;
};

// "GOOD" = fewer patients than the other office this half but more staff
// covering it (comparatively over-staffed); "NEEDS_HELP" = the mirror case
// (more patients, fewer staff); "NEUTRAL" = no such mismatch.
export type OfficeBalance = "GOOD" | "NEEDS_HELP" | "NEUTRAL";

export type HalfSlot = {
  office: Office;
  half: Half;
  providers: ProviderCell[];
  subScribes: AssignmentCell[];
  rooming: AssignmentCell[];
  xray: AssignmentCell[];
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
};

export type FreeStaffMember = {
  id: string;
  name: string;
  kind: string;
  canScribe: boolean;
  homeOffice: Office | null;
  dedicatedProviderName: string | null;
  reason: string;
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

  const [scheduleSlots, providerAbsences, staff, staffAbsences, patientCounts, assignments, scribeFallbacks] =
    await Promise.all([
      weekday === null
        ? Promise.resolve([])
        : prisma.providerScheduleSlot.findMany({
            where: { weekday },
            include: { provider: true },
          }),
      prisma.providerAbsence.findMany({ where: { date } }),
      prisma.staff.findMany({ where: { active: true }, include: { dedicatedProvider: true, dedicatedAidFor: true } }),
      prisma.staffAbsence.findMany({ where: { date } }),
      prisma.patientCount.findMany({ where: { date } }),
      prisma.assignment.findMany({ where: { date }, include: { staff: true, provider: true } }),
      weekday === null ? Promise.resolve([]) : prisma.scribeFallback.findMany({ where: { weekday } }),
    ]);

  const { isAbsent: isProviderAbsent, isActive: isProviderActive } = buildActivity(scheduleSlots, providerAbsences);

  const isStaffAbsent = (staffId: string, half: Half) =>
    staffAbsences.some((a) => a.staffId === staffId && absenceMatches(half, a.half));
  const isStaffAssigned = (staffId: string, half: Half) => assignments.some((a) => a.staffId === staffId && a.half === half);

  // A scribe whose own doctor doesn't need them this half, but who has a
  // fallback row naming `providerId` as their target — e.g. Reda defaults to
  // Brian on Friday PM whenever Christo doesn't need her.
  const resolveTargetScribe = (providerId: string, half: Half) => {
    if (weekday === null) return null;
    for (const s of staff) {
      if (!s.dedicatedProviderId || isProviderActive(s.dedicatedProviderId, half)) continue;
      if (isStaffAbsent(s.id, half) || isStaffAssigned(s.id, half)) continue;
      const row = resolveFallback(scribeFallbacks, s.id, weekday, half, isProviderActive);
      if (row?.targetProviderId === providerId) return { staffId: s.id, name: s.name };
    }
    return null;
  };

  const halves = {} as Record<Half, Record<Office, HalfSlot>>;
  const officeTotals: Record<Office, number> = { BETHESDA: 0, GERMANTOWN: 0 };

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
          scribe = { staffId: explicitSub.staffId, name: explicitSub.staff.name, substitute: true };
        } else if (dedicated && !dedicatedAbsent) {
          scribe = { staffId: dedicated.id, name: dedicated.name, substitute: false };
        } else {
          const target = resolveTargetScribe(s.providerId, half);
          if (target) scribe = { staffId: target.staffId, name: target.name, substitute: false };
        }

        const pc = patientCounts.find((p) => p.providerId === s.providerId && p.half === half);

        return {
          provider: { id: s.providerId, name: s.provider.name, initials: s.provider.initials },
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
        auto: false,
      });

      // Computed default rooming presence: a dedicated scribe falling back to
      // this office (own doctor not active this half), or a dedicated aid
      // (e.g. Mark for Christo) whose paired doctor is active in this office.
      const activeProviderIdsHere = new Set(activeSlots.map((s) => s.providerId));
      const autoEntries: AssignmentCell[] = [];
      if (weekday !== null) {
        for (const s of staff) {
          if (isStaffAbsent(s.id, half) || isStaffAssigned(s.id, half)) continue;

          if (s.dedicatedProviderId && !isProviderActive(s.dedicatedProviderId, half)) {
            const fallbackRow = resolveFallback(scribeFallbacks, s.id, weekday, half, isProviderActive);
            // Provider-targeted rows (e.g. Reda -> Brian) render as that
            // provider's scribe above, not a generic office-support entry.
            if (fallbackRow && !fallbackRow.targetProviderId && fallbackRow.office === office) {
              autoEntries.push({
                id: `auto:${s.id}`,
                role: "ROOMING",
                staffId: s.id,
                name: s.name,
                providerId: null,
                providerName: null,
                auto: true,
              });
              continue;
            }
          }

          if (s.dedicatedAidForProviderId && (!s.homeOffice || s.homeOffice === office)) {
            if (activeProviderIdsHere.has(s.dedicatedAidForProviderId)) {
              autoEntries.push({
                id: `auto:${s.id}`,
                role: "ROOMING",
                staffId: s.id,
                name: s.name,
                providerId: s.dedicatedAidForProviderId,
                providerName: s.dedicatedAidFor?.name ?? null,
                auto: true,
              });
            }
          }
        }
      }

      const patientTotal = providers.reduce((sum, p) => sum + (p.patientCount ?? 0), 0);
      officeTotals[office] += patientTotal;

      const subScribes = officeAssignments.filter((a) => a.role === "SUB_SCRIBE").map(toCell);
      const rooming = [...officeAssignments.filter((a) => a.role === "ROOMING").map(toCell), ...autoEntries];
      const xray = officeAssignments.filter((a) => a.role === "XRAY").map(toCell);
      const staffCount =
        providers.filter((p) => p.scribe).length + subScribes.length + rooming.length + xray.length;

      halves[half][office] = {
        office,
        half,
        providers,
        subScribes,
        rooming,
        xray,
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
  }

  let needsMoreStaffing: Office | null = null;
  if (officeTotals.BETHESDA !== officeTotals.GERMANTOWN) {
    needsMoreStaffing = officeTotals.BETHESDA > officeTotals.GERMANTOWN ? "BETHESDA" : "GERMANTOWN";
  }

  return { date, weekday, halves, officeTotals, needsMoreStaffing };
}

// Which staff are free to self-place, per half, and why. Scribe-eligible
// entries are ordered by experience (SCRIBE_PRIORITY) so substitute pickers
// suggest the most experienced available scribe first.
export async function getFreeStaff(date: string): Promise<Record<Half, FreeStaffMember[]>> {
  const weekday = weekdayIndex(date);

  const [scheduleSlots, providerAbsences, staff, staffAbsences, assignments, scribeFallbacks] = await Promise.all([
    weekday === null
      ? Promise.resolve([])
      : prisma.providerScheduleSlot.findMany({ where: { weekday } }),
    prisma.providerAbsence.findMany({ where: { date } }),
    prisma.staff.findMany({ where: { active: true }, include: { dedicatedProvider: true, dedicatedAidFor: true } }),
    prisma.staffAbsence.findMany({ where: { date } }),
    prisma.assignment.findMany({ where: { date } }),
    weekday === null ? Promise.resolve([]) : prisma.scribeFallback.findMany({ where: { weekday } }),
  ]);

  const { isActive: isProviderActive, activeOffice: providerActiveOffice } = buildActivity(scheduleSlots, providerAbsences);

  const result: Record<Half, FreeStaffMember[]> = { AM: [], PM: [] };

  for (const half of HALVES) {
    for (const s of staff) {
      const isAbsent = staffAbsences.some((a) => a.staffId === s.id && absenceMatches(half, a.half));
      if (isAbsent) continue;

      const alreadyAssigned = assignments.some((a) => a.staffId === s.id && a.half === half);
      if (alreadyAssigned) continue;

      let reason = "Available";
      if (s.dedicatedProviderId) {
        const doctorActive = isProviderActive(s.dedicatedProviderId, half);
        if (doctorActive) continue; // committed to their doctor, not free

        const fallbackRow =
          weekday === null ? null : resolveFallback(scribeFallbacks, s.id, weekday, half, isProviderActive);
        if (fallbackRow) continue; // committed to their fallback (office support, or a specific provider), not free

        reason = `${s.dedicatedProvider?.name ?? "Their doctor"} is out this half`;
      }

      if (s.dedicatedAidForProviderId) {
        const activeOffice = providerActiveOffice(s.dedicatedAidForProviderId, half);
        const officeMatches = activeOffice !== null && (!s.homeOffice || activeOffice === s.homeOffice);
        if (officeMatches) continue; // committed as dedicated aid, not free
      }

      result[half].push({
        id: s.id,
        name: s.name,
        kind: s.kind,
        canScribe: s.canScribe,
        homeOffice: (s.homeOffice as Office | null) ?? null,
        dedicatedProviderName: s.dedicatedProvider?.name ?? null,
        reason,
      });
    }

    result[half].sort((a, b) => scribeRank(a.name) - scribeRank(b.name));
  }

  return result;
}
