import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { easternToday } from "@/lib/date";
import { findNextChangeNotice, sendPush } from "@/lib/push";
import { NOTIFIED_STAFF } from "@/lib/types";

// Saves this phone for the nightly change alerts, then sends it a preview of
// the next one coming up. Only ever posts to the browser vendors' own push
// services, never a URL the caller made up.
const PUSH_HOST = /^(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)$/;
const DELAY_MS = 5000;

function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string") return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return NextResponse.json({ error: "Push keys aren't set up" }, { status: 500 });
  return NextResponse.json({ publicKey });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { staffId, subscription } = body ?? {};

  const staff = typeof staffId === "string" ? await prisma.staff.findUnique({ where: { id: staffId } }) : null;
  if (!staff || !NOTIFIED_STAFF.includes(staff.name)) {
    return NextResponse.json({ error: "Notifications aren't available for this person yet" }, { status: 403 });
  }
  if (!isPushEndpoint(subscription?.endpoint) || typeof subscription?.keys?.p256dh !== "string" || typeof subscription?.keys?.auth !== "string") {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const sub = { endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth };
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { ...sub, staffId: staff.id },
    create: { ...sub, staffId: staff.id },
  });

  const notice = await findNextChangeNotice(staff.id, easternToday());

  // Long enough to lock the phone and see it arrive on the lock screen.
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS));

  try {
    await sendPush(
      sub,
      notice
        ? { ...notice, title: `Preview. ${notice.title}` }
        : { title: "CFA Schedule", body: "You're set up. No changes coming up in the next two weeks.", url: "/" },
    );
  } catch (e) {
    const err = e as { statusCode?: number; body?: string; message?: string };
    return NextResponse.json({ error: `Push service said ${err.statusCode ?? "no"}: ${err.body || err.message}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
