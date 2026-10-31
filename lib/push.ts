import webpush from "web-push";
import { prisma } from "./prisma";
import { addDays, formatLong, weekdayIndex } from "./date";
import { getDaySchedule, getUsualPosition, findStaffPosition, type DaySchedule, type UsualPosition } from "./schedule";
import { getWorkingHolidays } from "./workingHolidays";
import { isFederalHoliday } from "./holidays";
import { HALVES, HALF_LABELS, NOTIFIED_STAFF, OFFICE_LABELS, type Half, type Role } from "./types";

// Push services require a contact address on every send; the site itself will do.
const VAPID_SUBJECT = "https://scheduling-chi-navy.vercel.app";

export type PushMessage = { title: string; body: string; url: string };
type StoredSubscription = { endpoint: string; p256dh: string; auth: string };

// Throws on failure, with statusCode 404/410 meaning the phone has dropped
// this subscription for good.
export async function sendPush(sub: StoredSubscription, message: PushMessage) {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error("Push keys aren't set up");
  await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(message),
    { vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY } },
  );
}

function describeRole(role: Role, providerName: string | null): string {
  if (role === "SCRIBE") return providerName ? `scribing for ${providerName}` : "scribing";
  return role === "XRAY" ? "x-ray" : "rooming";
}

function capitalize(text: string): string {
  return text[0].toUpperCase() + text.slice(1);
}

function describeHalf(day: DaySchedule, half: Half, staffId: string, providerNames: Map<string, string>, usual: UsualPosition | null) {
  const position = findStaffPosition(day, half, staffId);
  if (!position) return null;
  if (usual && usual.office === position.office && usual.role === position.role && usual.providerId === position.providerId) return null;

  const slot = day.halves[half][position.office];
  const doctors = slot.providers.map((p) => p.provider.name);
  const staff = new Map<string, string>();
  for (const p of slot.providers) if (p.scribe) staff.set(p.scribe.staffId, p.scribe.name);
  for (const a of [...slot.rooming, ...slot.xray]) staff.set(a.staffId, a.name);
  staff.delete(staffId);

  const where = `${capitalize(describeRole(position.role, position.providerId ? (providerNames.get(position.providerId) ?? null) : null))} in ${OFFICE_LABELS[position.office]}`;
  const was = usual
    ? `usually ${describeRole(usual.role, usual.providerId ? (providerNames.get(usual.providerId) ?? null) : null)} in ${OFFICE_LABELS[usual.office]}`
    : "not usually scheduled";
  return {
    where: `${where} (${was})`,
    details: `Doctors: ${doctors.join(", ") || "none"}\nStaff: ${[...staff.values()].join(", ") || "nobody else yet"}`,
  };
}

// The alert for `date`, or null if the person is where they usually are, or
// isn't being placed anywhere (out, or not assigned yet) on any half.
export async function buildChangeNotice(staffId: string, date: string): Promise<PushMessage | null> {
  if (weekdayIndex(date) === null) return null;
  if (isFederalHoliday(date) && !(await getWorkingHolidays([date])).has(date)) return null;

  const [day, providers, usualAM, usualPM] = await Promise.all([
    getDaySchedule(date),
    prisma.provider.findMany({ select: { id: true, name: true } }),
    getUsualPosition(staffId, date, "AM"),
    getUsualPosition(staffId, date, "PM"),
  ]);
  const providerNames = new Map(providers.map((p) => [p.id, p.name]));
  const usual = { AM: usualAM, PM: usualPM };

  const changes = HALVES.flatMap((half) => {
    const change = describeHalf(day, half, staffId, providerNames, usual[half]);
    return change ? [{ half, ...change }] : [];
  });
  if (changes.length === 0) return null;

  const allDay = changes.length === 2 && changes[0].where === changes[1].where && changes[0].details === changes[1].details;
  const body = allDay
    ? `All day: ${changes[0].where}\n${changes[0].details}`
    : changes.map((c) => `${HALF_LABELS[c.half]}: ${c.where}\n${c.details}`).join("\n\n");

  return { title: `Schedule change: ${formatLong(date).replace(/, \d{4}$/, "")}`, body, url: `/schedule/${date}` };
}

// The next `days` calendar days' first change, for previewing what an alert
// will look like without waiting for one.
export async function findNextChangeNotice(staffId: string, fromDate: string, days = 14): Promise<PushMessage | null> {
  for (let i = 1; i <= days; i++) {
    const notice = await buildChangeNotice(staffId, addDays(fromDate, i));
    if (notice) return notice;
  }
  return null;
}

export async function sendChangeNotices(date: string) {
  const staff = await prisma.staff.findMany({
    where: { name: { in: NOTIFIED_STAFF }, active: true },
    include: { pushSubscriptions: true },
  });

  const results: { staff: string; notice: boolean; sent: number; failed: number }[] = [];
  for (const person of staff) {
    const notice = await buildChangeNotice(person.id, date);
    const result = { staff: person.name, notice: Boolean(notice), sent: 0, failed: 0 };
    results.push(result);
    if (!notice) continue;

    for (const sub of person.pushSubscriptions) {
      if (sub.lastNoticeFor === date) continue;
      try {
        await sendPush(sub, notice);
        await prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastNoticeFor: date } });
        result.sent++;
      } catch (e) {
        result.failed++;
        const statusCode = (e as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) await prisma.pushSubscription.delete({ where: { id: sub.id } });
        else console.error(`Push to ${person.name} failed`, e);
      }
    }
  }
  return results;
}
