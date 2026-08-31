"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWhoAmI } from "@/lib/whoami";

const links = [
  { href: "/schedule", label: "Schedule" },
  { href: "/absences", label: "Absences" },
  { href: "/templates", label: "Doctor templates" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { current, setCurrentId } = useWhoAmI();

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold text-slate-800">CFA Ortho Schedule</span>
          <nav className="flex gap-4 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={
                  pathname.startsWith(l.href)
                    ? "font-medium text-blue-700"
                    : "text-slate-500 hover:text-slate-800"
                }
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        {current && (
          <div className="flex items-center gap-2 text-sm">
            <span
              className="flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 font-medium text-white"
              style={{ background: current.color }}
            >
              <span className="h-2 w-2 rounded-full bg-white/70" />
              {current.name}
            </span>
            <button
              onClick={() => setCurrentId(null)}
              className="text-slate-400 hover:text-slate-700 hover:underline"
            >
              Not you?
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
