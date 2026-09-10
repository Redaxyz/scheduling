// Shared office/status color palette — Bethesda, Germantown, surgery, and
// "off" each get one consistent color everywhere they're shown, rather than
// different components picking their own.
export const OFFICE_COLOR = {
  BETHESDA: "#579669", // green
  GERMANTOWN: "#0f172a", // near-black
} as const;

export const SURGERY_COLOR = "#38bdf8"; // light blue, like sterile surgical material
export const OFF_COLOR = "#dc2626"; // red
