// "30m" under an hour, "1h"/"1.5h" (never more than one decimal) at or
// above it — shared by the calendar cell display, the absences list, and
// the "mark me late" dropdown labels so a tardy's length reads the same
// way everywhere instead of always just appending "m".
export function formatLateDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : Math.round(hours * 10) / 10}h`;
}
