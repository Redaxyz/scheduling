"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { weekAnchorFor } from "@/components/CalendarWhoToggle";
import { PHONE_QUERY, UNFOLDED_QUERY } from "@/lib/phone";

// A window under the lg breakpoint has no Month/Week toggle in the header,
// so one that lands on a month (a bookmark, a resized window) is moved to
// the matching week instead of being stranded there. Phones are the
// exception: their bottom date bar has its own W/M switch (MobileDateBar),
// so month view is something they chose and can get back out of.
export default function MobileWeekRedirect({ who, month }: { who: "staff" | "providers"; month: string }) {
  const router = useRouter();
  useEffect(() => {
    // The unfolded iPhone Duo gets the computer layout, Month toggle and all.
    if (window.innerWidth < 1024 && !window.matchMedia(PHONE_QUERY).matches && !window.matchMedia(UNFOLDED_QUERY).matches) {
      router.replace(`/calendar/${who}/week/${weekAnchorFor(month)}`);
    }
  }, [router, who, month]);
  return null;
}
