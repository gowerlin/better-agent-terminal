---
schema_version: 1
schema_kind: workorder
id: T0815
title: "PLAN-058 W0（方案 D）：Claude 面板主回合中送出改為排進同一個 query——不中斷、待送可取消、Esc 一併取消、提問卡等待時排隊並提示"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-03T21:31:40+0800"
started_at: "2026-11-03T21:49:10+0800"
updated_at: "2026-11-03T22:24:48+0800"
completed_at: "2026-11-03T22:24:48+0800"
session_ids:
  - "194e17b3-924f-42ea-8fc1-6c621ac0fc7f"
depends_on: [T0814, T0811]
related:
  - "PLAN-058；D259（改變 D214 P-2）；T0813 回報區〈2〉原型量測、〈3〉inbox 與待送 UI、〈4〉影響表、〈6〉W0 草案、〈8〉P-1 / P-3 / P-4；T0769 / BUG-192（背景子代理執行中注入、排隊提示）；T0759 / BUG-190；T0744（Cache History R 列）；T0762（權限卡 / 提問卡等待提示）；CLAUDE.md「Sub-agent / Active Tasks Tracking」「React Rendering」節"
affects_files:
  - electron/claude-agent-manager.ts
  - src/components/ClaudeAgentPanel.tsx
  - src/types/claude-agent.ts
  - "electron/__tests__/claude-send-during-background-agent.test.ts（改寫 / 擴充）或新檔 `electron/__tests__/claude-send-during-turn.test.ts`"
  - src/__tests__/claude-panel-queued-message.test.tsx
  - e2e/v072-pre6-claude-panel.spec.ts
  - e2e/v072-real-model-claude-panel.spec.ts
  - "src/locales/**（三個 locale 的新字串）"
  - docs/agent-guide/claude-agent-sdk-cli.md
  - CLAUDE.md
  - "electron/__tests__/claude-panel-prereq-t0814.test.ts（只在行為變更需要時調整，不得刪項）"
  - _ct-workorders/T0815-claude-panel-send-during-turn-queues.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 行為（D259，使用者裁示）：① 主回合中送出 → 以 `streamInput` 排進目前的 query（每則帶 `uuid`），等 `command_lifecycle queued` 回執（上限 2 s）；reject 或無回執 → 走現行排隊（query 結束後 resume 送出）。🔴 不 abort、不另開 query、不清權限 / 提問卡、不加「已中斷」前綴、不送空白訊息（BUG-177）、同一則不得送兩次（以 uuid 去重，無回執才重送）。② 面板顯示「待送」＋取消（沿用 T0769 的 `claude:queued-messages` / `claude:cancel-queued-message` 與 `.claude-queued-note`）；取消改 `Query.cancelAsyncMessage(uuid)`（不在 `sdk.d.ts`，只經單一 helper 呼叫＋SDK 升版守門測試），失敗（已 started）→ 移出清單並提示。③ Esc（`stopSession`）：`interrupt()` 停目前回合，並一併取消所有待送訊息（與現行一致）。④ AskUserQuestion 卡（與權限卡）等待時送出 → 排隊到回答之後（CLI 行為），面板提示「請先回答上方問題」，不自動中斷提問。⑤ 停止 / 雙 Esc 不變。"
  - "🔴 其他必守（T0813〈6〉W0）：以 uuid 追蹤 `queued` / `started` / `completed` / `cancelled`；`resetQueryUsage` 移到某 uuid `started`（或沒有 uuid 的 `system/init`）時呼叫，不在送出時呼叫；有未完成的 uuid 時第一個 `result` 不結束「執行中」（主行程與 renderer 的 `isStreaming`），停止按鈕、T0762 等待卡、縮圖狀態要跟著正確；T0769 的背景子代理注入併入同一條路徑（不再限 `hasBackgroundTask`），T0759 規則不變；`exited with code` 的不 resume 重試只在尚未收到 `system/init` 時（T0769）不變；`flushSync` 規則照 CLAUDE.md React Rendering 節。"
  - "🔴 不回歸：e2e ⑦ / ⑦b / ⑦c、權限 allow / deny、BUG-177（`e2e/v072-pre7-claude-panel-ui.spec.ts`）、BUG-178、T0744 單元、`/resume`、圖片附件、雙 Esc 停止、T0814 的 dispose-session；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`。"
  - "🔴 驗收含真實模型：Haiku 5.5（`claude-haiku-5-5`）在 `e2e/v072-real-model-claude-panel.spec.ts` 加情境（回合中送出被排隊並回覆、Esc 後待送被取消且下一則正常、R 列與 `total_cost_usd` 相符），總共不超過 20 個 query 輪次；使用本機已登入的 claude，不登入 / 登出、不改 `~/.claude`；費用記入回報。假 API e2e 用 `e2e/fixtures/fake-anthropic-api.ts`（主回合以 gate 擋住時送第 2 則 → 待送提示 → 放行後兩則都有回覆、沒有「已中斷」前綴；權限卡等待時送出 → 允許後折入；取消待送；Esc 取消待送）。單元＋突變檢查。"
  - "🔴 文件：`docs/agent-guide/claude-agent-sdk-cli.md` 新節（行為、uuid 追蹤、回執判斷、cancelAsyncMessage 守門）；CLAUDE.md「Sub-agent / Active Tasks Tracking」節把 T0769「主回合中送出（中斷＋重送）不變」改成新行為（遵守 CLAUDE.md 撰寫規則）。另補 T0814 的 CLAUDE.md 條目（T0814 不改 CLAUDE.md，見 T0814 回報區〈後續〉原文）：「Claude Agent SDK / CLI」節加一行（`sdkSpawnEnv(runtime, { electronRunAsNode })`、🔴 不得寫全域 `process.env`；`closeTerminalNow` → `claude:dispose-session`，舊 host reject → `stopSession`，⏻ 重啟維持 stop＋start；`runQuery` 結束清 `queryInstance`（generator 守衛），account / 指令 / agents 讀 `lastQueryInit`；連到 docs 該節），「Electron Runtime」節 BUG-038 那行補「T0814 起面板 query 不再寫全域 env」。"
  - "🔴 T0814（`fc22e04a`）已改 `claude-agent-manager.ts`：`queryInstance` 在 query 結束時清（generator 守衛）、`lastQueryInit` 快取、`disposeSession`、`command_lifecycle` 改為 `[claude:lifecycle]` debug 摘要（`commandLifecycleSummary`，未解析狀態）。本單在此基礎上解析 lifecycle 狀態，不得破壞 T0814 的 22 項測試（`electron/__tests__/claude-panel-prereq-t0814.test.ts`）。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）。"
---

# T0815 — Claude 面板主回合中送出改為排隊（PLAN-058 W0，方案 D）

## 元資料

- **工單編號**：T0815
- **類型**：implementation
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T21:31:40+0800
- **預估規模**：M
- **前置**：T0814（W1）、T0811（同一 checkout 改 `CLAUDE.md`）完成後才派

## 背景

現行 Claude 面板在主回合進行中送出 = 中斷＋重送（D214 P-2）：abort 目前回合、清權限 / 提問卡、加「已中斷」前綴後重送。T0813 實測（SDK 0.3.316 / CLI 2.1.316）：現行「每則訊息一個字串 prompt query」在主回合中呼叫 `Query.streamInput()`，CLI 一樣排隊並在第 1 個 `result` 後跑第 2 回合（6/6），以 `command_lifecycle` 回執（帶 `uuid`）可確認送達，`result` 之後的窗口會 reject 或成功回執、沒有無聲遺失；不需常駐程序。使用者 2026-11-03 裁示（D259）：改成排隊、Esc 一併取消待送、提問卡等待時排隊並提示；常駐程序（方案 B）延後。

## 範圍

見 memory_overrides。原型量測與設計細節以 T0813 回報區為準。

## 不做

- 常駐程序 / inbox（方案 B）、`setEffort` 改即時、Settings 開關（D259：不加）、發版、push。

## 驗收

- [x] 實作說明（送出分支、uuid 追蹤、回執判斷、isStreaming 規則、取消 helper）
- [x] 單元＋突變檢查
- [x] 假 API e2e 情境結果
- [x] 真實模型（Haiku 5.5）結果、輪次與費用
- [x] 不回歸清單結果；typecheck 0 / 0、unit、legacy、vite build
- [x] 文件更新

---

## 回報區

<!-- Worker 由此往下寫 -->

### 完成狀態

- **狀態**：DONE（六項驗收都有結果，見下；驗證閘全過）
- **產品 commit**：`0b67db03`（feat: Claude panel — a message sent during a turn is queued in the same query …，T0815）
- **落點檢查**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 前 5 項都存在（PASS，資訊性）；無 `branch` 欄位（C-2 不適用）。`CT_HOME` 未設（非 worktree）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **session_id**：194e17b3-924f-42ea-8fc1-6c621ac0fc7f

### 產出摘要

#### 1. 實作說明

- **送出分支**（`sendMessage`，`electron/claude-agent-manager.ts`）：query 進行中（`isStreaming`）且 CLI 不是「已知沒有回執」（`lifecycleReceipts !== false`）→ 空白訊息不送（BUG-177）；有 `queryInstance` → `sendIntoRunningQuery`（`streamInput` 送 `SDKUserMessage`，帶 `crypto.randomUUID()` 的 `uuid`）；query 還在建立（`queryInstance` 未設）→ `queueUntilQueryEnds`（排隊等 query 結束，不 abort）。🔴 不 abort、不另開 query、不清權限 / 提問卡、不加「已中斷」前綴。T0769 的背景子代理情境併入同一條路徑（不再限 `hasBackgroundTask`）。`lifecycleReceipts === false`（init 沒有 `msg_lifecycle_v1` 的較舊 CLI）→ T0769 注入與 D214 P-2 中斷＋重送**原樣保留**（既有 T0769 單元測試的 init 沒有 capabilities，正好守住這條）。
- **uuid 追蹤**（`SessionInstance.pendingSends`，key = uuid；`onCommandLifecycle`）：`sending` →（`queued` 回執）`queued` →（`started`）`started` → 下一個 `result` 視為已回答並移除；`completed` / `cancelled` 移除；`refused` / `discarded` 而且還沒 `started` → 改走 fallback。frame 形狀以 CLI 2.1.316 的 schema 為準：`{ type: 'system', subtype: 'command_lifecycle', command_uuid, state }`，state 列舉 `queued` / `started` / `completed` / `cancelled` / `discarded` / `refused`（`parseCommandLifecycle`，也接受 `{ type: 'command_lifecycle', uuid }`）。
- **回執判斷**：`system/init` 的 `capabilities` 含 `msg_lifecycle_v1` → `lifecycleReceipts = true`，送出後 `INJECT_RECEIPT_TIMEOUT_MS` = 2000 ms 內沒有 `queued` → `fallbackPendingSend`（query 還開著 → 進 `messageQueue`，query 結束後 resume 送出；query 已結束 → 直接 `runQuery`）。`streamInput` reject 同樣走 fallback。🔴 不重送兩次：fallback 期間 entry 保留為 `fallback`，晚到的 `queued` 回執把 `messageQueue` 裡的副本移除；query 結束時還在 `sending` / `queued` 的（CLI 先結束）才進 `messageQueue`，map 先清掉，晚到的 reject / 計時器找不到就不送。第一個 init 之前送出的，計時從該 init 開始；init 沒有 capability → 已送出的視為送達（不計時、不重送）。
- **`resetQueryUsage`**：送出時不呼叫；該訊息的 `started` 到時若上一回合已 `result`（`mainTurnDone`）→ 重設並 `mainTurnDone = false`（它自己的 R 列）；否則是折入正在跑的回合，不重設、共用一列。`system/init` 與 `started` 誰先到都一樣（init 不重設）。query 的第一回合（字串 prompt、沒有 uuid）照舊在 `runQuery` 開頭重設——這就是工單「沒有 uuid 的 `system/init`」的那一回合；CLI 自己開的回合（背景子代理結束後）維持 T0815 前的行為（見〈遭遇問題〉3）。
- **isStreaming 規則**：主行程 `isStreaming` 仍 = query 開著。`claude:result` 多 `pendingTurns`（`sending` / `queued` 數＋`messageQueue` 長度，`waitingSendCount`）；renderer `keepsStreamingAfterResult(resultData)` 為真時不 `setIsStreaming(false)`（停止按鈕、T0762 等待卡、縮圖的 activity 都跟著 `isStreaming`），舊 host 沒有欄位 → 照舊結束。取消的 `idle` 改由 `turnIdle` 計算（沒有 query，或最新回合已 `result` 且沒有 `sending` / `queued` / `started` 與排隊訊息）。Cache History 的回合錨點：執行中送出的訊息 id 排進 `queuedTurnMsgIdsRef`，`pendingTurns > 0` 的 `result` 時換下一個。
- **取消 helper**：`cancelSdkQueuedMessage(instance, uuid)`（唯一呼叫 `Query.cancelAsyncMessage` 的地方；型別轉換、方法不存在或丟錯回 false）。`cancelQueuedMessage` 改 async（IPC 介面形狀 `{ cancelled, idle }` 不變，preload / d.ts 不必改）：`messageQueue` 的副本直接移除；`queued` 的呼叫 helper，true → 取消，false → 已開始（`cancelled: false`，面板移除提示並顯示「這則訊息已開始處理，無法取消。」）；還沒回執的標 `cancel-requested` 回 `cancelled: true`，晚到的 `queued` 會再取消一次、計時器到期不重送。
- **Esc**（`stopSession`）：先把待送標 `cancel-requested`、對每則呼叫 helper，再 `interrupt()`（之後 CLI drain loop 會立刻開下一則，順序不能反）；回執 `still_queued` 裡屬於我們的再取消一次；待送清單清空。停止 / 雙 Esc / `/abort` / 休眠 / reset / dispose 經 `clearMessageQueue` 一併丟掉（含計時器）。
- **面板**：`.claude-queued-note` 多 `data-waits-for`；文字 `queuedNoteKey`：卡片等待時「請先回答上方問題，回答後送出。」、`turn`「目前回合結束後送出。」、`query` / 舊 host「等背景子代理結束後送出。」。三語系新增 `claude.queuedUntilTurnDone` / `queuedUntilAnswered` / `queuedMessageAlreadyStarted`。`ClaudeQueuedMessage` 多 `waitsFor?`。
- 未改：`electron/handlers/claude.ts`、preload、`electron.d.ts`、remote 清單（介面形狀不變，`cancel-queued-message` 回 Promise 由 `register` 處理）；`flushSync` 規則不涉及（待送與 result 不影響 active tasks bar）。

#### 2. 單元＋突變檢查

- 新檔 `electron/__tests__/claude-send-during-turn.test.ts`：28 項（帶 uuid、不 abort / 不另開 query / 卡片保留 / 無前綴 / 送出時不重設；`queued` → `pendingTurns: 1` → `started` 重設 → `pendingTurns: 0`；init 先到時 init 不重設、`started` 才重設；折入不重設；空白不送；背景子代理情境；2 s 沒回執 → 排隊、晚到回執去重、及時回執不排隊、reject、query 結束後 reject 只送一次、`refused`、query 先結束；query 建立中送出；capability 才計時、沒有 capability 走舊路徑；取消四種情況；Esc 先取消再 interrupt、`still_queued` 再取消、排隊副本丟掉；abort 後計時器不重送；`parseCommandLifecycle` / `cancelSdkQueuedMessage`；🔴 SDK 升版守門（`sdk.mjs` 仍有 `cancelAsyncMessage` → `cancel_async_message`、`sdk.d.ts` 仍沒有它；`claude-agent-manager.ts` 只有一個呼叫點））。
- `electron/__tests__/claude-send-during-background-agent.test.ts`：15 項全過（檔頭補註：這些 init 沒有 capabilities = 沒有回執的 CLI 的舊路徑）；`cancelQueuedMessage` 改 async，2 個斷言加 `await … resolves`。
- `src/__tests__/claude-panel-queued-message.test.tsx`：8 項（新增 `turn` / 卡片等待文字、已開始的取消移除提示並顯示訊息、`pendingTurns` 維持執行中、舊 host 照舊結束、`queuedNoteKey` / `keepsStreamingAfterResult`；原「取消找不到 → 提示留著」依 D259 ② 改為「移出清單並提示」）。
- `electron/__tests__/claude-panel-prereq-t0814.test.ts`：22 項全過，未改。
- 突變檢查（scratchpad 腳本：改壞 → 跑上面三檔 → 從備份還原並比對內容）：**13 / 13 被抓到**（拿掉 uuid、送出時重設、拿掉回執計時、晚到回執不去重、Esc 不取消、`pendingTurns` 恆 0、改回舊注入條件、`started` 不重設、query 結束丟掉未開始訊息、取消不看 CLI 回答、result 不計待送、renderer 忽略 `pendingTurns`、卡片提示不出現）。最終程式碼上重跑一次，結果相同。

#### 3. 假 API e2e（`e2e/v072-pre6-claude-panel.spec.ts`，最終程式碼）

| 情境 | 結果 |
|---|---|
| ⑦d 主回合以 gate 擋住時送第 2 則 | PASS — 提示「目前回合結束後送出。」（`data-waits-for=turn`）；放行後 `turn-a answer` → `turn-b answer`，同一段對話（turn-b 請求 27 則訊息、只送 1 次、沒有「使用者先前的訊息（已中斷）」前綴、turn-a 沒有重送）；提示消失、執行中結束 |
| ⑦e 取消待送 | PASS — 提示消失；擋住的回合照常回答；被取消的訊息 3 s 內 0 個請求 |
| ⑦f Esc 取消待送 | PASS — 提示消失、待送訊息 0 個請求；下一則正常回答 |
| ⑥b 權限卡等待時的待送 | PASS — 提示先是「目前回合結束後送出。」，權限卡出現後變「請先回答上方問題，回答後送出。」、卡片保留；按「是」→ mkdir 執行；CLI 在工具結果邊界折入同一回合（BAT 日誌 lifecycle `queued` → `started` → `completed`，沒有自己的回合）；只送一次、權限回合沒有重跑 |
| 不回歸 ①–⑫（同 spec 兩個 test） | ①②③④⑤⑥⑦⑦b⑦c⑧⑨⑩⑪⑫ 全 PASS（含 ⑦ / ⑦b / ⑦c、權限 allow / deny、BUG-178 ⑪⑫）；2 passed |

#### 4. 真實模型（Haiku 5.5，`e2e/v072-real-model-claude-panel.spec.ts` 新 test「T0815」，`BAT_E2E_REAL_MODEL=1 BAT_E2E_RUN_TAG=t0815 … -g T0815`）

- 本機已登入的 claude；未登入 / 登出、未改 `~/.claude`；spec 結束刪掉 `~/.claude/projects` 下名稱含 `bat-e2e-t0815` 的資料夾（剩 0）與 `%ProgramData%\bat-e2e-t0815-*`。
- ① 第 1 則（數 1 到 60）串流中送第 2 則 → 提示「目前回合結束後送出。」（`waits-for=turn`）；第 1 回合完整結束（「count finished」），之後才回「SECOND OK」；2 個 result 都 `success`；沒有中斷前綴；執行中結束。PASS
- ② 第 3 則（數到 300）串流中送第 4 則 → 提示出現 → Esc → 提示消失；10 s 後只有被中斷回合的 result（`error_during_execution`），沒有「APPLE」；下一則回「AFTER ESC」。PASS
- ③ Cache History：3 列 R（被中斷回合的累計不變，不另成列）逐列與 `[Claude result]` 累計差相符（input / c.read / c.write / output / $ 全 OK）；real $ 總計與 CLI `total_cost_usd` 相符。PASS
- **輪次與費用**：跑 2 次（第 1 次在中途版本、第 2 次在最終程式碼），每次 4 個使用者回合 / 4 個 result，**共 8 個 query 輪次**（上限 20）。費用（最後一個 `total_cost_usd`）：US$0.01265374 ＋ US$0.00918786 = **US$0.02184160**。第 2 次（最終）：R1 $0.004799 / R2 $0.003683 / R3 $0.000707，real $ 總計 $0.0092 vs CLI 0.00918786。

#### 5. 不回歸與驗證閘（最終程式碼）

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npm run test:unit` | 400 files passed / 2 skipped；7031 tests passed / 37 skipped |
| `npm run test:legacy` | 33 files、472 tests passed、0 failed |
| `npx vite build` | exit 0 |
| e2e ⑦ / ⑦b / ⑦c、權限 allow / deny | PASS（上表） |
| BUG-177 `e2e/v072-pre7-claude-panel-ui.spec.ts` | 2 passed（A1 開分頁不跑模型、A2 `/model`、A3 一則訊息 1 個 session 檔、B1–B5 CLAUDE_CONFIG_DIR） |
| BUG-178 | ⑪⑫（pre6 spec 第 2 個 test）、pre7 B1–B5 PASS |
| T0744 單元 / e2e `t0744-cache-history-cumulative.spec.ts` | 單元在 test:unit 內全過；e2e passed；真實模型 R 列相符 |
| `/resume` | pre7 A3 / B4 PASS |
| 圖片附件 `t0742-panel-image-attachments.spec.ts` | passed；單元「images go as content blocks」（T0769 檔）過 |
| 雙 Esc 停止 | 單元「stop / double-Esc (abortSession) drops everything」；e2e ⑦c Esc |
| T0814 dispose-session | `claude-panel-prereq-t0814.test.ts` 22 項過 |

驗證後只改了 `e2e/v072-real-model-claude-panel.spec.ts` 檔頭的 3 行註解（說明新 test），沒有改程式；其餘都是 commit 前最後一次驗證的內容。

#### 6. 文件

- `docs/agent-guide/claude-agent-sdk-cli.md`：新節「Claude 面板：主回合中送出排進同一個 query（T0815，PLAN-058 W0，D259）」（用途、規則、回執判斷、狀態、執行中、待送清單、卡片等待、唯一實作、已知限制、驗證）；T0769 節開頭加一段註明該節路徑只留給沒有回執的 CLI、P-2 已改變。
- `CLAUDE.md`：「Sub-agent / Active Tasks Tracking」節 T0769 那一行改寫（不再寫「主回合中送出（中斷＋重送）不變」），新增 T0815 一行；「Claude Agent SDK / CLI」節加 T0814 一行（`sdkSpawnEnv(runtime, { electronRunAsNode })`、🔴 不寫全域 env、`claude:dispose-session`、舊 host → `stopSession`、⏻ stop＋start、`queryInstance` 清掉與 `lastQueryInit`）；「Electron Runtime」節 BUG-038 那行補「T0814 起面板 query 不再寫全域 env」。檔案約 71k 字元（目標 ≤ 100k）。

### 相關通過案例判定

- 工單沒有〈相關通過案例〉段落（非客戶驗收工單）；不回歸以上表 e2e / 單元為準。

### 遭遇問題

1. **卡片等待時輸入框是隱藏的**（既有 UI：`pendingPermission || pendingQuestion` 時 textarea `display: none`）。所以 D259 ④ 實際的情境是「訊息先排隊、之後權限 / 提問卡出現」：待送提示改成「請先回答上方問題，回答後送出。」，回答後 CLI 折入或排在之後。本單沒有改輸入框的顯示（不在範圍、會動到卡片的鍵盤操作）；⑥b 依此情境撰寫。若塔台要讓使用者在卡片等待時也能打字送出，需另開單。
2. **Esc（沒有背景子代理）後面板出現 `Error: Claude Code returned an error result: [ede_diagnostic] …`**：T0768 回報區已記錄的既有行為（字串 query 被 interrupt 時 SDK generator 丟這個錯誤），與本單無關；⑦f / 真實模型 ② 都看到，行為不變。
3. 最初在 `system/init`（上一回合已 `result`）也做 `resetQueryUsage`，造成既有 `claude-cache-history-last-call.test.ts`「scenario 2 (V2)」重播失敗；分析後拿掉（uuid 回合在 `started` 重設已涵蓋兩種 frame 順序，CLI 自己的回合維持原行為）。另外 3 個既有測試手工組 session 物件、沒有 `pendingSends` → 改以 `sendsOf(session)` 惰性建立，不改範圍外的測試檔。
4. 假 API e2e 第一次寫 `not.toContain('已中斷')` 命中 ⑥ 拒絕工具卡片的既有文字「工具已中斷」，改比對完整前綴「使用者先前的訊息（已中斷）」。
5. e2e 日誌看到一次「result 之後、query 結束前」送出的訊息沒有回執、query 結束 → 以 resume 送出（`did not start before the query ended; sending with resume`）：正是 T0769 的「無聲遺失」窗口，現在由回執判斷補送、只送一次（該情境的請求只有一個）。
6. 已知限制（寫進 docs）：取消 / Esc 時 CLI 若已把訊息取出準備下一回合，`cancelAsyncMessage` 回 false，它照常執行；沒有回執的 CLI 在第一個 init 前送出的訊息要等 init 才決定是否計時；待送清單不跨面板重新掛載。

### 互動紀錄

- 無使用者 / 塔台問答（yolo；未提問）。
- [22:00 前後] 📥 塔台補充檢查：驗證前、commit 前、填報告前三個節點都沒有 `## 塔台補充（…）` 段落。

### 子代理與 Workflow 使用

- 無（未使用子代理或 Workflow）。

### 後續

- 可選：卡片等待時讓輸入框可送出（見〈遭遇問題〉1），需另開單、塔台決策。
- 方案 B（PLAN-058 W2–W4）照 T0813〈7〉延後；W0 的 SDK 守門測試（`claude-send-during-turn.test.ts`）是觸發條件 1 的哨兵。

### 回報時間

2026-11-03T22:24:48+0800
