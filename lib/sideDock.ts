// The iPhone Duo keeps its status bar (clock, Wi-Fi) in a strip down the
// right edge, open or closed, and the dock goes in that strip. It's told
// apart by shape: about 2:3, squarer than any other iPhone, and smaller than
// an iPad. The server can't measure the screen, so the browser leaves this
// cookie for it (components/DockMode.tsx).
export const DOCK_COOKIE = "dock";

export function looksLikeDuo(): boolean {
  const long = Math.max(screen.width, screen.height);
  const short = Math.min(screen.width, screen.height);
  return navigator.maxTouchPoints > 0 && long <= 1100 && short / long >= 0.6;
}
