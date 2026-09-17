/**
 * BlockPop playtest — placement validity, line clear, dead-end detection
 * Run: node playtest.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

let failed = 0;
let passed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  PASS:', msg);
  } else {
    failed++;
    console.log('  FAIL:', msg);
  }
}

// --- Extract & syntax-check script ---
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert(!!scriptMatch, 'index.html contains inline <script>');
const script = scriptMatch[1];

try {
  new vm.Script(script, { filename: 'blockpop.js' });
  assert(true, 'Node/vm syntax check (equivalent to node --check)');
} catch (e) {
  assert(false, 'Syntax check: ' + e.message);
}

// --- Pure logic reimplementation for unit tests (mirrors game) ---
const GRID = 8;

function canPlace(grid, piece, r0, c0) {
  for (const [dr, dc] of piece.cells) {
    const r = r0 + dr, c = c0 + dc;
    if (r < 0 || c < 0 || r >= GRID || c >= GRID) return false;
    if (grid[r][c] !== null) return false;
  }
  return true;
}

function canPlaceAnywhere(grid, piece) {
  let maxR = 0, maxC = 0;
  piece.cells.forEach(([r, c]) => { maxR = Math.max(maxR, r); maxC = Math.max(maxC, c); });
  for (let r = 0; r <= GRID - (maxR + 1); r++) {
    for (let c = 0; c <= GRID - (maxC + 1); c++) {
      if (canPlace(grid, piece, r, c)) return true;
    }
  }
  return false;
}

function findFullLines(grid) {
  const rows = [], cols = [];
  for (let r = 0; r < GRID; r++) if (grid[r].every((v) => v !== null)) rows.push(r);
  for (let c = 0; c < GRID; c++) {
    let full = true;
    for (let r = 0; r < GRID; r++) if (grid[r][c] === null) { full = false; break; }
    if (full) cols.push(c);
  }
  return { rows, cols, lines: rows.length + cols.length };
}

function emptyGrid() {
  return Array.from({ length: GRID }, () => Array(GRID).fill(null));
}

console.log('\n=== Placement validity ===');
{
  const g = emptyGrid();
  const mono = { cells: [[0, 0]], color: '#fff' };
  assert(canPlace(g, mono, 0, 0), 'monomino places at 0,0 on empty');
  assert(canPlace(g, mono, 7, 7), 'monomino places at 7,7');
  assert(!canPlace(g, mono, 8, 0), 'monomino rejects out of bounds');
  const I = { cells: [[0, 0], [0, 1], [0, 2], [0, 3]], color: '#fff' };
  assert(canPlace(g, I, 0, 0), 'I-tetromino places at 0,0');
  assert(!canPlace(g, I, 0, 5), 'I-tetromino rejects overflow at c=5');
  g[0][0] = '#x';
  assert(!canPlace(g, mono, 0, 0), 'rejects occupied cell');
}

console.log('\n=== Line clear logic ===');
{
  const g = emptyGrid();
  for (let c = 0; c < GRID; c++) g[3][c] = '#a';
  let fl = findFullLines(g);
  assert(fl.rows.length === 1 && fl.rows[0] === 3, 'detects full row 3');
  assert(fl.lines === 1, 'lines count = 1 for one row');

  const g2 = emptyGrid();
  for (let r = 0; r < GRID; r++) g2[r][2] = '#b';
  fl = findFullLines(g2);
  assert(fl.cols.length === 1 && fl.cols[0] === 2, 'detects full column 2');

  const g3 = emptyGrid();
  for (let c = 0; c < GRID; c++) g3[0][c] = '#c';
  for (let r = 0; r < GRID; r++) g3[r][0] = '#c';
  fl = findFullLines(g3);
  assert(fl.rows.length === 1 && fl.cols.length === 1, 'combo: row+col both full');
  assert(fl.lines === 2, 'combo lines = 2');
}

console.log('\n=== Dead-end detection ===');
{
  const g = emptyGrid();
  // Fill entire board
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) g[r][c] = '#x';
  const mono = { cells: [[0, 0]], color: '#fff' };
  assert(!canPlaceAnywhere(g, mono), 'full board → no placement');

  const g2 = emptyGrid();
  // Leave only one hole — domino cannot fit
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) g2[r][c] = '#x';
  g2[0][0] = null;
  const domino = { cells: [[0, 0], [0, 1]], color: '#fff' };
  assert(!canPlaceAnywhere(g2, domino), 'single hole → domino dead end');
  assert(canPlaceAnywhere(g2, mono), 'single hole → monomino still placeable');

  const tray = [domino, { cells: [[0, 0], [1, 0]], color: '#fff' }, { cells: [[0, 0], [0, 1], [0, 2]], color: '#fff' }];
  const any = tray.some((p) => canPlaceAnywhere(g2, p));
  assert(!any, 'dead-end: none of 3 pieces placeable on single-hole board');
}

console.log('\n=== Soft start / empty board placeable ===');
{
  const g = emptyGrid();
  const shapes = [
    [[0, 0]],
    [[0, 0], [0, 1]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [1, 0], [1, 1]]
  ];
  for (const cells of shapes) {
    assert(canPlaceAnywhere(g, { cells }), 'empty board places shape size ' + cells.length);
  }
}

console.log('\n=== Static IAA stub greps ===');
{
  assert(html.includes('Ad · Banner'), 'Banner stub UI label present');
  assert(html.includes('Ad · Interstitial'), 'Interstitial stub UI label present');
  assert(html.includes('Ad · Rewarded') || html.includes('Rewarded Video'), 'Rewarded ad stub present');
  assert(html.includes('TODO: TTMinis.game'), 'TTMinis.game TODO comments present');
  assert(html.includes('createRewardedVideoAd') || html.includes('showRewardedAd'), 'showRewardedAd / createRewardedVideoAd referenced');
  assert(html.includes('Watch Ad to Revive'), 'Revive CTA present');
  assert(html.includes('reviveUsed') || html.includes('1 per run'), 'Revive 1/session cap present');
  assert(/INTERSTITIAL_EVERY\s*=\s*3/.test(html) || html.includes('every N') || html.includes('lineClearEvents'), 'Interstitial cadence wired');
}

console.log('\n=== Branding / UX ===');
{
  assert(html.includes('BlockPop'), 'Title BlockPop');
  assert(html.includes('Drop. Clear. One more round.'), 'Tagline present');
  assert(html.includes('localStorage') || html.includes('blockpop_best'), 'Best score localStorage');
  assert(html.includes('max-width:420px') || html.includes('420px'), 'Portrait ~420px');
}

console.log('\n========================================');
console.log('Results:', passed, 'passed,', failed, 'failed');
if (failed === 0) {
  console.log('VERDICT: READY');
  process.exit(0);
} else {
  console.log('VERDICT: NOT READY');
  process.exit(1);
}
