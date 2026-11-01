---
schema_version: 1
schema_kind: workorder
id: T0734
title: "研究 Claude 面板 `agentProgressSummaries` 的請求與成本＋把 prompt suggestion / progress summaries 的成本與關閉方式寫進 docs"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-01T12:41:53+0800"
started_at: "2026-11-01T12:42:45+0800"
updated_at: "2026-11-01T12:57:33+0800"
completed_at: "2026-11-01T12:57:33+0800"
depends_on: []
related:
  - "D199；T0733 回報區（prompt suggestion：成因、抑制條件、三種關閉方式、token 估算、面板比終端少的節流、相關但未涵蓋的 `agentProgressSummaries`）"
  - "T0733 / T0729 的 SDK 直接呼叫原型做法（假 Anthropic API、暫存 HOME 與工作區放在使用者家目錄以外、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`、擋外連 proxy）"
  - "`electron/claude-agent-manager.ts` `queryOptions`；`docs/agent-guide/claude-agent-sdk-cli.md`"
affects_files:
  - docs/agent-guide/claude-agent-sdk-cli.md
  - _ct-workorders/T0734-research-agent-progress-summaries-and-docs.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改 docs：不改產品程式碼、測試、CLAUDE.md（T0732 正在改 CLAUDE.md「Logging」）；不跑 `vite build` / 打包 / e2e。原型只放 scratchpad，以 SDK 0.3.316 驅動內嵌 CLI 2.1.316 打本機假 API；不得用使用者的登入或真實 key，不得有請求送到 api.anthropic.com；暫存 HOME 與 cwd 都放在使用者家目錄以外（T0733 偏差：cwd 在家目錄下會讀到使用者的 CLAUDE.md）。"
  - "🔴 `agentProgressSummaries` 要回答：① 以 BAT 面板實際選項重現一個前景 sub-agent（`Agent` tool_use，假 API 讓 sub-agent 跑 > 30 s 或以 gate 拖住）：progress summary 請求的頻率、內容特徵（model、system、tools 數、messages、`max_tokens`、thinking）、在哪裡產生；② BAT 是否用到結果（追 SDK 訊息 → `processMessage` → IPC → 面板哪個元件顯示），關掉後面板少了什麼；③ 關閉方式（SDK 選項、env、settings，以實測為準）；④ 真實帳號 token 估算（標明估算，cache read / 未快取 / output 分開）；⑤ 背景 sub-agent（CLI 2.1.316 `Agent` 預設背景執行，T0727 觀察 4）時是否同樣產生；⑥ Claude CLI 終端分頁的預設行為（只看原始碼）。"
  - "🔴 docs：在 `docs/agent-guide/claude-agent-sdk-cli.md` 新增一節（例如「Claude 面板額外的模型請求」），以使用者看得懂的方式寫兩項：prompt suggestion（D199 維持開啟；用途＝建議晶片與 Tab 填入；何時不送；成本特性；使用者關閉方式 `promptSuggestionEnabled: false` / env；面板比終端少的節流）與 agentProgressSummaries（依本單實測）。另附一句：BUG-177 修正後查模型清單不再送請求（T0729）。數字標明來源（實測 / 估算）。遵守 docs 去識別化，不寫家目錄路徑。"
  - "🔴 回報區給：①–⑥ 結論與證據、建議（維持 / 加開關 / 改預設；若要改，列實作單草案）、需要使用者決定的點。log / 回報不含權杖或完整 session id。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit docs 與本單。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
---

# T0734 — 研究 `agentProgressSummaries`＋額外請求的 docs

## 元資料

- **工單編號**：T0734
- **類型**：research（附 docs 交付）
- **優先級**：P3
- **建立時間**：2026-11-01T12:41:53+0800
- **預估規模**：S

## 背景

T0733 查明 Claude 面板每個 turn 結束後多出的請求是面板自己開的 prompt suggestion。使用者決定（D199）：維持開啟，把成本與關閉方式寫進 docs；並研究面板同樣開啟的 `agentProgressSummaries`（sub-agent 執行時約每 30 秒 fork 一次產生進度摘要）的成本。

## 範圍

1. `agentProgressSummaries` ①–⑥ 實測與查證。
2. docs 新增「Claude 面板額外的模型請求」一節。

## 不做

- 不改產品程式碼、測試、CLAUDE.md；不 build；不耗 token。

## 驗收

- [x] ①–⑥ 各有結論與證據
- [x] docs 一節涵蓋兩項功能，數字標明來源
- [x] 建議與待決點

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**。`agentProgressSummaries` 的 ①–⑥ 都有實測或原始碼證據。docs 已在 `docs/agent-guide/claude-agent-sdk-cli.md` 新增「Claude 面板額外的模型請求」一節（commit `72878412`）。

重點：
- 子代理每跑約 30 秒，CLI 就把子代理的對話 fork 一次，產生一句 3–5 字的進度摘要。
- BAT 有用到這句摘要：顯示在 Agent 卡片的進度列與執行中工作列。
- **只能用 SDK 選項關閉**：env 設 `0` 或改 settings 都無效，使用者端目前沒有辦法自己關。

建議：維持開啟，不改程式；要不要加 Settings 開關交使用者決定（附草案）。

### 落地檢查

- **PASS**：
  - C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS。
  - C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS。
  - C-3：`docs/agent-guide/claude-agent-sdk-cli.md` 存在 → present（另一項是本工單，排除）。
  - C-2：沒有 `branch` 欄位（在 `main`）。
- 其他環境：
  - 不在 worktree（`CT_HOME` 未設）。
  - `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只作證據）。
  - `CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 做法

- 原型 `probe.mjs` 只放在 scratchpad，以 T0733 原型為底改寫。以 SDK 0.3.316 `query()` 驅動內嵌 CLI 2.1.316，打本機假 Anthropic API，每個請求的內容都存檔。
- 選項照 BAT 面板 `queryOptions`：preset systemPrompt / tools、`includePartialMessages`、`promptSuggestions: true`、`settingSources: ['user','project','local']`、`thinking: adaptive`、`effort: high`、`toolConfig`、`agentProgressSummaries: true`、`model: claude-opus-5-5`、`canUseTool`；prompt 用字串（和 BAT `runQuery` 相同，one-shot）。
- 假 API 的劇本：
  - 主代理第一個請求回 `Agent` tool_use（`subagent_type: general-purpose`，`run_in_background` 依情境）。
  - 子代理每個請求延遲 12 秒，前 5 步各回一個 `Glob` tool_use，第 6 步回文字，總共約 72 秒。
  - 請求最後一則 user 訊息含 `Describe your most recent action` 的歸為 summary，回 `Reading notes step N`。
  - 另開 `debugFile` 收 CLI 的 `[AgentSummary]` 日誌。
- 隔離做法：
  - env 從零組（不繼承使用者的 Claude 登入）、`ANTHROPIC_API_KEY` 用假值、暫存 `CLAUDE_CONFIG_DIR`。
  - HOME / cwd 放在 `D:\t0734-probe-tmp\`（使用者家目錄以外），`HTTPS_PROXY` 指向擋外連的 proxy，並設 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`。
  - 6 個情境的 proxy 外連嘗試都是 **0**；請求內容沒有使用者的 CLAUDE.md（掃過 `R-G001` / `No Regressions Policy` / `Contents of`，0 筆）。
- 偏差：
  - 背景子代理的 `output_file` 路徑在 `TEMP` 底下（env 的 `TEMP` 沿用使用者的值），所以這個路徑字串出現在送到本機假 API 的請求裡；它是路徑，不是檔案內容，也沒有送出本機。
  - CLI 在 `%TEMP%\claude\D--t0734-probe-tmp-work-*` 留下 6 個目錄，每個只有 1 個子代理 `.output` 檔。刪除被安全檢查擋下，**未刪**，請使用者自行刪除。
  - `D:\t0734-probe-tmp\` 已清空並移除。

### 實測結果

| 情境 | 選項 `agentProgressSummaries` | 其他 | summary 請求 | 時間點（秒） | 帶 `summary` 的 `task_progress` | proxy 外連 |
|---|---|---|---|---|---|---|
| `fg` 前景 | `true` | — | **2** | 30.6 / 60.6 | 2（共 7 個 `task_progress`） | 0 |
| `fg-off` | `false` | — | **0** | — | 0（共 5 個） | 0 |
| `bg` 背景（`run_in_background: true`） | `true` | — | **2** | 30.4 / 60.4 | 2（共 7 個） | 0 |
| `fg-env-only` | `false` | env `CLAUDE_CODE_AGENT_PROGRESS_SUMMARIES=1` | **2**（env 會開啟） | 30.4 / 60.4 | 2 | 0 |
| `fg-env-zero` | `true` | env `CLAUDE_CODE_AGENT_PROGRESS_SUMMARIES=0` | **2**（關不掉） | 30.4 / 60.4 | 2 | 0 |
| `fg-setting` | `true` | settings `agentProgressSummaries: false`、`agentProgressSummariesEnabled: false` | **2**（關不掉） | 30.4 / 60.4 | 2 | 0 |

（每個情境都另有主代理 2–3 個請求、子代理 6 個請求、prompt suggestion 1–2 個，和本題無關。）

### ① 請求的頻率、內容與產生位置

- **頻率**（實測 + 原始碼）：
  - CLI 的摘要迴圈（`[AgentSummary]`）在子代理啟動時開始計時，`setTimeout` 30,000 ms；每次摘要做完再排下一個 30 秒，所以間隔是 30 秒加上摘要本身的時間。
  - 跳過的情況：子代理對話少於 3 則（`not enough messages`）、對話和上次相比沒變（`transcript unchanged`，以「訊息數 + 最後一則 uuid」判斷）。所以子代理卡在一個很長的步驟時只會送 1 次。
  - 另有一個暫緩條件：GrowthBook `tengu_wobbly_petal` 的 `sdkHosts`（預設 false）開啟時，若子代理自己的請求還沒回應、而且距上次回應超過 270 秒（快取可能已冷），就每 2 秒重看、最多暫緩 5 分鐘。真實帳號這個旗標的值不明。
  - 子代理結束時停止計時（`Stopping summarization`）。
- **內容**（實測，`fg` 的 `03-sub` 與 `04-summary` 逐欄比對）：
  - `model`：和子代理相同（`claude-opus-5-5`，子代理沿用主模型）。
  - `system`：3 個 block、約 3.0 KB，和子代理請求**逐位元相同**。
  - `tools`：12 個（Agent、Bash、Edit、Glob、Grep、ListAgents、Read、ReportFindings、Skill、ToolSearch、DeferredToolPlaceholder、Write），**逐位元相同**。
  - `max_tokens` 128000、`thinking: {type: adaptive, display: omitted}`、`output_config.effort: high`、`context_management`、`metadata` 都和子代理相同。
  - `messages`：子代理目前的完整對話，最後一則 user 訊息（最近一次 `tool_result`）後面多一個 text block，內容是 `Describe your most recent action in 3-5 words using present tense (-ing)…`（約 0.6 KB，含 Good / Bad 範例）。第二次起多一行 `Previous: "<上一句>" — say something NEW.`。
  - `cache_control` 標在倒數第二則（前一則 assistant）訊息上，子代理自己的請求則標在最後一則。
  - 原始碼：`vP({ promptMessages, cacheSafeParams: {...baseParams, forkContextMessages}, canUseTool: 一律拒絕, querySource: 'agent_summary', maxTurns: 1, skipTranscript: true, skipCacheWrite: true })`。結論：讀子代理的快取、不寫新快取的 fork。
  - 大小：最小環境下 38.1 KB（第 1 次）/ 38.7 KB（第 2 次），子代理請求本身是 35.3–38.8 KB。
- **在哪裡產生**：在 CLI 子行程內、子代理執行期間。結果經 `M3s` 以 `task_progress` 送出，`description` 與 `summary` **同為**摘要文字、不帶 `last_tool_name`。
- 原始碼還有一個「short」模式（GrowthBook `tengu_groovy_ember`）：改用小模型、不帶快取、`effort: low`、output 上限 2108、只送 ≤ 約 2000 tokens 的筆記。SDK 主機（`sdkAgentProgressSummariesEnabled` 為 true）時 `served` 為 undefined，固定用 full（fork）模式，所以 BAT 面板不會走 short。

### ② BAT 是否用到結果、關掉後少了什麼

- **有用到**（原始碼追蹤）：
  1. SDK `task_progress` → `processMessage`（`electron/claude-agent-manager.ts`，`subtype === 'task_progress'` 分支）：取 `agentMsg.description || agentMsg.summary` 存進 `activeTasks` 的 `summary`，更新 `lastProgressTime`、清 `stalled`。
  2. 經 `updateToolCall` 把 Agent 工具卡片的 `description` 改成「摘要 + ` [<上次的工具名>]`」，例如 `Reading notes step 4 [Glob]`；摘要事件不帶 `last_tool_name`，沿用前一次的值。
  3. `claude:tool-result` IPC → `ClaudeAgentPanel.tsx`：時間軸 Agent 卡片的 `.claude-task-progress-text`，以及上方執行中工作列的 `.claude-active-task-progress`。
- **顯示時間很短**：
  - 實測事件順序：子代理每次呼叫工具時，先來一個 CLI 自己產生的 `task_progress`（`description` 例 `Finding step1*.txt`，`last_tool_name: Glob`，不帶 `summary`），接著是子代理的 assistant 訊息（BAT 依 `parent_tool_use_id` 把卡片改成 `Glob: step1*.txt`）。
  - 所以摘要只在「摘要產生」到「子代理下一次呼叫工具」之間看得到。
- **關掉後少了什麼**：只少這一句摘要。
  - 卡片進度列改成只顯示 CLI 的工具標籤（`Finding … [Glob]` / `Glob: …`）。
  - `task_progress` 照樣送（`fg-off` 實測 5 個，每次工具呼叫 1 個）。
  - 「可能已停滯」判斷（`checkStalledTasks`，60 秒沒有進度）、停止按鈕、子代理紀錄（log 視窗）、`task_notification` 都不受影響。
  - 唯一的副作用：子代理卡在一個很長的步驟時，開著摘要會在第 30 秒多一次進度，讓「停滯」提示晚一點出現；之後因為對話沒變就跳過，影響很小。
- 未以 BAT UI 實機驗證（本單不 build）；顯示路徑是讀程式碼加上 SDK 事件實測推得。

### ③ 關閉方式（實測）

- **只有 SDK 選項有效**：`agentProgressSummaries: false`（或不傳）→ 0 次。
- **無效**：
  - env `CLAUDE_CODE_AGENT_PROGRESS_SUMMARIES=0`：選項為 true 時照樣產生。
  - settings 的 `agentProgressSummaries` / `agentProgressSummariesEnabled`：CLI 二進位裡沒有這類 settings 鍵；`agentProgressSummar*` 只出現在 SDK 選項、initialize 請求、`sdkAgentProgressSummariesEnabled` 旗標與 env 名稱。
- **反向**：選項為 false 時，env `CLAUDE_CODE_AGENT_PROGRESS_SUMMARIES=1` **會開啟**。BAT 的 `sdkSpawnEnv` 會把主行程的 `process.env` 整份帶進 spawn env，所以使用者環境有這個變數時，面板改成 false 也會被打開。
- 原始碼：`if (request.agentProgressSummaries) setSdkAgentProgressSummariesEnabled(true)`，沒有關閉的分支；env 只在特定 client type 下設為 true。
- 結論：使用者目前無法自己關閉；要讓使用者能關，必須改 BAT（見建議）。

### ④ 真實帳號的 token（估算，不是實測）

- 基準（實測大小，最小環境）：每次摘要約 38 KB，約 9.5k tokens（4 B/token）。
- 真實子代理的 context：system / tools 和最小環境同一個量級，但對話會累積讀檔、grep、指令輸出，常見 20k–100k tokens。子代理是否帶入使用者 / 專案 CLAUDE.md 會影響這個數字，本單沒有查證，也沒有逐一實測。
- **每次摘要**：
  - **cache read**：約等於子代理目前的整段 context（20k–100k），計價約 0.1 倍，換算約 **2k–10k 個一般 input token**。
  - **未快取 input**：提示約 150 tokens + 子代理最近一次工具結果（從幾十到幾千 tokens 不等）。
  - **cache write**：0（`skipCacheWrite`）。
  - **output**：3–5 個字（約 10 tokens），**另加 adaptive thinking**（沿用子代理的 `effort`，display omitted），數量假 API 量不到，屬未知。
  - 模型 = 子代理的模型（沿用主模型時是 Opus 等級的單價）。
- **一個子代理**：約每 30 秒 1 次。例：連續工作 5 分鐘 → 約 9 次 → cache read 約 18 萬–90 萬 tokens（換算約 1.8 萬–9 萬個一般 input token），加上 9 次的未快取尾段與 thinking。
- 對照：子代理自己每一步也要 cache read 整段 context，所以摘要約等於每 30 秒「多走一步，但不呼叫工具、output 很短」。子代理步驟密集時佔比小，步驟稀疏（每步很久）時佔比較大，但對話沒變時會跳過，所以有上限。

### ⑤ 背景子代理是否同樣產生

- **會**。`bg` 情境（`run_in_background: true`）實測和前景相同：第 30.4 秒、第 60.4 秒各 1 次，結果以帶 `summary` 的 `task_progress` 送出。
- 原始碼：SDK / 非互動模式下，背景路徑 `enableSummarization: hEe() || (coordinator || isFork || forkGate) && !nonInteractive`，前景（同步）路徑 `enableSummarization: hEe()`。`hEe()` = SDK 旗標，所以兩條路徑都開。
- 附帶觀察（和 T0727 觀察 4 一致）：背景情境下，第一個 `result` 在第 0.4 秒就送出，子代理完成時（第 72.7 秒）主代理再跑一個 turn、送第二個 `result`。prompt suggestion 在兩個 `result` 後各送 1 次。

### ⑥ Claude CLI 終端分頁的預設行為（只看原始碼）

- BAT 沒有對 claude-cli 終端分頁設定任何和摘要有關的東西，行為和一般 `claude` 相同。helper 派工的 Worker 也是互動式 TUI，同樣適用。
- 互動式終端：
  - **前景（同步）子代理**：`enableSummarization: hEe()`，SDK 旗標在 TUI 不會設，所以**不產生**。env `CLAUDE_CODE_AGENT_PROGRESS_SUMMARIES` 只在特定 client type 下生效，`cli` 不在其中（沒有實測）。
  - **背景子代理**：`hEe() || (coordinator || isFork || ife()) && 互動`。`ife()` = fork-subagent 閘門，互動模式下預設為 `default`（開啟）；以下情況關閉：coordinator 模式、設定 `forkSubagentDisabled`、env `CLAUDE_CODE_FORK_SUBAGENT` 為 false。所以背景子代理**預設會產生**。CLI 2.1.316 的 `Agent` 預設背景執行，所以終端裡多數子代理也有摘要。
  - 終端版的請求形式受服務端旗標控制：`tengu_groovy_ember` 可能改走 short 模式（小模型、不帶快取、`effort: low`）；`tengu_wobbly_petal` 的 `sessionModelFamilies` 可能在快取可能已冷時暫緩。
- 結論：面板和終端都會為背景子代理產生摘要；面板多了前景子代理，而且固定走 full（fork）模式。

### 結論與建議

- **結論**：
  - `agentProgressSummaries` 是 BAT 刻意開啟、而且有在顯示的功能，不是 BUG。
  - 成本特性和 prompt suggestion 類似：大部分是 cache read、沒有 cache write，但頻率跟著子代理執行時間走，每 30 秒 1 次。
  - 和 prompt suggestion 不同的是，**使用者沒有辦法自己關閉**。
- **建議：維持開啟，不改程式（不改預設）**。理由：
  - 子代理跑很久時，這是面板上唯一「現在在做什麼」的人話描述；
  - 成本有 CLI 內建的上限（對話沒變就跳過、不寫快取）；
  - 改成預設關會拿掉現有功能（No Regressions）。
  - docs 已寫明現況與「使用者端關不掉」。
- **若使用者想要能關閉，實作單草案**（建議 S，可和 T0733 草案的 prompt suggestion 開關合成一張）：
  - 範圍：Settings 加「Claude 面板：子代理進度摘要」開關（建議**預設開**，保留現行行為），對應 `queryOptions.agentProgressSummaries`。關閉時另把 spawn env 的 `CLAUDE_CODE_AGENT_PROGRESS_SUMMARIES` 拿掉（否則使用者環境設 `1` 時仍會開啟），只影響之後開始的 turn。不改 claude-cli 終端分頁。
  - affects_files：`electron/claude-agent-manager.ts`（`queryOptions`、`sdkSpawnEnv`）、`src/types/index.ts`（設定型別）、Settings 面板元件與 i18n、`electron/__tests__/` 一個選項 / env 測試、`docs/agent-guide/claude-agent-sdk-cli.md`。
  - 驗證：
    - 單元測試：開 / 關時 `agentProgressSummaries` 的值與 env 的有無；
    - SDK 原型（本單 `probe.mjs` 的 `fg` / `fg-off` 劇本）：關閉時 0 個 summary 請求、開啟時每 30 秒 1 個；
    - `test:unit`、兩個 typecheck、`vite build`。
  - e2e 可選：`e2e/v072-pre6-claude-panel.spec.ts` 的 sub-agent 段要讓子代理跑超過 30 秒，成本較高，建議只用 SDK 原型驗證。

### 需要使用者決定的點

1. `agentProgressSummaries`：維持現狀（建議）／加 Settings 開關（預設開）／改成預設關？
2. 若要加開關，是否和 prompt suggestion 的開關（T0733 草案）合成同一張實作單？
3. `%TEMP%\claude\D--t0734-probe-tmp-work-*`（6 個目錄，原型留下的子代理輸出）請使用者自行刪除；刪除指令被安全檢查擋下。

### 修改檔案

- `docs/agent-guide/claude-agent-sdk-cli.md`：新增「Claude 面板額外的模型請求（T0733 / T0734，D199）」一節，含 prompt suggestion、子代理進度摘要，以及附註（BUG-177 / T0729、標題請求、版本前提）。數字都標了實測 / 原始碼 / 估算。去識別化檢查：diff 中沒有家目錄路徑或使用者名稱。
- 本工單。
- 沒動產品程式碼、測試、CLAUDE.md；沒跑 build / e2e / 打包。

### Commit

- docs：`72878412`（`git commit --only`）。
- 本工單：收尾 commit（`git commit --only`）。
- 未 push。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### 回報時間

2026-11-01T12:56:12+0800
