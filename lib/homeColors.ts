// Colors that tie each doctor to their scribe on Home: the doctor's name is
// written in their color, and whoever is scribing for them gets a pill
// filled with it. Names are a deeper shade on the white (Bethesda) side and
// a lighter one on the black (Germantown) side, so yellow stays readable.
type DoctorColor = { onLight: string; onDark: string; pill: string };

const DOCTOR_COLORS: Record<string, DoctorColor> = {
  "Dr. Christoforetti": { onLight: "#2563eb", onDark: "#60a5fa", pill: "#93c5fd" }, // blue
  "Dr. Raffo": { onLight: "#dc2626", onDark: "#f87171", pill: "#fca5a5" }, // red
  "Dr. Fitzgibbons": { onLight: "#a16207", onDark: "#facc15", pill: "#fde047" }, // yellow
  "Dr. Feldman": { onLight: "#9333ea", onDark: "#c084fc", pill: "#d8b4fe" }, // purple
  "Dr. Gardiner": { onLight: "#ea580c", onDark: "#fb923c", pill: "#fdba74" }, // orange
  "Dr. McCormick": { onLight: "#16a34a", onDark: "#4ade80", pill: "#86efac" }, // green
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
