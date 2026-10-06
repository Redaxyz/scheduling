// Clock-time helpers for a staffer's custom arrival ("coming in at") and
// departure ("leaving at") times — stored as 24h "HH:MM" strings.

export const CLOCK_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// "15:00" -> "3:00", "09:30" -> "9:30". No am/pm: the half of the day the
// time belongs to (arrivals are mornings, departures afternoons) already
// reads clearly from the cell it's in.
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}`;
}

export function arriveNote(arriveAt: string | null, lateMinutes: number | null): string | null {
  if (arriveAt) return `in ${formatClock(arriveAt)}`;
  if (lateMinutes) return lateMinutes < 60 ? `${lateMinutes}m late` : `${lateMinutes / 60}h late`;
  return null;
}

export function leaveNote(leaveAt: string | null): string | null {
  return leaveAt ? `out ${formatClock(leaveAt)}` : null;
}

// Which half of the day a clock time falls in — before noon is the morning.
export function clockHalf(hhmm: string): "AM" | "PM" {
  return hhmm < "12:00" ? "AM" : "PM";
}
