import { prisma } from "@/lib/prisma";
import AbsencesManager from "@/components/AbsencesManager";

export default async function AbsencesPage() {
  const [staff, providers, staffAbsences, providerAbsences] = await Promise.all([
    prisma.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.provider.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.staffAbsence.findMany({
      where: { date: { gte: new Date().toISOString().slice(0, 10) } },
      include: { staff: true },
      orderBy: { date: "asc" },
    }),
    prisma.providerAbsence.findMany({
      where: { date: { gte: new Date().toISOString().slice(0, 10) } },
      include: { provider: true },
      orderBy: { date: "asc" },
    }),
  ]);

  return (
    <AbsencesManager
      staff={staff}
      providers={providers}
      staffAbsences={staffAbsences.map((a) => ({
        id: a.id,
        date: a.date,
        half: a.half,
        reason: a.reason,
        name: a.staff.name,
      }))}
      providerAbsences={providerAbsences.map((a) => ({
        id: a.id,
        date: a.date,
        half: a.half,
        reason: a.reason,
        name: a.provider.name,
      }))}
    />
  );
}
