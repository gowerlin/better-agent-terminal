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

- 主行程以 `child_process` 起的其他子程序（git、gh、claude CLI / Agent SDK、codex、`execFile` 類、Terminal Server 本身）仍會收到主行程沒有 `FD_CLOEXEC` 的描述元；headless / direct 模式下還會收到各分頁的 pty master。這不在 T0806 範圍（只處理 PTY），盤點見 T0806 回報區。
- 「保留 Terminal Server」時主行程 stdio 被 crashpad 卡住（PLAN-062 原題）不由本修正解決：Terminal Server 本身就是 crashpad 的 client（T0805 方案 C）。本修正解決的是「背景程序讓 crashpad 留著」的變體。
- 沒有 `/proc`（極少見）時迴圈找不到任何項目，fd 不關。
