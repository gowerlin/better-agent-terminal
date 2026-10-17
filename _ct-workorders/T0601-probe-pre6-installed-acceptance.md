---
schema_version: 1
schema_kind: workorder
id: T0601
title: "探針：`v0.7.0-pre.6` 安裝版實機驗收（T0600 啟動確認、BUG-151 啟動指令、BUG-150 AskUserQuestion → `question`）"
type: verification
status: TODO
repo: better-agent-terminal
project: PLAN-047
priority: P1
sizing: XS
created_at: "2026-10-18T04:13:45+0800"
started_at: ""
updated_at: "2026-10-18T04:13:45+0800"
completed_at: ""
depends_on: [T0597, T0598, T0599, T0600]
related:
  - "BUG-150 / BUG-151 / BUG-152（FIXED，等實機）；T0602（同批，隔離實例 e2e）"
  - "CLAUDE.md「blocked 狀態偵測」「Worker 啟動確認（T0600，D154）」小節"
affects_files:
  - _ct-workorders/T0601-probe-pre6-installed-acceptance.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: true
  intervention_type: user-click
memory_overrides:
  - "🔴 驗證單：**不改任何產品程式碼、測試、CLAUDE.md、docs**；只寫本工單回報區並 commit 本檔（`git commit --only <本檔>`）。不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 **步驟 2 必須真的呼叫 `AskUserQuestion` 工具一次**：這是本單的驗收對象（BUG-150），不是向使用者請示。yolo 的「改向塔台提問（`T#### 提問`）」規則**不適用於這一題**；題目與選項照下方原文，不得改成文字提問或略過。除此之外不得再問任何問題。"
  - "🔴 日誌與輸出不得含權杖；回報區引用日誌只貼 `[agent-command]` / `[blocked]` / `launch-suspect` / `report-hook` 相關行。"
---

# T0601 — 探針：`v0.7.0-pre.6` 安裝版實機驗收

## 背景

本機 BAT 已換成 `0.7.0-pre.6`（塔台 2026-10-18 04:1x 以 FileVersion 確認）。塔台以 `--wait-started 30000` 派出本單，派工結果（exit code、`started:` 行）由塔台記錄，Worker 不需要重查。

本單由 Worker 製造一個 AskUserQuestion，讓塔台以 BAT MCP（`bat_wait` / `bat_get_state`）在外面觀察：
- 對話框出現時：`state: blocked`、`blockedReason: question`（BUG-150 修正前是 `permission`）。
- 使用者用**滑鼠**點選答案後：立即離開 `blocked`（不必等回合結束的 `Stop`）。

## 步驟

1. 讀本工單、標 `IN_PROGRESS`（照 ct-exec 流程）。
2. **呼叫 `AskUserQuestion` 一次**（單選，不要 multiSelect），內容照原文：
   - question：`T0601 驗收題：請用滑鼠點選任一選項（這是 BUG-150 的測試，答案不影響結果）`
   - header：`T0601 驗收`
   - options：`選項 A`（description：`點這個`）、`選項 B`（description：`或點這個`）
3. 收到答案後，**先停 60 秒再做下一步**（例：`Start-Sleep -Seconds 60` 或等價指令，一次執行）。這段時間讓塔台確認 `blocked` 已在回答當下清除，而不是等回合結束才清除。
4. 查本機 BAT 日誌（`%APPDATA%\BetterAgentTerminal\Logs\` 最新一個 `debug-*.log`，以及同目錄 `bat-scripts.log`），只看**本分頁**（`$env:BAT_TERMINAL_ID`）的行：
   - `[agent-command]` 派工指令寫入相關行；是否有 `launch-suspect`（應**沒有**）。
   - `[blocked]` 轉換行：對話框出現 → 原因是 `question`？滑鼠回答後是哪個事件清除、時間與步驟 2 回答時間差多少？
   - `report-hook`：`session-start` 是否有記錄（T0600）。
5. 回報區照下方格式填寫，commit 本檔，依 ct-exec 流程通知塔台。

## 驗收

- 回報區列出步驟 4 每一項的實際日誌行（或「沒有」）與判定 PASS / FAIL。
- 本分頁啟動畫面沒有 `command not found` / `is not recognized` 類錯誤（BUG-151）。
- 只 commit 本工單檔。

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

### 產出摘要

### 互動紀錄

### 遭遇問題

### 回報時間
