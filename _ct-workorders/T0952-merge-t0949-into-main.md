---
schema_version: 1
schema_kind: workorder
id: T0952
title: "合併 `ct/T0949`（同一 PTY 接回時還原塔台宣告，BUG-230）→ `main`"
type: chore
status: DONE
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-27T21:20:30+08:00"
updated_at: "2026-11-27T21:24:29+08:00"
started_at: "2026-11-27T21:21:32+08:00"
completed_at: "2026-11-27T21:24:29+08:00"
session_ids:
  - "bda7db99-415d-4a11-885a-09c536e4431f"
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

### 完成狀態

- **狀態**：DONE（模式 ① 機械合併，無衝突，驗收全綠，無範圍外檔案）
- **merge commit**：`23d124dcf8ee8ae0e8861bc6db3aa62d78d4ddec`（分支 `ct-merge/T0952`）
  - parent1：`5e2e58b61551d8ffa0d267a69511d2c44a9407ad`（= `base_main_sha`）
  - parent2：`073dbaa15096377d3f61b2b0ea42644b77de00de`（= `ct/T0949`）
- **validated_sha**：`23d124dcf8ee8ae0e8861bc6db3aa62d78d4ddec`（= merge commit）
- **session_id**：bda7db99-415d-4a11-885a-09c536e4431f

### 落點檢查

- 結果：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`CT_HOME` 未設，非 worktree 派工）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有本工單（`_ct-workorders/**` 排除）→ 不適用
- C-2：工單無 `branch` 欄位 → 不適用
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只作證據）

### 開工前置條件（任務指令 1）

- 整合 worktree `status --porcelain` 為空，HEAD detached（在 `dc37842c`）
- `ct/T0949` = `073dbaa15096377d3f61b2b0ea42644b77de00de` ✓
- `main` = `1ed55176`；`git diff --name-only <base_main_sha> main` 只有 `_ct-workorders/T0952-merge-t0949-into-main.md`、`_decision-log.md`、`_tower-state.md` ✓
- `ct-merge/T0952` 原本不存在 ✓

### 合併過程

1. `git -c core.longpaths=true switch -c ct-merge/T0952 5e2e58b6…` → 成功
2. `git -c core.longpaths=true merge --no-ff -m "merge(ct): T0952 T0949 restore tower declaration on same-PTY reattach (BUG-230)" ct/T0949` → `ort` 策略，`Auto-merging CLAUDE.md`，**無衝突**，exit 0；6 檔 918+ / 25−

### 驗收結果（全部跑在 `23d124dc`）

| 項目 | 結果 |
|---|---|
| 樹比對 `git diff --name-only <base_main_sha> 23d124dc` | 恰好 6 檔：`CLAUDE.md`、`docs/agent-guide/tower-tab-title.md`、`electron/__tests__/tower-role-restore.test.ts`、`electron/main.ts`、`electron/pty-manager.ts`、`electron/terminal-role.ts`。**範圍外檔案：無** |
| `CLAUDE.md` 三處改動 | T0946 `msysArgConvExclusionPrefix`（「Claude 分頁的 session 名稱」節）✓；T0947 `resetLeftoverMouseTracking`（「終端分頁右鍵選單與滑鼠追蹤」節）✓；T0949 還原描述（「塔台分頁標題」節，`tower-roles.json`、同一個 PTY 程序接回才還原）✓ |
| `npm ci` | exit 0（結尾 `electron-winstaller` install script 被 allowScripts 擋的警告屬預期，見 CLAUDE.md「npm 12 install scripts」） |
| `npm run typecheck` | exit 0，`error TS` 0 筆 |
| `npm run typecheck:electron` | exit 0，`error TS` 0 筆 |
| `npx vite build` | exit 0 |
| `npm run test:unit`（第一次完整執行） | exit 0；Test Files 516 passed / 3 skipped（519）；Tests 9350 passed / 41 skipped（9391）；79.80 s |
| e2e | 依工單不跑 |

- 驗收後整合 worktree `status --porcelain` 仍為空。

### 異動檔案

- 主 checkout：只有本工單檔（`git commit --only`）
- 整合 worktree：分支 `ct-merge/T0952` 上的 merge commit `23d124dc`；未 ff `main`、未 push、未刪分支、未建 tag

### Commit 紀錄

- `81ca89fd` chore: T0952 IN_PROGRESS (ct)（主 checkout，只含本工單）
- `23d124dc` merge(ct): T0952 …（整合 worktree，`ct-merge/T0952`）
- 收尾 commit：本工單 DONE（主 checkout，只含本工單）

### 給塔台

- 依 merge-workorder.md 模式 ② 的 yolo 規則對照：驗收全綠且無範圍外檔案，可在主 checkout `git -c core.longpaths=true merge --ff-only ct-merge/T0952`。主 checkout 目前有 `_ct-workorders/T0950-restart-leave-alt-screen.md` 的未提交變更（開工前就存在，非本單），與合併檔不重疊，不會擋 ff。

### 遭遇問題

- 無

### 互動紀錄

- 無（yolo，未提問）
