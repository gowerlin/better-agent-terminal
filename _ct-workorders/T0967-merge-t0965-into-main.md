---
schema_version: 1
schema_kind: workorder
id: T0967
title: "合併 `ct/T0965`（選單開著時待辦分頁也能作答，BUG-236）→ `main`"
type: chore
status: DONE
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-28T12:48:00+0800"
started_at: "2026-11-28T12:49:15+0800"
updated_at: "2026-11-28T12:51:33+0800"
completed_at: "2026-11-28T12:51:33+0800"
session_ids:
  - "0369d886-b1dd-4a3b-b0e0-e3a6f6b9b184"
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

### 完成狀態

- **狀態**：`DONE`（模式 ① `mechanical`，無衝突；驗收全綠；沒有範圍外檔案）
- **完成時間**：2026-11-28T12:51:33+0800
- **session_id**：0369d886-b1dd-4a3b-b0e0-e3a6f6b9b184

### 落點檢查

- 結果：`PASS`
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/**` → 不適用
- C-2：工單沒有 `branch` 欄位；主 checkout 在 `main`
- `CT_HOME` 未設（非 worktree 派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 開工檢查

- 整合 worktree `git status --porcelain` 為空（detached 於 `64b39176`）
- `ct/T0965` = `e5a0ad16ba3601b2fc27e15fac831198c0d311e4`（相符）
- `main`（開工時 `d499b059`）相對 `base_main_sha` `ee76629f` 只多 `_ct-workorders/**`（BUG-236、T0965、T0967、`_decision-log.md`、`_tower-state.md`）
- `ct-merge/T0965` 分支原本不存在

### 合併結果

- 分支：`ct-merge/T0965`（自 `ee76629f43b4f4f2dff6d6284214e09e02ce8b85` 開出）
- merge commit：`84f8c9007f5b60ff2958380b6ec1dc6370316ef4`
- parent1：`ee76629f43b4f4f2dff6d6284214e09e02ce8b85`（= `base_main_sha`）
- parent2：`e5a0ad16ba3601b2fc27e15fac831198c0d311e4`（= `ct/T0965`）
- `git merge --no-ff` 以 ort 自動合併，只有 `docs/agent-guide/tower-inbox.md` 走 auto-merge，無衝突
- 驗收時 SHA：`84f8c9007f5b60ff2958380b6ec1dc6370316ef4`（= merge commit）

### 驗收

- [x] 樹比對：`git diff --name-only ee76629f 84f8c900` = 9 檔，與 `git diff --name-only b389f16c ct/T0965` 完全相同（`CLAUDE.md`、`docs/agent-guide/blocked-state.md`、`docs/agent-guide/notify-hold.md`、`docs/agent-guide/tower-inbox.md`、`electron/__tests__/notify-hold-question-menu.test.ts`、`electron/handlers/pty.ts`、`electron/notify-hold.ts`、`electron/pty-manager.ts`、`electron/terminal-blocked-state.ts`）。範圍外檔案：無。
- [x] `docs/agent-guide/tower-inbox.md`：第 117 行 `#### Worker 等你不含你的回答（T0966，U-58：A）`、第 531 行 `### 選單開著時的回答（T0965 / BUG-236，U-59：A）`，兩節都在。
- [x] 整合 worktree `npm ci` exit 0（結尾只有 `electron-winstaller` install script 被擋的預期警告）
- [x] `npm run typecheck` exit 0（0 錯誤）
- [x] `npm run typecheck:electron` exit 0（0 錯誤）
- [x] `npx vite build` exit 0
- [x] unit tests（`vitest run` = `npm run test:unit` 的內容，另加 json reporter）第一次完整執行即綠：Test Files 526 passed / 3 skipped（529）；Tests 9500 passed / 41 skipped（9541）；68.31 s。
  - `electron/__tests__/notify-hold-question-menu.test.ts`：28 tests 通過
  - `src/components/__tests__/inbox-worker-wait-t0966.test.tsx`：10 tests 通過
  - `src/lib/__tests__/inbox-model-t0966.test.ts`：5 tests 通過
- [x] e2e 未跑（依工單）
- 驗收後整合 worktree `git status --porcelain` 為空

### 給塔台的資訊

- 派單後 `main` 又前進到 `4765daa3`（`0327a3c0` 本單開工、`4765daa3` 塔台 D487），`git diff --name-only ee76629f main` 仍只有 `_ct-workorders/**`。`--ff-only` 前依 § 收單 SHA 比對五步第 5 步：在整合分支再 `git merge --no-ff main` 一次後 ff（產品樹相同，不需重跑驗收）。
- 本單未 ff `main`、未 push、未刪分支、未動主 checkout 的產品檔。

### 遭遇問題

- 無

### 互動紀錄

- 無（yolo，未提問）

### Commit

- 產品變更：merge commit `84f8c900` 在整合 worktree 的 `ct-merge/T0965`（本單無其他產品 commit）
- 工單：`0327a3c0`（開工）、本次收尾 commit 只含本工單檔

## 塔台收單補記

- 2026-11-28 12:52 (UTC+8) 收單：SHA 比對 ①–③ 成立（`base_main_sha` `ee76629f`；parent1 `ee76629f`、parent2 `e5a0ad16` = `ct/T0965` = T0965 `validated_sha`）；`main` 之後只多 `_ct-workorders/**`。`--close-worker --delay-ms 10000` exit 0。斷點 E → U-61；發版 → U-62（D488）。
- 2026-11-28 12:53 (UTC+8) U-61：A → 第 5 步整合分支再合併 `main` 後 ff：`main` = `ct-merge/T0965` = `8a1c1318`，產品樹 = `84f8c900`；整合 worktree detach；T0965 worktree 移除（乾淨）；分支 `ct/T0965`、`ct-merge/T0965` 保留（D489）。
