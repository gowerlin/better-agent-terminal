---
schema_version: 1
schema_kind: workorder
id: T0744
title: "修 BUG-181：Claude 面板 Cache History 以 session 累計的 `modelUsage` / `total_cost_usd` 換算成每回合值，合計不再重複計算"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T18:46:17+0800"
started_at: ""
updated_at: "2026-11-01T18:46:17+0800"
completed_at: ""
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

- [ ] 累計語意查證與 consumer 對照表
- [ ] 單元測試（含 T0739 實測數字）與 e2e 綠；〈相關通過案例判定〉
- [ ] `test:unit` 全過、兩個 typecheck = 0、`vite build` 成功
- [ ] build / e2e 在 T0742 結案後才執行（回報區記錄時間）

---

## 回報區

### 完成狀態

### 相關通過案例判定

### 遭遇問題

### 互動紀錄

### 回報時間
