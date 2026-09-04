import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROVIDERS = [
  { initials: "C", name: "Dr. Christoforetti" },
  { initials: "R", name: "Dr. Raffo" },
  { initials: "Fi", name: "Dr. Fitzgibbons" },
  { initials: "Fe", name: "Dr. Feldman" },
  { initials: "Mc", name: "Dr. McCormick" },
  { initials: "G", name: "Dr. Gardiner" },
  { initials: "B", name: "Brian, PA-C" },
  { initials: "J", name: "Jessica, PA-C" },
];

type ScheduleRow = { weekday: number; half: "AM" | "PM"; office: "BETHESDA" | "GERMANTOWN" | null };

// weekday: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri. A half not mentioned by the
// schedule owner is treated as off (half-day-then-surgery is the norm here).
const SCHEDULES: Record<string, ScheduleRow[]> = {
  C: [
    { weekday: 0, half: "AM", office: "BETHESDA" },
    { weekday: 0, half: "PM", office: "GERMANTOWN" },
    { weekday: 1, half: "AM", office: null },
    { weekday: 1, half: "PM", office: "BETHESDA" },
    { weekday: 2, half: "AM", office: "GERMANTOWN" },
    { weekday: 2, half: "PM", office: "GERMANTOWN" },
    { weekday: 3, half: "AM", office: null },
    { weekday: 3, half: "PM", office: null },
    { weekday: 4, half: "AM", office: "BETHESDA" },
    { weekday: 4, half: "PM", office: null },
  ],
  // Raffo: MM Germantown; no Tuesday; WM/WA Bethesda; RM/RA Germantown; FM Bethesda.
  R: [
    { weekday: 0, half: "AM", office: "GERMANTOWN" },
    { weekday: 0, half: "PM", office: null },
    { weekday: 1, half: "AM", office: null },
    { weekday: 1, half: "PM", office: null },
    { weekday: 2, half: "AM", office: "BETHESDA" },
    { weekday: 2, half: "PM", office: "BETHESDA" },
    { weekday: 3, half: "AM", office: "GERMANTOWN" },
    { weekday: 3, half: "PM", office: "GERMANTOWN" },
    { weekday: 4, half: "AM", office: "BETHESDA" },
    { weekday: 4, half: "PM", office: null },
  ],
  // Fitzgibbons: MM Bethesda; TM/TA Germantown; WM/WA Bethesda; no Thursday; FM Germantown.
  Fi: [
    { weekday: 0, half: "AM", office: "BETHESDA" },
    { weekday: 0, half: "PM", office: null },
    { weekday: 1, half: "AM", office: "GERMANTOWN" },
    { weekday: 1, half: "PM", office: "GERMANTOWN" },
    { weekday: 2, half: "AM", office: "BETHESDA" },
    { weekday: 2, half: "PM", office: "BETHESDA" },
    { weekday: 3, half: "AM", office: null },
    { weekday: 3, half: "PM", office: null },
    { weekday: 4, half: "AM", office: "GERMANTOWN" },
    { weekday: 4, half: "PM", office: null },
  ],
  // Feldman: MA Germantown; TM/TA Bethesda; WM/WA Germantown; RM Bethesda; no Thu PM or Friday.
  Fe: [
    { weekday: 0, half: "AM", office: null },
    { weekday: 0, half: "PM", office: "GERMANTOWN" },
    { weekday: 1, half: "AM", office: "BETHESDA" },
    { weekday: 1, half: "PM", office: "BETHESDA" },
    { weekday: 2, half: "AM", office: "GERMANTOWN" },
    { weekday: 2, half: "PM", office: "GERMANTOWN" },
    { weekday: 3, half: "AM", office: "BETHESDA" },
    { weekday: 3, half: "PM", office: null },
    { weekday: 4, half: "AM", office: null },
    { weekday: 4, half: "PM", office: null },
  ],
  // McCormick: MA Bethesda; TM Bethesda; no Wed; RM Germantown, RA Bethesda; Friday all day Germantown.
  Mc: [
    { weekday: 0, half: "AM", office: null },
    { weekday: 0, half: "PM", office: "BETHESDA" },
    { weekday: 1, half: "AM", office: "BETHESDA" },
    { weekday: 1, half: "PM", office: null },
    { weekday: 2, half: "AM", office: null },
    { weekday: 2, half: "PM", office: null },
    { weekday: 3, half: "AM", office: "GERMANTOWN" },
    { weekday: 3, half: "PM", office: "BETHESDA" },
    { weekday: 4, half: "AM", office: "GERMANTOWN" },
    { weekday: 4, half: "PM", office: "GERMANTOWN" },
  ],
  // Gardiner: MM Germantown, MA Bethesda; Tuesday all day Germantown; no Wed; Thursday all day Bethesda; no Fri.
  G: [
    { weekday: 0, half: "AM", office: "GERMANTOWN" },
    { weekday: 0, half: "PM", office: "BETHESDA" },
    { weekday: 1, half: "AM", office: "GERMANTOWN" },
    { weekday: 1, half: "PM", office: "GERMANTOWN" },
    { weekday: 2, half: "AM", office: null },
    { weekday: 2, half: "PM", office: null },
    { weekday: 3, half: "AM", office: "BETHESDA" },
    { weekday: 3, half: "PM", office: "BETHESDA" },
    { weekday: 4, half: "AM", office: null },
    { weekday: 4, half: "PM", office: null },
  ],
  // Brian, PA-C: MA Bethesda; TM Germantown; Wednesday all day Germantown; no Thursday; FM Germantown, FA Bethesda.
  B: [
    { weekday: 0, half: "AM", office: null },
    { weekday: 0, half: "PM", office: "BETHESDA" },
    { weekday: 1, half: "AM", office: "GERMANTOWN" },
    { weekday: 1, half: "PM", office: null },
    { weekday: 2, half: "AM", office: "GERMANTOWN" },
    { weekday: 2, half: "PM", office: "GERMANTOWN" },
    { weekday: 3, half: "AM", office: null },
    { weekday: 3, half: "PM", office: null },
    { weekday: 4, half: "AM", office: "GERMANTOWN" },
    { weekday: 4, half: "PM", office: "BETHESDA" },
  ],
  // Jessica, PA-C: only Friday — FM Bethesda, FA Germantown.
  J: [
    { weekday: 0, half: "AM", office: null },
    { weekday: 0, half: "PM", office: null },
    { weekday: 1, half: "AM", office: null },
    { weekday: 1, half: "PM", office: null },
    { weekday: 2, half: "AM", office: null },
    { weekday: 2, half: "PM", office: null },
    { weekday: 3, half: "AM", office: null },
    { weekday: 3, half: "PM", office: null },
    { weekday: 4, half: "AM", office: "BETHESDA" },
    { weekday: 4, half: "PM", office: "GERMANTOWN" },
  ],
};

const STAFF: {
  name: string;
  kind: "SCRIBE" | "GENERAL" | "XRAY";
  canScribe: boolean;
  color: string;
  homeOffice: "BETHESDA" | "GERMANTOWN" | null;
  dedicatedProviderInitials: string | null;
  defaultXrayOffice?: "BETHESDA" | "GERMANTOWN" | null;
  // Names of OTHER staff this person backs up for X-ray when that person is
  // absent (resolved to XrayBackup rows after everyone's created).
  xrayBackupForNames?: string[];
  addableByAnyone?: boolean;
  usesApp?: boolean;
  isManager?: boolean;
  pinnedGridIndex?: number;
}[] = [
  // 12 pastels evenly spaced around the hue wheel so every person reads as
  // a clearly different color while staying soft/mellow.
  // pinnedGridIndex values below lay out the sign-in picker (5 rows x 3
  // cols, column-major: index = col*ROWS + row) in this exact arrangement:
  //   Row1: Anna, Emily, Emma       Row2: Hope, Jen, Reda
  //   Row3: Brian PA-C, Joanna, Jessica PA-C
  //   Row4: Cindy, Charlie, JB      Row5: Shelby, Mark, Jenish
  { name: "Reda", kind: "SCRIBE", canScribe: true, color: "hsl(0, 62%, 85%)", homeOffice: null, dedicatedProviderInitials: "C", pinnedGridIndex: 11 },
  { name: "Emily", kind: "SCRIBE", canScribe: true, color: "hsl(30, 62%, 83%)", homeOffice: null, dedicatedProviderInitials: "R", pinnedGridIndex: 5 },
  { name: "Hope", kind: "SCRIBE", canScribe: true, color: "hsl(50, 58%, 80%)", homeOffice: null, dedicatedProviderInitials: "Fe", pinnedGridIndex: 1 },
  { name: "Anna", kind: "SCRIBE", canScribe: true, color: "hsl(80, 45%, 79%)", homeOffice: null, dedicatedProviderInitials: "Mc", pinnedGridIndex: 0 },
  { name: "Emma", kind: "SCRIBE", canScribe: true, color: "hsl(120, 38%, 80%)", homeOffice: null, dedicatedProviderInitials: "Fi", pinnedGridIndex: 10 },
  { name: "Jen", kind: "SCRIBE", canScribe: true, color: "hsl(155, 42%, 79%)", homeOffice: null, dedicatedProviderInitials: "G", pinnedGridIndex: 6 },
  { name: "JB", kind: "GENERAL", canScribe: false, color: "hsl(185, 45%, 81%)", homeOffice: "BETHESDA", dedicatedProviderInitials: null, pinnedGridIndex: 13 },
  // Mark is a Bethesda-leaning rooming/support person (homeOffice is just a
  // preference, not a lock) and Cindy's X-ray backup, only when she's out.
  {
    name: "Mark",
    kind: "GENERAL",
    canScribe: false,
    color: "hsl(212, 58%, 84%)",
    homeOffice: "BETHESDA",
    dedicatedProviderInitials: null,
    xrayBackupForNames: ["Cindy"],
    pinnedGridIndex: 9,
  },
  {
    name: "Charlie",
    kind: "GENERAL",
    canScribe: false,
    color: "hsl(238, 55%, 87%)",
    homeOffice: "GERMANTOWN",
    dedicatedProviderInitials: null,
    xrayBackupForNames: ["Shelby"],
    pinnedGridIndex: 8,
  },
  { name: "Jenish", kind: "GENERAL", canScribe: false, color: "hsl(268, 48%, 87%)", homeOffice: "GERMANTOWN", dedicatedProviderInitials: null, pinnedGridIndex: 14 },
  { name: "Cindy", kind: "XRAY", canScribe: false, color: "hsl(298, 45%, 86%)", homeOffice: "BETHESDA", dedicatedProviderInitials: null, defaultXrayOffice: "BETHESDA", pinnedGridIndex: 3 },
  { name: "Shelby", kind: "XRAY", canScribe: false, color: "hsl(332, 58%, 86%)", homeOffice: "GERMANTOWN", dedicatedProviderInitials: null, defaultXrayOffice: "GERMANTOWN", pinnedGridIndex: 4 },
  // Brian and Jessica are PA-Cs (see PROVIDERS/SCHEDULES above for their clinic
  // schedule) but also get a Staff row so they can pick themselves in the app
  // and self-log their own absences, same as the rest of the staff.
  { name: "Brian, PA-C", kind: "GENERAL", canScribe: false, color: "hsl(15, 60%, 84%)", homeOffice: null, dedicatedProviderInitials: null, pinnedGridIndex: 2 },
  { name: "Jessica, PA-C", kind: "GENERAL", canScribe: false, color: "hsl(345, 55%, 86%)", homeOffice: null, dedicatedProviderInitials: null, pinnedGridIndex: 12 },
  // Lester floats between both offices, only accessible for X-ray when
  // either Cindy or Shelby is out — not office-locked like Mark/Charlie.
  {
    name: "Lester",
    kind: "XRAY",
    canScribe: false,
    color: "hsl(170, 40%, 82%)",
    homeOffice: null,
    dedicatedProviderInitials: null,
    xrayBackupForNames: ["Cindy", "Shelby"],
    addableByAnyone: true,
    usesApp: false,
  },
  // Joanna is the manager: can add anyone eligible to any position while
  // logged in as herself, not just self-add (see TakeRoleButton). Pinned to
  // the exact center of the 5-row x 3-col sign-in grid (index 7 = row 2,
  // col 1), rather than wherever alphabetical order would otherwise put her.
  {
    name: "Joanna",
    kind: "GENERAL",
    canScribe: false,
    color: "hsl(100, 40%, 82%)",
    homeOffice: null,
    dedicatedProviderInitials: null,
    isManager: true,
    pinnedGridIndex: 7,
  },
];

type FallbackRow = {
  weekday: number;
  half: "AM" | "PM";
  office: "BETHESDA" | "GERMANTOWN";
  conditionalProviderInitials?: string;
  conditionalRequireActive?: boolean;
  // When set, this isn't generic office support — the staff member becomes
  // THAT provider's scribe for the half (like a dedicated scribe), instead
  // of a rooming-list entry.
  targetProviderInitials?: string;
};

// Where each scribe defaults to when their own doctor doesn't need them for
// a given weekday+half (off per template, or unexpectedly absent that day).
// Rows with a conditionalProviderInitials only fire when that OTHER
// provider's active-this-half status matches conditionalRequireActive.
const SCRIBE_FALLBACKS: Record<string, FallbackRow[]> = {
  // Reda (Christo's scribe): Thu Christo is off entirely -> Bethesda both
  // halves. Fri PM Christo is off -> Reda is Brian's (PA-C) primary scribe
  // whenever she's free that half.
  Reda: [
    { weekday: 3, half: "AM", office: "BETHESDA" },
    { weekday: 3, half: "PM", office: "BETHESDA" },
    { weekday: 4, half: "PM", office: "BETHESDA", targetProviderInitials: "B" },
  ],
  // Emily (Raffo's scribe): Raffo never works Tuesdays. Only the PM half
  // gets a fallback (Germantown); AM Tuesday she's simply free.
  Emily: [{ weekday: 1, half: "PM", office: "GERMANTOWN" }],
  // Hope (Feldman's scribe): Feldman is off Fridays entirely.
  Hope: [
    { weekday: 4, half: "AM", office: "BETHESDA" },
    { weekday: 4, half: "PM", office: "BETHESDA" },
  ],
  // Anna (McCormick's scribe): McCormick is off Wednesdays entirely.
  Anna: [
    { weekday: 2, half: "AM", office: "BETHESDA" },
    { weekday: 2, half: "PM", office: "BETHESDA" },
  ],
  // Emma (Fitzgibbons's scribe): Fitzgibbons is off Thursdays entirely.
  Emma: [
    { weekday: 3, half: "AM", office: "GERMANTOWN" },
    { weekday: 3, half: "PM", office: "GERMANTOWN" },
  ],
  // Jen (Gardiner's scribe): Gardiner is off Wed/Fri entirely, and this same
  // rule also covers a Thursday where Gardiner is unexpectedly absent, since
  // "own doctor not active this half" already accounts for ad-hoc absences.
  Jen: [
    { weekday: 2, half: "AM", office: "GERMANTOWN" },
    { weekday: 2, half: "PM", office: "GERMANTOWN" },
    { weekday: 3, half: "AM", office: "GERMANTOWN" },
    { weekday: 3, half: "PM", office: "GERMANTOWN" },
    { weekday: 4, half: "AM", office: "GERMANTOWN" },
    { weekday: 4, half: "PM", office: "GERMANTOWN" },
  ],
};

async function main() {
  console.log("Seeding...");

  await prisma.assignment.deleteMany();
  await prisma.patientCount.deleteMany();
  await prisma.staffAbsence.deleteMany();
  await prisma.providerAbsence.deleteMany();
  await prisma.scribeFallback.deleteMany();
  await prisma.xrayBackup.deleteMany();
  await prisma.providerScheduleSlot.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.provider.deleteMany();

  const providerByInitials = new Map<string, string>();
  for (const p of PROVIDERS) {
    const created = await prisma.provider.create({ data: p });
    providerByInitials.set(p.initials, created.id);
  }

  for (const [initials, rows] of Object.entries(SCHEDULES)) {
    const providerId = providerByInitials.get(initials)!;
    await prisma.providerScheduleSlot.createMany({
      data: rows.map((s) => ({ ...s, providerId })),
    });
  }

  const staffByName = new Map<string, string>();
  for (const s of STAFF) {
    const created = await prisma.staff.create({
      data: {
        name: s.name,
        kind: s.kind,
        canScribe: s.canScribe,
        color: s.color,
        homeOffice: s.homeOffice,
        dedicatedProviderId: s.dedicatedProviderInitials
          ? providerByInitials.get(s.dedicatedProviderInitials)!
          : null,
        defaultXrayOffice: s.defaultXrayOffice ?? null,
        addableByAnyone: s.addableByAnyone ?? false,
        usesApp: s.usesApp ?? true,
        isManager: s.isManager ?? false,
        pinnedGridIndex: s.pinnedGridIndex ?? null,
      },
    });
    staffByName.set(s.name, created.id);
  }

  for (const s of STAFF) {
    if (!s.xrayBackupForNames?.length) continue;
    const staffId = staffByName.get(s.name)!;
    await prisma.xrayBackup.createMany({
      data: s.xrayBackupForNames.map((primaryName) => ({
        staffId,
        primaryStaffId: staffByName.get(primaryName)!,
      })),
    });
  }

  for (const [name, rows] of Object.entries(SCRIBE_FALLBACKS)) {
    const staffId = staffByName.get(name)!;
    await prisma.scribeFallback.createMany({
      data: rows.map((r) => ({
        staffId,
        weekday: r.weekday,
        half: r.half,
        office: r.office,
        conditionalProviderId: r.conditionalProviderInitials
          ? providerByInitials.get(r.conditionalProviderInitials)!
          : null,
        conditionalRequireActive: r.conditionalRequireActive ?? null,
        targetProviderId: r.targetProviderInitials ? providerByInitials.get(r.targetProviderInitials)! : null,
      })),
    });
  }

  console.log("Seeded", PROVIDERS.length, "providers and", STAFF.length, "staff.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
