import { prisma } from "./prisma";
import { monthWeekdays, weekDates, weekdayIndex } from "./date";
import { HALVES, WEEKDAY_LABELS, type Half, type Office } from "./types";

export type QuadrantEntry = {
  providerId: string;
  initials: string;
  name: string;
  present: boolean;
  absenceId: string | null; // set when present === false, so the UI can un-mark it
};

export type DayQuadrants = {
  date: string;
  weekdayLabel: string;
  // office -> half -> entries scheduled there that day
  cells: Record<Office, Record<Half, QuadrantEntry[]>>;
};

async function getCalendarForDates(dates: string[]): Promise<DayQuadrants[]> {
  const [scheduleSlots, absences] = await Promise.all([
    prisma.providerScheduleSlot.findMany({
      where: { office: { not: null } },
      include: { provider: true },
    }),
    prisma.providerAbsence.findMany({ where: { date: { in: dates } } }),
  ]);

  return dates.map((date) => {
    const weekday = weekdayIndex(date)!;
    const cells = {} as DayQuadrants["cells"];
    for (const office of ["BETHESDA", "GERMANTOWN"] as Office[]) {
      cells[office] = {} as Record<Half, QuadrantEntry[]>;
      for (const half of HALVES) {
        const slots = scheduleSlots.filter((s) => s.weekday === weekday && s.office === office && s.half === half);
        cells[office][half] = slots.map((s) => {
          const absence = absences.find(
            (a) => a.providerId === s.providerId && a.date === date && (a.half === "ALL" || a.half === half)
          );
          return {
            providerId: s.providerId,
            initials: s.provider.initials,
            name: s.provider.name,
            present: !absence,
            absenceId: absence?.id ?? null,
          };
        });
      }
    }
    return { date, weekdayLabel: WEEKDAY_LABELS[weekday], cells };
  });
}

export function getWeekCalendar(mondayStr: string): Promise<DayQuadrants[]> {
  return getCalendarForDates(weekDates(mondayStr));
}

export function getMonthCalendar(firstOfMonthStr: string): Promise<DayQuadrants[]> {
  return getCalendarForDates(monthWeekdays(firstOfMonthStr));
}
