---
schema_version: 1
schema_kind: workorder
id: T0424
title: "遠端 PTY 達上限（PtyLimitError）時 renderer 顯示提示，而非空白終端"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: S
created_at: "2026-10-05T05:35:22+08:00"
started_at: "2026-10-05T05:45:08+08:00"
updated_at: "2026-10-05T05:52:16+08:00"
completed_at: "2026-10-05T05:52:16+08:00"
target_version: next
depends_on:
  - T0419
related:
  - "T0404 回報區 / PLAN-036「T0404 後續建議」：renderer `pty.create` 為 fire-and-forget，達上限時使用者只看到空白終端"
  - "`electron/pty-manager.ts` PtyLimitError（約 :79、:569）；`headless-entry.ts` `HEADLESS_MAX_PTYS_DEFAULT = 64` / `BAT_SERVER_MAX_PTYS`"
  - "T0403（`pty:create` 回傳 `{ ok, created }`）"
  - "D134（本 session 排程表第 8 列）"
affects_files:
  - src/components/WorkspaceView.tsx
  - src/stores/workspace-store.ts
  - src/App.tsx
  - src/lib/pty-replay.ts
  - electron/handlers/pty.ts
  - electron/pty-manager.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先確認現況**：以程式碼證據回答 (a) 達上限時 `pty:create` 對 renderer 回什麼（reject？`{ ok: false, error }`？）；(b) renderer 各呼叫點（`WorkspaceView.tsx`、`workspace-store.ts`、`App.tsx`、`pty-replay.ts`、`useRemoteToolInstall.ts`）是否 await 並處理結果；(c) 本機 Electron PtyManager 是否也有上限（本機行為不得改變，除非本機也會遇到同樣空白終端）。"
  - "🔴 UI 呈現：沿用專案既有 toast 機制（找現有 toast 元件 / store，不要新造），並在該終端區塊寫一行可讀訊息（i18n 三語：en / zh-TW / zh-CN）。錯誤辨識用結構化欄位（error code / name），**不要**以英文訊息字串比對。"
  - "🔴 依賴 T0419（同改 `src/App.tsx`）。開工前 `git log --oneline -3` 確認。"
  - "🔴 同工作樹有其他 Worker 平行。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL。"
---

# T0424 — 遠端 PTY 達上限 UI 提示

## 背景

T0404 為 headless server 加了 PTY 上限（預設 64，`BAT_SERVER_MAX_PTYS` 可調）與孤兒回收。超過上限時 `pty:create` 被拒（`PtyLimitError`），但 renderer 的 `pty.create` 為 fire-and-forget → 使用者只看到空白終端，不知道原因。

## 範圍

1. 現況確認（memory_overrides 第 1 條）
2. 讓上限錯誤以結構化形式回到 renderer（若 T0403 的 `{ ok, created }` 結果可擴充 `{ ok: false, code: 'PTY_LIMIT', limit }` 即沿用；跨 RemoteClient 代理時 error 序列化需實測可保留 code）
3. renderer 在建立終端處處理：toast + 終端區塊訊息；不自動重試
4. i18n 三語
5. 測試：handler 回傳結構、renderer 處理（RTL）、代理序列化保留 code

## 驗收條件

- [ ] 回報區附現況結論
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [ ] 回報區附實機步驟（WSL：`BAT_SERVER_MAX_PTYS=2` 之類設定低上限 → 開第 3 個終端看到提示）；實機由使用者執行，本單不部署

## Sub-session 執行指示
1. 讀本工單 + T0404 回報區 + `electron/pty-manager.ts` / `electron/handlers/pty.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 現況確認 → 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** — 結構化上限結果 + toast + 終端區塊訊息 + i18n 三語 + 測試。實機驗證待使用者執行（本單不部署）。

**Landing check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` == `basename(REPO_ROOT)` `better-agent-terminal` → PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：`affects_files` 前 5 項皆存在 → PASS（informational）
- C-2：無 `branch` 欄位；HEAD = `main`
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- 依賴確認：`git log --oneline -3` 頂端為 `038c98e`（T0419）✅

### 產出摘要

#### 1. 現況結論（memory_overrides 第 1 條）

- **(a) 達上限時 `pty:create` 回什麼**：`PtyManager.create()`（`electron/pty-manager.ts` :567-571）`throw new PtyLimitError(limit)`（`code = 'PTY_LIMIT_REACHED'`、`limit`）；`registerPtyHandlers` 的 `pty:create` 不攔 → 例外上拋。
  - 經 remote：`remote-server.ts` :491-494 catch 後只送 `{ type: 'invoke-error', error: message }`；`remote-client.ts` :413-414 `reject(new Error(frame.error))` → **`code` / `limit` 遺失**，只剩英文訊息。
  - 再經 Electron IPC（`bindProxiedHandlersToIpc` → `ipcMain.handle`）：renderer 收到 `Error invoking remote method 'pty:create': Error: PTY limit reached…`，自訂屬性同樣不保留。
  - ⇒ 現況 renderer **無法以結構化欄位辨識**上限錯誤。
- **(b) renderer 各呼叫點**：
  - `WorkspaceView.tsx`：5 處裸 `window.electronAPI.pty.create(...)` **完全 fire-and-forget**（預設 agent 終端、預設終端迴圈、`handleAddTerminal`、`handleAddTerminalWithShell`、`handleAddAgent`）→ rejection 未處理，終端空白。另 3 處（restore 迴圈、`startClaudeCliPty`、login terminal）經 `createPtyWithReplay` / `createPtyThenLaunch`，有 await，但 catch 把任何 reject 當 `{ ok: false, created: true }` 吞掉 → 仍空白（且會照打 launch 指令）。
  - `pty-replay.ts`：`normalizePtyCreateResult` 只讀 `ok` / `created`。
  - `useRemoteToolInstall.ts`：安裝分頁走 `createPtyThenLaunch` → `install-runner` 已處理 `!ok` 並 toast `remoteToolInstall.error.ptyFailed`；隱藏的 `$HOME` probe 走 `normalizePtyCreateResult`（非使用者可見終端）。
  - `App.tsx`：只用 `pty.createWithCommand`（`terminal:create-with-command`），該 channel headless 未實作（`headless-channel-status.ts` P3），不會碰到 PTY 上限 → **不需改**。
  - `workspace-store.ts`：無 `pty.create` 呼叫（只有 `:323` 的註解）→ **不需改**。
- **(c) 本機 Electron PtyManager**：`main.ts` :1009 / :1389 `new PtyManager(createElectronPtyDeps())` 不帶 `maxInstances` → 無上限；上限檢查 `limit && limit > 0` 不成立。**本機行為不變**（本機不會收到 `PTY_LIMIT_REACHED`，新增的 UI 路徑對本機不觸發）。

#### 2. 實作

- **Server（`electron/handlers/pty.ts`）**：`pty:create` 攔 `PtyLimitError`（`instanceof`），回 `{ ok: false, created: false, code: 'PTY_LIMIT_REACHED', limit }`；其他錯誤照舊 throw；no-manager / shell 拒絕的回傳不變。走 invoke **result**（JSON / structured clone），跨 WebSocket 與 Electron IPC 皆保留欄位。`PtyManager.createWithResult` 保持 throw（T0404 測試契約不動），僅補註解。
- **型別（`src/types/index.ts`）**：`PtyCreateResult` 加選填 `code?: PtyCreateFailureCode`、`limit?: number`；新增共用常數 `PTY_LIMIT_REACHED`（`PtyLimitError.code` 改引用之，單一來源）。
- **Renderer 核心（`src/lib/pty-replay.ts`）**：
  - `normalizePtyCreateResult` 保留已知 failure code（只認 `PTY_LIMIT_REACHED`，未知 code 視為一般失敗；`limit` 須為有限數字）。
  - `isPtyLimitResult()`；`onPtyCreateRefused(listener)` 拒絕事件（`createPtyWithReplay` 收到上限結果時發出，listener 例外不影響 create）。
  - 終端訊息 registry `showPtyNotice(id, text)` / `registerPtyNoticeSink(id, sink)`：與 replay registry 同型，view 未掛載時暫存、掛載後依序寫出。
  - 上限結果 `created: false` ⇒ `createPtyThenLaunch` **不打 launch 指令**、不 replay、**不重試**。
- **UI**：
  - 新 hook `src/hooks/usePtyLimitNotice.ts`：只處理 `options.workspaceId === workspace.id` 的拒絕 → `showPtyNotice`（每個被拒終端一行）+ 沿用既有 `CtToast` / `useCtToast` 的 warning toast（10s；5s 內的連發共用一則 toast，避免一次還原多分頁時洗版）+ `debug.log`。
  - `WorkspaceView.tsx`：呼叫 `usePtyLimitNotice(workspace.id, addNoticeToast)`（沿用該元件既有的 `addNoticeToast`）；5 處裸 `pty.create` 改 `void createPtyWithReplay(...)`（新 id 永遠不會 `created: false`，replay 行為不變；原本的 unhandled rejection 也一併收斂）。
  - `TerminalPanel.tsx`：註冊 notice sink，以黃字寫一行到 xterm。
- **i18n 三語**：`terminal.ptyLimitNotice`（終端內一行，含 `BAT_SERVER_MAX_PTYS` 提示）、`toast.ptyLimit.reached`，en / zh-TW / zh-CN，皆帶 `{{limit}}`。

#### 3. 測試

- `electron/__tests__/pty-handler-limit.test.ts`（新）：handler 回結構化結果；JSON round-trip 保留 `code` / `limit`；`normalizePathsInResult('pty:create', …)` 原樣通過（RemoteClient 代理不改值）；其他錯誤仍 throw；成功 / no-manager 不變。
- `electron/remote/__tests__/headless-orphan-pty.test.ts`（改）：T0404 的 wire-level 測試原斷言 `rejects.toThrow(/PTY limit reached/)`，即本單刻意改變的契約 → 改為斷言真實 headless + wss 回 `{ ok: false, created: false, code: 'PTY_LIMIT_REACHED', limit: 2 }`（**代理序列化實測保留 code**），其餘（既有 PTY 存活、kill 釋放名額）不變。
- `src/lib/__tests__/pty-replay.test.ts`（擴）：normalize 保留/丟棄規則、拒絕事件只發一次且不 launch / 不 replay / 不重試、非上限結果（含訊息含「PTY limit reached」的 reject）**不**被當上限、listener 例外隔離、notice registry 暫存/順序/消耗。
- `src/hooks/__tests__/usePtyLimitNotice.test.tsx`（新，RTL）：toast（`ct-toast-warning`）+ 終端行、view 晚掛載仍收到、他 workspace 不處理、連發共用一則 toast 且逾時後再發、成功/一般失敗無提示、三語 key 齊備。

#### 4. 驗證

| Lane | 結果 | 證據 |
|------|------|------|
| `npm run test:unit` | **PASS** | `Test Files 118 passed (118)`、`Tests 1915 passed | 1 skipped (1916)`（stderr 的 `AttachConsole failed` / `No such remote 'origin'` 為既有 conpty / git fixture 雜訊，非失敗） |
| 指定測試 | **PASS** | `headless-orphan-pty` / `pty-manager-limits` / `headless-pty` / `headless-electron-free`：4 files / 36 tests passed |
| `npx tsc --noEmit` | **PASS（40 ≤ 40）** | 40 個 `error TS`，皆非本單觸及檔案（grep 觸及檔案 0 筆） |
| `npx vite build` / `test:e2e` | 未跑 | 依 memory_overrides L141（同工作樹平行 Worker） |
| 實機 | **待使用者** | 見下方步驟 |

#### 5. 實機步驟（使用者執行；本單不部署）

1. 重新打包/部署含本 commit 的 server bundle 到 WSL（或以 dev 模式啟動 headless），啟動前設低上限：systemd drop-in `Environment=BAT_SERVER_MAX_PTYS=2`，或手動 `BAT_SERVER_MAX_PTYS=2 <bat-server 啟動指令>`；log 應見 `PTY limit: 2`。
2. 客戶端（同為含本 commit 的 BAT）以 remote profile 連上，在一個 workspace 內開 2 個終端（正常）。
3. 開第 3 個終端 → 預期：
   - 右下角黃色 toast：「已達遠端終端上限：伺服器已執行 2 個終端，新終端未啟動。請關閉部分終端後再試。」
   - 第 3 個終端區塊內出現一行黃字：「[BAT] 終端未啟動：遠端伺服器已執行上限 2 個終端。…」
   - 不自動重試；`debug.log` 有 `[T0424] pty:create refused terminal=… (max 2)`。
4. 關閉一個終端後再開新終端 → 正常啟動（kill 釋放名額）。
5. 回歸：本機（local profile）開多個終端不受影響、不出現此提示。

### 遭遇問題

- **範圍偏差（必要，記錄供塔台）**：`affects_files` 未列但實作所需——`src/types/index.ts`（`PtyCreateResult` 擴欄 + 共用常數）、`src/components/TerminalPanel.tsx`（終端區塊訊息須由 xterm view 寫出）、`src/hooks/usePtyLimitNotice.ts` + 其測試（為了 RTL 可測，避免整個 WorkspaceView 渲染）、`electron/remote/__tests__/headless-orphan-pty.test.ts`（T0404 wire 測試斷言舊契約，必須同步）。`src/App.tsx`、`src/stores/workspace-store.ts` 經確認**不需改**。
- **契約變更**：T0404 起 headless `pty:create` 超限為 invoke-error；本單改為 invoke-result `{ ok: false, … }`。舊客戶端（T0403 前只測 truthiness）對 `ok: false` 物件的行為與先前 reject 同樣是「未建立」；T0403～本單前的客戶端會讀為 `ok: false, created: false`（不打 launch 指令），無退化。新客戶端連 T0404～本單前的舊 server 仍只拿到訊息字串 → 依規定**不**以字串比對，維持原空白行為（伺服器升級後即生效）。
- **已知小殘留**：遠端工具安裝（`install-runner`）撞上限時會同時出現既有的 `remoteToolInstall.error.ptyFailed` toast 與本單的上限 toast（兩則資訊互補，未合併）。隱藏的 `$HOME` probe（無終端分頁）撞上限不顯示本單提示。
- 未執行 `git stash` / `reset` / `checkout --` / `restore`；同工作樹其他 Worker 的檔案（`main.ts`、`worktree-manager.ts`、`remote-connect-plan.ts`、T0429/T0430 工單等）未觸碰、未納入 commit。

### 回報時間

2026-10-05T05:51:19+08:00
