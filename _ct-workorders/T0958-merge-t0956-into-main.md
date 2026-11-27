---
schema_version: 1
schema_kind: workorder
id: T0958
title: "合併 `ct/T0956`（登入導引分頁與遠端工具安裝的命令前輸入保留，BUG-232）→ `main`"
type: chore
status: PENDING
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T22:50:25+08:00"
updated_at: "2026-11-27T22:50:25+08:00"
target_version: "下一個預覽版（`0.8.1-pre.2`，發版前與使用者確認）"
kind: merge
merges:
  - "ct/T0956"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: aef9678bda71facd04e6da6d55352b6cbc3fd8cb
merge_target: main
depends_on: [T0956]
related:
  - "D458；T0956（`137e7b6e`，base `39557f4a`）；`main` 自 base 起併入 T0957（`CLAUDE.md`、`docs/agent-guide/terminal-context-menu.md`、`src/components/TerminalPanel.tsx`、`src/lib/mouse-tracking-reset.ts`、`src/lib/pty-replay.ts`、兩個測試檔），判準 1 不成立，所以派合併單。塔台 `git merge-tree` 試合併無衝突（只有 `CLAUDE.md` 兩邊都改、不同節）"
affects_files:
  - _ct-workorders/T0958-merge-t0956-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0958`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0958-merge-t0956-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0958 — 合併 `ct/T0956` → `main`

## 背景

T0956（BUG-232）改 8 檔（`src/lib/claude-login-guide.ts`、`src/components/WorkspaceView.tsx`、`src/lib/remote-tools/install-runner.ts`、`src/hooks/useRemoteToolInstall.ts`、兩個新測試、docs、`CLAUDE.md`），`137e7b6e`，base `39557f4a`。期間 `main` 併入了 T0957（BUG-233），`CLAUDE.md` 兩邊都改，塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併無衝突。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0956` = `137e7b6e677c5ff2c995b499350ee87a9554930c`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0958 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0958 T0956 hold input before the login guide and remote tool install commands (BUG-232)" ct/T0956`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0956 的 8 檔（以 `git diff --name-only 39557f4a ct/T0956` 為準）；其他檔算範圍外，照實回報。
- [ ] `CLAUDE.md` 確認 T0957（「終端分頁右鍵選單與滑鼠追蹤」節 `showLeftoverHiddenCursor`）與 T0956（「BAT MCP shim」節）兩處都在。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）。
- [ ] e2e 不跑。

---

## 回報區

（Worker 填寫）
