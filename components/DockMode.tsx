"use client";

import { useEffect } from "react";
import { DOCK_COOKIE, looksLikeDuo } from "@/lib/sideDock";
import { UNFOLDED_QUERY } from "@/lib/phone";

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

    // In the strip, the dock and the date bar each go black with white text
    // when the page right beside them is black (Germantown), cream again
    // otherwise. Checked as the page scrolls, and every so often for page
    // changes.
    let frame = 0;
    const retone = () => {
      frame = 0;
      for (const el of document.querySelectorAll<HTMLElement>("#bottom-nav .nav-surface")) {
        const dark = root.dataset.dock === "side" && besideDark(el);
        if (dark) el.dataset.tone = "dark";
        else delete el.dataset.tone;
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(retone);
    };
    const root = document.documentElement;
    retone();
    const timer = window.setInterval(retone, 300);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.clearInterval(timer);
      cancelAnimationFrame(frame);
      probe.remove();
    };
  }, []);

  return null;
}

// Is a black part of the page level with `el`'s middle? The black areas that
// reach the strip are tagged in the page itself (.strip-dark and friends,
// see globals.css), so this just checks whether one of them spans that
// height right now.
function besideDark(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.height === 0) return false;
  const y = rect.top + rect.height / 2;
  const mainPb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--main-pb")) || 0;
  const spans = (area: Element, extraBelow = 0) => {
    const r = area.getBoundingClientRect();
    return r.height > 0 && y >= r.top && y <= r.bottom + extraBelow;
  };
  // Germantown on Home (it also runs on through the bottom padding below it).
  for (const area of document.querySelectorAll(".strip-dark")) if (spans(area, mainPb)) return true;
  // Germantown afternoons on the Me tab.
  for (const area of document.querySelectorAll(".strip-dark-beside")) if (spans(area)) return true;
  // Home with the offices side by side: all of Germantown's half.
  if (window.matchMedia(UNFOLDED_QUERY).matches) {
    for (const area of document.querySelectorAll(".strip-dark-home")) if (spans(area)) return true;
  }
  return false;
}
