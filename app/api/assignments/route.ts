import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDaySchedule, getFreeStaff, getXrayEligible } from "@/lib/schedule";
import { weekdayIndex } from "@/lib/date";
import { HALVES, OFFICES, ROLES, type Half, type Office } from "@/lib/types";

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

  const day = await getDaySchedule(date);
  if (day.halves[half as Half][office as Office].providers.length === 0) {
    return NextResponse.json({ error: "That office is closed that half, since no providers are working." }, { status: 400 });
  }

  // X-ray has its own eligibility system (default tech, or a satisfied
  // backup) — validated independently of the generic free-staff pool, since
  // x-ray techs are deliberately excluded from that pool entirely.
  if (role === "XRAY") {
    const xrayEligible = await getXrayEligible(date, office as Office, half as Half);
    if (!xrayEligible.some((s) => s.id === staffId)) {
      return NextResponse.json(
        { error: `${staff.name} isn't eligible for x-ray here right now (not the default tech, or their backup condition isn't met).` },
        { status: 400 }
      );
    }
  } else {
    const freeStaff = await getFreeStaff(date);
    const isFree = freeStaff[half as Half].some((s) => s.id === staffId);
    if (!isFree) {
      return NextResponse.json(
        { error: `${staff.name} isn't free that half (absent, already placed, or an x-ray tech).` },
        { status: 409 }
      );
    }

    if (role === "SCRIBE" && !staff.canScribe) {
      return NextResponse.json({ error: `${staff.name} cannot scribe.` }, { status: 400 });
    }
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
    // Someone can only hold one placement a half, and if they got this far
    // any they already have is set aside at a closed office.
    const closedOffices = OFFICES.filter((o) => day.halves[half as Half][o].providers.length === 0);
    await prisma.assignment.deleteMany({ where: { date, half, staffId, office: { in: [...closedOffices] } } });
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
