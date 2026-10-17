---
schema_version: 1
schema_kind: workorder
id: T0484
title: "Claude 面板成本與模型顯示：Haiku 5.5 長 prompt 分段計價接線（逐 turn 計價後加總）+ setModel() 5 系列 contextWindow / maxOutputTokens 推估更正"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P2
sizing: S
created_at: "2026-10-13T23:13:05+08:00"
started_at: "2026-10-13T23:17:20+08:00"
updated_at: "2026-10-13T23:26:21+08:00"
completed_at: "2026-10-13T23:26:21+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - "T0483"
related:
  - "T0483 回報區第 9 節觀察 1 / 2；`src/lib/model-pricing.ts` `getModelPricing(model, { promptTokens })` 與 `HAIKU_5_5_LONG_PROMPT_THRESHOLD`"
  - "官方 models overview / pricing（T0483 第 3 節出處）"
affects_files:
  - "src/components/ClaudeAgentPanel.tsx"
  - "src/lib/model-pricing.ts"
  - "src/lib/__tests__/"
  - "electron/claude-agent-manager.ts"
  - "electron/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改 `src/components/CodexAgentPanel.tsx`（T0486 範圍）；若 Codex 面板也需要同樣接線，寫在回報區建議，不動檔"
  - "🔴 模型上限數值只取官方 models overview（附出處與擷取日期）；查不到的模型維持現行推估並註明"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 **不改 `CLAUDE.md`**（除非本單 frontmatter 另有授權）：需更新的文件內容寫在回報區「CLAUDE.md 建議文字」，由 T0493 統一套用"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0484 — Claude 面板成本與模型顯示：Haiku 5.5 長 prompt 分段計價接線（逐 turn 計價後加總）+ setModel() 5 系列 contextWindow / maxOutputTokens 推估更正

## A. Haiku 5.5 分段計價接線

- 現況：`ClaudeAgentPanel.tsx:3715`（per-model 統計，跨呼叫累加 token 再乘單價）與 `:3732`（per-turn 列）呼叫 `getModelPricing(model)` 未傳 `promptTokens` → Haiku 5.5 一律以 ≤100K 價計，>100K 請求低估 5 倍
- per-turn 列：以該列 prompt 長度（input + cache read + cache write，依官方「prompt length counts all of its input tokens」定義）傳 `promptTokens`
- per-model 統計：改為「逐 turn 計價後加總」（或等效做法），讓每次呼叫依自己的 prompt 長度選價；其他模型結果必須與現行完全相同（測試證明）
- 計價邏輯純函式化並加單元測試（≤100K / =100,000 / >100K / 多 turn 混合 / 非 Haiku 模型不變）

## B. `setModel()` 顯示推估（`electron/claude-agent-manager.ts:1697-1699` 一帶）

- 現況：非 `[1m]` 一律 `contextWindow = 200000`；名稱含 `haiku` 一律 `maxOutputTokens = 8192` → 5 系列（Opus 5.5 / Fable 5.1 / Sonnet 5.5 / Haiku 5.5，原生 1M）在下一次 `modelUsage` 覆蓋前顯示錯誤
- 依官方 models overview 建立「模型 → context / max output」對照（集中一處、可測），未知模型維持現行推估；legacy 4.x 行為不變
- 單元測試涵蓋 5 系列、legacy、`[1m]` 變體、未知 ID

## 驗收條件

- [x] A / B 單元測試；其他模型成本數值不變的測試
- [x] `npm run test:unit`（回報數字，標註他人 WIP 影響）；`npx vite build` exit 0
- [x] 回報區附官方數值出處；CLAUDE.md 建議文字（計價段 / `BAT_BUILTIN_MODELS` 段）

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 0. Landing Zone / 執行環境

- **結果：PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 之下 → PASS
- C-3：前 5 個可測 `affects_files` 皆存在 → PASS（資訊性）
- C-2：工單無 `branch` 欄位，不適用；實際在 `main`
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 狀態原為 `TODO`（非 `PENDING`），照常改為 `IN_PROGRESS`

### 1. 結果摘要

A、B 兩項都完成，單元測試與 build 皆綠。

**A. Haiku 5.5 分段計價接線**

- **為什麼要動後端**：result（R）列的 `modelUsage` 是 SDK 依模型加總整個 turn 所有 API 呼叫的結果，renderer 拿不到單次呼叫的 prompt 長度，只靠面板無法逐呼叫選價；非 result 列又只記主 agent、有去重、最多保留 20 筆，無法拿來還原。
- **後端**（`electron/claude-agent-manager.ts`）：
  - 每次 query 依 API message id 追蹤每次呼叫的 usage（新增 `QueryCallTracker` 與 `trackStreamEventUsage` / `recordCallUsage`）。
  - `stream_event` 的 `message_start` 取 id、model 與 input / cache tokens，`message_delta` 更新最終的 output tokens；sub-agent 的呼叫也一併記錄（以 `parent_tool_use_id` 區分來源）。
  - `assistant` 訊息的 `message.usage` 作為備援，涵蓋 stream event 沒轉送的呼叫，同一個 id 的各欄位取最大值。
  - result 時呼叫 `attachLongPromptUsage`，把 prompt（input + cache read + cache write）> `HAIKU_5_5_LONG_PROMPT_THRESHOLD` 的呼叫加總，寫進 `modelUsage[model].longPrompt`（這部分**包含在**原本的總量內，不是另外加上去）。
  - V1 / V2 開始 query 時、以及 result 處理完後，都會重置 tracker。
- **純函式**（`src/lib/model-pricing.ts`）：
  - `estimateCallCost(model, usage, split)`：單次呼叫，依該呼叫自己的 prompt 長度選價。
  - `estimateModelUsageCost(model, usage, split)`：跨呼叫加總。`longPrompt` 部分用長 prompt 價，其餘用基本價，兩者相加。計價是線性的，所以結果等於逐呼叫計價後加總。若 `longPrompt` 超過總量，會截到總量為止。
  - 另新增 `promptTokensOf()` 與 `TokenUsage` / `ModelUsageTokens` / `CacheWriteSplit` / `UsageCost` 型別。
  - 運算順序沿用 T0484 前面板的寫法，價格不分段的模型結果**逐位元相同**（測試用 `toEqual` 比對舊公式的逐字複本）。
- **面板**（`ClaudeAgentPanel.tsx` `calcModelCosts`）：
  - modelUsage 分支改呼叫 `estimateModelUsageCost`。
  - 單次呼叫列改呼叫 `estimateCallCost`，prompt 長度 = 未快取 input + cache read + cache write（即該列的 `totalInput`）。
  - 兩段內嵌的計價運算已移除。`SessionMeta.modelUsage` 型別加上可選的 `longPrompt`。

**B. `setModel()` 顯示推估**

- 新增 `estimateModelLimits(model)` 與 `MODEL_LIMITS` 對照表，集中在一處。
- 依官方 models overview：`opus-5-5` / `fable-5-1` / `sonnet-5-5` / `haiku-5-5` 皆為 1M context / 128K max output。
- 未列入對照表的 ID 維持 T0484 前的推估：`[1m]` → 1M，否則 200K；含 `haiku` → 8192，否則 64000。legacy 4.x、alias（`opus` / `haiku` / `default`）、Opus 5 / Sonnet 5 / Fable 5 都走這條規則，行為不變。

### 2. 官方數值出處

- `https://platform.claude.com/docs/en/models/overview`，2026-10-13 擷取。Compare models 表原文：`Context window | 1M tokens | 1M tokens | 1M tokens | 1M tokens`、`Max output | 128K tokens | 128K tokens | 128K tokens | 128K tokens`，欄位依序為 Claude Fable 5.1 / Opus 5.5 / Sonnet 5.5 / Haiku 5.5；ID 依序為 `claude-fable-5-1` / `claude-opus-5-5` / `claude-sonnet-5-5` / `claude-haiku-5-5`。
- 表下註 Max output：`Synchronous Messages API limit.`（Batch API 搭配 beta header 可到 300k，與 Agent SDK 無關，沿用 128K）。
- **查不到的模型**：legacy 的 Fable 5 / Opus 5 / Opus 4.8 / 4.7 / 4.6 / 4.5 / Sonnet 5 / 4.6 / Haiku 4.5 在 overview 頁只列連結，沒有數值，依 memory_overrides 維持現行推估，未改。
- 分段計價的門檻與價格沿用 T0483 第 3b 節（pricing 頁 2026-10-13 原文：`A request's prompt length counts all of its input tokens, including cache reads and cache writes.`）。本單未改任何價格數字。

### 3. 修改檔案

| 檔案 | 變更 |
|---|---|
| `src/lib/model-pricing.ts` | 新增成本純函式與型別（只新增，既有 export 不變） |
| `src/components/ClaudeAgentPanel.tsx` | import 改為 `estimateCallCost` / `estimateModelUsageCost`；`calcModelCosts` 兩分支改呼叫純函式；`SessionMeta.modelUsage` 型別 |
| `electron/claude-agent-manager.ts` | `estimateModelLimits` / `MODEL_LIMITS`；per-call tracker、`attachLongPromptUsage`；`SessionMetadata.modelUsage` 型別加 `longPrompt`；`SessionInstance.callUsage`；`setModel()` 改用 `estimateModelLimits` |
| `src/lib/__tests__/model-pricing-cost.test.ts`（新） | A 的純函式測試 |
| `electron/__tests__/claude-model-limits-and-call-usage.test.ts`（新） | B 的上限表測試；tracker 與 `attachLongPromptUsage` 測試；經 `processMessage` 的端到端測試；`setModel()` 接線測試 |

未動 `CodexAgentPanel.tsx` 與 `CLAUDE.md`。

### 4. 驗收證據

| Lane | 結果 | 證據 |
|---|---|---|
| A 單元測試 | PASS | `model-pricing-cost.test.ts`，含：≤100K、剛好 100,000（仍是低價）、100,001（長 prompt 價，output 一併套用）、5m/1h 權重、多呼叫混合（逐呼叫計價加總 = 分桶結果，且高於舊的全低價估計）、全部長 prompt、`longPrompt` 超量截斷、未知模型回 null |
| A 其他模型數值不變 | PASS | 13 個非 Haiku 5.5 的 ID × 3 種 cache write 拆分 × 4 組 usage，modelUsage 分支（有無 `longPrompt` 皆測）與單次呼叫列分支都與 T0484 前公式 `toEqual`；`MODEL_PRICING` 中除 `haiku-5-5*` 外的所有 key，傳入 `promptTokens` 回傳的都是同一個物件；Haiku 5.5 ≤100K 也與舊結果相同 |
| B 單元測試 | PASS | 5 系列（含 `[1m]` 後綴）、legacy 4.x 與 `[1m]` 變體、Opus 5 / Sonnet 5 / Fable 5、alias（`default` / `opus` / `haiku`）、未知 ID；`setModel()` 送出的 `claude:status` 帶正確數值 |
| 後端 tracker | PASS | 測 `message_start` / `message_delta` 依來源配對；assistant usage 合併取最大值；100,000 不算長、100,001 算長；`[1m]` key 可模糊比對；未知模型丟棄；`processMessage` 端到端（主 agent 走 stream、sub-agent 只有 assistant 訊息、result）得到正確的 `longPrompt`，且 tracker 已重置 |
| 本單相關測試 | PASS | `model-pricing.test.ts` + `model-pricing-cost.test.ts` 83 passed；`claude-model-limits-and-call-usage.test.ts` 29 passed；`claude-agent-manager-deps.test.ts` 仍綠 |
| `npm run test:unit`（全套） | PASS | `Test Files 178 passed (178)`、`Tests 3083 passed \| 1 skipped (3084)`。工作樹當時有他人 WIP（T0485：`electron/logger.ts`、`electron/early-path-fix.ts`、`package.json`；T0486：`CodexAgentPanel.tsx`、`src/types/*`、兩個測試檔），未造成失敗 |
| `npx vite build` | PASS | exit 0 |
| headless bundle | PASS | `esbuild electron/remote/headless-entry.ts --bundle --platform=node --packages=external` exit 0，新 import `../src/lib/model-pricing` 可解析（產物寫到 scratchpad，已刪除） |
| tsc（以檔案為單位） | PASS（無新增） | 在 HEAD `da1b9e1` 的暫時 worktree（node_modules 用 junction，結束時先拆 junction 再 `git worktree remove`）跑 `tsc -p .` + `tsc -p tsconfig.node.json`：`claude-agent-manager.ts` 21 個，本單改後同為 21 個，錯誤類型逐項相同（皆為既有的 PermissionResult / SDKSessionOptions / SessionMessage 等）；`ClaudeAgentPanel.tsx`、`model-pricing.ts` 改前改後皆 0。全專案總數：HEAD 113、目前 77（減少的部分來自 T0486 的 WIP，與本單無關） |
| runtime smoke | 未跑 | 依 memory_overrides 不以預設實例啟動；本單以 `processMessage` 端到端單元測試代替。實際 Haiku 5.5 >100K 對話的 est. $ 與 real $ 比對，留給塔台聯合複驗或實機 |

### 5. 偏差 / 殘餘風險

1. **範圍內的設計選擇**：工單寫「逐 turn 計價後加總（或等效做法）」。我採等效做法：後端分兩桶（≤100K / >100K），renderer 分別計價後相加。這需要後端新增追蹤，屬 `affects_files` 已列的 `electron/claude-agent-manager.ts`。
2. **漏追的呼叫退回低價**：沒經過 stream event 也沒有 assistant 訊息的呼叫（例如 CLI 內部的背景呼叫、壓縮），或 model 名稱對不上任何 `modelUsage` key 的呼叫，不會進 `longPrompt`，仍以 ≤100K 價計算，等同 T0484 前的行為，只會低估、不會高估。
3. **sub-agent output 可能偏低**：sub-agent 呼叫若只有 assistant 訊息、沒有 `message_delta`，`outputTokens` 取的是 assistant 訊息裡看到的最大值，可能小於最終值。少算的部分以低價計，同樣只會低估。
4. **單次呼叫列沿用既有語意**：該列的 `totalInput` 來自 `session.metadata.inputTokens`，後端只在「單次 contextTokens 變大」時更新它，上一個 turn 的 result 之後可能殘留跨 turn 的總量（既有行為，本單未動）。該值 >100K 時會以長 prompt 價估算該列，與該列顯示的 token 一致。若要修，另開單整理非 result 列的語意。
5. `longPrompt` 對所有模型都會記錄（例如 Opus 5.5 >100K 的呼叫），但只有價格分段的模型（目前只有 Haiku 5.5）會用到，其他模型的計價不受影響（有測試）。
6. `grandTotal` 迴圈會把非 result 列與 R 列一起加總（既有行為，未改）。

### 6. 建議（非本單範圍）

- **Codex 面板**（T0486 範圍，未動檔）：`CodexAgentPanel.tsx` 計價的對象是 OpenAI 模型，`getModelPricing` 對它們都回 `null`，Haiku 5.5 分段在 Codex 面板實際不會發生，目前不需要接線。若日後 Codex 面板會顯示 Claude 模型成本，可直接改用 `estimateCallCost` / `estimateModelUsageCost`（純函式已共用）。
- 若要讓「單次呼叫列」也精準，可改用後端 tracker 的 per-call 資料取代 `inputTokens` 的最大值語意（見殘餘風險 4）。

### 7. CLAUDE.md 建議文字（交 T0493 套用）

**計價段**（`## Claude Agent SDK / CLI` 第 4 點）：將「`getModelPricing(model, { promptTokens })` 支援分段，但 Claude / Codex 面板目前未傳 `promptTokens`，一律以 ≤100K 價格計（長 prompt 會低估）。」替換為：

> `getModelPricing(model, { promptTokens })` 支援分段。Claude 面板的 Cache History 自 T0484 起經 `estimateCallCost()` / `estimateModelUsageCost()`（同模組，運算順序與舊面板相同，價格不分段的模型結果逐位元不變）計價：單次呼叫列以該列 prompt 長度選價；R 列的 `modelUsage` 是跨呼叫加總，主行程依 API message id 追蹤每次呼叫（`stream_event` 的 `message_start` / `message_delta` + `assistant` 訊息 usage，sub-agent 一併記錄），result 時把 prompt > 100,000 的呼叫加總寫入 `modelUsage[model].longPrompt`（含在總量內），renderer 對這部分用 long 價、其餘用基本價。漏追的呼叫（CLI 背景呼叫等）仍以 ≤100K 價計，只會低估。Codex 面板只計 OpenAI 模型（皆回 `null`），未接線。

**`BAT_BUILTIN_MODELS` 段**（第 3 點末尾）追加：

> `setModel()` 切換模型後、下一次 `modelUsage` 回報前，顯示的 context window / max output 取自 `estimateModelLimits()`（`electron/claude-agent-manager.ts` `MODEL_LIMITS`，T0484）：Opus 5.5 / Fable 5.1 / Sonnet 5.5 / Haiku 5.5 為 1M / 128K（官方 models overview，2026-10-13）；其餘 ID（含 legacy 與 alias）沿用舊推估（`[1m]` → 1M 否則 200K；含 `haiku` → 8192 否則 64000）。新增 5 系列模型時同步補此表與 `electron/__tests__/claude-model-limits-and-call-usage.test.ts`。

### 8. Commit

- `git commit --only` 本單 6 個檔案（3 個產品檔、2 個新測試、本工單）。commit message 含 `T0484`，未 push；hash 見 `git log`（本單 commit 之後即為 HEAD）。

### 回報時間

2026-10-13T23:26:21+08:00
