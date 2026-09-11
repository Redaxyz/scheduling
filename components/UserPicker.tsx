"use client";

import { useMemo, useRef, useState } from "react";
import { useWhoAmI, type StaffOption } from "@/lib/whoami";
import { useThemeMode } from "@/lib/theme";
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

// Straight from the CAO pin logo. Assigning by (row + col) % length instead
// of per-person means every edge-adjacent pair of cells always lands on a
// different index in the cycle — no two touching tiles ever share a color,
// without needing a real graph-coloring pass for a plain grid.
const CAO_PALETTE = ["#1878b4", "#4fb3e8", "#f5871f", "#333f4c"];
function modernCellColor(row: number, col: number) {
  return CAO_PALETTE[(row + col) % CAO_PALETTE.length];
}

export default function UserPicker() {
  const { staffList, setCurrentId } = useWhoAmI();
  // Nobody's signed in yet at this screen, so there's no `current` to check
  // — but modern is now the default look for everyone anyway, and the raw
  // persisted toggle (true unless a device explicitly opted out) already
  // reflects that regardless of who's mid-pick right now.
  const { modernEnabled: modern } = useThemeMode();
  const [phase, setPhase] = useState<Phase>("idle");
  const [picked, setPicked] = useState<StaffOption | null>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [radius, setRadius] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [pickedColor, setPickedColor] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
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
    return <div className={`fixed inset-0 z-50 ${modern ? "bg-[#0b0f14]" : "bg-slate-100"}`} />;
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
    setPickedColor(modern ? modernCellColor(cell.row, cell.col) : cell.staff.color);
    setPhase("grow");
    grow.run(0, maxRadius(), GROW_MS, setRadius, () => {
      setPhase("hold");
      window.setTimeout(() => {
        setPhase("fade");
        fade.run(1, 0, FADE_MS, setOpacity, () => setCurrentId(cell.staff.id));
      }, HOLD_MS);
    });
  }

  const labelClass = modern
    ? "absolute font-black uppercase tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
    : "absolute font-extrabold tracking-tight text-slate-700";
  const labelStyle = { fontSize: modern ? "clamp(0.7rem, 1.6vw, 1rem)" : "clamp(1rem, 2.4vw, 1.5rem)", whiteSpace: "nowrap" as const };

  return (
    <div className={`fixed inset-0 z-50 overflow-hidden select-none ${modern ? "bg-[#0b0f14]" : "bg-slate-100"}`}>
      {modern && phase === "idle" && (
        <div
          className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 text-lg font-black uppercase tracking-[0.3em] sm:text-xl"
          style={{ backgroundImage: "linear-gradient(135deg, #4fb3e8, #f5871f)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
        >
          CFA Ortho
        </div>
      )}

      {phase !== "fade" &&
        cells.map((cell) => (
          <button
            key={cell.staff.id}
            type="button"
            aria-label={`Continue as ${cell.staff.name}`}
            onClick={phase === "idle" ? () => pick(cell) : undefined}
            onMouseEnter={modern ? () => setHoveredId(cell.staff.id) : undefined}
            onMouseLeave={modern ? () => setHoveredId(null) : undefined}
            tabIndex={phase === "idle" ? 0 : -1}
            className="absolute inset-0 h-full w-full transition duration-200"
            style={{
              clipPath: cellClipPath(cell.row, cell.col, curves),
              background: modern ? modernCellColor(cell.row, cell.col) : cell.staff.color,
              pointerEvents: phase === "idle" ? "auto" : "none",
              opacity: modern && phase === "idle" && hoveredId && hoveredId !== cell.staff.id ? 0.5 : 1,
              filter: modern && hoveredId === cell.staff.id ? "brightness(1.1)" : undefined,
            }}
          >
            <span
              className={labelClass}
              style={{
                left: `${((cell.col + 0.5) / COLS) * 100}%`,
                top: `${((cell.row + 0.5) / ROWS) * 100}%`,
                transform: "translate(-50%, -50%)",
                ...labelStyle,
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
            background: pickedColor,
            clipPath: `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
            opacity,
          }}
        />
      )}

      {picked && phase !== "idle" && (
        <span
          className={`pointer-events-none ${labelClass}`}
          style={{
            left: origin.x,
            top: origin.y,
            transform: "translate(-50%, -50%)",
            ...labelStyle,
            opacity,
          }}
        >
          {picked.name}
        </span>
      )}
    </div>
  );
}
