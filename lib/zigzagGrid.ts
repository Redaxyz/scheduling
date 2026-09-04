// Builds clip-path polygons for an N-row x M-col grid that fills its
// container edge-to-edge, with a jagged (torn-paper) seam on every internal
// boundary between cells while the outer edges stay a clean rectangle.
//
// The trick: every internal divider (each vertical seam between columns,
// and each horizontal seam between rows) is a shared zigzag curve. Two cells
// on either side of a seam slice the exact same curve, so they always tile
// with no gaps or overlaps. Points that land on ANOTHER seam (or the outer
// edge) are pinned back to their ideal fraction — otherwise two independently
// wobbling curves would miss each other where they cross.

export const ROWS = 5;
export const COLS = 3;
const TEETH_PER_ROW = 9; // segments per row along each vertical divider
const TEETH_PER_COL = 7; // segments per column along each horizontal divider
const AMP_V = 4; // px, x-wobble of each vertical divider
const AMP_H = 3.5; // px, y-wobble of each horizontal divider

type Pt = [string, string]; // [xExpr, yExpr] as CSS length strings

const pct = (v: number) => `${v}%`;
const wobble = (basePct: number, px: number) => (px === 0 ? pct(basePct) : `calc(${basePct}% + ${px}px)`);

// A single vertical divider (full height) at a given x-fraction, e.g. one of
// the COLS-1 internal seams between columns.
function verticalDividerPoints(colFracPct: number): Pt[] {
  const total = TEETH_PER_ROW * ROWS;
  const pts: Pt[] = [];
  for (let i = 0; i <= total; i++) {
    const y = (i / total) * 100;
    const pinned = i % TEETH_PER_ROW === 0;
    const xExpr = pinned ? pct(colFracPct) : wobble(colFracPct, i % 2 === 0 ? AMP_V : -AMP_V);
    pts.push([xExpr, pct(y)]);
  }
  return pts;
}

function horizontalDividerPoints(rowFracPct: number): Pt[] {
  const total = TEETH_PER_COL * COLS;
  const pts: Pt[] = [];
  for (let j = 0; j <= total; j++) {
    const x = (j / total) * 100;
    const pinned = j % TEETH_PER_COL === 0;
    pts.push([pct(x), pinned ? pct(rowFracPct) : wobble(rowFracPct, j % 2 === 0 ? AMP_H : -AMP_H)]);
  }
  return pts;
}

// vDivs[c] is the vertical seam between column c-1 and column c (c = 1..COLS-1).
// hDivs[r] is the horizontal seam between row r-1 and row r (r = 1..ROWS-1).
export type GridCurves = { vDivs: Pt[][]; hDivs: Pt[][] };

export function buildGridCurves(): GridCurves {
  const vDivs: Pt[][] = [];
  for (let c = 1; c < COLS; c++) {
    vDivs[c] = verticalDividerPoints((c / COLS) * 100);
  }
  const hDivs: Pt[][] = [];
  for (let r = 1; r < ROWS; r++) {
    hDivs[r] = horizontalDividerPoints((r / ROWS) * 100);
  }
  return { vDivs, hDivs };
}

function ptStr([x, y]: Pt) {
  return `${x} ${y}`;
}

/** clip-path polygon() value for the cell at (row r, col c). */
export function cellClipPath(r: number, c: number, { vDivs, hDivs }: GridCurves): string {
  const xStart = (c / COLS) * 100;
  const xEnd = ((c + 1) / COLS) * 100;
  const colStartIdx = c * TEETH_PER_COL;
  const colEndIdx = (c + 1) * TEETH_PER_COL;
  const rowStartIdx = r * TEETH_PER_ROW;
  const rowEndIdx = (r + 1) * TEETH_PER_ROW;

  const top: Pt[] =
    r === 0 ? [[pct(xStart), pct(0)], [pct(xEnd), pct(0)]] : hDivs[r].slice(colStartIdx, colEndIdx + 1);

  const bottomLtoR: Pt[] =
    r === ROWS - 1
      ? [[pct(xStart), pct(100)], [pct(xEnd), pct(100)]]
      : hDivs[r + 1].slice(colStartIdx, colEndIdx + 1);
  const bottom = [...bottomLtoR].reverse();

  const rowStartPct = (r / ROWS) * 100;
  const rowEndPct = ((r + 1) / ROWS) * 100;

  const rightTtoB: Pt[] =
    c === COLS - 1
      ? [[pct(100), pct(rowStartPct)], [pct(100), pct(rowEndPct)]]
      : vDivs[c + 1].slice(rowStartIdx, rowEndIdx + 1);

  const leftTtoB: Pt[] =
    c === 0 ? [[pct(0), pct(rowStartPct)], [pct(0), pct(rowEndPct)]] : vDivs[c].slice(rowStartIdx, rowEndIdx + 1);
  const left = [...leftTtoB].reverse();

  const points = [...top, ...rightTtoB.slice(1), ...bottom.slice(1), ...left.slice(1)];
  return `polygon(${points.map(ptStr).join(",")})`;
}
