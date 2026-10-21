---
schema_version: 1
schema_kind: workorder
id: T0696
title: "CT-T022 驗收情境 2：舊 Worker 分頁已手動關閉時重派，`--close-worker` 回 NOT_FOUND 且照常派工（BUG-170）"
type: verification
status: PENDING
repo: better-agent-terminal
project: BUG-170
priority: P3
sizing: XS
created_at: "2026-10-22T01:31:47+0800"
depends_on: []
related:
  - CT-T022
  - BUG-170
  - D180
affects_files:
  - _ct-workorders/T0696-ct-t022-acceptance-old-tab-gone.md
renew_count: 0
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

# T0696 — CT-T022 驗收情境 2：舊分頁已不在

## 元資料

- **工單編號**：T0696
- **類型**：verification（CT 流程驗收用測試工單）
- **優先級**：P3
- **建立時間**：2026-10-22T01:31:47+0800
- **預估規模**：XS

## 目的

驗收 CT v5.12.x「重派前回收舊 Worker 分頁」在舊分頁已不存在時的處理（CT-T022 / BUG-170）。Worker 走 yolo 提問備援後，**使用者手動關閉該 Worker 分頁**，塔台再答覆並重派。

## 執行步驟（Worker）

1. **第一次執行**（本工單沒有 `## 塔台補充（Renew #1）` 區段時）：
   - 照 ct-exec 的「問塔台」規則提問，題目固定如下（不要自行回答、不要改題目）：
     - `#### Q-1：驗收用問題——回報區的「選定代號」要寫 A 還是 B？`
     - 選項：[A] 寫 `ALPHA` / [B] 寫 `BRAVO`
     - Worker 建議：無偏好（驗收用）
     - 影響範圍：本工單回報區
     - 阻塞：是
   - 因 `worker_question_timeout: 0`，送出 `T0696 提問` 後直接走備援：狀態 `BLOCKED`、保留 `tower_question: open`、commit 本工單、送 `T0696 需要協助`。
2. **重派後**（有 `## 塔台補充（Renew #1）` 且其中有 `塔台答覆 Q-1`）：
   - 依答覆在回報區 `### 選定代號` 寫入對應代號，記互動紀錄，刪除 `tower_question`，狀態 `DONE`，commit，通知塔台。

## 驗收條件（塔台）

- 使用者手動關閉第一次的 Worker 分頁後，Renew 重派前的 `--close-worker T0696 … --delay-ms 0` exit `3`（NOT_FOUND），塔台照常派工。
- 新 Worker `DONE` 後，收單回收 exit `0`。

## 回報區

### 完成狀態

### 選定代號

### 互動紀錄

### 遭遇問題

### Commit

### 回報時間
