---
schema_version: 1
schema_kind: bug
id: BUG-189
title: "Windows 上 PATH 第一個 codex 是 npm shim（`codex.cmd`）時版本探測回 `version-unknown`：手動 codex 分頁不加 `--no-daemon`、派工的 codex 不啟用 OSC 狀態"
status: CLOSED
severity: low
reproducibility: always
created_at: "2026-11-02T02:23:44+0800"
updated_at: "2026-11-02T05:26:29+0800"
fixed_at: "2026-11-02T02:42:32+0800"
closed_at: "2026-11-02T05:26:29+0800"
fix_commit: ddfb4f38
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
| **狀態** | 🚫 CLOSED（T0758 `ddfb4f38`；交付版 `v0.7.3-pre.4` 安裝版自動化實測 T0772 PASS，真的 npm codex） |
| 回報者 | T0742 Worker |

## 現象

- 版本探測在 Windows 只認 PATH 上第一個 codex 為 `codex.exe`；第一個是 npm shim（`codex.cmd` / `.ps1`）→ `[codex-version] path=- version=unknown (first codex on PATH is …\codex.cmd (needs a shell))`（`electron/codex-osc-version.ts` `resolveDispatchCodexBinary`）。
- 結果：BAT MCP 關閉的手動 codex 分頁 `no-daemon=no (version-unknown)`（BUG-159 修正不生效）；helper 派工的 codex 走同一個解析 → `blockedDetection: none`、`--wait-started` 回 `unknown`。
- 以 `npm i -g @openai/codex` 安裝 codex 的使用者都會遇到；從 `npx` 啟動的 BAT（`node_modules\.bin` 在 PATH 最前面）也會。
- 附帶：`e2e/t0584-bat-mcp-shim.spec.ts` 第 275 行斷言 Settings 關閉時 codex 參數為 `''`，現在會過只因 npx 把 `codex.cmd` 放在前面；PATH 改變就會紅。

## 修正（T0758 `ddfb4f38`，2026-11-02T02:42:32+0800）

- Windows 上 PATH 第一個 codex 是 npm shim（`codex.cmd` / `.ps1` / `.bat`）時，讀 shim（不執行）追到 `@openai/codex/bin/codex.js`，再照 codex.js 的找法找到平台套件的原生 `codex.exe`，以 `execFile`（不經 shell、5 s）探測版本；手動分頁 `--no-daemon` 與派工 OSC 共用同一個 reader（`resolveNpmCodexShim`，`electron/codex-osc-version.ts`）。追不到維持 `version-unknown`；macOS / Linux 不變。
- 驗證：單元 14 項＋突變；t0742 新增 npm shim 情境（突變重現 BUG-189 原樣）；t0584 斷言改由同一探測計算（兩種 PATH 皆綠）；typecheck 0 / 0、`test:unit` 6542 passed / 366 files、`vite build`（匯出目錄）。
- 待實機驗收：以 `npm i -g @openai/codex` 安裝 codex 的 Windows 環境，關 BAT MCP 開 Codex CLI 分頁 → 命令列有 `--no-daemon`。

## 驗收（2026-11-02T05:26:29+0800，第一百零四 session）

- 依據（R-G003）：交付版 `v0.7.3-pre.4` 安裝版（`BAT_E2E_EXECUTABLE`，隔離實例）自動化實測 T0772 情境 ①（`366b96b0` / 回報 `04d57a8f`，D215）。真的 npm 安裝 `@openai/codex@0.166.0`（暫存 prefix，不動使用者環境）在 PATH 最前面：
  - BAT MCP 關 → `[codex-version] … version=0.166.0 (probed) via=…codex.cmd`，`injected: --no-daemon`，執行中的 `codex.exe` 命令列含 `--no-daemon`。
  - BAT MCP 開 → 只注入 `mcp_servers.bat.*`、不加 `--no-daemon`。
  - helper 派 codex Worker → 派工探測同樣追到原生 `codex.exe`，`blockedDetection: osc`（修正前為 `none`）；codex 未登入停在登入選單，`--wait-started` 回 `unconfirmed` exit 8，符合 T0621 契約。
- `t0742-codex-no-daemon` 在安裝版 2 / 2 綠。
- 未涵蓋：登入狀態下的 npm codex Worker（`started: <ISO>`）。
