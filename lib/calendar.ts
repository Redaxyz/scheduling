import { prisma } from "./prisma";
import { monthWeekdays, weekDates, weekdayIndex } from "./date";
import { HALVES, type Half, type Office } from "./types";

// Per half-day: an explicit ProviderAbsence row (SURGERY if flagged, else
// ABSENT) always wins; failing that, the provider's own template defaults
// to surgery this weekday+half (see ProviderScheduleSlot.surgery) unless a
// ProviderAutoOverride opts this specific date back to present; otherwise
// PRESENT. late is independent of AM/PM — a CUSTOM row is a running-late
// note for the whole day, not tied to one half, so it's on both.
export type ProviderHalfStatus = "PRESENT" | "ABSENT" | "SURGERY";

export type ProviderHalfCell = {
  status: ProviderHalfStatus;
  // true when this half's status comes from the template default rather
  // than an explicit absence row for this exact date — so the UI can hint
  // that toggling it creates a one-off exception instead of editing history.
  fromTemplate: boolean;
  // Which office the weekly template has this provider at for this
  // weekday+half, regardless of today's actual present/absent/surgery
  // status — shown as a small B/G letter in the UI. Null when the template
  // doesn't put them at either office that half.
  office: Office | null;
};

export type ProviderCalendarRow = {
  providerId: string;
  name: string;
  initials: string;
  days: Record<string, Record<Half, ProviderHalfCell>>;
};

async function getProviderCalendarForDates(dates: string[]): Promise<ProviderCalendarRow[]> {
  const [providers, absences, overrides, templateSlots] = await Promise.all([
    prisma.provider.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.providerAbsence.findMany({ where: { date: { in: dates } } }),
    prisma.providerAutoOverride.findMany({ where: { date: { in: dates } } }),
    prisma.providerScheduleSlot.findMany(),
  ]);

  return providers.map((p) => {
    const days = {} as Record<string, Record<Half, ProviderHalfCell>>;
    for (const date of dates) {
      const weekday = weekdayIndex(date);
      const rows = absences.filter((a) => a.providerId === p.id && a.date === date);
      const halves = {} as Record<Half, ProviderHalfCell>;
      for (const half of HALVES) {
        const slot = weekday === null ? undefined : templateSlots.find((s) => s.providerId === p.id && s.weekday === weekday && s.half === half);
        const office = (slot?.office as Office | null) ?? null;

        const matching = rows.filter((a) => a.half === "ALL" || a.half === half);
        if (matching.length > 0) {
          halves[half] = { status: matching.some((a) => a.surgery) ? "SURGERY" : "ABSENT", fromTemplate: false, office };
          continue;
        }
        const overridden = overrides.some((o) => o.providerId === p.id && o.date === date && o.half === half);
        const defaultsToSurgery = !overridden && Boolean(slot?.surgery);
        halves[half] = { status: defaultsToSurgery ? "SURGERY" : "PRESENT", fromTemplate: defaultsToSurgery, office };
      }
      days[date] = halves;
    }
    return { providerId: p.id, name: p.name, initials: p.initials, days };
  });
}

export function getProviderMonthCalendar(firstOfMonthStr: string): Promise<ProviderCalendarRow[]> {
  return getProviderCalendarForDates(monthWeekdays(firstOfMonthStr));
}

export function getProviderWeekCalendar(mondayStr: string): Promise<ProviderCalendarRow[]> {
  return getProviderCalendarForDates(weekDates(mondayStr));
}

// PRESENT = no approved absence at all that day. ABSENT = out the whole day
// (an ALL row, or separate AM+PM rows covering both halves), approved.
// PARTIAL = approved for only one half, or just a CUSTOM running-late note
// (not a real absence, but still worth flagging). PENDING = a day-off
// request submitted but not yet approved by Joanna — see the StaffAbsence
// schema comment; doesn't block anything yet, just needs a decision.
export type StaffDayStatus = "PRESENT" | "ABSENT" | "PARTIAL" | "PENDING";

export type StaffCalendarRow = {
  staffId: string;
  name: string;
  color: string;
  days: Record<string, StaffDayStatus>;
};

async function getStaffCalendarForDates(dates: string[]): Promise<StaffCalendarRow[]> {
  const [staff, absences] = await Promise.all([
    prisma.staff.findMany({ where: { active: true, usesApp: true }, orderBy: { name: "asc" } }),
    prisma.staffAbsence.findMany({ where: { date: { in: dates } } }),
  ]);

  return staff.map((s) => {
    const days = {} as Record<string, StaffDayStatus>;
    for (const date of dates) {
      const rows = absences.filter((a) => a.staffId === s.id && a.date === date);
      const approved = rows.filter((a) => a.status === "APPROVED");
      const hasAM = approved.some((a) => a.half === "ALL" || a.half === "AM");
      const hasPM = approved.some((a) => a.half === "ALL" || a.half === "PM");
      const hasCustom = approved.some((a) => a.half === "CUSTOM");
      const hasPending = rows.some((a) => a.status === "PENDING");
      days[date] = hasAM && hasPM ? "ABSENT" : hasAM || hasPM || hasCustom ? "PARTIAL" : hasPending ? "PENDING" : "PRESENT";
    }
    return { staffId: s.id, name: s.name, color: s.color, days };
  });
}

export function getStaffMonthCalendar(firstOfMonthStr: string): Promise<StaffCalendarRow[]> {
  return getStaffCalendarForDates(monthWeekdays(firstOfMonthStr));
}

export function getStaffWeekCalendar(mondayStr: string): Promise<StaffCalendarRow[]> {
  return getStaffCalendarForDates(weekDates(mondayStr));
}
