---
schema_version: 1
schema_kind: workorder
id: T0693
title: "研究：塔台 Renew 工單、Worker 重讀繼續執行後，BAT 分頁標籤仍顯示 ✓（已回報）— 是否該回到執行中，該由什麼信號清除，對批次關閉與 CT 契約的影響（只查不修）"
type: research
status: TODO
repo: better-agent-terminal
project: ""
priority: P2
sizing: M
created_at: "2026-10-21T23:50:57+0800"
updated_at: "2026-10-21T23:50:57+0800"
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

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### Renew 歷程

### 遭遇問題

### 回報時間
