import Link from "next/link";
import { firstOfMonth } from "@/lib/date";

export default function CalendarWhoToggle({ who, anchorDate }: { who: "providers" | "staff"; anchorDate: string }) {
  const providersHref = `/calendar/month/${firstOfMonth(anchorDate)}`;
  const staffHref = `/calendar/staff/${firstOfMonth(anchorDate)}`;

  return (
    <div className="accent-border inline-flex rounded-full border-2 p-0.5 text-sm font-bold">
      <Link
        href={providersHref}
        className="rounded-full px-3 py-1"
        style={who === "providers" ? { background: "var(--theme-accent)", color: "#334155" } : undefined}
      >
        Providers
      </Link>
      <Link
        href={staffHref}
        className="rounded-full px-3 py-1"
        style={who === "staff" ? { background: "var(--theme-accent)", color: "#334155" } : undefined}
      >
        Staff
      </Link>
    </div>
  );
}
