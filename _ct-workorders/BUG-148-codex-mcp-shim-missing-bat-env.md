---
schema_version: 1
schema_kind: bug
id: BUG-148
title: "Codex CLI 分頁的 BAT MCP 一律 CONNECT_FAILED：codex 啟動 stdio MCP server 時沒有傳 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`"
status: FIXING
severity: medium
reproducibility: always
created_at: "2026-10-17T23:50:21+0800"
fixed_by: T0586
impact:
  - bat-mcp
  - codex-cli
links:
  discovered_in: "第七十四 session `v0.7.0-pre.2` 實機驗收（待辦 1：codex 分頁 MCP 實際連線）"
  related: [T0584, PLAN-047]
---

# BUG-148 — codex 分頁的 BAT MCP 讀不到分頁 env

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（codex 分頁的 `mcp__bat__*` 全部不可用；claude 分頁正常） |
| 可重現 | 必現（本機 BAT `0.7.0-pre.2`、OpenAI Codex `v0.163.0`、Windows） |
| **狀態** | 🔧 FIXING（T0586） |

## 現象

BAT `0.7.0-pre.2` 新開「Codex CLI」分頁（`codex-cli` preset，YOLO mode），請 codex 呼叫 `bat_whoami` / `bat_list_terminals`：

- **預期**：回傳該分頁的 whoami（`role: shell`、`agent: codex-cli`）與只有自己一筆的 list。
- **實際**：兩個 tool 都回

  ```
  {"content":[{"type":"text","text":"CONNECT_FAILED: not running inside a BAT terminal (BAT_REMOTE_PORT / BAT_REMOTE_TOKEN not set)"}],
   "structuredContent":{"code":"CONNECT_FAILED","message":"not running inside a BAT terminal (BAT_REMOTE_PORT / BAT_REMOTE_TOKEN not set)"},"isError":true}
  ```

注入本身成功：BAT 日誌（`debug-20261017-233800.log`）有 `[bat-mcp] tab agent=codex-cli → injected: -c 'mcp_servers.bat.command='\''node'\''' -c 'mcp_servers.bat.args=[…\resources\scripts\bat-mcp.mjs]' -c mcp_servers.bat.tool_timeout_sec=60`，codex 也確實啟動了 shim（訊息來自 `bat-mcp.mjs`）。同一台機器的 Claude CLI 塔台分頁 `bat_whoami` / `bat_list_terminals` 正常（claude 把完整 env 交給 stdio MCP server）。

## 推測原因（待 T0586 確認）

codex 啟動 stdio MCP server 時只傳預設白名單的環境變數，分頁的 `BAT_*` 沒有傳下去。T0584 對 codex 只驗了 `codex mcp get bat --json` 的設定解析（codex-cli 0.162.1），沒有實際連線，因此沒發現。
