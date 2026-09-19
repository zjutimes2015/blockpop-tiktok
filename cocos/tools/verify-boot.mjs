#!/usr/bin/env node
/**
 * Headless smoke: preview boot path for BlockPop.
 * Run from cocos/:  node tools/verify-boot.mjs
 *
 * Asserts:
 * - GameController is a child of Canvas (not a Scene sibling)
 * - Scene mounts only GameManager via compressUuid(meta.uuid, false)
 * - onLoad + start() boot; start rebuilds board/tray if missing
 * - no find(); roots come from ensureHierarchy() / getChildByName
 * - wechatgame export checklist still documented
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(cond, msg) {
    if (!cond) {
        console.error('FAIL:', msg);
        process.exit(1);
    }
    console.log('  PASS:', msg);
}

/** Creator compressUuid(uuid, false) — 5 hex prefix + base64 of remaining hex. */
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function compressUuid(uuid) {
    const str = String(uuid).replace(/-/g, '').toLowerCase();
    assert(str.length === 32, `uuid hex length 32, got ${str.length}`);
    const head = str.slice(0, 5);
    const hex = str.slice(5);
    let out = head;
    for (let i = 0; i < hex.length; i += 3) {
        const n = parseInt(hex.substr(i, 3).padEnd(3, '0'), 16);
        out += BASE64[(n >> 6) & 63] + BASE64[n & 63];
    }
    return out;
}

function stripComments(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

console.log('=== BlockPop boot / preview wiring ===');

const gm = read('assets/scripts/GameManager.ts');
const ui = read('assets/scripts/UIManager.ts');
const board = read('assets/scripts/BoardManager.ts');
const tray = read('assets/scripts/PieceTray.ts');
const ads = read('assets/scripts/AdBridge.ts');
const scene = JSON.parse(read('assets/scenes/main.scene'));
const wechat = read('WECHAT.md');
const readme = read('README.md');
const builder = JSON.parse(read('settings/v2/packages/builder.json'));
const project = JSON.parse(read('settings/v2/packages/project.json'));
const opener = JSON.parse(read('project.json'));
const pkg = JSON.parse(read('package.json'));
const gmMeta = JSON.parse(read('assets/scripts/GameManager.ts.meta'));
const gmCode = stripComments(gm);
const uiCode = stripComments(ui);

assert(!/\bfind\s*\(/.test(gmCode), 'GameManager.ts does not call find()');
assert(!/\bfind\s*\(/.test(uiCode), 'UIManager.ts does not call find()');
assert(/boot\s*\(\s*phase/.test(gm), 'boot(phase, allowCreateCanvas) exists');
assert(/onLoad[\s\S]*?this\.boot\(\s*'onLoad'\s*,\s*false\s*\)/.test(gm),
    'onLoad calls boot("onLoad", false) — will not create a nested Canvas');
assert(/start\s*\(\s*\)\s*(:\s*void\s*)?\{/.test(gm), 'start() exists');
assert(/hasPlayUI\s*\(\s*\)/.test(gm) && /boot\(\s*'start'\s*,\s*true\s*\)/.test(gm),
    'start() rebuilds via boot("start", true) if play UI missing');
assert(/try\s*\{[\s\S]*boot\(\s*'onLoad'/.test(gm), 'onLoad is wrapped in try/catch');
assert(/console\.error/.test(gm) && /console\.log/.test(gm), 'boot logs success and failure');

assert(/ensureHierarchy\s*\(/.test(gm), 'ensureHierarchy is used');
assert(/return\s*\{\s*canvas,\s*board,\s*ui\s*\}/.test(gm), 'ensureHierarchy returns canvas, board, ui');
assert(/setUIRoot\s*\(\s*ui\s*\)/.test(gm), 'boot sets uiRoot from ensureHierarchy ui');
assert(/setBoardHost\s*\(\s*board\s*\)/.test(gm), 'boot sets boardHost from ensureHierarchy board');
assert(/ensureComponents\s*\(/.test(gm), 'boot calls ensureComponents()');
assert(/named\(this\.node\.parent,\s*'Canvas'\)/.test(gm),
    'resolveCanvas uses parent name Canvas (GameController under Canvas)');
assert(/allowCreateCanvas/.test(gm), 'Canvas create is gated so onLoad cannot nest a duplicate');
assert(/reparent/.test(gm), 'runtime reparents GameController under Canvas if needed');
assert(/this\.node !== canvas/.test(gm), 'will not reparent Canvas onto itself');
assert(/Layers\.Enum\.UI_2D|UI_2D/.test(gm), 'UI nodes use UI_2D');
assert(/ProjectionType\.ORTHO/.test(gm), 'Camera set to ORTHO');
assert(/cameraComponent\s*=\s*camera/.test(gm), 'Canvas.cameraComponent linked');
assert(/executionOrder/.test(gm) || /orderEarly/.test(gm), 'GameManager executionOrder so boot runs first');
assert(/addComponent\(BoardManager\)/.test(gm) && /addComponent\(PieceTray\)/.test(gm),
    'BoardManager and PieceTray are addComponent siblings at runtime');
assert(/addComponent\(UIManager\)/.test(gm) && /addComponent\(AdBridge\)/.test(gm),
    'UIManager and AdBridge are addComponent siblings at runtime');

assert(/uiRoot is null/.test(ui), 'build logs if uiRoot is null instead of silent return');
assert(/hasPlayUI\s*\(/.test(ui), 'UIManager.hasPlayUI() for start() retry');
assert(/StartScreen/.test(ui) && /TrayHost/.test(ui), 'UI builds StartScreen + TrayHost');
assert(/YOUR BLOCKS/.test(ui), 'tray label present');
assert(/Ad · Banner/.test(ui) && /Ad · Interstitial/.test(ui) && /Ad · Rewarded Video/.test(ui),
    'wx-shaped ad stubs remain visible');

assert(/hasBoard\s*\(/.test(board), 'BoardManager.hasBoard()');
assert(/const box = /.test(board) && !/const box = [\s\S]*const box = /.test(board),
    'BoardManager.containsWorld does not redeclare box');
assert(/hasTray\s*\(/.test(tray), 'PieceTray.hasTray()');

assert(/createBannerAd/.test(ads) && /createInterstitialAd/.test(ads) && /createRewardedVideoAd/.test(ads),
    'AdBridge keeps wx.create*Ad shape');

const objects = Array.isArray(scene) ? scene : [];
const sceneNode = objects.find((o) => o && o.__type__ === 'cc.Scene');
const canvasNode = objects.find((o) => o && o.__type__ === 'cc.Node' && o._name === 'Canvas');
const gameController = objects.find((o) => o && o.__type__ === 'cc.Node' && o._name === 'GameController');
const boardRoot = objects.find((o) => o && o.__type__ === 'cc.Node' && o._name === 'BoardRoot');
const uiRoot = objects.find((o) => o && o.__type__ === 'cc.Node' && o._name === 'UIRoot');
assert(!!sceneNode && !!canvasNode && !!gameController, 'scene has Scene, Canvas, GameController');
assert(!!boardRoot && !!uiRoot, 'scene has BoardRoot and UIRoot under Canvas');

const canvasId = objects.indexOf(canvasNode);
const gcId = objects.indexOf(gameController);
assert(Array.isArray(sceneNode._children) && sceneNode._children.length === 1,
    `Scene has exactly 1 child (Canvas), got ${(sceneNode._children || []).length}`);
assert(sceneNode._children[0].__id__ === canvasId, 'Scene child 0 is Canvas');
assert(gameController._parent && gameController._parent.__id__ === canvasId,
    `GameController parent is Canvas (id ${canvasId}), got ${JSON.stringify(gameController._parent)}`);
assert((canvasNode._children || []).some((c) => c.__id__ === gcId),
    'Canvas children include GameController');
assert(boardRoot._parent && boardRoot._parent.__id__ === canvasId, 'BoardRoot parent is Canvas');
assert(uiRoot._parent && uiRoot._parent.__id__ === canvasId, 'UIRoot parent is Canvas');

const gcCompIds = (gameController._components || []).map((c) => c.__id__);
assert(gcCompIds.length === 2, `GameController has 2 components (UITransform + GameManager), got ${gcCompIds.length}`);
const gcComps = gcCompIds.map((id) => objects[id]);
const types = gcComps.map((c) => c && c.__type__);
assert(types.includes('cc.UITransform'), 'GameController keeps cc.UITransform');
const ut = gcComps.find((c) => c && c.__type__ === 'cc.UITransform');
assert(ut && ut._contentSize && ut._contentSize.width <= 1 && ut._contentSize.height <= 1,
    'GameController UITransform is 1×1 so it does not steal Play clicks');

const scriptTypes = types.filter((t) => t && t !== 'cc.UITransform');
assert(scriptTypes.length === 1, 'GameController has exactly one custom script');
const cid = scriptTypes[0];
assert(/^[0-9a-zA-Z+/]{22,23}$/.test(cid) && !cid.includes('-'),
    `GameManager CID is compressed (no UUID hyphens): ${cid}`);

const expectedCid = compressUuid(gmMeta.uuid);
assert(cid === expectedCid,
    `scene CID ${cid} must equal compressUuid(GameManager.ts.meta uuid) ${expectedCid}`);
assert(String(gmMeta.uuid).replace(/-/g, '').startsWith('8c3e5'),
    'GameManager.ts.meta UUID still matches expected prefix');

const extraScripts = objects.filter((o) => o && typeof o.__type__ === 'string'
    && !String(o.__type__).startsWith('cc.'));
assert(extraScripts.length === 1, `scene custom scripts should be GameManager only, got ${extraScripts.length}`);

const cameraNode = objects.find((o) => o && o.__type__ === 'cc.Node' && o._name === 'Camera');
assert(cameraNode && cameraNode._layer === 33554432, 'Camera node layer is UI_2D (33554432)');
const cameraComp = objects.find((o) => o && o.__type__ === 'cc.Camera');
assert(cameraComp && cameraComp._projection === 0, 'Camera projection ORTHO (0)');
assert(cameraComp && cameraComp._visibility === 33554432, 'Camera visibility UI_2D');
assert(cameraComp && cameraComp._orthoHeight === 640, 'Camera orthoHeight 640');
assert(cameraComp && cameraComp._clearFlags === 7, 'Camera SOLID_COLOR clear (not black)');
assert(cameraComp && cameraComp._color && cameraComp._color.r === 26 && cameraComp._color.g === 10 && cameraComp._color.b === 46,
    'clear color candy purple #1a0a2e');
const canvasComp = objects.find((o) => o && o.__type__ === 'cc.Canvas');
assert(canvasComp && canvasComp._cameraComponent && canvasComp._cameraComponent.__id__ != null,
    'Canvas.cameraComponent linked in scene');
assert(canvasComp && canvasComp._alignCanvasWithScreen === true, 'Canvas aligned with screen');

assert(opener.version === '3.8.8' && opener.engine === 'cocos-creator-js', 'root project.json opener 3.8.8');
assert(pkg.creator && pkg.creator.version === '3.8.8', 'package.json creator 3.8.8');
assert(opener.id === pkg.uuid, 'project.json id matches package.json uuid');
assert(fs.existsSync(path.join(root, 'tsconfig.json')), 'tsconfig.json opener present');
assert(fs.existsSync(path.join(root, 'tsconfig.editor.json')), 'tsconfig.editor.json opener present');
assert(fs.existsSync(path.join(root, 'assets.meta')), 'assets.meta opener present');

const design = project.general && project.general.designResolution;
assert(design && design.width === 720 && design.height === 1280, 'project designResolution 720×1280');
assert(builder.__version__, 'builder.json present');
assert(builder['splash-setting'], 'builder splash-setting present for wechatgame');

assert(/wechatgame/.test(wechat), 'WECHAT.md mentions wechatgame');
assert(/720\s*[×x]\s*1280/i.test(wechat), 'WECHAT.md mentions 720×1280');
assert(/touristappid/.test(wechat), 'WECHAT.md has AppID placeholder touristappid');
assert(/build\/wechatgame/.test(wechat), 'WECHAT.md output build/wechatgame');
assert(/微信开发者工具/.test(wechat), 'WECHAT.md mentions 微信开发者工具');
assert(/Portrait|竖屏/.test(wechat), 'WECHAT.md portrait orientation');
assert(/main\.scene/.test(wechat), 'WECHAT.md start scene main');
assert(/GameController/.test(wechat) && /Canvas/.test(wechat), 'WECHAT.md documents GameController under Canvas');
assert(/verify-boot/.test(wechat), 'WECHAT.md documents boot smoke test');
assert(/board|tray|棋盘|托盘/i.test(wechat), 'WECHAT.md preview path mentions board/tray');

assert(/GameController/.test(readme) && /verify-boot/.test(readme), 'cocos/README.md documents boot path');
assert(fs.existsSync(path.join(root, '..', 'index.html')), 'root HTML prototype kept');

console.log('CID', cid, '==', expectedCid);
console.log('GameController parent = Canvas; onLoad+start boot without find()');
console.log('ALL PASS');
