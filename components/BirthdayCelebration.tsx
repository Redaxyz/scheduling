"use client";

import { useEffect, useMemo, useState } from "react";
import { useWhoAmI } from "@/lib/whoami";
import { useCelebrationDate } from "@/components/HolidayProvider";
import { CONFETTI, isBirthday } from "@/lib/birthdays";

// On your own birthday (lib/birthdays.ts): confetti behind the whole app
// (html[data-birthday], see globals.css) and, once per visit, a shower of
// confetti falling down the screen. Nobody else sees any of this; they get
// the 🎂 by your name instead.
export default function BirthdayCelebration() {
  const { current } = useWhoAmI();
  const date = useCelebrationDate();
  const on = Boolean(current && isBirthday(current.name, date));
  const [shower, setShower] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (on) {
      root.dataset.birthday = "";
      root.style.setProperty("--bday-pattern", CONFETTI);
    } else {
      delete root.dataset.birthday;
      root.style.removeProperty("--bday-pattern");
    }
  }, [on]);

  useEffect(() => {
    if (!on || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const key = `birthday-shower-${date}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {}
    setShower(true);
    const done = window.setTimeout(() => setShower(false), 5000);
    return () => window.clearTimeout(done);
  }, [on, date]);

  return shower ? <ConfettiShower /> : null;
}

const SHOWER_COLORS = ["#ec4899", "#3b82f6", "#facc15", "#22c55e", "#a855f7", "#f97316"];

function ConfettiShower() {
  // Made once, in the browser only (it never renders on the server).
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.6,
        duration: 2.6 + Math.random() * 1.8,
        spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540),
        color: SHOWER_COLORS[i % SHOWER_COLORS.length],
        round: i % 4 === 0,
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.round ? 7 : 6,
            height: p.round ? 7 : 11,
            borderRadius: p.round ? 999 : 2,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--spin" as string]: `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}
