import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Approves a pending day-off request — see the StaffAbsence schema comment.
// Declining one isn't a status; it's just DELETE (below), same as canceling
// an already-approved one.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { approvedByStaffId } = body ?? {};

  const approver = typeof approvedByStaffId === "string" ? await prisma.staff.findUnique({ where: { id: approvedByStaffId } }) : null;
  if (!approver?.isManager) {
    return NextResponse.json({ error: "Only a manager can approve a day-off request." }, { status: 403 });
  }

  try {
    const updated = await prisma.staffAbsence.update({ where: { id }, data: { status: "APPROVED" } });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "That request no longer exists." }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.staffAbsence.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
