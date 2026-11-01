---
schema_version: 1
schema_kind: workorder
id: T0739
title: "pre.5 / pre.6 真實模型驗收（小額）：Claude Agent 面板（SDK 0.3）實際對話、工作清單 Task*、背景 Agent 卡片、Grep / Glob 卡片"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T17:35:39+0800"
started_at: "2026-11-01T18:27:49+0800"
updated_at: "2026-11-01T18:42:08+0800"
completed_at: "2026-11-01T18:42:08+0800"
depends_on: [T0738]
related:
  - "T0727（假 API 已驗 BAT 端 ①–⑨；實機仍需：背景 `Agent` 卡片、真實模型是否主動用 Task*）、T0725 / D195（Claude 面板工作清單，Claude 5 開 todo tools）、T0718（SDK 0.3.316、V2 下架）、T0717（內嵌 CLI 2.1.316）"
  - "`e2e/v072-pre6-claude-panel.spec.ts`、`e2e/fixtures/electron-isolation.ts`；CLAUDE.md「Claude Agent SDK / CLI」「Sub-agent / Active Tasks Tracking」；`docs/agent-guide/claude-agent-sdk-cli.md`「Claude 面板工作清單」「Claude 面板額外的模型請求」"
affects_files:
  - "e2e/v072-real-model-claude-panel.spec.ts（新增，檔名可調；🔴 必須預設 skip，只有設 `BAT_E2E_REAL_MODEL=1` 才跑，避免一般 e2e 耗 token）"
  - docs/agent-guide/claude-agent-sdk-cli.md
  - _ct-workorders/T0739-real-model-claude-panel-acceptance.md
renew_count: 0
session_ids:
  - "293a00cc-ee23-4b24-b555-035c21a536cb"
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 使用者已同意（2026-11-01 第一百零三 session）以真實模型小額驗收。預設模型 `claude-haiku-5-5`；4.x 對照只用 `claude-haiku-4-5`、只送 1 個回合。🔴 不得使用 Opus / Fable / Sonnet。用量上限：整張單合計 ≤ 12 個模型回合（不含 CLI 自己的 prompt suggestion / progress summary 等額外請求，但要記錄其數量），每個 prompt 要求簡短回答；面板顯示的估計費用合計超過 US$1 立即停止並回報 PARTIAL。回報區列出每個回合的模型、input / output tokens、估計費用（取自 BAT 面板 / Cache History，取不到就寫取不到）。"
  - "🔴 情境（隔離實例、Claude Agent 面板分頁）：① 送訊息、串流顯示、完成；② 權限詢問：要求執行一個需要核准的 Bash（例 `echo t0739`）→ 面板出現權限卡 → 核准 → 結果回來；③ Grep / Glob：要求在工作區找一個檔案或字串 → 記錄卡片是 Grep / Glob 還是 Bash（CLI 2.1.316 的實際行為，只記錄，兩者都不算失敗）；④ 工作清單：要求『先列出 3 步驟的待辦再逐步完成』→ 記錄模型是否用了 TaskCreate / TaskUpdate（Claude 5）、面板工作清單是否顯示與更新；4.x 對照 1 回合記錄用的是哪種工具；⑤ sub-agent / 背景 Agent：要求用 Agent 工具派一個子任務 → 記錄 active tasks 列、背景 Agent 卡片的顯示、完成後是否清除、`stopTask` 是否可用（選做）；⑥ 換模型後再送 1 回合；⑦ 關閉分頁重開 BAT（同一隔離 runtime）→ resume 該 session → 歷史重建、再送 1 回合可接續。做不到的情境寫原因；模型沒有照指示用某工具時照實記錄，不重試超過 1 次。"
  - "🔴 登入與隔離：用使用者現有的 claude 登入（隔離實例預設沿用真實 HOME 即可）；🔴 不得複製、讀出、記錄或印出任何認證檔或權杖內容（`.credentials.json`、API key、`batcap.`）；測試輸出不得傾印整個 `process.env`。隔離實例：`e2e/fixtures/electron-isolation.ts`（獨立 userData 與 remote port），不碰使用者正在用的 BAT。工作區放 `%ProgramData%\\bat-e2e-t0739-*`（避免載入上層目錄的 `.claude/CLAUDE.md`），跑完刪除；本單在使用者 `~/.claude/projects/` 產生的、目錄名含 `bat-e2e-t0739` 的 session 目錄跑完可刪除（只刪這些），其他一律不動。先 `npx vite build`（T0738 完成後才派本單）。"
  - "🔴 不改產品程式碼；發現產品缺陷 → 記在回報區〈發現的問題〉附重現步驟與證據，由塔台開 BUG。spec 預設 skip（`BAT_E2E_REAL_MODEL=1` 才跑），一般 `npm run test:e2e` 不得因此耗 token。`npm run typecheck` = 0、`npm run typecheck:electron` = 0。`docs/agent-guide/claude-agent-sdk-cli.md` 補一行：真實模型驗收 spec 的位置、啟用方式與本次結果日期。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 spec 不得出現使用者家目錄路徑或帳號。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0739 — pre.5 / pre.6 真實模型驗收（小額）

## 元資料

- **工單編號**：T0739
- **類型**：implementation（驗收用 e2e，真實模型）
- **優先級**：P2
- **建立時間**：2026-11-01T17:35:39+0800
- **預估規模**：S

## 背景

pre.5（Agent SDK 0.3.316、V2 下架）與 pre.6（Claude 面板工作清單、Claude 5 開 todo tools）的 BAT 端已由 T0727 以假 API 驗過；仍缺真實模型的行為：模型是否主動用 Task*、背景 Agent 卡片、Grep / Glob 卡片、真實串流與 resume。使用者同意以真實模型小額驗收（Haiku 5.5 為主、4.x 對照 1 回合、合計 ≤ 12 回合、≤ US$1）。

## 範圍

1. 情境 ①–⑦（見 frontmatter）。
2. 預設 skip 的 spec（`BAT_E2E_REAL_MODEL=1` 才跑）。
3. docs 一行。

## 不做

- 不用 Opus / Fable / Sonnet；不超過用量上限。
- 不改產品程式碼、不碰認證檔。

## 驗收

- [ ] 情境 ①–⑦ 逐項結果（PASS / 行為記錄 / 未涵蓋與原因）
- [ ] 每回合模型、tokens、估計費用；合計在上限內
- [ ] spec 預設 skip、兩個 typecheck = 0
- [ ] 〈發現的問題〉與〈仍需手動〉

---

## 回報區

### 完成狀態

- **狀態**：DONE（情境 ①–⑦ 全部實際跑過；BAT 端的檢查 PASS，模型行為照實記錄；另有 2 項發現的問題交塔台判斷）
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal` = `basename(REPO_ROOT)`；C-1 PASS；C-3 PASS（`docs/agent-guide/claude-agent-sdk-cli.md` 存在，`e2e/` 存在）；C-2 無 `branch` 欄位。`CT_HOME` 未設（非 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- **環境**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；BAT helper env 齊全（`BAT_REMOTE_TOKEN` 已設定）。
- **產品 commit**：`4f195570` test(e2e): T0739 real-model Claude panel acceptance spec + docs
- **改動檔案**：
  - `e2e/v072-real-model-claude-panel.spec.ts`（新增；預設 skip，`BAT_E2E_REAL_MODEL=1` 才跑）
  - `docs/agent-guide/claude-agent-sdk-cli.md`（「Claude 面板工作清單」節補一行：spec 位置、啟用方式、2026-11-01 結果）
- **驗證**：
  - `npx vite build` exit 0
  - `npm run typecheck` = 0、`npm run typecheck:electron` = 0
  - 不設 `BAT_E2E_REAL_MODEL`：`npx playwright test e2e/v072-real-model-claude-panel.spec.ts` → `1 skipped`（不啟動 app、不耗 token）
  - 設 `BAT_E2E_REAL_MODEL=1`：第 2 次執行 `1 passed (2.2m)`（第 1 次見〈互動紀錄〉，spec 自身錯誤，只送出 1 回合）
  - spec 另以 `tsc --noEmit --strict` 單檔檢查 0 錯誤
  - 最後一次修改 spec（費用改以累計值的最大值計，依〈發現的問題〉F1 的實測）後只重跑 skip 與型別檢查，沒有再以真實模型重跑（避免多耗 token）；改動只有費用計算與 log 文字。
- **未改產品程式碼**；不發版、不改 CHANGELOG、不 push。
- **session_id**：293a00cc-ee23-4b24-b555-035c21a536cb

### 情境結果

隔離實例（`launchIsolated`，獨立 userData / remote port；繼承的 `BAT_*` / `CT_*` / `ANTHROPIC_*` / `CLAUDE*` 都去掉），沿用真實 HOME 的 claude 登入（沒有讀、複製或印出任何認證檔或權杖）。工作區 `%ProgramData%\bat-e2e-t0739-*\ws`，內含 `docs/notes/deep.txt`（內容 `marker: T0739-NEEDLE-42`）。單一 Claude Agent 分頁，模型 `claude-haiku-5-5`。

| # | 結果 | 內容 |
|---|---|---|
| ① 送訊息、串流、完成 | PASS | 回覆「T0739 hello」顯示，結束後游標消失。答案只有 8 個 output token，**沒有觀察到串流中的游標**（第一回合 61 s 大多是 CLI 啟動時間）；串流本身 T0727 已以假 API 驗過，這裡只記錄。 |
| ② 權限詢問 | PASS | `setPermissionMode(default)` 回 `false`（回合之間 query 已結束，T0727 已知；session 仍保留模式）。模型呼叫 `Bash(mkdir t0739-perm)` → 面板出現權限卡「允許此 Bash 呼叫？」、指令 `mkdir t0739-perm` → 按「是」→ 資料夾建立、卡片消失、回合完成。 |
| ③ Grep / Glob | 記錄：**Grep** | 工具只有 `Grep(T0739-NEEDLE-42)`，回答正確指出 `deep.txt`。CLI 2.1.316 + Haiku 5.5 搜尋字串走 Grep 卡片（沒用 Bash）。 |
| ④ 工作清單（Claude 5） | 記錄：**用了 Task\*** | Haiku 5.5 先呼叫 `ToolSearch`（Task\* 在 deferred 清單），再 `TaskCreate` ×3（step A/B/C）、`TaskUpdate(completed)` ×3；沒用 `TodoWrite`。面板清單：`pending:step A/B/C` → `completed:step A/B/C`（兩段連續的 Task\* 卡片各畫一份清單，符合「每段只在最後一張畫」）。截圖 `t0739-task-list.png`（在 `e2e-results/`，未 commit）。 |
| ④ 4.x 對照（併入 ⑥） | 記錄：**用了 Task\*** | `claude-haiku-4-5`：直接 `TaskCreate` ×2、`TaskUpdate(completed)` ×2，不需 ToolSearch；沒用 `TodoWrite`。 |
| ⑤ 背景 Agent | 記錄 | 模型呼叫 `Agent`（`run_in_background: true`）。執行中：Agent 卡片 1 張、有「背景」標籤，**active task bar 0 項**；結束後卡片 `dot-success`、描述仍是「T0739 bg probe」（沒有 `[completed]` 前綴）。背景子代理結束後 CLI 自己多跑了 1 個回合（多收到 1 個 `claude:result`）。`stopTask`（選做）未做。見〈發現的問題〉F2。 |
| ⑥ 換模型後再送 1 回合 | PASS | `setModel(claude-haiku-4-5)` 回 `true`；該回合 `modelUsage` 出現 `claude-haiku-4-5`（確實換了模型）。之後 `setModel` 換回 `claude-haiku-5-5`（不送回合）。 |
| ⑦ 重開 BAT → resume | PASS | 關閉後以同一 runtime 重開：分頁還原、`sdkSessionId` 相同（`8e50ff27…`）、模型 `claude-haiku-5-5`，歷史重建（①的「T0739 hello」與④的「tasks done」都在）；再送 1 回合問第一則訊息要回什麼 → 答「T0739 hello」，上下文接續。 |

### 用量

**合計：10 個模型回合（≤ 12），實際花費約 US$0.1514（≤ US$1）。** 使用的模型只有 `claude-haiku-5-5` 與 `claude-haiku-4-5`。

CLI 2.1.316 的 `result.total_cost_usd` 與 `modelUsage` 是 **session 累計值**（含 prompt suggestion 等額外請求、resume 後延續），所以每回合費用 = 累計值的差。tokens 取自同一個 `result` 的 `usage`（這個是單一 query 的值），來源是隔離實例 debug log 的 `[Claude result] usage=` 行；面板狀態列的 `totalCost` 也是這個累計值。

| 回合 | 情境 | 模型 | input | cache write | cache read | output | session 累計 US$ | 本回合 Δ US$ |
|---|---|---|---|---|---|---|---|---|
| 0 | ①（第 1 次執行，spec 錯誤後中止） | haiku-5-5 | 2 | 39,779 | 0 | 8 | 0.008167 | 0.008167 |
| 1 | ① | haiku-5-5 | 2 | 21,679 | 18,282 | 8 | 0.004650 | 0.004650 |
| 2 | ② | haiku-5-5 | 4 | 17,300 | 66,522 | 89 | 0.008820 | 0.004170 |
| 3 | ③ | haiku-5-5 | 4 | 4,227 | 88,685 | 151 | 0.011123 | 0.002303 |
| 4 | ④ | haiku-5-5 | 10 | 8,938 | 265,630 | 849 | 0.016544 | 0.005421 |
| 5 | ⑤ | haiku-5-5 | 4 | 4,878 | 115,520 | 212 | 0.019451 | 0.002907 |
| 6 | ⑤ 背景子代理 + CLI 自動接續回合 | haiku-5-5 | 取不到（沒有單獨的 usage 行） | — | — | — | （併入下一列） | 0.005329（haiku-5-5 累計差） |
| 7 | ⑥ | haiku-4-5 | 26 | 48,391 | 94,317 | 474 | 0.133390 | 0.108610（haiku-4-5） |
| 8 | ⑦（重開後） | haiku-5-5 | 2 | 5,410 | 62,526 | 8 | 0.143201 | 0.001711（haiku-5-5）+ 0.008099（haiku-4-5，推論為 ⑥ 之後的 prompt suggestion） |

- 第 0 回合在另一個 session（第 1 次執行），所以另計：0.143201 + 0.008167 = **0.151368**。回合數：第 1 次執行 1 + 第 2 次執行送出 7 + CLI 自動接續 1 + 背景子代理 1 = 10。
- 4.5 那一回合最貴（cache write 48k，1 小時 cache 兩倍價），連同 ⑥ 之後的 4.5 prompt suggestion 約佔 77%。
- **額外請求（不算回合）**：renderer 收到 `claude:prompt-suggestion` 共 1 次（第 1 次啟動）、0 次（第 2 次啟動）。以「累計 cache read 增量 − 該回合 usage」推算，②、③、④、⑤ 之後各多一個約 44k–57k cache read 的請求，⑥ 之後還有一個 haiku-4-5 請求（約 48k cache read），合計約 5 個額外請求（**推估**，與 docs「每個 turn 的 result 之後 1 個 prompt suggestion」一致；有些建議沒有送到 renderer）。子代理進度摘要的請求量不到。

### 發現的問題

- **F1（建議開 BUG）Cache History 的 R 列與合計把 session 累計值當成單一回合**
  - 現象：CLI 2.1.316 的 `result.modelUsage` / `total_cost_usd` 是 session 累計值。`src/lib/cache-history.ts` 註解寫「R row — the whole turn」，`cacheHistoryRowCosts` 以 R 列的 `modelUsage` 算該列 tokens 與費用；`src/components/ClaudeAgentPanel.tsx` 約 3874–3880 行再把每個 R 列的 `costUSD` 相加當 API 合計 → R 列的 tokens 與費用一列比一列大，合計重複計算（本次 8 個回合加總會算成約 US$0.34，實際 0.143）。主行程由 `modelUsage` 加總得到的 `inputTokens` / `outputTokens`（log `[Claude ctx] new: input=…`）也是累計值。
  - 證據：② 的 `modelUsage.cacheReadInputTokens` = 84,804 = ① 的 `usage.cache_read_input_tokens` 18,282 + ② 的 66,522；⑦（重開後）的 `modelUsage` 仍含 ⑥ 的 `claude-haiku-4-5`。
  - 重現：`BAT_E2E_REAL_MODEL=1 npx playwright test e2e/v072-real-model-claude-panel.spec.ts`，看 log 的 `usage=` 與 `modelUsage=`；或在 Claude 面板連送 3 則訊息後開 Cache History。
  - 未查證：假 API（T0727）不送 `modelUsage`，所以以往的 e2e 抓不到；更早的 CLI 版本是否也這樣沒查。
- **F2（交塔台判斷）背景 Agent 執行中不在 active task bar，結束後描述沒有 `[completed]`**
  - 現象：`run_in_background: true` 的 Agent 呼叫，卡片出現 1.5 s 後 `.claude-active-task-item` = 0（推論：工具結果在啟動時就回來，`activeTasks` 隨即清掉）；結束後卡片 `dot-success`，描述仍是原本的「T0739 bg probe」，沒有 `task_notification` 會寫的 `[completed] …`。背景子代理完成後 CLI 自己多跑 1 個回合。
  - 不確定這是缺陷還是設計（CLAUDE.md「Sub-agent / Active Tasks Tracking」以 tool_result 清 `activeTasks`）；截圖 `t0739-agent-running.png` / `t0739-agent-after.png` 在 `e2e-results/`（未 commit）。
- 其他（已知，非新問題）：回合之間 `setPermissionMode` 回 `false`（T0727 已記錄），模式仍生效。

### 仍需手動

- `stopTask`（⑤ 選做）沒做。
- 長回答的串流游標畫面：本次回答都很短，沒觀察到串流中的游標。
- Cache History 畫面實際數字（F1）請人看一次。
- **使用者 `~/.claude` 的殘留**（工單只允許刪 `projects/` 底下名稱含 `bat-e2e-t0739` 的目錄，其他的沒刪）：
  - `projects/` 下 2 個（兩次執行各 1 個）已由 spec 刪除，現在 0 個。
  - 本次 session `8e50ff27…` 另留下 `session-env/8e50ff27-…` 與 `tasks/8e50ff27-…`（Task\* 清單檔），要刪請使用者手動處理；第 1 次執行的 session id 沒記到，無法對應。
  - `~/.claude.json` 沒有 `bat-e2e-t0739` 的項目。
- 工作區 `%ProgramData%\bat-e2e-t0739-*` 與隔離 runtime userData 兩次都已刪除。

### 互動紀錄

- [18:27] 開工，落點檢查 PASS，標 IN_PROGRESS（commit `b5f31f6f`）。
- [18:33] 第 1 次 `BAT_E2E_REAL_MODEL=1` 執行：① 實際完成（US$0.0082），但 spec 等 `claude:turn-end`，那是 codex 才送的事件，Claude 面板沒有 → 逾時失敗。這是 spec 錯誤，不是產品問題；只送出 1 回合。改成以 `claude:result` / `claude:error` 判斷回合結束。
- [18:39] 第 2 次執行 `1 passed (2.2m)`。
- [18:41] 依實測把 spec 的費用計算改成「累計值取最大」（原本把累計值相加，記成 US$0.337，高估）；只重跑 skip 與型別檢查。
- 沒有問塔台的問題。

### 回報時間

- 2026-11-01T18:42:08+0800
