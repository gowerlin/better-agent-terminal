---
schema_version: 1
schema_kind: workorder
id: T0962
title: "合併 `ct/T0961`（Linux spec：⏻ 後游標，BUG-233）→ `main`"
type: chore
status: PENDING
repo: better-agent-terminal
priority: P3
sizing: XS
created_at: "2026-11-28T00:08:39+08:00"
updated_at: "2026-11-28T00:08:39+08:00"
target_version: "下一個預覽版（`0.8.1-pre.3`）"
kind: merge
merges:
  - "ct/T0961"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: c411a6682e83fa11e88eb373a178c9bf3674c1f9
merge_target: main
depends_on: [T0961]
related:
  - "D468；T0961（`e05999d3`，base `acb4f4cf`）；`main` 自 base 起併入 T0960（`src/lib/__tests__/launch-command.test.ts` 1 行），判準 1 不成立，所以派合併單。兩邊檔案不重疊，塔台 `git merge-tree` 試合併無衝突"
affects_files:
  - _ct-workorders/T0962-merge-t0961-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0962`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0962-merge-t0961-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0962 — 合併 `ct/T0961` → `main`

## 背景

T0961 只新增 `e2e/linux/t0961-restart-hidden-cursor.spec.ts`（`e05999d3`，base `acb4f4cf`），已在 `linux-acceptance` 對 pre.1（B1 FAIL，預期）與 pre.2（全 PASS）驗過。期間 `main` 併入了 T0960（`src/lib/__tests__/launch-command.test.ts` 1 行），塔台直接合併判準第 1 條不成立，依規則派本單。兩邊檔案不重疊，`merge-tree` 無衝突。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0961` = `e05999d317511d92451b79fafaa8b48c5e57d604`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0962 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0962 T0961 Linux spec for BUG-233" ct/T0961`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 `e2e/linux/t0961-restart-hidden-cursor.spec.ts`；其他檔算範圍外，照實回報。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，確認 Linux spec 不被 vitest 收到）；以 tsc 檢查新 spec（同 T0961 的旗標）。
- [ ] e2e 不跑。

---

## 回報區

（Worker 填寫）
