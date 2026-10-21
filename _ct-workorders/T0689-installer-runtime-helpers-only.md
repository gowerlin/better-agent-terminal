---
schema_version: 1
schema_kind: workorder
id: T0689
title: "安裝檔的 resources/scripts 只收執行期 helper：extraResources 改成明列白名單（與 serverBundleHelperScripts 同一組），verify 腳本守住，build:dir 實測"
type: chore
status: TODO
repo: better-agent-terminal
project: D179
priority: P2
sizing: S
created_at: "2026-10-21T22:00:10+0800"
depends_on: []
related:
  - "D179（v0.7.1-pre.5 發版前的小批：T0687／T0688／T0689；使用者選「併入這批」）"
  - "現況：`package.json` `build.extraResources` = `[{ from: 'scripts', to: 'scripts', filter: ['*.mjs'] }]`，所有 `scripts/*.mjs`（含 T0685 新增的 `run-legacy-tests.mjs` 與 build / smoke / migrate 等開發腳本）都進安裝檔"
  - "BUG-058 / T0247：舊的明列白名單漏了 `_bat-logger.mjs`、`_bat-cert.mjs`（helper 的相對 import），安裝版 helper 起不來，才改成 `*.mjs`；之後 `scripts/verify-helper-bundle.js` 加了 import 封閉性檢查"
  - "T0433：`scripts/build-server-bundle.mjs` 的 `serverBundleHelperScripts`（bat-terminal、bat-notify、bat-mcp、bat-hook、_bat-cert、_bat-logger）是 headless PTY 的執行期 helper 清單，`verify-helper-bundle.js` 已檢查它的封閉性"
  - "本機 PTY 的 `BAT_HELPER_DIR`：`localHelperDir()`（`electron/main.ts`，打包版 = `process.resourcesPath/scripts`）；CT skill 的後備路徑 `C:\\Program Files\\BetterAgentTerminal\\resources\\scripts\\bat-terminal.mjs` / `bat-notify.mjs`"
affects_files:
  - package.json
  - scripts/verify-helper-bundle.js
  - scripts/verify-packaged-native.js
  - scripts/__tests__/server-bundle-helpers.test.mjs
  - scripts/__tests__/verify-packaged-native.test.mjs
  - CLAUDE.md
  - docs/agent-guide/packaging-release-checks.md
  - docs/plan-007-release-checklist.md
  - _ct-workorders/T0689-installer-runtime-helpers-only.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先盤點再改：列出 `scripts/*.mjs` 逐檔分「執行期」／「開發用」，每檔附證據（打包版誰從 `<resources>/scripts/` 讀它：`localHelperDir()` → `BAT_HELPER_DIR`、`electron/bat-mcp-launch.ts` 的 shim / hook 路徑、Docker／WSL／SSH 流程是否從安裝目錄複製或掛載 helper、其他 `process.resourcesPath` 消費者、CT 的後備路徑）。塔台初判（待你證實）：執行期 = `serverBundleHelperScripts` 那 6 個；`bat-server.mjs` 與 `_bat-server-helpers.mjs` 只在建置 server bundle 時從 repo 讀，其餘是開發腳本。若有證據顯示某個「開發用」檔案在打包版執行期會被讀到，保留它並在回報說明。"
  - "🔴 `package.json` 只改 `build.extraResources[0].filter`：由 `['*.mjs']` 改成明列執行期 helper 的檔名（不用萬用字元）。其他 build 設定不動；不得使用 `build.<platform>.extraResources` / `files`（CLAUDE.md 🔴）。"
  - "🔴 `scripts/verify-helper-bundle.js`：保留既有 import 封閉性與 D146 baseline 檢查；新增：① filter 的每一項必須是字面檔名（出現萬用字元即失敗，避免改回 `*.mjs` 又把開發腳本打進去）；② filter 的集合必須等於 `serverBundleHelperScripts`（本機與 headless 用同一組執行期 helper；任一邊多或少都失敗，訊息寫清楚兩處都要加）；③ 錯誤訊息裡「改回 `*.mjs`」的建議改成「把檔名加進白名單與 `serverBundleHelperScripts`」。若你認為兩組不該強制相等，先問塔台。"
  - "🔴 `scripts/verify-packaged-native.js`（CI 打包後跑）：新增打包產物檢查，`resources/scripts` 必須正好是執行期那組（缺任何一個或多出任何 `.mjs` 都失敗並列出檔名）。沿用腳本現有的各平台 resources 目錄解析（win / linux 的 `resources/`、mac 的 `.app/Contents/Resources/`），並在 `scripts/__tests__/verify-packaged-native.test.mjs` 以三個平台的 fixture 測綠與紅。mac 無法本機實測，fixture 必須涵蓋。"
  - "🔴 實測：`npm run verify:helpers` 綠；`npm run build:dir`（本單會清掉並重建 `dist-electron`，同批 T0688 已被告知不要同時建置）；列出 `release/win-unpacked/resources/scripts` 的檔案（應正好 6 個）；以 CI 的方式跑 `verify-packaged-native.js` 對 `release/` 綠；在打包目錄裡實際執行 `bat-terminal.mjs` 與 `bat-notify.mjs`（用不需要連線的參數，例如 `--help` 或缺參數的用法錯誤），證明沒有 `ERR_MODULE_NOT_FOUND`。只碰 `release/` 的產物，不得動已安裝的 BAT（`C:\\Program Files\\BetterAgentTerminal`）。"
  - "🔴 相關測試：`npx vitest run scripts/__tests__/server-bundle-helpers.test.mjs scripts/__tests__/verify-packaged-native.test.mjs scripts/__tests__/asar-runtime-deps.test.mjs`（fixture 若寫 `*.mjs` 要跟著改，並補紅燈案例：萬用字元、少一個 helper、與 `serverBundleHelperScripts` 不一致、打包產物多出開發腳本）。`scripts/build-version.js` 會 `require('./verify-helper-bundle')`，確認它仍可用。整包 `test:unit` 由塔台在這批收齊後一起跑。"
  - "🔴 文件：CLAUDE.md「Packaging / Release 前置檢查」節的 **Helper bundle fail-fast** 那條改寫（安裝檔只收執行期 helper、白名單與 `serverBundleHelperScripts` 同一組、新增 helper 兩處都加並跑 `npm run verify:helpers`），一兩句，細節放 `docs/agent-guide/packaging-release-checks.md`（Helper bundle fail-fast 段、打包產物檢查項目）；`docs/plan-007-release-checklist.md` 第 30–33 行若仍寫「每個 `scripts/*.mjs`」一併改。遵守 CLAUDE.md 開頭的撰寫規則。"
  - "🔴 CLAUDE.md 與同批 T0687 重疊（T0687 改「BAT MCP shim」節）。commit 前先跑 `git diff -- CLAUDE.md`：只能有本單的 hunk。若出現別的 hunk，不要 commit CLAUDE.md，用 BAT 通道問塔台。"
  - "🔴 Git：`git commit --only <檔案>`；不 push；不觸發任何 workflow。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122），本單原則上不需要 gh。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報裡的路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題問塔台。"
---

# T0689 — 安裝檔只收執行期 helper

## 目標

安裝檔目前把 `scripts/` 底下所有 `.mjs` 都放進 `resources/scripts`，其中大多是開發與建置用的腳本（T0685 新增的 `run-legacy-tests.mjs` 也在內）。改成只收執行期 helper，並讓 verify 腳本在打包前、打包後都守住，避免 BUG-058（漏掉 helper 的相對 import）重演。併入 `v0.7.1-pre.5` 發版批次（D179）。

## 要做的事

1. 盤點 `scripts/*.mjs`：逐檔分執行期／開發用，附證據。
2. `package.json` `build.extraResources[0].filter` 改成明列執行期 helper。
3. `scripts/verify-helper-bundle.js`：字面檔名、與 `serverBundleHelperScripts` 相等、錯誤訊息。
4. `scripts/verify-packaged-native.js`：打包產物的 `resources/scripts` 正好是執行期那組（三平台 fixture 測試）。
5. `verify:helpers`、`build:dir`、打包產物檢查、打包目錄裡實際執行 helper。
6. CLAUDE.md 與 docs。

## 驗收

- 盤點表（檔名、分類、證據）；`release/win-unpacked/resources/scripts` 正好是執行期那組。
- `npm run verify:helpers` 綠；萬用字元、少一個、兩組不一致、打包產物多出開發腳本都有紅燈測試。
- 打包目錄裡 `bat-terminal.mjs`、`bat-notify.mjs` 可執行、沒有 `ERR_MODULE_NOT_FOUND`。
- 文件已更新；只改 `affects_files`；未 push、未觸發 workflow。

---

## 回報區

### 完成狀態

### 修改內容

### 驗證結果

### Commit

### 遭遇問題

### 互動紀錄

### 回報時間
