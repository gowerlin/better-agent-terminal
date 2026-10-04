---
schema_version: 1
schema_kind: workorder
id: T0438
title: "遠端視窗新增「複製遠端路徑」選單項（FileTree / Sidebar / MarkdownPreviewPanel / PathLinker），原「複製路徑」維持 client 形式"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: BUG-105
priority: P2
sizing: S
created_at: "2026-10-05T05:51:45+08:00"
started_at: "2026-10-05T07:14:10+08:00"
updated_at: "2026-10-05T07:14:10+08:00"
completed_at: null
target_version: next
depends_on:
  - T0437
related:
  - "T0421 研究拆單第 4 列；Q2 裁決（新增選單項，保留原本 client 形式）"
  - "D134 追加（T0421 拆單）"
affects_files:
  - src/components/FileTree.tsx
  - src/components/Sidebar.tsx
  - src/components/MarkdownPreviewPanel.tsx
  - src/components/PathLinker.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 使用 T0437 的 `remote:resolve-client-paths(paths, 'workspace-entry')`，不另寫轉換邏輯。選單項**只在遠端 profile 視窗顯示**；本機視窗 UI 不變。"
  - "🔴 同工作樹有其他 Worker 平行。i18n 檔 commit 前 `git diff <file>` 確認只含本單 hunk。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0438 — 複製遠端路徑

## 範圍

1. 四處右鍵 / 選單（行號以 T0421 回報區為參考：`FileTree.tsx`、`Sidebar.tsx` 約 :584、`MarkdownPreviewPanel.tsx` 約 :69、`PathLinker.tsx` 約 :225）新增「複製遠端路徑」
2. i18n 三語
3. 測試：遠端視窗顯示且複製 server 形式；本機視窗不顯示

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] 回報區附實機步驟

## Sub-session 執行指示
1. 讀本工單 + T0421 回報區（Q2）+ T0437 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（開始 2026-10-05T07:14:10+08:00，Worker，`CT_MODE=yolo`、`CT_INTERACTIVE=0`）

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 PASS（`src/components/FileTree.tsx` 等皆存在）；C-2 不適用（無 `branch`，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 依賴：T0437 `DONE`（commit `394add5`）
- 驗收：
  - `npm run test:unit`：**159 files / 2528 passed / 1 skipped，全綠**
  - `npx tsc --noEmit`：**36**（≤ 39）；本單改動檔案 0 錯誤（剩餘皆既有 `CodexAgentPanel.tsx` 型別債）
  - 未跑 `npx vite build` / `npm run test:e2e`（工單 L141）；未用 stash / reset / checkout / restore；未 push
  - i18n 三檔 `git diff` 確認各只含本單 1 行

### 產出摘要

**機制**

- 「複製遠端路徑」一律走 T0437 的 `remote:resolve-client-paths([path], 'workspace-entry')`，未另寫轉換邏輯：
  - `src/lib/client-paths.ts` 新增 `resolveRemotePath(path)`（以既有 `splitResolvedPaths` 配對，fail-closed：IPC 失敗 / 不可達 / 答案不符 → `null`）與 `copyRemotePath(path)`（`null` → 不寫剪貼簿、`debug.log`、回 `false`）
- 遠端視窗判斷：新 hook `src/hooks/useIsRemoteWindow.ts` —— `app.getWindowProfile()`（detached 視窗回報父視窗綁定，T0446）+ `profile.listLocal()`（local-only，不依賴遠端已連線，T0443）→ 綁定 profile `type === 'remote'`。每個 renderer 快取一次；任何失敗 → `false`（維持本機 UI）
- 四處入口（只在遠端 profile 視窗顯示；本機視窗 DOM 不變）：
  | 位置 | 形式 | 原有項目 |
  |---|---|---|
  | `FileTree.tsx` 右鍵選單 | 「Copy Absolute Path」下方新增選單項 | 「Copy Relative Path」/「Copy Absolute Path」不變（client 形式） |
  | `Sidebar.tsx` 工作區右鍵選單 | 「複製路徑」下方新增選單項 | 「複製路徑」不變 |
  | `MarkdownPreviewPanel.tsx` 標頭 | 「⎘ 複製路徑」旁新增按鈕 `⧉`（title / aria-label = 複製遠端路徑） | 不變 |
  | `PathLinker.tsx` `FilePreviewModal` 標頭 | 「⎘」旁新增按鈕 `⧉`，成功後短暫顯示 `✓` | 不變；client 形式（Ctrl+P）與 server 形式（agent 輸出）皆正確（`toServer` 對 server 形式 no-op） |
- i18n：`sidebar.copyRemotePath` —— en `Copy Remote Path` / zh-TW `複製遠端路徑` / zh-CN `复制远程路径`

**檔案**

- `src/components/FileTree.tsx` / `Sidebar.tsx` / `MarkdownPreviewPanel.tsx` / `PathLinker.tsx`
- `src/locales/{en,zh-TW,zh-CN}.json`
- `src/lib/client-paths.ts`（**超出 affects_files**：T0437 已在其 `workspace-entry` 註解預留 T0438；放這裡讓四處共用同一 helper）
- `src/hooks/useIsRemoteWindow.ts`（**新檔，超出 affects_files**：四個元件共用的遠端視窗判斷，避免 prop drilling 穿過 WorkspaceView / LinkedText 等多層）
- 測試 `src/__tests__/copy-remote-path.test.tsx`（7）：遠端視窗 × 4 入口皆複製 server 形式、原「複製路徑」仍為 client 形式、`resolveClientPaths` 以 `'workspace-entry'` 呼叫；FilePreviewModal client / server 兩種輸入；不可達 / IPC 失敗不寫剪貼簿；本機視窗 4 處皆無新項目且不呼叫 IPC；偵測失敗 → 視為本機

**實機步驟（待使用者以新 build 驗證）**

1. 開 WSL 視窗（例 `Ubuntu-24.04`，工作區 `/home/<u>/repo`）：
   - 檔案樹右鍵任一檔 → 選單多出「複製遠端路徑」→ 貼上得 `/home/<u>/repo/<檔>`；「Copy Absolute Path」貼上仍為 `\\wsl.localhost\Ubuntu-24.04\home\<u>\repo\<檔>`
   - Sidebar 工作區右鍵 →「複製遠端路徑」→ `/home/<u>/repo`；「複製路徑」仍為 UNC 形式
   - 開 Markdown 預覽 → 標頭 `⧉` 按鈕（hover 顯示「複製遠端路徑」）→ server 形式
   - Ctrl+P 開檔案預覽 modal → `⧉` → server 形式；從 agent 輸出的 `/home/...` 連結開預覽 → `⧉` 一樣得 `/home/...`
2. SSH / Docker 視窗：同上，得 server home / container 內路徑
3. 本機視窗：上述 4 處皆**沒有**「複製遠端路徑」，「複製路徑」行為不變

### 遭遇問題

1. 複製失敗（`no-translator`，例 WSL / Docker / SSH profile 尚未完成 auth、translator 只有 Identity）時只 `debug.log`、不寫剪貼簿，**沒有 UI 提示**（FileTree / Sidebar / MarkdownPreviewPanel 無既有 toast 掛點；FilePreviewModal 只是不顯示 `✓`）。若需失敗提示可另開單
2. legacy 遠端 profile（`targetOS` 未設 / `'local'`）也會顯示「複製遠端路徑」，Identity → 複製結果與「複製路徑」相同（同 T0437 遭遇問題 1 的前提）
3. 遠端視窗判斷在掛載後非同步完成，掛載後極短時間內開的選單可能尚未出現新項目（快取後即時）
4. FileTree 既有選單文字為寫死英文（`Copy Relative Path` 等），本單新項目用 i18n；未改既有項目（範圍外）
5. 首次用 Python heredoc 批次改 `PathLinker.tsx` 時因 `\u` 跳脫失敗（未寫入），改以 Edit 工具完成；無副作用

### 回報時間
2026-10-05T07:18:45+08:00
