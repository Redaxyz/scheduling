// How much of the bottom of the screen the fixed chrome takes up — the dock
// plus, on a phone, the date bar stacked on top of it (both live inside
// #bottom-nav, see BottomNav.tsx).
//
// On a computer/tablet the raised "Home" button pokes above the dock's own
// box via a negative margin — a plain getBoundingClientRect on #bottom-nav
// doesn't include that overhang, so this takes whichever is higher.
//
// On the iPhone Duo the dock moves into the status-bar strip down the right
// edge (html[data-dock="side"], see lib/sideDock.ts) along with the date
// bar, so nothing at the bottom of the screen is taken.
export function getBottomNavHeight(): number {
  const bottomNav = document.getElementById("bottom-nav");
  if (!bottomNav) return 0;
  const navRect = bottomNav.getBoundingClientRect();
  if (navRect.height === 0) return 0;
  const navTop = navRect.top;
  if (document.documentElement.dataset.dock === "side") return 0;
  const raised = document.getElementById("bottom-nav-raised");
  const raisedTop = raised ? raised.getBoundingClientRect().top : navTop;
  const top = Math.min(navTop, raisedTop);
  return Math.max(0, window.innerHeight - top);
}
