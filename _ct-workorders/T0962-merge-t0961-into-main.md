---
schema_version: 1
schema_kind: workorder
id: T0962
title: "合併 `ct/T0961`（Linux spec：⏻ 後游標，BUG-233）→ `main`"
type: chore
status: DONE
repo: better-agent-terminal
priority: P3
sizing: XS
created_at: "2026-11-28T00:08:39+08:00"
updated_at: "2026-11-28T00:12:13+08:00"
started_at: "2026-11-28T00:09:47+08:00"
completed_at: "2026-11-28T00:12:13+08:00"
session_ids:
  - "de616ea1-3c7e-4ef9-94f4-5a08d68144a2"
target_version: "下一個預覽版（`0.8.1-pre.3`）"
kind: merge
merges:
  - "ct/T0961"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: c411a6682e83fa11e88eb373a178c9bf3674c1f9
merge_target: main
depends_on: [T0961]
related:
  - "D468；T0961（`e05999d3`，base `acb4f4cf`）；`main` 自 base 起併入 T0960（`src/lib/__tests__/launch-command.test.ts` 1 行），判準 1 不成立，所以派合併單。兩邊檔案不重疊，塔台 `git merge-tree` 試合併無衝突"
affects_files:
  - _ct-workorders/T0962-merge-t0961-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0962`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0962-merge-t0961-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0962 — 合併 `ct/T0961` → `main`

## 背景

T0961 只新增 `e2e/linux/t0961-restart-hidden-cursor.spec.ts`（`e05999d3`，base `acb4f4cf`），已在 `linux-acceptance` 對 pre.1（B1 FAIL，預期）與 pre.2（全 PASS）驗過。期間 `main` 併入了 T0960（`src/lib/__tests__/launch-command.test.ts` 1 行），塔台直接合併判準第 1 條不成立，依規則派本單。兩邊檔案不重疊，`merge-tree` 無衝突。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0961` = `e05999d317511d92451b79fafaa8b48c5e57d604`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0962 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0962 T0961 Linux spec for BUG-233" ct/T0961`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 `e2e/linux/t0961-restart-hidden-cursor.spec.ts`；其他檔算範圍外，照實回報。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，確認 Linux spec 不被 vitest 收到）；以 tsc 檢查新 spec（同 T0961 的旗標）。
- [ ] e2e 不跑。

---

## 回報區

### 完成狀態

- **狀態**：DONE（模式 ① `mechanical`，無衝突、驗收全綠、無範圍外檔案；未 ff `main`，留給塔台斷點 E）
- **完成時間**：2026-11-28T00:12:13+08:00
- **session_id**：de616ea1-3c7e-4ef9-94f4-5a08d68144a2

### 落點檢查

- 結論：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在主 checkout `_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/**` → not applicable
- C-2：工單沒有 `branch` 欄位；主 checkout 在 `main`
- `CT_HOME` 未設定（非隔離派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 開工檢查（任務指令 1）

| 項目 | 結果 |
|---|---|
| 整合 worktree `status --porcelain` | 空（乾淨），開工前 detached 於 `178862f1`（T0960 的合併分支 head） |
| `ct/T0961` | `e05999d317511d92451b79fafaa8b48c5e57d604`，與工單一致 |
| `main` 自 `base_main_sha` 起的變更 | 只有 `_ct-workorders/**`（`BUG-233-…`、`T0962-…`、`_bug-tracker.md`、`_decision-log.md`、`_tower-state.md`）；開工時 `main` = `836c61cf` |
| `ct-merge/T0962` | 不存在 |
| 主 checkout `status --porcelain` | 空 |

### 合併結果

- 合併分支：`ct-merge/T0962`（從 `c411a6682e83fa11e88eb373a178c9bf3674c1f9` 開出，整合 worktree 目前在此分支上）
- merge commit：`69f4e1cccd10bc87936944557a189146eab1faaa`（訊息 `merge(ct): T0962 T0961 Linux spec for BUG-233`，ort，無衝突）
- parent1：`c411a6682e83fa11e88eb373a178c9bf3674c1f9`（= `base_main_sha`）
- parent2：`e05999d317511d92451b79fafaa8b48c5e57d604`（= `ct/T0961`）
- 跑驗收時的 SHA：`69f4e1cccd10bc87936944557a189146eab1faaa`（= merge commit）

### 驗收

| 項目 | 結果 |
|---|---|
| 樹比對 `git diff --name-only <base_main_sha> <merge commit>` | 只有 `e2e/linux/t0961-restart-hidden-cursor.spec.ts` → PASS |
| 範圍外檔案 | 無 |
| 整合 worktree `npm ci` | exit 0（結尾 `electron-winstaller` install script 被擋的警告屬預期，見 CLAUDE.md「本機開發：npm 12 install scripts」） |
| `npm run typecheck` | exit 0（0 錯誤） |
| `npx vite build` | exit 0 |
| `npm run test:unit`（第一次完整執行） | exit 0；Test Files 522 passed / 3 skipped（525）；Tests 9432 passed / 41 skipped（9473）；68.56 s。輸出中沒有 `t0961` → Linux spec 未被 vitest 收到 |
| 新 spec 的 tsc（同 T0961：`tsc --noEmit --strict --target ES2022 --module esnext --moduleResolution bundler --skipLibCheck --esModuleInterop --types node`） | exit 0 |
| e2e | 未跑（依工單） |
| 驗收後整合 worktree `status --porcelain` | 空 |

### 異動檔案

- 整合 worktree：合併分支 `ct-merge/T0962` 的 merge commit（產品檔只有上述 spec）
- 主 checkout：只有本工單檔

### commit

- 主 checkout：`2e926c2f`（開工 IN_PROGRESS）＋本次收尾 commit（只含本工單檔）
- 未 ff `main`、未 push、未建 tag、未觸發 workflow、未刪任何分支

### 遭遇問題

- 無。typecheck 的輸出暫存到 `.ct-integration/tc.log`（整合 worktree 上層、不在任何 repo 內），跑完已刪除；其他日誌都在 session 暫存資料夾。

### 互動紀錄

- 無（yolo，沒有需要問塔台的問題）

### 給塔台

- 可依 `merge-workorder.md` § 收單 SHA 比對五步 確認後 `git -C <主 checkout> merge --ff-only ct-merge/T0962`。注意 `main` 在本單期間已前進（`836c61cf` 與本單 commit，都只在 `_ct-workorders/**`），依第 5 步需先在整合分支 `merge --no-ff main` 一次再 ff。
