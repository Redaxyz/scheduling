import { NextRequest, NextResponse } from "next/server";
import { respondSwapRequest } from "@/lib/swap";

// Accept or deny a direct swap proposal. { staffId, accept }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { staffId, accept } = body ?? {};

  if (typeof staffId !== "string") {
    return NextResponse.json({ error: "Missing staffId" }, { status: 400 });
  }
  if (typeof accept !== "boolean") {
    return NextResponse.json({ error: "Missing accept" }, { status: 400 });
  }

  try {
    await respondSwapRequest(id, staffId, accept);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Something went wrong" }, { status: 400 });
  }
}
