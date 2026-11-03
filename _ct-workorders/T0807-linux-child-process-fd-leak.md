---
schema_version: 1
schema_kind: workorder
id: T0807
title: "BUG-206 / BUG-207：Linux 上 child_process 子程序不再繼承 pty master（headless / direct 宿主）與主行程描述元（長時間執行的子程序）"
type: implementation
status: FIXED
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: L
created_at: "2026-11-03T17:59:11+0800"
started_at: "2026-11-03T18:00:46+0800"
updated_at: "2026-11-03T18:34:39+0800"
completed_at: "2026-11-03T18:34:39+0800"
session_ids:
  - "ed06eff7-851e-46c9-8959-14b914a098d6"
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
  - "scripts/bat-server.mjs（Q-1 塔台答 A：`main()` 安裝 `installChildProcessFdGuard`）"
  - "docs/agent-guide/README.md（Q-1 塔台答 A：只改 linux-pty-fd-inheritance 那一列）"
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

### 待塔台決策

#### Q-1：headless 安裝點放在 `scripts/bat-server.mjs`、並更新 `docs/agent-guide/README.md` 索引列，兩檔不在 `affects_files`，是否接受？
- 提問時間：2026-11-03T18:27:10+0800
- 選項：[A] 接受：`scripts/bat-server.mjs` `main()` 在 `loadServerEntry` 之後、`applyHeadlessLoginShellPath` 之前呼叫 `serverEntry.installChildProcessFdGuard?.(…)`（`server-entry.ts` 匯出，比照 T0755 login-shell PATH 的位置與 source guard），`docs/agent-guide/README.md` 只改 linux-pty-fd-inheritance 那一列的說明 / 對應節 / [B] 不動 `bat-server.mjs`：改在 `electron/remote/headless-entry.ts` `createHeadlessServer` 內安裝（缺點：測試在行程內建立 headless server 時也會裝上全域 guard，且 bat-server 的 login-shell PATH spawn 在它之前）；README 索引列還原 / [C] 其他：________
- Worker 建議：[A]。guard 是行程層級的安裝（libuv 入口），headless 唯一的行程入口就是 `bat-server.mjs`；放在那裡最早、只裝一次、不影響行程內建立 headless server 的測試。README 是 docs/agent-guide 索引，CLAUDE.md 規定改功能時兩邊一起更新（T0806 也改了同一列）。
- 影響範圍：`scripts/bat-server.mjs`（+4 行）、`docs/agent-guide/README.md`（1 列）；選 [B] 要改 `headless-entry.ts`、source guard 測試與文件。
- 阻塞：否（其餘實作與驗證已完成；填完成狀態前等答覆）
- **通道**：BAT（`q-7bb3e799-…`，18:27:35 送出、8 s 後答覆 choice 1）；答覆全文見〈互動紀錄〉

### 完成狀態

- **狀態**：FIXED（BUG 修正：實作與所有驗收關卡完成，等塔台合併、發版後實機驗收）
- **結論一句話**：Linux 上主行程與 headless bat-server 的每個 `child_process` 子程序改經固定的 bash 包裝，exec 前關掉 stdio 以外的 fd。WSL 實測：持有兩個 pty master 的宿主起的子程序（8 種 API 與 `git commit` 的 hook）都沒有 `/dev/ptmx`；Electron 主行程起的 `sleep` 從 49 個可繼承 fd 降到 0。pid、argv、執行檔、env、cwd、錯誤行為與修正前相同。Windows / macOS 不安裝（單元測試守住）。
- **開始 / 完成時間**：2026-11-03T18:00:46+0800 → 2026-11-03T18:34:39+0800
- **session_id**：ed06eff7-851e-46c9-8959-14b914a098d6

### 落點檢查

- 結果：**PASS**
- C-0：工單 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` → PASS
- C-3：`electron/pty-spawn-fd-guard.ts`、`CLAUDE.md`、`docs/agent-guide/linux-pty-fd-inheritance.md` 都在 worktree；新檔的上層（`electron/`、`electron/__tests__/`、`e2e/linux/`）都在 → present
- C-2：工單沒有 `branch` 欄位；目前分支 `ct/T0807`
- `CT_HOME` = 主 checkout（better-agent-terminal）、`CT_WORKTREE_BRANCH` = `ct/T0807`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### SHA

- `branch`：`ct/T0807`
- `base_sha`：`842ef07dd987ed2690636298661cd7ff2a9eb140`
- `validated_sha`：`5e056b72f21a3d4f1cd928389de0952310b5fea7`
- `head_sha`：`5e056b72f21a3d4f1cd928389de0952310b5fea7`
- 說明：Windows 關卡（typecheck ×2、`test:unit` ×2、`test:legacy`、`vite build`）與 WSL 測試（Linux 實測、e2e、完整 vitest、headless 冒煙）跑在 commit 前的工作樹上。commit 後 `git status` 乾淨，WSL 副本與 worktree 的 10 個變更檔 SHA-256 逐一相同，所以那份內容就是 `5e056b72`。

### 做法與理由

- **攔截點選 libuv 入口，不逐點改 spawn**：所有 `child_process` API 最後都進兩個 binding——`process.binding('process_wrap').Process.prototype.spawn`（spawn / execFile / exec / fork）與 `process.binding('spawn_sync').spawn`（spawnSync / execFileSync / execSync）。在這兩處包裝，一次涵蓋 `electron/**` 約 37 檔的呼叫點、Claude Agent SDK 與 codex SDK 內部的 spawn（不改 `node_modules`、不改 SDK 選項），以及日後新增的呼叫點。逐點改要動數十處、還漏掉第三方程式碼，風險較高。
- **Node 實測**（WSL Node 26.13、Electron 45 內建 Node 24.22.1）：async binding 是位置參數 `spawn(file, args, cwd, envPairs, stdio, flags, uid, gid)`，sync 是物件 `spawn(options)`；兩種形狀（加上舊版物件形 async）都支援。不認得的形狀或 guard 內部例外 → 原樣 spawn＋記一行（fail open，不讓 git / claude 起不來）。
- **包裝**：`/bin/bash -c <固定腳本> bat-child-fd-guard <flags> <BASH_ENV> <PWD> <keep> <extra> <argv0> <target> <args…>`。保留 fd 0 … stdio 數−1（`fork` 的 IPC、額外 pipe）與 `CRASHDUMP_SIGNAL_FD`；`exec -a argv0 target` 讓 argv 與 libuv 相同；`target` 由 `resolveChildExecutable` 照 libuv `uv__execvpe` 的 PATH 順序在父行程先找好。
- **找不到 / 不可執行的命令不包裝**：否則 bash 會存在、spawn 成功後才 exit 127，原本靠 ENOENT 判斷「沒裝」的程式（docker / wsl / gh / claude 偵測）會壞掉。不包裝時照舊 ENOENT / EACCES，也沒有程序可繼承任何東西。
- **env**：比照 T0806 的處理（`BASH_ENV` 不給包裝的 bash 並還原、沒有的 `SHLVL` 經 `/usr/bin/env -u SHLVL`），另外把 `PWD` 原值（含失效的）還原，因為 child_process 常以 `cwd` 選項＋繼承來的 `PWD` 起子程序。
- **安裝點**：`electron/main.ts` 模組層（`handOffEarlyCrashCapture()` 之後、任何 spawn 之前）、`scripts/bat-server.mjs` `main()`（Q-1 塔台答 A）。Terminal Server 不安裝；它的兩個 `fork` 包在 `runWithoutChildProcessFdGuard`（PLAN-062 方案 C 不在本單）。
- **短命 `execFile` 在 Electron 主行程的判斷**：工單允許不處理（Terminal Server 模式下主行程沒有 master）。因為 guard 裝在入口，一律包裝反而較單純，而且 Electron 的 direct 模式（Terminal Server 起不來時）主行程就持有 master，也需要涵蓋。代價是每次 spawn 多一個 bash 啟動（毫秒級）。

### 變更檔案

| 檔案 | 變更 |
|---|---|
| `electron/child-process-fd-guard.ts` | 新增（唯一實作：`guardChildSpawn` / `resolveChildExecutable` 純函式、`installChildProcessFdGuard`、`runWithoutChildProcessFdGuard`；沿用 `pty-spawn-fd-guard.ts` 的常數） |
| `electron/main.ts` | 模組層安裝；兩個 Terminal Server `fork` 包在 `runWithoutChildProcessFdGuard` |
| `electron/remote/server-entry.ts` | 匯出 `installChildProcessFdGuard` |
| `scripts/bat-server.mjs` | `main()` 在 `loadServerEntry` 後、`applyHeadlessLoginShellPath` 前安裝（`?.`，舊 server-entry 略過） |
| `electron/__tests__/child-process-fd-guard.test.ts` | 新增（29 tests，各平台） |
| `electron/__tests__/child-process-fd-guard-linux.test.ts` | 新增（10 tests，Linux 才跑：真 libuv / bash / node-pty） |
| `e2e/linux/t0807-child-process-fds.spec.ts` | 新增（打包的 Linux 版 G1–G3） |
| `CLAUDE.md` | 新增「Linux child_process 子程序只保留 stdio（T0807 / BUG-206 / BUG-207，D253）」一節（6 條），並改上一節的已知限制 |
| `docs/agent-guide/linux-pty-fd-inheritance.md`、`docs/agent-guide/README.md` | 新增 child_process 章（規則、包裝、env、日誌、呼叫點盤點、驗證、已知限制）；README 只改這一列 |

`electron/pty-spawn-fd-guard.ts` 沒有改（只 import 它的常數）。

### child_process 呼叫點盤點與處置

完整表格（每點的行程、長短、IPC / 額外 fd、Linux 處置）寫在 `docs/agent-guide/linux-pty-fd-inheritance.md`〈呼叫點盤點〉。摘要：

- **不包裝**：Terminal Server 的兩個 `fork(terminal-server.js)`（IPC 在 fd 3；PLAN-062 方案 C）；`PtyManager` 的 child_process fallback（已經過 PTY guard，`already-guarded`）。
- **長時間、主要對象**：Claude Agent SDK 起的 claude CLI、codex SDK 起的 codex（主行程與 headless 都有）；`ssh-tunnel`、`wsl-keepalive`（wsl 只在 Windows）。
- **短命**：git / gh（`handlers/git.ts`、`ct-worktree.ts`、`worktree-manager.ts`，hook 會執行 repo 程式碼）、`claude auth`、版本偵測（`claude-resolver`、`claude-version-check`、`codex-osc-version`、`codex-runtime-resolver`、`gh-resolver`）、`locale -a`、remote-tools probe、ssh wizard / docker / uname、語音檢查（`execPath`＋`ELECTRON_RUN_AS_NODE`，保留 `CRASHDUMP_SIGNAL_FD`）、headless login-shell PATH。全部包裝。
- **只在 Windows 呼叫**：`spawnSync('powershell')`、`taskkill`（`pty-manager`、`process-tree`）、`wsl-*`、`windows-elevation`。
- **在 guard 之前執行**：`early-path-fix`（bootstrap import 期，T0485 限制它的 import；此時沒有 pty master）。維持原狀，列為已知限制。
- 沒有呼叫點使用 `argv0` 選項；用到 IPC / 額外 stdio 的只有 Terminal Server `fork`（已退出）。

### 驗證

**單元測試（各平台）`child-process-fd-guard.test.ts`，29 tests**

- `guardChildSpawn`：
  - 非 Linux 不包裝；Linux 的形狀。
  - 參數原樣（空白、引號、`$(…)`、反引號、`--`、`-c`、空字串、換行），而且不進腳本。
  - `/usr/bin/bash` 退回；沒有 bash 時不包裝。
  - 找不到 / 不可執行 / 空字串的命令不包裝。
  - keep = stdio 數（4、6；小於 3 或 NaN → 3）；`CRASHDUMP_SIGNAL_FD`。
  - `BASH_ENV`（含空值）、`PWD` W / P、`SHLVL` 的 S（沒有 `/usr/bin/env` 時不加）。
  - `argv0` ≠ file；`envPairs` 未給；PTY / child guard 不重複包裝；`shell: true`。
- `resolveChildExecutable`：有斜線的路徑、PATH 順序、預設 PATH、空項目 = cwd、相對項目、結尾斜線。
- `installChildProcessFdGuard`（假 binding）：
  - 非 Linux 不要求任何 binding、不改、不記日誌；沒有 bash 不改。
  - 位置參數 async 與物件 sync 都包裝，stdio 物件是同一個，呼叫端的陣列 / 物件沒被改。
  - 找不到時原樣呼叫；`runWithoutChildProcessFdGuard` 可巢狀，例外後也會還原。
  - 不認得的形狀與 deps 例外時 fail open，每種只記一行；重複安裝被拒；uninstall 還原；沒有 binding 時不安裝。
- source guard（Q-1 條件）：`main.ts` 在 `fork(serverScript` 之前安裝，且兩個 fork 都退出；`bat-server.mjs` 的安裝在 `loadServerEntry` 之後、`applyHeadlessLoginShellPath?.(` 與 `createHeadlessServer(` 之前；`server-entry.ts` 匯出；Terminal Server 兩個檔都不安裝。T0755 既有的 `headless-login-path.test.ts` 在完整 unit 裡照常通過。

**Linux 實測（WSL Ubuntu 24.04，Node 26.13，bash 5.2.21）`child-process-fd-guard-linux.test.ts`，10 / 10**

- 本行程以 `PtyManager` direct 模式開兩個 bash（= headless 的同一條路），持有 2 個 `/dev/ptmx`。
- **反向對照**：安裝前子程序拿到 ≥ 2 個 master；`runWithoutChildProcessFdGuard` 內同樣拿到；git hook 在不包裝時也拿到 ≥ 2 個。
- 安裝後：spawnSync / execFileSync / execSync / execFile / exec / promisify(execFile) / spawn / fork(ipc) 都 0 個 master、stdio 以外沒有沒設 `O_CLOEXEC` 的 fd。`git commit` 執行的 pre-commit hook（repo 程式碼）也是 0。
- 額外 pipe 在 fd 3 寫得通；fork 的 IPC 回得了訊息，fd 3 仍是 socket。
- 與不包裝的 spawn 比對，3 種 env × 有沒有 `argv0`：pid = spawn 回報的 pid、ppid = 本行程，argv、cwd、env 都相同。env 情境：失效 PWD＋SHLVL＋OLDPWD、沒有 PWD / SHLVL、`BASH_ENV` 不被 source。唯一差異是文件寫明的 `argv0`＋沒有 SHLVL → `SHLVL=0`。
- PATH 找到的 shebang 腳本 argv / env 相同；exit code 7＋stdout / stderr、SIGTERM、`detached` 的 `kill(-pid)` 都與修正前相同。
- ENOENT（不存在的命令）、EACCES（不可執行）、cwd 不存在：sync 與 async 的錯誤物件（`code` / `syscall` / `path` / `spawnfile` / message）與修正前逐欄相同。

**e2e（WSL 打包 `electron-builder --linux dir`，版號 `0.0.0-t0807`，Electron 45.2.1，`xvfb-run`，`chromiumSandbox: true`，只開 shell 分頁）**

| 項目 | 結果 | 證據（摘要） |
|---|---|---|
| G1 安裝日誌 | PASS | debug log：`[child-fd-guard] installed (/bin/bash): child_process children keep only their stdio fds (BUG-206 / BUG-207)` |
| G2 主行程的子程序 | PASS | `spawn('sleep')`、`execFile('sleep')`：3 個 fd，fd ≥ 3 沒設 CLOEXEC 的 **0** 個（T0806 盤點修正前 49）。`execPath`＋`ELECTRON_RUN_AS_NODE`：沒設 CLOEXEC 的只有 v8 snapshot、eventpoll、eventfd（Electron 自己開的，乾淨啟動的同一執行檔也有，作參照比對）與 `CRASHDUMP_SIGNAL_FD` 的 socket（保留）；修正前 38。都沒有 `/dev/ptmx` |
| G3 反向對照 | PASS | 主行程本身 49 個沒設 CLOEXEC（socket 15、file 20、pipe 4、eventpoll 5、eventfd 4、inotify 1）。Terminal Server（不包裝的 fork）33 個，同 T0806 的數字，證明退出有效、量測抓得到繼承。shell 分頁 fd 只有 0–2＋255，執行指令正常 |
| T0806 F1–F6 不回歸 | PASS ×6 | F1–F4、F6、F5 全 PASS；F5 `app.close()` 25 ms、沒有殘留 crashpad。F6 中「保留 server 離開」那次 `app.close()` 不返回，同 T0806（PLAN-062 原題） |

- G2 第一次跑時判定式把 Electron-as-node 自己開的 fd 也算進去而 FAIL。改成和「乾淨啟動的同一執行檔」比對種類後 PASS（fd 編號每次不同，種類固定）。產品程式沒有改。

**headless 實體入口冒煙（WSL）**

- 以 esbuild 照 `build-server-bundle.mjs` 的方式（node24、cjs、外部套件不打包）打包 `server-entry.ts`。
- 以隔離 `--data-dir` 與 localhost 隨機 port 執行真的 `scripts/bat-server.mjs`，結果：
  - 輸出 `[child-fd-guard] installed (/bin/bash)…`。
  - `login shell PATH: applied (shell=/bin/bash, 93 ms …)`：login shell 的 detached spawn 經包裝照常運作。
  - `listening on 127.0.0.1:<port>`，SIGTERM 後 exit 0。

**關卡**

| 關卡 | 結果 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npm run test:unit`（Windows） | 第 1 次：11 檔失敗、385 檔通過，原因是 `beforeAll` hook 逾時 10 s ×10、ConPTY `AttachConsole failed` ×4、1 個 5 s 逾時，與 T0806 相同的高負載現象；那 11 檔單獨重跑 231 / 231 通過。第 2 次整體重跑：**396 passed、2 skipped、0 failed**（6940 tests passed） |
| `npm run test:legacy`（Windows） | 33 / 33 檔、472 / 472 tests passed |
| `npx vite build`（Windows） | exit 0；guard 在主行程 chunk（`main-*.js`），`terminal-server.js` 裡沒有 |
| 完整 vitest（WSL，`--no-file-parallelism`） | **395 passed、2 failed、1 skipped**。失敗的 2 檔是 `server-bundle-download-retry`「closed local port → ECONNREFUSED」與 `tls-fingerprint`「refused → unreachable」，WSL Mirrored 網路回 `ECONNRESET`，與 T0806 相同的環境因素，不碰 spawn。fd guard 4 檔全過 |

- Windows 測試時去掉了 `BAT_REMOTE_*` / `BAT_TERMINAL_ID` / `CT_*` 等連線變數，`BAT_USER_DATA` / `BAT_HELPER_LOG_DIR` 指到 scratchpad，與 CI 的環境一致，避免測試碰到正在使用的 BAT。
- WSL 完整 vitest 以暫存 `HOME` 執行，避開 BUG-208。

### 環境還原

| 項目 | 開始前（18:14:42） | 結束後（18:32:52） |
|---|---|---|
| `~/bat-build` | `ef6d06b81eabe2ca`，53196 項 | 相同 |
| `~/.codex/config.toml` | sha256 前 16 碼 `0772345e3306d8e0`，mtime 2026-10-19 11:48:52 | 相同 |
| `~/.config/BetterAgentTerminal` | `37879a04b8a39303`，3 項；`bat-scripts.log` 15 行、1726 bytes | 相同（暫存 HOME 有效，這次沒有寫入） |
| `~/.config/BetterAgentTerminal-runtime-*` | 0 | 0 |
| `~/.cache/electron` | 只有 `92de7e0b…` | 只有 `92de7e0b…`（本單下載的 zip 與 `fb82adfe…/` 已刪） |
| 本單的程序（e2e 的 `sleep 370x`、Electron-as-node、BAT 建置、bat-server 冒煙） | — | 0 |
| 使用者的 bat-server（`~/.local/bat-server`、docker `/opt/bat-server`） | 執行中 | 執行中。沒有停止、沒有連線；pid 變了是 WSL VM 閒置重開後隨開機自動起來 |

- 已刪除：WSL `~/t0807-tmp`（repo 副本、node_modules、Linux 建置、patchelf、報告、日誌、headless 打包），以及 `/tmp` 的 t0807 暫存。
- Windows worktree 的 `node_modules` / `dist-electron` 是 gitignored，`git status` 乾淨。
- 本機 Windows BAT 的 `%APPDATA%\BetterAgentTerminal\Logs\bat-scripts.log`：兩次 `test:unit` 期間，既有 helper 測試（BUG-208，T0808 處理）即使設了暫存 `BAT_USER_DATA` / `BAT_HELPER_LOG_DIR`，仍追加了 10 行。內容是 `bat-terminal` / `bat-notify` 的 `--version` / `--help`，只有 helper 名稱、pid、argv，沒有權杖。同時段的其他新增行是本 session 自己的 hook 紀錄。這個檔正被本機 BAT 持續寫入，同 T0806 **沒有清**，交塔台。本單新增的測試沒有呼叫 helper。
- `~/.npm/_cacache`：`npm ci` 會寫入，屬共用目錄、不在保護清單，沒有清。
- 本機 Windows 正在使用的 BAT 與它的 Terminal Server 完全沒碰。沒有 push 任何分支，也沒有觸發 workflow 或對外開 issue / PR。

### 遭遇問題

1. WSL VM 閒置重開會清空 `/tmp`，第一次背景建置的腳本因此不見；改把腳本放在 `~/t0807-tmp`。另外 Git Bash 經 `wsl.exe` 傳指令時，`$var` 會先在本機展開，改成用腳本檔執行。
2. Node 26 與 Node 24.22 的 `process_wrap` spawn 已經是位置參數，不是物件，第一版試寫的物件形攔截因此失敗。改成兩種形狀都支援，並對不認得的形狀 fail open。
3. Linux 實測第一版斷言 fork 子程序的 `NODE_CHANNEL_FD`，但 Node 子程序建好 channel 後會把它從 `process.env` 移除，所以斷言失敗。改成驗「IPC 有回應、fd 3 是 socket」。
4. e2e G2 第一版的判定式見〈驗證〉的 e2e 說明（只改測試）。
5. 塔台答覆 Q-1 時說已把兩檔加進 `affects_files`，工單檔裡確實有，但尚未 commit。本單收尾的工單 commit 會一起帶入，沒有另外改。

### 已知限制

- Terminal Server 本身（PLAN-062 方案 C）沒有處理。`early-path-fix` 的 login shell 在 guard 安裝前執行：當時沒有 master，只有 Chromium 的 fd，而且是短命程序。
- 常駐的舊 bat-server（systemd / launchd）與更新前就在跑的 BAT，要重啟後才會安裝 guard。
- `argv0` 選項與 `file` 不同、且原 env 沒有 `SHLVL` 時，子程序會收到 `SHLVL=0`（BAT 程式碼沒有用 `argv0`）。
- binding 形狀是 Node 內部細節。Node 改形狀時 guard 會退回不包裝並記一行，不會讓 spawn 失敗。升級 Electron / bundled node 時必跑 Linux 實測檔（CLAUDE.md 已寫）。
- 非目錄的 `OLDPWD`、匯出的 `SHELLOPTS` / `BASHOPTS` / `IFS` / `BASH_FUNC_*%%` 與 T0806 相同，會被改寫成等效值；env 匯出 `SHELLOPTS=xtrace` 時，包裝腳本的幾行會印到 stderr。

### 互動紀錄

- [18:00] 開工；`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`CT_HOME` 已設（worktree）；落點檢查 PASS；讀 T0806 回報區與 `pty-spawn-fd-guard.ts`。
- [18:03–18:10] 盤點呼叫點；在 WSL / Electron 實測 binding 形狀；實作 guard 與接線；`npm ci`。
- [18:10–18:20] 單元測試、Linux 實測（WSL 10 / 10）、e2e spec、Linux 建置。
- [18:20–18:27] 文件；e2e G1–G3、T0806 F1–F6；headless 冒煙；Windows 關卡。
- [18:27] Q-1: headless 安裝點放 `scripts/bat-server.mjs`、更新 README 索引列（不在 affects_files）是否接受 → A（塔台）: 「A：接受。scripts/bat-server.mjs main() 在 loadServerEntry 之後、applyHeadlessLoginShellPath 之前呼叫 serverEntry.installChildProcessFdGuard?.(…)，docs/agent-guide/README.md 只改 linux-pty-fd-inheritance 那一列；塔台已把兩檔加進 affects_files。條件：T0755 的既有 source guard 必須仍然通過；新增的安裝點也比照加 source guard；非 Linux 時 installChildProcessFdGuard 必須是 no-op（舊 server-entry 沒有這個匯出時 ?. 略過，行為不變）。」 → Action: 維持現行實作；三個條件逐一確認：`headless-login-path.test.ts` 在完整 unit 通過，新 source guard 與非 Linux no-op 測試已在 `child-process-fd-guard.test.ts`，`?.` 已寫。
- [18:28–18:33] 產品 commit `5e056b72`；WSL 完整 vitest；環境清理與事後快照。
- 塔台補充檢查：驗證前、產品 commit 前、寫回報前各查一次，沒有 `## 塔台補充` 段落。

### 子代理與 Workflow 使用

沒有使用。

### 方法論

本單沒有 `methodology` 欄位，也沒有 `### 方法論邊界`。啟動時沒有看到方法論注入，也沒有呼叫方法論 skill。

### Commit

- 產品：`5e056b72f21a3d4f1cd928389de0952310b5fea7`（`ct/T0807`，`fix(child-process): Linux child_process 子程序只保留 stdio fd (T0807, BUG-206, BUG-207)`），worktree 乾淨。
- 工單：在主 checkout 以 `git commit --only` 提交本檔（含塔台在 frontmatter 加的兩列 `affects_files`）。
- 未 push、未合併回 main。

### 後續（交塔台）

1. 合併 `ct/T0807` 回 main（`validated_sha` = `head_sha`）。BUG-206 / BUG-207 → FIXED；發版前維持不公開（D252 / D253）。
2. 發版後在真的 Linux 上驗收：`BAT_E2E_EXECUTABLE=<AppImage> xvfb-run -a npx playwright test e2e/linux/t0807-child-process-fds.spec.ts e2e/linux/t0806-pty-fd-inheritance.spec.ts`。headless 要重啟常駐的 bat-server，然後確認啟動輸出有 `[child-fd-guard] installed`。
3. CI（ubuntu-24.04）的 `test:unit` 會跑 `child-process-fd-guard-linux.test.ts`，它用到 `git`、`/bin/bash` 與真 node-pty；沒有 git 時 hook 那一項會跳過。
4. PLAN-062：Terminal Server 本身仍帶主行程的 fd（G3 實測 33 個），本單刻意不處理。
5. `%APPDATA%` 的 `bat-scripts.log` 多了 10 行測試紀錄（BUG-208），見〈環境還原〉。
