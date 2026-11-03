---
schema_version: 1
schema_kind: workorder
id: T0805
title: "查證：PTY 內的 shell 繼承 Terminal Server 的描述元（含 crashpad client socket）——每個 fd 的來源、影響範圍與修正方向"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-03T16:27:42+0800"
started_at: "2026-11-03T16:29:03+0800"
updated_at: "2026-11-03T17:06:07+0800"
completed_at: "2026-11-03T17:06:07+0800"
session_ids:
  - "467ef19c-cfbc-4b65-ab26-21e6f6c2d016"
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

- [x] fd 盤點表（fd、類型、inode、對端、CLOEXEC、來源判斷），Terminal Server 模式＋direct 模式
- [x] 影響查證結果（可否讀寫、背景子程序留著時的關閉結果、crashpad 推論）
- [x] headless / Windows / macOS 的對照（實測或推論，標明）
- [x] 結論：缺陷與否、嚴重度建議、修正方向與工單草案；與 PLAN-062 的關係
- [x] 環境還原：隔離 userData、下載檔、暫存腳本已刪；沒有本單留下的 BAT / terminal-server / crashpad / mount；`~/.config/BetterAgentTerminal`、`~/bat-build`、`~/.codex/config.toml` 前後雜湊相同

---

## 回報區

### 完成狀態

- **狀態**：DONE（研究型，驗收 5 項都有證據）
- **結論一句話**：是缺陷，而且範圍比 T0804 看到的大。Linux 上每個分頁的 shell 都繼承 Electron 主行程約 30 個沒有 `FD_CLOEXEC` 的描述元（Chromium 開的檔案、到 GPU／網路服務／renderer 的 socket、crashpad client socket、Local Storage leveldb 的寫入 fd），**還繼承比它早開的分頁的 pty master（`/dev/ptmx`，O_RDWR）**。這代表任一分頁的程式不用權杖就能對前面的分頁送輸入（含塔台分頁）。成因有三段：Chromium 開 fd 不設 CLOEXEC；libuv 的 `child_process.fork` 不關多餘 fd；`@lydell/node-pty` 1.1.0 的 `forkpty`＋`execvp` 也不關。direct 模式與 headless 都會漏 pty master；direct 模式另外漏主行程全部約 50 個 fd。另外實測：分頁留下的背景程序活著時，就算選「離開＋結束 Terminal Server」，crashpad 也不會結束，`app.close()` 會一直等，砍掉背景程序後 2 ms 內返回。
- **嚴重度建議**：跨分頁 pty master → **P2**（繞過 T0575 / D149 的範圍權杖模型）；其餘描述元外流 → P3。
- **開始 / 完成時間**：2026-11-03T16:29:03+0800 → 2026-11-03T17:06:07+0800
- **session_id**：467ef19c-cfbc-4b65-ab26-21e6f6c2d016

### 落點檢查

- 結果：**PASS**
- C-0：工單 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 底下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 底下的本工單 → not applicable
- C-2：工單沒有 `branch` 欄位；目前分支 `main`
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`CT_HOME` 未設定（非 worktree）

### 環境與方法

- WSL Ubuntu-24.04（kernel 6.18.33.2-microsoft-standard-WSL2、glibc 2.39、WSLg）、node v26.13.0（nvm）、`playwright-core@1.59.1`（裝在 `~/t0805-tmp`，已刪）。
- 受測：`v0.7.4-pre.3` AppImage，SHA-256 `4f6bfd63a6cdcd74496c2edb01b905842119d7ff7ef489ba116d6c980d149a05`（與 T0803 / T0804 相同）。檔名存成 `BAT.AppImage`，所以 mount 名稱是 `/tmp/.mount_BAT.*`。
- 每輪一個隔離 runtime（`--runtime=t0805-s1` … `t0805-s4`，userData `<使用者資料夾>/.config/BetterAgentTerminal-runtime-t0805-sN`）。env 先移除 `BAT_*` / `CT_*` / `ELECTRON_RUN_AS_NODE`，`BAT_REMOTE_PORT` 用空閒埠，`chromiumSandbox: true`。工作區只放 shell 分頁（`type: 'terminal'`），沒有開 codex / claude 分頁，沒有送按鍵給任何 agent TUI，沒有登入任何服務。關閉時一律以 `closeIsolated` 的 mock 回答「離開＋結束 Terminal Server」（`response: 1, checkboxChecked: true`）。
- 取證工具（暫存，已刪）：
  - `inv.sh`：讀 `/proc/<pid>/fd`、`fdinfo` 的 `flags`（`02000000` = O_CLOEXEC）、`ss -xpa` 的對端 inode，並掃 `/proc/*/fd` 找同一 inode 的持有者。
  - `kcmp.py`：用 `kcmp(2)` `KCMP_FILE` 判斷 shell 的 fd N 和 server／主行程的 fd N 是不是**同一個 open file description**。這是唯讀操作，只需要對同 uid 程序有 PTRACE_MODE_READ。
  - `probe.py`：在分頁裡執行，對 dup 出來的副本做 `fstat`、`F_GETFL`、`SO_TYPE`、`SO_DOMAIN`、`SO_PEERCRED`、`getsockname`、`getpeername`。**沒有對任何 fd 讀或寫資料**，副本 detach 後關閉；關副本不會關到原本的 fd。
- direct 模式：產品沒有關閉 Terminal Server 的開關（`useServer` 只看 server 連線，`electron/pty-manager.ts:659`）。所以用**等效實驗**：以 `app.evaluate` 在 Electron 主行程載入 app 自己的 `@lydell/node-pty`（`resources/app.asar.unpacked/node_modules/@lydell/node-pty`），再 `pty.spawn`。這和 `PtyManager` direct 分支（`electron/pty-manager.ts:1445`）的呼叫者、模組都相同，env 不同。

### 驗收結果

#### 1. fd 盤點表

**Terminal Server 模式**（S1：主行程 1562 → Terminal Server 1726 → 分頁 shell `bash -l -i` 1816；第 2 輪 S2 開兩個分頁，以 `kcmp` 逐一確認來源，fd 編號與 S1 只差 ±1）。分頁 shell 0–2、255 以外共 **34** 個 fd，**全部沒有 CLOEXEC**：

| fd（S1） | 類型 / 目標 | 存取 | 對端（`ss -xp` peer／`SO_PEERCRED`） | 來源（`kcmp`） |
|---|---|---|---|---|
| 26、72 | 檔案 `v8_context_snapshot.bin`（mount 內） | RO | — | 26 = Terminal Server 自己開的；72 = 主行程 |
| 27、28 / 31、68、69 | `anon_inode` eventpoll / eventfd | RW | — | 27、28 = Terminal Server 自己開的；31、68、69 = 主行程 |
| 42 / 45 | 檔案 `resources/app.asar` | RO | — | 42 = Terminal Server 自己開的；45 = 主行程 |
| 50 / 51 | pipe `5447`（讀端 / 寫端各一） | RO / WO | 只有主行程、server、shell 持有 | 主行程（推論：Chromium 主行程內部 pipe；主行程有 `CrShutdownDetec` 執行緒，是否就是它的 shutdown pipe 未查證，Yama 擋住讀 `/proc/<tid>/syscall`） |
| 52–55 | `chrome_100_percent.pak`、`chrome_200_percent.pak`、`locales/en-US.pak`、`resources.pak` | RO | — | 主行程 |
| 57 | socket `6364`，AF_NETLINK / SOCK_RAW（`sockname` = 主行程 pid） | RW | — | 主行程（推論：Chromium 網路變更監看） |
| 58 | inotify | RO | — | 主行程 |
| 59、61 | `u_str` `17848`、`10527` | RW | GPU process（1632） | 主行程（推論：Mojo IPC） |
| 63、65、66 | `GPUPersistentCache/GPUCache/…/cache.db`、`.journal`、`.db-wal` | **RW** | — | 主行程 |
| 70、83 | `u_str` `17858`、`17945` | RW | NetworkService utility（1642） | 主行程 |
| 71 / 73 | TCP `127.0.0.1:<port>` ESTAB / LISTEN | RW | — | 主行程：Chromium DevTools `--remote-debugging-port`（S2 `ss -tanp` backlog 10）。**只有 Playwright 啟動時才有** |
| **74** | `u_seq` `5448`（abstract 位址） | RW | **`chrome_crashpad_handler`（1644 fd 75）**；renderer 也持有同一個 | 主行程。S2 以比較確認：它就是 Terminal Server env `CRASHDUMP_SIGNAL_FD` 指的 fd（只比較、沒有印值），`CRASHPAD_HANDLER_PID` 指的程序 comm = `chrome_crashpad` |
| 75、76、77、79 | `Local Storage/leveldb/LOG`、`LOCK`、`MANIFEST-000001`、`000003.log` | **WO / RW / WO / WO** | — | 主行程 |
| 81、84 | `u_str` `2617`、`5450` | RW | renderer（1708） | 主行程 |
| 1023 | 目錄 `/tmp/.mount_BAT.*`（mount 根） | RO | — | 主行程（推論：AppImage 執行環境開的） |
| **44**（S2，只有第 2 個分頁有） | **`/dev/ptmx`，`tty-index: 2`** | **RW**（flags `0104002`） | 第 1 個分頁的 pts（`/dev/pts/2`） | Terminal Server 自己開的：node-pty 為**第 1 個分頁**開的 master |

- 小結：34 個裡有 30 個是主行程經 Terminal Server 轉傳下來的（同一個 open file description，fd 編號也相同），4 個是 Terminal Server 自己開的。從第 2 個分頁起，每個分頁另外還持有**所有比它早開、仍開著的分頁的 pty master**。S2 實測：Terminal Server 有 fd 44（tty-index 2）、45（tty-index 3），分頁 B（pts/3）持有 44，分頁 A 沒有 45。
- **沒有**外流的：Terminal Server 的 fd 0–25 都帶 CLOEXEC（IPC channel 3、Playwright 管線 4、AppImage keepalive pipe 5、Chromium socket 8/9 等），所以 shell 收不到。由 Node 開的 socket（RemoteServer 監聽 `BAT_REMOTE_PORT` 的主行程 fd 92、Node inspector、Terminal Server 自己的 TCP 監聽 fd 43）也都帶 CLOEXEC，同樣收不到。
- Terminal Server 的 fd 3–25 為什麼帶 CLOEXEC 沒查到。它們在主行程是 inheritable（例：主行程 fd 4 `flags=02`、server fd 4 `flags=02000002`）。推論：Node / Electron node 模式啟動時設的。對照：用 `child_process.spawn` 起的純 node 子程序，3–20 也一樣被設了 CLOEXEC。
- env：Terminal Server 的初始 env 有 `CRASHDUMP_SIGNAL_FD`、`CRASHPAD_HANDLER_PID`、`ELECTRON_RUN_AS_NODE`、`NODE_CHANNEL_FD`、`NODE_CHANNEL_SERIALIZATION_MODE`、`BAT_IDLE_TIMEOUT_MS`、`BAT_SCROLL_BUFFER_LINES`、`BAT_USER_DATA`。主行程的初始 env 和 `process.env` **都沒有**兩個 crashpad 變數，所以是 Electron 從主行程 spawn 子程序時加進去的。分頁 shell 的 env **沒有**任何 crashpad／`NODE_CHANNEL*` 變數（S1 `probe.py` 與 `/proc/<pid>/environ` 都確認），但有 AppImage 的 `APPDIR`、`APPIMAGE`、`ARGV0`、`OWD`、`LD_LIBRARY_PATH` 與 `CHROME_DESKTOP`。只記名稱。

**direct 模式（等效實驗，S3 / S4）**：主行程用 node-pty 直接 spawn。

- 子程序拿到主行程**全部**沒有 CLOEXEC 的 fd，共 **51** 個（`/bin/sleep`）：3–11、17–23、32、46、51–59、61、63、65、66、68–76、78、79、81、83、84、87–90、93、100、1023。
- 比 Terminal Server 模式多出的有：
  - fd 3 / 4：Playwright 管線，只有測試時才有。
  - fd 5：AppImage keepalive pipe，T0804 實測過，持有者是 AppImage runtime。
  - fd 6 / 7：`icudtl.dat`、`v8_context_snapshot.bin`。
  - fd 8 / 9：`u_seq`，與 zygote、GPU、renderer 共用。
  - `Extension State` 的 leveldb 四個檔、`Dictionaries/*.bdic`。
- 第 2 個子程序持有第 1 個的 master（S3：fd 94，`tty-index: 2`）。
- 用 `bash -l -i` 時，S3 看到 shell 的 fd 3–19 被設了 CLOEXEC（不會再傳給 shell 啟動的程式）。改用 `bash --norc --noprofile -i` 或 `sleep`（S4）就全部是 inheritable。所以是那台 WSL 的登入設定檔造成的，**不能當成保護**。
- 子程序 env 沒有 crashpad／`NODE_CHANNEL*` 變數。

#### 2. 影響查證

**(a) 分頁內的程式能不能讀寫這些 fd**：實測拿得到，而且存取模式允許讀寫。以下是 S1 `probe.py` 在分頁裡跑出的結果：

```
fd 59: socket … family=1 type=STREAM peercred_pid=1562(BetterAgentTerm)
fd 63: reg … access=O_RDWR                      (GPUCache cache.db)
fd 74: socket … family=1 type=SEQPACKET sockname=b'\x00f4ffa' peername=b'\x00aee8a' peercred_pid=1562(BetterAgentTerm)
fd 75: reg … access=O_WRONLY                    (Local Storage leveldb LOG)
fd 76: reg … access=O_RDWR                      (… LOCK)
fd 81: socket … family=1 type=STREAM peercred_pid=1708(BetterAgentTerm)
fd 83: socket … family=1 type=STREAM peercred_pid=1642(BetterAgentTerm)
env CRASHPAD_HANDLER_PID set: False | CRASHDUMP_SIGNAL_FD set: False
```

（socket 都是 O_RDWR；`SO_PEERCRED` 是建立連線那一端的程序，所以有幾個顯示主行程。）依工單紅線**沒有實際讀寫**。以下影響都是推論：

- **pty master（最重要）**：對 master 寫入，就等於在那個分頁打字（進到該分頁 shell／TUI 的輸入）；從 master 讀取，會把該分頁的輸出搶走，BAT 就收不到。這表示 Worker 分頁裡的任何程式，不需要 `batcap.` 權杖，就能對比它早開的塔台分頁送按鍵，例如回答塔台的權限對話框。這等於繞過 PLAN-036 / T0575（D149）的範圍權杖與 T0788 的保留機制。同 uid 程式原本沒辦法往別的終端注入輸入：`TIOCSTI` 只對自己的控制終端有效（對其他終端需要 `CAP_SYS_ADMIN`），Linux 6.2 起還能以 `dev.tty.legacy_tiocsti` 整個關掉。所以這是**新增**的能力。
- Mojo socket（GPU、NetworkService、renderer）：寫入垃圾資料，可能讓那條通道斷掉，或讓對端程序結束（畫面、網路異常）。Chromium 用 socketpair，沒有名稱，同 uid 程式原本也拿不到。
- pipe 50 / 51：如果它是 Chromium 的 shutdown pipe，寫入 4 bytes 會讓 BAT 主行程當成收到訊號而退出（推論，未證實是哪條 pipe）。
- leveldb、GPUCache 的寫入 fd：同 uid 本來就能直接寫這些檔案，**沒有新增權限**；風險只在程式誤寫到繼承來的 fd 編號（≥ 26，機率低）。
- crashpad socket：可以假冒 client 送 crash 請求（推論，影響是在 crash 目錄產生 dump）。
- DevTools 監聽 socket（71 / 73）：只出現在 Playwright 啟動時，但分頁程式可以 `accept()` 搶走 CDP 連線。正常使用者啟動時沒有這個 port。
- 從 Terminal Server 轉傳的那 30 個 fd 一樣會再傳給 server 之後 spawn 的所有分頁。headless 與 direct 的範圍見第 3 節。

**(b) 背景子程序留著時的關閉結果**（S1、S2 各一次，結果相同）：

- 分頁裡執行 `setsid sleep 9001 </dev/null >/dev/null 2>&1 &`。`sleep` 的 stdio 已導到 `/dev/null`，但仍持有 26–84、1023 這些 fd（`inv.sh`：與 shell 相同，**包含 crashpad socket 74**）。
- 接著以「離開＋結束 Terminal Server」關閉：

```
[+ 58444ms] main 'exit' code=0 signal=null                         ← 主行程 798 ms 結束
[+ 82105ms] app.close(): TIMEOUT after 24459 ms; 'exit' 798 ms; 'close' not yet
[+ 85109ms] alive after quit: server=false shell=false bg-sleep=true main=false
process tree (after quit):
   1644     967 … /tmp/.mount_BAT.ApGyhTUJ/chrome_crashpad_handler …
   8454     967 … sleep 9001
holders of main stdio:
  pid 1644 fd 1 socket:[12890] chrome_crashpad
  pid 1644 fd 2 socket:[12892] chrome_crashpad
crashpad after quit: fd=75 socket:[5449] u_seq peer_holders=[8454:74(sleep)]   ← 唯一剩下的 client 是 sleep
[+ 85833ms] killed bg sleep 8454
[+ 85834ms] main 'close' code=0 signal=null                        ← 砍掉 sleep 後 1 ms（S2：2 ms）
```

- Terminal Server 與 shell 正常結束（T0540 / T0704 流程照常運作）。**crashpad 繼續存活，直到背景程序結束**；它持有主行程的 stdout / stderr，所以 PLAN-062 的現象在「結束 Terminal Server」這條路徑也會出現。
- AppImage：S2 確認 FUSE runtime（1577）已結束，`/proc/mounts` 沒有 `mount_BAT`。背景程序持有的 mount 內檔案路徑變成 `/v8_context_snapshot.bin`（已 lazy 卸載的 mount），crashpad 從已卸載、daemon 也已結束的 mount 繼續執行。推論：它的程式碼頁面若被換出後要重讀，可能 SIGBUS；本單沒有觀察到。結論是 **mount 不會留著，留著的是 crashpad 程序**。
- 推論：使用者正常使用時，主行程的 stdio 通常是 `/dev/null` 或 journal，所以實際影響是：每個 BAT session 只要分頁留下背景程序（`nohup` / `setsid` / `&` 起的 dev server、沒有自行關 fd 的 daemon），就會多留一個 crashpad 程序，直到那些程序結束。下次啟動 BAT 會另起一個新的 crashpad。

**(c) 分頁內其他 Electron / Chromium 程式會不會回報到 BAT 的 crashpad**（推論＋env 實測）：不會。

- Electron 的 node 模式靠 `CRASHDUMP_SIGNAL_FD` / `CRASHPAD_HANDLER_PID` 這兩個 env 接上既有的 handler。分頁 shell 的 env 沒有這兩個變數（S1–S4 都確認），所以分頁裡的 `ELECTRON_RUN_AS_NODE` 程式（例如 VS Code 的 `code` CLI）不會接上 BAT 的 crashpad。
- 一般 Electron / Chromium 應用會自己起 crashpad。
- 那條 socket 雖然被繼承，但沒有 env 指出 fd 編號，正常程式不會使用它。
- 分頁以外的情況屬設計：BAT 主行程用 `child_process` 起的 Electron 子程序（Terminal Server、claude 的 `ELECTRON_RUN_AS_NODE` fallback）會被 Electron 加上這兩個變數，成為 BAT crashpad 的 client。

#### 3. 對照

| 環境 | 分頁 shell 是否繼承宿主的描述元 | 是否繼承其他分頁的 pty master | 依據 |
|---|---|---|---|
| Linux，Terminal Server 模式 | **是**，30 個來自主行程＋4 個來自 server | **是** | 實測 S1、S2 |
| Linux，direct 模式 | **是**，主行程全部約 50 個 | **是** | 等效實驗 S3、S4 |
| Linux，headless bat-server | **否**。使用者自己的 `~/.local/bat-server`（pid 377）**唯讀**檢查：fd ≥ 3 共 19 個，全部帶 CLOEXEC；當時沒有 PTY 子程序 | **是**。用同一個 bundle 的 node＋`@lydell/node-pty` 1.1.0 另起一個 node 程序測試：第 2 個子程序持有 `20=/dev/ptmx`（第 1 個的 master），第 1 個子程序 fd ≥ 3 為空 | 實測。bat-server 本身沒有動、沒有連線 |
| Windows（ConPTY） | 推論：否 | 推論：否 | 下方說明 |
| macOS | 推論：否 | 推論：否 | 下方說明 |

- Windows 說明（推論）：
  - libuv 在 Windows 的 `uv_spawn` 用 `CreateProcessW(bInheritHandles=TRUE)`，但只繼承標成 inheritable 的 handle。Chromium / Node 建立 handle 預設不可繼承，所以 Terminal Server 推論不會收到主行程的 handle。
  - node-pty 的 ConPTY 以 pseudoconsole 屬性啟動 shell。上游 `conpty.cc` 的 `CreateProcessW` 傳 `bInheritHandles=FALSE`（依上游原始碼；本機只有編譯後的 `conpty.node`，沒有核對）。各分頁 pipe 的 handle 也不可繼承。
  - Windows 的 crashpad 走 named pipe，沒有 fd 繼承的對應機制。
  - 沒有實跑。
- macOS 說明（推論）：
  - microsoft/node-pty PR #867 的說明寫 macOS 已經用 `posix_spawn` + `POSIX_SPAWN_CLOEXEC_DEFAULT`，子程序只拿到明確指定的 fd。
  - libuv 1.45 起在 macOS 也用 `posix_spawn` 並設 `POSIX_SPAWN_CLOEXEC_DEFAULT`（依記憶中的 libuv 原始碼，沒有核對）。
  - 上游 issue #950 提到 darwin 每次 spawn 會在**父程序**留下一個 ptmx fd，屬於父程序資源外流，不會傳給子程序。

#### 4. 來源與修正方向

**每類 fd 的來源**：

1. **Chromium 主行程開的檔案與 socket 不帶 CLOEXEC**。Chromium 自己起子程序時，靠 `base::LaunchProcess` 在子程序端關掉多餘 fd，所以它不設 CLOEXEC。實測：主行程這些 fd `flags` 都沒有 `02000000`。
2. **libuv（Node `child_process`）在 Linux 用 fork＋exec，不關多餘 fd**，只靠 CLOEXEC。所以 `fork(terminal-server.js)`（`electron/main.ts:411`、`:471`）把 (1) 全部帶進 Terminal Server。推論：主行程用 `child_process` 起的**所有**子程序（git、gh、claude CLI、codex、`execFile` 類）也都會收到同一批 fd，這不在本單範圍，記在後續第 3 點。
3. **`@lydell/node-pty` 1.1.0 在 Linux 用 `forkpty`＋`execvp`，子程序端不關 fd**。實測二進位 `pty.node` 匯入的 libc 函式有 `forkpty` / `execvp` / `fcntl64`，沒有 `close`、`close_range`、`syscall`、`opendir`。另外它為每個分頁開的 master **不設 CLOEXEC**（`flags 0104002`，只有 O_NONBLOCK），所以後開的分頁會帶走前面分頁的 master。

**上游狀態**（`gh` 查 microsoft/node-pty）：

- PR **#867**「fix: close inherited file descriptors in child process on Linux」，2026-01-13 merge，修 issue #657 與 microsoft/vscode#58814，進了 1.2.0-beta。做法是在子程序 exec 前呼叫 `pty_close_inherited_fds()`：
  - 先試 `syscall(SYS_close_range, 3, ~0U, CLOSE_RANGE_CLOEXEC)`。
  - 不行就從 fd 3 起逐一 `fcntl` 設 CLOEXEC：「前 16 個無條件試，之後遇到第一個錯誤就停」。
- PR **#986**「set close-on-exec on pty fds in the parent process」仍 open。
- `@lydell/node-pty` 目前 latest = `1.2.0-beta.18`。
- **實測（`gaptest`）**：模擬 Terminal Server，宿主可繼承的 fd 為 30、39（第 1 個 master）、41（第 2 個 master）、60，中間有缺號。

| 版本 | 第 1 個子程序 fd ≥ 3 | 第 2 個子程序 fd ≥ 3 |
|---|---|---|
| `@lydell/node-pty` 1.1.0 | 30, 60 | 30, **39=/dev/ptmx**, 60 |
| `@lydell/node-pty` 1.2.0-beta.18 | **60** | **60** |

  lydell 的 1.2.0-beta 二進位一樣沒有匯入 `syscall`，也就是 `close_range` 那段沒有編進去（推論：建置時的 glibc 2.28 標頭沒有 `SYS_close_range` / `CLOSE_RANGE_CLOEXEC`），只走 fcntl 迴圈，遇到第一個缺號就停。BAT 的 Terminal Server 在 fd 40 有缺號，所以升級後 **41 以後全部還是會漏**，包含 crashpad 74、其他分頁的 master 44 / 45、1023。⇒ **只升級 node-pty 修不完整。**

**修正方向**：

| 方案 | 內容 | 涵蓋 | 副作用 / 風險 |
|---|---|---|---|
| **A（建議先做）BAT 端 exec 包裝** | Linux 上每個 PTY 子程序改經 `/bin/bash -c '<讀 /proc/self/fd，把 ≥3 的關掉>; exec -a "$0" "$@"' <shell> <args…>` 啟動；沒有 `/bin/bash` 時照舊直接 spawn 並記一行 log。只做一個純函式，`electron/terminal-server/server.ts:243`、`PtyManager` direct 分支（`electron/pty-manager.ts:1445`）與它的 `child_process.spawn` fallback（`:1489`）都經它；headless 走同一個 `PtyManager`，自然涵蓋 | Terminal Server、direct、headless 三種模式的主行程 fd、server fd、其他分頁 master、crashpad socket 全部清掉；「背景程序讓 crashpad 留著」也一併解決 | 每個分頁多一次 exec（ms 級）；pid 不變（bash exec 成 shell），T0540 程序樹、`pty:list`、blocked 追蹤、`--close-worker` 都不受影響；`exec -a` 保留 argv[0]。要注意：保留 `-l` 等參數原樣；`$0` 含空白時的引號；Windows / macOS 不套用（D 平台判斷）；需要 Linux e2e：`/proc/<shell>/fd` 只剩 0–2（與 255） |
| B 上游修正後升級 | 到 microsoft/node-pty 提 issue / PR：標頭沒有時定義 `__NR_close_range`（x86_64 / arm64 都是 436），fallback 改成逐一走 `/proc/self/fd`，不要遇缺號就停；另外跟進 #986（master 設 CLOEXEC）。lydell 發版後再升級 `@lydell/node-pty`，並移除 A 的包裝 | 和 A 相同，而且不需要 bash | 時程看上游；目前是 beta；升級需走 Electron 45 / prebuilt 驗證（T0492 不重建原生模組的原則不變） |
| C（只限 PLAN-062）Terminal Server 不當 crashpad client | fork server 時移除 `CRASHDUMP_SIGNAL_FD` / `CRASHPAD_HANDLER_PID`，並在 server 程序的 exec 前關掉那個 fd（要在 fork 時套 exec 包裝。Node 沒有 fcntl，server 起來後不能安全地 `fs.closeSync`，因為 Electron 已經用它註冊了 handler，fd 編號被重用時 crash 處理會寫到錯的 fd） | 「保留 Terminal Server」時主行程 stdio 不再被 crashpad 卡住（PLAN-062 原題） | Terminal Server 當掉時不會產生 crash dump。包裝不能關 fd 3（IPC）與 AppImage keepalive pipe（T0804：server 從 mount 內執行，必須讓 mount 留著），要辨識 keepalive pipe，邏輯較脆弱 ⇒ 需先做實驗，優先度低 |

**與 PLAN-062 的關係**：

- **A / B 解決本單實測到的「選結束 server 仍卡住」變體**：分頁留下的背景程序是 crashpad 唯一剩下的 client，這條外流斷掉後 crashpad 就會結束。
- **但 A / B 不解決 PLAN-062 原題**：保留 Terminal Server 時，server 本身就是 crashpad 的 client（fd 74 = `CRASHDUMP_SIGNAL_FD`，S2 已確認）。那要方案 C。
- ⇒ PLAN-062 只有**部分重疊**。建議 PLAN-062 補記這個變體，狀態維持 IDEA。

**工單草案（交塔台開單）**：

```
BUG-xxx（建議 P2）Linux：PTY 子程序繼承其他分頁的 pty master 與 Electron 主行程的描述元
  重現：Linux（AppImage 或 deb），開兩個 shell 分頁；在第 2 個分頁 `ls -l /proc/$$/fd`，可以看到 /dev/ptmx
        （`grep tty-index /proc/$$/fdinfo/<fd>` = 第 1 個分頁的 pts 編號）、GPUCache / Local Storage 的檔案、多條 socket。
        分頁執行 `setsid sleep 600 &` 後以「離開＋結束 Terminal Server」關閉 → chrome_crashpad_handler 留到 sleep 結束。
  影響：分頁內任何程式不需權杖就能對前面的分頁（含塔台）送輸入、搶讀輸出；Mojo 通道、crashpad 可被干擾；背景程序讓 crashpad 留著。
  範圍：Linux 的 Terminal Server / direct / headless（headless 只有 pty master）；Windows、macOS 推論不受影響。
T0xxx（修正）方案 A：Linux PTY spawn 經 fd 關閉包裝（唯一實作一個純函式；server.ts / PtyManager direct ＋ fallback 共用）
  驗收：Linux e2e（隔離實例，兩個 shell 分頁）：每個 shell 的 /proc/<pid>/fd 只剩 0–2、255；第 2 個分頁沒有 /dev/ptmx；
        背景 `setsid sleep` ＋「離開＋結束 server」→ app.close() < 3 s、沒有殘留 crashpad；
        既有：T0540 程序樹、⏻ 重啟、Recovery、--close-worker、blocked hook 不回歸；沒有 bash 時照舊並記 log。
  文件：CLAUDE.md「關閉分頁時的程序樹」或新節＋ docs/agent-guide。
（可選）上游 issue：microsoft/node-pty pty_close_inherited_fds 的 fallback 遇缺號即停、未定義 SYS_close_range 時不走 close_range（附本單 gaptest 數據）。
```

#### 5. 環境還原 — PASS

| 項目 | 開始前（16:30:42） | 結束後（17:02:35） |
|---|---|---|
| `~/.config/BetterAgentTerminal` | `719d9318bb56913d`，3 項 | `719d9318bb56913d`，3 項（未變） |
| `~/bat-build` | `5bc47cbf8d0639f8`，53196 項 | `5bc47cbf8d0639f8`，53196 項（未變） |
| `~/.codex/config.toml` | sha256 前 16 碼 `0772345e3306d8e0`，mtime 2026-10-19 11:48:52 | 相同 |
| `~/.config/BetterAgentTerminal-runtime-*` | 無 | 無（t0805-s1 … s4 已刪，只刪名稱完全吻合 `t0805-s[0-9]` 的） |
| `/proc/mounts` 的 `mount_BAT` / `.mount_Better` | 0 | 0 |
| `chrome_crashpad` / `terminal-server` / `BetterAgent` / `sleep 9001` 程序 | — | 0 |

（雜湊方式同 T0803 / T0804：`find . -printf '%P|%s|%T@|%y\n' | sort | sha256sum` 前 16 碼＋項目數。）

- 已刪：WSL `~/t0805-tmp`，內容包括 AppImage、`playwright-core`、解開的 node-pty、npm pack 下來的三個版本、`gaptest` 的兩份安裝、驅動與取證腳本、紀錄。Windows scratchpad 的暫存腳本與紀錄在 commit 前刪除。
- 使用者的 headless bat-server（`~/.local/bat-server`）與 docker 內的 bat-server（`/opt/bat-server`，tini 底下）都沒有停止或連線，只讀了前者的 `/proc/<pid>/fd` 與 `fdinfo`。
- 備註：每次 `wsl.exe` 呼叫之間 WSL VM 會自行閒置關機再開（各輪 pid 都從約 1500 起，結束時 `uptime -s` = 16:39:25），所以使用者 bat-server 的 pid 依序是 340 → 377 → 336，是它的服務隨 WSL 開機自動起來的，本單沒有動它。
- `npm i` / `npm pack` 會寫入共用的 `~/.npm/_cacache`，另外一次 `ECONNRESET` 在 `~/.npm/_logs` 留下一份 npm 除錯 log。都是 npm 共用目錄，不在保護清單，沒有清。
- 本機 Windows 的 BAT 安裝版與它的 Terminal Server 完全沒碰。

### 遭遇問題

1. 第 1 輪 direct 等效實驗 `process.mainModule.require('@lydell/node-pty')` 找不到模組（node-pty 在 `app.asar.unpacked`）。第 2 輪 `__filename` 未定義。第 3 輪改用 `Module.createRequire(<resourcesPath>/app.asar/package.json)` 後成功。
2. 第 1 輪的 mount 計數用了 T0804 的 `.mount_Better` 樣式，但本單 AppImage 檔名是 `BAT.AppImage`，mount 叫 `.mount_BAT.*`，所以 S1 的「mounts: 0」不能採信。第 2 輪改正後重測（關閉前 1、關閉後 0）。
3. `/proc/<tid>/syscall` 被 Yama（ptrace_scope=1）擋下，讀到空值，所以沒辦法證實 pipe 50 / 51 是不是 Chromium 的 shutdown pipe，表內標為推論。
4. `gaptest` 第一次的 `npm i` 裝進了上層 `~/t0805-tmp/node_modules`（上層有 `package.json`），改用 `--prefix`；`1.2.0-beta.18` 下載遇到一次 `ECONNRESET`，重試後成功。都在暫存目錄，已一併刪除。

### 互動紀錄

- [16:29] 開工；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；落點檢查 PASS；讀 T0804 回報、PLAN-062、`electron/main.ts`（fork）、`electron/terminal-server/server.ts`（`buildServerPtyEnv` / `pty.spawn`）、`e2e/fixtures/electron-isolation.ts`。
- [16:30] WSL 前置快照；下載 AppImage（SHA-256 一致）、裝 `playwright-core@1.59.1`。
- [16:35–16:50] S1（盤點＋分頁內 probe＋背景程序關閉）、S2（兩個分頁、kcmp、crashpad fd 比對、mount 檢查）、S3 / S4（direct 等效實驗）。
- [16:50–17:00] headless 唯讀檢查；解出 node-pty 二進位看 libc 匯入；`gh` 查上游 PR #867 / #986；`gaptest` 比較 1.1.0 與 1.2.0-beta.18。
- [17:02] 清理與事後快照一致。
- 沒有向塔台提問。

### 子代理與 Workflow 使用

沒有使用。

### Commit

- 本單沒有產品變更，只 commit 本工單（`git commit --only`）。commit hash 見 git log（本回報寫在 commit 之前）。
- `methodology`：本單沒有 `methodology` 欄位，也沒有 `### 方法論邊界`；啟動時沒有看到方法論注入，也沒有呼叫方法論 skill。

### 後續（交塔台）

1. 依第 4 節草案開 BUG（建議 P2）＋修正單（方案 A）。修正單要寫 Linux e2e，並把「pty master 不外流」列為不回歸項。
2. PLAN-062：補記「背景程序讓 crashpad 留著」這個變體（方案 A 會解掉）；原題（保留 Terminal Server）需要方案 C，維持 IDEA。
3. 觀察（不在本單範圍，推論）：同一機制下，主行程以 `child_process` 起的**所有**子程序都會收到 Chromium 的那批 fd，包括 git、gh、claude CLI / Agent SDK、codex、各種 `execFile`。像 claude CLI 這類長時間執行的子程序也會持有 crashpad socket 與 leveldb 寫入 fd。要不要另開查證單由塔台決定（方案 A 只處理 PTY）。
4. 可選：到 microsoft/node-pty 回報 `pty_close_inherited_fds` fallback 的缺陷（附 `gaptest` 數據），對應方案 B。
