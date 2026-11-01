---
schema_version: 1
schema_kind: workorder
id: T0754
title: "研究：bat-server（headless）啟動時以登入 shell 取得 PATH 的量測與設計（PLAN-057）"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T00:25:31+0800"
started_at: "2026-11-02T00:26:48+0800"
updated_at: "2026-11-02T00:43:58+0800"
completed_at: "2026-11-02T00:43:58+0800"
session_ids:
  - "352584d8-b56a-4377-9929-3d6b6d78421a"
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

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 底下 → PASS
- C-3：`affects_files` 只有本工單（`_ct-workorders/` 不算）→ 不適用
- C-2：工單沒有 `branch` 欄位；目前分支 `main`
- `CT_HOME` 未設定（不是 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 結論

1. **取法**：用 `<登入 shell> -l -i -c '<以隨機標記包住的 printf "$PATH">'`。Node 端 `spawn` 加 `detached: true`、自己計時，逾時就 `process.kill(-pid, 'SIGKILL')` 砍掉整個程序群組，並以 `exit` 事件結束（不等 `close`）。**逾時建議 3000 ms**（實測中位 123 ms、最大 141 ms；沒有 `.hushlogin` 而印出 MOTD 時約 160–180 ms）。
   - 🔴 不能直接用 `execFile`／`execFileSync` 的 `timeout`：interactive bash 會忽略 SIGTERM。rc 卡住時，callback 8 s 都沒回，`spawnSync` 卡了 38–39 s；改用 SIGKILL 只會殺掉 bash，孫程序會留下來（實測見數據表 D）。
   - 選 `-l -i` 而不是 `-l`：Ubuntu 預設的 `.bashrc` 遇到非互動 shell 會直接 `return`，`zsh -l` 也不讀 `.zshrc`（Docker 實測）。`-l -i` 讀的 rc 和 server 開的分頁一樣（`PtyManager.create` 的 `['-l', '-i']`），也和遠端工具面板的「登入檢視」（`buildLoginProbeInvocation`）一致。
2. **PATH 差異**（使用者 WSL Ubuntu 24.04，在 systemd user manager 的環境下量）：unit PATH 10 項，`/snap/bin` 重複一次。登入 shell PATH 多了 `<使用者家目錄>/.local/bin` 和 nvm 的 `v26.13.0/bin`；**`/mnt/c` 項是 0**（WSL interop 只對 `wsl.exe` 開的程序加 Windows PATH，systemd 服務不會加）。現在 server 開的分頁 PATH 和這個登入 PATH **完全相同**。套用之後，分頁再跑 `bash -l -i` 會讓 `~/.local/bin` **多一份**（Ubuntu 預設的 `.profile` 沒有防重複；nvm 不會重複），功能不受影響。
3. **影響**：會改變的是 Claude 面板的 Bash 工具（SDK spawn env = `process.env`）、使用者自己設定的 MCP（`npx`／`uvx`）、system runtime 找 claude、codex 解析，以及遠端工具面板的「伺服器檢視」。不變的有 git／gh（本來就另外掃常見安裝位置），以及 BAT MCP shim、BAT hooks、helper（都用打包的 `bin/node` 絕對路徑）。**沒有找到會讓 BAT 本身壞掉的路徑**。使用者環境有一個既有問題：nvm 預設的 node `v26.13.0` 缺 `libatomic.so.1`，無法執行。套用後，Claude 面板裡跑 `node`／`npx` 會從「找不到」變成這個載入錯誤（終端分頁現在就是這樣），見〈需要使用者決定的點〉4。
4. **套用點**：`scripts/bat-server.mjs` 的 `main()` 裡，在 `resolveDataDir` 之後、`createHeadlessServer` 之前 `await`。實作放在新模組，由 `server-entry` 匯出。採非同步（才能砍程序群組），啟動時間通常多約 0.1 s，最差多 3 s。失敗時一律保留原 PATH，記一行日誌，然後照常啟動。
5. **Docker**：`bat-server:latest`（Debian 12、root，ENTRYPOINT 環境沒有 `SHELL`）在預設 rc 下，登入 PATH 和映像 PATH 完全相同（等於沒改，約 3 ms）；rc 裡有加路徑時都會帶進來。`SHELL` 沒設時要改用 `os.userInfo().shell`（容器裡是 `/bin/bash`）。
6. **開關**：`<dataDir>/settings.json` 的 `headlessLoginShellPath`（布林；沒設定或不是 `false` 就算開），只在啟動時讀一次。關閉時完全不 spawn、不動 `process.env`，和現況一樣。Settings UI 放在只有遠端視窗才出現的區塊（BAT MCP 旁邊），並提示「重新啟動 BAT 伺服器後生效」。
7. **macOS（launchd）未實測**，只依程式碼與文件推論（見 ⑤ 後面的 macOS 段落）。

### 量測數據

環境：使用者 WSL `Ubuntu-24.04`（WSL2、`systemd=true`）、bash 5、`SHELL=/bin/bash`；沒有裝 zsh／fish（另外用 Docker 測試映像量）。「systemd 環境」= `env -i $(systemctl --user show-environment)`，它的 PATH 和使用者 bat-server 的 PATH 相同（從 MainPID 的 `/proc/<pid>/environ` 只讀 `PATH`／`SHELL` 的值和變數名稱）。

**A. 取 PATH 的方式（WSL、systemd 環境、各 12 次，單位 ms）**

| 方式 | 中位 | 最小 | 最大 | PATH 項數 | 加入的項 | `/mnt/*` | 雜訊 |
|---|---|---|---|---|---|---|---|
| `bash -l -i -c`（shell 端計時） | 103 | 101 | 112 | 12 | `~/.local/bin`、nvm v26 | 0 | 0 |
| `bash -l -c` | 89 | 86 | 94 | 12 | 同上（nvm 排前面） | 0 | 0 |
| `bash -i -c`（非登入） | 97 | 93 | 105 | 11 | 只有 nvm，缺 `~/.local/bin` | 0 | 0 |
| `early-path-fix.ts` 現行做法（`$SHELL -l -c 'echo $PATH'`，沒有標記） | 91 | 88 | 101 | 12 | 同 `-l` | 0 | 0 |
| `sh -l -c`（dash，只讀 `.profile`） | 48 | 46 | 52 | 12 | 同 `-l`（靠 BAT 寫進 `.profile` 的 nvm loader） | 0 | 0 |
| Node `spawn` detached `bash -l -i`（實作會用的方式） | 123 | 120 | 141（第一次） | 12 | 同上 | 0 | stderr 112 字元（`cannot set terminal process group`／`no job control`） |
| Node `spawn` detached `bash -l` | 104 | 100 | 107 | 12 | 同上 | 0 | 0 |

- 12 次都拿到標記。使用者家目錄有 `.hushlogin`，所以 stdout 沒有雜訊；換成假家目錄（沒有 `.hushlogin`）時，`-l -i` 會印出 sudo 提示和 MOTD 共 16–18 行（約 160–180 ms），所以**一定要用標記過濾**。
- bat-server 啟動時間（journal 最近 6 次）：`Started` 到 `listening` 都在同一秒內，多 0.12 s 影響不大。

**B. PATH 差異與重複疊加（WSL）**

| 項目 | 結果 |
|---|---|
| unit PATH（`systemctl --user show-environment`） | `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin:/snap/bin`（`/snap/bin` 重複） |
| 登入 PATH（P1） | `<使用者家目錄>/.local/bin:<使用者家目錄>/.nvm/versions/node/v26.13.0/bin:` 加上 unit PATH |
| 現在 server 分頁的 PATH | **= P1**（完全相同） |
| 套用後的分頁（在 P1 上再跑 `bash -l -i`） | 13 項，`~/.local/bin` 重複一次；nvm 不重複 |
| 再多套一層 | 14 項（每層加 1，這是 Ubuntu 預設 `.profile` 的行為） |
| server PATH 先去重再交給分頁 | `~/.local/bin` 還是會重複（rc 會再加一次），只少掉 `/snap/bin` 那份 |
| `/mnt/*` 項 | unit、登入、分頁都是 0（只有從 `wsl.exe` 互動開的 shell 才有 70 多項 Windows 路徑） |

| 工具 | unit PATH | 登入 PATH |
|---|---|---|
| `node` | 無 | `~/.nvm/versions/node/v26.13.0/bin/node`（🔴 這台缺 `libatomic.so.1`，無法執行；v24.22.0 正常） |
| `claude` / `codex` / `uv` | 無 | `~/.local/bin/*` |
| `npx` | 無 | nvm v26（同上，執行會失敗） |
| `git` / `gh` | `/usr/bin` | `/usr/bin`（不變） |

**C. 失敗模式（WSL、假家目錄 `/tmp/bat-e2e-t0754-home`、用 `setsid` 脫離控制 tty、shell 層 3 s 逾時）**

| rc 情境 | `-l -i` | `-l` |
|---|---|---|
| rc 會 `echo` 橫幅／設定 OSC 標題 | 找得到標記；stdout 有多行雜訊 | 找得到標記；2 行雜訊 |
| `.profile` 有 `exit 0` | rc=0，**沒有標記**，要退回原 PATH | 同左 |
| `.bashrc`（互動段）有 `exit 3` | rc=3，沒有標記 | 不受影響 |
| `read -p "Passphrase: "` | stdin 是 `/dev/null`，立刻 EOF，正常（181 ms） | 正常 |
| `.profile` 有 `sleep 30` | 卡住，只能靠逾時 | 卡住，只能靠逾時 |
| `.bashrc`（互動段）有 `sleep 30` | 卡住，只能靠逾時 | 不受影響 |
| `stty`／`tput`（需要 tty） | stderr 報錯，繼續執行 | 不受影響 |
| rc 有 `exec /bin/sh` | 沒有標記（`-c` 指令被換掉） | 不受影響 |
| 有控制 tty、在背景程序群組（用了 `timeout` 但沒 `setsid`） | **連乾淨的 rc 都會被 SIGTTOU 停住**，直到被殺 | 正常 |

最後一列表示：使用者在終端機手動啟動 bat-server 時，也要用 `detached: true`（Node 會 `setsid`，就沒有控制 tty）。

**D. Node 的逾時能不能結束卡住的登入 shell（WSL、node v24.22.0、`.profile` 或 `.bashrc` 有 `sleep 37`、逾時 1500 ms）**

| 寫法 | `-l -i` | `-l` |
|---|---|---|
| `execFile` `timeout` + SIGTERM（預設） | 🔴 8 s 內 callback 都沒回（bash -i 忽略 SIGTERM） | 1.5 s 回來；孫程序 `sleep` 留下來 |
| `spawnSync` `timeout` + SIGTERM | 🔴 卡 38–39 s（等 sleep 結束） | 1.5 s；孫程序留下來 |
| `execFile`／`spawnSync` + SIGKILL | 1.5 s 回來；孫程序留下來 | 1.5 s；孫程序留下來 |
| `spawn` `detached: true` + 自己計時 `process.kill(-pid, 'SIGKILL')` | **1.7 s，沒有殘留** | — |
| 同上，但 rc 用 `setsid` 在背景跑一個程序並佔住 stdout | 群組砍掉了，但 `close` 等到 37.9 s，所以要用 `exit` 事件，並 `destroy()` stdout／stderr | — |

**E. Docker（WSL Docker engine 29.1.3、容器名 `bat-e2e-t0754-*`、各 10 次）**

| 容器 | 方式 | 中位 ms | PATH 結果 |
|---|---|---|---|
| `bat-server:latest`（Debian 12、root、映像 PATH） | `bash -l -i`／`bash -l`／`sh -l` | 2–3 | 和映像 PATH 完全相同（等於沒改）；`-l -i` 的 stderr 有 job control 訊息 |
| 同上，`.profile` 加 `~/.local/bin`、`.bashrc` 加假的 nvm 路徑 | `bash -l -i`／`bash -l` | 3 | 兩項都有（Debian root 的 `.bashrc` 沒有互動檢查） |
| 同上 | `sh -l` | 3 | 只有 `.profile` 那項 |
| 測試映像（debian:12-slim + zsh + fish），`.zshrc` 加一項 | `zsh -l -i` | 2 | 有 |
| 同上 | `zsh -l` | 1 | **沒有**（`-l` 不讀 `.zshrc`） |
| 同上，`config.fish` 用 `fish_add_path` 加一項 | `fish -l -i` / `fish -l` | 5–6 | 都有；`fish -l -i` 的 stderr 有 TERM 警告；`"$PATH"` 和 `string join : $PATH` 都輸出冒號分隔 |
| 容器裡的 server 程序環境 | — | — | 映像的 `Env` 沒有 `SHELL`；passwd 裡 root 的 shell 是 `/bin/bash` |

### ① 取 PATH 的候選方式

| 候選 | 判斷 |
|---|---|
| `$SHELL -l -i -c` + 標記 + 砍程序群組（SIGKILL） | ✅ 建議。和分頁讀同一組 rc；標記擋掉 MOTD／echo 雜訊；砍群組能處理 SIGTERM 被忽略和孫程序殘留 |
| `$SHELL -l -c` | ❌ Ubuntu 的 `.bashrc` 對非互動 shell 直接 return（這台是剛好靠 BAT 寫進 `.profile` 的 nvm loader 才拿到 nvm）；zsh 不讀 `.zshrc` |
| `early-path-fix.ts` 現行做法（`-l -c 'echo $PATH'`、`execFileSync` 3000 ms） | ❌ 沒有標記（rc 印出的字會被整段當成 PATH）；`-l` 的缺點同上；它用 SIGTERM，在 `-l` 下能結束，但孫程序會留下來。本單不改它（不在範圍內），可另開單評估 |
| 只掃常見安裝位置（git／gh resolver 的做法） | ❌ 只補得到已知工具，`claude`／MCP 的 Bash 子程序還是看不到 |

shell 的選法：`process.env.SHELL` → `os.userInfo().shell` → `/bin/sh`。白名單沿用 `selectLoginShell`（bash／zsh／sh／dash／ksh，而且要是絕對路徑）；fish 另外處理（指令改用 `string join : $PATH`）；其他 shell 退回 `/bin/sh -l -i`。標記每次隨機產生，用 `printf '\n<標記>%s<標記>\n'` 輸出，只取最後一組。

### ② PATH 差異怎麼處理

- **`/mnt/c`（WSL interop）建議不過濾**：systemd 服務實測是 0 項；如果使用者自己在 rc 加了 `/mnt/...`，分頁裡也會有，server 和分頁一致比較好理解。Windows 的項都排在 Linux 的項後面，同名工具會先找到 Linux 版。日誌記下 `/mnt/` 項的數量，方便追查。（另一種做法見〈需要使用者決定的點〉2。）
- **合併規則**：登入 PATH 放前面，原 PATH 裡登入 PATH 沒有的項接在後面（這樣 rc 拿掉的項不會消失）；去重時保留第一次出現的位置；只接受絕對路徑，只要有換行或 NUL 就整個不用。
- **分頁裡的重複**：接受每多一層 `~/.local/bin` 就多一份（分頁本來就跑 `-l -i`，在分頁裡再開 `bash -l` 原本就會這樣）。不改 `PtyManager`；如果要分頁完全不變，見待決點 3。

### ③ 影響盤點（headless，套用之後）

| 子程序 | 怎麼拿到 PATH | 套用後 | 會壞嗎 |
|---|---|---|---|
| 終端分頁（`PtyManager` 直接 spawn） | `process.env` 去掉 `BAT_*`（`inheritedEnv`），再用 `-l -i` 重讀 rc | `~/.local/bin` 多一份 | 不會 |
| helper（`BAT_HELPER_NODE`；`headlessHelperPathEnv` 把打包的 `bin` 接在最後） | 同上 | 不變（`bin` 還是在最後，使用者裝的 node 優先，和現在一樣） | 不會 |
| Claude 面板 SDK（`sdkSpawnEnv` = `process.env` 加少數鍵） | 繼承 | Bash 工具、使用者的 MCP、使用者的 hooks 都看得到 `~/.local/bin` 和 nvm | BAT 不會；使用者自己壞掉的 node（這台的 v26）會從「找不到」變成載入錯誤 |
| BAT MCP shim／BAT hooks（`nodeCommand` = 打包的 `bin/node`） | 絕對路徑 | 不變 | 不會 |
| SDK 的 `executable`（`getNodeExecutable`：先掃 PATH，再掃 nvm 最新版） | `process.env.PATH` | 現在就已經選到 nvm 最新版（v26），套用後一樣 | 不變；內嵌 claude 是原生 binary，SDK 不會用到這個 node |
| system runtime 的 claude（`claude-resolver` 掃 PATH） | `process.env.PATH` | 找得到 `~/.local/bin/claude` | 不會（行為變好） |
| codex（`codex-runtime-resolver`／`codex-osc-version`） | `env.PATH` | 找得到 `~/.local/bin/codex` | 不會 |
| git／gh／worktree（`resolveGitBinary`／`resolveGhBinary` + `buildProbeEnv`） | PATH 加常見位置 | 不變（`/usr/bin`） | 不會 |
| 遠端工具面板的「伺服器檢視」（用 server 環境跑 `/bin/sh -c`） | 繼承 | 登入檢視找得到的工具，多數會變成「伺服器：可見」 | 不會 |
| agent 可用性檢查（`createHeadlessAgentAvailabilityCheck`、`buildProbeEnv`） | 繼承 | codex 等會被判成可用 | 不會 |

會不會叫到 Windows 程式：systemd 下 `/mnt/*` 是 0 項，不會。如果是從 `wsl.exe` 開的 shell 手動啟動 server，原 PATH 本來就有那些項，合併後也不變。

### ④ 套用點

- 位置：`scripts/bat-server.mjs` 的 `main()`，在 `loadServerEntry` 和 `resolveDataDir` 之後、`createHeadlessServer` 之前：`await serverEntry.applyHeadlessLoginShellPath?.({ dataDir, logger: console })`（`?.` 讓舊的 entry 也能跑）。
- 為什麼不放進 `createHeadlessServer`：很多測試直接呼叫它，放進去的話每個測試都會 spawn 登入 shell。放在正式入口，測試專用的 headless server（一樣走 `bat-server.mjs`）也涵蓋得到。
- 為什麼不放在 `bin/bat-server` 的 sh 包裝（`exec $SHELL -l -c …`）：沒有逾時，rc 的雜訊或卡住會擋住整個 server 啟動，也沒辦法讀開關。
- 為什麼要在 `createHeadlessServer` 之前：直接改 `process.env.PATH`，之後建立的模組和快取（`node-resolver` 的延遲快取、remote tools cache）讀到的就都是新值。
- 為什麼非同步：要砍程序群組，就得用 `spawn` + `detached`，`spawnSync` 做不到。
- 失敗時（逾時、沒有標記、spawn 錯誤、結果不合法）PATH 不動，記一行原因，server 照常啟動。exit code 不是 0 但有拿到標記時，還是採用結果。
- 日誌：`[bat-server] login shell PATH: applied (shell=/bin/bash, 123 ms, +2 entries, /mnt 0)` / `off (setting)` / `failed (timeout 3000 ms) — PATH unchanged`；不記完整 PATH。

### ⑤ Docker

見數據表 E。預設映像等於沒改，3 ms 內完成；使用者自建的映像要在 rc 加了路徑才有效果。ENTRYPOINT 的環境沒有 `SHELL`，所以要用 `os.userInfo().shell` 備援；root 沒有影響。容器裡沒有 tty，`-l -i` 的 job control 訊息只會到 stderr。

**macOS（launchd，未實測，只依程式碼與文件推論）**：launchd 給的 PATH 只有 `/usr/bin:/bin:/usr/sbin:/sbin`。Homebrew（`/opt/homebrew/bin`）通常寫在 `.zprofile`，nvm 寫在 `.zshrc`，所以 macOS 上的 headless 受惠最多。預設 shell 是 zsh，要用 `-l -i` 才會讀 `.zshrc`。launchd 的環境有沒有 `SHELL` 還沒確認，靠 `os.userInfo().shell` 備援。Electron 主程序的 `early-path-fix.ts` 只在 darwin 執行、用的是 `-l -c`，和本設計無關。

### ⑥ 開關設計（D206：預設開、可關）

- 鍵名：`headlessLoginShellPath`（在 `<dataDir>/settings.json`，布林；`!== false` 就算開，和 `batMcpEnabled` 同規則）。
- 讀取：`bat-server.mjs` 啟動時用 `readHeadlessSettings(dataDir)` 讀一次；改了要重新啟動 server 才生效。
- 關閉時：不 spawn 任何程序、不碰 `process.env`，只記一行 `off (setting)`，和現況完全相同（實作單用測試守住：關閉時 `process.env` 深度相等、spawn 次數為 0）。
- Settings UI：在 `SettingsPanel.tsx`，只在遠端視窗顯示（`remoteTargetOS` 有值而且不是 Windows），放在「BAT MCP」區塊旁邊。一個勾選框，加提示「BAT 伺服器程序（Claude 面板的工具與 MCP、Git…）使用登入 shell 的 PATH；重新啟動 BAT 伺服器後生效」。另外要改 `AppSettings` 型別、`settingsStore` setter 和三個語系。
- 遠端工具面板：開啟並套用成功後，登入檢視找得到的工具大多會顯示「伺服器：可見」。「伺服器程序：不可見（終端分頁找得到）」只會在這幾種情況出現：開關關閉、套用失敗、或工具只靠互動 rc 裡的函式才找得到（例如 `.profile` 沒有 loader 的 nvm）。本設計不改面板。

### ⑦ 實作單草案

- **標題**：headless server 啟動時以登入 shell 取得 PATH（PLAN-057 實作，預設開、可關）
- **範圍**：
  1. 新模組 `electron/remote/headless-login-path.ts`（不 import electron）：
     - `resolveLoginShellPath(deps)`：純邏輯，負責選 shell、組指令、解析標記、合併去重、驗證。
     - `applyHeadlessLoginShellPath({ dataDir, logger, deps? })`：讀開關、spawn detached、3000 ms 後 SIGKILL 整個群組、用 `exit` 事件、destroy pipes、寫入 `process.env.PATH`、記一行日誌。
  2. `electron/remote/server-entry.ts` 匯出這個函式；`scripts/bat-server.mjs` 在 `createHeadlessServer` 之前呼叫（用 `?.`）。
  3. Settings：`AppSettings.headlessLoginShellPath`、`settingsStore` setter、`SettingsPanel.tsx` 的遠端視窗區塊、`en`／`zh-TW`／`zh-CN` 語系。
  4. 文件：新增 `docs/agent-guide/headless-login-shell-path.md`、更新 `docs/agent-guide/README.md` 索引、CLAUDE.md 新增一節（3–12 行）。
- **affects_files**：`electron/remote/headless-login-path.ts`、`electron/remote/server-entry.ts`、`scripts/bat-server.mjs`、`electron/remote/__tests__/headless-login-path.test.ts`、`src/types/index.ts`、`src/stores/settings-store.ts`、`src/components/SettingsPanel.tsx`、`src/components/__tests__/`（設定區塊的測試）、`src/locales/en.json`、`src/locales/zh-TW.json`、`src/locales/zh-CN.json`、`docs/agent-guide/headless-login-shell-path.md`、`docs/agent-guide/README.md`、`CLAUDE.md`
- **不做**：不改 `PtyManager`、`early-path-fix.ts`、git／gh resolver、遠端工具面板，以及 systemd unit／launchd plist 範本。
- **驗證**：
  - 單元測試（注入 spawn／kill／clock）：
    - 標記前後有雜訊時仍取得正確 PATH；沒有標記時用原 PATH。
    - 合併時保留原 PATH 獨有的項、會去重、拒絕相對路徑和換行。
    - 開關是 `false` 時 spawn 0 次，`process.env` 深度相等。
    - 逾時會呼叫 `kill(-pid, 'SIGKILL')`。
    - fish 的指令形式。
    - `SHELL` 沒設時依序用 `userInfo().shell`、`/bin/sh`；不在白名單的 shell 用 `/bin/sh`。
  - 真 shell 測試（只在 Linux／macOS 跑，win32 跳過）：
    - 假家目錄的 `.profile` 有 `sleep 37` 時，3.5 s 內結束，沒有殘留程序。
    - `.profile` 有 `exit 0` 時用原 PATH。
    - rc 用 `setsid` 佔住 stdout 時，仍在逾時內結束。
  - 突變檢查（每次只改一處，確認測試會失敗）：
    1. 改回 SIGTERM 或不砍群組 → 卡住的測試失敗。
    2. 拿掉標記過濾 → 雜訊測試失敗。
    3. 忽略開關 → 關閉測試失敗。
    4. 拿掉和原 PATH 的合併 → 「rc 移除的項」測試失敗。
    5. 改用 `close` 事件 → setsid 測試失敗。
    6. 把 `bat-server.mjs` 裡的呼叫移到 `createHeadlessServer` 之後 → source guard 失敗。
  - `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`。
  - WSL 實機（測試專用 headless server，照 T0748／T0749 的做法：放在 `/tmp/bat-e2e-t07xx`，用 `env -i $(systemctl --user show-environment)` 加 `setsid` 啟動 `bat-server.mjs --data-dir … --port <隨機>`，不經 systemd）：
    - 開啟時：日誌是 `applied`，遠端工具 detect 的伺服器檢視裡 claude／codex／uv 是 `found`。
    - `settings.json` 設成 `false` 時：日誌是 `off`，伺服器檢視和現在相同。
    - server 開的分頁 PATH 只多一份 `~/.local/bin`。
    - 前後比對使用者 bat-server 的 MainPID 和 unit 狀態沒有變。
  - Docker：用 `bat-server` 映像起一個 `bat-e2e-` 容器，日誌是 `applied`、PATH 不變；測試資源在結束時清掉。

### 需要使用者決定的點

1. **開關鍵名**：建議用 `headlessLoginShellPath`（布林、預設開）。要不要再加一個環境變數來覆蓋（例如在 unit drop-in 設 `BAT_SERVER_LOGIN_SHELL_PATH=0`）？建議**不加**：套用失敗會自動退回原 PATH，server 不會因此起不來，用 Settings 就夠了。
2. **`/mnt/<磁碟>/` 項**：建議**不過濾**（systemd 下實測 0 項，而且和分頁一致）。另一種做法：在 WSL 上丟掉「原 PATH 沒有、只有登入 PATH 才有」的 `/mnt/<磁碟>/` 項。
3. **分頁的 PATH**：建議接受 `~/.local/bin` 多一份（這樣不用改共用的 `PtyManager`）。如果要求分頁完全不變，就得讓 headless 的 `PtyManager` 繼承套用前的 PATH，要改共用程式碼，範圍會變大。
4. **使用者 WSL 的 nvm node v26.13.0 無法執行**（缺 `libatomic.so.1`，nvm 預設的 `lts/*` 指到它）：套用後，Claude 面板裡的 `node`／`npx` 會從「找不到」變成載入錯誤；終端分頁現在就已經是這樣。這不是 BAT 的問題，建議在 WSL 裝 `libatomic1` 套件，或把 nvm 預設改成 v24。

### 遭遇問題

- 量測腳本第一次用了 `timeout` 但沒加 `setsid`，結果 `-l -i` 全部被 SIGTTOU 停住（`wsl.exe` 有控制 tty）。這剛好成了一筆數據（表 C 最後一列）；之後的量測都加了 `setsid`。
- Docker 第一次跑時，腳本漏了 `shift`，把標籤當成指令執行；修正後重跑。兩次都只用 `bat-e2e-t0754-` 容器。
- 建測試映像時，BuildKit 拉了 `debian:12-slim` 當基底，但**沒有留下 tag**（`docker image inspect debian:12-slim` 查不到）；`bat-e2e-t0754-shells:local` 已刪除。BuildKit 的建置快取可能還留著這些層；工單禁止 `prune`，所以沒有清，要不要清由使用者決定。
- 發現 WSL 的 nvm node v26.13.0 無法執行（見待決點 4），所以 Node 端的量測改用 v24.22.0。
- session id：工單的 `memory_overrides` 規定回報不能有完整 session id，這和 ct-exec 寫 `session_ids` 的規則衝突。我依工單只在〈完成狀態〉寫前 8 碼，frontmatter 不寫 `session_ids`（塔台收單時可以從分頁的 `claudeSessionId` 補記）。

### 讀過的檔案（只讀）

`electron/early-path-fix.ts`、`electron/remote/headless-entry.ts`、`electron/remote/headless-handlers.ts`、`electron/remote/server-entry.ts`、`scripts/bat-server.mjs`、`scripts/build-server-bundle.mjs`、`electron/pty-manager.ts`、`electron/claude-agent-manager.ts`、`electron/node-resolver.ts`、`electron/remote-tools/probe-script.ts`、`electron/wsl-systemd.ts`、`electron/remote/ssh-start-server.ts`、`src/components/SettingsPanel.tsx`、`src/locales/zh-TW.json`。

### 量測資源與使用者環境

- 量測腳本只放在 Worker scratchpad（Windows 端，經 `/mnt/c` 讀取）和 WSL 的 `/tmp/bat-e2e-t0754*`。結束時 `/tmp/bat-e2e-t0754*` 已刪除，沒有殘留的 `sleep` 程序。
- Docker：只建立了 `bat-e2e-t0754-inspect`／`-a`／`-b`／`-c` 容器（都用 `--rm`）和 `bat-e2e-t0754-shells:local` 映像；結束時 t0754 的容器和映像都是 0。使用者既有的 bat-server 容器（名稱含專案名，塔台收單時改代稱）沒有動（前後都是 Up / healthy）。
- 使用者 bat-server 前後比對：`bat-server.service` 的 MainPID `357`、`active/running`、`NRestarts=0`、`ActiveEnterTimestamp` `2026-11-02 00:22:46` 前後都相同；unit 檔、`~/.profile`、`~/.bashrc` 的 mtime 都早於本單開始時間（沒有修改）。
- 沒有用 SSH 主機；macOS 沒有實測。

### 互動紀錄

- 無（yolo；沒有需要問塔台的問題）。

### 完成狀態

- **狀態**：DONE
- **驗收**：①–⑦ 都有結論和證據（macOS 標明未實測）✅；量測數據表、建議、實作單草案和待決點 ✅；使用者 bat-server 前後相同、測試資源已清除 ✅
- **commit**：只用 `git commit --only` commit 本工單，沒有產品變更
- **session_id**：352584d8…（只留前 8 碼，見〈遭遇問題〉）
