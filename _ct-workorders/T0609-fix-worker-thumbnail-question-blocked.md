---
schema_version: 1
schema_kind: workorder
id: T0609
title: "BUG-153：Worker 分頁縮圖區分「等使用者（blocked）」「等塔台答覆（提問）」「已回報」，提問 / blocked 不計入批次關閉"
type: bugfix
status: DONE
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: M
created_at: "2026-10-18T05:11:26+0800"
started_at: "2026-10-18T05:12:17+0800"
updated_at: "2026-10-18T05:30:34+0800"
completed_at: "2026-10-18T05:30:34+0800"
depends_on: [T0607]
related:
  - "BUG-153（BMad-Guide T0166 實機發現、建議四態表）；T0607（主行程 `blocked` / `tower` / `pendingQuestions`，已在 main `00bdcaeb`）；T0538（`findReportingWorkers`、`.worker-batch-close-dialog`）；T0590（hook `blocked`）"
  - "並行工單 T0608（隔離 worktree，只改 `scripts/bat-notify.mjs` / `bat-terminal.mjs` / `bat-mcp.mjs` / `scripts/__tests__/**` / `docs/agent-guide/bat-mcp-shim.md`）"
affects_files:
  - src/stores/workspace-store.ts
  - "src/components/TerminalThumbnail.tsx（與其樣式檔）"
  - "src/locales/*.json（tooltip 文字）"
  - "src/types/index.ts（只在需要新欄位型別時）"
  - "electron/terminal-blocked-state.ts、electron/tower-questions.ts、electron/terminal-query-handlers.ts（只在需要對外發出狀態變更事件時）"
  - "electron/main.ts、electron/preload.ts、electron/remote/headless-entry.ts、electron/remote/**（主行程 → renderer 的狀態推送；本機與遠端視窗對等）"
  - "src/**/__tests__/**、electron/__tests__/**、electron/remote/__tests__/**"
  - "CLAUDE.md（只改「Worker 分頁回收」節一句）、docs/agent-guide/worker-tab-recycle.md"
  - _ct-workorders/T0609-fix-worker-thumbnail-question-blocked.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 並行：T0608 在隔離 worktree 改 `scripts/**` 與 `docs/agent-guide/bat-mcp-shim.md`；本單不得改這些檔。CLAUDE.md 只改「Worker 分頁回收」節，不改「Worker 問塔台」「BAT MCP shim」節。"
  - "🔴 不改主行程既有契約（T0590 / T0600 / T0607 的 channel 參數與回傳）；需要的是**新增**對 renderer 的狀態推送（或沿用既有事件），不得改 helper / MCP 看到的回傳。推送內容只含狀態欄位（state / blockedReason / blockedSince / pendingQuestions 等），**不得含問題 / 答案內容**（D155）。"
  - "🔴 renderer 不得輪詢 helper channel；不得用 `window.confirm`（`.worker-batch-close-dialog` 維持頁內確認，T0538）；Dialog / Esc 規則照 CLAUDE.md。日誌用 `window.electronAPI.debug.log` / `logger`。"
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；含反斜線的內容用 Write / Edit 工具（L129）；寫檔保持 LF（T0607 曾因 CRLF 打壞 source guard）；commit 一律 `git commit --only <檔案…>`。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）；e2e 用隔離實例（先 `npx vite build`）。不得對 claude / codex 送出任何 prompt。"
---

# T0609 — BUG-153：Worker 縮圖的提問 / blocked 標示

## 背景

見 BUG-153。現況：任何 `bat-notify --source T####` 都經 `markWorkerReported` 寫 `workerReport`，縮圖顯示 `✓`，並被 `findReportingWorkers` 算進「關閉已回報的 Worker 分頁（N）」——Worker 送 `T#### 提問` 等塔台答覆時也一樣。hook `blocked` 時縮圖沒有標示。

使用者已同意（2026-10-18）：縮圖**優先用主行程的結構化狀態**（T0607 的 `blocked` / `blockedReason` / `pendingQuestions`），訊息結尾 `提問` 只作為舊 CT（工單檔往返、未用 `--ask`）的後備判斷。

## 規格

| 狀況 | 判斷來源 | 縮圖標示 | tooltip | 計入批次關閉 |
|---|---|---|---|---|
| 執行中 | — | 無 | — | 否 |
| 等使用者 | 主行程 `state: blocked` 且 `blockedReason` ∈ `permission` / `question` / `elicitation` | ⚠️（可依 reason 細分） | 原因 + 起始時間 | 否 |
| 等塔台答覆 | 主行程 `blockedReason: tower` 或 `pendingQuestions > 0`；後備：最近一次通知訊息以 `提問` 結尾 | `?` | 「已向塔台提問 HH:MM」 | 否 |
| 已回報 | 其他通知（完成 / BLOCKED / 需要協助等），現行 `markWorkerReported` | `✓` | 現行 | 是 |

- 同時成立：等使用者 > 等塔台答覆 > 已回報。
- 清除：等使用者依主行程既有清除規則；等塔台答覆在主行程問題結束（答覆 / 取消 / 過期 / lost）時清除，後備判斷則在 Worker 下一次通知時換成對應標示。
- 塔台不必知道答覆何時送達：Worker 答覆後再通知（例 `T#### 完成`）即轉 `✓`。

## 任務

1. 主行程 → renderer 的狀態推送：查現況（renderer 目前是否收得到 `blocked`；`terminal:role-changed` 等既有推送模式），選一種本機與遠端視窗（RemoteClient proxied）都成立的做法，事件驅動、不輪詢。推送只含狀態欄位。
2. renderer：`workspace-store` 保存每個終端的注意狀態；`markWorkerReported` 依訊息結尾 `提問` 記為「提問中」而非 `workerReport`（後備）；`findReportingWorkers` 排除提問中與 blocked；`TerminalThumbnail` 依上表顯示圖示與 tooltip（i18n 補 `en` / `zh-TW` / `zh-CN` 等現有語系）。
3. 測試：store（優先序、清除、後備字串判斷、批次關閉排除）、縮圖渲染、推送事件（本機 + proxied）、`.worker-batch-close-dialog` 既有 source guard 不壞；e2e 新檔（隔離實例：以 helper env 的 node 腳本扮演 Worker 送 `--source T#### "T#### 提問"` → 縮圖 `?`、不計入批次關閉；送完成通知 → `✓`；可選：以 `bat-hook.mjs` 觸發 `ask-user-question` → ⚠️）。T0608 尚未合併，`--ask` 流程不在本單 e2e（由收尾單補）。
4. 文件：CLAUDE.md「Worker 分頁回收」節補一句（提問 / blocked 不計入批次關閉、判斷唯一實作位置）；`docs/agent-guide/worker-tab-recycle.md` 同步。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠（回報 passed / files 數）；新 e2e 通過。
2. 回報區附：推送方式與理由、三種標示的截圖或 DOM 斷言摘錄、遠端視窗行為說明、變更檔案清單。

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

**FIXED**（產品 commit `fbf641dc`；驗收條件 1、2 皆達成，等待使用者實機驗收 BUG-153）

### Landing check

- C-0：PASS（frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；`CT_HOME` 未設定，非 worktree）
- C-1：PASS（工單在 `REPO_ROOT/_ct-workorders/`）
- C-3：PASS（`src/stores/workspace-store.ts` 等存在）；C-2：工單無 `branch` 欄位，main
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 產出摘要

**推送方式與理由**：新增事件 `terminal:attention-changed`（主行程 → renderer），沿用 T0566 `terminal:usage-limit-status` 的模式（事件 + renderer 記憶體 store + `useSyncExternalStore`）。
- 現況：renderer 原本收不到 `blocked`（只有 helper / MCP 的 `terminal:get-state` 查得到）；`terminal:role-changed` / `usage-limit-status` 是既有的主行程推送範本。
- 唯一實作 `TerminalAttentionNotifier`（`electron/terminal-attention.ts`，不 import electron，本機與 headless 共用）。觸發點全是事件：`TerminalBlockedTracker` 新增 `onChange`（經 `PtyManagerDeps.onBlockedChange`；hook 進入 / 清除、使用者輸入、PTY 結束、recovery）與 `TowerQuestionDeps.onChange`（ask / answer / cancel / 過期 / PTY 結束 / recovery）。同一 microtask 合併、只在狀態改變時送出。
- 問題過期原本「每次存取才判斷」：有 `onChange` 時 store 另開一個計時器到下一個 `expiresAt` / 租約到期，無人查詢也會送出（沒有 `onChange` 的既有呼叫端行為不變）。
- payload `{ id, blockedReason?, blockedSince?, pendingQuestions, questionsSince? }`，優先序同 `stateOf`（hook > tower）；**只含狀態欄位**，測試斷言不含問題 / 選項 / detail / 答案 / tool name（D155）。helper / MCP 回傳與 channel 參數完全未改（`QuestionSummary` 只新增選用欄位 `pendingSince`，`stateOf` 不使用）。
- 日誌 `[attention] terminal=<id> → blocked reason=… pendingQuestions=n windows=n | none`。

**遠端視窗行為**：Electron 用 `terminalEmit`（所有視窗 + broadcastHub）；headless 在 `createHeadlessTerminalQueryModule` 建立同一 notifier，`host.emit` → `PROXIED_EVENTS`（已加入 `terminal:attention-changed`，`path-aware-channels` 歸類為 path-free）→ RemoteClient → 該 profile 的視窗。`headless-attention-e2e.test.ts` 以真 headless + 真 node-pty、Worker PTY 內自己的權杖驗證 client 依序收到 `tower → question → tower → none`。

**renderer**：
- `src/lib/terminal-attention.ts`：`workerAttention`（判斷唯一實作，優先序 等使用者 > 等塔台答覆 > 已回報）、`isQuestionNotifyMessage`（訊息結尾 `提問`）。
- `src/stores/terminal-attention-store.ts`：記憶體 store；`App.tsx` 訂閱（每個視窗都存、`pty:exit` 清除）。
- `markWorkerReported`：結尾 `提問` → `TerminalInstance.workerQuestion = { message, askedAt }` 並移除 `workerReport`；下一則其他通知反之。`workerQuestion` 與 `workerReport` 一樣持久化 / load / detached adopt。
- `reportedWorkersOfTower` 只算 `workerAttention` = `reported`；`ThumbnailBar` 訂閱 version 重算 N；`WorkspaceView` 批次確認框的清單與確認時都重新過濾（開框後才開始等待的 Worker 會從清單消失、不被關閉；`.worker-batch-close-dialog` / `closeTerminalNow(id, { cleanWorktree: false })` 不變，無 `window.confirm`）。
- `TerminalThumbnail`：⚠️（class `blocked`、`data-blocked-reason`）/ `?`（class `question`）/ `✓`（`reported`），皆帶 `data-attention`；tooltip i18n（en / zh-TW / zh-CN）：`workerTabs.blockedTooltip.{permission,question,elicitation}`（含起始時間）、`questionTooltip`「已向塔台提問 HH:MM，等待塔台答覆」、`questionPendingTooltip`（> 1 題）。只對 Worker 分頁顯示。

**三種標示的 DOM 斷言摘錄**（e2e `e2e/t0609-worker-attention-badge.spec.ts`，隔離實例）：
- `T0612 提問` → `.worker-badge` text `?`、class `question`、`data-attention="question"`、title 含 `HH:MM`；N 仍為 (1)；registry 存 `workerQuestion.message = "T0612 提問"`、無 `workerReport`
- `bat-hook.mjs ask-user-question`（Worker PTY 內）→ text `⚠️`、class `blocked`、`data-blocked-reason="question"`；N = (0)；hook `stop` → `✓`、N = (1)
- `T0612 完成` → `✓`、N = (2)；批次確認框列出 `T0611`、`T0612`，確認後兩者關閉
- debug 日誌：`[T0609] Worker asked its Tower: …`、`[attention] terminal=<w1> → blocked reason=question pendingQuestions=0`、`[attention] terminal=<w1> → none`
- 截圖（本機 `e2e-results/`，gitignore）：`question-badge.png`、`blocked-and-question-badges.png`（T0611 ⚠️、T0612 `?` 已目視確認）、`batch-close-confirm.png`

**驗證**（於 base `a121e7e5` + 本次變更、內容即 `fbf641dc` 時執行）：
- `npx vite build`：PASS（exit 0）
- `npm run typecheck` = 0；`npm run typecheck:electron` = 0
- `npm run test:unit`：PASS — **299 files passed，5192 passed / 3 skipped**
- 新增 unit：`workspace-store.workerAttention.test.ts`（13）、`worker-tab-attention.test.tsx`（7，含批次 source guard）、`electron/__tests__/terminal-attention.test.ts`（14，含 main / headless 接線 source guard）、`headless-attention-e2e.test.ts`（4）
- 既有 `worker-tab-marker.test.tsx`（`.worker-batch-close-dialog` source guard）、`workspace-store.workerReport.test.ts`、`tower-questions.test.ts`、`path-aware-channels-coverage`、`proxied-channels-binding`、`headless-parity`、`headless-electron-free`：PASS
- e2e：`t0609-worker-attention-badge.spec.ts` + 回歸 `t0538-worker-tab-batch-close.spec.ts`、`t0553-worker-tab-title.spec.ts`：**3 passed**
- 未碰使用者的 BAT（port 9876）；e2e 皆隔離實例；未對 claude / codex 送任何 prompt。

**變更檔案**（commit `fbf641dc`）：
- 新增：`electron/terminal-attention.ts`、`src/lib/terminal-attention.ts`、`src/stores/terminal-attention-store.ts`、`electron/__tests__/terminal-attention.test.ts`、`electron/remote/__tests__/headless-attention-e2e.test.ts`、`src/components/__tests__/worker-tab-attention.test.tsx`、`src/stores/__tests__/workspace-store.workerAttention.test.ts`、`e2e/t0609-worker-attention-badge.spec.ts`
- 修改：`electron/main.ts`、`electron/preload.ts`、`electron/pty-manager.ts`、`electron/terminal-blocked-state.ts`、`electron/tower-questions.ts`、`electron/remote/headless-entry.ts`、`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`、`src/App.tsx`、`src/components/TerminalThumbnail.tsx`、`src/components/ThumbnailBar.tsx`、`src/components/WorkspaceView.tsx`、`src/stores/workspace-store.ts`、`src/types/index.ts`、`src/types/electron.d.ts`、`src/styles/panels.css`、`src/locales/{en,zh-TW,zh-CN}.json`、`CLAUDE.md`（只改「Worker 分頁回收」節一行）、`docs/agent-guide/worker-tab-recycle.md`
- 未改：`scripts/**`、`docs/agent-guide/bat-mcp-shim.md`、CLAUDE.md「Worker 問塔台」「BAT MCP shim」節（T0608 範圍）；`src/styles/settings.css` 的 M 不是本單變更，未提交。

### 已知限制 / 後續

- attention 只在記憶體：視窗重新載入、遠端重新連線後，要等該分頁下一次狀態變更才會再顯示 ⚠️ / 結構化 `?`（後備 `workerQuestion` 有持久化）。遠端 server 重啟時舊標示留到 PTY 結束事件或下一次變更。若需要，可另開單加「一次性快照」channel。
- 非 Worker 分頁 blocked 不顯示標籤（本單範圍是 Worker 縮圖）。
- `--ask`（T0608）結構化提問的 e2e 留給收尾單；推送本身已由 unit + headless e2e 覆蓋。

### 互動紀錄

無（yolo，未向塔台提問）。

### 遭遇問題

- i18n key 原擬 `blockedTooltip_permission`，因 i18next 對 `_` 後綴有複數 / context 語意，改為巢狀 `blockedTooltip.<reason>`。

### 回報時間

2026-10-18T05:30:34+0800
