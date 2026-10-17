---
schema_version: 1
schema_kind: workorder
id: T0601
title: "探針：`v0.7.0-pre.6` 安裝版實機驗收（T0600 啟動確認、BUG-151 啟動指令、BUG-150 AskUserQuestion → `question`）"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-047
priority: P1
sizing: XS
created_at: "2026-10-18T04:13:45+0800"
started_at: "2026-10-18T04:15:29+0800"
updated_at: "2026-10-18T04:18:18+0800"
completed_at: "2026-10-18T04:18:18+0800"
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

（無）

### 完成狀態

DONE — 步驟 4 三項皆 PASS。

### 產出摘要

**Landing check**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 本檔位於 `REPO_ROOT` 下；C-3 不適用（`affects_files` 只有本檔）；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_HOME` 未設定（非 worktree）。本分頁 `BAT_TERMINAL_ID=7dfd88e37341ad32de55d563173a84fb`。

**時間軸（UTC，來源 `debug-20261018-041113.log` / `bat-scripts.log`）**

| 時間 | 事件 |
|---|---|
| 20:15:04.563 | `[agent-command]` 派工指令組裝（posix） |
| 20:15:06.263 | `session-start` hook → `[agent-start] started` |
| 20:15:32（本機 04:15:32） | 步驟 2 呼叫 `AskUserQuestion` 前取的時間 |
| 20:15:33.476 | `[blocked] → blocked reason=question (hook ask-user-question)` |
| 20:16:10.969 | `[blocked] → cleared (hook ask-user-question-done)` |
| 20:16:13（本機 04:16:13） | 收到答案（`選項 B`）後第一個取時間的指令 |
| 20:16:13 → 20:17:20 | 步驟 3 停 60 秒（背景 `sleep 60`，結束時間 04:17:20） |
| 20:16:23.104 | `stop` hook → `unchanged`（回合結束；`blocked` 早已清除） |

#### 4-1 `[agent-command]` / `launch-suspect` — PASS

```
[2026-10-17T20:15:04.563Z] [LOG] [agent-command] id=7dfd88e37341ad32de55d563173a84fb shell family=posix from=persisted
[2026-10-17T20:15:04.595Z] [LOG] [agent-command] resolved agent=default to claude-cli source=settings workspace=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b (better-agent-terminal) workspaceSource=tower-terminal argsSource=settings
```

- `launch-suspect`：整個 `debug-20261018-041113.log` 出現 **0 次**（不只本分頁）。
- shell 解析：`shell-resolution … basename=bash.exe persistedShell=git-bash source=persisted fallback=no spawn=bash.exe`，與 `shell family=posix` 一致（BUG-151 / T0598：shell 只解析一次）。

#### 4-2 `[blocked]` 轉換 — PASS（BUG-150）

```
[2026-10-17T20:15:33.476Z] [LOG] [blocked] terminal=7dfd88e37341ad32de55d563173a84fb → blocked reason=question (hook ask-user-question)
[2026-10-17T20:16:10.969Z] [LOG] [blocked] terminal=7dfd88e37341ad32de55d563173a84fb → cleared (hook ask-user-question-done)
```

- 對話框出現 → 原因 `question`（修正前為 `permission`）。塔台的 `terminal:wait` 在 20:15:33.520 回 `changed=true state=blocked`。
- 滑鼠回答後由 `ask-user-question-done` hook 清除；清除時間比 Worker 收到答案後第一個指令（04:16:13）早約 2 秒，即回答當下清除。比回合結束的 `stop`（20:16:23.104）早約 12 秒，**不是**等 `Stop` 才清除。
- 附帶：對話框期間 20:15:33.567 另有 `permission-request` hook → `unchanged`，沒有把 `question` 覆寫成 `permission`。

#### 4-3 `report-hook` `session-start`（T0600）— PASS

```
{"ts":"2026-10-17T20:15:06.263Z","script":"remote-server","event":"report-hook","terminalId":"7dfd88e37341ad32de55d563173a84fb","hook":"session-start","result":"started"}
{"ts":"2026-10-17T20:15:06.264Z","script":"bat-hook","event":"report-hook","hook":"session-start","result":"started","durationMs":9,"terminalId":"7dfd88e37341ad32de55d563173a84fb"}
{"ts":"2026-10-17T20:15:06.396Z","script":"bat-terminal","event":"wait-started","terminalId":"7dfd88e37341ad32de55d563173a84fb","waitStartedMs":30000,"result":"started","waitedMs":1798,"agentStartedAt":"2026-10-17T20:15:06.263Z", …}
```

（`pid` 欄位已省略，其餘照原文。）`bat_get_state` 本分頁：`agentStarted: true`、`agentStartedAt: 1792268106263`、`blockedDetection: hook`。

#### BUG-151 啟動畫面 — PASS（間接證據）

- 啟動畫面已捲出 `bat_read_output` 的保留範圍（`skippedLines` 1600+，以 `cursor: 0` 讀取也只拿到保留範圍的開頭），無法直接看到第一屏。
- 間接證據：spawn（20:15:04.621）後 1.6 秒 claude 的 `SessionStart` hook 就回報了，`launch-suspect` 0 次，本 Worker 本身就是那條派工指令啟動的 claude，所以指令沒有被 `command not found` / `is not recognized` 擋下。

**檔案變更**：只有本工單檔。

### 互動紀錄

- [04:15] 步驟 2：依工單呼叫 `AskUserQuestion`（驗收對象，不是請示）→ 使用者以滑鼠選 `選項 B` → Action：步驟 3 停 60 秒後查日誌。
- 註：harness 擋下前景 `Start-Sleep 60`，改用背景 `sleep 60` 一次執行（04:16:13 → 04:17:20），等待期間沒有其他動作。

### 遭遇問題

- 無阻斷問題。啟動畫面無法以 `bat_read_output` 直接讀到（見上），BUG-151 判定用間接證據。

### 回報時間

2026-10-18T04:17:50+0800
