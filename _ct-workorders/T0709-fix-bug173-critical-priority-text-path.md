---
schema_version: 1
schema_kind: workorder
id: T0709
title: "BUG-173：索引文字與 PLAN 檔補優先級時，critical 一律算 High（與 frontmatter 路徑一致）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: ""
priority: P3
sizing: XS
created_at: "2026-10-29T09:46:36+0800"
depends_on: []
related:
  - "BUG-173（現象、行號）"
  - "BMad-Guide 塔台 ADVISORY 2026-10-29（CT D408：CT 索引改寫成「🔴 High（critical）」，但 PLAN 檔 frontmatter `priority: critical` 經補優先級路徑仍是 Unknown）"
  - "frontmatter 路徑的既有行為：`priorityFromFmEnum`（`src/types/backlog.ts:23`）、`severityFromFmEnum`（`src/types/bug-tracker.ts:62`）"
affects_files:
  - src/types/backlog.ts
  - src/types/bug-tracker.ts
  - "src/types 的 parser 測試（既有測試檔補項或新檔）"
  - _ct-workorders/T0709-fix-bug173-critical-priority-text-path.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍：`extractPriority`（`src/types/backlog.ts`）與 `extractSeverity`（`src/types/bug-tracker.ts`）認 `critical`（不分大小寫）→ `High`。不新增 Critical 等級，`PlanPriority` / `BugSeverity` 型別不變；frontmatter 路徑不改。`extractPriorityFromPlanContent` 因呼叫 `extractPriority` 自然受益，確認即可。若 `src/types` 還有其他文字路徑的優先級／嚴重度解析（例如工單 priority）有同樣缺口，列在回報區，不在本單修。"
  - "🔴 不改：`src/components/ControlTowerPanel.tsx`、locales（T0708 同時在改）、`electron/**`、CLAUDE.md。"
  - "🔴 驗證：測試涵蓋索引格子 `critical`、`🔴 Critical`、`CRITICAL`、`🔴 High（critical）` 都得 High；PLAN 檔 frontmatter `priority: critical`、條列 `- **優先級**：critical`、表格 `| **優先級** | critical |` 經 `extractPriorityFromPlanContent` 得 High；既有 high / medium / low 結果不變。`npm run test:unit` 全綠、`npm run typecheck` = 0、`npx vite build` 成功。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 workflow、不建 tag。T0708 同時在 repo 內工作：只 commit 本單 `affects_files`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。工單完成狀態寫 `DONE`（不要寫 FIXED，那是 BUG 單狀態）；BUG-173 單與 `_bug-tracker.md` 由塔台更新，不要改。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。yolo：不得問使用者，判讀問題問塔台（每輪最多 3 題）。"
---

# T0709 — BUG-173：critical 在文字路徑算 High

## 背景

指揮塔面板從 frontmatter 讀優先級／嚴重度時 `critical` 算 High，從索引文字讀、或從 PLAN 檔補優先級時卻是 Unknown。詳見 BUG-173。

## 實作

1. `extractPriority` / `extractSeverity` 加 `CRITICAL` → High。
2. parser 測試補項。

## 驗收

- [ ] 文字路徑 `critical`（各種寫法）→ High
- [ ] PLAN 檔補優先級（frontmatter／條列／表格）`critical` → High
- [ ] 既有等級結果不變
- [ ] `npm run test:unit` 全綠；`npm run typecheck` = 0；`npx vite build` 成功

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策（僅 yolo Worker 有問題時）

### 互動紀錄

### 完成狀態

### 實作摘要

### 驗證證據

### 遭遇問題

### Commit

### 回報時間
