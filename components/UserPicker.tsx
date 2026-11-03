"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { useWhoAmI, type StaffOption } from "@/lib/whoami";
import { buildGridCurves, cellCenterPct, cellClipPath, GRID_SLOTS, gridColorIndexes } from "@/lib/zigzagGrid";

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

// Straight from the CAO pin logo. Colored by position, not per person, and
// arranged so no two touching tiles ever share a color (see gridColorIndexes).
const CAO_PALETTE = ["#1878b4", "#4fb3e8", "#f5871f", "#333f4c"];
const CELL_COLORS = gridColorIndexes(CAO_PALETTE.length);
function modernCellColor(row: number, col: number) {
  return CAO_PALETTE[CELL_COLORS.get(`${row}:${col}`) ?? 0];
}

export default function UserPicker() {
  const { staffList, setCurrentId } = useWhoAmI();
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

  // Alphabetical, slot by slot in GRID_SLOTS order (column 0 top to
  // bottom, then column 1, ...) — except anyone with a
  // pinnedGridIndex, who's fixed at that exact slot; everyone else fills
  // the remaining slots around them, still in alphabetical order.
  const cells: Cell[] = useMemo(() => {
    const sorted = [...staffList].sort((a, b) => a.name.localeCompare(b.name));
    const pinned = sorted.filter((s) => s.pinnedGridIndex !== null);
    const unpinned = sorted.filter((s) => s.pinnedGridIndex === null);

    // One slot per grid cell. Anyone past the last cell isn't shown, so
    // change ROW_COLS in lib/zigzagGrid.ts whenever the headcount changes.
    const slots: (StaffOption | undefined)[] = new Array(GRID_SLOTS.length);
    for (const p of pinned) {
      if (p.pinnedGridIndex! >= 0 && p.pinnedGridIndex! < slots.length) slots[p.pinnedGridIndex!] = p;
    }
    let next = 0;
    for (let i = 0; i < slots.length && next < unpinned.length; i++) {
      if (!slots[i]) slots[i] = unpinned[next++];
    }

    return slots
      .map((staff, i) => (staff ? { staff, ...GRID_SLOTS[i] } : null))
      .filter((c): c is Cell => c !== null);
  }, [staffList]);

  if (cells.length === 0) {
    return <div className="fixed inset-0 z-50 bg-[#0b0f14]" />;
  }

  const maxRadius = () => Math.hypot(window.innerWidth, window.innerHeight) * 1.05;

  function pick(cell: Cell) {
    if (phase !== "idle") return;
    const center = cellCenterPct(cell.row, cell.col);
    setOrigin({
      x: (center.x / 100) * window.innerWidth,
      y: (center.y / 100) * window.innerHeight,
    });
    setPicked(cell.staff);
    setPickedColor(modernCellColor(cell.row, cell.col));
    setPhase("grow");
    grow.run(0, maxRadius(), GROW_MS, setRadius, () => {
      setPhase("hold");
      window.setTimeout(() => {
        setPhase("fade");
        fade.run(1, 0, FADE_MS, setOpacity, () => setCurrentId(cell.staff.id));
      }, HOLD_MS);
    });
  }

  const labelClass = "absolute font-black uppercase tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]";
  const labelStyle = { fontSize: "clamp(0.7rem, 1.6vw, 1rem)", whiteSpace: "nowrap" as const };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none bg-[#0b0f14]">
      {phase === "idle" && (
        <div
          className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 text-lg font-black uppercase tracking-[0.3em] sm:text-xl"
          style={{ backgroundImage: "linear-gradient(135deg, #4fb3e8, #f5871f)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
        >
          CFA Ortho
        </div>
      )}

      {phase !== "fade" &&
        cells.map((cell) => {
          const center = cellCenterPct(cell.row, cell.col);
          return (
          <button
            key={cell.staff.id}
            type="button"
            aria-label={`Continue as ${cell.staff.name}`}
            onClick={phase === "idle" ? () => pick(cell) : undefined}
            onMouseEnter={() => setHoveredId(cell.staff.id)}
            onMouseLeave={() => setHoveredId(null)}
            tabIndex={phase === "idle" ? 0 : -1}
            className="absolute inset-0 h-full w-full transition duration-200"
            style={{
              clipPath: cellClipPath(cell.row, cell.col, curves),
              background: modernCellColor(cell.row, cell.col),
              pointerEvents: phase === "idle" ? "auto" : "none",
              opacity: phase === "idle" && hoveredId && hoveredId !== cell.staff.id ? 0.5 : 1,
              filter: hoveredId === cell.staff.id ? "brightness(1.1)" : undefined,
            }}
          >
            <span
              className={labelClass}
              style={{
                left: `${center.x}%`,
                top: `${center.y}%`,
                transform: "translate(-50%, -50%)",
                ...labelStyle,
                // A long name (e.g. "Jessica, PA-C") wraps inside its own
                // tile on a narrow phone instead of spilling into the next.
                whiteSpace: "normal",
                textAlign: "center",
                width: "max-content",
                maxWidth: `calc(${center.width}vw - 12px)`,
              }}
            >
              {/* Only ever break after a comma, never inside "PA-C". */}
              {cell.staff.name.split(", ").map((part, i, parts) => (
                <Fragment key={i}>
                  <span className="whitespace-nowrap">
                    {part}
                    {i < parts.length - 1 && ","}
                  </span>
                  {i < parts.length - 1 && " "}
                </Fragment>
              ))}
            </span>
          </button>
          );
        })}

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
