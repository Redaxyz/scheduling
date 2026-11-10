"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { addDays, calendarMonthOf, effectiveMonday, effectiveScheduleDate, weekdayIndex } from "@/lib/date";

// Matches Tailwind's `lg` breakpoint — the same width each grid's own
// column layout switches on.
const DESKTOP_BREAKPOINT = 1024;

// A week link's anchor is either an actual Monday already (coming from a
// week page — used as-is) or a month's 1st (coming from a month page).
// From the CURRENT month, Week goes to the current week; from any other
// month, to the first week of that month's view — the week of its first
// Friday (see calendarMonthOf), which can start in the previous month.
export function weekAnchorFor(anchorDate: string): string {
  if (anchorDate === calendarMonthOf(effectiveScheduleDate())) return effectiveMonday();
  if (weekdayIndex(anchorDate) === 0) return anchorDate;
  // A month's 1st: the first week of that month's view (see calendarMonthOf),
  // which may start in the previous month (Nov 30 opens December).
  let friday = anchorDate;
  while (weekdayIndex(friday) !== 4) friday = addDays(friday, 1);
  return addDays(friday, -4);
}

const activeTextStyle = { color: "#334155" };

// "Month"/"Week" on a computer, just "M"/"W" on a phone so the switch fits
// on the same row as Providers/Staff.
function ShortLabel({ full, short }: { full: string; short: string }) {
  return (
    <>
      <span className="phone:hidden">{full}</span>
      <span className="hidden phone:inline">{short}</span>
    </>
  );
}

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
  options: { key: string; label: ReactNode; href?: string; onClick?: () => void }[];
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
          // Blended with white so the dark label on top stays readable
          // even when the accent is a deep blue or navy.
          style={{ left: indicator.left, width: indicator.width, background: "color-mix(in srgb, var(--theme-accent) 35%, white)" }}
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

  const subView = who === "providers" ? providersView : staffView;
  const subBase = who === "providers" ? "/calendar/providers" : "/calendar/staff";

  // Switching between Providers/Staff keeps whatever granularity (month or
  // week) you're already looking at — only a brand-new visit (this toggle
  // not rendered yet, so no subView to read) falls back to guessing from
  // screen width. The footer's own Schedule tab link is what starts a visit
  // on staff+week; this toggle should never second-guess it.
  const useWeek = subView === "week" || (subView === undefined && !isDesktop());

  function goToProviders() {
    router.push(useWeek ? `/calendar/providers/week/${weekAnchorFor(anchorDate)}` : `/calendar/providers/month/${monthFor(anchorDate)}`);
  }

  function goToStaff() {
    router.push(useWeek ? `/calendar/staff/week/${weekAnchorFor(anchorDate)}` : `/calendar/staff/month/${monthFor(anchorDate)}`);
  }

  // Same size for both pills — Providers/Staff and Month/Week are equally
  // important choices, so one being visibly bigger than the other never
  // made sense.
  const trackClass = "skew-track accent-border border-2 p-1 text-sm font-bold";
  const segClass = "skew-seg px-3 py-2 lg:px-4";

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

      {/* Hidden on tablets/narrow windows (which get bounced to week view,
          see MobileWeekRedirect), but shown on phones as a compact W/M
          switch beside Providers/Staff, and on the unfolded iPhone Duo. */}
      <div className="max-lg:hidden phone:!block unfolded:!block">
      <SlidingPair
        trackClassName={trackClass}
        segClassName={segClass}
        activeKey={subView ?? ""}
        options={[
          { key: "month", label: <ShortLabel full="Month" short="M" />, href: `${subBase}/month/${monthFor(anchorDate)}` },
          { key: "week", label: <ShortLabel full="Week" short="W" />, href: `${subBase}/week/${weekAnchorFor(anchorDate)}` },
        ]}
      />
      </div>
    </div>
  );
}

// The month view to switch to: a month page's own anchor (its 1st) as-is,
// or for a week, the month that week belongs to (that of its Friday).
function monthFor(anchorDate: string): string {
  return anchorDate.endsWith("-01") ? anchorDate : calendarMonthOf(anchorDate);
}
