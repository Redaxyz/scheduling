import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Click-to-toggle for ONE half of a day on the staff calendar — sets that
// half out or back in without touching the other half or any running-late
// note. A whole-day ("ALL") row is split on the fly when only one of its
// halves is being cleared.
export async function POST(req: NextRequest) {
  const { staffId, date, half, out } = (await req.json().catch(() => ({}))) ?? {};
  if (typeof staffId !== "string" || !staffId) return NextResponse.json({ error: "Missing staffId" }, { status: 400 });
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  if (half !== "AM" && half !== "PM") return NextResponse.json({ error: "half must be AM or PM" }, { status: 400 });
  if (typeof out !== "boolean") return NextResponse.json({ error: "out must be a boolean" }, { status: 400 });

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || !staff.active) return NextResponse.json({ error: "Unknown staff member" }, { status: 400 });

  const other = half === "AM" ? "PM" : "AM";
  const rows = await prisma.staffAbsence.findMany({ where: { staffId, date, half: { in: ["ALL", half] } } });
  const allRow = rows.find((r) => r.half === "ALL");
  const halfRow = rows.find((r) => r.half === half);

  if (out) {
    if (!allRow && !halfRow) await prisma.staffAbsence.create({ data: { staffId, date, half } });
  } else {
    if (allRow) {
      const otherRow = await prisma.staffAbsence.findFirst({ where: { staffId, date, half: other } });
      if (otherRow) await prisma.staffAbsence.delete({ where: { id: allRow.id } });
      else await prisma.staffAbsence.update({ where: { id: allRow.id }, data: { half: other } });
    }
    if (halfRow) await prisma.staffAbsence.delete({ where: { id: halfRow.id } });
  }
  return NextResponse.json({ ok: true });
}
