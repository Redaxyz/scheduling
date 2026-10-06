import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expandDateRange } from "@/lib/dateRange";
import { CLOCK_RE } from "@/lib/timing";

const HALF_OPTIONS = ["AM", "PM", "ALL", "CUSTOM"];

function validateLateMinutes(half: string, lateMinutes: unknown, hasClock: boolean): { value: number | null; error?: string } {
  if (half !== "CUSTOM") return { value: null };
  if (lateMinutes === undefined || lateMinutes === null) {
    return hasClock ? { value: null } : { value: null, error: "Pick a time you're coming in or leaving." };
  }
  const n = Number(lateMinutes);
  if (!Number.isInteger(n) || n <= 0 || n % 15 !== 0 || n > 480) {
    return { value: null, error: "Custom lateness must be a positive multiple of 15 minutes (up to 8 hours)." };
  }
  return { value: n };
}

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

  const { arriveAt, leaveAt } = body;
  for (const [label, v] of [["arrival", arriveAt], ["departure", leaveAt]] as const) {
    if (v !== undefined && v !== null && (typeof v !== "string" || !CLOCK_RE.test(v))) {
      return NextResponse.json({ error: `Invalid ${label} time` }, { status: 400 });
    }
  }
  if (half !== "CUSTOM" && (arriveAt || leaveAt)) {
    return NextResponse.json({ error: "Arrival/departure times only apply to a custom entry" }, { status: 400 });
  }
  const late = validateLateMinutes(half, body.lateMinutes, Boolean(arriveAt || leaveAt));
  if (late.error) {
    return NextResponse.json({ error: late.error }, { status: 400 });
  }
  const lateMinutes = late.value;

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) return NextResponse.json({ error: "Unknown staff member" }, { status: 400 });

  const dates = expandDateRange(startDate, endDate || startDate);
  if (dates.length === 0) return NextResponse.json({ error: "Invalid range" }, { status: 400 });

  await prisma.$transaction(
    dates.map((date) =>
      prisma.staffAbsence.upsert({
        where: { staffId_date_half: { staffId, date, half } },
        // Only touch the fields this request actually carries, so adding an
        // early departure to a day that already has a late arrival (or vice
        // versa) doesn't wipe the other one.
        update: {
          reason: reason || null,
          ...(lateMinutes !== null ? { lateMinutes } : {}),
          ...(arriveAt ? { arriveAt } : {}),
          ...(leaveAt ? { leaveAt } : {}),
        },
        create: { staffId, date, half, reason: reason || null, lateMinutes, arriveAt: arriveAt || null, leaveAt: leaveAt || null },
      })
    )
  );

  return NextResponse.json({ ok: true, count: dates.length }, { status: 201 });
}
