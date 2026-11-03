import type { StaffOption } from "./whoami";
import { GRID_SLOTS, gridColorIndexes } from "./zigzagGrid";

// Who sits in which sign-in tile, and each tile's color. Shared by the
// picker itself and ThemeAccent, so a person's app accent always matches
// the tile they tapped.

export type SigninCell = { staff: StaffOption; row: number; col: number };

// Straight from the CAO pin logo. Colored by position, not per person, and
// arranged so no two touching tiles ever share a color (see gridColorIndexes).
const CAO_PALETTE = ["#1878b4", "#4fb3e8", "#f5871f", "#333f4c"];
const CELL_COLORS = gridColorIndexes(CAO_PALETTE.length);

export function tileColor(row: number, col: number): string {
  return CAO_PALETTE[CELL_COLORS.get(`${row}:${col}`) ?? 0];
}

// Slot by slot in GRID_SLOTS order (column 0 top to bottom, then column 1,
// ...): anyone with a pinnedGridIndex is fixed at that exact slot; everyone
// else fills the remaining slots around them in alphabetical order. Anyone
// past the last slot isn't shown, so change ROW_COLS in lib/zigzagGrid.ts
// whenever the headcount changes.
export function layoutSigninCells(staffList: StaffOption[]): SigninCell[] {
  const sorted = [...staffList].sort((a, b) => a.name.localeCompare(b.name));
  const pinned = sorted.filter((s) => s.pinnedGridIndex !== null);
  const unpinned = sorted.filter((s) => s.pinnedGridIndex === null);

  const slots: (StaffOption | undefined)[] = new Array(GRID_SLOTS.length);
  for (const p of pinned) {
    if (p.pinnedGridIndex! >= 0 && p.pinnedGridIndex! < slots.length) slots[p.pinnedGridIndex!] = p;
  }
  let next = 0;
  for (let i = 0; i < slots.length && next < unpinned.length; i++) {
    if (!slots[i]) slots[i] = unpinned[next++];
  }

  return slots.map((staff, i) => (staff ? { staff, ...GRID_SLOTS[i] } : null)).filter((c): c is SigninCell => c !== null);
}

// The color of this person's sign-in tile, or null if they don't have one.
export function signinTileColor(staffList: StaffOption[], staffId: string): string | null {
  const cell = layoutSigninCells(staffList).find((c) => c.staff.id === staffId);
  return cell ? tileColor(cell.row, cell.col) : null;
}
