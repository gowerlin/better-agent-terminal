---
schema_version: 1
schema_kind: workorder
id: T0813
title: "研究（PLAN-058）：Claude 面板常駐串流輸入的設計與可行性驗證——生命週期、影響表、最小原型量測、分階段實作草案"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: L
created_at: "2026-11-03T21:11:52+0800"
started_at: "2026-11-03T21:14:40+0800"
updated_at: "2026-11-03T21:30:01+0800"
completed_at: "2026-11-03T21:30:01+0800"
session_ids:
  - "e64687dc-f5ff-471a-8a89-302380157d86"
depends_on: []
related:
  - "PLAN-058；D214 / D258；T0768（方案 B 原始研究）；T0769 / BUG-192（背景子代理執行中注入、排隊、`perTaskStopAffordance`）；T0759 / BUG-190（背景子代理）；T0725（工作清單工具）；T0744（Cache History R 列）；CLAUDE.md「Sub-agent / Active Tasks Tracking」「Claude Agent SDK / CLI」節；`docs/agent-guide/claude-agent-sdk-cli.md`；`electron/claude-agent-manager.ts`、`src/components/ClaudeAgentPanel.tsx`"
affects_files:
  - _ct-workorders/T0813-research-claude-panel-persistent-streaming-design.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 研究型：只設計與驗證、不實作。repo 內唯一可改的是本工單（回報區）。原型一律寫在 repo 外的暫存目錄（引用 repo 的 `node_modules/@anthropic-ai/claude-agent-sdk` 即可），收尾刪除；不得 commit 產品程式、測試、文件。"
  - "🔴 原型呼叫真實模型時：只用 Haiku 5.5（`claude-haiku-5-5`）、極短 prompt、總共不超過 20 次 query 輪次；使用本機已登入的 claude（不得登入 / 登出、不得改 `~/.claude` 設定與 credentials）；不在使用者正在用的 BAT 分頁或面板裡測。原型的 cwd 用暫存目錄，不得讓原型的工具改 repo 檔案（權限模式不放寬到可寫 repo）。費用與 token 數記入回報。"
  - "🔴 不記任何權杖、credentials、session 內容；回報不寫家目錄真實路徑或帳號名（D176）。實測不到的部分標「推論」。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本工單（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。本單與 T0811 / T0812 並行，不得改它們的檔。"
---

# T0813 — 研究：Claude 面板常駐串流輸入的設計與可行性（PLAN-058）

## 元資料

- **工單編號**：T0813
- **類型**：research（設計＋原型量測，不實作）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T21:11:52+0800
- **預估規模**：L

## 背景

T0768 查證：SDK 0.3.316 的 AsyncIterable prompt 可在同一個 CLI 程序內持續送訊息；主回合進行中送第 2 則時 CLI 自己排隊（`command_lifecycle`），不必「中斷＋重送」。BUG-192 先以方案 C 修（T0769：只在主回合結束後、背景子代理執行中注入，輸入已關則排隊）。要讓主回合進行中送出也不中斷，需改成「每個面板一個常駐 query＋inbox」（方案 B）：規模 L、回歸面大、每個面板多一個常駐 claude 程序。使用者 2026-11-03 指示先做設計與可行性驗證（D258）。

## 範圍

1. **現況盤點**：`electron/claude-agent-manager.ts` 與面板目前的 query 生命週期（每則訊息一個 query？何時 resume、abort、重開）、`isStreaming` / `messageQueue` / retry / resume、`setModel` / effort、`setPermissionMode`、休眠（`isResting`）、worktree、headless、背景子代理注入（T0769）、Cache History（T0744）、工作清單（T0725）、權限卡 / AskUserQuestion（T0762）各自依賴的假設。
2. **原型量測**（repo 外）：常駐 query＋AsyncIterable inbox 的最小原型，量測：
   - 主回合進行中送第 2 則：CLI 是否排隊、回應順序、`result` 訊息形狀（每則一個 result？）、usage / `total_cost_usd` 的累計方式（影響 T0744 的 R 列換算）；
   - 中斷（`interrupt()`）只停當前回合、query 不結束；權限請求在常駐模式下的流程；
   - 中途改 model / effort / permission mode 的方式（`setModel`、`applyFlagSettings`、`setPermissionMode`）是否生效於下一回合；
   - 閒置時程序數、RSS、CPU；閒置多久可以收掉、如何以 resume 重開；
   - 程序意外結束（kill CLI）時的偵測與恢復。
3. **設計**：常駐 query 的生命週期（建立、閒置回收、休眠、切 worktree、關面板、BAT 關閉、Terminal Server / headless 下的行為）；inbox 與「待送」UI（沿用 T0769 的排隊提示 / 取消 / 上限原則）；每個既有功能的影響表（不變 / 需改 / 風險）；是否加 Settings 開關、預設值建議；資源上限（同時常駐的面板數）。
4. **分階段實作草案**：拆成可獨立驗收的工單（每張的 affects_files、必守規則、驗收、不回歸測試），標出需要真實模型驗收的項目。

## 不做

- 不改產品程式、測試、文件；不升 SDK / CLI 版本；不開 BUG。

## 驗收

- [ ] 現況盤點（含依賴的假設清單）
- [ ] 原型量測結果（每項實測／推論標明；token 與費用）
- [ ] 生命週期設計與影響表
- [ ] Settings 開關與資源上限建議
- [ ] 分階段實作工單草案
- [ ] 若結論是不值得做或應延後，寫明理由與觸發條件

---

## 回報區

<!-- Worker 由此往下寫 -->

### 完成狀態

- **狀態**：DONE（研究單；六項驗收都有內容，見下方各節；結論為「常駐 query 可行，但建議先做較小的方案 D，常駐（方案 B）延後並附觸發條件」）
- **產品 commit**：無（只研究；未改產品程式、測試、文件；未 build）
- **落點檢查**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 只有本工單（`_ct-workorders/` 排除）→ 不適用；無 `branch` 欄位（C-2 不適用）。`CT_HOME` 未設（非 worktree）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **session_id**：e64687dc-f5ff-471a-8a89-302380157d86

### 產出摘要

**結論**

1. **常駐 query＋inbox（方案 B）在 SDK 0.3.316 / CLI 2.1.316 上可行**（實測）：同一個 CLI 程序內，主回合進行中送出的訊息由 CLI 排隊（`command_lifecycle` `queued` → `started` → `completed`），各自一個 `result`；`interrupt()` 只停當前回合、query 不結束；`setModel` / `applyFlagSettings({ effortLevel })` / `setPermissionMode` 在下一回合生效；程序被 kill 時 22 ms 內偵測、以 `resume` 開新 query 0.4 s 接回。代價：每個面板一個常駐 `claude.exe`，閒置實測約 **206–221 MB＋conhost 8.8 MB**、CPU 約 0.3–0.5 s / 分鐘；回歸面大（見影響表）。
2. **新發現：主回合中送出不必常駐也能排隊（方案 D）**（實測 6/6）：BAT 現行「每則訊息一個字串 prompt query」在**主回合進行中**呼叫 `Query.streamInput()`，CLI 一樣排隊並跑第 2 回合，query 在第 2 個 `result` 後正常結束。配合 `command_lifecycle` 回執（帶 `uuid`）可確認送達；result 之後的窗口會立即 reject（`ProcessTransport is not ready for writing`）或成功回執，6 次沒有無聲遺失。D 拿到 PLAN-058 的主要使用者效益（主回合中送出不中斷），不多常駐程序，規模 S–M。
3. **建議**：先做 **W0（方案 D）＋ W1（前置修正）**；方案 B（W2–W4）延後，觸發條件見〈7〉。D 會改變 D214 P-2（主回合中送出＝中斷＋重送），需使用者裁示（〈8〉P-1）。

#### 1. 現況盤點（HEAD `22360c65`，行號以此為準）

query 生命週期（`electron/claude-agent-manager.ts`）：

- **一則訊息（沒有 query 在跑時）＝一個 `runQuery` ＝一個 CLI 程序**。`runQuery`（`:949`）開頭 `isStreaming = true`、新 `AbortController`、`mainTurnDone = false`、`resetQueryUsage`（`:1152`）；以字串 prompt（有圖片時是單則 AsyncIterable）呼叫 `query()`；有 `sdkSessionId` 就 `resume`（`:1122`，prompt 空白才 `continue`）。`finally`（`:1216`）：`isStreaming = false`、清 `activeTasks`、仍 `running` 的卡片標 `Agent terminated unexpectedly`、取 `messageQueue` 第一則再 `runQuery`。
- **送出**（`sendMessage` `:803`）三條路：① T0769 注入（`isStreaming && mainTurnDone && queryInstance && hasBackgroundTask`）→ `streamInput`，reject → `messageQueue`（帶 `queuedId`，`claude:queued-messages` 列出、可取消）；② `isStreaming`（主回合在跑）→ `abort()`、清 `pendingPermissions` / `pendingAskUser` / `messageQueue`、加「`[使用者先前的訊息（已中斷）…]`」前綴後排隊；③ 否則 `runQuery`。
- **retry**：`exited with code` 且還沒收到 `system/init` → 清 `sdkSessionId`、「Starting fresh」重跑（`:1178`）。
- **Esc** `stopSession`（`:1726`）：清佇列、`interrupt()`（失敗才 abort）；背景子代理在跑時保留 `isStreaming`。**停止 / 雙 Esc** `abortSession`（`:1754`）：abort、`isStreaming = false`。
- **setModel**（`:1861`）：存 `session.model`，若有 `queryInstance` 就即時 `setModel`（失敗只記錄）。**setEffort**（`:1894`）：只存，下一個 query 的 `effort` 選項才生效。**setPermissionMode**（`:1844`）：存＋即時呼叫；`canUseTool` 每次讀 `session.permissionMode`；`allowDangerouslySkipPermissions` 只在 spawn 時 mode 為 `bypassPermissions` 才帶。
- **休眠** `restSession`（`:2337`，只由 Sidebar 手動觸發）：abort＋`close()`＋`isResting`；送出自動喚醒、resume。**resetSession**（`:2357`）：拆掉重建、保留 worktree。**worktree**：`startSession` 決定 cwd，整個 session 固定。
- **關分頁** `closeTerminalNow`（`src/stores/workspace-store.ts:657`）：只呼叫 `claude.stopSession`，**session 留在 map、不 `close()`**；⏻ 重啟（`WorkspaceView.tsx:1044`）`stopSession` 後 `startSession`（session 已存在 → 直接回 true）。**BAT 關閉**：`killAll`（`electron/main.ts:1492`）abort＋`close()`。**headless**：同一個 `ClaudeAgentManager`（`electron/remote/headless-entry.ts:476`），結束時 `killAll` / `dispose`。Terminal Server 與面板無關（SDK 程序是主行程的子程序）。
- 其他：`getSupportedModels` 用獨立的 `idleSdkPrompt` probe（BUG-177）；`forkSession` 另開一個 query；`queryInstance` 在 query 結束後**沒有清掉**（之後的 `setModel` / `accountInfo` 打到已結束的 query，失敗只記錄）。
- renderer（`src/components/ClaudeAgentPanel.tsx`）：送出時 `setIsStreaming(true)`（`:1546`）；`onResult` 一律 `setIsStreaming(false)`（`:764`）；`onError` 同；排隊提示 `.claude-queued-note`（`:1600` 起）；Esc `handleInterrupt`、停止 `handleStop`。

**既有功能依賴的假設**（方案 B 會打破的標 ✱，方案 D 會碰到的標 ◆）：

| # | 假設 | 依賴者 |
|---|---|---|
| A1 ✱ | 沒有背景子代理時，query 結束 ＝ 回合結束 ＝ CLI 程序結束 | `runQuery` finally、`messageQueue`、T0759 背景項目的上限、`queryInstance` 的有效性 |
| A2 ✱◆ | 主行程 `isStreaming` ＝「有 query 在跑」；renderer `isStreaming` 在第一個 `result` 就變 false | 送出分支、`cancelQueuedMessage.idle`、Esc / 停止按鈕可用性、T0762 等待卡 |
| A3 ✱◆ | 主回合中送出 ＝ 中斷＋重送（加前綴、清權限 / 提問卡） | D214 P-2、使用者習慣 |
| A4 ✱ | effort 只在 spawn 時生效 | `setEffort` |
| A5 ✱ | plugins（`installed_plugins.json`）、`settingSources`、runtime（embedded / system）、spawn env（`CLAUDE_CONFIG_DIR` 等）、`allowDangerouslySkipPermissions` 在 spawn 時決定，下一則訊息就生效 | runtime 設定「只影響新 session」、plugin 安裝、bypass 模式 |
| A6 ✱ | 開面板 / 還原分頁不起程序（BUG-177：第一則訊息才 spawn） | 啟動時資源、`v072-pre7-claude-panel-ui.spec.ts` |
| A7 ✱ | 關分頁只 `stopSession` 就夠（程序隨 query 結束） | `closeTerminalNow`、`--close-worker` 的面板分頁 |
| A8 ✱ | `ELECTRON_RUN_AS_NODE=1` 只在 query 期間寫進全域 `process.env`（`:973` 設、`:1219` 刪） | Electron 當 node 的 fallback；PTY env 已剔除（`pty-manager.ts:1484`），其他子程序沒有 |
| A9 ◆ | Cache History 每個 query 開頭 `resetQueryUsage`，R 列 ＝ 累計差（`turnModelUsage`，與 query 邊界無關） | T0744 / T0498 |
| A10 ✱◆ | 一個 query 只有一個使用者回合（T0769 注入之外）→ `currentPrompt`、「已中斷」前綴、`sawInit` 都以 query 為單位 | 中斷前綴、retry 判斷 |
| A11 | 權限 / AskUserQuestion 卡：`pendingPermissions` / `pendingAskUser` 在中斷路徑清掉 | T0762 |
| A12 | 背景子代理：`task_notification` 或 query 結束清項目；60 s 無進度標 `[stalled]` | T0759 |
| A13 | 工作清單（T0725）由 `TaskCreate` / `TaskList` 的 tool_use / tool_result 重播（`src/lib/claude-task-list.ts`），與 query 邊界無關（推論，本單未逐行查） | T0725 |

#### 2. 原型量測

**方法**：探測腳本放在 scratchpad（repo 外，收尾刪除）；引用 repo 的 `node_modules/@anthropic-ai/claude-agent-sdk`（0.3.316）與內嵌 `node_modules/@anthropic-ai/claude-code/bin/claude.exe`（2.1.316）。選項比照 BAT（`canUseTool`、`includePartialMessages`、`promptSuggestions`、`settingSources`、preset system prompt / tools、`thinking: adaptive`、`effort: high`、`agentProgressSummaries`、`perTaskStopAffordance: true`）。inbox ＝自寫的 push 型 AsyncIterable，每則 `SDKUserMessage` 帶 `uuid`。程序量測：Windows CIM `Win32_Process`（WorkingSet、Kernel+User CPU 時間），只量探測程式的子孫程序。

- **F（假 API）**：`e2e/fixtures/fake-anthropic-api.ts`（T0727）＋一層自寫的記錄 proxy（記錄每個請求的 `model` / `output_config` / 訊息數）；暫存 HOME / `CLAUDE_CONFIG_DIR` / cwd；`startBlockingProxy` 擋外連（CLI 嘗試 19 次 `CONNECT api.anthropic.com:443`，全部 403，沒有任何請求離開本機）。0 token、0 費用。
- **R（真實模型）**：Haiku 5.5（`claude-haiku-5-5`）、本機已登入的 claude（未登入 / 登出、未改設定與 credentials）；`settingSources: []`（不載入使用者的 hooks / MCP / plugins）、`persistSession: false`、`promptSuggestions: false`、`canUseTool` 一律拒絕（實際 0 次工具請求）；cwd 為暫存目錄。**共 6 輪 query**（上限 20）。

| 項目 | 結果 | 依據 |
|---|---|---|
| 主回合中送第 2 則（常駐） | **CLI 排隊**：第 2 則立即 `command_lifecycle queued`（`command_uuid` ＝ 我們給的 `uuid`）；第 1 回合 `result` 後 `completed`，第 2 則 `started`、跑自己的回合、自己的 `result`；順序不變、不合併 | 實測 F2；實測 R1/R2（真實：`alpha` → `beta` 兩個 result） |
| `result` 形狀 | **每個使用者回合一個 `result`**；`total_cost_usd` / `modelUsage` 為 session 累計（F：0.0001125 → 0.000126 …；R：0.0054547 → 0.00678145 → …）；`usage` 為單回合。每回合 CLI 都重送一次 `system/init`（含 14 個 capabilities：`interrupt_receipt_v1`、`interrupt_cancel_queued_v1`、`interrupt_send_now_v1`、`msg_lifecycle_v1` …） | 實測 F、R。→ T0744 的 `turnModelUsage`（累計差）不必改；`resetQueryUsage` 要改在每個回合開始（`command_lifecycle started`）時呼叫，不是在 push 時 |
| 權限請求等待中又送一則 | 第 2 則 `queued`；使用者允許後，在**工具結果的邊界折入同一回合**（`started` 與 tool_result 同時、請求訊息數 +1），**沒有自己的 `result`**，與該回合一起 `completed` | 實測 F3′ |
| 工具迴圈中（工具結果已送出）又送一則 | 不折入，該回合結束後自己跑一回合、自己的 `result` | 實測 F3″ → 送出時機決定「折入」或「下一回合」，UI 要以 lifecycle 為準 |
| `interrupt()` | 只停當前回合：回合 `result` `error_during_execution`、`usage` 全 0；generator 不結束；下一則正常。回執 `{ still_queued: [...] }` | 實測 F6a、R4（真實：數到 16 被停，之後 `delta` 正常，1.1 s 首字） |
| `interrupt()` 時有排隊訊息 | 回執 `still_queued` 列出其 uuid；**排隊訊息不被取消**，中斷後照跑 | 實測 F6b。現行 Esc 會清 `messageQueue`，要對齊須另外取消（下一列） |
| 取消排隊訊息 | `Query.cancelAsyncMessage(uuid)` 回 `true`、lifecycle `cancelled`、模型從未收到 | 實測 F6c。🔴 此方法在 `sdk.mjs` 有、**不在 `sdk.d.ts` 的 `Query` 型別**（T0768 遭遇問題 5）→ 實作需型別轉換＋SDK 升版時的守門測試 |
| 中途改模型 | `setModel('claude-sonnet-5-5')` → 下一回合請求的 `model` 換掉；`modelUsage` 依模型分開累計。CLI 會送一則 replay user 訊息 `<local-command-stdout>Set model to …`，並把它併進下一則送給模型的 user 訊息 | 實測 F5（請求 body）。BAT `processMessage` 只處理陣列 content 的 user 訊息，replay（字串）不顯示（`:1405`） |
| 中途改 effort | `applyFlagSettings({ effortLevel: 'low' })` → 下一回合請求 `output_config.effort: "low"`（之前 `"high"`），prompt suggestion 的旁請求也是 low；改回 `high` 生效 | 實測 F5；R3 呼叫成功（真實模型看不到參數，只確認不出錯） |
| 中途改權限模式 | `setPermissionMode('acceptEdits')` → CLI 送 `system/status`（`permissionMode: acceptEdits`），下一回合 Bash `mkdir` 0 次 `canUseTool`、目錄建立 | 實測 F4 |
| 閒置：程序數 / RSS / CPU | 每個常駐 query：**1 個 `claude.exe`＋1 個 `conhost.exe`（8.8 MB）**。第一則訊息前（已 spawn、未跑回合、0 個模型請求）：F 163 MB、R 198 MB。用過後閒置：F 213 → 211 → 206 MB（0 / 45 / 90 s），CPU 0.32 s / 90 s；R 221 → 216 → 213 MB（0 / 30 / 60 s），CPU 0.48 s / 60 s。閒置期間 0 個訊息、程序不會自己結束 | 實測 F7、R。使用者實際設定（MCP server、plugins、hooks）下每個常駐 query 還會常駐其 MCP 子程序：**推論**（R 刻意不載入使用者設定，未量） |
| 閒置收掉與重開 | 結束 inbox（沒有背景子代理）→ generator 正常結束：F 85 ms、R 342 ms，程序消失。重開：新 query＋`resume`＋inbox → F 第一個 `result` 在送出後 436 ms，`session_id` 相同、請求含先前全部歷史（47 則訊息） | 實測 F9 / F10、R |
| 首字延遲（暖程序 vs 現行每則新程序） | 暖程序：R3 1092 ms、R5 1149 ms。現行路徑（新程序、字串 prompt）：R6 首字 2391 ms、結束 3318 ms（兩者都命中 prompt cache）。R1 的 3518 ms 含 26,639 tokens 的 cache 寫入，不可比 | 實測 R，n = 1：**常駐約省 1.2 s / 則屬推論**（樣本 1 次、網路波動未控制） |
| 程序意外結束 | kill `claude.exe` → generator 22 ms 後丟 `Claude Code process exited with code 1`；之後 `setModel` reject `Query closed before response received`；往 inbox push 不會丟錯（inbox 是我們的）。🔴 錯誤訊息與 T0768 G0（interrupt 後 exit 1）相同，無法以訊息分辨 | 實測 F8 → 偵測靠 generator 結束；恢復 ＝ 下一則訊息以 resume 開新 query（F9） |
| **方案 D**：現行字串 query 主回合中 `streamInput` | **6/6 成功**（3 次在回合開頭、3 次在回合結束前約 0.5 s）：`streamInput` resolve、lifecycle `queued`、第 1 回合後跑第 2 回合、兩個 `result`、generator 正常結束、模型收到第 2 則 | 實測（lite 探測） |
| 方案 D：`result` 之後的窗口 | 看到 `result` 後 0 ms 呼叫：3/3 回執 `queued` 並跑完（2 個 result）。延遲 30 / 60 / 120 ms：3/3 立即 reject `ProcessTransport is not ready for writing`、無回執、模型沒收到。**6 次都沒有無聲遺失**（T0769 e2e 曾在 BAT 實機看到無聲遺失） | 實測（window 探測）。→ 以「有沒有 `queued` 回執」判斷是否送達，可同時涵蓋 reject 與無聲遺失（後者為推論） |

**token 與費用（只有 R 用到真實模型）**：

| | input | output | cache read | cache write | 費用（`total_cost_usd`） |
|---|---|---|---|---|---|
| 常駐 query（R1–R5，5 個 result，累計） | 1,185 | 31 | 74,523 | 32,429 | US$0.00736503 |
| 現行路徑對照（R6，一次） | 2 | 6 | 20,648 | 4,066 | US$0.00102288 |
| **合計（6 輪）** | | | | | **US$0.00838791** |

觀察（真實模型）：被中斷的回合（R4，已輸出到 16）沒有計入累計：中斷的 `result` 累計值不變，下一個 `result` 的增量也只有該回合本身 → **推論**：中斷回合的部分輸出不進 `modelUsage` / `total_cost_usd`。這是 CLI 既有行為（現行 Esc 也是 interrupt），與方案無關；記下供 T0744 參考。

#### 3. 設計：常駐 query（方案 B）

**狀態機**（每個面板 session 一個）：

```
NONE ──第一則訊息 / 喚醒──▶ SPAWNING ──system/init──▶ READY ⇄ BUSY
  ▲                                                     │
  ├──閒置回收 / LRU 淘汰 / 休眠 / 設定變更需重開（優雅：結束 inbox，5 s 後 close）──┤
  └──程序意外結束 / 停止（abort）（立即 close）────────────────────────┘
```

- **BUSY** ＝ 有已 `queued` / `started` 而未 `completed` / `cancelled` 的 uuid，或 CLI 自己的回合（`system/init` 到 `result` 之間、沒有對應 uuid，例：背景子代理結束後），或有背景子代理、權限 / 提問卡在等。**READY** ＝ 以上皆無。
- **建立**：lazy，第一則訊息才 spawn（維持 BUG-177：開面板、還原分頁不起程序）；有 `sdkSessionId` 就 `resume`。spawn 選項沿用現行 `queryOptions`，`prompt` 換成 inbox。
- **閒置回收**：READY 連續 `T_idle`（建議 10 分鐘）→ 結束 inbox（實測 85–342 ms 正常結束），5 s 未結束再 `close()`；保留 `sdkSessionId`，下一則以 resume 重開（實測 0.4 s 接回）。
- **休眠**（Sidebar）：等同立即回收；BUSY 時照現行先 abort。
- **切 worktree / reset**：cwd 綁 session，維持現行「拆掉重建」，舊 query `close()`。
- **關面板**：🔴 新增 `claude:dispose-session`（關閉 query、移出 map）；現行只 `stopSession`，常駐後會留下孤兒程序（A7）。
- **BAT 關閉 / headless 結束**：沿用 `killAll` / `dispose`（已 `close()`）。headless 的回收計時與上限在 server 端，各 host 各自計算。Terminal Server 與 recovery 不受影響（SDK 程序不在 Terminal Server 下）。
- **設定變更需重開**（A5：runtime、plugins、spawn env、切到 `bypassPermissions` 而 spawn 時沒帶 `allowDangerouslySkipPermissions`）：標記「下次 READY 時重開」，不打斷進行中的回合。最後一項是否真的需要重開未實測（推論；現行 `canUseTool` 在 app 層也會自動允許）。
- **程序意外結束**：generator 丟錯 → NONE；BUSY 中則照現行顯示錯誤、卡片標 error；不自動重開、不「Starting fresh」（沿用 T0769：init 之後的 `exited with code` 不重試）；下一則訊息 resume。
- **Esc**：`interrupt()`（只停回合，實測）；排隊訊息依 P-3 決定保留或以 `cancelAsyncMessage` 取消（現行行為 ＝ 取消）。
- **停止 / 雙 Esc**：維持「結束一切」＝ `close()` 程序（含背景子代理、排隊訊息），→ NONE。
- **effort**：`setEffort` 改為 READY / BUSY 時呼叫 `applyFlagSettings({ effortLevel })`（實測下一回合生效），NONE 時照舊存起來。**model / permission mode**：現行已即時呼叫，不變。
- **Cache History**：`resetQueryUsage` 移到每個回合開始（某 uuid 的 `started`，或沒有 uuid 的 `system/init`）；🔴 不可在 push 時呼叫（主回合還在串流時會清掉它的單次呼叫列）。折入的訊息沒有自己的 `result`，與該回合共用一列 R。
- **ELECTRON_RUN_AS_NODE**（A8）：🔴 常駐後全域 `process.env` 會一直帶著這個變數（git、gh、其他子程序都會拿到）→ 改經 `options.env` 傳給 SDK，不寫全域。

**inbox 與「待送」UI**（沿用 T0769 的提示 / 取消，並加上限）：

- 每則送出 ＝ `SDKUserMessage` 帶 `uuid`，主行程以 lifecycle 追蹤 `queued` / `started` / `completed` / `cancelled`；`claude:queued-messages` 照現行形狀列出「已 queued 未 started」的訊息，面板顯示「待送」＋取消。
- 取消：`cancelAsyncMessage(uuid)`（實測）；回 false / 失敗（已 started）→ 從清單移除並提示「已開始，無法取消」。
- 上限：每面板待送 8 則（同 T0788 `NOTIFY_HOLD_*` 的量級），第 9 則擋下並提示，不中斷目前回合。
- renderer `isStreaming`：不再在第一個 `result` 就結束，改看主行程送的回合狀態（建議新事件 `claude:turn-state { busy }`，或以待送清單＋result 推導）。
- 權限 / AskUserQuestion 卡等待時送出：CLI 在使用者回答後的工具邊界折入（實測 F3′）；卡片仍可回答；提示「回答後送出」。使用者若改在輸入框打字回答 AskUserQuestion，該訊息會卡在卡片後面 → 見 P-4。

#### 4. 影響表

| 功能 | 方案 D（W0） | 方案 B（W2–W3） | 風險 / 備註 |
|---|---|---|---|
| 主回合中送出 | 需改：注入目前 query＋回執；取代「中斷＋重送」 | 需改：push 到 inbox | 改 D214 P-2 行為（P-1） |
| 背景子代理執行中送出（T0769） | 需改：併入同一條注入路徑（不再限 `hasBackgroundTask`） | 需改：成為一般路徑，T0769 分支移除 | T0769 單元測試要改寫 |
| 排隊提示 / 取消（T0769 P-1） | 需改：排隊來源改為 lifecycle、取消改 `cancelAsyncMessage`；reject / 無回執仍走現行 resume 排隊 | 同左，再加上限 | `cancelAsyncMessage` 不在 d.ts |
| `isStreaming`（主行程 / renderer） | 需改：有未完成的 uuid 時 `result` 不結束「執行中」 | 需改：語意改為回合狀態 | 🔴 回歸面最大（停止按鈕、T0762 等待卡、縮圖狀態） |
| Esc（`stopSession`） | 不變（interrupt）；需處理 `still_queued` | 同左 | P-3 |
| 停止 / 雙 Esc | 不變 | 需改：`close()` 程序 | |
| 權限卡 / AskUserQuestion（T0762） | 需改：送出不再清卡、不 abort | 同左 | P-4 |
| retry（`exited with code`） | 不變（T0769 已限 init 前） | 不變 | |
| resume | 不變 | 需改：只在 spawn / 回收後重開時 | |
| `setModel` | 不變 | 不變（已即時呼叫）；replay 訊息不顯示（已如此） | |
| `setEffort` | 不變 | 需改：`applyFlagSettings` | |
| `setPermissionMode` | 不變 | 不變；bypass 旗標見設定變更重開 | 推論 |
| Cache History（T0744 / T0498） | 需改：`resetQueryUsage` 在 `started` 時呼叫 | 同左 | 單元＋真實模型 spec 複驗 |
| 背景子代理（T0759） | 不變 | 需改：「query 結束」不再是背景項目的上限，只剩 `task_notification` 與程序結束 | stalled 標示仍在 |
| 工作清單（T0725） | 不變（推論） | 不變（推論） | |
| 休眠（`isResting`） | 不變 | 需改：等同回收 | |
| worktree / reset | 不變 | 需改：關舊 query | |
| 關分頁 / ⏻ 重啟 | 不變 | 需改：`claude:dispose-session` | A7 |
| BAT 關閉 / headless | 不變 | 不變（`killAll`）＋回收計時在 server | |
| 新分頁不跑模型（BUG-177） | 不變 | 不變（lazy spawn） | e2e 守 |
| `getSupportedModels` probe | 不變 | 可選：READY 時改用常駐 query（省一個 probe 程序） | 非必要 |
| `forkSession` | 不變 | 不變（另開 query） | |
| ELECTRON_RUN_AS_NODE | 建議修（W1） | 必修 | A8 |
| 日誌 | 需改：`command_lifecycle` 降噪（現在每則都記一行 `[claude:msg]`） | 同左 | |
| Codex 面板 | 不涉及 | 不涉及 | |

#### 5. Settings 開關與資源上限建議

- **方案 D**：不加開關（行為修正，同 T0769 / D214 先例）；若使用者要保守，可加「主回合中送出：排隊（預設）/ 中斷＋重送」二選一。
- **方案 B**：加開關「Claude 面板常駐程序（實驗）」，Settings → 進階，**預設關**；關閉時程式路徑與 W0 / W1 後完全相同。驗收後再決定是否改預設開（另開決策）。
- **資源上限**（B）：同時常駐上限預設 **4** 個面板（每個閒置約 215 MB＋conhost 9 MB，實測；含使用者 MCP 時更多，推論）、閒置回收 **10 分鐘**；超過上限時回收最久未用的 READY；全部 BUSY 時新面板走現行一次性路徑（不排隊等程序、不擋使用者）。兩個值可設定、有上下限（上限 1–8，回收 1–60 分鐘）。

#### 6. 分階段實作工單草案（交塔台改寫）

**W0：主回合中送出改為注入目前 query（方案 D）**（S–M，需 P-1 裁示）

- affects_files：`electron/claude-agent-manager.ts`、`src/components/ClaudeAgentPanel.tsx`、`src/types/claude-agent.ts`、`electron/__tests__/claude-send-during-background-agent.test.ts`（改寫 / 擴充，或新檔 `claude-send-during-turn.test.ts`）、`src/__tests__/claude-panel-queued-message.test.tsx`、`e2e/v072-pre6-claude-panel.spec.ts`、三個 locale、`docs/agent-guide/claude-agent-sdk-cli.md`、`CLAUDE.md`「Sub-agent / Active Tasks Tracking」一行
- 做法：每則送出帶 `uuid`；`isStreaming` 且 query 未結束 → `streamInput`，等 `command_lifecycle queued` 回執（上限 2 s）；reject 或無回執 → 現行排隊（query 結束後 resume）。以 uuid 追蹤 `queued` / `started` / `completed`；`resetQueryUsage` 在 `started` 時；未完成 uuid 存在時 `result` 不結束「執行中」；取消改 `cancelAsyncMessage`（失敗回原路徑）；Esc 依 P-3 處理 `still_queued`。
- 必守：🔴 不 abort、不另開 query；🔴 不清權限 / 提問卡、不加「已中斷」前綴；🔴 不送空白訊息（BUG-177）；🔴 T0759 規則不變；🔴 同一則訊息不得送兩次（以 uuid 去重；無回執才重送）；🔴 `cancelAsyncMessage` 只經單一 helper 呼叫，SDK 升版必跑其測試。
- 驗收：單元（mock SDK：回合中送出 → `streamInput`、不 abort；回執 → 待送清單；無回執 / reject → resume 排隊；`started` 才重設 R 列；兩個 result 之間「執行中」不中斷；取消）＋突變檢查；假 API e2e（主回合用 gate 擋住時送第 2 則 → 待送提示 → 放行後兩則都有回覆、沒有「已中斷」前綴；權限卡等待時送出 → 允許後折入；取消待送）；**真實模型驗收**（Haiku 5.5：回合中送出被排隊並回覆；Esc 後下一則正常；R 列與 `total_cost_usd` 相符，`e2e/v072-real-model-claude-panel.spec.ts` 加情境）。
- 不回歸：e2e ⑦ / ⑦b / ⑦c、權限 allow / deny、BUG-177（`v072-pre7-claude-panel-ui.spec.ts`）、BUG-178、T0744 單元、`/resume`、圖片附件、雙 Esc 停止；`npm run typecheck` / `typecheck:electron` = 0、`npm run test:unit`、`npx vite build`。

**W1：前置修正（與 D / B 都有關）**（S）

- affects_files：`electron/claude-agent-manager.ts`、`electron/handlers/claude.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`、`src/stores/workspace-store.ts`、對應測試
- 內容：① `ELECTRON_RUN_AS_NODE` 改經 `options.env`，不寫全域 `process.env`；② `claude:dispose-session`（關閉 query、移出 map），`closeTerminalNow` 改呼叫它（⏻ 重啟維持 stop＋start）；③ query 結束時清 `queryInstance`；④ `command_lifecycle` 日誌降噪。
- 必守：🔴 PTY env 仍剔除 `ELECTRON_RUN_AS_NODE`（BUG-038）；🔴 `--close-worker` 的關閉路徑不變（只換 IPC）；遠端經 `PROXIED_CHANNELS`。
- 驗收：單元（fallback 時全域 env 不變、spawn env 有該變數；關分頁後 session 不在 map、`close()` 被呼叫）；`workspace-store.closeTerminalNow.test.ts` source guard 更新。

**W2：常駐 query 核心（開關預設關）**（M）——延後，觸發條件見〈7〉

- affects_files：`electron/claude-agent-manager.ts`（`SessionInstance` 加 inbox / 狀態機）、`src/types/index.ts`（Settings 欄位）、新測試 `electron/__tests__/claude-persistent-query.test.ts`
- 內容：lazy spawn、inbox push、lifecycle 狀態、BUSY / READY、`setEffort` → `applyFlagSettings`、程序結束 → NONE、resume 重開；開關關閉時走 W0 路徑。
- 必守：🔴 開關關閉時行為與 W0 / W1 後逐項相同（測試以同一組情境跑兩種設定）；🔴 開面板不 spawn；🔴 程序結束不自動重開、不 fresh retry。
- 驗收：假 API e2e（本單 F2–F10 的情境）；真實模型（Haiku：排隊、中斷、effort、閒置回收後 resume）。

**W3：生命週期管理與設定 UI**（M）

- affects_files：`electron/claude-agent-manager.ts`、Settings 進階頁元件、三個 locale、`electron/remote/headless-entry.ts`（若回收計時需 host 注入）
- 內容：閒置回收、上限與 LRU、休眠、設定變更需重開、headless；Settings 開關、上限、回收時間。
- 驗收：fake timers 的回收 / 淘汰單元；多面板 e2e（5 個面板、上限 4 → 程序數 ≤ 4）；實機量測（含使用者 MCP 設定下的程序數與 RSS）。

**W4：文件、真實模型驗收、預設值決策資料**（S）

- docs `claude-agent-sdk-cli.md` 新節、CLAUDE.md 一節；`e2e/v072-real-model-claude-panel.spec.ts` 常駐情境；量測報告供「是否預設開啟」決策。

需要真實模型驗收的項目：W0 的回合中送出 / Esc / Cache History；W2 的排隊、effort、回收後 resume；W3 的多面板資源量測。

#### 7. 為什麼建議延後方案 B，及觸發條件

- **理由**：PLAN-058 的主要使用者效益是「主回合中送出不中斷」，方案 D 已實測可達成，規模 S–M、不多常駐程序、開關不必要。方案 B 額外帶來的只有：回合間暖程序（首字約快 1.2 s，n = 1，推論）、effort 即時生效（現行下一則就生效，差異小）、回合之間能即時呼叫只在串流輸入可用的控制（目前 BAT 沒用到）；代價是每個面板約 215 MB 常駐、回收 / 上限 / 關分頁 / 設定重開等新生命週期，以及「query 結束」這個邊界消失帶來的回歸面。
- **觸發條件**（任一成立就開 W2）：
  1. SDK / CLI 改變方案 D 的前提（字串 prompt 的 query 在主回合中不再接受 `streamInput`，或回合後不再排隊）——W0 的守門測試會先紅；
  2. SDK 宣告字串 prompt / 每則一個 query 的用法棄用，或新功能只在常駐串流輸入下可用且使用者要用；
  3. 使用者回報回合間的首字延遲是主要不滿，且接受每個面板常駐約 200 MB 以上。

#### 8. 待決點（yolo：不問、不停；交塔台 / 使用者）

- **P-1**：是否以方案 D 改變 D214 P-2（主回合中送出由「中斷＋重送」改為「排隊 / 折入」）。建議：改（這正是 PLAN-058 的目的）；保守選項是 Settings 二選一、預設排隊。
- **P-2**：方案 B 是否依〈7〉延後（建議延後，先做 W0＋W1）。
- **P-3**：Esc 時已排隊的訊息：取消（與現行一致，建議）或保留（CLI 預設，中斷後照跑）。
- **P-4**：AskUserQuestion 卡等待中、使用者在輸入框送出文字：排隊到回答後（CLI 行為）或視為不回答並中斷提問（建議：排隊＋提示「請先回答上方問題」，不自動中斷）。
- **P-5**：W1 是否先獨立排程（`ELECTRON_RUN_AS_NODE` 全域寫入、關分頁不 `close()` 在現行也有小風險，與 B 無關也值得修）。

### 遭遇問題

1. 同一 checkout 有其他 Worker 的未提交修改（T0811 / T0812 及 `electron/pty-manager.ts`、`CLAUDE.md` 等）；本單只讀，未碰；行號以 HEAD `22360c65` 為準。
2. 真實模型探測即使 `persistSession: false`，CLI 仍在 `<Claude 設定目錄>/projects/<暫存 cwd 編碼>/` 建了一個**空的** `memory/` 目錄（auto-memory）；確認為空後刪除，目前無 t0813 相關項目。實作 B 時若以 `persistSession` 減少寫入，要知道這個目錄仍會建立（推論：每個 cwd 一次）。
3. 假 API 探測時 CLI 向 `api.anthropic.com:443` 嘗試 19 次連線（非模型流量），全部被擋 proxy 拒絕；不影響結果。
4. 量測限制：RSS / 首字延遲各只有 1–2 個樣本；真實模型探測刻意不載入使用者設定（MCP / plugins / hooks），實際 BAT 面板的常駐資源會更高（推論）；方案 D 的「無聲遺失」在探測中沒有重現（T0769 在 BAT 實機看過），回執判斷能否涵蓋該情境屬推論。
5. 探測暫存目錄（`%TEMP%\bat-t0813-*`）已全部刪除（0 個）；scratchpad 探測腳本不在 repo 內。

### 互動紀錄

- 無使用者 / 塔台問答（yolo，待決點寫在〈8〉，不提問）。

### 回報時間

2026-11-03T21:30:01+0800
