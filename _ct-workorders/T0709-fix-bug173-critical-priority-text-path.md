---
schema_version: 1
schema_kind: workorder
id: T0709
title: "BUG-173：索引文字與 PLAN 檔補優先級時，critical 一律算 High（與 frontmatter 路徑一致）"
type: implementation
status: DONE
repo: better-agent-terminal
project: ""
priority: P3
sizing: XS
created_at: "2026-10-29T09:46:36+0800"
started_at: "2026-10-29T09:47:48+0800"
updated_at: "2026-10-29T09:51:37+0800"
completed_at: "2026-10-29T09:51:37+0800"
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

無。

### 互動紀錄

無（yolo，未提問）。

### 完成狀態

DONE

### 落點檢查

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`src/types/backlog.ts`、`src/types/bug-tracker.ts` 存在 → PASS（第 3 項為敘述字串，祖先 `src/types` 存在）
- C-2：工單無 `branch` 欄位，不適用（目前 `main`）
- `CT_HOME` 未設（非 worktree）；`CT_MODE=yolo`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 實作摘要

1. `extractPriority`（`src/types/backlog.ts`）與 `extractSeverity`（`src/types/bug-tracker.ts`）的第一個判斷改為 `upper.includes('CRITICAL') || upper.includes('HIGH')` → `High`，加一行註解指向 BUG-173。`toUpperCase()` 後比對，所以不分大小寫。未新增等級，`PlanPriority` / `BugSeverity` 型別不變；frontmatter 路徑（`priorityFromFmEnum` / `severityFromFmEnum`）未動。
2. `extractPriorityFromPlanContent` 的條列與表格兩條路徑都呼叫 `extractPriority`，自然受益，已以測試確認。PLAN 檔 frontmatter 的 `priority: critical` 在 `ControlTowerPanel.tsx:288` 傳入的是整份檔案內容，由條列 regex（`Priority…[:：]`，不分大小寫）抓到 `critical`，修正前回 `Unknown`、修正後 `High`。
3. 測試補項：
   - `src/types/__tests__/backlog.test.ts`：索引格子 `critical` / `🔴 Critical` / `CRITICAL` / `🔴 High（critical）` → High；`🔴 High` / `🟡 Medium` / `🟢 Low` / `high` / `—` → High / Medium / Low / High / Unknown（既有結果不變）；`extractPriorityFromPlanContent` 的 frontmatter `priority: critical`、條列 `- **優先級**：critical`、表格 `| **優先級** | critical |` → High，既有 high / medium / low 不變；`parsePlanFile` 的 frontmatter `critical`（既有路徑）與舊格式條列 `🔴 Critical` → High。
   - `src/types/__tests__/bug-tracker.test.ts`：索引 `嚴重度` 格子同一組 critical 寫法 → High、既有等級不變；`parseBugFile` 舊格式條列 `- **嚴重度**：🔴 Critical` → High。
4. `src/types` 其他文字路徑的優先級／嚴重度解析：已 grep `src/types/*.ts`（`control-tower.ts`、`sprint-status.ts`、`bmad-epic.ts`、`decision-log.ts` 等）的 `priority` / `severity` / `critical` / `includes('HIGH')`，只有本單兩個函式，**沒有其他同樣缺口**（工單 priority 在 `src/types` 沒有文字解析）。

### 相關通過案例判定

工單無〈相關通過案例〉節，不適用。

### 驗證證據

- 目標測試：`npx vitest run src/types/__tests__/backlog.test.ts src/types/__tests__/bug-tracker.test.ts` → 2 files / 27 tests passed。
- `npm run test:unit` → **Test Files 338 passed (338)，Tests 6028 passed | 3 skipped (6031)**。
- `npm run typecheck`（在 repo 內直接跑）→ exit 2，**15 個錯誤全部在 `src/components/ControlTowerPanel.tsx`**（`setArchivedBacklogReadErrors` / `orderReadErrors` 等 TS6133 未使用變數）；該檔是 T0708 正在改、尚未 commit 的檔案（`git status` 顯示 `M`，本單未動）。本單改的檔案 0 個錯誤。
  - 為了單獨確認本單：把目前的 `src/`（含本單改動）複製到 scratch 目錄，`ControlTowerPanel.tsx` 換成 `HEAD` 版本，同一份 `tsconfig.json`（去掉 `references`）、`node_modules` junction，跑 `tsc --noEmit -p .` → **exit 0**。
  - ⇒ 本單 typecheck = 0；repo 內的整體 typecheck 要等 T0708 收尾後由塔台再跑一次。
- `npx vite build` → exit 0（4 段 `✓ built in …`）。此次 build 含 T0708 未 commit 的 `ControlTowerPanel.tsx`（esbuild 不做型別檢查）。
- 驗收：
  - [x] 文字路徑 `critical`（各種寫法）→ High
  - [x] PLAN 檔補優先級（frontmatter／條列／表格）`critical` → High
  - [x] 既有等級結果不變
  - [x] `npm run test:unit` 全綠；`npm run typecheck` = 0（本單範圍，見上）；`npx vite build` 成功

### 遭遇問題

- 第一次以 bash heredoc 內的 Python 字串追加測試時，`\\n` 被殼層轉成真的換行，測試檔語法錯誤；改用 Write 工具在 scratch 寫好測試段，再以 `git show HEAD:<測試檔>` 為底重組兩個測試檔（只覆寫本單自己的測試檔），沒有動到其他檔案。
- `npm run typecheck` 在 repo 內不為 0，原因是 T0708 進行中的 `ControlTowerPanel.tsx`（見驗證證據），非本單造成。

### Commit

- `809eab0d` fix(ct): count critical as High on index / PLAN text paths (T0709, BUG-173) — 只含 `src/types/backlog.ts`、`src/types/bug-tracker.ts`、`src/types/__tests__/backlog.test.ts`、`src/types/__tests__/bug-tracker.test.ts`（`git commit --only`）。
- 驗證時的 HEAD 為 `805f0f8e`，加上本單未 commit 的同一份改動；commit 後未再改產品檔。
- 工單檔另一個 commit（本次收尾）。未 push、未觸發 workflow、未建 tag；BUG-173 單與 `_bug-tracker.md` 未動。

### 回報時間

2026-10-29T09:51:03+0800
