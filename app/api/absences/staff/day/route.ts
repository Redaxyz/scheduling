import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Clears every absence row (AM/PM/ALL/CUSTOM) for one staff member on one
// date in a single call — powers the click-to-toggle calendar, where a red
// or amber box going back to green shouldn't leave a stray half-day or
// late-note row behind. The full Absences page still handles anything more
// nuanced (single-half, reason text, lateness) one row at a time.
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get("staffId");
  const date = searchParams.get("date");

  if (typeof staffId !== "string" || !staffId) {
    return NextResponse.json({ error: "Missing staffId" }, { status: 400 });
  }
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const result = await prisma.staffAbsence.deleteMany({ where: { staffId, date } });
  return NextResponse.json({ ok: true, count: result.count });
}
