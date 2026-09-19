# BlockPop — Cocos Creator 3.8.8

**Drop. Clear. One more round.**

Cocos Creator **3.8.x** + TypeScript port of the HTML prototype, aimed at **微信小游戏** export. UI is built at runtime with `Graphics` / `Label` / `Button` / `Widget` — no prefabs or external art required.

Open **this `cocos/` folder** (not the repo root) in Creator.

## Open & preview

1. Install [Cocos Creator 3.8.8](https://www.cocos.com/creator-download).
2. **Cocos Dashboard → Open** → select `cocos/` (folder with `project.json` + `package.json` + `assets/`).
3. Open scene `assets/scenes/main.scene`.
4. Hierarchy: `Scene → Canvas → Camera / BoardRoot / UIRoot / GameController`.
5. Click **▶ Preview** (browser). You should see the candy-purple **BlockPop start screen + Play** (not a blank clear-color view). Console: `[GameManager] boot(onLoad|start) SUCCESS`.
6. **Play** → **8×8 board + 3-piece tray**, tap/drag to place.

> `GameController` **must be under Canvas** (not a Scene sibling). The scene mounts only `cc.UITransform` (1×1) + `GameManager` (23-char compressed CID from `GameManager.ts.meta`). `BoardManager` / `PieceTray` / `UIManager` / `AdBridge` are `addComponent` siblings at runtime.
>
> `boot()` wires `BoardRoot` / `UIRoot` from `ensureHierarchy()` return values / `getChildByName`. **Never `find()` in onLoad.** If Canvas is not ready, `onLoad` does not nest a duplicate Canvas; `start()` retries with `boot('start', true)`.
>
> Headless check: `node tools/verify-boot.mjs`

First open compiles `temp/tsconfig.cocos.json`. Ignore IDE red squiggles until then.

## How to play

Same rules as `../index.html`:

1. Pick a block from the tray (tap to select, or drag).
2. Place it on the **8×8** board (ghost preview).
3. Fill a full **row or column** → clear & score. Multi-line clears = combos.
4. Empty tray refills with 3 new pieces (retries so at least one usually fits).
5. First round uses small pieces (size ≤ 3). No moves → **Watch Ad to Revive** (1/run: shuffle tray + clear one occupied row) or **End Run**.
6. Optional **Hint** (rewarded) highlights one valid placement.
7. Best score: `blockpop_best` via `WxAdapter` (`wx` storage on mini game, `localStorage` in preview).

## Ads (IAA)

| Placement | Trigger | API |
|-----------|---------|-----|
| Banner | Persistent bottom | `wx.createBannerAd` |
| Interstitial | Every **3** line-clear events | `wx.createInterstitialAd` |
| Rewarded revive | Dead end, **1/run** | `wx.createRewardedVideoAd` |
| Rewarded hint | Hint button | `wx.createRewardedVideoAd` |

Placeholder unit IDs live in `assets/scripts/core/AdConfig.ts`:

```
adunit-banner-placeholder
adunit-interstitial-placeholder
adunit-rewarded-placeholder
```

In Creator preview (no `wx`), ads use an in-game countdown stub. Replace IDs before shipping — see **WECHAT.md**.

## Scripts

| Script | Role |
|--------|------|
| `GameManager` | Boot + run loop, scoring, revive, interstitial cadence |
| `BoardManager` | 8×8 cells, ghost / hint / clear animation |
| `PieceTray` | 3 slots, tap select, drag ghost |
| `UIManager` | Code-built screens + simulated ad overlays |
| `AdBridge` | `wx.create*Ad` + simulated fallback |
| `WxAdapter` | `wx` detect + storage |

## Project settings (safe)

- Design resolution **720×1280**, fit width & height (portrait).
- Physics 2D/3D **off**; collision matrix `0_0: false` (no DEFAULT self-collision).
- Engine modules: 2D + UI + Graphics + Tween; 3D/physics/spine off.
- `.gitignore`: `library/`, `temp/`, `local/`, `build/`, `profiles/`.
- Custom scene scripts must use the **23-char compressed CID**, not the full UUID.

## 微信小游戏

Build checklist (`wechatgame`, portrait, `touristappid`, output `build/wechatgame`): **[WECHAT.md](./WECHAT.md)**.

## Playtest (no Creator)

```bash
node tools/verify-boot.mjs
node playtest.mjs
```

---

## 中文

用 **Cocos Creator 3.8.8** 打开本目录 `cocos/`，打开 `main.scene` 后预览。层级为 `Scene → Canvas → GameController`。控制台应有 `boot(...) SUCCESS`，画面是开始页而不是空白清屏；点 Play 出现 8×8 棋盘和三格托盘。`onLoad` 禁止 `find()`，Canvas 未就绪时由 `start()` 补建。玩法与根目录 HTML 原型一致。广告位对接 `wx.createBannerAd` / `createInterstitialAd` / `createRewardedVideoAd`；预览环境走倒计时占位。导出微信小游戏：平台 `wechatgame`、竖屏、AppID 先填 `touristappid`、输出 `build/wechatgame`，步骤见 `WECHAT.md`。
