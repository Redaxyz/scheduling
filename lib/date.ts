// Dates are stored/passed around as plain "YYYY-MM-DD" strings throughout the
// app so we never fight timezone conversion on a field that's really just a
// calendar day.

export function todayStr(): string {
  const d = new Date();
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

// Monday=0 .. Friday=4, Saturday/Sunday => null
export function weekdayIndex(dateStr: string): number | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  if (jsDay === 0 || jsDay === 6) return null;
  return jsDay - 1; // Mon=0 .. Fri=4
}

export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

// The next weekday after dateStr — Friday's next business day is Monday, so
// a run of dates spanning a weekend still counts as one continuous stretch
// (used to group consecutive day-off requests into a single approval).
export function nextBusinessDay(dateStr: string): string {
  let next = addDays(dateStr, 1);
  while (weekdayIndex(next) === null) next = addDays(next, 1);
  return next;
}

export function formatLong(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function isWeekday(dateStr: string): boolean {
  return weekdayIndex(dateStr) !== null;
}

// The Monday on/before dateStr's week (works for any day, weekend included).
export function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  const deltaToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  return addDays(dateStr, deltaToMonday);
}

// The Monday on/after dateStr — the opposite direction from mondayOf, used
// when landing a month's 1st on a week: mondayOf would often roll backward
// into the previous month (e.g. October 1st, a Thursday, lands on September
// 28th), which reads as "went back a week" even though nothing did.
export function mondayOnOrAfter(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  const deltaToMonday = (8 - jsDay) % 7;
  return addDays(dateStr, deltaToMonday);
}

// The 5 weekday dates (Mon..Fri) of the week starting at mondayStr.
export function weekDates(mondayStr: string): string[] {
  return [0, 1, 2, 3, 4].map((n) => addDays(mondayStr, n));
}

export function formatShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function firstOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function addMonths(firstOfMonthStr: string, delta: number): string {
  const [y, m] = firstOfMonthStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return dt.toISOString().slice(0, 10);
}

// All weekday (Mon-Fri) dates in the month starting at firstOfMonthStr.
export function monthWeekdays(firstOfMonthStr: string): string[] {
  const [y, m] = firstOfMonthStr.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dates: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (isWeekday(dateStr)) dates.push(dateStr);
  }
  return dates;
}

export function formatMonthLabel(firstOfMonthStr: string): string {
  const [y, m] = firstOfMonthStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return dt.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

// The month's weekdays grouped into Mon-Fri rows, like a real calendar grid:
// each row has exactly 5 slots, padded with null before the 1st and after
// the last day so every date lines up under its correct weekday column.
export function monthGridWeeks(firstOfMonthStr: string): (string | null)[][] {
  const dates = monthWeekdays(firstOfMonthStr);
  const weeks: (string | null)[][] = [];
  let row: (string | null)[] = [];
  for (const date of dates) {
    if (row.length === 0) {
      const wd = weekdayIndex(date)!;
      for (let i = 0; i < wd; i++) row.push(null);
    }
    row.push(date);
    if (row.length === 5) {
      weeks.push(row);
      row = [];
    }
  }
  if (row.length > 0) {
    while (row.length < 5) row.push(null);
    weeks.push(row);
  }
  return weeks;
}
