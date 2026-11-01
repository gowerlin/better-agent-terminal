# headless server 的登入 shell PATH（PLAN-057 / T0755，D206 / D207）

> CLAUDE.md「headless server 的登入 shell PATH（PLAN-057 / T0755，D206 / D207）」節的完整說明。設計依據與量測數據：T0754 回報區。

## 用途

bat-server（headless）由 systemd user unit、launchd 或容器 ENTRYPOINT 啟動，PATH 只有系統預設值，沒有 `~/.local/bin`、nvm、Homebrew。server 開的終端分頁跑 `bash -l -i`，自己會讀 rc 檔；但 server 程序本身的子程序繼承的是 `process.env.PATH`，所以找不到這些工具：

- Claude 面板的 SDK（spawn env = `process.env`）：Bash 工具、使用者自己設定的 MCP（`npx` / `uvx`）、使用者的 hooks
- system runtime 找 claude（`claude-resolver` 掃 PATH）、codex 解析（`codex-runtime-resolver` / `codex-osc-version`）
- 遠端工具面板的「伺服器檢視」、agent 可用性檢查

bat-server 啟動時用登入 shell 取一次 PATH，合併進 `process.env.PATH`，之後建立的模組與快取都讀到新值。

## 必守規則

- 🔴 取法：`<shell> -l -i -c "printf '\n%s%s%s\n' '<標記>' "$PATH" '<標記>'"`，標記每次以 `randomBytes` 隨機產生，只取 stdout **最後一組**標記之間的值。
- 🔴 `spawn` 一律 `detached: true`（自己的程序群組、沒有控制 tty）；逾時 `LOGIN_SHELL_PATH_TIMEOUT_MS` = 3000 ms 以 `process.kill(-pid, 'SIGKILL')` 砍整個程序群組。
- 🔴 不得用 `execFile` / `execFileSync` / `spawnSync` 的 `timeout`：interactive bash 忽略 SIGTERM（T0754 數據 D：`execFile` 8 s callback 不回、`spawnSync` 卡 38–39 s；改 SIGKILL 只殺 bash，孫程序留下）。
- 🔴 以 `exit` 事件結束並 `destroy()` stdout / stderr，不得等 `close`：rc 用 `setsid` 在背景跑的程序會佔住 stdout，`close` 要等它結束（T0754 實測 37.9 s）。
- 🔴 任何失敗（逾時、沒有標記、spawn 錯誤、結果不合法）PATH 不動、記一行、server 照常啟動；`applyHeadlessLoginShellPath` 不丟例外。
- 🔴 開關關閉時不 spawn、不碰 `process.env`（`headless-login-path.test.ts` 守住 spawn 0 次、env 深度相等）。
- 🔴 套用點只有 `scripts/bat-server.mjs` `main()`：`resolveDataDir` 之後、`createHeadlessServer` 之前 `await serverEntry.applyHeadlessLoginShellPath?.(…)`。不得放進 `createHeadlessServer`（很多測試直接呼叫它，會讓每個測試都 spawn 登入 shell）；source guard 守住順序。
- 🔴 新模組不 import `electron`（`headless-electron-free.test.ts` 以 bundle 檢查）。
- 日誌不記完整 PATH，只記數量。
- win32 不執行（headless 只跑在 Linux / macOS；記 `skipped (win32)`）。

## 唯一實作

| 項目 | 位置 |
|---|---|
| 純邏輯（選 shell、組指令、解析標記、合併 / 去重 / 驗證） | `electron/remote/headless-login-path.ts`：`selectHeadlessLoginShell`、`buildLoginShellPathArgs`、`extractMarkedValue`、`resolveLoginShellPath` |
| 執行登入 shell（detached、逾時砍群組、`exit` 結束） | 同檔 `runLoginShell` |
| 讀開關、套用、日誌 | 同檔 `applyHeadlessLoginShellPath`、`isHeadlessLoginShellPathEnabled` |
| 匯出 | `electron/remote/server-entry.ts` |
| 呼叫 | `scripts/bat-server.mjs` `main()`（`?.`：舊的 server-entry 沒有這個匯出也能跑） |
| Settings | `AppSettings.headlessLoginShellPath`（`src/types/index.ts`）、`settingsStore.setHeadlessLoginShellPath`、`SettingsPanel.tsx`「進階」頁 BAT MCP 下方 |

不改（D207、T0755「不做」）：`PtyManager`、`electron/early-path-fix.ts`（Electron 主程序，macOS 才跑、`-l -c`）、git / gh resolver、遠端工具面板、systemd unit / launchd plist 範本。

## shell 選法

1. 候選 = `process.env.SHELL`，沒有就 `os.userInfo().shell`（容器的 ENTRYPOINT 環境通常沒有 `SHELL`；Debian 映像 root 是 `/bin/bash`）。
2. 候選是絕對路徑、basename 為 `fish` → fish，指令改用 `(string join : $PATH)`（fish 的 `$PATH` 是 list）。
3. 其他一律經 `selectLoginShell`（`electron/remote-tools/probe-script.ts`，與遠端 PTY / 工具面板登入檢視同一份白名單：`bash` / `zsh` / `sh` / `dash` / `ksh` 的絕對路徑），不合格退回 `/bin/sh`。

選 `-l -i` 而不是 `-l`：Ubuntu 預設 `.bashrc` 對非互動 shell 直接 `return`，`zsh -l` 不讀 `.zshrc`。`-l -i` 讀的 rc 與 server 開的分頁（`PtyManager.create` 的 `['-l', '-i']`）、工具面板的登入檢視（`buildLoginProbeInvocation`）一致。stdin 是 `/dev/null`（`read -p` 會立刻 EOF），stderr 讀掉丟棄（沒有 tty 時 `-i` 會印 job control 訊息）。stdout 只保留最後 256 KiB（標記在最後）。

## 合併規則（`resolveLoginShellPath`）

- 沒有完整一組標記 → `no-marker`（rc 裡 `exit`、`exec`、卡住後被砍）。
- 標記之間的值有 `\n` / `\r` / NUL → 整個不用（`invalid-chars`）。
- 登入 PATH 的項只收絕對路徑（相對、空項、`~/x` 丟掉）；一項都沒有 → `no-absolute-entries`。
- 結果 = 登入 PATH 的項在前，原 PATH 裡登入 PATH 沒有的項接在後面（rc 拿掉的項不會消失），去重保留第一次出現的位置。原 PATH 的項不檢查是否絕對路徑（原樣保留，只去掉空項）。
- exit code 不是 0 但有標記 → 照樣採用。
- WSL 的 `/mnt/<磁碟>/` 項**不過濾**（D207），日誌記數量。systemd 服務實測 0 項（WSL interop 只對 `wsl.exe` 開的程序加 Windows PATH）。

## 開關（D206 / D207）

- `<dataDir>/settings.json` 的 `headlessLoginShellPath`：布林，`!== false` 就算開（與 `batMcpEnabled` 同規則；字串 `"false"`、`0` 都算開）。
- `bat-server.mjs` 啟動時以 `readHeadlessSettings(dataDir)` 讀一次；改了要重新啟動 BAT 伺服器才生效。
- 🔴 不加環境變數覆蓋（D207 ①）。
- Settings UI：「設定 › 進階」的「BAT 伺服器 PATH」，只在遠端視窗、而且主機是 Linux / macOS 時顯示（`targetOS` 為 `wsl-linux` / `docker-linux` / `ssh-linux` / `ssh-darwin`；本機視窗不顯示）。遠端視窗的 `settings:save` proxy 到該主機 bat-server 的 `<dataDir>/settings.json`，所以勾選框改的就是 server 讀的那份。

## 日誌

`bat-server.mjs` 傳 `console`，systemd 下進 journal、手動啟動進 stdout / stderr。

| 情況 | 內容 |
|---|---|
| 套用 | `[bat-server] login shell PATH: applied (shell=/bin/bash, 124 ms, +2 entries, 11 total, /mnt 0)` |
| 開關關閉 | `[bat-server] login shell PATH: off (setting)` |
| win32 | `[bat-server] login shell PATH: skipped (win32)` |
| 失敗（`warn`） | `[bat-server] login shell PATH: failed (timeout 3000 ms; shell=/bin/bash, 3007 ms) — PATH unchanged` |
| | `… failed (no-marker, exit 0; shell=…, 39 ms) — PATH unchanged` |
| | `… failed (spawn error ENOENT; …) — PATH unchanged` |

`+N entries` = 合併結果裡原 PATH 沒有的項數；`total` = 合併後項數（含去重）；`/mnt` = 合併結果裡 `/mnt/<磁碟>/` 項數。

## 影響（headless，套用之後）

| 子程序 | 套用後 | 會壞嗎 |
|---|---|---|
| 終端分頁（`PtyManager`，`-l -i` 重讀 rc） | 去重後的項目相同；`~/.local/bin` 多一份（Ubuntu 預設 `.profile` 沒有防重複，D207 ③ 接受），原 unit PATH 的重複項（例 `/snap/bin`）因 server 端去重而少一份 | 不會 |
| helper（`headlessHelperPathEnv` 把打包的 `bin` 接在最後） | 不變 | 不會 |
| Claude 面板 SDK | Bash 工具、MCP、hooks 看得到 `~/.local/bin`、nvm | BAT 不會；使用者自己壞掉的 node 會從「找不到」變成載入錯誤（終端分頁本來就是這樣） |
| BAT MCP shim / BAT hooks（打包的 `bin/node` 絕對路徑） | 不變 | 不會 |
| system runtime claude、codex | 找得到 `~/.local/bin/*` | 不會（行為變好） |
| git / gh / worktree（另外掃常見位置） | 不變 | 不會 |
| 遠端工具面板「伺服器檢視」 | 登入檢視找得到的工具多數變成「伺服器：可見」 | 不會（面板不改） |

## 已知限制

- **macOS（launchd）未實測**：只依程式碼與文件推論。launchd 的 PATH 只有 `/usr/bin:/bin:/usr/sbin:/sbin`，Homebrew 通常在 `.zprofile`、nvm 在 `.zshrc`，所以受惠最多；launchd 環境有沒有 `SHELL` 未確認，靠 `os.userInfo().shell` 備援。
- rc 會在 server 啟動時多執行一次（與開一個分頁相同）：有副作用的 rc（啟動 agent、寫檔）也會跑。正常結束時不砍程序群組，rc 在背景留下的程序（例 `ssh-agent`）不會被殺；只有逾時才砍整個群組。
- `/proc/<pid>/environ` 是程序啟動時的環境，行程內改 `process.env.PATH` 不會反映在那裡；要看生效值請用遠端工具面板的「伺服器檢視」或日誌。
- 只在啟動時取一次：之後改 rc 要重新啟動 BAT 伺服器。
- 只靠互動 rc 裡的函式才找得到的工具（例 `.profile` 沒有 loader 的 nvm）不會進 PATH，伺服器檢視仍會顯示不可見。
- 最差啟動延遲 3 s（rc 卡住時），通常約 0.1 s。

## 驗證清單

| 項目 | 方法 / T0755 結果 |
|---|---|
| 單元測試 | `electron/remote/__tests__/headless-login-path.test.ts`（注入 spawn / kill / timer）：標記前後雜訊、只取最後一組、沒有標記、合併保留原 PATH 獨有項、去重、拒絕相對路徑與換行 / CR / NUL、`/mnt` 計數、開關 `false` 時 spawn 0 次且 env 深度相等、逾時 `kill(-pid, 'SIGKILL')`、只有 `exit` 沒有 `close` 也結束、fish 指令、`SHELL` 沒設時用 passwd shell、win32 skip |
| 真 shell（Linux / macOS；win32 skip，CI `ubuntu-24.04` 會跑） | 同檔 `real bash`：假家目錄 `.profile` 有 `trap '' TERM` + `sleep 37` → 3.5 s 內結束、PATH 不變、沒有殘留；`.profile` `exit 0` → 原 PATH；rc 印橫幅 / OSC 標題 → 採用；rc 用 `setsid` 佔住 stdout → 逾時內採用。T0755 在 WSL 以 esbuild 編出的同一模組 + 等效 harness 跑 7/7 PASS（Windows 本機 vitest 這 4 個 skip） |
| 突變檢查 | ① 改 SIGTERM / 不砍群組 → 單元測試與真 shell「沒有殘留」失敗；② 拿掉標記過濾 → 雜訊測試失敗；③ 忽略開關 → 關閉測試失敗；④ 拿掉與原 PATH 的合併 → 「rc 移除的項」測試失敗；⑤ 改用 `close` → setsid / exit 測試失敗；⑥ `bat-server.mjs` 呼叫移到 `createHeadlessServer` 之後 → source guard 失敗 |
| Settings UI | `src/components/__tests__/settings-headless-login-path.test.tsx`：四種遠端 `targetOS` 顯示、本機不顯示、取消勾選存 `false`、三語系 |
| WSL 實機 | 測試專用 headless server（`/tmp/bat-e2e-t0755`、`env -i $(systemctl --user show-environment)` + `setsid`、不經 systemd、隨機 port）：開啟 → `applied (shell=/bin/bash, 124 ms, +2 entries, 11 total, /mnt 0)`，伺服器檢視 claude / codex / uv 為可見；`false` → `off (setting)`，claude / codex / uv 不可見（與現況相同）；分頁 PATH 去重後相同，重複項由 `/snap/bin x2` 變成 `<使用者家目錄>/.local/bin x2`；使用者 bat-server MainPID / unit 狀態前後相同 |
| Docker | `bat-server:latest` 起 `bat-e2e-t0755-` 容器（新 JS 以唯讀 bind mount 蓋上）：預設 rc → `applied (… +0 entries …)`；`.profile` 加一項 → `+1 entries`；`shell=/bin/bash` 來自 `os.userInfo().shell`；容器與目錄已清 |
