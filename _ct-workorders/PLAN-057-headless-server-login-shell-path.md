---
schema_version: 1
schema_kind: plan
id: PLAN-057
title: "bat-server（headless）啟動時以登入 shell 取得 PATH：遠端的 Claude 面板工具 / MCP、Git 面板找得到 `~/.local/bin`、nvm、Homebrew（預設開、可關）"
status: DONE
completed_at: "2026-11-02T02:11:14+08:00"
priority: low
created_at: "2026-11-02T00:25:31+0800"
links:
  source: "T0753 Q-2 選項 B ＋ 回報區〈發現的問題〉1（BUG-186）；D206"
  related: [BUG-186, T0753, T0754]
---

# PLAN-057 — headless server 的登入 shell PATH

## 動機

bat-server 由 systemd user unit（WSL / SSH Linux）、launchd（SSH macOS）或容器 ENTRYPOINT（Docker）啟動，PATH 只有系統預設值，沒有 `~/.local/bin`、nvm、Homebrew。server 開的終端分頁走 `bash -l -i` 所以找得到，但 server 程序自己的子程序（Claude 面板的 Bash 工具 / hooks / MCP server（`npx` / `uvx`）、worktree、git-scaffold）找不到。T0753 只修了遠端工具面板的判斷與文案（「伺服器程序：不可見（終端分頁找得到）」），沒有改 PATH。

## 方向（D206）

- 先研究量測（T0754，只查不改）：取 PATH 的方式、耗時、雜訊與失敗模式、PATH 差異（含 WSL `/mnt/c` interop、重複項）、會受影響的子程序、開關設計、實作單草案。
- 再依量測結果開實作單。比照 `electron/early-path-fix.ts`：timeout、只取 PATH、失敗退回原 PATH。
- 預設開、可關（headless settings 開關，D206）。關閉時行為與現況完全相同。
- 生效需要升級並重啟 server。

## 研究結果（T0754 DONE，`6ddb08e1`）

- 取法：`<登入 shell> -l -i -c` ＋隨機標記；`spawn` detached、逾時 3000 ms 以 SIGKILL 砍整個程序群組、用 `exit` 事件（`execFile` 的 timeout 對 `bash -i` 無效）。WSL 實測中位 123 ms。
- WSL systemd 下 `/mnt/*` 項為 0；套用後分頁的 `~/.local/bin` 多一份；沒找到會讓 BAT 壞掉的路徑。
- 套用點：`scripts/bat-server.mjs` `main()`，`createHeadlessServer` 之前；開關 `<dataDir>/settings.json` `headlessLoginShellPath`（`!== false` 為開）。
- 實作單草案與待決點見 T0754 回報區 ⑦ 與〈需要使用者決定的點〉。
- D207：不加環境變數覆蓋、不過濾 `/mnt`、接受分頁 PATH 重複 → 實作單 **T0755**。

## 實作（T0755 DONE，`681a8d64`）

- `electron/remote/headless-login-path.ts`、`bat-server.mjs` 呼叫、Settings 開關（進階頁，Linux / macOS 遠端視窗）、docs `docs/agent-guide/headless-login-shell-path.md`、CLAUDE.md 一節。
- 驗證：unit 6448 / 363 files、typecheck 0 / 0、build；6 項突變檢查；WSL 測試 server `applied`（124 ms，+2 項）/ `off` 與現況相同；Docker `applied`。
- 剩：發版後以精靈升級使用者 bat-server 實機確認（journal `login shell PATH: applied`、工具面板「伺服器：可見」）；macOS 未實測。

## 實機驗收（2026-11-02T02:11:14+08:00，第一百零四 session）

- 隨 `v0.7.3-pre.3` 發佈（run `41332527832`，target `4a5f73d6`）。使用者以精靈把 WSL `Ubuntu-24.04` 的 bat-server 升到 `0.7.3-pre.3`（port 9877 沿用、profile 更新而非新增）。
- journal：`[bat-server] login shell PATH: applied (shell=/bin/bash, 114 ms, +2 entries, 11 total, /mnt 0)`，與 T0755 測試 server 一致。
- 使用者實機：遠端工具面板伺服器檢視 claude / codex / uv 皆可見；舊分頁 ⏻ 重啟正常。
- 未實測：macOS（launchd）、SSH Linux 正式安裝（程式路徑與 WSL 相同，Docker 已於 T0755 驗 `applied`）；列為已知限制，不阻擋結案。
