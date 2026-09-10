import { prisma } from "./prisma";
import { findStaffPosition, getDaySchedule, type PositionRef } from "./schedule";
import type { Half, Office, Role } from "./types";
import type { Prisma } from "@prisma/client";

export type SwapRequestView = {
  id: string;
  date: string;
  half: Half;
  office: Office;
  role: Role;
  providerId: string | null;
  positionStaffId: string;
  positionStaffName: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
  // true when the position holder opened this themselves (a broadcast, no
  // one specific person to respond) — false for a direct proposal from
  // someone else, which only the position holder can accept/deny.
  isBroadcast: boolean;
  createdAt: string;
};

function toView(
  r: Prisma.SwapRequestGetPayload<{ include: { positionStaff: true; requestedByStaff: true } }>
): SwapRequestView {
  return {
    id: r.id,
    date: r.date,
    half: r.half as Half,
    office: r.positionOffice as Office,
    role: r.positionRole as Role,
    providerId: r.positionProviderId,
    positionStaffId: r.positionStaffId,
    positionStaffName: r.positionStaff.name,
    requestedByStaffId: r.requestedByStaffId,
    requestedByStaffName: r.requestedByStaff.name,
    isBroadcast: r.requestedByStaffId === r.positionStaffId,
    createdAt: r.createdAt.toISOString(),
  };
}

// A position referenced by an OPEN request can go stale if the person got
// removed/reassigned through the normal schedule UI since the request was
// made. Rather than hook cleanup into every mutation route, we validate
// against the live schedule whenever requests are read, silently cancelling
// anything that no longer matches.
async function dropStaleRequests(
  rows: Prisma.SwapRequestGetPayload<{ include: { positionStaff: true; requestedByStaff: true } }>[],
  date: string
) {
  if (rows.length === 0) return rows;
  const day = await getDaySchedule(date);
  const fresh: typeof rows = [];
  const staleIds: string[] = [];
  for (const r of rows) {
    const pos = findStaffPosition(day, r.half as Half, r.positionStaffId);
    const matches = pos && pos.office === r.positionOffice && pos.role === r.positionRole && pos.providerId === r.positionProviderId;
    if (matches) fresh.push(r);
    else staleIds.push(r.id);
  }
  if (staleIds.length > 0) {
    await prisma.swapRequest.updateMany({ where: { id: { in: staleIds } }, data: { status: "CANCELLED", respondedAt: new Date() } });
  }
  return fresh;
}

// Open swap activity for one date: every broadcast (visible to everyone),
// plus any direct proposal where viewerId is one of the two people involved
// — "only that person is notified" means nobody else's direct proposals are
// returned at all.
export async function listSwapRequestsForDate(date: string, viewerId: string | null): Promise<SwapRequestView[]> {
  const rows = await prisma.swapRequest.findMany({
    where: { date, status: "OPEN" },
    include: { positionStaff: true, requestedByStaff: true },
    orderBy: { createdAt: "asc" },
  });
  const fresh = await dropStaleRequests(rows, date);
  return fresh
    .filter((r) => r.requestedByStaffId === r.positionStaffId || !viewerId || r.positionStaffId === viewerId || r.requestedByStaffId === viewerId)
    .map(toView);
}

// Every OPEN direct proposal (not a broadcast) currently waiting on viewerId
// to respond, across all dates — powers the bottom-nav badge so someone
// notices a swap request even when they're not looking at that date.
export async function listIncomingSwapRequests(viewerId: string): Promise<SwapRequestView[]> {
  const rows = await prisma.swapRequest.findMany({
    where: { status: "OPEN", positionStaffId: viewerId, NOT: { requestedByStaffId: viewerId } },
    include: { positionStaff: true, requestedByStaff: true },
    orderBy: { createdAt: "asc" },
  });
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);

  const fresh: typeof rows = [];
  for (const [date, group] of byDate) fresh.push(...(await dropStaleRequests(group, date)));
  fresh.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return fresh.map(toView);
}

// Click the swap icon on a position: toggles it off if the same person
// already has an OPEN request on that exact spot (cancel), otherwise opens
// one. A direct proposal (someone else's position) also retracts any other
// OPEN proposal the requester already had out this half — one active
// outgoing offer at a time keeps "my position" unambiguous.
export async function toggleSwapRequest(input: {
  date: string;
  half: Half;
  office: Office;
  role: Role;
  providerId: string | null;
  positionStaffId: string;
  requestedByStaffId: string;
}): Promise<{ cancelled: boolean }> {
  const { date, half, office, role, providerId, positionStaffId, requestedByStaffId } = input;

  const existing = await prisma.swapRequest.findFirst({
    where: { date, half, positionStaffId, requestedByStaffId, status: "OPEN" },
  });
  if (existing) {
    await prisma.swapRequest.update({ where: { id: existing.id }, data: { status: "CANCELLED", respondedAt: new Date() } });
    return { cancelled: true };
  }

  if (positionStaffId !== requestedByStaffId) {
    await prisma.swapRequest.updateMany({
      where: { date, half, requestedByStaffId, status: "OPEN", NOT: { positionStaffId: requestedByStaffId } },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });
  }

  await prisma.swapRequest.create({
    data: { date, half, positionOffice: office, positionRole: role, positionProviderId: providerId, positionStaffId, requestedByStaffId },
  });
  return { cancelled: false };
}

async function vacate(tx: Prisma.TransactionClient, pos: PositionRef, date: string) {
  if (pos.assignmentId) {
    await tx.assignment.delete({ where: { id: pos.assignmentId } });
  } else {
    await tx.autoOverride.upsert({
      where: { staffId_date_half: { staffId: pos.staffId, date, half: pos.half } },
      update: {},
      create: { staffId: pos.staffId, date, half: pos.half },
    });
  }
}

async function place(tx: Prisma.TransactionClient, staffId: string, date: string, pos: Pick<PositionRef, "half" | "office" | "role" | "providerId">) {
  await tx.assignment.create({
    data: { date, half: pos.half, office: pos.office, role: pos.role, staffId, providerId: pos.providerId },
  });
}

// Accept or deny a direct proposal. On accept, both people's LIVE positions
// are re-resolved off the current schedule (never a stored snapshot) and
// swapped; if the requester currently holds no position that half, this
// degrades to a one-way handoff (the position holder steps down, the
// requester steps in) rather than a two-way trade.
export async function respondSwapRequest(id: string, respondingStaffId: string, accept: boolean): Promise<void> {
  const reqRow = await prisma.swapRequest.findUnique({ where: { id } });
  if (!reqRow || reqRow.status !== "OPEN") throw new Error("This swap request is no longer open.");
  if (reqRow.requestedByStaffId === reqRow.positionStaffId) throw new Error("That's an open offer, not a direct proposal — there's no one response to give.");
  if (reqRow.positionStaffId !== respondingStaffId) throw new Error("Only the person being asked can respond to this.");

  if (!accept) {
    await prisma.swapRequest.update({ where: { id }, data: { status: "DECLINED", respondedAt: new Date() } });
    return;
  }

  const half = reqRow.half as Half;
  const day = await getDaySchedule(reqRow.date);
  const posA = findStaffPosition(day, half, reqRow.positionStaffId);
  const posB = findStaffPosition(day, half, reqRow.requestedByStaffId);

  if (!posA || posA.office !== reqRow.positionOffice || posA.role !== reqRow.positionRole || posA.providerId !== reqRow.positionProviderId) {
    await prisma.swapRequest.update({ where: { id }, data: { status: "CANCELLED", respondedAt: new Date() } });
    throw new Error("That position changed since the request was made — nothing to swap anymore.");
  }

  const [staffA, staffB] = await Promise.all([
    prisma.staff.findUnique({ where: { id: reqRow.positionStaffId } }),
    prisma.staff.findUnique({ where: { id: reqRow.requestedByStaffId } }),
  ]);
  if (!staffA?.active || !staffB?.active) throw new Error("One of you is no longer active.");

  if (posA.role === "SCRIBE" && !staffB.canScribe) throw new Error(`${staffB.name} can't scribe.`);
  if (posA.role === "XRAY" && staffB.kind !== "XRAY") throw new Error(`${staffB.name} isn't an x-ray tech.`);
  if (posB) {
    if (posB.role === "SCRIBE" && !staffA.canScribe) throw new Error(`${staffA.name} can't scribe.`);
    if (posB.role === "XRAY" && staffA.kind !== "XRAY") throw new Error(`${staffA.name} isn't an x-ray tech.`);
  }

  await prisma.$transaction(async (tx) => {
    await vacate(tx, posA, reqRow.date);
    if (posB) await vacate(tx, posB, reqRow.date);
    await place(tx, staffB.id, reqRow.date, posA);
    if (posB) await place(tx, staffA.id, reqRow.date, posB);

    await tx.swapRequest.update({ where: { id }, data: { status: "ACCEPTED", respondedAt: new Date() } });
    await tx.swapRequest.updateMany({
      where: {
        id: { not: id },
        date: reqRow.date,
        half: reqRow.half,
        status: "OPEN",
        OR: [{ positionStaffId: { in: [staffA.id, staffB.id] } }, { requestedByStaffId: { in: [staffA.id, staffB.id] } }],
      },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });
  });
}
