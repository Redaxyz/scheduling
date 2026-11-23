// Holiday color themes: from a week before a holiday to a week after it, the
// two offices trade their usual cream and black for the holiday's colors,
// and the app's accents (borders, icons, the dock) go plain black and white.
// Decided by today's date in Eastern time, the same on the server and in the
// browser, so the page never flashes from one look to the other.
//
// The colors themselves are CSS variables (html[data-holiday=...] in
// app/globals.css); this file says which theme applies and whether each
// office's color is dark (white text on it) or light (black text).
import { addDays } from "./date";
import type { Office } from "./types";

export type HolidayKey = "thanksgiving" | "christmas";

// Set by ?holiday=... (see components/HolidayProvider.tsx) to try a theme in
// one browser: a theme's key, or "none".
export const HOLIDAY_COOKIE = "holiday";

type HolidayTheme = {
  name: string;
  // Is this office's holiday color dark enough to need white text?
  dark: Record<Office, boolean>;
};

export const HOLIDAY_THEMES: Record<HolidayKey, HolidayTheme> = {
  // Bethesda golden yellow, Germantown red-orange.
  thanksgiving: { name: "Thanksgiving", dark: { BETHESDA: false, GERMANTOWN: true } },
  // Bethesda red, Germantown green.
  christmas: { name: "Christmas", dark: { BETHESDA: true, GERMANTOWN: true } },
};

// How far either side of the holiday its theme runs.
const DAYS_AROUND = 7;

// "2026-11-26" for 2026: the fourth Thursday of November.
function thanksgivingOf(year: number): string {
  const first = new Date(Date.UTC(year, 10, 1)).getUTCDay(); // 0=Sun
  const firstThursday = 1 + ((4 - first + 7) % 7);
  return `${year}-11-${String(firstThursday + 21).padStart(2, "0")}`;
}

function within(date: string, holiday: string): boolean {
  return date >= addDays(holiday, -DAYS_AROUND) && date <= addDays(holiday, DAYS_AROUND);
}

// The holiday theme for a given day (YYYY-MM-DD), or null on an ordinary day.
export function holidayFor(date: string): HolidayKey | null {
  const year = Number(date.slice(0, 4));
  if (within(date, thanksgivingOf(year))) return "thanksgiving";
  // Early January still counts as last year's Christmas week.
  if (within(date, `${year}-12-25`) || within(date, `${year - 1}-12-25`)) return "christmas";
  return null;
}

export function isHolidayKey(value: string | undefined | null): value is HolidayKey {
  return value === "thanksgiving" || value === "christmas";
}

// Whether an office's color is dark (white text) under a theme. Without a
// holiday, Germantown is the black side and Bethesda the cream one.
export function officeIsDark(holiday: HolidayKey | null, office: Office): boolean {
  return holiday ? HOLIDAY_THEMES[holiday].dark[office] : office === "GERMANTOWN";
}
