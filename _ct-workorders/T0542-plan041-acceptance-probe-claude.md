---
schema_version: 1
schema_kind: workorder
id: T0542
title: "PLAN-041 實機驗收探針（claude Worker）：真實 claude Worker 完成回報後閒置，供塔台以 CT v5.1.0 `worker_auto_close` 回收分頁"
type: verification
status: PENDING
repo: better-agent-terminal
project: PLAN-041
priority: P2
sizing: XS
created_at: "2026-10-15T19:59:34+0800"
updated_at: "2026-10-15T19:59:34+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.3（已安裝，不改程式碼）"
depends_on: []
related:
  - "PLAN-041 介面契約（`--close-worker` exit code）；D144"
  - "T0543（同一驗收的 codex Worker 探針，本單完成後才派）"
affects_files:
  - _ct-workorders/T0542-plan041-acceptance-probe-claude.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 本單只改本工單檔；不改任何產品程式碼、不跑 build / test。commit 用 `git commit --only _ct-workorders/T0542-plan041-acceptance-probe-claude.md`（`src/styles/settings.css` 的 M 狀態不是你的變更）。"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不要自己呼叫 `bat-terminal.mjs --close-worker`、不要關閉或重啟任何分頁；不碰使用者正在用的 BAT（port 9876）以外的行為。"
  - "🔴 通知塔台（ct-exec 收尾的 bat-notify）之後**不要再執行任何指令、不要再輸出**，保持閒置等塔台回收本分頁。"
---

# T0542 — PLAN-041 實機驗收探針（claude Worker）

## 背景

PLAN-041（Worker 分頁回收）BAT 端已隨 `0.6.1-pre.3` 發佈，本機已安裝；Control Tower v5.1.0 也已在本機生效。剩下的實機驗收是：**真實 claude Worker 回報後閒置時，會不會因為 TUI 週期輸出而被判 `BUSY`（exit 6）或在延遲期間被取消**。

本單就是那個 Worker。你的工作很小，真正的驗收由塔台在你回報後執行（`--close-worker`，延遲 10 秒）。

## 任務

1. 照 ct-exec 流程開工（填 `started_at`、`status: IN_PROGRESS`）。
2. 在回報區記錄以下事實（用指令取值，不要推測）：
   - 目前 agent 與版本（例：`claude --version`；若取不到就寫「取不到」與原因）
   - 環境變數：`BAT_SESSION`、`BAT_TERMINAL_ID`、`BAT_TOWER_TERMINAL_ID`、`BAT_WORKSPACE_ID`、`CT_MODE`、`CT_INTERACTIVE`（**不要**印 `BAT_REMOTE_TOKEN` 的值，只寫有沒有設定）
   - 系統時間（`date "+%Y-%m-%dT%H:%M:%S%z"`）
3. 填完成狀態 `DONE`、`completed_at`，`git commit --only` 本工單檔。
4. 照 ct-exec 收尾通知塔台（yolo：`bat-notify.mjs --submit`，`--source "T0542"`）。
5. **通知之後保持閒置**，不再執行指令。分頁會在塔台收單後約 10 秒被 BAT 自動關閉，這是預期行為。

## 驗收條件（Worker 部分）

- [ ] 回報區含 agent / 版本、上述 env（token 只寫有無）、系統時間
- [ ] commit 只含本工單檔
- [ ] 已通知塔台，之後無額外動作

## 塔台驗收（塔台在收單後執行，Worker 不需處理）

- `node "$BAT_HELPER_DIR\bat-terminal.mjs" --close-worker T0542 --notify-id "$BAT_TERMINAL_ID" --delay-ms 10000` 的 exit code（期望 `0`；`6` = BUSY → 記錄為發現）
- `debug-*.log` 的 `[close-worker]` 行（排程 / 取消 / 關閉）、`bat-scripts.log` 的 `close-worker` 事件
- 10 秒後分頁是否消失、window registry 內是否已無此分頁

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 回報時間
