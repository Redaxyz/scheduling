// Colors that tie each doctor to their scribe on Home: the doctor's name is
// written in their color, and whoever is scribing for them gets a pill
// filled with it. All pastel; names are a touch deeper on the white
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
