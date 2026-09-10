"use client";

import { useMemo, useRef, useState } from "react";
import { useWhoAmI, type StaffOption } from "@/lib/whoami";
import { buildGridCurves, cellClipPath, COLS, ROWS } from "@/lib/zigzagGrid";

const GROW_MS = 480;
const HOLD_MS = 120;
const FADE_MS = 380;

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
type Cell = { staff: StaffOption; row: number; col: number };

export default function UserPicker() {
  const { staffList, setCurrentId } = useWhoAmI();
  const [phase, setPhase] = useState<Phase>("idle");
  const [picked, setPicked] = useState<StaffOption | null>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [radius, setRadius] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const grow = useTweener();
  const fade = useTweener();

  const curves = useMemo(() => buildGridCurves(), []);

  // Alphabetical, top-to-bottom then left-to-right: first ROWS names fill
  // column 0, next ROWS fill column 1, etc. — except anyone with a
  // pinnedGridIndex, who's fixed at that exact slot; everyone else fills
  // the remaining slots around them, still in alphabetical order.
  const cells: Cell[] = useMemo(() => {
    const sorted = [...staffList].sort((a, b) => a.name.localeCompare(b.name));
    const pinned = sorted.filter((s) => s.pinnedGridIndex !== null);
    const unpinned = sorted.filter((s) => s.pinnedGridIndex === null);

    const slots: (StaffOption | undefined)[] = new Array(sorted.length);
    for (const p of pinned) {
      if (p.pinnedGridIndex! >= 0 && p.pinnedGridIndex! < slots.length) slots[p.pinnedGridIndex!] = p;
    }
    let next = 0;
    for (let i = 0; i < slots.length; i++) {
      if (!slots[i]) slots[i] = unpinned[next++];
    }

    return slots
      .map((staff, i) => (staff ? { staff, row: i % ROWS, col: Math.floor(i / ROWS) } : null))
      .filter((c): c is Cell => c !== null);
  }, [staffList]);

  if (cells.length === 0) {
    return <div className="fixed inset-0 z-50 bg-slate-100" />;
  }

  const maxRadius = () => Math.hypot(window.innerWidth, window.innerHeight) * 1.05;

  function pick(cell: Cell) {
    if (phase !== "idle") return;
    const xCenterPct = ((cell.col + 0.5) / COLS) * 100;
    const yCenterPct = ((cell.row + 0.5) / ROWS) * 100;
    setOrigin({
      x: (xCenterPct / 100) * window.innerWidth,
      y: (yCenterPct / 100) * window.innerHeight,
    });
    setPicked(cell.staff);
    setPhase("grow");
    grow.run(0, maxRadius(), GROW_MS, setRadius, () => {
      setPhase("hold");
      window.setTimeout(() => {
        setPhase("fade");
        fade.run(1, 0, FADE_MS, setOpacity, () => setCurrentId(cell.staff.id));
      }, HOLD_MS);
    });
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none bg-slate-100">
      {phase !== "fade" &&
        cells.map((cell) => (
          <button
            key={cell.staff.id}
            type="button"
            aria-label={`Continue as ${cell.staff.name}`}
            onClick={phase === "idle" ? () => pick(cell) : undefined}
            tabIndex={phase === "idle" ? 0 : -1}
            className="absolute inset-0 h-full w-full"
            style={{
              clipPath: cellClipPath(cell.row, cell.col, curves),
              background: cell.staff.color,
              pointerEvents: phase === "idle" ? "auto" : "none",
            }}
          >
            <span
              className="absolute font-extrabold tracking-tight text-slate-700"
              style={{
                left: `${((cell.col + 0.5) / COLS) * 100}%`,
                top: `${((cell.row + 0.5) / ROWS) * 100}%`,
                transform: "translate(-50%, -50%)",
                fontSize: "clamp(1rem, 2.4vw, 1.5rem)",
                whiteSpace: "nowrap",
              }}
            >
              {cell.staff.name}
            </span>
          </button>
        ))}

      {picked && phase !== "idle" && (
        <div
          className="fixed inset-0"
          style={{
            background: picked.color,
            clipPath: `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
            opacity,
          }}
        />
      )}

      {picked && phase !== "idle" && (
        <span
          className="pointer-events-none absolute font-extrabold tracking-tight text-slate-700"
          style={{
            left: origin.x,
            top: origin.y,
            transform: "translate(-50%, -50%)",
            fontSize: "clamp(1rem, 2.4vw, 1.5rem)",
            whiteSpace: "nowrap",
            opacity,
          }}
        >
          {picked.name}
        </span>
      )}
    </div>
  );
}
