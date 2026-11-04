---
schema_version: 1
schema_kind: workorder
id: T0856
title: "研究：PLAN-065 Windows 升級不中斷終端的 holder 模型（ConPTY 持有者放安裝目錄外、跨版本接回）可行性、方案比較與拆單"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T18:10:49+0800"
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
- **狀態**：PENDING
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

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### Renew 歷程

### 遭遇問題

### 方法論狀態回寫

### 回報時間
