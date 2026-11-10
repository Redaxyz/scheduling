import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { easternToday } from "@/lib/date";
import { worksOn } from "@/lib/staffDates";

export async function GET() {
  const staff = await prisma.staff.findMany({
    where: { active: true, usesApp: true },
    include: { dedicatedProvider: true },
    orderBy: { name: "asc" },
  });
  const today = easternToday();
  return NextResponse.json(staff.filter((s) => worksOn(s.name, today)));
}
