/**
 * Pure BlockPop rules — no engine imports, so Node playtest can load this file.
 * Ported faithfully from the HTML prototype.
 */
import { COLORS, GRID, SHAPES } from './Constants';
import type { Cell, FullLines, Grid, Hint, Piece, PieceBounds } from './Types';

export function emptyGrid(): Grid {
    return Array.from({ length: GRID }, () => Array(GRID).fill(null));
}

export function cloneGrid(grid: Grid): Grid {
    return grid.map((row) => row.slice());
}

export function normalizeShape(shape: number[][]): Cell[] {
    let minR = Infinity;
    let minC = Infinity;
    for (const [r, c] of shape) {
        minR = Math.min(minR, r);
        minC = Math.min(minC, c);
    }
    return shape.map(([r, c]) => [r - minR, c - minC] as Cell);
}

export function pieceBounds(cells: Cell[]): PieceBounds {
    let maxR = 0;
    let maxC = 0;
    for (const [r, c] of cells) {
        maxR = Math.max(maxR, r);
        maxC = Math.max(maxC, c);
    }
    return { rows: maxR + 1, cols: maxC + 1 };
}

export function randomOf<T>(list: T[]): T {
    return list[Math.floor(Math.random() * list.length)];
}

export function makePieceFromShape(shape: number[][], color?: string): Piece {
    return {
        cells: normalizeShape(shape),
        color: color || randomOf(COLORS),
    };
}

export function randomShapePiece(): Piece {
    return makePieceFromShape(randomOf(SHAPES));
}

export function canPlace(grid: Grid, piece: Piece | null, r0: number, c0: number): boolean {
    if (!piece) return false;
    for (const [dr, dc] of piece.cells) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || c < 0 || r >= GRID || c >= GRID) return false;
        if (grid[r][c] !== null) return false;
    }
    return true;
}

export function canPlaceAnywhere(grid: Grid, piece: Piece | null): boolean {
    if (!piece) return false;
    const { rows, cols } = pieceBounds(piece.cells);
    for (let r = 0; r <= GRID - rows; r++) {
        for (let c = 0; c <= GRID - cols; c++) {
            if (canPlace(grid, piece, r, c)) return true;
        }
    }
    return false;
}

export function anyTrayPlaceable(grid: Grid, tray: Array<Piece | null>): boolean {
    return tray.some((p) => p && canPlaceAnywhere(grid, p));
}

export function findHint(grid: Grid, tray: Array<Piece | null>): Hint | null {
    for (let i = 0; i < tray.length; i++) {
        const p = tray[i];
        if (!p) continue;
        const { rows, cols } = pieceBounds(p.cells);
        for (let r = 0; r <= GRID - rows; r++) {
            for (let c = 0; c <= GRID - cols; c++) {
                if (canPlace(grid, p, r, c)) return { idx: i, r, c };
            }
        }
    }
    return null;
}

export function ghostCellsAt(piece: Piece, r0: number, c0: number): Cell[] {
    return piece.cells.map(([dr, dc]) => [r0 + dr, c0 + dc] as Cell);
}

export function anchorOffset(piece: Piece): { ar: number; ac: number } {
    const { rows, cols } = pieceBounds(piece.cells);
    return { ar: Math.floor(rows / 2), ac: Math.floor(cols / 2) };
}

export function stampPiece(grid: Grid, piece: Piece, r0: number, c0: number): void {
    for (const [dr, dc] of piece.cells) {
        grid[r0 + dr][c0 + dc] = piece.color;
    }
}

export function findFullLines(grid: Grid): FullLines {
    const rows: number[] = [];
    const cols: number[] = [];
    for (let r = 0; r < GRID; r++) {
        if (grid[r].every((v) => v !== null)) rows.push(r);
    }
    for (let c = 0; c < GRID; c++) {
        let full = true;
        for (let r = 0; r < GRID; r++) {
            if (grid[r][c] === null) {
                full = false;
                break;
            }
        }
        if (full) cols.push(c);
    }
    return { rows, cols, lines: rows.length + cols.length };
}

export function collectClearKeys(fullRows: number[], fullCols: number[]): string[] {
    const set = new Set<string>();
    for (const r of fullRows) {
        for (let c = 0; c < GRID; c++) set.add(r + ',' + c);
    }
    for (const c of fullCols) {
        for (let r = 0; r < GRID; r++) set.add(r + ',' + c);
    }
    return Array.from(set);
}

export function applyClears(grid: Grid, keys: string[]): void {
    for (const key of keys) {
        const [r, c] = key.split(',').map(Number);
        grid[r][c] = null;
    }
}

export function comboMessage(lines: number): string {
    if (lines <= 1) return 'CLEAR!';
    if (lines === 2) return 'COMBO x2';
    if (lines === 3) return 'COMBO x3';
    return 'COMBO x' + lines + '!';
}

export function comboMultiplier(lines: number): number {
    if (lines <= 1) return 1;
    return lines;
}

export function scoreForPlace(piece: Piece): number {
    return piece.cells.length;
}

export function scoreForClear(lines: number, clearCount: number): number {
    const mult = comboMultiplier(lines);
    const base = 10 * lines;
    const bonus = lines > 1 ? base * (mult - 1) : 0;
    return base + bonus + clearCount * 2;
}

export function refillTray(grid: Grid, attempts = 20): Piece[] {
    let tray = [randomShapePiece(), randomShapePiece(), randomShapePiece()];
    if (!tray.some((p) => canPlaceAnywhere(grid, p))) {
        for (let attempt = 0; attempt < attempts; attempt++) {
            tray = [randomShapePiece(), randomShapePiece(), randomShapePiece()];
            if (tray.some((p) => canPlaceAnywhere(grid, p))) break;
        }
    }
    return tray;
}

export function softStartTray(): Piece[] {
    const small = SHAPES.filter((s) => s.length <= 3);
    const tray: Piece[] = [];
    for (let i = 0; i < 3; i++) {
        tray.push(makePieceFromShape(randomOf(small)));
    }
    return tray;
}

export function occupiedRows(grid: Grid): number[] {
    const filled: number[] = [];
    for (let r = 0; r < GRID; r++) {
        if (grid[r].some((v) => v !== null)) filled.push(r);
    }
    return filled;
}

export function clearRandomOccupiedRow(grid: Grid): number {
    const filled = occupiedRows(grid);
    if (filled.length === 0) return -1;
    const rr = filled[Math.floor(Math.random() * filled.length)];
    for (let c = 0; c < GRID; c++) grid[rr][c] = null;
    return rr;
}

export function reviveTray(grid: Grid, attempts = 40): Piece[] {
    clearRandomOccupiedRow(grid);
    let tray = [randomShapePiece(), randomShapePiece(), randomShapePiece()];
    for (let attempt = 0; attempt < attempts; attempt++) {
        tray = [randomShapePiece(), randomShapePiece(), randomShapePiece()];
        if (tray.some((p) => canPlaceAnywhere(grid, p))) break;
    }
    return tray;
}

export function resolveDropCell(
    grid: Grid,
    piece: Piece,
    r: number,
    c: number,
    preferAnchor: boolean,
): { r0: number; c0: number } | null {
    if (preferAnchor) {
        const { ar, ac } = anchorOffset(piece);
        const r0 = r - ar;
        const c0 = c - ac;
        if (canPlace(grid, piece, r0, c0)) return { r0, c0 };
        if (canPlace(grid, piece, r, c)) return { r0: r, c0: c };
        return null;
    }
    if (canPlace(grid, piece, r, c)) return { r0: r, c0: c };
    const { ar, ac } = anchorOffset(piece);
    const r0 = r - ar;
    const c0 = c - ac;
    if (canPlace(grid, piece, r0, c0)) return { r0, c0 };
    return null;
}

export function remainingCount(tray: Array<Piece | null>): number {
    return tray.filter(Boolean).length;
}
