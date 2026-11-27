---
schema_version: 1
schema_kind: workorder
id: T0948
title: "合併 `ct/T0947`（⏻ 重啟前關掉殘留的滑鼠追蹤，BUG-229）→ `main`"
type: chore
status: DONE
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-27T21:04:06+08:00"
updated_at: "2026-11-27T21:08:30+08:00"
completed_at: "2026-11-27T21:08:30+08:00"
session_ids:
  - "860343e5-af99-4163-950c-146459bf2d12"
started_at: "2026-11-27T21:05:43+08:00"
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

### 完成狀態

- **結果**：DONE — 模式 ①（`mechanical`）合併無衝突，驗收全綠。
- **merge commit**：`9f5cc1eed2417ad47c0cee4fa7d0e3e2bc6a76aa`（分支 `ct-merge/T0948`，整合 worktree）
  - parent1 = `e1c1476e6ab2871374ae43deb0509f76f7b9b9ea`（= `base_main_sha`）
  - parent2 = `6e58f168e7063d08798c0b36633452a3a434f44c`（= `ct/T0947`）
- **驗收 SHA**：`9f5cc1ee…`（= merge commit；驗收後沒有新 commit）
- **範圍外檔案**：無
- **session_id**：860343e5-af99-4163-950c-146459bf2d12

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在主 checkout `_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有本工單（`_ct-workorders/**`）→ 不適用
- C-2：工單沒有 `branch` 欄位 → 不適用
- `CT_HOME` 未設定（非隔離派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 開工檢查（任務指令 1）

- 整合 worktree `status --porcelain` 為空，detached 在 `773fe35c`。
- `ct/T0947` = `6e58f168e7063d08798c0b36633452a3a434f44c` → 相符。
- `main` 開工時 = `b4d6ad15`；`git diff --name-only <base_main_sha> main` 全部在 `_ct-workorders/**`（`BUG-230-…`、`T0948-…`、`_bug-tracker.md`、`_decision-log.md`、`_tower-state.md`）→ 符合。
- `ct-merge/T0948` 開工前不存在。
- 回報時 `main` = `f8b7770b`（塔台又加了 `451bbba9`、`f8b7770b`，T0949 / BUG-230 記帳）；自 base 起仍只有 `_ct-workorders/**` 前進（多了 `T0949-restore-tower-role-on-reattach.md`），供塔台做收單第 5 步。

### 執行

1. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0948 e1c1476e…` → 成功。
2. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0948 T0947 reset leftover mouse tracking before a new PTY (BUG-229)" ct/T0947` → `ort` 自動合併 `CLAUDE.md`、`src/components/WorkspaceView.tsx`，無衝突，exit 0。

### 驗收

- [x] 樹比對：`git diff --name-only <base_main_sha> 9f5cc1ee` 正好 8 檔：`CLAUDE.md`、`docs/agent-guide/terminal-context-menu.md`、`src/__tests__/terminal-context-menu.test.tsx`、`src/components/TerminalPanel.tsx`、`src/components/WorkspaceView.tsx`、`src/lib/__tests__/mouse-tracking-restart.test.ts`、`src/lib/mouse-tracking-reset.ts`、`src/lib/pty-replay.ts`（merge 統計 8 files, +433 / −6）。其他檔：無。
- [x] 兩邊改動都在：
  - `WorkspaceView.tsx`：T0946 `import { towerLaunchCommandPrefix, towerLaunchPrompt }`（L27）、`towerLaunchCommandPrefix(towerPrompt, shell)`（L784）、`[T0946]` log（L788）；T0947 `import { resetLeftoverMouseTracking }`（L21），`resetLeftoverMouseTracking(…, 'before-new-pty')` 在兩處 `pty.kill` 前（L857→L858、L1071→L1072）。
  - `CLAUDE.md`：T0946 的 `MSYS2_ARG_CONV_EXCL` / `T0946 / BUG-228` / `msysArgConvExclusionPrefix` 句子在「Claude 分頁的 session 名稱」節；T0947 的 `T0947 / BUG-229 … resetLeftoverMouseTracking` 句子在「終端分頁右鍵選單與滑鼠追蹤」節。
- [x] 整合 worktree（HEAD = `9f5cc1ee`）：
  - `npm ci` exit 0（結尾 `electron-winstaller` install script 被擋的警告，屬 CLAUDE.md 所述預期）
  - `npm run typecheck` exit 0，`error TS` = 0
  - `npm run typecheck:electron` exit 0，`error TS` = 0
  - `npx vite build` exit 0
  - `npm run test:unit` 第一次完整執行 exit 0：Test Files 515 passed | 3 skipped (518)；Tests 9334 passed | 41 skipped (9375)；Duration 73.01s
- [x] e2e 不跑。
- 驗收後整合 worktree `status --porcelain` 為空。

### 未做（依工單）

- 沒有 ff `main`、沒有 push、沒有建 tag / 觸發 workflow、沒有刪分支；整合 worktree 停在 `ct-merge/T0948`（ff 與 detach 由塔台做）。

### 遭遇問題

- 無。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### Commit

- 主 checkout 只寫本工單檔：開工 `541cef4b`（IN_PROGRESS）、收尾 commit 見本工單的下一個 commit（`chore: T0948 DONE (ct)`）。
- 整合 worktree：merge commit `9f5cc1ee`（分支 `ct-merge/T0948`）。
