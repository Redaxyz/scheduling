"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

// Periodically re-runs the server component tree so pages built from live
// DB state (schedule, absences, swap requests) pick up changes made
// elsewhere — another device, another staff member — without anyone having
// to manually reload or navigate away and back.
export default function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    const id = window.setInterval(() => startTransition(() => router.refresh()), intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
