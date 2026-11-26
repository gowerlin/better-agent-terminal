---
schema_version: 1
schema_kind: workorder
id: T0933
title: "合併 `ct/T0930`（待辦分頁參考檔案可點，在「檔案」頁籤開啟）→ `main`"
type: chore
status: TODO
repo: better-agent-terminal
project: PLAN-069
priority: P2
sizing: S
created_at: "2026-11-26T20:27:38+08:00"
updated_at: "2026-11-26T20:27:38+08:00"
session_ids: []
target_version: "0.8.0-pre.5"
kind: merge
merges:
  - "ct/T0930"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: a267cb3c63c6c18f0e5fd1c46d4bc42969adddbe
merge_target: main
depends_on: [T0930]
related:
  - "D374；T0930（`a9254f55`，base `78f4ecf6`）；`main` 自 base 起併入 T0931（`src/lib/tower-card-view.ts`、其測試、`docs/agent-guide/tower-inbox.md` 一條），判準 1 不成立，所以派合併單。`--worktree-status` conflicts []、塔台 `git merge-tree` 試合併 exit 0（`tower-inbox.md` 兩邊都改但不同段落）"
affects_files:
  - _ct-workorders/T0933-merge-t0930-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0933`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0933-merge-t0930-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0933 — 合併 `ct/T0930` → `main`

## 背景

T0930 新增 `src/lib/inbox-file-refs.ts`、`src/components/inbox/InboxRefText.tsx`、`useInboxFileRefs.ts` 與兩個測試檔，改 `InboxLists.tsx`、`InboxPanel.tsx`、`inbox.css`、`docs/agent-guide/tower-inbox.md`、`CLAUDE.md`（`a9254f55`，base `78f4ecf6`）。期間 `main` 併入了 T0931（`a267cb3c`），塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併無衝突。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0930` = `a9254f556b617adb04462b650b72c97055e670b2`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0933 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0933 T0930 inbox file refs" ct/T0930`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0930 的 10 檔（`CLAUDE.md`、`docs/agent-guide/tower-inbox.md`、`src/components/InboxPanel.tsx`、`src/components/__tests__/inbox-file-refs-t0930.test.tsx`、`src/components/inbox/InboxLists.tsx`、`src/components/inbox/InboxRefText.tsx`、`src/components/inbox/useInboxFileRefs.ts`、`src/lib/__tests__/inbox-file-refs.test.ts`、`src/lib/inbox-file-refs.ts`、`src/styles/inbox.css`）；其他檔算範圍外，照實回報。`tower-inbox.md` 確認 T0929、T0930、T0931 三處都在。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）。
- [ ] e2e 不跑。

## 收尾

- 回報區填：merge commit、parent1 / parent2、衝突（無則寫無）、驗收 SHA、樹比對、範圍外檔案。
- 只 commit 本工單檔到主 checkout；通知塔台。塔台做收單 SHA 比對後 ff `main`（斷點 E）。

---

## 回報區

（Worker 填寫）
