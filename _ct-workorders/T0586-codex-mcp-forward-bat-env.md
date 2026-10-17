---
schema_version: 1
schema_kind: workorder
id: T0586
title: "BUG-148：codex 分頁的 BAT MCP 讀不到分頁 env（CONNECT_FAILED）— 讓 codex 把 shim 需要的 `BAT_*` 傳給 stdio MCP server"
type: bugfix
status: PENDING
started_at: ""
updated_at: "2026-10-17T23:50:21+0800"
completed_at: ""
repo: better-agent-terminal
project: PLAN-047
priority: P1
sizing: S
created_at: "2026-10-17T23:50:21+0800"
target_version: "0.7.0-pre.3（候選）"
depends_on: [T0584]
related:
  - "BUG-148（現象、實機錯誤原文、注入日誌）"
  - "T0584 回報區與 CLAUDE.md「BAT MCP shim（PLAN-047 M1 / T0584）」：codex 注入參數、TOML 引號規則、三種 shell 的 quoting、`codex mcp get bat --json` 驗證方式"
  - "CLAUDE.md「Logging」的 helper userData 解析（T0481：`BAT_USER_DATA` / `BAT_SERVER_CERT_PATH` / `BAT_HELPER_LOG_DIR` / `BAT_RUNTIME`）"
affects_files:
  - electron/bat-mcp-launch.ts
  - "scripts/bat-mcp.mjs（只在需要改錯誤訊息 / 診斷時）"
  - "electron/__tests__/bat-mcp-launch.test.ts、scripts/__tests__/bat-mcp.test.mjs、e2e/t0584-bat-mcp-shim.spec.ts（必要時）"
  - "CLAUDE.md（只改「BAT MCP shim」小節的 codex 注入說明與已知限制）"
  - _ct-workorders/T0586-codex-mcp-forward-bat-env.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`；`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 權杖**值**絕不寫進任何設定檔、命令列、日誌。只允許以**變數名稱**轉送（例：codex 的 env 名稱白名單）；`mcp_servers.bat.env = { BAT_REMOTE_TOKEN = \"<值>\" }` 這類帶值寫法一律禁止。"
  - "🔴 不執行任何會送 prompt / 耗 token 的 claude / codex 指令（`codex exec`、互動式 codex 送訊息都不行）。可用 `codex mcp get` / `codex mcp list` 等不連模型的指令；需要隔離時用暫存 `CODEX_HOME`，不碰使用者的 `~/.codex`。e2e 用隔離實例（需先 `npx vite build`），不碰使用者的 BAT（9876）。"
---

# T0586 — codex 分頁的 BAT MCP 讀不到分頁 env（BUG-148）

## 背景

`v0.7.0-pre.2` 實機驗收：Claude CLI 分頁的 `mcp__bat__*` 正常；**Codex CLI 分頁（OpenAI Codex `v0.163.0`，Windows）兩個 tool 都回 `CONNECT_FAILED: not running inside a BAT terminal (BAT_REMOTE_PORT / BAT_REMOTE_TOKEN not set)`**。BAT 日誌顯示注入成功，codex 也啟動了 `bat-mcp.mjs`，只是 shim 的 process env 沒有分頁的 `BAT_*`。詳見 BUG-148。

塔台推測：codex 啟動 stdio MCP server 時只傳預設白名單的 env（claude 則傳完整 env）。T0584 對 codex 只驗了 `codex mcp get bat --json` 的解析。

## 任務

1. **確認原因**：查 codex（以本機實際安裝版 `v0.163.0` 為準，也看 T0584 用的 0.162.1 是否相同）對 stdio MCP server 的 env 規則：預設會傳哪些變數、有沒有「只列名稱」的轉送設定（例如 `mcp_servers.<name>.env_vars`，以 codex 實際支援的 key 為準）。用不耗 token 的方式佐證（`codex mcp get bat --json` 看解析結果、codex 原始碼或官方文件），在回報區寫明依據。
2. **修正注入**（`electron/bat-mcp-launch.ts` `buildBatMcpLaunchArgs` 的 codex 分支，本機與 headless 共用）：讓 codex 把 shim 需要的變數**以名稱**傳給 MCP server。變數清單從 `scripts/bat-mcp.mjs` 與它 import 的 `_bat-*.mjs` 實際讀取的 env 推得（至少 `BAT_REMOTE_PORT`、`BAT_REMOTE_TOKEN`；憑證路徑與日誌目錄相關的 `BAT_USER_DATA` / `BAT_SERVER_CERT_PATH` / `BAT_HELPER_LOG_DIR` / `BAT_RUNTIME`；以及 Windows 上 shim 解析 userData fallback 所需、但 codex 預設白名單沒有的系統變數，例如 `APPDATA`，以實測為準）。沿用 T0584 的 TOML 與 shell quoting 規則，pwsh / bash / cmd 三種 shell 都要正確。
3. **若 codex 沒有任何「只列名稱」的轉送方式**：不要改成帶值寫法；停下來回報 BLOCKED，列出可行選項與取捨（例：shim 以其他方式取得權杖的設計），由塔台決定。
4. **測試**：單元測試涵蓋新參數（三種 shell 的字串、不含任何權杖值）、關閉 / 自訂參數已含 `mcp_servers.bat` 時不注入的既有行為不變。盡量加一個不耗 token 的整合驗證，證明 codex 實際啟動 shim 時 env 有傳到（例：以隔離 `CODEX_HOME` + 能讓 codex 只啟動 MCP server 而不呼叫模型的方式；若 codex 沒有這種模式，寫明並以 `codex mcp get bat --json` 的解析結果 + 單元測試涵蓋，實機留給塔台隨下一版驗收）。
5. **CLAUDE.md**：更新「BAT MCP shim」小節的 codex 注入說明（新增的參數、原因），並把「codex 實際連線未驗」相關描述改成本單實測結果。

## 驗收

- `npm run test:unit` 全綠（基線 4992 passed / 284 files / 3 skipped，加上本單新增）
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npx vite build` 成功
- 回報區寫明：原因的依據、轉送的變數清單與理由、三種 shell 的實際注入字串（不含權杖值）、整合驗證做了什麼 / 沒做什麼
- 實機（塔台隨下一版做）：新開 Codex CLI 分頁 → `bat_whoami` 回 `role: shell`、`agent: codex-cli`

## 不在範圍

- claude 分頁的注入（正常，不動）
- M1b / M2 / M3、新的 tool
- Claude Agent SDK 面板

## 回報區

（Worker 填寫）
