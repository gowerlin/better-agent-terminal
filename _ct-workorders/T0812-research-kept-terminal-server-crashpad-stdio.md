---
schema_version: 1
schema_kind: workorder
id: T0812
title: "研究（PLAN-062）：Terminal Server 保留時主行程 stdout / stderr 不關閉——BUG-205/206/207 修正後的現況、可行修法與副作用"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-03T21:11:52+0800"
started_at: "2026-11-03T21:14:58+0800"
updated_at: "2026-11-03T22:15:11+0800"
completed_at: "2026-11-03T22:15:11+0800"
session_ids:
  - "a899e5e0-3513-4f20-abf3-62d104988467"
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

### 完成狀態

- **狀態**：DONE（研究型，驗收 5 項都有證據）
- **結論一句話**：`v0.7.4-pre.4` 三種情境都重現，行為和 `pre.3` 相同（T0806 / T0807 沒有改到這條路徑）。Linux 上可以修：fork Terminal Server 時不讓它接上 crashpad（關掉 crashpad fd），就能解決 `out=$(…)` 和 `| tee`。建議的做法是 **A3**：fork 改走 T0807 的 fd guard，只留 IPC 和 AppImage keepalive，並把 keepalive 放在固定的 fd 4。A3 另外修好查證時找到的一個既有問題：一般啟動、保留 server 離開後，AppImage 的 mount 被卸載，server 從已卸載的 mount 繼續執行，讀不到還沒載入的頁面（`ENOTCONN`）。拿掉 crashpad 的代價是 0：實測目前 Terminal Server 當掉**本來就不產生 dump**。Playwright 搭配 AppImage 的情境修不掉，原因是 AppImage runtime 的 FUSE 程序也持有 Playwright 額外傳入的 fd。Windows 實測有同樣現象，但成因不同：server 自己繼承了主行程的 stdio handle。建議不修 Windows。
- **開始 / 完成時間**：2026-11-03T21:14:58+0800 → 2026-11-03T22:15:11+0800
- **session_id**：a899e5e0-3513-4f20-abf3-62d104988467

### 落點檢查

- 結果：**PASS**
- C-0：工單 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 底下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 底下的本工單 → not applicable
- C-2：工單沒有 `branch` 欄位；目前分支 `main`
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`CT_HOME` 未設定（不是 worktree）

### 環境

- WSL Ubuntu-24.04（kernel 6.18.33.2-microsoft-standard-WSL2，`kernel.yama.ptrace_scope = 1`，WSLg），node v26.13.0（nvm）、`playwright-core@1.59.1`、`@electron/asar`（都裝在 `~/t0812-tmp`，已刪）
- 受測：`v0.7.4-pre.4` AppImage，SHA-256 `34ed1b827395894ad4f8237b01855247ca415d76cfe8d266d2a3af028fbd49cf`（與 release asset digest 一致）；另以 `--appimage-extract` 解開一份（不經 FUSE）。Electron 45.2.1。
- Windows：本機已安裝的 `0.7.4-pre.4`（`C:\Program Files\BetterAgentTerminal`），只以隔離 `--runtime=t0812-w1..w3` 另開實例。
- 每輪一個隔離 runtime（`--runtime=t0812-*`），`BAT_*` / `CT_*` / `ELECTRON_RUN_AS_NODE` 從 env 移除，`BAT_REMOTE_PORT` 用空閒埠。每輪只開一個 shell 分頁：seed 工作區之後確認 Terminal Server 底下有 `bash -l -i`。沒有開 codex / claude 分頁，沒有登入任何服務。
- 關閉確認的回答方式與 `closeIsolated` 相同：在主行程 mock `dialog.showMessageBox`，回答「離開」，「結束 Terminal Server」**不勾**（=預設值）。Playwright 情境經 `app.evaluate` 送出；shell 情境經主行程 Node inspector（`--inspect=<埠>`）送出。
- **方案實驗的做法**（只改執行中的程序，沒有改任何檔案）：在主行程把 `child_process.fork` 換成實驗版本，只對 `terminal-server.js` 生效，改用 `/bin/bash -c '<關 fd>; exec -a "$0" "$0" "$@"' <execPath> <script>` 啟動。接著 SIGKILL 目前的 server，讓 T0704 recovery 經由實驗版 fork 重新起一個 server，之後的關閉流程都在這個 server 上量。另外試過一次「改解開副本裡 app 的 `main.js`」，見〈遭遇問題〉。
- 持有者判定方式：主行程啟動時，記下 fd 1–5 中屬於 pipe 或 socket 的 inode；之後掃 `/proc/*/fd`，並用 `ss -xapn` 對照 socket 的對端。

### 驗收結果

#### 1. `v0.7.4-pre.4` 現況重現 — 三種情境都重現

| 情境（AppImage，保留 server 離開） | 主行程結束 | 外部程式等到 EOF / `close` | 主行程 stdio 的持有者 | 殺掉 server 之後 |
|---|---|---|---|---|
| Playwright `app.close()`（r1） | 1157 ms，code 0 | **逾時 30 s** | `chrome_crashpad_handler` fd 1 / fd 2（socket） | 21 ms 後 `close` |
| `out=$(./BAT.AppImage … 2>&1)`（r2） | 963 ms | **30 s 仍在等** | crashpad fd 1 / 2（pipe）＋ bash 自己的讀取端 | 50 ms 後 `SUBST_DONE`，收到 6658 bytes |
| `./BAT.AppImage … 2>&1 \| tee log`（r3） | 865 ms | **30 s 仍在等** | crashpad fd 1 / 2＋`tee` 的 fd 0 | 50 ms 後 `TEE_DONE status=0 0` |

- 保留下來的 server（例 r3 pid 3426）初始 env 有 `CRASHDUMP_SIGNAL_FD`、`CRASHPAD_HANDLER_PID`（只記名稱），而且持有 1 條 unix socket，對端是 crashpad（x0 / x1 以 `ss` 對端比對）。
- **與 T0804（`pre.3`）比較**：E1 是逾時 29.4 s，主行程 875 ms 結束，持有者是 crashpad fd 1 / 2，殺掉 server 9 ms 後 `close`。`pre.4` 完全相同。T0806 / T0807 只讓分頁 shell 與主行程的其他 child_process 子程序不再拿到 crashpad socket（T0806 F5：「離開＋結束 server」時 `app.close()` 25 ms 返回、沒有殘留 crashpad）。Terminal Server 本身的 fork 刻意包在 `runWithoutChildProcessFdGuard` 裡（`electron/main.ts:418` / `:479`），所以原題沒有變化。
- 對照組：Windows 與 Linux 勾選「結束 Terminal Server」時都正常返回（Windows w3：`exit` 171 ms、`close` 174 ms）。

#### 2. 成因（實測與原始碼各自標明）

1. **crashpad handler 為什麼持有主行程 stdio**
   - 原始碼：handler 由主行程 `crashReporter.start()`（`electron/main.ts:1739`）啟動。Linux 上 crashpad 的 `SpawnSubprocess`（`util/posix/spawn_subprocess.cc`）只執行 `CloseMultipleNowOrOnExec(STDERR_FILENO + 1, …)`，fd 0–2 原樣留給 handler。
   - 實測：stdin 是 `/dev/null`（Playwright 的 fd 0），持有的是 fd 1 / 2。
   - 原始碼：Electron 沒有選項可以改這個行為。`crashReporter.start` 的參數沒有任何一個跟 stdio 有關。
2. **Terminal Server 為什麼是 crashpad client**（原始碼，Electron v45.2.1）
   - `lib/node/init.ts` 在 Linux 上掛勾 `ChildProcess.prototype.spawn` / `spawnSync`：只要 `options.file === process.execPath` 而且 envPairs 有 `ELECTRON_RUN_AS_NODE=`，就在 envPairs **後面**加上 `CRASHDUMP_SIGNAL_FD=<fd>`、`CRASHPAD_HANDLER_PID=<pid>`。所以就算呼叫端的 `env` 拿掉這兩個變數也沒用。
   - `shell/app/node_main.cc` 讀這兩個變數，把 fd 登記為 `kCrashDumpSignal`，再呼叫 `InitializeCrashpad(false, "node")`。
   - 那個 fd 沒有 `FD_CLOEXEC`，Terminal Server 的 fork 又不經 fd guard，所以 server 直接繼承它。
3. **crashpad 什麼時候結束**
   - 原始碼：`handler/linux/exception_handler_server.cc` 的 `Run()` 是 `while (keep_running_ && clients_.size() > 0)`；client socket 收到 `EPOLLHUP`（持有對端的程序全部關閉）時移除。
   - 實測：所以「誰持有那個 fd」才是關鍵，env 不是。**A0**：去掉 env、fd 照樣繼承，結果照樣逾時，crashpad 也還在。
4. **實測：目前 Terminal Server 當掉不產生 dump**（WSL Ubuntu 24.04，`ptrace_scope = 1`）
   - pre.4 原樣（解開版 x0 / x1），`Crashes/` 都**沒有新檔**：
     - server 以 Node inspector 執行 `process.crash()`；
     - `kill -SEGV` server；
     - 主行程 fork 的 `ELECTRON_RUN_AS_NODE` 子程序執行 `process.crash()` / `process.abort()` / SIGSEGV。
   - 同一實例的 renderer（CDP `Page.crash`）和主行程（`process.crash()`）都產生了 `pending/<id>.dmp`。
   - 原因沒有查證（推論：Linux 的 node 模式 client 在這個環境沒有接成功，候選原因是 ptrace 限制或訊號處理，未驗）。原生 Ubuntu 沒有實測。⇒ 讓 server 不當 crashpad client，**目前**不會少掉任何 dump。
5. **查證中找到的兩個相關機制**（實測）
   - **(a) 啟動方另外傳入的 fd**：Playwright 會傳 fd 3 / 4（socket）。Terminal Server 會繼承 fd 4（fd 3 被 fork 的 IPC 蓋掉），所以只關 crashpad fd（A1）時，Playwright 還是等不到 `close`：解開版 a1，持有者是 server 的 fd 4。
   - **(b) AppImage keepalive**：AppImage runtime 的 FUSE 程序持有 keepalive pipe 的寫入端。讀取端的持有者全部結束後，FUSE 程序就卸載 mount 並結束。
     - 一般啟動（pipe 或 `/dev/null`，沒有額外的 fd）時，keepalive 在主行程的 **fd 3**，fork 時被 IPC 的 fd 3 蓋掉，所以 **server 沒有持有 keepalive**。主行程一結束，mount 就卸載了，但 server 還在 `/tmp/.mount_*/BetterAgentTerminal.bin` 上跑。
     - 實測（rl-base）：`/proc/<server>/exe` 指向 `/BetterAgentTerminal.bin`，從 64 MiB 處讀回 **`ENOTCONN`**，`/proc/mounts` 裡已經沒有這個 mount。重開並回答「還原」後，server 和 shell 仍然能用（`echo` 寫出 `T0812_42`）。推論：server 之後若需要載入還沒載過、或已被回收的程式碼 / 資料頁，會收到 SIGBUS。這是**既有問題**，跟 PLAN-062 無關（T0805 推論過 crashpad 有同樣的問題，這次確認 server 本身也有）。
     - Playwright 啟動時 keepalive 在 fd 5，server 有繼承到，mount 會留著（T0804 E1 的情況）。
     - FUSE 程序本身也持有啟動方額外傳入的 fd（Playwright 的 fd 3 / 4），但沒有持有 fd 0–2（都是 `/dev/null`）。

#### 3. 候選修法比較表（Linux 實測，A 系列都用原版 AppImage；Playwright 另外補測解開版）

方案說明：

- **A0**：server 不帶 crashpad env，fd 照樣繼承。
- **A1**：只關 crashpad fd。
- **A2**：fd ≥ 3 只留 IPC 和 keepalive，keepalive 維持原本的 fd 編號。
- **A3（建議）**：fd ≥ 3 只留 IPC，keepalive 以 `stdio[4]` 放到固定的 fd 4。

| 方案 | server env 有 crashpad 變數 / 有連到 crashpad 的 socket | `out=$(…)` | `\| tee` | Playwright（AppImage） | Playwright（解開版） | mount / server exe（一般啟動，主行程結束後） | 備註 |
|---|---|---|---|---|---|---|---|
| 現況 | 有 / 1 | 等到 server 結束 | 等到 server 結束 | 逾時 | 逾時（x0） | **已卸載 / `ENOTCONN`** | — |
| A0 | 無 / 1 | 未測（推論：同現況） | 未測 | — | 逾時（a0，持有者是 crashpad） | — | 證明是 fd 讓 crashpad 留著，不是 env |
| A1 | 無 / 0 | **906 ms** | **913 ms** | 逾時（Playwright 的 fd 4 被 server 和 FUSE 持有） | 逾時（server 持有 Playwright 的 fd 4） | 未改善（推論：同現況） | server 有 76–79 個 fd |
| A2 | 無 / 0 | **908 / 915 ms** | **912 ms** | 逾時（只剩 FUSE 持有 fd 3 / 4） | 未測（推論：返回，同 A3） | 已卸載 / `ENOTCONN` | server 只剩 30–31 個 fd |
| **A3** | 無 / 0 | **908 ms** | 未測（推論：同 A2，兩者只差 keepalive 的位置） | 逾時（只剩 FUSE 持有 fd 3 / 4） | **27 ms 返回**（server 保留） | **mount 留著 / exe 可讀** | server 有 30–31 個 fd |
| B：crashpad 不持有主行程 stdio | — | — | — | — | — | — | 不可行：Node 沒有 `dup2`，沒辦法在 `crashReporter.start` 前後暫時換掉 fd 1 / 2；Electron / crashpad 都沒有選項；要做只能加原生模組。不建議 |
| C1：不修，只寫文件 | — | 照舊 | 照舊 | 照舊 | 照舊 | 照舊 | 影響面小：桌面啟動的 stdio 是 `/dev/null` 或 journal，systemd 不等 stdout EOF |
| C2：關閉確認時另外處理 | — | — | — | — | — | — | 沒有可行做法：主行程結束後，crashpad / server 持有的 fd 已經不歸主行程管 |

各方案的副作用（A 系列，實測）：

- **dump**：server 本來就不產生 dump（第 2 節第 4 點），拿掉沒有損失。A3 實例的 renderer `Page.crash` 照樣產生 `pending/<id>.dmp`。主行程 dump 不受影響：A 系列只改 server 的 fork；主行程的 dump 只在 baseline（x1）實測過，A 系列下推論相同。
- **T0704 recovery**：8 輪 swap 都是「SIGKILL server → `reason=ipc-exit` → `re-forked with pid …` → `recovery complete` → 分頁以 shell 重建」，正常。實作時 `reforkTerminalServer` 走同一個 helper。
- **T0578 / BUG-146 Recovery 提示**（rl-base / rl-A2 / rl-A3）：保留 server 離開後重開同一個 runtime，log 依序出現：
  - `1 live PTYs detected — deferring to user recovery decision`
  - `pty:create held`
  - 按「還原」後 `user chose recovery — connected to port …`
  - `released … 1 held create(s)`

  還原後 server pid 不變，原 shell 照常執行指令。之後以「離開＋結束 server」關閉，server 正常結束。三種做法結果相同。
- **headless**：不受影響。bat-server 不 fork Terminal Server，`createHeadlessServer` 用 `PtyManager` direct。
- **AppImage mount**：A3 讓 server 持有 keepalive，FUSE 和 mount 會留到 server 結束。T0804 E1 在 Playwright 啟動時本來就是這樣；一般啟動則從「卸載」變成「保留」，等於修好第 2 節 5(b)。
- **實作規模**：小到中。主行程兩個 fork 點收成一個 helper；fd guard 加一個「去掉 crashpad env」的範圍旗標；新增 keepalive 偵測；加上單元測試和 Linux e2e。見第 5 節。

#### 4. Windows / macOS 對照

- **Windows（實測，隔離實例 w1–w3，已安裝的 pre.4）**：stdout / stderr 用 pipe、保留 server 離開時，`exit` 166 / 169 ms，`close` **20 s 未觸發**，留下 `--type=crashpad-handler` 和 server。
  - w2 先結束 crashpad-handler，`close` 5 s 內**仍未觸發**；再結束 server，80 ms 後觸發。⇒ Windows 上持有主行程 stdio 的是 **server 本身**。原因（原始碼推論）：libuv 在 Windows 以 `bInheritHandles=TRUE` 呼叫 `CreateProcessW`，主行程所有可繼承的 handle 都會帶給 server，`stdio: 'ignore'` 管不到。
  - crashpad 方面（原始碼 `client/crashpad_client_win.cc`）：handler 以 `STARTF_USESTDHANDLES` 接收可繼承的 std handle；非 persistent 模式下，所有 client 斷線才結束。node 模式在 Windows 一律 `InitializeCrashpad(false, "node")`。⇒ crashpad 可能也持有 stdio，但被 server 擋住看不出來（推論）。
  - **方案 A 對 Windows 無效**。要修得讓 server 不繼承 handle（`PROC_THREAD_ATTRIBUTE_HANDLE_LIST`，或主行程清掉 std handle 的 inherit 旗標），兩者都要原生程式碼。Windows 是 GUI 子系統，很少有人以擷取 stdout 的方式啟動；repo 的 Windows e2e 一律經 `closeIsolated` 勾選結束 server。⇒ **建議不修**，寫進文件即可。
- **macOS（只有推論，沒有機器）**：
  - crashpad `handler_main.cc` 在 Apple 平台（不是由 launchd 啟動時）會執行 `CloseStdinAndStdout()`，**只保留 stderr**。
  - node 模式子程序一律 `InitializeCrashpad`；子程序繼承 task exception port，handler 要等 send right 全部消失才結束。
  - libuv 在 macOS 用 `posix_spawn`＋`POSIX_SPAWN_CLOEXEC_DEFAULT`，server 不繼承主行程其他的 fd。
  - ⇒ 推論：`$(…)` 只擷取 stdout 時不卡；擷取 stderr（`2>&1`、`2>&1 | tee`）時會卡到 server 結束。這只是推論；mac 只出 arm64 dmg，用量小，建議不處理。

#### 5. 建議與實作工單草案

**建議**：修 Linux，採 **A3**，優先度 P3。理由：

1. 一個改動同時解決 PLAN-062 原題（`out=$(…)`、`| tee`、以 pipe 收輸出的外部程式）和第 2 節 5(b) 的既有問題（mount 被卸載、server 頁面讀不到）。5(b) 有讓保留下來的 server 當掉的風險（推論），比 PLAN-062 本身更值得修。
2. server 不再繼承主行程約 70 個 Chromium fd（leveldb、GPU / 網路 socket 等），補上 T0807 刻意留下的缺口。
3. 拿掉 crashpad client 實測沒有損失。

不做的部分：Windows、macOS、Playwright＋AppImage（FUSE runtime 持有 Playwright 額外傳入的 fd，不在 BAT 能控制的範圍，測試照舊用 `closeIsolated`）。

另外建議塔台把 5(b) 開成 BUG（P2–P3），由同一張實作單修掉；或者先開 BUG，再判斷要不要併進來。

**實作工單草案**

```
標題：Linux：Terminal Server 的 fork 改經 fd guard——只留 IPC 與 AppImage keepalive、不當 crashpad client（PLAN-062、<5(b) 的 BUG>）
priority: P3，sizing: M
affects_files:
  - electron/main.ts（兩個 fork 點收成一個 helper，例 forkTerminalServer；拿掉 runWithoutChildProcessFdGuard）
  - electron/child-process-fd-guard.ts（加一個範圍旗標，例 runWithoutCrashpadClient(fn)：該次 spawn 從 envPairs 去掉
    CRASHDUMP_SIGNAL_FD / CRASHPAD_HANDLER_PID，guard 因此不保留那個 fd）
  - electron/appimage-keepalive.ts（新增：findAppImageKeepaliveFd(deps)——只在 process.env.APPIMAGE 有值時，
    找出「主行程持有、另一端在 exe === APPIMAGE 的程序手上」的 pipe fd；找不到回 null）
  - electron/__tests__/child-process-fd-guard.test.ts、electron/__tests__/appimage-keepalive.test.ts（新增）
  - e2e/linux/<新 spec 或擴充 t0807>.spec.ts、.github/workflows/linux-acceptance.yml（如需新 step）
  - CLAUDE.md「Linux child_process 子程序只保留 stdio」節、docs/agent-guide/linux-pty-fd-inheritance.md
必守規則：
  - 只有 Linux。Windows / macOS 的 fork 參數、env、日誌完全不變（Windows 的同類現象另記在文件，不修）。
  - fork 的 stdio：有 keepalive → ['ignore','ignore','ignore','ipc', <keepalive fd>]；沒有 → ['ignore','ignore','ignore','ipc']
    （🔴 不得用 'ignore' 佔第 5 格：libuv 遇到 UV_IGNORE 不碰 fd 4，guard 又會保留 < stdio 數的 fd，
    結果會留下主行程的 fd 4。T0812 實驗碼就踩過這一點）。
  - server 的 fd 只剩 0–3（＋keepalive 時的 4），env 沒有 CRASHDUMP_SIGNAL_FD / CRASHPAD_HANDLER_PID。
  - pid = server（wrapper exec 成 server）、argv / env / cwd / detached 照 T0807 的規則；T0704 re-fork 走同一個 helper；
    headless 不受影響。
  - keepalive 偵測失敗 → 照舊啟動（不帶 keepalive），記一行 [terminal-server] … 的 debug log，不丟例外。
  - Terminal Server 不再產生 crash dump（T0812 實測：目前本來就沒有）；文件寫明。
驗收：
  - npm run typecheck:electron = 0、npm run test:unit、npx vite build。
  - 單元測試：範圍旗標去掉兩個 env pair 且不保留該 fd；旗標可巢狀、例外後還原；keepalive 偵測以假 /proc 涵蓋
    （有 / 沒有 APPIMAGE、多個 pipe、讀取失敗）。
  - linux-acceptance（AppImage，隔離 runtime，只開 shell 分頁）：
    K1 保留 server 離開後，主行程 fd 1 / 2 對應的 inode 沒有任何持有者（等同 `out=$(…)` 會返回；
       也可以直接用 bash -c 'out=$(…)' 計時，上限 10 s）；
    K2 server 的 /proc/<pid>/fd 只有 0–4、env 沒有兩個 crashpad 變數名稱、`ss` 找不到對端是 crashpad 的 socket；
    K3 一般啟動（沒有額外 fd）時，主行程結束後 /proc/mounts 仍有該 mount，讀 /proc/<server>/exe 的後段不出錯；
    K4 重開同一個 runtime 出現 Recovery 提示，按「還原」後原 shell 能執行指令；
    K5 renderer Page.crash 仍產生 pending/*.dmp；
    T0806 F1–F6、T0807 G1–G3 不回歸。
  - 注意：Playwright＋AppImage 的 app.close() 仍會等（FUSE 持有 Playwright 的 fd 3 / 4），e2e 一律沿用 closeIsolated；
    K1 以 /proc 判定，不要拿 app.close() 計時。
```

### 其他觀察（交塔台，不在本單範圍）

1. **5(b) AppImage mount 在保留 server 時被卸載**（實測 `ENOTCONN`）：見第 2 節，建議開 BUG。
2. **Linux 上 node 模式子程序不產生 crash dump**（實測）：包含 Terminal Server，以及主行程 fork 的任何 `ELECTRON_RUN_AS_NODE` 子程序。原因未查。如果需要 server 的崩潰資訊，可以考慮 Node 的 `--report-on-fatalerror` 之類的替代方案（推論，未試）。
3. T0807 的 guard 對 `ELECTRON_RUN_AS_NODE` 子程序會保留 `CRASHDUMP_SIGNAL_FD` 那個 fd（這是設計）。所以這類子程序如果活得比主行程久（例：claude 的 `ELECTRON_RUN_AS_NODE` fallback），也會讓 crashpad 和主行程的 stdio 留著（推論）。正常情況下這些子程序會跟主行程一起結束，影響小。

### 環境還原 — PASS

| 項目 | 開始前（21:18:00） | 結束後（22:12:21） |
|---|---|---|
| `~/.config/BetterAgentTerminal` | `8e5e8b4e57f7e127`，3 項 | `8e5e8b4e57f7e127`，3 項 |
| `~/bat-build` | `5bc47cbf8d0639f8`，53196 項 | 相同 |
| `~/.claude` | `07e55568f7aef3b6`，9 項 | 相同 |
| `~/.codex/config.toml` | `0772345e3306d8e0`，mtime 2026-10-19 11:48:52 | 相同 |
| `~/.config/BetterAgentTerminal-runtime-*` | 0 | 0 |
| `/proc/mounts` 的 `/tmp/.mount_*` | 0 | 0 |

- 雜湊方式同 T0804：`find . -printf '%P|%s|%T@|%y\n' | sort | sha256sum` 取前 16 碼，加上項目數。
- 已刪除：WSL 的 `~/t0812-tmp`（AppImage、解開的 `squashfs-root`、`playwright-core`、`@electron/asar`）、`~/t0812-scripts`（驅動腳本）、`/tmp/t0812-*`，以及 Windows scratchpad 裡的驅動腳本。
- WSL 原本在跑的兩個 bat-server（`~/.local/bat-server`，以及 `/opt/bat-server` 的 tini 服務）都沒有碰。它們的 pid 前後不同，原因是 WSL VM 開工時是 `Stopped`，閒置時會自動停機、下次 `wsl.exe` 再啟動，服務隨 VM 重新啟動。
- 收尾後 `ps` 沒有任何 `BetterAgent` / `terminal-server` / `chrome_crashpad_handler` / `.mount_` 程序。
- Windows：本機正在使用的 BAT（主行程 41104、它的 Terminal Server 36716）結束後仍在執行，沒有碰。隔離實例 w1–w3 收尾時：只結束 pid 檔屬於該 runtime 的 `terminal-server.js`，以及 w2 該 runtime 的 crashpad-handler；之後 `%APPDATA%` 已經沒有 `runtime-t0812*`。
- `npm i` 會寫入 npm 共用快取 `~/.npm/_cacache`，沒有清（共用快取，不在保護清單）。

### 遭遇問題

1. `wsl.exe -- bash -lc "<指令>"` 的外層 shell 會先展開 `$var`，導致兩次跑錯：
   - A0 / A1 第一次跑成 baseline；
   - 一批 4 輪的 runtime 名稱變成 `20000`，情境也錯，而且在主行程還沒結束時就收掉 server，T0112 因此又 fork 了一個 server。這些程序與目錄都屬於本單，驅動腳本的 final reap 已收掉並刪除。

   這幾輪都**不採計**，之後一律改成在腳本檔裡執行。
2. 「改解開副本裡的 `main.js`」那次試驗：第一次 log shim 的換行跳脫寫錯，`fork` 丟出 `SyntaxError`，server 沒有起來，驅動腳本中斷，留下 x0 的 server / crashpad。以 `BAT_USER_DATA` 比對（沒有印值）確認後已結束。之後改用「執行中替換 fork＋T0704 re-fork」的做法，那份解開副本也還原成原版 `app.asar`。
3. 第一次 `kill -SEGV` server 看不到 dump，懷疑訊號來源被過濾，改用 `process.crash()`（Node inspector 經 SIGUSR1 開啟，只對本單的 server）重測，結果相同（第 2 節第 4 點）。
4. A3 第一版的 bash 包裝無條件保留 fd 4；沒有 keepalive 時，`stdio[4]='ignore'` 不會覆蓋 fd 4，Playwright 的 socket 因此留了下來（ext-A3 第一次逾時）。修正後重跑，27 ms 返回。這一點已寫進實作草案的必守規則。

### 互動紀錄

- [21:14] 開工；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；落點檢查 PASS；讀 PLAN-062、T0804 回報、T0805 / T0807 相關段落、`electron/main.ts`（fork、`crashReporter.start`、`before-quit`）、`e2e/fixtures/electron-isolation.ts`、`e2e/linux/t0806-*.spec.ts`。
- [21:18] WSL 前置快照；下載 pre.4 AppImage（SHA-256 與 release digest 一致）；安裝 `playwright-core@1.59.1`。
- [21:20–21:30] r1（Playwright）、r2（`out=$(…)`）、r3（`| tee`）重現；查 Electron v45.2.1 `lib/node/init.ts`、`shell/app/node_main.cc`，以及 crashpad 的 `spawn_subprocess.cc`、`exception_handler_server.cc`。
- [21:30–21:45] 解開 AppImage；x0 / x1 dump 實測（server、node 模式子程序、renderer、主行程）；A0 / A1（解開版）；找到 Playwright fd 4。
- [21:43–22:12] 原版 AppImage 以「執行中替換 fork」測 A1 / A2 / A3（Playwright、`out=$(…)`、`| tee`、重開＋Recovery 還原、renderer dump）；找到 5(b) keepalive 問題；Windows w1–w3。
- [22:12] 收尾、事後快照一致。
- 沒有向塔台提問。

### Commit

- 本單沒有產品變更，只 commit 本工單（`git commit --only`）。工作區裡其他已修改的檔案（`CLAUDE.md`、`electron/claude-agent-manager.ts` 等，屬並行的 T0815）沒有碰，也沒有 stage。
- `methodology`：本單沒有 `methodology` 欄位，也沒有 `### 方法論邊界`；啟動時沒有看到方法論注入，也沒有呼叫方法論 skill。
