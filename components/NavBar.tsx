"use client";

import { useWhoAmI } from "@/lib/whoami";

export default function NavBar() {
  const { current } = useWhoAmI();

  return (
    <header className="accent-border-soft border-b-2">
      <div className="relative mx-auto flex max-w-6xl items-center justify-center px-4 py-4">
        <span className="text-xl font-extrabold tracking-tight">CFA Ortho Schedule</span>
        {current && (
          <span className="absolute right-4 flex items-center gap-1.5 text-sm font-bold opacity-70">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: current.color }} />
            {current.name}
          </span>
        )}
      </div>
    </header>
  );
}
