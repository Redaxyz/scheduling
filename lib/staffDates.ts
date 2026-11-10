// The last day someone works ("YYYY-MM-DD", by stored name). After it they
// drop out of the app: off the sign-in screen, off every schedule from the
// next day on, and out of the calendars once a view starts after it. Days up
// to and including it stay exactly as they were.
export const LAST_DAYS: Record<string, string> = {
  JB: "2026-11-13",
};

export function worksOn(name: string, date: string): boolean {
  const last = LAST_DAYS[name];
  return !last || date <= last;
}
