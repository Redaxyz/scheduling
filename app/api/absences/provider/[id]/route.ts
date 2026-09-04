import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const HALF_OPTIONS = ["AM", "PM", "ALL", "CUSTOM"];

function validateLateMinutes(half: string, lateMinutes: unknown): { value: number | null; error?: string } {
  if (half !== "CUSTOM") return { value: null };
  const n = Number(lateMinutes);
  if (!Number.isInteger(n) || n <= 0 || n % 15 !== 0 || n > 480) {
    return { value: null, error: "Custom lateness must be a positive multiple of 15 minutes (up to 8 hours)." };
  }
  return { value: n };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { date, half, reason } = body ?? {};

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (!HALF_OPTIONS.includes(half)) {
    return NextResponse.json({ error: "Invalid half" }, { status: 400 });
  }

  const late = validateLateMinutes(half, body.lateMinutes);
  if (late.error) {
    return NextResponse.json({ error: late.error }, { status: 400 });
  }

  try {
    const updated = await prisma.providerAbsence.update({
      where: { id },
      data: { date, half, reason: reason || null, lateMinutes: late.value },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "That date/half is already scheduled off, or this absence no longer exists." },
      { status: 409 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.providerAbsence.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
