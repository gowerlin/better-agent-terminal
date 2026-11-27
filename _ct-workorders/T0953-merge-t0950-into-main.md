---
schema_version: 1
schema_kind: workorder
id: T0953
title: "合併 `ct/T0950`（⏻ 重啟後離開殘留的 alt screen）→ `main`"
type: chore
status: DONE
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T21:26:52+08:00"
started_at: "2026-11-27T21:28:04+08:00"
updated_at: "2026-11-27T21:31:17+08:00"
completed_at: "2026-11-27T21:31:17+08:00"
session_ids:
  - "5de76132-b1ae-4e63-a744-9caa73ee8dcd"
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

### 完成狀態

- **狀態**：DONE（模式 ① `mechanical`，無衝突；未 ff `main`，等塔台斷點 E）
- **完成時間**：2026-11-27T21:31:17+08:00
- **session_id**：5de76132-b1ae-4e63-a744-9caa73ee8dcd

### 落點檢查

- 結果：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`CT_HOME` 未設定，非 worktree 派工）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有本工單（`_ct-workorders/**` 排除）→ not applicable
- C-2：工單沒有 `branch` 欄位 → 略過
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 開工檢查（步驟 1）

- 整合 worktree `status --porcelain` 為空，detached 於 `2059de7e89279c637330c72e2d4fe95046c84b4c`（= `base_main_sha`）
- `ct/T0950` = `cbc3175c4e3e9500ecaf83e4ac0eb44819f6d847`（相符）
- `main` 開工時 = `7aad0218`，收尾時 = `5568866d`；自 `base_main_sha` 起只多了 `_ct-workorders/**`（`git diff --name-only 2059de7e main` 排除 `_ct-workorders/` 後為空）
- `ct-merge/T0953` 開工前不存在

### 合併結果

- 合併分支：`ct-merge/T0953`（整合 worktree）
- **merge commit**：`d04306686b32c14efdee4a2c35578f1f64906b4b`
- parent1：`2059de7e89279c637330c72e2d4fe95046c84b4c`（`base_main_sha`）
- parent2：`cbc3175c4e3e9500ecaf83e4ac0eb44819f6d847`（`ct/T0950`）
- 衝突：無（`CLAUDE.md` 由 ort 自動合併）
- commit 訊息：`merge(ct): T0953 T0950 leave leftover alt screen when a new PTY starts`
- 塔台 ff 指令（供參考，本單未執行）：`git -C <主 checkout> -c core.longpaths=true merge --ff-only ct-merge/T0953`；`main` 目前比 base 多的只有 `_ct-workorders/**` commit，ff 前需先把 `main` 併進合併分支或以塔台既有做法處理（同 T0952 的 `merge(ct): main into ct-merge/T0952`）

### 驗收（跑在 merge commit `d0430668`，`validated_sha` = merge commit）

- [x] 樹比對：`git diff --name-only 2059de7e d0430668` = 7 檔，正好是 T0950 的 7 檔（`CLAUDE.md`、`docs/agent-guide/terminal-context-menu.md`、`src/__tests__/terminal-context-menu.test.tsx`、`src/components/TerminalPanel.tsx`、`src/lib/__tests__/alt-screen-restart.test.ts`、`src/lib/mouse-tracking-reset.ts`、`src/lib/pty-replay.ts`）。範圍外檔案：無
- [x] `CLAUDE.md` 四處改動都在：T0946 / BUG-228（第 466 行，`msysArgConvExclusionPrefix`）、T0947 / BUG-229（第 135 行，`resetLeftoverMouseTracking`）、T0949 / BUG-230（第 109 行，`TowerRolePersistence`）、T0950（第 135 行，`leaveLeftoverAltScreen`）
- [x] `npm ci`：exit 0（749 packages；結尾 `electron-winstaller` install script 被擋為預期，見 CLAUDE.md「npm 12 install scripts」）
- [x] `npm run typecheck`：exit 0（0 錯誤）
- [x] `npm run typecheck:electron`：exit 0（0 錯誤）
- [x] `npx vite build`：exit 0
- [x] `npm run test:unit`（第一次完整執行，未重跑）：exit 0，Test Files 517 passed / 3 skipped（520）；Tests 9368 passed / 41 skipped（9409）；Duration 70.94 s
- [x] e2e 不跑
- 驗收後整合 worktree `status --porcelain` 為空

### 護欄遵守

- 只在整合 worktree 合併；未 ff `main`、未 push、未建 tag、未觸發 workflow、未刪分支；未用 `--force` / `reset --hard` / rebase / stash / `checkout --` / `restore`
- 所有 git 寫入指令帶 `-c core.longpaths=true`
- 主 checkout 只寫本工單檔

### 遭遇問題

無。

### 互動紀錄

- [21:28] 開工；yolo、無提問。
