import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listIncomingSwapRequests, listSwapRequestsForDate, toggleSwapRequest } from "@/lib/swap";
import { HALVES, OFFICES, ROLES } from "@/lib/types";

// ?date=YYYY-MM-DD&viewerId=... -> broadcasts + this viewer's own direct
// proposals for that date (everyone else's direct proposals stay hidden).
// ?viewerId=...&incoming=1 (no date) -> every direct proposal waiting on
// this viewer to respond, across all dates, for the bottom-nav badge.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const viewerId = searchParams.get("viewerId");
  const incoming = searchParams.get("incoming");

  if (incoming) {
    if (typeof viewerId !== "string" || !viewerId) {
      return NextResponse.json({ error: "Missing viewerId" }, { status: 400 });
    }
    return NextResponse.json(await listIncomingSwapRequests(viewerId));
  }

  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  return NextResponse.json(await listSwapRequestsForDate(date, viewerId));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, half, office, role, providerId, positionStaffId, requestedByStaffId } = body ?? {};

  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (!HALVES.includes(half)) return NextResponse.json({ error: "Invalid half" }, { status: 400 });
  if (!OFFICES.includes(office)) return NextResponse.json({ error: "Invalid office" }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  if (typeof positionStaffId !== "string" || typeof requestedByStaffId !== "string") {
    return NextResponse.json({ error: "Missing staffId" }, { status: 400 });
  }

  const [positionStaff, requestedByStaff] = await Promise.all([
    prisma.staff.findUnique({ where: { id: positionStaffId } }),
    prisma.staff.findUnique({ where: { id: requestedByStaffId } }),
  ]);
  if (!positionStaff?.active || !requestedByStaff?.active) {
    return NextResponse.json({ error: "Unknown staff member" }, { status: 400 });
  }

  const result = await toggleSwapRequest({
    date,
    half,
    office,
    role,
    providerId: typeof providerId === "string" ? providerId : null,
    positionStaffId,
    requestedByStaffId,
  });
  return NextResponse.json(result, { status: 201 });
}
