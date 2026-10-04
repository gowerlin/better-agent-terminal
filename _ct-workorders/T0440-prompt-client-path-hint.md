---
schema_version: 1
schema_kind: workorder
id: T0440
title: "遠端視窗 Claude prompt 送出前偵測 client 形式路徑樣式 → 非阻斷提示（不改內容、可關閉）"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-105
priority: P3
sizing: S
created_at: "2026-10-05T05:51:45+08:00"
started_at: "2026-10-05T07:29:20+08:00"
updated_at: "2026-10-05T07:33:51+08:00"
completed_at: "2026-10-05T07:33:51+08:00"
target_version: next
depends_on:
  - T0439
related:
  - "T0421 研究策略 C / 拆單第 6 列（選做；使用者 05:51 裁決納入）"
  - "D134 追加（T0421 拆單）"
affects_files:
  - src/components/ClaudeAgentPanel.tsx
  - src/lib/
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
  - "🔴 **絕不改寫使用者內容**，只提示。提示為非阻斷（送出照常），附「不再提示」開關（沿用既有設定機制，不新造 store）。只在遠端 profile 視窗啟用。"
  - "🔴 偵測規則抽成純函式（`src/lib/` 下）並單測：`C:\\…`、`\\\\wsl.localhost\\…`、`\\\\wsl$\\…`；避免誤報：程式碼區塊（```…```）內、行內 code、URL 不提示。若可用，顯示 T0437 解析出的 server 形式作為建議（只顯示，不替換）。"
  - "🔴 同工作樹有其他 Worker 平行。共用檔 commit 前 `git diff <file>` 確認只含本單 hunk。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0440 — prompt 內 client 路徑提示

## 範圍

1. 偵測純函式 + 單測（含誤報案例）
2. Claude 面板送出時於遠端視窗檢查並顯示非阻斷提示；可關閉
3. i18n 三語

## 驗收條件

- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39（2591 passed、tsc 36）
- [x] 回報區附實機步驟

## Sub-session 執行指示
1. 讀本工單 + T0421 回報區（策略 C）+ T0437 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（開始 2026-10-05T07:29:20+08:00，Worker，`CT_MODE=yolo`、`CT_INTERACTIVE=0`）

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 PASS（`src/components/ClaudeAgentPanel.tsx` 等皆存在）；C-2 不適用（無 `branch`，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 依賴 T0439 已在 HEAD（`ea35f19`）；沿用 T0437 `remote:resolve-client-paths` 與 T0438 `useIsRemoteWindow`
- 驗收：
  - [x] `npm run test:unit`：**161 files / 2591 passed / 1 skipped，0 failed**（stderr 的 `conpty_console_list_agent.js AttachConsole failed` 為 node-pty 既有雜訊，不影響結果）
  - [x] `npx tsc --noEmit`：**36**（≤ 39）；全為既有錯誤（`CodexAgentPanel.tsx` 型別債、`terminal-keyboard-event.test.ts`、`agent-profiles.ts:76`、`integration.transitions.test.ts:52`），本單檔案 0 錯
  - [x] 回報區附實機步驟（下方；**未實機**，待使用者以新 build 驗證）
  - 未跑 `npx vite build` / `npm run test:e2e`（L141）；未用 stash / reset / checkout / restore；`git commit --only`；未 push；未部署

### 產出摘要

**行為**

- 遠端 profile 視窗（`useIsRemoteWindow`，T0438；WSL / Docker / SSH / legacy remote）的 Claude 面板一般送出時，對使用者**手打 / 貼上的文字**（不含附件 `@` 前綴）做偵測；**prompt 一律原文送出**（測試斷言 `sendMessage` 收到的字串與輸入完全相同）
- 偵測到時，輸入框下方顯示一行非阻斷提示（沿用 `.claude-cli-warning` 色調）：「已照原文送出。以下看起來是本機路徑，agent 在遠端主機執行，可能讀不到：」+ 最多 3 筆路徑（超過顯示 `…(+N)`）；`remote:resolve-client-paths`（`purpose: 'local-file'`）回可達且與原字串不同時附「遠端路徑：`/mnt/c/…`」（**只顯示，不替換**）。SSH 本機檔、他 distro UNC → 無建議，只列路徑
- 查詢不阻塞送出（送出後非同步補上提示）；IPC 失敗只失去建議、提示照常；連續送出時以序號丟棄過期結果；下一次一般送出會先清掉舊提示
- 「不再提示」→ `settingsStore.setPromptClientPathHint(false)`（沿用既有 settings store / 持久化，未新造 store）；`×` 只關閉本次。Settings 面板（Claude 區，「預設折疊所有工具輸出」下方）新增同名 checkbox 可重新開啟
- 本機視窗 / 未綁定視窗：不偵測、不查詢、不顯示；`/snippet`、`/resume` 等攔截指令不經此路徑

**偵測規則**（`src/lib/prompt-client-paths.ts`，純函式 `findClientPathsInPrompt`）

- 命中：`X:\…`（大小寫 drive）、`\\wsl.localhost\…`、`\\wsl$\…`（不分大小寫）；`"…"` / `'…'` 引號內保留空白（`"C:\Program Files\x y\z.txt"`）；結尾句讀 `.,;:!)]}` 去除；遇空白、引號、`<>|*?`、中文全形標點即結束；依出現順序去重
- 不提示：``` / ~~~ 程式碼區塊（含未關閉的 fence）、行內 code（單 / 多重 backtick）、URL（`scheme://…`，含 `file:///C:\…`）、drive 字母接在英數 / `\` / `/` 之後（`abc:\`、`foo\C:\`、regex `\d:\\`）、`[A-Za-z]:\\` 字元類、`C:/…` 斜線形式、server 路徑、一般 `\\server\share` UNC（不在工單樣式內）
- `pairPathSuggestions` 以 `input` 逐一配對答案，不符 / 不可達 / 與原字串相同（Identity）→ 無建議

**檔案**

- `src/lib/prompt-client-paths.ts`（新）：`findClientPathsInPrompt` / `stripNonProse` / `pairPathSuggestions` / `resolvePromptPathSuggestions`
- `src/components/ClaudeAgentPanel.tsx`：`handleSend` 送出前偵測 + 提示 UI + 「不再提示」
- `src/locales/{en,zh-TW,zh-CN}.json`：`claude.promptClientPathHint*`（4 鍵）+ `settings.promptClientPathHint` / `promptClientPathHintHint`
- **超出 affects_files（最小必要）**：`src/types/index.ts`（`AppSettings.promptClientPathHint?: boolean`，未設 = 開）、`src/stores/settings-store.ts`（`setPromptClientPathHint`，同既有 setter 樣式）、`src/components/SettingsPanel.tsx`（重新開啟的 checkbox；否則「不再提示」後無 UI 可回復）、`src/styles/claude-agent.css`（`.claude-path-hint*` 版面）
- 測試 `src/__tests__/prompt-client-path-hint.test.tsx`（39）：偵測命中 14 例、誤報 15 例 + 混合 1 例、`pairPathSuggestions`、面板 7 例（遠端：原文送出 + 提示含遠端形式 / 不可達無建議；不再提示→設定 false 且後續不查詢不提示；× 關閉；只在 code 內不查詢；IPC 失敗仍提示；local profile 視窗與未綁定視窗不提示）、`resolvePromptPathSuggestions` purpose

**實機步驟（待使用者以新 build 驗證）**

1. WSL 視窗（例 `Ubuntu-24.04`）開 Claude 面板，送出 `請讀 C:\Users\<u>\Documents\a.txt` → agent 收到的 prompt 為原文；輸入框下方出現提示，列出 `C:\Users\<u>\Documents\a.txt — 遠端路徑：/mnt/c/Users/<u>/Documents/a.txt`
2. 同視窗送出 `` 看 `C:\x` `` 與 ```` ``` ```` 程式碼區塊內含 `C:\…`、或 `https://…` → 無提示
3. 送出 `\\wsl.localhost\<其他 distro>\…` → 提示只列路徑、無遠端路徑
4. 按「不再提示」→ 提示消失；再送含 `C:\…` 的 prompt → 無提示；Settings → Claude 區「遠端視窗的 Claude prompt 含本機路徑時提示」為未勾選，勾回後恢復
5. SSH 視窗：送 `C:\…` → 提示只列路徑（SSH 本機檔不可達）
6. 本機視窗：送 `C:\…` → 無提示

### 遭遇問題

1. **超出 affects_files 4 檔**（見「檔案」）：設定欄位 / setter 為「沿用既有設定機制」的必要落點；SettingsPanel checkbox 為「不再提示」的回復入口；CSS 為提示列版面。皆為新增，不改既有行為
2. 提示改為**送出後**顯示在輸入框下方（而非送出前攔下）：工單要求非阻斷、送出照常，送出後顯示可同時讓使用者知道「已照原文送出」；代價是提示出現時輸入框已清空（原文仍在訊息列 / 輸入歷史）
3. 只做 Claude 面板（工單範圍）；Codex 面板未加。一般 `\\server\share` UNC 與 `C:/…` 斜線形式不提示（工單樣式外，避免誤報擴大）；若要涵蓋需塔台決定
4. JSON 中 escaped 字串（例 `"C:\\Users"`）若不在 code 內仍會被提示（只提示不改寫，影響僅為一行提示）
5. 同工作樹他單的 dirty 檔（`T0427` / `T0436` 工單、`_tower-state.md`）未觸碰、未納入 commit

### 回報時間
2026-10-05T07:33:51+08:00
