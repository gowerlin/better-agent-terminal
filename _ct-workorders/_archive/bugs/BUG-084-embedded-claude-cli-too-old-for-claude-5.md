---
schema_version: 1
schema_kind: bug
id: BUG-084
title: 內嵌 Claude CLI 2.1.113 被服務端拒絕 Claude 5 主力模型（claude_code_version_too_old）
status: CLOSED
severity: high
fix_commit: 0d231b3
fixed_at: "2026-10-04T16:24:08+08:00"
reproducibility: always
created_at: "2026-10-04T16:09:22+08:00"
updated_at: "2026-10-04T21:04:52+08:00"
closed_at: "2026-10-04T21:04:52+08:00"
impact:
  - claude-agent
  - claude-cli-terminal
links:
  research_workorder: T0368
  fix_workorders:
    - T0371
    - T0372
---

# BUG-084 — 內嵌 Claude CLI 2.1.113 被服務端拒絕 Claude 5 主力模型

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（預設 runtime = embedded；選 Opus 5.5 / Fable 5.1 必 400） |
| 可重現 | 100%（T0368 實測，request id 見下） |
| 狀態 | 🚫 CLOSED（2026-10-04 21:04 實機驗收通過；Phase 2 SDK 0.3 另案，D123） |
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
| 1 | T0371 ✅ `0d231b3` | CLI → 2.1.289 + Claude 5 模型清單 + `getSupportedModels()` 帶 runtime 路徑 + `release.yml` Node 24（embedded + `claude-opus-5-5` smoke = `pong`） |
| 2 | T0372 ✅ `79c349e` | `claude_code_version_too_old` 錯誤分類 + `HEALTHY_MIN` → 2.1.280 + embedded 注入 `DISABLE_UPDATES=1` + 模型下拉去重 + CLAUDE.md |
| 3 | T0374 ✅ `5b8975f` | 計價表（5 系列、cache-read 倍率、Claude/Codex 共用模組）+ Settings `max (Opus only)` 標示 |
| 4 | 待開（Phase 2） | SDK 0.3.289 + **`claude-code-v2` preset 下架**（D123，含既有設定遷移至 `claude-code`）+ Task tools UI |

## 實機驗收（2026-10-04 21:04 UTC+8）— CLOSED

- **受測版本**：已安裝 BAT 本機 build `0.5.9-pre.4`（含 `71706c2`）；`C:\Program Files\BetterAgentTerminal\resources\app.asar` 與 `release\win-unpacked\resources\app.asar` SHA-256 一致（`518EE6CB…`，塔台雜湊比對，L127）
- **環境**：Windows 11、UAC 停用（`EnableLUA=0`）
- **結果**：使用者回報「驗收通過」（Claude 面板 Claude 5 模型可對話）
- **結論**：runtime lane 通過 → CLOSED。`claude-agent-sdk` 0.3.x 與 `claude-code-v2` 下架屬 Phase 2（D123），不阻擋本單結案
