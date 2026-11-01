---
schema_version: 1
schema_kind: workorder
id: T0768
title: "研究：BUG-192 背景子代理執行中送新訊息的做法（串流輸入 vs 排隊 vs 其他），附實作單草案"
type: research
status: DONE
started_at: "2026-11-02T03:08:57+0800"
updated_at: "2026-11-02T03:19:36+0800"
completed_at: "2026-11-02T03:19:36+0800"
session_ids:
  - "a2a500de-02c9-495b-bbc3-af07be6ab994"
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T03:08:29+0800"
depends_on: []
related:
  - "BUG-192；D213；T0759 回報區（訊息序列、`stopTask` / `interrupt` 實錄、〈後續建議〉）；BUG-190 / T0759；T0727（假 Anthropic API）"
  - "`electron/claude-agent-manager.ts`（`sendMessage`、`runQuery`、`activeTasks`、中止路徑）、`src/components/ClaudeAgentPanel.tsx`、`node_modules/@anthropic-ai/claude-agent-sdk`（`sdk.mjs`、`sdk.d.ts`、`sdk-tools.d.ts`）、`docs/agent-guide/claude-agent-sdk-cli.md`「Claude 面板的背景子代理」"
affects_files:
  - _ct-workorders/BUG-192-claude-panel-new-message-kills-background-agent.md
  - _ct-workorders/T0768-research-bug192-message-during-background-agent.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只研究：不改產品程式碼、不跑 `vite build`、不跑既有 e2e（與 Lane A / B 並行）；探測腳本放 scratchpad，以 SDK `query()` ＋內嵌 `claude.exe` ＋ `e2e/fixtures/fake-anthropic-api.ts`（T0759 作法），不用真實模型、不連外。不動使用者的 `~/.claude`（探測用暫存 `CLAUDE_CONFIG_DIR`），跑完清掉。"
  - "🔴 查證：① 現況重現（背景子代理執行中送新訊息 → 中止與錯誤訊息）；② SDK 0.3.316 的串流輸入（AsyncIterable prompt）能否在同一個 query 內於背景子代理執行中送後續訊息、主回合與子代理的訊息怎麼交錯、`perTaskStopAffordance` 是什麼、`stopTask` / `interrupt` 在串流輸入下的行為；③ 排隊方案：子代理結束（`task_notification`）後才送、使用者可取消排隊；④ BAT 現行功能在串流輸入下是否仍成立（權限 `canUseTool`、`setPermissionMode`、`promptSuggestions`、resume、Cache History 的 result 累計 T0744、中止按鈕、BUG-177 的空 prompt）。每項附 SDK 原始碼位置或實錄。"
  - "🔴 產出：2–3 個方案的取捨表（使用者看到的行為、改動範圍、風險、規模）、建議方案、實作單草案（affects_files、必守規則、驗收：單元＋假 API e2e 怎麼造情境、不回歸清單）、需要使用者偏好的〈待決點〉（不問塔台、不停下）。寫在回報區；BUG-192 只在文末補〈研究結果〉摘要，status 不改。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0768 — 研究：BUG-192 背景子代理執行中送新訊息的做法（串流輸入 vs 排隊 vs 其他），附實作單草案

## 元資料

- **工單編號**：T0768
- **類型**：research
- **優先級**：P2
- **建立時間**：2026-11-02T03:08:29+0800
- **預估規模**：S

## 背景

T0759 發現：Claude 面板的背景子代理執行中送出新訊息，會中止整個 query、子代理一起被結束。CLI 2.1.316 的 Agent 預設背景，這會常見。使用者決定開 BUG-192 並先研究、排進本批（D213）。

## 範圍

查證 ①–④、方案取捨、建議、實作單草案、待決點。只研究。

## 不做

- 不改產品程式碼；不 build；不用真實模型；不發版。

## 驗收

- [ ] ①–④ 有證據（SDK 原始碼位置或實錄）
- [ ] 方案取捨表、建議、實作單草案、待決點

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：DONE（研究單；驗收兩項：①–④ 皆有 SDK 原始碼位置或實錄；取捨表、建議、實作單草案、待決點都在下方）
- **產品 commit**：無（只研究，未改產品程式碼、未 build、未跑既有 e2e）
- **落點檢查**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 兩個檔皆存在；無 `branch` 欄位（C-2 不適用）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_HOME` 未設（非 worktree）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- **session_id**：a2a500de-02c9-495b-bbc3-af07be6ab994

### 產出摘要

**結論**：建議**方案 C「在仍開著的 query 上注入」**：主回合 `result` 之後、query 還開著（背景子代理在跑）時，新訊息改用 `Query.streamInput()` 送進同一個 query，並在 query 選項宣告 `perTaskStopAffordance: true`；注入失敗（輸入已關）就排隊、等 query 結束後照現行路徑以 resume 送出。改動集中在 `electron/claude-agent-manager.ts`，renderer 幾乎不動。方案 B（整個面板改成常駐串流輸入）長期最乾淨但改動大，列為後續選項。

行號以 HEAD `80e760fb` 為準（工作期間 T0760 已 commit 改動此檔，另有 Worker 的未提交修改）。SDK 檔案在 `node_modules/@anthropic-ai/claude-agent-sdk/`（0.3.316）；`sdk.mjs` 是壓縮檔，以行號＋引用字串定位。

#### 1. 查證

探測腳本 `t0768-probe.mts`（scratchpad，不進 repo）：SDK `query()` ＋內嵌 `node_modules/@anthropic-ai/claude-code/bin/claude.exe`（2.1.316）＋ `e2e/fixtures/fake-anthropic-api.ts`（子代理請求以 `gate` 擋住）；暫存 HOME / `CLAUDE_CONFIG_DIR` / 工作目錄、擋外連 proxy（全部 8 個情境的 proxy attempts 都是 `[]`）。選項比照 BAT（`canUseTool`、`includePartialMessages`、`promptSuggestions`、`agentProgressSummaries`、`settingSources`、preset system prompt / tools）。

**① 現況重現（情境 A）**

- BAT 路徑（code）：主回合 `result` 時 renderer `onResult` 把 `isStreaming` 設 false（`src/components/ClaudeAgentPanel.tsx` `api.onResult`），但主行程的 `session.state.isStreaming` 要到 query 結束（`runQuery` finally，`claude-agent-manager.ts:1061`）才變 false；背景子代理在跑時 query 不會結束（SDK 只在 `session_state_changed: idle` 才 `endRun`，見 ②）。使用者送訊息 → `sendMessage` 見 `isStreaming` 走 `:761` 分支：`abortController.abort()`、清 `pendingPermissions` / `pendingAskUser` / `messageQueue`、在新訊息前加「`[使用者先前的訊息（已中斷）: …]`」（`:770`）、排進 `messageQueue`；finally 把仍 `running` 的卡片標 error `Agent terminated unexpectedly`（`:1069`）、清 `activeTasks`（`:1063`），再以 resume 跑新 query（`:1078`）。
- 實錄（A）：result #1 0.4 s → `abort()` 1.4 s → generator 8.4 s 才丟 `Operation aborted`（abort 約 7 s 才收尾）→ resume 的新 query 第一個訊息是 CLI 補發的 `task_notification status=stopped summary="Background agent \"T0768 bg probe\" didn't finish before the previous session ended"`，接著一個 `turns=0 cost=0` 的空 result（model-less turn），才是新訊息的回合。模型收到的請求含 task-notification 標記，但**沒有**子代理的結果。→ BUG-192 現象成立；另外 resume 的 query 有兩個 result（空的那個會讓 renderer 提早結束 streaming 狀態，既有行為）。

**② SDK 0.3.316 的串流輸入（情境 B1 / B2 / C / E / F / G / G0）**

| 查證 | 結果 | 證據 |
|---|---|---|
| 字串 prompt 何時關 CLI 輸入 | `isSingleUserTurn = typeof prompt === "string"`；收到 result 時若 `sessionState` 不是 idle 且有雙向需求（`canUseTool` 等）就不關，等 `session_state_changed: idle` 才 `endRun` → `transport.endInput()`。背景子代理在跑 = 不 idle = 輸入開著 | `sdk.mjs:152` `this.endRun();else this.armRunEndCeiling()`、`hasBidirectionalNeeds(){`；`sdk.mjs:157` `Run ended for single-turn query, closing stdin` |
| AsyncIterable prompt 能否在背景子代理執行中送後續訊息 | **能**。B1 / B2：result #1（子代理擋住）→ push 第 2 則 → 0.1 s 後第 2 個回合、result #2，子代理仍在跑；之後再送 Bash 回合也正常；放行子代理 → `task_notification completed` → CLI 自己跑一個回合（再一個 result）。一個 CLI 程序、`session_id` 不變 | 實錄 B1 / B2 |
| 在 BAT 現行字串 query 上用 `Query.streamInput()` 注入 | **能**（C）：result #1 後 `streamInput([followup])` → 第 2 個回合正常、子代理不受影響；放行後 notification + CLI 回合，`streamInput` 在 run 結束時 resolve，query 正常結束。`streamInput` 的流程：送完訊息後若有雙向需求就 `waitForRunEnd()` 再 `endInput()` | 實錄 C；`sdk.mjs:157` `Has bidirectional needs, waiting for the run to end`；`sdk.d.ts:3313` |
| 輸入已關後再 `streamInput` | 立即丟 `ProcessTransport is not ready for writing`（0 ms），訊息沒有送出（假 API 0 個請求）→ 可偵測、可退回排隊 | 實錄 F |
| 主回合進行中送第 2 則（串流） | CLI 自己排隊：`command_lifecycle` 事件，第 1 回合結束後第 2 則跑自己的回合（不合併、不中斷） | 實錄 E；`SDKUserMessage.priority?: 'now' \| 'next' \| 'later'`（`sdk.d.ts:6588`，未測） |
| 訊息交錯 | 主回合訊息 `parent_tool_use_id: null`；子代理訊息帶 `parent_tool_use_id`（`assistant(sub)`）；`task_*` 系統訊息與主回合在同一個串流交錯；子代理結束後 CLI 會自己起一個回合（新的 `system/init` ＋ `result`），使用者沒送訊息也會有 | 實錄 B1、C、D |
| `perTaskStopAffordance` 是什麼 | 宣告「本 consumer 有逐 task 的停止控制（`stop_task`）」。宣告後，輸入開著的 session 上 `interrupt` 只中止目前回合、**不殺**背景子代理；不宣告（預設）時 `interrupt` 會殺背景子代理（fail-closed）。字串 prompt / `-p` 的 one-shot 例外：held result 釋放時 hold-back task 仍會被殺 | `sdk.d.ts:1849-1868`（Options）、`sdk.d.ts:4768`（initialize request）；`sdk.mjs` 以 `perTaskStopAffordance:this.initConfig?.perTaskStopAffordance` 送進 initialize |
| `interrupt()` 實測 | 串流＋宣告（B1）：回合 `error_during_execution`，背景子代理 8 s 內無 notification（仍在跑）。串流不宣告（B2）：子代理 `killed` / `stopped`。**字串 query＋宣告＋注入回合中 interrupt（G）**：子代理不受影響，放行後 `completed`，query 正常結束。字串 query 不宣告（G0）：子代理被殺，之後 generator 丟 `Claude Code process exited with code 1` | 實錄 B1 / B2 / G / G0 |
| `stopTask` 實測 | 串流、result 之後：`task_updated killed` ＋ `task_notification stopped`，resolve（B1 / B2）。CLI 接著送一則 `[Request interrupted by user]` 的 user 訊息並自己跑一個回合 | 實錄 B1 / B2 |
| 結束輸入 / `close()` 時背景子代理 | 串流結束 iterable、子代理仍在跑：generator **不結束**，等子代理（B1 等 25 s 仍開著）。`close()`：generator 立即結束，**沒有** `task_notification`（程序被結束）→ BAT 需自己把卡片收尾（現有 finally 會標 error） | 實錄 B1 |
| 對照：現況 Esc（字串、無背景子代理，H） | `interrupt` → `error_during_execution` → generator 丟 `Claude Code returned an error result: [ede_diagnostic] …`（既有行為，本單未查 BAT 畫面上的呈現） | 實錄 H |

**③ 排隊方案（情境 D）**

- 字串 query、result #1 後不送；放行子代理 → `task_notification completed` → CLI 自己的回合（result #2）→ generator 正常結束；之後以 resume 送排隊的訊息 → 正常回合。模型收到的請求**含**子代理結果（`finished T0768`）與 task-notification 標記。→ 排隊可行，子代理不受影響，且模型知道結果。
- 代價：要等子代理結束（可能很久）；排隊的訊息之前會先有 CLI 自己的回合（以真實模型而言，是模型對子代理結果的回應）。取消排隊只是 BAT 端從 `messageQueue` 移除，SDK 無需介入。

**④ BAT 現行功能在串流輸入 / 注入下是否成立**

| 功能 | 串流輸入（方案 B） | 注入（方案 C） | 證據 |
|---|---|---|---|
| 權限 `canUseTool` | 成立：第 3 回合 Bash `mkdir` → `canUseTool(Bash)` 被呼叫、允許後目錄建立 | 同一個 query 的 callback，不變 | B2 |
| `setPermissionMode` | 成立：回合間切 `acceptEdits` → 下一回合 Bash `mkdir` 不再詢問（0 次 `canUseTool`），目錄建立 | 輸入開著時可用（`sdk.d.ts:2959` 只限串流輸入；字串 query 在 idle 前輸入仍開） | B2；T0759 ⑦b 也在 result 後送達 `stopTask` |
| `promptSuggestions` | 每個 result 後都有 `prompt_suggestion` | 不變 | B1 / B2 / C 原始輸出 |
| resume | 同一程序內不需 resume；`session_id` 全程不變 | 注入不換程序；query 結束後照現行 resume | B1、C、D |
| Cache History（T0744） | 每個 result 的 `modelUsage` / `total_cost_usd` 在同程序內持續累加（B1：30 → 60 → 105 → 150 …） | 同 | B1；`turnModelUsage`（`src/lib/cache-history.ts:120`）以「本次累計 − 上一個 result 累計」計算，與 query 邊界無關，不受影響。🔴 但 `resetQueryUsage`（`claude-agent-manager.ts:1087`，T0498 用 `modelUsage === undefined` 區分串流中 / 已結束）目前只在 `runQuery` 開頭呼叫（`:994`），注入 / 串流時要在每次送出時呼叫 |
| 中止按鈕 | Esc（`stopSession` → `interrupt`）：宣告後只停回合；雙 Esc / 停止（`abortSession` → abort）殺整個程序、子代理一起 | 同；🔴 `stopSession` 目前把 `session.state.isStreaming` 設 false（`:1574`），若 query 因背景子代理仍開著，下一則訊息會走「非串流」路徑另開一個 query → 同一 session 兩個 CLI 程序 | G / G0；code |
| BUG-177 空 prompt | 串流 query 可以先不 yield（`idleSdkPrompt` 已用這招，`claude-agent-manager.ts:205`），不跑回合；🔴 不可 push 空字串訊息（字串 `''` / `' '` 會跑一個完整回合） | 不涉及（只注入使用者實際送出的訊息） | docs `claude-agent-sdk-cli.md` 開頭「`idleSdkPrompt`」；code `:969` 的 `prompt \|\| ' '` |
| `continue: true`（resume 且 prompt 空白） | 串流下沒有「空白 prompt 接續」的需要 | 不變 | code `:963` |
| `effort` 切換 | 目前是 query 選項（`setEffort` 只存給下一個 query）；常駐 query 要改用 `applyFlagSettings({ effortLevel })`（`sdk.d.ts` Query，約 3043 行起） | 不變（注入的回合沿用該 query 的 effort） | code `setEffort` |

#### 2. 方案取捨表

| | A 排隊 | C 注入（建議） | B 常駐串流輸入 |
|---|---|---|---|
| 使用者看到 | 背景子代理在跑時送出 → 訊息標「排隊中（等背景子代理結束）」＋取消；子代理結束、CLI 回應結果後才處理 | 背景子代理在跑時送出 → 立即得到回應，子代理繼續跑、卡片與 task bar 不變；Esc 只停目前回合 | 同 C；另外主回合中送出也可改成 CLI 排隊（E），不再「中斷＋重送」 |
| 改動範圍 | `sendMessage` 分支、`messageQueue` 加排隊狀態 / 取消 IPC、renderer 顯示排隊列 | `sendMessage` 分支＋「主回合已 result」旗標、`perTaskStopAffordance: true`、`stopSession` 的 `isStreaming` 修正、retry 防護、`resetQueryUsage` 時機；renderer 不變 | `runQuery` 生命週期整個改寫（每 session 一個常駐 query、inbox、何時結束 / 重開、`isStreaming` 語意、`messageQueue` / retry / resume / 休眠 `isResting` / `effort` / `setModel` / worktree / headless 全部重驗） |
| 風險 | 低；但長時間子代理期間無法對話，等於沒解決「背景」的用意 | 中低：依賴「字串 query 在背景子代理跑時輸入仍開」（SDK 內部行為，T0759 / 本單實錄；SDK 改了 → 注入丟錯 → 退回排隊，不會殺子代理）；輸入關閉瞬間的競態（F：立即丟錯、可偵測） | 高：程序常駐（每個面板一個閒置 claude 程序）、所有既有功能回歸面大 |
| 規模 | S | S–M | L |

#### 3. 建議

採 **C ＋退路 A**：

1. 主回合已 `result`、query 仍開著 → `streamInput` 注入（CLI 若正忙會自己排隊，E）。
2. `streamInput` 丟錯（輸入已關 / 程序已結束）→ 排進 `messageQueue`，query 結束後照現行 resume 送出（D 已證明模型看得到子代理結果）。
3. 主回合本身還在跑（沒有 result）時維持現行「中斷＋重送」行為（不在 BUG-192 範圍；見〈待決點〉P-2）。
4. 同時宣告 `perTaskStopAffordance: true`（BAT task bar 已有逐項停止，T0759 ⑦b 實測），讓 Esc 不殺背景子代理，也避開 G0 的 `exit code 1`。

方案 B 列為後續：若日後要做「主回合中送出也不中斷」或面板常駐程序，再開研究 / 實作單。

#### 4. 實作單草案（交塔台改寫）

- **標題**：修正 BUG-192：背景子代理執行中送出新訊息改為注入同一個 query（不中止子代理）
- **affects_files**：`electron/claude-agent-manager.ts`、`electron/__tests__/claude-background-agent.test.ts`（或新檔 `electron/__tests__/claude-send-during-background-agent.test.ts`）、`e2e/v072-pre6-claude-panel.spec.ts`（加情境）、`docs/agent-guide/claude-agent-sdk-cli.md`（「Claude 面板的背景子代理」節）、`CLAUDE.md`（「Sub-agent / Active Tasks Tracking」一行）；視待決點 P-1 可能加 `src/components/ClaudeAgentPanel.tsx` 與三個 locale
- **做法**：
  1. `SessionInstance` 加 `mainTurnDone`（`runQuery` 開頭 / 注入時 false，`result` 時 true）。
  2. `sendMessage`：`isStreaming && mainTurnDone && queryInstance` → 廣播 user 訊息（`addMessage`）、`resetQueryUsage`、`currentPrompt = prompt`、`mainTurnDone = false`，`queryInstance.streamInput(單則 SDKUserMessage，圖片沿用 `runQuery` 的 content blocks 組法)`；reject → 排進 `messageQueue`（不清 `pendingPermissions`、不加「已中斷」前綴），log 一行原因。其餘情況維持現行分支。
  3. `queryOptions` 加 `perTaskStopAffordance: true`。
  4. `stopSession`：query 仍開著（背景子代理在跑）時不要把 `session.state.isStreaming` 設 false（改由 `runQuery` finally 設）；或另設旗標讓 `sendMessage` 走注入 / 排隊，不得另開 query。
  5. `runQuery` catch 的「`exited with code` → 不 resume 重試」只在**還沒收到 `system/init`** 時才做（G0：interrupt 後 exit 1 不得變成「Starting fresh」重跑）。
- **必守規則**：
  - 🔴 不得在背景子代理執行中 `abort()` 或另開 query（同一 session 不得同時有兩個 CLI 程序）。
  - 🔴 注入路徑不清 `pendingPermissions` / `pendingAskUser`（背景子代理可能正在等權限）、不加「使用者先前的訊息（已中斷）」前綴。
  - 🔴 不送空白訊息（BUG-177）；注入只送使用者實際送出的內容。
  - 🔴 T0759 規則不變：背景項目只由 `task_notification` 或 query 結束清除；主回合 `result` 不清。
  - 🔴 `interrupt` / `stopTask` 語意：宣告 `perTaskStopAffordance` 後 Esc 只停回合，逐項停止走 task bar；雙 Esc / 停止（abort）仍結束整個 query（含子代理）——除非待決點 P-3 另定。
  - Cache History：注入的回合也要有獨立的 R 列（`resetQueryUsage` 在注入時呼叫；`turnModelUsage` 不改）。
- **驗收**：
  - 單元（mock `queryInstance.streamInput`）：result 後送出 → 呼叫 `streamInput`、不 abort、背景卡片仍 `running`、`activeTasks` 不變、user 訊息有廣播；`streamInput` reject → 進 `messageQueue`、query 結束後以 resume 送出；主回合未 result → 走現行中斷路徑（對照）；`perTaskStopAffordance: true` 在選項內（source / 選項斷言）；`stopSession` 後 query 仍開著時再送 → 不另開 query；interrupt 後 `exited with code 1` 不觸發「Starting fresh」。突變檢查：拿掉注入分支 → 失敗。
  - 假 API e2e（`e2e/v072-pre6-claude-panel.spec.ts` 加 ⑦c）：`bg-agent` 情境、`gate('bgsub')`；主回合結束後在面板送 `[[T0727:followup]] next` → 斷言回覆 `followup answer` 出現、task bar 仍 1 項、卡片沒有 `Agent terminated unexpectedly`；`release('bgsub', 0)` → bar 0、卡片 `[completed] …`。再一段：注入的回合用 `gate('slow')` 擋住時按 Esc → 背景卡片仍 running，放行後 completed。驗紅：換回 HEAD 的 `claude-agent-manager.ts` 重 build → ⑦c 失敗在「卡片被標 error」。
  - 不回歸清單：e2e ⑦（前景 Agent）、⑦b（背景完成 / task bar 停止）、權限 allow / deny 情境、BUG-177（新分頁 0 個模型請求、0 個 session 檔，`v072-pre7-claude-panel-ui.spec.ts`）、BUG-178（`CLAUDE_CONFIG_DIR`）、Cache History R 列（T0744 單元）、`/resume`、圖片附件送出、主回合中送出的中斷＋重送、雙 Esc 停止；`npm run typecheck` / `typecheck:electron` = 0、`npm run test:unit`、`npx vite build`。

#### 5. 待決點（需要使用者偏好；本單不問、不停）

- **P-1 注入失敗退回排隊時的畫面**：只在訊息下加一行「等背景子代理結束後送出」＋取消按鈕，或不顯示（建議顯示＋可取消；這是少見的競態，但等待可能很久）。
- **P-2 主回合本身還在跑時送出**：維持「中斷＋重送」（現行，建議本批維持），或改成背景子代理存在時 `interrupt`（宣告後不殺子代理）＋注入，或全面改成 CLI 排隊（E 的行為，等同方案 B 的使用者體驗）。
- **P-3 雙 Esc / 停止按鈕**：維持「結束一切含背景子代理」（建議，task bar 可逐項停），或背景子代理在跑時改成只停回合。
- **P-4 方案 B 是否列入後續規劃**：常駐串流輸入（每個面板一個常駐程序、主回合中也能排隊對話）。

### 遭遇問題

1. 工作期間同一 checkout 有其他 Worker 未提交的修改（含 `electron/claude-agent-manager.ts`、`CLAUDE.md`、`docs/agent-guide/claude-agent-sdk-cli.md`）；本單只讀，報告行號改以 HEAD `80e760fb` 為準，未碰這些檔。實作單動工前需確認對方已 commit。
2. 第一次 B1 探測 `setPermissionMode('acceptEdits')` 在 Bash 回合之前，`mkdir` 被 acceptEdits 自動允許，看不出 `canUseTool`；B2 改成先在 default 模式測 `canUseTool`、再測切模式，兩者都成立。
3. B1 第一次跑完清暫存目錄時 `EPERM`（CLI 程序還在，佔住工作目錄）；手動刪除後改成重試刪除。所有探測暫存目錄（`%TEMP%\bat-t0768-probe-*`）已清，數量 0；使用者 `~/.claude/projects` 無 t0768 項目。
4. 觀察到但不在本單範圍：G0 / B2 中 interrupt 後 CLI `exit code 1`；H（現況 Esc）generator 丟 `Claude Code returned an error result: [ede_diagnostic] …`；A 中 resume 的 query 先有一個 `turns=0` 空 result。BAT 畫面上怎麼呈現未查，實作單的 retry 防護（做法 5）會碰到前者。
5. `Query.cancelAsyncMessage` 在 `sdk.mjs` 有實作（送 `cancel_async_message`）但不在 `sdk.d.ts` 的 `Query` 介面；方案 C 不需要它（排隊在 BAT 端）。`SDKUserMessage.priority` 與 `rapidFollowupPreempt` 未測。

### 互動紀錄

- 無使用者 / 塔台問答（yolo，待決點依工單寫在回報區，不提問）。

### 回報時間

2026-11-02T03:19:36+0800
