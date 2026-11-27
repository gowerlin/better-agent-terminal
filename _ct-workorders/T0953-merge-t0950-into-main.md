---
schema_version: 1
schema_kind: workorder
id: T0953
title: "合併 `ct/T0950`（⏻ 重啟後離開殘留的 alt screen）→ `main`"
type: chore
status: PENDING
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T21:26:52+08:00"
updated_at: "2026-11-27T21:26:52+08:00"
target_version: "下一個預覽版（`0.8.1-pre.N`，發版前與使用者確認）"
kind: merge
merges:
  - "ct/T0950"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: 2059de7e89279c637330c72e2d4fe95046c84b4c
merge_target: main
depends_on: [T0950]
related:
  - "D442；T0950（`cbc3175c`，base `18d0a229`）；`main` 自 base 起併入 T0949（經 T0952：`CLAUDE.md`、`docs/agent-guide/tower-tab-title.md`、`electron/main.ts`、`electron/pty-manager.ts`、`electron/terminal-role.ts`、新測試），判準 1 不成立，所以派合併單。塔台 `git merge-tree` 試合併無衝突（`CLAUDE.md` 兩邊都改但不同節）"
affects_files:
  - _ct-workorders/T0953-merge-t0950-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0953`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0953-merge-t0950-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0953 — 合併 `ct/T0950` → `main`

## 背景

T0950 改 `src/lib/mouse-tracking-reset.ts`、`src/lib/pty-replay.ts`、`src/components/TerminalPanel.tsx`、`CLAUDE.md`、`docs/agent-guide/terminal-context-menu.md`，新增 `src/lib/__tests__/alt-screen-restart.test.ts`，並在 `src/__tests__/terminal-context-menu.test.tsx` 檔尾加測試（`cbc3175c`，base `18d0a229`）。期間 `main` 併入了 T0949（經 T0952），`CLAUDE.md` 兩邊都改，塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併無衝突。T0951 仍在跑，與本單無關。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0950` = `cbc3175c4e3e9500ecaf83e4ac0eb44819f6d847`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0953 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0953 T0950 leave leftover alt screen when a new PTY starts" ct/T0950`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0950 的 7 檔（`CLAUDE.md`、`docs/agent-guide/terminal-context-menu.md`、`src/__tests__/terminal-context-menu.test.tsx`、`src/components/TerminalPanel.tsx`、`src/lib/__tests__/alt-screen-restart.test.ts`、`src/lib/mouse-tracking-reset.ts`、`src/lib/pty-replay.ts`）；其他檔算範圍外，照實回報。
- [ ] `CLAUDE.md` 確認 T0946、T0947、T0949、T0950 四處改動都在。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）。
- [ ] e2e 不跑。

---

## 回報區

（Worker 填寫）
