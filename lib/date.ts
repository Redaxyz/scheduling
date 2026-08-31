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

// The 5 weekday dates (Mon..Fri) of the week starting at mondayStr.
export function weekDates(mondayStr: string): string[] {
  return [0, 1, 2, 3, 4].map((n) => addDays(mondayStr, n));
}

export function formatShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
