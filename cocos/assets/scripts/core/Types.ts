export type Cell = [number, number];
export type GridCell = string | null;
export type Grid = GridCell[][];

export interface Piece {
    cells: Cell[];
    color: string;
}

export interface PieceBounds {
    rows: number;
    cols: number;
}

export interface Hint {
    idx: number;
    r: number;
    c: number;
}

export interface FullLines {
    rows: number[];
    cols: number[];
    lines: number;
}

export interface PlaceResult {
    ok: boolean;
    fullRows: number[];
    fullCols: number[];
    lines: number;
    clearKeys: string[];
}

export type ScreenName = 'start' | 'game' | 'deadend' | 'gameover' | 'interstitial' | 'rewarded';
