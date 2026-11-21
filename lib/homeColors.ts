// Colors that tie each doctor to their own scribe on Home: the doctor's name
// is written in their color, and their usual scribe's pill is filled with
// it — always, whoever that scribe is covering that day (see staffPill).
// All pastel; names are a touch deeper on the white (Bethesda) side than on
// the black (Germantown) side so they stay readable.
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

// The pill for a person anywhere on Home, fixed per person: a scribe always
// wears their own doctor's color (`ownDoctorName`, from
// DaySchedule.ownDoctorByStaffId) even while scribing for someone else or
// rooming; support staff are black/white. Null = no fixed scheme, so the
// caller falls back to the person's profile color.
export function staffPill(name: string, ownDoctorName: string | undefined, dark: boolean): { color: string; textClassName: string } | null {
  const own = ownDoctorName ? doctorColor(ownDoctorName) : null;
  if (own) return { color: own.pill, textClassName: "text-black" };
  return supportPill(name, dark);
}
