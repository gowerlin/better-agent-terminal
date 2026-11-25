---
schema_version: 1
schema_kind: bug
id: BUG-223
title: "CI 單元測試 `verify-packaged-native.test.mjs`〈reads an app.asar written by @electron/asar〉偶發讀到全 NUL（`node_modules/ws/package.json` 內容是 `\\u0000…`），測試失敗"
status: FIXED
severity: low
reproducibility: "rare（ubuntu runner 第一次見：desktop-build run `45621864786` `tests` job，`main` `402c9648`；同檔自 T0887 起未改，pre.3 CI 綠）"
created_at: "2026-11-25T21:36:50+08:00"
updated_at: "2026-11-25T21:52:23+08:00"
impact:
  - tests
  - ci
links:
  discovered_in: "desktop-build run `45621864786`（D350，PLAN-069 驗收版打包）"
  related: [T0546, T0922, BUG-218, BUG-219]
---
# BUG-223 — asar 往返測試偶發讀到全 NUL

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響測試；但 CI Test gate（T0686）失敗會擋 `pre-release.yml` 的 build / 發版） |
| 可重現 | 少見：第一次出現 |
| **狀態** | ✅ FIXED（T0924 `1eb8f5ee`；合併後下一次 CI `tests` 綠燈 → CLOSED，D352） |
| 回報者 | 塔台（desktop-build run `45621864786` 的 `tests` job） |
| 影響版本 | `main` `402c9648`（測試檔與 `scripts/verify-packaged-native.js` 自 T0887 `a05a9c79` 起未改；`v0.8.0-pre.3` CI 同一測試通過） |

## 現象（預期 vs 實際）

- **預期**：`scripts/__tests__/verify-packaged-native.test.mjs` › `verifyPackagedWin (T0546)` › `reads an app.asar written by @electron/asar (packed and unpacked files)` 通過。
- **實際**（ubuntu-latest，Node 由 workflow 設定）：`expected '\u0000\u0000…' to be '{"name":"ws"}'`（第 984 行，`readAsarFile(archive, 'node_modules/ws/package.json')`）。同 run 其他 9059 個測試通過；Test Files 1 failed / 497 passed。
- 與 T0922（PLAN-069）無關：T0922 沒有改 `scripts/` 與打包相關程式。

## 初步推論（未查證）

- 測試在 `await asar.createPackageWithOptions(...)` 之後立刻以 `readAsar` 讀檔；header 已寫入（檔案清單正確，第 983 行通過），但打包的檔案內容讀到 0。可能是 `@electron/asar`（lock 內 `3.4.1`）的 promise 在資料串流真正寫完前就 resolve，或讀取端用到尚未落盤的長度。需查 `@electron/asar` 寫入流程與 `readAsar` / `readAsarFile`（`scripts/verify-packaged-native.js`）。

## 證據

- run `45621864786` job `139231964283`（`tests` → `Unit tests (vitest)`）日誌第 322、12808–12828 行。

## 處置

- 2026-11-25 23:41 佐證：含修正的 `main` `56ca6e66` desktop-build run `45644734317` 的 `tests` job 綠燈（單次綠燈只是佐證）；照 BUG-218 前例，等 `0.8.0-pre.4` 發版的 CI Test gate 也綠再 CLOSED。
- 2026-11-25 21:52 T0924 FIXED（`1eb8f5ee`）：根因在測試——`@electron/asar` 3.4.1 `createPackageWithOptions` 回傳 `out.end()` 的串流、不等寫完（`disk.js` 第 60–66、85 行），最後打包的 `ws/package.json` 偶爾還沒寫入就被讀；測試改 `await finished(out)` 再讀，斷言不變，`verify-packaged-native.js` 未改。慢寫入對照：修正前 20/20 讀到 NUL、修正後 30/30 通過；整檔連跑 120/120。後續建議（未開單）：`readAsarFile` 檢查 `readSync` 位元組數，讀不足判失敗。
- 2026-11-25 21:38 使用者裁示 U-8：A —— `0.8.0-pre.4` 發版前修，修正單 T0924（與 T0923 平行，D351）。
