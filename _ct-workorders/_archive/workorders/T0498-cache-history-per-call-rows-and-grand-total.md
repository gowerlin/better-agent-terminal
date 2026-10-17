---
schema_version: 1
schema_kind: workorder
id: T0498
title: "Claude 面板 Cache History：單次呼叫列改用 per-call tracker 資料（修 inputTokens 跨 turn 殘留語意）+ 查明 grandTotal 是否重複加總非 result 列與 R 列"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P2
sizing: S
created_at: "2026-10-13T23:27:10+08:00"
started_at: "2026-10-14T00:16:46+08:00"
updated_at: "2026-10-14T00:26:41+08:00"
completed_at: "2026-10-14T00:26:41+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - "T0484"
  - "T0496"
related:
  - "T0484 回報區第 5 節殘餘風險 4（單次呼叫列 `totalInput` 來自 `session.metadata.inputTokens`，只在 contextTokens 變大時更新，可能殘留跨 turn 總量）與 6（`grandTotal` 迴圈把非 result 列與 R 列一起加總）"
  - "T0484 新增的 per-call tracker（`QueryCallTracker` / `recordCallUsage`，`electron/claude-agent-manager.ts`）與 `estimateCallCost` / `estimateModelUsageCost`（`src/lib/model-pricing.ts`）"
affects_files:
  - "src/components/ClaudeAgentPanel.tsx"
  - "electron/claude-agent-manager.ts"
  - "src/lib/model-pricing.ts"
  - "src/lib/__tests__/"
  - "electron/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先查明再改：`grandTotal` 若確實重複計算（非 result 列的成本已包含在同 turn 的 R 列內），修正並以測試證明；若非重複（兩者代表不同成本），只補註解與測試、不改數值，並在回報區說明"
  - "🔴 不改 `CodexAgentPanel.tsx`；Codex 面板若有同樣問題，寫回報區建議"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）；tsc / typecheck:electron 以檔案為單位不增加（T0496 後應為 0）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0498 — Cache History 單次呼叫列與總計

## A. 查明 `grandTotal`

- 追 `ClaudeAgentPanel.tsx` Cache History 的資料來源：非 result 列（單次呼叫）與 R 列（`modelUsage`，跨呼叫加總）各自代表什麼、是否同一批 API 呼叫被計兩次
- 以實際 `processMessage` 序列（單元層級）重建一個 turn，計算現行 grandTotal 與「真實成本」（逐呼叫加總）比較

## B. 單次呼叫列語意

- 改用 T0484 per-call tracker 的每次呼叫 usage（需要時由主行程隨 status / 事件送給 renderer），取代 `session.metadata.inputTokens` 的最大值語意；顯示的 token 與計價一致
- 既有 IPC 事件簽章若需擴充，trace 所有 consumer（preload / electron.d.ts / headless remote）並保持相容

## 驗收條件

- [x] A 的結論與證據（含測試）；如有修正，修正前後數值對照
- [x] B 單元測試；其他模型 / 既有顯示不回歸
- [x] `npm run test:unit`、`npx vite build`、`npm run typecheck`、`npm run typecheck:electron`
- [x] CLAUDE.md 建議文字（計價段）

## Sub-session 執行指示

1. 讀本工單 + D139 + T0484 回報區 + 相關檔案
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 0. Landing Zone / 執行環境

- **結果：PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 之下 → PASS
- C-3：可測 `affects_files` 皆存在（資訊性）→ PASS
- C-2：工單無 `branch` 欄位，不適用；實際在 `main`
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 狀態原為 `TODO`（非 `PENDING`），照常改為 `IN_PROGRESS`

### 1. A 結論：`grandTotal` 確實重複計算（已修）

**資料來源**

- **R 列**：result 的 `modelUsage`，是 SDK 對整個 query 所有 API 呼叫（含 sub-agent）依模型加總的結果。這一列本身就是該 query 的完整成本。
- **非 result 列（T0498 前）**：主 agent 每個 `message_start` / `message_delta` 送出的 `claude:status`。各欄位取自 session 全域的 `inputTokens` / `cacheReadTokens` / `outputTokens`。這些值只在「單次 context 變大」時才更新，上一個 result 之後則是上一 turn 的**加總**。所以這些列既不是單次呼叫，也不是 turn 總量。
- **舊 `grandTotal`**：只跳過「緊接在 R 列前的那一筆」非 result 列，其餘非 result 列都與 R 列一起加總。

**重複的三種來源**（皆以 `processMessage` 實際序列重建，見 `electron/__tests__/claude-cache-history-last-call.test.ts`）

1. 同一 query 的第 1 到 N-1 筆單次呼叫列，成本已含在同 query 的 R 列內，卻又加了一次。
2. 新 query 的 `system init` status 會把 `modelUsage` 清掉，但 `inputTokens` 仍是上一 turn 的加總，所以會多推一列「上一 turn 總量」。這一列沒有緊接在 R 前時會被加總，等於上一 turn 被算兩次。
3. **V2（`claude-code-v2` preset）**：`runQueryV2` 開始時沒有清 `metadata.modelUsage`，下一 query 的串流 status 都帶著上一 result 的 `modelUsage`，被 renderer 當成 R 列推入。結果 est. $ 與 **real $** 兩欄的總計都被重複加總。

**修正前後數值**（Opus 5.5，單元測試以 `toBeCloseTo(…, 10)` 斷言）

| 情境 | 真實成本（逐呼叫加總） | 修正前 Total est. $ | 修正後 Total est. $ |
|---|---|---|---|
| 1（V1）：3 主 agent 呼叫 + 1 sub-agent，接 2 呼叫 query | $0.3354 | $0.48642（+45%：第 1、2 筆單次呼叫列重複） | $0.3354 |
| 2（V1）：1 呼叫 query，接單次呼叫都大於前一 turn 總量的 2 呼叫 query | $0.1836 | $0.3074（+67%：殘留的上一 turn 總量列 + msg_7 列） | $0.1836 |
| 2（V2）：同上，走 V2 | $0.1836 | $0.3256（+77%：上一 turn `modelUsage` 多算 2 次）；real $ 總計 $0.04（應為 $0.02） | $0.1836；real $ $0.02 |

**新規則**（`cacheHistoryTotalRows`）

- R 列一律計入。
- R 列之前、與「該段最後一筆單次呼叫列」同一 query 的單次呼叫列，已包含在 R 內，不再加。
- 不同 query 的列（沒有 result 就結束的 query，例如中斷）仍計入。
- 最後一個 R 之後的列（query 進行中）仍計入，等 R 到來後就由 R 取代。
- 舊 server 送來的列沒有 query 編號，由後面的 R 全部涵蓋。

### 2. B：單次呼叫列改用 per-call tracker

**後端**（`electron/claude-agent-manager.ts`）

- `QueryCallTracker` 加 `seq`，每個 tracker（即每個 query）一個編號。
- 新增 `mainAgentCall(tracker)` 與 `LastCallUsage` 型別。
- 主 agent 的 stream status 帶 `metadata.lastCall`（id / model / query / 四種 token）。
- query 開始與 result 時，`lastCall` 設為 `null`。
- 新增 `resetQueryUsage()`，由 V1 `runQuery` 與 V2 `runQueryV2` 共用（V2 原本只重置 tracker，即上面第 3 點的根因）。
- `lastCall` 用 `null` 而不是省略：renderer 才能分辨「新 server、目前沒有呼叫」與「舊 server」。

**Renderer**（新檔 `src/lib/cache-history.ts`；`ClaudeAgentPanel.tsx` 改為呼叫它）

- `applyStatusToCacheHistory()`：
  - 有 `lastCall` → 每個主 agent 呼叫一列，欄位與計價都用該呼叫自己的 token 與 API model id；同一呼叫的 `message_delta` 就地更新（保留第一個 timestamp）。
  - `lastCall: null` 且沒有 `modelUsage`（init / setModel）→ 不推列，消除殘留列。
  - result → R 列，邏輯不變。
  - 沒有 `lastCall` 欄位（舊 headless server）→ 走 T0498 前的邏輯，測試以舊程式碼逐字複本 `toEqual` 比對。
- `cacheHistoryRowCosts()`：即原本的 `calcModelCosts`，原樣搬移，計價不變。
- `cacheHistoryGrandTotal()`：新加總規則。

**IPC 相容性**

- `claude:status` 只多一個欄位，簽章不變。
- preload / `electron.d.ts` 的型別為 `meta: unknown`，不需要改。
- remote 走 `electron/remote/protocol.ts` 原樣轉送（`path-aware-channels.ts` 標為 `sessionId + status`，不改寫內容）。
- 舊 server 搭配新 renderer 時走舊邏輯；新 server 搭配舊 renderer 時多出的欄位會被忽略。

### 3. 修改檔案

| 檔案 | 變更 |
|---|---|
| `electron/claude-agent-manager.ts` | tracker `seq`、`LastCallUsage` / `mainAgentCall`、`metadata.lastCall`、`resetQueryUsage()`（V1 / V2 共用） |
| `src/components/ClaudeAgentPanel.tsx` | onStatus 推列、`calcModelCosts`、`grandTotal` 改呼叫 `cache-history`；`SessionMeta.lastCall`；`cacheHistoryRef` 型別改為 `CacheHistoryEntry[]` |
| `src/lib/cache-history.ts`（新） | 從面板抽出的列邏輯、計價、總計 |
| `src/lib/__tests__/cache-history.test.ts`（新） | 13 個測試 |
| `electron/__tests__/claude-cache-history-last-call.test.ts`（新） | 6 個測試（`processMessage` 重播，含 A 的修正前後對照） |

`src/lib/model-pricing.ts` 未改（列在 `affects_files`，但不需要動）。未改 `CodexAgentPanel.tsx`、`CLAUDE.md`。

### 4. 驗收證據

| Lane | 結果 | 證據 |
|---|---|---|
| A 結論 + 測試 | PASS | 見第 1 節；三個重播情境斷言修正前與修正後的數值 |
| B 單元測試 | PASS | `cache-history.test.ts` 13 passed：單次呼叫列用自己的 token、`message_delta` 就地更新、Haiku 5.5 以單次 prompt 長度分段（prompt 100,000 → 低價、100,001 → 長價）、`lastCall: null` 不推列、R 列不變且去重、20 列上限、舊 server 逐字等價、總計規則（涵蓋 / 中斷 query / 進行中 / 舊列 / 未知模型） |
| 後端 | PASS | `claude-cache-history-last-call.test.ts` 6 passed：`lastCall` 序列（init / result 為 null，sub-agent 不影響）、`mainAgentCall`、`resetQueryUsage` 清除，並靜態確認 V1 / V2 都呼叫它 |
| 相關回歸 | PASS | 連同 T0484 的 `claude-model-limits-and-call-usage.test.ts`、`model-pricing-cost.test.ts`、`model-pricing.test.ts`：5 files / 131 passed |
| `npm run test:unit` | PARTIAL（本單無失敗） | `Test Files 1 failed \| 195 passed (196)`、`Tests 1 failed \| 3290 passed \| 1 skipped`。唯一失敗是 `electron/__tests__/ssh-teardown.test.ts > uninstallBundleOnRemote > rejects a bad host / user without spawning`（`expected true to be false`），來源是並行中的 T0505 未 commit WIP（`electron/remote/ssh-args.ts` 等，讓 `sshUser` 可為空），與本單檔案無關 |
| `npx vite build` | PASS | exit 0 |
| `npm run typecheck` | PASS | exit 0（0 錯誤） |
| `npm run typecheck:electron` | PASS | exit 0（0 錯誤） |
| runtime smoke | 未跑 | 依 memory_overrides 不以預設實例啟動；以 `processMessage` 重播單元測試代替。實機開 Cache History 看 Total est. $ 與 real $ 是否接近，留給塔台聯合複驗 |

### 5. 偏差 / 殘餘風險

1. **新檔**：`src/lib/cache-history.ts` 不在 `affects_files` 內。因為列邏輯與總計必須能以實際 status 序列測試，所以從面板抽出；只新增檔案，不碰其他工單的檔案。
2. **單次呼叫列只有主 agent**：sub-agent 的呼叫沒有 status，只會出現在 R 列（與 T0498 前相同）。query 進行中時，Total 只含主 agent 已完成的呼叫，R 到來後才完整。
3. **中斷 query 的判定**：以「該段最後一筆單次呼叫列的 query 編號」決定 R 涵蓋哪個 query。若新 query 在任何主 agent `message_start` 之前就產生 result，前一個中斷 query 的列會被誤判為已涵蓋（實務上 result 前必有 API 呼叫）。
4. **舊 headless server**：沒有 `lastCall`，單次呼叫列仍是舊語意。總計在 R 到來後正確；query 進行中時仍可能高估（舊列含上一 turn 總量）。
5. 單次呼叫列的 `turn c.read` / `turn c.write` / `turn total` 欄位現在是該呼叫自己的值（calls = 1）。狀態列 cache 顏色用的 `totalInput >= 50000` 判斷，也隨之改為單次 prompt 長度，比舊的「最大值 / 上一 turn 加總」更貼近欄位原意。

### 6. 建議（非本單範圍）

- **Codex 面板**：`CodexAgentPanel.tsx` 有相同的推列邏輯（:881）與 grandTotal 迴圈（:4068-4075）。目前它只計 OpenAI 模型，`getModelPricing` 都回 `null`，Total 顯示 `—`，實際不會發生錯算。若日後 Codex 面板顯示可計價的模型，建議改用 `cacheHistoryGrandTotal` / `applyStatusToCacheHistory`（需 codex manager 也送 `lastCall`）。

### 7. CLAUDE.md 建議文字（交 T0493 套用）

在 `## Claude Agent SDK / CLI` 計價段（T0484 建議文字之後）追加：

> Cache History 的列與總計邏輯在 `src/lib/cache-history.ts`（T0498）。主行程在主 agent 的串流 `claude:status` 帶 `lastCall`（該次 API 呼叫的 id / model / query 編號 / token，取自 per-call tracker）；query 開始與 result 時為 `null`（`null` 代表新版 server，欄位不存在代表舊版，renderer 走舊邏輯）。單次呼叫列一呼叫一列，以自己的 token 計價。R 列為 SDK `modelUsage`，含同 query 所有呼叫（含 sub-agent），**總計不重複加同 query 的單次呼叫列**，只加沒有 result 的 query 與進行中 query 的列。V1 / V2 開始 query 時都經 `resetQueryUsage()` 清 `modelUsage` / `lastCall` / tracker（T0498 前 V2 不清，上一 result 會被當成新的 R 列重複加總）。

### 8. Commit

- `git commit --only` 本單 6 個檔案（3 個產品檔含 1 個新檔、2 個新測試、本工單），commit message 含 `T0498`，未 push。

### 回報時間

2026-10-14T00:26:32+08:00
