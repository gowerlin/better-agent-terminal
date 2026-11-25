---
schema_version: 1
schema_kind: workorder
id: T0924
title: "BUG-223：`verify-packaged-native.test.mjs`〈reads an app.asar written by @electron/asar〉偶發讀到全 NUL —— 查根因並修，讓 CI Test gate 不再偶發失敗"
type: bugfix
status: IN_PROGRESS
repo: better-agent-terminal
project: BUG-223
priority: P2
sizing: S
created_at: "2026-11-25T21:38:19+08:00"
started_at: "2026-11-25T21:39:31+08:00"
updated_at: "2026-11-25T21:39:31+08:00"
target_version: "0.8.0-pre.4"
depends_on: []
related:
  - "BUG-223；desktop-build run `45621864786` job `139231964283`（`tests` → `Unit tests (vitest)`）；T0546（測試來源）；BUG-218 / BUG-219（同類測試穩定度單的寫法）"
affects_files:
  - _ct-workorders/T0924-fix-bug223-asar-roundtrip-test.md
  - scripts/__tests__/verify-packaged-native.test.mjs
  - scripts/verify-packaged-native.js
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0924` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。與 T0923（`e2e/manual/`、`e2e/fixtures/`）平行，不得碰那兩處。"
  - "🔴 根因優先：先判斷是測試寫法（例：`createPackageWithOptions` 回傳時資料尚未寫完、暫存目錄被並行測試清掉 / 重用）還是 `scripts/verify-packaged-native.js` 的 `readAsar` / `readAsarFile`（第 385–440 行附近）讀取邏輯有錯（例：offset / 對齊 / 讀到未寫完的檔）。讀 `node_modules/@electron/asar`（lock `3.4.1`）的寫入流程佐證。若是產品檢查程式（`verify-packaged-native.js`）的錯，修正後打包產物檢查的判定不得放寬（🔴 不得以略過、重試吞掉錯誤、或改弱斷言當作修正）。若只能證明是測試競態，修測試本身（例：等寫入真正完成、每個測試用獨立暫存目錄），斷言內容不變。"
  - "🔴 重現：先試著在本機重現（同一測試連跑多次，例 `npx vitest run scripts/__tests__/verify-packaged-native.test.mjs -t 'reads an app.asar' --repeat` 或迴圈 100 次以上；可行時也在 WSL / Linux 跑）。重現不到時寫明嘗試次數與環境，依讀碼證據修，並說明為何修正能排除該路徑。"
  - "🔴 驗證：worktree `npm ci`；修正後該測試檔連跑 ≥ 100 次全過（附次數）；`npm run test:unit` 在 head 第一次完整執行全綠（附 passed / files 數）；`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0。改到 `verify-packaged-native.js` 時另跑 `node scripts/verify-packaged-native.js --help` 或其單元測試全檔確認行為不變。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 公開 repo（D176）：程式、註解、回報區不寫真名、家目錄路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0924 — BUG-223：asar 往返測試偶發讀到全 NUL

## 背景

PLAN-069 驗收版打包（desktop-build run `45621864786`，`main` `402c9648`）的 `tests` job 有一個失敗：`scripts/__tests__/verify-packaged-native.test.mjs` › `verifyPackagedWin (T0546)` › `reads an app.asar written by @electron/asar (packed and unpacked files)`，第 984 行 `readAsarFile(archive, 'node_modules/ws/package.json')` 讀到 `\u0000…`（第 983 行檔案清單正確）。其餘 9059 個測試通過。該測試檔與 `verify-packaged-native.js` 自 T0887 起沒改，`v0.8.0-pre.3` CI 通過。發版 workflow 的 Test gate（T0686）遇到會擋發版，使用者裁示在 `0.8.0-pre.4` 前修（U-8：A）。

## 驗收

- [ ] 根因（測試競態或讀取邏輯），附證據（讀碼位置、重現結果）
- [ ] 修正不放寬任何檢查、不改斷言內容
- [ ] 該測試檔連跑 ≥ 100 次全過；`npm run test:unit` head 第一次全綠；`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] BUG-223 的處置建議寫在回報區（塔台改 BUG 狀態）

---

## 回報區

### 完成狀態

### 根因

### 產出摘要

### 驗證

### 互動紀錄

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0924`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
