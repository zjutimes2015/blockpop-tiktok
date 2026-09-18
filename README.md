# BlockPop

**Drop. Clear. One more round.**

A Block Blast–style hypercasual puzzle built for **IAA (in-app ads)** — banners, interstitials at natural breaks, and a capped rewarded revive. English-first for TikTok overseas / Mini Games flywheels.

## Play

1. Open `index.html` in a mobile browser or desktop Chrome (`file://` works — no server, no CDN).
2. Tap **Play**.
3. Select a piece from the bottom tray (tap) or drag it onto the **8×8** board.
4. Fill any full **row or column** to clear it and score. Multi-line clears = combos.
5. After all 3 tray pieces are placed, you get 3 new ones.
6. No legal moves → **No moves!** → Watch Ad to Revive (once per run) or End Run.

**Best score** is saved in `localStorage` (`blockpop_best`).

### Controls
- **Tap**: select piece → tap a valid board cell (ghost preview on hover).
- **Drag**: press piece, drag onto board, release to place.
- **Hint**: optional rewarded stub — highlights one valid placement.

## Why IAA-strong (TikTok / 2026)

- Block / polyomino puzzles sit in the **puzzle** category (~53% of mobile game ad revenue) with a strong **block subgenre** share — high session length and frequent soft fails.
- Natural ad inventory:
  - **Banner** — always-on bottom strip (non-blocking).
  - **Interstitial** — after every **3 line-clear events** (post-satisfaction break).
  - **Rewarded revive** — 1× per run (Block Blast playbook): high intent, opt-in.
  - Optional **rewarded hint**.
- No hard paywall — ads *are* the monetization story; perfect for TikTok Mini Games IAA loops (play → ad → revive/continue → share clip).

Different from color-sort games (e.g. SortSplash): spatial packing + line clears drive longer “one more round” sessions.

## IAA stubs (wire to TTMinis)

UI stubs are visible in-game. Search the source for `TODO: TTMinis.game`:

| Placement | Trigger | Stub |
|-----------|---------|------|
| Banner | Persistent bottom | `Ad · Banner` — `createBannerAd` |
| Interstitial | Every 3 line-clear events | Full-screen 2s countdown → Continue |
| Rewarded revive | Dead end, **1/run cap** | 3s `showRewardedAd` → shuffle tray + clear one occupied row |
| Rewarded hint | Hint button | Same rewarded stub → glow valid cells |

```js
// TODO: TTMinis.game.createRewardedVideoAd
// TODO: TTMinis.game.createInterstitialAd
// TODO: TTMinis.game.createBannerAd
function showRewardedAd(onSuccess) { /* simulated countdown → onSuccess() */ }
```

**Revive mechanic:** shuffle tray with placeable-biased pieces **and** clear one random row that still has blocks (creates breathing room). Cap: only one revive per run; then only **End Run**.

## TikTok Native note

> **HTML ≠ Native upload.** This project is a single-file **HTML5** prototype for browser / WebView playtests and IAA UX review. Shipping as a **TikTok Mini Game (Native)** requires the platform’s native project format, SDK (`TTMinis.game.*`), and store packaging — not a raw `index.html` upload. Use this build to validate gameplay + ad beat sheet, then port ad calls into the official Mini Game template.

## Tech

- Vanilla HTML + CSS + JS (one file)
- No modules, no build step, no external assets
- Mouse + touch
- Portrait layout ~420px wide

## Files

| File | Purpose |
|------|---------|
| `index.html` | Full HTML5 prototype |
| `playtest.mjs` | Placement / clear / dead-end / stub checks |
| `PLAYTEST.md` | Verdict log |
| `README.md` | This file |
| `cocos/` | **Cocos Creator 3.8.8 + TypeScript** project (微信小游戏) |

### Cocos Creator (微信小游戏)

A runtime-UI port lives in [`cocos/`](./cocos/README.md). Open **that folder** in Creator 3.8.8, preview `main.scene`, then follow [`cocos/WECHAT.md`](./cocos/WECHAT.md) to export 微信小游戏 and replace placeholder `adUnitId`s.

```bash
node playtest.mjs
node cocos/playtest.mjs
```

---

## 中文简介

**BlockPop** — 类 Block Blast 的消行方块休闲游戏，面向 **IAA 广告变现**（Banner + 插屏自然断点 + 激励复活，每局限 1 次）。

- 打开 `index.html` 即可玩（支持 `file://`）。
- 8×8 棋盘，底部 3 个彩色方块；摆满整行/整列消除得分，连消有 Combo。
- 无合法落点 → 激励视频复活（洗牌托盘并清一行）或结束本局。
- **注意：** 本仓库是 HTML 原型，**不能直接当 TikTok Native 小游戏包上传**；需接入 `TTMinis.game.*` 并按官方原生工程打包。

