import Link from "next/link";
import { firstOfMonth, mondayOf } from "@/lib/date";

export default function CalendarViewToggle({ mode, anchorDate }: { mode: "week" | "month"; anchorDate: string }) {
  const weekHref = `/calendar/week/${mondayOf(anchorDate)}`;
  const monthHref = `/calendar/month/${firstOfMonth(anchorDate)}`;

  return (
    <div className="accent-border inline-flex rounded-full border-2 p-0.5 text-sm font-bold">
      <Link
        href={weekHref}
        className="rounded-full px-3 py-1"
        style={mode === "week" ? { background: "var(--theme-accent)", color: "#334155" } : undefined}
      >
        Week
      </Link>
      <Link
        href={monthHref}
        className="rounded-full px-3 py-1"
        style={mode === "month" ? { background: "var(--theme-accent)", color: "#334155" } : undefined}
      >
        Month
      </Link>
    </div>
  );
}
