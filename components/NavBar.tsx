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
  const { staffList, currentId, setCurrentId } = useWhoAmI();

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
        <label className="flex items-center gap-2 text-sm text-slate-600">
          I am:
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={currentId ?? ""}
            onChange={(e) => setCurrentId(e.target.value || null)}
          >
            <option value="">Select your name…</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
