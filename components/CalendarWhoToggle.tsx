"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { firstOfMonth, mondayOf } from "@/lib/date";

// Matches Tailwind's `lg` breakpoint — the same width each grid's own
// column layout switches on.
const DESKTOP_BREAKPOINT = 1024;

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
      isDesktop() ? `/calendar/providers/month/${firstOfMonth(anchorDate)}` : `/calendar/providers/week/${mondayOf(anchorDate)}`
    );
  }

  function goToStaff() {
    router.push(isDesktop() ? `/calendar/staff/month/${firstOfMonth(anchorDate)}` : `/calendar/staff/week/${mondayOf(anchorDate)}`);
  }

  const activeStyle = { background: "var(--theme-accent)", color: "#334155" };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="accent-border inline-flex rounded-full border-2 p-0.5 text-sm font-bold">
        <button type="button" onClick={goToProviders} className="rounded-full px-3 py-1" style={who === "providers" ? activeStyle : undefined}>
          Providers
        </button>
        <button type="button" onClick={goToStaff} className="rounded-full px-3 py-1" style={who === "staff" ? activeStyle : undefined}>
          Staff
        </button>
      </div>

      {who === "providers" && (
        <div className="accent-border inline-flex rounded-full border-2 p-0.5 text-xs font-bold opacity-80">
          <Link
            href={`/calendar/providers/month/${firstOfMonth(anchorDate)}`}
            className="rounded-full px-2.5 py-1"
            style={providersView === "month" ? activeStyle : undefined}
          >
            Month
          </Link>
          <Link
            href={`/calendar/providers/week/${mondayOf(anchorDate)}`}
            className="rounded-full px-2.5 py-1"
            style={providersView === "week" ? activeStyle : undefined}
          >
            Week
          </Link>
        </div>
      )}

      {who === "staff" && (
        <div className="accent-border inline-flex rounded-full border-2 p-0.5 text-xs font-bold opacity-80">
          <Link
            href={`/calendar/staff/month/${firstOfMonth(anchorDate)}`}
            className="rounded-full px-2.5 py-1"
            style={staffView === "month" ? activeStyle : undefined}
          >
            Month
          </Link>
          <Link
            href={`/calendar/staff/week/${mondayOf(anchorDate)}`}
            className="rounded-full px-2.5 py-1"
            style={staffView === "week" ? activeStyle : undefined}
          >
            Week
          </Link>
        </div>
      )}
    </div>
  );
}
