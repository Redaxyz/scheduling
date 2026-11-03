import { getBottomNavHeight } from "./bottomNav";

// Shared by the views that size themselves to fill one screen (calendars,
// My Schedule). Two things used to make them jump around:
//
// 1. Measuring an element's top against the *screen* instead of the *page*.
//    Scrolled down, the element looks like it starts higher up, so any
//    re-measure (a button press resizing something nearby) suddenly hands
//    out far more room, rows stretch, and the page leaps.
// 2. Phone browsers resize the viewport as the address bar hides/shows
//    while scrolling, firing "resize" mid-scroll and resizing everything.
//
// So: measure from the top of the page, and only take a new viewport
// height when the width changes (rotation, window resize) or the page is
// scrolled all the way up — otherwise reuse the last one.
let stable = { width: 0, height: 0 };

function viewportHeight(): number {
  const width = window.innerWidth;
  if (stable.height === 0 || width !== stable.width || window.scrollY <= 0) {
    stable = { width, height: window.innerHeight };
  }
  return stable.height;
}

// Room from the top of `el` down to the bottom nav, as laid out at the top
// of the page — the same answer no matter how far the page is scrolled.
export function spaceBelow(el: HTMLElement): number {
  const pageTop = el.getBoundingClientRect().top + window.scrollY;
  return viewportHeight() - pageTop - getBottomNavHeight();
}
