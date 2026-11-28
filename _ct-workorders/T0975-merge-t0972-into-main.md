---
schema_version: 1
schema_kind: workorder
id: T0975
title: "合併 `ct/T0972`（BUG-235 重修：宣告契約前送出的草稿也清除）→ `main`"
type: chore
status: PENDING
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-28T16:00:47+0800"
updated_at: "2026-11-28T16:00:47+0800"
target_version: "下一個預覽版（`0.8.1-pre.5`）"
kind: merge
merges:
  - "ct/T0972"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: e54da6ff1f6fa458aa1bc7507029cc711fafe3f1
merge_target: main
depends_on: [T0972]
related:
  - "D506；T0972（head `c1abe148`，`validated_sha` `abcff41d`，head 只多一筆純文件 commit；base `07afa77b`）；`main` 自 base 起併入 T0970 的 `e2e/manual/` 驅動（`8de1e2d1`），判準 1、2 不成立，所以派合併單。塔台 `git merge-tree --write-tree main ct/T0972` 無衝突"
affects_files:
  - _ct-workorders/T0975-merge-t0972-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0972`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0975-merge-t0972-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0975 — 合併 `ct/T0972` → `main`

## 背景

T0972（BUG-235 重修）改 5 檔（`electron/notify-hold.ts`、`electron/__tests__/notify-hold-prompt-submit.test.ts`、`docs/agent-guide/tower-inbox.md`、`docs/agent-guide/notify-hold.md`、`CLAUDE.md`），head `c1abe148`（`validated_sha` `abcff41d`，之後只多一筆 `tower-inbox.md` 文件 commit），base `07afa77b`。期間 `main` 併入 T0970 的 `e2e/manual/` 驅動（不重疊），塔台直接合併判準第 1、2 條不成立，依規則派本單；本單在合併結果上重跑完整驗收，涵蓋 head。塔台 `git merge-tree` 試合併無衝突。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0972` = `c1abe1489b86ddabdd7edc42686611d1b9392bfd`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0972 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0972 clear the draft on the launch-argument turn before the contract declare (BUG-235)" ct/T0972`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0972 的 5 檔；其他檔算範圍外，照實回報。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）；確認 `notify-hold-prompt-submit.test.ts` 的 `T0972 / BUG-235` 段落都有跑到並通過。
- [ ] e2e 不跑。

---

## 回報區

（Worker 填寫）
