---
schema_version: 1
schema_kind: workorder
id: T0693
title: "研究：塔台 Renew 工單、Worker 重讀繼續執行後，BAT 分頁標籤仍顯示 ✓（已回報）— 是否該回到執行中，該由什麼信號清除，對批次關閉與 CT 契約的影響（只查不修）"
type: research
status: DONE
repo: better-agent-terminal
project: ""
priority: P2
sizing: M
created_at: "2026-10-21T23:50:57+0800"
started_at: "2026-10-21T23:51:56+0800"
updated_at: "2026-10-21T23:56:24+0800"
completed_at: "2026-10-21T23:56:24+0800"
depends_on: []
related:
  - "使用者提問（2026-10-21 第八十九 session）：「塔台 Renew 工單後，通知 Worker 重讀繼續執行，BAT 終端 title 狀態已打勾，是否要設回執行中（無勾狀態）？」"
  - "PLAN-041 / T0538：分頁標示與手動批次關閉；已回報比對唯一實作 `findReportingWorkers`（`src/stores/workspace-store.ts`）；批次關閉的頁內確認 `.worker-batch-close-dialog`"
  - "T0609 / BUG-153：Worker 標籤 ⚠️ / `?` / `✓`，判斷唯一實作 `workerAttention`（`src/lib/terminal-attention.ts`），主行程推送 `terminal:attention-changed`（`TerminalAttentionNotifier`，`electron/terminal-attention.ts`）；提問與 blocked 不計入批次關閉"
  - "T0545 / D145：`--close-worker` 等安靜；只有排程後的使用者輸入取消；T0551 `isTerminalAutoReply`"
  - "T0590 / T0600 / T0621：`TerminalBlockedTracker`（hook / OSC 7501 的 working / idle / blocked、`agentStarted`）可能是「Worker 又開始工作」的信號來源"
  - "CT Renew 機制：塔台在工單加 `## 塔台補充（Renew #N）`、`renew_count` +1，再讓 Worker「重讀工單」（control-tower `references/research-workorder.md` § Renew 機制；yolo 下的實際送達方式見 `references/yolo-mode.md`）。CT 收單後回收 Worker 分頁只在工單 `status == DONE` 且本次不 Renew 時執行（`work-order-system.md` § 收單後回收 Worker 分頁）"
affects_files:
  - _ct-workorders/T0693-research-worker-tab-check-after-renew.md
  - "_ct-workorders/_report-T0693-worker-tab-check-after-renew.md（回報太長時另寫，選用）"
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只查不修：不改任何產品程式、測試檔、`package.json`、CI 設定、CLAUDE.md、docs。暫存檔與除錯輸出一律放 Worker 的 scratchpad。"
  - "🔴 結論要有證據：每個「現況是 X」都附檔案:行號、測試名稱或實測紀錄；推論與事實分開標示（【推論】）。"
  - "🔴 可以用隔離實例實測（沿用 e2e 的隔離 userData 做法，需先 `npx vite build`），但不得碰使用者正在用的 BAT、已安裝的 BAT 與使用者的 userData；不得對其他分頁（含本塔台與其他 Worker）送任何輸入。若某項只能在使用者的 BAT 上才看得到，寫進回報的「待實機確認」，不執行。"
  - "🔴 可以自己開唯讀子代理平行讀程式碼與工單；回報區要有「子代理使用」紀錄：幾個、做什麼、約多少 tokens（讀不到就寫怎麼估的）。不使用 Workflow 工具（本單沒有授權）。"
  - "🔴 跑 helper 相關測試時，`BAT_HELPER_LOG_DIR`、`BAT_USER_DATA` 指到 scratchpad（CLAUDE.md 規則）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報只用代稱，不寫真名、家目錄路徑或權杖。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit `affects_files`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0693 — 研究：Renew 後 Worker 分頁仍顯示 ✓

## 元資料

- **工單編號**：T0693
- **類型**：research（只查不修）
- **優先級**：P2
- **建立時間**：2026-10-21T23:50:57+0800
- **預估規模**：M

## 研究目標

Worker 回報後，BAT 在它的分頁標籤加上 `✓`。塔台若 Renew 這張工單、讓 Worker 重讀並繼續做，標籤仍是 `✓`，看起來像已完成。要回答：

1. `✓` 應不應該在 Worker 重新開始工作時回到「執行中」（無 `✓`）？
2. 如果應該，由什麼信號清除最可靠，要不要 CT 配合？
3. 不清除會造成什麼實際問題（特別是批次關閉）？

## 已知資訊

- `✓` 的比對與顯示：`findReportingWorkers`（`src/stores/workspace-store.ts`）、`workerAttention`（`src/lib/terminal-attention.ts`）；⚠️ / `?` 有自己的清除規則，`✓` 的清除規則未知。
- 批次關閉（T0538）把「已回報」的 Worker 列進候選；提問與 blocked 不計入。【推論】若 Renew 中的 Worker 仍顯示 `✓`，使用者可能在批次關閉時把正在工作的 Worker 一起關掉。
- CT 的自動回收只在 `status == DONE` 且不 Renew 時執行，所以 CT 本身不會因 `✓` 誤關；風險在使用者手動操作與畫面判讀。
- Worker 重新開始工作時，可能出現的信號：使用者或塔台送進 Worker 分頁的輸入、claude hook（`UserPromptSubmit` / `PreToolUse` 等，看 `BAT_CLAUDE_HOOKS` 實際註冊哪些）、codex OSC 7501 `state=working`、PTY 輸出、工單檔 `status` 從 DONE / PARTIAL 等改回 `IN_PROGRESS`。

## 調查範圍

1. **`✓` 的生命週期**：何時設、依什麼比對（通知文字？工單編號？Worker 的 notify 呼叫？）、何時清除、是否持久化（BAT 重開後還在嗎）、主行程或 renderer 哪一端持有狀態。
2. **Renew 的實際路徑**：CT 在 yolo / 非 yolo 下怎麼讓 Worker 重讀（使用者手動輸入、塔台經 helper 寫入 Worker 分頁、或 Worker 自己監看工單檔），這些路徑各會觸發 BAT 哪些事件。查 BAT 權杖範圍：塔台能不能寫入自己的 Worker 分頁（`HELPER_CHANNEL_ROLES`、`authorizeHelperInvoke`）。
3. **現況實測或推演**：Worker 回報 → `✓` → Renew → Worker 開始工作 → 再回報，每一步的標籤狀態。同一張工單第二次回報時會不會重複、錯亂或不更新。claude 與 codex Worker 都要涵蓋（codex 可用推演，附依據）。
4. **影響**：批次關閉候選、`--close-worker` 等安靜 / 取消規則、`terminal:attention-changed` 的消費端、CT 讀 `bat_list_terminals` / `bat_get_state` 時會不會誤判。
5. **方案比較**（至少下列幾種，可增加）：
   - a. Worker 回報後再出現「開始工作」的信號（hook working、OSC working、使用者 / 塔台輸入後有新輸出）就清除 `✓`；
   - b. 塔台 Renew 時以新的 helper 參數或 channel 明確通知 BAT（需新契約與 CT 配合）；
   - c. 監看工單檔 `status` 改回非終態；
   - d. 不清除 `✓`，改成批次關閉時排除「回報後又在工作」的 Worker，或標籤改成另一種符號（例如「已回報、又在執行」）。
   每個方案寫：可靠度（漏清 / 誤清的情境）、改動範圍（檔案與唯一實作位置）、是否需要改 BAT ↔ CT 介面契約、是否影響遠端 headless、測試方式。

## 研究指引

- 先讀 CLAUDE.md「Worker 分頁回收」「blocked 狀態偵測」「Worker 啟動確認」「Worker 問塔台」各節與對應 `docs/agent-guide/` 檔，再看程式。
- 判斷「應不應該清除」時，以使用者看標籤做的決定為準（批次關閉、要不要切過去看），不以「現在的程式碼就是對的」為準。

## 互動規則

- yolo、`--no-interactive`：不得問使用者。判讀問題問塔台，每輪最多 3 題（`research_max_questions: 3`）。

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

無（本單沒有需要塔台判讀的問題，未送 `提問`）。

### 完成狀態

**DONE**（research，只查不修；未改任何產品程式、測試、設定或文件）

- 落點檢查：**PASS**。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1：工單在 `REPO_ROOT/_ct-workorders/` 下；C-3：`affects_files` 只有 `_ct-workorders/` 項目 → not applicable；C-2：工單無 `branch` 欄位。非 worktree（`CT_HOME` 未設定）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- 驗證：`npx vitest run src/stores/__tests__/workspace-store.workerReport.test.ts` → 12 passed；`npx vitest run src/stores/__tests__/workspace-store.workerAttention.test.ts` → 18 passed（`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指到 scratchpad）。沒有開隔離實例實測：`✓` 的設定與清除全在 renderer 的純函式與 store，程式碼加既有單元測試已能確定現況（見下方事實表）；真正需要實機的項目列在「待實機確認」。

### 互動紀錄

無（yolo、`CT_INTERACTIVE=0`，未問使用者，也未問塔台）。

### 調查結論

#### 1. `✓` 的生命週期（事實）

| 項目 | 現況 | 證據 |
|---|---|---|
| 誰持有 | **只有 renderer**：`TerminalInstance.workerReport { message, reportedAt }`，每個視窗各自一份 | `src/types/index.ts:77-83`；`electron/`、`scripts/` 底下沒有任何 `workerReport` 參照（grep 0 筆，測試除外） |
| 何時設 | Worker 的 `terminal:notified`：`targetId` = 該分頁的 `towerTerminalId`、`source`（`--source "T####"`）= 該分頁的 `workorder`，訊息不是 `提問` 結尾、也沒帶 `questionId` | `src/App.tsx:510-521` → `workspaceStore.markWorkerReported`（`src/stores/workspace-store.ts:677-697`）→ `findReportingWorkers`（`:43-52`）、`workerNotifyKind`（`src/lib/terminal-attention.ts:71-74`） |
| 何時清除 | **只有下一次 notify**：一般回報 → 換成新的 `workerReport`；`T#### 提問` → 換成 `workerQuestion`（`?`）；`bat-notify --ask`（帶 `questionId`）→ 兩者都清掉。另外就是分頁關閉 | `workspace-store.ts:683-689`；測試 `a later report replaces the message …`（`workspace-store.workerReport.test.ts:135`）、`already ✓ (or the old CT ?) before --ask → nothing once the question ends`（`workspace-store.workerAttention.test.ts:256`） |
| 會被什麼蓋過（不是清除） | main 的 `terminal:attention-changed`：hook / codex OSC 的 `blocked`（⚠️）、塔台問題（`?`）優先於 `✓`；事件消失後 `✓` 又出現 | `terminal-attention.ts:87-98` |
| 使用者輸入、hook、OSC、PTY 輸出 | **都不碰 `✓`**。使用者輸入只清 hook `blocked`；`UserPromptSubmit` / `Stop` hook 在 main 只當「清除 blocked」事件；codex OSC `working` 只清 `input`；輸出只更新 `lastActivityTime`（縮圖旁的活動點） | `electron/terminal-blocked-state.ts:111-120`（`'user-prompt-submit': null`、`stop: null`）、`:50-55`；`electron/bat-mcp-launch.ts:161-162`；`src/components/TerminalThumbnail.tsx:293`（`ActivityIndicator`） |
| 持久化 | **有**：跟 `towerTerminalId` / `workorder` 一起存，BAT 重開後還在；detached 視窗交回時取較新的 | `workspace-store.ts:207-224`（`workerOwnership`）、`:1149-1151`、`:1203-1204`；測試 `save() → load() keeps the report (still shown after BAT reopens)`（`workerReport.test.ts:154`） |
| 標題顯示 | 預設標題已含工單號（T0553）時，徽章只顯示 `✓`；使用者改過名則顯示 `✓ T####` | `TerminalThumbnail.tsx:216-226`、`:268-279` |

結論：Worker 回報後，不管它又做了什麼，`✓` 都會留著，直到它再 notify 或分頁關閉。

#### 2. Renew 的實際路徑與觸發的 BAT 事件

| 路徑 | 怎麼讓 Worker 重讀 | BAT 收到的事件 | 對 `✓` 的影響 |
|---|---|---|---|
| R1：研究工單 Renew（原分頁繼續） | 塔台改工單（`## 塔台補充（Renew #N）`、`renew_count` +1），**告訴使用者**回 Worker 分頁說「重讀工單」（`control-tower/references/research-workorder.md` § Renew 機制 › 塔台操作流程 第 4 點、Worker 端觸發詞） | 使用者輸入（main `noteUserInput`）→ claude `UserPromptSubmit` hook（codex：OSC 7501 `state=working`）→ PTY 輸出 | **不變，仍是 `✓`**，直到 Worker 收尾再 notify |
| R2：yolo 提問備援（`BLOCKED` + `tower_question: open`） | 塔台在 Renew 區段答覆、`status` 改回 `PENDING`，**派新的 Worker，不對舊分頁送按鍵**（`yolo-mode.md` § 塔台端「收到備援」） | 新分頁的建立、`SessionStart` | 舊分頁保留 `✓`（它確實結束了）；新分頁無徽章。新分頁回報時，**兩個分頁都被標 `✓`**（`findReportingWorkers` 比對同塔台、同工單的所有分頁；測試 `every Worker of that Tower with that work order (Renew re-dispatch) is marked`，`workerReport.test.ts:83`） |
| R3：塔台經 helper 寫入 Worker 分頁 | **做不到**：`pty:write` / `terminal:keypress` / `terminal:notify` 只開放給 `worker` 角色，塔台只有派工、`--close-worker`、`--set-role`、`question:answer` 與唯讀查詢 | — | — |
| R4：Worker 自己監看工單檔 | 只在 Worker 等提問答覆時（`yolo-mode.md` § Worker 端 3-B）；回報後的 Worker 回合已結束，不會監看 | — | — |

R3 的證據：`electron/remote/helper-capability.ts:390-428`（`HELPER_CHANNEL_ROLES`；`'pty:write': ['worker']` 在 `:403`）。

⇒ 使用者描述的情境（「塔台 Renew 後通知 Worker 重讀繼續執行，標籤已打勾」）在 BAT 上只可能是 **R1：使用者自己在原 Worker 分頁輸入**。【推論】第八十九 session 的實際路徑沒有記錄可查（近期工單沒有 `## 塔台補充（Renew #N）` 樣本），列入待實機確認。

#### 3. 推演：回報 → `✓` → Renew → 工作 → 再回報

| 步驟 | claude Worker（hook 分頁） | codex Worker（`>= 0.163.0`，osc 分頁） | 縮圖徽章 | 批次關閉候選 |
|---|---|---|---|---|
| ① Worker notify `T#### 完成` | 回合內送出，之後 `Stop` | 回合內送出，之後 OSC `idle` | `✓` | **是** |
| ② 塔台 Renew（只改工單檔） | 無事件 | 無事件 | `✓` | 是 |
| ③ 使用者在 Worker 分頁輸入「重讀工單」 | `noteUserInput`、`UserPromptSubmit` | `noteUserInput`、OSC `working` | **`✓`（不變）** | **是（誤）** |
| ④ Worker 工作中（數分鐘到數十分鐘） | 大量輸出、`PreToolUse` 等 | 輸出、`working` | **`✓`**（活動點在閃） | **是（誤）** |
| ④' 工作中卡在權限 / 提問 | hook `blocked` | OSC `blocked` | ⚠️ / `?`（蓋過 `✓`） | 否（T0609 已排除） |
| ⑤ Worker 再 notify `T#### 完成` | `markWorkerReported` 換掉訊息與時間 | 同左 | `✓`（tooltip 換成新訊息） | 是 |

- 第二次回報**不會重複或錯亂**：同一分頁只是 `message` / `reportedAt` 被取代（`workerReport.test.ts:135`）。【推論】codex 欄位的推演依據為 `terminal-blocked-state.ts:50-55` 與 `src/lib/codex-terminal-state.ts` 的轉換表，與 claude 的差別只在信號來源，`✓` 的處理同一個 renderer 函式。
- 錯亂只出現在 R2：同一工單兩個分頁同時標 `✓`，且見下方 4-b。

#### 4. 影響

a. **批次關閉（主要風險，事實 + 推論）**：「關閉已回報的 Worker 分頁（N）」以 `reportedWorkersOfTower` 選分頁，只排除 ⚠️ / `?`（`workspace-store.ts:66-72`）；確認框只列工單號與標題，tooltip 是舊的回報訊息（`WorkspaceView.tsx:1474-1486`）；確認後逐一 `closeTerminalNow`，**沒有任何輸出 / 輸入檢查**（`WorkspaceView.tsx:962-969`），文案還寫「其中執行中的程序會被終止」（`zh-TW.json:1403`）。⇒ 步驟 ③④ 期間按批次關閉，正在做 Renew 的 Worker 會被一起關掉。【推論】使用者看到 `✓` 也會判斷「這個做完了，不必切過去看」。
b. **`--close-worker`（不受 `✓` 影響，但 R2 有獨立問題）**：主行程完全不看 `✓`，用 PTY 歸屬比對（`electron/close-worker.ts:251-262`），延遲期間使用者輸入會取消（`:323-326`），所以 R1 的 Renew 若在 CT 排程回收後才輸入，回收會被取消，不會誤關。CT 也只在 `status == DONE` 且本次不 Renew 時回收（`work-order-system.md` § 收單後回收 Worker 分頁）。**旁支發現**：R2 留下的舊分頁不會被回收（它是 `BLOCKED`），新 Worker 之後 `DONE` 時，同塔台同工單有兩個存活分頁 → `--close-worker` 回 `AMBIGUOUS`（exit 5，`close-worker.ts:262`），CT 只「一行回報使用者，不重試」（`work-order-system.md` § 回報處理流程 exit code 表）。這跟 `✓` 無關，但會在 Renew 後實際發生。
c. **`terminal:attention-changed` 消費端**：payload 只有 `blockedReason` / `pendingQuestions`（`terminal-attention.ts:35-45`），不含 `✓`；消費端是縮圖徽章、批次關閉清單（`useTerminalAttentionVersion`，`WorkspaceView.tsx:956-960`），不受現況影響。
d. **CT 讀 `bat_list_terminals` / `bat_get_state`**：**不會誤判**。這些 channel 的 `state` 由主行程的輸出時間與 blocked 計算（`electron/terminal-query-handlers.ts:405`，`working` = `TERMINAL_QUERY_IDLE_MS` 內有輸出），主行程沒有 `✓` 的資料。

#### 5. 該不該清除（回答研究目標 1）

**應該**，但不是「刪掉回報」，而是「回報後 Worker 又在執行時，不顯示 `✓`、不列入批次關閉；這段工作結束而沒有新回報時，回到 `✓`」。理由：使用者看標籤做的兩個決定（批次關閉、要不要切過去看）在步驟 ③④ 都會因 `✓` 做錯；而 Worker 在 Renew 後一定會再 notify（ct-exec 收尾規則），屆時 `✓` 自然回來。BAT 已有同類先例：T0613 讓 `--ask` 清掉既有的 `✓`，問題結束後分頁顯示「執行中」（`workerAttention.test.ts:256`）。

### 建議方向

#### 方案比較

| 方案 | 做法 | 可靠度（漏清 / 誤清） | 改動範圍（唯一實作位置） | BAT ↔ CT 契約 | 遠端 headless | 測試方式 |
|---|---|---|---|---|---|---|
| **a. 回報後的「回合開始」信號（建議，與 d 合併）** | 主行程對每個分頁記「回合進行中」：claude `user-prompt-submit` → 開始、`stop` → 結束；codex OSC `working` → 開始、`idle` / `clear` → 結束；PTY 結束 / recovery 清除。放進 `terminal:attention-changed` payload（只是狀態欄位，例如 `busy: boolean`，符合 D155）。renderer 在已有 `workerReport` 的分頁收到 `busy: true` 時記「回報後又在執行」（只在記憶體） | 誤清：使用者回報後跟 Worker 閒聊 → 該回合期間不顯示 `✓`，`Stop` 後回到 `✓`（不會永久消失）。漏清：`blockedDetection: none` 的分頁（hooks 被關、舊 codex、raw command）沒有信號，維持現況 `✓`；BAT 重開時主行程不知道回合狀態，維持 `✓` 直到下一個 hook。【推論】claude 的 `Stop` 在使用者 Esc 中斷時可能不觸發，回合會一直算進行中，需要逾時備援（例如輸出安靜 N 秒視為結束），實作前要查 | main：`TerminalBlockedTracker`（`electron/terminal-blocked-state.ts`，`user-prompt-submit` / `stop` 已在收、`observeCodexState` 已在轉換）、`TerminalAttentionNotifier`（`electron/terminal-attention.ts`）；共用型別與判斷：`TerminalAttentionEvent`、`workerAttention`（`src/lib/terminal-attention.ts`，新增一個 kind）；renderer：`terminal-attention-store`、`reportedWorkersOfTower`（`workspace-store.ts`）、`TerminalThumbnail` 徽章與 i18n | **不需要**：`terminal:attention-changed` 是 BAT 內部 main → renderer 事件；hook 表、helper、MCP、CT 都不變 | 需要：headless 也推送 attention（`electron/remote/headless-entry.ts:614-630`），tracker 本機與 headless 共用，欄位跟著走。🔴 renderer 判斷「回報之後」要用**收到事件的順序 / renderer 自己的時間**，不要拿遠端主機的 `blockedSince` 類時間戳與 renderer 的 `reportedAt` 比（兩台機器的時鐘不同） | 單元：tracker 的回合狀態轉換、`workerAttention` 優先序表、`reportedWorkersOfTower` 排除、notify 與 attention 事件先後兩種順序（比照 `workerAttention.test.ts:245`）；e2e：隔離實例跑 claude Worker 回報 → 輸入 → 再回報，看 `data-attention` |
| b. 塔台 Renew 時明確通知 BAT | 新 helper 參數（例如 `--renew-worker T####`）或 channel，tower 權杖，清掉該分頁的 `✓` | 誤清：R2（派新 Worker）時舊分頁其實已結束，不該清，CT 必須分辨兩條路徑；塔台 Renew 了但使用者沒回去輸入 → 分頁永遠不顯示 `✓`、也不進批次關閉，變成殘留分頁。漏清：使用者自己在 Worker 分頁追加指示（沒經塔台）不會觸發 | `HELPER_CHANNEL_ROLES`、新 handler、`bat-terminal.mjs`、main → renderer 新事件、`markWorkerReported` 旁的新 store 方法 | **需要**：新介面契約 + CT 的 Renew 流程改版（`research-workorder.md`、yolo 備援路徑），舊 BAT / 舊 CT 相容表 | 需要（helper 經 RemoteServer） | helper 契約測試、CT 端文件測試、e2e |
| c. 監看工單檔 `status` | BAT 監看 Worker 工單檔，`status` 回到非終態時清 `✓` | 很差：研究工單 Renew **不改 `status`**（`research-workorder.md` § 塔台操作流程只加區段與 `renew_count`）；yolo 備援改 `PENDING` 但工作在新分頁；Worker 重讀時 `status` 可能維持 `DONE` 到收尾 | BAT 要知道工單路徑（cwd / `CT_HOME` / 檔名樣式）並解析 CT 的 frontmatter，新增檔案監看 | 隱性契約（BAT 依賴 CT 的檔案格式），CT 改格式會壞 | 遠端要在遠端主機監看檔案 | 不建議，不列測試 |
| d. 不清 `✓`，只改批次關閉 / 符號 | d1：批次關閉排除「回報後又在執行」的分頁、或改用另一個符號（例如「已回報、又在執行」）；d2（不需信號的安全網）：確認框對 `CLOSE_WORKER_IDLE_MS` 內有輸出的分頁加註「仍在輸出」 | d1 需要的信號就是方案 a；d2 對所有分頁有效（含 `none`），但剛回報的 Worker 還會印一陣子（T0545 的觀察），所以只能「加註」不能「排除」，否則剛回報的分頁會暫時不能批次關 | d1：同 a；d2：`WorkspaceView.tsx` 批次確認框 + renderer 的 `lastActivityTime` | 不需要 | d2 用 renderer 已有的活動時間，遠端一樣有 | 元件測試確認框加註 |
| e.（新增）R2 的舊分頁 | 派新 Worker 前由 CT 先 `--close-worker` 舊分頁，或 BAT 派工時偵測同塔台同工單仍有存活分頁並回報 | 解決 4-b 的 `AMBIGUOUS` 與雙 `✓` | CT：yolo 備援流程；或 BAT：`createWithCommand` | CT 方案不改 BAT 契約；BAT 方案要新回應欄位 | — | — |

#### 建議

1. **採方案 a + d1**：新增 kind（暫稱 `resumed`）——「已回報，又在執行」：徽章不顯示 `✓`（可顯示另一個符號或只顯示工單號，由實作工單決定），tooltip 寫「已回報（<訊息>），之後又開始執行」，不列入批次關閉；回合結束而沒有新回報 → 回到 `✓`；有新回報 → 一般 `✓`。不需要 CT 配合、不改任何對外契約。
2. **加上 d2 安全網**：批次關閉確認框對近期有輸出的分頁加註，涵蓋沒有 hook / OSC 的分頁。
3. **不建議 b、c**：b 要改契約且在 R2 會清錯分頁；c 無法偵測研究工單的 Renew。
4. **旁支（e）交塔台另案判斷**：yolo 備援重派後舊 `BLOCKED` 分頁留著，之後 `--close-worker` 必定 `AMBIGUOUS`。這屬 CT 流程或 BAT 派工行為，與本單的 `✓` 無關。

#### 殘留風險

- `blockedDetection: none` 分頁維持現況（`✓` 不變），只有 d2 的加註保護。
- claude `Stop` 不觸發的情況（Esc 中斷、API 錯誤）會讓「又在執行」卡住，需要逾時備援；實作前要查 claude 的 hook 文件與實測。
- 只在記憶體：BAT 重開後到下一個 hook 事件前，Renew 中的分頁仍顯示 `✓`。

#### 待實機確認（未執行，依工單規定不碰使用者的 BAT）

1. 第八十九 session 的 Renew 實際走哪條路（R1 使用者在原分頁輸入，或 R2 派新 Worker）：看使用者 BAT 日誌的 `[T0538] Worker reported` 與該工單分頁數。
2. claude 在 Esc 中斷、API 錯誤結束回合時是否送 `Stop`（決定方案 a 是否需要逾時備援）。
3. 遠端視窗（WSL / SSH）裡 `terminal:notified` 與 `terminal:attention-changed` 的到達順序是否保持（決定 renderer 用到達順序判斷「回報之後」是否可靠）。

### 建議下一步

- 開實作工單（BAT，`sizing: M`）：方案 a + d1 + d2。驗收含 `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、e2e（claude Worker 回報 → 輸入 → 再回報、回報 → 閒聊 → 回到 `✓`），codex 部分照 CLAUDE.md 跑 `e2e/t0621-codex-osc-state.spec.ts`。實作前先處理待實機確認第 2、3 點。
- 旁支 e 交塔台決定：CT 端（yolo 備援重派前先回收舊分頁）或 BAT 端（派工偵測同工單存活分頁）。

### 子代理與 Workflow 使用

未使用子代理，也未使用 Workflow（本單沒有授權）。

### Renew 歷程

無

### 遭遇問題

- 工單 frontmatter 初始 `status` 是 `TODO`（ct-exec 預期 `PENDING`），照 PENDING 處理改為 `IN_PROGRESS`，未改其他欄位。
- 其他無。

### Commit

- 只 commit 本工單檔（`git commit --only`），沒有產品變更；未建立 `_report-T0693-*.md`（回報直接寫在本區）。
- 工作區原有的未提交變更（`T0692` 工單、`usage-limit` 相關三檔）不屬本單，未動。

### 回報時間

2026-10-21T23:56:24+0800
