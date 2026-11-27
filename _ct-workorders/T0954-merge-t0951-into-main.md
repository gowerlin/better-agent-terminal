---
schema_version: 1
schema_kind: workorder
id: T0954
title: "合併 `ct/T0951`（renderer 啟動命令前打的字移到命令之後，BUG-231）→ `main`"
type: chore
status: PENDING
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T21:33:31+08:00"
updated_at: "2026-11-27T21:33:31+08:00"
target_version: "下一個預覽版（`0.8.1-pre.N`，發版前與使用者確認）"
kind: merge
merges:
  - "ct/T0951"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: a86b23259218da7ec95d43b06633bdf2d346d7d3
merge_target: main
depends_on: [T0951]
related:
  - "D446；T0951（`f975ef45`，base `18d0a229`）；`main` 自 base 起併入 T0949（經 T0952：`electron/pty-manager.ts`、`electron/main.ts`、`electron/terminal-role.ts`、`CLAUDE.md` 等）與 T0950（經 T0953：`src/lib/pty-replay.ts`、`src/lib/mouse-tracking-reset.ts`、`TerminalPanel.tsx`、`CLAUDE.md` 等），判準 1 不成立，所以派合併單。塔台 `git merge-tree` 試合併無衝突（`pty-manager.ts`、`pty-replay.ts`、`CLAUDE.md` 兩邊都改）"
affects_files:
  - _ct-workorders/T0954-merge-t0951-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0954`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0954-merge-t0951-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0954 — 合併 `ct/T0951` → `main`

## 背景

T0951（BUG-231）改 17 檔（`electron/pty-manager.ts`、`electron/handlers/pty.ts`、`electron/preload.ts`、`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`、`src/lib/launch-command.ts`、`src/lib/pty-replay.ts`、`src/components/WorkspaceView.tsx`、型別、測試、docs、`CLAUDE.md`），`f975ef45`，base `18d0a229`。期間 `main` 併入了 T0949（經 T0952）與 T0950（經 T0953），`pty-manager.ts`、`pty-replay.ts`、`CLAUDE.md` 兩邊都改，塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併無衝突。這是本批最後一張合併。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0951` = `f975ef45e6b46a572381b67e2549c9f3cf87aa81`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0954 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0954 T0951 hold input typed before a renderer launch command (BUG-231)" ct/T0951`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0951 的 17 檔（以 `git diff --name-only 18d0a229 ct/T0951` 為準）；其他檔算範圍外，照實回報。
- [ ] 兩邊都改的檔確認雙方改動都在：`electron/pty-manager.ts`（T0949 `noteTowerDeclaration` / `restoreTowerDeclaration`；T0951 `holdInputForLaunch` / `writeLaunchCommand`）、`src/lib/pty-replay.ts`（T0947 `resetLeftoverMouseTracking`、T0950 `leaveLeftoverAltScreen`、T0951 `holdInputUntilLaunch`）、`CLAUDE.md`（T0946 / T0947 / T0949 / T0950 / T0951 五處）。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）。
- [ ] e2e 不跑。

---

## 回報區

（Worker 填寫）
