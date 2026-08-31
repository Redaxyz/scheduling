import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROVIDERS = [
  { initials: "C", name: "Dr. Christoforetti" },
  { initials: "R", name: "Dr. Raffo" },
  { initials: "Fi", name: "Dr. Fitzgibbons" },
  { initials: "Fe", name: "Dr. Feldman" },
  { initials: "M", name: "Dr. McCormick" },
  { initials: "G", name: "Dr. Gardiner" },
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
    { weekday: 4, half: "AM", office: "GERMANTOWN" },
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
  M: [
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
};

const STAFF: {
  name: string;
  kind: "SCRIBE" | "GENERAL" | "XRAY";
  canScribe: boolean;
  homeOffice: "BETHESDA" | "GERMANTOWN" | null;
  dedicatedProviderInitials: string | null;
}[] = [
  { name: "Reda", kind: "SCRIBE", canScribe: true, homeOffice: null, dedicatedProviderInitials: "C" },
  { name: "Emily", kind: "SCRIBE", canScribe: true, homeOffice: null, dedicatedProviderInitials: "R" },
  { name: "Hope", kind: "SCRIBE", canScribe: true, homeOffice: null, dedicatedProviderInitials: "Fe" },
  { name: "Anna", kind: "SCRIBE", canScribe: true, homeOffice: null, dedicatedProviderInitials: "M" },
  { name: "Emma", kind: "SCRIBE", canScribe: true, homeOffice: null, dedicatedProviderInitials: "Fi" },
  { name: "Jen", kind: "SCRIBE", canScribe: true, homeOffice: null, dedicatedProviderInitials: "G" },
  { name: "JB", kind: "GENERAL", canScribe: false, homeOffice: "BETHESDA", dedicatedProviderInitials: null },
  { name: "Mark", kind: "GENERAL", canScribe: false, homeOffice: "BETHESDA", dedicatedProviderInitials: null },
  { name: "Charlie", kind: "GENERAL", canScribe: false, homeOffice: "GERMANTOWN", dedicatedProviderInitials: null },
  { name: "Jenish", kind: "GENERAL", canScribe: false, homeOffice: "GERMANTOWN", dedicatedProviderInitials: null },
  { name: "Cindy", kind: "XRAY", canScribe: false, homeOffice: "BETHESDA", dedicatedProviderInitials: null },
  { name: "Shelby", kind: "XRAY", canScribe: false, homeOffice: "GERMANTOWN", dedicatedProviderInitials: null },
];

async function main() {
  console.log("Seeding...");

  await prisma.assignment.deleteMany();
  await prisma.patientCount.deleteMany();
  await prisma.staffAbsence.deleteMany();
  await prisma.providerAbsence.deleteMany();
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

  for (const s of STAFF) {
    await prisma.staff.create({
      data: {
        name: s.name,
        kind: s.kind,
        canScribe: s.canScribe,
        homeOffice: s.homeOffice,
        dedicatedProviderId: s.dedicatedProviderInitials
          ? providerByInitials.get(s.dedicatedProviderInitials)!
          : null,
      },
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
