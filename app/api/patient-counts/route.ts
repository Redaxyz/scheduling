import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HALVES } from "@/lib/types";

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { providerId, date, half, count } = body ?? {};

  if (typeof providerId !== "string") {
    return NextResponse.json({ error: "Missing providerId" }, { status: 400 });
  }
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (!HALVES.includes(half)) {
    return NextResponse.json({ error: "Invalid half" }, { status: 400 });
  }
  const n = Number(count);
  if (!Number.isInteger(n) || n < 0) {
    return NextResponse.json({ error: "Count must be a non-negative whole number" }, { status: 400 });
  }

  const result = await prisma.patientCount.upsert({
    where: { providerId_date_half: { providerId, date, half } },
    update: { count: n },
    create: { providerId, date, half, count: n },
  });

  return NextResponse.json(result);
}
