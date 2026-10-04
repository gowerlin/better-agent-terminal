---
schema_version: 1
schema_kind: workorder
id: T0441
title: "BUG-109：/snippet 情境 prompt 不再寫死 macOS snippets.json 路徑；改用實際儲存位置 / IPC，遠端視窗停用或改注入清單"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-109
priority: P3
sizing: S
created_at: "2026-10-05T05:51:45+08:00"
started_at: null
updated_at: "2026-10-05T05:51:45+08:00"
completed_at: null
target_version: next
depends_on:
  - T0436
related:
  - "BUG-109；T0421「遭遇問題」1；T0422（snippet:* 改 ALWAYS_LOCAL）"
  - "D134 追加（T0421 其他項目，使用者 05:51 裁決開 BUG）"
affects_files:
  - src/components/ClaudeAgentPanel.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先確認現況**：snippet 實際儲存（better-sqlite3 DB？是否仍有 `snippets.json`？路徑如何取得——`settings:get-logging-info` 類的 userData 路徑來源）。以證據決定修法：(a) prompt 改帶正確的本機路徑（僅本機視窗）、(b) prompt 注入 snippet 清單並請 agent 回傳變更、由 BAT 經 `snippet:*` IPC 套用，或 (c) 遠端視窗停用該流程並提示。偏好不讓 agent 直接改 DB / 檔案。回報區說明選擇理由。"
  - "🔴 依賴 T0436（同改 `ClaudeAgentPanel.tsx`）。開工前 `git log --oneline -5` 確認；i18n 檔 commit 前 `git diff <file>` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0441 — /snippet prompt 路徑（BUG-109）

## 範圍

1. 現況確認（memory_overrides 第 1 條）
2. 修 prompt / 流程；遠端視窗的行為明確
3. 測試鎖住：prompt 不含 `~/Library` 字樣；遠端視窗行為

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] BUG-109 改 `FIXED`

## Sub-session 執行指示
1. 讀本工單 + BUG-109 + T0422 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 現況 → 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + BUG-109；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
