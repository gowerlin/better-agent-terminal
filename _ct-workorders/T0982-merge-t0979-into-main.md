---
schema_version: 1
schema_kind: workorder
id: T0982
title: "合併 `ct/T0979`（PLAN-066 後續研究的量測腳本與結果，只在 `experiments/`）→ `main`"
type: chore
status: IN_PROGRESS
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-28T19:04:38+08:00"
started_at: "2026-11-28T19:06:52+08:00"
updated_at: "2026-11-28T19:06:52+08:00"
target_version: "—（只有 experiments/）"
kind: merge
merges:
  - "ct/T0979"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: d2c9e9803294caa0bafabebcf7ded71da47a6360
merge_target: main
depends_on: [T0979]
related:
  - "D522（U-78：A）；T0979（`e882e120`，base `80d96e25`，7 檔全在 `experiments/node-pty-worker/`：`t0979/` 3 支腳本＋`run-env-churn.sh`、`results/t0979-*` 3 個結果檔）；`main` 自 base 起併入 T0977 / T0978 / T0980（不重疊），判準 1 不成立，所以派合併單。BAT `--worktree-status` `conflicts: []`"
affects_files:
  - _ct-workorders/T0982-merge-t0979-into-main.md
renew_count: 0
session_ids: []
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0979`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0982-merge-t0979-into-main.md`）。"
  - "🔴 不執行 `experiments/` 下的量測腳本（會起 Terminal Server / PTY）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）；結果檔只應有數字、pid 與程序名稱，合併前抽查一次沒有 env 內容與權杖樣式（`batcap.`、`sk-ant-`、`ghp_`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0982 — 合併 `ct/T0979` → `main`

## 背景

T0979（PLAN-066 三項後續研究）只新增 `experiments/node-pty-worker/` 下 7 檔（量測腳本與結果），`e882e120`，base `80d96e25`。F4 實作單 T0983 的驗收會重用這些腳本，使用者裁示併進 `main`（U-78：A，D522）。期間 `main` 併入 T0977 / T0978 / T0980（不重疊），塔台直接合併判準第 1 條不成立，依規則派本單。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0979` = `e882e1204e543f4e64b587315564cd4e379f0c5d`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0979 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0979 PLAN-066 follow-up measurement scripts" ct/T0979`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0979 的 7 檔（全在 `experiments/node-pty-worker/`）；其他檔算範圍外，照實回報。
- [ ] 結果檔抽查：沒有 env 內容與權杖樣式。
- [ ] 整合 worktree `npm ci`；`npm run test:unit` 第一次完整執行即綠（附數字；確認沒有收到 `experiments/` 的檔）。typecheck / vite build 可略（沒有產品檔），寫明略過。
- [ ] e2e 不跑。

---

## 回報區

（Worker 填寫）
