# 微信小游戏导出（BlockPop）

Cocos Creator **3.8.8** → 平台 **微信小游戏**（`wechatgame`）。根目录 `index.html` 只是玩法原型，**不能**当小游戏包上传。

## 预览必须先可玩（浏览器 ▶）

1. 用 Creator 3.8.8 **打开 `cocos/`**（含 `assets/` + `package.json` + `project.json`）
2. 打开 `assets/scenes/main.scene`
3. 层级应为：`Scene → Canvas → Camera / BoardRoot / UIRoot / GameController`
   - `GameController` 在 **Canvas 下**（不是 Scene 的兄弟节点），只挂 `cc.UITransform`（1×1）+ `GameManager`（压缩 CID `8c3e5wBIAFCAYIBAAAAAAAB`）
   - `BoardManager` / `PieceTray` / `UIManager` / `AdBridge` 由 `ensureComponents()` 运行时 `addComponent`
4. 点编辑器 **▶ 预览（浏览器）**
5. 控制台应出现 `[GameManager] boot(...) SUCCESS`（`onLoad` 或 `start()` 补建）
6. 画面应是 **BlockPop 开始页 + Play**，不是只有清屏色 `#1a0a2e` / draw calls ≈ 2
7. 点 **Play** → 应看到 **8×8 棋盘 + 底部 3 格托盘**（YOUR BLOCKS），可点选/拖放方块

`boot()` 用 `parent` / `getChildByName` 绑定 `BoardRoot` / `UIRoot`，**禁止 `find()`**。`onLoad` 若还查不到 Canvas，**不会**在 GameController 下再建一个套娃 Canvas；`start()` 发现棋盘/托盘缺失会再 `boot('start', true)`。

无头冒烟（不启动 Creator）：在 `cocos/` 下执行：

```bash
node tools/verify-boot.mjs
node playtest.mjs
```

它会检查：GameController 父节点是 Canvas；场景 CID = `compressUuid(GameManager.ts.meta)`；`onLoad`/`start` 不用 `find()`；开始页 + Board/Tray 宿主存在。

## 构建发布 → 微信小游戏

1. 菜单 **项目 → 构建发布**
2. 发布平台：**微信小游戏**（`wechatgame`）
3. 起始场景：`db://assets/scenes/main.scene`（`main`）
4. 设备方向：**Portrait（竖屏）**，设计分辨率 **720×1280**
5. AppID：先填占位 `touristappid`（游客/开发）；上架换成微信公众平台正式 AppID
6. 构建输出目录：**`build/wechatgame`**（相对 `cocos/`）
7. 建议勾选 **MD5 Cache**；未用的 3D / 物理 / Spine 可按包体裁剪

| Field | Value |
|-------|--------|
| Platform | **微信小游戏** (`wechatgame`) |
| Start scene | `main` (`assets/scenes/main`) |
| AppID | `touristappid` then your 小游戏 AppID |
| Orientation | **Portrait** |
| Output | `cocos/build/wechatgame` |

Creator 会写入 `game.json` 的 `"deviceOrientation": "portrait"`。

## 用微信开发者工具打开

- [ ] 安装 [微信开发者工具](https://developers.weixin.qq.com/minigame/dev/devtools/download.html)
- [ ] 导入项目 → 选 `cocos/build/wechatgame`
- [ ] 打开产物里的 `game.json`，确认 `"deviceOrientation": "portrait"`
- [ ] 详情 → 本地设置：开发阶段可勾选「不校验合法域名」
- [ ] 模拟器点编译/预览：Play → 落子 / 消行 / Hint
- [ ] 真机预览：`wx.setStorageSync('blockpop_best')` 能记下最高分；广告在模拟器里经常不填充

## 广告位（上架前）

在 `assets/scripts/core/AdConfig.ts` 把占位换成流量主 ID。未替换或 `wx` 不存在时，`AdBridge` 回退到局内倒计时桩。

```ts
export const AD_UNIT = {
    banner: 'adunit-xxxxxxxx',        // Banner
    interstitial: 'adunit-xxxxxxxx',  // 插屏（每 3 次消行）
    rewarded: 'adunit-xxxxxxxx',      // 激励视频（复活 + 提示共用）
};
```

`AdBridge.ts` 已按微信形状调用：

- `wx.createBannerAd({ adUnitId, adIntervals, style })`
- `wx.createInterstitialAd({ adUnitId })`
- `wx.createRewardedVideoAd({ adUnitId })`

存储：`WxAdapter` 在小游戏用 `wx.setStorageSync` / `wx.getStorageSync`，Creator 预览走 `sys.localStorage`。键：`blockpop_best`。

## 常见问题

| Symptom | Fix |
|---------|-----|
| 预览只有清屏色 | `GameController` 必须在 Canvas 下；不要在 `onLoad` 里 `find('Canvas/...')`。看控制台是否有 `boot(...) SUCCESS`。 |
| `[Scene] Missing class` | 场景自定义组件必须是 **23 位压缩 CID**，不能写完整 UUID。 |
| UI invisible | 节点 layer **UI_2D**（`33554432`）；Camera ORTHO + `SOLID_COLOR` + visibility UI_2D。 |
| Ads never show | 替换 placeholder `adUnitId`；真机 + 已开通流量主的 AppID。 |
| Banner overlaps board | 桩 Banner 高 50px；`wx` banner 用 `onResize` 贴底。HUD/托盘 Widget 留出该条。 |

## 上架注意

- [ ] 隐私协议 / 用户协议；类目选 **休闲 / 益智**
- [ ] 广告位与代码 ID 一致，不要带着 `adunit-*-placeholder` 提审
- [ ] 包体审查：无外部 CDN
- [ ] 根目录 HTML 原型不要打进小游戏包
