// The bottom nav's raised "Home" button pokes above the nav bar's own box
// via a negative margin (see BottomNav.tsx) — a plain getBoundingClientRect
// on #bottom-nav only measures its own padding/content box, not that
// overhang, so anything computing "how much space does the footer take"
// from the nav element alone underestimates it and lets content render
// underneath the raised button. This finds the true topmost visual pixel
// of the whole nav area, raised button included.
export function getBottomNavHeight(): number {
  const bottomNav = document.getElementById("bottom-nav");
  if (!bottomNav) return 0;
  const navTop = bottomNav.getBoundingClientRect().top;
  const raised = document.getElementById("bottom-nav-raised");
  const raisedTop = raised ? raised.getBoundingClientRect().top : navTop;
  const top = Math.min(navTop, raisedTop);
  return Math.max(0, window.innerHeight - top);
}
