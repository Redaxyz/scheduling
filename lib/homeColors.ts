// Colors that tie each doctor to their own scribe on Home: the doctor's name
// is written in their color, and their scribe's pill is always filled with
// it, whoever they're working with that day. So a pill that doesn't match
// the doctor beside it means someone is off their usual schedule. All pastel; names are a touch deeper on the white
// (Bethesda) side than on the black (Germantown) side so they stay readable.
type DoctorColor = { onLight: string; onDark: string; pill: string };

const DOCTOR_COLORS: Record<string, DoctorColor> = {
  "Dr. Christoforetti": { onLight: "#6b9be0", onDark: "#a9c9f5", pill: "#c6dcf9" }, // blue
  "Dr. Raffo": { onLight: "#e07a7a", onDark: "#f5b0b0", pill: "#f8cccc" }, // red
  "Dr. Fitzgibbons": { onLight: "#c9a227", onDark: "#f3dc8a", pill: "#f8e9a8" }, // yellow
  "Dr. Feldman": { onLight: "#a385d6", onDark: "#cdb8ef", pill: "#e0d2f5" }, // purple
  "Dr. Gardiner": { onLight: "#e3955a", onDark: "#f6c39b", pill: "#f9d8bd" }, // orange
  "Dr. McCormick": { onLight: "#5fae7a", onDark: "#a8dbb7", pill: "#c9ead2" }, // green
};

export function doctorColor(name: string): DoctorColor | null {
  return DOCTOR_COLORS[name] ?? null;
}

// Support staff are plain black or white instead: a black pill on the white
// side, a white one on the black side.
const SUPPORT_STAFF = new Set(["Charlie", "Jenish", "JB", "Isabel", "Mark", "Shelby", "Cindy"]);

export function supportPill(name: string, dark: boolean): { color: string; textClassName: string } | null {
  if (!SUPPORT_STAFF.has(name)) return null;
  return dark ? { color: "#ffffff", textClassName: "text-black" } : { color: "#000000", textClassName: "text-white" };
}

// Each scribe's own doctor: their pill is that doctor's color wherever they
// are (scribing for someone else, rooming, x-ray). Emily is Ben's name on
// screen until Oct 31 (see lib/prisma.ts).
const SCRIBE_DOCTOR: Record<string, string> = {
  Reda: "Dr. Christoforetti",
  Ben: "Dr. Raffo",
  Emily: "Dr. Raffo",
  Emma: "Dr. Fitzgibbons",
  Hope: "Dr. Feldman",
  Jen: "Dr. Gardiner",
  Anna: "Dr. McCormick",
};

// The pill for one person on Home: their doctor's color for a scribe, black
// or white for support staff, or null to keep their own color.
export function staffPill(name: string, dark: boolean): { color: string; textClassName: string } | null {
  const doctor = SCRIBE_DOCTOR[name] ? DOCTOR_COLORS[SCRIBE_DOCTOR[name]] : null;
  if (doctor) return { color: doctor.pill, textClassName: "text-black" };
  return supportPill(name, dark);
}

// The signed-in person's own pill, in the old Home button's brand gradient,
// so you can find yourself at a glance.
export const MY_PILL = { color: "linear-gradient(135deg, #1878b4, #f5871f)", textClassName: "text-white" };
