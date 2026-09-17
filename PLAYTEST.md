# BlockPop — PLAYTEST

**Date:** 2026-09-17 (Asia/Shanghai)  
**Build:** `/workspace/blockpop/index.html`  
**Runner:** `node playtest.mjs` + `node --check` on extracted script

## Automated results

```
Results: 33 passed, 0 failed
VERDICT: READY
node --check: OK
```

### Coverage
- [x] Inline script extractable; VM + `node --check` clean
- [x] Placement: bounds, occupied, I-tetromino overflow
- [x] Line clear: row, column, row+col combo
- [x] Dead-end: full board; single-hole vs multi-cell tray
- [x] Soft start: empty 8×8 accepts sizes 1–4
- [x] IAA greps: `Ad · Banner`, Interstitial, Rewarded, `TODO: TTMinis.game`, revive CTA, 1/run cap, interstitial cadence
- [x] Branding: BlockPop, tagline, localStorage, ~420px

## Manual logic review
- Early tray biased to size ≤3 → always placeable on empty board
- Refill retries up to 20× if no piece fits
- Dead end when no remaining tray piece has any legal cell
- Interstitial every 3 line-clear events (after clear animation)
- Revive: rewarded 3s stub → shuffle tray + clear one occupied row; `reviveUsed` enforces 1/run
- Banner does not block play (`padding-bottom: 56px`)
- Hint rewarded path glows a valid placement

## Ad stub matrix
| Stub | Visible | Trigger |
|------|---------|---------|
| Banner | Yes | Persistent bottom |
| Interstitial | Yes | Every 3 clears → 2s → Continue |
| Rewarded revive | Yes | Dead end, max 1/run |
| Rewarded hint | Yes | Hint button |

## Verdict

**READY**

