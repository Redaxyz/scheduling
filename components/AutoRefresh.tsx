"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { effectiveMonday, effectiveScheduleDate } from "@/lib/date";

// Periodically re-runs the server component tree so pages built from live
// DB state (schedule, absences, swap requests) pick up changes made
// elsewhere — another device, another staff member — without anyone having
// to manually reload or navigate away and back. When `stale` is given, each
// tick also checks whether a page that was showing today/this-week WHEN IT
// LOADED has quietly rolled over (left open past 5pm, over a weekend, or
// past midnight) and navigates to the new current one instead of just
// refreshing the stale one in place. Deliberately does NOT do this for a
// page that wasn't already "today" at load time — someone looking ahead at
// next week shouldn't get yanked back just because time passes while they
// look at it. `stale.period` must stay plain/serializable since this is
// invoked from server components — no functions as props.
export default function AutoRefresh({
  intervalMs = 15000,
  stale,
}: {
  intervalMs?: number;
  stale?: { kind: "day"; period: string } | { kind: "week"; period: string };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const staleKind = stale?.kind;
  const stalePeriod = stale?.period;

  useEffect(() => {
    // Captured once, at mount: was this page already "today"/"this week"
    // when it loaded? Only that case ever warrants auto-navigating away.
    const wasCurrent =
      staleKind && stalePeriod ? (staleKind === "day" ? effectiveScheduleDate() : effectiveMonday()) === stalePeriod : false;

    const tick = () => {
      if (wasCurrent && staleKind && stalePeriod) {
        const effective = staleKind === "day" ? effectiveScheduleDate() : effectiveMonday();
        if (effective !== stalePeriod) {
          const href = staleKind === "day" ? `/schedule/${effective}` : `/my-schedule/${effective}`;
          startTransition(() => router.push(href));
          return;
        }
      }
      startTransition(() => router.refresh());
    };
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs, staleKind, stalePeriod]);

  return null;
}
