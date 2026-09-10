import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HALVES, OFFICES, ROLES } from "@/lib/types";

// Everyone edits their own personal template only — see components/MyTemplateEditor,
// which never renders a picker for anyone but the signed-in person. The
// server trusts staffId in the body, same as every other write in this app
// (see /api/absences/staff, /api/assignments): there's no server-side auth
// layer here, just a client that never offers the button to touch someone
// else's row.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get("staffId");
  const slots = await prisma.staffScheduleSlot.findMany({
    where: staffId ? { staffId } : undefined,
    orderBy: [{ weekday: "asc" }, { half: "asc" }],
  });
  return NextResponse.json(slots);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { staffId, weekday, half, role, office, providerId } = body ?? {};

  if (typeof staffId !== "string") {
    return NextResponse.json({ error: "Missing staffId" }, { status: 400 });
  }
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 4) {
    return NextResponse.json({ error: "Invalid weekday" }, { status: 400 });
  }
  if (!HALVES.includes(half)) {
    return NextResponse.json({ error: "Invalid half" }, { status: 400 });
  }

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) return NextResponse.json({ error: "Unknown staff member" }, { status: 400 });

  // No role (Off) just clears the slot — see the schema comment on
  // StaffScheduleSlot: once someone has ANY row, missing days mean "off
  // duty", not "fall back to the old defaults".
  if (role === null || role === undefined) {
    await prisma.staffScheduleSlot.deleteMany({ where: { staffId, weekday, half } });
    return NextResponse.json({ ok: true });
  }

  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (role === "SCRIBE") {
    if (!staff.canScribe) return NextResponse.json({ error: `${staff.name} can't scribe.` }, { status: 400 });
    if (typeof providerId !== "string") return NextResponse.json({ error: "Scribe needs a provider" }, { status: 400 });
  } else {
    if (role === "XRAY" && staff.kind !== "XRAY") {
      return NextResponse.json({ error: `${staff.name} isn't an x-ray tech.` }, { status: 400 });
    }
    if (!OFFICES.includes(office)) return NextResponse.json({ error: "Invalid office" }, { status: 400 });
  }

  const result = await prisma.staffScheduleSlot.upsert({
    where: { staffId_weekday_half: { staffId, weekday, half } },
    update: {
      role,
      office: role === "SCRIBE" ? null : office,
      providerId: role === "SCRIBE" ? providerId : null,
    },
    create: {
      staffId,
      weekday,
      half,
      role,
      office: role === "SCRIBE" ? null : office,
      providerId: role === "SCRIBE" ? providerId : null,
    },
  });

  return NextResponse.json(result);
}
