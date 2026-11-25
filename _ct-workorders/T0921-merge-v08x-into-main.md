---
schema_version: 1
schema_kind: workorder
id: T0921
title: "合併 `v0.8.x`（`0.8.0-pre.3`）→ `main`，結束 D307 的分支分流"
type: chore
status: PENDING
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
