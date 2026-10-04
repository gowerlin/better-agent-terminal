---
schema_version: 1
schema_kind: bug
id: BUG-083
title: Codex agent 出錯，測試者指稱需更新 codex 版本（內嵌 SDK/CLI 0.124.0，上游已 0.160.0）
status: CLOSED
severity: medium
fix_commits: [c6214c2, ca0d292, 30fcf45, 3d52a1d]
fixed_at: "2026-10-04T16:46:35+08:00"
reproducibility: conditional
created_at: "2026-10-04T13:29:07+08:00"
updated_at: "2026-10-04T20:24:43+08:00"
closed_at: "2026-10-04T20:24:43+08:00"
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
| **狀態** | 🚫 CLOSED（2026-10-04 20:24 實機驗收通過） |
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
| 2 | T0369 | T-B bump SDK 0.160 + 內嵌解析相容新目錄 + 體積量測 | ✅ DONE `ca0d292`（573 tests；win32-x64 213→430 MB） |
| 3 | T0370 | T-D 模型清單（讀 `models_cache.json`、清下架、effort `max`/`ultra`）+ 連線重試誤報改 notice | ✅ DONE `30fcf45`（593 tests） |
| 4 | T0373 | T-C 選最新 binary + 版本 notice + effort 依模型校正 | ✅ DONE `3d52a1d`（635 tests；本機選 embedded 0.160.0） |
| — | 後排 | T-E Settings codex runtime 選擇（S3） | 未排 |

## 待實機驗收（下次發版後）

- 開 Codex 分頁：首行 notice 應為 `Codex CLI 0.160.0 (embedded)`（或更新的 installer / desktop-app 版本）
- 正常對話不再出現 `Codex is ignoring …` / `Reconnecting …` 紅色 Error
- 模型下拉含 `gpt-6-luna` / `gpt-5.6-terra` 等 cache 模型；換到 `gpt-5.5` 時 effort `max` 自動改為 `medium`

## 實機驗收（2026-10-04 20:24 UTC+8）— CLOSED

- **受測版本**：已安裝 BAT `1.26.1004195815`（使用者本機 build，程式碼等同 `v0.5.9-pre.4`）；`app.asar.unpacked` 內 `@openai/codex-sdk` = 0.160.0（塔台讀套件 `package.json`，非字串 grep，L127）
- **環境**：Windows、UAC 停用（`EnableLUA=0`）—— 即 BUG-085 的提權環境；Codex Agent 面板**未**被 daemon 提權檢查擋下
- **使用者截圖證據**（Codex Agent 面板，20:22-20:23）：
  | 驗收項 | 結果 |
  |---|---|
  | 首行 `Codex CLI 0.160.0 (embedded)` | ✅ PASS |
  | `Codex is ignoring …` 不再是紅色 Error | ✅ PASS（以黃色 ⚠️ notice 呈現；內容為使用者 `config.toml` 的 `env` 鍵已不被 0.160 認得） |
  | 無 `Reconnecting …` 誤報 | ✅ PASS |
  | 對話可完成 | ✅ PASS（`hi` → `Hi! I'm here and ready.`） |
  | 模型下拉 cache 模型 / `gpt-5.5` effort 自動校正 | ⚪ 未實機觀察，僅 unit test 覆蓋（T0370 / T0373） |
- **結論**：核心症狀（版本過舊出錯、錯誤誤報）runtime lane 通過 → CLOSED。下拉清單項目若日後出問題另開 BUG。

