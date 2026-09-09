"use client";

import type { ComponentType, CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { firstOfMonth, mondayOf, todayStr } from "@/lib/date";
import { CalendarIcon, ClipboardIcon, QuadrantGridIcon, UserOffIcon } from "@/components/icons";

type IconType = ComponentType<{ className?: string; style?: CSSProperties }>;
type Tab = { key: string; href: string; match: string; label: string; Icon: IconType; primary?: boolean };

export default function BottomNav() {
  const pathname = usePathname();

  const tabs: Tab[] = [
    { key: "absences", href: "/absences", match: "/absences", label: "Absences", Icon: UserOffIcon },
    { key: "schedule", href: `/schedule/${todayStr()}`, match: "/schedule", label: "Schedule", Icon: CalendarIcon, primary: true },
    { key: "calendar", href: `/calendar/month/${firstOfMonth(todayStr())}`, match: "/calendar", label: "Calendar", Icon: QuadrantGridIcon },
    { key: "my-schedule", href: `/my-schedule/${mondayOf(todayStr())}`, match: "/my-schedule", label: "My Schedule", Icon: ClipboardIcon },
  ];

  return (
    <nav
      className="accent-border-soft fixed inset-x-0 bottom-0 z-40 border-t-2 bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-6xl items-start">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.match);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-label={tab.label}
              className={`flex flex-1 flex-col items-center gap-1.5 py-3.5 text-xs font-bold transition-opacity ${
                tab.primary ? "" : active ? "opacity-100" : "opacity-60 hover:opacity-100"
              }`}
            >
              {tab.primary ? (
                <>
                  <span
                    className="-mt-7 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white text-slate-700 shadow-sm"
                    style={{ background: "var(--theme-accent)" }}
                  >
                    <tab.Icon className="h-7 w-7" />
                  </span>
                  <span className="-mt-1">{tab.label}</span>
                </>
              ) : (
                <>
                  <tab.Icon className="h-6 w-6" style={active ? { color: "var(--theme-accent)" } : undefined} />
                  {tab.label}
                  <span
                    className="h-1 w-1 rounded-full"
                    style={{ background: active ? "var(--theme-accent)" : "transparent" }}
                  />
                </>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
