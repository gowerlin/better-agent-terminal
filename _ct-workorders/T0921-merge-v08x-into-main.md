---
schema_version: 1
schema_kind: workorder
id: T0921
title: "合併 `v0.8.x`（`0.8.0-pre.3`）→ `main`，結束 D307 的分支分流"
type: chore
status: DONE
started_at: "2026-11-25T18:43:27+08:00"
updated_at: "2026-11-25T18:46:13+08:00"
completed_at: "2026-11-25T18:46:13+08:00"
session_ids:
  - "baa2061e-736e-4467-ab88-923b4faf07aa"
repo: better-agent-terminal
project: PLAN-066
priority: P1
sizing: S
created_at: "2026-11-25T18:41:59+08:00"
target_version: "main 對齊 `v0.8.0-pre.3`（不發版）"
kind: merge
merges:
  - "v0.8.x"
merge_mode: conflict
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: 5699a2aad61ce172c83e39b7b4d21f814757c9a2
merge_target: main
depends_on: []
related:
  - "U-2 → B（D342）；D307（產品改動在 `v0.8.x`）；PLAN-066；外部測試者從 main「Download ZIP」打包到舊程式（main `package.json` 仍 `0.7.5-pre.2`）"
affects_files:
  - _ct-workorders/T0921-merge-v08x-into-main.md
  - CHANGELOG.md
renew_count: 0
waiting_user: "U-3"
worker_question_timeout: 30
interaction:
  mode_hint: on
  interactive: false
  intervention_type: decision-requiring
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ②（`conflict`）與 § 共同護欄執行；只在整合 worktree 工作。被合併的是長期分支 `v0.8.x`（不是 `ct/T####`），合併分支名 `ct-merge/T0921`。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪 `v0.8.x`；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0921-merge-v08x-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。"
---

# T0921 — 合併 `v0.8.x` → `main`

## 背景

D307 起產品改動都在 `v0.8.x`，`main` 只累積塔台紀錄（`_ct-workorders/**`）與發版文件（`CHANGELOG.md`、`release-note.md`）。結果 GitHub 首頁 `main` 的「Download ZIP」是舊程式（`package.json` `0.7.5-pre.2`），`CHANGELOG.md` 卻寫到 pre.3，外部測試者因此打包到舊版。使用者裁示（U-2 → B，D342）：現在就把 `v0.8.x` 併回 `main`。

塔台查證（`origin/main` `7deb824c`、`origin/v0.8.x` `4ce779ee`、merge-base `06c3b884`）：

- `main` 自 merge-base 起只改 `_ct-workorders/**`、`CHANGELOG.md`、`release-note.md`；`v0.8.x` 改 222 個檔（產品程式、`README.md`、`CHANGELOG.md`、`site/`、`CLAUDE.md` 等）。
- `git merge-tree` 試合併：**只有 `CHANGELOG.md` 衝突**。兩邊都在 `## [Unreleased]` 之下新增 `## [0.8.0-pre.3]` 段（內容看起來相同）；`main` 另有 `## [0.8.0-pre.2]`（等）發版段，`v0.8.x` 沒有。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached `4ce779ee`）。確認 `v0.8.x` = `4ce779ee65f74f0cc58f5a7f5614ca5a7a7154c4`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**` 的 commit（塔台記帳，`git diff --name-only <base_main_sha> main`）。不符就停下問塔台。合併一律從 `base_main_sha` 開分支；`main` 在這之後的塔台記帳 commit 由塔台在 ff 前併入，Worker 不處理。
2. `git -C <整合 worktree> switch -c ct-merge/T0921 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0921 v0.8.x (0.8.0-pre.3) into main" v0.8.x`。
4. 解 `CHANGELOG.md`：結果必須是**每個版本段只出現一次**、依版號由新到舊、`## [Unreleased]` 留空；以 `main` 的發版段為準（發版文件依 L150 寫在 `main`），`v0.8.x` 那邊若有 `main` 沒有的條目就補進對應段並在回報說明。逐段比對兩邊 `[0.8.0-pre.3]` 是否逐字相同，不同之處寫進回報。
5. 若出現 `CHANGELOG.md` 以外的衝突 → `git merge --abort`，停下回報 `PARTIAL`（不自行擴大範圍）。

## 驗收（跑在 merge commit，回報 SHA）

- [ ] **樹比對（主要證據）**：`git diff --name-only 4ce779ee <merge commit>` 只列出 `_ct-workorders/**`、`CHANGELOG.md`、`release-note.md`；其他任何檔案都算異常，照實回報。另附 `git diff 4ce779ee <merge commit> -- CHANGELOG.md` 的摘要。
- [ ] `package.json` / `package-lock.json` 版號 = `0.8.0-pre.3`。
- [ ] `npm ci`；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）；`npm run verify:helpers`。
- [ ] 網站：照 `.github/workflows/pages.yml` 的建置指令在本機建一次網站（exit 0）；`main` 推送後 Pages 會部署 `v0.8.x` 帶來的 `site/` 變更（例 `site/tower-inbox.md`），回報建置結果與新增頁面清單。
- [ ] e2e 不跑：產品檔與 `v0.8.x` `4ce779ee`（pre.3 CI 已驗）相同，以樹比對為證據。
- [ ] 範圍外檔案：合併結果相對 `base_main_sha` 的變更中，除了 `v0.8.x` 帶進來的檔之外不得有其他改動；`CHANGELOG.md` 以外沒有手動編輯。

## 收尾

- 回報區填：merge commit、parent1 / parent2、衝突檔說明（雙方意圖、解法、理由）、驗收 SHA、樹比對結果、範圍外檔案。
- 只 commit 本工單檔到主 checkout；通知塔台。塔台做收單 SHA 比對後 ff `main`（斷點 E，非 yolo 會先問使用者）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：DONE（模式 ② `conflict`；只在整合 worktree 工作，未 ff `main`、未 push、未建 tag、未刪 `v0.8.x`）
- **完成時間**：2026-11-25T18:46:13+08:00
- **session_id**：baa2061e-736e-4467-ab88-923b4faf07aa

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`CT_HOME` 未設，非 worktree 派工）
- C-1：工單位於主 checkout `_ct-workorders/` 之下 → PASS
- C-3：`affects_files` 的 `CHANGELOG.md` 存在 → PASS（`_ct-workorders/**` 不計）
- C-2：工單無 `branch` 欄位，不適用
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE` = `on`

### 開工前置確認（任務指令第 1–2 步）

- 整合 worktree `<repo 上層>/.ct-integration/better-agent-terminal`：`status --porcelain` 為空，detached `4ce779ee` ✅
- `v0.8.x` = `origin/v0.8.x` = `4ce779ee65f74f0cc58f5a7f5614ca5a7a7154c4` ✅
- `main` = `254424b7`（`base_main_sha` `5699a2aa` 之後多 2 個 commit），`git diff --name-only 5699a2aa main` 只有 `_ct-workorders/T0921-merge-v08x-into-main.md`、`_ct-workorders/_tower-state.md` → 符合「只多塔台記帳」✅（Worker 不處理，依工單由塔台在 ff 前併入）
- `ct-merge/T0921` 原本不存在 → `switch -c ct-merge/T0921 5699a2aa` ✅

### 合併結果

- **merge commit**：`f9375c2c78c0afa2f8c51afcff53c5bb62d53c3d`（分支 `ct-merge/T0921`）
- **parent1**：`5699a2aad61ce172c83e39b7b4d21f814757c9a2`（= `base_main_sha`）
- **parent2**：`4ce779ee65f74f0cc58f5a7f5614ca5a7a7154c4`（= `v0.8.x`）
- **驗收 SHA**：`f9375c2c…`（所有驗收都在 merge commit 跑，與 merge commit 相同；驗收後整合 worktree `status --porcelain` 為空）
- commit 訊息：`merge(ct): T0921 v0.8.x (0.8.0-pre.3) into main`，後面附 git 自動產生的 `# Conflicts: CHANGELOG.md` 註記行（以 `commit --no-edit` 收尾，git 未清掉註解行）。只是註記、不影響內容，未 amend。

### 衝突檔說明

只有 `CHANGELOG.md` 衝突（與塔台 `merge-tree` 預測一致），沒有其他衝突。

- **`main` 的意圖**：發版文件依 L150 寫在 `main`，在 `## [Unreleased]` 之下依序有 `[0.8.0-pre.3]`、`[0.8.0-pre.2]`、`[0.8.0-pre.1]` 三個發版段。
- **`v0.8.x` 的意圖**：pre.3 打包時（`4ce779ee` "package version 0.8.0-pre.3, CHANGELOG"）在分支上也寫了 `[0.8.0-pre.3]` 段，但沒有 pre.2 / pre.1 段。
- **逐段比對**（以 merge 的 stage 1/2/3 取出三份檔比對）：
  - 兩邊第 1–29 行（標頭、空的 `[Unreleased]`、整個 `[0.8.0-pre.3]` 段）**逐字相同**，沒有差異。
  - 兩邊從 `[0.7.5-pre.2]` 起到檔尾也逐字相同，且與 merge-base `06c3b884` 的內容相同。
  - 唯一差別：`main` 多 `[0.8.0-pre.2]`、`[0.8.0-pre.1]` 兩段；`v0.8.x` 沒有 `main` 缺少的條目。
- **解法**：採 `main` 的版本（stage 2）原樣。staged blob `7be386cc` = `5699a2aa:CHANGELOG.md` 的 blob，沒有任何手動改寫，也不必從 `v0.8.x` 補條目。
- **結果檢查**：版本段 88 個，沒有重複；依 `sort -V -r` 比對順序是由新到舊；`## [Unreleased]` 留空；沒有衝突標記殘留。

### 驗收

| 項目 | 結果 | 證據 |
|---|---|---|
| 樹比對 `git diff --name-only 4ce779ee f9375c2c` | ✅ PASS | 只列出 `CHANGELOG.md`、`release-note.md`、`_ct-workorders/**` 59 個檔；沒有其他檔案 |
| `CHANGELOG.md` 對 `4ce779ee` 的差異 | — | +38 行、0 刪：在 `[0.8.0-pre.3]` 之後插入 `[0.8.0-pre.2] — 2026-11-25`、`[0.8.0-pre.1] — 2026-11-24` 兩段（`main` 的發版段） |
| `release-note.md` 對 `4ce779ee` 的差異 | — | +131 行、0 刪：`main` 的 `v0.8.0-pre.3`／`pre.2`／`pre.1` 三段更版重點 |
| `package.json` / `package-lock.json` 版號 | ✅ PASS | `0.8.0-pre.3`／lock `version` 與 `packages[""].version` 都是 `0.8.0-pre.3` |
| `npm ci` | ✅ exit 0 | 749 packages；結尾只有預期的 `electron-winstaller` install-scripts 警告（CLAUDE.md「npm 12 install scripts」節） |
| `npm run typecheck` | ✅ 0 | exit 0 |
| `npm run typecheck:electron` | ✅ 0 | exit 0 |
| `npx vite build` | ✅ exit 0 | |
| `npm run test:unit`（第一次完整執行） | ✅ 綠 | Test Files 495 passed / 3 skipped（498）；Tests 9001 passed / 41 skipped（9042）；65.52 s；exit 0。log 裡有 16 次 node-pty `conpty_console_list_agent.js` 的 `AttachConsole failed` stderr，屬子程序雜訊、沒有造成任何測試失敗 |
| `npm run verify:helpers` | ✅ exit 0 | 6 個執行期 helper，與 server bundle 同一組 |
| 網站建置（照 `pages.yml`：`site/` 下 `npm ci` → `npm run build`） | ✅ exit 0 | VitePress `build complete in 5.92s` |
| e2e | 不跑（依工單） | 產品檔與 `4ce779ee`（pre.3 CI 已驗）相同，見樹比對 |
| 範圍外檔案 | ✅ 無 | 見下節 |

本機環境：Node v26.13.1、npm 12.2.3（`pages.yml` 用 Node 24；網站建置在本機 Node 26 下 exit 0）。

### 網站變更（`main` 推送後 Pages 會部署）

`git diff --name-status 5699a2aa f9375c2c -- site/`：

- 新增頁面：`site/tower-inbox.md`
- 修改：`site/.vitepress/config.mts`、`site/control-tower.md`、`site/features.md`

### 範圍外檔案

- 合併結果相對 `base_main_sha` 改了 221 個檔；`v0.8.x` 自 merge-base `06c3b884` 起改了 222 個檔。
- 「結果有改、但不是 `v0.8.x` 帶進來的檔」：**無**。
- 「`v0.8.x` 帶進來、但結果相對 `main` 沒變的檔」：只有 `CHANGELOG.md`（採 `main` 版本）。
- `CHANGELOG.md` 以外沒有手動編輯。

### 遭遇問題

- 無阻斷問題。上面記了兩點：merge commit 訊息裡有 git 註記行；unit test log 有 node-pty stderr 雜訊。

### 互動紀錄

- [18:43] 開工，`CT_MODE=on`、`interactive: false`。全程沒有向使用者或塔台提問。

### 給塔台

- 收單 SHA 比對：parent1 = `base_main_sha` `5699a2aa`；parent2 = `v0.8.x` `4ce779ee`。
- `main` 目前是 `254424b7`，在 `5699a2aa` 之後只多 `_ct-workorders/**`（另加上本工單收尾的 commit）。依五步的第 5 步，ff 前要在整合分支再 `merge --no-ff main` 一次。
- 整合 worktree 停在 `ct-merge/T0921`、工作區乾淨，留給 ff。
