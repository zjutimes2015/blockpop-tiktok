/** Shared gameplay constants — mirrored from the HTML prototype. */

export const GRID = 8;
export const TRAY_SIZE = 3;
export const LS_BEST = 'blockpop_best';
export const INTERSTITIAL_EVERY = 3;
export const MILESTONES = [100, 250, 500, 1000, 2000, 5000];

export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;
export const BANNER_HEIGHT = 50;

/** Candy palette */
export const COLORS = [
    '#ff6b9d',
    '#c44dff',
    '#6b8cff',
    '#4dffc4',
    '#ffd56b',
    '#ff9a3c',
    '#ff5e5e',
    '#7dff6b',
];

export const COLOR_BG = '#1a0a2e';
export const COLOR_BG_MID = '#2d1b4e';
export const COLOR_TEXT = '#ffffff';
export const COLOR_MUTED = '#b8a0d4';
export const COLOR_LABEL = '#9a7fb8';
export const COLOR_HOWTO = '#d4c4e8';
export const COLOR_GOLD = '#ffd56b';
export const COLOR_MINT = '#4dffc4';
export const COLOR_PINK = '#ff9ec8';
export const COLOR_CELL_EMPTY = 'rgba(255,255,255,0.06)';

/** Classic polyomino shapes (relative cells [r, c]) */
export const SHAPES: number[][][] = [
    [[0, 0]],
    [[0, 0], [0, 1]],
    [[0, 0], [1, 0]],
    [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [1, 0]],
    [[0, 0], [0, 1], [1, 1]],
    [[0, 1], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [2, 1]],
    [[0, 1], [1, 1], [2, 0], [2, 1]],
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [1, 0], [2, 0]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
    [[0, 2], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [0, 1], [0, 2], [1, 1]],
    [[0, 1], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [0, 1], [1, 0], [2, 0]],
    [[0, 0], [1, 0], [2, 0], [2, -1]],
    [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2]],
    [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
];
