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
    const timer = window.setInterval(retone, 700);
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

// Is the page just left of the strip, level with `el`'s middle, dark? Reads
// the first solid background found there, skipping the strip's own parts.
function besideDark(el: HTMLElement): boolean {
  const nav = document.getElementById("bottom-nav");
  const rect = el.getBoundingClientRect();
  const x = (nav?.getBoundingClientRect().left ?? rect.left) - 2;
  if (x < 0 || rect.height === 0) return false;
  for (const under of document.elementsFromPoint(x, rect.top + rect.height / 2)) {
    if (nav?.contains(under)) continue;
    const match = getComputedStyle(under).backgroundColor.match(/[\d.]+/g);
    if (!match) continue;
    const [r, g, b, a = "1"] = match.map(Number).map(String);
    if (Number(a) < 0.5) continue;
    return (0.299 * Number(r) + 0.587 * Number(g) + 0.114 * Number(b)) / 255 < 0.35;
  }
  return false;
}
