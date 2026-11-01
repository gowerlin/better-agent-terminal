---
schema_version: 1
schema_kind: plan
id: PLAN-057
title: "bat-server（headless）啟動時以登入 shell 取得 PATH：遠端的 Claude 面板工具 / MCP、Git 面板找得到 `~/.local/bin`、nvm、Homebrew（預設開、可關）"
status: PLANNED
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
