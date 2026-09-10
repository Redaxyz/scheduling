"use client";

import { useEffect, useState, type ComponentType, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { firstOfMonth, mondayOf, todayStr } from "@/lib/date";
import { CalendarIcon, ClipboardIcon, QuadrantGridIcon, UserOffIcon } from "@/components/icons";
import { useWhoAmI } from "@/lib/whoami";
import type { SwapRequestView } from "@/lib/swap";

const INCOMING_SWAP_POLL_MS = 15000;

type IconType = ComponentType<{ className?: string; style?: CSSProperties }>;
type Tab = { key: string; href: string; match: string; label: string; Icon: IconType; primary?: boolean; badge?: number };

export default function BottomNav() {
  const pathname = usePathname();
  const { current } = useWhoAmI();
  const [incoming, setIncoming] = useState<SwapRequestView[]>([]);

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

  const scheduleHref = incoming.length > 0 ? `/schedule/${incoming[0].date}` : `/schedule/${todayStr()}`;

  const tabs: Tab[] = [
    { key: "absences", href: "/absences", match: "/absences", label: "Absences", Icon: UserOffIcon },
    { key: "schedule", href: scheduleHref, match: "/schedule", label: "Schedule", Icon: CalendarIcon, primary: true, badge: incoming.length },
    { key: "calendar", href: `/calendar/providers/month/${firstOfMonth(todayStr())}`, match: "/calendar", label: "Calendar", Icon: QuadrantGridIcon },
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
                  <span className="relative -mt-7">
                    <span
                      className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white text-slate-700 shadow-sm"
                      style={{ background: "var(--theme-accent)" }}
                    >
                      <tab.Icon className="h-7 w-7" />
                    </span>
                    {Boolean(tab.badge) && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-extrabold text-white">
                        {tab.badge}
                      </span>
                    )}
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
