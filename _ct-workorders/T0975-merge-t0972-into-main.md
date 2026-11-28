---
schema_version: 1
schema_kind: workorder
id: T0975
title: "合併 `ct/T0972`（BUG-235 重修：宣告契約前送出的草稿也清除）→ `main`"
type: chore
status: DONE
repo: better-agent-terminal
priority: P2
sizing: S
created_at: "2026-11-28T16:00:47+0800"
started_at: "2026-11-28T16:02:05+0800"
updated_at: "2026-11-28T16:04:51+0800"
completed_at: "2026-11-28T16:04:51+0800"
session_ids:
  - "481bb84a-d9a4-46c0-b581-a9be3c64be30"
target_version: "下一個預覽版（`0.8.1-pre.5`）"
kind: merge
merges:
  - "ct/T0972"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: e54da6ff1f6fa458aa1bc7507029cc711fafe3f1
merge_target: main
depends_on: [T0972]
related:
  - "D506；T0972（head `c1abe148`，`validated_sha` `abcff41d`，head 只多一筆純文件 commit；base `07afa77b`）；`main` 自 base 起併入 T0970 的 `e2e/manual/` 驅動（`8de1e2d1`），判準 1、2 不成立，所以派合併單。塔台 `git merge-tree --write-tree main ct/T0972` 無衝突"
affects_files:
  - _ct-workorders/T0975-merge-t0972-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0972`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0975-merge-t0972-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0975 — 合併 `ct/T0972` → `main`

## 背景

T0972（BUG-235 重修）改 5 檔（`electron/notify-hold.ts`、`electron/__tests__/notify-hold-prompt-submit.test.ts`、`docs/agent-guide/tower-inbox.md`、`docs/agent-guide/notify-hold.md`、`CLAUDE.md`），head `c1abe148`（`validated_sha` `abcff41d`，之後只多一筆 `tower-inbox.md` 文件 commit），base `07afa77b`。期間 `main` 併入 T0970 的 `e2e/manual/` 驅動（不重疊），塔台直接合併判準第 1、2 條不成立，依規則派本單；本單在合併結果上重跑完整驗收，涵蓋 head。塔台 `git merge-tree` 試合併無衝突。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0972` = `c1abe1489b86ddabdd7edc42686611d1b9392bfd`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0972 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0972 clear the draft on the launch-argument turn before the contract declare (BUG-235)" ct/T0972`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0972 的 5 檔；其他檔算範圍外，照實回報。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）；確認 `notify-hold-prompt-submit.test.ts` 的 `T0972 / BUG-235` 段落都有跑到並通過。
- [ ] e2e 不跑。

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **合併模式**：① `mechanical`（無衝突，未改模式）
- **session_id**：481bb84a-d9a4-46c0-b581-a9be3c64be30

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（主 checkout 執行；非 BAT worktree，`CT_HOME` 未設）
- C-1：工單在主 checkout `_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/**` → 不適用
- C-2：工單無 `branch` 欄位；主 checkout 在 `main`
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 開工檢查（任務指令 1）

- 整合 worktree `status --porcelain` 為空，detached 於 `8de1e2d1`（T0970 的合併 commit）
- `ct/T0972` = `c1abe1489b86ddabdd7edc42686611d1b9392bfd` ✅
- `main` 開工時 = `59ef6010`（之後本單 start commit 使其變成 `4e7a0258`）；`git diff --name-only e54da6ff..main` 只有 `_ct-workorders/**`（`BUG-235-…`、`T0972-…`、`T0975-…`、`_decision-log.md`、`_tower-state.md`）✅
- `ct-merge/T0972` 原本不存在 ✅

### 合併結果

- 分支：`ct-merge/T0972`（從 `base_main_sha` `e54da6ff1f6fa458aa1bc7507029cc711fafe3f1` 開出）
- **merge commit**：`b04ed2e984554f5ba0cfb5503d6fee7b8a38653d`
- **parent1**：`e54da6ff1f6fa458aa1bc7507029cc711fafe3f1`（= `base_main_sha`）
- **parent2**：`c1abe1489b86ddabdd7edc42686611d1b9392bfd`（= `ct/T0972` head）
- 衝突：無（`ort` 策略直接完成）
- 訊息：`merge(ct): T0972 clear the draft on the launch-argument turn before the contract declare (BUG-235)`
- 提醒塔台：`main` 已在 `e54da6ff` 之後前進（只有 `_ct-workorders/**`），`--ff-only` 前依收單 SHA 比對第 5 步在整合分支再 `merge --no-ff main` 一次。

### 驗收（全部在 `b04ed2e9` 上執行，validated_sha = merge commit）

| 項目 | 結果 |
|---|---|
| 樹比對 `git diff --name-only e54da6ff b04ed2e9` | 只有 5 檔：`CLAUDE.md`、`docs/agent-guide/notify-hold.md`、`docs/agent-guide/tower-inbox.md`、`electron/__tests__/notify-hold-prompt-submit.test.ts`、`electron/notify-hold.ts`。**範圍外檔案：無** |
| `npm ci` | exit 0（結尾 `electron-winstaller` install script 被擋的警告屬預期，見 CLAUDE.md「npm 12 install scripts」） |
| `npm run typecheck` | exit 0，`error TS` 0 筆 |
| `npm run typecheck:electron` | exit 0，`error TS` 0 筆 |
| `npx vite build` | exit 0 |
| `npm run test:unit`（第一次完整執行） | exit 0：Test Files **532 passed / 3 skipped（535）**、Tests **9625 passed / 41 skipped（9666）**，Duration 67.65 s；未重跑 |
| `notify-hold-prompt-submit.test.ts` T0972 段落 | 另以 `npx vitest run <檔> --reporter=verbose` 列出：29 / 29 通過；`describe('T0972 / BUG-235: the launch-prompt turn submits before the Tower declares contract 2')` 5 個 it 全 ✓（含 `T0972 Q-2 (intended)`），以及 `BUG-235: …` describe 中 2 個 T0972 案例（v1 Tower / not a Tower）✓ |
| e2e | 依工單不跑 |

- 驗收後整合 worktree `status --porcelain` 為空（`dist-electron` 等產物為 ignore 檔）。

### 遵守的護欄

- 只在整合 worktree 合併；未 ff `main`、未 push、未建 tag、未觸發 workflow、未刪分支；未使用 `--force` / `reset --hard` / rebase / stash / `checkout --` / `restore`。
- git 指令皆帶 `-c core.longpaths=true`（`switch` / `merge`）。
- 主 checkout 只 commit 本工單檔（`--only`）。

### 互動紀錄

- [16:02] 開工；yolo、`CT_INTERACTIVE=0`，未向塔台提問（無需判讀的問題）。
- [16:02] Phase 1 的 frontmatter 自檢第一次因 Git Bash 路徑未轉換而沒跑到（找不到腳本），start commit 已先送出；隨即以 `cygpath -m` 路徑重跑 → PASS，start commit 內容無誤。

### 遭遇問題

- 無產品面問題。僅上述自檢腳本路徑轉換的操作失誤，已補跑通過。

### Commit

- 產品 commit：無（合併 commit `b04ed2e9` 在整合 worktree 的 `ct-merge/T0972`，不在 `main`）
- 工單 commit：`4e7a0258`（start）、closeout commit（本次）

## 塔台收單補記

- 2026-11-28 16:05 (UTC+8) 收單：SHA 比對 ①–③ 成立（`base_main_sha` `e54da6ff`；merge `b04ed2e9` parent1 `e54da6ff`、parent2 `c1abe148` = `ct/T0972` head；本單在 merge commit 重跑完整驗收，涵蓋 T0972 validated 之後的文件 commit）；`main` 之後只多 `_ct-workorders/**`。`--close-worker --delay-ms 10000` exit 0。斷點 E → U-69（D507）。
- 2026-11-28 16:06 (UTC+8) U-69：A → 整合分支再合併 `main` 後 ff：`main` = `7d2e571d`，產品樹 = `b04ed2e9`；整合 worktree detach；T0972 worktree 移除；分支 `ct/T0972`、`ct-merge/T0972` 保留（D508）。
