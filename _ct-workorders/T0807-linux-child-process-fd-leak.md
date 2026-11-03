---
schema_version: 1
schema_kind: workorder
id: T0807
title: "BUG-206 / BUG-207：Linux 上 child_process 子程序不再繼承 pty master（headless / direct 宿主）與主行程描述元（長時間執行的子程序）"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: L
created_at: "2026-11-03T17:59:11+0800"
started_at: "2026-11-03T18:00:46+0800"
updated_at: "2026-11-03T18:00:46+0800"
completed_at: ""
session_ids: []
depends_on: [T0806]
isolation: worktree
related:
  - "BUG-206（high）/ BUG-207（low）；D253；T0806 回報區〈child_process 子程序 fd 外流盤點〉與 `electron/pty-spawn-fd-guard.ts`（`guardPtySpawnFds`，可沿用或抽共用）——**動工前必讀**；T0805 回報區（成因、上游 node-pty PR #867 / #986）；BUG-205；PLAN-062；CLAUDE.md「Linux PTY 子程序只保留 fd 0–2」「Child Process Spawning」「Claude Agent SDK / CLI」「BAT MCP shim」「headless server 的登入 shell PATH」節"
affects_files:
  - "electron/pty-spawn-fd-guard.ts（可擴充或抽出共用函式）"
  - "electron/child-process-fd-guard.ts（新增，名稱可依慣例調整）"
  - "electron/**/*.ts 中 Linux 上會起長時間執行子程序或在 headless / direct 宿主起子程序的 spawn 點（動工前列清單，回報列實際改動檔）"
  - "electron/__tests__/*（新增或調整 fd guard 相關單元測試）"
  - "e2e/linux/*（擴充 t0806 spec 或新增 spec）"
  - CLAUDE.md
  - docs/agent-guide/linux-pty-fd-inheritance.md
  - _ct-workorders/T0807-linux-child-process-fd-leak.md
renew_count: 0
workdir: "worktree（BAT `--isolation worktree`，分支 `ct/T0807`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 揭露時程（D252 / D253）：BUG-205 / 206 是安全性缺陷，發版前不得公開。不得 push 任何分支、不得觸發需要 push 的 workflow、不得對外開 issue / PR / 留言。Linux 驗證一律在本機 WSL。commit 訊息寫行為，不寫利用方式。"
  - "🔴 目標優先序：① BUG-206：在 Linux 的 headless bat-server 與 direct 模式，**任何** `child_process` 子程序（含短命的 git / `execFile`：git hook 會執行使用者程式碼）都不得拿到分頁的 pty master；② BUG-207：Electron 主行程起的長時間執行子程序（Claude Agent SDK 起的 claude CLI、codex、MCP server 類）不再繼承主行程的無 CLOEXEC fd。短命的 `execFile` 在 Electron 主行程（無 master）可不處理，需在回報說明判斷。"
  - "🔴 先盤點再改：列出 `electron/**`（不含測試）所有 `child_process` 呼叫點（約 37 檔），每點標：哪個行程（Electron 主行程 / Terminal Server / headless / 共用）、短命或長時間、是否用 IPC（`fork` / `stdio: 'ipc'` / 額外 stdio fd）、Linux 是否需處理。🔴 用 IPC 或額外 stdio 的子程序（例：`fork(terminal-server.js)`、`NODE_CHANNEL_FD`）不得被關掉那些 fd；Terminal Server 本身不在本單（PLAN-062 方案 C）。"
  - "🔴 做法自選但要守住：唯一實作（純函式，不 import electron），呼叫端不內聯；只在 `process.platform === 'linux'` 生效，Windows / macOS 的 spawn 參數、行為、log 完全不變（單元測試守住）；以陣列參數 spawn，不組 shell 字串（CLAUDE.md「Child Process Spawning」）；保留 pid / argv / env / cwd / stdio 語意（沿用 T0806 的 env 還原經驗）；Claude Agent SDK 若要改 spawn 方式，只能用 SDK 提供的選項（例：自訂 spawn 函式），不得 patch node_modules。若達成 ① 需要 native 模組、改 node-pty 版本、或要改的 spawn 點太多以致風險過高 → 停在已完成的部分回報 PARTIAL，附方案比較與建議，不要硬做。"
  - "🔴 驗證：單元測試（Linux 套用 / 非 Linux 不變 / IPC fd 保留 / 退回路徑）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`。WSL 實測：(a) 以 headless 或等效宿主（同 T0806 的 node＋node-pty 模擬，或隔離 dataDir 的 bat-server bundle）開兩個 PTY 後，宿主起的 git / claude 類子程序 fd ≥ 3 不含 `/dev/ptmx`；(b) Electron 隔離實例（`electron-builder --linux dir`，同 T0806）中代表性長時間子程序的 fd 清單；(c) 反向對照證明測試抓得到漏洞；(d) T0806 e2e F1–F6 不回歸。🔴 不得停止或連線使用者 WSL 原本在跑的 bat-server（`~/.local/bat-server`、docker 內）；不改 `~/bat-build`、`~/.config/BetterAgentTerminal`、`~/.codex`。"
  - "🔴 L185：只開 shell 分頁；不開 codex / claude 分頁、不在 agent TUI 送按鍵、不登入任何服務；不得讓 claude / codex 實際呼叫模型（只驗 spawn 出的程序 fd，可用 `--version` 類不連網的參數或替身執行檔）。Playwright 關 BAT 用 `closeIsolated`。不得關閉本機 Windows 正在使用的 BAT。"
  - "🔴 測試衛生：helper 相關測試一律設暫存 `BAT_USER_DATA` / `BAT_HELPER_LOG_DIR`（BUG-208 由 T0808 修，本單新測試不得再寫真實 log）。"
  - "🔴 文件：CLAUDE.md「Linux PTY 子程序只保留 fd 0–2」節擴充或新增一節（3–12 行），docs/agent-guide 同步；不寫利用步驟；不改 CHANGELOG / release-note / README。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。Git：只在 `ct/T0807` commit 本單範圍；禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。不合併回 main。公開 repo 去識別化（D176）：回報不寫 WSL 帳號名與家目錄真實路徑。"
---

# T0807 — Linux child_process 子程序的 fd 外流（BUG-206 / 207）

## 元資料

- **工單編號**：T0807
- **類型**：implementation（安全性修正）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-03T17:59:11+0800
- **預估規模**：L
- **隔離**：worktree（`ct/T0807`），不 push

## 背景

T0806 修好 PTY 子程序（BUG-205），盤點時發現：headless / direct 宿主持有各分頁的 pty master 且無 CLOEXEC，宿主以 `child_process` 起的子程序（Claude 面板的 claude CLI、git 等）全部拿到所有分頁的 master（BUG-206，high）；Electron 主行程起的子程序繼承 Chromium 約 49 個無 CLOEXEC 的 fd（BUG-207，low）。使用者決定三張同批修完再發版（D253）。

## 範圍

1. 盤點 `child_process` 呼叫點（表格見 memory_overrides）。
2. 實作 Linux 專用的 child_process fd guard（唯一實作），套用到：headless / direct 宿主的所有子程序（BUG-206）、Electron 主行程的長時間執行子程序（BUG-207）。
3. 測試（單元＋ WSL 實測＋反向對照＋ T0806 e2e 不回歸）。
4. 文件。

## 不做

- Terminal Server 本身的 fd（PLAN-062 方案 C）；升級 node-pty；Windows / macOS 行為；push / 發版 / 對外回報；CHANGELOG / release-note / README。

## 驗收

- [ ] child_process 呼叫點盤點表與每點處置
- [ ] 單元測試（Linux 套用 / 非 Linux 不變 / IPC fd 保留 / 退回路徑）
- [ ] typecheck 0 / 0、unit、legacy、vite build 綠
- [ ] WSL：headless / direct 宿主的子程序不含 `/dev/ptmx`；Electron 長時間子程序 fd 清單；反向對照
- [ ] T0806 e2e F1–F6 不回歸
- [ ] CLAUDE.md / docs 更新
- [ ] 環境還原；未 push 任何分支

---

## 回報區
