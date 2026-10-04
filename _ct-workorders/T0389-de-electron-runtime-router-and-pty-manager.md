---
schema_version: 1
schema_kind: workorder
id: T0389
title: "PLAN-036 P0-B：去 Electron 化 —— claude-runtime-router 設定注入 + embedded resolver 合一（含 bundle `bin/claude`）+ PtyManager DI"
type: implementation
status: IN_PROGRESS
priority: P1
sizing: M
created_at: "2026-10-04T23:58:00+08:00"
updated_at: "2026-10-05T00:05:55+08:00"
started_at: "2026-10-05T00:05:55+08:00"
completed_at: null
target_version: next
depends_on: [T0387]
related:
  - "PLAN-036 / D129"
  - "T0386 回報區 §2、§3（改動面與回歸風險）、§4（claude runtime / helper env）、建議工單清單 B"
affects_files:
  - electron/claude-runtime-router.ts
  - electron/claude-agent-manager.ts
  - electron/pty-manager.ts
  - electron/main.ts
  - electron/__tests__/claude-runtime-router.test.ts
  - electron/__tests__/pty-manager-deps.test.ts
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。比對 baseline 用 `git show HEAD:<path>` 或 `git worktree add` 到 scratchpad。"
  - "🔴 **No Regressions**：`PtyManager` 是本機終端 / Terminal Server proxy / heartbeat recovery 的共同依賴（`main.ts:975`、`:1336-1338`、`:1507-1510`）。Electron 端以 `createElectronPtyDeps()` 保持原行為；本機 smoke（開終端、claude-cli preset、Agent 面板）必做。"
  - "🔴 `DISABLE_UPDATES` 只給 embedded、system 絕不注入（CLAUDE.md T0372 規則）；不得改 `DISABLE_AUTOUPDATER` 注入點語意。"
  - "⚠️ 依賴 T0387 commit（同改 `electron/main.ts`）；派發時 T0387 應已完成。不 push。"
---

# T0389 — runtime router / embedded resolver / PtyManager DI

## 範圍（依 T0386 §2-§4）

1. `claude-runtime-router.ts`：設定來源改注入（Electron = `app.getPath('userData')/settings.json` 原行為；headless = `dataDir`），模組本身不 import `electron`
2. **embedded resolver 合一**：目前三份（`claude-runtime-router.ts:82-107`、`claude-agent-manager.ts:107-134`、`main.ts:2259-2266`）一律找 `bin/claude.exe`；合為單一函式，依平台 / 版型解析（Windows `claude.exe`；server bundle POSIX wrapper `node_modules/@anthropic-ai/claude-code/bin/claude`，headless 由 deps 注入 install root）。三處改呼叫同一函式，Electron 端行為不變
3. **PtyManager DI**：建構子改收 deps（`emit` / `dataDir` / `helperDir` 等），移除對 `electron` `app` / `BrowserWindow` 的直接依賴；`BAT_HELPER_DIR` 由 deps 決定（headless 傳空 → 不注入）；Electron 端 `createElectronPtyDeps()` 維持原行為
4. 本單**不**註冊任何新 headless channel（T0390 做）

## 驗收

- unit：router 設定注入（兩種來源）、resolver（Windows / bundle POSIX / 找不到）、PtyManager deps（不注入 helper dir、emit 被呼叫）
- `npm run test:unit` 全綠（回報新數字）；`npx vite build` exit 0；`npx tsc --noEmit` ≤ **40**
- 若 T0388 的 electron-free guard 已在 HEAD：`pty-manager.ts` / `claude-runtime-router.ts` 需能通過（回報結果）
- **本機 smoke**（`npm run dev` 或等價）：一般終端、claude-cli preset 分頁、Claude Agent 面板對話各一次正常

## Sub-session 執行指示

1. 讀取本工單 + PLAN-036 + **T0386 回報區**
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

- **開始**：2026-10-05T00:05:55+08:00（Worker，`CT_MODE=on`、`CT_INTERACTIVE=0`）
- **落點檢查**：WARN —— C-0 無法判定（frontmatter **無 `repo` 欄位**；`basename(REPO_ROOT)` = `better-agent-terminal`）；C-1 PASS（工單在 REPO_ROOT 下）；C-3 PASS（`affects_files` 前 5 項皆存在）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- **結果**：DONE。範圍 1-3 全部落地，未註冊任何 headless channel（範圍 4）；全部驗收閘門通過（含本機 smoke 三項）
- **平行狀況**：執行期間 T0388（`694771c`）、T0391、T0392 由其他 Worker 在同一 working tree commit；與本單檔案無重疊，本單 commit 以 `git commit --only` 只收本單檔案

### 1. claude-runtime-router 設定注入

- 移除 `import { app } from 'electron'`；新增 `configureRuntimeRouter({ getDataDir?, getEmbeddedLayout? })`（`electron/claude-runtime-router.ts`）
  - `getDataDir` 為 getter：Electron = `() => app.getPath('userData')`（保留 `--runtime` 的 `app.setPath('userData')` 時序語意）；headless = `() => dataDir`
  - 未設定 → `getRuntimeSettingsSnapshot()` 回 `DEFAULT_CLAUDE_RUNTIME_SETTINGS` 並 warn 一次（與原「讀檔失敗 → 預設」同一降級路徑）
- Electron 端於 `main.ts` 模組層、`--runtime` userData 決定之後呼叫 `configureRuntimeRouter`（packaged → `electron-packaged` + `process.resourcesPath`；dev → `node-modules`）
- 既有 DI seam `ResolveClaudeRuntimeDeps` 不變（`resolve-claude-base-command.test.ts` 等既有測試照過）

### 2. embedded resolver 合一

- 單一實作 `resolveEmbeddedClaudePath(layout?, platform?, resolvePackageJson?)`，`EmbeddedClaudeLayout` 三型：
  | layout | 路徑 | binary |
  |---|---|---|
  | `electron-packaged` | `<resourcesPath>/app.asar.unpacked/node_modules/@anthropic-ai/claude-code/bin/` | `claude.exe`（所有平台，BUG-052 原行為） |
  | `node-modules` | 由 module graph 解析 `@anthropic-ai/claude-code/package.json` 的 `bin/` | `claude.exe`（原行為；找不到回 `''`） |
  | `server-bundle` | `<installRoot>/node_modules/@anthropic-ai/claude-code/bin/` | POSIX `claude`（`build-server-bundle.mjs` 的 wrapper）；win32 → `claude.exe` |
- 三處改呼叫同一函式：router（`resolveClaudeRuntime` 預設）、`claude-agent-manager.ts`（刪除 `resolveClaudeCodePath` 副本，BUG-047 assertion 改呼叫 router；順帶移除不再使用的 `createRequire` import）、`main.ts` `claude:detectRuntime`（刪除 inline 副本，改 dynamic import router，沿用該 handler 原本的 dynamic import 風格）
- 未改 `claude-agent-manager.ts` 的其他 Electron 耦合（`Notification` / `webContents` / settings 讀取，屬 P1 工單 E）

### 3. PtyManager DI

- 建構子 `new PtyManager(deps: PtyManagerDeps)`，`PtyManagerDeps = { emit, dataDir, helperDir? }`；`pty-manager.ts` 不再 import `electron`
  - `emit` 取代原 `broadcast` 內的 window 迴圈 + `broadcastHub`
  - `dataDir` 取代 `handleServerDeath` 的 `app.getPath('userData')`（孤兒 PTY registry）
  - `helperDir` 決定 `BAT_HELPER_DIR`：三個 env 區塊（Terminal Server proxy / node-pty / child_process）改 `...this.helperDirEnv()`，位置不變故覆蓋順序不變；空值 → 不注入
- 匯出 `createWindowBroadcastEmit(getWindows)`（結構型別 `PtyEventWindow`，不依賴 electron 型別），即原 `broadcast` 行為（略過 destroyed、吞掉 disposed frame 例外、再送 broadcastHub）
- `main.ts` 新增 `createElectronPtyDeps()`（emit = `createWindowBroadcastEmit(getAllWindows)`、dataDir = userData、helperDir = 原 `resolveHelperDir` 邏輯），兩個建構點（`createWindow` guard、`app.whenReady`）改用它；`getRemoteServerInfo` / `onRequestNewServer` 設定方式不變
- 語意差異（記錄）：`dataDir` 由「server death 時才讀」改為「建構時讀一次」；兩個建構點都在 `app.setPath('userData')`（模組層）之後，值相同

### 驗收證據

| 證據道 | 結果 | 內容 |
|---|---|---|
| unit（新增） | PASS | `electron/__tests__/claude-runtime-router.test.ts` +13：設定來源（未設定 → 預設、Electron userData getter、headless dataDir 且 getter 每次重讀、settings 缺檔 / 壞檔 → 預設）、resolver（packaged 三平台皆 `claude.exe`、bundle linux/darwin `bin/claude`、bundle win32 `claude.exe`、node-modules 解到實際套件、找不到 → `''`、設定的 layout 被 `resolveClaudeRuntime` embedded 模式採用）。`electron` mock 改為「被 import 即 throw」 |
| unit（新增） | PASS | `electron/__tests__/pty-manager-deps.test.ts` 5 項：真 node-pty 開 shell 驗 `helperDir` 未給 → 子行程無 `BAT_HELPER_DIR`、給值 → 等於該值，且 `emit` 收到 `pty:output` + `pty:exit`；`createWindowBroadcastEmit` 扇出行為；esbuild resolve 掃描 `pty-manager.ts` / `claude-runtime-router.ts` 傳遞依賴不含 `electron`。連跑 3 次穩定（~2.4s） |
| `npm run test:unit` | PASS | **73 files / 1039 tests 全綠**（含本單新增 18：router 13 + pty-manager-deps 5；另含 T0388/T0391 平行新增之測試） |
| `npx vite build` | PASS | exit 0（兩次：HEAD=`79c8698` 時與 T0388 `694771c` 入 HEAD 後） |
| `npx tsc --noEmit` | PASS | **40**（≤ 40）；分佈 `CodexAgentPanel.tsx` 33、`terminal-keyboard-event.test.ts` 5、`agent-profiles.ts` 1、`integration.transitions.test.ts` 1，**本單觸及檔案 0 個** |
| T0388 electron-free guard | PASS | T0388 於本單執行中 commit（`694771c`）。`headless-electron-free.test.ts` 4/4 通過；另以其 `loadServerBundleEsbuildConfig()` 真實 bundle 設定、entry = `pty-manager.ts` + `claude-runtime-router.ts` 跑同法 resolve 掃描（暫存測試，跑完已刪）→ 無任何 `electron` resolve |
| 本機 smoke | PASS | Playwright `_electron` 啟動 build 後 app（獨立 `--runtime=t0389-smoke-*`，剝除 `BAT_*` env），經 preload `window.electronAPI`（與 UI 同一 IPC 路徑）：① 一般終端：`pty:create` → Terminal Server proxy 模式（log `pty:create … → Terminal Server`），env `BAT_HELPER_DIR=<repo>\scripts`、`DISABLE_AUTOUPDATER=1`、**無** `DISABLE_UPDATES`、`BAT_TERMINAL_ID` 正確，`getCwd` 正確，`exit` → `pty:exit` code 0；② claude-cli preset：`claude:get-cli-path` 與 `claude:detectRuntime` embedded 皆為 `node_modules\@anthropic-ai\claude-code\bin\claude.exe`（healthy 2.1.289），分頁 env `DISABLE_UPDATES=1`（T0372 規則維持）、執行 `--version` → `2.1.289 (Claude Code)`；③ Claude Agent：`claude:start-session` + `send-message` → `claude:result` subtype `success`、回覆 `T0389-SMOKE-OK`。關閉後 log 為 `beginShutdown` + `IPC exit during shutdown — skip re-fork`，Terminal Server pid 已不存在，無殘留行程；smoke 的 runtime userData 目錄已刪除 |
| 未涵蓋 | — | 未點擊真實 UI 元件（smoke 走 preload API，非 DOM 操作）；packaged 安裝版路徑（`electron-packaged` layout）僅 unit 覆蓋，屬 release 驗收道 |

### 偏差 / 風險 / 後續

- `resolveEmbeddedClaudePath` 多一個可注入的 `resolvePackageJson` 參數（預設 = 原 createRequire → require.resolve 鏈），為了能測「找不到」；語意與原巢狀 try 相同
- headless `helperDir` 空值時「不注入」，但**不會清除**從 server 行程 env 繼承來的 `BAT_HELPER_DIR`（例如 bat-server 從 BAT 終端內手動啟動時）。建議 T0390「env 隔離」一併決定是否 `delete`
- `claude-agent-manager.ts` 仍 import `electron`（P1 工單 E 範圍）；本單只移除其 embedded resolver 副本
- PTY 測試在 Windows 用 `cmd.exe`、POSIX 用 `/bin/bash`（不存在則丟錯）；CI 若在無 bash 的極簡 Linux 映像會失敗——目前 repo CI 三平台皆有 bash
- 先前一度誤判「ConPTY 首次 spawn 的 `pty:exit` 不穩」而移除 exit 斷言，實為測試正規式標記格式錯誤（`M::E` vs `M:::E`）；已修正並恢復 exit 斷言

### 變更檔案

- `electron/claude-runtime-router.ts`
- `electron/claude-agent-manager.ts`
- `electron/pty-manager.ts`
- `electron/main.ts`
- `electron/__tests__/claude-runtime-router.test.ts`
- `electron/__tests__/pty-manager-deps.test.ts`（新）
- 本工單檔

### Commit

- `git commit --only` 僅上列檔案；未 push。hash 見 commit 後 `git log`（回報區寫入在 commit 之前，不自我引用）
