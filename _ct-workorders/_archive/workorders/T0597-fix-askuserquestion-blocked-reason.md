---
schema_version: 1
schema_kind: workorder
id: T0597
title: "BUG-150：`PermissionRequest` 的 `tool_name` = `AskUserQuestion` 記為 `question`，並補真實事件順序的測試（T0596 方案 A）"
type: bugfix
status: DONE
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-18T02:43:24+0800"
started_at: "2026-10-18T02:45:47+0800"
updated_at: "2026-10-18T04:19:32+0800"
completed_at: "2026-10-18T02:51:01+0800"
depends_on: [T0596]
related:
  - BUG-150
  - "T0596 回報區（根因、Q5 方案 A 與建議測試）"
  - "CLAUDE.md「blocked 狀態偵測（PLAN-047 M1b / T0590）」小節；docs/agent-guide/blocked-state.md"
  - "並行工單 T0598（BUG-151：helper 派工引號 shell family，`electron/terminal-command-handlers.ts` 等）"
affects_files:
  - electron/terminal-blocked-state.ts
  - electron/__tests__/terminal-blocked-state.test.ts
  - electron/remote/__tests__/headless-blocked-state-e2e.test.ts
  - e2e/t0590-blocked-state.spec.ts
  - docs/agent-guide/blocked-state.md
  - _ct-workorders/T0597-fix-askuserquestion-blocked-reason.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit 工具（L129）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0598 同時在主 checkout 改 `electron/terminal-command-handlers.ts` 等派工 / shell 相關檔與其測試。你不碰這些檔；commit 一律 `git commit --only <你的檔>`，commit 前 `git diff --cached` 只能有你的變更。"
  - "🔴 hook 腳本規則沿用 T0590：一律 exit 0、stdout 不輸出、不影響 claude 決策、不送 `tool_input` / 內容 / 權杖。本單預期**不需要**改 `scripts/bat-hook.mjs`（它已送 `tool_name`）；若查證後必須改，在回報區說明理由。"
  - "🔴 契約不變：`blockedReason` 列舉、欄位名、channel 參數、`HOOK_EVENT_CLEARS_ONLY` 語意都不改；CLAUDE.md 不改（除非你認為例外對應屬必守規則，先在回報區說明，由塔台決定）。"
---

# T0597 — BUG-150 修正：AskUserQuestion 的 `PermissionRequest` 記為 `question`

## 目標

claude 的 AskUserQuestion 固定觸發 `PreToolUse` → 約 90 ms 後 `PermissionRequest`（`tool_name: AskUserQuestion`），目前後者把 reason 換成 `permission`，T0594 的 `ask-user-question-done` 因此永遠清不掉（只清 `question`）。依 T0596 方案 A：`permission-request` 帶 `toolName === 'AskUserQuestion'` 時 reason 記為 `question`。

## 範圍

1. `electron/terminal-blocked-state.ts` `TerminalBlockedTracker.report`：reason 改由一個小函式決定（例 `reasonOf(event, toolName)`），`permission-request` + `AskUserQuestion` → `question`，其餘照 `HOOK_EVENT_REASON`。結果：
   - 已是 `question` → `unchanged`（`blockedSince` 保留 `PreToolUse` 的時間，不印轉換行）
   - 沒有先收到 `PreToolUse` → 直接 `blocked` / `question`
   - `question` 期間收到 `permission-request(Bash)` 等其他工具 → 照舊換成 `permission`（T0594 情境不變）
2. 測試（T0596 Q5 列的六項，重點是**真實事件順序** `ask-user-question` → `permission-request(AskUserQuestion)` → `ask-user-question-done`）：
   - `electron/__tests__/terminal-blocked-state.test.ts`：狀態機、channel 回傳 `blockedReason: 'question'`、真 `bat-hook.mjs` 程序 stdin `PermissionRequest` + `tool_name: AskUserQuestion` → 塔台 state 為 `question`
   - `electron/remote/__tests__/headless-blocked-state-e2e.test.ts`：driver 照真實順序送三個事件，斷言等待期間 `blocked (question)`、done 之後離開 `blocked`、不經鍵盤
   - `e2e/t0590-blocked-state.spec.ts` 3b 段同上（需先 `npx vite build`）
3. `docs/agent-guide/blocked-state.md`：事件表 `PermissionRequest` 列補「`tool_name` = `AskUserQuestion` → `question`」並寫明原因（claude 2.1.300 / 2.1.302 的 AskUserQuestion `requiresUserInteraction`，T0596 查證）；「已知限制」改寫 bypass 那一條（bypass 下也會有 AskUserQuestion 的 `PermissionRequest`，修正後回報為 `question`）、滑鼠回答 AskUserQuestion 的清除改為 T0597 起實際生效。

## 驗收

- `npm run test:unit` 全綠（回報 passed / files 數）；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功；`e2e/t0590-blocked-state.spec.ts` 通過。
- 回報區寫明：改動摘要、測試新增項目、實機驗收步驟（給使用者：系統 claude 分頁問一題 → 塔台 `bat_list_terminals` 為 `blocked` / `question` → 滑鼠回答 → 立刻清除，不必等 `Stop`；debug log `→ cleared (hook ask-user-question-done)`）。
- commit 只含 `affects_files`；訊息 `fix(blocked): …（BUG-150, T0597）`。

---

## 回報區

### 結果摘要

- **FIXED**：`permission-request` 帶 `toolName === 'AskUserQuestion'` 時 reason 記為 `question`（T0596 方案 A）。真實順序 `ask-user-question` → `permission-request(AskUserQuestion)` → `ask-user-question-done` 現在是 `blocked (question)` → `unchanged`（`blockedSince` 保留 `PreToolUse` 的時間，不印轉換行）→ `cleared (hook ask-user-question-done)`。
- 契約不變：`blockedReason` 列舉、欄位名、channel 參數、`HOOK_EVENT_REASON` / `HOOK_EVENT_CLEARS_ONLY` 內容與語意都沒動。`scripts/bat-hook.mjs` 不用改（`hookReport` 已對 `permission-request` 送 `tool_name`）。CLAUDE.md 未改：例外對應寫在 docs 事件表，我認為不屬於必守規則。
- 沒有加 T0596 提的方案 C 保險（`ask-user-question-done` 也清 `toolName = AskUserQuestion` 的 `permission`）：不在本單範圍。A 實施後，只有舊版 `bat-hook.mjs`（不帶 `tool_name`）才會出現這種狀態，而那時 `toolName` 本來就不存在，C 也起不了作用。

### 環境與落點

- Landing：C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS。C-1 PASS。C-3：`electron/terminal-blocked-state.ts` 等 5 項都存在 → PASS。C-2：無 `branch` 欄位。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`：沒有互動，Q/A 為無。
- frontmatter 原本 `status: TODO`（不是 `PENDING`），照常改為 `IN_PROGRESS`。

### 改動

- `electron/terminal-blocked-state.ts`：新增 export `hookEventReason(event, toolName?)`，`permission-request` + `AskUserQuestion` → `question`，其餘回 `HOOK_EVENT_REASON[event]`。`TerminalBlockedTracker.report` 改用它決定 reason。檔頭事件表註解補一行。
- `electron/__tests__/terminal-blocked-state.test.ts`（+3 個 it）：
  1. tracker：`hookEventReason` 對應表；真實順序 ask → permission-request(AskUserQuestion) 回 `unchanged`，`since` 不變 → done 清除；只有 permission-request(AskUserQuestion) → `blocked / question`，done 清除；`question` 期間 permission-request(Bash) → `permission`，done 回 `unchanged`；日誌只有預期的轉換行。
  2. channel：`terminal:report-hook` 回 `blockedReason: 'question'`（`unchanged` 與直接進入兩種），塔台 `terminal:get-state` 為 `question`，done → `cleared`，日誌沒有 `reason=permission`。
  3. 真 RemoteServer + 範圍權杖 + 真 `bat-hook.mjs` 程序：stdin `PermissionRequest` + `tool_name: AskUserQuestion`（含 `tool_input`）→ 線上只送 `{ event: 'permission-request', toolName: 'AskUserQuestion' }`，不送 SECRET / `tool_input`；塔台 get-state 為 `blocked / question`，`blockedSince` = PreToolUse 的時間；`PostToolUse` 清除；只有 PermissionRequest 時也是 `question`；Stop 清除。
- `electron/remote/__tests__/headless-blocked-state-e2e.test.ts`（+1 個 it，保留原 T0594 測試）：driver 以同一個指令依序執行 `ask-user-question` → 90 ms 後 `permission-request(AskUserQuestion)` → 3 s 後 `ask-user-question-done`。斷言：進入 `blocked (question)`；1.5 s 後（PermissionRequest 已回報）仍是 `question`，`blockedSince` 不變；之後不經 client 輸入離開 `blocked`；三個 hook 都 exit 0、stdout 為空。
- `e2e/t0590-blocked-state.spec.ts` 3b 段：Worker 的步驟改成真實順序（ask → 90 ms 後 permission-request(AskUserQuestion) → 6 s 後 done），結果索引跟著調整。另斷言：debug log 沒有該 Worker 的 `→ blocked reason=permission` 行；`bat-scripts.log` 有 `bat-hook` 的 `permission-request` / `unchanged`。
- `docs/agent-guide/blocked-state.md`：事件表 `PermissionRequest` 列補「`tool_name` = `AskUserQuestion` → `question`」。表下說明原因：AskUserQuestion 的 `requiresUserInteraction()` 為真，`checkPermissions` 一律回 ask，任何權限模式下都會執行這個 hook（claude 2.1.300 / 2.1.302，T0596 查證）；也寫明 `hookEventReason` 的位置與退回條件。回報 channel 段補 `toolName` 的用途。實機查證段補 T0596 的實測順序。「已知限制」：bypass 那一條改寫（bypass 下 AskUserQuestion 仍有 `PermissionRequest`，T0597 起回報 `question`；`permission` 只可能來自其他 requiresUserInteraction 工具，屬推論）；滑鼠回答 AskUserQuestion 的清除改為「T0597 起實際生效」，並說明之前為什麼沒有作用。驗證清單補 T0597 的測試。

### 驗證

| 項目 | 結果 |
|---|---|
| `npx vitest run electron/__tests__/terminal-blocked-state.test.ts` | PASS（22 / 22） |
| `npx vitest run electron/remote/__tests__/headless-blocked-state-e2e.test.ts` | PASS（6 / 6） |
| 反向驗證（暫時拿掉 `hookEventReason` 的 AskUserQuestion 分支，跑完後還原檔案） | 新增的 4 個測試全部 FAIL、其他 24 個 PASS：新測試確實能抓到 BUG-150 |
| `npm run test:unit` | PASS：**291 files passed，5075 passed / 3 skipped（5078）**，exit 0 |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npx vite build` | 成功 |
| `npx playwright test e2e/t0590-blocked-state.spec.ts`（vite build 之後） | PASS（1 passed，17.0 s） |

- 註：全套 unit 在主 checkout 上跑。當時並行的 T0598 只改了它自己的工單檔（另有 `src/styles/settings.css` 的既有 M），沒有動到產品程式碼。
- 實機（真實 claude）驗收：未做，需要互動。交給使用者，步驟如下。

### 實機驗收步驟（給使用者）

1. 用含本修正的 BAT build（或 `npm run dev`）開一個**系統 claude** 分頁（2.1.302），請它用 AskUserQuestion 問一題，並要求回答後做一段較長的工作（例如讀幾個檔案後再總結），這樣才能把 done 與 `Stop` 分開。
2. 問題出現時，在塔台分頁用 `bat_list_terminals`（或 `bat_get_state`）確認該分頁是 `blocked`、`blockedReason: question`（修正前是 `permission`）。
3. 用**滑鼠**點選答案。
4. 塔台再查一次：應**立刻**離開 `blocked`，不必等到回合結束的 `Stop`。debug log（`<appData>/BetterAgentTerminal/Logs/debug-*.log`）應依序出現 `[blocked] terminal=<id> → blocked reason=question (hook ask-user-question)`、`→ cleared (hook ask-user-question-done)`，中間**不會**有 `reason=permission (hook permission-request tool=AskUserQuestion)`。

### 異動檔案

- `electron/terminal-blocked-state.ts`
- `electron/__tests__/terminal-blocked-state.test.ts`
- `electron/remote/__tests__/headless-blocked-state-e2e.test.ts`
- `e2e/t0590-blocked-state.spec.ts`
- `docs/agent-guide/blocked-state.md`
- `_ct-workorders/T0597-fix-askuserquestion-blocked-reason.md`（本回報）
- 未觸碰：`scripts/bat-hook.mjs`、CLAUDE.md、T0598 的檔案、`src/styles/settings.css`。

### Commit

- 產品：`ddb9b970` `fix(blocked): AskUserQuestion 的 PermissionRequest 記為 question（BUG-150, T0597）`（以 `git commit --only` 提交上面 5 個產品 / 測試 / docs 檔）。
- 工單：本檔另以 `git commit --only` 提交。不 push。

### 後續建議

- 塔台：依 T0596 回報補正 CT-T017 第 74 / 81 / 104 行的措辭，版本條件寫「含 T0597 的 BAT 之前 / 之後」。
- 實機驗收通過後，BUG-150 可以結案。
