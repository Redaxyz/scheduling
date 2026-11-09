"use client";

import { useEffect } from "react";
import { DOCK_COOKIE, looksLikeDuo } from "@/lib/sideDock";

const hasCookie = () => document.cookie.split("; ").includes(`${DOCK_COOKIE}=side`);

// Keeps the dock cookie in step with the screen (reloading once when it
// changes, so the server can let the page under the status bar), then puts
// the dock in the status bar strip whenever iOS reports one on the right.
export default function DockMode() {
  useEffect(() => {
    const want = looksLikeDuo();
    if (want !== hasCookie()) {
      document.cookie = want ? `${DOCK_COOKIE}=side; path=/; max-age=31536000; samesite=lax` : `${DOCK_COOKIE}=; path=/; max-age=0`;
      // Only if it stuck, or a blocked cookie would reload forever.
      if (hasCookie() === want) window.location.reload();
      return;
    }
    if (!want) return;

    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;width:env(safe-area-inset-right)";
    document.body.appendChild(probe);
    const update = () => {
      if (probe.getBoundingClientRect().width >= 40) document.documentElement.dataset.dock = "side";
      else delete document.documentElement.dataset.dock;
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      probe.remove();
    };
  }, []);

  return null;
}
