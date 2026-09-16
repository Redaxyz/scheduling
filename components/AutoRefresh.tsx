"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { effectiveMonday, effectiveScheduleDate } from "@/lib/date";

// Periodically re-runs the server component tree so pages built from live
// DB state (schedule, absences, swap requests) pick up changes made
// elsewhere — another device, another staff member — without anyone having
// to manually reload or navigate away and back. When `stale` is given, each
// tick also checks whether the page's own date/week has quietly gone out of
// date (someone left the app open past 5pm, over a weekend, or past
// midnight) and navigates to the current one instead of just refreshing the
// stale one in place. `stale.current` must stay plain/serializable since
// this is invoked from server components — no functions as props.
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
    const tick = () => {
      if (staleKind && stalePeriod) {
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
