"use client";

import { useRef, useState } from "react";
import { useWhoAmI, type StaffOption } from "@/lib/whoami";

const GROW_MS = 480;
const HOLD_MS = 120;
const FADE_MS = 380;

const KIND_LABELS: Record<string, string> = {
  SCRIBE: "Scribe",
  GENERAL: "General",
  XRAY: "X-ray",
};

const KIND_ORDER = ["SCRIBE", "GENERAL", "XRAY"];

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function useTweener() {
  const rafRef = useRef<number | null>(null);
  const run = (from: number, to: number, duration: number, onUpdate: (v: number) => void, onDone?: () => void) => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      onUpdate(from + (to - from) * easeInOutCubic(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        onDone?.();
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };
  return { run };
}

type Phase = "idle" | "grow" | "hold" | "fade";

export default function UserPicker() {
  const { staffList, setCurrentId } = useWhoAmI();
  const [phase, setPhase] = useState<Phase>("idle");
  const [picked, setPicked] = useState<StaffOption | null>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [radius, setRadius] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const grow = useTweener();
  const fade = useTweener();

  if (staffList.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100 text-slate-400">
        Loading staff…
      </div>
    );
  }

  const maxRadius = () => Math.hypot(window.innerWidth, window.innerHeight) * 1.05;

  function pick(staff: StaffOption, e: React.MouseEvent<HTMLButtonElement>) {
    if (phase !== "idle") return;
    const rect = e.currentTarget.getBoundingClientRect();
    setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setPicked(staff);
    setPhase("grow");
    grow.run(0, maxRadius(), GROW_MS, setRadius, () => {
      setPhase("hold");
      window.setTimeout(() => {
        setPhase("fade");
        fade.run(1, 0, FADE_MS, setOpacity, () => setCurrentId(staff.id));
      }, HOLD_MS);
    });
  }

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    members: staffList.filter((s) => s.kind === kind),
  })).filter((g) => g.members.length > 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none bg-slate-100">
      {phase === "idle" && (
        <div className="flex h-full flex-col items-center justify-center gap-8 overflow-y-auto px-6 py-10">
          <h1 className="text-2xl font-bold text-slate-700">Who are you?</h1>
          <div className="flex w-full max-w-3xl flex-col gap-6">
            {groups.map((g) => (
              <div key={g.kind}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {KIND_LABELS[g.kind] ?? g.kind}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {g.members.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={(e) => pick(s, e)}
                      className="flex h-24 flex-col items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
                      style={{ background: s.color }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {picked && phase !== "idle" && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{
            background: picked.color,
            clipPath: `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
            opacity,
          }}
        >
          <span className="text-5xl font-extrabold text-white sm:text-6xl">{picked.name}</span>
        </div>
      )}
    </div>
  );
}
