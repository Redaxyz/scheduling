"use client";

import { useEffect } from "react";
import { useWhoAmI } from "@/lib/whoami";
import { signinTileColor } from "@/lib/signinGrid";
import { useHoliday } from "@/components/HolidayProvider";

const DEFAULT_ACCENT = "#94a3b8";
const HOLIDAY_ACCENT = "#111111";

/** Drives the --theme-accent CSS var from the active person's sign-in tile
 * color (dark blue, light blue, orange or navy), so the whole app is tinted
 * to match the tile they tapped. Falls back to their own profile color if
 * they somehow have no tile. */
export default function ThemeAccent() {
  const { current, staffList } = useWhoAmI();
  const holiday = useHoliday();

  useEffect(() => {
    const own = current ? (signinTileColor(staffList, current.id) ?? current.color) : DEFAULT_ACCENT;
    // In a holiday theme everyone's accent is plain black, so borders, icons
    // and highlights are black and white against the holiday colors.
    const accent = holiday ? HOLIDAY_ACCENT : own;
    const root = document.documentElement.style;
    root.setProperty("--theme-accent", accent);
    // The Duo strip's icons: brand orange for anyone on an orange tile, brand
    // blue for everyone else (deep on cream, light beside black); black and
    // white in a holiday theme.
    const orange = own.toLowerCase() === "#f5871f";
    root.setProperty("--strip-ink", holiday ? "#111111" : orange ? "#d9690a" : "#1878b4");
    root.setProperty("--strip-ink-light", holiday ? "#ffffff" : orange ? "#f8a95c" : "#4fb3e8");
  }, [current, staffList, holiday]);

  return null;
}
