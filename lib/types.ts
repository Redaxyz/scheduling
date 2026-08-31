export const OFFICES = ["BETHESDA", "GERMANTOWN"] as const;
export type Office = (typeof OFFICES)[number];

export const HALVES = ["AM", "PM"] as const;
export type Half = (typeof HALVES)[number];

// Used only on absence records, meaning "both halves of the day"
export type AbsenceHalf = Half | "ALL";

export const ROLES = ["SCRIBE", "SUB_SCRIBE", "ROOMING", "XRAY"] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_KINDS = ["SCRIBE", "GENERAL", "XRAY"] as const;
export type StaffKind = (typeof STAFF_KINDS)[number];

export const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const OFFICE_LABELS: Record<Office, string> = {
  BETHESDA: "Bethesda",
  GERMANTOWN: "Germantown",
};

export const HALF_LABELS: Record<Half, string> = {
  AM: "Morning",
  PM: "Afternoon",
};
