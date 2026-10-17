---
schema_version: 1
schema_kind: workorder
id: T0609
title: "BUG-153：Worker 分頁縮圖區分「等使用者（blocked）」「等塔台答覆（提問）」「已回報」，提問 / blocked 不計入批次關閉"
type: bugfix
status: PENDING
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: M
created_at: "2026-10-18T05:11:26+0800"
started_at: ""
updated_at: "2026-10-18T05:11:26+0800"
completed_at: ""
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

### 產出摘要

### 互動紀錄

### 遭遇問題

### 回報時間
