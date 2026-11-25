// Birthdays as "MM-DD", by first name for staff and by last name for
// providers, without the "Dr." or ", PA-C" the app shows ("Gardiner" for
// Dr. Gardiner, "Brian" for Brian, PA-C). Add people here as their dates
// come in.
//
// On someone's birthday everyone sees a 🎂 by their name (their pill on Home,
// their row on the Schedule tab) and their day in pink and blue; the person
// themselves gets confetti across the app and a greeting on Home
// (components/BirthdayCelebration.tsx).
export const BIRTHDAYS: Record<string, string> = {
  // Staff
  Anna: "06-21",
  Ben: "08-08",
  Charlie: "03-19",
  Cindy: "06-05",
  Emma: "10-08",
  Hope: "12-03",
  Isabel: "05-04",
  Jen: "04-03",
  Jenish: "09-01",
  Jo: "09-13",
  Joanna: "09-15",
  Mark: "09-12",
  Reda: "08-02",
  Shelby: "02-14",
  // Providers
  Brian: "03-10",
  Christoforetti: "06-21",
  Feldman: "05-17",
  Fitzgibbons: "09-14",
  Gardiner: "01-07",
  Raffo: "06-05",
};

// "Dr. Gardiner" → "Gardiner", "Brian, PA-C" → "Brian".
function birthdayKey(name: string): string {
  return name.replace(/^dr\.?\s+/i, "").split(",")[0].trim();
}

export const BIRTHDAY_CAKE = "🎂";

// Pink into blue: a birthday person's boxes on that day.
export const BIRTHDAY_FILL = "linear-gradient(135deg, #f9a8d4, #93c5fd)";

export function isBirthday(name: string, date: string): boolean {
  return BIRTHDAYS[birthdayKey(name)] === date.slice(5, 10);
}

export function birthdayAmong(name: string, dates: string[]): boolean {
  return dates.some((date) => isBirthday(name, date));
}

// A scatter of confetti (little strips and dots in party colors), tiled
// behind the birthday person's own view of the app.
export const CONFETTI = (() => {
  const colors = ["#ec4899", "#3b82f6", "#facc15", "#22c55e", "#a855f7", "#f97316"];
  const pieces = [
    [10, 12, 20], [38, 6, -35], [70, 18, 60], [104, 10, -15], [22, 40, 75], [56, 34, 10], [90, 44, -50], [6, 70, -20],
    [34, 64, 45], [66, 72, -65], [100, 66, 30], [18, 98, 55], [48, 92, -10], [80, 104, 25], [112, 92, -40], [60, 114, 70],
  ];
  const shapes = pieces
    .map(([x, y, r], i) =>
      i % 3 === 2
        ? `<circle cx="${x}" cy="${y}" r="2.2" fill="${colors[i % colors.length]}"/>`
        : `<rect x="${x - 4}" y="${y - 1.6}" width="8" height="3.2" rx="1" fill="${colors[i % colors.length]}" transform="rotate(${r} ${x} ${y})"/>`,
    )
    .join("");
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" opacity="0.55">${shapes}</svg>`)}")`;
})();
