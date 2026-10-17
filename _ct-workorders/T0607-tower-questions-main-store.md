---
schema_version: 1
schema_kind: workorder
id: T0607
title: "PLAN-048 A：Worker 問塔台 — 主行程問答 store、5 個 channel 與權限、`blocked` / `tower` 與 `pendingQuestions`（本機 + headless）"
type: feature
status: PENDING
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: M-L
created_at: "2026-10-18T04:50:47+0800"
started_at: ""
updated_at: "2026-10-18T04:50:47+0800"
completed_at: ""
depends_on: [T0606]
related:
  - "T0606 回報區「介面契約草案」C-1–C-11 = 本單介面契約（D156 全部採用推薦；CT-T019 依此撰寫，不得單方更改）；「實作切分」A 節 = 本單範圍"
  - "D155 / D156；並行工單 T0608（B：helper + MCP shim，worktree 隔離，只改 `scripts/**` 與 `docs/agent-guide/bat-mcp-shim.md`）"
affects_files:
  - "electron/tower-questions.ts（新：store + `registerTowerQuestionHandlers`，不 import electron）"
  - electron/remote/helper-capability.ts
  - electron/terminal-query-handlers.ts
  - electron/terminal-blocked-state.ts
  - electron/main.ts
  - electron/remote/headless-entry.ts
  - "electron/pty-manager.ts（只在需要 recovery hook 時）"
  - "electron/__tests__/**、electron/remote/__tests__/**（含 IPC / channel binding guard 測試的清單）"
  - CLAUDE.md
  - "docs/agent-guide/tower-questions.md（新）、docs/agent-guide/README.md、docs/agent-guide/blocked-state.md、docs/agent-guide/helper-query-channels.md、docs/agent-guide/remote-tower-notify.md"
  - _ct-workorders/T0607-tower-questions-main-store.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 契約 = T0606 回報區「介面契約草案」C-1–C-11，D156 已全部採用該單「待塔台 / 使用者決定」的推薦。必須照寫；實作中發現契約不可行或需改名，停下以 `T0607 提問` 問塔台（yolo 提問流程），不得自行改契約。"
  - "🔴 內容不落地（D155）：問題 / 選項 / detail / 答案只存在主行程記憶體，**不寫入任何檔案**；`[tower-question]` 日誌與 bat-scripts.log 只記 id / 長度 / 數量 / 結果，**永遠不記內容與權杖**（測試要斷言）。工單的問答紀錄屬 CT，與 BAT 無關。"
  - "🔴 並行：T0608 在隔離 worktree 改 `scripts/bat-notify.mjs`、`scripts/bat-terminal.mjs`、`scripts/bat-mcp.mjs`、`scripts/__tests__/**`、`docs/agent-guide/bat-mcp-shim.md`。本單**不得**改這些檔；CLAUDE.md「BAT MCP shim」節也不改（由收尾單處理）。"
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；含反斜線的內容用 Write / Edit 工具（L129）；commit 一律 `git commit --only <檔案…>`。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）；需要 BAT 時用隔離實例（先 `npx vite build`）。不得對 claude / codex 送出任何 prompt。"
---

# T0607 — PLAN-048 A：主行程問答 store、channel、狀態

## 背景

PLAN-048（D155 / D156）：yolo Worker 以結構化通道問塔台、等答覆。T0606 已寫定介面契約並切成三張實作單；本單是 A（主行程），B（helper + MCP shim）由 T0608 在隔離 worktree 並行，C（e2e）待 A / B 合併後再派。

## 任務

1. 依 T0606 契約 C-1–C-4、C-7、C-9、C-10 實作（本機與 headless 共用同一 module，接線比照 T0582 / T0590：`electron/main.ts` 與 `electron/remote/headless-entry.ts` 各呼叫一次 `register…Handlers(deps)`）：
   - `electron/tower-questions.ts`：store（id 帶 boot id → `lost`、狀態、`endReason`、保留期、C-2 常數與文字規則、收件即 `redactTerminalSecrets`）與 5 個 channel handler（`question:ask` / `cancel` / `answer` / `list` / `wait`）。
   - `HELPER_CHANNEL_ROLES` 5 列 + `authorizeHelperInvoke` 綁定（`question:answer` 比照 `terminal:close-worker` 的 `towerId` 綁定）。
   - PTY 結束（Worker / 塔台，含 restart）、Terminal Server recovery、`dispose` 的取消與 wait 收尾（C-4）。
   - `stateOf` 合成 `blocked` / `tower`（優先序在 hook reason 之後，`source: 'question'`，`blockedDetection: none` 的分頁也回）；`terminal:get-state` / `list` / `wait` 每個回傳加 `pendingQuestions`；`BlockedReason` 型別加 `tower`。使用者輸入不清除 `tower`。
2. 測試：T0606「實作切分」A 節列的 unit 全部；另加真 RemoteServer + 範圍權杖的整合測試（worker 權杖 ask → tower 權杖 list / answer → worker wait 收到；權限拒絕路徑）與 headless 對等測試（比照 `headless-terminal-query-e2e.test.ts`）。fake timers 遵守 CLAUDE.md「Frontend unit tests」規則。
3. 文件（CLAUDE.md T0595 規則）：
   - CLAUDE.md 新增「## Worker 問塔台（PLAN-048 / T0607）」小節（3–12 行：用途、契約一句話與 CT-T019、唯一實作 `electron/tower-questions.ts`、🔴 不變式：內容只存記憶體且日誌不記內容、BAT MCP 維持唯讀、`tower` 不被使用者輸入清除、helper 內容只走 stdin（T0608））。「blocked 狀態偵測」「遠端 Tower 通知」兩節各補一句（`tower` reason 與 `none` 新定義；權杖範圍表新列）。
   - `docs/agent-guide/tower-questions.md`（新）：完整契約（主行程部分）、限制、日誌、已知限制（agent 自己的對話紀錄含問答內容）、驗證清單；helper / MCP 段落留一句「見 T0608，收尾單補入」。索引 `docs/agent-guide/README.md`；同步 `blocked-state.md`、`helper-query-channels.md`、`remote-tower-notify.md`。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠（回報 passed / files 數）。
2. 回報區附：`question:ask` → `list` → `answer` → `wait` 的實際回傳 JSON 範例（內容用假資料）、`get-state` 的 `blocked` / `tower` JSON 範例、一段 `[tower-question]` 日誌範例（證明不含內容）、與契約的差異（若有，必須是已問過塔台的）、變更檔案清單。

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

### 產出摘要

### 互動紀錄

### 遭遇問題

### 回報時間
