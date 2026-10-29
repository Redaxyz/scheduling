import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_LEN = 1000;

export async function GET(req: NextRequest) {
  const date = new URL(req.url).searchParams.get("date");
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const note = await prisma.dayNote.findUnique({ where: { date } });
  return NextResponse.json(note ?? { date, text: "", updatedByName: null, updatedAt: null });
}

// Saves (or, with empty text, clears) the note for one day. Same trust model
// as the rest of the app: no server-side auth, the client says who's writing.
export async function PUT(req: NextRequest) {
  const { date, text, updatedByName } = (await req.json().catch(() => ({}))) ?? {};
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (typeof text !== "string" || text.length > MAX_LEN) {
    return NextResponse.json({ error: `Note must be text under ${MAX_LEN} characters` }, { status: 400 });
  }
  const trimmed = text.trim();
  if (!trimmed) {
    await prisma.dayNote.deleteMany({ where: { date } });
    return NextResponse.json({ date, text: "", updatedByName: null, updatedAt: null });
  }
  const by = typeof updatedByName === "string" ? updatedByName.slice(0, 80) : null;
  const note = await prisma.dayNote.upsert({
    where: { date },
    update: { text: trimmed, updatedByName: by },
    create: { date, text: trimmed, updatedByName: by },
  });
  return NextResponse.json(note);
}
