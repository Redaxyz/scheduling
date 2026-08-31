import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// weekday: 0=Mon .. 4=Fri. office: null means not in clinic that half.
const PROVIDERS = [
  { initials: "C", name: "Dr. Christoforetti" },
  { initials: "R", name: "Dr. Raffo" },
  { initials: "Fi", name: "Dr. Fitzgibbons" },
  { initials: "Fe", name: "Dr. Feldman" },
  { initials: "M", name: "Dr. McCormick" },
  { initials: "G", name: "Dr. Gardiner" },
];

// Only Dr. Christoforetti's recurring schedule is known so far.
const C_SCHEDULE: { weekday: number; half: "AM" | "PM"; office: "BETHESDA" | "GERMANTOWN" | null }[] = [
  { weekday: 0, half: "AM", office: "BETHESDA" }, // Mon AM
  { weekday: 0, half: "PM", office: "GERMANTOWN" }, // Mon PM
  { weekday: 1, half: "AM", office: null }, // Tue AM - off
  { weekday: 1, half: "PM", office: "BETHESDA" }, // Tue PM
  { weekday: 2, half: "AM", office: "GERMANTOWN" }, // Wed AM
  { weekday: 2, half: "PM", office: "GERMANTOWN" }, // Wed PM
  { weekday: 3, half: "AM", office: null }, // Thu AM - off
  { weekday: 3, half: "PM", office: null }, // Thu PM - off
  { weekday: 4, half: "AM", office: "GERMANTOWN" }, // Fri AM
  { weekday: 4, half: "PM", office: null }, // Fri PM - off
];

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

  const cId = providerByInitials.get("C")!;
  await prisma.providerScheduleSlot.createMany({
    data: C_SCHEDULE.map((s) => ({ ...s, providerId: cId })),
  });

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
