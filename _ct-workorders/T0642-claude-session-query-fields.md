---
schema_version: 1
schema_kind: workorder
id: T0642
title: "PLAN-050 B：查詢回傳 `claudeSessionName` / `claudeSessionId`（R3）——`SessionStart` hook 回報 sessionId（改 T0600）、BAT 重開後還原"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-050
priority: P2
sizing: M
created_at: "2026-10-18T16:44:32+0800"
started_at: "2026-10-18T16:45:53+08:00"
updated_at: "2026-10-18T17:08:06+0800"
completed_at: "2026-10-18T17:08:06+0800"
depends_on: [T0641]
related:
  - "D167（使用者同意改 T0600 契約讓 hook 回報 session_id）；T0640 回報區（Q1-5 hook stdin 欄位、Q2-2 現況與落點、介面契約草案 C-4 / C-5 / C-8、實作切分 B）"
  - "T0641（`claudeSessionNameRecords`，`electron/claude-session-name-record.ts`：每個分頁實際注入的名稱與原因；`docs/agent-guide/claude-session-name.md`）"
  - "T0590 / T0600（`bat-hook.mjs`、`terminal:report-hook`、`TerminalBlockedTracker`、`agentStarted` 生命週期）；T0582（`terminal:whoami` / `list` / `get-state` 契約）；T0584（`scripts/bat-mcp.mjs`）；T0537（`withSavedWorkerOwnership` / 已存分頁）"
  - "並行：T0644（D，「以塔台開啟 Claude」，只改 `src/**` 與 locales）"
affects_files:
  - scripts/bat-hook.mjs
  - "electron/terminal-blocked-state.ts（`terminal:report-hook` 接受 `sessionId`）"
  - electron/claude-session-name-record.ts
  - electron/terminal-query-handlers.ts
  - "scripts/bat-mcp.mjs（tool 說明與輸出欄位）"
  - "electron/pty-manager.ts、electron/main.ts、electron/window-registry.ts、electron/worker-ownership.ts、electron/remote/headless-entry.ts（只在記錄 / 還原需要時）"
  - "electron/__tests__/**、electron/remote/__tests__/**、scripts/__tests__/**"
  - "e2e/t0642-claude-session-query.spec.ts（新，或擴充 e2e/t0600 系列）"
  - "docs/agent-guide/claude-session-name.md、docs/agent-guide/worker-launch-confirmation.md、docs/agent-guide/blocked-state.md、docs/agent-guide/helper-query-channels.md、docs/agent-guide/bat-mcp-shim.md、CLAUDE.md（相關節各補一兩句；PLAN-050 那一節由本單更新）"
  - _ct-workorders/T0642-claude-session-query-fields.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **C-4 狀態欄位**（T0640 草案，可微調並在回報說明）：`terminal:whoami`、`terminal:list` 每列、`terminal:get-state` 多 `claudeSessionName: string | null`（取 T0641 紀錄中實際注入的名稱；沒注入 = `null`）與 `claudeSessionId: string | null`（UUID；尚未回報、`blockedDetection: none`、BAT 重開後無紀錄都是 `null`，🔴 `null` 不代表沒有 session）。結束紀錄（exited）保留最後的值。既有欄位與值域一律不變。查詢範圍沿用 `authorizeHelperQueryTarget`，本單不放寬（`scope: 'towers'` 是 T0643）。"
  - "🔴 **C-5 hook 回報（D167 同意改 T0600）**：`terminal:report-hook { event: 'session-start', sessionId?: string }`。`bat-hook.mjs` 只在 `session-start` 讀 stdin 的 `session_id`，驗證 UUID 格式，不合格就不帶。🔴 T0590 / T0600 其他規則不變：一律 exit 0、stdout 不輸出任何東西、任何失敗靜默、總時限 1.8 s；除了 `session_id` 不送其他 payload（不送 `source` / `transcript_path` / `cwd` 等）。舊 BAT 不認得 `sessionId` 時 hook 仍 exit 0。`startup` / `resume` / `clear` / `compact` 的 `SessionStart` 都更新 sessionId（`agentStartedAt` 仍只記第一次，T0600 契約不變）。日誌（`[blocked]` / `[agent-start]` / bat-scripts.log）只記 sessionId 前 8 碼。"
  - "🔴 **C-8 持久化**：Electron 把 `claudeSessionName` / `claudeSessionId` 存進分頁紀錄（不含權杖），BAT 重開且 Terminal Server 存活時還原；headless 不持久化（已知限制）。持久化位置自選，限 `electron/**`；若必須經 renderer 的 `workspace:save`，先在工單提問（避免與 T0644 同時改 `src/**`）。"
  - "🔴 **並行工單 T0644** 同時改 `src/components/**`、`src/stores/**`、`src/types/index.ts`、`src/locales/**`：本單**不得改這些檔案**。CLAUDE.md 與 `docs/agent-guide/claude-session-name.md` 只由本單改（T0644 的文件段落由後續 T0643 併入）。"
  - "🔴 非隔離工單。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。不 push。"
  - "🔴 與另一張工單並行：`npx vite build` / e2e 共用 `dist` / `dist-electron`，兩邊同時 build 可能互相覆寫或鎖檔 —— build 或 e2e 出現與自己變更無關的失敗時，先重跑一次再判斷，並在回報區記錄。"
---

# T0642 — 查詢回傳 claude session 名稱與 sessionId（PLAN-050 B）

## 背景

T0641 已讓 claude-cli 分頁啟動時帶 `--name`，並在主行程記下每個分頁實際注入的名稱。本單把名稱與 sessionId 開放給查詢（R3），讓 CT 能由 BAT 分頁對應到 ListAgents 上的 session。sessionId 由已注入的 `SessionStart` hook 回報（T0640：`--session-id` 會讓 claude 在 resume / 重啟時啟動失敗，不用）。

## 要做的事

1. `bat-hook.mjs`：`session-start` 時讀 `session_id`，UUID 驗證後帶進 `terminal:report-hook`。
2. `terminal:report-hook`：接受並記錄 `sessionId`（只限呼叫者自己的分頁，現行規則）；不合格的值忽略（不回錯誤、不影響 `agentStarted`）。
3. 查詢欄位：`whoami` / `list` / `get-state` 加 `claudeSessionName` / `claudeSessionId`；exited 保留；MCP（`bat-mcp.mjs`）tool 說明補一句欄位意義（仍 `readOnlyHint: true`）。
4. 持久化與還原（C-8）。
5. 文件：`claude-session-name.md` 加 R3 一節（欄位、來源、`null` 的意義、生命週期、持久化）；`worker-launch-confirmation.md` / `blocked-state.md` 註明 hook 契約的改變（T0600 → 本單）；`helper-query-channels.md` 契約表加兩欄；CLAUDE.md PLAN-050 節補一句；`bat-mcp-shim.md` 一句。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（基線 5334 / 307）
- `npx vite build` 成功
- 測試涵蓋：hook 只帶合格 UUID、仍 exit 0 無 stdout；`/clear` 類的第二次 `session-start` 更新 sessionId 但不改 `agentStartedAt`；三個查詢的欄位（注入 / 未注入 / codex / exited）；舊 BAT 對 `sessionId` 欄位的相容；持久化還原
- e2e（隔離實例、不耗 token，可沿用 T0600 / T0590 的假 claude 腳本跑 `bat-hook.mjs session-start` 並餵 stdin）：塔台 MCP `bat_get_state` / `bat_list_terminals` 拿到 `claudeSessionName` 與 `claudeSessionId`；日誌只有 sessionId 前 8 碼

## 驗收

- R3：塔台可由 BAT 查到自己 Worker（及自己）的 session 名稱與 sessionId
- hook 規則（exit 0、stdout 空、時限）不變；既有欄位與 exit code 不變
- 驗證全部通過；回報區附：最終欄位定義（給 CT-T021 用）、持久化設計、測試清單、commit

---

## 回報區

### 結果摘要

**DONE**。R3 完成：塔台經 `terminal:whoami` / `terminal:list` / `terminal:get-state`（MCP `bat_whoami` / `bat_list_terminals` / `bat_get_state`）取得自己與自己 Worker 的 `claudeSessionName` / `claudeSessionId`；sessionId 由 `SessionStart` hook 回報（D167 改 T0600 契約），Electron 以 `<userData>/claude-sessions.json` 在 BAT 重開、Terminal Server 存活時還原。hook 規則（exit 0、stdout 空、1.8 s、不送其他 payload）與既有欄位 / exit code 不變。

### 落點檢查（Landing Zone）

- 結果：**PASS**
- C-0：工單 `repo: better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）→ PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：前 5 個可測項目（`scripts/bat-hook.mjs` 等）皆存在 → PASS（C-0 已 PASS，僅記錄）
- C-2：工單無 `branch` 欄位，略過（實際 `main`）
- 非隔離工單（`CT_HOME` 未設定）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 最終欄位定義（給 CT-T021）

`terminal:whoami`、`terminal:list` 每一列、`terminal:get-state` **每個回傳都有這兩個鍵**（`terminal:wait` 不加；既有欄位與值域不變）：

| 欄位 | 型別 | 來源 | `null` 的意義 |
|---|---|---|---|
| `claudeSessionName` | `string \| null` | 該分頁最後一次啟動決策實際注入的 `--name`（T0641 `claudeSessionNameRecords`） | 沒注入：非 claude-cli（codex / 自訂 CLI / shell）、使用者自己命名、system claude 太舊或讀不到版本 |
| `claudeSessionId` | `string \| null`（UUID） | 該 PTY 的 claude 最後一次 `SessionStart` hook 的 `session_id` | 還沒回報、`blockedDetection: none`、hooks 被關、BAT 重開後無存檔（headless / Terminal Server 沒存活）。🔴 `null` 不代表沒有 session |

- 每一次 `SessionStart`（startup / resume / clear / compact）以新值取代 sessionId；`agentStartedAt` 仍只記第一次（e2e 實測 `/clear` 換 id、時間不變）。
- 結束紀錄（exited）保留兩值；PTY 結束 / ⏻ 重啟 / Terminal Server recovery 清除 sessionId；使用者輸入不清除。名稱不隨 PTY 清除（是「最後一次注入的名稱」，不保證 claude 仍在跑）。
- 範圍沿用 `authorizeHelperQueryTarget`，未放寬（worker 對綁定塔台的 metadata 也看得到兩欄）。
- hook 契約（C-5）：`terminal:report-hook { event: 'session-start', sessionId?: string }`；handler 以 `CLAUDE_SESSION_ID_PATTERN` 驗證，不合格 / 非字串 / 其他 event → 忽略、不回錯誤，回應格式不變。舊 BAT 忽略該欄位，hook 仍 exit 0。

### 持久化設計（C-8）

- 唯一實作 `ClaudeSessionPersistence`（`electron/claude-session-name-record.ts`），比照 T0576 `helper-capabilities.json`；只在 `electron/**`，**不經 renderer `workspace:save`、不動 window registry**（故未提問）。
- 檔案 `<userData>/claude-sessions.json` = `{ version: 1, sessions: [{ terminalId, name, sessionId }] }`，只存執行中且兩值至少一個非 null 的 PTY；不含權杖；原子寫入、內容沒變不重寫。
- main.ts：whenReady 與 helper capabilities 同時 `load`（PtyManager 建立前）→ pending；`onSurvivingPtys` `settle`（存活者還原：名稱僅在沒有更新的啟動決策時、sessionId 經 `PtyManager.restoreClaudeSessionId` 僅在未回報新值時）；`startTerminalServer` fork 前 `settle(() => false)` 全丟。寫入時機：`recordClaudeSessionName`、`onClaudeSessionChange`（新 PtyManagerDeps）、`onPtyExit`、`onServerRecovery`。
- headless：只在記憶體（已知限制）。
- 還原不含 `agentStartedAt` / `blockedDetection` / tower 角色（各自既有限制）：BAT 重開後可能 `claudeSessionId` 有值但 `blockedDetection: none`、`agentStarted: null`、role `shell`（e2e 實測）。

### 變更檔案

- `scripts/bat-hook.mjs`（`SESSION_ID_PATTERN`、`hookReport` 帶 `sessionId`、bat-scripts.log `session` 前 8 碼）
- `electron/terminal-blocked-state.ts`（`CLAUDE_SESSION_ID_PATTERN`、`sessionIdForLog`、tracker `sessionIds` / `getSessionId` / `restoreSessionId` / `onSessionChange`、report-hook 收 `sessionId`、鏡像前 8 碼）
- `electron/pty-manager.ts`（`ExitedPtyRecord.claudeSessionId`、`reportHookEvent` 第 4 參數、`getClaudeSessionId`、`restoreClaudeSessionId`、`PtyManagerDeps.onClaudeSessionChange`）
- `electron/claude-session-name-record.ts`（store read / write、`ClaudeSessionPersistence`）
- `electron/terminal-query-handlers.ts`（`getClaudeSessionName` dep、`claudeSessionOf`，三個 channel 加欄位）
- `electron/main.ts`、`electron/remote/headless-entry.ts`（接線）
- `scripts/bat-mcp.mjs`（三個 tool 說明、whoami 摘要）
- 測試：新 `electron/__tests__/claude-session-query.test.ts`；`terminal-blocked-state` / `terminal-query-handlers` / `codex-osc-state` / `tower-questions` / `claude-session-name-launch` / `bat-hook` / `bat-mcp` 測試更新；新 e2e `e2e/t0642-claude-session-query.spec.ts`
- 文件：`docs/agent-guide/claude-session-name.md`（新「查詢欄位 R3」節、日誌、已知限制、驗證）、`worker-launch-confirmation.md`、`blocked-state.md`、`helper-query-channels.md`、`bat-mcp-shim.md`、`CLAUDE.md` PLAN-050 節
- 未動 `src/components/**`、`src/stores/**`、`src/types/index.ts`、`src/locales/**`、`src/styles/settings.css`

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | ✅ 0 |
| `npm run typecheck:electron` | ✅ 0 |
| `npm run test:unit` | ✅ 310 files / 5371 passed / 3 skipped（基線 5334 / 307；+T0644 2 檔、+本單 1 檔） |
| `npx vite build` | ✅ 成功 |
| e2e `e2e/t0642-claude-session-query.spec.ts` | ✅ 1 passed（31.6 s，最終 build 上重跑） |
| 回歸 e2e `t0590` / `t0600` / `t0576`（含 control）/ `t0641` | ✅ 5 passed |

測試涵蓋（對應工單「驗證」）：
- hook 只帶合格 UUID、仍 exit 0 無 stdout：`bat-hook.test.mjs`（`hookReport` / `reportHook`）、`terminal-blocked-state.test.ts` 真 RemoteServer + 真 `bat-hook.mjs` process（UUID 送出、非 UUID 不送、`source` / `transcript_path` / `cwd` 不送、bat-scripts.log 只有前 8 碼）
- `/clear` 類第二次 `session-start` 更新 sessionId、不改 `agentStartedAt`：tracker 單元、真 hook process、e2e
- 三個查詢欄位（注入 / 未注入 / codex / exited）、範圍不變、`wait` 不加欄位：`claude-session-query.test.ts`
- 舊 BAT 相容：T0600 BAT（丟棄 `sessionId`）與更舊 BAT（`INVALID_ARGS`）皆 exit 0（真 hook process）；handler 層 T0600 形狀不變
- 持久化還原：store 格式 / 無權杖 / 損毀 / 無效項目、兩個 BAT 行程間的還原 / 丟棄 / 新值優先 / 結束移除 / 不重寫（單元）；e2e 保留 Terminal Server 重開 BAT → `[claude-session] kept restored` → 塔台 MCP 讀回名稱與兩個 sessionId
- e2e：塔台 MCP `bat_whoami`（`T0642 · Tower` + SID_T）、`bat_get_state` / `bat_list_terminals`（Worker 名稱 null + SID_W）；debug log / bat-scripts.log 只有前 8 碼、不含完整 sessionId / 權杖 / hook 內容

### 偏離與決策（yolo，自行決定，未提問）

1. **`terminal:wait` 不加兩欄**：C-4 只列 whoami / list / get-state；`wait` 共用 `StateSnapshot`，刻意不擴（測試斷言 wait 沒有該欄位）。若 CT 需要在 `until: 'agent-started'` 後直接拿 sessionId，可另開小單。
2. **修正 T0641 的 renderer source guard**（`electron/__tests__/claude-session-name-launch.test.ts`）：T0644（commit `6174a6f2`）把 `startClaudeCliPty` 的 `sessionName` 改成依 `launchRole` 的三元式，使 T0641 guard 失敗（T0644 範圍不含 `electron/**`）。該檔在本單 `affects_files` 內，故把 guard 改成比對新寫法的 tab 分支，維持「一般分頁仍是 `<ws> · <短 ID>`」的守護。
3. **持久化不經 renderer**：選 main 端獨立檔（比照 T0576），不需改 `src/**`，未觸發工單要求的提問條件。
4. `/clear` 換 sessionId：T0640 列為推論；本單 e2e 以模擬的 `source: clear` hook 驗證 BAT 端行為（取代、不改時間），**未以真 claude 實測** `/clear` 會換 id（不耗 token 原則）。

### 已知限制

- headless 不持久化；BAT 重開後 `agentStarted` / `blockedDetection` / tower 角色不還原（各自既有限制），可能出現 sessionId 有值但 `blockedDetection: none`。
- 名稱是最後一次注入的值；claude 結束、shell 仍在時兩欄仍回傳最後的值（未注入 `SessionEnd`）。
- 手動在 shell 打 `claude`、hooks 被關閉 → `claudeSessionId` 為 null。

### 遭遇問題

- 並行工單 T0644 於本單執行期間提交，導致 T0641 renderer guard 失敗（見偏離 2，已處理）。
- `vite build` / e2e 與 T0644 並行，未遇到互相覆寫或鎖檔問題。
- bash heredoc 內含特定字元時 `bash -c` 解析失敗，改以 scratchpad 的 Python 腳本套用編輯（不影響產物）。

### Commit

- 產品：`12da2ca6` feat(T0642): claudeSessionName / claudeSessionId in whoami / list / get-state (PLAN-050 B, D167)
- 工單：本次結案 commit（`git commit --only _ct-workorders/T0642-claude-session-query-fields.md`）
- 未 push

### 互動紀錄

- 無（yolo，未向塔台提問）。
