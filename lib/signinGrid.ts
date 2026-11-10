import type { StaffOption } from "./whoami";
import { makeGrid, gridColorIndexes, type Grid } from "./zigzagGrid";

// Who sits in which sign-in tile, and each tile's color. Shared by the
// picker itself and ThemeAccent, so a person's app accent always matches
// the tile they tapped.

export type SigninCell = { staff: StaffOption; row: number; col: number };

// Straight from the CAO pin logo. Colored by position, not per person, and
// arranged so no two touching tiles ever share a color (see gridColorIndexes).
const CAO_PALETTE = ["#1878b4", "#4fb3e8", "#f5871f", "#333f4c"];

// 4x4 while there are 16 people, using each person's stored pinnedGridIndex.
// At 15 (JB's last day is Nov 13, 2026) it goes back to the earlier 5 rows of
// 3, with Isabel in JB's old spot; those spots live here rather than in the
// database, so the switch needs nobody to edit data on the day.
type Layout = { grid: Grid; colors: Map<string, number>; pins?: Record<string, number> };
function layout(rowCols: number[], pins?: Record<string, number>): Layout {
  const grid = makeGrid(rowCols);
  return { grid, colors: gridColorIndexes(grid, CAO_PALETTE.length), pins };
}
const FOUR_BY_FOUR = layout([4, 4, 4, 4]);
const FIVE_BY_THREE = layout([3, 3, 3, 3, 3], {
  // Anna, Ben, Emma / Hope, Jen, Reda / Brian, Joanna, Jessica /
  // Cindy, Charlie, Isabel / Shelby, Mark, Jenish
  Anna: 0, Hope: 1, Brian: 2, Cindy: 3, Shelby: 4,
  Ben: 5, Jen: 6, Joanna: 7, Charlie: 8, Mark: 9,
  Emma: 10, Reda: 11, Jessica: 12, Isabel: 13, Jenish: 14,
});

export function signinLayout(staffList: StaffOption[]): Layout {
  return staffList.length <= 15 ? FIVE_BY_THREE : FOUR_BY_FOUR;
}

export function tileColor(layout: Layout, row: number, col: number): string {
  return CAO_PALETTE[layout.colors.get(`${row}:${col}`) ?? 0];
}

// Slot by slot in grid order (column 0 top to bottom, then column 1, ...):
// anyone with a pin is fixed at that exact slot; everyone else fills the
// remaining slots around them in alphabetical order. Anyone past the last
// slot isn't shown, so add a layout above whenever the headcount changes.
export function layoutSigninCells(staffList: StaffOption[]): SigninCell[] {
  const { grid, pins } = signinLayout(staffList);
  const pinOf = (s: StaffOption) => (pins ? (pins[s.name] ?? null) : s.pinnedGridIndex);
  const sorted = [...staffList].sort((a, b) => a.name.localeCompare(b.name));
  const pinned = sorted.filter((s) => pinOf(s) !== null);
  const unpinned = sorted.filter((s) => pinOf(s) === null);

  const slots: (StaffOption | undefined)[] = new Array(grid.slots.length);
  for (const p of pinned) {
    const i = pinOf(p)!;
    if (i >= 0 && i < slots.length && !slots[i]) slots[i] = p;
    else unpinned.push(p);
  }
  let next = 0;
  for (let i = 0; i < slots.length && next < unpinned.length; i++) {
    if (!slots[i]) slots[i] = unpinned[next++];
  }

  return slots.map((staff, i) => (staff ? { staff, ...grid.slots[i] } : null)).filter((c): c is SigninCell => c !== null);
}

// The color of this person's sign-in tile, or null if they don't have one.
export function signinTileColor(staffList: StaffOption[], staffId: string): string | null {
  const cell = layoutSigninCells(staffList).find((c) => c.staff.id === staffId);
  return cell ? tileColor(signinLayout(staffList), cell.row, cell.col) : null;
}
