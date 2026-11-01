---
schema_version: 1
schema_kind: workorder
id: T0754
title: "研究：bat-server（headless）啟動時以登入 shell 取得 PATH 的量測與設計（PLAN-057）"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T00:25:31+0800"
depends_on: []
related:
  - "PLAN-057；D206；T0753 Q-2 與回報區〈發現的問題〉1（BUG-186）"
  - "`electron/early-path-fix.ts`（macOS Electron 主程序取登入 shell PATH 的既有做法）"
  - "`electron/remote/headless-entry.ts`（`headlessHelperPathEnv` 等）、`electron/terminal-server/server.ts` `buildServerPtyEnv`、`electron/pty-manager.ts` `buildPtyEnv`、git / gh resolver（`resolveGitBinary` / `resolveGhBinary`）"
  - "T0748 / T0749 的測試專用 headless server 做法（`/tmp/bat-e2e-*`、不經 systemd、使用者 bat-server 前後比對）；T0743 的 WSL Docker 做法（只動 `bat-e2e-t0754-` 資源）"
affects_files:
  - _ct-workorders/T0754-research-headless-login-shell-path.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只查不改：不改產品程式碼、測試、docs；不跑 `vite build` / 打包 / e2e。量測腳本只放 scratchpad 或 WSL `/tmp/bat-e2e-t0754*`。不動使用者的 bat-server（systemd unit、`~/.config/systemd`、dataDir、已在跑的程序），量測前後比對其 PID / unit 狀態不變；不改使用者的 rc 檔（`~/.bashrc`、`~/.profile` 等）。Docker 只在 WSL 的 Docker engine 建立 `bat-e2e-t0754-` 前綴的容器 / 映像並於結束時清掉（不得 `prune`、不碰使用者容器）；gxdocker / 其他 SSH 主機不使用。macOS（launchd）沒有機器：只讀程式碼與文件推論，回報標明「未實測」。"
  - "🔴 要回答：① 取 PATH 的候選方式（`$SHELL -l -i -c`、`-l -c`、以標記字串包住輸出過濾 rc 雜訊、`early-path-fix.ts` 現有做法；bash / zsh / fish / sh 的差異），在使用者 WSL 實際環境各量 ≥ 10 次（中位數 / 最大值）、輸出雜訊、失敗模式（rc 有 `exit`、互動提示、卡住 → timeout 建議值）；② PATH 差異：systemd unit 的 PATH（`systemctl --user show-environment`）vs 登入 shell PATH，含 WSL interop `/mnt/c/...` 項（要不要濾、怎麼濾）、重複項，以及 server 開的分頁再跑 `bash -l -i` 後是否重複疊加（`buildServerPtyEnv` / `buildPtyEnv`）；③ 影響盤點：headless 哪些子程序繼承 server PATH（Claude 面板 SDK spawn env、hooks、MCP、git / gh、worktree、codex、helper `BAT_HELPER_NODE` / bundle node bin），套用後哪些行為會變，有沒有會壞的（例如 Windows 程式被叫到、node 版本換成 nvm 的）；④ 套用點：headless 入口哪裡最早、同步或非同步、對啟動時間的影響，失敗 fallback；⑤ Docker（root、映像 PATH）在測試容器實測效果；⑥ 開關設計（D206：預設開、可關）：headless settings 鍵名與讀取時機（啟動時讀一次）、關閉時與現況完全相同、遠端工具面板「伺服器程序：不可見」標記在開啟後的表現、Settings UI 放哪；⑦ 實作單草案：範圍、affects_files、驗證方式（含測試專用 headless server 的 e2e、突變檢查）。"
  - "🔴 回報區給：結論、量測數據表、建議（含 timeout 值、`/mnt/c` 處理、開關鍵名）、實作單草案，以及需要使用者決定的點。log / 回報不含權杖、完整 session id；家目錄路徑寫 `<使用者家目錄>`。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
---

# T0754 — 研究：headless server 的登入 shell PATH

## 元資料

- **工單編號**：T0754
- **類型**：research
- **優先級**：P2
- **建立時間**：2026-11-02T00:25:31+0800
- **預估規模**：M

## 背景

bat-server 由 systemd user unit / launchd / 容器 ENTRYPOINT 啟動，PATH 只有系統預設值；server 開的終端分頁走 `bash -l -i` 所以找得到 `~/.local/bin`、nvm，但 server 程序的子程序（Claude 面板的 Bash 工具 / MCP、worktree 等）找不到（T0753 實測：WSL unit PATH 沒有 `~/.local/bin`、沒有 nvm）。使用者決定開 PLAN-057、先量測再實作，之後的開關預設開、可關（D206）。

## 範圍

1. 在使用者 WSL（不動使用者 bat-server）量測取 PATH 的方式、耗時、雜訊、失敗模式。
2. PATH 差異、影響盤點、套用點、Docker 測試容器實測。
3. 開關設計與實作單草案。

## 不做

- 不改任何產品檔案、不 build、不跑 e2e；不動使用者 bat-server、rc 檔、使用者容器；不用 SSH 主機；macOS 不實測。

## 驗收

- [ ] ①–⑦ 各有結論與證據（macOS 標明未實測）
- [ ] 量測數據表、建議、實作單草案與待決點
- [ ] 使用者 bat-server 前後狀態相同、測試資源已清除

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
