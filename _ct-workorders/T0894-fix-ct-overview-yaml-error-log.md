---
schema_version: 1
schema_kind: workorder
id: T0894
title: "修正 BUG-217（在 `v0.8.x`）：指揮塔總覽的 YAML 解析錯誤只記一行原因、同一檔同一錯誤只記一次，不記原文"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-25T00:39:51+08:00"
updated_at: "2026-11-25T00:47:55+08:00"
started_at: "2026-11-25T00:41:29+08:00"
completed_at: "2026-11-25T00:47:55+08:00"
session_ids:
  - "c5fa6a32-4bb2-4545-beb0-d3842656b331"
target_version: "0.8.0-pre.2"
depends_on: []
related:
  - "BUG-217；T0892（調查結論 §1、建議方向 B）；D318（使用者 2026-11-25：BUG-216 / BUG-217 一起修，放進 pre.2）；D307；T0701（指揮塔總覽，契約 v1）"
  - "CLAUDE.md「指揮塔總覽（T0701，D184）」「Logging」各節；`docs/agent-guide/ct-tower-overview.md`"
affects_files:
  - _ct-workorders/T0894-fix-ct-overview-yaml-error-log.md
  - src/components/ControlTowerPanel.tsx
  - src/lib/ct-tower-overview.ts
  - src/components/__tests__/tower-overview.test.tsx
  - src/lib/__tests__/ct-tower-overview.test.ts
renew_count: 0
isolation: worktree
workdir: worktree ct/T0894（塔台已預先從 `v0.8.x` 建立分支 `ct/T0894`，`bcb4bbe0`）
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0894` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `bcb4bbe0e2f300832bfa3bbfbfbebcc46f1f23a4`，不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 只改 `affects_files` 列的檔案。**不改 CLAUDE.md、`docs/agent-guide/`、`package.json`、`package-lock.json`**（T0891 正在改，避免合併衝突）；`docs/agent-guide/ct-tower-overview.md` 需要補的文字寫在回報區，由塔台合併後補。需要動其他檔 → 先問塔台。"
  - "🔴 不得改變的行為（T0701 / D184）：總覽維持唯讀；frontmatter 摘要契約 v1（`schema_kind: tower-state`、`summary_version`）與「最後更新」那一行的比對不變；解析失敗時畫面的顯示（無法讀取摘要）不變；`fs.watch` 重載與 ↻ 行為不變；遠端工作區行為不變。"
  - "🔴 修正目標（BUG-217）：① 解析錯誤日誌只記一行：錯誤類別 / reason ＋行列（js-yaml `mark.line` / `mark.column` 之類），🔴 不記 js-yaml 的原文摘錄（`mark.snippet` 或 `message` 中的多行片段）、不記檔案內容與完整路徑（工作區以 id 或檔名即可）；② 同一工作區同一檔、同一錯誤（以 reason＋行列或內容雜湊判定）只記一次，直到檔案內容改變或錯誤改變才再記；解析恢復成功時可記一行恢復。去重狀態只在記憶體。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 全綠（附 passed / files 數）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。新增 / 更新測試：雙引號字串含未跳脫反斜線的 frontmatter → 只記一次、單行、不含原文；內容改變後再記；修好後顯示恢復。不需要啟動 BAT 實機；若要啟動只用隔離實例（`--runtime`），不碰使用者正在用的 BAT（安裝版 `0.8.0-pre.1`）。`TMP` 用系統預設（T0716）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "🔴 公開 repo（D176）：回報區與測試 fixture 不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`，範例路徑用 `C:\\Users\\demo`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0894 — 修正 BUG-217：指揮塔總覽的 YAML 錯誤日誌

## 背景

T0892 在 `v0.8.0-pre.1` 日誌看到（詳見 `_ct-workorders/BUG-217-ct-overview-yaml-error-log-spam.md`）：某工作區的 `_tower-state.md` frontmatter 在雙引號字串裡有未跳脫的反斜線，`ControlTowerPanel.tsx`（約 506 行）每次 `fs.watch` → `reloadAll` 都記 `[ct-overview] _tower-state.md summary ignored: YAML parse error: unknown escape sequence`，而且附 js-yaml 約 8 行原文摘錄：4 小時 347 次、222 KB，並把該工作區的塔台狀態內容寫進 debug log。

既有程式（T0701 起），不是 `v0.8.x` 回歸；修正放在 `v0.8.x`，隨 `0.8.0-pre.2` 發佈。

## 實作

1. 確認 merge-base；worktree `npm ci`。
2. 照 `memory_overrides` 第 4 條：單行原因、去重、不記原文。
3. 測試；`docs/agent-guide/ct-tower-overview.md` 要補的文字寫在回報區。

## 驗收

- [x] 同一錯誤只記一次、單行、不含原文與檔案內容
- [x] 內容 / 錯誤改變後才再記；畫面顯示與 T0701 契約不變
- [x] `test:unit` 全綠、`vite build` exit 0、兩個 typecheck = 0
- [x] 隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（驗收四項皆通過）
- **session_id**：c5fa6a32-4bb2-4545-beb0-d3842656b331
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal` = `basename "$CT_HOME"`；C-1 工單在 `$CT_HOME/_ct-workorders/` 下；C-3 `affects_files` 4 個產品檔皆存在；C-2 工單無 `branch` 欄位。`CT_HOME` 已設定（主 checkout）、`CT_WORKTREE_BRANCH` = `ct/T0894`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- **merge-base 檢查**：`git merge-base HEAD v0.8.x` = `bcb4bbe0e2f300832bfa3bbfbfbebcc46f1f23a4`，符合 `memory_overrides` 第 1 條。

### 產出摘要

**修正（BUG-217）**
- `src/lib/ct-tower-overview.ts`
  - 新增 `describeYamlError(err, lineOffset)`：只輸出 `YAML parse error: <js-yaml reason> at line L, column C`（1-based；`parseTowerState` 傳 `lineOffset = 1`，行號是檔案的行號，不是 frontmatter 區塊內的行號）。🔴 不用 `message`（js-yaml 4.3.2 的 `message` 會附上含檔案原文的多行片段）。非 `YAMLException` 的錯誤只取第一行、最多 120 字。
  - `schema_kind` / `summary_version` 不符的原因：字串值只在 ≤ 40 字時照寫（JSON），map / list / 長字串只寫型別（`a map` / `a list` / `a string`），避免把 frontmatter 內容帶進日誌。
  - 新增 `towerStateSummaryLog(prev, content, parsed)`（純函式）與 `contentHash`（FNV-1a 32-bit）：同一錯誤＋同一內容只記一次；內容或錯誤改變時再記；記過錯誤後第一次沒有錯誤的讀取記一行 `[ct-overview] _tower-state.md summary error cleared`。
- `src/components/ControlTowerPanel.tsx`：`loadTowerOverview` 改經 `towerStateSummaryLog`，去重狀態放在 `summaryErrorLogRef`（`Map<_ct-workorders 路徑, 狀態>`，只在記憶體、不寫檔；路徑只當 key，不進日誌）。

**日誌行（修正後）**
- `[ct-overview] _tower-state.md summary ignored: YAML parse error: expected hexadecimal character at line 4, column 12`（只有一行，不含原文、內容、路徑）
- `[ct-overview] _tower-state.md summary error cleared`

**不變的行為（T0701 / D184）**：總覽仍唯讀；契約 v1 的判斷與「最後更新」比對沒動；解析失敗時畫面照舊顯示「沒有摘要」＋最後更新行（測試斷言 `ov.noSummary` 與最後更新文字）；`fs.watch` 重載與 ↻ 沒動；遠端工作區走同一條路，沒有另外改。`parseTowerConfigYaml` 的錯誤字串（畫面上 `layerParseError` 會顯示，不寫日誌）不改。

**測試**
- `src/lib/__tests__/ct-tower-overview.test.ts`：新增 `describeYamlError / towerStateSummaryLog` 5 項：未跳脫反斜線 → 一行、有行列、不含原文；非 YAMLException 的錯誤只留第一行並截斷；值只寫型別；同錯誤同內容只記一次 → 內容改變再記 → 錯誤改變再記 → 修好記 cleared；hash 穩定。
- `src/components/__tests__/tower-overview.test.tsx`：新增「T0894 (BUG-217)」：雙引號字串含 `\U`（未跳脫反斜線）的 frontmatter，watcher 觸發 3 次只記 1 行（逐字比對、不含換行、`demo`、`schema_kind`、工作區路徑）；內容改變 → 再記；修好 → `summary error cleared` 並顯示摘要。fixture 範例路徑用 `C:\Users\demo`。

**`docs/agent-guide/ct-tower-overview.md` 待塔台補的文字**（第 56 行，原文「YAML 解析失敗或不符條件 → 當作沒有摘要，renderer 日誌記 `[ct-overview] _tower-state.md summary ignored: <原因>`，不丟例外。」）建議改為：

> - YAML 解析失敗或不符條件 → 當作沒有摘要，不丟例外。renderer 日誌記一行 `[ct-overview] _tower-state.md summary ignored: <原因>`：YAML 錯誤只寫 js-yaml 的 reason 與檔案行列（`YAML parse error: <reason> at line L, column C`，`describeYamlError`），🔴 不寫 js-yaml 的原文片段、檔案內容與路徑；`schema_kind` / `summary_version` 的值只在是短純量（字串 ≤ 40 字）時寫出，其他只寫型別。同一工作區的同一錯誤＋同一內容（FNV-1a 雜湊）只記一次，`_ct-workorders/` watcher 再觸發也不重記；內容或錯誤改變才再記，記過錯誤後恢復時記一行 `… summary error cleared`。去重狀態只在記憶體（`towerStateSummaryLog`，`src/lib/ct-tower-overview.ts`；T0894 / BUG-217）。

CLAUDE.md「指揮塔總覽」節不需要改（該節沒寫日誌格式）。

**Commit**
- 產品：`2b49e5a5a3cfd6b4ee28deedcc8f7bf27d277a3e`（`ct/T0894`，4 檔，+182 / −7）
- 工單：主 checkout `git commit --only` 本檔（hash 見塔台 git log）

**驗證**（皆在 `2b49e5a5`）
- 依賴：worktree `npm ci` exit 0（結尾 `electron-winstaller` install-scripts 警告，屬預期）。
- `npm run test:unit`：第 1 次 exit 1：所有測試項通過（8404 passed / 92 skipped），但 4 個 headless e2e 檔（`electron/remote/__tests__/headless-blocked-state-e2e` / `headless-close-worker-e2e` / `headless-helper-narrowing` / `headless-remote-tower-e2e`）在 `beforeAll` 等 10 s 逾時（log 另有 node-pty `AttachConsole failed`）。這 4 檔單獨重跑 4 passed / 45 tests；第 2 次完整重跑 **exit 0：463 files passed / 3 skipped（466），8454 tests passed / 42 skipped（8496）**。
- `npx vite build`：exit 0。
- `npm run typecheck`：0；`npm run typecheck:electron`：0。
- 沒有啟動 BAT 實機。

### 互動紀錄
- [00:41] 開工：`CT_MODE=yolo`，落點與 merge-base 檢查 PASS，worktree `npm ci`。
- [00:44] 第一次用 bash heredoc 寫測試，fixture 的反斜線被吃掉（測試失敗、看得出原因），改用 Edit 工具修正（L129）。
- [00:45] 第一次完整 `test:unit` 有 4 個 headless e2e 檔逾時 → 單獨重跑通過 → 完整重跑全綠。沒有向塔台提問。

### Renew 歷程
無

### 遭遇問題
- 第一次完整 `test:unit` 有 4 個 headless e2e 測試檔在 `beforeAll` 逾時（見〈驗證〉）；重跑全綠，跟本單改的 renderer 程式無關，判斷是全套平行執行時的負載。若塔台合併後的 CI 再看到，可另開單觀察這 4 檔的 hookTimeout。

### 隔離分支證據
- branch：`ct/T0894`
- base_sha：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`，是與 main 的共同祖先；與 `v0.8.x` 的 merge-base = `bcb4bbe0e2f300832bfa3bbfbfbebcc46f1f23a4`）
- validated_sha：`2b49e5a5a3cfd6b4ee28deedcc8f7bf27d277a3e`
- head_sha：`2b49e5a5a3cfd6b4ee28deedcc8f7bf27d277a3e`
- validated_sha ≠ head_sha 的說明：兩者相同
- worktree `git status --porcelain`：空

### 回報時間
2026-11-25T00:47:55+0800
