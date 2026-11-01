---
schema_version: 1
schema_kind: bug
id: BUG-189
title: "Windows 上 PATH 第一個 codex 是 npm shim（`codex.cmd`）時版本探測回 `version-unknown`：手動 codex 分頁不加 `--no-daemon`、派工的 codex 不啟用 OSC 狀態"
status: FIXING
severity: low
reproducibility: always
created_at: "2026-11-02T02:23:44+0800"
updated_at: "2026-11-02T02:23:44+0800"
impact:
  - codex-launch
  - bat-mcp
links:
  discovered_in: "T0742 回報區〈發現的問題〉2 / 3（2026-11-01，第一百零三 session）"
  related: [T0758, BUG-159, T0651, T0621, T0742]
---
# BUG-189 — Windows 上 PATH 第一個 codex 是 npm shim（`codex.cmd`）時版本探測回 `version-unknown`：手動 codex 分頁不加 `--no-daemon`、派工的 codex 不啟用 OSC 狀態

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（npm 全域安裝 codex 的使用者，BUG-159 的修正不生效、Worker 啟動確認回 `unknown`） |
| 可重現 | 必現（PATH 上 `codex.cmd` 排在 `codex.exe` 之前，或只有 npm 安裝） |
| **狀態** | 🔧 FIXING（T0758） |
| 回報者 | T0742 Worker |

## 現象

- 版本探測在 Windows 只認 PATH 上第一個 codex 為 `codex.exe`；第一個是 npm shim（`codex.cmd` / `.ps1`）→ `[codex-version] path=- version=unknown (first codex on PATH is …\codex.cmd (needs a shell))`（`electron/codex-osc-version.ts` `resolveDispatchCodexBinary`）。
- 結果：BAT MCP 關閉的手動 codex 分頁 `no-daemon=no (version-unknown)`（BUG-159 修正不生效）；helper 派工的 codex 走同一個解析 → `blockedDetection: none`、`--wait-started` 回 `unknown`。
- 以 `npm i -g @openai/codex` 安裝 codex 的使用者都會遇到；從 `npx` 啟動的 BAT（`node_modules\.bin` 在 PATH 最前面）也會。
- 附帶：`e2e/t0584-bat-mcp-shim.spec.ts` 第 275 行斷言 Settings 關閉時 codex 參數為 `''`，現在會過只因 npx 把 `codex.cmd` 放在前面；PATH 改變就會紅。
