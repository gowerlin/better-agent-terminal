---
schema_version: 1
schema_kind: workorder
id: T0498
title: "Claude 面板 Cache History：單次呼叫列改用 per-call tracker 資料（修 inputTokens 跨 turn 殘留語意）+ 查明 grandTotal 是否重複加總非 result 列與 R 列"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P2
sizing: S
created_at: "2026-10-13T23:27:10+08:00"
started_at: null
updated_at: "2026-10-13T23:27:10+08:00"
completed_at: null
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

- [ ] A 的結論與證據（含測試）；如有修正，修正前後數值對照
- [ ] B 單元測試；其他模型 / 既有顯示不回歸
- [ ] `npm run test:unit`、`npx vite build`、`npm run typecheck`、`npm run typecheck:electron`
- [ ] CLAUDE.md 建議文字（計價段）

## Sub-session 執行指示

1. 讀本工單 + D139 + T0484 回報區 + 相關檔案
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
