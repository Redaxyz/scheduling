import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { weekdayIndex } from "@/lib/date";
import type { Half } from "@/lib/types";

function otherHalf(half: Half): Half {
  return half === "AM" ? "PM" : "AM";
}

// Click-to-toggle (cycling PRESENT -> ABSENT -> SURGERY -> PRESENT) for the
// provider calendar grid, aware of the weekly template default (see
// ProviderScheduleSlot.surgery): setting PRESENT when the template
// defaults this weekday+half to surgery creates a ProviderAutoOverride for
// just this date instead of merely clearing an absence row that may not
// even exist, since without one the default would just re-apply.
function validateBody(body: unknown): { providerId: string; date: string; half: Half; status: "PRESENT" | "ABSENT" | "SURGERY" } | { error: string } {
  const { providerId, date, half, status } = (body ?? {}) as Record<string, unknown>;
  if (typeof providerId !== "string" || !providerId) return { error: "Missing providerId" };
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid date" };
  if (half !== "AM" && half !== "PM") return { error: "half must be AM or PM" };
  if (status !== "PRESENT" && status !== "ABSENT" && status !== "SURGERY") return { error: "Invalid status" };
  return { providerId, date, half, status };
}

export async function POST(req: NextRequest) {
  const parsed = validateBody(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { providerId, date, half, status } = parsed;

  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider) return NextResponse.json({ error: "Unknown provider" }, { status: 400 });

  const weekday = weekdayIndex(date);
  const templateSlot =
    weekday === null
      ? null
      : await prisma.providerScheduleSlot.findUnique({ where: { providerId_weekday_half: { providerId, weekday, half } } });
  const defaultsToSurgery = templateSlot?.surgery ?? false;

  const existingAbsences = await prisma.providerAbsence.findMany({ where: { providerId, date, half: { in: ["ALL", half] } } });
  const allRow = existingAbsences.find((a) => a.half === "ALL");
  const thisRow = existingAbsences.find((a) => a.half === half);

  if (status === "PRESENT") {
    if (allRow) {
      // Shrink the whole-day row down to just the half that's still out.
      await prisma.providerAbsence.update({ where: { id: allRow.id }, data: { half: otherHalf(half) } });
    } else if (thisRow) {
      await prisma.providerAbsence.delete({ where: { id: thisRow.id } });
    }
    if (defaultsToSurgery) {
      await prisma.providerAutoOverride.upsert({
        where: { providerId_date_half: { providerId, date, half } },
        update: {},
        create: { providerId, date, half },
      });
    } else {
      await prisma.providerAutoOverride.deleteMany({ where: { providerId, date, half } });
    }
  } else {
    const surgery = status === "SURGERY";
    if (allRow) {
      if (allRow.surgery !== surgery) {
        // The other half needs to keep the ALL row's current status, so
        // split it off into its own row before this half moves to a
        // different one.
        await prisma.$transaction([
          prisma.providerAbsence.update({ where: { id: allRow.id }, data: { half: otherHalf(half) } }),
          prisma.providerAbsence.create({ data: { providerId, date, half, surgery } }),
        ]);
      }
    } else if (thisRow) {
      if (thisRow.surgery !== surgery) {
        await prisma.providerAbsence.update({ where: { id: thisRow.id }, data: { surgery } });
      }
    } else {
      await prisma.providerAbsence.create({ data: { providerId, date, half, surgery } });
    }
    // An explicit row now governs this half, so any leftover override
    // (from a previous present-toggle) would be redundant.
    await prisma.providerAutoOverride.deleteMany({ where: { providerId, date, half } });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
