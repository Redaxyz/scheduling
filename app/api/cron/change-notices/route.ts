import { NextRequest, NextResponse } from "next/server";
import { addDays, easternHour, easternToday } from "@/lib/date";
import { sendChangeNotices } from "@/lib/push";

const SEND_HOUR = 20;

// Called by Vercel Cron (see vercel.json), which only speaks UTC: one run is
// scheduled for each side of daylight saving, and only the one landing on
// 8pm Eastern does anything.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (easternHour() !== SEND_HOUR) {
    return NextResponse.json({ skipped: `Not ${SEND_HOUR}:00 Eastern` });
  }

  const date = addDays(easternToday(), 1);
  return NextResponse.json({ date, results: await sendChangeNotices(date) });
}
