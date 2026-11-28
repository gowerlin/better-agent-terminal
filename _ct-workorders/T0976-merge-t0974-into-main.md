---
schema_version: 1
schema_kind: workorder
id: T0976
title: "合併 `ct/T0974`（CT 6.4.0-pre.2 範例與重複鍵 fixture＋解析測試）→ `main`"
type: chore
status: DONE
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-28T16:11:43+0800"
started_at: "2026-11-28T16:12:55+0800"
updated_at: "2026-11-28T16:15:56+0800"
completed_at: "2026-11-28T16:15:56+0800"
target_version: "下一個預覽版（`0.8.1-pre.5`）"
kind: merge
merges:
  - "ct/T0974"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: 804b04c0f68def6aeeb0c225fc1334c40a442d2c
merge_target: main
depends_on: [T0974]
related:
  - "D509；T0974（`5410c597`，base `c56a595d`，只新增測試與 fixture 9 檔）；`main` 自 base 起併入 T0972（`electron/notify-hold.ts`、其測試、docs、`CLAUDE.md`，不重疊），判準 1 不成立，所以派合併單。塔台 `git merge-tree --write-tree main ct/T0974` 無衝突"
affects_files:
  - _ct-workorders/T0976-merge-t0974-into-main.md
renew_count: 0
session_ids:
  - "e22750e8-b197-4cd2-b995-213e383e1847"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0974`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0976-merge-t0974-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0976 — 合併 `ct/T0974` → `main`

## 背景

T0974（CT 6.4.0-pre.2 補跑＋fixture）只新增 9 檔：`src/lib/__tests__/tower-state-ct642-fixtures-t0974.test.ts`、`src/types/__tests__/fixtures/ct-tower-state-v642/`（README、`tower-state-v642.md`）、`src/types/__tests__/fixtures/ct-tower-state-dup-key/`（README＋5 份樣本），`5410c597`，base `c56a595d`。期間 `main` 併入 T0972（不重疊），塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併無衝突。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0974` = `5410c5979cd1696310a098e75f217cf8b7bed7f8`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0974 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0974 CT 6.4.0-pre.2 fixtures and parser tests" ct/T0974`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0974 的 9 檔；其他檔算範圍外，照實回報。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）；確認 `tower-state-ct642-fixtures-t0974.test.ts` 有跑到並通過。
- [ ] e2e 不跑。

---

## 回報區

### 完成狀態

- **狀態**：DONE（模式 ① `mechanical`，無衝突）
- **完成時間**：2026-11-28T16:15:56+0800
- **session_id**：e22750e8-b197-4cd2-b995-213e383e1847

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在主 checkout `_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有本工單（`_ct-workorders/` 排除）→ 不適用
- C-2：工單無 `branch` 欄位；主 checkout 在 `main`
- `CT_HOME` 未設（非隔離派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE` = `yolo`

### 合併結果

| 項目 | 值 |
|---|---|
| 整合 worktree | `integration_worktree`（`.ct-integration/better-agent-terminal`），開工時乾淨、detached 於 `7d2e571d` |
| 合併分支 | `ct-merge/T0974`（新建，自 `base_main_sha`） |
| `base_main_sha` | `804b04c0f68def6aeeb0c225fc1334c40a442d2c` |
| `ct/T0974` | `5410c5979cd1696310a098e75f217cf8b7bed7f8`（= 工單指定值） |
| merge commit | `7cadec9dc9fb067dfea5ddab855a4d1b5c86353c` |
| parent1 | `804b04c0f68def6aeeb0c225fc1334c40a442d2c`（= `base_main_sha`） |
| parent2 | `5410c5979cd1696310a098e75f217cf8b7bed7f8`（= `ct/T0974`） |
| 衝突 | 無（`ort` 策略直接完成） |
| 驗收時 HEAD | `7cadec9dc9fb067dfea5ddab855a4d1b5c86353c`（= merge commit） |
| 驗收後整合 worktree | `status --porcelain` 為空 |

- 開工時 `main` = `d26e13fc`，回報時 `main` = `84b28ea0`；`git diff --name-only 804b04c0 main` 只有 `_ct-workorders/**`（`T0974-…`、`T0976-…`、`_decision-log.md`、`_tower-state.md`），符合步驟 1 條件。ff 前請塔台依〈收單 SHA 比對五步〉第 5 步處理（parent1 ≠ 目前 `main`，但差異只在 `_ct-workorders/**`）。

### 驗收

- [x] 樹比對：`git diff --name-only 804b04c0 7cadec9d` = 9 檔，與 `git diff --name-only c56a595d ct/T0974` 完全相同；**範圍外檔案：無**。
  - 附註：背景寫「只新增 9 檔」，實際 `src/types/__tests__/fixtures/ct-tower-state-v642/README.md` 是**修改**（+10 −11，該檔在 base 已存在），其餘 8 檔是新增；仍全屬 T0974 的變更。
- [x] `npm ci` exit 0（結尾 `electron-winstaller` install script 被擋的警告屬預期，見 CLAUDE.md「本機開發：npm 12 install scripts」）。
- [x] `npm run typecheck` exit 0（0 錯誤）。
- [x] `npm run typecheck:electron` exit 0（0 錯誤）。
- [x] `npx vite build` exit 0。
- [x] `npm run test:unit` 第一次完整執行即綠：Test Files **533 passed | 3 skipped (536)**，Tests **9634 passed | 41 skipped (9675)**，Duration 69.70 s。
- [x] `tower-state-ct642-fixtures-t0974.test.ts`：在 `test.include`（`src/**/*.test.{ts,tsx}`）內，完整執行時一併收錄；預設 reporter 不列通過檔名，另以 `npx vitest run <該檔> --reporter=verbose` 確認 **9 / 9 passed**（只為確認檔名，不是失敗後重跑）。
- [x] e2e 不跑（依工單）。

### 變更檔案

- 主 checkout：只有本工單檔。
- 整合 worktree：分支 `ct-merge/T0974` 多一個 merge commit `7cadec9d`；沒有其他 commit。

### Commit

- 產品：merge commit `7cadec9d`（在整合 worktree 的 `ct-merge/T0974`）。
- 工單：`git -C <主 checkout> commit --only _ct-workorders/T0976-merge-t0974-into-main.md`（本回報）。
- 未 ff `main`、未 push、未建 tag、未刪分支；整合 worktree 停在 `ct-merge/T0974`（留給塔台 ff）。

### 遭遇問題

- 無。

### 互動紀錄

- 無（yolo，未提問）。

### 後續建議

- 塔台：〈收單 SHA 比對五步〉→ 第 5 步（`main` 自 `804b04c0` 起只多 `_ct-workorders/**`，在整合分支再 `merge --no-ff main` 一次後 ff，產品樹不變、不必重跑驗收）→ 斷點 E → `--ff-only` → 整合 worktree `switch --detach`。

## 塔台收單補記

- 2026-11-28 16:16 (UTC+8) 收單：SHA 比對 ①–③ 成立（`base_main_sha` `804b04c0`；merge `7cadec9d` parent1 `804b04c0`、parent2 `5410c597` = T0974 `validated_sha`）；`main` 之後只多 `_ct-workorders/**`。`--close-worker --delay-ms 10000` exit 0。斷點 E → U-70；發 `0.8.1-pre.5` → U-71（D510）。
- 2026-11-28 16:22 (UTC+8) U-70：A → 整合分支再合併 `main` 後 ff：`main` = `9c4ca30e`，產品樹 = `7cadec9d`；整合 worktree detach；T0974 worktree 移除；分支保留（D511）。
