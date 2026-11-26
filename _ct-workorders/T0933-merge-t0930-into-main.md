---
schema_version: 1
schema_kind: workorder
id: T0933
title: "合併 `ct/T0930`（待辦分頁參考檔案可點，在「檔案」頁籤開啟）→ `main`"
type: chore
status: DONE
repo: better-agent-terminal
project: PLAN-069
priority: P2
sizing: S
created_at: "2026-11-26T20:27:38+08:00"
updated_at: "2026-11-26T20:31:03+08:00"
completed_at: "2026-11-26T20:31:03+08:00"
started_at: "2026-11-26T20:28:38+08:00"
session_ids:
  - "e8fad4eb-177b-4ec3-9f28-c677d99b99f9"
target_version: "0.8.0-pre.5"
kind: merge
merges:
  - "ct/T0930"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: a267cb3c63c6c18f0e5fd1c46d4bc42969adddbe
merge_target: main
depends_on: [T0930]
related:
  - "D374；T0930（`a9254f55`，base `78f4ecf6`）；`main` 自 base 起併入 T0931（`src/lib/tower-card-view.ts`、其測試、`docs/agent-guide/tower-inbox.md` 一條），判準 1 不成立，所以派合併單。`--worktree-status` conflicts []、塔台 `git merge-tree` 試合併 exit 0（`tower-inbox.md` 兩邊都改但不同段落）"
affects_files:
  - _ct-workorders/T0933-merge-t0930-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0933`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0933-merge-t0930-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0933 — 合併 `ct/T0930` → `main`

## 背景

T0930 新增 `src/lib/inbox-file-refs.ts`、`src/components/inbox/InboxRefText.tsx`、`useInboxFileRefs.ts` 與兩個測試檔，改 `InboxLists.tsx`、`InboxPanel.tsx`、`inbox.css`、`docs/agent-guide/tower-inbox.md`、`CLAUDE.md`（`a9254f55`，base `78f4ecf6`）。期間 `main` 併入了 T0931（`a267cb3c`），塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併無衝突。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0930` = `a9254f556b617adb04462b650b72c97055e670b2`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0933 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0933 T0930 inbox file refs" ct/T0930`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0930 的 10 檔（`CLAUDE.md`、`docs/agent-guide/tower-inbox.md`、`src/components/InboxPanel.tsx`、`src/components/__tests__/inbox-file-refs-t0930.test.tsx`、`src/components/inbox/InboxLists.tsx`、`src/components/inbox/InboxRefText.tsx`、`src/components/inbox/useInboxFileRefs.ts`、`src/lib/__tests__/inbox-file-refs.test.ts`、`src/lib/inbox-file-refs.ts`、`src/styles/inbox.css`）；其他檔算範圍外，照實回報。`tower-inbox.md` 確認 T0929、T0930、T0931 三處都在。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）。
- [ ] e2e 不跑。

## 收尾

- 回報區填：merge commit、parent1 / parent2、衝突（無則寫無）、驗收 SHA、樹比對、範圍外檔案。
- 只 commit 本工單檔到主 checkout；通知塔台。塔台做收單 SHA 比對後 ff `main`（斷點 E）。

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **模式**：① `mechanical`，無衝突
- **session_id**：e8fad4eb-177b-4ec3-9f28-c677d99b99f9
- **完成時間**：2026-11-26T20:30:39+08:00

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（主 checkout，`CT_HOME` 未設定，非 BAT 隔離 worktree）
- C-1：工單在 REPO_ROOT 下 → PASS
- C-3：`affects_files` 只有本工單（`_ct-workorders/**` 排除）→ 不適用
- C-2：工單沒有 `branch` 欄位 → 不適用（主 checkout 在 `main`）
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_REMOTE_TOKEN` 已設定

### 開工檢查（任務指令 1）

- 整合 worktree `git status --porcelain` 為空，detached 於 `a267cb3c63c6c18f0e5fd1c46d4bc42969adddbe`（= `base_main_sha`）
- `ct/T0930` = `a9254f556b617adb04462b650b72c97055e670b2` ✅
- `main` = `6bf494fc7468f3c77b2371b6b8c2f38b1960b0f8`；`git diff --name-only <base_main_sha> main` 只有 `_ct-workorders/**`（`T0933-…md`、`_decision-log.md`、`_insights/session-stats/2026-11.json`、`_tower-state.md`）✅
- `ct-merge/T0933` 事先不存在 ✅

### 合併結果

- **合併分支**：`ct-merge/T0933`（整合 worktree）
- **merge commit**：`83a74de2942b59b507f8715ca046e1d21c4003ed`（訊息 `merge(ct): T0933 T0930 inbox file refs`）
- **parent1**：`a267cb3c63c6c18f0e5fd1c46d4bc42969adddbe`（`base_main_sha`）
- **parent2**：`a9254f556b617adb04462b650b72c97055e670b2`（`ct/T0930`）
- **衝突**：無（ort 策略，`docs/agent-guide/tower-inbox.md` 自動合併）
- **驗收 SHA**：`83a74de2942b59b507f8715ca046e1d21c4003ed`（= merge commit；驗收前後整合 worktree `status --porcelain` 皆為空）

### 樹比對

`git diff --name-only a267cb3c <merge commit>` 共 10 檔，與工單列出的 T0930 10 檔完全一致：

- `CLAUDE.md`
- `docs/agent-guide/tower-inbox.md`
- `src/components/InboxPanel.tsx`
- `src/components/__tests__/inbox-file-refs-t0930.test.tsx`
- `src/components/inbox/InboxLists.tsx`
- `src/components/inbox/InboxRefText.tsx`
- `src/components/inbox/useInboxFileRefs.ts`
- `src/lib/__tests__/inbox-file-refs.test.ts`
- `src/lib/inbox-file-refs.ts`
- `src/styles/inbox.css`

- **範圍外檔案**：無
- `tower-inbox.md` 三處都在：T0929（第 430 行，版面）、T0930（第 14 行索引列、第 593 行 `## 參考檔案連結（T0930）`）、T0931（第 362 行，BUG-225 收合預覽取行規則）

### 驗收

| 項目 | 結果 |
|---|---|
| `npm ci`（整合 worktree） | exit 0（結尾 `electron-winstaller` install script 被擋的警告屬預期，見 CLAUDE.md「npm 12 install scripts」） |
| `npm run typecheck` | exit 0（0 錯誤） |
| `npx vite build` | exit 0 |
| `npm run test:unit`（第一次完整執行） | exit 0：Test Files 501 passed / 3 skipped（504）；Tests 9091 passed / 41 skipped（9132）；Duration 65.21 s |
| e2e | 依工單不跑 |

### 變更檔案

- 主 checkout：只改本工單檔（`_ct-workorders/T0933-merge-t0930-into-main.md`）
- 整合 worktree：merge commit `83a74de2`（分支 `ct-merge/T0933`）；未 ff `main`、未 push、未刪分支

### 遭遇問題

- 無。`npm ci` 的輸出起初寫到整合 worktree 上層（`.ct-integration/t0933-npmci.log`，repo 外），已移到 session scratchpad，沒有留下檔案。

### 互動紀錄

- 無（未向塔台提問）

### 後續

- 塔台：收單 SHA 比對五步後於主 checkout `git merge --ff-only ct-merge/T0933`（斷點 E）。`main` 目前比 `base_main_sha` 多 `_ct-workorders/**` 的 commit，ff 前需先處理（同 T0932 的做法）。
