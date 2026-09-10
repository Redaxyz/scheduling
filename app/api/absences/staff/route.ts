import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expandDateRange } from "@/lib/dateRange";

const HALF_OPTIONS = ["AM", "PM", "ALL", "CUSTOM"];

function validateLateMinutes(half: string, lateMinutes: unknown): { value: number | null; error?: string } {
  if (half !== "CUSTOM") return { value: null };
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
  const { staffId, startDate, endDate, half, reason, requestedByStaffId } = body ?? {};

  if (typeof staffId !== "string") {
    return NextResponse.json({ error: "Missing staffId" }, { status: 400 });
  }
  if (typeof requestedByStaffId !== "string") {
    return NextResponse.json({ error: "Missing requestedByStaffId" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || startDate)) {
    return NextResponse.json({ error: "Invalid date(s)" }, { status: 400 });
  }
  if (!HALF_OPTIONS.includes(half)) {
    return NextResponse.json({ error: "Invalid half" }, { status: 400 });
  }

  const late = validateLateMinutes(half, body.lateMinutes);
  if (late.error) {
    return NextResponse.json({ error: late.error }, { status: 400 });
  }
  const lateMinutes = late.value;

  const [staff, requestor] = await Promise.all([
    prisma.staff.findUnique({ where: { id: staffId } }),
    prisma.staff.findUnique({ where: { id: requestedByStaffId } }),
  ]);
  if (!staff) return NextResponse.json({ error: "Unknown staff member" }, { status: 400 });
  if (!requestor) return NextResponse.json({ error: "Unknown requester" }, { status: 400 });

  // A running-late note isn't a day-off request — nothing to approve. A
  // manager acting (for herself or on someone else's behalf) also skips the
  // queue, since there's nobody above her to ask. Anyone else requesting a
  // real day off needs Joanna's sign-off first.
  const status = half === "CUSTOM" || requestor.isManager ? "APPROVED" : "PENDING";

  const dates = expandDateRange(startDate, endDate || startDate);
  if (dates.length === 0) return NextResponse.json({ error: "Invalid range" }, { status: 400 });

  await prisma.$transaction(
    dates.map((date) =>
      prisma.staffAbsence.upsert({
        where: { staffId_date_half: { staffId, date, half } },
        update: { reason: reason || null, lateMinutes, status },
        create: { staffId, date, half, reason: reason || null, lateMinutes, status },
      })
    )
  );

  return NextResponse.json({ ok: true, count: dates.length, status }, { status: 201 });
}
