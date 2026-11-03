---
schema_version: 1
schema_kind: workorder
id: T0806
title: "BUG-205：Linux 上 PTY 子程序經 exec 包裝關掉 fd ≥ 3（不再繼承其他分頁的 pty master 與主行程描述元）；一併盤點 child_process 子程序的 fd 外流"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-03T17:08:46+0800"
started_at: "2026-11-03T17:11:05+0800"
updated_at: "2026-11-03T17:55:35+0800"
completed_at: "2026-11-03T17:55:35+0800"
session_ids:
  - "5838dbe6-3b80-4a0b-b2ea-9deac6c58683"
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
  - docs/agent-guide/linux-pty-fd-inheritance.md
  - docs/agent-guide/README.md
  - "electron/terminal-server/protocol.ts（塔台收單接受：`pty:created` 加選用欄位 `fdGuard`）"
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

- [x] consumer 清單與逐一不回歸判斷
- [x] 單元測試（Linux 套用 / 非 Linux 不變 / 參數與 argv0 保留 / 退回路徑）
- [x] typecheck 0 / 0、unit、legacy、vite build 綠
- [x] WSL 實測：兩個 shell 分頁 fd 只剩 0–2（＋255）、第 2 個分頁無 `/dev/ptmx`；背景 `setsid sleep` ＋「離開＋結束 Terminal Server」→ `app.close()` < 3 s、無殘留 crashpad
- [x] T0540 程序樹、⏻ 重啟、Recovery 等既有行為在 Linux 不回歸（e2e 或等效檢查，附證據）
- [x] child_process 子程序 fd 外流盤點表與建議
- [x] CLAUDE.md / docs 更新
- [x] 環境還原（WSL 暫存、隔離 userData 已刪；使用者 WSL 資料前後雜湊相同）；未 push 任何分支 —— 例外：`~/.config/BetterAgentTerminal` 內容已還原但 mtime 無法重現、雜湊不同；本機 Windows BAT 的 `bat-scripts.log` 被既有測試寫入 10 行未清（見回報區〈環境還原〉）

---

## 回報區

### 完成狀態

- **狀態**：FIXED（BUG 修正：實作與驗收關卡完成，等塔台合併與發版後的實機驗收）
- **結論一句話**：Linux 上 PTY 子程序改經固定的 bash 包裝啟動，exec shell 前關掉 fd ≥ 3。WSL 實測：分頁 shell 只剩 fd 0–2＋255，第 2 個分頁不再持有 `/dev/ptmx`；pid、argv、env、cwd 不變。背景 `setsid sleep` 留著時，「離開＋結束 Terminal Server」的 `app.close()` 49 ms，沒有殘留 crashpad。Windows / macOS 的 spawn 內容與日誌不變（單元測試守住）。
- **開始 / 完成時間**：2026-11-03T17:11:05+0800 → 2026-11-03T17:55:35+0800
- **session_id**：5838dbe6-3b80-4a0b-b2ea-9deac6c58683

### 落點檢查

- 結果：**PASS**
- C-0：工單 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` → PASS
- C-3：`affects_files` 的 `electron/terminal-server/server.ts`、`electron/pty-manager.ts`、`CLAUDE.md` 都在 worktree；新檔的上層目錄（`electron/`、`e2e/linux/`、`docs/agent-guide/`）都在 → present
- C-2：工單沒有 `branch` 欄位；目前分支 `ct/T0806`
- `CT_HOME` = 主 checkout（better-agent-terminal）、`CT_WORKTREE_BRANCH` = `ct/T0806`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### SHA

- `branch`：`ct/T0806`
- `base_sha`：`714fb5e98640ab0566f0048cc4137ad1cb924b8d`
- `validated_sha`：`524c9e103aa5a4203b35dbbf5363909c07a2ac03`
- `head_sha`：`524c9e103aa5a4203b35dbbf5363909c07a2ac03`
- 說明：完整關卡（Windows `test:unit` ×2、`test:legacy`、`vite build`，WSL 完整 vitest、e2e）跑在未 commit 的工作樹上。commit 後 `git status` 乾淨，WSL 副本與 worktree 的 7 個變更檔 SHA-256 逐一相同，所以那份工作樹內容就是 `524c9e10`。commit 後又在 HEAD 重跑兩個 typecheck（0 / 0）與 4 個相關測試檔（28 passed、3 skipped：Windows 上跳過 Linux 專用測試）。

### 實作

- **新增 `electron/pty-spawn-fd-guard.ts`**：純函式 `guardPtySpawnFds({ file, args, env }, { platform, fileExists })`，不 import electron、不碰 fs。
  - 非 Linux：直接回傳原物件，`reason: 'not-linux'`。
  - Linux：回傳 `/bin/bash -c <固定腳本> bat-pty-fd-guard <flags> <BASH_ENV 值> <原 file> <原 args…>`；`/bin/bash`、`/usr/bin/bash` 都沒有 → 原物件，`reason: 'no-bash'`。
- **腳本做的事**：
  1. 依 flags 還原 env：`B` 由 `$2` 還原 `BASH_ENV`；`P` 在原本沒有 `PWD` 時拿掉它；`S` 在原本沒有 `SHLVL` 時經 `/usr/bin/env -u SHLVL --` exec。
  2. 在函式內以 `local -`、`local GLOBIGNORE=` 跑迴圈：讀 `/proc/self/fd`，把 0–2 以外的 fd 用 `exec {fd}>&-` 關掉。bash < 4.1 跳過這步。
  3. `exec "$@"`。
- **為什麼這樣寫（實測得到的）**：直接 `bash -c '<關 fd>; exec -a "$0" "$@"'` 會改到 env——source `BASH_ENV`、原本沒有的 `PWD` / `SHLVL` 被補上；用 `--posix` 又會拿掉 `POSIXLY_CORRECT`。WSL 以 16 種 env 情境比對原 env 與子程序 env，最後的寫法只剩兩類差異：匯出的 `SHELLOPTS` / `BASHOPTS` 被改寫成等效值、`BASH_FUNC_*%%` 重新排版，對 shell 沒有影響（docs 有完整表）。argv 不用 `exec -a`：`exec "$@"` 的 argv[0] 就是原 `file`，與 node-pty（argv[0] = file）、child_process 相同。
- **接線**（三個 spawn 點）：
  - `electron/terminal-server/server.ts` `createPty`：新增 `TerminalServerDeps.fdGuard`（預設 `process.platform` + `fs.existsSync`）。Linux 的 `pty:created` 帶 `fdGuard: 'closed' | 'no-bash'`，其他平台送出的訊息與以前相同。
  - `electron/terminal-server/protocol.ts`：`pty:created` 加選用欄位 `fdGuard`。
  - `electron/pty-manager.ts`：direct `pty.spawn` 與 `child_process.spawn` fallback 都經 guard；`PtyManagerDeps.fdGuard` 讓測試替換。`handlePtyCreated` 在原本那行後面加 ` fd-guard=closed`，只在 server 有回報時加。只有 Linux 記 `[pty-fd-guard]` debug log，不記 env 值。`PtyManager` 存的、送給 server 的仍是原 shell / args，server 端才包裝，所以 recovery 重建時會再包裝一次。
- **文件**：CLAUDE.md 新增「Linux PTY 子程序只保留 fd 0–2（T0806 / BUG-205，D252）」一節（6 條），放在「Recovery 提示期間的 `pty:create`」前。新增 `docs/agent-guide/linux-pty-fd-inheritance.md`（規則、原因概述、包裝形狀、env 表、日誌、consumer 表、驗證、已知限制），並更新 `docs/agent-guide/README.md` 索引。沒有寫利用步驟。沒有改 CHANGELOG / release-note / README。

### 變更檔案

| 檔案 | 變更 |
|---|---|
| `electron/pty-spawn-fd-guard.ts` | 新增（唯一實作） |
| `electron/terminal-server/server.ts` | `createPty` 經 guard；`fdGuard` deps；`pty:created.fdGuard` |
| `electron/terminal-server/protocol.ts` | `pty:created` 加 `fdGuard?` |
| `electron/pty-manager.ts` | direct / fallback 經 guard；`fdGuard` deps；`logFdGuard`；`handlePtyCreated` 記錄 |
| `electron/__tests__/pty-spawn-fd-guard.test.ts` | 新增（18 tests，其中 2 個只在 Linux 跑真 bash） |
| `electron/__tests__/pty-spawn-fd-guard-linux.test.ts` | 新增（Linux 才跑：真 node-pty、direct 模式兩個 shell） |
| `e2e/linux/t0806-pty-fd-inheritance.spec.ts` | 新增（Linux e2e F1–F6） |
| `CLAUDE.md`、`docs/agent-guide/linux-pty-fd-inheritance.md`、`docs/agent-guide/README.md` | 文件 |

### consumer 清單與不回歸判斷（動工前列出）

| consumer | 依賴 | 判斷 | 證據 |
|---|---|---|---|
| T0540 `killProcessTree` / `endPty` / `PtyManager.kill` | shell pid | pid 不變（wrapper exec 成 shell）。`killProcessTree` 在 Linux 本來就回 `not-windows`；關分頁照舊由 node-pty 對 shell 送 SIGHUP | e2e F3：關 B 後 shell 與前景 `sleep 3601` 都結束；單元測試真 bash：pid = spawn 回報的 pid |
| `pty:list`、PTY registry、`killOrphanPtyProcesses` | 記錄的 pid | pid 不變 | e2e F1 / F4：`/proc` 找到的 shell pid = 日誌 `server spawned PTY <id> (pid N)`、parent = Terminal Server |
| Terminal Server recovery（T0704 `handleServerDeath`） | `shell` / `shellArgs` | 存的是原 shell，server 端重建時再包裝 | e2e F4：SIGKILL server → 新 server 重建 A，乾淨、`fd-guard=closed` |
| ⏻ 重啟（`pty:restart` / `restartOrCreatePty`） | 原 shell / args | 同上 | e2e F2 |
| Recovery 提示（T0578）／保留的 PTY | 存活 server | 「保留」不重建（pid 相同）；之後的新分頁由存活 server 經包裝 spawn | e2e F6 |
| `resolveDispatchShell` 的 shell family、`shell.includes('pwsh')` 等參數判斷 | 原 shell 字串 | 都在包裝之前、以原 shell 判斷 | 程式碼位置：`create()` 先算 args，spawn 當下才包裝 |
| `TerminalBlockedTracker`、hooks、`--close-worker`、Worker 歸屬 | hook 回報、`customEnv` | env 不變 | 單元測試真 bash：子程序 env 與原 env 逐項相同；PtyManager 接線測試：`BAT_TERMINAL_ID` 等照常傳入 |
| 縮圖 / 標題、codex OSC、`LaunchSuspectWatcher` | PTY 輸出 | 輸出路徑不變；包裝本身不輸出（只有 shell 找不到時，bash 印 `bat-pty-fd-guard: … not found`，見已知限制） | e2e 分頁正常輸出 |
| node-pty `IPty.process`（前景程序名） | — | BAT 沒有使用（grep 確認） | — |
| 既有 PtyManager / server 測試（mock 的 `ptySpawn` 斷言） | spawn 參數 | 沒有斷言 file / args 的既有測試；env 斷言用 `toMatchObject`，不受影響 | Linux 完整 vitest |

### 驗證

**單元測試（新增）**

- `pty-spawn-fd-guard.test.ts`：
  - 純函式：非 Linux 回傳同一物件；Linux 的形狀；參數原樣（空白、引號、`$`、`--`、`-l`、空字串）且不進腳本；`/usr/bin/bash` 退回；沒有 bash 時 `no-bash`；`BASH_ENV` 由 `$2` 還原；`PWD` / `SHLVL` flags；log 不含 env 值。
  - 接線：PtyManager node-pty（win32 / darwin 不變、Linux 包裝、沒有 bash 的退回）、Terminal Server 模式（送給 server 的是原 shell、`pty:created.fdGuard` 的日誌）、`child_process` fallback（Linux 包裝、darwin 不變）、Terminal Server `createPty`（Linux / win32 / darwin / 沒有 bash）。
  - Linux 真 bash：spawn 交給子程序的 fd（指向暫存檔）被關；pid / argv / cwd / env 相同；`PWD` / `SHLVL` 沒有、`BASH_ENV` 有時 env 仍相同，且 `BASH_ENV` 沒被 source。
- `pty-spawn-fd-guard-linux.test.ts`（Linux、真 node-pty）：PtyManager direct 模式開兩個 `bash -l -i`，兩個都只有 fd 0–2＋255、沒有 `/dev/ptmx`，argv = `['/bin/bash','-l','-i']`。
  - **反向對照**（WSL，暫時把 guard 換成 darwin、不 commit）：測試失敗，`shell b … {"fd":22,"target":"/dev/ptmx"}`，代表這個測試抓得到漏洞。

**關卡**

| 關卡 | 結果 |
|---|---|
| `npm run typecheck` | 0（工作樹與 HEAD 各一次） |
| `npm run typecheck:electron` | 0（同上） |
| `npm run test:unit`（Windows） | 第 1 次：11 檔失敗、384 檔通過，全部是 RemoteServer / headless harness 的 `beforeAll` hook timeout（10 s）；那 11 檔單獨重跑 231 / 231 通過。第 2 次整體重跑：**395 passed、1 skipped、0 failed**（6911 tests passed） |
| `npm run test:legacy`（Windows） | 33 / 33 檔、472 / 472 tests passed |
| `npx vite build`（Windows） | exit 0；`dist-electron/terminal-server.js` 與 main chunk 都含 guard |
| 完整 vitest（WSL Ubuntu 24.04，等同 CI 的 Linux） | 平行跑：18 檔失敗，全是 hook timeout，加上 2 個網路測試。`--no-file-parallelism` 循序重跑：**393 passed、2 failed**。剩下 2 個是 `tls-fingerprint`「refused → unreachable」與 `server-bundle-download-retry`「closed local port → ECONNREFUSED」：WSL `networkingMode=Mirrored` 下連關閉的 localhost port 回 `ECONNRESET`，兩個檔都不碰 PTY，屬環境因素 |

**Linux e2e（WSL Ubuntu 24.04）**

- 受測：本分支在 WSL 暫存目錄 `npm ci` → `npx vite build` → `npx electron-builder --linux dir`（版號 `0.0.0-t0806`），執行檔 `release/linux-unpacked/BetterAgentTerminal`。`patchelf` 用 `apt download` 解到暫存目錄、只加進該次建置的 PATH，沒有安裝。
- 環境：kernel 6.18.33.2-microsoft-standard-WSL2、bash 5.2.21、`xvfb-run`、`chromiumSandbox: true`。隔離 runtime，只開 shell 分頁（L185）。

| 項目 | 結果 | 證據（摘要） |
|---|---|---|
| F1 兩個 shell 分頁 | PASS | B（pid 1789）在 A（1634）執行中 spawn。兩者 fds 都是 `0,1,2,255` → `/dev/pts/N`，沒有 `/dev/ptmx`；parent = Terminal Server 1524；argv `["/bin/bash","-l","-i"]`；日誌 `server spawned PTY … fd-guard=closed`。Terminal Server 自己持有 2 個 `/dev/ptmx`，所以真的有漏也看得到 |
| F2 ⏻ 重啟 | PASS | A 新 pid 1940，乾淨；B 仍乾淨 |
| F3 關分頁的程序樹 | PASS | B 的前景子程序 `sleep 3601` 只有 fd 0–2；關 B 後 shell 與 sleep 都結束 |
| F4 Terminal Server recovery | PASS | SIGKILL server 1524 → 新 server 2092 重建 A（pid 2103），乾淨；舊 shell 已結束 |
| F6 保留 server 重開＋Recovery「保留」 | PASS | 重開後 A 仍是 pid 2103、乾淨；存活 server 新開的分頁 C（2580）乾淨，這時 server 持有 3 個 master |
| F5 背景程序＋「離開＋結束 Terminal Server」 | PASS | `setsid sleep 3602` 的 fd 只有 0–2（都是 `/dev/null`）；`app.close()` **49 ms**（T0805 修正前：24 s 逾時）；1 秒後這個建置的程序 0 個（含 crashpad）；Terminal Server 已結束 |

- F1–F5 第一次跑（沒有 F6）也全 PASS（`app.close()` 48 ms）。
- F6 的「保留 server 離開」那次，`app.close()` 20 s 內沒有返回、由測試結束程序。這是 PLAN-062 原題（保留 Terminal Server 時 server 本身是 crashpad client，T0805 方案 C），不在本單範圍，也與修正前相同。F5 前看得到 2 個 crashpad（第一次啟動的那個被保留的 server 卡住），結束 server 後兩個都結束。
- direct 模式：產品沒有開關（`useServer` 只看 server 連線）。改以 Linux 真 node-pty 單元測試（上面的 `pty-spawn-fd-guard-linux.test.ts`）驗證 PtyManager direct 分支；headless 用同一個 `PtyManager`。
- AppImage target 沒有另外建、也沒有測（工單允許 `--dir`）。guard 與打包格式無關，AppImage runtime 多出的 keepalive pipe 也是 fd ≥ 3，一樣會被關（推論）。

### child_process 子程序 fd 外流盤點（只查不修）

方法：同一個 WSL 隔離實例（e2e 用的建置），以 `app.evaluate` 在主行程用 `child_process` 起 3 個代表性子程序，加上 Terminal Server，只讀 `/proc/<pid>/fd`、`fdinfo` 的 flags 與 environ 的變數名稱。另外以 node＋本分支的 `@lydell/node-pty` 模擬 headless / direct 的宿主。暫存腳本不 commit，已刪除。

| 子程序（代表） | 對應的實際用途 | fd ≥ 3 | 沒有 CLOEXEC | 內容（分類） | crashpad env |
|---|---|---|---|---|---|
| `child_process.spawn('sleep')` | git、gh、claude CLI、codex、各種 spawn | 49 | **49** | socket 15、pipe 4、eventpoll 5、eventfd 4、inotify 1、app 資源（.pak / .bin / asar）8、userData 的 leveldb / GPUCache 11（含寫入 fd）、Dictionaries 1 | 無 |
| `child_process.execFile('sleep')` | `execFile` 類（git、版本偵測…） | 49 | **49** | 同上 | 無 |
| `spawn(process.execPath)` ＋ `ELECTRON_RUN_AS_NODE=1` | Claude SDK fallback、語音檢查子程序 | 71 | **38** | 同類（Node 啟動後自己開的有 CLOEXEC） | `CRASHDUMP_SIGNAL_FD`、`CRASHPAD_HANDLER_PID` |
| Terminal Server（`fork`） | — | 68 | 33 | 同類（T0805 已盤點） | 同上 |
| headless / direct 宿主（node＋2 個 node-pty PTY）的 `child_process.spawn('sleep')` | headless bat-server 起的 claude CLI（Claude 面板）、git 等 | 2 | 2 | **2 個 `/dev/ptmx`（兩個分頁的 master）** | — |

- 主行程（Electron）此時共有 49 個沒有 CLOEXEC 的 fd，Playwright 啟動時多 DevTools / 管線。用 `child_process` 起的子程序全部拿到。
- 長時間執行的子程序（claude CLI、codex）用自己的 `child_process` 再起子程序（例如 agent 的 Bash 工具），這批 fd 會一路傳下去（推論，同一機制）。
- headless / direct 模式：宿主持有各分頁的 master（node-pty 不設 CLOEXEC），所以 bat-server 起的每個 `child_process` 子程序都拿到所有分頁的 master。這和 BUG-205 是同一類問題（不需權杖就能對分頁送輸入），只是走的是 child_process 子程序而不是 PTY 子程序。Electron 的 Terminal Server 模式下，master 在 server，主行程沒有，所以不受這點影響。
- **建議**：另開一張 BUG（建議 P2），範圍是「headless / direct 宿主的 child_process 子程序繼承 pty master」，加上「Electron 主行程的 child_process 子程序繼承 Chromium fd」（P3）。修法方向（未實作、未驗證）：
  - 方案 B（上游 PR #986：master 設 CLOEXEC）可以解掉 master 那部分。
  - Chromium 那批 fd 需要對長時間執行的子程序（claude CLI、codex）套類似的 exec 包裝，或在 spawn 前設 CLOEXEC（Node 沒有 fcntl，要 native 或包裝）。
  - 短命的 git / `execFile` 影響小，可不處理。
- 本單沒有擴大修正範圍。

### 環境還原

| 項目 | 開始前（17:25:15） | 結束後（17:48） |
|---|---|---|
| `~/bat-build` | `5bc47cbf8d0639f8`，53196 項 | `5bc47cbf8d0639f8`，53196 項（未變） |
| `~/.codex/config.toml` | sha256 前 16 碼 `0772345e3306d8e0`，mtime 2026-10-19 11:48:52 | 相同 |
| `~/.config/BetterAgentTerminal` | `719d9318bb56913d`，3 項 | 內容已還原，但雜湊不同（`8e5e8b4e57f7e127`），原因見下 |
| `~/.config/BetterAgentTerminal-runtime-*` | 0 | 0 |
| `/proc/mounts` 的 `mount_B*` | 0 | 0 |
| BAT / terminal-server / crashpad / 測試的 `sleep 36xx` 程序 | 0 | 0 |
| 使用者的 bat-server（`~/.local/bat-server`、docker `/opt/bat-server`） | 執行中 | 執行中（沒有停止、沒有連線；pid 變了是 WSL VM 閒置重開後隨開機自動起來，同 T0805 備註） |

- `~/.config/BetterAgentTerminal` 的差異：WSL 完整 vitest（兩次）期間，**既有**測試 `scripts/__tests__/server-bundle-helpers.test.mjs` 對 `bat-terminal.mjs` / `bat-notify.mjs` 執行 `--version`，env 只去掉 `BAT_*`、`HOME` 是真的（還有幾個 `--help` 測試），helper 退回舊推測位置，往 `Logs/bat-scripts.log` 追加了 10 行（ts `2026-11-03T09:40`–`09:45Z`）。這個檔原本就有同類紀錄（2026-10-21、10-25，前人的測試跑出來的）。
  - 處理：只刪掉時間戳在本單執行時段的那 10 行，剩下原本的 15 行（1726 bytes），mtime 設回最後一行的時間戳（2026-10-25T13:51:03.086Z）。
  - 原始 mtime 的小數部分無法重現（窮舉 .086–.120 s 沒有命中），所以雜湊不同；內容是原本那 15 行。
  - 同一批測試在 Windows 的 `npm run test:unit`（工單規定的關卡）也寫進了本機正在使用的 BAT 的 `%APPDATA%\BetterAgentTerminal\Logs\bat-scripts.log`：唯讀確認，本單執行時段內 argv 為 `--version` / `--help` 的紀錄有 10 筆（2 次 × 5 筆），只有 helper 名稱、pid、argv，沒有權杖。那個檔正被本機 BAT 與其他分頁的 helper 持續寫入，同時改寫可能吃掉別人追加的行，所以**沒有清**，交塔台決定。
- 已刪除：
  - WSL `~/t0806-tmp`（repo 副本、node_modules、Linux 建置、patchelf、日誌、e2e 報告）。
  - 本單下載到 `~/.cache/electron/` 的 `electron-v45.2.1-linux-x64.zip` 與 `fb82adfe…/`，原有的 `92de7e0b…/` 保留。
  - Windows scratchpad 的暫存腳本，會在 commit 前刪除。
- `~/.npm/_cacache`：`npm ci` 會寫入，屬共用目錄、不在保護清單，沒有清。
- 本機 Windows 正在使用的 BAT 與它的 Terminal Server 完全沒碰。
- 沒有 push 任何分支，也沒有觸發任何 workflow、沒有對外開 issue / PR。

### 遭遇問題

1. 第一版腳本（`bash -c '…; exec -a "$0" "$0" "$@"'`）在 WSL 比對 env 時發現：`BASH_ENV` 會被 source、原本沒有的 `SHLVL` 變成 `0`、`PWD` 被補上；改用 `--posix` 又會拿掉 `POSIXLY_CORRECT`。改成 flags＋`/usr/bin/env -u SHLVL`＋函式內 `local` 的寫法，16 種情境重測後只剩對 shell 等效的差異。
2. 經 `wsl.exe -- bash -lc '…'` 傳指令時，`$PATH` / `$HOME` 被提前展開，第一次建置失敗。改成寫腳本檔再執行。
3. WSL 沒有 `patchelf`，Linux 打包的 `afterPack`（T0800）需要它。用 `apt download` 解到暫存目錄，不安裝。
4. Linux 真 node-pty 測試第一次的反向對照因為 5 s 預設 timeout 而失敗（不是斷言失敗）。加上 60 s 的 test timeout 後，反向對照得到預期的 `/dev/ptmx` 斷言失敗。
5. 完整測試在高負載下有 RemoteServer / headless harness 的 hook timeout（Windows 第 1 次、WSL 平行跑），重跑都通過，見「驗證」。
6. 既有測試把紀錄寫進使用者 WSL 的 `~/.config/BetterAgentTerminal/Logs/bat-scripts.log`（已移除本單寫入的行）與本機 Windows BAT 的 `bat-scripts.log`（10 行，沒有清），見「環境還原」。

### 已知限制

- 更新前就在跑的舊 Terminal Server（T0108，跨 BAT 更新存活）不包裝，要等它結束、由新版 fork 新的 server。
- 沒有 `/bin/bash` 與 `/usr/bin/bash`（例：NixOS）→ 不包裝，記一行 log。bash < 4.1 → 不關 fd。沒有 `/usr/bin/env` → 原本沒有 `SHLVL` 時 shell 收到 `SHLVL=0`。
- shell 路徑不存在時，錯誤訊息從 node-pty 的 `execvp(3) failed.`（exit 1）變成 bash 的 `bat-pty-fd-guard: line <n>: exec: <shell>: not found`（exit 127）。
- env 匯出 `SHELLOPTS=xtrace` / `verbose` 時，包裝腳本的幾行會被追蹤印到分頁裡。
- PLAN-062 原題（保留 Terminal Server 時 crashpad 卡住主行程 stdio）不在本單範圍，e2e F6 也觀察到。

### 互動紀錄

- [17:11] 開工；`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`CT_HOME` 已設（worktree）；落點檢查 PASS；讀 `_local-rules.md`、BUG-205、T0805 全文。
- [17:12–17:20] 盤點 spawn 點與 consumer；在 WSL 以 python harness 試做包裝腳本（fd、env 16 種情境、argv、pid）。
- [17:20–17:28] 實作 guard＋接線；單元測試；WSL `npm ci`；WSL 跑新測試＋反向對照。
- [17:28–17:40] WSL 建 Linux 版；寫 e2e，F1–F5 PASS，再加 F6 全 PASS；child_process 盤點。
- [17:40–17:51] 文件；Windows 關卡（unit ×2、legacy、vite build、typecheck）；WSL 完整 vitest；環境清理與事後快照；產品 commit `524c9e10`；在 HEAD 重跑 typecheck 與相關測試。
- 塔台補充檢查：驗證前、產品 commit 前、寫回報前各查一次，沒有 `## 塔台補充` 段落。
- 沒有向塔台提問。

### 子代理與 Workflow 使用

沒有使用。

### 方法論

本單沒有 `methodology` 欄位，也沒有 `### 方法論邊界`。啟動時沒有看到方法論注入，也沒有呼叫方法論 skill。

### Commit

- 產品：`524c9e103aa5a4203b35dbbf5363909c07a2ac03`（`ct/T0806`，`fix(pty): Linux PTY 子程序不再繼承多餘描述元 (T0806, BUG-205)`），worktree 乾淨。
- 工單：在主 checkout 以 `git commit --only` 提交本檔（hash 見 git log，本回報寫在那次 commit 之前）。
- 未 push、未合併回 main（交塔台依 merge-workorder 處理）。

### 後續（交塔台）

1. 合併 `ct/T0806` 回 main（`validated_sha` = `head_sha`）。BUG-205 → FIXED，修正發版前維持不公開（D252）。
2. 發版後在真的 Linux（AppImage / deb）上驗收：兩個分頁 `ls -l /proc/$$/fd` 只剩 0–2、255；背景 `setsid sleep` ＋「離開＋結束 Terminal Server」能立即結束。可直接以 `BAT_E2E_EXECUTABLE=<AppImage> xvfb-run -a npx playwright test e2e/linux/t0806-pty-fd-inheritance.spec.ts` 跑。
3. 建議另開 BUG：headless / direct 宿主的 child_process 子程序（Claude 面板的 claude CLI、git 等）繼承所有分頁的 pty master（P2）；Electron 主行程的 child_process 子程序繼承 Chromium fd（P3）。見「child_process 子程序 fd 外流盤點」。
4. 測試衛生（建議小單）：`scripts/__tests__/server-bundle-helpers.test.mjs` 等呼叫 helper `--version` / `--help` 的測試沒有把 `BAT_USER_DATA` / `BAT_HELPER_LOG_DIR` 指到暫存目錄，Linux 會寫進 `~/.config/BetterAgentTerminal/Logs/bat-scripts.log`，Windows 會寫進 `%APPDATA%\BetterAgentTerminal\Logs\bat-scripts.log`（兩邊本單都實測到；違反 CLAUDE.md「helper 測試須設 BAT_HELPER_LOG_DIR / BAT_USER_DATA 到 temp」）。
5. PLAN-062：e2e F6 再次觀察到原題（保留 server 時 `app.close()` 不返回）；本單已解掉「背景程序讓 crashpad 留著」的變體（F5）。
