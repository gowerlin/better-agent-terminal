---
schema_version: 1
schema_kind: workorder
id: T0967
title: "合併 `ct/T0965`（選單開著時待辦分頁也能作答，BUG-236）→ `main`"
type: chore
status: IN_PROGRESS
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-28T12:48:00+0800"
started_at: "2026-11-28T12:49:15+0800"
updated_at: "2026-11-28T12:49:15+0800"
target_version: "下一個預覽版（`0.8.1-pre.4`，發版前與使用者確認）"
kind: merge
merges:
  - "ct/T0965"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: ee76629f43b4f4f2dff6d6284214e09e02ce8b85
merge_target: main
depends_on: [T0965]
related:
  - "D486；T0965（`e5a0ad16`，base `b389f16c`）；`main` 自 base 起併入 T0966（`64b39176`：`docs/agent-guide/tower-inbox.md`、`src/components/inbox/InboxLists.tsx`、`useInboxModel.ts`、`src/lib/inbox-answer.ts`、`inbox-model.ts`、`src/stores/inbox-sent-store.ts`、三個 locales、兩個測試檔），判準 1 不成立，所以派合併單。塔台 `git merge-tree --write-tree main ct/T0965` 無衝突（只有 `docs/agent-guide/tower-inbox.md` 兩邊都改、不同段落）"
affects_files:
  - _ct-workorders/T0967-merge-t0965-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0965`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0967-merge-t0965-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0967 — 合併 `ct/T0965` → `main`

## 背景

T0965（BUG-236）改 9 檔（`electron/notify-hold.ts`、`electron/terminal-blocked-state.ts`、`electron/pty-manager.ts`、`electron/handlers/pty.ts`、新測試 `electron/__tests__/notify-hold-question-menu.test.ts`、三份 docs、`CLAUDE.md`），`e5a0ad16`，base `b389f16c`。期間 `main` 併入了 T0966（待辦分頁「Worker 等你」不再算回答），兩邊都改 `docs/agent-guide/tower-inbox.md`（不同段落），塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併無衝突。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0965` = `e5a0ad16ba3601b2fc27e15fac831198c0d311e4`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0965 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0965 inbox answer closes an open question menu (BUG-236)" ct/T0965`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0965 的 9 檔（以 `git diff --name-only b389f16c ct/T0965` 為準）；其他檔算範圍外，照實回報。
- [ ] `docs/agent-guide/tower-inbox.md` 確認 T0966 的〈Worker 等你不含你的回答（T0966，U-58：A）〉與 T0965 的〈選單開著時的回答（T0965 / BUG-236，U-59：A）〉兩節都在。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）；確認 `notify-hold-question-menu.test.ts` 與 T0966 的兩個測試檔都有跑到並通過。
- [ ] e2e 不跑。

---

## 回報區

（Worker 填寫）
