---
schema_version: 1
schema_kind: workorder
id: T0744
title: "修 BUG-181：Claude 面板 Cache History 以 session 累計的 `modelUsage` / `total_cost_usd` 換算成每回合值，合計不再重複計算"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T18:46:17+0800"
started_at: "2026-11-01T18:47:32+0800"
updated_at: "2026-11-01T19:09:37+0800"
completed_at: "2026-11-01T19:09:37+0800"
session_ids:
  - "bf0336cb-d44c-41c2-ab11-34c3a71c0cb0"
depends_on: []
related:
  - "BUG-181（T0739 回報區〈發現的問題〉F1、〈用量〉表：`result.usage` 是單一 query、`result.modelUsage` / `total_cost_usd` 是 session 累計，含 prompt suggestion 等額外請求、resume 後延續）"
  - "`src/lib/cache-history.ts`（`cacheHistoryRowCosts`，註解「R row — the whole turn」）、`src/lib/__tests__/cache-history.test.ts`、`src/components/ClaudeAgentPanel.tsx` 約 3828 / 3874–3880 行（`realTurnCost`、`apiTotal`）、`src/lib/model-pricing.ts`；CLAUDE.md「Claude Agent SDK / CLI」節（計價唯一 `model-pricing.ts`、Cache History 邏輯 `cache-history.ts`）、`docs/agent-guide/claude-agent-sdk-cli.md`"
  - "`e2e/v072-real-model-claude-panel.spec.ts`（T0739，`BAT_E2E_REAL_MODEL=1`）、`e2e/v072-pre6-claude-panel.spec.ts` / `e2e/fixtures/fake-anthropic-api.ts`（假 API 不送 `modelUsage`）"
affects_files:
  - src/lib/cache-history.ts
  - src/lib/__tests__/cache-history.test.ts
  - src/components/ClaudeAgentPanel.tsx
  - "electron/claude-agent-manager.ts（只在 result 事件需要多帶欄位時；IPC 簽章向後相容）"
  - "e2e/（假 API 情境：讓假 API / 測試以 CLI 實際格式送累計 `modelUsage`，或以 IPC 注入 result 事件）"
  - docs/agent-guide/claude-agent-sdk-cli.md
  - CLAUDE.md
  - _ct-workorders/BUG-181-cache-history-sums-cumulative-model-usage.md
  - _ct-workorders/T0744-fix-cache-history-cumulative-usage.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先查證：以 T0739 的 log 證據與 SDK 0.3.316 / CLI 2.1.316 的型別或原始碼，確認 `result.modelUsage`、`total_cost_usd` 為 session 累計、`result.usage` 為單一 query；並追所有 consumer（Cache History R 列與 `realTurnCost`、`apiTotal` 合計、狀態列 `totalCost` / session cost、統計 / 匯出、存檔與還原的 cache history）列出各自目前用的是累計還是單回合，哪些是錯的。Codex 面板（`CodexAgentPanel.tsx` 有相同寫法）🔴 不在修正範圍：只在回報區記錄 codex 的 `modelUsage` 是否也是累計（查得到就寫，查不到寫未查），由塔台另案決定。"
  - "🔴 修正規則：每個 R 列的 tokens 與費用 = 本回合累計 − 同一 session 上一個 R 列的累計，依 model 分開相減（新出現的 model 以 0 為基準；任何欄位相減為負 → 視為累計重置，改以本回合值為準並記 debug log）；API 合計 = 最後一個累計值（或各列差值相加，兩者須相等）；resume / 重開 BAT 後第一個回合的基準：若能取得上一個累計（存檔的 history 或 SDK）就用，否則該列標示為「含先前累計」或以 `result.usage` 計，選一種並在 docs 寫明。換算寫成 `cache-history.ts` 的純函式（唯一實作），ClaudeAgentPanel 不內聯。計價一律經 `model-pricing.ts`。已存檔的舊 history（累計值）還原後顯示也要正確（同一規則可處理就沿用；不行則說明）。"
  - "🔴 行為不變（R-G003 第 3 點）：Cache History 其他列（非 R 列）、cache 命中率百分比、`claude:result` / `claude:error` IPC 簽章、狀態列既有正確的值、Codex 面板一律不變。動工前列出相關已通過案例（`cache-history.test.ts`、`model-pricing.test.ts`、`v072-pre6-claude-panel.spec.ts` ①–⑫、`v072-pre7-claude-panel-ui.spec.ts`）並於改動後逐案確認，回報區列〈相關通過案例判定〉。"
  - "🔴 build 錯開（重要）：T0742 Worker 正在同一個 checkout 以 `dist/` / `dist-electron/` 跑隔離實例 e2e。🔴 在 `_ct-workorders/T0742-*.md` frontmatter `status` 變成 DONE / PARTIAL / BLOCKED / FAILED 之前，不得執行 `npx vite build`、`npm run build*`、任何 e2e，也不得刪改 `dist*`；這段期間先做查證、修正、單元測試（`npm run test:unit` 可跑）、兩個 typecheck；之後才 build 與跑 e2e，等待時用 Monitor / 間隔檢查該檔，不要忙等。"
  - "🔴 驗證：單元測試涵蓋：多回合累計 → 每列正確差值、合計 = 實際累計（用 T0739〈用量〉表的數字當案例：8 回合實際 US$0.143、舊算法約 0.34）、中途換模型（新 model 基準 0）、累計重置（負值）、resume 第一回合、舊存檔還原。e2e：以假 API 送 CLI 實際格式的累計 `modelUsage`（擴充 fake API 時不得改既有 spec 的斷言意圖）或以注入 result 事件，打開 Cache History 斷言 R 列與合計。🔴 不得用真實模型重跑 T0739 spec（不耗 token）；回報區附「建議使用者日後以 `BAT_E2E_REAL_MODEL=1` 複驗」一句即可。`npm run test:unit` 全過；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功。完成後 BUG-181 改 FIXED（附 commit）。CLAUDE.md「Claude Agent SDK / CLI」節只補一句（累計值換算規則、唯一實作位置），細節寫 docs。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）；會改變使用者可見數字定義而本單沒寫到的（例如狀態列 session cost 的意義），先問塔台。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0744 — 修 BUG-181：Cache History 累計值重複計算

## 元資料

- **工單編號**：T0744
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-01T18:46:17+0800
- **預估規模**：M

## 背景

T0739（真實模型小額驗收）發現：內嵌 CLI 2.1.316 回傳的 `result.modelUsage` / `total_cost_usd` 是 session 累計值，Claude 面板 Cache History 把它當成單一回合，R 列逐列膨脹，合計再把各列相加（實際 US$0.143，顯示約 0.34）。假 API e2e 不送 `modelUsage`，所以以往抓不到。使用者指示現在開單修。

## 範圍

1. 查證累計語意並列出所有 consumer。
2. 累計 → 每回合換算的純函式與面板接線。
3. 單元測試、假 API / 注入 e2e。
4. BUG-181 → FIXED；CLAUDE.md 一句、docs。

## 不做

- 不改 Codex 面板（只記錄其語意）。
- 不用真實模型重跑。

## 驗收

- [x] 累計語意查證與 consumer 對照表
- [x] 單元測試（含 T0739 實測數字）與 e2e 綠；〈相關通過案例判定〉
- [x] `test:unit` 全過、兩個 typecheck = 0、`vite build` 成功
- [x] build / e2e 在 T0742 結案後才執行（回報區記錄時間）

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **session_id**：bf0336cb-d44c-41c2-ab11-34c3a71c0cb0
- **產品 commit**：`0d42ebdc`（`fix(claude-panel): T0744 BUG-181 Cache History R rows from the CLI running totals`），未 push。
- **落點檢查**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 皆存在（含已存在的祖先）；無 `branch` 欄位（C-2 不適用）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`。`CT_HOME` 未設（非 worktree）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

#### 1. 累計語意查證

| 欄位 | 語意 | 依據 |
|---|---|---|
| `result.modelUsage` | **session 累計**（每個 result 帶到目前為止的總量；含主 agent、Task 子代理、sidechain、compaction 等內部呼叫；resume / fork 從 transcript 存的總量接續；`/clear` 重置；crash / 啟動錯誤的 result 可能為 0） | SDK 0.3.316 `sdk.d.ts` `SDKResultSuccess` / `SDKResultError.modelUsage` 註解；T0739 實測（② `cacheReadInputTokens` 84,804 = 18,282 + 66,522） |
| `result.total_cost_usd` | **session 累計**，生命週期同 `modelUsage` | 同上 `total_cost_usd` 註解；本單 e2e ①：0.01627 → 0.04880 → 0.09757 |
| `result.usage` | 單一回合，只算主 agent 迴圈 | 同上 `usage` 註解（"MAIN AGENT LOOP ONLY … per-turn"） |
| resume 後是否延續 | 是 | 本單 e2e ②：重開 BAT resume 後第一個 result 的 cache read = 2,000,000 = 前 3 回合 1,200,000 + 本回合 800,000；T0739 ⑦ |
| Codex（不改，只記錄） | `codex-agent-manager.ts` **不送 `modelUsage`**（Codex 面板沒有 R 列）；`turn.completed.usage` 依 `@openai/codex-sdk` 型別註解為**單一回合**（"used during the turn"），主行程以 `+=` 加到 `metadata.inputTokens` / `outputTokens` / `cacheReadTokens`（session 累計）；`totalCost` 恆為 0 | `electron/codex-agent-manager.ts` `turn.completed`、`node_modules/@openai/codex-sdk/dist/index.d.ts` `Usage` |

#### 2. consumer 對照

| consumer | 修正前用的值 | 對錯 | 本單處置 |
|---|---|---|---|
| Cache History R 列 tokens / `%` / turn c.read / c.write / total / output（`applyStatusToCacheHistory`） | 累計（`modelUsage` 與主行程由它加總的 `inputTokens` 等） | ❌ | 改為本回合差值 |
| R 列 est. $（`cacheHistoryRowCosts`） | 累計 `modelUsage` | ❌ | 隨 R 列改為差值 |
| R 列 real $（`realTurnCost`，面板內聯） | 累計 `costUSD` | ❌ | 改用 `cacheHistoryRealCost`（差值） |
| 合計 est. $（`cacheHistoryGrandTotal`） | 各 R 列累計相加 | ❌ | 函式不變，R 列改為差值後正確 |
| 合計 real $（`apiTotal`，面板內聯） | 各 R 列累計 `costUSD` 相加（T0739：0.34 vs 0.143） | ❌ | 改用 `cacheHistoryApiTotal`（= 最後累計） |
| Cache entry 明細 modal（`Turn n · % cache · input · output`） | R 列欄位（累計） | ❌ | 隨 R 列改為每回合 |
| 狀態列 `cost`（`sessionMeta.totalCost`） | 累計 `total_cost_usd` | ✅（session cost） | 不變 |
| 狀態列 `cache:` 百分比 | 累計 cache read ÷ 累計 input | ✅（session 值） | 不變；顏色取 history 中 ≥ 50k 的列最低 %，R 列改為每回合後跟著改 |
| 存檔的 sessionMeta（`setTerminalSessionMeta`：totalCost / inputTokens / outputTokens / numTurns…） | 累計 | ✅（狀態列還原用 session 值） | 不變 |
| 單次呼叫列（`lastCall`）、pre-T0498 非 R 列 | 單次呼叫 | ✅ | 不變 |
| `lastResultRef.totalInput`（cache 倒數） | 累計 input | 只用時間戳，數值未顯示 | 不變 |
| 統計 / 匯出 | 無（Claude 面板沒有 Cache History 匯出） | — | — |
| 存檔與還原的 cache history | 不存在（`cacheHistoryRef` 只在記憶體） | — | 記錄於 docs；`applyStatusToCacheHistory` 不給 baseline 時以前一個 R 列為基準，T0744 前建立的 R 列（`modelUsage` 即累計）也能當基準 |
| `claude:status` / `claude:result` IPC | 累計 | — | 主行程不改，簽章不變（`electron/claude-agent-manager.ts` 未動） |

#### 3. 修正

- `src/lib/cache-history.ts`：
  - `turnModelUsage(current, previous)`（換算唯一實作）：依 model 相減、新 model 以 0 為基準、沒變化的 model 不列（全沒變保留 0）；任何欄位變小或有用量的 model 消失 → `reset`（該列 = 本次累計）；基準未知 → `includes-prior`（該列 = 本次累計）；`costUSD` 容許 1e-9 誤差；`longPrompt`（本 query 的追蹤，非累計）原樣保留。
  - `applyStatusToCacheHistory(hist, m, ctx, baseline?)`：result 列以差值建列、記 `cumulativeModelUsage` / `usageBasis`，並推進 baseline；與基準相同的 result（重送）不加列。不給 baseline 時以 hist 前一個 R 列為基準（無則 0）。
  - `CacheHistoryUsageBaseline`、`freshUsageBaseline()`、`unknownUsageBaseline()`、`cacheHistoryRealCost()`、`cacheHistoryApiTotal()`。
- `src/components/ClaudeAgentPanel.tsx`：`cacheUsageBaselineRef`（新 session / `/new` / `claude:session-reset` → fresh；auto-resume / 清單 resume / fork 新分頁 / 重新掛載 → unknown；Clear 不動基準）；R 列 `#` 顯示 `R*`（includes-prior）與 tooltip（reset 也有）；`usageBasis` 非 `turn` 時記 debug log；real $ 與合計改用 lib 函式；底部說明加一句；列加 `claude-cache-history-row` / `data-row-kind` / `data-usage-basis`、合計列 `claude-cache-history-total`（e2e 用）。
- resume 第一回合的基準：選「標示 `R*`（含先前累計）」，不用 `result.usage`（不含子代理與額外請求、沒有 `costUSD`，用了 real $ 合計 ≠ 累計）。已寫入 docs。
- 計價一律經 `model-pricing.ts`（未改）。
- `docs/agent-guide/claude-agent-sdk-cli.md` 新增「Cache History 的 R 列：CLI 累計值換算（T0744 / BUG-181）」節，並改既有 R 列描述；`CLAUDE.md`「Claude Agent SDK / CLI」節計價那一行後補一句。
- e2e：`e2e/fixtures/fake-anthropic-api.ts` 的 `FakeTurn` 加選用 `usage`（不給時與原本完全相同：message_start input 10 / output 1、message_delta output 5）；新 spec `e2e/t0744-cache-history-cumulative.spec.ts`。

#### 4. 驗證（證據分道）

| 道 | 項目 | 結果 |
|---|---|---|
| source | 兩個 typecheck | `npm run typecheck` exit 0；`npm run typecheck:electron` exit 0 |
| test | `npm run test:unit` | PASS：358 檔、6339 passed / 3 skipped |
| test | T0744 單元測試（`cache-history.test.ts`「T0744」8 案） | PASS：T0739 數字 7 個 R 列各為該回合（② 66,522），real $ 合計 0.1432（舊算法 0.3372），est. $ 合計 = 最後累計的估價；換模型（新 model 基準 0）；重置（負值、token 變少、model 消失、浮點誤差不算）；resume 第一回合 `includes-prior`；重送與 Clear 後重送不加列；無 baseline 參數 / T0744 前的舊列當基準；`longPrompt`；面板 source guard |
| build | `npx vite build` | exit 0（19:07，T0742 於 19:06:35 前已 DONE） |
| e2e | `e2e/t0744-cache-history-cumulative.spec.ts` | 1 passed：① 新 session 3 回合，R 列 `R`/`turn`，turn c.read 200,000 / 400,000 / 600,000（修正前會是 200k / 600k / 1.2M）、c.write 10k / 20k / 30k，real $ 合計 $0.0976 = session cost 0.0975675；② 重開 resume 後第 4 回合為 `R*` / `includes-prior`（c.read 2,000,000，CLI 延續累計），real $ 合計 $0.1626 = session cost 0.16259；proxy attempts [] |
| e2e | `v072-pre6-claude-panel.spec.ts`、`v072-pre7-claude-panel-ui.spec.ts` | 4 passed（pre6 ①–⑫ 全 PASS） |
| 真實模型 | 未執行（依工單不耗 token） | 建議使用者日後以 `BAT_E2E_REAL_MODEL=1 npx playwright test e2e/v072-real-model-claude-panel.spec.ts` 複驗，並開 Cache History 看 R 列與合計 |

- SHA：驗證（unit / typecheck / build / e2e）時 HEAD = `e8d4afa9`＋工作區未提交變更；產品 commit `0d42ebdc` 內容 = 驗證時的工作區，另加 docs 一行（`R*` 列 est. $ 低估的已知限制，於 e2e 後補），只動 docs、不需重驗。

### 相關通過案例判定

| 案例 | 與改動的關係 | 判定 |
|---|---|---|
| `src/lib/__tests__/cache-history.test.ts`（T0498 per-call 列 8 案、grand total 4 案） | per-call 列與合計邏輯 | 不變，全 PASS |
| 同檔「pre-T0498 server — builds exactly the rows the old panel built」 | 含一個 result 列 | 意圖不變：非 R 列逐欄相同；R 列（新 session 第一個 result，基準 0）數字與舊版相同，只多 `cumulativeModelUsage` / `usageBasis` 兩欄 → 斷言改為去掉這兩欄後 `toEqual`，另斷言 `usageBasis: 'turn'`、累計 = 列值。PASS |
| `electron/__tests__/claude-cache-history-last-call.test.ts`（T0498 replay 6 案） | harness 原本每個 result 只送該 query 的 `modelUsage`（與實際 CLI 不符） | harness 預設改送累計（實際格式）；T0498「修正前」數字以 `perQuery: true` 保留同一組斷言；「修正後」斷言（grand total = 每次呼叫加總、列序、real $ 0.02）不變。PASS |
| `src/lib/__tests__/model-pricing.test.ts` | 計價未改 | PASS |
| `v072-pre6-claude-panel.spec.ts` ①–⑫ | 假 API 加選用欄位（預設不變）、面板 Cache History | 不涉及 Cache History 的斷言，全 PASS |
| `v072-pre7-claude-panel-ui.spec.ts` | 面板 UI | PASS |
| 非 R 列、cache 命中率（狀態列 `cache:` 數字）、`claude:result` / `claude:error` IPC、狀態列 `cost`、Codex 面板 | 未改 | 不變（Codex 面板與主行程檔案未動） |

### 遭遇問題

- **範圍偏離（必要）**：`electron/__tests__/claude-cache-history-last-call.test.ts` 不在 `affects_files`。它的 harness 假設 `modelUsage` 為單一 query，修正後 3 案失敗；不改則 `test:unit` 無法全過。已改為實際累計格式並保留斷言意圖（見上表），請塔台知悉。
- **已知限制（寫入 docs）**：`R*` 列的 est. $ 對 Haiku 5.5 只有本 query 的長 prompt 呼叫用 long 價，先前回合以基本價估 → 低估（e2e ②：est. $0.0845、real $0.1626）；real $ 正確。
- **使用者可見的定義變化（判讀為本單範圍，未問塔台）**：R 列的 `%`（tooltip 本來就寫「Turn cache efficiency」）改為每回合值；狀態列 `cache:` 的顏色（取 history 最低 %）跟著改用每回合值；新增 `R*` 標示。狀態列 session cost / `cache:` 數字的定義未改。
- 回合之間的額外請求（prompt suggestion、背景子代理後 CLI 自動接續的回合）算進下一個 R 列（docs 已寫明）。
- **索引**：依 R-G003 第 4 點，BUG-181 改 FIXED 時同批更新 `_ct-workorders/_bug-tracker.md`（BUG-181 列由「修復中」移到「已修復」、統計 Fixing 0 / Fixed 12；「最後同步」行未動，留給塔台）。此檔不在 `affects_files`。

### 互動紀錄

- [18:47] 開工；T0742 為 IN_PROGRESS → 先做查證、修正、單元測試、typecheck，不 build / e2e。
- [19:01] `test:unit` 全過；以背景 until 迴圈（30 s 間隔）監看 `T0742` frontmatter `status`。
- [19:06] T0742 → DONE；19:07 起 `npx vite build`、e2e（t0744、pre6、pre7）。
- 未向塔台提問（無阻塞的判讀問題）。

### 回報時間

2026-11-01T19:08:17+0800
