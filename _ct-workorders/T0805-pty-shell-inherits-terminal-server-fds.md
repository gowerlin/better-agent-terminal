---
schema_version: 1
schema_kind: workorder
id: T0805
title: "查證：PTY 內的 shell 繼承 Terminal Server 的描述元（含 crashpad client socket）——每個 fd 的來源、影響範圍與修正方向"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-03T16:27:42+0800"
started_at: ""
updated_at: "2026-11-03T16:27:42+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "T0804 回報區〈結論〉C 觀察 2；D251；PLAN-062；T0540 / PLAN-042（程序樹）；T0704（recovery）；`electron/terminal-server/server.ts`、`electron/pty-manager.ts`"
affects_files:
  - _ct-workorders/T0805-pty-shell-inherits-terminal-server-fds.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 研究型：只查證、不修。不改產品程式、測試、e2e、文件、workflow；repo 內唯一可改的是本工單（回報區）。實驗腳本、下載的 AppImage、記錄放 WSL 或系統暫存目錄，收尾刪除。結論若是缺陷，回報寫修正方向與工單草案，由塔台開 BUG / 修正單。"
  - "🔴 不碰使用者既有資料：WSL 的 `~/.config/BetterAgentTerminal`、`~/bat-build`、`~/.codex`、WSL 原本在跑的 bat-server 不改不停；BAT 一律用隔離 userData（`--runtime=<名稱>`）。本機 Windows 正在使用的 BAT 安裝版不得關閉、不得結束它的 Terminal Server；Windows 端若要實測只能用隔離實例，且只結束自己啟動的程序（以 pid / 命令列確認）。"
  - "🔴 L185：只開 shell 分頁，不開 codex / claude 分頁、不在任何 agent TUI 送按鍵、不登入任何服務。以 Playwright 驅動 BAT 時關閉一律用 `closeIsolated`（`e2e/fixtures/electron-isolation.ts`）的作法（關閉確認回答離開＋結束 Terminal Server）；要保留 server 時先等主行程 `exit` 再收 server。"
  - "🔴 不記任何權杖或環境變數值（只記名稱）；fd 證據只記編號、類型、inode 與對端程序名稱。回報不寫家目錄真實路徑或帳號名（D176：`<使用者資料夾>` / `<使用者>`）。實測不到的部分標「推論」。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本工單（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0805 — 查證：PTY shell 繼承 Terminal Server 描述元

## 元資料

- **工單編號**：T0805
- **類型**：research（查證，不修）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T16:27:42+0800
- **預估規模**：M

## 背景

T0804（WSL Ubuntu 24.04、`v0.7.4-pre.3` AppImage）以 `ss -xp` 看到：PTY 內的 shell `bash -l -i` 持有 fd 59 / 61 / 70 / 83（與 Terminal Server 共用的 `u_str` socket）與 fd 73（crashpad client socket，`CRASHPAD_HANDLER_PID` / `CRASHDUMP_SIGNAL_FD` 也在 Terminal Server 的 env）。推論影響：shell 或它背景化的子程序（`nohup`、`setsid`）活著時 crashpad 不結束；分頁裡的使用者程式拿得到這些描述元（能讀寫的話，可能干擾 Terminal Server 與主行程之間的通道）。T0804 建議先查證每個 fd 的來源再決定修法。

## 範圍

1. **盤點**（WSL，隔離 userData，只開 shell 分頁）：Terminal Server 模式下，shell 的 `/proc/<pid>/fd` 逐一列出（0–2 以外），每個 fd 對應到誰（Terminal Server / 主行程 / crashpad / node-pty 內部 / 其他），是不是 `FD_CLOEXEC`（`/proc/<pid>/fdinfo` 的 `flags`），以及 env 裡 BAT 以外的繼承變數名稱（例 `CRASHPAD_HANDLER_PID`、`CRASHDUMP_SIGNAL_FD`）。
2. **影響**：
   - 分頁內程式能否實際讀寫這些 fd（只做無害的探測，例如 `fstat` / `getsockname`；🔴 不得寫入資料、不得關閉 Terminal Server 正在用的通道）。若判斷探測有風險，改以原始碼推論並標明。
   - shell 背景化的子程序活著時，BAT 正常關閉（離開＋結束 Terminal Server）後 crashpad / Terminal Server / AppImage mount 是否留著。
   - 繼承的 crashpad 設定會不會讓分頁內的其他 Electron / Chromium 程式（若有）回報到 BAT 的 crashpad（推論即可）。
3. **對照**：
   - direct 模式（不經 Terminal Server，`PtyManager` 直接 node-pty）的 shell 有沒有同樣情況。
   - headless bat-server（WSL 原本在跑的那個不能動；可用隔離 dataDir 另起一個、或讀原始碼推論）。
   - Windows（ConPTY 的 handle 繼承）：讀原始碼 / node-pty 文件推論即可，不必實跑；若實跑只能用隔離實例。
   - macOS：推論即可。
4. **來源與修正方向**：每類 fd 是誰打開、為什麼沒有 `CLOEXEC`（Node / libuv / node-pty / Electron 的行為），可行的修法與副作用（例：spawn 前設 `CLOEXEC`、server 不以 `ELECTRON_RUN_AS_NODE` 的 crashpad client 身分執行、env 去掉 crashpad 變數），並說明是否也解掉 PLAN-062（Terminal Server 保留時主行程 stdio 不關閉）。

## 不做

- 不修程式、不改測試；不開 BUG（塔台依結論開）；不動使用者的 WSL / Windows 既有 BAT 與資料。

## 驗收

- [ ] fd 盤點表（fd、類型、inode、對端、CLOEXEC、來源判斷），Terminal Server 模式＋direct 模式
- [ ] 影響查證結果（可否讀寫、背景子程序留著時的關閉結果、crashpad 推論）
- [ ] headless / Windows / macOS 的對照（實測或推論，標明）
- [ ] 結論：缺陷與否、嚴重度建議、修正方向與工單草案；與 PLAN-062 的關係
- [ ] 環境還原：隔離 userData、下載檔、暫存腳本已刪；沒有本單留下的 BAT / terminal-server / crashpad / mount；`~/.config/BetterAgentTerminal`、`~/bat-build`、`~/.codex/config.toml` 前後雜湊相同

---

## 回報區
