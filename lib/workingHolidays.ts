import { prisma } from "./prisma";
import { isFederalHoliday } from "./holidays";

// Server-only, kept out of lib/holidays.ts because the calendar grids import
// that file in the browser, where the database client can't load.
// Which federal holidays within `dates` the clinic actually works, as a
// Set for O(1) lookup — queried once per calendar page load and passed down
// to both grids so Staff/Provider/week/month all agree on the same toggle.
export async function getWorkingHolidays(dates: string[]): Promise<Set<string>> {
  const holidayDates = dates.filter(isFederalHoliday);
  if (holidayDates.length === 0) return new Set();
  const rows = await prisma.holidayOverride.findMany({ where: { date: { in: holidayDates } } });
  return new Set(rows.map((r) => r.date));
}
