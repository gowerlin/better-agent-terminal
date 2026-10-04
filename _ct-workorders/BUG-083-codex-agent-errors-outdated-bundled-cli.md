---
schema_version: 1
schema_kind: bug
id: BUG-083
title: Codex agent 出錯，測試者指稱需更新 codex 版本（內嵌 SDK/CLI 0.124.0，上游已 0.160.0）
status: FIXING
severity: medium
reproducibility: conditional
created_at: "2026-10-04T13:29:07+08:00"
updated_at: "2026-10-04T15:52:52+08:00"
impact:
  - codex-agent
links:
  research_workorder: T0366
---

# BUG-083 — Codex agent 出錯，測試者指稱需更新 codex 版本

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（暫定；Codex agent 為次要 agent，但出錯即整個面板不可用。T0366 結論後重評） |
| 可重現 | 條件式 100%（T0366）：H3 另裝新版 Codex 但 BAT 用內嵌 0.124；H1 選用新模型 |
| 狀態 | 📂 OPEN → ⏳ FIXING（2026-10-04，D121） |
| 回報者 | 外部測試者（2026-10-02 00:49，經使用者轉述） |

## 現象（原始回報，轉述）

> 「BAT 的 codex 版本要更新才不會出錯，他們（OpenAI）改版太快」

- **缺**：錯誤訊息原文、BAT 版本、平台、使用的是 Codex agent 面板還是 terminal 內的 codex CLI、測試者機器上是否另裝 codex CLI 及其版本

## 塔台初步事實（2026-10-04，未深入分析）

- `package.json:46` `@openai/codex-sdk: ^0.124.0`；`node_modules` 實裝 `@openai/codex-sdk` / `@openai/codex` 皆 **0.124.0**（2026-04-25 引入後未升級）
- `npm view @openai/codex version` = **0.160.0**（2026-10-04）
- `electron/codex-agent-manager.ts:155-167` `findCodexBinary()` 優先序：`BAT_CODEX_BIN` → **PATH 上的 codex** → 內嵌 binary。⇒ SDK JS（0.124）可能驅動使用者自裝的**較新** CLI，存在雙向版本錯配的可能
- 本專案已有 claude 的 runtime selection 先例（PLAN-027，`electron/claude-runtime-router.ts`），codex 沒有對應機制

## 根因（T0366 研究結論，`aa970dc`）

| 假設 | 結論 | 摘要 |
|------|------|------|
| H1 內嵌 CLI 過舊 | ✅ 證實 | 0.124 + `gpt-5.6-terra` → `requires a newer version of Codex. Please upgrade…`（與測試者原話吻合） |
| H2 SDK/CLI 錯配 | ⚠️ 部分 | argv/事件相容；但 0.160 的 `Codex is ignoring …` 以 `item.type=error` 送出 → BAT 誤報紅色 Error 並熄滅 streaming |
| H3 共用 config.toml | ✅ 證實（致命） | 新版 Codex 寫入 `service_tier = "default"` → 0.124 `Error loading config.toml` exit 1。Windows `npm i -g` 只產生 shim，BAT 略過 → 退回內嵌 |
| H4 auth 等 | ❌ 排除 | |

## 修復計畫（D121，串行）

| 順序 | 工單 | 內容 | 狀態 |
|------|------|------|------|
| 1 | T0367 | T-A 錯誤分類 + config 警告誤報修正 | ✅ DONE `c6214c2`（561 tests） |
| 2 | T0369 | T-B bump SDK 0.160 + 內嵌解析相容新目錄 + 體積量測 | 派發中 |
| 3 | （待開） | T-D 模型清單（清下架、讀 `models_cache.json`、effort `max`） | — |
| 4 | （待開） | T-C 選最新 binary + 版本 toast | — |
| — | 後排 | T-E Settings codex runtime 選擇（S3） | 未排 |
