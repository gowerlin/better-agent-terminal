---
schema_version: 1
schema_kind: workorder
id: T0694
title: "Worker 回報後又開始執行（Renew）時不顯示 ✓、不列入批次關閉：主行程回合信號 → 「已回報、又在執行」，回合結束回到 ✓；批次關閉確認框加註近期輸出（T0693 方案 a + d1 + d2，D180）"
type: feature
status: DONE
repo: better-agent-terminal
project: D180
priority: P2
sizing: M
created_at: "2026-10-22T00:26:01+0800"
updated_at: "2026-10-22T00:50:51+08:00"
completed_at: "2026-10-22T00:50:51+08:00"
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
  - electron/pty-manager.ts
  - electron/main.ts
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

- Q-1 已由塔台經 BAT 通道答覆（見 `### 互動紀錄`），`tower_question` 已移除。

### 完成狀態

**DONE**：驗收項目全部通過。

- 落點檢查：**PASS**。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1：工單在 `REPO_ROOT/_ct-workorders/` 底下；C-3：前 5 個可測路徑都存在 → PASS；C-2：工單沒有 `branch` 欄位，當前分支 `main`。非 worktree（沒有設定 `CT_HOME`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- 驗收（HEAD `cefb9db3adb2acee47da1b59fe4e89ea7e739e41`，`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 都指到 scratchpad temp）：
  - `npm run typecheck` = 0、`npm run typecheck:electron` = 0
  - `npx vite build`：exit 0
  - `npm run test:unit`：**329 files / 5857 passed / 3 skipped / 0 failed**（基線 326 / 5812 / 3）
  - e2e（隔離實例，build 之後才跑）：新增的 `e2e/t0694-worker-resumed-badge.spec.ts` 通過；回歸跑了 `e2e/t0538-worker-tab-batch-close.spec.ts`、`e2e/t0609-worker-attention-badge.spec.ts`、`e2e/t0621-codex-osc-state.spec.ts`（本機 `codex-cli 0.163.0`，真 codex TUI），4 個都通過。e2e 跑在 commit 前的工作樹上；commit 前最後兩處只是改註解、刪一行空行，之後在 HEAD 上重跑了 typecheck、build 與整包 unit。
  - `npm run test:legacy`：**未跑**。沒有改到 `tests/` 底下 legacy 收的檔案（依工單規則可以不跑）。

### 產出摘要

#### 步驟 0：claude `Stop` 是否觸發 → 需要逾時備援

- **證據**：claude 官方 hooks 文件（`https://code.claude.com/docs/en/hooks`，§ Stop）原文：「Runs when the main Claude Code agent has finished responding. Does not run if the stoppage occurred due to a user interrupt. API errors fire StopFailure instead.」；§ StopFailure：「Runs instead of Stop when the turn ends due to an API error.」。內嵌 CLI `@anthropic-ai/claude-code` 2.1.306 的二進位，hook 事件表也有 `"Stop","StopFailure"`，另外有 `executeStopFailureHooks` 和 `hook_event_name:"StopFailure"` 的 payload（`error` / `error_details` / `last_assistant_message`）。
- **結論**：使用者按 Esc 中斷，或回合因 API 錯誤結束時，BAT 都收不到 `stop`，所以要逾時備援。**加了**：`AGENT_TURN_QUIET_END_MS` = 60 s，回合中 PTY 連續 60 s 沒有輸出就視為結束。安靜時間從「回合開始」和「最後一次輸出」中較晚的那個算起，`blocked` 期間不判斷。**沒有**加 `StopFailure` hook：Esc 的情況本來就要靠備援，備援也同時涵蓋 API 錯誤，符合工單「不新增 hook 事件就做得到就不要加」。
- 選 60 s 的理由：claude / codex 回合進行中，工作指示器和經過秒數至少每秒重繪一次，PTY 會持續有輸出。這個數字是推論，沒有逐秒實測。
- `/clear` 等情況：`UserPromptSubmit` 也會在排程任務、背景 subagent 回報等「claude 自己開始的回合」觸發（文件 § UserPromptSubmit），那些都是真的在工作；回合結束時沒有 `Stop` 的情況一律由備援收尾。
- codex：codex 的 TUI 每次轉換都會送 OSC 7501（T0619 實測過）。Esc 中斷後是否一定會送 `idle` **沒有逐一實測**，逾時備援同樣涵蓋 codex。

#### 實作（D180：a + d1 + d2）

- **主行程**（唯一實作，本機與 headless 共用）：`TerminalBlockedTracker`（`electron/terminal-blocked-state.ts`）新增回合狀態 `isTurnActive`。
  - 開始：claude `user-prompt-submit`、codex OSC `working`。
  - 結束：claude `stop`、codex OSC `idle` / `clear`（`blocked` 不改變回合狀態）、PTY 結束（`clearStarted`）、Terminal Server recovery（`clearAll`）、`dispose`、逾時備援。
  - 每次轉換都呼叫既有的 `onChange`，記一行日誌 `[turn] terminal=<id> → started|ended (<原因>)`。
  - `report()` 的回傳（`terminal:report-hook` 契約）不變。
- **接線**：`PtyManager.isAgentTurnActive(id)` 給 tracker `{ lastOutputAt }`（`electron/pty-manager.ts`）。`TerminalAttentionNotifier` 新增 `isTurnActive` dep，`computeTerminalAttention` 第 4 參數，payload 多 `busy: true`（只有回合進行中才帶）。Electron `electron/main.ts` 與 headless `createHeadlessTerminalQueryModule` 各加一行，兩邊對稱。payload 只有狀態欄位（D155）。
- **renderer**：
  - `src/stores/terminal-attention-store.ts` 依「本視窗收到事件的順序」判斷：`busy` 從沒有變成有 → 記一個序號；`markWorkerReported` → `noteWorkerNotified` 記序號；`isWorkerResumedAfterReport` = 回合開始的序號大於最近一次通知的序號。不拿主行程或遠端的時間跟 `reportedAt` 比。這個狀態只存在記憶體。
  - `workerAttention(tab, attention, resumed)` 新增 kind `resumed`，優先序為 ⚠️ / `?` > `resumed` > `✓`。
  - 徽章顯示 `↻`，class `resumed`，`data-attention="resumed"`，tooltip 是 `workerTabs.resumedTooltip`。用形狀和 `✓` 區分，不靠顏色；`resumed` 沒有加 CSS，沿用 `.worker-badge` 的中性樣式。
  - `reportedWorkersOfTower` 排除 `resumed`（新增第 4 參數 `resumedOf`，預設讀 store）。
- **d2**：把批次關閉確認框抽成同檔的 `WorkerBatchCloseDialog`（`src/components/WorkspaceView.tsx`，class、`ModalOverlay`、Esc、按鈕都不變）。最後輸出在 `BATCH_CLOSE_RECENT_OUTPUT_MS` = 5 s 以內的分頁會加註「仍在輸出」（`.worker-batch-close-printing`，`li[data-still-printing]`），每秒重算一次，只加註、不排除。這個值與 `CLOSE_WORKER_IDLE_MS` 相同，renderer 端放一份複本，有測試斷言兩者相等。三語 i18n 各加 3 個 key。
- **detached 視窗**：每個視窗各自依收到順序判斷，同一個分頁在主視窗和 detached 視窗的結果一致。交回時：父視窗原本就有的分頁沿用自己的序號；父視窗沒看過通知的新分頁，回合已結束顯示 `✓`，回合還在跑顯示 `↻`（保守做法，回合結束就回到 `✓`，不會殘留）。單元測試涵蓋這三種情況。
- **對外契約不變**：helper、BAT MCP、`terminal:get-state` / `list` / `wait`、`--close-worker` 都沒改，hook 腳本與 hook 事件表也沒改，沒有注入 codex hooks、`-c notify` 或 `-c tui.*`。

#### 異動檔案（commit `cefb9db3`）

- 主行程：`electron/terminal-blocked-state.ts`、`electron/terminal-attention.ts`、`electron/pty-manager.ts`（只加 `isAgentTurnActive`、tracker 的 `lastOutputAt` 選項與 deps 註解；`buildPtyEnv()`、`enqueuePtyOutput`、create / restart / recovery 都沒改）、`electron/main.ts`（只加 1 行 `isTurnActive` 接線；`app-paths-bootstrap` 仍是第一個 import，有 source guard 斷言）、`electron/remote/headless-entry.ts`
- renderer：`src/lib/terminal-attention.ts`、`src/stores/terminal-attention-store.ts`、`src/stores/workspace-store.ts`、`src/components/TerminalThumbnail.tsx`、`src/components/WorkspaceView.tsx`、`src/locales/{en,zh-TW,zh-CN}.json`
- 測試（新增）：`electron/__tests__/agent-turn-attention.test.ts`（24）、`src/stores/__tests__/workspace-store.workerResumed.test.ts`（15）、`src/components/__tests__/worker-tab-resumed.test.tsx`（5）、`e2e/t0694-worker-resumed-badge.spec.ts`。另在 `electron/remote/__tests__/headless-attention-e2e.test.ts` 加了 1 個 headless 推送案例。
- 改到的既有斷言（沒有改弱）：`electron/__tests__/terminal-blocked-state.test.ts` 與 `electron/__tests__/codex-osc-state.test.ts` 的日誌是**完整比對**，現在多了 `[turn]` 行，所以在期望陣列中**插入**新行，codex 那筆的 `changes` 從 6 筆變 8 筆（多了回合開始與結束）。原有的行與順序都保留。T0538 / T0609 / T0613 的測試完全沒動，全部通過。
- 文件：`docs/agent-guide/worker-tab-recycle.md`（五態表、T0694 條：生命週期、回合信號、步驟 0 理由、收到順序、d2、detached、已知限制、驗證）、`docs/agent-guide/blocked-state.md`（回合信號一條、codex 轉換表加註）、`CLAUDE.md`「Worker 分頁回收」節多一行（`##` 標題沒改）。

#### 測試覆蓋對照工單要求

- tracker 的回合轉換（claude hook、codex OSC、PTY 結束 / recovery、逾時備援）：`agent-turn-attention.test.ts`
- `workerAttention` 優先序表、`reportedWorkersOfTower` 排除、事件兩種先後順序、`resumed` → `✓`、→ 新回報：`workspace-store.workerResumed.test.ts`
- 批次確認框加註：`worker-tab-resumed.test.tsx`
- headless 推送欄位：`headless-attention-e2e.test.ts`
- e2e：claude Worker 回報 → 開始回合 → 標籤 `↻`、N = 0 → 回合結束回到 `✓`；確認框只列已回報的那個，並標示仍在輸出、5 s 後標示消失；回合中再回報 → `✓`。逾時備援（60 s）只有單元測試，e2e 沒有測。

### 子代理與 Workflow 使用

都沒有使用。

### 互動紀錄

- [00:33] Q-1: affects_files 缺 `electron/pty-manager.ts` 與 `electron/main.ts`，可以加進本單範圍嗎？ → A（塔台，BAT 通道 `q-5b9a42a2-bcecfa487321bf29`，choice 1）: [A] 可以，只做接線；條件：Worker 自己把兩檔加進 `affects_files` 並寫明理由；pty-manager.ts 只加讀取回合狀態的公開方法與逾時備援要讀的活動時間，不改 `buildPtyEnv()`、`enqueuePtyOutput` 的輸出處理、create / restart / recovery 既有行為；main.ts 只加 `TerminalAttentionNotifier` 接線，`app-paths-bootstrap` 仍是第一個 import、不新增 import 期 `app.getPath('userData')`；本機與 headless 接線對稱、各有測試 → Action: 兩檔已加進 frontmatter `affects_files`，依條件實作。

### 遭遇問題

- **範圍**：`affects_files` 原本沒有 `electron/pty-manager.ts`、`electron/main.ts`，但回合狀態一定要透過這兩處接線，所以先問塔台（Q-1）。塔台答覆 [A] 後，兩檔已加進 frontmatter `affects_files`，只做接線，並照塔台的條件實作：pty-manager.ts 只加讀取方法與輸出時間；main.ts 只加 1 行 notifier 接線，`app-paths-bootstrap` 仍是第一個 import，有 source guard。`src/types/index.ts` 在 `affects_files` 內，但不需要修改，所以沒改。
- **e2e 回歸（已修正）**：「仍在輸出」標示一開始用了 `.worker-badge` class，導致 `e2e/t0538-worker-tab-batch-close.spec.ts` 的選擇器 `li .worker-badge` 對到兩個元素而失敗。改成只用 `.worker-batch-close-printing`，加上少量 inline style（`src/styles/panels.css` 不在範圍內），既有 e2e 不用改。重跑 4 個 e2e 都通過。
- **已知限制**（也寫進 docs）：
  - `blockedDetection: none` 的分頁沒有回合信號，只靠 d2 的「仍在輸出」標示提醒。
  - BAT 重開或視窗重新載入後，要等到下一個回合事件才會更新，在那之前顯示 `✓`。
  - 回合中安靜超過 60 s 時會提早回到 `✓`，等同 T0694 之前的行為。
  - 閒置時仍持續輸出的分頁（例如會定時重繪的自訂 claude status line）在 Esc 之後會停在 `↻`，直到下一個 `stop`。這屬於安全方向：分頁不會被批次關閉。
  - 回報後只是跟 Worker 閒聊，那個回合也會顯示 `↻`。
- 工單初始 `status` 是 `TODO`（ct-exec 預期是 `PENDING`），當成 PENDING 處理，改為 `IN_PROGRESS`。
- 沒有 push，也沒有觸發任何 workflow。Git 只用 `git commit --only`，沒有用 stash / reset / checkout / restore。

### Commit

- 產品：`cefb9db3adb2acee47da1b59fe4e89ea7e739e41`（`feat: T0694 resumed Worker badge, not batch-closed while working after its report (D180)`，23 檔）
- 工單：`76a252a1`（開工與 Q-1），以及本次結案 commit（只含本工單檔，`git commit --only`）

### 回報時間

2026-10-22T00:50:51+0800
