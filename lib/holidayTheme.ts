// Holiday color themes: around each holiday the two offices trade their
// usual cream and black for the holiday's colors, the page takes a soft
// tint, accents go plain black and white, and a garland and a few icons come
// out (components/HolidayDecor.tsx). Decided by today's date in Eastern time
// on the server, once per page.
//
// How long: a big holiday's theme starts a week before and lasts 3 days
// after; a smaller one's, 3 days before and 1 after. Two holidays within a
// week of each other hand over at the halfway point between them, with no
// plain days in between. Where both claim a day, the nearer holiday wins;
// on the holiday itself, a shorter holiday beats a longer one around it
// (Christmas Day inside Hanukkah), then the order listed below.
import { addDays } from "./date";
import type { Office } from "./types";

// Set by ?holiday=... (see components/HolidayProvider.tsx) to try a theme in
// one browser: a theme's key, or "none".
export const HOLIDAY_COOKIE = "holiday";

export type Garland =
  | { kind: "leaves" }
  | { kind: "lights"; colors: string[] }
  | { kind: "emoji"; items: string[] };

type OfficeColor = { bg: string; dark: boolean }; // dark: white text on it

type HolidayTheme = {
  name: string;
  major: boolean; // a big holiday: a longer run (see the top of this file)
  // The first and last day of the holiday itself in a given year (one day
  // for most), or null if it doesn't fall in that year.
  days: (year: number) => [string, string] | null;
  pageBg: string; // the soft tint every page takes
  offBg: string; // a half with no office (the Me tab's blank days)
  BETHESDA: OfficeColor;
  GERMANTOWN: OfficeColor;
  garland: Garland;
  // Shown beside each office's heading on Home, cycling. "svg:..." names one
  // of the drawn icons in components/HolidayDecor.tsx; anything else is emoji.
  icons: Record<Office, string[]>;
};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const day = (m: number, d: number) => (y: number): [string, string] => [ymd(y, m, d), ymd(y, m, d)];

// The fourth Thursday of November.
function thanksgiving(y: number): [string, string] {
  const first = new Date(Date.UTC(y, 10, 1)).getUTCDay(); // 0=Sun
  const d = ymd(y, 11, 1 + ((4 - first + 7) % 7) + 21);
  return [d, d];
}

// Western Easter Sunday (the anonymous Gregorian computus).
function easter(y: number): [string, string] {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), date = ((h + l - 7 * m + 114) % 31) + 1;
  const s = ymd(y, month, date);
  return [s, s];
}

// The Gregorian day in year `y` that another calendar (Hebrew, Chinese,
// Islamic) calls month/day, found with the built-in calendar support.
const lookups = new Map<string, string | null>();
function inCalendar(y: number, calendar: string, month: string, date: string): string | null {
  const key = `${y}:${calendar}:${month}:${date}`;
  if (lookups.has(key)) return lookups.get(key)!;
  const fmt = new Intl.DateTimeFormat(`en-u-ca-${calendar}`, { month: calendar === "hebrew" ? "long" : "numeric", day: "numeric", timeZone: "UTC" });
  let found: string | null = null;
  for (let t = Date.UTC(y, 0, 1); new Date(t).getUTCFullYear() === y; t += 86400000) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
    if (parts.month === month && parts.day === date) {
      found = new Date(t).toISOString().slice(0, 10);
      break;
    }
  }
  lookups.set(key, found);
  return found;
}
const span = (start: string | null, days: number): [string, string] | null => (start ? [start, addDays(start, days - 1)] : null);

// Diwali follows the Hindu lunisolar calendar, which browsers and servers
// don't carry; these are the published dates.
const DIWALI: Record<number, string> = {
  2026: "2026-11-08", 2027: "2027-10-29", 2028: "2028-10-17", 2029: "2029-11-05", 2030: "2030-10-26",
  2031: "2031-11-14", 2032: "2032-11-02", 2033: "2033-10-22", 2034: "2034-11-10", 2035: "2035-10-30",
};

export const HOLIDAY_THEMES = {
  christmas: {
    name: "Christmas",
    major: true,
    days: day(12, 25),
    pageBg: "#e8f0e6", offBg: "#d3e0d0",
    BETHESDA: { bg: "#b8312f", dark: true }, // red
    GERMANTOWN: { bg: "#1d6b3a", dark: true }, // green
    garland: { kind: "lights", colors: ["#ef4444", "#22c55e", "#facc15", "#3b82f6", "#f97316"] },
    icons: { BETHESDA: ["svg:tree", "🎁", "🍬", "⭐"], GERMANTOWN: ["svg:snowflake", "⛄", "🔔", "🦌"] },
  },
  hanukkah: {
    name: "Hanukkah", // eight days from 25 Kislev
    major: true,
    days: (y) => span(inCalendar(y, "hebrew", "Kislev", "25"), 8),
    pageBg: "#e2e9f7", offBg: "#cdd8ee",
    BETHESDA: { bg: "#ffffff", dark: false }, // white
    GERMANTOWN: { bg: "#1d4ed8", dark: true }, // blue
    garland: { kind: "lights", colors: ["#2563eb", "#e2e8f0", "#60a5fa", "#f8fafc", "#facc15"] },
    icons: { BETHESDA: ["🕎", "🕯️", "✡️"], GERMANTOWN: ["🍩", "🪙", "⭐"] },
  },
  newyear: {
    name: "New Year's",
    major: true,
    days: day(1, 1),
    pageBg: "#f4efe2", offBg: "#e4dcc8",
    BETHESDA: { bg: "#d4a72c", dark: false }, // gold
    GERMANTOWN: { bg: "#111111", dark: true }, // black
    garland: { kind: "lights", colors: ["#facc15", "#f8fafc", "#fbbf24", "#e5e7eb"] },
    icons: { BETHESDA: ["🎉", "🥂", "🎊"], GERMANTOWN: ["🎆", "✨", "🕛"] },
  },
  lunarnewyear: {
    name: "Lunar New Year", // 1st day of the 1st month
    major: false,
    days: (y) => span(inCalendar(y, "chinese", "1", "1"), 1),
    pageBg: "#fbe8d8", offBg: "#f1d3bb",
    BETHESDA: { bg: "#c62828", dark: true }, // red
    GERMANTOWN: { bg: "#e0a800", dark: false }, // gold
    garland: { kind: "emoji", items: ["🏮"] },
    icons: { BETHESDA: ["🧧", "🏮", "🐉"], GERMANTOWN: ["🍊", "🥟", "🎆"] },
  },
  valentines: {
    name: "Valentine's Day",
    major: false,
    days: day(2, 14),
    pageBg: "#fde7ef", offBg: "#f7cfdd",
    BETHESDA: { bg: "#f9a8c9", dark: false }, // pink
    GERMANTOWN: { bg: "#be123c", dark: true }, // red
    garland: { kind: "emoji", items: ["❤️", "💕"] },
    icons: { BETHESDA: ["💝", "🌹", "💌"], GERMANTOWN: ["❤️", "🍫", "💐"] },
  },
  stpatricks: {
    name: "St. Patrick's Day",
    major: false,
    days: day(3, 17),
    pageBg: "#e6f4e6", offBg: "#cfe6cf",
    BETHESDA: { bg: "#8fdca6", dark: false }, // light green
    GERMANTOWN: { bg: "#15803d", dark: true }, // green
    garland: { kind: "emoji", items: ["☘️", "🍀"] },
    icons: { BETHESDA: ["☘️", "🌈", "🪙"], GERMANTOWN: ["🍀", "🎩", "🌈"] },
  },
  eid: {
    name: "Eid al-Fitr", // 1 Shawwal
    major: false,
    days: (y) => span(inCalendar(y, "islamic-umalqura", "10", "1"), 3),
    pageBg: "#eef2e4", offBg: "#dbe2cc",
    BETHESDA: { bg: "#d9b44a", dark: false }, // gold
    GERMANTOWN: { bg: "#0f5e4a", dark: true }, // deep green
    garland: { kind: "emoji", items: ["🌙", "⭐"] },
    icons: { BETHESDA: ["🌙", "🏮", "✨"], GERMANTOWN: ["⭐", "🕌", "🍬"] },
  },
  passover: {
    name: "Passover", // eight days from 15 Nisan
    major: false,
    days: (y) => span(inCalendar(y, "hebrew", "Nisan", "15"), 8),
    pageBg: "#f3ece0", offBg: "#e5d9c4",
    BETHESDA: { bg: "#e9d7b0", dark: false }, // matzah
    GERMANTOWN: { bg: "#7f1d1d", dark: true }, // wine
    garland: { kind: "emoji", items: ["🍷", "🫓"] },
    icons: { BETHESDA: ["🫓", "🌿", "✡️"], GERMANTOWN: ["🍷", "🥚", "🌸"] },
  },
  easter: {
    name: "Easter",
    major: true,
    days: easter,
    pageBg: "#f3ecfb", offBg: "#e4d8f4",
    BETHESDA: { bg: "#fde68a", dark: false }, // pastel yellow
    GERMANTOWN: { bg: "#7c3aed", dark: true }, // purple
    garland: { kind: "emoji", items: ["🥚", "🐣", "🌷"] },
    icons: { BETHESDA: ["🐣", "🥚", "🌷"], GERMANTOWN: ["🐰", "🌸", "🧺"] },
  },
  july4: {
    name: "Independence Day",
    major: true,
    days: day(7, 4),
    pageBg: "#eef2fa", offBg: "#d9e1f2",
    BETHESDA: { bg: "#b91c1c", dark: true }, // red
    GERMANTOWN: { bg: "#1e3a8a", dark: true }, // blue
    garland: { kind: "lights", colors: ["#dc2626", "#f8fafc", "#2563eb"] },
    icons: { BETHESDA: ["🎆", "🇺🇸", "🌭"], GERMANTOWN: ["🎇", "⭐", "🍔"] },
  },
  halloween: {
    name: "Halloween",
    major: false,
    days: day(10, 31),
    pageBg: "#fbe7d3", offBg: "#f1d1b2",
    BETHESDA: { bg: "#f97316", dark: false }, // orange
    GERMANTOWN: { bg: "#1f1033", dark: true }, // midnight purple
    garland: { kind: "emoji", items: ["🦇", "🎃"] },
    icons: { BETHESDA: ["🎃", "🍬", "🕸️"], GERMANTOWN: ["👻", "🦇", "🌙"] },
  },
  diwali: {
    name: "Diwali",
    major: false,
    days: (y) => span(DIWALI[y] ?? null, 1),
    pageBg: "#fbeeda", offBg: "#f1dcb9",
    BETHESDA: { bg: "#f59e0b", dark: false }, // marigold
    GERMANTOWN: { bg: "#7e22ce", dark: true }, // deep purple
    garland: { kind: "lights", colors: ["#f59e0b", "#facc15", "#fb923c", "#fde68a"] },
    icons: { BETHESDA: ["🪔", "✨", "🌼"], GERMANTOWN: ["🎇", "🪔", "🍬"] },
  },
  thanksgiving: {
    name: "Thanksgiving",
    major: true,
    days: thanksgiving,
    pageBg: "#fcebcf", offBg: "#f2d9b0",
    BETHESDA: { bg: "#f2c14e", dark: false }, // golden yellow
    GERMANTOWN: { bg: "#d9532b", dark: true }, // red-orange
    garland: { kind: "leaves" },
    icons: { BETHESDA: ["svg:turkey", "🥧", "🌽", "🍁"], GERMANTOWN: ["svg:pumpkin", "🍂", "🌰", "🍎"] },
  },
} satisfies Record<string, HolidayTheme>;

export type HolidayKey = keyof typeof HOLIDAY_THEMES;

export function holidayTheme(key: HolidayKey): HolidayTheme {
  return HOLIDAY_THEMES[key];
}

// How long a theme runs around its holiday, in days.
const RUN = { major: { before: 7, after: 3 }, minor: { before: 3, after: 1 } };
// Holidays this close (days between them) hand over at the halfway point.
const CLOSE = 7;

const dayNumber = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86400000;

type Occurrence = { key: HolidayKey; start: number; end: number };

// Every holiday falling in the given years, in date order.
function occurrences(years: number[]): Occurrence[] {
  const out: Occurrence[] = [];
  for (const key of Object.keys(HOLIDAY_THEMES) as HolidayKey[]) {
    for (const y of years) {
      const range = HOLIDAY_THEMES[key].days(y);
      if (range) out.push({ key, start: dayNumber(range[0]), end: dayNumber(range[1]) });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

// The holiday theme for a given day (YYYY-MM-DD), or null on an ordinary day.
export function holidayFor(date: string): HolidayKey | null {
  const year = Number(date.slice(0, 4));
  const today = dayNumber(date);
  const all = occurrences([year - 1, year, year + 1]);
  const order = Object.keys(HOLIDAY_THEMES);

  // On a holiday itself: the shortest one that day, then list order.
  const on = all.filter((o) => o.start <= today && today <= o.end);
  if (on.length > 0) {
    on.sort((a, b) => a.end - a.start - (b.end - b.start) || order.indexOf(a.key) - order.indexOf(b.key));
    return on[0].key;
  }

  // Between holidays: the last one before today and the next one after.
  const before = all.filter((o) => o.end < today).sort((a, b) => b.end - a.end)[0];
  const after = all.filter((o) => o.start > today).sort((a, b) => a.start - b.start)[0];
  const sinceBefore = before ? today - before.end : Infinity;
  const untilAfter = after ? after.start - today : Infinity;

  // Close together: whichever is nearer, so they meet halfway (a tie goes to
  // the coming one).
  if (before && after && after.start - before.end <= CLOSE) return sinceBefore < untilAfter ? before.key : after.key;

  const run = (key: HolidayKey) => (HOLIDAY_THEMES[key].major ? RUN.major : RUN.minor);
  const inBefore = before && sinceBefore <= run(before.key).after;
  const inAfter = after && untilAfter <= run(after.key).before;
  if (inBefore && inAfter) return sinceBefore < untilAfter ? before.key : after.key;
  if (inBefore) return before.key;
  if (inAfter) return after.key;
  return null;
}

export function isHolidayKey(value: string | undefined | null): value is HolidayKey {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(HOLIDAY_THEMES, value!);
}

// Whether an office's color is dark (white text) under a theme. Without a
// holiday, Germantown is the black side and Bethesda the cream one.
export function officeIsDark(holiday: HolidayKey | null, office: Office): boolean {
  return holiday ? HOLIDAY_THEMES[holiday][office].dark : office === "GERMANTOWN";
}

// The CSS variables a theme sets on the page (see app/globals.css for what
// each one colors). Black text on light colors, white on dark ones.
export function holidayCssVars(key: HolidayKey): Record<string, string> {
  const t = HOLIDAY_THEMES[key];
  const ink = (c: OfficeColor) => (c.dark ? "#ffffff" : "#111111");
  return {
    "--page-bg": t.pageBg,
    "--off-bg": t.offBg,
    "--bt-bg": t.BETHESDA.bg,
    "--bt-ink": ink(t.BETHESDA),
    "--gt-bg": t.GERMANTOWN.bg,
    "--gt-panel": t.GERMANTOWN.bg,
    "--gt-ink": ink(t.GERMANTOWN),
  };
}

// How a closed holiday's cells look on the Schedule tab: the colors of the
// holiday theme around that day (both offices', blended), or null for a
// holiday with no theme of its own (they stay the usual purple).
export function holidayCellLook(date: string): { background: string; accent: string } | null {
  const key = holidayFor(date);
  if (!key) return null;
  const t = HOLIDAY_THEMES[key];
  return { background: `linear-gradient(135deg, ${t.BETHESDA.bg}, ${t.GERMANTOWN.bg})`, accent: t.GERMANTOWN.bg };
}
