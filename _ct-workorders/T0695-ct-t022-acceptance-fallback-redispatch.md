---
schema_version: 1
schema_kind: workorder
id: T0695
title: "CT-T022 驗收情境 1：yolo 提問備援 → 塔台 Renew 重派前回收舊 Worker 分頁（BUG-170）"
type: verification
status: PENDING
tower_question: open
repo: better-agent-terminal
project: BUG-170
priority: P3
sizing: XS
created_at: "2026-10-22T01:31:47+0800"
started_at: "2026-10-22T01:32:26+0800"
updated_at: "2026-10-22T01:33:33+0800"
depends_on: []
related:
  - CT-T022
  - BUG-170
  - D180
affects_files:
  - _ct-workorders/T0695-ct-t022-acceptance-fallback-redispatch.md
renew_count: 1
workdir: main repo
worker_question_timeout: 0
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: none
memory_overrides:
  - "🔴 本單是 CT 流程驗收用的測試工單：不改任何產品程式、測試、文件、設定；唯一可改的檔案是本工單。"
  - "🔴 yolo：不得問使用者。Git：只用 `git commit --only` commit 本工單檔；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0695 — CT-T022 驗收情境 1：備援重派

## 元資料

- **工單編號**：T0695
- **類型**：verification（CT 流程驗收用測試工單）
- **優先級**：P3
- **建立時間**：2026-10-22T01:31:47+0800
- **預估規模**：XS

## 目的

驗收 CT v5.12.x「重派前回收舊 Worker 分頁」（CT-T022 / BUG-170）。本單**刻意**讓 Worker 走 yolo 提問備援（`worker_question_timeout: 0`），塔台答覆後重派；驗收看的是塔台端的 `--close-worker` 結果，Worker 的工作本身只是一個小步驟。

## 執行步驟（Worker）

1. **第一次執行**（本工單沒有 `## 塔台補充（Renew #1）` 區段時）：
   - 照 ct-exec 的「問塔台」規則提問，題目固定如下（不要自行回答、不要改題目）：
     - `#### Q-1：驗收用問題——回報區的「選定代號」要寫 A 還是 B？`
     - 選項：[A] 寫 `ALPHA` / [B] 寫 `BRAVO`
     - Worker 建議：無偏好（驗收用）
     - 影響範圍：本工單回報區
     - 阻塞：是
   - 因 `worker_question_timeout: 0`，送出 `T0695 提問` 後直接走備援：狀態 `BLOCKED`、保留 `tower_question: open`、commit 本工單、送 `T0695 需要協助`。
2. **重派後**（有 `## 塔台補充（Renew #1）` 且其中有 `塔台答覆 Q-1`）：
   - 依答覆在回報區 `### 選定代號` 寫入對應代號，記互動紀錄，刪除 `tower_question`，狀態 `DONE`，commit，通知塔台。
   - 另在回報區記一行：`bat_whoami` 回傳的 `terminalId`（用來對照是否為新分頁）。MCP 不可用就寫「MCP 不可用」。

## 驗收條件（塔台）

- Renew 重派前的 `--close-worker T0695 … --delay-ms 0` exit `0`，舊分頁被關閉，只剩新 Worker 分頁。
- 新 Worker `DONE` 後，收單回收的 `--close-worker T0695` exit `0`（不是 `5` AMBIGUOUS）。

## 塔台補充（Renew #1）

**時間**：2026-10-22T01:33:33+0800（取自系統）
**補充內容**：
> 備援 `需要協助` 已收到；依 yolo-mode.md「收到備援」在本區段答覆 Q-1。

- **塔台答覆 Q-1**：[A] 寫 `ALPHA`——驗收用，無技術差異（2026-10-22T01:33:33+0800；塔台代決）

**新指示**：
> 依上方答覆完成執行步驟 2，狀態 `DONE`。

## 回報區

### 待塔台決策

#### Q-1：驗收用問題——回報區的「選定代號」要寫 A 還是 B？
- 提問時間：2026-10-22T01:32:51+0800
- 選項：[A] 寫 `ALPHA` / [B] 寫 `BRAVO` / [C] 其他：________
- Worker 建議：無偏好（驗收用）
- 影響範圍：本工單回報區
- 阻塞：是

### 完成狀態

BLOCKED — 第一次執行：依步驟 1 提問 Q-1，`worker_question_timeout: 0` → 不用 BAT 通道、不等待，直接走 yolo 提問備援（`### 待塔台決策` 與 `tower_question: open` 保留），等塔台在 `## 塔台補充（Renew #1）` 答覆後重派。

落點檢查：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 下的本工單 → not applicable
- C-2：工單無 `branch` 欄位（目前 `main`）
- 非 worktree（`CT_HOME` 未設）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`BAT_TERMINAL_ID`（本分頁）= `a56fe7ff577ab5f7fbfa03265dc8e35e`

### 選定代號

（未定：等 Q-1 答覆）

### 互動紀錄

- [01:32] Q-1 寫入工單、`tower_question: open`，commit `0fe25acc` → 送 `T0695 提問`（`--submit`，exit 0）
- [01:33] `worker_question_timeout: 0` → 備援：BLOCKED，送 `T0695 需要協助`

### 遭遇問題

無（備援是本單刻意設計的路徑）。未改任何產品檔案；未使用 BAT 問答通道（`worker_question_timeout: 0`），沒有待取消的 BAT 題目。

### Commit

- `0fe25acc` — 工單：Q-1 提問與 `tower_question: open`
- 本次收尾 commit（BLOCKED 與回報）：見 `git log -- _ct-workorders/T0695-ct-t022-acceptance-fallback-redispatch.md`
- 無產品變更；未 push

### 回報時間

2026-10-22T01:33:03+0800
