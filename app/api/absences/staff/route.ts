import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expandDateRange } from "@/lib/dateRange";

const HALF_OPTIONS = ["AM", "PM", "ALL"];

export async function GET() {
  const absences = await prisma.staffAbsence.findMany({
    where: { date: { gte: new Date().toISOString().slice(0, 10) } },
    include: { staff: true },
    orderBy: [{ date: "asc" }],
  });
  return NextResponse.json(absences);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { staffId, startDate, endDate, half, reason } = body ?? {};

  if (typeof staffId !== "string") {
    return NextResponse.json({ error: "Missing staffId" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || startDate)) {
    return NextResponse.json({ error: "Invalid date(s)" }, { status: 400 });
  }
  if (!HALF_OPTIONS.includes(half)) {
    return NextResponse.json({ error: "Invalid half" }, { status: 400 });
  }

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) return NextResponse.json({ error: "Unknown staff member" }, { status: 400 });

  const dates = expandDateRange(startDate, endDate || startDate);
  if (dates.length === 0) return NextResponse.json({ error: "Invalid range" }, { status: 400 });

  await prisma.$transaction(
    dates.map((date) =>
      prisma.staffAbsence.upsert({
        where: { staffId_date_half: { staffId, date, half } },
        update: { reason: reason || null },
        create: { staffId, date, half, reason: reason || null },
      })
    )
  );

  return NextResponse.json({ ok: true, count: dates.length }, { status: 201 });
}
