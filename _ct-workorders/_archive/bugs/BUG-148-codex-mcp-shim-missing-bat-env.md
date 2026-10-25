---
schema_version: 1
schema_kind: bug
id: BUG-148
title: "Codex CLI 分頁的 BAT MCP 一律 CONNECT_FAILED：codex 啟動 stdio MCP server 時沒有傳 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`"
status: CLOSED
severity: medium
reproducibility: always
created_at: "2026-10-17T23:50:21+0800"
fixed_at: "2026-10-18T00:00:58+0800"
closed_at: "2026-10-18T00:28:44+0800"
fixed_by: T0586
fix_commit: "8c7bd4c4"
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
| **狀態** | 🚫 CLOSED（T0586 `8c7bd4c4`；2026-10-18 使用者 `0.7.0-pre.3` 實機驗收通過：Codex CLI 分頁 `bat_whoami` 回 `role: shell`、`agent: codex-cli`） |

## 現象

BAT `0.7.0-pre.2` 新開「Codex CLI」分頁（終端縮圖列右側 **「+」選單 → Codex CLI**，即 `WorkspaceView` 新建 Agent 終端路徑；`codex-cli` preset，YOLO mode），請 codex 呼叫 `bat_whoami` / `bat_list_terminals`：

- **預期**：回傳該分頁的 whoami（`role: shell`、`agent: codex-cli`）與只有自己一筆的 list。
- **實際**：兩個 tool 都回

  ```
  {"content":[{"type":"text","text":"CONNECT_FAILED: not running inside a BAT terminal (BAT_REMOTE_PORT / BAT_REMOTE_TOKEN not set)"}],
   "structuredContent":{"code":"CONNECT_FAILED","message":"not running inside a BAT terminal (BAT_REMOTE_PORT / BAT_REMOTE_TOKEN not set)"},"isError":true}
  ```

注入本身成功：BAT 日誌（`debug-20261017-233800.log`）有 `[bat-mcp] tab agent=codex-cli → injected: -c 'mcp_servers.bat.command='\''node'\''' -c 'mcp_servers.bat.args=[…\resources\scripts\bat-mcp.mjs]' -c mcp_servers.bat.tool_timeout_sec=60`，codex 也確實啟動了 shim（訊息來自 `bat-mcp.mjs`）。同一台機器的 Claude CLI 塔台分頁 `bat_whoami` / `bat_list_terminals` 正常（claude 把完整 env 交給 stdio MCP server）。

## 推測原因（待 T0586 確認）

codex 啟動 stdio MCP server 時只傳預設白名單的環境變數，分頁的 `BAT_*` 沒有傳下去。T0584 對 codex 只驗了 `codex mcp get bat --json` 的設定解析（codex-cli 0.162.1），沒有實際連線，因此沒發現。

## 修正（T0586，`8c7bd4c4`）

原因已確認：codex `0.163.0` 對 stdio MCP server 只傳 Windows 預設白名單的 21 個環境變數（`PATH` / `APPDATA` / `USERPROFILE` …），不含任何 `BAT_*`。codex 的 app-server 加假 MCP server 實測可重現，錯誤訊息與實機逐字相同。修正為 codex 注入多帶 `-c mcp_servers.bat.env_vars=[…]`，只列 9 個變數**名稱**，權杖值不出現在命令列。單元與整合測試、e2e 都通過；塔台複驗 unit 4997 passed / 285 files，typecheck 0 / 0。實機（Codex CLI 分頁 `bat_whoami`）隨 `0.7.0-pre.3` 驗收。

## 結案紀錄（2026-10-18 00:28，第七十五 session）

使用者安裝 `0.7.0-pre.3` 後，以「+」選單新開 Codex CLI 分頁（OpenAI Codex `v0.163.0`，YOLO mode）請 agent 呼叫 `bat_whoami`（不帶參數）：`Called bat.bat_whoami` 成功，`structuredContent` = `terminalId a106526c-…`、`workspaceId cc0afc4a-…`（與塔台同一工作區）、`role: "shell"`、`yolo: false`、`agent: "codex-cli"`、`cwd` 為本 repo，無 `isError`。驗收通過 → CLOSED。
