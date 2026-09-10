"use client";

import { useWhoAmI } from "@/lib/whoami";

export default function NavBar() {
  const { current, setCurrentId } = useWhoAmI();

  return (
    <header className="accent-border-soft border-b-2">
      <div className="relative mx-auto flex max-w-6xl items-center justify-center px-4 py-2">
        <span className="text-base font-extrabold tracking-tight">CFA Ortho Schedule</span>
        {current && (
          <button
            type="button"
            onClick={() => setCurrentId(null)}
            aria-label="Switch person"
            title="Not you? Tap to switch"
            className="absolute right-4 flex items-center gap-1.5 text-sm font-bold opacity-70 transition-opacity hover:opacity-100"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: current.color }} />
            {current.name}
          </button>
        )}
      </div>
    </header>
  );
}
