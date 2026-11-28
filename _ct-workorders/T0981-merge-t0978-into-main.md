---
schema_version: 1
schema_kind: workorder
id: T0981
title: "合併 `ct/T0978`（啟動參數回合不套 2 s Enter 保護窗）→ `main`"
type: chore
status: PENDING
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-28T18:15:16+08:00"
updated_at: "2026-11-28T18:15:16+08:00"
target_version: "下一個預覽版（`0.8.1-pre.6`）"
kind: merge
merges:
  - "ct/T0978"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: f679dfded9ae4346e77e30abefab6337cd4ef13d
merge_target: main
depends_on: [T0978]
related:
  - "D518；T0978（`f9738360`，base `80d96e25`，8 檔：`electron/notify-hold.ts`、`electron/pty-manager.ts`、`src/lib/launch-command.ts`、2 個測試檔、`docs/agent-guide/tower-inbox.md`、`notify-hold.md`、`CLAUDE.md`）；`main` 自 base 起併入 T0977（`scripts/verify-packaged-native.js`、其測試、`docs/agent-guide/packaging-release-checks.md`，不重疊），判準 1 不成立，所以派合併單。塔台 `git merge-tree --write-tree main ct/T0978` 無衝突"
affects_files:
  - _ct-workorders/T0981-merge-t0978-into-main.md
renew_count: 0
session_ids: []
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0978`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0981-merge-t0978-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0981 — 合併 `ct/T0978` → `main`

## 背景

T0978（啟動參數回合不套 2 s Enter 保護窗）改 8 檔，`f9738360`，base `80d96e25`。期間 `main` 併入 T0977（只改打包檢查腳本、其測試與 packaging 文件，不重疊），塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併無衝突。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0978` = `f97383606dc7140d844ad524f46ee14ad0c1af9f`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0978 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0978 launch-prompt turn skips the 2 s Enter guard" ct/T0978`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0978 的 8 檔；其他檔算範圍外，照實回報。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）；確認 `electron/__tests__/notify-hold-prompt-submit.test.ts`、`src/lib/__tests__/launch-command-prompt.test.ts`、`scripts/__tests__/verify-packaged-native.test.mjs` 有跑到並通過。
- [ ] e2e 不跑。

---

## 回報區

（Worker 填寫）
