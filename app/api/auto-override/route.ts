import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HALVES } from "@/lib/types";

// Lets a staff member opt out of their own computed default (dedicated
// scribe, scribe fallback, dedicated aid, or default x-ray) for one
// date+half, freeing them up to self-place elsewhere instead.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { staffId, date, half } = body ?? {};

  if (typeof staffId !== "string") {
    return NextResponse.json({ error: "Missing staffId" }, { status: 400 });
  }
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (!HALVES.includes(half)) {
    return NextResponse.json({ error: "Invalid half" }, { status: 400 });
  }

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || !staff.active) {
    return NextResponse.json({ error: "Unknown staff member" }, { status: 400 });
  }

  const result = await prisma.autoOverride.upsert({
    where: { staffId_date_half: { staffId, date, half } },
    update: {},
    create: { staffId, date, half },
  });

  return NextResponse.json(result, { status: 201 });
}
