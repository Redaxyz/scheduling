"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { HOLIDAY_COOKIE, type HolidayKey } from "@/lib/holidayTheme";

// Which holiday theme is on (see lib/holidayTheme.ts), worked out once by the
// server for the whole page and shared with every component that styles
// itself by it.
const HolidayContext = createContext<HolidayKey | null>(null);

export function HolidayProvider({ holiday, children }: { holiday: HolidayKey | null; children: ReactNode }) {
  // Trying a theme early: open any page with ?holiday=christmas (or
  // thanksgiving, or none) to see it in this browser; ?holiday=auto goes back
  // to following the date. Only this browser is affected.
  useEffect(() => {
    const url = new URL(window.location.href);
    const pick = url.searchParams.get("holiday");
    if (pick === null) return;
    document.cookie =
      pick === "auto" ? `${HOLIDAY_COOKIE}=; path=/; max-age=0` : `${HOLIDAY_COOKIE}=${encodeURIComponent(pick)}; path=/; max-age=604800; samesite=lax`;
    url.searchParams.delete("holiday");
    window.location.replace(url.toString());
  }, []);

  return <HolidayContext.Provider value={holiday}>{children}</HolidayContext.Provider>;
}

export function useHoliday(): HolidayKey | null {
  return useContext(HolidayContext);
}
