"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { weekAnchorFor } from "@/components/CalendarWhoToggle";

// Month view is unusably small on a phone, so a phone-width window that
// lands on one (footer Schedule tab, a bookmark) is moved to the matching
// week instead. Matches Tailwind's lg breakpoint, like the rest of the
// calendar's desktop/mobile split.
export default function MobileWeekRedirect({ who, month }: { who: "staff" | "providers"; month: string }) {
  const router = useRouter();
  useEffect(() => {
    if (window.innerWidth < 1024) router.replace(`/calendar/${who}/week/${weekAnchorFor(month)}`);
  }, [router, who, month]);
  return null;
}
