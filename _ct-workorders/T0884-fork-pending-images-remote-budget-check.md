---
schema_version: 1
schema_kind: workorder
id: T0884
title: "遠端視窗 fork 後自動送出的待送圖片做面板預算檢查並提示（BUG-211 後續）"
type: implementation
status: DONE
updated_at: "2026-11-20T17:03:54+0800"
started_at: "2026-11-20T16:58:59+0800"
completed_at: "2026-11-20T17:03:54+0800"
session_ids:
  - "f352a110-6d69-479b-847b-47b43126385b"
repo: better-agent-terminal
project: ""
priority: P2
sizing: S
created_at: "2026-11-20T16:40:41+0800"
depends_on: []
related:
  - "D303；BUG-211〈修復紀錄〉末段「未涵蓋：fork 後自動送出的 pending 圖片（`onHistory` 路徑）不做面板檢查，只靠 client 守門（不斷線，但無提示）」；`src/lib/remote-image-budget.ts`（`checkRemoteImageBudget` / `remoteImageBudgetMessage` / `restoredAttachments` / `restoredInputText`）；`ClaudeAgentPanel.tsx` `onHistory` 自動送出（約 L991–L1008）、`CodexAgentPanel.tsx` 同路徑（約 L1032）；一般送出路徑 `handleSend`（Claude 約 L1544、Codex 約 L1792）"
affects_files:
  - _ct-workorders/T0884-fork-pending-images-remote-budget-check.md
  - src/components/ClaudeAgentPanel.tsx
  - src/components/CodexAgentPanel.tsx
  - src/lib/remote-image-budget.ts
  - src/lib/
  - src/components/__tests__/
  - src/lib/__tests__/
  - docs/agent-guide/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 行為規格：只在遠端視窗（判斷沿用一般送出路徑的 `isRemoteWindow`，不另寫判斷）且待送圖片超過 `checkRemoteImageBudget` 的預算時改變行為：不送出、顯示與一般送出相同的預算提示（`remoteImageBudgetMessage`）、把待送文字與圖片放回輸入框與附圖（沿用 `restoredInputText` / `restoredAttachments` 或一般送出被擋時的同一段做法），讓使用者移除圖片後自己送出；歷史照常載入。預算內、或本機 / 非遠端視窗：行為與現在逐字相同（照舊自動送出）。待送欄位（`pendingPrompt` / `pendingImages`）的清除時機不變，不得因被擋而重複自動送出。"
  - "🔴 同一規則只寫一處：Claude 與 Codex 兩個面板若都有這條路徑，判斷做成共用的純函式（放 `src/lib/`，可加在 `remote-image-budget.ts`），兩個面板都經它；一般送出路徑（`handleSend`）的既有行為與 T0834 上傳流程不改。"
  - "🔴 不改 `RemoteClient` 的 `FRAME_TOO_LARGE` 守門、`ws-limits.ts`、IPC 簽章。不新增 Settings 開關。日誌只記數量與結果（例 `[remote-image-budget] fork pending images blocked count=<n> bytes=<n>`），不記文字與圖片內容；本單不處理既有 `onHistory AUTO-SENDING` 日誌（不在範圍，回報區可列為觀察）。"
  - "驗證只用可自動化的方式：純函式單元測試（預算內 / 超過 / 非遠端 / 沒有圖片）、面板層至少一個 RTL 或等效測試證明被擋時沒有呼叫 `sendMessage` 且輸入與附圖已放回（Claude 必做；Codex 有同路徑時也做）；`npm run typecheck` = 0、`npm run test:unit` 全過、`npx vite build` 成功。不需要人工驗收。"
  - "文件：在 BUG-211 相關的 docs 段落（T0883 若已補在某個 `docs/agent-guide/` 檔，接在那段；沒有就放 `docs/agent-guide/claude-agent-sdk-cli.md` 或 `remote-file-upload.md`，自選、寫明）把「fork 後待送圖片沒有面板檢查」改成現況。不改 CLAUDE.md。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push、不觸發 workflow。不改 BUG-211 單（塔台處理）。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0884 — 遠端視窗 fork 後待送圖片的預算檢查

## 元資料
- **工單編號**：T0884｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-20 16:40 (UTC+8)
- **規模**：S｜**依賴**：無（排在 T0883 之後派工，文件接在 T0883 補的段落）｜**決策**：D303

## 背景
BUG-211 讓遠端視窗的面板在送出前檢查圖片總量（`checkRemoteImageBudget`），超過就提示、不送出；連線層另有 `FRAME_TOO_LARGE` 守門。但 fork 對話後、歷史載入完成時自動送出的待送 prompt 與圖片（`onHistory` 路徑）沒有經過面板檢查：超過上限時只被連線層擋下，連線不會斷，但使用者看不到任何提示，訊息也沒有送出。

## 任務
1. 查證 Claude / Codex 兩個面板的 fork 自動送出路徑與待送圖片的格式（是否為 data URL、怎麼算大小）。
2. 依 frontmatter 的行為規格實作共用判斷並接到兩個面板。
3. 測試、文件、驗證（見 frontmatter）。

## 驗收條件
- [ ] 兩個面板的路徑查證結果（`檔案:行`）
- [ ] 遠端＋超過預算：不送出、顯示預算提示、文字與圖片放回；預算內 / 非遠端：行為不變（以測試證明）
- [ ] 不會因被擋而重複自動送出
- [ ] `npm run typecheck` = 0、`npm run test:unit` 全過（附 passed / files 數）、`npx vite build` 成功
- [ ] docs 已更新（寫明檔案）
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **狀態**：DONE
- **完成時間**：2026-11-20T17:03:54+0800
- **session_id**：f352a110-6d69-479b-847b-47b43126385b

### 落點檢查
- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 下 → PASS；C-3：`affects_files` 抽查皆存在（資訊用）；C-2：工單無 `branch`，目前 `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（證據，不比對）；`CT_HOME` 未設（非 worktree）；`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`

### 路徑查證
| 項目 | 位置 | 結果 |
|---|---|---|
| Claude fork 存待送 | `src/components/ClaudeAgentPanel.tsx:1321` `handleForkSession` | 把輸入文字與 `attachedImages.map(img => img.dataUrl)` 存成新分頁的 `pendingPrompt` / `pendingImages`（`setTerminalPendingPrompt`，`src/stores/workspace-store.ts:477`） |
| Claude 自動送出 | `src/components/ClaudeAgentPanel.tsx:995–1031`（`onHistory`） | 修正前直接 `claude.sendMessage(sessionId, prompt, images)`，沒有預算檢查 |
| Codex fork 存待送 | `src/components/CodexAgentPanel.tsx:1389` `handleForkSession` | 同 Claude |
| Codex 自動送出 | `src/components/CodexAgentPanel.tsx:1034–1072`（`onHistory`） | 同 Claude（多 `isRemoteConnectedRef` 判斷是否先顯示 user 訊息、`scrollToBottomAfterRender`） |
| 待送圖片格式 | `src/types/index.ts:56` `pendingImages?: string[]` | base64 data URL；大小以既有 `dataUrlDecodedBytes` / `checkRemoteImageBudget` 計算（解碼後位元組） |
| 一般送出檢查 | Claude `handleSend`（`:1406`，檢查約 `:1558`）、Codex `handleSend`（`:1507`，檢查約 `:1808`） | 未改 |

### 實作摘要
- 共用純函式（只寫一處）：`planForkPendingSend(pendingImages, isRemoteWindow)`（`src/lib/remote-image-budget.ts`）→ `send` / `restore`（`exceeded` 與要放回的附件，key `fork-pending:<n>`）；`forkPendingBlockedLog` 產生日誌行 `[remote-image-budget] fork pending images blocked count=<n> bytes=<n>`（只有數量與位元組）。判斷本身就是 `checkRemoteImageBudget`。
- 兩個面板的 `onHistory`：`pendingPromptSentRef = true` 與 `setTerminalPendingPrompt(sessionId, '')` 照舊在判斷**之前**（清除時機不變）；`restore` → 記日誌、`setMessages(historyItems)`（Codex 另 `scrollToBottomAfterRender()`，與「沒有待送」分支相同）、`addNoticeToast(remoteImageBudgetMessage(…), 'warning', 10000)`（與 `handleSend` 相同參數）、`setInputValue(restoredInputText(prompt, 目前輸入))`、`setAttachedImages(prev => restoredAttachments(附件, prev, MAX_IMAGES))`，不 `setIsStreaming`、不送出；`send` → 原程式逐字不變。
- 遠端判斷沿用 `useIsRemoteWindow()` 的同一個值：`onHistory` listener 只在 `sessionId` 變動時註冊（closure 會停在初始的 `false`），所以面板以 `forkBudgetRef`（每次 render 更新 `{ isRemoteWindow, t }`）讀最新值；沒有另寫判斷。`t` 一併放進 ref，因為 listener 內的 `t` 被區域變數（terminal）遮蔽，且語言切換後才不會用到舊的翻譯函式。
- 一般送出路徑（`handleSend`）、T0834 上傳流程、`RemoteClient` `FRAME_TOO_LARGE`、`ws-limits.ts`、IPC 簽章、Settings 都沒改。

### 修改檔案
- `src/lib/remote-image-budget.ts`：`ForkPendingSendPlan` / `planForkPendingSend` / `forkPendingBlockedLog`
- `src/components/ClaudeAgentPanel.tsx`、`src/components/CodexAgentPanel.tsx`：import、`forkBudgetRef`、`onHistory` 的 `restore` 分支
- `src/lib/__tests__/remote-image-budget.test.ts`：新增 1 個測試（預算內剛好 20 MiB / 本機 / `undefined` / 空陣列 → `send`；遠端超過 → `restore`、提示文字數字、日誌行）
- `src/components/__tests__/fork-pending-images-budget.test.tsx`（新）：Claude 與 Codex 各 4 個 RTL 測試——遠端超過（沒有呼叫 `sendMessage`、toast 文字、輸入框文字與 3 張附圖的 `src` 放回、歷史顯示、沒有執行中、待送欄位已清、日誌行且沒有 `AUTO-SENDING`、第二次 `onHistory` 仍不送）；遠端預算內、本機超過、只有文字 → 照舊自動送出（參數相同）
- `docs/agent-guide/remote-security.md`：「WebSocket frame 上限與 `FRAME_TOO_LARGE`」節的「已知缺口」改成現況（fork 自動送出的規則＋已知限制），驗證清單加兩個測試檔。選這個檔的原因：T0883 把 BUG-211 的段落補在這裡（commit `ece924e5`）。CLAUDE.md 未改。

### 驗證
| 關卡 | 結果 | 證據 |
|---|---|---|
| 新測試能抓到回歸 | PASS | 暫時讓 `planForkPendingSend` 一律回 `send` → 兩個面板的「遠端超過」測試 FAIL（2 failed / 6 passed），還原後全過 |
| `npm run typecheck` | PASS | exit 0（0 錯誤） |
| `npm run test:unit` | PASS | `Test Files 461 passed | 3 skipped (464)`、`Tests 8414 passed | 42 skipped (8456)`，exit 0 |
| `npx vite build` | PASS | exit 0（`✓ built`） |
| 人工驗收 | 不需要 | 工單規定只用可自動化驗證 |

### Commit
- 產品：`cf0b0809` `fix(remote): budget-check fork's pending images before auto-send (T0884)`（6 檔，`git add` 明確路徑）；驗證時的 HEAD 為 `410e83dc`＋上述工作樹變更，commit 內容與驗證時相同
- 工單：本檔另一個 commit（見 git log）
- 未 push、未觸發 workflow、未改 BUG-211 單

### 遭遇問題
- 無阻擋。觀察：`onHistory` listener 以 `[sessionId]` 註冊，直接讀 `isRemoteWindow` 會拿到初始的 `false`，所以用 ref（見實作摘要）。

### 已知限制
- 遠端判斷（兩個 IPC）完成前就載入歷史時，待送圖片照舊送出、由 client 端 `FRAME_TOO_LARGE` 擋下（與 `handleSend` 在判斷完成前送出相同，非回歸）。fork 由同一視窗的面板發起，判斷已快取，實務上不會發生。已寫進 docs。

### 觀察（不在範圍）
- 既有的 `onHistory AUTO-SENDING pending prompt: "<prompt>"` 與 `handleForkSession` 的 `prompt="…"` / `pendingPrompt="…"` debug log 會記下 prompt 全文；本單依規定未處理，新增的 `restore` 路徑不記文字。

### 後續建議
- 若要處理上一點的 prompt 全文日誌，可另開工單（只改成記長度）。

### 互動紀錄
- [16:58] 開工，yolo，無提問。
- 三個節點的塔台補充檢查皆無新段落。
