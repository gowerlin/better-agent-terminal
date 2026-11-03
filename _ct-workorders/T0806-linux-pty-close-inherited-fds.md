---
schema_version: 1
schema_kind: workorder
id: T0806
title: "BUG-205：Linux 上 PTY 子程序經 exec 包裝關掉 fd ≥ 3（不再繼承其他分頁的 pty master 與主行程描述元）；一併盤點 child_process 子程序的 fd 外流"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-03T17:08:46+0800"
started_at: ""
updated_at: "2026-11-03T17:08:46+0800"
completed_at: ""
session_ids: []
depends_on: [T0805]
isolation: worktree
related:
  - "BUG-205；D252；T0805 回報區（fd 盤點、成因、方案 A / B / C、工單草案）——**動工前必讀全文**；T0804；PLAN-062；CLAUDE.md「關閉分頁時的程序樹」「Terminal Server 存活判定與 recovery」「新 PTY 的初始尺寸」「Logging」（`PtyManager.buildPtyEnv` / `buildServerPtyEnv`）「Child Process Spawning」「BAT MCP shim」（`resolveDispatchShell`）節"
affects_files:
  - "electron/pty-spawn-fd-guard.ts（新增，名稱可依慣例調整：Linux exec 包裝純函式）"
  - electron/terminal-server/server.ts
  - electron/pty-manager.ts
  - "electron/__tests__/*（新增或調整與 PTY spawn 參數相關的單元測試）"
  - "electron/terminal-server/__tests__/*（若有對應測試）"
  - "e2e/linux/*（新增 Linux e2e：隔離實例、兩個 shell 分頁的 fd 檢查）"
  - CLAUDE.md
  - "docs/agent-guide/pty-process-tree.md 或新增 docs/agent-guide/linux-pty-fd-inheritance.md（並更新 docs/agent-guide/README.md 索引）"
  - _ct-workorders/T0806-linux-pty-close-inherited-fds.md
renew_count: 0
workdir: "worktree（BAT `--isolation worktree`，分支 `ct/T0806`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 揭露時程（D252）：BUG-205 是安全性缺陷，修正發版前不得公開。**不得 push 任何分支**（含 `ct/T0806`）、不得觸發需要 push 的 workflow（desktop-build / linux-acceptance / pre-release）、不得到 microsoft/node-pty 或任何外部開 issue / PR / 留言。Linux 驗證一律在本機 WSL 做。commit 訊息寫行為（「Linux PTY 子程序不再繼承多餘描述元」），不寫利用方式。"
  - "🔴 範圍：只動 Linux（`process.platform === 'linux'`）的 PTY spawn；Windows / macOS 的 spawn 參數、行為與 log 完全不變（單元測試守住）。唯一實作一個純函式（不 import electron），由 `electron/terminal-server/server.ts` 的 `pty.spawn`、`PtyManager` direct 分支與它的 `child_process.spawn` fallback 共用；headless 走同一個 `PtyManager`，不另寫。不改 node-pty 版本（方案 B 不做）、不做 PLAN-062 原題（方案 C 不做）。"
  - "🔴 包裝不得改變既有行為：shell 的 pid 不變（wrapper `exec` 成 shell）、argv[0] 保留（`exec -a`）、原參數（含 `-l`、`-i`、含空白 / 引號的參數）原樣、env 與 cwd 不變、只保留 fd 0–2。包裝 shell 不在時（例如沒有 `/bin/bash`）照舊直接 spawn，記一行 debug log（不記 env 值）。動工前先列出所有依賴 PTY 程序路徑 / 名稱 / pid 的 consumer（例：T0540 `killProcessTree` / `endPty`、`pty:list`、`TerminalBlockedTracker`、`--close-worker`、⏻ 重啟、Recovery、`resolveDispatchShell` 的 shell family 判斷、縮圖 / 標題、codex OSC、`LaunchSuspectWatcher`），逐一確認不回歸並寫進回報。"
  - "🔴 安全：包裝命令一律以陣列參數傳給 spawn，不得組 shell 字串拼接使用者輸入（CLAUDE.md「Child Process Spawning」）；shell 路徑與參數以位置參數傳入 wrapper，wrapper 腳本本身是固定字串。不在 log / 測試輸出印權杖或 env 值。"
  - "🔴 驗證：單元測試（純函式：Linux 套用 / 非 Linux 不套用 / 參數與 argv0 保留 / 包裝 shell 不存在時退回）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`。Linux 實機：在 WSL 以本分支建出的 Linux 版（暫存目錄複製或 `electron-builder --linux --dir`；不得改動 WSL 的 `~/bat-build`、`~/.config/BetterAgentTerminal`、`~/.codex`、使用者的 bat-server）跑新增的 e2e：隔離實例、兩個 shell 分頁，每個 shell 的 `/proc/<pid>/fd` 只剩 0–2（與 bash 的 255）、第 2 個分頁沒有 `/dev/ptmx`；背景 `setsid sleep` ＋關閉確認「離開＋結束 Terminal Server」→ `app.close()` < 3 s、沒有殘留 crashpad；並跑 T0540 程序樹、⏻ 重啟、Recovery 的既有相關 e2e 或等效手動檢查。關閉一律用 `closeIsolated`（L185）。"
  - "🔴 L185：只開 shell 分頁，不開 codex / claude 分頁、不在 agent TUI 送按鍵、不登入任何服務。不得關閉本機 Windows 正在使用的 BAT 或它的 Terminal Server。"
  - "🔴 一併查證（只查不修）：主行程以 `child_process` 起的其他子程序（git、gh、claude CLI / Agent SDK、codex、`execFile` 類、Terminal Server 本身）是否也收到主行程的無 CLOEXEC fd；在 WSL 隔離實例取 2–3 個代表性子程序實測（只看 fd 清單，不讀寫），寫成盤點表與建議（另開單 / 不處理），不擴大本單修正範圍。"
  - "🔴 文件：CLAUDE.md 新增一節（3–12 行，依 CLAUDE.md 撰寫規則：用途、必守規則、唯一實作位置、不變式、連到 docs），docs/agent-guide 寫完整說明；不寫利用步驟，只寫「Linux PTY 子程序只保留 fd 0–2」的規則與原因概述。不改 CHANGELOG / release-note / README（塔台發版時處理）。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。Git：只在 `ct/T0806` commit 本單範圍；禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。不合併回 main（塔台依 merge-workorder 處理）。公開 repo 去識別化（D176）。"
---

# T0806 — Linux PTY 子程序關掉繼承的描述元（BUG-205）

## 元資料

- **工單編號**：T0806
- **類型**：implementation（安全性修正）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-03T17:08:46+0800
- **預估規模**：M
- **隔離**：worktree（`ct/T0806`），不 push

## 背景

BUG-205（T0805 查證）：Linux 上每個分頁的 shell 繼承 Electron 主行程與 Terminal Server 約 30 個沒有 CLOEXEC 的描述元，並持有比它早開的分頁的 pty master。成因：Chromium 不設 CLOEXEC、libuv 在 Linux fork＋exec 不關多餘 fd、`@lydell/node-pty` 1.1.0 `forkpty`＋`execvp` 不關且 master 無 CLOEXEC；上游 1.2.0-beta 的修正在 BAT 的 fd 分布下仍漏。使用者選方案 A（D252）：BAT 在 Linux 上把 PTY 子程序經 exec 包裝，exec shell 前關掉 fd ≥ 3。

## 範圍

1. 純函式（Linux 才套用）：輸入原本的 `file` / `args`，輸出包裝後的 `file` / `args`（例：`/bin/bash`，`-c`，固定腳本，`<原 file>`，`<原 args…>`；腳本讀 `/proc/self/fd` 關掉 ≥ 3，`exec -a "<argv0>" "$@"`）。實作細節（腳本內容、argv0 取法、包裝 shell 不存在的判斷）由 Worker 依實測決定並寫進回報。
2. 接線：`terminal-server/server.ts` 的 `pty.spawn`、`PtyManager` direct 分支、其 `child_process.spawn` fallback。
3. 測試：單元測試＋ Linux e2e（`e2e/linux/` 下新增，不放進 `tests/`）；WSL 本機實跑。
4. 一併查證 `child_process` 子程序的 fd 外流（只查不修）。
5. 文件：CLAUDE.md 一節＋ docs/agent-guide。

## 不做

- 不升級 node-pty、不做 PLAN-062 原題、不改 Windows / macOS 行為；不 push、不發版、不對外回報；不改 CHANGELOG / release-note / README。

## 驗收

- [ ] consumer 清單與逐一不回歸判斷
- [ ] 單元測試（Linux 套用 / 非 Linux 不變 / 參數與 argv0 保留 / 退回路徑）
- [ ] typecheck 0 / 0、unit、legacy、vite build 綠
- [ ] WSL 實測：兩個 shell 分頁 fd 只剩 0–2（＋255）、第 2 個分頁無 `/dev/ptmx`；背景 `setsid sleep` ＋「離開＋結束 Terminal Server」→ `app.close()` < 3 s、無殘留 crashpad
- [ ] T0540 程序樹、⏻ 重啟、Recovery 等既有行為在 Linux 不回歸（e2e 或等效檢查，附證據）
- [ ] child_process 子程序 fd 外流盤點表與建議
- [ ] CLAUDE.md / docs 更新
- [ ] 環境還原（WSL 暫存、隔離 userData 已刪；使用者 WSL 資料前後雜湊相同）；未 push 任何分支

---

## 回報區
