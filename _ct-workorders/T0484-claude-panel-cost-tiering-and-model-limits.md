---
schema_version: 1
schema_kind: workorder
id: T0484
title: "Claude 面板成本與模型顯示：Haiku 5.5 長 prompt 分段計價接線（逐 turn 計價後加總）+ setModel() 5 系列 contextWindow / maxOutputTokens 推估更正"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P2
sizing: S
created_at: "2026-10-13T23:13:05+08:00"
started_at: null
updated_at: "2026-10-13T23:13:05+08:00"
completed_at: null
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

- [ ] A / B 單元測試；其他模型成本數值不變的測試
- [ ] `npm run test:unit`（回報數字，標註他人 WIP 影響）；`npx vite build` exit 0
- [ ] 回報區附官方數值出處；CLAUDE.md 建議文字（計價段 / `BAT_BUILTIN_MODELS` 段）

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
