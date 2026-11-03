---
schema_version: 1
schema_kind: workorder
id: T0812
title: "研究（PLAN-062）：Terminal Server 保留時主行程 stdout / stderr 不關閉——BUG-205/206/207 修正後的現況、可行修法與副作用"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-03T21:11:52+0800"
started_at: ""
updated_at: "2026-11-03T21:11:52+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "PLAN-062；D251 / D258；T0804（結論 A＋B、觀察 1）；T0805（方案 C）；T0806 / T0807（BUG-205 / 206 / 207 修正，`runWithoutChildProcessFdGuard` 排除 Terminal Server 的 fork）；T0144 / T0578（保留 Terminal Server、Recovery 提示）；`electron/main.ts` `crashReporter.start`、`electron/pty-manager.ts`（fork Terminal Server）、`electron/terminal-server/server.ts`"
affects_files:
  - _ct-workorders/T0812-research-kept-terminal-server-crashpad-stdio.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 研究型：只查證、不修。repo 內唯一可改的是本工單（回報區）。實驗用的改動（例如試改 fork 參數、env）只能在 repo 外的副本、解開的 AppImage 或暫存目錄做，收尾刪除；不得 commit 產品程式、測試、文件、workflow。結論寫修正方向與實作工單草案，由塔台開單。"
  - "🔴 不碰使用者既有資料：WSL 的 `~/.config/BetterAgentTerminal`、`~/bat-build`、`~/.codex`、`~/.claude`、原本在跑的 bat-server 不改不停；BAT 一律用隔離 userData（`--runtime=<名稱>`）。本機 Windows 正在使用的 BAT 安裝版不得關閉、不得結束它的 Terminal Server；Windows 端若實測只能用隔離實例，且只結束自己啟動的程序（以 pid / 命令列確認）。"
  - "🔴 L185：只開 shell 分頁，不開 codex / claude 分頁、不對任何 agent TUI 送按鍵、不登入任何服務。以 Playwright 驅動 BAT 時，不保留 server 的情境一律依 `closeIsolated`（`e2e/fixtures/electron-isolation.ts`）的作法關閉；保留 server 的情境要自己收掉隔離實例的 server（以 pid 確認）。"
  - "🔴 不記任何權杖或環境變數值（只記名稱）；回報不寫家目錄真實路徑或帳號名（D176：`<使用者資料夾>` / `<使用者>`）。實測不到的部分標「推論」。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本工單（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。本單與 T0811（實作，改 `electron/pty-manager.ts` 等）/ T0813 並行，不得改它們的檔。"
---

# T0812 — 研究：Terminal Server 保留時主行程 stdio 不關閉（PLAN-062）

## 元資料

- **工單編號**：T0812
- **類型**：research（查證＋實驗，不修）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T21:11:52+0800
- **預估規模**：M

## 背景

T0804（WSL Ubuntu 24.04、`v0.7.4-pre.3` AppImage）：關閉確認預設保留 Terminal Server（T0144）；Terminal Server 是 `chrome_crashpad_handler` 的 client，crashpad 由主行程 `crashReporter.start()` 啟動並繼承主行程 stdout / stderr，所以 server 活著時主行程 stdio 不關閉，Playwright `app.close()` 等不到 `close`。推論：以 pipe 接 BAT 輸出、等 EOF 的外部啟動方式（`out=$(./BAT.AppImage)`、`| tee`、服務管理器）會一直等。T0805 方案 C：fork server 時不讓它成為 crashpad client，代價是 server 當掉不產生 dump。之後 T0806 / T0807（`v0.7.4-pre.4`）修了 PTY / child_process 的 fd 外流，但 Terminal Server 的 `fork` 刻意排除在 guard 之外（`runWithoutChildProcessFdGuard`，PLAN-062 方案 C 待定）。使用者 2026-11-03 指示先研究（D258）。

## 範圍

1. **現況重現**（交付版 `v0.7.4-pre.4` AppImage，WSL，隔離 userData）：保留 Terminal Server 關閉後，主行程 stdout / stderr 的 pipe 何時 EOF；誰持有（`/proc/*/fd` 對 pipe inode）；`out=$(…)` / `| tee` / Playwright `close` 三種情境的實際結果。與 T0804 的 `v0.7.4-pre.3` 結果比較（T0806 / T0807 後有沒有變化）。
2. **成因細節**：Terminal Server 成為 crashpad client 的機制（env `CRASHDUMP_SIGNAL_FD` / `CRASHPAD_HANDLER_PID`、繼承的 socket、`ELECTRON_RUN_AS_NODE` 下 Electron 的初始化）；crashpad handler 為何繼承主行程 stdio。
3. **候選修法實驗**（只在 repo 外 / 解開的 AppImage 做）：至少比較
   - A：fork server 時不當 crashpad client（去掉相關 env / 關掉繼承的 crashpad fd），量測 server 當掉時有沒有 dump、主行程與 renderer 的 dump 是否不受影響；
   - B：讓 crashpad handler 不持有主行程 stdio（例如主行程 stdio 在 `crashReporter.start` 前後的處理、Electron 是否有選項）；
   - C：其他你查到的作法（例：server 改由 crashpad 外的方式回報、關閉確認時的處理）。
   每個方案寫：是否解決三種情境、副作用（dump、Recovery 提示、T0578 / T0704 行為、headless 不受影響與否）、實作位置與規模。
4. **平台**：Windows 本機有沒有同樣現象（ConPTY / handle 繼承；可讀原始碼推論，或用隔離實例實測）；macOS 推論。
5. **建議**：推薦方案、不做的理由（若結論是不值得修也可以）、實作工單草案（affects_files、必守規則、驗收，含 Linux CI `linux-acceptance` 可加的檢查）。

## 不做

- 不修程式、不改測試 / 文件 / workflow；不開 BUG（塔台依結論處理）；不動使用者既有 BAT 與資料。

## 驗收

- [ ] `v0.7.4-pre.4` 現況重現（三種情境、持有者證據）
- [ ] 成因說明（實測／推論標明）
- [ ] 候選修法比較表（解決與否、副作用、規模）
- [ ] Windows / macOS 對照
- [ ] 建議與實作工單草案

---

## 回報區

<!-- Worker 由此往下寫 -->
