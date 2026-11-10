"use client";

import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { effectiveMonday, effectiveScheduleDate } from "@/lib/date";
import { CalendarIcon, HomeIcon, PersonIcon } from "@/components/icons";
import { useWhoAmI } from "@/lib/whoami";
import { PHONE_QUERY } from "@/lib/phone";
import type { SwapRequestView } from "@/lib/swap";

const INCOMING_SWAP_POLL_MS = 15000;

// The tinted slab behind the active tab — the same tint as the active side
// of the Providers/Staff switch. On a computer it fills the tab (and is
// slanted along with the whole dock); on a phone it slants on its own.
function ActiveSlab() {
  return (
    <span
      aria-hidden
      className="absolute inset-1 rounded-[4px] phone:inset-x-3 phone:inset-y-0.5 phone:-skew-x-12"
      style={{ background: "color-mix(in srgb, var(--theme-accent) 30%, white)" }}
    />
  );
}

type IconType = ComponentType<{ className?: string; style?: CSSProperties }>;
type Tab = { key: string; href: string; match: string; label: string; Icon: IconType; primary?: boolean; badge?: number };

export default function BottomNav() {
  const pathname = usePathname();
  const { current, setCurrentId } = useWhoAmI();
  const [incoming, setIncoming] = useState<SwapRequestView[]>([]);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!current) {
      setIncoming([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      fetch(`/api/swap-requests?viewerId=${current.id}&incoming=1`)
        .then((r) => r.json())
        .then((data: SwapRequestView[]) => {
          if (!cancelled) setIncoming(Array.isArray(data) ? data : []);
        })
        .catch(() => {});
    };
    load();
    const id = window.setInterval(load, INCOMING_SWAP_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [current]);

  // How tall the bottom chrome is right now (dock, plus the date bar on
  // pages that have one): <main> pads itself by exactly that (--main-pb)
  // instead of a guess. (Whether the dock goes in the iPhone Duo's side
  // strip is DockMode's job — see lib/sideDock.ts.)
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const root = document.documentElement;
    const phone = window.matchMedia(PHONE_QUERY);
    const standalone = window.matchMedia("(display-mode: standalone)");
    // Phone-only: the Safari-toolbar-stranding this compensates for is a
    // small-viewport iOS phenomenon. The unfolded iPhone Duo's inner screen
    // used to be included here too ("it's touch-only, so iOS can strand it
    // the same way"), but on the Duo's big spanning viewport the visualViewport
    // numbers don't line up with the real layout the way they do on a phone,
    // so the computed shift could be large and wrong — dragging the dock up
    // into the middle of the screen instead of leaving it pinned at the
    // bottom. The Duo already gets the computer-style dockrow layout
    // everywhere else, so it doesn't need this correction either.

    function update() {
      if (!nav) return;
      root.style.setProperty("--main-pb", `${Math.round(nav.getBoundingClientRect().height) + 12}px`);

      // On a phone, full-bleed blocks (.w-bleed) size from the page's real
      // laid-out width instead of 100vw. In an iOS home-screen app 100vw can
      // come out wider than what's actually on screen, and since those
      // blocks center themselves, the extra spills off the LEFT edge where
      // it can't be scrolled back into view.
      if (phone.matches) root.style.setProperty("--vw", `${root.clientWidth}px`);
      else root.style.removeProperty("--vw");
    }
    update();

    // Keeps the bar glued to the bottom of what's actually on screen. Some
    // iOS browsers (Firefox in particular) grow the page as their own
    // toolbar slides away mid-scroll but don't move position:fixed things
    // to match, leaving the bar stranded partway up — and folding/unfolding
    // the iPhone Duo can leave it placed against the old screen size. So
    // rather than trusting position:fixed, this checks where the bar's
    // bottom edge ACTUALLY is against where the visible screen's bottom edge
    // is (the visual viewport always knows), and shifts it by the
    // difference. Skipped while zoomed in or typing (the two are meant to
    // differ then), and while the page is bounced past either end — iOS
    // reports odd offsets mid-bounce, and following them is what made the
    // bar jump up when pulling down at the top.
    const vv = window.visualViewport;
    let settleTimers: number[] = [];
    let shift = 0;
    function pin() {
      if (!nav) return;
      const typing = document.activeElement instanceof HTMLElement && document.activeElement.matches("input:not([type=date]), textarea, select");
      // Not with the dock in the Duo's side strip either: it's fixed inside
      // this bar, and a transform here would drag it along with the bar.
      const sideDock = root.dataset.dock === "side";
      if (!vv || !phone.matches || sideDock || Math.abs(vv.scale - 1) > 0.01 || typing) {
        shift = 0;
        nav.style.transform = "";
        return;
      }
      const maxScroll = root.scrollHeight - root.clientHeight;
      const bouncing = window.scrollY < 0 || window.scrollY > maxScroll;
      if (bouncing) return;
      const naturalBottom = nav.getBoundingClientRect().bottom - shift;
      const delta = vv.offsetTop + vv.height - naturalBottom;
      shift = Math.abs(delta) >= 1 && Math.abs(delta) < vv.height * 0.45 ? Math.round(delta) : 0;
      nav.style.transform = shift ? `translateY(${shift}px)` : "";
    }
    pin();

    // iOS can keep placing position:fixed things against the OLD screen
    // size after a fold/unfold until something forces a fresh layout —
    // which is what leaves the dock floating partway up. Taking the bar out
    // of layout for an instant and putting it back, plus a no-op scroll,
    // makes WebKit re-anchor it to the current bottom edge.
    function reanchor() {
      if (!nav) return;
      nav.style.display = "none";
      void nav.offsetHeight;
      nav.style.display = "";
      window.scrollTo(window.scrollX, window.scrollY);
    }

    // The screen changing size (fold/unfold, rotation): drop any nudge at
    // once, then re-anchor and re-measure everything only after the change
    // has settled — measuring mid-change is what used to leave the bar out
    // of place.
    function onScreenChange() {
      shift = 0;
      if (nav) nav.style.transform = "";
      update();
      settleTimers.forEach((t) => window.clearTimeout(t));
      settleTimers = [150, 400, 900, 1600].map((ms) =>
        window.setTimeout(() => {
          reanchor();
          update();
          pin();
        }, ms)
      );
    }

    // Folding/unfolding always changes the width, and iOS doesn't reliably
    // fire window "resize" for it — but the visual viewport always reports
    // it. (Height-only changes are just a toolbar sliding; pin() has those.)
    let lastWidth = vv ? Math.round(vv.width * vv.scale) : 0;
    function onVisualResize() {
      if (!vv) return;
      const width = Math.round(vv.width * vv.scale);
      if (Math.abs(width - lastWidth) < 2) return;
      lastWidth = width;
      onScreenChange();
    }

    const ro = new ResizeObserver(update);
    ro.observe(nav);
    window.addEventListener("resize", onScreenChange);
    window.addEventListener("orientationchange", onScreenChange);
    phone.addEventListener("change", onScreenChange);
    vv?.addEventListener("resize", onVisualResize);
    standalone.addEventListener("change", update);
    vv?.addEventListener("resize", pin);
    vv?.addEventListener("scroll", pin);
    window.addEventListener("scroll", pin, { passive: true });
    return () => {
      settleTimers.forEach((t) => window.clearTimeout(t));
      ro.disconnect();
      window.removeEventListener("resize", onScreenChange);
      window.removeEventListener("orientationchange", onScreenChange);
      phone.removeEventListener("change", onScreenChange);
      vv?.removeEventListener("resize", onVisualResize);
      standalone.removeEventListener("change", update);
      vv?.removeEventListener("resize", pin);
      vv?.removeEventListener("scroll", pin);
      window.removeEventListener("scroll", pin);
    };
  }, []);

  const scheduleHref = incoming.length > 0 ? `/schedule/${incoming[0].date}` : `/schedule/${effectiveScheduleDate()}`;

  const tabs: Tab[] = [
    { key: "schedule", href: `/calendar/staff/week/${effectiveMonday()}`, match: "/calendar", label: "Schedule", Icon: CalendarIcon },
    { key: "home", href: scheduleHref, match: "/schedule", label: "Home", Icon: HomeIcon, primary: true, badge: incoming.length },
    { key: "me", href: `/my-schedule/${effectiveMonday()}`, match: "/my-schedule", label: "Me", Icon: PersonIcon },
  ];

  // One design language for the dock and the date control beside it: the
  // same frosted surface (.nav-surface), the same accent border, the same
  // slanted-trapezoid shape as every other control in the app, and the
  // same tinted slab marking whatever's active (as in the Providers/Staff
  // switch). Home is a small slanted chip in the brand gradient instead of
  // a raised circle, so nothing pokes out of the bar.
  //
  // Computer/tablet: the whole dock is one slanted track (contents slanted
  // back upright), icon beside label. Phone (`phone:`): a bar flush with
  // the bottom edge of the screen like a native tab bar, icon over label,
  // with just enough padding under the labels to clear the home indicator
  // — there the slant lives on the active slab and the Home chip instead.
  const itemClass =
    "relative flex flex-1 items-center justify-center text-sm font-bold transition-opacity phone:pb-1 phone:pt-1.5 phone:text-[10px] phone:leading-none";
  const innerClass = "relative flex items-center gap-2 skew-x-12 phone:skew-x-0 phone:flex-col phone:gap-1";

  return (
    <div
      ref={navRef}
      id="bottom-nav"
      className="fixed bottom-0 z-40 px-3 pt-1.5 pb-[calc(0.375rem_+_var(--sa-bottom))] phone:p-0"
    >
      {/* Stacked on a phone (date bar on top of the dock); one row on a
          computer and the unfolded Duo (date bar on the left, dock beside
          it). */}
      <div className="mx-auto flex max-w-6xl flex-col dockrow:flex-row dockrow:items-center dockrow:gap-3">
      {/* Where a page's MobileDateBar lands (it portals itself in here), so
          the date bar and the dock are one block: laid out with no gap to
          guess at, and measured together. */}
      <div id="date-nav-slot" className="dockrow:shrink-0" />

      <nav id="dock" aria-label="Main" className="dockrow:min-w-0 dockrow:flex-1">
        <div className="dock-surface nav-surface accent-border flex h-12 -skew-x-12 items-stretch overflow-hidden rounded-md border-2 p-0 phone:h-auto phone:skew-x-0 phone:rounded-b-none phone:rounded-t-[1.25rem] phone:border-x-0 phone:border-b-0 phone:pb-[max(0.25rem,calc(var(--sa-bottom)_-_16px))]">
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.match);
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-label={tab.label}
                title={tab.label}
                aria-current={active ? "page" : undefined}
                className={`${itemClass} ${active || tab.primary ? "text-slate-800" : "text-slate-500 hover:text-slate-800"}`}
              >
                {active && <ActiveSlab />}
                <span className={innerClass}>
                  {tab.primary ? (
                    <span
                      id="bottom-nav-raised"
                      className="relative flex h-7 w-10 items-center justify-center rounded-[5px] text-white phone:h-6 phone:w-9 phone:-skew-x-12"
                      style={{ background: "var(--theme-accent)" }}
                    >
                      <tab.Icon className="h-4 w-4 phone:skew-x-12" />
                      {Boolean(tab.badge) && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-extrabold text-white phone:skew-x-12">
                          {tab.badge}
                        </span>
                      )}
                    </span>
                  ) : (
                    <tab.Icon className="h-6 w-6" style={active ? { color: "color-mix(in srgb, var(--theme-accent) 70%, #334155)" } : undefined} />
                  )}
                </span>
              </Link>
            );
          })}

          {/* Was the top header's top-right "switch person" button — moved
              here (bottom right of the footer) now that the header is gone
              entirely, freeing up a full row of vertical space on every
              page. */}
          {current && (
            <button
              type="button"
              onClick={() => setCurrentId(null)}
              aria-label="Switch person"
              title="Not you? Tap to switch"
              className={`${itemClass} text-slate-500 hover:text-slate-800`}
            >
              <span className={innerClass}>
                <span className="flex h-5 w-5 items-center justify-center">
                  <span className="h-3 w-3 rounded-full" style={{ background: "var(--theme-accent)" }} />
                </span>
                <span className="max-w-[6rem] truncate phone:max-w-[3.25rem] phone:pb-px">{current.name}</span>
              </span>
            </button>
          )}
        </div>
      </nav>
      </div>
    </div>
  );
}
