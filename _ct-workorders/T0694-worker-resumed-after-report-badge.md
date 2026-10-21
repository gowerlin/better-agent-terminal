---
schema_version: 1
schema_kind: workorder
id: T0694
title: "Worker 回報後又開始執行（Renew）時不顯示 ✓、不列入批次關閉：主行程回合信號 → 「已回報、又在執行」，回合結束回到 ✓；批次關閉確認框加註近期輸出（T0693 方案 a + d1 + d2，D180）"
type: feature
status: IN_PROGRESS
repo: better-agent-terminal
project: D180
priority: P2
sizing: M
created_at: "2026-10-22T00:26:01+0800"
updated_at: "2026-10-22T00:27:51+08:00"
started_at: "2026-10-22T00:27:51+08:00"
depends_on: []
related:
  - "T0693 研究（`6f3f623c`）回報區：`✓` 生命週期事實表、Renew 路徑 R1–R4、推演表、方案比較與殘留風險 —— 本單的設計依據，先讀"
  - "D180（使用者 2026-10-22 選 a + d1 + d2；不改 CT）"
  - "現況實作：`findReportingWorkers` / `markWorkerReported` / `reportedWorkersOfTower`（`src/stores/workspace-store.ts`）、`workerAttention` / `workerNotifyKind`（`src/lib/terminal-attention.ts`）、`TerminalAttentionNotifier`（`electron/terminal-attention.ts`）、`TerminalBlockedTracker`（`electron/terminal-blocked-state.ts`，`user-prompt-submit` / `stop` 已在收、`observeCodexState`）、`terminal-attention-store`（`src/stores/terminal-attention-store.ts`）、徽章 `src/components/TerminalThumbnail.tsx`、批次關閉 `src/components/WorkspaceView.tsx`"
  - "CLAUDE.md「Worker 分頁回收」節（T0538 分頁標示與批次關閉、T0609 ⚠️ / `?` / `✓`）、「blocked 狀態偵測」節（hook 腳本規則、codex OSC 規則）；`docs/agent-guide/worker-tab-recycle.md`、`docs/agent-guide/blocked-state.md`"
  - "先例：T0613 讓 `--ask` 清掉既有 `✓`，問題結束後分頁顯示執行中（`workspace-store.workerAttention.test.ts:256`）"
  - "BUG-170（旁支 e，不在本單範圍）"
affects_files:
  - electron/terminal-blocked-state.ts
  - electron/terminal-attention.ts
  - electron/remote/headless-entry.ts
  - electron/__tests__/**
  - electron/remote/__tests__/**
  - src/lib/terminal-attention.ts
  - src/stores/workspace-store.ts
  - src/stores/terminal-attention-store.ts
  - src/stores/__tests__/**
  - src/components/TerminalThumbnail.tsx
  - src/components/WorkspaceView.tsx
  - src/components/__tests__/**
  - src/types/index.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - e2e/t0694-*.spec.ts
  - docs/agent-guide/worker-tab-recycle.md
  - docs/agent-guide/blocked-state.md
  - CLAUDE.md
  - _ct-workorders/T0694-worker-resumed-after-report-badge.md
renew_count: 0
tower_question: open
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 步驟 0（先查再寫）：claude 在使用者 Esc 中斷、API 錯誤、`/clear` 等情況結束回合時，是否送 `Stop` hook（查 claude 官方 hook 文件與內嵌 CLI 2.1.306 二進位，必要時在隔離實例實測；不得對使用者的 BAT 與其他分頁送任何輸入）。不會送 → 加逾時備援（例如回合開始後輸出連續安靜 N 秒視為結束，N 與理由寫進回報與 docs）；會送 → 不加。codex 的 OSC `idle` / `clear` 同樣說明。"
  - "🔴 主行程（唯一實作，本機與 headless 共用）：在 `TerminalBlockedTracker` 記每個分頁的「回合進行中」：claude `user-prompt-submit` → 開始、`stop` → 結束；codex OSC `working` → 開始、`idle` / `clear` → 結束；PTY 結束 / restart / Terminal Server recovery 清除。經 `terminal:attention-changed` payload 多一個狀態欄位（例 `busy: boolean`）推給 renderer；payload 只能有狀態欄位，不得含輸出、問題內容或權杖（T0609 / D155）。`blockedDetection: none` 的分頁沒有信號，維持現況。🔴 hook 腳本規則不變（exit 0、stdout 不輸出，T0590）；不新增 hook 事件就做得到就不要加；🔴 不得注入 codex hooks / `-c notify` / `-c tui.*`。"
  - "🔴 不改對外契約：helper（`bat-terminal.mjs` / `bat-notify.mjs`）、BAT MCP tool、`terminal:get-state` / `list` / `wait` 的回傳欄位、`--close-worker` 行為都不變。CT 不需要配合。"
  - "🔴 renderer：`workerAttention` 新增一個 kind（暫稱 `resumed`，「已回報、又在執行」），優先序：⚠️ blocked / `?` 提問 > `resumed` > `✓`。已有 `workerReport` 的分頁在回報**之後**收到回合開始 → `resumed`：徽章不顯示 `✓`（顯示什麼由你決定，與既有徽章風格一致、色盲可辨），tooltip 寫「已回報（<訊息>），之後又開始執行」；回合結束而沒有新回報 → 回到 `✓`；新回報 → 一般 `✓`。「回報之後」以 renderer 收到事件的順序判斷，🔴 不得拿主行程或遠端主機的時間戳與 renderer 的 `reportedAt` 比（遠端時鐘不同）。`resumed` 只在記憶體、不持久化（BAT 重開後回到 `✓`，下一個 hook 再更新）。`reportedWorkersOfTower`（批次關閉候選）排除 `resumed`。"
  - "🔴 d2：批次關閉確認框（`.worker-batch-close-dialog`，🔴 不得改用 `window.confirm`）對 `CLOSE_WORKER_IDLE_MS`（5 s，`electron/close-worker.ts`；renderer 端引用或同值常數，說明來源）內有輸出的分頁加註「仍在輸出」，只加註、不排除。用 renderer 已有的活動時間。i18n 三語都加。"
  - "🔴 detached 視窗：每個 renderer 各自持有 `workerReport`（T0693 事實表），確認 detached 視窗與主視窗的行為一致、交回後不殘留錯誤的 `resumed`。"
  - "🔴 測試：單元——tracker 的回合轉換（claude hook、codex OSC、PTY 結束 / recovery 清除、逾時備援若有）、`workerAttention` 優先序表、`reportedWorkersOfTower` 排除 `resumed`、notify 與 attention 事件**先後兩種順序**（比照 `workspace-store.workerAttention.test.ts:245`）、`resumed` → 回合結束回到 `✓`、→ 新回報、批次確認框加註（元件測試）、headless 推送欄位。既有 T0538 / T0609 / T0613 測試不得改弱；若要改既有斷言，回報寫明理由。e2e（新 `e2e/t0694-*.spec.ts`，隔離實例，需先 `npx vite build`）：claude Worker 回報 → 輸入 → 標籤非 `✓`、不在批次候選 → 回合結束回 `✓`；做不到全自動時寫明哪一段以單元測試代替。改到 codex OSC 處理時跑 `e2e/t0621-codex-osc-state.spec.ts`（環境沒有 codex `>= 0.163.0` 就寫明未跑）。"
  - "🔴 驗收：`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、整包 `npm run test:unit`（基線 5812 passed / 326 files / 3 skipped，只能增加，0 failed）、`npm run test:legacy` 綠（有碰到 legacy 收的檔才必跑，否則寫明未碰）。跑測試時 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指到 temp。"
  - "🔴 文件：`docs/agent-guide/worker-tab-recycle.md`（`✓` / `resumed` 生命週期、批次關閉規則、d2 加註、已知限制：`none` 分頁、重開後、逾時備援）與 `docs/agent-guide/blocked-state.md`（回合信號）；CLAUDE.md「Worker 分頁回收」節的 T0609 那條補一句（`resumed` 不計入批次關閉、判斷唯一實作位置），遵守開頭撰寫規則，`##` 標題不改名。"
  - "🔴 Git：`git commit --only <檔案>`；不 push；不觸發任何 workflow。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。可以開唯讀子代理平行讀程式碼；不使用 Workflow 工具（本單沒有授權）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報裡的路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題問塔台（設計選擇在 D180 範圍內可自行決定並寫理由；要改對外契約、CT 流程或擴大範圍時才問）。"
---

# T0694 — Worker 回報後又在執行：不顯示 ✓、不列入批次關閉

## 元資料

- **工單編號**：T0694
- **類型**：feature（D180，T0693 方案 a + d1 + d2）
- **優先級**：P2
- **建立時間**：2026-10-22T00:26:01+0800
- **預估規模**：M

## 目標

Worker 回報後，分頁標籤顯示 `✓`。塔台 Renew、使用者在原分頁讓 Worker 重讀繼續做時，`✓` 不會變，手動「關閉已回報的 Worker 分頁」會把正在工作的 Worker 一起關掉（T0693）。本單讓 BAT 以既有的回合信號（claude hook、codex OSC 7501）知道「回報後又開始執行」：這段期間不顯示 `✓`、不列入批次關閉，結束後沒有新回報就回到 `✓`。另外在批次關閉確認框對近期還有輸出的分頁加註，涵蓋沒有信號的分頁。不改 helper、MCP 與 CT。

## 要做的事

0. 查 claude `Stop` 在 Esc 中斷 / API 錯誤時是否觸發，決定逾時備援。
1. 主行程：`TerminalBlockedTracker` 記回合狀態，`terminal:attention-changed` 多一個狀態欄位（本機與 headless）。
2. renderer：`workerAttention` 新 kind `resumed`、徽章與 tooltip、`reportedWorkersOfTower` 排除。
3. 批次關閉確認框加註「仍在輸出」。
4. 單元測試、e2e、typecheck、build、`test:unit`。
5. docs 與 CLAUDE.md。

## 驗收

- 回報有步驟 0 的結論與證據、逾時備援的決定。
- 回報 → 開始執行 → 標籤非 `✓`、不在批次候選；回合結束 → `✓`；再回報 → `✓`（單元 + e2e 或寫明替代）。
- notify 與 attention 事件兩種到達順序結果正確；detached 視窗一致。
- 批次確認框對近期輸出的分頁加註，三語 i18n。
- 對外契約（helper、MCP、query channel、`--close-worker`）不變。
- typecheck 兩個 = 0、`vite build` 成功、`test:unit` ≥ 5812 passed、0 failed。
- 文件已更新；只改 `affects_files`；未 push、未觸發 workflow。

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

#### Q-1：affects_files 缺 `electron/pty-manager.ts` 與 `electron/main.ts`，可以加進本單範圍嗎？
- 提問時間：2026-10-22T00:32:40+0800
- 選項：[A] 可以，兩檔都加（只做接線） / [B] 不可以，改別的做法 / [C] 其他：________
- Worker 建議：[A]。回合狀態記在 `TerminalBlockedTracker`，但 tracker 是 `PtyManager` 的私有欄位（`electron/pty-manager.ts:329`），要多一個 `PtyManager.isAgentTurnActive(id)`，逾時備援也要讀 `PtyManager` 的 `lastOutputAt`；Electron 主行程的 `TerminalAttentionNotifier` 在 `electron/main.ts:2428` 建立，要加一行 `isTurnActive` 接線（headless 那份在 `electron/remote/headless-entry.ts`，已在範圍內）。不改這兩檔，本機的 attention 推送拿不到回合狀態。兩檔只加接線，不改其他行為；對外契約不變。
- 影響範圍：`electron/pty-manager.ts`（約 10 行）、`electron/main.ts`（1 行）；驗收「只改 `affects_files`」那條。
- 阻塞：否（先做 renderer、tracker、測試；主行程接線等答覆）

### 完成狀態

### 產出摘要

### 互動紀錄

### 遭遇問題

### 回報時間
