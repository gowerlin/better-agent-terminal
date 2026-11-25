---
schema_version: 1
schema_kind: workorder
id: T0927
title: "合併 `ct/T0926`（BUG-224：極快 Esc 後晚到的 hook 不再把 `blocked: question` 設回）→ `main`"
type: chore
status: PENDING
repo: better-agent-terminal
project: BUG-224
priority: P1
sizing: S
created_at: "2026-11-25T23:15:40+08:00"
target_version: "0.8.0-pre.4"
kind: merge
merges:
  - "ct/T0926"
merge_mode: conflict
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: 5d891249f421615b0d38b6a19747a88fd2cafc6c
merge_target: main
depends_on: [T0926]
related:
  - "D358；T0926（`2781c81e`，base `4e562519`）；`main` 自 base 起多了 T0925 的 `e2e/manual/README.md`、`e2e/manual/ct-accept-act.mjs`（判準 1 不成立，所以派合併單）"
affects_files:
  - _ct-workorders/T0927-merge-t0926-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ②（`conflict`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0927`。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0927-merge-t0926-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。"
---

# T0927 — 合併 `ct/T0926` → `main`

## 背景

T0926（BUG-224）改 `electron/terminal-blocked-state.ts`、新增 `electron/__tests__/blocked-late-question-hook.test.ts`、改 `docs/agent-guide/blocked-state.md` 與 `CLAUDE.md`（`2781c81e`，base `4e562519`）。期間 `main` 併入了 T0925（`e2e/manual/` 2 檔），塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併：無衝突、兩邊檔案不重疊。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0926` = `2781c81ebdfa30796f0448f9a77dce3c7f79fcf6`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0927 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0927 T0926 BUG-224 late question hook" ct/T0926`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 `CLAUDE.md`、`docs/agent-guide/blocked-state.md`、`electron/__tests__/blocked-late-question-hook.test.ts`、`electron/terminal-blocked-state.ts`；其他檔算範圍外，照實回報。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）；`npm run test:legacy` 全綠。
- [ ] e2e 不跑（實機併入 `0.8.0-exp.2` 補跑）。

## 收尾

- 回報區填：merge commit、parent1 / parent2、衝突（無則寫無）、驗收 SHA、樹比對、範圍外檔案。
- 只 commit 本工單檔到主 checkout；通知塔台。塔台做收單 SHA 比對後 ff `main`（斷點 E）。

---

## 回報區

### 完成狀態

### 合併結果

### 驗證

### 範圍外檔案

### 互動紀錄

### 遭遇問題

### 回報時間
