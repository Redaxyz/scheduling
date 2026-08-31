import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFreeStaff } from "@/lib/schedule";
import { weekdayIndex } from "@/lib/date";
import { HALVES, OFFICES, ROLES, type Half } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, half, office, role, staffId, providerId } = body ?? {};

  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (!HALVES.includes(half)) {
    return NextResponse.json({ error: "Invalid half" }, { status: 400 });
  }
  if (!OFFICES.includes(office)) {
    return NextResponse.json({ error: "Invalid office" }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (typeof staffId !== "string") {
    return NextResponse.json({ error: "Missing staffId" }, { status: 400 });
  }

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || !staff.active) {
    return NextResponse.json({ error: "Unknown staff member" }, { status: 400 });
  }

  const freeStaff = await getFreeStaff(date);
  const isFree = freeStaff[half as Half].some((s) => s.id === staffId);
  if (!isFree) {
    return NextResponse.json(
      { error: `${staff.name} isn't free that half (absent, already placed, or committed to their doctor).` },
      { status: 409 }
    );
  }

  if ((role === "SCRIBE" || role === "SUB_SCRIBE") && !staff.canScribe) {
    return NextResponse.json({ error: `${staff.name} cannot scribe.` }, { status: 400 });
  }

  if (role === "XRAY" && staff.kind !== "XRAY") {
    return NextResponse.json({ error: `${staff.name} isn't an x-ray tech.` }, { status: 400 });
  }

  if (role === "SCRIBE") {
    if (typeof providerId !== "string") {
      return NextResponse.json({ error: "A substitute scribe assignment needs a providerId." }, { status: 400 });
    }
    const weekday = weekdayIndex(date);
    const slot =
      weekday === null
        ? null
        : await prisma.providerScheduleSlot.findFirst({
            where: { providerId, half, office, weekday },
          });
    if (!slot) {
      return NextResponse.json({ error: "That provider isn't scheduled at that office/half." }, { status: 400 });
    }
    const existingScribe = await prisma.assignment.findFirst({
      where: { date, half, role: "SCRIBE", providerId },
    });
    if (existingScribe) {
      return NextResponse.json({ error: "That doctor already has a substitute scribe." }, { status: 409 });
    }
  }

  try {
    const created = await prisma.assignment.create({
      data: {
        date,
        half,
        office,
        role,
        staffId,
        providerId: typeof providerId === "string" ? providerId : null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "That person is already placed for this half." }, { status: 409 });
  }
}
