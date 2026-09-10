import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HALVES, OFFICES } from "@/lib/types";

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { providerId, weekday, half } = body ?? {};

  if (typeof providerId !== "string") {
    return NextResponse.json({ error: "Missing providerId" }, { status: 400 });
  }
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 4) {
    return NextResponse.json({ error: "Invalid weekday" }, { status: 400 });
  }
  if (!HALVES.includes(half)) {
    return NextResponse.json({ error: "Invalid half" }, { status: 400 });
  }

  const hasOffice = Object.prototype.hasOwnProperty.call(body, "office");
  const hasSurgery = Object.prototype.hasOwnProperty.call(body, "surgery");
  if (hasOffice && body.office !== null && !OFFICES.includes(body.office)) {
    return NextResponse.json({ error: "Invalid office" }, { status: 400 });
  }
  if (hasSurgery && typeof body.surgery !== "boolean") {
    return NextResponse.json({ error: "surgery must be a boolean" }, { status: 400 });
  }

  const data: { office?: string | null; surgery?: boolean } = {};
  if (hasOffice) data.office = body.office;
  if (hasSurgery) data.surgery = body.surgery;

  const result = await prisma.providerScheduleSlot.upsert({
    where: { providerId_weekday_half: { providerId, weekday, half } },
    update: data,
    create: { providerId, weekday, half, office: hasOffice ? body.office : null, surgery: hasSurgery ? body.surgery : false },
  });

  return NextResponse.json(result);
}
