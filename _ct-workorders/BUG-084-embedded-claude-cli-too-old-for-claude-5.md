---
schema_version: 1
schema_kind: bug
id: BUG-084
title: 內嵌 Claude CLI 2.1.113 被服務端拒絕 Claude 5 主力模型（claude_code_version_too_old）
status: FIXING
severity: high
reproducibility: always
created_at: "2026-10-04T16:09:22+08:00"
updated_at: "2026-10-04T16:09:22+08:00"
impact:
  - claude-agent
  - claude-cli-terminal
links:
  research_workorder: T0368
  fix_workorders:
    - T0371
---

# BUG-084 — 內嵌 Claude CLI 2.1.113 被服務端拒絕 Claude 5 主力模型

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（預設 runtime = embedded；選 Opus 5.5 / Fable 5.1 必 400） |
| 可重現 | 100%（T0368 實測，request id 見下） |
| 狀態 | ⏳ FIXING（D122，T0371） |
| 發現者 | 塔台 / T0368 研究（2026-10-04，由使用者詢問「SDK 是否最新」觸發） |
| Workaround | Settings → Advanced → Claude Runtime 切 **system**（需系統另裝 claude ≥ 2.1.280） |

## 現象

內嵌 `@anthropic-ai/claude-code` 2.1.113（經 SDK 0.2.113，與 BAT 同路徑）：

| model | 結果 |
|-------|------|
| `claude-opus-5-5` | ❌ `API Error: 400 ... "Claude Code 2.1.113 does not support this model; version 2.1.280 or newer is required." "error_code":"claude_code_version_too_old"`（`req_011CfgrA72sUuecgiqB9xRCj`） |
| `claude-fable-5-1` | ❌ 同上，`version 2.1.251 or newer is required`（`req_011CfgrAfh9bUb1c67swXH3u`） |
| `claude-sonnet-5-5` | ✅（尚未設門檻，隨時可能設） |
| `claude-opus-4-7` | ✅ |

另：`BAT_BUILTIN_MODELS` 最新只到 `claude-opus-4-7`；2.1.113 的 `supportedModels()` 也看不到 Claude 5。

## 根因

服務端以 CLI 版本逐模型設門檻（與 BUG-083 Codex 完全同型）；BAT 內嵌 CLI 自 2026-04-18（T0165，`84c2930`）未升級。

## 修復計畫（D122）

| 順序 | 工單 | 內容 |
|------|------|------|
| 1 | T0371 | CLI → 2.1.289 + Claude 5 模型清單 + `getSupportedModels()` 帶 runtime 路徑 + `release.yml` Node 24 |
| 2 | 待開 | `claude_code_version_too_old` 錯誤分類 + `HEALTHY_MIN` → 2.1.280 + embedded 注入 `DISABLE_UPDATES=1` |
| 3 | 待開 | 計價表（5 系列、cache-read 倍率、Claude/Codex 共用模組）—— 需等 BUG-083 T0370 收尾 |
| 4 | 待開（Phase 2） | SDK 0.3.289 + **`claude-code-v2` preset 下架**（D123，含既有設定遷移至 `claude-code`）+ Task tools UI |
