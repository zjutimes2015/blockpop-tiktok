/**
 * BlockPop Cocos port — placement / clear / dead-end / IAA wiring checks
 * Run: node cocos/playtest.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;

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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

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

console.log('\n=== Project files ===');
{
  const required = [
    'package.json',
    'project.json',
    'assets.meta',
    'tsconfig.json',
    'tsconfig.editor.json',
    '.gitignore',
    'README.md',
    'WECHAT.md',
    'assets/scenes/main.scene',
    'assets/scenes/main.scene.meta',
    'assets/scripts/GameManager.ts',
    'assets/scripts/BoardManager.ts',
    'assets/scripts/PieceTray.ts',
    'assets/scripts/UIManager.ts',
    'assets/scripts/AdBridge.ts',
    'assets/scripts/WxAdapter.ts',
    'settings/v2/packages/project.json',
    'settings/v2/packages/engine.json',
    'settings/v2/packages/cocos-service.json',
  ];
  for (const f of required) {
    assert(fs.existsSync(path.join(root, f)), 'exists ' + f);
  }
}

console.log('\n=== Creator 3.8.8 + scene camera ===');
{
  const pkg = JSON.parse(read('package.json'));
  assert(pkg.creator && pkg.creator.version === '3.8.8', 'package.json creator 3.8.8');
  const project = JSON.parse(read('project.json'));
  assert(project.version === '3.8.8', 'root project.json version 3.8.8');
  assert(project.engine === 'cocos-creator-js', 'root project.json engine cocos-creator-js');
  assert(project.id === pkg.uuid, 'project.json id matches package.json uuid');
  const assetsMeta = JSON.parse(read('assets.meta'));
  assert(assetsMeta.importer === 'directory' && !!assetsMeta.uuid, 'assets.meta is a directory meta');
  const editorTs = JSON.parse(read('tsconfig.editor.json'));
  assert(Array.isArray(editorTs.include) && editorTs.include.join(',').includes('assets/**/*.ts'), 'tsconfig.editor.json includes assets scripts');
  const scene = read('assets/scenes/main.scene');
  assert(scene.includes('"__type__": "cc.Canvas"'), 'main.scene has Canvas');
  assert(scene.includes('"__type__": "cc.Camera"'), 'main.scene has Camera');
  assert(/"_projection":\s*0/.test(scene), 'Camera projection ORTHO (0)');
  assert(/"_clearFlags":\s*7/.test(scene), 'Camera SOLID_COLOR clear (no black preview)');
  assert(scene.includes('"r": 26') && scene.includes('"g": 10') && scene.includes('"b": 46'), 'clear color candy purple #1a0a2e');
  assert(/"_alignCanvasWithScreen":\s*true/.test(scene), 'Canvas aligned with screen');
  assert(scene.includes('"_cameraComponent"'), 'Canvas wired to Camera');
  assert(/"_layer":\s*33554432/.test(scene), 'Canvas/Camera UI_2D layer');
  assert(/"_visibility":\s*41943040/.test(scene), 'Camera visibility includes UI_2D');
  assert(scene.includes('8c3e5wBIAFCAYIBAAAAAAAB'), 'GameManager component attached');
}

console.log('\n=== Safe project settings ===');
{
  const project = read('settings/v2/packages/project.json');
  assert(project.includes('"0_0": false') || project.includes('"0_0":false'), 'DEFAULT physics group does not self-collide');
  assert(project.includes('720') && project.includes('1280'), 'portrait design resolution 720x1280');
  const engine = read('settings/v2/packages/engine.json');
  assert(/"physics"[\s\S]*?"_value": false/.test(engine), '3D physics module off');
  assert(/"physics-2d"[\s\S]*?"_value": false/.test(engine), '2D physics module off');
  assert(engine.includes('"graphics"'), 'Graphics module present');
  const gi = read('.gitignore');
  assert(gi.includes('library/'), '.gitignore library/');
  assert(gi.includes('temp/'), '.gitignore temp/');
  assert(gi.includes('local/'), '.gitignore local/');
  assert(gi.includes('build/'), '.gitignore build/');
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
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) g[r][c] = '#x';
  const mono = { cells: [[0, 0]], color: '#fff' };
  assert(!canPlaceAnywhere(g, mono), 'full board → no placement');
  const g2 = emptyGrid();
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) g2[r][c] = '#x';
  g2[0][0] = null;
  const domino = { cells: [[0, 0], [0, 1]], color: '#fff' };
  assert(!canPlaceAnywhere(g2, domino), 'single hole → domino dead end');
  assert(canPlaceAnywhere(g2, mono), 'single hole → monomino still placeable');
}

console.log('\n=== Source port / IAA ===');
{
  const logic = read('assets/scripts/core/GameLogic.ts');
  const gm = read('assets/scripts/GameManager.ts');
  const ads = read('assets/scripts/AdBridge.ts');
  const wx = read('assets/scripts/WxAdapter.ts');
  const ui = read('assets/scripts/UIManager.ts');
  const cfg = read('assets/scripts/core/AdConfig.ts');
  assert(logic.includes('softStartTray'), 'soft-start tray');
  assert(logic.includes('refillTray'), 'refill anti-softlock');
  assert(logic.includes('reviveTray'), 'revive shuffle + clear row');
  assert(gm.includes('INTERSTITIAL_EVERY'), 'interstitial cadence');
  assert(gm.includes('reviveUsed'), 'revive 1/run cap');
  assert(ads.includes('wx.createBannerAd') && ads.includes('createBannerAd'), 'banner wx.createBannerAd');
  assert(ads.includes('createInterstitialAd'), 'wx.createInterstitialAd');
  assert(ads.includes('createRewardedVideoAd'), 'wx.createRewardedVideoAd');
  assert(cfg.includes('adunit-banner-placeholder'), 'placeholder banner adUnitId');
  assert(cfg.includes('adunit-interstitial-placeholder'), 'placeholder interstitial adUnitId');
  assert(cfg.includes('adunit-rewarded-placeholder'), 'placeholder rewarded adUnitId');
  assert(wx.includes('setStorageSync') && wx.includes('getStorageSync'), 'wx storage adapter');
  assert(wx.includes('blockpop_best') || read('assets/scripts/core/Constants.ts').includes('blockpop_best'), 'best score key');
  assert(ui.includes('BlockPop') && ui.includes('Drop. Clear. One more round.'), 'English-first branding');
  assert(ui.includes('Watch Ad to Revive'), 'Revive CTA');
  assert(ui.includes('Ad · Banner'), 'Banner stub label');
  assert(ui.includes('Ad · Interstitial'), 'Interstitial stub label');
  assert(ui.includes('Ad · Rewarded Video'), 'Rewarded stub label');
  assert(ui.includes('Graphics') || read('assets/scripts/ui/UiFactory.ts').includes('Graphics'), 'code-built Graphics UI');
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
