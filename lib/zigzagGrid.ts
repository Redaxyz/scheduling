// Builds clip-path polygons for the sign-in grid: rows that fill the
// container edge-to-edge, with a jagged (torn-paper) seam on every internal
// boundary between cells while the outer edges stay a clean rectangle.
//
// Rows can have different numbers of columns (ROW_COLS) — e.g. a wider
// middle row. Each horizontal seam is one shared zigzag curve across the
// full width, pinned at every column boundary of the rows above AND below
// it; each vertical seam lives inside a single row and is pinned at that
// row's top and bottom. Two cells on either side of a seam slice the exact
// same points, so they always tile with no gaps or overlaps.

// Columns in each row, top to bottom. 4x4 for 16 people; back to
// [3, 3, 3, 3, 3] once there are 15 again.
export const ROW_COLS = [4, 4, 4, 4];
export const ROWS = ROW_COLS.length;
const MAX_COLS = Math.max(...ROW_COLS);

// Teeth are sized in pixels, the same in both directions, so up-down and
// left-right seams look identical whatever the screen's shape.
const TOOTH_PX = 22; // distance between neighboring points along a seam
const AMP_PX = 4; // how far each point sticks out from the seam line

export type GridSize = { width: number; height: number };

function teeth(lengthPx: number) {
  return Math.max(2, Math.round(lengthPx / TOOTH_PX));
}

type Pt = [string, string]; // [xExpr, yExpr] as CSS length strings
type HPt = { x: number; pt: Pt }; // a horizontal-seam point and its ideal x

const pct = (v: number) => `${v}%`;
const wobble = (basePct: number, px: number) => (px === 0 ? pct(basePct) : `calc(${basePct}% + ${px}px)`);

// Slot index -> (row, col). Column by column, top to bottom (so slots 0-4
// are column 0, 5-9 column 1, ...), skipping rows that don't reach that
// column. Stored pinnedGridIndex values use this numbering.
export const GRID_SLOTS: { row: number; col: number }[] = [];
for (let col = 0; col < MAX_COLS; col++) {
  for (let row = 0; row < ROWS; row++) {
    if (col < ROW_COLS[row]) GRID_SLOTS.push({ row, col });
  }
}

function colBounds(row: number, col: number) {
  return { xStart: (col / ROW_COLS[row]) * 100, xEnd: ((col + 1) / ROW_COLS[row]) * 100 };
}

function rowBounds(row: number) {
  return { yStart: (row / ROWS) * 100, yEnd: ((row + 1) / ROWS) * 100 };
}

export function cellCenterPct(row: number, col: number) {
  const { xStart, xEnd } = colBounds(row, col);
  const { yStart, yEnd } = rowBounds(row);
  return { x: (xStart + xEnd) / 2, y: (yStart + yEnd) / 2, width: xEnd - xStart };
}

// The seam between row r-1 and row r, pinned at both rows' column edges.
function horizontalSeam(r: number, size: GridSize): HPt[] {
  const y = (r / ROWS) * 100;
  const breaks = new Set<number>([0, 100]);
  for (const row of [r - 1, r]) for (let c = 1; c < ROW_COLS[row]; c++) breaks.add((c / ROW_COLS[row]) * 100);
  const sorted = [...breaks].sort((a, b) => a - b);

  const pts: HPt[] = [{ x: 0, pt: [pct(0), pct(y)] }];
  let tooth = 0;
  for (let i = 1; i < sorted.length; i++) {
    const [a, b] = [sorted[i - 1], sorted[i]];
    const n = teeth(((b - a) / 100) * size.width);
    for (let j = 1; j < n; j++) {
      const x = a + ((b - a) * j) / n;
      pts.push({ x, pt: [pct(x), wobble(y, tooth++ % 2 === 0 ? AMP_PX : -AMP_PX)] });
    }
    pts.push({ x: b, pt: [pct(b), pct(y)] });
  }
  return pts;
}

// The seam inside row r at x, pinned at the row's top and bottom.
function verticalSeam(r: number, x: number, size: GridSize): Pt[] {
  const { yStart, yEnd } = rowBounds(r);
  const n = teeth(((yEnd - yStart) / 100) * size.height);
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const y = yStart + ((yEnd - yStart) * i) / n;
    const pinned = i === 0 || i === n;
    pts.push([pinned ? pct(x) : wobble(x, i % 2 === 0 ? AMP_PX : -AMP_PX), pct(y)]);
  }
  return pts;
}

// hSeams[r] is the seam between row r-1 and row r (r = 1..ROWS-1).
// vSeams[r][c] is the seam in row r between column c-1 and column c.
export type GridCurves = { hSeams: HPt[][]; vSeams: Pt[][][] };

// `size` is the grid's on-screen size in pixels (the whole window here).
export function buildGridCurves(size: GridSize): GridCurves {
  const hSeams: HPt[][] = [];
  for (let r = 1; r < ROWS; r++) hSeams[r] = horizontalSeam(r, size);
  const vSeams: Pt[][][] = [];
  for (let r = 0; r < ROWS; r++) {
    vSeams[r] = [];
    for (let c = 1; c < ROW_COLS[r]; c++) vSeams[r][c] = verticalSeam(r, (c / ROW_COLS[r]) * 100, size);
  }
  return { hSeams, vSeams };
}

const EPS = 1e-6;
function slice(seam: HPt[], xStart: number, xEnd: number): Pt[] {
  return seam.filter((p) => p.x >= xStart - EPS && p.x <= xEnd + EPS).map((p) => p.pt);
}

function ptStr([x, y]: Pt) {
  return `${x} ${y}`;
}

/** clip-path polygon() value for the cell at (row r, col c). */
export function cellClipPath(r: number, c: number, { hSeams, vSeams }: GridCurves): string {
  const { xStart, xEnd } = colBounds(r, c);
  const { yStart, yEnd } = rowBounds(r);

  const top: Pt[] = r === 0 ? [[pct(xStart), pct(0)], [pct(xEnd), pct(0)]] : slice(hSeams[r], xStart, xEnd);
  const bottomLtoR: Pt[] = r === ROWS - 1 ? [[pct(xStart), pct(100)], [pct(xEnd), pct(100)]] : slice(hSeams[r + 1], xStart, xEnd);
  const bottom = [...bottomLtoR].reverse();
  const rightTtoB: Pt[] = c === ROW_COLS[r] - 1 ? [[pct(100), pct(yStart)], [pct(100), pct(yEnd)]] : vSeams[r][c + 1];
  const leftTtoB: Pt[] = c === 0 ? [[pct(0), pct(yStart)], [pct(0), pct(yEnd)]] : vSeams[r][c];
  const left = [...leftTtoB].reverse();

  const points = [...top, ...rightTtoB.slice(1), ...bottom.slice(1), ...left.slice(1)];
  return `polygon(${points.map(ptStr).join(",")})`;
}

// Cells that share an edge: same row side by side, or neighboring rows
// whose column spans overlap.
function touching(a: { row: number; col: number }, b: { row: number; col: number }) {
  if (a.row === b.row) return Math.abs(a.col - b.col) === 1;
  if (Math.abs(a.row - b.row) !== 1) return false;
  const A = colBounds(a.row, a.col);
  const B = colBounds(b.row, b.col);
  return Math.min(A.xEnd, B.xEnd) - Math.max(A.xStart, B.xStart) > EPS;
}

// A palette index per cell so no two touching cells match: each takes its
// usual (row + col) color unless a neighbor already has it.
export function gridColorIndexes(paletteSize: number): Map<string, number> {
  const order = [...GRID_SLOTS].sort((a, b) => a.row - b.row || a.col - b.col);
  const colors = new Map<string, number>();
  const key = (s: { row: number; col: number }) => `${s.row}:${s.col}`;
  for (const cell of order) {
    const taken = new Set(order.filter((o) => colors.has(key(o)) && touching(o, cell)).map((o) => colors.get(key(o))!));
    const preferred = (cell.row + cell.col) % paletteSize;
    let pick = preferred;
    for (let i = 0; i < paletteSize && taken.has(pick); i++) pick = (preferred + i + 1) % paletteSize;
    colors.set(key(cell), pick);
  }
  return colors;
}
