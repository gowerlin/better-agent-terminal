---
schema_version: 1
schema_kind: workorder
id: T0796
title: "BUG-196 實機驗收用的空工單：Worker 只寫回報並以 yolo `--submit` 通知塔台（塔台此時停在 AskUserQuestion 對話框）"
type: verification
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: XS
created_at: "2026-11-03T00:14:24+0800"
updated_at: "2026-11-03T00:15:11+0800"
started_at: "2026-11-03T00:14:59+0800"
completed_at: "2026-11-03T00:15:11+0800"
session_ids:
  - "ab15bea6-b7c0-4fb7-8392-6a4c871c1b17"
depends_on: []
related:
  - "BUG-196（high，FIXED，T0788 notify-hold，pre.8 起）；D233 / D240；CLAUDE.md「塔台等使用者回答時保留 Worker 通知（T0788 / BUG-196，D227）」"
affects_files:
  - _ct-workorders/T0796-bug196-live-acceptance-noop.md
renew_count: 0
workdir: main repo
worker_question_timeout: 0
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 本單沒有實作工作：讀完工單後**立即**照 ct-exec 收尾 —— 回報區寫完成狀態、落點檢查、`BAT_TOWER_TERMINAL_ID` 是否存在（只記有無，不寫值）、回報時間，`git commit --only` 本工單檔，然後照 yolo 規則以 `bat-notify.mjs --submit` 通知塔台（照 ct-exec 的通知指令原樣，不加、不減參數）。記下 bat-notify 的 exit code 與 stdout 原文（不含權杖）寫進回報區後再 commit 一次（或在第一次 commit 前先跑通知，二擇一，以 ct-exec 流程為準）。"
  - "🔴 不得改任何其他檔案、不跑測試、不 build、不 push；不得問塔台或使用者（`worker_question_timeout: 0`）；不得重送通知（exit 非 0 照實記錄即可）。禁止 `git stash`（含 `list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。完成狀態寫 `DONE`。"
---

# T0796 — BUG-196 實機驗收用空工單

## 元資料

- **工單編號**：T0796
- **類型**：verification（實機驗收輔助）
- **互動模式**：yolo
- **優先級**：P2
- **建立時間**：2026-11-03T00:14:24+0800
- **預估規模**：XS

## 目的

塔台派出本單後立刻停在 AskUserQuestion 對話框（`blockedReason: question`）。Worker 的 `--submit` 完成通知到達時，BAT 應保留它（塔台縮圖「📨 待送 1」、對話框維持、不替使用者作答），使用者答完、安靜 1 s 後才送進塔台輸入框。Worker 只要正常收尾即可。

## 驗收

- [ ] 回報區寫完、工單檔 commit
- [ ] `bat-notify --submit` 已送出，exit code 與 stdout 記錄

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **狀態**：DONE
- **開始時間**：2026-11-03T00:14:59+0800
- **回報時間**：2026-11-03T00:15:11+0800
- **session_id**：ab15bea6-b7c0-4fb7-8392-6a4c871c1b17

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 內的本工單 → not applicable
- C-2：工單無 `branch` 欄位；目前分支 `main`
- `CT_HOME` 未設定（非 worktree 隔離）
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 環境

- `CT_MODE`：yolo
- `BAT_TOWER_TERMINAL_ID`：存在（值不記錄）
- `BAT_REMOTE_PORT`：存在；`BAT_REMOTE_TOKEN`：已設定
- `BAT_HELPER_DIR`：存在

### 執行內容

- 本單無實作工作；未改其他檔案、未跑測試、未 build、未 push。
- 收尾順序：回報區 + DONE → `git commit --only` 本工單檔 → `bat-notify.mjs --submit` 通知塔台 → 通知結果補寫進下方〈通知結果〉→ 再 commit 一次。

### 通知結果

- 指令：`"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --source "T0796" --target "$BAT_TOWER_TERMINAL_ID" --submit "T0796 完成"`（只送一次，未重送）
- 送出時間：2026-11-03T00:15:25+0800（指令結束後取的系統時間）
- exit code：`0`
- stdout 原文：`✓ Notified 508fced6…: T0796 完成`（helper 自行截短的目標分頁 id 前綴，非權杖）

### 互動紀錄

- 無（`worker_question_timeout: 0`，未提問）

### 遭遇問題

- 無
