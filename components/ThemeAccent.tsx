"use client";

import { useEffect } from "react";
import { useWhoAmI } from "@/lib/whoami";
import { signinTileColor } from "@/lib/signinGrid";

const DEFAULT_ACCENT = "#94a3b8";

/** Drives the --theme-accent CSS var from the active person's sign-in tile
 * color (dark blue, light blue, orange or navy), so the whole app is tinted
 * to match the tile they tapped. Falls back to their own profile color if
 * they somehow have no tile. */
export default function ThemeAccent() {
  const { current, staffList } = useWhoAmI();

  useEffect(() => {
    const accent = current ? (signinTileColor(staffList, current.id) ?? current.color) : DEFAULT_ACCENT;
    const root = document.documentElement.style;
    root.setProperty("--theme-accent", accent);
    // The Duo strip's icons: brand orange for anyone on an orange tile, brand
    // blue for everyone else (deep on cream, light beside black).
    const orange = accent.toLowerCase() === "#f5871f";
    root.setProperty("--strip-ink", orange ? "#d9690a" : "#1878b4");
    root.setProperty("--strip-ink-light", orange ? "#f8a95c" : "#4fb3e8");
  }, [current, staffList]);

  return null;
}
