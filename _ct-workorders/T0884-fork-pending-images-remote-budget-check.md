---
schema_version: 1
schema_kind: workorder
id: T0884
title: "遠端視窗 fork 後自動送出的待送圖片做面板預算檢查並提示（BUG-211 後續）"
type: implementation
status: PENDING
updated_at: "2026-11-20T16:40:41+0800"
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
- **工單編號**：T0884｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-20 16:40 (UTC+8)
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
