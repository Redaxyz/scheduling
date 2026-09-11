"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { firstOfMonth, mondayOf, mondayOnOrAfter, todayStr } from "@/lib/date";
import { useThemeMode } from "@/lib/theme";

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
  if (anchorDate === firstOfMonth(todayStr())) return mondayOf(todayStr());
  return mondayOnOrAfter(anchorDate);
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
  const { active: modern } = useThemeMode();

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

  const activeStyle = modern
    ? { background: "linear-gradient(135deg, var(--cao-blue,#1878b4), var(--cao-blue-light,#4fb3e8))", color: "#fff" }
    : { background: "var(--theme-accent)", color: "#334155" };
  const inactiveStyle = modern ? { color: "#64748b" } : undefined;

  const trackClass = modern
    ? "inline-flex rounded-full bg-black/[0.04] p-0.5 text-sm font-bold"
    : "accent-border inline-flex rounded-full border-2 p-0.5 text-sm font-bold";
  const subTrackClass = modern
    ? "inline-flex rounded-full bg-black/[0.04] p-0.5 text-xs font-bold"
    : "accent-border inline-flex rounded-full border-2 p-0.5 text-xs font-bold opacity-80";
  const segClass = `rounded-full px-3 py-1${modern ? " transition" : ""}`;
  const subSegClass = `rounded-full px-2.5 py-1${modern ? " transition" : ""}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className={trackClass}>
        <button
          type="button"
          onClick={goToProviders}
          className={segClass}
          style={who === "providers" ? activeStyle : inactiveStyle}
        >
          Providers
        </button>
        <button type="button" onClick={goToStaff} className={segClass} style={who === "staff" ? activeStyle : inactiveStyle}>
          Staff
        </button>
      </div>

      {who === "providers" && (
        <div className={subTrackClass}>
          <Link
            href={`/calendar/providers/month/${firstOfMonth(anchorDate)}`}
            className={subSegClass}
            style={providersView === "month" ? activeStyle : inactiveStyle}
          >
            Month
          </Link>
          <Link
            href={`/calendar/providers/week/${weekAnchorFor(anchorDate)}`}
            className={subSegClass}
            style={providersView === "week" ? activeStyle : inactiveStyle}
          >
            Week
          </Link>
        </div>
      )}

      {who === "staff" && (
        <div className={subTrackClass}>
          <Link
            href={`/calendar/staff/month/${firstOfMonth(anchorDate)}`}
            className={subSegClass}
            style={staffView === "month" ? activeStyle : inactiveStyle}
          >
            Month
          </Link>
          <Link
            href={`/calendar/staff/week/${weekAnchorFor(anchorDate)}`}
            className={subSegClass}
            style={staffView === "week" ? activeStyle : inactiveStyle}
          >
            Week
          </Link>
        </div>
      )}
    </div>
  );
}
