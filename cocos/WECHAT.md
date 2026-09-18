# WeChat Mini Game export — BlockPop

Checklist for building this Creator 3.8.8 project to **微信小游戏**.

## 1. Open the right folder

Dashboard → Open → **`cocos/`** (the folder that contains `assets/` + `package.json`).  
Creator version: **3.8.8**.

Confirm preview is not black: `main.scene` has Canvas + ORTHO UI Camera, clear flags **SOLID_COLOR**, color `#1a0a2e`, layer **UI_2D**.

## 2. Replace ad unit IDs

WeChat MP admin → 流量主 → 广告管理 → create three units (Banner, Interstitial, Rewarded video).

Edit `assets/scripts/core/AdConfig.ts`:

```ts
export const AD_UNIT = {
    banner: 'adunit-xxxxxxxx',        // Banner
    interstitial: 'adunit-xxxxxxxx',  // 插屏
    rewarded: 'adunit-xxxxxxxx',      // 激励视频（复活 + 提示共用）
};
```

`AdBridge.ts` already calls:

- `wx.createBannerAd({ adUnitId, adIntervals, style })`
- `wx.createInterstitialAd({ adUnitId })` — shown every **3** line-clear events
- `wx.createRewardedVideoAd({ adUnitId })` — revive (1/run) and Hint

If `wx` is missing (browser preview), `AdBridge` falls back to the in-game countdown overlay.

## 3. Build panel

Menu **项目 → 构建发布** (Project → Build):

| Field | Value |
|-------|--------|
| Platform | **微信小游戏** (WeChat Mini Game) |
| Start scene | `main` (`assets/scenes/main`) |
| AppID | your 小游戏 AppID |
| Orientation | **Portrait** (`portrait`) |
| Source maps | off for release |
| Debug | on for first device pass |

Other useful options:

- MD5 Cache: on for production
- Separate engine: default is fine
- Device orientation must match `game.json` `"deviceOrientation": "portrait"` (Creator writes this on build)

## 4. WeChat DevTools

1. Install [微信开发者工具](https://developers.weixin.qq.com/minigame/dev/devtools/download.html).
2. After a successful Creator build, open the **output directory** (default `cocos/build/wechatgame`).
3. DevTools → 导入 → that folder → the same AppID.
4. Preview on a real phone (ads often do **not** fill in the simulator).

## 5. Storage

Best score key: `blockpop_best`.

`WxAdapter` uses `wx.setStorageSync` / `wx.getStorageSync` on mini game, and `sys.localStorage` in Creator preview.

## 6. Common issues

| Symptom | Fix |
|---------|-----|
| Black preview | Camera must be ORTHO, `clearFlags` SOLID_COLOR (7), visibility UI_2D, Canvas `alignCanvasWithScreen`. Do not leave a 3D camera as the only clearer. |
| UI invisible | Nodes must be **UI_2D** (`33554432`), not DEFAULT. Code UI uses `Layers.Enum.UI_2D`. |
| Physics / DEFAULT collision warnings | Physics modules are off; `collisionMatrix["0_0"]` is `false`. |
| Ads never show | Replace placeholder `adUnitId`; test on a **real device** with a traffic-main enabled AppID; check `AdBridge` console warnings. |
| Banner overlaps board | Stub banner is 50px; wx banner is pinned to the bottom via `onResize`. Keep HUD/tray widgets above that strip. |
| System font | Labels use `useSystemFont` + Arial. WeChat maps this to a device sans-serif. |

## 7. Submit

Follow WeChat mini game review: privacy, ads, category **休闲 / 益智**. Do not ship placeholder ad unit IDs.

---

## 中文清单

1. 用 Creator **3.8.8** 打开 `cocos/`，预览 `main.scene`（紫底开始页，不应黑屏）。
2. 在 `AdConfig.ts` 把三个 `adunit-*-placeholder` 换成微信流量主 ID。
3. 构建发布 → 平台 **微信小游戏** → 竖屏 → 填 AppID → 起始场景 `main`。
4. 用微信开发者工具打开 `build/wechatgame`，真机预览广告。
5. 最高分走 `wx` 存储键 `blockpop_best`。
