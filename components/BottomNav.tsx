"use client";

import { useEffect, useState, type ComponentType, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { effectiveMonday, effectiveScheduleDate, firstOfMonth } from "@/lib/date";
import { CalendarIcon, ClipboardIcon, HomeIcon } from "@/components/icons";
import { useWhoAmI } from "@/lib/whoami";
import type { SwapRequestView } from "@/lib/swap";

const INCOMING_SWAP_POLL_MS = 15000;

type IconType = ComponentType<{ className?: string; style?: CSSProperties }>;
type Tab = { key: string; href: string; match: string; label: string; Icon: IconType; primary?: boolean; badge?: number };

export default function BottomNav() {
  const pathname = usePathname();
  const { current, setCurrentId } = useWhoAmI();
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

  const scheduleHref = incoming.length > 0 ? `/schedule/${incoming[0].date}` : `/schedule/${effectiveScheduleDate()}`;

  const tabs: Tab[] = [
    { key: "schedule", href: `/calendar/staff/month/${firstOfMonth(effectiveScheduleDate())}`, match: "/calendar", label: "Schedule", Icon: CalendarIcon },
    { key: "home", href: scheduleHref, match: "/schedule", label: "Home", Icon: HomeIcon, primary: true, badge: incoming.length },
    { key: "me", href: `/my-schedule/${effectiveMonday()}`, match: "/my-schedule", label: "Me", Icon: ClipboardIcon },
  ];

  return (
    <nav
      id="bottom-nav"
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
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs font-bold transition-opacity ${
                tab.primary ? "" : active ? "opacity-100" : "opacity-60 hover:opacity-100"
              }`}
            >
              {tab.primary ? (
                <>
                  <span className="relative -mt-4">
                    <span
                      id="bottom-nav-raised"
                      className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white text-slate-700 shadow-sm"
                      style={{ background: "var(--theme-accent)" }}
                    >
                      <tab.Icon className="h-5 w-5" />
                    </span>
                    {Boolean(tab.badge) && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-extrabold text-white">
                        {tab.badge}
                      </span>
                    )}
                  </span>
                  <span>{tab.label}</span>
                </>
              ) : (
                <>
                  <tab.Icon className="h-5 w-5" style={active ? { color: "var(--theme-accent)" } : undefined} />
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
            className="flex flex-1 flex-col items-center gap-1 py-2 text-xs font-bold opacity-60 transition-opacity hover:opacity-100"
          >
            <span className="flex h-5 w-5 items-center justify-center">
              <span className="h-3 w-3 rounded-full" style={{ background: current.color }} />
            </span>
            <span className="max-w-[4.5rem] truncate">{current.name}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
