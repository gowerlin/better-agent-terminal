---
schema_version: 1
schema_kind: workorder
id: T0370
title: "BUG-083 T-D：Codex 模型清單改讀 models_cache.json + effort 擴充 + 連線重試訊息不再誤報為錯誤"
type: fix
status: PENDING
priority: P2
sizing: S
created_at: "2026-10-04T16:06:46+08:00"
updated_at: "2026-10-04T16:06:46+08:00"
started_at: null
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

- **狀態**：PENDING
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

### 產出摘要

### 驗收條件逐項

### 遭遇問題

### 回報時間
