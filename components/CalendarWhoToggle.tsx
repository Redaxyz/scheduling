"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { effectiveMonday, effectiveScheduleDate, firstOfMonth, mondayOnOrAfter } from "@/lib/date";

// Matches Tailwind's `lg` breakpoint — the same width each grid's own
// column layout switches on.
const DESKTOP_BREAKPOINT = 1024;

// A week link's anchor is either an actual Monday already (coming from a
// week page — mondayOnOrAfter is then a no-op) or a month's 1st (coming
// from a month page). Two things go wrong if you just use mondayOf() there:
// 1. Anchored to the CURRENT month, mondayOf(the 1st) gives "the week
//    containing the 1st", which is only the current week for the first few
//    days of the month — any later, it's an earlier week entirely.
// 2. Anchored to any OTHER month, mondayOf often rolls backward into the
//    previous month (e.g. October 1st, a Thursday, lands on September
//    28th) — landing on "an earlier week" every single time you switch to
//    Week view, which is exactly the bug this fixes.
function weekAnchorFor(anchorDate: string): string {
  if (anchorDate === firstOfMonth(effectiveScheduleDate())) return effectiveMonday();
  return mondayOnOrAfter(anchorDate);
}

const activeTextStyle = { color: "#334155" };

// A two-option trapezoid pill with a sliding highlight behind whichever
// segment is active, instead of the highlight just snapping between them.
// `activeKey` updates optimistically the instant you click — synchronously,
// before the route navigation that follows — so the slide is already under
// way on the page you're leaving; the page you land on then mounts fresh,
// already in its final (settled) position, same as this component always
// has on a brand new page load.
function SlidingPair({
  trackClassName,
  segClassName,
  activeKey,
  options,
}: {
  trackClassName: string;
  segClassName: string;
  activeKey: string;
  options: { key: string; label: string; href?: string; onClick?: () => void }[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [optimisticKey, setOptimisticKey] = useState(activeKey);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => setOptimisticKey(activeKey), [activeKey]);

  useLayoutEffect(() => {
    const active = trackRef.current?.querySelector<HTMLElement>(`[data-seg-key="${optimisticKey}"]`);
    if (active) setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
  }, [optimisticKey]);

  return (
    <div ref={trackRef} className={`relative ${trackClassName}`}>
      {indicator && (
        <span
          className="absolute inset-y-1 rounded-[4px] transition-all duration-200 ease-out"
          style={{ left: indicator.left, width: indicator.width, background: "var(--theme-accent)" }}
        />
      )}
      {options.map((opt) => {
        const isActive = optimisticKey === opt.key;
        const className = `relative z-10 transition-colors duration-200 ${segClassName}`;
        const style = isActive ? activeTextStyle : undefined;
        return opt.href ? (
          <Link key={opt.key} href={opt.href} data-seg-key={opt.key} onClick={() => setOptimisticKey(opt.key)} className={className} style={style}>
            <span className="skew-label">{opt.label}</span>
          </Link>
        ) : (
          <button
            key={opt.key}
            type="button"
            data-seg-key={opt.key}
            onClick={() => {
              setOptimisticKey(opt.key);
              opt.onClick?.();
            }}
            className={className}
            style={style}
          >
            <span className="skew-label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// providersView/staffView are only meaningful for the matching `who` value —
// which of the two sub-views (month, computer-oriented; week, mobile-
// oriented) is currently showing, so its own toggle can highlight the
// active one.
export default function CalendarWhoToggle({
  who,
  anchorDate,
  providersView,
  staffView,
}: {
  who: "providers" | "staff";
  anchorDate: string;
  providersView?: "month" | "week";
  staffView?: "month" | "week";
}) {
  const router = useRouter();

  // Both entry points default by screen width — a computer lands on the
  // full month, a phone lands on the one-week view — checked at click time
  // (not render time) so there's no server/client hydration mismatch. The
  // Month/Week toggle below still lets anyone switch either way once there.
  function isDesktop() {
    return typeof window !== "undefined" && window.innerWidth >= DESKTOP_BREAKPOINT;
  }

  function goToProviders() {
    router.push(
      isDesktop() ? `/calendar/providers/month/${firstOfMonth(anchorDate)}` : `/calendar/providers/week/${weekAnchorFor(anchorDate)}`
    );
  }

  function goToStaff() {
    router.push(isDesktop() ? `/calendar/staff/month/${firstOfMonth(anchorDate)}` : `/calendar/staff/week/${weekAnchorFor(anchorDate)}`);
  }

  // Same size for both pills — Providers/Staff and Month/Week are equally
  // important choices, so one being visibly bigger than the other never
  // made sense.
  const trackClass = "skew-track accent-border border-2 p-1 text-sm font-bold";
  const segClass = "skew-seg px-4 py-2";

  const subView = who === "providers" ? providersView : staffView;
  const subBase = who === "providers" ? "/calendar/providers" : "/calendar/staff";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SlidingPair
        trackClassName={trackClass}
        segClassName={segClass}
        activeKey={who}
        options={[
          { key: "providers", label: "Providers", onClick: goToProviders },
          { key: "staff", label: "Staff", onClick: goToStaff },
        ]}
      />

      <SlidingPair
        trackClassName={trackClass}
        segClassName={segClass}
        activeKey={subView ?? ""}
        options={[
          { key: "month", label: "Month", href: `${subBase}/month/${firstOfMonth(anchorDate)}` },
          { key: "week", label: "Week", href: `${subBase}/week/${weekAnchorFor(anchorDate)}` },
        ]}
      />
    </div>
  );
}
