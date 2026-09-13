// U.S. federal holidays — computed per-year from calendar rules instead of a
// hardcoded date table, so this stays correct for any year without needing
// yearly maintenance. Purely a display concern (see StaffCalendarGrid /
// ProviderCalendarGrid): a holiday still behaves like a normal weekday
// everywhere else (templates, scheduling, day-nav) — it's just recolored
// and labeled in the calendar grids, not removed like a weekend.

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

// The nth occurrence of a given weekday in a month (e.g. "3rd Monday of
// January" for MLK Day). weekday: 0=Sun..6=Sat. month: 1-12. n: 1-based.
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): string {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
  return toDateStr(year, month, day);
}

// The last occurrence of a given weekday in a month (e.g. "last Monday of
// May" for Memorial Day).
function lastWeekdayOfMonth(year: number, month: number, weekday: number): string {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDayWeekday = new Date(Date.UTC(year, month - 1, daysInMonth)).getUTCDay();
  const day = daysInMonth - ((lastDayWeekday - weekday + 7) % 7);
  return toDateStr(year, month, day);
}

// Returns the holiday's name if `dateStr` ("YYYY-MM-DD") falls on one of the
// 11 official U.S. federal holidays, else null. Deliberately doesn't shift
// fixed dates that land on a weekend (e.g. July 4th on a Saturday) — the
// clinic's own weekend closure already covers those days regardless.
export function federalHolidayName(dateStr: string): string | null {
  const year = Number(dateStr.slice(0, 4));

  const fixed: Record<string, string> = {
    [toDateStr(year, 1, 1)]: "New Year's Day",
    [toDateStr(year, 6, 19)]: "Juneteenth",
    [toDateStr(year, 7, 4)]: "Independence Day",
    [toDateStr(year, 11, 11)]: "Veterans Day",
    [toDateStr(year, 12, 25)]: "Christmas Day",
  };
  if (fixed[dateStr]) return fixed[dateStr];

  const floating: Record<string, string> = {
    [nthWeekdayOfMonth(year, 1, 1, 3)]: "Martin Luther King Jr. Day",
    [nthWeekdayOfMonth(year, 2, 1, 3)]: "Presidents' Day",
    [lastWeekdayOfMonth(year, 5, 1)]: "Memorial Day",
    [nthWeekdayOfMonth(year, 9, 1, 1)]: "Labor Day",
    [nthWeekdayOfMonth(year, 10, 1, 2)]: "Columbus Day",
    [nthWeekdayOfMonth(year, 11, 4, 4)]: "Thanksgiving Day",
  };
  return floating[dateStr] ?? null;
}

export function isFederalHoliday(dateStr: string): boolean {
  return federalHolidayName(dateStr) !== null;
}

// A washed-out purple, deliberately softer than the vivid status colors it
// sits alongside — a holiday cell isn't a real present/absent/surgery
// status, just a visual "nobody's expected today" marker.
export const HOLIDAY_COLOR = "#c4b5fd";
