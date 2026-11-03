# Linux PTY 子程序只保留 fd 0–2（T0806 / BUG-205，D252）

用途：Linux 上 BAT 開的每個 PTY 子程序（分頁的 shell）只保留標準輸入 / 輸出 / 錯誤（fd 0–2），不再繼承 Electron 主行程、Terminal Server 的描述元，也不再拿到比它早開的分頁的 pty master。Windows、macOS 的行為與日誌不變。

## 必守規則

- 🔴 只有 Linux（`process.platform === 'linux'`）套用；Windows / macOS 傳給 `spawn` 的檔案、參數、env 物件與 T0806 前完全相同（`guardPtySpawnFds` 直接回傳原物件），日誌也不多一行。
- 🔴 唯一實作 `guardPtySpawnFds`（`electron/pty-spawn-fd-guard.ts`，純函式、不 import electron、不碰 fs，`platform` / `fileExists` 由呼叫端傳入）。三個 spawn 點都經它：Terminal Server `createPty`（`electron/terminal-server/server.ts`）、`PtyManager` direct 分支的 `pty.spawn` 與它的 `child_process.spawn` fallback（`electron/pty-manager.ts`）。headless bat-server 用同一個 `PtyManager`，不另寫。🔴 新增 PTY spawn 路徑一律經它。
- 🔴 包裝不得改變既有行為：
  - pid 不變：包裝的 bash 最後 `exec` 成原本的命令，node-pty / child_process 回報的 pid 就是 shell。
  - argv 不變：argv[0] 是呼叫端給的 `file`（與 node-pty / child_process 原本一樣），參數原樣（含 `-l`、`-i`、空白、引號、`$`、空字串）；它們是位置參數，從不被 shell 解析。
  - env 不變：見下節「env」；cwd 不變（包裝不 `cd`）。
  - 只保留 fd 0–2。
- 🔴 安全：包裝腳本是固定字串（`PTY_FD_GUARD_SCRIPT`），shell 路徑與參數只以位置參數傳入，以陣列交給 `spawn`（CLAUDE.md「Child Process Spawning」）。日誌不記 env 值與權杖。
- 包裝用的 bash 依序找 `/bin/bash`、`/usr/bin/bash`；都沒有（例：NixOS）→ 照舊直接 spawn，記一行 debug log（見「日誌」）。
- Terminal Server 存活跨 BAT 更新（T0108）：更新前就在跑的舊 server 不會包裝，直到它結束、新版 fork 新的 server 為止（選「離開＋結束 Terminal Server」或重開機）。

## 為什麼會繼承（原因概述，T0805）

1. Chromium 主行程開的檔案與 socket 不設 `FD_CLOEXEC`（它自己起子程序時在子程序端關）。
2. libuv（Node `child_process`）在 Linux 以 fork＋exec 起子程序、不關多餘 fd，所以 `fork(terminal-server.js)` 把它們全帶進 Terminal Server。
3. `@lydell/node-pty` 1.1.0 在 Linux 以 `forkpty`＋`execvp` 起 shell，子程序端不關 fd，而且它開的 pty master 不設 `FD_CLOEXEC`，所以後開的分頁帶走前面分頁的 master。上游 1.2.0-beta 的修正遇到 fd 缺號就停，在 BAT 的 fd 分布下仍漏（T0805 實測），所以 BAT 自己處理（方案 A，D252）。

Windows（ConPTY，handle 預設不可繼承）與 macOS（`posix_spawn` + `POSIX_SPAWN_CLOEXEC_DEFAULT`）不受影響（T0805 推論），所以不套用。

## 包裝的形狀

```
/bin/bash -c <PTY_FD_GUARD_SCRIPT> bat-pty-fd-guard <flags> <BASH_ENV 值> <原 file> <原 args…>
```

- `bat-pty-fd-guard` 是 bash 的 `$0`，bash 自己的錯誤訊息以它開頭（例：shell 不存在時 `bat-pty-fd-guard: line <n>: exec: <shell>: not found`，exit 127）。
- 腳本：依 flags 還原 env（下節）→ 讀 `/proc/self/fd`，把 0、1、2 以外的編號用 `exec {fd}>&-` 關掉 → `exec "$@"`。
- 關 fd 的迴圈在函式裡以 `local -`、`local GLOBIGNORE=` 執行：env 若匯出了 `SHELLOPTS=…noglob…` 或 `GLOBIGNORE`，迴圈仍看得到 `/proc/self/fd` 的每一項，且匯出的值不變。
- `{fd}>&-` 需要 bash ≥ 4.1；更舊的 bash 跳過迴圈、只 `exec`（fd 不關，但分頁照常開）。

## env

包裝的 bash 會動到幾個 env，`guardPtySpawnFds` 與腳本處理掉會造成差異的部分（WSL 實測：bash 5.2.21，原 env 與 shell 收到的 env 逐項比對）：

| 變數 | bash 原本會做的 | 處理 |
|---|---|---|
| `BASH_ENV` | 非互動 bash 會先 source 它（執行使用者的檔案、可能有輸出） | 不放進包裝的 env；以 `$2` 傳入，腳本 `export BASH_ENV="$2"` 還原（flag `B`） |
| `PWD`（原本沒有） | bash 補上 `PWD=<cwd>` | 腳本 `unset PWD`（flag `P`） |
| `SHLVL`（原本沒有） | bash 的 `exec` 匯出 `SHLVL=0` | 經 `/usr/bin/env -u SHLVL --` exec（flag `S`；沒有 `/usr/bin/env` 時不加，shell 收到 `SHLVL=0`，用 SHLVL 的 shell 都把 0 與沒有當成 1） |
| `SHLVL`（原本有） | 啟動 +1、`exec` −1 | 不需處理，值相同 |
| `POSIXLY_CORRECT` | 不動 | — |

不處理、但對 shell 沒有差別的：

- `_`（bash 拿掉，各 shell 自己設）。
- 失效的 `PWD` / `OLDPWD`：bash 改成實際 cwd、拿掉失效的 `OLDPWD`，與 bash / zsh / dash 啟動時自己做的一樣。
- 匯出的 `IFS`：bash 一律重設，POSIX shell 啟動時也重設。
- 匯出的 `SHELLOPTS` / `BASHOPTS`：bash 改寫成「bash 預設值＋原值」，對同版 bash 等效。
- `BASH_FUNC_*%%`：函式文字重新排版，語意相同。
- 已知限制：env 匯出 `SHELLOPTS=xtrace`（或 `verbose`）時，包裝腳本自己的幾行也會被追蹤印到分頁裡。

## 日誌

- Terminal Server 模式：server 的 stderr 沒有接（`stdio: 'ignore'`），所以 Linux 的 server 在 `pty:created` 帶 `fdGuard: 'closed' | 'no-bash'`，主行程記在原本那行後面：`[PtyManager] server spawned PTY <id> (pid <pid>) fd-guard=closed`；`no-bash` 另記一行 `[pty-fd-guard] Terminal Server PTY <id>: no bash at /bin/bash / /usr/bin/bash; …`。Windows / macOS 的 server 不帶這個欄位，日誌與 T0806 前相同；舊 server 也不帶。
- direct / fallback：`[pty-fd-guard] node-pty <id>: /bin/bash closes inherited fds >= 3, then execs <shell>`（`child_process` fallback 同格式）；沒有 bash 時 `[pty-fd-guard] node-pty <id>: no bash at …; spawning <shell> directly, inherited fds stay open (BUG-205)`。

## 不受影響的 consumer（T0806 逐一確認）

| consumer | 依賴 | 結論 |
|---|---|---|
| T0540 `killProcessTree` / `endPty`、`PtyManager.kill` | shell pid | pid 不變；`killProcessTree` 在 Linux 本來就不做事（只 Windows），關分頁照舊由 node-pty 對 shell 送 SIGHUP。e2e F3：分頁關閉後 shell 與它的前景子程序都結束 |
| `pty:list`、PTY registry、`killOrphanPtyProcesses`、Terminal Server recovery | 記錄的 pid、`shell` / `shellArgs` | pid 不變；`PtyManager` 存的、送給 server 的都是原本的 shell / args（server 端才包裝），recovery 重建時再包裝一次。e2e F4 |
| ⏻ 重啟（`pty:restart` / `restartOrCreatePty`） | 原 shell / args | 同上，新 shell 一樣經包裝。e2e F2 |
| Recovery 提示（T0578）／保留的 PTY | 存活 server 的 PTY | 「保留」後 PTY 不重建（pid 相同）；之後的新分頁由存活的 server 經包裝 spawn。e2e F6 |
| `resolveDispatchShell` / shell family、`shell.includes('pwsh')` 等參數判斷 | 原 shell 字串 | 都在包裝之前、以原 shell 判斷，包裝只在 spawn 當下 |
| `TerminalBlockedTracker`、hooks、`LaunchSuspectWatcher`、codex OSC、縮圖 / 標題 | PTY 輸出、hook 回報、env | 輸出與 env 不變 |
| `--close-worker`、Worker 歸屬 | `customEnv` 的 `BAT_TOWER_TERMINAL_ID` | env 不變 |
| node-pty `IPty.process`（前景程序名） | — | BAT 沒有使用 |

## 驗證

- 單元測試：`electron/__tests__/pty-spawn-fd-guard.test.ts`（純函式：Linux 套用 / 非 Linux 原物件 / 參數與 argv0 原樣 / 沒有 bash 的退回 / `BASH_ENV`、`PWD`、`SHLVL` flags；`PtyManager` 與 Terminal Server 的接線；Linux 才跑的真 bash：spawn 交給子程序的 fd 被關、pid / argv / cwd / env 相同）。`electron/__tests__/pty-spawn-fd-guard-linux.test.ts`（Linux 才跑，真 node-pty：direct 模式兩個 shell 都沒有 `/dev/ptmx`、fd 只有 0–2＋255；不包裝時第 2 個 shell 持有第 1 個的 master，T0806 實測）。CI（ubuntu-24.04）會跑這兩個檔的 Linux 部分。
- e2e：`e2e/linux/t0806-pty-fd-inheritance.spec.ts`，對打包的 Linux 版（`BAT_E2E_EXECUTABLE` = AppImage 或 `release/linux-unpacked/BetterAgentTerminal`）跑 F1–F6：
  - F1：兩個 shell 分頁都只有 fd 0–2＋255、沒有 `/dev/ptmx`，Terminal Server 自己持有兩個 master。
  - F2：⏻ 重啟。
  - F3：關分頁時程序樹照舊結束。
  - F4：Terminal Server recovery。
  - F6：保留 server 重開＋Recovery「保留」＋存活 server 開新分頁。
  - F5：背景 `setsid sleep` ＋「離開＋結束 Terminal Server」→ `app.close()` < 3 s、沒有殘留 crashpad。
  - 報告寫到 `LINUX_REPORT_DIR`（`t0806-report.md` / `.json`）。只開 shell 分頁（L185）。
  - 本機 WSL：`xvfb-run -a npx playwright test e2e/linux/t0806-pty-fd-inheritance.spec.ts`。打包 Linux 版需要 `patchelf`（`apt download patchelf` 解到暫存目錄、加進 PATH 即可，不必安裝）。

## 已知限制

- `child_process` 子程序（git、gh、claude CLI / Agent SDK、codex、`execFile` 類）的同類問題由 T0807 處理，見下方「child_process 子程序只保留 stdio」。Terminal Server 本身仍收到主行程沒有 `FD_CLOEXEC` 的描述元（PLAN-062 方案 C，不在 T0806 / T0807 範圍）。
- 「保留 Terminal Server」時主行程 stdio 被 crashpad 卡住（PLAN-062 原題）不由本修正解決：Terminal Server 本身就是 crashpad 的 client（T0805 方案 C）。本修正解決的是「背景程序讓 crashpad 留著」的變體。
- 沒有 `/proc`（極少見）時迴圈找不到任何項目，fd 不關。

---

# child_process 子程序只保留 stdio（T0807 / BUG-206 / BUG-207，D253）

用途：Linux 上 BAT 主行程與 headless bat-server 以 `child_process` 起的每個子程序（git、gh、claude CLI 與 Claude Agent SDK、codex、ssh、版本偵測…）只保留自己的 stdio fd，不再繼承：

- BUG-206：headless bat-server 與 Electron direct 模式持有各分頁的 pty master（node-pty 不設 `FD_CLOEXEC`），子程序原本全部拿到；git hook 這類會執行 repo 內程式碼的子程序也一樣。
- BUG-207：Electron 主行程的子程序原本繼承 Chromium 約 49 個沒有 `FD_CLOEXEC` 的描述元（socket、pipe、eventfd、app 資源、userData 的 leveldb / GPUCache 等），長時間執行的 claude CLI / codex 再傳給它們起的程序。

Windows、macOS 不安裝，行為與日誌不變。

## 必守規則（child_process）

- 🔴 只有 Linux 安裝；`installChildProcessFdGuard` 在其他平台直接回 `not-linux`，不碰任何 binding、不記日誌（單元測試守住）。
- 🔴 唯一實作 `electron/child-process-fd-guard.ts`：純函式 `guardChildSpawn` / `resolveChildExecutable`（不 import electron、不碰 fs），安裝 `installChildProcessFdGuard`、退出 `runWithoutChildProcessFdGuard`。呼叫端不內聯、不逐點改 spawn。
- 🔴 安裝點只有兩個：`electron/main.ts`（模組層，`handOffEarlyCrashCapture()` 之後、任何 spawn 之前）與 `scripts/bat-server.mjs` `main()`（`loadServerEntry` 之後、`applyHeadlessLoginShellPath` 之前，經 `server-entry` 匯出）。Terminal Server 行程不安裝。新的 BAT 行程若會持有 pty master 或起長時間子程序，也要安裝。
- 🔴 Terminal Server 的兩個 `fork`（`startTerminalServer` / `reforkTerminalServer`）包在 `runWithoutChildProcessFdGuard` 裡：server 本身的描述元屬 PLAN-062 方案 C，不在本單。
- 🔴 攔截點是 libuv 的兩個入口：`process.binding('process_wrap').Process.prototype.spawn`（spawn / execFile / exec / fork，含第三方程式碼如 Claude Agent SDK 內部的 spawn）與 `process.binding('spawn_sync').spawn`（spawnSync / execFileSync / execSync）。沒有改 `node_modules`、沒有改 SDK 的 spawn 選項。
- 🔴 binding 的呼叫形狀是 Node 內部細節（Node 24.22 / 26.13 實測：async 是位置參數 `spawn(file, args, cwd, envPairs, stdio, flags, uid, gid)`、sync 是物件 `spawn(options)`；舊版的物件形 async 也支援）。不認得的形狀 → 原樣 spawn＋記一行日誌（fail open，不讓 spawn 失敗）。升級 Electron（Node）或 bundled node 時必跑 `electron/__tests__/child-process-fd-guard-linux.test.ts`。
- 🔴 包裝不得改變既有行為（WSL 實測，見「驗證（child_process）」）：
  - 保留 fd 0 … stdio 數−1（標準 stdio、額外的 `pipe`、`fork` 的 IPC channel）；子程序 env 的 `CRASHDUMP_SIGNAL_FD` 指到的 fd 也保留（`ELECTRON_RUN_AS_NODE` 子程序的 crash 回報照舊）。
  - pid 不變（包裝 `exec` 成原命令）；argv 不變（argv[0] = `argv0` 選項或 `file`，經 `exec -a`）；執行的檔案是 libuv 會選的那個（`resolveChildExecutable` 依 libuv `uv__execvpe` 的順序在子程序 env 的 PATH 找，沒有 PATH 用 `/usr/bin:/bin`，空項目 = cwd）。
  - 找不到或不可執行的命令**不包裝**：`spawn` 照舊回 ENOENT / EACCES（錯誤的 `code` / `syscall` / `path` / `spawnfile` / message 與修正前相同），也沒有程序可以繼承任何東西。
  - cwd、uid / gid、`detached`（setsid、`process.kill(-pid)`）、stdio、timeout、kill 訊號、exit code、stdout / stderr 都是 libuv 原本的處理。
  - 已經是 PTY / child fd guard 的命令（`PtyManager` 的 `child_process` fallback）不重複包裝。
- 🔴 安全：腳本是固定字串（`CHILD_FD_GUARD_SCRIPT`），每個值都是位置參數，從不被 shell 解析（CLAUDE.md「Child Process Spawning」）。日誌不記命令、參數、env 值與權杖。

## 包裝的形狀（child_process）

```
/bin/bash -c <CHILD_FD_GUARD_SCRIPT> bat-child-fd-guard <flags> <BASH_ENV> <PWD> <keep> <extra> <argv0> <target> <args…>
```

- `keep` = stdio 數（至少 3），`extra` = `CRASHDUMP_SIGNAL_FD` 的值（不需要時空字串）。
- 腳本：依 flags 還原 env → 在函式裡（用位置參數，不用會蓋到匯出變數的名稱）讀 `/proc/self/fd`，關掉 `< keep` 與 `extra` 以外的編號 → `exec -a "$argv0" "$target" "$@"`；flag `S` 時改 `exec /usr/bin/env -u SHLVL -- "$target" "$@"`。
- bash 找法與 PTY guard 相同（`/bin/bash` → `/usr/bin/bash`）；都沒有 → 不安裝，記一行。

## env（child_process）

| 變數 | 處理 |
|---|---|
| `BASH_ENV` | 不放進包裝的 env（bash 會 source），以 `$2` 傳入、腳本 `export` 還原（flag `B`） |
| `PWD`（原本有，含失效的） | 以 `$3` 傳入、腳本 `export PWD=` 還原原值（flag `W`；bash 啟動時會把失效的 PWD 改成實際 cwd） |
| `PWD`（原本沒有） | 腳本 `unset PWD`（flag `P`） |
| `SHLVL`（原本沒有） | `argv0` = `file`（一般情況）時經 `/usr/bin/env -u SHLVL --` exec（flag `S`，env 以同一個 PATH 找檔案）；`argv0` 選項與 `file` 不同時以 argv0 為準，子程序收到 `SHLVL=0`（BAT 程式碼沒有用 `argv0` 選項） |
| `SHLVL`（原本有） | 啟動 +1、`exec` −1，值相同 |
| `envPairs` 未給（繼承） | 取本行程的 `process.env` 明確傳入，內容相同 |

不處理（與 PTY guard 相同、實際上沒有差別）：非目錄的 `OLDPWD` 被 bash 拿掉、匯出的 `SHELLOPTS` / `BASHOPTS` / `IFS` / `BASH_FUNC_*%%` 被改寫成等效值；env 匯出 `SHELLOPTS=xtrace` 時包裝腳本的幾行會印到子程序的 stderr。

## 日誌（child_process）

- 安裝：`[child-fd-guard] installed (/bin/bash): child_process children keep only their stdio fds (BUG-206 / BUG-207)`（主行程寫進 debug log；headless 寫進 bat-server 的 console）。
- 沒有 bash / binding 不可用：各一行，guard 不安裝。
- 不認得的 binding 呼叫形狀、guard 內部例外：每種只記第一次，該次照原樣 spawn。
- 每次 spawn 不記日誌。

## 呼叫點盤點（T0807，`electron/**` 不含測試）

guard 裝在 libuv 入口，所以下表每個呼叫點在 Linux 都自動套用，沒有逐點改程式碼；這張表用來確認沒有呼叫點依賴被關掉的 fd。

| 檔案 | 行程 | 呼叫 | 長短 | IPC / 額外 fd | Linux 處置 |
|---|---|---|---|---|---|
| `main.ts` `startTerminalServer` / `reforkTerminalServer` | Electron 主行程 | `fork(terminal-server.js)` | 長（跨 BAT 存活） | `ipc` 在 fd 3 | **不包裝**（`runWithoutChildProcessFdGuard`，PLAN-062 方案 C） |
| `main.ts`（`spawnSync('powershell')`、以編輯器開資料夾的 `execFile`、其他 `execFile`） | 主行程 | spawnSync / execFile | 短 | 無 | 包裝（powershell 只在 Windows 呼叫） |
| `claude-agent-manager.ts` → Claude Agent SDK | 主行程 / headless | SDK 內部 `spawn` | **長**（claude CLI，再起 MCP / Bash 工具） | stdio pipe | 包裝（BUG-206 / 207 主要對象） |
| `codex-agent-manager.ts` → `@openai/codex-sdk` | 主行程 / headless | SDK 內部 `spawn` | **長** | stdio pipe | 包裝 |
| `pty-manager.ts` `child_process` fallback | 主行程 / headless | `spawn`（已經過 PTY guard） | 長 | 無 | 不重複包裝（`already-guarded`） |
| `pty-manager.ts` `taskkill` | 主行程 | execFileSync | 短 | 無 | 只 Windows |
| `pty-locale-env.ts`（`locale -a`） | 主行程 / headless | execFileSync | 短 | 無 | 包裝 |
| `handlers/git.ts`（git / gh 查詢、`gh` 登入 spawn） | 主行程 / headless | execFileSync / spawn | 短（git hook 可能執行 repo 程式碼） | 無 | 包裝（BUG-206：hook 不再拿到 master） |
| `handlers/claude.ts`（`claude auth status / logout`） | 主行程 / headless | execFile | 短 | 無 | 包裝 |
| `handlers/remote-tools.ts`、`remote-tools/probe-script.ts` | 主行程 / headless | execFile | 短 | 無 | 包裝 |
| `ct-worktree.ts`、`worktree-manager.ts` | 主行程 / headless | execFile（git，`worktree add` 會跑 checkout hook） | 短 | 無 | 包裝 |
| `claude-resolver.ts`、`claude-version-check.ts`、`codex-osc-version.ts`、`codex-runtime-resolver.ts`、`gh-resolver.ts` | 主行程 / headless | spawn / execFile / execFileSync（`--version`、`which`） | 短 | 無 | 包裝 |
| `voice-availability.ts` | 主行程 | execFile（`execPath`＋`ELECTRON_RUN_AS_NODE`） | 短 | 無 | 包裝；`CRASHDUMP_SIGNAL_FD` 的 fd 保留 |
| `early-path-fix.ts`（login shell 取 PATH） | 主行程 | execFileSync | 短 | 無 | 在 guard 安裝前執行（bootstrap import 期，T0485 限制它的 import），此時沒有 pty master；維持原狀 |
| `remote/headless-login-path.ts` | headless | spawn（`detached`，逾時 `kill(-pid)`） | 短 | 無 | 包裝（guard 在它之前安裝，此時尚無 master） |
| `remote/ssh-*.ts`、`remote/arch-detect.ts`、`docker-*.ts`、`wsl-*.ts`、`windows-elevation.ts` | 主行程 | spawn / execFile（ssh、docker、wsl、uname） | 短；`ssh-tunnel` / `wsl-keepalive` 長 | 無 | 包裝（wsl / windows-elevation 只在 Windows 呼叫） |
| `terminal-server/process-tree.ts` | Terminal Server | execFile（taskkill） | 短 | 無 | 只 Windows；Terminal Server 不安裝 guard |

短命的 `execFile` 在 Electron 主行程（Terminal Server 模式下沒有 master）原本可以不處理；guard 裝在入口、一律包裝較簡單，也涵蓋 direct 模式（主行程持有 master 時）。代價是每次 spawn 多一個 bash 啟動（毫秒級）。

## 驗證（child_process）

- 單元測試 `electron/__tests__/child-process-fd-guard.test.ts`（各平台）：`guardChildSpawn` Linux 形狀、非 Linux 不包裝、參數原樣且不進腳本、keep = stdio 數（`fork` 的 IPC fd 保留）、`CRASHDUMP_SIGNAL_FD`、找不到 / 不可執行不包裝、`BASH_ENV` / `PWD` / `SHLVL` flags、`argv0`、`envPairs` 未給、不重複包裝；`resolveChildExecutable` 的 PATH 規則；`installChildProcessFdGuard` 以假 binding：非 Linux 不碰 binding、位置參數 async 與物件 sync 都包裝且不改呼叫端的物件、`runWithoutChildProcessFdGuard`、fail open、重複安裝、uninstall；source guard（`main.ts` 安裝在 fork 之前且兩個 fork 都退出、`bat-server.mjs` 的順序、Terminal Server 不安裝）。
- Linux 實測 `electron/__tests__/child-process-fd-guard-linux.test.ts`（Linux 才跑，真 libuv / bash / node-pty）：本行程以 `PtyManager` direct 模式開兩個 shell（等同 headless）。
  - 反向對照：安裝前、以及 `runWithoutChildProcessFdGuard` 內，子程序與 git hook 都拿到兩個 `/dev/ptmx`。
  - 安裝後：spawn / execFile / exec / fork / promisify(execFile) / spawnSync / execFileSync / execSync 與 `git commit` 執行的 pre-commit hook 都沒有 master、沒有 stdio 以外沒設 `O_CLOEXEC` 的 fd；額外 `pipe`（fd 3）與 fork 的 IPC 照常可用。
  - 與不包裝的 spawn 比對：pid、ppid、argv（含 `argv0`）、cwd、env（失效 PWD、沒有 PWD / SHLVL、`BASH_ENV` 不被 source）、PATH 找到的 shebang 腳本、exit code / stdout / stderr、SIGTERM、`detached` 程序群組 SIGKILL、ENOENT / EACCES / cwd 不存在的錯誤物件。
- e2e `e2e/linux/t0807-child-process-fds.spec.ts`（打包的 Linux 版，`BAT_E2E_EXECUTABLE`）：G1 安裝日誌；G2 主行程 `spawn('sleep')` / `execFile('sleep')` / `execPath`＋`ELECTRON_RUN_AS_NODE` 的子程序沒有 stdio 以外沒設 `O_CLOEXEC` 的 fd（execPath 子程序只多保留 `CRASHDUMP_SIGNAL_FD`）；G3 反向對照：主行程本身與（不包裝的）Terminal Server 都有大量沒設 `O_CLOEXEC` 的 fd，shell 分頁照常可用且乾淨。T0806 的 F1–F6 一起跑以確認不回歸。G2 的對照組（同一執行檔、關掉 fd ≥ 3 後從測試行程啟動）用主行程的 `process.execPath`，不是 `BAT_E2E_EXECUTABLE`（T0810）：交付版的 `BAT_E2E_EXECUTABLE` 是 `.AppImage`，經 runtime 掛載與 AppRun / T0799 啟動器才 exec 掛載點內的 `BetterAgentTerminal.bin`（且帶 runtime 的 FUSE fd），對照組的 argv[0] 永遠不是 AppImage 路徑；app 執行中掛載點存在，`--linux dir` 目錄版的 execPath 就是執行檔本身。

## 已知限制（child_process）

- Terminal Server 本身（PLAN-062 方案 C）不在範圍；`early-path-fix` 的 login shell 在 guard 安裝前執行（沒有 master，只有 Chromium 的 fd，短命）。
- 更新前就在跑的舊 bat-server（systemd / launchd 常駐）要重啟才會安裝。
- `argv0` 選項與 `file` 不同且原 env 沒有 `SHLVL` 時，子程序收到 `SHLVL=0`。
- 可執行但沒有 shebang 的文字檔：libuv 與 bash `exec` 的處理可能不同（BAT 沒有這種呼叫）。
- binding 是 Node 內部介面：Node 改了形狀時 guard 退回不包裝並記一行（不會讓 spawn 失敗），升級時以 Linux 實測檔確認。
