---
schema_version: 1
schema_kind: workorder
id: T0759
title: "修正 BUG-190：背景 Agent 執行中留在 active task bar，結束時移除並標示結果"
type: implementation
status: DONE
updated_at: "2026-11-02T03:04:45+08:00"
completed_at: "2026-11-02T03:04:45+08:00"
started_at: "2026-11-02T02:42:59+08:00"
session_ids:
  - "734b3f6c-f0c8-447d-bedf-13eb990d76c2"
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T02:23:44+0800"
depends_on: [T0758]
related:
  - "BUG-190；T0739 回報區 F2（真實模型觀察）；T0727（假 Anthropic API e2e）；CLAUDE.md「Sub-agent / Active Tasks Tracking」"
  - "`electron/claude-agent-manager.ts`（`session.activeTasks`、`stopTask`）、`src/components/ClaudeAgentPanel.tsx`（active task bar）、`docs/agent-guide/claude-agent-sdk-cli.md`"
affects_files:
  - electron/claude-agent-manager.ts
  - electron/__tests__/
  - src/components/ClaudeAgentPanel.tsx
  - src/components/__tests__/
  - src/lib/
  - e2e/v072-pre6-claude-panel.spec.ts
  - e2e/fixtures/fake-anthropic-api.ts
  - docs/agent-guide/claude-agent-sdk-cli.md
  - CLAUDE.md
  - _ct-workorders/T0759-fix-bug190-background-agent-task-bar.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先查證：SDK 0.3.316 / CLI 2.1.316 對背景 Agent（`run_in_background: true`）送出哪些訊息：tool_use、立即回來的 tool_result 內容（是否帶 task id / 背景標記）、子代理完成時的訊息（`task_notification` / system message / 多出的回合內容）、`stopTask` 能否停背景子代理。依據：SDK 型別定義、CLI 二進位字串、假 API e2e 實錄（不用真實模型）。"
  - "🔴 修正方向：背景 Agent 在 tool_result 時不從 `activeTasks` 移除，改在完成 / 失敗 / 被停止的信號到達時移除；卡片描述標示結果（沿用既有 `[completed]` 等寫法）。前景 Agent / Task 行為不變（CLAUDE.md 規則：tool_result 清除、`flushSync` 只用於 Agent / Task）。收不到結束信號時要有上限（例：session 結束 / 回合結束時清除），不得永遠殘留。"
  - "🔴 驗收：假 API e2e 新增背景 Agent 情境：執行中 task bar 1 項、結束後 0 項、卡片標示完成；前景 Agent 情境照舊；`stopTask` 可停就驗，不能就照實寫。"
  - "🔴 驗證：新增 / 修改的單元測試＋突變檢查（拿掉修正，測試要失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`（依上方 build 規則的位置）。"
  - "🔴 build（Lane B：T0758 → T0759 → T0760 → T0766 → T0767，與 Lane A 並行）：主 checkout 的 `dist` / `dist-electron` 可能正被 Lane A 的 e2e 使用。`npx vite build` 與 e2e 一律在 `git archive` 匯出目錄做（`%TEMP%/bat-<工單>-build`，`node_modules` 以 junction 共用主 checkout，T0742 作法）；主 checkout 只跑 `npm run typecheck` / `npm run typecheck:electron` / `npm run test:unit`。跑完刪匯出目錄（先刪 junction 本身，確認主 checkout `node_modules/electron` 仍在）。e2e 一律用隔離實例。"
  - "🔴 文件：CLAUDE.md「Sub-agent / Active Tasks Tracking」節補一句背景 Agent 規則；細節寫進 `claude-agent-sdk-cli.md`。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0759 — 修正 BUG-190：背景 Agent 執行中留在 active task bar，結束時移除並標示結果

## 元資料

- **工單編號**：T0759
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-02T02:23:44+0800
- **預估規模**：M

## 背景

T0739 以真實模型觀察到背景 Agent 執行中不在 active task bar、結束沒有完成標示。D210 排入本批。

## 範圍

1. 查證背景 Agent 的訊息序列。
2. 修正 `activeTasks` 生命週期與卡片標示。
3. 假 API e2e、單元測試、文件。

## 不做

- 不用真實模型；不改前景 Agent；不做 Claude 面板 ⚠️（T0762）；不發版。

## 驗收

- [ ] 查證有證據
- [ ] 單元＋e2e（假 API）＋突變檢查；typecheck 0 / 0、`test:unit`、`vite build`（匯出目錄）
- [ ] 文件更新

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：DONE（驗收三項全過：查證有證據；單元＋假 API e2e＋突變 / 驗紅；typecheck 0 / 0、`test:unit`、`vite build`（匯出目錄）；文件已更新）
- **產品 commit**：`b8a3b7f7` fix: keep background Agents in the active task bar until they end (T0759, BUG-190)（9 檔，`git commit --only`）
- **validated_sha**：驗證時工作樹內容 = `b8a3b7f7` 的 9 檔（基底 HEAD `e39d6f74` 匯出＋這 9 檔覆上，sha256 逐檔比對一致）。全量 `test:unit` 跑在把卡片 class 從 `claude-task-result` 改名為 `claude-task-end-label` 之前；改名後重跑了相關單元測試、兩個 typecheck、`vite build` 與 e2e（見下）。
- **落點檢查**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 皆存在或祖先存在；無 `branch` 欄位（C-2 不適用）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_HOME` 未設（非 worktree）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- **session_id**：734b3f6c-f0c8-447d-bedf-13eb990d76c2

### 產出摘要

#### 1. 查證（SDK 0.3.316 / CLI 2.1.316，T0727 假 API，不用真實模型）

探測腳本（scratchpad，不進 repo）以 SDK `query()` + 內嵌 `claude.exe` + `e2e/fixtures/fake-anthropic-api.ts`（子代理請求 gate 住）錄下訊息序列：

- **背景**（`run_in_background: true`；不帶參數時 CLI 2.1.316 也預設背景，`sdk-tools.d.ts` AgentInput 註解「Agents run in the background by default」，實錄相同）：
  `tool_use Agent` → `background_tasks_changed`（含該 task）→ `task_started`（`is_backgrounded: true`、`tool_use_id`、`task_type: local_agent`）→ user `tool_result`「Async agent launched successfully…」（`tool_use_result.status: 'async_launched'`、`isAsync: true`）→ 主回合 `result`（+0.4 s）→（放行子代理）子代理文字（`parent_tool_use_id`）→ `task_updated`（`patch.status: completed`）→ `task_notification`（`status: completed`、`summary` = 子代理最後的文字）→ `background_tasks_changed`（空）→ 第 2 個 `system init` + CLI 自己的 1 個回合（第 2 個 `result`）→ query 結束。
  → BUG-190 根因：tool_result 在啟動時就到，`activeTasks` 隨即清掉；另外 `task_notification` 寫的 `[completed] …` 描述，卡片只在 `running` 時顯示（`ClaudeAgentPanel.tsx` 進度列），所以結束後看不到。
- **前景**（`run_in_background: false`）：`task_started`（`is_backgrounded: false`）→ 子代理訊息 → `task_updated` / `task_notification`（completed）→ user `tool_result`「[Subagent hand-back] …」（`tool_use_result.status: completed`）→ 主回合繼續。
- **`stopTask`**：
  - 送 **task_id**、主回合還在跑：`task_updated`（`killed`）+ `task_notification`（`stopped`）→ resolve。
  - 送 **tool_use_id**：**resolve 但不停**，子代理照跑完、`task_notification` 是 `completed`。修正前 `activeTasks` 同一子代理有兩筆（tool_use 時 key = tool_use_id、`task_started` 時 key = task_id），`stopTask` 先找到 tool_use_id 那筆 → 送的正是這個 id、還把卡片標 `[stopped by user]`（前景 / 背景都一樣）。
  - 主回合 `result` 之後：最小選項（字串 prompt、無 `canUseTool`）時 SDK 在第一個 `result` 就關 CLI 輸入（`sdk.mjs` `endRun` → `transport.endInput()`），`stopTask` / `interrupt` 不送達，到 query 結束才 reject `Query closed before response received`；加上 BAT 的選項（`canUseTool`、`promptSuggestions`、`includePartialMessages`）時輸入仍開著，`stopTask` 送達並停下（探測 + e2e ⑦b 都確認）。
  - 主回合還在跑時 `interrupt()` 會殺背景子代理（`stopped`）；`result` 之後（最小選項）不送達。

#### 2. 修正

- `electron/claude-agent-manager.ts`：
  - `ActiveTask.background`；`applyToolResult`（兩個 tool_result 分支共用）：背景項目的 tool_result 不移除、卡片保持 `running` 並帶 `isBackground: true`；錯誤的 tool_result 照舊結束。
  - 背景判定：`task_started.is_backgrounded`、`task_updated.patch.is_backgrounded`（前景改背景）、只帶一個 tool_result 的 user 訊息 `tool_use_result.status === 'async_launched'`（沒有 `task_started` 的舊 CLI）。
  - `task_started` 把 tool_use 時登記的項目改以 task_id 為 key（一個子代理一筆）→ `stopTask` 送對的 id。
  - `task_notification` 先以 task_id、再以 tool_use_id 找項目，刪掉同一 tool_use 的所有項目（避免殘留項目被 60 s 停滯檢查改寫成 `[stalled]`）。
  - `stopTask` 失敗時：背景項目若已結束（notification 先到）不蓋掉結果；仍在跑就只把描述改 `[stop failed] …`、保持 `running`。前景的失敗路徑不變。
  - 上限：沒有結束信號時，`runQuery` finally 清空 `activeTasks` 並把仍 `running` 的卡片標 error（既有）。主回合 `result` 不清。
- `src/types/claude-agent.ts`：`ClaudeToolCall.isBackground?`。
- `src/lib/agent-task-label.ts`（新）：`isBackgroundAgentCall`（「背景」標籤：主行程旗標或 `run_in_background: true`）、`backgroundAgentResultLabel`（已結束的背景卡片顯示 `[completed] …` / `[failed] …` / `[stopped …`）。
- `src/components/ClaudeAgentPanel.tsx`：卡片 `.claude-task-end-label`（沿用 `.claude-task-progress` 樣式）、卡片與 task bar 的「背景」標籤改用 `isBackgroundAgentCall`。前景卡片照舊（結束後顯示 tool_result，不加標示）。
- 文件：`docs/agent-guide/claude-agent-sdk-cli.md` 新增「Claude 面板的背景子代理（T0759 / BUG-190）」節（規則、判定、唯一實作、訊息序列、`stopTask`、已知限制、驗證）；`CLAUDE.md`「Sub-agent / Active Tasks Tracking」補一條背景例外。

#### 3. 驗證

| 項目 | 結果 |
|---|---|
| 新單元測試 `electron/__tests__/claude-background-agent.test.ts`（11 項：背景完成 / 失敗 / 舊 CLI / 前景改背景 / 錯誤 tool_result / re-key；前景 2 項不變；`stopTask` 送 task_id、失敗不蓋結果、失敗仍 running）＋ `src/lib/__tests__/agent-task-label.test.ts`（3 項）＋既有 `claude-sdk03-task-tools.test.ts` | 3 檔 16 passed |
| 突變檢查（改壞後跑上面兩檔，再以備份還原） | M1 拿掉背景保留 → 7 failed；M2 拿掉 re-key → 6 failed；M3 拿掉 stop 失敗防護 → 2 failed；M4 拿掉 tool_use_id 查找 → 1 failed；M5 拿掉 `task_updated` 處理 → 1 failed；M6 卡片標示回 null → 1 failed。全部抓到 |
| `npm run typecheck` / `npm run typecheck:electron` | 0 / 0（主 checkout） |
| `npm run test:unit` | 368 files、6556 passed、10 skipped（主 checkout） |
| `npx vite build` | exit 0（匯出目錄 `%TEMP%\bat-T0759-build` = `git archive` HEAD `e39d6f74` ＋本單 9 檔，`node_modules` junction） |
| e2e `e2e/v072-pre6-claude-panel.spec.ts`（匯出目錄、隔離實例） | **2 passed（25.4 s）**。⑦b：主回合結束後 bar 1 項 `"T0759 bg probe"`、標籤 `["背景"]`，等 2 s 仍 1 項；放行子代理 → bar 0、卡片 dot-success、`[completed] bg sub-agent finished`；第 2 個背景子代理從 bar 按停止 → bar 0、卡片 `[stopped by user] T0759 bg stop probe`。⑦（前景）照舊：bar 1 → 0、dot-success |
| e2e 驗紅（匯出目錄換回 HEAD 的 `claude-agent-manager.ts`，blob `57fc4b3d` 比對一致，重 build） | 1 failed / 1 passed：失敗在 `v072-pre6-claude-panel.spec.ts:361`「主回合結束後 bar 應 1 項」，實得 0（= BUG-190）。之後還原修正版並重 build |
| 清理 | 匯出目錄已刪（先刪 junction，主 checkout `node_modules\electron` 仍在）；探測殘留 `%TEMP%\bat-t0759-probe-*` 3 個、`%ProgramData%\bat-t0759-probe-*` 3 個已刪（逾時中斷的探測留下的）；`%ProgramData%\bat-e2e-t0727-*`、`%TEMP%\bat-t0727-*`、使用者 `~/.claude/projects` 下 t0727 / t0759 項目：0 |

`stopTask`：**可停**，已驗（e2e ⑦b 從 task bar 停止背景子代理）。

### 遭遇問題

1. **與工單「不改前景 Agent」的關係（自行決定，事後回報）**：`task_started` 改 key 讓前景子代理的 `stopTask` 也改送 task_id。修正前前景按停止會送 tool_use_id → resolve 但子代理沒停、卡片卻標 `[stopped by user]`（實錄見〈查證〉）。前景的 tool_result 清除、`flushSync`、卡片顯示都沒改（單元測試「foreground Agent is unchanged」與 e2e ⑦）；`task_notification` 改成刪掉同一 tool_use 的所有項目，前景最後結果相同（completed + tool_result）。
2. **`affects_files` 外的檔案**：`src/types/claude-agent.ts`（`ClaudeToolCall.isBackground` 一個欄位，IPC 帶給 renderer 用）。沒有改其他工單範圍外的檔。
3. **e2e 第一次失敗**：新卡片 class 取名 `claude-task-result` 與卡片既有的結果區塊同名（strict mode 解析到 2 個元素），改名 `claude-task-end-label` 後通過；該次執行的 bar 斷言（主回合結束後仍 1 項、子代理結束後 0 項）已通過。
4. **驗紅第一次無效**：以 PowerShell 管線寫入 HEAD 版本時編碼被改、build 失敗，e2e 跑的仍是修正版（2 passed）。改用原樣輸出（blob hash 比對一致）重做，才得到上表的紅版結果。主 checkout 的 `dist` / `dist-electron` 未被本單改動（最新寫入時間 02:48:17，早於本單任何 build）。
5. 工作期間同一 checkout 有 T0757 / T0761 Worker 並行；本單只 commit 自己的 9 檔，`CLAUDE.md` / `docs` 在別人的修改已 commit 後才改（`git diff` 確認乾淨）。

### 後續建議（交塔台判斷）

- **背景子代理執行中送新訊息會殺掉它**（既有行為，本單未改）：背景子代理在跑時 query 仍在進行（`isStreaming`），`sendMessage` 走「中止目前 query 再送」路徑，CLI 被中止、背景子代理一起結束，卡片標 error `Agent terminated unexpectedly`，新訊息前面加「使用者先前的訊息（已中斷）」。CLI 2.1.316 的 Agent 預設背景，這會常見。可能方向：改用串流輸入（同一個 query 送後續訊息）並宣告 `perTaskStopAffordance`，或在背景子代理執行中把新訊息排隊。建議另開研究單。
- `background_tasks_changed`（level 信號）目前不用；若日後出現漏掉 `task_notification` 的情況，可作為第二道清除依據。
- 真實模型下的實機確認（T0739 ⑤ 的情境）未做（工單不用真實模型）。

### 互動紀錄

- 無使用者 / 塔台問答（yolo，沒有需要塔台決定的問題）。

### 回報時間

2026-11-02T03:03:49+0800
