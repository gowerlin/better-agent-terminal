---
schema_version: 1
schema_kind: workorder
id: T0370
title: "BUG-083 T-D：Codex 模型清單改讀 models_cache.json + effort 擴充 + 連線重試訊息不再誤報為錯誤"
type: fix
status: IN_PROGRESS
priority: P2
sizing: S
created_at: "2026-10-04T16:06:46+08:00"
updated_at: "2026-10-04T16:08:17+08:00"
started_at: "2026-10-04T16:08:17+08:00"
completed_at: null
target_version: next
depends_on:
  - T0369
related:
  - "BUG-083"
  - "T0366（research；回報區 H1「附帶發現」：`gpt-5.4`、`o3` 對 ChatGPT 帳號已不支援；models_cache 現有清單）"
  - "T0367（`c6214c2`：`src/lib/codex-error-classify.ts`、`Codex is ignoring` notice 模式）"
  - "T0369（`ca0d292`：SDK 0.160；回報區「遭遇問題 3」為本單 Part C 來源）"
  - "D121（排序：本單為第 3 張，下一張 T-C 選最新 binary）"
affects_files:
  - electron/codex-agent-manager.ts
  - electron/codex-models.ts
  - electron/__tests__/codex-models.test.ts
  - src/lib/codex-error-classify.ts
  - src/lib/__tests__/codex-error-classify.test.ts
  - src/types/index.ts
  - src/components/CodexAgentPanel.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - CHANGELOG.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 `~/.codex/models_cache.json` **只讀**；讀不到 / 格式不符 / 解析失敗一律靜默 fallback 到內建清單，不得讓 Codex 面板因此出錯。"
  - "🔴 不改 `findCodexBinary()` / `codex-bundled-path.ts`（T-C 範圍）；不動 `@anthropic-ai/*`、`ClaudeAgentPanel.tsx`、Claude 的 `EFFORT_LEVELS`（T0368 正在研究 Claude 端）。"
  - "🔴 不得把 `turn.failed` 或最終失敗降級——只有「回合仍在進行」的過程訊息可改為 notice。"
---

# T0370 — BUG-083 T-D：Codex 模型清單 + effort 擴充 + 連線重試誤報

- **狀態**：IN_PROGRESS
- **任務類型**：fix
- **工作量預估**：S
- **Context Window 風險**：低~中

## 背景

1. **模型清單過時**：`CODEX_MODELS`（`electron/codex-agent-manager.ts:175` 起）寫死；T0366 實測 `gpt-5.4`、`o3` 對 ChatGPT 帳號已回 `not supported when using Codex with a ChatGPT account`。新版 Codex CLI 會自動維護 `~/.codex/models_cache.json`（本機現況：`client_version` 0.159.2、`models` 為 6 筆的 array；每筆含 `slug`、`display_name`、`description`、`supported_reasoning_levels`、`default_reasoning_level`、`visibility`、`supported_in_api`、`priority` 等欄位）
2. **effort 落後**：`CODEX_EFFORT_LEVELS`（`src/types/index.ts:126`）= `minimal|low|medium|high|xhigh`；服務端已有 `max`（T0366：0.124 解不開 `unknown variant max`），SDK 0.160 `ModelReasoningEffort` 另含 `ultra|persistent`
3. **連線重試誤報**（T0369 smoke 發現）：0.160 連線抖動時送出頂層 `{"type":"error","message":"Reconnecting... n/5 (...)"}` 與 `item.type="error"` 的 `Falling back from WebSockets to HTTPS transport...`。BAT `case 'error'`（約 :1289）與 item error 非 `Codex is ignoring` 分支都送 `claude:error` → 回合仍在跑卻顯示紅色 Error、熄滅 streaming（與 T0367 修掉的 H2 同型）

## 範圍

### Part A — 模型清單改讀 cache（fallback 內建）

1. 新增 `electron/codex-models.ts`：
   - 純函式 `parseCodexModelsCache(json: unknown): Array<{ value; displayName; description; efforts?: string[]; defaultEffort?: string }> | undefined`——格式不符回 `undefined`；過濾 `visibility` 表示隱藏的項目（**實際欄位值請讀本機 cache 判斷**，只讀；回報區記錄你採用的判斷規則與本機 6 筆的過濾結果），依 `priority` 排序（若語意可判斷）
   - `loadCodexModels()`：讀 `CODEX_HOME`（未設則 `~/.codex`）下的 `models_cache.json`，任一失敗回 `undefined`
2. `getSupportedModels()`（約 :1455）：cache 可用 → 用 cache（`source: 'cache'`）；否則內建清單（`source: 'builtin'`）
3. 內建 `CODEX_MODELS` 清理：移除 T0366 實測不支援的 `gpt-5.4`、`o3`；補上本機 cache 中 `supported_in_api`/可見的現行模型作為新 fallback（以 cache 為準，不憑記憶）。`DEFAULT_CODEX_MODEL = 'gpt-5.5'` 維持不變
4. 確認 `CodexAgentPanel.tsx` 的模型下拉能顯示新清單（若 renderer 有另一份寫死清單，一併改為吃 `getSupportedModels()`；沒有就不動）

### Part B — effort 擴充

- `CODEX_EFFORT_LEVELS` 加入 `max`（服務端已確認）。`ultra` / `persistent` **只有**在本機 cache 某模型的 `supported_reasoning_levels` 中出現時才加入，否則不加（回報區說明依據）
- 若 cache 提供模型層級的 `supported_reasoning_levels`，effort 下拉可依所選模型過濾（做得到就做；renderer 改動過大則略過並在回報區說明）
- 新增 effort 若需顯示文字，三語 locale 同步

### Part C — 連線重試訊息改為 notice

- 在 `src/lib/codex-error-classify.ts` 新增純函式（例如 `isCodexTransientNotice(message): boolean`），涵蓋：`Codex is ignoring`（T0367 既有，改為共用此函式）、`Reconnecting... n/m`、`Falling back from WebSockets to HTTPS transport`。比對不分大小寫、抓關鍵片語
- `codex-agent-manager.ts` 頂層 `case 'error'` 與 item error 分支：命中 → `logger.log` + 以 T0367 相同的 system notice 通道顯示（`Reconnecting` 每次數字不同，請避免洗版：同一回合只顯示第一則或以單則更新，二擇一，回報區說明）；未命中 → 原行為
- 單元測試以 T0369 回報區 AC-4 的原文為 fixture

### Part D — CHANGELOG

`## [Unreleased]` 對應 `### Changed` / `### Fixed` 各一筆（refs: BUG-083, T0370）

## 明確排除（不要做）

- ❌ 不寫入 `~/.codex/`、不跑需要登入的真實回合
- ❌ 不改 binary 解析 / 候選優先序（T-C）
- ❌ 不動 Claude 端任何檔案
- ❌ 不 push、不 bump 版號、不碰 `AGENTS.md`

## 驗收條件

- [ ] AC-1 `npm run test:unit` 全綠，基線 **573** 提升；`codex-models.test.ts` 涵蓋：合法 cache、隱藏項過濾、格式錯誤 → `undefined`、檔案不存在 → `undefined`
- [ ] AC-2 `npx vite build` 成功；`npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 42（貼前後數字）
- [ ] AC-3 以本機真實 `~/.codex/models_cache.json`（只讀）跑 `parseCodexModelsCache`，回報區列出產出清單（slug / displayName / efforts）
- [ ] AC-4 `isCodexTransientNotice` 對三種訊息原文回 `true`；對 `turn.failed` 的 `unexpected status 401 Unauthorized ...` 與 T0367 的 `config-incompatible` / `cli-too-old` 原文回 `false`
- [ ] AC-5 內建 fallback 清單不含 `gpt-5.4`、`o3`
- [ ] AC-6 `git diff --stat` 僅動 `affects_files`

## Sub-session 執行指示

1. 讀取本工單 + T0366 回報區 H1 段 + T0369 回報區「遭遇問題 3」與 AC-4
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 記錄 tsc 基線
4. Part A → B → C → D
5. 跑 AC-1 ~ AC-6
6. 填寫回報區、更新 `status` / `completed_at` / `updated_at`
7. commit（`git commit --only` 指定實際改動檔），訊息建議：`fix(codex): model list from models_cache, effort max, transient reconnect notices (T0370)`
8. 依派發 mode 通知塔台（`bat-notify.mjs`；YOLO 依 ct-exec 規則帶 `--submit`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**FIXED** — Part A ~ D 全數完成，AC-1 ~ AC-6 全數 PASS（runtime：依排除項未跑需登入的真實回合；notice 路徑以單元測試 + 程式審閱驗證）。

**Landing Zone Check：WARN**
- C-0：frontmatter `repo` = absent → WARN「repo identity unavailable」；observed `basename(REPO_ROOT)` = `better-agent-terminal`
- C-1：PASS（工單位於 `REPO_ROOT/_ct-workorders/`）
- C-3：PASS（`electron/codex-agent-manager.ts`、`src/lib/codex-error-classify.ts`、`src/types/index.ts`、`src/components/CodexAgentPanel.tsx` 存在；`electron/codex-models.ts` 祖先 `electron/` 存在）
- C-2：工單無 `branch` 欄位，N/A（HEAD = `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

**Part A — 模型清單改讀 cache**
- 新增 `electron/codex-models.ts`：
  - `parseCodexModelsCache(json)`：需為物件且 `models` 為 array，否則 `undefined`；逐筆要求非空 `slug`，略過非物件與重複 slug；`supported_reasoning_levels[].effort`（亦容忍純字串）→ `efforts`、`default_reasoning_level` → `defaultEffort`；`display_name` 缺則用 slug、`description` 缺則空字串。過濾後無任何模型 → `undefined`（交由 fallback）
  - **visibility 判斷規則**：只保留 `visibility === "list"` 或**無此欄位**者；其餘（本機實值為 `"hide"`）一律隱藏。依據：本機 cache 只出現 `list` / `hide` 兩值，`hide` 的兩筆為 `gpt-reserve`、`codex-auto-review`（後者 description 為「Automatic approval review model for Codex」，明顯非使用者選用模型）。採白名單 `list`，未來出現其他隱藏值也不會誤列
  - **priority 排序**：數值**小者在前**（`gpt-6-luna`=4 居首、`codex-auto-review`=43 墊底，與 Codex 選單語意一致）；缺 priority 排最後；同值保留 cache 順序（stable sort）
  - **本機 6 筆過濾結果**：保留 `gpt-6-luna`(4)、`gpt-5.6-terra`(8)、`gpt-5.6-luna`(9)、`gpt-5.5`(13)；隱藏 `gpt-reserve`(hide, 4)、`codex-auto-review`(hide, 43)
  - `getCodexHome()`：`CODEX_HOME`（trim 後非空）否則 `~/.codex`；`loadCodexModels(codexHome?)`：`fs.readFile` + `JSON.parse` + parse，任何例外 → `undefined`。**只讀，無任何寫入**
- `getSupportedModels()`：cache 可用 → `source: 'cache'`；否則內建 → `source: 'builtin'`
- 內建 `CODEX_MODELS`：移除 `gpt-5.4`、`o3`；前插本機 cache 可見的 4 筆（`gpt-6-luna` / `gpt-5.6-terra` / `gpt-5.6-luna` / `gpt-5.5`，描述與 efforts 照 cache 原文）。其餘未經實測判定不支援的舊項（`gpt-5.4-mini`、`gpt-5.3-codex`、`gpt-5.3-codex-spark`、`codex-mini-latest`、`o4-mini`、`gpt-4.1`）保留——可能仍供 API key 帳號使用，工單只指定移除兩項。`DEFAULT_CODEX_MODEL = 'gpt-5.5'` 未動
- `CodexAgentPanel.tsx`：renderer **沒有**另一份寫死清單（已吃 `getSupportedModels()`）；僅讓 `source: 'cache'` 歸入「Codex Agent」群組（原本非 `sdk` 一律歸「Better Agent Terminal」），`ModelInfo` 型別補 `'cache'` 與 `efforts`

**Part B — effort 擴充**
- `CODEX_EFFORT_LEVELS` = `minimal|low|medium|high|xhigh|max|ultra`（`src/types/index.ts`）
  - `max`：工單指定（服務端已確認），本機 cache 5/6 模型亦列出
  - `ultra`：本機 cache `gpt-5.6-terra` 的 `supported_reasoning_levels` 含 `{"effort":"ultra","description":"Maximum reasoning with automatic task delegation"}` → 加入
  - `persistent`：本機 cache **無任何模型**在 `supported_reasoning_levels` 列出（字串只出現在 `model_messages.persistent_instructions` 提示詞欄位，非 effort）→ 不加
- `electron/codex-agent-manager.ts` 原有一份本地 `CODEX_EFFORT_LEVELS` 拷貝，改為 import `src/types` 的唯一定義（`electron/claude-runtime-router.ts` 已有從 `../src/types` import 值的先例），避免兩份漂移。`src/types/agent-profiles.ts` 的 effort 選項自動跟著擴充（未改檔）
- effort 下拉依所選模型過濾：**已做**。`codexEffortOptions` = `CODEX_EFFORT_LEVELS` ∩ 該模型 `efforts`，但**目前選中的值永遠保留**（避免 select 值不在選項內）；模型無 efforts 資訊時顯示全部。限制見「遭遇問題 3」
- locale：effort 下拉直接顯示原始字串（`{level}`），無翻譯 key → 三語 locale **不需改動**

**Part C — 連線重試訊息改為 notice**
- `src/lib/codex-error-classify.ts` 新增 `codexTransientNoticeKind(message)` → `'config-warning' | 'reconnecting' | 'transport-fallback' | undefined`，與 `isCodexTransientNotice(message): boolean`。規則（皆不分大小寫）：`^\s*codex is ignoring\b`（沿用 T0367 的行首語意）、`\breconnecting\.{3}\s*\d+\s*/\s*\d+`、`falling back from websockets? to https transport`
- `codex-agent-manager.ts` 新增私有方法 `showCodexTransientNotice()`，item error 分支與頂層 `case 'error'` 共用：命中 → `logger.log` + 以 T0367 相同的 `role: 'system'` `⚠️ ...` 訊息顯示，**不送 `claude:error`**；未命中 → 原行為（`claude:error`，頂層另有 `logger.error`）
- **防洗版策略：選「同一回合每種只顯示第一則」**。回合內 `noticesShownThisTurn: Set` 記錄已顯示的 kind；`reconnecting` / `transport-fallback` 各只顯示當回合第一則，後續只寫 log。`config-warning` 維持 T0367 的「每 session 一次」（依內容比對）。未選「單則更新」是因為 `addMessage` 無就地更新既有訊息的通道，改用會牽動 renderer
- `turn.failed`、idle timeout、`Codex turn ended unexpectedly` 等最終失敗路徑**完全未動**

**Part D — CHANGELOG**：`## [Unreleased]` → `### Fixed` 前插重試誤報一筆、`### Changed` 前插模型清單 / effort 一筆（皆 refs: BUG-083, T0370）

**改動檔案**：`electron/codex-models.ts`（新）、`electron/__tests__/codex-models.test.ts`（新）、`electron/codex-agent-manager.ts`、`src/lib/codex-error-classify.ts`、`src/lib/__tests__/codex-error-classify.test.ts`、`src/types/index.ts`、`src/components/CodexAgentPanel.tsx`、`CHANGELOG.md`、本工單。`src/locales/*.json` 列於 affects_files 但不需改

### 驗收條件逐項

- [x] **AC-1 PASS** — `npm run test:unit`：`Test Files 44 passed (44)`、`Tests 593 passed (593)`（基線 573 → 593，+20）。`codex-models.test.ts` 涵蓋：合法 cache（完整比對 4 筆輸出）、`hide` 過濾、缺 visibility / 缺 priority / 同 priority 順序、壞項目與重複 slug、字串型 effort、格式錯誤 → `undefined`（6 種）、無可見模型 → `undefined`、檔案不存在 → `undefined`、壞 JSON → `undefined`、錯誤 shape → `undefined`、`CODEX_HOME` 解析
- [x] **AC-2 PASS** — `npx vite build` exit 0；`npx tsc --noEmit 2>&1 | grep -c "error TS"`：改動前 **42** → 改動後 **42**；去除行號後前後錯誤訊息集合 `diff` 完全相同，新檔與改動檔無新增 error
- [x] **AC-3 PASS** — scratchpad `t0370-ac3.mts`（Node 24 type-stripping 直接 import `electron/codex-models.ts`）以 `loadCodexModels()` 讀本機真實 `C:\Users\Gower\.codex\models_cache.json`（只讀；`client_version` 0.159.2；該檔於本單執行期間被其他 Codex 行程刷新，`fetched_at` 變為 `2026-10-04T08:10:18Z`，6 筆內容不變）：

  | slug | displayName | efforts | default |
  |------|-------------|---------|---------|
  | `gpt-6-luna` | GPT-6-Luna | low,medium,high,xhigh,max | medium |
  | `gpt-5.6-terra` | GPT-5.6-Terra | low,medium,high,xhigh,max,ultra | medium |
  | `gpt-5.6-luna` | GPT-5.6-Luna | low,medium,high,xhigh,max | medium |
  | `gpt-5.5` | GPT-5.5 | low,medium,high,xhigh | medium |

  `count = 4`（`gpt-reserve`、`codex-auto-review` 因 `visibility: "hide"` 被濾除）
- [x] **AC-4 PASS** — `codex-error-classify.test.ts` 以 T0369 AC-4 原文為 fixture：`Reconnecting... 2/5 (unexpected status 401 Unauthorized: ... wss://...)`、`Falling back from WebSockets to HTTPS transport...`、T0367 `Codex is ignoring ...` → `true`；`turn.failed` 的 `unexpected status 401 Unauthorized: ... https://...`、T0367 `config-incompatible`（`Error loading config.toml ... service_tier`）與 `cli-too-old`（`The 'gpt-5.6-terra' model requires a newer version of Codex...`）原文 → `false`；另含大小寫、空白變體、片段不誤判、空字串
- [x] **AC-5 PASS** — 內建 `CODEX_MODELS` 已無 `gpt-5.4`、`o3`（`gpt-5.4-mini` 為不同模型，保留）
- [x] **AC-6 PASS** — `git status`：本單改動僅上列檔案，全在 `affects_files` 內。`AGENTS.md` 為開工前既有髒檔，未觸碰、未納入 commit

### 遭遇問題

1. **無阻擋問題**。
2. 開工時 git status 顯示 `_ct-workorders/T0368-*.md` 為髒檔，執行中該檔已不在 modified 清單（推測由其他 session commit），本單未觸碰。
3. **後續建議（範圍外，未修改）**：
   - Codex 面板模型清單是 lazy 載入（開啟模型選單或有 `sdkSessionId` 後才抓），effort 過濾在此之前不生效、顯示完整清單；若要開面板即過濾，可在 Codex session mount 時預抓 `getSupportedModels()`
   - 選了模型不支援的 effort（例：`gpt-5.5` + `max`）時目前保留原值、不自動改，由 Codex 端回錯；是否自動降到 `defaultEffort` 可由塔台評估
   - cache 由使用者實際執行的 Codex CLI 寫入，可能列出 BAT 內嵌 0.160 尚不支援的新模型；此時錯誤會走 T0367 `cli-too-old` 提示，與 T-C（選最新 binary）互補

### Commit

單一 commit（訊息含 T0370，`git commit --only` 指定 9 檔）；不 push。

### 回報時間

2026-10-04T16:13:29+08:00
