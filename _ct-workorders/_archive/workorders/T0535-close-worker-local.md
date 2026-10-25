---
schema_version: 1
schema_kind: workorder
id: T0535
title: "PLAN-041 B'-1：BAT 本機 `--close-worker`（歸屬驗證、延遲計時與取消、與 ✕ 相同的關閉路徑）"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-041
priority: P2
sizing: M
created_at: "2026-10-15T15:44:39+0800"
started_at: "2026-10-15T16:15:22+0800"
updated_at: "2026-10-15T16:32:34+0800"
completed_at: "2026-10-15T16:32:34+0800"
target_version: "0.6.1-pre.3"
depends_on: []
related:
  - PLAN-041
  - T0534（研究回報 §1、§4–§6）
  - D144
affects_files:
  - electron/pty-manager.ts
  - electron/terminal-command-handlers.ts
  - electron/handlers/terminal.ts
  - electron/handlers/pty.ts
  - electron/preload.ts
  - electron/main.ts
  - src/types/electron.d.ts
  - src/App.tsx
  - src/components/WorkspaceView.tsx
  - src/stores/workspace-store.ts
  - scripts/bat-terminal.mjs
  - electron/__tests__/
  - src/**/__tests__/
  - e2e/
  - CLAUDE.md
  - _ct-workorders/T0535-close-worker-local.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）。e2e 一律隔離實例，Worker 用自訂 CLI 跑 node 腳本，不耗 token（範本 `e2e/t0529-workspace-agent-launch.spec.ts`）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141），只跑本單新增 / 相關 spec。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0；`npx vite build` 成功。"
  - "🔴 **No Regressions**：使用者按 ✕ 的行為（確認框條件、`stopSession` / `pty.kill` 分支、worktree 清理勾選）必須完全不變。"
  - "🔴 **不加 Settings 開關**（D144：要不要回收、延遲多久由 CT `*config` 決定）。"
---

# T0535 — BAT 本機 `--close-worker`

## 背景

見 PLAN-041 與 T0534 回報區。介面契約（參數、exit code）**以 PLAN-041「介面契約」節為準**，CT-T011 依同一份契約撰寫，不得自行更改；確有必要更改時在回報區說明理由，由塔台同步更新 PLAN 與 CT-T011。

## 任務

1. **記錄工單與查詢（`electron/pty-manager.ts`）**
   - `PtyInstance` 新增 `workorder?: string`。`terminal:create-agent-command` 有 `workorder` 參數時寫入（`terminal-command-handlers.ts` → `createWithCommand` → `ptyManager.create`）。`pty:restart` 與 Terminal Server recovery 沿用（比照 T0525 的 `customEnv` / `agentPreset`）。
   - 新增 public 查詢：`findWorkerTerminals(towerId, workorder): string[]`（比對 `customEnv.BAT_TOWER_TERMINAL_ID` 與 `workorder`）、`getLastOutputAt(id)`、`getLastUserInputAt(id)`（後兩者若既有欄位可用就沿用）。
   - 工單編號比對：大小寫一致、去掉前後空白；格式同 helper `--workorder` 規則。
2. **主行程 handler `terminal:close-worker`**（`{ towerId, workorder, delayMs? }`）
   - 參數驗證失敗 → `{ ok:false, code:'INVALID_ARGS' }`。
   - 查詢：0 個 → `NOT_FOUND`；>1 個 → `AMBIGUOUS`。
   - 歸屬：以工單查到分頁，但它的 `BAT_TOWER_TERMINAL_ID` 不是 `towerId` → `NOT_OWNER`。實作方式：先只以 `workorder` 找候選，再比對 tower，以區分 `NOT_FOUND` 與 `NOT_OWNER`。
   - 閒置：最近 `CLOSE_WORKER_IDLE_MS = 5000` 內有輸出 → `BUSY`（常數，不開放設定）。
   - 通過 → 回 `{ ok:true, terminalId, closeAt }`，`delayMs` 夾在 `0–300000`。
   - **延遲在 main 計時**。到期前若該分頁有**新輸出**或**來自 renderer 的 `pty:write`**（使用者打字）→ 取消，`logger.log` 記原因。到期時分頁已不存在 → 靜默結束。同一分頁重複請求 → 以最新一次為準（重設計時器）。
   - 到期 → 送 `terminal:close-requested { id }` 給**所有視窗**（含 detached；持有該分頁的 `WorkspaceView` 處理，其他視窗忽略）。
   - 日誌前綴 `[close-worker]`，記錄 towerId / workorder / 結果 / 取消原因。`bat-scripts.log` 由 helper 記事件 `close-worker`。
3. **Renderer**
   - 把 `WorkspaceView.tsx` `handleConfirmClose` 的關閉邏輯抽成共用函式（例如 `closeTerminalNow(id, { cleanWorktree })`）。✕ 路徑改呼叫它，**行為逐項不變**。
   - 收到 `terminal:close-requested`：分頁屬於本視窗 → `closeTerminalNow(id, { cleanWorktree: false })`（不跳確認框，不清 worktree）→ `removeTerminal` + `save()`。
   - preload / `electron.d.ts` 補上事件型別。
4. **Helper `scripts/bat-terminal.mjs`**
   - 新增 `--close-worker <T####>`、`--delay-ms <n>`；`--notify-id` 必填。與建立分頁的參數互斥（用法錯誤 exit 1）。
   - 依 PLAN-041 契約對應 exit code：`0` / `3 NOT_FOUND` / `4 NOT_OWNER` / `5 AMBIGUOUS` / `6 BUSY` / `1` 其他；stderr 印 `close-worker: <CODE>`；成功時 stdout 印 `✓ Worker close scheduled: <id> (in <n> ms)`。
   - 回應以 frame id 比對（BUG-114 規則，沿用 `waitForMessage`）。`--help` 補說明。
   - 確認舊版行為：在 `--close-worker` 之前沒有位置參數時，舊版會 `Unknown option` exit 1、不建立分頁（契約依此設計，回報區附實際輸出）。
5. **文件**：CLAUDE.md 新增「Worker 分頁回收（PLAN-041）」小節：契約、BAT 檢查、延遲取消條件、已知限制（BAT 重開後在 T0537 之前回 `NOT_FOUND`、遠端見 T0536）。

## 驗收條件

- [x] 單元測試：`INVALID_ARGS` / `NOT_FOUND` / `NOT_OWNER` / `AMBIGUOUS` / `BUSY` / 成功；延遲期間新輸出取消、使用者輸入取消、重複請求重設計時；`delayMs` 夾值；restart 後 `workorder` 保留
- [x] source guard 或測試：✕ 路徑（確認框條件、`stopSession` / `pty.kill` 分支、worktree 清理）不變
- [x] helper 測試：各 exit code、互斥參數、`--help`（`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指到 temp）
- [x] e2e（隔離實例，自訂 CLI 跑 node 腳本）：派工 → Worker 輸出停止 → `--close-worker` → 分頁消失、registry 不含該 id → 重開實例不還原；detached 視窗中的 Worker 同樣可關；延遲期間打字會取消
- [x] Windows Terminal Server 模式關閉後子程序是否結束，由 T0540（PLAN-042）專責實測與修正；本單不改 `killPty`，只要求不退化（未改 `killPty` / `PtyManager.kill` 的程序終止邏輯）
- [x] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、相關單元測試全綠

## 回報區

### 0. 執行摘要

- 開始：2026-10-15T16:15:22+0800；`CT_MODE=yolo`、`CT_INTERACTIVE=0`，無互動。
- 著陸檢查：**PASS**
  - C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal` → PASS
  - C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
  - C-3：前 5 筆非萬用字元 `affects_files`（`electron/pty-manager.ts` 等）皆存在 → PASS（資訊性）
  - C-2：無 `branch` 欄位；目前在 `main`
  - `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 結果：B'-1 本機能力完成。介面契約**未更改**，與 PLAN-041「介面契約」一致。
- 沒有碰使用者的 BAT（port 9876 / 真實 userData）：e2e 用隔離實例，helper 測試用 mock server，舊版 helper 行為用 HEAD 版本複本在 scratchpad 執行（未設 `BAT_REMOTE_*`）。

### 1. 實作

| 項目 | 內容 |
|---|---|
| 記錄工單 | `PtyInstance.workorder`（`electron/pty-manager.ts`）。`PtyManager.create` 收 `PtyManagerCreateOptions`（= `CreatePtyOptions & { workorder? }`），以 `normalizeWorkorderId` 去空白、轉大寫、驗 `--workorder` 文法後才記錄。三條 spawn 分支、`restart`、Terminal Server 冪等重建（T0108 replay 後補齊）、recovery（`{ ...inst }`）都保留。`terminal:create-agent-command` 只在 skill 模式把 `workorder` 帶進 `createWithCommand` → `ptyManager.create`。 |
| 查詢 | `findWorkerTerminals(towerId \| null, workorder)`、`getTowerTerminalId(id)`、`getLastOutputAt(id)`（`enqueuePtyOutput` 收到原始輸出時記錄）、`getLastUserInputAt(id)` / `noteUserInput(id)`。PTY 結束 / kill 時清除。既有沒有可用的主行程活動時間欄位（`lastActivityTime` 只在 renderer），所以新增。 |
| handler | 新模組 `electron/close-worker.ts`（不 import electron）：`WorkerCloseScheduler.request({ towerId, workorder, delayMs? })`。驗證順序：`INVALID_ARGS` → 以工單找候選（0 → `NOT_FOUND`）→ 比對塔台（0 → `NOT_OWNER`，>1 → `AMBIGUOUS`）→ `CLOSE_WORKER_IDLE_MS = 5000` 內有輸出 → `BUSY` → `{ ok:true, terminalId, closeAt, delayMs }`。`delayMs` 夾 0–300000（非數字 → `INVALID_ARGS`）。由 `registerTerminalHandlers` 的選用 dep `workerCloser` 註冊 `terminal:close-worker`；main.ts 傳入，headless 不傳（T0536）。 |
| 延遲 | main 計時。到期時：分頁不在 → 靜默（log `skipped`）；排程後有本機輸入 → 取消（`cancelled (user input during the delay)`）；排程後有輸出 → 取消（`cancelled (new output during the delay)`）；否則送 `terminal:close-requested { id }` 給所有視窗（`createTerminalWindowEmit`，含 detached）。同一分頁再次成功請求 → 清掉舊計時器以新請求為準；被拒的請求不動既有排程。app 結束時 `dispose()` 清計時器。 |
| 使用者輸入 | `handlers/pty.ts` 的 `pty:write`：`ctx.connectionId` 為空（Electron IPC，含 detached 視窗）時呼叫 `noteUserInput`；helper 經 RemoteServer 的寫入（有 connectionId）不算。 |
| renderer | `workspaceStore.closeTerminalNow(id, { cleanWorktree })`：搬自 `handleConfirmClose`，逐行同邏輯（integrated → `claude.stopSession`，勾選清理再 `cleanupWorktree`；其他 → `pty.kill`，`claude-cli-worktree` 勾選清理再 `worktree.remove`；`removeTerminal` + `save()`）。✕ 的兩條路徑（閒置 shell 直接關、確認框確認）都改呼叫它，確認框條件未動。`App.tsx` 監聽 `terminal:close-requested`，以 `ownsTerminalForCloseRequest` 判斷（detached 視窗只處理自己的工作區；主視窗只處理沒 detach 出去的工作區），呼叫 `closeTerminalNow(id, { cleanWorktree: false })`。另加一個 effect：確認框開著時分頁被外部關掉 → 關閉確認框。preload `pty.onCloseRequested` / `electron.d.ts` 補型別。 |
| helper | `bat-terminal.mjs`：`--close-worker <T####>`、`--delay-ms <n>`（非負整數）。`--notify-id` 必填；與 `--cwd` / `--workspace` / `--agent` / `--prompt` / `--skill` / `--workorder` / `--mode` / `--interactive` / `--no-interactive` / 位置參數互斥 → exit 1。exit：0 / 3 NOT_FOUND / 4 NOT_OWNER / 5 AMBIGUOUS / 6 BUSY / 1 其他；stderr 一律印 `close-worker: <CODE>`（另有 `USAGE` / `NOT_IN_BAT` / `CONNECT_FAILED` / `AUTH_FAILED` / `TIMEOUT` / `UNSUPPORTED` / `ERROR`）；成功 stdout `✓ Worker close scheduled: <id> (in <n> ms)`。回應以 frame id 比對（沿用 `waitForMessage`）。`bat-scripts.log` 事件 `close-worker`。`--help` 補說明；close-worker 模式不印 `--workspace not specified` 提示。 |
| 文件 | CLAUDE.md 新增「Worker 分頁回收（PLAN-041 / T0535，D144）」小節。 |

舊版 helper 行為（`git show HEAD:scripts/bat-terminal.mjs` 複本，未設 `BAT_REMOTE_*`）：

```
== bat-terminal.mjs --close-worker T0535 --notify-id abc
Error: Unknown option '--close-worker'
Usage: bat-terminal.mjs [options] <command> [args...]
Run with --help for details.
exit=1
== bat-terminal.mjs --notify-id abc --close-worker T0535 --delay-ms 1000
Error: Unknown option '--close-worker'
Usage: bat-terminal.mjs [options] <command> [args...]
Run with --help for details.
exit=1
```

已安裝的 BAT（`C:\Program Files\BetterAgentTerminal\resources\scripts\bat-terminal.mjs`）同樣不含 `close-worker` 字串。參數解析在連線之前，所以不會建立分頁；契約成立。

### 2. 變更檔案

- 新增：`electron/close-worker.ts`、`electron/__tests__/close-worker.test.ts`、`electron/__tests__/bat-terminal-close-worker.test.ts`、`src/stores/__tests__/workspace-store.closeTerminalNow.test.ts`、`e2e/t0535-close-worker.spec.ts`
- 修改：`electron/pty-manager.ts`、`electron/terminal-command-handlers.ts`、`electron/handlers/terminal.ts`、`electron/handlers/pty.ts`、`electron/preload.ts`、`electron/main.ts`、`src/types/electron.d.ts`、`src/App.tsx`、`src/components/WorkspaceView.tsx`、`src/stores/workspace-store.ts`、`scripts/bat-terminal.mjs`、`electron/remote/__tests__/proxied-channels-binding.test.ts`、`CLAUDE.md`、本工單

### 3. 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm run typecheck` | PASS（0） | exit 0，無輸出 |
| `npm run typecheck:electron` | PASS（0） | exit 0，無輸出 |
| `npx vite build` | PASS | exit 0（main / preload / renderer / terminal-server 皆 built） |
| 新增單元測試 | PASS | `close-worker.test.ts` 23 passed；`bat-terminal-close-worker.test.ts` 21 passed；`workspace-store.closeTerminalNow.test.ts` 48 passed |
| 全套 `npm run test:unit` | PASS | `Test Files 229 passed (229)`、`Tests 3840 passed \| 1 skipped (3841)`（第一次跑時 `proxied-channels-binding.test.ts` 抓到新 channel 未登記，補 REGISTRY_ONLY 後全綠） |
| `npm run verify:helpers` | PASS | `OK — all 15 helper .mjs files in extraResources are reachable via filter` |
| e2e `e2e/t0535-close-worker.spec.ts` | PASS（27.3 s） | 隔離實例 `e2e-t0535-*`：NOT_FOUND 3 / NOT_OWNER 4；`--delay-ms 4000` 後以 renderer `pty.write` 打字 → 6 s 後分頁仍在，日誌 `cancelled (user input during the delay)`；閒置後 delay 0 → 分頁消失、registry 不含 id、再呼叫回 3；同工單兩個 Worker → 5 AMBIGUOUS；B detach 後在 detached 視窗關閉 Tower B 的 Worker，父 entry 不含 id、Tower B 仍在；relaunch 同 runtime → 兩個被關的 Worker 都沒有還原，其餘分頁照常 |
| 相關既有 e2e | PASS | `detached-terminal-persistence.spec.ts`（detached 視窗按 ✕）、`t0523-dispatch-workspace.spec.ts`（helper 派工）2 passed |
| ✕ 路徑不變 | PASS | `workspace-store.closeTerminalNow.test.ts`：10 種 preset × 有無 `worktreePath` × 勾選與否，`closeTerminalNow` 的呼叫序列與 T0535 前 `handleConfirmClose` 的複本逐項相同；source guard 檢查確認框條件字串、兩條 ✕ 路徑都走 `closeTerminalNow`、close-requested 用 `cleanWorktree: false` |

未執行：全套 e2e（L141，依工單只跑新增 / 相關 spec）；Windows Terminal Server 模式關閉後子程序是否結束（T0540 範圍）。

### 4. 偏差

1. **新增模組不在 `affects_files`**：`electron/close-worker.ts`（scheduler 與 `normalizeWorkorderId`，為了可單獨測試、且之後 T0536 headless 可共用，不 import electron）。
2. **`electron/remote/__tests__/proxied-channels-binding.test.ts`**（不在 `affects_files`）：BUG-095 guard 要求每個 registered channel 綁 IPC 或列入 REGISTRY_ONLY 並附理由。`terminal:close-worker` 只由 helper 經 RemoteServer 呼叫，renderer 不用，所以列入 REGISTRY_ONLY，沒有加進 `PROXIED_CHANNELS`。
3. **`CreatePtyOptions` 沒改**：`src/types/index.ts` 不在 `affects_files`，改在 `pty-manager.ts` 定義 `PtyManagerCreateOptions`；renderer 的 `pty:create` 不帶 `workorder`。
4. **renderer 共用函式放在 store**：工單舉例 `closeTerminalNow`，放在 `workspaceStore`（`affects_files` 內），因為事件由 `App.tsx` 處理，工作區可能未掛載 `WorkspaceView`（lazy mount）。
5. **取消判斷在到期時做**：不是在輸出 / 輸入發生的當下取消計時器，而是到期時比對「排程後是否有輸出 / 本機輸入」。結果相同（不關閉），日誌在到期時記錄原因。
6. **「使用者輸入」的範圍**：本機視窗經 IPC 的所有 `pty:write` 都算，包含 xterm 對程式查詢的自動回應（DA / DSR / focus report）。這類回應通常緊接在輸出之後，輸出本身也會取消，所以影響只是偏向不關閉。

### 5. 剩餘風險 / 後續

- **claude CLI 實際閒置時是否完全沒有輸出未實測**：e2e 用 node 腳本。若 Worker 的 TUI 會週期重繪（spinner、狀態列時間），會一直 `BUSY` 或延遲被取消。建議 CT-T011 發佈前在真實 Worker 上量一次（例如收單後 10 s 呼叫）。
- BAT 重開後回 `NOT_FOUND`（T0537）、遠端 headless 未支援（T0536）、Windows Terminal Server 模式子程序終止（T0540）——都已寫進 CLAUDE.md 已知限制。
- 主視窗 reload 期間若有工作區 detach 中，`detachedIds` 會重設為空（既有行為），此時主視窗與 detached 視窗都可能處理同一事件：`pty.kill` 重複無害，主視窗的 save 依 T0491 保留 detached 視窗擁有的清單，不影響持久化。

### 6. Commit

- `f26b7641` feat: T0535 bat-terminal --close-worker closes a Tower's own Worker tab (PLAN-041)（19 files）；`git commit --only`，`src/styles/settings.css` 不包含；不 push。回報區收尾與狀態另一個 commit。
- 完成：2026-10-15T16:32:34+0800
