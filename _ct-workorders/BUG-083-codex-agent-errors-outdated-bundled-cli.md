---
schema_version: 1
schema_kind: bug
id: BUG-083
title: Codex agent 出錯，測試者指稱需更新 codex 版本（內嵌 SDK/CLI 0.124.0，上游已 0.160.0）
status: OPEN
severity: medium
reproducibility: unknown
created_at: "2026-10-04T13:29:07+08:00"
updated_at: "2026-10-04T13:29:07+08:00"
impact:
  - codex-agent
links:
  research_workorder: T0366
---

# BUG-083 — Codex agent 出錯，測試者指稱需更新 codex 版本

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（暫定；Codex agent 為次要 agent，但出錯即整個面板不可用。T0366 結論後重評） |
| 可重現 | 未知（回報無錯誤訊息、無版本、無平台） |
| 狀態 | 📂 OPEN |
| 回報者 | 外部測試者（2026-10-02 00:49，經使用者轉述） |

## 現象（原始回報，轉述）

> 「BAT 的 codex 版本要更新才不會出錯，他們（OpenAI）改版太快」

- **缺**：錯誤訊息原文、BAT 版本、平台、使用的是 Codex agent 面板還是 terminal 內的 codex CLI、測試者機器上是否另裝 codex CLI 及其版本

## 塔台初步事實（2026-10-04，未深入分析）

- `package.json:46` `@openai/codex-sdk: ^0.124.0`；`node_modules` 實裝 `@openai/codex-sdk` / `@openai/codex` 皆 **0.124.0**（2026-04-25 引入後未升級）
- `npm view @openai/codex version` = **0.160.0**（2026-10-04）
- `electron/codex-agent-manager.ts:155-167` `findCodexBinary()` 優先序：`BAT_CODEX_BIN` → **PATH 上的 codex** → 內嵌 binary。⇒ SDK JS（0.124）可能驅動使用者自裝的**較新** CLI，存在雙向版本錯配的可能
- 本專案已有 claude 的 runtime selection 先例（PLAN-027，`electron/claude-runtime-router.ts`），codex 沒有對應機制

## 後續

T0366（research）調查根因並提修復選項；塔台依結論開實作工單。
