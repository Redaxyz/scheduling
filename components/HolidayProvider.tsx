"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { HOLIDAY_COOKIE, holidayCssVars, holidayFor, type HolidayKey } from "@/lib/holidayTheme";

// Which holiday theme is on (see lib/holidayTheme.ts), worked out by the
// server for the whole page and shared with every component that styles
// itself by it.
type HolidayState = { holiday: HolidayKey | null; demo: boolean; show: (key: HolidayKey | null) => void };
const HolidayContext = createContext<HolidayState>({ holiday: null, demo: false, show: () => {} });

// Every variable a theme sets on <html> (the same list for every theme).
const THEME_VARS = Object.keys(holidayCssVars("christmas"));

export function HolidayProvider({ holiday: fromServer, demo, children }: { holiday: HolidayKey | null; demo: boolean; children: ReactNode }) {
  const [holiday, setHoliday] = useState(fromServer);

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

  // Switches the page to another theme on the spot (preview builds only, see
  // useDemoHolidayFor), setting the same variables the server would have.
  function show(key: HolidayKey | null) {
    const root = document.documentElement;
    for (const name of THEME_VARS) root.style.removeProperty(name);
    if (key) {
      for (const [name, value] of Object.entries(holidayCssVars(key))) root.style.setProperty(name, value);
      root.dataset.holiday = key;
    } else {
      delete root.dataset.holiday;
    }
    setHoliday(key);
  }

  return <HolidayContext.Provider value={{ holiday, demo, show }}>{children}</HolidayContext.Provider>;
}

export function useHoliday(): HolidayKey | null {
  return useContext(HolidayContext).holiday;
}

// Preview builds only (never the live app): Home shows the theme of the day
// it's showing instead of today's, so every holiday's look can be checked by
// paging through the dates. It stays on when you switch tabs.
export function useDemoHolidayFor(date: string) {
  const { demo, show } = useContext(HolidayContext);
  useEffect(() => {
    if (demo) show(holidayFor(date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, date]);
}
