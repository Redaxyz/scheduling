"use client";

import { useEffect } from "react";
import { useWhoAmI } from "@/lib/whoami";

/** Drives the --theme-accent CSS var from the active person's color, the
 * same trick the GOAT app uses to tint its whole UI per logged-in profile. */
export default function ThemeAccent() {
  const { current } = useWhoAmI();

  useEffect(() => {
    document.documentElement.style.setProperty("--theme-accent", current?.color ?? "#94a3b8");
  }, [current]);

  return null;
}
