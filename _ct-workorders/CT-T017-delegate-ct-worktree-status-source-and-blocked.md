---
schema_version: 1
schema_kind: workorder
id: CT-T017
title: "【受派】CT 接 BAT 0.7.0-pre.4 兩個新介面：`--worktree-status` 關閉後可查（`source`）與 `blocked` 狀態（斷點 D）"
type: implementation
status: TODO
repo: BMad-Guide
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-18T02:19:05+0800"
depends_on:
  - "T0589（PLAN-047 Q3：`--worktree-status` 關閉後可查，`source` 欄位）"
  - "T0590 / T0594（PLAN-047 M1b-1：claude-cli 分頁 `blocked`）"
  - "BAT `v0.7.0-pre.4`（2026-10-18 已發佈）"
related:
  - CT-T015
  - CT-T016
  - D150
  - PLAN-047
interaction:
  mode_hint: ask
  interactive: true
  intervention_type: delegate
renew_count: 0
---

# CT-T017 — `source`（關閉後查 worktree 狀態）與 `blocked`（斷點 D）

## 跨專案協調

- **協調類型**：DELEGATE
- **來源專案**：better-agent-terminal（PLAN-047 Q3 / M1b-1）
- **目標專案**：BMad-Control-Tower（由 **BMad-Guide 塔台**派發執行，本檔為需求規格）
- **BAT 介面權威**：BAT repo `CLAUDE.md`「worktree 狀態查詢（PLAN-047 W1 / T0585）」「blocked 狀態偵測（PLAN-047 M1b / T0590）」兩節，細節在 `docs/agent-guide/worktree-status.md`、`docs/agent-guide/blocked-state.md`。本檔與權威不一致時以權威為準，差異請在完成回覆列出。
- **BAT 最低版本**：兩項皆 **`>= 0.7.0-pre.4`**。

## 一、`--worktree-status` 分頁關閉後仍可查（T0589）

### BAT 行為

- 指令與 exit code 不變：`"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --worktree-status T#### --notify-id "$BAT_TERMINAL_ID"`（或 MCP `bat_worktree_status`）。
- 回傳新增 `source`，依序找、第一個找到的就用：

  | `source` | 何時 | 備註 |
  |---|---|---|
  | `live` | Worker 分頁還在執行 | T0585 原行為 |
  | `exited` | 分頁已結束，且在 BAT 的結束紀錄內（**10 分鐘 / 最多 32 筆**） | 另帶 `exited: true`、`exitedAt`；`terminalId` = 已結束的 id |
  | `git` | 以上都沒有，且**以工單號查詢 + 塔台權杖 + 塔台分頁仍在執行** | 從塔台分頁 cwd 所在 repo 的 git 依位置規則（`.bat-worktrees/<repo>/<T####>`、分支 `ct/<T####>`）找回；`terminalId: null` |

- `source: git` 時：worktree 仍登記（以 `--worktree keep` 關閉）→ `dirty` 照常讀；已 `--worktree remove`（只剩分支）→ `dirty: null`、`dirtyCount: null`、`worktreeMissing: true`，其餘欄位照算。
- 仍回 `NOT_FOUND`（exit 3）：分支 `ct/<T####>` 不存在（已 `archive` 改名或刪除）、塔台 cwd 不是 git repo；或用 `terminalId` 參數 / Worker 權杖 / server token 查已關閉的分頁（這些不走 `git`）。
- 有結束紀錄但不在範圍內 → `NOT_OWNER`，不會再往 `git` 找。

### 修改清單

1. `merge-workorder.md` § 合併判準資料來源（第 24 行「**在回收 Worker 分頁之前**查 `--worktree-status`（分頁關閉後 BAT 查不到，只能改用 git）」與第 116 行起）：BAT `>= 0.7.0-pre.4` 時回收後也可直接用 `--worktree-status`，不必搶在回收前查；git 重算只留給：
   - 舊 BAT（`< 0.7.0-pre.4`：關閉後 exit 3、回傳沒有 `source`）
   - 分支已 `archive` / 刪除（exit 3）
2. 判準第 5 條（`dirty` 為空陣列；`worktreeMissing` 不算通過）維持不變：以 `--worktree keep` 關閉時 `dirty` 照常可讀，不影響現行流程。
3. 版本對照：舊 BAT 的判定方式 = 回傳沒有 `source` 欄位。

## 二、`blocked` 狀態（斷點 D，T0590 / T0594）

### BAT 行為

- `terminal:get-state` / `terminal:list` / `terminal:wait`（MCP `bat_get_state` / `bat_list_terminals` / `bat_wait`）的 `state` 多一個 `blocked`。優先序：`exited` > `blocked` > `working` / `idle`。
- `blocked` 時另回 `blockedReason`（`permission` = 權限確認 / `question` = AskUserQuestion / `elicitation` = MCP 表單）、`blockedSince`（ms）、`source: 'hook'`；其他狀態 `source: 'output'`。
- **每個** state 回傳都帶 `blockedDetection`：
  - `hook`：這個分頁注入了 BAT 的 claude hooks，`blocked` 可信。
  - `none`：沒有偵測能力（codex、Settings 關閉 BAT MCP、自訂參數已含 `--settings`、raw command 派工…）。**`none` 的分頁永遠不會回 `blocked`，它的 `idle` 不代表沒有在等人。**
- `bat_wait`：`until: 'state-change'` 在進入 / 離開 `blocked` 時返回，`fromState` 可為 `blocked`；`until: 'idle'` 以「不是 `working`」判斷，`blocked` 也會返回。
- 清除：使用者送出下一則 prompt、回合結束（`Stop`）、AskUserQuestion 回答完成（只清 `question`）、使用者在該分頁鍵盤輸入、分頁結束。
- 只有 MCP 能查（沒有對應的 helper CLI 參數）。

### 已知限制（CT 文件須寫明）

- 只有 claude-cli Worker 支援；codex Worker 一律 `blockedDetection: none`（BAT M1b-2 未排期）。
- 權限對話框以**滑鼠**允許 / 拒絕、elicitation 以滑鼠回答或逾時關閉：`blocked` 會維持到該回合 `Stop` 或使用者鍵盤輸入。
- 以 `--dangerously-skip-permissions` 啟動的 Worker（本專案 yolo Worker 的自訂參數）不會出現 `permission`，只會有 `question` / `elicitation`。
- 使用者或專案設定 `disableAllHooks: true` 時 hooks 不執行：`blockedDetection` 仍是 `hook`，但不會有事件。

### 修改清單

1. `auto-session.md` 第 972 行 `bat_get_state` 列（「`blocked` **尚未提供**」）與第 990 行（斷點 D「在那之前不定義、不使用」）：改為 BAT `>= 0.7.0-pre.4` 提供，並定義斷點 D。
2. **斷點 D 定義**（建議，最終由 BMad-Guide 塔台 / 使用者決定）：
   - 觸發：塔台查到 Worker `state == blocked`。
   - 處理：以分頁標題告訴使用者「哪張工單、在等什麼（`blockedReason`）、從何時開始」，並請使用者到該分頁回答。**塔台不代答、不送按鍵**，yolo 也一樣。
   - Worker 啟動檢查與「Worker 是否卡住」的判斷：`blocked` 不算卡住或失敗，不重派、不計入連續 FAILED。
   - `blockedDetection: none` 的 Worker：維持現行判斷方式（看輸出 / 等待時間），不得把 `idle` 解讀為沒有在等人。
3. 版本對照：舊 BAT 的判定方式 = state 回傳沒有 `blockedDetection` 欄位，此時斷點 D 不啟用。

## 三、順帶告知（不需修改 CT）

- BUG-149 / T0593：全新安裝的 Windows（`settings.json` 沒有 `shell` 鍵）上，helper `--agent` 派出的 claude / codex Worker 起不來，pre.4 已修。
- BAT `v0.7.0-pre.4` 更版重點有「歡迎協助測試」一節，請 codex 使用者以 Codex CLI 當 Worker 跑一次 Tower / Worker 流程並回報。

## 驗收

- 文件：`source` 的資料來源規則與斷點 D 定義各在權威位置寫一份；版本對照表加 BAT `0.7.0-pre.4`。
- 實機（BAT `0.7.0-pre.4`）：
  1. 隔離派一張小單，Worker 以 `--worktree keep` 回收後查 `--worktree-status T####`：10 分鐘內為 `source: exited`；BAT 重開或超過 10 分鐘為 `source: git`；`dirty` 照常可讀。
  2. 派一張 claude-cli Worker 小單，請 Worker 用 AskUserQuestion 問一題：塔台 `bat_get_state` 為 `blocked` / `question`、`blockedDetection: hook`；回答後恢復為 `working` / `idle`。
  3. codex Worker：`blockedDetection: none`。

---

## 轉交紀錄

- 2026-10-18T02:19:05+0800：BAT 塔台建立（第七十六 session），待轉交 BMad-Guide 塔台。
- 2026-10-18T02:20:06+0800：BAT 塔台以跨 session 訊息轉交 BMad-Guide 塔台（`bmad-guide-94`，msg `3426f784`，`notify_when_idle`），同一則附上回覆檔 `_reply-2026-10-18-bmad-guide-log-dir-handled.md`。
