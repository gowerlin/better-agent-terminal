---
schema_version: 1
schema_kind: workorder
id: T0803
title: "BUG-159 驗收：在 WSL Ubuntu（非 root）以 `v0.7.4-pre.3` AppImage 確認 BAT MCP 關閉時手動 codex 分頁不接上共用 daemon"
type: verification
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-03T15:24:09+0800"
started_at: "2026-11-03T15:25:31+0800"
updated_at: "2026-11-03T15:58:54+0800"
completed_at: "2026-11-03T15:58:54+0800"
session_ids:
  - "56020afd-c8d4-4a4c-b4d6-60a3ca0126fb"
depends_on: []
related:
  - "BUG-159；T0651（修正 `5b1be0f5`）；T0648；D249；T0797 / T0798（WSL Ubuntu 24.04 跑 AppImage 的前例、`e2e/linux/`）"
affects_files:
  - _ct-workorders/T0803-bug159-verify-wsl-non-root.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只做驗收，不改任何產品程式、測試、文件、workflow；repo 內唯一可改的檔案是本工單（回報區）。驗收用的腳本、下載的 AppImage、記錄檔一律放 WSL 或系統暫存目錄，收尾刪除。"
  - "🔴 不碰使用者既有資料：WSL 的 `~/.config/BetterAgentTerminal`、`~/bat-build` 不改不刪；BAT 用隔離的 userData（沿用 `e2e/linux/` 或 e2e 既有的隔離方式）。`~/.codex` 只讀與觀察（daemon 的 pid / sock / log 檔），不刪、不改 `config.toml`；測試結束若 daemon 是本單啟動的就停掉它，並在回報寫明怎麼停的。"
  - "🔴 帳號與憑證：不得執行 codex 登入，不得從 Windows 或其他地方複製 codex / OpenAI 憑證到 WSL。WSL 的 codex 已經登入（能直接回應）才可以讓它執行一條無害指令（例 `node -e \"console.log(process.env.BAT_TERMINAL_ID)\"`）；沒有登入就改用不需模型的證據（見〈驗收〉）。回報不寫權杖值、不寫家目錄真實路徑（D176，用 `<使用者資料夾>`）。"
  - "🔴 判讀要能分辨：先做對照組，證明在這個環境下「不帶 `--no-daemon` 的 codex」確實會接上共用 daemon，再看 BAT 開的分頁有沒有接上。對照組不成立（例如這版 codex 沒啟動 daemon），結果就不能當成 PASS，回報 PARTIAL 並寫明原因。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本工單（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0803 — BUG-159 驗收（WSL Ubuntu，非 root）

## 元資料

- **工單編號**：T0803
- **類型**：verification
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T15:24:09+0800
- **預估規模**：M

## 背景

BUG-159（FIXED，T0651 `5b1be0f5`）：BAT MCP 沒注入、BAT 不是系統管理員、手動開的 codex 分頁，可能接上 codex 共用 daemon，分頁內的 helper 讀到另一個分頁的 `BAT_*`。修正：這種分頁在 codex `>= 0.156.0` 時加 `--no-daemon`（`codexNoDaemonDecision`，`electron/bat-mcp-launch.ts`）。本機 Windows 的 UAC 關閉，BAT 一定以系統管理員執行，無法驗收（BUG-159〈狀態〉）。

Linux 一般使用者對 BAT 來說就是「非系統管理員」（`AgentRegistry.isElevated()` 只在 Windows 設定）。本機 WSL Ubuntu-24.04：uid 1000、codex `0.160.0`（`~/.local/bin/codex`，`>= 0.156.0`）、`~/.codex/app-server-daemon/` 存在（daemon 在這裡跑過）、`~/.codex/auth.json` 不存在（是否登入未知）；T0797 已在這台 WSL 跑過 AppImage（WSLg）。塔台決定在這裡以交付版驗收（D249）。

## 範圍

1. 取得 `v0.7.4-pre.3` Linux AppImage（`gh release download v0.7.4-pre.3 -R gowerlin/better-agent-terminal …`，比對 SHA-256），在 WSL 以一般使用者、隔離 userData 執行；Settings 的 BAT MCP 關閉（`batMcpEnabled: false`）。
2. 對照組：共用 daemon 沒在跑時，在 BAT 以外直接執行 `codex`（不帶 `--no-daemon`、沒有非 `features.*` 的 `-c`），確認它會啟動 / 接上共用 daemon（daemon pid、sock、`loaded-threads.json`、程序樹等，用得到的證據都記）。結束後讓 daemon 回到沒在跑的狀態，或保留它當作「已在跑的 daemon」用於第 3 步，二擇一並寫明。
3. 在 BAT 的兩個工作區各開一個**手動** codex 分頁（「+」選單的 Codex CLI，不是 helper 派工）：
   - 記錄 codex 程序的實際命令列（`/proc/<pid>/cmdline`），預期含 `--no-daemon`、沒有 `mcp_servers.bat.*`。
   - 確認兩個分頁的 codex 都沒有接上共用 daemon（與對照組同一組證據）。
   - codex 已登入時：在第二個分頁請 codex 執行 `node -e "console.log(process.env.BAT_TERMINAL_ID)"`，預期是該分頁自己的 id（以 BAT 查到的分頁 id 比對）。
4. 共用 daemon 已在跑（第 2 步留下或另外啟動）時，再開一個手動 codex 分頁，重複第 3 步的檢查，預期仍不接上。

## 不做

- 不改產品程式、測試、文件；不修 BUG（驗收失敗就回報，塔台另開修正單）；不驗 Windows 非系統管理員；不驗 helper 派工的 codex Worker（它走 embedded，BUG-159 已說明不受影響）。

## 驗收

- [ ] AppImage 版號與 SHA-256（附指令與輸出）
- [ ] 對照組成立：不帶 `--no-daemon` 的 codex 會接上共用 daemon（附證據）；不成立則 PARTIAL
- [ ] BAT 手動 codex 分頁命令列含 `--no-daemon`、不含 `mcp_servers.bat.*`（附 cmdline）
- [ ] 兩個分頁（daemon 沒在跑 / 已在跑兩種情況）都沒接上共用 daemon（附證據）
- [ ] codex 已登入時：`BAT_TERMINAL_ID` = 該分頁自己的 id；未登入則寫明略過
- [ ] 環境還原：隔離 userData、下載檔、暫存腳本已刪；daemon 狀態回到開始前；`~/.config/BetterAgentTerminal`、`~/bat-build`、`~/.codex/config.toml` 未變（附前後雜湊或時間戳）
- [ ] 結論：PASS（塔台結 BUG-159）/ FAIL（附重現步驟）/ PARTIAL（附缺少哪個證據）

---

## 回報區

### 完成狀態

- **狀態**：DONE（驗收結論 **PASS**：BAT 手動開的 codex 分頁沒有接上共用 daemon）
- 🔴 **重大偏差（違反工單紅線，必讀〈遭遇問題〉第 1 點）**：補做不需模型的 `!` 指令取證時，按鍵落在 codex 的登入畫面，**意外完成了 WSL codex 的 ChatGPT 登入**（`~/.codex/auth.json` 於 15:46:15 建立）。Worker 已在 15:53:43 以 `codex logout` 還原為「Not logged in」、`auth.json` 已不存在；登入期間沒有用它做任何事。
- **完成時間**：2026-11-03T15:58:54+0800
- **session_id**：56020afd-c8d4-4a4c-b4d6-60a3ca0126fb

### 落點檢查

- 結果：**PASS**
- C-0：工單 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 底下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 底下的本工單 → not applicable
- C-2：工單沒有 `branch` 欄位；目前分支 `main`
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`CT_HOME` 未設定（非 worktree）

### 環境

- WSL：Ubuntu 24.04.5 LTS、kernel 6.18.33.2-microsoft-standard-WSL2、uid 1000（一般使用者）、WSLg（`DISPLAY=:0`）
- codex：`<使用者資料夾>/.local/bin/codex` → standalone `0.160.0`（`codex --version` = `codex-cli 0.160.0`）；daemon 套件 `~/.codex/packages/app-server-daemon/current` 開始時是 `0.163.0`（測試中被 codex 自動更新到 `0.166.0`，見〈遭遇問題〉第 3 點）
- 開始時：WSL 是 Stopped 狀態、沒有任何 codex / app-server 程序；`~/.codex/app-server-daemon/daemon.pid`（Oct 19 的舊檔，pid 7608，程序不存在）、`loaded-threads.json`（`[]`）存在；`app-server-control/` 只有 `app-server-startup.lock`；`codex login status` = `Not logged in`、`~/.codex/auth.json` 不存在
- WSL 環境沒有任何 `BAT_*` / `CT_*` 變數（`compgen -e` 名稱檢查）

### 驗收結果

#### 1. AppImage 版號與 SHA-256 — PASS

```
gh api repos/gowerlin/better-agent-terminal/releases/tags/v0.7.4-pre.3 -q '.assets[] | select(.name|test("AppImage|linux|yml")) | "\(.name) \(.size) \(.digest)"'
BetterAgentTerminal-0.7.4-pre.3.AppImage 353747924 sha256:4f6bfd63a6cdcd74496c2edb01b905842119d7ff7ef489ba116d6c980d149a05

gh release download v0.7.4-pre.3 -R gowerlin/better-agent-terminal -p 'BetterAgentTerminal-0.7.4-pre.3.AppImage'
sha256sum（Windows 下載檔）       4f6bfd63a6cdcd74496c2edb01b905842119d7ff7ef489ba116d6c980d149a05
sha256sum（複製到 WSL 後）        4f6bfd63a6cdcd74496c2edb01b905842119d7ff7ef489ba116d6c980d149a05
```

- release 沒有 `latest-linux.yml` 或 SHA256SUMS 資產，比對對象是 GitHub release API 的資產 `digest`，一致。
- 執行中的 app：`app.getVersion()` = `0.7.4-pre.3`。

#### 2. 對照組 — 成立

在 BAT 以外、`~/t0803-tmp/ctl` 目錄直接執行 `codex`（不帶 `--no-daemon`、沒有 `-c`），共用 daemon 原本沒在跑：

- 第 1 次（15:29，`setsid script -qfc codex`）：12 s 內 TUI（pid 1441）自己 fork 出共用 daemon：
  - `1506 ppid=1441 :: <使用者資料夾>/.codex/packages/app-server-daemon/releases/0.163.0-x86_64-unknown-linux-musl/bin/codex app-server --listen unix:// --managed-daemon`
  - `1613 ppid=1441 :: … codex app-server daemon pid-update-loop`
  - `daemon.pid` 改寫為 `{"pid":1506,…}`，出現 `app-server-control/app-server-control.sock`（symlink → `/tmp/codex-daemon-1000/63c13d…` 監聽 socket，`ss -xapn` 為 pid 1506 的 LISTEN）。
  - `script` 不回應終端查詢，TUI 停在查詢、沒有畫面，所以改用 tmux 再做一次。
- 第 2 次（15:30，`tmux -L t0803 new-session -d -s ctl -x 120 -y 30 codex`，tmux 會回應終端查詢）：
  - 同樣由 TUI（pid 3053）fork 出 daemon `3125 ppid=3053 … app-server --listen unix:// --managed-daemon` 與 `pid-update-loop`，`daemon.pid` = 3125、control socket 出現。
  - TUI 畫面（`tmux capture-pane`）顯示它**已連上 daemon 並比對設定**：
    ```
    Background server has incompatible feature settings
    This session requires api_key_model_discovery to be disabled
    Restart will use these shared feature settings: …
    1. Run without daemon this time
    2. Restart with these settings
    › 3. Cancel
    ```
  - 選 3（Cancel）後 TUI 結束；`codex app-server daemon stop` → `{"status":"stopped",…}`；`pid-update-loop` 以 SIGTERM／SIGKILL 結束，回到「daemon 沒在跑」。
- 判讀：不帶 `--no-daemon` 的 codex **一啟動就啟動共用 daemon 並連上去**（daemon 是它的子程序、畫面是只有連上 daemon 才會出現的提示）。對照組成立。
- 附註：這台的 CLI（0.160.0）與 daemon 套件（0.163.0）版本不同，所以 TUI 停在相容性提示，沒有實際把 session 跑在 daemon 上（要選 2 才會，而選 2 會讓 daemon 記住共用設定，故未選）。版本一致時就會直接跑在 daemon 上，這正是 BUG-159 的情境。

#### 3. BAT 手動 codex 分頁的命令列 — PASS

AppImage 在 WSL 以一般使用者執行：Playwright `_electron.launch`（`playwright-core@1.59.1`，`chromiumSandbox: true`）、`--runtime=t0803-<ts>`（userData `<使用者資料夾>/.config/BetterAgentTerminal-runtime-t0803-<ts>`）、`BAT_*` / `CT_*` 不帶入、`HISTFILE=/dev/null`。以 `electronAPI.settings.save` 設 `batMcpEnabled: false`，種兩個工作區 `t0803-ws1` / `t0803-ws2`（各一個 shell 分頁）後 reload；`settings.batMcpEnabled` 讀回 `false`。每個 codex 分頁都是點側欄工作區 → 縮圖列「+」→「Codex CLI」開的（不是 helper 派工）。

主行程判斷（debug log）：

```
[codex-version] path=<使用者資料夾>/.local/bin/codex version=0.160.0 (probed)
[bat-mcp] tab agent=codex-cli terminal=25f7da90-d5f7-40af-ac60-42049ff8ab8c → injected: --no-daemon; mcp=no (turned off in Settings)
[bat-mcp] tab agent=codex-cli terminal=f1c686d4-f6e7-4d94-8b01-7b50071d9608 → injected: --no-daemon; mcp=no (turned off in Settings)
[bat-mcp] tab agent=codex-cli terminal=dc4e94b0-bdca-47e0-a532-3ea067c6ffb5 → injected: --no-daemon; mcp=no (turned off in Settings)
[bat-mcp] tab agent=codex-cli terminal=0263d686-8230-4a4b-aebc-430009cd714b → injected: --no-daemon; mcp=no (turned off in Settings)
```

codex 程序實際命令列（`/proc/<pid>/cmdline`；pid 是以 `/proc/<pid>/environ` 裡唯一讀取的 `BAT_TERMINAL_ID` 對到分頁 id 找到的）：

| 分頁 | 工作區 | 開啟時 daemon | codex pid | cmdline | 程序的 `BAT_TERMINAL_ID` = 分頁 id | 含 `mcp_servers.bat` |
|---|---|---|---|---|---|---|
| A `25f7da90-…` | ws1 | 沒在跑 | 2006 | `codex --no-daemon` | 是 | 否 |
| B `f1c686d4-…` | ws2 | 沒在跑 | 2410 | `codex --no-daemon` | 是 | 否 |
| C `dc4e94b0-…` | ws1 | 已在跑（pid 2562） | 2876 | `codex --no-daemon` | 是 | 否 |
| D `0263d686-…` | ws2 | 已在跑（pid 2562） | 3096 | `codex --no-daemon` | 是 | 否 |
| E `e8057a5c-…`（第 2 輪） | ws1 | 已在跑（pid 3665，0.166.0） | 6754 | `codex --no-daemon` | 是 | 否 |
| F `da971ca8-…`（第 2 輪） | ws2 | 已在跑（pid 3665，0.166.0） | 7233 | `codex --no-daemon` | 是 | 否 |

分頁畫面也看得到 shell 送出的是 `<使用者>@… : ~/t0803-tmp/ws1 $ codex --no-daemon`（塔台收單時依 D176 把 WSL 帳號名改成 `<使用者>`）。

#### 4. 兩種情況都沒接上共用 daemon — PASS

證據項目與對照組相同：daemon 程序與父程序、`daemon.pid`、control socket、每個 codex 程序所有 unix socket 的對端（`ss -xapn` 的 peer inode 對回擁有者 pid），以及畫面上有沒有 daemon 提示。每個分頁開出後等 15 s 再檢查。

- **daemon 沒在跑（第 1 輪 phase A，分頁 A / B）**：開完兩個分頁 15 s 後，**沒有任何 `codex app-server` 程序**、沒有 `daemon.pid`、沒有 `app-server-control.sock`。對照組的 codex 1 s 內就 fork 出 daemon，`--no-daemon` 的分頁完全沒有。兩個 codex 各 13 個 unix socket，對端只有 BAT 自己的程序（GPU 1494、network service 1501、crashpad 1503、renderer 1561）與自己，連到 daemon 的 = 0；畫面沒有「Background server …」提示，直接進入 codex 畫面。
- **daemon 已在跑（第 1 輪 phase B）**：BAT 外以 `codex app-server daemon start` 啟動 → `{"status":"started","backend":"pid","pid":2562,"managedCodexVersion":"0.163.0","appServerVersion":"0.163.0",…}`，之後再開 C（ws1）、D（ws2）。15 s 後 A、B、C、D 四個 codex：連到 daemon（2562 / pid-update-loop 2667）的 socket 都 = 0，沒有子 daemon，畫面都沒有 daemon 提示；daemon 的父程序是 WSL init 下的 shell（ppid 966），不是任何分頁。
- **daemon 已在跑（第 2 輪，分頁 E / F）**：daemon 已被 codex 自動更新重啟為 0.166.0（pid 3665，ppid = pid-update-loop 2667）。E、F 連到 daemon 的 socket = 0，沒有子 daemon。
- 截圖：phase A / phase B / 第 2 輪各有截圖（WSL 暫存目錄，已隨收尾刪除）；第 2 輪截圖顯示兩個工作區、縮圖列有 shell 與 Codex CLI 分頁。

#### 5. `BAT_TERMINAL_ID` 由 codex 執行指令取得 — 略過（codex 未登入）

- 開始時 `codex login status` = `Not logged in`、`~/.codex/auth.json` 不存在 → 依工單不讓 codex 執行指令。
- 改用不需模型的證據：每個分頁 codex 程序本身的 `BAT_TERMINAL_ID` 都等於該分頁 id（上表）。`--no-daemon` 時 app server 在 codex 程序內，它執行的指令沿用這份環境；共用 daemon 的 env 則是啟動 daemon 那個程序的 env（BUG-159 的原因）。
- 另外嘗試的 `!` 指令取證**沒有成功**，而且造成意外登入，見〈遭遇問題〉第 1 點。

#### 6. 環境還原 — 大致 PASS，有 codex 自己寫入的變更（見〈遭遇問題〉第 2、3 點）

前後快照（`find . -printf '%P|%s|%T@|%y\n' | sort | sha256sum` 前 16 碼＋項目數）：

| 項目 | 開始前（開工後、下載 AppImage 前） | 結束後（15:55） |
|---|---|---|
| `~/.config/BetterAgentTerminal` | `719d9318bb56913d`，3 項 | `719d9318bb56913d`，3 項（未變） |
| `~/bat-build` | `5bc47cbf8d0639f8`，53196 項 | `5bc47cbf8d0639f8`，53196 項（未變） |
| `~/.codex/config.toml` | sha256 `0772345e3306d8e0ca26e0c7c5773587247e20372e7da14d7285d41cf2826c88`，mtime 2026-10-19 11:48:52 | 相同（未變） |
| `~/.config/BetterAgentTerminal-runtime-*` | 無 | 無（兩輪的隔離 userData 都已刪，`exists=false`） |
| codex / app-server 程序 | 無 | 無 |
| daemon 狀態 | 沒在跑 | 沒在跑（`codex app-server daemon stop` → `stopped`；`pid-update-loop` 以 SIGTERM／SIGKILL 結束） |
| `codex login status` | `Not logged in` | `Not logged in`（中途曾被登入，已 `codex logout`） |
| `~/.bash_history` | mtime 2026-11-03 01:23:57 | 相同；不含 `no-daemon` |

- 已刪除：WSL `~/t0803-tmp`（AppImage、`playwright-core`、驅動腳本、紀錄、截圖、ws1 / ws2 資料夾）、tmux socket `/tmp/tmux-1000/t0803`、Windows scratchpad 的下載檔與腳本。`/proc/mounts` 沒有殘留的 `.mount_Better*`。
- daemon 是本單啟動的（對照組 2 次、`daemon start` 1 次），都以 `codex app-server daemon stop` 停掉（`pid-update-loop` 不會跟著停，另外結束）。
- BAT 結束時 `app.close()` 不會返回：主行程結束後 Terminal Server（`terminal-server.js`）仍在，AppImage runtime 不卸載。第 1 輪手動 SIGTERM 主行程 → terminal-server → crashpad；第 2 輪腳本在 20 s 逾時後自動做。分頁的 PTY 已先 `pty.kill`，收尾後沒有任何帶 `BAT_TERMINAL_ID` 的程序。

#### 7. 結論 — **PASS**（塔台可結 BUG-159）

在非系統管理員（Linux uid 1000）、BAT MCP 關閉的情況下，`v0.7.4-pre.3` 從「+」選單開的 Codex CLI 分頁一律以 `codex --no-daemon` 啟動（6 / 6，兩個工作區，daemon 沒在跑 / 已在跑兩種情況），沒有啟動也沒有連上共用 daemon。對照組證明同一台機器上不帶 `--no-daemon` 的 codex 會啟動並連上 daemon。
限制：codex 未登入，沒有取得「codex 執行的指令看到的 `BAT_TERMINAL_ID`」這項直接證據，改以程序環境與 socket 證據判斷。

### 遭遇問題

1. 🔴 **意外完成 codex 登入（違反工單紅線「不得執行 codex 登入」）**
   - 經過：第 1 輪結束後，分頁的 codex 畫面尾端有「› Ask Codex to do anything」，我判斷可以用 codex 的 `!`（使用者 shell 指令，不經模型）取證，於是開第 2 輪，對分頁 E、F 逐字送出 `!echo T0803MARK=$BAT_TERMINAL_ID:…` 再送 Enter。實際上未登入的 codex 只會短暫顯示輸入框，隨即切到登入畫面；送出的 Enter 選中預設的「Sign in with ChatGPT」，codex 啟動 OAuth（127.0.0.1:1455 回呼）並經 WSL interop 在 **Windows 瀏覽器**開授權頁。瀏覽器已登入 ChatGPT，授權自動完成。
   - 證據：`~/.codex/auth.json` 建立時間 2026-11-03 15:46:15（分頁 E）、修改時間 15:46:29（分頁 F 第二次）；之後 `codex login status` = `Logged in using ChatGPT`；第 2 輪截圖顯示「Finish signing in via your browser」與 authorize 連結。沒有從 Windows 或其他地方複製任何憑證，也沒有輸入帳密。
   - 處置：發現後沒有用這個登入做任何事（沒有讓 codex 執行指令）。2026-11-03 15:53:43 執行 `codex logout` → `Successfully logged out`；`codex login status` = `Not logged in`；`auth.json` 不存在，與開始前相同。
   - 可能殘留（Worker 無法確認）：Windows 瀏覽器可能留著 1–2 個 OpenAI 授權完成頁的分頁；ChatGPT 帳號的「已授權應用 / 裝置」可能出現 Codex CLI 的紀錄（`codex logout` 是否會撤銷伺服器端的權杖未查證）。需要使用者確認（見〈後續〉）。
   - 根因：沒有先確認未登入的 codex 會不會進入可輸入狀態，就在未登入的 TUI 送 Enter。之後不應在未登入的 codex TUI 送任何按鍵。
2. ⚠️ **codex 在 `~/.codex` 產生的 shell 快照含已失效的 BAT 權杖**：登入後 codex 建立了 `~/.codex/shell_snapshots/01a1a05f-7fa7-7733-9d3f-7a46aa0836cf.1793691975595244521.sh`（15:46:15，200147 bytes）。依名稱檢查（只計行數、沒有讀值），內含 `BAT_TERMINAL_ID`、`BAT_REMOTE_TOKEN`、`BAT_REMOTE_PORT`、`BAT_USER_DATA` 各 1 行，是第 2 輪隔離 BAT 分頁的環境。該 BAT 實例已結束、userData 已刪，權杖已無作用；檔內也可能有使用者登入 shell 的其他環境內容。依工單「`~/.codex` 不刪」未處理，交塔台裁示。
3. ℹ️ **codex 自己寫入 `~/.codex` 的其他變更**（執行 codex 本身造成，Worker 沒有改動）：
   - daemon 自動更新：`packages/app-server-daemon/current` 由 `0.163.0` 改指向新下載的 `releases/0.166.0-x86_64-unknown-linux-musl`（15:39，由 `pid-update-loop` 下載安裝並重啟 daemon）；新增 `selection-history`；`auto-update-version`、`install.lock` 更新。standalone CLI 仍是 `0.160.0`。
   - `version.json`（`latest_version` 0.163.0 → 0.166.0，分頁 codex 的更新檢查）、`logs_2.sqlite*`、`memories_1.sqlite`、`queue_1.sqlite-shm`、`.sandbox_migration`、`.tmp`、`skills/.system/`（`imagegen`、`openai-docs` 等系統 skill，登入後安裝）。
   - `app-server-daemon/`：開始前的舊 `daemon.pid`（pid 7608）與 `loaded-threads.json` 在 daemon 停止時由 codex 刪除；新增 `daemon.stderr.log.previous`；`daemon-updater.*` 更新。`config.toml` 未變。
4. ℹ️ AppImage 版 BAT 以 Playwright `app.close()` 關閉時不會返回（Terminal Server 留著，AppImage runtime 不卸載），兩輪都要另外結束程序。這是本單驗收的操作問題，與 BUG-159 無關，沒有進一步查證是不是產品行為（`e2e/linux` 的 T0797 spec 是否遇到相同情況未比對）。

### 互動紀錄

- [15:25] 開工；確認 `CT_MODE=yolo`、`CT_INTERACTIVE=0`；落點檢查 PASS。
- [15:26] WSL 前置快照；`codex login status` = `Not logged in` → 依工單略過「讓 codex 執行指令」。
- [15:27] 下載 AppImage、比對 SHA-256 一致。
- [15:29–15:31] 對照組 2 次（`script`、tmux），都成立；停 daemon。
- [15:32–15:43] 第 1 輪（分頁 A–D，daemon 沒在跑 → `daemon start` → 已在跑）全部 PASS；`app.close()` 卡住，手動結束程序。
- [15:44–15:47] 第 2 輪（分頁 E、F）：daemon 已在跑的檢查 PASS；`!` 取證失敗並造成意外登入。
- [15:53] 發現登入狀態改變 → `codex logout` 還原。
- [15:54–15:57] 停 daemon、刪除暫存、事後快照。

### 子代理與 Workflow 使用

沒有使用。

### Commit

- 本單沒有產品變更；只 commit 本工單（`git commit --only`）。commit hash 見 git log（本回報寫在 commit 之前）。

### 後續（交塔台）

1. 🔴 請使用者確認（Worker 依 yolo 不問使用者）：Windows 瀏覽器是否有 OpenAI 授權完成頁的分頁需要關閉；ChatGPT 帳號的已授權應用 / 裝置是否要撤銷 2026-11-03 15:46 的 Codex CLI 登入。
2. ⚠️ 裁示 `~/.codex/shell_snapshots/01a1a05f-….sh`（含已失效 BAT 權杖的環境快照）是否刪除。
3. ℹ️ 是否需要讓 WSL 的 daemon 套件回到 `0.163.0`（codex 自動更新，Worker 未動；codex 下次啟動 daemon 時本來也會更新）。
4. ℹ️ BUG-159 可依本報告結案；`BAT_TERMINAL_ID` 經 codex 執行指令的直接證據，需要在已登入（由使用者自己登入）的環境才能補。
5. ℹ️ AppImage 版 `app.close()` 不返回（〈遭遇問題〉第 4 點）可另開查證單。
