---
schema_version: 1
schema_kind: bug
id: BUG-159
title: "codex 分頁在 BAT MCP 未注入、非系統管理員時接上 codex 共用 daemon，分頁內 helper 讀到其他分頁的 `BAT_*`（通知可能錯投）"
status: FIXING
severity: low
reproducibility: conditional（原始碼推論；本機 UAC 關閉無法重現）
created_at: "2026-10-18T18:37:00+0800"
impact:
  - codex-tab-env
  - helper-notify
links:
  discovered_in: "T0648（codex 共用 daemon 環境變數繼承探針，2026-10-18）"
  related: [T0647, T0648, T0651, T0377, BUG-085, T0584, D169]
---

# BUG-159 — codex 共用 daemon 繼承別的分頁的環境

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只在 BAT MCP 關閉 / 不可用、非系統管理員、手動 codex 分頁時發生；預設設定與 helper 派工不受影響） |
| 可重現 | 條件式；本機 `EnableLUA = 0`，codex 一律 `no_daemon`，無法重現（T0648 三次嘗試皆被 codex 擋下） |
| **狀態** | ⏳ FIXING（T0651） |

## 現象（T0648，codex `rust-v0.163.0` 原始碼）

- 共用 daemon 模式下，shell 工具命令、MCP server（含 `env_vars` 轉送值）、hook 都由 daemon spawn，環境取自 daemon 程序；daemon 由第一個自動啟動它的 codex 程序 spawn、完整繼承其環境，之後不更新。TUI 不把自己的 env 傳給 daemon。
- codex 0.163.0 只要命令列有非 `features.*` 的 `-c` 覆寫就排除 daemon（`tui/src/daemon_startup.rs` `config_exclusion`）。BAT MCP 注入 `-c mcp_servers.bat.*`、helper 派工加 `-c check_for_update_on_startup=false` → 這兩類分頁走 embedded，不受影響。
- 剩下的情境：非系統管理員 + 手動 codex 分頁 + BAT MCP 沒注入（Settings 關、RemoteServer 未 listen、shim 不在）+ 自訂參數沒有非 features 的 `-c`。此時分頁內 codex 執行的 `bat-notify.mjs` / `bat-terminal.mjs` 讀到 daemon 的 `BAT_TERMINAL_ID` / `BAT_REMOTE_TOKEN` / `BAT_TOWER_TERMINAL_ID` / `CT_MODE`（屬於啟動 daemon 的分頁 X）：Worker 通知**成功**送到 X 的塔台（範圍權杖驗的是一致性，這組值本來一致）、派工落到 X 的工作區，或 X 已關閉時 `Capability revoked`。
- BAT 現有的 `features.daemon_auto_start=false`（只在 elevated 時注入，`agent-registry.ts` `CODEX_DISABLE_DAEMON_ARGS`）只關自動啟動，擋不住連上已在跑的 daemon。
- 潛在回歸：BAT 目前靠 codex 未文件化的「非 features 的 `-c` → embedded」規則；codex 若改成把 `-c mcp_servers.*` 隨 thread 轉送，問題會擴大到所有 codex 分頁。

## 重現步驟（未實測）

1. 非系統管理員執行 BAT，Settings → BAT MCP 關閉，codex ≥ 0.163.0，`~/.codex` 的共用 daemon 沒在跑。
2. 工作區 1 開 codex 分頁 X（自動啟動 daemon）。
3. 工作區 2 開 codex 分頁 Y，請 codex 執行 `node -e "console.log(process.env.BAT_TERMINAL_ID)"`。
4. 預期 Y 的 id，實際印出 X 的 id；關掉 X 後在 Y 執行 helper → `Capability revoked`。

## 修正方向（使用者 2026-10-18 18:3x 選推薦，T0651）

- 文件與 CLAUDE.md「BAT MCP shim」節寫明不變式，加 source guard。
- BAT MCP 沒注入（且 BAT 會注入 helper env）時，codex 分頁加 `--no-daemon`；先確認 codex 版本支援（T0375：0.133 遇到 `--no-daemon` exit 2），確認不到就不加。
