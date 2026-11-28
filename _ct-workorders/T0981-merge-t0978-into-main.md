---
schema_version: 1
schema_kind: workorder
id: T0981
title: "合併 `ct/T0978`（啟動參數回合不套 2 s Enter 保護窗）→ `main`"
type: chore
status: DONE
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-28T18:15:16+08:00"
updated_at: "2026-11-28T18:18:47+08:00"
started_at: "2026-11-28T18:16:25+08:00"
completed_at: "2026-11-28T18:18:47+08:00"
target_version: "下一個預覽版（`0.8.1-pre.6`）"
kind: merge
merges:
  - "ct/T0978"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: f679dfded9ae4346e77e30abefab6337cd4ef13d
merge_target: main
depends_on: [T0978]
related:
  - "D518；T0978（`f9738360`，base `80d96e25`，8 檔：`electron/notify-hold.ts`、`electron/pty-manager.ts`、`src/lib/launch-command.ts`、2 個測試檔、`docs/agent-guide/tower-inbox.md`、`notify-hold.md`、`CLAUDE.md`）；`main` 自 base 起併入 T0977（`scripts/verify-packaged-native.js`、其測試、`docs/agent-guide/packaging-release-checks.md`，不重疊），判準 1 不成立，所以派合併單。塔台 `git merge-tree --write-tree main ct/T0978` 無衝突"
affects_files:
  - _ct-workorders/T0981-merge-t0978-into-main.md
renew_count: 0
session_ids:
  - "f3632b9f-181a-407a-9535-36e4d60542e4"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0978`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0981-merge-t0978-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0981 — 合併 `ct/T0978` → `main`

## 背景

T0978（啟動參數回合不套 2 s Enter 保護窗）改 8 檔，`f9738360`，base `80d96e25`。期間 `main` 併入 T0977（只改打包檢查腳本、其測試與 packaging 文件，不重疊），塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併無衝突。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0978` = `f97383606dc7140d844ad524f46ee14ad0c1af9f`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0978 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0978 launch-prompt turn skips the 2 s Enter guard" ct/T0978`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0978 的 8 檔；其他檔算範圍外，照實回報。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）；確認 `electron/__tests__/notify-hold-prompt-submit.test.ts`、`src/lib/__tests__/launch-command-prompt.test.ts`、`scripts/__tests__/verify-packaged-native.test.mjs` 有跑到並通過。
- [ ] e2e 不跑。

---

## 回報區

### 完成狀態

- **狀態**：DONE（模式 ① 機械合併，無衝突，驗收全綠，無範圍外檔案）
- **session_id**：f3632b9f-181a-407a-9535-36e4d60542e4
- **完成時間**：2026-11-28T18:18:47+08:00

### 落點檢查

- 結果：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在主 checkout `_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有本工單（`_ct-workorders/**` 排除）→ 不適用
- C-2：工單無 `branch` 欄位；主 checkout 在 `main`
- `CT_HOME` 未設定（非 worktree 派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 開工檢查（步驟 1）

- 整合 worktree `status --porcelain` 為空，detached HEAD（原在 `1ae19702`）
- `ct/T0978` = `f97383606dc7140d844ad524f46ee14ad0c1af9f` ✅
- `main` = `dad3c5b3`；`git diff --name-only <base_main_sha> main` 只有 `_ct-workorders/**`（本工單、`_decision-log.md`、`_insights/session-stats/2026-11.json`、`_tower-state.md`）✅
- `ct-merge/T0978` 開工前不存在 ✅

### 合併結果

- 合併分支：`ct-merge/T0978`（整合 worktree）
- merge commit：`d1c3c32e4c957252898d7b2ced335651bb74fcd4`
- parent1：`f679dfded9ae4346e77e30abefab6337cd4ef13d`（= `base_main_sha`）
- parent2：`f97383606dc7140d844ad524f46ee14ad0c1af9f`（= `ct/T0978`）
- 衝突：無（ort，8 files changed, 346 insertions(+), 10 deletions(-)）
- 驗收時的 SHA：`d1c3c32e4c957252898d7b2ced335651bb74fcd4`（= merge commit）；驗收後整合 worktree `status --porcelain` 仍為空

### 驗收

- [x] 樹比對：`git diff --name-only f679dfde d1c3c32e` 正好是 T0978 的 8 檔：`CLAUDE.md`、`docs/agent-guide/notify-hold.md`、`docs/agent-guide/tower-inbox.md`、`electron/__tests__/notify-hold-prompt-submit.test.ts`、`electron/notify-hold.ts`、`electron/pty-manager.ts`、`src/lib/__tests__/launch-command-prompt.test.ts`、`src/lib/launch-command.ts`。**範圍外檔案：無**
- [x] `npm ci` exit 0（結尾 `electron-winstaller` install script 被擋，CLAUDE.md 註明屬預期）
- [x] `npm run typecheck` exit 0，`error TS` 0 個
- [x] `npm run typecheck:electron` exit 0，`error TS` 0 個
- [x] `npx vite build` exit 0
- [x] `npm run test:unit` 第一次完整執行即綠：Test Files 534 passed | 3 skipped (537)；Tests 9662 passed | 41 skipped (9703)；Duration 70.44 s；exit 0
- [x] 三個指定測試檔：`vitest list --filesOnly` 確認三檔都在完整執行的收集範圍內（完整執行 0 失敗）；另單獨以 verbose 跑三檔：Test Files 3 passed、Tests 155 passed
- [x] e2e 未跑（依工單）

### 遵守的護欄

- 只在整合 worktree 合併；未 ff `main`、未 push、未建 tag、未觸發 workflow、未刪分支；未用 `--force` / `reset --hard` / rebase / stash / `checkout --` / `restore`
- 主 checkout 只寫本工單檔
- git 指令皆帶 `-c core.longpaths=true`（`rev-parse` 等唯讀查詢除外）

### 給塔台

- 可依 § 收單 SHA 比對五步核對後 `git -C <主 checkout> merge --ff-only ct-merge/T0978`（主 checkout 目前在 `main`，`main` 自 base 起只多 `_ct-workorders/**`，與合併檔不重疊）

### 互動紀錄

- 無（yolo，未向塔台提問）

### 遭遇問題

- 開工時一度把 `started_at` 寫成未經取時的值，隨即改為系統時間 `2026-11-28T18:16:25+08:00`（尚未 commit 前已修正）
