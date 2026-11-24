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
    return () => {
      window.removeEventListener("resize", update);
      probe.remove();
    };
  }, []);

  // Black or white for the see-through dock, checked as the page scrolls and
  // every so often for page changes. In the Duo's strip the dock and the date
  // bar each go light when the page right beside them is black (Germantown).
  // In a holiday theme everywhere else, each button goes white or black
  // against whatever is right behind it.
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const retone = () => {
      frame = 0;
      const side = root.dataset.dock === "side";
      const holiday = root.dataset.holiday !== undefined;
      for (const surface of document.querySelectorAll<HTMLElement>("#bottom-nav .nav-surface")) {
        setTone(surface, side && besideDark(surface));
        for (const item of surface.children) {
          if (item instanceof HTMLElement) setTone(item, !side && holiday && behindDark(item));
        }
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(retone);
    };
    retone();
    const timer = window.setInterval(retone, 300);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.clearInterval(timer);
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}

// Below this brightness a color counts as dark and gets white. A little above
// the strict best-contrast point, so a holiday's mid-tone (Thanksgiving's
// red-orange) gets white like the page's own text on it.
const DARK = 0.3;

function setTone(el: HTMLElement, dark: boolean) {
  if (dark) el.dataset.tone = "dark";
  else if (el.dataset.tone) delete el.dataset.tone;
}

// Is what's showing right behind the middle of `el` dark? The first thing
// under that point (other than the dock itself) with a color of its own
// decides it (see DARK).
function behindDark(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const nav = document.getElementById("bottom-nav");
  const under = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  for (const node of under) {
    if (nav?.contains(node)) continue;
    const color = ownColor(node);
    if (color) return luminance(color) < DARK;
  }
  return luminance(ownColor(document.body) ?? [251, 248, 241]) < DARK;
}

// An element's background color, or failing that the first color of a
// gradient it's painted with; null if it's see-through.
function ownColor(node: Element): number[] | null {
  const style = getComputedStyle(node);
  const rgba = (text: string) => {
    const m = text.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
    return a >= 0.5 ? [r, g, b] : null;
  };
  return rgba(style.backgroundColor) ?? (style.backgroundImage.includes("gradient(") ? rgba(style.backgroundImage) : null);
}

function luminance([r, g, b]: number[]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
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
