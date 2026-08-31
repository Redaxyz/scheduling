import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HALVES, OFFICES } from "@/lib/types";

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { providerId, weekday, half, office } = body ?? {};

  if (typeof providerId !== "string") {
    return NextResponse.json({ error: "Missing providerId" }, { status: 400 });
  }
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 4) {
    return NextResponse.json({ error: "Invalid weekday" }, { status: 400 });
  }
  if (!HALVES.includes(half)) {
    return NextResponse.json({ error: "Invalid half" }, { status: 400 });
  }
  if (office !== null && !OFFICES.includes(office)) {
    return NextResponse.json({ error: "Invalid office" }, { status: 400 });
  }

  const result = await prisma.providerScheduleSlot.upsert({
    where: { providerId_weekday_half: { providerId, weekday, half } },
    update: { office },
    create: { providerId, weekday, half, office },
  });

  return NextResponse.json(result);
}
