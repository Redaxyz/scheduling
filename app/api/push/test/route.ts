import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// A one-person trial of push notifications: Reda's phone registers and gets a
// test notification straight back, with nothing stored. Only ever posts to
// the browser vendors' own push services, never a URL the caller made up.
const PUSH_HOST = /^(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)$/;
const DELAY_MS = 5000;
// Push services require a contact address on every send; the site itself will do.
const VAPID_SUBJECT = "https://scheduling-chi-navy.vercel.app";

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
  if (staff?.name !== "Reda") {
    return NextResponse.json({ error: "Only Reda can run this test" }, { status: 403 });
  }
  if (!isPushEndpoint(subscription?.endpoint) || typeof subscription?.keys?.p256dh !== "string" || typeof subscription?.keys?.auth !== "string") {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "Push keys aren't set up" }, { status: 500 });
  }

  // Long enough to lock the phone and see it arrive on the lock screen.
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS));

  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } },
      JSON.stringify({ title: "CFA Schedule", body: "It works! Notifications are reaching your phone.", url: "/" }),
      { vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY } },
    );
  } catch (e) {
    const err = e as { statusCode?: number; body?: string; message?: string };
    return NextResponse.json({ error: `Push service said ${err.statusCode ?? "no"}: ${err.body || err.message}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
