---
schema_version: 1
schema_kind: workorder
id: T0973
title: "合併 `ct/T0970`（pre.4 交付版驗收的 e2e/manual 驅動）→ `main`"
type: chore
status: IN_PROGRESS
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-28T15:42:36+0800"
updated_at: "2026-11-28T15:44:35+0800"
started_at: "2026-11-28T15:44:35+0800"
target_version: "下一個預覽版（`0.8.1-pre.5`）"
kind: merge
merges:
  - "ct/T0970"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: 8a0ae680d3dcd05cb18e65d0c6216396767318ab
merge_target: main
depends_on: [T0970]
related:
  - "D503；T0970（`30e3c240`，base `e09b3da8`，只改 `e2e/manual/ct-accept-act.mjs`、`e2e/manual/README.md`）；`main` 自 base 起併入 T0971 產品改動（`electron/**`、`src/**`、docs、`CLAUDE.md`，不含 `e2e/manual/`），判準 1 不成立，所以派合併單。塔台 `git merge-tree --write-tree main ct/T0970` 無衝突"
affects_files:
  - _ct-workorders/T0973-merge-t0970-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0970`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0973-merge-t0970-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0973 — 合併 `ct/T0970` → `main`

## 背景

T0970（`v0.8.1-pre.4` 交付版驗收）只改 `e2e/manual/ct-accept-act.mjs`（新增 `input` 指令）與 `e2e/manual/README.md`，`30e3c240`，base `e09b3da8`。期間 `main` 併入 T0971 的產品改動（不重疊），塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併無衝突。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0970` = `30e3c240ce39d7c4362c4a26ceb59f1cfe91ea30`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0970 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0970 pre.4 acceptance drivers" ct/T0970`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0970 的 2 檔；其他檔算範圍外，照實回報。
- [ ] 整合 worktree `npm ci`；`node --check e2e/manual/ct-accept-act.mjs`；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）。
- [ ] e2e 不跑。

---

## 回報區

（Worker 填寫）
