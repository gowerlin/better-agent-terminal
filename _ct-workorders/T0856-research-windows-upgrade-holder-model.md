---
schema_version: 1
schema_kind: workorder
id: T0856
title: "研究：PLAN-065 Windows 升級不中斷終端的 holder 模型（ConPTY 持有者放安裝目錄外、跨版本接回）可行性、方案比較與拆單"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T18:10:49+0800"
started_at: "2026-11-04T18:12:40+08:00"
updated_at: "2026-11-04T18:25:33+08:00"
completed_at: "2026-11-04T18:25:33+08:00"
session_ids:
  - "217e1d8d-4317-406a-895b-3b988be2f051"
depends_on: []
related:
  - "PLAN-065；D285；PLAN-063（T0820 研究、T0821 / T0822 / T0823 / T0825 / T0846 / T0847）；PLAN-059 子項 D（Herdr holder 對照）；T0540（程序樹）；T0578 / T0580（Recovery create hold）；T0704（Terminal Server 存活判定與 recovery）；T0766 / T0767（被中斷的 agent 分頁）；T0816（Linux Terminal Server fork）；T0783（desktop-build.yml 只 build 不發布）"
affects_files:
  - _ct-workorders/T0856-research-windows-upgrade-holder-model.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 唯讀研究：只寫本工單檔，不改程式、不在 repo 內建檔、不開分支、不 push。可讀程式、`node_modules`（electron-builder NSIS 模板、`@lydell/node-pty` 的檔案）、跑唯讀指令與既有單元測試。"
  - "🔴 不碰本機 BAT 安裝版：`C:\\Program Files\\BetterAgentTerminal` 只能列檔案、讀檔案大小 / 版本資訊（唯讀）；不得啟動、結束、重裝、升級、解除安裝它或它的 Terminal Server，不執行任何安裝檔、不跑 `nsis-reinstall-acceptance.ps1`、不觸發任何 GitHub workflow。查詢執行中程序只用唯讀指令（例 `Get-Process` / `Get-CimInstance Win32_Process` 只看名稱、路徑、父程序），回報不記命令列中的權杖或環境變數值。"
  - "🔴 需要實驗時只能在 repo 外的 scratchpad 做（例：寫小腳本以 node 載入 repo 的 `node_modules/@lydell/node-pty` 起一個 shell，看它的 console host 程序與路徑），做完刪除，並在回報區寫明做了什麼。不得以 BAT 安裝版的檔案做實驗。實測不到的寫「推論」。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台（研究型提問上限依 `research_max_questions`）。Git：只 commit 本工單檔（`git add <明確路徑>`，不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0856 — 研究：Windows 升級不中斷終端的 holder 模型（PLAN-065）

## 元資料

- **工單編號**：T0856
- **任務名稱**：研究：PLAN-065 holder 模型的可行性、方案比較與拆單
- **狀態**：DONE
- **類型**：research
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-04 18:10 (UTC+8)

## 研究目標

使用者決定啟動 PLAN-065，先研究再拆單（D285）。目標是產出可以直接拆成實作工單的設計：

**Windows 上，使用者在 BAT 執行中以 NSIS 安裝新版（互動或 `/S`）後，所有分頁的 PTY（shell、執行中的指令、claude / codex）都不被結束，新版 BAT 啟動後原樣接回，不需要 resume。**

使用者裁決的範圍（D285）：
- 涵蓋**全部分頁的 PTY**，不只 agent 分頁。
- **只做 Windows**。macOS / Linux 行為不變，本單只需確認它們換版時目前的實際行為，並說明為什麼不在範圍內。
- 研究結果出來後拆實作單；`0.7.5-pre.1` 等本批實作做完再發。

## 已知資訊

- **T0820**（`_ct-workorders/T0820-research-nsis-upgrade-running-terminal-server.md`，GitHub Actions Windows runner 實測）：NSIS 安裝程式以 TerminateProcess 結束安裝目錄下所有程序（主行程、Terminal Server）。shell 的 ConPTY 由 Terminal Server 持有，所以一起結束。主視窗已關、只保留 server 時也一樣。重開走孤兒清理，沒有 Recovery 提示。
- **PLAN-063 已做**（`v0.7.4-pre.6`–`pre.8` 實機 PASS）：
  - T0823：`build/installer.nsh` `customCheckAppRunning` → 啟動 `--installer-quit-request` → BAT 寫 `installer-quit-record.json` → 完整 quit（含 `stopTerminalServerGracefully`）→ 等安裝目錄下程序結束（15 s）→ 範本原本的 `_CHECK_APP_RUNNING`。
  - T0821 / T0846：升級後說明（`detectUpgradeInterruption`）；T0766 / T0767：被中斷的 agent 分頁一鍵接回。
  - 細節見 `CLAUDE.md`「升級結束終端的提示與說明（PLAN-063 / T0821）」與 `docs/agent-guide/upgrade-interruption.md`。
- **Terminal Server**：主行程以 `forkTerminalServer`（`electron/main.ts`）用 `process.execPath`（安裝目錄裡的 `BetterAgentTerminal.exe`，`ELECTRON_RUN_AS_NODE`）fork，入口在 `electron/terminal-server/`。存活判定與 recovery 見 `CLAUDE.md`「Terminal Server 存活判定與 recovery（T0704）」，Recovery 提示見「Recovery 提示期間的 `pty:create`（T0578）」，程序樹見「關閉分頁時的程序樹（T0540）」。
- **塔台推論（未驗證）**：`@lydell/node-pty` 在 Windows 可能自帶 `conpty.dll` / `OpenConsole.exe`。若 shell 的 console host 是這份 `OpenConsole.exe`，而它放在安裝目錄裡，即使 Terminal Server 搬出安裝目錄，安裝程式仍會結束它，shell 也會跟著結束。請先查證這一點。
- PLAN-059 子項 D：Herdr 每個終端一個 holder 程序，core 可單獨重啟 / 更新（`_ct-workorders/PLAN-059-herdr-comparison-borrowings.md`）。

## 調查範圍與要回答的問題

1. **現況盤點（Windows）**：一個 BAT 分頁從 `pty:create` 到 shell 跑起來，涉及哪些程序與檔案：主行程、Terminal Server、node-pty 原生模組（`.node`）、ConPTY（系統 `conhost.exe`，或 node-pty 自帶的 `conpty.dll` / `OpenConsole.exe`）、shell。逐一列出各自的執行檔路徑（安裝目錄內或外）與父子關係。查證上面那條推論（node-pty 的 Windows build 設定、`useConpty` / `useConptyDll` 等選項、BAT 實際傳的參數），能在 scratchpad 實驗就實驗。標出 NSIS 會結束哪些程序。
2. **holder 要放什麼、放哪裡（主要比較項）**：比較至少以下做法，每種列出：要放到安裝目錄外的檔案與大小、每次升級多佔多少磁碟、啟動耗時、與 Electron / node-pty ABI 的關係、維護成本：
   - (a) 把整個 Electron 執行環境（`BetterAgentTerminal.exe` 與必要的 dll / resources）以版本化副本放到安裝目錄外（例 `%LOCALAPPDATA%\BetterAgentTerminal\holder\<版本>\`），Terminal Server 從副本執行。
   - (b) 獨立的 Node 執行環境（`node.exe`＋Node ABI 的 node-pty prebuilt）當 holder，不依賴 Electron。
   - (c) 每個終端一個極小的 holder（Herdr 模型）。
   - (d) 其他你找到、比上面更小或更穩的做法（例：只把 ConPTY 持有與 shell 的父程序搬出去、Terminal Server 本體維持現狀）。
   最後給推薦與理由。
3. **跨版本接回**：新版主行程怎麼找到並連上舊版 holder（現有的 pid / port / registry 檔與 TCP 協定，`electron/terminal-server/`）；需要的版本協商；協定不相容時的退回路徑（應等於現在的行為：結束＋ PLAN-063 的說明與一鍵接回）。scrollback / replay 怎麼帶過去。舊版 holder 要留到什麼時候、怎麼清掉（全部分頁都關了、下次升級、解除安裝）。
4. **與既有機制的關係**：逐一說明需要怎麼改、會不會回歸：
   - T0823 安裝前請 BAT 結束：有 holder 時應只結束主行程、保留 holder；`installer-quit-record.json` 與 `detectUpgradeInterruption` 的觸發條件怎麼調。
   - T0578 Recovery 提示、T0704 heartbeat / recovery、T0540 程序樹、quit 時「保留 Terminal Server」的對話框、孤兒清理（`killOrphanPtyProcesses`）。
   - 解除安裝：holder 在安裝目錄外，解除安裝程式要結束它並刪除副本（`customUnInstall` 等 NSIS 掛點）。
   - 同版重裝、降級、per-user 與 per-machine 兩種安裝範圍。
5. **安全與企業環境**：從使用者可寫的目錄執行 exe 的風險（被替換、AppLocker / WDAC / SmartScreen / 防毒誤判；本 fork Windows 安裝檔目前有沒有簽章）；per-machine 安裝原本放在受保護的 `Program Files`，搬出後要怎麼驗證副本沒被改（雜湊等）。holder 只監聽 localhost、權杖規則（`CLAUDE.md`「Remote 資安」、「遠端 Tower 通知」）不變。
6. **macOS / Linux 確認**：dmg 換 app、AppImage 換檔時，執行中的 Terminal Server 目前會怎樣（推論即可，附依據）；說明為什麼不在本 PLAN 範圍。
7. **測試策略**：哪些可以單元測試；真實升級怎麼驗（GitHub Actions Windows runner，比照 T0820；可否用 `desktop-build.yml` 從同一分支打兩個不同版號的安裝檔，在發版前就驗「新版接回舊版 holder」）；注意第一個有 holder 的版本只能在升到下一版時實測。

## 研究指引

- 先讀 T0820、T0823 的回報區、`docs/agent-guide/upgrade-interruption.md`、`docs/agent-guide/terminal-server-recovery.md`、`docs/agent-guide/recovery-create-hold.md`、`docs/agent-guide/pty-process-tree.md`、`docs/agent-guide/packaging-release-checks.md`（NSIS 一節）、`build/installer.nsh`。
- 結論要能拿來做決定：每題給建議值與理由，並列出需要使用者決定的事項（例：holder 放哪、磁碟用量上限、協定不相容時的處理）。
- 若研究結論是「做不到」或「成本遠大於效益」，直接寫明並給替代建議，不必硬拆實作單。

## 預期產出（寫在回報區）

- 〈調查結論〉：逐題回答（附 `檔案:行`；實測與推論分開標示）。
- 〈建議方向〉：holder 方案比較表與推薦。
- 〈建議下一步〉：拆成實作工單，每張寫範圍、`affects_files` 預估、規模 S / M / L、依賴、能否並行、驗收方式（含真實升級驗收怎麼做）。另列需要使用者裁決的問題。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **DONE**：七題都有答案；建議方向、拆單與待裁決事項附在下面。唯讀研究，只改本工單檔。
- **結論一句話**：**做得到，規模 L（6 張工單，多數 M）**。關鍵是讓「持有 ConPTY 的程序」（今天的 Terminal Server）從**安裝目錄外**的執行檔啟動。塔台的推論（node-pty 自帶 `OpenConsole.exe`，搬出去也會被結束）**不成立**：node-pty 用系統 `conhost.exe`（實測）。有三個限制要先知道：
  1. **內嵌 claude 程序仍會被結束**。claude-cli 分頁預設用安裝目錄裡的 `claude.exe`，所以 shell 會留下，但 claude 程序會被結束。
  2. **第一個有 holder 的版本 N 只能從 N 升到 N+1 時保住終端**，從 N-1 升上來照樣全部結束。
  3. **N 的解除安裝程式與 quit 行為上線後就改不了**，所以發版前一定要用兩個 `desktop-build` 版本實際跑過一次升級。
- **落點檢查**：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3 不適用（`affects_files` 只有本工單）；C-2 工單無 `branch`。未設 `CT_HOME`。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- **session_id**：217e1d8d-4317-406a-895b-3b988be2f051

### 互動紀錄

- 無提問（yolo；需要使用者決定的事列在〈建議下一步〉的「待裁決」，不卡研究）。三個檢查節點都沒有讀到塔台補充段落。

### 調查結論

標示：✅ 本單實測，📄 讀程式或模板得出，🔸 推論（未實測）。

#### 實驗紀錄（scratchpad，已刪除）

在 repo 外的 scratchpad 做了以下實驗，**沒有動 BAT 安裝版**。對安裝目錄只做了列檔、讀檔案大小、讀 FileVersion、讀簽章狀態，另外查詢了執行中程序的名稱與數量。

| # | 做法 | 結果 |
|---|---|---|
| E1 | 系統 `node.exe`（v26.13.0，ABI 147）載入 repo 的 `@lydell/node-pty` 啟動 `cmd.exe`，再列出程序樹 | ✅ 載入成功（N-API 10，與 Electron ABI 150 無關，載入 4 ms）。子程序：`conhost.exe`，路徑 `\\?\C:\WINDOWS\system32\conhost.exe`，ppid = holder；`cmd.exe`，ppid = holder |
| E2 | E1 後對 holder 做 `Stop-Process -Force`（TerminateProcess） | ✅ 6 秒後 `cmd.exe` 與 conhost 都已結束，與 T0820 對照組 ③ 相同 |
| E3 | 把 `node_modules/electron/dist/electron.exe` 複製成 `bat-pty-holder.exe`，以 `ELECTRON_RUN_AS_NODE=1` 執行，逐一拿掉檔案 | ✅ 最少需要 **exe ＋ `icudtl.dat` ＋ `v8_context_snapshot.bin`**：少了後者 → `FATAL … Error loading V8 startup snapshot file`；少了 `icudtl.dat` → `Invalid file descriptor to ICU data`。`ffmpeg.dll`、`snapshot_blob.bin` 不需要。改名不影響執行。最小組合 261,366,890 bytes |
| E4 | 用 E3 的副本跑 E1、E2 | ✅ 版本 Node 24.22.1 / Electron 45.2.1 / ABI 150。程序樹、強制結束後 shell 跟著結束，都與 E1、E2 相同 |
| E5 | 兩種 runtime 都跑 `pty.kill()`（node-pty 會 `fork` `conpty_console_list_agent`） | ✅ 都在約 1.1 s 內 `onExit`。改名的 Electron 副本 fork 也正常 |
| E6 | 啟動耗時與記憶體（暖快取，本機） | ✅ `-e 0`：node 46–48 ms，Electron 副本 38–62 ms。各持有 1 個 PTY 時：node WS 63 MB / private 37.5 MB，Electron 副本 WS 49.9 MB / private 34.8 MB。複製 261 MB 花 61 ms（暖快取，🔸 冷磁碟估計 1–3 s），SHA-256 250 MB 花 158 ms |
| E7 | 唯讀查詢安裝版（`C:\Program Files\BetterAgentTerminal`） | ✅ per-machine 安裝；172 個檔、共 1251.3 MB；`BetterAgentTerminal.exe` 238.5 MB，FileVersion `0.7.4-pre.9`，**`NotSigned`**；`app.asar.unpacked` 879 MB；node-pty 的 Windows 檔案只有 `conpty.node`（302,080 bytes）與 `conpty_console_list.node`（133,120 bytes）。執行中、路徑在安裝目錄下的 `BetterAgentTerminal.exe` 有 6 個 |
| E8 | 系統 `node.exe` 的簽章 | ✅ `Valid`，簽署者 `CN=OpenJS Foundation` |

實驗後確認 scratchpad 裡沒有殘留程序，目錄已刪除。

#### Q1. 現況盤點（Windows）

| 程序或檔案 | 執行檔 / 載入位置 | 父程序 | 在安裝目錄內？ | NSIS 會結束？ |
|---|---|---|---|---|
| BAT 主行程與 Chromium 子程序 | `<INSTDIR>\BetterAgentTerminal.exe` | 使用者 | 是 | 是（T0823 起先正常結束） |
| Terminal Server（ConPTY 持有者） | 同一個 exe，以 `ELECTRON_RUN_AS_NODE` 執行。📄 `electron/main.ts:389-406` `fork(serverScript, [], { detached: true … })`，沒有指定 `execPath`。腳本 `resources\app.asar.unpacked\dist-electron\terminal-server.js`（`package.json` `asarUnpack`） | 主行程 | 是 | 是（T0823：IPC `server:shutdown`，`main.ts:2466-2470` 強制 `shouldStopServer = true`） |
| node-pty 原生模組 | `…\app.asar.unpacked\node_modules\@lydell\node-pty-win32-x64\conpty.node`，由 server 載入（mapped） | — | 是 | 跟著 server |
| ConPTY | 📄 `conpty.node` 匯入 `KERNEL32.dll` 的 `CreatePseudoConsole` / `ResizePseudoConsole` / `ClosePseudoConsole`，沒有 `conpty.dll` / `OpenConsole.exe` 字串。`@lydell/node-pty` 1.1.0 以 node-pty `1.1.0-beta14` 為基礎、拿掉 winpty（README），沒有 `useConptyDll` 選項（`node-pty.d.ts` 只有 `conptyInheritCursor`）。BAT 只傳 `name` / `cols` / `rows` / `cwd` / `env`（`electron/terminal-server/server.ts:251-257`）。✅ E1：`C:\WINDOWS\system32\conhost.exe` | **server** | 否 | 否，但 server 一死就跟著結束（✅ E2） |
| 分頁 shell（pwsh / cmd / bash） | 系統或使用者路徑 | **server** | 否 | 否，但跟著 conhost 結束 |
| claude-cli 分頁的 claude | 預設 runtime embedded → `resolveClaudeBaseCommand`（`electron/resolve-claude-base-command.ts:20-27`）→ `…\app.asar.unpacked\node_modules\@anthropic-ai\claude-code\bin\claude.exe`（repo 版 335 MB） | shell | **是** | **是**：`FIND_PROCESS` / `KILL_PROCESS` 以路徑前綴比對（`allowOnlyOneInstallerInstance.nsh:68, 94`） |
| codex 分頁 | `defaultCommand: 'codex'`（`electron/agent-runtime/agent-registry.ts:147`），使用者自己裝的 codex | shell | 否 | 否 |
| BAT MCP shim、hooks | 主機上的 `node`（`main.ts:892` `nodeCommand: () => 'node'`）＋ `<INSTDIR>\resources\scripts\*.mjs`（讀完就關檔） | claude | 否（腳本在安裝目錄內，但不佔用） | 否。🔸 主行程不在時（安裝期間）連不到 RemoteServer，安裝期間腳本檔也暫時不存在 |
| `node-pty` kill 用的 `conpty_console_list_agent` | `child_process.fork`，用 holder 自己的 `execPath` | server | 跟著 server | — |

NSIS 結束程序的方式（📄，與 T0820 第 1 節相同，以下是對 holder 有影響的細節）：
- PowerShell 可用時，比對 **`Path.StartsWith('$INSTDIR')`，是字串前綴比對，結尾不帶 `\`**（`allowOnlyOneInstallerInstance.nsh:68, 94`）。⇒ holder 目錄若取名 `C:\Program Files\BetterAgentTerminal PTY Holder` 這類「安裝目錄名稱加字尾」，也會被比中並結束。
- PowerShell 不可用時，以**映像名稱** `BetterAgentTerminal.exe` 比對與結束，不看路徑（`:72, 75, 97, 99`）。⇒ holder 的 exe **不能叫 `BetterAgentTerminal.exe`**。
- 兩種方式都是**逐一結束 PID，不結束整個程序樹**（`Stop-Process` / `taskkill /IM`，沒有 `/T`）。⇒ holder 是主行程的子程序也不會被連帶結束。

#### Q2. holder 要放什麼、放哪裡

各方案需要的檔案（大小取自 E3、E6、E7）：
- **(a) Electron 副本**：`BetterAgentTerminal.exe` 改名，加上 `icudtl.dat`、`v8_context_snapshot.bin`，約 **249.5 MB**。安裝版的 exe 是 238.5 MB，stock `electron.exe` 是 249.8 MB。
- **(b) 獨立 Node**：`node.exe` 約 **85–100 MB**。Node 26 實測 100,097,864 bytes；🔸 Node 24 推論同一量級。
- **兩者都還需要**：`terminal-server.js`（9 KB）＋ node-pty 的 JS 與兩個 `.node`（約 0.5 MB）。
- **不必要的部分**：`ffmpeg.dll`、`snapshot_blob.bin`、`*.pak`、`locales`、GPU dll。

| | (a) Electron 執行環境的版本化副本 | (b) 獨立 Node（官方 `node.exe`） | (c) 每個終端一個 holder（Herdr 型） | (d) 其他 |
|---|---|---|---|---|
| 放到安裝目錄外的檔案 | 約 250 MB／份 | 約 90–100 MB／份 | runtime 同 (a) 或 (b)，共用一份 | 見下方 (d1)–(d4) |
| 每次升級多佔的磁碟 | 以 BAT 版本為 key：每版 +250 MB，舊版要清。🔸 以 Electron 版本為 key 可以跨 BAT 版本共用，但 exe 的版本資源（FileVersion = BAT 版本）每版都不同，內容雜湊也就不同，只能「同一 Electron 版本取第一份」 | 以 Node 版本為 key：Node 不升版就是 0；只有 JS 每版約 0.5 MB。安裝檔約多 30 MB 壓縮後大小（🔸 依 nodejs.org win-x64 zip 推論） | 同左 | — |
| 啟動耗時 | 38–62 ms（✅ E6） | 46–48 ms（✅ E6） | 每開一個分頁多 ~50 ms | — |
| 記憶體 | 1 個程序，private ~35 MB（✅） | 1 個程序，private ~37.5 MB（✅） | **每個分頁** ~35 MB。20 個分頁約 700 MB（🔸 依 E6 推算） | — |
| ABI | 與 BAT 相同（Electron 45 / ABI 150），不用另外測 | node-pty 是 N-API（✅ E1 在 Node 26 / ABI 147 載入），**不綁 Node ABI**。另一個 runtime 要追 Node 安全更新 | 同上 | — |
| 簽章、信任 | 本 fork 的 exe **沒有簽章**（✅ E7）。未簽章的 250 MB exe 被複製到新路徑再執行，🔸 較可能被防毒軟體的行為偵測判成「dropper」 | **OpenJS 簽章**（✅ E8）。改名不影響 Authenticode；AppLocker 發行者規則看的是 OriginalFilename | 同左 | — |
| 維護成本 | 最低：不加建置依賴，複製 BAT 自己的檔案 | 中：Windows build 要下載 `node.exe` 並驗 SHA（`scripts/build-server-bundle.mjs` 已有 linux / darwin 的前例）、`verify-packaged-native` 加檢查、Node 升版時跟著改 | 高：PtyManager 要從「1 個 server」改成「N 個連線」（`electron/pty-manager.ts` 的 `serverProcess` / `tcpSocket` / `serverGeneration` 都是單一，`sendToServer` 有 10 個呼叫點）。heartbeat、recovery（T0704）、replay 全部要改 | — |
| 升級接回 | 需要 | 需要 | 同左。另一個好處：新分頁自然由新版 holder 處理 | — |

(d) 其他做法：
- **(d1) 只把 ConPTY 持有者搬出去、Terminal Server 本體留在安裝目錄**：🔸 等於 (c)。持有者就是呼叫 `CreatePseudoConsole` 的程序，它必須自己轉送 I/O；留在安裝目錄的 server 只剩代理，沒有價值，還多一層 IPC。
- **(d2) 極小的原生 holder（C / Rust，< 1 MB、每個幾 MB 記憶體）**：磁碟最小，但要重寫 node-pty 的 Windows 部分（管線、resize、console process list kill）。CI 要加原生工具鏈，而未簽章的小型原生 exe 被誤判的風險不比 (a) 低。規模 XL。不推薦。
- **(d3) 轉交 handle（`DuplicateHandle` 把 ConPTY 管線交給安裝目錄外的程序）**：node-pty 沒有開放這些 handle，HPCON 也不能跨程序。不可行。
- **(d4) 換安裝技術（像 Squirrel 那樣用 `app-<ver>` 並排目錄，舊版程序留在舊目錄）**：要換掉 electron-builder NSIS 與 T0823 的整套機制。不划算。

**位置**（Q2 與 Q5 一起決定）：holder 檔案放在「**與安裝目錄同等保護、但路徑前綴不同**」的地方。
- per-user（`perMachine: false`，預設 `%LOCALAPPDATA%\Programs\BetterAgentTerminal`）：放 `%LOCALAPPDATA%\BetterAgentTerminal-PtyHolder\`。使用者可寫，與安裝目錄同等級。不用 `%APPDATA%`（Roaming 會同步大型檔案）。
- per-machine（本機的情況）：放 `%ProgramFiles%\BAT-PtyHolder\`，由提權的安裝程式寫入，一般使用者不能改，也在 AppLocker 預設規則允許範圍內。
- 自訂安裝目錄：沿用依範圍決定的固定位置。BAT 啟動時檢查「holder 路徑不以 `$INSTDIR` 開頭」，違反就不用 holder（照今天的方式）。
- **由誰複製**：安裝程式的 `customInstall`（`build/installer.nsh` 已有這個巨集），在檔案解開後複製。per-machine 只有提權的安裝程式能寫 Program Files；per-user 也走同一條路，維持單一機制。
- **沒有 holder 的情況**：zip 版、開發模式、holder 檔案缺少或雜湊不符，都退回今天的 `forkTerminalServer`。

#### Q3. 跨版本接回

- **怎麼找到（📄 現況）**：userData 裡的 `bat-pty-server.pid` / `.port` / `bat-pty-registry.json`（`electron/terminal-server/pid-manager.ts`、`pty-registry.ts`）。新版主行程走 `startTerminalServer`：
  - 有存活的 PTY → `pendingRecovery` ＋ `holdCreates`（`main.ts:450-456`），Recovery 提示選「保留」→ `connectToServer(port)` ＋ `pty:list` ＋ `releaseCreatesOnReplayList`（`main.ts:4623-4656`）。
  - 0 個 PTY → 靜默重新連線（`main.ts:458-466`）。
  - ⇒ **「BAT 重開後連回保留的 server」這條路今天就有**（T0108 / T0110 / T0578；權杖跨重開 T0576；RemoteServer port 由設定決定，預設 9876，`main.ts:756`），升級只是讓它跨版本。
- **協定現況（📄）**：TCP JSON-line，`127.0.0.1` 隨機 port（`server.ts:148-189`）。
  - **沒有版本號、沒有握手、沒有認證**。
  - 不認得的訊息 `switch` 直接忽略、不回應（`server.ts:204-221`）。
  - 訊息型別在 `protocol.ts`，共 9 種請求、8 種回應。
- **需要的版本協商（建議）**：
  - 新增 `server:hello { protocolMin, protocolMax, token }` → 回 `server:hello-ok { protocol, batVersion, runtime, holderDir, pid }`，取雙方共同的最高版本。
  - holder 對不認得的請求改回 `error`（今天是不回應），讓之後的新版主行程可以探測功能。
  - 協定只做相加，不改舊欄位的意義。
- **對方沒回 hello（舊 server，只會出現在 macOS / Linux 或開發模式）**：視為 protocol 0（今天的訊息集合，相容）。
- **認證（建議一起做）**：今天任何本機程序（包括其他 Windows 使用者）都能連上這個 port 並 `pty:write` 到別人的 shell。🔸 這是既有風險，holder 存活時間變長後更值得處理。權杖存在 userData 的 `bat-pty-server.token`（只有該使用者能讀），不寫日誌。
  - 未認證的第一個請求回 `error` 並**關閉 socket**。這樣降回沒有 holder 的舊版時，舊主行程會收到 TCP close，走 T0704 的立即 recovery：結束 holder 的 PTY、自己 fork 新 server。不會變成「以為連上了但永遠建不出 shell」。🔸 要在 W6 的降級情境實測。
- **不相容時的退回**：雙方沒有共同版本，或 hello 失敗、逾時 → 照 Recovery「重新開始」的路徑（`main.ts:4659-4686`：`sendShutdownToServer` → `waitForTerminalServerExit` → 新 server）。
  - 舊 holder 正常 shutdown 會結束 PTY 樹（T0540）。
  - 再沿用 PLAN-063 的說明與一鍵接回：`detectUpgradeInterruption` 加一個來源「holder 不相容」，N = 舊 holder 的 PTY 數。
- **scrollback / replay**：沿用 `pty:getBuffer` → `RingBuffer`（`ring-buffer.ts`，預設 1000 行，設定 `terminalServerScrollBufferLines`）。
  - 新版 renderer 是新程序，xterm 只拿得到 ring buffer 內容。超過 1000 行的會遺失，與今天的 Recovery 保留一樣。
  - 🔸 claude / codex 這類全螢幕 TUI 靠 replay 加上接回後第一次 resize 重繪（ConPTY resize 會觸發），與今天的 Recovery 一樣。
- **新分頁由誰處理**：
  - **建議（第一版）**：接回後新分頁仍由舊 holder 建立，跟今天保留 server 時一樣。
  - BAT 啟動時若 holder 存活但 **0 個 PTY、且版本 ≠ 目前版本**，就 `server:shutdown` 並 fork 新版（把今天 `main.ts:458-466` 的靜默重連改成「換新」）。
  - 每個分頁都關掉之前，舊版 holder 的程式碼一直在服務。holder 程式碼小（`server.ts` 444 行）且變動少，可以接受。
  - 多 holder 並存（新分頁一律進新版 holder）要改 PtyManager 的單一 server 模型，規模 L，列為之後的選項。
- **舊 holder 留到什麼時候、怎麼清**：
  - **程序**：不變。沒有任何 client 時 idle timeout 結束（預設 30 分鐘，`terminalServerIdleTimeoutMinutes`，`server.ts:390-399`）、`server:shutdown`（quit 時勾「同時停止」、Recovery「重新開始」、解除安裝、協定不相容）、啟動時 0 個 PTY 換新。
  - **檔案**：每次安裝時，安裝程式刪掉 holder 根目錄下**沒有程序在執行**的版本目錄（以 `Get-CimInstance Win32_Process` 路徑前綴判斷，與 `FIND_PROCESS` 同法）。解除安裝（非 `--updated`）時先停 holder，再刪整個根目錄。
  - 🔸 per-user 版的 BAT 也可以在啟動時清掉沒在用的目錄（使用者有權限）。per-machine 版只能靠安裝程式清（BAT 沒有權限）。
  - 🔴 **不能刪正在執行的版本目錄**：`icudtl.dat` 會被 mapped 而鎖住，其他檔案卻能刪掉，結果 holder 之後 `fork` `conpty_console_list_agent` 會失敗。
- **其他細節（📄 ＋ 🔸）**：
  - fork holder 時要指定 `execPath`（holder exe）與 **`cwd`（holder 目錄）**。今天的 fork 沒有指定 `cwd`，會繼承主行程的 cwd。🔸 holder 的 cwd 若在 `$INSTDIR` 裡，會讓安裝目錄刪不掉。
  - (a) 要明確設 `ELECTRON_RUN_AS_NODE=1`，(b) 不設。
  - holder 從 holder 目錄載入 `conpty.node`，不能從 `$INSTDIR` 載入（被 mapped 的 DLL 會鎖住安裝目錄）。
  - `buildServerPtyEnv`（`server.ts:47-69`）照舊刪掉 `ELECTRON_RUN_AS_NODE`。
  - **heartbeat 在 TCP 模式的缺口**：`serverLiveness` 只看 fork 的 `serverProcess`（`pty-manager.ts:1829-1833`）。以 TCP 接回時 `serverProcess` 為 null → 永遠回報「process gone / ipc closed」→ 連續 3 個遲到的 tick 就會 `handleServerDeath`（`:1795-1803`），把 holder 與全部 PTY 結束後重建。🔸 今天 Recovery 保留之後也有這個風險，升級接回後會變成常態。要改成在 TCP 模式以 pid 檔加上 `process.kill(pid, 0)` 判斷存活。

#### Q4. 與既有機制的關係

| 機制 | 需要怎麼改 | 回歸風險 |
|---|---|---|
| T0823 安裝前請 BAT 結束（`InstallerQuitController`、`main.ts:2466-2470`） | holder 在安裝目錄外 → `shouldStopServer = false`，只結束主行程、保留 holder。`runInstallerQuitWithoutApp`（`installer-quit-request.ts:285`）在 holder 版改成**不停** holder。**而且** BAT 要在結束前自己結束分頁裡、執行檔在 `$INSTDIR` 下的程序（內嵌 claude），並記下它們的 tab id 與 claude session。否則 `batRequestGracefulQuit` 會等滿 15 s，接著範本又跳一次「正在執行」對話框，再強制結束（`installer.nsh` 的等待迴圈，📄） | 中：沒有 holder 時（zip、開發模式、holder 缺少）必須維持 T0823 原行為，source guard 與單元測試要分兩條路 |
| `installer-quit-record.json` 與 `detectUpgradeInterruption` | 紀錄 schema 2：`holderKept: true`、`endedPtys`（holder 版是 0）、`endedAgentProcesses`（被結束的內嵌 claude）。偵測時：有 `holderKept` 且 holder 接回成功 → 不顯示「升級結束了 N 個終端」，改顯示「已接回 N 個終端」；被結束的 agent 列進 `InterruptedAgentsStore`（`cause: 'upgrade'`，沿用 T0766 一鍵接回）。holder 不相容或接回失敗 → 照 T0821 原規則 | 低到中：T0846 同版重裝的文字要分「有沒有 holder」兩種 |
| T0578 Recovery 提示 | 有 `holderKept` 紀錄（且紀錄的 holder pid 與 pid 檔一致）→ **不提示、直接走「保留」**（同 `terminal-server:recover` 的程式碼）。沒有紀錄（使用者自己關窗保留、per-machine UAC inner instance 強制結束主行程的情況）→ 照舊提示。`holdCreates` 與 `releaseCreatesOnReplayList`（BUG-146）都不變 | 低（只多一個前置條件） |
| T0704 heartbeat / recovery | TCP 模式的存活判斷（上面 Q3）；`handleServerDeath` 的 re-fork 改經 holder 路徑。`endReplacedServer` / `killOrphanPtyProcesses` 不變 | 中：要有測試涵蓋「TCP 模式 3 個遲到 tick、holder 仍在 → 不 recovery」 |
| T0540 程序樹 | 不變：holder 結束 PTY 時照舊先 `taskkill /T` 再 `pty.kill()`（`server.ts` `endPty`）。NSIS 不會對 holder 下 `/T`（Q1） | 低 |
| quit 時「保留 Terminal Server」對話框 | 文字不變；保留的 holder 現在也能撐過升級。🔸 可以考慮把文字改成「保留終端（升級後也會接回）」，由使用者決定 | 低 |
| 孤兒清理（`main.ts:424-445`） | 不變（holder 不在時才會走到）。pid 重用造成誤殺的既有風險不變 | 低 |
| 解除安裝 | 新增 `customUnInstall`（`uninstaller.nsh:156-158` 的掛點）：`${isUpdated}` 為真（升級時舊版的解除安裝）→ **什麼都不做**；為假（真的解除安裝）→ 先請 holder 正常結束，再刪 holder 根目錄。「請 holder 正常結束」的做法：執行 `$INSTDIR\BetterAgentTerminal.exe --uninstall-quit-request`（新參數，與 `--installer-quit-request` 分開，因為請求行程分不出是升級還是解除安裝），逾時就以路徑前綴 `Stop-Process`。`un.checkAppRunning` 在升級時也會跑（`uninstaller.nsh:1-3, 17-19`），它的前綴比對不會比到 holder ✅ | 🔴 高：**版本 N 的解除安裝程式在 N+1 升級時才會執行**（`installUtil.nsh:224` 執行的是舊版的 uninstaller，帶 `--updated`），而 N+1 的安裝程式會對**已安裝的 N 的 exe** 送出 quit 請求。這兩段行為在 N 發佈後就改不了 |
| 同版重裝 | holder key 相同 → 安裝程式看到目錄已存在且 manifest 相符 → 不複製（執行中的 exe 本來就鎖住）。接回走同版本協定 | 低 |
| 降級 | 較新的 uninstaller（`--updated`）保留 holder。舊的 BAT：有 hello → 看協定範圍，相容就接回，不相容就退回；**沒有 holder 支援的舊版** → 未認證被關閉 → T0704 recovery → 終端結束（與今天升級一樣）。🔸 要實測 | 中 |
| per-user 與 per-machine | per-machine 互動升級時，UAC inner instance 不跑 `CHECK_APP_RUNNING`，由舊 uninstaller 以路徑強制結束主行程（T0820 第 1 節）。holder 不在前綴內 → **仍然存活** 🔸，但主行程沒有正常結束、沒有紀錄 → 下次啟動走 Recovery 提示（不是自動接回）。可以接受，或在待裁決 D4 一起決定 | 中：要在 W6 實測兩種範圍 |

#### Q5. 安全與企業環境

- **從使用者可寫目錄執行 exe**：
  - per-user 安裝本來就從使用者可寫的 `%LOCALAPPDATA%\Programs` 執行，holder 放在 `%LOCALAPPDATA%` **不增加新風險**（同一個使用者的程序本來就能改 BAT 本體）。
  - per-machine 版若把 holder 複製到使用者可寫的目錄，等於把 `Program Files` 的保護降級。🔸 若 BAT 以系統管理員執行（`electron/windows-elevation.ts` 會偵測，T0377），甚至可能被利用來提權。⇒ **per-machine 的 holder 放在 `%ProgramFiles%` 底下由安裝程式寫入**（Q2）。
  - 依安裝範圍決定 holder 位置，四種組合（per-user / per-machine × 一般 / 提權）都沒有新增風險。
- **簽章**：本 fork 的 Windows 安裝版**沒有簽章**（✅ E7）。`release.yml` 只匯入 Apple 憑證（`:195-207`），`package.json` 沒有 Windows 的 `win.sign` / `certificateFile`（📄）。
  - (b) 的 `node.exe` 有 OpenJS 簽章（✅ E8）。對防毒信譽與 AppLocker / WDAC 發行者規則較友善，這也是推薦 (b) 的主因之一。
- **雜湊驗證**：安裝程式在 holder 目錄寫 `holder-manifest.json`（版本、每個檔案的大小與 SHA-256）；BAT fork 前驗證（node.exe 約 90 MB，🔸 ≈ 60 ms，依 E6 的 250 MB / 158 ms 推算）。不符 → 不用 holder（退回今天的方式）並記一行 `[pty-holder]`。
  - 誠實說明：per-user 模式下 manifest 與 exe 都是同一個使用者可寫，所以**不是安全邊界**，只能抓出複製不完整或檔案損壞。per-machine 模式的保護來自 ACL，不是雜湊。
- **SmartScreen**：只對帶 Mark-of-the-Web 的下載檔生效。安裝程式在本機複製出來的檔案沒有 MotW，🔸 不會觸發。
- **AppLocker**：預設規則允許 `%ProgramFiles%\*` 與 `%WINDIR%\*`。per-user 的 BAT 本來就會被擋，per-machine 的 holder 放 `%ProgramFiles%` 在允許範圍內。
- **WDAC**：未簽章的 BAT 本來就會被以簽章為準的政策擋下。
- **防毒**：🔸 未簽章的大型 exe 被複製到新路徑再執行（(a)），比較可能被行為偵測判定為可疑。(b) 用有簽章的官方檔，風險較低。
- **網路與權杖**：holder 照舊只聽 `127.0.0.1`。「Remote 資安」「遠端 Tower 通知」的權杖規則不變（`BAT_REMOTE_TOKEN` 在 PTY env，屬於 RemoteServer，不是 holder）。建議**新增** holder 的 TCP 權杖（Q3）。

#### Q6. macOS / Linux

- **Linux AppImage**：
  - 🔸 換掉 AppImage 檔案時，執行中的 runtime 仍持有舊檔的 fd。保留的 Terminal Server 有 AppImage keepalive（T0816，`electron/appimage-keepalive.ts`；`docs/agent-guide/linux-pty-fd-inheritance.md`「Terminal Server 的 fork」），所以 mount 會留到 server 結束，舊檔案內容仍讀得到。
  - 換檔不會結束任何程序。下次啟動新版會看到存活的 server，走 Recovery 提示「保留」，**以今天的協定跨版本接回**。
- **macOS dmg**：
  - 🔸 用新的 `.app` 取代舊的：POSIX 刪除或改名不影響執行中的程序（inode 還在），server 會存活。
  - 🔸 不確定的地方：Finder 可能拒絕取代「使用中」的 app。另外 node-pty 在 macOS 的 `spawn-helper` 以絕對路徑解析（`unixTerminal.js:21-23`），取代後舊 server 建立新 PTY 用的會是新 bundle 裡同一路徑的 `spawn-helper`。
- **為什麼不在範圍內**：
  - D285 使用者裁決只做 Windows。
  - 兩個平台換檔本來就不會結束 server，「保住終端」今天就做得到。缺的只有跨版本協定沒有版本號。W1（協定 v1）是跨平台的修改，順帶補上；其他工單只在 Windows 生效。

#### Q7. 測試策略

- **單元測試（vitest，Ubuntu CI 可跑）**：
  - holder 路徑與 key 計算、前綴檢查（`StartsWith` 的陷阱）、manifest 驗證。
  - 協定 hello 與協商、未認證就關閉、不認得的請求回 `error`（`server.ts`）。
  - PtyManager 在 TCP 模式的存活判斷。
  - InstallerQuitController 有 holder 與沒有 holder 兩條路。
  - 紀錄 schema 2 與 `detectUpgradeInterruption` 的觸發表。
  - 啟動時 0 個 PTY、版本不同 → 換新。
  - `installer.nsh` 的 source guard（比照 T0823 的寫法）。
- **Windows 整合測試（新的 Windows job 或手動）**：從 temp 目錄啟動 holder → TCP 連線 → 建 PTY → 結束「主行程」→ 重新連線，確認同一個 pid 還在、ring buffer replay 正確。CI 的 `tests.yml` 跑在 `ubuntu-24.04`，要另外加一個 Windows job。
- **真實升級（發版前就能驗）**：
  - 同一個分支跑兩次 `desktop-build.yml`。不帶 version 時是 `0.0.0-exp.<run>`（`desktop-build.yml:74`），兩次自然不同版號，兩個版本都含 holder 程式碼。
  - 新增 `windows-upgrade-acceptance.yml`（`workflow_dispatch`，輸入兩個 build run id；比照 T0820 的 Playwright ＋ `Get-CimInstance` 做法；唯讀權杖、不傳 secret、不建 tag / Release），跑以下情境：
    1. per-user `/S /currentuser` 從 exp.A 升到 exp.B；
    2. per-machine `/allusers`（runner 已提權）；
    3. 同版重裝；
    4. 從 exp.B 降回 exp.A；
    5. 從 exp.B 降到現行正式版 `0.7.4-pre.9`（沒有 holder）；
    6. 解除安裝（holder 結束、目錄刪掉）；
    7. 「安裝目錄下的 agent 類程序」：在分頁裡執行 `<INSTDIR>\BetterAgentTerminal.exe` ＋ `ELECTRON_RUN_AS_NODE` 跑 `setInterval`，模擬內嵌 claude，不需要登入或呼叫模型。驗證 BAT 先結束它並記錄，安裝程式不需要等 15 s。
  - 每個情境檢查：shell 的 pid 與 `ping -t` 的 pid 升級前後相同、conhost 還在、holder 的路徑、重開後**沒有** Recovery 提示（有紀錄的情境）、新版能接回並持續收到輸出、toast 文字、holder 目錄的清理。
- **使用者的發版驗收**：`e2e/manual/nsis-reinstall-acceptance.ps1` 加一段「升級前開 2 個 shell 分頁跑長命令 → 升級 → 確認 pid 不變」。
- 🔴 **第一個有 holder 的版本 N**：正式版從 N-1 升到 N 仍然會結束終端（舊版沒有 holder），從 N 升到 N+1 才是第一次真實的保留。exp.A → exp.B 的 CI 驗收是發 N 之前**唯一**能驗證 N 的解除安裝程式與 quit 行為的機會，應列為發 N 的必要關卡。

### 建議方向

**推薦：(b) 獨立 Node runtime（改名為 `bat-pty-holder.exe` 的官方 `node.exe`）＋ 單一 holder 程序（就是今天的 Terminal Server，換了執行位置）＋ 依安裝範圍決定 holder 位置、由安裝程式複製＋協定 v1（hello、版本協商、TCP 權杖）＋ 接回後 0 個 PTY 時換新。**

理由：
1. **持有 ConPTY 的程序必須不在安裝目錄、不叫 `BetterAgentTerminal.exe`**（Q1 的兩種比對方式），其他（conhost、shell）本來就在外面（✅ E1）。所以「搬一個程序」就夠了，不需要 (c) 的每個終端一個程序。(c) 每個分頁 +35 MB，還要拆掉 PtyManager 的單一 server 模型。
2. **(b) 優於 (a)**：
   - 磁碟約 90–100 MB 對 250 MB，而且 key 用 Node 版本，BAT 升版時不用多佔空間。
   - 有 OpenJS 簽章，對防毒、AppLocker、WDAC 較友善；(a) 是未簽章的 exe 被複製出來執行。
   - node-pty 是 N-API，不綁 ABI（✅ E1）。
   - `server.ts` 本來就是純 Node 程式碼，vitest 也在 Node 上跑。
   - 代價：Windows build 要下載並驗證 `node.exe`（`build-server-bundle.mjs` 有前例）、安裝檔多約 30 MB、要追 Node 安全更新。
   - 若使用者不想新增這條供應鏈，(a) 也可行，其他工單不變，只差 holder 目錄的內容與大小。
3. **單一 holder ＋ 0 個 PTY 時換新**：沿用今天「保留 server → BAT 重開 → 接回」這條已在使用的路徑（T0108 / T0110 / T0578 / T0576），改動集中。多 holder 留到需要時再做。
4. **協定 v1 一定要先做**：holder 會常態地與新版主行程連線；今天的協定沒有版本、沒有認證、不認得的請求不回應（Q3）。這部分跨平台，也讓 macOS / Linux 今天已經存在的跨版本接回更安全。

不推薦：(a) 磁碟與簽章的理由；(c) 記憶體與改動範圍；(d2) XL 規模；(d3) 不可行；(d4) 要換安裝技術。

已知限制（實作後仍然存在）：
- 用內嵌 runtime 的 claude 程序仍會被結束（列為已中斷的 agent，可一鍵接回；使用者也可以把 Claude Runtime 切成 system 來避開）。
- 從沒有 holder 的版本升到 N 時，終端仍會結束。
- per-machine 互動升級（UAC inner instance）時主行程是被強制結束的，所以重開後會出現 Recovery 提示，不會自動接回。
- 安裝期間（約 20 s）helper 與 MCP 連不到主行程，`resources\scripts` 也暫時不存在。

### 建議下一步

#### 拆單（建議順序；Wn 只是本單內的代號）

| # | 範圍 | `affects_files` 預估 | 規模 | 依賴 | 並行 | 驗收 |
|---|---|---|---|---|---|---|
| **W1** 協定 v1 | `server:hello` 與 `hello-ok`（協定範圍、BAT 版本、runtime、pid）、TCP 權杖檔（`bat-pty-server.token`，未認證回 `error` 並關閉）、不認得的請求回 `error`、`probeServerPtyCount` / `connectToServer` / Recovery 改用 hello、TCP 模式的存活判斷（pid 檔加 `kill 0`）、舊 server 不回 hello 時當 protocol 0。**跨平台** | `electron/terminal-server/{protocol,server,pid-manager}.ts`、`electron/terminal-server.ts`、`electron/pty-manager.ts`、`electron/main.ts`（`probeServerPtyCount` / `startTerminalServer` / `terminal-server:recover` / `sendShutdownToServer`）、`electron/installer-quit-request.ts`（`server-only` 的 shutdown 要帶權杖）、測試、`docs/agent-guide/terminal-server-recovery.md`、`CLAUDE.md` | M | — | 可與 W2 並行 | 單元測試（協商、未認證、TCP 模式 3 個遲到 tick、舊 server 相容）；三平台 `npm run test:unit` / 兩個 typecheck；Linux / macOS 保留 server 後重開接回不回歸（`linux-acceptance` / `macos-acceptance` 手動跑一次） |
| **W2** holder 打包 | Windows build 下載並驗證 Node（版本固定、SHA-256，比照 `build-server-bundle.mjs`）→ 放進 `resources\pty-holder\`（`bat-pty-holder.exe`、`terminal-server.js`、node-pty 的 win32 檔案、`holder-manifest.json`）；`installer.nsh` `customInstall` 依範圍複製到 holder 根目錄（存在且相符就略過）並清掉沒在用的版本目錄；`build.files` / `extraResources` 用 `${os}`（🔴 不得用 `build.<platform>.files`，T0546）；`verify-packaged-native.js` 加 `pty-holder` 檢查 | `package.json`（build）、`scripts/`（新的取得 Node 腳本）、`build/installer.nsh`、`scripts/verify-packaged-native.js`、`.github/workflows/{pre-release,release,desktop-build}.yml`（只有 Windows step，若需要）、`docs/agent-guide/packaging-release-checks.md` | M | — | 可與 W1 並行 | 打包產物檢查；本機 `npm run build:dir` 看到 `resources\pty-holder`；`desktop-build` 的安裝檔裝起來後 holder 目錄與 manifest 正確（W6 涵蓋） |
| **W3** 從 holder 啟動 | 新模組 `electron/pty-holder.ts`（純函式：holder 根目錄、key、前綴檢查、manifest 驗證、fork 參數）；`forkTerminalServer` 在 win32 打包版且 holder 有效時 `fork(script, { execPath, cwd: holderDir, env 不帶 ELECTRON_RUN_AS_NODE })`，否則照舊；`reforkTerminalServer` 同一路徑；日誌 `[pty-holder]` 只記 key 與結果 | `electron/pty-holder.ts`（新）、`electron/main.ts`（`forkTerminalServer`）、`electron/__tests__/pty-holder.test.ts`（新）、docs | S～M | W2（holder 的目錄配置）；W1（hello 回報 runtime） | W1 合併後做（`main.ts` 會衝突） | 單元測試；隔離 runtime 的 e2e：BAT 啟動後 server 的 `ExecutablePath` 在 holder 根目錄、可建分頁 |
| **W4** 安裝程式與解除安裝的整合 | 有 holder 時 `InstallerQuitController` 不停 server；先結束分頁裡 `$INSTDIR` 下的程序並記錄（session 沿用 `claudeSessionPersistence`）；`runInstallerQuitWithoutApp` 保留 holder；新增 `--uninstall-quit-request`；`customCheckAppRunning` 在 `un.` 環境依 `${isUpdated}` 選參數；`customUnInstall`（非 `--updated`）停 holder 並刪根目錄；紀錄 schema 2 | `electron/installer-quit-request.ts`、`electron/main.ts`（`before-quit`、`second-instance`）、`build/installer.nsh`、`electron/upgrade-interruption.ts`、測試、`docs/agent-guide/upgrade-interruption.md`、`CLAUDE.md` | M | W1、W3 | 否 | 單元測試（兩條路、`isUpdated`、紀錄 schema 2）＋ source guard；T0823 e2e 擴充成有 holder 與沒有 holder 兩種 |
| **W5** 升級後自動接回 | 有 `holderKept` 紀錄且 pid 相符 → 不提示、直接接回並顯示 toast「已接回 N 個終端」；不相容 → 走「重新開始」的路徑並顯示 PLAN-063 的說明（新來源）；0 個 PTY 且版本不同 → 換新；`detectUpgradeInterruption` 調整；i18n | `electron/main.ts`（`startTerminalServer`、recover / fresh-start）、`electron/upgrade-interruption.ts`、`src/components/ServerStatusToast.tsx` 一帶、i18n 檔、測試、docs | M | W1、W4 | 否 | 單元測試；隔離 runtime 的 e2e（保留 holder → 寫紀錄 → 重開：沒有 Recovery 提示、同一個 pid 的 shell、輸出持續） |
| **W6** 真實升級驗收 | `windows-upgrade-acceptance.yml`（`workflow_dispatch`，兩個 desktop-build run id）＋ spec，涵蓋 Q7 的情境 1–7；`nsis-reinstall-acceptance.ps1` 加 holder 檢查；`docs/agent-guide/` 新增 holder 文件與 `CLAUDE.md` 一節 | `.github/workflows/windows-upgrade-acceptance.yml`（新）、`e2e/`（新 spec）、`e2e/manual/nsis-reinstall-acceptance.ps1`、`docs/agent-guide/pty-holder.md`（新）、`docs/agent-guide/README.md`、`CLAUDE.md` | M | W2–W5（workflow 骨架可以先寫） | 骨架可與 W4、W5 並行 | 兩個 exp build 跑過全部情境，PASS 才能發 `0.7.5-pre.1` |

- 整體規模：**L**（約 5–6 張工單）。
- 關鍵路徑：W1 → W3 → W4 → W5 → W6。W2 與 W1 並行。
- 🔴 發版關卡：W6 在 exp.A → exp.B 全部 PASS 之後，才能發第一個有 holder 的版本。理由見 Q4「解除安裝」那一列與 Q7。

#### 待裁決（使用者）

| # | 問題 | 選項 | 建議 |
|---|---|---|---|
| D1 | holder 的 runtime | (b) 官方 `node.exe` 改名（約 90–100 MB、有簽章、新增一條供應鏈）／(a) Electron 副本（約 250 MB、未簽章、不加依賴） | **(b)** |
| D2 | holder 位置 | per-user `%LOCALAPPDATA%\BetterAgentTerminal-PtyHolder\`、per-machine `%ProgramFiles%\BAT-PtyHolder\`（安裝程式寫入）／全部放 `%LOCALAPPDATA%`（per-machine 會降低保護）／per-machine 不使用 holder | **依範圍分開放**（名稱可再調，但不能以安裝目錄路徑開頭） |
| D3 | 內嵌 claude 程序 | 升級時由 BAT 先結束並記錄，升級後一鍵接回（不增加磁碟）／把內嵌 claude 也搬出安裝目錄（每個 claude 版本約 335 MB，再拆一張工單） | **先結束並一鍵接回**；說明可以切成 system runtime 來避開 |
| D4 | 升級後要不要提示 | 有安裝程式紀錄就自動接回、只顯示 toast／照舊顯示 Recovery 提示 | **自動接回**（沒有紀錄的情況照舊提示） |
| D5 | 協定不相容時 | 結束舊 holder 並顯示 PLAN-063 的說明（等於今天的行為）／讓舊 holder 繼續跑到 idle 結束（分頁接不回去，沒有意義） | **結束並說明** |
| D6 | 新分頁由誰建立 | 單一 holder、0 個 PTY 時換新（M）／多 holder 並存、新分頁進新版（L） | **單一 holder** |
| D7 | holder 的 idle timeout | 沿用設定（預設 30 分鐘，升級後 30 分鐘內沒開 BAT 就會結束）／安裝程式觸發的 quit 改用較長的時間（例如 24 h） | 🔸 **延長**到例如 24 h；或維持 30 分鐘並在升級完成頁提醒 |
| D8 | holder 的 TCP 權杖 | 隨 W1 一起做（降到沒有 holder 的舊版時，終端會被結束）／不做 | **做**（今天任何本機程序都能寫入別人的 PTY） |
| D9 | 磁碟上限 | holder 根目錄只保留「正在執行的」加上「目前版本」，每次安裝時清理／另設上限 | **只保留在用的加目前版本**（(b) 通常只有 1 份約 100 MB） |

### Renew 歷程

- 無。

### 遭遇問題

- 無阻斷。
- 本機的 `node.exe` 是 Node 26，(b) 的 Node 24 大小與 N-API 載入是推論。node-pty 是 N-API 10，Node 24 也支援，所以風險低。W2 實作時要再量一次。
- 複製 261 MB 的 61 ms 是暖快取的數字，冷磁碟沒有量。
- 互動安裝、per-machine UAC 的路徑、macOS 換 `.app` 的行為都是推論（本單規定不能執行安裝檔）。

### 方法論狀態回寫

- 不適用（工單沒有 `methodology`）。

### 回報時間

- 2026-11-04T18:25:33+08:00
