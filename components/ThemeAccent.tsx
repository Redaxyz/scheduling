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
    document.documentElement.style.setProperty("--theme-accent", accent);
  }, [current, staffList]);

  return null;
}
