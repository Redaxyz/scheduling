import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const staff = await prisma.staff.findMany({
    where: { active: true, usesApp: true },
    include: { dedicatedProvider: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(staff);
}
