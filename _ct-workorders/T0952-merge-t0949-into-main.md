---
schema_version: 1
schema_kind: workorder
id: T0952
title: "合併 `ct/T0949`（同一 PTY 接回時還原塔台宣告，BUG-230）→ `main`"
type: chore
status: PENDING
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-27T21:20:30+08:00"
updated_at: "2026-11-27T21:20:30+08:00"
target_version: "下一個預覽版（`0.8.1-pre.N`，發版前與使用者確認）"
kind: merge
merges:
  - "ct/T0949"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: 5e2e58b61551d8ffa0d267a69511d2c44a9407ad
merge_target: main
depends_on: [T0949]
related:
  - "D439；T0949（`073dbaa1`，base `451bbba9`）；`main` 自 base 起併入 T0947（經 T0948，`dc37842c`：`CLAUDE.md`、`src/components/TerminalPanel.tsx`、`WorkspaceView.tsx`、`src/lib/mouse-tracking-reset.ts`、`pty-replay.ts` 等 8 檔），判準 1 不成立，所以派合併單。塔台 `git merge-tree` 試合併無衝突（`CLAUDE.md` 兩邊都改但不同節）"
affects_files:
  - _ct-workorders/T0952-merge-t0949-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0952`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0952-merge-t0949-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0952 — 合併 `ct/T0949` → `main`

## 背景

T0949 改 `electron/terminal-role.ts`、`electron/pty-manager.ts`、`electron/main.ts`、`CLAUDE.md`、`docs/agent-guide/tower-tab-title.md`，新增 `electron/__tests__/tower-role-restore.test.ts`（`073dbaa1`，base `451bbba9`）。期間 `main` 併入了 T0947（經 T0948），其中 `CLAUDE.md` 兩邊都改，塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併無衝突。同時還有 T0950 / T0951 在跑，與本單無關。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0949` = `073dbaa15096377d3f61b2b0ea42644b77de00de`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0952 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0952 T0949 restore tower declaration on same-PTY reattach (BUG-230)" ct/T0949`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0949 的 6 檔（`CLAUDE.md`、`docs/agent-guide/tower-tab-title.md`、`electron/__tests__/tower-role-restore.test.ts`、`electron/main.ts`、`electron/pty-manager.ts`、`electron/terminal-role.ts`）；其他檔算範圍外，照實回報。
- [ ] `CLAUDE.md` 確認 T0946、T0947、T0949 三處改動都在（「Claude 分頁的 session 名稱」節 `msysArgConvExclusionPrefix`、「終端分頁右鍵選單與滑鼠追蹤」節 `resetLeftoverMouseTracking`、「塔台分頁標題」節 T0949 的還原描述）。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）。
- [ ] e2e 不跑。

---

## 回報區

（Worker 填寫）
