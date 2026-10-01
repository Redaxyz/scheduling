import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isFederalHoliday } from "@/lib/holidays";

export async function GET() {
  const rows = await prisma.holidayOverride.findMany();
  return NextResponse.json(rows.map((r) => r.date));
}

// Toggles whether a specific federal holiday date is a working day for the
// clinic (shown green instead of the default purple) — a plain on/off flip,
// no body beyond the date itself. Purely a calendar-grid display setting;
// see the HolidayOverride schema comment.
export async function POST(req: NextRequest) {
  const { date } = (await req.json().catch(() => ({}))) ?? {};
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (!isFederalHoliday(date)) {
    return NextResponse.json({ error: "That date isn't a federal holiday" }, { status: 400 });
  }

  const existing = await prisma.holidayOverride.findUnique({ where: { date } });
  if (existing) {
    await prisma.holidayOverride.delete({ where: { date } });
    return NextResponse.json({ working: false });
  }
  await prisma.holidayOverride.create({ data: { date } });
  return NextResponse.json({ working: true });
}
