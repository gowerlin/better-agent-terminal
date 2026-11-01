---
schema_version: 1
schema_kind: bug
id: BUG-181
title: "Claude 面板 Cache History：CLI 回傳的 `modelUsage` / `total_cost_usd` 是 session 累計值，R 列當成單一回合、合計再把各列相加 → tokens 與費用逐列膨脹、合計重複計算"
status: OPEN
severity: medium
reproducibility: always
created_at: "2026-11-01T18:44:32+0800"
updated_at: "2026-11-01T18:44:32+0800"
impact:
  - claude-panel
  - cost-display
links:
  discovered_in: "T0739 回報區〈發現的問題〉F1（2026-11-01，真實模型小額驗收）"
  related: [T0739, T0727, T0717, T0718]
---

# BUG-181 — Cache History 把 session 累計用量當成單一回合

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（費用與 token 顯示錯誤、合計高估；不影響對話功能） |
| 可重現 | 一定（同一 session 連送 ≥ 2 則） |
| **狀態** | 📂 OPEN |
| 回報者 | T0739 Worker |

## 現象

- 預期：Cache History 的 R 列（一個回合）顯示該回合的 tokens 與費用；API 合計 = 各回合費用相加 = session 實際花費。
- 實際：內嵌 CLI 2.1.316 的 `result.modelUsage` 與 `result.total_cost_usd` 是 **session 累計值**（含 prompt suggestion 等額外請求，resume 後延續）。`src/lib/cache-history.ts` 註解寫「R row — the whole turn」，`cacheHistoryRowCosts` 以 R 列的 `modelUsage` 算該列 tokens 與費用；`src/components/ClaudeAgentPanel.tsx` 約 3874–3880 行再把每個 R 列的 `costUSD` 相加當 API 合計 → R 列一列比一列大，合計重複計算。
- 實測（T0739，Haiku 5.5 / 4.5，8 個回合）：實際累計 US$0.143，各列相加約 US$0.34。
- 證據：② 的 `modelUsage.cacheReadInputTokens` = 84,804 = ① 的 `usage.cache_read_input_tokens` 18,282 + ② 的 66,522；⑦（重開 BAT、resume 後）的 `modelUsage` 仍含 ⑥ 才用到的 `claude-haiku-4-5`。`result.usage`（不是 `modelUsage`）是單一 query 的值。

## 重現

1. Claude Agent 面板（真實模型）同一個 session 連送 3 則短訊息。
2. 開 Cache History：R 列 tokens / 費用逐列變大；合計大於狀態列 `totalCost`。
3. 自動化：`BAT_E2E_REAL_MODEL=1 npx playwright test e2e/v072-real-model-claude-panel.spec.ts`，看 log 的 `usage=` 與 `modelUsage=`。

## 備註

- 假 API e2e（T0727）不送 `modelUsage`，所以以往抓不到。更早的 CLI 版本是否也是累計值未查。
- 修正方向（待修正單評估）：R 列以「本回合累計 − 上一回合累計」（依 model 分開）或改用 `result.usage` 計；合計改用最後一個累計值；resume 後第一個回合的基準要處理（累計延續）。計價仍走 `src/lib/model-pricing.ts`。
