---
schema_version: 1
schema_kind: workorder
id: T0539
title: "PLAN-042：修 BUG-137（已結束分頁 ⏻ 重啟無效）＋ helper 派工日誌 `sourceTerminalId` 永遠為空"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-042
priority: P3
sizing: S
created_at: "2026-10-15T16:13:05+0800"
started_at: "2026-10-15T17:21:25+0800"
updated_at: "2026-10-15T17:30:31+0800"
completed_at: "2026-10-15T17:30:31+0800"
commit: 2ff55bdd
target_version: "0.6.1-pre.3"
depends_on: [T0535]
related:
  - PLAN-042
  - BUG-137
  - T0534（研究回報 §8-4、§8-5）
affects_files:
  - electron/pty-manager.ts
  - electron/handlers/pty.ts
  - src/components/WorkspaceView.tsx
  - electron/terminal-command-handlers.ts
  - scripts/bat-terminal.mjs
  - electron/__tests__/
  - src/**/__tests__/
  - _ct-workorders/BUG-137-restart-button-no-op-on-exited-terminal.md
  - _ct-workorders/T0539-restart-exited-terminal-and-source-id-log.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）。實測一律隔離實例，不耗 token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0；`npx vite build` 成功。"
  - "🔴 依賴 T0535：本單在 T0535 合入後才開工（兩者都改 `WorkspaceView.tsx` / `terminal-command-handlers.ts`），以 T0535 之後的程式為基礎。"
---

# T0539 — ⏻ 重啟已結束分頁 ＋ `sourceTerminalId` 日誌

## 任務 A：BUG-137

1. 隔離實例實測兩種情境：① 分頁被 `pty:kill` 後按 ⏻；② shell 自己 `exit` 後按 ⏻。記錄 instance 是否存在、`restart` 回傳值、畫面結果。
2. 修正：instance 不存在時，重啟改為以同一 id 建立新 PTY（cwd / shell 取 UI 傳入值；env 一律經 `PtyManager.buildPtyEnv()`，工作區 env 由 renderer 依現有新建分頁的方式帶入，T0525 規則）。實作位置由 Worker 決定（main 端 `restart` fallback 或 renderer 改呼叫 `pty.create`），回報區說明理由。
3. UI 檢查回傳值；仍失敗時在分頁內印一行原因（比照 `registerPtyNoticeSink` 的格式），不得靜默。
4. 不得改變程序存活時的重啟行為（含 terminal-driven agent 重跑啟動命令）。

## 任務 B：`sourceTerminalId` 永遠為空

- `terminal-command-handlers.ts` `createWithCommand` 以 `opts.customEnv?.BAT_TERMINAL_ID` 取 `sourceTerminalId`，但 `bat-terminal.mjs` 從未送這個值（T0534 §8-4）。
- 修正方向擇一並說明：helper 送出呼叫端的 `BAT_TERMINAL_ID`（不放進 Worker 的 `customEnv`，避免污染 Worker env），或日誌改記 `BAT_TOWER_TERMINAL_ID`（派工時與 `--notify-id` 相同）。
- 只影響診斷日誌，不得改變派工落點（T0523）與 env 注入。

## 驗收條件

- [x] A：單元測試（instance 不存在時的重啟、回傳值檢查）；隔離實例實測兩種情境都能重啟，存活分頁的重啟行為不變
- [x] B：helper 測試或單元測試確認日誌欄位有值；Worker 的 env 不多出任何變數
- [x] BUG-137 更新為 FIXED（附 commit）
- [x] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、相關單元測試全綠

## 回報區

### 0. Landing check：PASS

- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 REPO_ROOT 下 → PASS；C-3：C-0 已通過，僅參考（`electron/pty-manager.ts` 等皆存在）；C-2：工單無 `branch` 欄位，HEAD = `main`
- 依賴：T0535 已合入（`f26b7641`），以其後的程式為基礎
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 1. 結果摘要

- **A（BUG-137）**：修正。⏻ 的一般終端分支改走 `restartOrCreatePty`（`src/lib/pty-replay.ts`）：先呼叫 `pty:restart`；回 `true` 與修正前完全相同；回 `false` / `undefined`（instance 不存在）時，以**同一 id** 呼叫 `pty:create`，參數照新建分頁的方式組（`mergeEnvVars(globalEnvVars, workspace.envVars)`、`workspaceId`、`agentPreset`、cwd、shell），env 由 main 的 `PtyManager.buildPtyEnv()` 組裝（T0525）。仍失敗時在分頁內印一行 `terminal.restartFailedNotice`（`showPtyNotice`，與 T0424 `ptyLimitNotice` 同一個 sink / 格式；PTY 上限的拒絕已由 `usePtyLimitNotice` 印出，不重複），並記 `[BUG-137]` debug log。terminal-driven agent 的啟動命令只在真的起了新 shell（`spawned`）時才重送。
- **B（`sourceTerminalId`）**：修正。`createWithCommand` 改讀 `opts.customEnv?.BAT_TOWER_TERMINAL_ID`（= 派工時的 `--notify-id`）。只影響 `[remote][terminal] … source=` 與 `bat-scripts.log` 的 `ipc-invoke` / `terminal-created` 兩個事件的 `sourceTerminalId` 欄位；派工落點（T0523）與 env 注入不變，`bat-terminal.mjs` 未改。

### 2. 任務 A 實測（隔離實例，修正前）

`e2e/t0539-restart-exited-terminal.spec.ts`（隔離 runtime、Terminal Server 模式（預設）、自訂 CLI 跑 node 腳本記錄啟動，不耗 token）。修正前 build（`npx vite build` @ `13f4c08d`）的記錄：

| 情境 | instance | `pty:write` | `pty:restart` 回傳 | 按 ⏻ 後 |
|---|---|---|---|---|
| 存活分頁 | 存在 | ok | （UI 路徑）| 正常重啟 |
| ① `pty:kill` 後 | **不存在** | `{"ok":false,"reason":"pty-not-found"}` | `false` | 無任何新 shell（15 s 內 `pty:write` 仍 `pty-not-found`），畫面停住 |
| ② shell 自己 `exit` 後 | **不存在**（`handlePtyExit` 刪除）| `ok:false` | `false` | 同上 |
| agent 分頁被 kill 後 | 不存在 | — | — | 啟動命令沒有重跑（launch 次數停在 2） |

⇒ BUG-137 程式碼推論成立，且 shell 自行結束時 instance 同樣被移除（BUG 單「需實測確認」的項目）。

修正後同一 spec：①、② 按 ⏻ 後都起了新 shell，且新 shell 讀得到工作區 env（`node -e` 印出 `T0539_WS_ENV=ws-env-t0539`）；存活分頁重啟照舊；agent 分頁存活重啟與被 kill 後重啟都重跑啟動命令（launch 3 次，每次都帶工作區 env）。`1 passed (10.3s)`。

### 3. 實作位置的選擇（任務 A 步驟 2）

選 **renderer fallback**（`pty:restart` 回 false → renderer 呼叫 `pty:create`），不在 main `restart` 內補建：

1. instance 不存在時，main 已沒有該分頁的 `customEnv` / `workspaceId` / `agentPreset`；這些資料只在 renderer（工作區 env 由 renderer 合併 Settings 全域 + 工作區 env 後帶入，T0525 規則「工作區 env 由 renderer 依現有新建分頁的方式帶入」）。在 main 補建等於要另外把這些資料送下去，等同改 `pty:restart` 的協定。
2. 不改 IPC / remote 協定：遠端視窗的 `pty:restart` / `pty:create` 都是 proxied channel，renderer fallback 對舊版 headless server 也成立（headless `rejectShell` 等檢查照樣套用在 create）。
3. 存活時的路徑完全不動（`pty:restart` 回 true 即結束，其餘程式碼與修正前相同）。

### 4. 任務 B 方向的選擇

選「日誌改記 `BAT_TOWER_TERMINAL_ID`」，不讓 helper 多送 `BAT_TERMINAL_ID`：

- 不改 helper 與協定：所有 T0133 之後的 `bat-terminal.mjs` 在有 `--notify-id` 時都已送這個值，新舊 helper × 新舊 BAT 不需相容矩陣。
- 遠端 headless 的 `authorizeHelperInvoke` 已檢查 `BAT_TOWER_TERMINAL_ID` = 呼叫端權杖的 terminal（`tower-not-bound`），值可信；若改成另送一個頂層欄位則是未驗證的自我宣告。
- Worker env 不變：`ptyManager.create` 收到的 `customEnv` 就是 helper 送的那份（單元測試斷言）。
- 限制：不帶 `--notify-id` 的派工（無塔台）仍為空（log `source=n/a`），與「無回報對象」一致。

### 5. 變更檔案

- `src/lib/pty-replay.ts`：新增 `restartOrCreatePty` / `PtyRestartOutcome`
- `src/components/WorkspaceView.tsx`：`handleRestart` 一般終端分支改用上者、檢查結果、失敗印 notice、`spawned` 才重送 agent 啟動命令；`useCallback` deps 補 `workspace.id` / `folderPath` / `envVars` / `t`
- `src/locales/{en,zh-TW,zh-CN}.json`：`terminal.restartFailedNotice`
- `electron/terminal-command-handlers.ts`：`sourceTerminalId` 改讀 `BAT_TOWER_TERMINAL_ID`
- 測試：`src/lib/__tests__/pty-restart-or-create.test.ts`（10：restart true 不呼叫 create、false / undefined → 同 id create 且參數為分頁資料、`created:false` → 不 spawn + replay、create 失敗 / 丟錯 / PTY 上限、restart 丟錯不 create；`WorkspaceView` source guard）、`electron/__tests__/terminal-command-source-terminal-id.test.ts`（4：兩個 channel 的 `ipc-invoke` / `terminal-created` 與 logger 都有 `tower-1`、Worker `customEnv` 與 helper 送出者相同、無 `--notify-id` 為 `n/a`、helper 不在 `customEnv` 放 `BAT_TERMINAL_ID`）、e2e `e2e/t0539-restart-exited-terminal.spec.ts`
- 未改：`electron/pty-manager.ts`、`electron/handlers/pty.ts`、`scripts/bat-terminal.mjs`（方向選擇使然，見 §3 / §4）

### 6. 驗證

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | PASS（exit 0） |
| `npm run typecheck:electron` | PASS（exit 0） |
| `npx vite build` | PASS（exit 0） |
| `npm run test:unit` | PASS：237 files / 3939 passed / 1 skipped |
| e2e `e2e/t0539-restart-exited-terminal.spec.ts`（單獨跑，隔離實例） | 修正前 FAIL（§2 記錄）→ 修正後 PASS `1 passed (10.3s)`；Terminal Server 與 runtime userData 皆清除 |
| 全套 e2e | 未跑（L141） |

### 7. 偏差、限制、後續

- 偏差：`affects_files` 未列 `src/lib/pty-replay.ts`、`src/locales/*.json`、`e2e/`。邏輯放進 `pty-replay.ts`（renderer PTY 生命週期 helper、`showPtyNotice` 所在）以便單元測試；notice 需三語字串；e2e 為步驟 1 的隔離實測。
- 存活路徑唯一差異：傳給 `pty:restart` 的 cwd 在 `getCwd` 與 `terminal.cwd` 皆空時改用工作區 `folderPath`（原為空字串）；正常情況兩者不會都空。
- 限制：instance 不存在時補建的 PTY 不會有原 Worker 的 `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE` / `workorder`（main 已無記錄；renderer 只帶工作區 env）。`--close-worker` 仍可經 T0537 的已存歸屬（`withSavedWorkerOwnership`）找到該分頁；死掉的 Worker 按 ⏻ 得到的是一般 shell。
- 限制：e2e 只跑 Terminal Server 模式；direct 模式 `handleDirectExit` / `kill` 同樣刪除 instance，renderer 路徑相同。macOS / Linux 未實測。
- 未改 `CLAUDE.md`；若塔台要記錄 ⏻ fallback 規則，可補在「關閉分頁時的程序樹」附近。

### 8. Commit

- `2ff55bdd` fix: T0539 restart a tab whose process is gone (BUG-137); log the dispatching Tower as sourceTerminalId (PLAN-042)
- closeout commit（本回報 hash、BUG-137 → FIXED、狀態 DONE）另行 commit；皆用 `git commit --only`，未含 `src/styles/settings.css`；未 push
