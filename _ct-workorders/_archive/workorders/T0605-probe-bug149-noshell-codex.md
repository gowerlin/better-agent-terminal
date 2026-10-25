---
schema_version: 1
schema_kind: workorder
id: T0605
title: "探針：BUG-149 安裝版缺 `shell` 鍵時 Codex CLI Worker 能否啟動"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: XS
created_at: "2026-10-18T04:26:44+0800"
started_at: "2026-10-18T04:29:00+0800"
updated_at: "2026-10-18T04:31:00+0800"
completed_at: "2026-10-18T04:31:00+0800"
depends_on: [T0593]
related:
  - "BUG-149（FIXED，等安裝版實機）；T0604 / T0605 同批（claude / codex）"
affects_files:
  - _ct-workorders/T0605-probe-bug149-noshell-codex.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 探針單：不讀產品程式碼、不改任何其他檔案；只做下方步驟，只 commit 本檔（`git commit --only <本檔>`）。不 push。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 日誌與輸出不得含權杖；只貼 `[agent-command]` / `shell-resolution` / `[bat-mcp]` 相關行。不得修改 `settings.json`（塔台在派工前已暫時移除 `shell` 鍵，派工後由塔台還原）。"
---

# T0605 — 探針：BUG-149 缺 `shell` 鍵時 Codex CLI Worker 能否啟動

塔台派工前已暫時移除 `%APPDATA%\BetterAgentTerminal\settings.json` 的 `shell` 鍵（模擬全新安裝）。你能讀到本工單，就代表 Worker 已啟動（BUG-149 修正前，缺鍵時 codex 以 `invalid type: string "[", expected a sequence in mcp_servers.bat.args` 結束）。

## 步驟

1. 照 ct-exec 流程標 IN_PROGRESS。
2. 呼叫 BAT MCP tool `bat_whoami`，回報 `role` / `agent` / `workorder`（確認 codex 分頁的 BAT MCP 參數引號正確、shim 已連上）。
3. 在 `%APPDATA%\BetterAgentTerminal\Logs\` 最新的 `debug-*.log` 找**本分頁**（`BAT_TERMINAL_ID`）的派工行並原文貼上：
   - `[agent-command] id=<本分頁> shell family=… from=…`（預期 `family=pwsh from=pty-default:pwsh.exe`）
   - 同一次派工的 `shell-resolution` 行
   - 本分頁的 `[bat-mcp]` 行（若有）
4. 回報本分頁實際的 shell（例：`$PSVersionTable.PSVersion` 有值 → pwsh）。
5. 回報區寫上述結果與 PASS / FAIL → DONE → commit 本檔 → 通知塔台。

---

## 回報區

### 完成狀態

DONE — PASS。缺少持久化 `shell` 設定時，Codex CLI Worker 成功啟動並呼叫 BAT MCP `bat_whoami`，BUG-149 安裝版啟動探針通過。

### 產出摘要

- BAT MCP `bat_whoami`：`role=worker`、`agent=codex-cli`、`workorder=T0605`、`yolo=true`；terminal=`7ff9a74d30efe66808ef08d2b61c1105`，workspace=`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`。
- 本分頁啟動記錄（2026-10-17T20:27:22Z）：
  - `[agent-command] id=7ff9a74d30efe66808ef08d2b61c1105 shell family=pwsh from=pty-default:pwsh.exe`
  - `shell-resolution channel=terminal:create-with-command id=7ff9a74d30efe66808ef08d2b61c1105 basename=pty-default persistedShell=unset source=pty-default fallback=yes reason=missing-persisted-shell spawn=pwsh.exe`
  - `[bat-mcp] dispatch agent=codex-cli terminal=7ff9a74d30efe66808ef08d2b61c1105 → injected: -c 'mcp_servers.bat.command=''node''' -c 'mcp_servers.bat.args=[''C:\Program Files\BetterAgentTerminal\resources\scripts\bat-mcp.mjs'']' -c 'mcp_servers.bat.env_vars=[''BAT_REMOTE_PORT'', ''BAT_REMOTE_TOKEN'', ''BAT_TERMINAL_ID'', ''BAT_USER_DATA'', ''BAT_SERVER_CERT_PATH'', ''BAT_HELPER_LOG_DIR'', ''BAT_RUNTIME'', ''APPDATA'', ''XDG_CONFIG_HOME'']' -c mcp_servers.bat.tool_timeout_sec=60`
- 本分頁 shell：PowerShell，`$PSVersionTable.PSVersion`=`7.6.7`。
- 驗證：MCP 啟動與身分回報 PASS；shell 缺鍵 fallback PASS；MCP 派工參數引號與 shim 連線 PASS。
- Landing zone：PASS。C-0 `repo=better-agent-terminal` 與實際 repo basename=`better-agent-terminal` 相符，REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`；C-1 工單位於 repo 內；C-2 `main` 與 workdir `main` 相符；C-3 不適用（affects_files 僅列工單）。未設定 `CT_HOME`；BAT_WORKSPACE_ID=`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`。
- 僅修改本工單。既有 `src/styles/settings.css` dirty 狀態為使用者變更，保留且未納入提交。
- 提交：依工單僅提交本檔，commit message 含 T0605；不 push。無偏差、無阻塞、無後續項目。

### 回報時間

2026-10-18 04:30 +08:00