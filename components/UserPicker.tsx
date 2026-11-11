"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWhoAmI, type StaffOption } from "@/lib/whoami";
import { buildGridCurves, cellCenterPct, cellClipPath } from "@/lib/zigzagGrid";
import { layoutSigninCells, signinLayout, tileColor, type SigninCell } from "@/lib/signinGrid";

// Names fill at most this share of their tile's width (the longest name
// sets the size for all of them).
const LABEL_WIDTH_SHARE = 0.8;
// ...but never bigger than this, so names stay sensible on a big screen.
const MAX_LABEL_PX = 25;
const MEASURE_PX = 100;
const LABEL_TYPE = "font-black uppercase tracking-wide";

const PICKER_BG = "#0b0f14";

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
type Cell = SigninCell;

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

  // The grid fills the window; seams are rebuilt for its real pixel size so
  // teeth stay the same size both ways (see lib/zigzagGrid.ts).
  const [gridSize, setGridSize] = useState({ width: 1280, height: 800 });
  const layout = useMemo(() => signinLayout(staffList), [staffList]);
  const { grid } = layout;
  const curves = useMemo(() => buildGridCurves(grid, gridSize), [grid, gridSize]);

  // Who's in which tile: see lib/signinGrid.ts.
  const cells: Cell[] = useMemo(() => layoutSigninCells(staffList), [staffList]);
  const cellColor = (cell: Cell) => tileColor(layout, cell.row, cell.col);

  // One font size for every name: the biggest at which each name fits in
  // 80% of its own tile's width (and half its height). Measured from hidden
  // copies of the labels rendered at 100px, since letter widths vary.
  const measureRef = useRef<HTMLDivElement>(null);
  const [fontPx, setFontPx] = useState<number | null>(null);
  useLayoutEffect(() => {
    function fit() {
      const spans = measureRef.current ? ([...measureRef.current.children] as HTMLElement[]) : [];
      let size = Infinity;
      spans.forEach((el, i) => {
        const cell = cells[i];
        const width100 = el.getBoundingClientRect().width;
        if (!cell || !width100) return;
        const tileWidth = (window.innerWidth * cellCenterPct(grid, cell.row, cell.col).width) / 100;
        size = Math.min(size, (LABEL_WIDTH_SHARE * tileWidth * MEASURE_PX) / width100);
      });
      size = Math.min(size, (window.innerHeight / grid.rows) * 0.5, MAX_LABEL_PX);
      if (Number.isFinite(size)) setFontPx(Math.floor(size));
      setGridSize((prev) =>
        prev.width === window.innerWidth && prev.height === window.innerHeight ? prev : { width: window.innerWidth, height: window.innerHeight },
      );
    }
    fit();
    document.fonts?.ready.then(fit).catch(() => {});
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [cells, grid]);

  // While the picker is up the page's own background is its near-black, not
  // the app's cream: in some orientations the iPhone Duo keeps a band along
  // the top that the page can't draw in, and fills it with this color.
  useEffect(() => {
    const body = document.body;
    const previous = body.style.backgroundColor;
    body.style.backgroundColor = PICKER_BG;
    return () => {
      body.style.backgroundColor = previous;
    };
  }, []);

  if (cells.length === 0) {
    return <div className="fixed inset-0 z-50 bg-[#0b0f14]" />;
  }

  const maxRadius = () => Math.hypot(window.innerWidth, window.innerHeight) * 1.05;

  function pick(cell: Cell) {
    if (phase !== "idle") return;
    const center = cellCenterPct(grid, cell.row, cell.col);
    setOrigin({
      x: (center.x / 100) * window.innerWidth,
      y: (center.y / 100) * window.innerHeight,
    });
    setPicked(cell.staff);
    setPickedColor(cellColor(cell));
    setPhase("grow");
    grow.run(0, maxRadius(), GROW_MS, setRadius, () => {
      setPhase("hold");
      window.setTimeout(() => {
        setPhase("fade");
        fade.run(1, 0, FADE_MS, setOpacity, () => setCurrentId(cell.staff.id));
      }, HOLD_MS);
    });
  }

  const labelClass = `absolute ${LABEL_TYPE} text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]`;
  const labelStyle = {
    fontSize: fontPx ?? "clamp(0.7rem, 1.6vw, 1rem)",
    lineHeight: 1,
    whiteSpace: "nowrap" as const,
    // Hidden until measured, so names don't flash small then jump big.
    visibility: fontPx == null ? ("hidden" as const) : undefined,
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none bg-[#0b0f14]">
      <div ref={measureRef} aria-hidden className="pointer-events-none invisible fixed left-0 top-0">
        {cells.map((cell) => (
          <span key={cell.staff.id} className={`block w-max ${LABEL_TYPE}`} style={{ fontSize: MEASURE_PX, lineHeight: 1, whiteSpace: "nowrap" }}>
            {cell.staff.name}
          </span>
        ))}
      </div>
      {phase === "idle" && (
        <div
          className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 whitespace-nowrap text-lg font-black uppercase tracking-[0.3em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)] sm:text-xl"
        >
          MOS Schedule
        </div>
      )}

      {phase !== "fade" &&
        cells.map((cell) => {
          const center = cellCenterPct(grid, cell.row, cell.col);
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
              clipPath: cellClipPath(grid, cell.row, cell.col, curves),
              background: cellColor(cell),
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
              }}
            >
              {cell.staff.name}
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
