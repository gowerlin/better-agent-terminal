---
schema_version: 1
schema_kind: workorder
id: T0973
title: "合併 `ct/T0970`（pre.4 交付版驗收的 e2e/manual 驅動）→ `main`"
type: chore
status: DONE
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-28T15:42:36+0800"
updated_at: "2026-11-28T15:46:49+0800"
completed_at: "2026-11-28T15:46:49+0800"
started_at: "2026-11-28T15:44:35+0800"
target_version: "下一個預覽版（`0.8.1-pre.5`）"
kind: merge
merges:
  - "ct/T0970"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: 8a0ae680d3dcd05cb18e65d0c6216396767318ab
merge_target: main
depends_on: [T0970]
related:
  - "D503；T0970（`30e3c240`，base `e09b3da8`，只改 `e2e/manual/ct-accept-act.mjs`、`e2e/manual/README.md`）；`main` 自 base 起併入 T0971 產品改動（`electron/**`、`src/**`、docs、`CLAUDE.md`，不含 `e2e/manual/`），判準 1 不成立，所以派合併單。塔台 `git merge-tree --write-tree main ct/T0970` 無衝突"
affects_files:
  - _ct-workorders/T0973-merge-t0970-into-main.md
renew_count: 0
session_ids:
  - "ef248063-acd7-46a6-82e0-e8012168f025"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0970`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0973-merge-t0970-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0973 — 合併 `ct/T0970` → `main`

## 背景

T0970（`v0.8.1-pre.4` 交付版驗收）只改 `e2e/manual/ct-accept-act.mjs`（新增 `input` 指令）與 `e2e/manual/README.md`，`30e3c240`，base `e09b3da8`。期間 `main` 併入 T0971 的產品改動（不重疊），塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併無衝突。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0970` = `30e3c240ce39d7c4362c4a26ceb59f1cfe91ea30`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0970 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0970 pre.4 acceptance drivers" ct/T0970`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0970 的 2 檔；其他檔算範圍外，照實回報。
- [ ] 整合 worktree `npm ci`；`node --check e2e/manual/ct-accept-act.mjs`；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）。
- [ ] e2e 不跑。

---

## 回報區

### 完成狀態

- **狀態**：DONE（模式 ① `mechanical`，無衝突）
- **完成時間**：2026-11-28T15:46:49+0800
- **session_id**：ef248063-acd7-46a6-82e0-e8012168f025

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 下的本工單 → not applicable
- C-2：工單沒有 `branch` 欄位；主 checkout 在 `main`
- `CT_HOME` 未設（非 worktree 派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 開工確認（步驟 1）

- 整合 worktree `status --porcelain` 為空，detached 在 `6a7b90e8`
- `ct/T0970` = `30e3c240ce39d7c4362c4a26ceb59f1cfe91ea30` ✅
- `main` = `76b15d38`（`base_main_sha` 之後只多 `_ct-workorders/**` 7 檔：BUG-235、T0970、T0972、T0973、`_bug-tracker.md`、`_decision-log.md`、`_tower-state.md`）✅
- `ct-merge/T0970` 原本不存在 ✅

### 合併結果

- 合併分支：`ct-merge/T0970`（從 `8a0ae680d3dcd05cb18e65d0c6216396767318ab` 開）
- merge commit：`b933cdd14c7c67be47c4f5968cc7a2f32b62bead`
  - parent1：`8a0ae680d3dcd05cb18e65d0c6216396767318ab`（`base_main_sha`）
  - parent2：`30e3c240ce39d7c4362c4a26ceb59f1cfe91ea30`（`ct/T0970`）
- 衝突：無（ort，`e2e/manual/README.md` +10、`e2e/manual/ct-accept-act.mjs` +13）
- 跑驗收時的 SHA：`b933cdd1…`（= merge commit）
- 整合 worktree 收單時 `status --porcelain` 為空（`npm ci` / build 產物皆被 `.gitignore` 涵蓋）

### 驗收

| 項目 | 結果 |
|---|---|
| 樹比對 `git diff --name-only <base_main_sha> b933cdd1` | 只有 `e2e/manual/README.md`、`e2e/manual/ct-accept-act.mjs` → **範圍外檔案：無** |
| `npm ci` | exit 0（結尾照例列出 `electron-winstaller` install script 被擋，屬預期） |
| `node --check e2e/manual/ct-accept-act.mjs` | exit 0 |
| `npm run typecheck` | exit 0（= 0） |
| `npm run typecheck:electron` | exit 0（= 0） |
| `npx vite build` | exit 0 |
| `npm run test:unit`（第一次完整執行） | exit 0：Test Files 532 passed / 3 skipped（535）；Tests 9619 passed / 41 skipped（9660）；69.11 s。輸出中有 3 行 `Error: AttachConsole failed`（stderr 雜訊，不影響結果） |
| e2e | 未跑（依工單） |

### 未做的事（依工單護欄）

- 未 ff `main`、未 push、未建 tag、未觸發 workflow、未刪任何分支；未 detach 整合 worktree（合併後清理屬塔台）
- 主 checkout 只寫入本工單檔

### 互動紀錄

- [15:44] 開工，yolo、`CT_INTERACTIVE=0`；無塔台提問

### 遭遇問題

- 無（`check-frontmatter.py` 第一次以未轉換的 `/c/…` 路徑呼叫失敗，改 `cygpath -m` 後 PASS；與工單無關）

### 後續建議

- 塔台照 `merge-workorder.md` § 收單 SHA 比對五步確認後，`git -C <主 checkout> merge --ff-only ct-merge/T0970`；`main` 目前在 `base_main_sha` 之後多了 `_ct-workorders/**` commit，ff 前需先把它們併進合併分支（或依塔台既有做法處理）

## 塔台收單補記

- 2026-11-28 15:47 (UTC+8) 收單：SHA 比對 ①–③ 成立（`base_main_sha` `8a0ae680`；merge `b933cdd1` parent1 `8a0ae680`、parent2 `30e3c240` = `ct/T0970` = T0970 `validated_sha`）；`main` 之後只多 `_ct-workorders/**`。`--close-worker --delay-ms 10000` exit 0。斷點 E → U-68（D504）。
- 2026-11-28 15:55 (UTC+8) U-68：A → 整合分支再合併 `main` 後 ff：`main` = `8de1e2d1`，產品樹 = `b933cdd1`；整合 worktree detach；T0970 worktree 移除；分支 `ct/T0970`、`ct-merge/T0970` 保留（D505）。
