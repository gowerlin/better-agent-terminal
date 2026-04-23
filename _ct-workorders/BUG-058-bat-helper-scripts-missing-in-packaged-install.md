# BUG-058-bat-helper-scripts-missing-in-packaged-install

## 元資料
- **編號**：BUG-058
- **標題**：封裝佈署後 `$BAT_HELPER_DIR` 缺少 `_bat-*.mjs` helper scripts
- **狀態**：🚫 CLOSED
- **嚴重度**:🔴 High
- **發現時間**：2026-04-23 17:20 (UTC+8)
- **受影響版本**：v0.3.0（Session 23 首次正式版 release）
- **修復版本**：v0.3.1（2026-04-24 GitHub Actions release）
- **可重現性**：100%（剛打包安裝後即發生）
- **Workaround**：從 repo `scripts/` 手動 `cp` 到 `$BAT_HELPER_DIR`（v0.3.1 已根治，不再需要）
- **關閉時間**：2026-04-24 00:01 (UTC+8)
- **關閉依據**：D085（v0.3.1 NSIS installer 實測 `$BAT_HELPER_DIR` 含 4 個 `.mjs` helper，使用者驗收通過）

## 問題描述

### 重現步驟
1. 打包 v0.3.0 NSIS installer（GitHub release 下載 或本機 `npm run build:release`）
2. 安裝到 `C:/Program Files/Better Agent Terminal/`（預設路徑）
3. 啟動 BAT，觀察 `$BAT_HELPER_DIR` 內容

### 預期行為
`$BAT_HELPER_DIR` 應包含所有 repo `scripts/_bat-*.mjs` helper 檔，至少包含：
- `_bat-logger.mjs`
- `_bat-cert.mjs`
- `bat-terminal.mjs`
- `bat-notify.mjs`
- `verify-native-modules.js`（依 T0243 閉環）

### 實際行為
使用者回報 `$BAT_HELPER_DIR` **缺少 `_bat-logger.mjs`**（可能同時缺 `_bat-cert.mjs`，待 T0246 驗證）。

缺檔後果：
- 依賴 `_bat-logger.mjs` 的 helper script 執行失敗（例如 `bat-terminal.mjs` / `bat-notify.mjs` 若 `import` 了 logger 會 ENOENT）
- Worker→Tower 通知鏈路（T0133 建立）可能受影響
- Terminal helper 能力降級

## 歷史脈絡（相關 BUG / 工單）

| 編號 | 事件 | 關聯性 |
|------|------|--------|
| BUG-032 | Helper scripts 打包與路徑解析設計缺漏（T0138-T0141 修復鏈） | 同類型：helper packaging |
| BUG-056 | `@kutalia/whisper-node-addon` missing in packaged NSIS install | 同類型：打包漏檔 |
| T0243 | BUG-056 預防閉環（build fail-fast + CI `npm ci` 雙閘） | 既有預防機制未攔截此次漏檔 — 需研究原因 |
| CLAUDE.md `## Packaging / Release` | Squash merge 後打包前必做 `npm install` + `verify-native-modules.js` | 既有 runbook，但顯然未涵蓋 helper `.mjs` 檔案檢查 |

### 潛在根因假設（待 T0246 確認）
1. **`build.files` 未涵蓋 `scripts/_bat-*.mjs`** — electron-builder 預設不打包 `scripts/` 內容，需顯式加入 `files` 或 `extraResources`
2. **`build.asarUnpack` 漏收** — helper 被打進 `app.asar`，但執行時以絕對路徑 require，找不到檔案
3. **runtime 路徑解析誤差** — helper 存在於打包產物某處，但 `BAT_HELPER_DIR` 環境變數沒指到正確位置
4. **T0243 的 `verify-native-modules.js` 只檢查 native modules 不檢查 `.mjs` helper** — 預防機制有缺口

## 修復紀錄

| 工單 | 動作 | 狀態 | Commit |
|------|------|------|--------|
| T0246 | 研究 — 定位根因 + 推薦方案 A（glob 白名單）| ✅ DONE | 工單回報區 |
| T0247 | 修復 — `extraResources.filter` 改 `["*.mjs"]` | ✅ FIXED | `a460d8b` |
| T0248 | 預防 — 新增 `verify-helper-bundle.js` 靜態驗證 | ✅ DONE | `a73a965` + `1009154` |
| T0249 | Release — CHANGELOG + v0.3.1 bump + commit | ✅ DONE | `eca8ab6` |

## 關閉原因

使用者實測 v0.3.1 NSIS installer（2026-04-23 GitHub Actions release）完成安裝後，`$BAT_HELPER_DIR` 內含 4 個 `.mjs` helper 檔（`bat-terminal.mjs` / `bat-notify.mjs` / `_bat-logger.mjs` / `_bat-cert.mjs`），漏檔問題根治。

**預防機制生效**：`scripts/verify-helper-bundle.js` 已整合進 build pipeline（`build` / `build:dir` / `build:release` 三路徑），未來若 `extraResources.filter` 再度偏離 import graph，build 前即 fail-fast 攔截，不會重犯同類 regression。

---

## 塔台備註

- 使用者當下被阻擋（回報現場：剛安裝後立即發現），故評 🔴 High 而非 🟡 Medium
- BUG-032 / BUG-056 已建立 helper / native module packaging 的修復模式 → T0246 優先比對這兩個先例
- T0243 `verify-native-modules.js` 清單需要考慮擴充（若研究結論指向「預防機制缺口」）
