---
schema_version: 1
schema_kind: workorder
id: T0958
title: "合併 `ct/T0956`（登入導引分頁與遠端工具安裝的命令前輸入保留，BUG-232）→ `main`"
type: chore
status: DONE
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T22:50:25+08:00"
updated_at: "2026-11-27T22:54:02+08:00"
started_at: "2026-11-27T22:51:22+08:00"
completed_at: "2026-11-27T22:54:02+08:00"
session_ids:
  - "1bd38a0d-6301-464f-9ddf-0cb080df2604"
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

### 完成狀態

- **狀態**：DONE（模式 ① `mechanical`，無衝突）
- **開工**：2026-11-27T22:51:22+08:00；**完成**：2026-11-27T22:54:02+08:00
- **session_id**：1bd38a0d-6301-464f-9ddf-0cb080df2604

### 落點檢查

- 結果：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在主 checkout `_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/**` → not applicable
- C-2：工單無 `branch` 欄位；主 checkout 在 `main`
- `CT_HOME` 未設定（非隔離派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`

### 開工前檢查（任務指令 1）

- 整合 worktree `<主 checkout 上層>/.ct-integration/better-agent-terminal`：`status --porcelain` 為空，原本 detached 在 `0f818244`
- `ct/T0956` = `137e7b6e677c5ff2c995b499350ee87a9554930c` ✅
- `main` = `e32dc771`；`git diff --name-only aef9678b main` 只有 `_ct-workorders/T0958-merge-t0956-into-main.md`、`_ct-workorders/_decision-log.md`、`_ct-workorders/_tower-state.md` ✅（只在 `_ct-workorders/**` 前進）
- `ct-merge/T0958` 事先不存在 ✅

### 合併結果

- 分支：`ct-merge/T0958`（從 `base_main_sha` `aef9678bda71facd04e6da6d55352b6cbc3fd8cb` 開出）
- merge commit：`011899a13f76be201394c55ff50f650a1edad8db`
  - parent1：`aef9678bda71facd04e6da6d55352b6cbc3fd8cb`（= `base_main_sha`）
  - parent2：`137e7b6e677c5ff2c995b499350ee87a9554930c`（= `ct/T0956`）
- `git merge --no-ff`（ort）：`Auto-merging CLAUDE.md`，無衝突，8 檔 433+ / 15-
- 驗收全部跑在 `011899a1`（= merge commit）

### 驗收

| 項目 | 結果 |
|---|---|
| 樹比對 `git diff --name-only aef9678b 011899a1` vs `git diff --name-only 39557f4a ct/T0956` | 完全相同（`diff` 無輸出），8 檔：`CLAUDE.md`、`docs/agent-guide/launch-command-input-hold.md`、`electron/__tests__/launch-hold-login-install.test.ts`、`src/components/WorkspaceView.tsx`、`src/hooks/useRemoteToolInstall.ts`、`src/lib/__tests__/launch-hold-login-install-wiring.test.tsx`、`src/lib/claude-login-guide.ts`、`src/lib/remote-tools/install-runner.ts`。範圍外檔案：無 |
| `CLAUDE.md` 兩處 | T0957：「終端分頁右鍵選單與滑鼠追蹤」節（第 135 行）含 `showLeftoverHiddenCursor` ✅；T0956：「BAT MCP shim」節（第 381 行起）派工 shell 那一點含「T0956 / BUG-232 起含登入導引分頁（不送 Enter）與遠端工具安裝」✅ |
| `npm ci` | exit 0（749 packages；`electron-winstaller` install script 被擋屬預期） |
| `npm run typecheck` | exit 0（0 錯誤） |
| `npm run typecheck:electron` | exit 0（0 錯誤） |
| `npx vite build` | exit 0 |
| `npm run test:unit`（第一次完整執行） | exit 0：Test Files 522 passed / 3 skipped（525）；Tests 9432 passed / 41 skipped（9473）；67.97 s |
| e2e | 不跑（依工單） |

- 驗收後整合 worktree `status --porcelain` 為空，停在 `ct-merge/T0958`（留給塔台 `--ff-only`）

### 未做的事（依工單護欄）

- 未 ff `main`、未 push、未建 tag、未觸發 workflow、未刪分支；未用 stash / reset / rebase / restore
- 主 checkout 只寫本工單檔

### 互動紀錄

- 無（yolo，沒有向塔台提問）

### 遭遇問題

- 無

### 後續建議

- 塔台做收單 SHA 比對五步：parent1 = `base_main_sha`；ff 前 `main` 已前進到 `e32dc771`（只有 `_ct-workorders/**`），依第 5 步需在整合分支再 `merge --no-ff main` 一次後 ff（產品樹相同，不重跑驗收）
