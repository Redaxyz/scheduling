// Shared office/status color palette — Bethesda, Germantown, surgery, and
// "off" each get one consistent color everywhere they're shown, rather than
// different components picking their own.
export const OFFICE_COLOR = {
  // CSS variables (app/globals.css): cream and near-black, or the holiday
  // theme's colors (lib/holidayTheme.ts). OFFICE_INK is the text on each.
  BETHESDA: "var(--bt-bg)",
  GERMANTOWN: "var(--gt-panel)",
} as const;

export const OFFICE_INK = { BETHESDA: "var(--bt-ink)", GERMANTOWN: "var(--gt-ink)" } as const;

export const SURGERY_COLOR = "#38bdf8"; // light blue, like sterile surgical material
export const OFF_COLOR = "#dc2626"; // red
