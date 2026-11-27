---
schema_version: 1
schema_kind: workorder
id: T0948
title: "合併 `ct/T0947`（⏻ 重啟前關掉殘留的滑鼠追蹤，BUG-229）→ `main`"
type: chore
status: PENDING
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-27T21:04:06+08:00"
updated_at: "2026-11-27T21:04:06+08:00"
target_version: "下一個預覽版（`0.8.1-pre.N`，發版前與使用者確認）"
kind: merge
merges:
  - "ct/T0947"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: e1c1476e6ab2871374ae43deb0509f76f7b9b9ea
merge_target: main
depends_on: [T0947]
related:
  - "D433；T0947（`6e58f168`，base `48f4dc98`）；`main` 自 base 起併入 T0946（`773fe35c`：`CLAUDE.md`、`docs/agent-guide/claude-session-name.md`、`src/components/WorkspaceView.tsx`、`src/lib/tower-launch-prompt.ts` 與其測試、`src/utils/shell-quote.ts` 與新測試），判準 1 不成立，所以派合併單。塔台 `git merge-tree` 試合併無衝突（`CLAUDE.md`、`WorkspaceView.tsx` 兩邊都改但不同段落）"
affects_files:
  - _ct-workorders/T0948-merge-t0947-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0948`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0948-merge-t0947-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0948 — 合併 `ct/T0947` → `main`

## 背景

T0947 改 `src/lib/mouse-tracking-reset.ts`、`src/lib/pty-replay.ts`、`src/components/TerminalPanel.tsx`、`src/components/WorkspaceView.tsx`、`CLAUDE.md`、`docs/agent-guide/terminal-context-menu.md`，新增 `src/lib/__tests__/mouse-tracking-restart.test.ts`，並在 `src/__tests__/terminal-context-menu.test.tsx` 檔尾加測試（`6e58f168`，base `48f4dc98`）。期間 `main` 併入了 T0946（BUG-228，`773fe35c`），其中 `CLAUDE.md`、`src/components/WorkspaceView.tsx` 兩邊都改，塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併無衝突。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0947` = `6e58f168e7063d08798c0b36633452a3a434f44c`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0948 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0948 T0947 reset leftover mouse tracking before a new PTY (BUG-229)" ct/T0947`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0947 的 8 檔（`CLAUDE.md`、`docs/agent-guide/terminal-context-menu.md`、`src/__tests__/terminal-context-menu.test.tsx`、`src/components/TerminalPanel.tsx`、`src/components/WorkspaceView.tsx`、`src/lib/__tests__/mouse-tracking-restart.test.ts`、`src/lib/mouse-tracking-reset.ts`、`src/lib/pty-replay.ts`）；其他檔算範圍外，照實回報。
- [ ] `CLAUDE.md`、`WorkspaceView.tsx` 確認 T0946 與 T0947 的改動都在（T0946：`towerLaunchCommandPrefix` / `[T0946]` log；T0947：`resetLeftoverMouseTracking` 在兩處 `pty.kill` 前）。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）。
- [ ] e2e 不跑。

---

## 回報區

（Worker 填寫）
