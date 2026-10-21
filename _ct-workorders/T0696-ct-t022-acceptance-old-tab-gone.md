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
started_at: "2026-10-22T01:32:52+0800"
updated_at: "2026-10-22T01:33:33+0800"
depends_on: []
related:
  - CT-T022
  - BUG-170
  - D180
affects_files:
  - _ct-workorders/T0696-ct-t022-acceptance-old-tab-gone.md
renew_count: 1
tower_question: open
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

## 塔台補充（Renew #1）

**時間**：2026-10-22T01:33:33+0800（取自系統）
**補充內容**：
> 備援 `需要協助` 已收到；依 yolo-mode.md「收到備援」在本區段答覆 Q-1。

- **塔台答覆 Q-1**：[B] 寫 `BRAVO`——驗收用，無技術差異（2026-10-22T01:33:33+0800；塔台代決）

**新指示**：
> 依上方答覆完成執行步驟 2，狀態 `DONE`。

## 回報區

### 待塔台決策

#### Q-1：驗收用問題——回報區的「選定代號」要寫 A 還是 B？
- 提問時間：2026-10-22T01:33:00+0800
- 選項：[A] 寫 `ALPHA` / [B] 寫 `BRAVO` / [C] 其他：________
- Worker 建議：無偏好（驗收用）
- 影響範圍：本工單回報區
- 阻塞：是

### 完成狀態

`BLOCKED`（第一次執行；yolo 提問備援）。依步驟 1 送出 Q-1 與 `T0696 提問`；`worker_question_timeout: 0` → 不走 BAT 問答通道、不等待，直接備援：保留 `### 待塔台決策` 與 `tower_question: open`，送 `T0696 需要協助`。待塔台於 `## 塔台補充（Renew #1）` 答覆 Q-1 後重派。

落點檢查：`PASS`
- C-0：frontmatter `repo` = `better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）→ PASS
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 下的本工單 → not applicable
- C-2：工單無 `branch` 欄位（目前 `main`）→ 略過
- `CT_HOME` 未設（非 worktree 隔離）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`BAT_TERMINAL_ID` = `61ee470801c0c5b32a1eeac301f33551`

### 選定代號

（尚未答覆；待 Renew #1 依塔台答覆 Q-1 填寫）

### 互動紀錄

- [01:33] Q-1: 回報區「選定代號」寫 A 還是 B → 送 `T0696 提問`（`--submit`，exit 0）；`worker_question_timeout: 0` → 不等待，走備援 → Action: `BLOCKED`、送 `T0696 需要協助`

### 遭遇問題

- 無。工作目錄另有 `_ct-workorders/T0695-ct-t022-acceptance-fallback-redispatch.md` 未提交變更，非本單範圍，未動（本單只以 `git commit --only` 提交本工單檔）。

### Commit

- `aea731f6ace740ca6184edeff6fe63f41cee2a17`：T0696 IN_PROGRESS + Q-1（送 `提問` 前）
- 本次收尾 commit：狀態 `BLOCKED` + 回報（hash 見 git log）
- 無產品變更（驗收用工單）；未 push

### 回報時間

2026-10-22T01:33:20+0800
