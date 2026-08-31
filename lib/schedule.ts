import { prisma } from "./prisma";
import { weekdayIndex } from "./date";
import { HALVES, OFFICES, type Half, type Office } from "./types";

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
  providerName: string | null;
};

export type HalfSlot = {
  office: Office;
  half: Half;
  providers: ProviderCell[];
  subScribes: AssignmentCell[];
  rooming: AssignmentCell[];
  xray: AssignmentCell[];
  patientTotal: number;
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

export async function getDaySchedule(date: string): Promise<DaySchedule> {
  const weekday = weekdayIndex(date);

  const [scheduleSlots, providerAbsences, staff, staffAbsences, patientCounts, assignments] =
    await Promise.all([
      weekday === null
        ? Promise.resolve([])
        : prisma.providerScheduleSlot.findMany({
            where: { weekday },
            include: { provider: true },
          }),
      prisma.providerAbsence.findMany({ where: { date } }),
      prisma.staff.findMany({ where: { active: true }, include: { dedicatedProvider: true } }),
      prisma.staffAbsence.findMany({ where: { date } }),
      prisma.patientCount.findMany({ where: { date } }),
      prisma.assignment.findMany({ where: { date }, include: { staff: true, provider: true } }),
    ]);

  const isProviderAbsent = (providerId: string, half: Half) =>
    providerAbsences.some((a) => a.providerId === providerId && absenceMatches(half, a.half));

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
        const dedicatedAbsent = dedicated
          ? staffAbsences.some((a) => a.staffId === dedicated.id && absenceMatches(half, a.half))
          : true;

        let scribe: ProviderCell["scribe"] = null;
        if (explicitSub) {
          scribe = { staffId: explicitSub.staffId, name: explicitSub.staff.name, substitute: true };
        } else if (dedicated && !dedicatedAbsent) {
          scribe = { staffId: dedicated.id, name: dedicated.name, substitute: false };
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
        providerName: a.provider?.name ?? null,
      });

      const patientTotal = providers.reduce((sum, p) => sum + (p.patientCount ?? 0), 0);
      officeTotals[office] += patientTotal;

      halves[half][office] = {
        office,
        half,
        providers,
        subScribes: officeAssignments.filter((a) => a.role === "SUB_SCRIBE").map(toCell),
        rooming: officeAssignments.filter((a) => a.role === "ROOMING").map(toCell),
        xray: officeAssignments.filter((a) => a.role === "XRAY").map(toCell),
        patientTotal,
      };
    }
  }

  let needsMoreStaffing: Office | null = null;
  if (officeTotals.BETHESDA !== officeTotals.GERMANTOWN) {
    needsMoreStaffing = officeTotals.BETHESDA > officeTotals.GERMANTOWN ? "BETHESDA" : "GERMANTOWN";
  }

  return { date, weekday, halves, officeTotals, needsMoreStaffing };
}

// Which staff are free to self-place, per half, and why.
export async function getFreeStaff(date: string): Promise<Record<Half, FreeStaffMember[]>> {
  const weekday = weekdayIndex(date);

  const [scheduleSlots, providerAbsences, staff, staffAbsences, assignments] = await Promise.all([
    weekday === null
      ? Promise.resolve([])
      : prisma.providerScheduleSlot.findMany({ where: { weekday } }),
    prisma.providerAbsence.findMany({ where: { date } }),
    prisma.staff.findMany({ where: { active: true }, include: { dedicatedProvider: true } }),
    prisma.staffAbsence.findMany({ where: { date } }),
    prisma.assignment.findMany({ where: { date } }),
  ]);

  const isProviderAbsent = (providerId: string, half: Half) =>
    providerAbsences.some((a) => a.providerId === providerId && absenceMatches(half, a.half));

  const isProviderActive = (providerId: string, half: Half) =>
    scheduleSlots.some(
      (s) => s.providerId === providerId && s.half === half && s.office !== null && !isProviderAbsent(providerId, half)
    );

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
        reason = `${s.dedicatedProvider?.name ?? "Their doctor"} is out this half`;
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
  }

  return result;
}
