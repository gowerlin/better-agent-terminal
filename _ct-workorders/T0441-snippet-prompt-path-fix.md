---
schema_version: 1
schema_kind: workorder
id: T0441
title: "BUG-109：/snippet 情境 prompt 不再寫死 macOS snippets.json 路徑；改用實際儲存位置 / IPC，遠端視窗停用或改注入清單"
type: fix
status: IN_PROGRESS
repo: better-agent-terminal
project: BUG-109
priority: P3
sizing: S
created_at: "2026-10-05T05:51:45+08:00"
started_at: "2026-10-05T06:57:18+08:00"
updated_at: "2026-10-05T06:57:18+08:00"
completed_at: null
target_version: next
depends_on:
  - T0436
related:
  - "BUG-109；T0421「遭遇問題」1；T0422（snippet:* 改 ALWAYS_LOCAL）"
  - "D134 追加（T0421 其他項目，使用者 05:51 裁決開 BUG）"
affects_files:
  - src/components/ClaudeAgentPanel.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先確認現況**：snippet 實際儲存（better-sqlite3 DB？是否仍有 `snippets.json`？路徑如何取得——`settings:get-logging-info` 類的 userData 路徑來源）。以證據決定修法：(a) prompt 改帶正確的本機路徑（僅本機視窗）、(b) prompt 注入 snippet 清單並請 agent 回傳變更、由 BAT 經 `snippet:*` IPC 套用，或 (c) 遠端視窗停用該流程並提示。偏好不讓 agent 直接改 DB / 檔案。回報區說明選擇理由。"
  - "🔴 依賴 T0436（同改 `ClaudeAgentPanel.tsx`）。開工前 `git log --oneline -5` 確認；i18n 檔 commit 前 `git diff <file>` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0441 — /snippet prompt 路徑（BUG-109）

## 範圍

1. 現況確認（memory_overrides 第 1 條）
2. 修 prompt / 流程；遠端視窗的行為明確
3. 測試鎖住：prompt 不含 `~/Library` 字樣；遠端視窗行為

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] BUG-109 改 `FIXED`

## Sub-session 執行指示
1. 讀本工單 + BUG-109 + T0422 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 現況 → 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + BUG-109；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（product commit 見下方「Commit」）

Landing Zone：**PASS** —— C-0 `repo: better-agent-terminal` == `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS（工單在 REPO_ROOT 下）；C-3 present（`src/components/ClaudeAgentPanel.tsx` 等皆存在）；無 `branch` 欄（C-2 N/A）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo` / `CT_INTERACTIVE=0`。
依賴確認：`git log --oneline -5` 有 T0436 `6c26edc`（`ec131bb` 派發本單）；開工時 `ClaudeAgentPanel.tsx` 無他人未提交改動。

### 現況確認結論（memory_overrides 第 1 條）

- snippet **不在** better-sqlite3：`electron/snippet-db.ts` 為記憶體 store，持久化到 `app.getPath('userData')/snippets.json`（Windows 為 `%APPDATA%\BetterAgentTerminal\snippets.json`，與 prompt 寫死的 macOS 路徑不同）。
- `SnippetDatabase` **只在建構時 `load()` 一次，無 watch / reload**；之後所有 `snippet:*` 操作都從記憶體 `save()` 覆寫檔案 ⇒ agent 直接改 JSON，BAT UI 看不到（直到重啟），且下一次任何 BAT 端 snippet 操作會把 agent 的改動覆蓋掉。**本機 macOS 也是壞的**。
- `snippet:*` 自 T0422 為 ALWAYS_LOCAL：遠端視窗的 renderer 取到的是本機 snippet，但 agent 跑在遠端主機，任何路徑都無意義。
- 沒有既有 IPC 回傳 userData 路徑給 renderer；也沒有 agent → BAT 的工具 / MCP 機制可「回傳變更由 BAT 套用」。

**選擇**：(b) 的唯讀變體。
- (a) 帶正確本機路徑：否決——上述 no-reload 使「agent 改檔」本身就不成立，且需新增 IPC（超出 affects_files）。
- (b) 完整版（agent 回傳結構化變更、BAT 解析後經 `snippet:*` 套用）：需新增訊息解析 + 「套用」UI + 確認流程，超出 S 規模；列為後續選項。
- (c) 遠端停用：不需要——清單在本機 renderer 取得後以文字注入，遠端 agent 照樣可用。
- 實作：prompt 注入 snippet 清單**含內容與 metadata**，**不含任何路徑**，明示 agent 不得尋找 / 讀寫 snippet 檔案或 DB；建立 / 修改 / 刪除由 agent 給出精確變更，使用者在 BAT Snippets 面板套用。符合「不讓 agent 直接改 DB / 檔案」。

### 產出摘要

- `src/lib/snippet-context.ts`（新）：`buildSnippetContextPrompt({ snippets, query, workspaceId })`。每筆 `- [id] title (format, workspace|global, favorite, category, tags)` + 內容 code fence（fence 長度大於內容中最長的 backtick 串）；單筆內容上限 `SNIPPET_CONTENT_MAX_CHARS = 2000`（超出標註 `truncated`），全體內容預算 `SNIPPET_CONTEXT_MAX_CONTENT_CHARS = 20000`（超出者僅列標題並註明省略數）。
- `src/components/ClaudeAgentPanel.tsx`：`/snippet` 改呼叫 helper，移除寫死路徑與「Use Write/Edit tool … JSON file」指示。其餘流程（本機 `snippet.search` / `getByWorkspace`、user message 顯示、`claude.sendMessage`、錯誤處理）不變。
- `src/components/CodexAgentPanel.tsx`：同段重複碼同步改呼叫 helper（見「偏離」）。
- 測試：
  - `src/lib/__tests__/snippet-context.test.ts`（新，4 tests）：無 `~/Library` / `Application Support` / `snippets.json` / `AppData` / `Write/Edit tool`；含內容與 metadata；query 變體；fence 防衝突；截斷與總預算。
  - `src/__tests__/snippet-prompt-no-path.test.tsx`（新，5 tests）：`ClaudeAgentPanel` 在**本機視窗**與**遠端 profile 視窗**（`isRemoteConnected`）下，`/snippet deploy` → 本機 `snippet.search('deploy')`、`/snippet` → `snippet.getByWorkspace('ws-1')`，送出的 prompt 含 snippet 內容且不含路徑；兩個 panel 原始碼不含 `~/Library/Application Support` / `snippets.json`。
- `BUG-109` → `FIXED`（frontmatter + 表格 + 修復段）。
- i18n：**未改**。prompt 是給 agent 的英文 context（原本即非 i18n），遠端視窗不需停用提示，故 `en` / `zh-TW` / `zh-CN` 無需新增 key。

### 驗收

| 閘門 | 結果 | 證據 |
|---|---|---|
| 現況確認 | PASS | 見上節 |
| 新測試 | PASS | 2 files、9 tests 全綠 |
| `npx vitest run src`（本單範圍） | PASS | 67 files、922 tests 全綠 |
| `npm run test:unit`（全量） | **未全綠（外部 WIP，非本單）** | 153 files：126 passed / 27 failed；2104 tests：2092 passed / 3 failed / 9 skipped。失敗**全部**在 `electron/` 與 `scripts/`，無一在 `src/`、無一 import 本單檔案：25 個 suite 為 `electron/remote/remote-server.ts:129:53: ERROR: Unterminated regular expression`（他人未提交的 `remote-server.ts` 改動，`LOG_UNSAFE_CHARS` 正規式內含行分隔字元）造成的 transform 失敗，連帶 `headless-electron-free` 1 test；`scripts/__tests__/dev-deploy-headless.test.mjs` 2 tests 對應他人未提交的 `scripts/dev-deploy-headless.mjs`（T0434 範圍）。連跑兩次結果相同。依 L138 不得 stash，故無法在乾淨樹上重跑全量；建議塔台在該 WIP 提交後聯合驗證 |
| `npx tsc --noEmit` | PASS | 36 errors（≤ 39）；本單新增 / 改動處 0 個（`CodexAgentPanel.tsx` 既有錯誤皆在其他行） |
| vite build / e2e | 未跑 | 依 memory_overrides 第 3 條刻意不跑 |
| 實機（本機 / 遠端視窗打 `/snippet`） | 未做 | 需新 build，交使用者實機 |

### 偏離

- **`CodexAgentPanel.tsx` 不在 affects_files，但一併修改**：同一段 `/snippet` 程式碼（含寫死路徑）在 Codex panel 有一份複本。該分支受 `!isCodexSession` 守衛而 `isCodexSession = true` 為常數，**實為 dead code**，不影響行為；改為呼叫同一 helper 以免留下錯誤路徑字串（亦讓「原始碼不含 `~/Library`」測試能涵蓋兩個 panel）。diff 僅 import 1 行 + 該分支 prompt 組裝。
- 新增 `src/lib/snippet-context.ts` 與 `src/lib/__tests__/` 測試（affects_files 列 `src/__tests__/`）：比照既有 `src/lib/*` helper + `src/lib/__tests__` 慣例。

### 遭遇問題

- 第一次用 Python 腳本批次替換字串時找不到 substring（未落地任何改動），改用 Edit 工具完成。
- panel 測試首次以 `fireEvent.change` 驅動輸入失敗：textarea 綁的是 `onInput`（非受控）；且 `/snippet` 無空白時會開 slash menu，Enter 被選單吃掉。改為設 `value` + `fireEvent.input`，無 query 情境輸入 `'/snippet '`（trim 後同為 `/snippet`）。
- 工作樹有其他 Worker 的未提交改動（`electron/remote/remote-server.ts`、`scripts/*`、`CLAUDE.md`、其他工單、`_tower-state.md`、`headless-remote-tower-e2e.test.ts`），皆未觸碰；以 `git commit --only` 精準提交。

### 殘留風險 / 後續

- agent 不再能自行建立 / 修改 snippet（舊流程本來就因 no-reload 而無效）。若要「agent 提案 → 使用者一鍵套用」，可另開單做 (b) 完整版：約定 fenced `bat-snippet-ops` JSON 區塊 + 面板「套用」按鈕 + 確認，經 `snippet:create/update/delete` IPC 落地。
- 大量 snippet 時 prompt 有內容預算（20000 字），超出者僅列標題。
- 遠端視窗會把本機 snippet 內容送到遠端 agent（使用者主動打 `/snippet` 才會）；與本機 session 送給 API 的資料相同，不另視為洩漏。

### Commit

（commit 後補）

### 回報時間

2026-10-05T07:02:07+08:00
