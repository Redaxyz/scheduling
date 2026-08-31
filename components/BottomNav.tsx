"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWhoAmI } from "@/lib/whoami";
import { todayStr } from "@/lib/date";
import { CalendarIcon, QuadrantGridIcon, SwitchProfileIcon, UserOffIcon } from "@/components/icons";
import { mondayOf } from "@/lib/date";

type IconType = ComponentType<{ className?: string }>;
type Tab = { key: string; href: string; match: string; label: string; Icon: IconType; primary?: boolean };

export default function BottomNav() {
  const pathname = usePathname();
  const { setCurrentId } = useWhoAmI();

  const tabs: Tab[] = [
    { key: "absences", href: "/absences", match: "/absences", label: "Absences", Icon: UserOffIcon },
    { key: "schedule", href: `/schedule/${todayStr()}`, match: "/schedule", label: "Schedule", Icon: CalendarIcon, primary: true },
    { key: "calendar", href: `/calendar/week/${mondayOf(todayStr())}`, match: "/calendar", label: "Calendar", Icon: QuadrantGridIcon },
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
                  <tab.Icon className="h-6 w-6" />
                  {tab.label}
                </>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setCurrentId(null)}
          aria-label="Switch person"
          className="flex flex-1 flex-col items-center gap-1.5 py-3.5 text-xs font-bold opacity-60 transition-opacity hover:opacity-100"
        >
          <SwitchProfileIcon className="h-6 w-6" />
          Switch
        </button>
      </div>
    </nav>
  );
}
