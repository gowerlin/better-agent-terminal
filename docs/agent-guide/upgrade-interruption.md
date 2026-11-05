# 升級前提示與升級後說明（PLAN-063 子項 1、2 / T0821；子項 3 / T0823；holder 版 PLAN-065 W4 / T0860、W5 / T0861）

> 對應 CLAUDE.md「升級結束終端的提示與說明（PLAN-063 / T0821）」節。改這個功能時兩邊一起更新。
> holder 版（Terminal Server 從安裝目錄外的 PTY holder 執行，T0858 / T0859）的安裝前結束、解除安裝與紀錄 schema 2 見〈holder 版：升級保留 holder、解除安裝停 holder（T0860）〉；下次啟動的自動接回、不相容與換新見〈holder 版：升級後自動接回…（T0861）〉。

## 背景（T0820 實測摘要）

- Windows 的 NSIS 安裝程式在安裝新版時，結束安裝目錄底下的每一個程序（`Win32_Process.Path` 以 `$INSTDIR` 開頭；`Stop-Process` = TerminateProcess），包括 BAT 主行程與 Terminal Server（同一個 `BetterAgentTerminal.exe`）。互動安裝按「確定」後與 `/S` 走同一段程式；per-machine 需要 UAC 時可能看不到「正在執行」的對話框（推論）。
- 分頁的 shell 不在安裝目錄，但 ConPTY 由 Terminal Server 持有：server 一死，conhost、shell 與執行中的指令在 5 秒內跟著結束（T0820 對照組 ③）。即使先關主視窗、保留 Terminal Server，升級一樣全部結束。
- server 沒跑 shutdown，`bat-pty-server.pid` / `.port` / `bat-pty-registry.json` 留著。升級後重開 BAT 走 `startTerminalServer` 的孤兒清理（`orphan PID … detected` → `killOrphanPtyProcesses` → `Cleaned N orphan PTY process(es) from registry` → 新 server），**沒有** Recovery 提示；分頁依存檔還原成新的 shell，claude-cli / codex-cli 分頁各自開一個新的 agent（不是 resume）。
- BAT 沒有自動更新：`electron/update-checker.ts` 只比版號，`UpdateNotification.tsx` 開 releases 頁面，使用者自己下載、安裝。

## 子項 1：升級前提示（只有 Windows）

- 更新通知（`src/components/UpdateNotification.tsx`）在 `win32` 多一行：「安裝新版會結束所有終端分頁，包括執行中的指令與 agent（claude、codex）。請先完成或保存工作。」（`update.windowsInstallEndsTerminals`，en / zh-TW / zh-CN）。
- 判斷唯一實作 `showsWindowsUpgradeWarning(platform)`（同檔，`window.electronAPI.platform`）。macOS / Linux 不顯示：它們的升級方式未研究。
- 🔴 既有的標題、版本、更新內容、「在 GitHub 上查看」按鈕與連結、`checkForUpdates` 設定、Esc / [X] 都不變。
- README「方式一：直接下載」下方有同樣內容。

## 子項 2：升級後說明

### 偵測條件

唯一實作 `detectUpgradeInterruption`（`electron/upgrade-interruption.ts`）：

| 上次版本 | 孤兒清理找到的 PTY | 安裝程式結束紀錄的 PTY（T0823） | 結果 |
|---|---|---|---|
| 有（不同或相同） | 任意 | ≥ 1 | **觸發**（正常結束沒有孤兒，靠紀錄）。T0846（D278）：版本相同也觸發，用同版文字 |
| 有，且不同 | ≥ 1 | 0 / 沒有紀錄 | **觸發**：「上次升級結束了 N 個終端」 |
| 與目前相同（當機、工作管理員結束） | 任意 | 0 / 沒有紀錄 | 不觸發（與 T0821 前相同；空紀錄照樣刪掉） |
| 有，且不同 | 0 | 0 / 沒有紀錄 | 不觸發，記一行 `none` |
| 沒有（第一次執行、檔案讀不到 / 內容不對） | 任意 | 任意 | 不觸發 |

版本相同＋紀錄 ≥ 1（T0846）有兩種來源：同版重裝（2026-11-04 實機：pre.7 重裝 pre.7，T0846 前沒有提示），以及安裝程式請 BAT 結束後使用者取消安裝。紀錄只有結束時的版本與 PTY，兩者無法區分，**兩者都提示**（終端確實被安裝程式結束了）；同版文字因此寫成兩種情況都成立的說法（見〈說明的顯示〉）。只有孤兒、沒有紀錄（當機）的同版重開照舊不觸發。

N = 兩份清單依 terminal id 的聯集（紀錄在前）；claude session 以紀錄的為準（紀錄是在 PTY 還在跑時取的）。日誌 `detected` 行結尾的 `source=orphans|installer|installer+orphans` 標明來源，版本相同時再加 ` same-version`（T0846）。

- 「上次版本」存在 `<userData>/last-run-version.json`（`{ "schema": 1, "version": "<app.getVersion()>" }`）。`UpgradeInterruptionCheck.begin()` 在 whenReady、`startTerminalServer()` 之前讀舊值、再寫入目前版本（版本相同時不寫）；所以升級前的版本在升級前就已經寫好。寫入走 temp 檔＋rename，失敗只記一行、不丟例外；路徑由 main 傳入（🔴 模組不在 import 期呼叫 `app.getPath`）。
- N = 孤兒清理讀到的 `bat-pty-registry.json` 的 `ptys.length`（與 `Cleaned N orphan PTY process(es)` 同一個數）。`noteOrphanCleanup` 只記下 registry 的 id / cwd 與上一個行程的 claude session 紀錄（`claudeSessionPersistence.entries()`，此時都還是 pending），不碰程序。只有每個行程第一次孤兒清理算數；`finish` 只執行一次。
- 🔴 孤兒清理本身的行為與順序不變：`readRegistry` → （T0821：記下）→ `killOrphanPtyProcesses`（T0540：先殺程序樹再殺 shell）→ `Cleaned …` → `clearRegistry` → 刪 pid / port 檔。Recovery 提示（T0578）、Terminal Server recovery（T0704）的觸發條件與流程不變。`upgrade-interruption.test.ts` 有 source guard 守住順序。

### 說明的顯示

- main：`finishUpgradeInterruptionCheck()`（`electron/main.ts`，`startTerminalServer()` 之後、建立視窗之前）判定一次，結果留在 `UpgradeInterruptionCheck`。IPC `terminal-server:query-upgrade-interruption`（`ipcMain.handle`，🔴 只給本機 renderer，不是 helper / RemoteServer channel）回 `{ previousVersion, currentVersion, ptyCount, agentCount }`，**第一個問的視窗拿到、之後回 null**（只顯示一次；reload 不再出現；版本檔已改成目前版本，下次啟動也不會再觸發）。
- renderer：`App.tsx` 掛載時 pull（`parseUpgradeInterruptionNotice` 驗證），沿用既有的 `ServerStatusToast`（key `UPGRADE_INTERRUPTED_TOAST_KEY` = `app.upgradeInterrupted`，帶 `count` / `from` / `to`）。T0846：key 由 `upgradeNoticeToastKey(notice)`（`ServerStatusToast.tsx`）決定，`previousVersion === currentVersion` → `UPGRADE_REINSTALLED_TOAST_KEY` = `app.upgradeReinstalled`（帶 `count` / `version`），notice 形狀不變。
  - 選 `ServerStatusToast` 的理由：同一個位置、同一種「Terminal Server 的分頁被重建」語意；T0766 已在它上面加了「N 個 agent 分頁已中斷，按此查看」一行與點擊開清單，升級說明直接沿用，不新開 Dialog（CLAUDE.md Dialog 規則：不新增 Dialog）。
  - heartbeat toast（T0112）顯示中時優先顯示它，升級說明排在後面；升級說明不自動消失，點一下關閉（有 agent 分頁時同時開清單）。
- 文字（三語）：「BAT 已升級（v舊 → v新）。安裝新版時結束了 N 個終端，包括其中執行中的指令與 agent；分頁已用新的 shell 重新開啟。」
- 同版文字（T0846，三語同義）：「安裝程式結束了 BAT（v版本）與 N 個終端，包括其中執行中的指令與 agent；分頁已用新的 shell 重新開啟。」不說「已升級」或「已重新安裝」，取消安裝時也成立。版本不同的文字逐字不變。

### agent 分頁（沿用「被中斷的 agent 分頁」）

- 來源 `buildUpgradeInterruptedSources`：對每個被清掉的 PTY id，
  - 存檔分頁（`windows.json` 各視窗的 `terminals`，`windowRegistry.readAll()`）的 `agentPreset`（不是 `none` 才算）、`workspaceId`、`launchRole: 'tower'`（當成 `role: 'tower'`，排序用）；
  - 上一個行程的 `claude-sessions.json` 紀錄：有 session id（UUID）或 `--name` 而存檔沒有 `agentPreset`（helper 派工的 claude Worker）→ 當成 `claude-cli`；session id 只取 UUID。
  - 其他升級後都不存在（沒有 `session-start` / OSC、沒有 workorder env），`startedAt` null、`blockedDetection` `none`。
- 之後與 recovery 同一條路：`buildInterruptedAgentSnapshot(…, { cause: 'upgrade' })` → `InterruptedAgentsStore.record(snapshot, 'upgrade')`。不改任何持久化格式：只多一個記憶體欄位 `InterruptedAgent.cause: 'upgrade'`（renderer 的 `InterruptedAgentInfo` 同名鏡像）。
- 與 recovery 的差異（只對 `cause: 'upgrade'` 的項目）：
  - `record(…, 'upgrade')` 送 `reason: 'update'`：對話框不自己開（視窗此時還不存在，renderer 以既有的 pull 取得清單），由升級說明 toast 點開。
  - 🔴 `session-start` 不移除項目：還原的 claude-cli 分頁會自己開一個新的 claude（`WorkspaceView` 還原流程），它的 `SessionStart` 不是 resume。其餘移除時機不變（恢復時先 kill → `pty-ended`、main 的 `resumed`、略過 `dismissed`、關分頁 / ⏻ → `pty-ended`）。
  - 對話框（`InterruptedAgentsDialog`）在每一列都是升級造成時改用 `interruptedAgents.upgradeTitle` / `upgradeDesc`（說明 claude / codex 分頁可能已經開了新的 agent，按「恢復」會結束它、接續被中斷的對話）；有 recovery 列時維持原標題與說明。縮圖 ⏸ 的 tooltip 用 `interruptedAgents.badgeUpgradeTooltip`（T0822）。
  - 文字（T0847 / D279）：T0846 起同版重裝、取消安裝也會列進來，所以這三個字串用不提版本的單一說法（zh-TW 標題「安裝程式結束的 agent 分頁」、說明「安裝程式執行時結束了這些分頁的 agent。…接續被中斷的對話…」、tooltip「這個分頁的 agent 被安裝程式中斷，按此查看」），不依版本分支；三語都不含「新版 / 升級」（en：`new version` / `upgrade`），`upgrade-interruption.test.tsx` 守住。key 名稱與 `cause: 'upgrade'` 不變；toast（`app.upgradeInterrupted` / `upgradeReinstalled`）照舊依版本分兩種。
- 🔴 恢復沿用 T0766 / T0767：claude-cli 分頁 `startClaudeCliPty` ＋ `claudeResumeArgs`（session 未知 → `--resume` picker），codex-cli 分頁 `resumeCodexCliTab` ＋ `codexResumeArgs`（codex 自己的 resume 選單），其他經 main `terminal:resume-interrupted-agent`。不自動 resume、不自動重跑指令、不通知塔台。

### 日誌

| 位置 | 內容 |
|---|---|
| main，觸發 | `[upgrade-interruption] detected: previous=<舊> current=<新> ended-ptys=<N> agent-tabs=<M> source=<orphans\|installer\|installer+orphans>`；版本相同（T0846）結尾加 ` same-version` |
| main，版本變了但沒觸發 | `[upgrade-interruption] none: previous=<舊或 unknown> current=<新> ended-ptys=<N>` |
| main，版本相同且沒觸發 | 不記 |
| main，版本檔寫不進去 | `[upgrade-interruption] could not write last-run-version.json (version <新>)` |
| main，清單 | 既有的 `[interrupted-agents] interrupted: terminal=… session=<前 8 碼>`，加 `[interrupted-agents] upgrade interrupted M agent tab(s); listed K` |
| renderer | `[upgrade-interruption] notice shown: previous=… current=… ended-ptys=N agent-tabs=M` |

🔴 不記 session id 全文、指令內容或權杖。

## 子項 3：安裝前請 BAT 正常結束（T0823）

升級仍會結束所有終端（子項 4 才處理），但結束方式從 TerminateProcess 改成 BAT 自己的完整結束：存檔（T0504 flush-save）、Terminal Server 跑 shutdown（T0540：先程序樹再 shell，pid / port / registry 檔清掉），下次啟動不再走孤兒清理（沒有 pid 被重用而誤殺的風險）。

### electron-builder 的呼叫時機（26.8.1 實讀範本）

| 誰 | 何時 | 有沒有呼叫 `customCheckAppRunning` |
|---|---|---|
| 新版安裝程式（per-user，本專案預設） | install section 開頭、`uninstallOldVersion` 之前（`installSection.nsh`） | 有 |
| 新版安裝程式，選「所有使用者」→ UAC 提權 | 提權的 inner instance 跑 install section，`${ifNot} ${UAC_IsInnerInstance}` 擋掉 | **沒有**（範本本來也不檢查；之後舊版解除安裝程式以舊版自己的範本強制結束） |
| 新版安裝程式，本身已以系統管理員執行 | install section（非 inner instance） | 有，也送請求：請求行程以系統管理員身分啟動，但只把 argv 交給執行中的 BAT（或停保留的 server）就結束、不開視窗。T0823 原本加了「提權不送」，CI 實測（GitHub runner 關閉 UAC、一律 elevated）一個請求都沒送出，改為不分權限 |
| 舊版解除安裝程式（覆蓋安裝時新版以 `/S --updated` 執行） | `un.checkAppRunning` | 用的是**舊版**編進去的版本：T0823 前的版本照舊強制結束；T0823 之後的版本有本單的巨集（`--updated` → 不跳提示），但此時 BAT 已被新版安裝程式請走，找不到程序 |
| 使用者解除安裝（設定 → 應用程式） | `un.checkAppRunning`（靜默時於 `un.onInit`） | 有（同安裝程式）。T0860 起送 `--uninstall-quit-request`（見 holder 版一節） |

- 覆寫方式：`build/installer.nsh` 經 `build.nsis.include` 放進 header（在範本 `allowOnlyOneInstallerInstance.nsh` 之前）。定義 `customCheckAppRunning` 後範本**不再** `!include "getProcessInfo.nsh"`、不宣告 `Var pid`，所以本檔自己補上；回退是原樣 `!insertmacro _CHECK_APP_RUNNING`（範本的巨集，不是複製）。`IS_POWERSHELL_AVAILABLE` / `FIND_PROCESS` 也是範本的巨集。
- 升級 electron-builder 時：`electron/__tests__/installer-quit-request.test.ts` 的最後一個測試鎖住 `app-builder-lib` 版本（26.8.1）與上面這些掛勾的原文，版本一變就失敗，提醒依 [packaging-release-checks.md](packaging-release-checks.md)「NSIS：安裝前請 BAT 正常結束」重新核對。

### 流程

0. 安裝時（`customInstall`，檔案放好之後）：寫 `$INSTDIR\resources\installer-quit-request.supported`（`BAT_INSTALLER_QUIT_MARKER`），代表「裝在這裡的 BAT 認得請求」。T0823 前的安裝沒有這個檔；任何解除安裝（含降版時舊版安裝程式先跑的解除安裝）都 `RMDir /r $INSTDIR`，檔案跟著消失。
1. 安裝程式（`batRequestGracefulQuit`）：不是 app 本身、`$INSTDIR\BetterAgentTerminal.exe` 與標記檔都存在，且 `FIND_PROCESS` 找到安裝目錄下的程序 →
2. 不是 `--updated` 時先顯示範本同一句提示（`$(appRunning)`，確定 / 取消；取消 = 結束安裝程式；`/S` 自動確定）。
3. `Exec "<安裝目錄>\BetterAgentTerminal.exe --installer-quit-request"`，每 `BAT_INSTALLER_QUIT_POLL_MS` = 500 ms 以 `FIND_PROCESS` 檢查，最多 `BAT_INSTALLER_QUIT_TIMEOUT_MS` = 15 s（`GetTickCount` 計時）。
4. 無論結果，接著跑範本的 `_CHECK_APP_RUNNING`：程序都結束了 → 什麼都不做；還有 → 範本原本的提示 / 強制結束（與 T0823 前相同）。
5. BAT 端（`electron/installer-quit-request.ts`）：
   - 帶參數的行程拿不到 lock（BAT 在跑）→ Electron 把 argv 交給執行中的 BAT（`second-instance`），自己 `app.quit()`。🔴 這個行程（不論有沒有 lock）在 whenReady 開頭 return（`installerQuitRequestProcess`）：T0823 本機 e2e 實測，第二個實例 `app.quit()` 後 whenReady 照樣執行，執行中的 BAT 一結束、釋放 lock 與 Terminal Server，它就會跑完整啟動、讀掉紀錄並 fork 新 server。T0825（BUG-210）起，所有拿不到 lock 的第二個實例（不帶參數、`--profile=` 等）也一樣：whenReady 開頭的判斷是 `if (!gotTheLock || installerQuitRequestProcess)`，沒有 lock 時記一行 `[startup] second instance: handed off to the running BAT, skipping startup`（不記 argv）後 return。
   - 執行中的 BAT：載入時註冊的 `second-instance` listener → `InstallerQuitController.request()`。啟動還沒完成（視窗未建立）就先記著，`markReady()`（whenReady 裡的 `second-instance` handler 註冊之後）才執行；同一行程只處理一次。已在 quit（例如使用者的離開對話框開著）→ 只記一行，交給安裝程式回退。
   - 執行：取 `ptyManager.listTerminalIds()` / `getCwd` 與這些 PTY 的 claude session（`claudeSessionPersistence.entries()`）→ 寫 `installer-quit-record.json`（temp＋rename、0600）→ `installerQuitRequested = true; app.quit()`。`before-quit` 看到旗標就不顯示確認對話框、`shouldStopServer = true`，其餘照原流程：flush 每個 renderer（含 detached 視窗）、存 profile 快照、`stopTerminalServerGracefully`（IPC / TCP `server:shutdown`，🔴 Windows 不用 SIGTERM）、`runCleanupOnce`（remote / ssh）。
   - 帶參數的行程拿到 lock（沒有 BAT 主行程）→ `runInstallerQuitWithoutApp`：這個 userData 的 Terminal Server 在跑（使用者離開時保留了 server）→ 以 registry 寫紀錄（`source: server-only`）、TCP `server:shutdown`、等最多 `INSTALLER_QUIT_SERVER_EXIT_TIMEOUT_MS` = 8 s → `app.exit(0)`。沒有 server → 直接結束。不開視窗。
6. 新版第一次啟動：`begin()` 之後 `takeInstallerQuitRecord`（讀一次即刪，壞掉也刪）→ `noteInstallerQuit` → 偵測規則見上。

### 安全

- 只認 `--installer-quit-request` 這一個參數（完全相等），其他 argv 與 `additionalData` 都不讀；不開埠、不讀其他檔。
- single-instance lock 依 userData（同一使用者、同一台機器）；能啟動這個 exe 的同使用者程式本來就能結束 BAT，沒有新增能力。
- 紀錄檔與 `claude-sessions.json` 同等內容（terminal id、cwd、claude `--name` 與 session id），權限 0600；日誌只記數量。

### 使用者看得到的差異

| 情況 | T0823 前 | T0823 後 |
|---|---|---|
| 互動安裝、BAT（T0823+）在跑 | 「正在執行，按確定關閉」→ BAT 被強制結束 | 同一句提示 → BAT 自己存檔、停 Terminal Server 後結束（通常 1 秒內），不再出現 BAT 的離開確認對話框 |
| `/S` 靜默安裝、BAT（T0823+）在跑 | 直接強制結束 | 直接請 BAT 正常結束 |
| 裝著的 BAT 是 T0823 前的安裝程式裝的（例 pre.5 → pre.6 這一次） | 強制結束 | 相同（沒有標記檔，不送請求）。若送了，舊版會把參數當成「開新視窗」（舊版的 `second-instance`，`createEntry` 立即存進 windows.json），15 s 後仍被強制結束，重開多一個空視窗——所以用標記擋掉 |
| BAT 還在啟動、或離開對話框開著 | 強制結束 | 送出請求、等滿 15 s，範本照舊：互動安裝**再顯示一次**提示，然後強制結束 |
| 「所有使用者」安裝經 UAC 提權 | inner instance 不檢查，之後舊版解除安裝程式強制結束 | 相同 |
| 以系統管理員執行的安裝程式（含關閉 UAC 的電腦） | 強制結束 | 與一般相同：請 BAT 正常結束。若提權用的是**另一個帳號**的憑證，請求到不了使用者的 BAT（lock 依帳號的 userData），等滿 15 s 後回退 |
| 只剩保留的 Terminal Server | server 被強制結束、重開走孤兒清理 | 請求行程請 server 正常 shutdown |
| BAT 以 `--runtime=N` 執行 | 強制結束 | 相同（請求只到預設 runtime 的 lock；逾時後回退） |
| 重開後的說明 | 版本變＋孤兒 → toast | 版本變＋（孤兒或紀錄）→ 同一則 toast；文字相同 |

## holder 版：升級保留 holder、解除安裝停 holder（T0860）

PLAN-065 W4（D286 D3 / D7 / D2）。Terminal Server 從安裝目錄外、通過驗證的 PTY holder 執行時（T0858 打包與複製、T0859 啟動），安裝程式觸發的 quit 只結束 BAT 主行程，shell 與 PTY 留在 holder；下次啟動直接接回（不跳 Recovery 提示）見〈holder 版：升級後自動接回…（T0861）〉。

### 兩條路（🔴 必守）

| 條件 | 行為 |
|---|---|
| **有 holder**：目前的 server 是本行程從 holder 啟動的（`forkTerminalServer` 走 `spawn(holderSpawnSpec(...))`），或 hello 說它是 holder（probe / 重連 / Recovery「保留」的 hello，`isKeptHolderHello`：`runtime.name === 'node'` 且 `holderDir` 不在安裝目錄內、也不包含安裝目錄），**而且** quit 時再開一條 TCP hello 仍是 holder | 延長 idle 到 24 h（`server:extendIdle`）→ 結束分頁程序樹中、執行檔在安裝目錄下的程序（D3）→ 寫紀錄 schema 2 → quit，`before-quit` 不停 server |
| **沒有 holder**：zip / `build:dir`（沒有 T0823 標記）、開發模式、holder 缺少或不符、macOS / Linux、hello 失敗或說不是 holder | 🔴 T0823 原行為逐字不變：同步執行、紀錄 schema 1、`shouldStopServer = true`、`stopTerminalServerGracefully`（Windows 不用 SIGTERM）、不跳確認 |
| **真的解除安裝**（`--uninstall-quit-request`） | 有沒有 holder 都走 T0823 那條（停 server）；沒有 BAT 主行程時請求行程 `server:shutdown` 後等不到結束 → BAT 自己結束（`forceStopServer`：先 registry 的 PTY 程序樹（T0540 順序），再 `taskkill /F /T` pid 檔的 server，清 pid / port / token / registry） |

- 唯一實作：`electron/installer-quit-request.ts` — `InstallerQuitController`（`serverFromHolder` 為假或沒有 holder deps → `runStopping`，與 T0823 的 `run` 相同）、`runKeepingHolder`、`runInstallerQuitWithoutApp`（`kind` / `keptHolder` / `endAgentProcesses` / `forceStopServer`）、`queryKeptHolder`、`findInstallDirAgentProcesses`、`endInstallDirAgentProcesses`、`buildHolderKeptQuitRecord`。main 只接線：`terminalServerFromHolder`（`forkTerminalServer` 設 true / false、`noteTerminalServerHello` 由 hello 設）、`installerQuitKeepsServer`、`installerQuitHolderDepsWithoutApp`、`forceStopTerminalServer`。
- idle 延長（D7）：在一條新的 TCP 連線上 hello（帶權杖）→ 確認是 holder → 同一條連線送 `server:extendIdle { durationMs: 86400000 }`，收到 `server:idle-extended` = `extended`，`ALREADY_EXTENDED` = `already-extended`（不算失敗），2 s 內沒回 = `failed`（照樣保留）。🔴 不能在送完 extendIdle 之後再對 server hello（任何 client hello 都會把延長清掉，T0857）。

### 內嵌 agent 的結束（D3）

- 程序清單：PowerShell `Get-CimInstance Win32_Process`（固定腳本，`execFile` ＋陣列參數＋ 8 s timeout，UTF-8 輸出），每行 `pid / 父 pid / 建立時間 / 執行檔路徑`。
- 根 = registry 每個分頁的 shell pid（`bat-pty-registry.json`）。從根往下找子孫；子程序建立時間早於父程序的不算（父 pid 被重用）。
- 🔴 只以路徑判斷（`isPathInsideDir`：不分大小寫、`\` / `/`、`<安裝目錄>\` 前綴，`<安裝目錄>-old\…` 不算），不看名稱；根（shell）本身永遠不結束；樹外的程序（BAT 主行程、Claude 面板的 claude、holder 本身）不碰；樹裡不在安裝目錄的程序（claude 的 bash、使用者的指令）不碰。
- 結束：`process.kill(pid)`（TerminateProcess），等最多 3 s 確認消失。讀不到清單 → 不結束任何程序、記一行，照樣保留 holder（安裝程式等滿 15 s 後回退到範本的處理）。
- 紀錄只記分頁 id 與被結束的程序數，以及這些分頁的 claude session（`claudeSessionPersistence`；請求行程讀 `claude-sessions.json`）。

### 紀錄 schema 2

```json
{
  "schema": 2,
  "version": "<結束的版本>",
  "source": "running-app | server-only",
  "holderKept": true,
  "holderPid": 4242,
  "endedPtys": [],
  "endedAgentProcesses": [{ "terminalId": "<id>", "processes": 1 }],
  "claudeSessions": [{ "terminalId": "<id>", "name": "<--name>", "sessionId": "<uuid>" }]
}
```

- 只在保留 holder 時寫；沒有 holder 時照舊寫 schema 1（不改格式：降版到 T0860 前的版本時，舊版讀得懂）。`takeInstallerQuitRecord` 讀 schema 1 與 2，其他 → `invalid`（刪掉、不用）。
- 下次啟動（`UpgradeInterruptionCheck.noteInstallerQuit`）：schema 2 的 `endedPtys` 當成紀錄的 PTY（通常 0），`endedAgentProcesses` 的分頁另外列進「被中斷的 agent 分頁」（`cause: 'upgrade'`，沿用 T0766 一鍵接回；不自動 resume、不通知塔台）。偵測多一個條件 `installerQuitAgentTabCount ≥ 1`（只有 schema 2 會給）。notice 多 `holderKept: true`；`ptyCount` 是 0 時 renderer 不顯示「結束了 N 個終端」的 toast（T0861：接回時改顯示「已接回 N 個終端」，見下一節）。holder 在重開前就不在了（孤兒清理）→ 孤兒照 T0821 規則併入。schema 1 的行為完全不變。

### NSIS（`build/installer.nsh`）

- `batRequestGracefulQuit` 的參數：安裝程式一律 `--installer-quit-request`；解除安裝程式（`!ifdef BUILD_UNINSTALLER`）`${isUpdated}` 為假且安裝目錄有 `resources\uninstall-quit-request.supported` → `--uninstall-quit-request`，否則 `--installer-quit-request`。其餘（提示、等待、回退到 `_CHECK_APP_RUNNING`）不變。
- `customInstall`：T0823 標記之後、複製 holder 之前，再寫 `resources\uninstall-quit-request.supported`（`BAT_UNINSTALL_QUIT_MARKER`）。
- `customUnInstall`（範本在刪檔之前插入）：🔴 `${isUpdated}`（升級時舊版的解除安裝）→ 什麼都不做。否則 `batUninstallPtyHolder`：依 `$installMode` 取本次範圍的 holder 根目錄（per-user `$LOCALAPPDATA\BAT-PtyHolder`、per-machine `$PROGRAMFILES64\BAT-PtyHolder`；與 `$INSTDIR` 互為前綴 → 不碰）；根目錄存在才 `Exec <安裝目錄>\BetterAgentTerminal.exe --uninstall-quit-request`，每 500 ms 以 `batPtyHolderInUse` 檢查根目錄與安裝目錄，最多 `BAT_UNINSTALL_QUIT_TIMEOUT_MS` = 20 s；最後根目錄沒有程序在跑才 `RMDir /r`，否則保留並 `DetailPrint`。🔴 NSIS 不強制結束任何程序（T0823 source guard：檔內沒有 `Stop-Process` / `taskkill` / `KILL_PROCESS`）；逾時的強制結束由 BAT 的請求行程做。

### 各情況的動作順序

N = 第一個有 holder 的版本，N+1 = 下一版。

**N → N+1 升級（per-user，BAT 在跑）**

1. N+1 安裝程式 install section：`customCheckAppRunning`（安裝程式版）→ `FIND_PROCESS` 找到 `$INSTDIR` 下的程序 → 提示（`/S` 自動確定）→ `Exec <N 的 exe> --installer-quit-request`。
2. N 的 BAT（`second-instance` → `InstallerQuitController`）：`serverFromHolder` 真 → hello ＋ extendIdle 24 h → 結束分頁樹中 `$INSTDIR` 下的程序（內嵌 claude / codex、經 BAT exe 跑的 MCP shim）→ 寫 schema 2 → quit（flush-save、存 profile、**不**停 server）。
3. 安裝程式的等待迴圈看到 `$INSTDIR` 下沒有程序 → 範本 `_CHECK_APP_RUNNING` 什麼都不做。
4. `uninstallOldVersion`：以 `/S --updated` 執行 **N 的**解除安裝程式 → `un.checkAppRunning`（`${isUpdated}`，找不到程序）→ `customUnInstall`：`${isUpdated}` → 不做 → 範本刪 `$INSTDIR`。
5. 新檔案放好 → `customInstall`：寫兩個標記、複製 N+1 的 holder（key 相同就略過；其他 key 目錄沒有程序在跑才刪，N 的 holder 在跑 → 保留）。
6. N+1 第一次啟動：`takeInstallerQuitRecord`（schema 2）→ `startTerminalServer` probe 到 N 的 holder（有 PTY）→ 紀錄的 holder pid 與 pid 檔、hello 相符 → 直接接回、不跳 Recovery 提示（T0861）→ 被結束 agent 的分頁列進清單。

沒有 BAT 主行程、只剩保留的 holder：步驟 1 只有在 `$INSTDIR` 下有程序（例如 holder 分頁裡的內嵌 claude）時才送請求；請求行程拿到 lock → `runInstallerQuitWithoutApp`（holder → 結束那些程序、寫 schema 2 `server-only`、不停 holder）。沒有任何程序在 `$INSTDIR` 下時不送請求，holder 本來就不會被範本比到。

**真的解除安裝（N，per-user）**

1. `un.onInit` / uninstall section：`un.checkAppRunning` → `customCheckAppRunning`（解除安裝程式版，`${isUpdated}` 假）→ 有 `$INSTDIR` 下的程序 → 提示 → `Exec <exe> --uninstall-quit-request` → BAT `request('uninstall')` → T0823 那條：寫 schema 1、停 server（holder 也停）。
2. `customUnInstall` → `batUninstallPtyHolder`：根目錄存在 → 再 `Exec --uninstall-quit-request`（這次通常沒有 BAT：請求行程停掉還在跑的 holder，`server:shutdown` 8 s 內沒結束 → `forceStopServer`）→ 等根目錄與 `$INSTDIR` 沒有程序（≤ 20 s）→ 根目錄沒有程序在跑 → `RMDir /r` 根目錄。
3. 範本刪 `$INSTDIR`（兩個標記檔一起刪）。userData（紀錄、設定）照範本規則保留。

**降級（N+1 → N，或 N → 沒有 holder 的版本）**

- 舊版安裝程式（install section）用**舊版**的 `customCheckAppRunning`：送 `--installer-quit-request`（裝著的 N+1 有 T0823 標記）。N+1 的 BAT 有 holder → 保留 holder（與升級相同）。
- 接著舊版安裝程式執行**較新的** N+1 解除安裝程式（`/S --updated`）→ `${isUpdated}` → `customUnInstall` 不做，holder 留著。
- 舊版第一次啟動：有 holder 支援且協定相容 → 接回（T0861；不相容 → 結束並說明）；**沒有 holder 支援的舊版**（T0857 前）→ 未認證被關閉 → T0704 recovery → 終端結束（與 T0856 Q4「降級」列相同）。比 N 更舊、沒有 T0823 標記處理的版本不受影響（它不讀紀錄 schema 2：`invalid`，丟掉）。🔸 〈待 W6 驗收〉

### 日誌（只記數量與結果，不記路徑、session id、權杖）

| 位置 | 內容 |
|---|---|
| 執行中的 BAT，保留 holder | `[installer-quit] ended <n> agent process(es) under the install directory in <m> tab(s)`、`[installer-quit] request received: Terminal Server runs from the PTY holder (idle <extended\|already-extended\|failed>) — keeping it with <k> terminal(s); recorded <m> tab(s) with ended agent processes, <s> claude session(s) — quitting without confirmation`、`[installer-quit] quit without confirmation (stopTerminalServer=false, PTY holder kept)` |
| 執行中的 BAT，記憶裡是 holder 但 hello 說不是 | `[installer-quit] the Terminal Server is not a kept PTY holder (<no-port\|hello-failed\|not-a-holder>) — stopping it as before`，之後是 T0823 的行 |
| 執行中的 BAT，解除安裝 | `[installer-quit] uninstall request — the Terminal Server stops too`，之後是 T0823 的行 |
| 請求行程，保留 holder | `[installer-quit] no running BAT; Terminal Server runs from the PTY holder (idle …) — keeping it with <k> terminal(s); recorded <m> tab(s) with ended agent processes` |
| 請求行程，解除安裝逾時 | `[installer-quit] Terminal Server still running after 8000 ms — ended (uninstall)` 或 `… and could not be ended — left to the uninstaller` |
| 讀不到程序清單 | `[installer-quit] process list unavailable — no agent process ended` |
| 下次啟動 | `[installer-quit] record found: version=… source=… holder-kept ended-ptys=<n> agent-tabs=<m> claude-sessions=<s>`；`[upgrade-interruption] detected: … holder-kept ended-agent-tabs=<m>` |

### 已知限制（holder 版）

- 只刪**本次安裝範圍**的 holder 根目錄；改過安裝範圍（per-user ↔ per-machine）留下的另一個根目錄不刪（T0858 的範圍規則）。
- 解除安裝的請求只到預設 runtime 的 userData；`--runtime=N` 的 holder、以另一個帳號提權的解除安裝 → holder 沒被請走 → 根目錄有程序在跑 → 保留（DetailPrint）。
- per-machine 互動升級時 UAC inner instance 不跑 `CHECK_APP_RUNNING`（T0820）：主行程被舊版解除安裝程式以路徑強制結束、沒有紀錄；holder 不在 `$INSTDIR` 內 → 仍存活，下次啟動走 Recovery 提示。
- 內嵌 agent 結束後，該分頁的 shell 還在（原本的指令列）；恢復沿用清單，不自動 resume。
- 程序清單到結束之間的時間差（TOCTOU）：期間新起的程序不會被結束（安裝程式等滿 15 s 後回退）；pid 在這之間被重用的機率極低，且只結束路徑在安裝目錄下的程序。
- idle 延長只有一次（server 規則）：送完之後任何 client 的 hello 都會清掉延長（例如使用者在升級前又開了 BAT）。

## holder 版：升級後自動接回、不相容時結束並說明、0 個 PTY 時換新（T0861）

PLAN-065 W5（D286 D4 / D5 / D6）。全部在 `startTerminalServer`（`electron/main.ts`）的「server 還在跑」那一段；判斷是 `electron/upgrade-interruption.ts` 的純函式。

### 自動接回（D4）

🔴 **全部**成立才不跳 Recovery 提示（唯一實作 `decideHolderReattach`）：

| 條件 | 來源 | 不成立時（`reason`，記一行後走 Recovery 提示） |
|---|---|---|
| 有 schema 2 安裝程式紀錄（`holderKept`） | `UpgradeInterruptionCheck.keptHolder()`（`noteInstallerQuit` 記下的紀錄） | `no-record`（不記行：使用者自己關窗保留、per-machine UAC 強制結束主行程、schema 1、沒有紀錄） |
| 紀錄有 holder pid | 紀錄的 `holderPid` | `no-holder-pid` |
| 紀錄的 pid = pid 檔的 pid | `readPidFile` | `pid-file-mismatch` |
| hello 協商成功（不是 protocol 0） | probe 的 `server:hello-ok` | `no-hello` |
| hello 回報的 pid = 紀錄的 pid | `hello.pid` | `hello-pid-mismatch` |
| ≥ 1 個存活的 PTY | probe 的 `pty:list` | `no-ptys`（走下面的 0 個 PTY 規則） |

- 接回 = Recovery「保留」的同一段程式（`reconnectKeptTerminalServer`，`terminal-server:recover` 也呼叫它）：先 `holdCreates('PTY holder reattach')` → `connectToServer`（hello 帶權杖）→ `pty:list` → `releaseCreatesOnReplayList()`。🔴 BUG-146 / T0580 規則不變：清單註冊存活 id 之前不放行，存活 id 的 create 回 `created: false`（不 spawn、不簽權杖、不重送 agent 啟動指令），helper 派工在 hold 中照舊最多等 2 s、逾時 `RECOVERY_PENDING`。
- 連不上（server 剛好死了，或 hello 失敗 → 照下面 D5 結束）→ 與「保留」失敗相同：刪 pid / port / token 檔 → `startTerminalServer()` → `finally releaseCreates('PTY holder reattach failed: new Terminal Server')`。
- 接回成功：`terminalServerReattachedAtStartup = true`，第一個視窗**第一次** `did-finish-load` 不 re-probe（否則 View→Reload 用的 re-probe 會把已接上的 PTY 當成待恢復而跳提示）；之後的 reload 照舊。`noteHolderReattached(N, holder 的 batVersion)` → notice 多 `reattachedPtyCount: N`。
- hello 會清掉 T0860 的 24 h idle 延長（server 規則），接回後 idle 回到設定值。
- 新分頁仍由舊 holder 建立（D6 單一 holder），直到它沒有 PTY、下次啟動換新。

### 說明（toast）

- notice：`reattachedPtyCount` ≥ 1 時，即使沒有結束任何終端（`ptyCount` 0）也會給；`previousVersion` 取 `last-run-version.json`，讀不到時用紀錄的 `version`（兩者都沒有 → 不給 notice，只記一行）。renderer `parseUpgradeInterruptionNotice` 收 `ptyCount ≥ 1` **或** `reattachedPtyCount ≥ 1`；`ptyCount ≥ 1` 的既有 notice 形狀與行為不變。
- 文字：`upgradeNoticeToastKey` → 有 `reattachedPtyCount` 時 `app.upgradeReattached`（版本不同：「BAT 已升級（v舊 → v新）。安裝期間 N 個終端持續執行，已重新接回。」）/ `app.upgradeReattachedSameVersion`（版本相同，T0846 的中性說法：「安裝程式結束了 BAT（v版本）。N 個終端持續執行，已重新接回。」）；值由 `upgradeNoticeToastValues`（`count` = 接回數）。三語都有。
- 被 T0860 結束的內嵌 agent（紀錄的 `endedAgentProcesses`）照 T0860 列進「被中斷的 agent 分頁」（`cause: 'upgrade'`），toast 多「N 個 agent 分頁已中斷，按此查看」一行。

### 恢復被接回分頁的 agent（實際行為）

- 接回後那些分頁的 shell 是同一個（被保留的）PTY：還原的分頁 `pty:create` 回 `created: false`，claude-cli 分頁不重送啟動指令（T0403），分頁停在 shell 提示字元。
- 按「恢復」：claude-cli 分頁 `pty.kill(id)` → `startClaudeCliPty(…, { sessionId })`；codex-cli 分頁 `restartOrCreatePty`（⏻ 路徑）→ `codex resume`。在 Terminal Server 模式下 `kill` 送 `pty:kill`、本機立即移除該 id，server 端 `killPty` 同步刪除項目並以 T0540 順序結束**該分頁的** shell 與它的程序樹，接著的 `pty:create` 在 holder 上建**一個**新 shell（`created: true`）。⇒ 不會把被接回的 shell 當成已結束而另起第二個 shell；結束的只有被恢復那個分頁自己的 shell 樹（與 ⏻ 相同），其他分頁與 holder 不受影響。
- helper 派工的 Worker（沒有 `agentPreset`）走 main `terminal:resume-interrupted-agent`：分頁還在跑（`isRunning`）→ 把 resume 指令寫進**同一個** shell，不 kill、不建新 PTY。
- 驗證：`electron/__tests__/holder-reattach.test.ts`「resuming an agent tab on a kept shell」。

### 不相容（D5）

- probe 或接回的 hello 回 `unauthenticated` / `incompatible` / `timeout`（`endsUnusableServer`）→ `endUnusableTerminalServer`：先讀 registry（shutdown 會刪），`endTerminalServer`：`server:shutdown`（v1 server 沒有共同協定也接受）→ 等 5 s；🔴 Windows 上仍在跑 → `forceStopTerminalServer`（T0860：registry 的 PTY 程序樹先、再 `taskkill /F /T` server、清檔），macOS / Linux 照 T0857 前的行為（記一行、照樣啟動新的）。結束了才把 registry 的 PTY 交給 `noteIncompatibleServer`。
- 偵測：`detectUpgradeInterruption` 的 `incompatibleServerPtyCount ≥ 1` 且（版本不同 **或** 有 holder 紀錄）→ 觸發，N 與孤兒 / 紀錄的 PTY 依 id 聯集，日誌 `source=…incompatible`；agent 分頁照 T0821 列進清單、一鍵恢復，不自動 resume、不通知塔台。版本相同、沒有紀錄 → 不觸發（不是升級）。
- Recovery 提示回答之後才發現不相容（`terminal-server:recover` 走到 hello 失敗）：照樣結束舊 server、啟動新的，但 notice 已在啟動時決定 → 不顯示說明（與 T0861 前相同）。

### 0 個 PTY 且版本不同 → 換新（D6）

- `shouldReplaceIdleServer`：probe **收到** `pty:list` 且 0 個（3 s 內沒回清單 = 數量不確定 → 照舊重連）、hello 的 `batVersion` 是合法版號且 ≠ `app.getVersion()` → `endTerminalServer` 後走既有的清檔＋ fork（本版的 server / holder）。版本未知（沒有 hello、server 沒被告知版本 `''`）或相同 → 照舊靜默重連（T0108）。
- 有 PTY 時不換（新分頁仍由舊 holder 建立）。規則不分平台（macOS / Linux 的 0 個 PTY 舊版 server 也會被換掉；有 PTY 時的 Recovery 提示照舊）。

### 日誌（只記數量與結果）

| 情況 | 內容 |
|---|---|
| 自動接回 | `[terminal-server] N live PTYs on the PTY holder the installer kept — reconnecting without the Recovery prompt`、`[BUG-146] pty:create held (PTY holder reattach)`、`[terminal-server] PTY holder reattach — connected to port <p>`；`[upgrade-interruption] reattached: previous=… current=…[ same-version] reattached-ptys=N holder-version=…`（有被結束的 agent 時是 `detected: … holder-kept ended-agent-tabs=M reattached-ptys=N holder-version=…`） |
| 有紀錄但不接回 | `[terminal-server] the installer kept a PTY holder, but <reason> — showing the Recovery prompt` |
| 接回失敗 | `[terminal-server] PTY holder reattach failed (hello <r> \| server died) — …`、`[BUG-146] pty:create released (PTY holder reattach failed: new Terminal Server)` |
| 不相容 | 既有 `existing server on port <p>: hello <r> — ending it`；仍在跑時既有的 `unusable server still running after 5000 ms — starting the new one anyway`，Windows 再 `unusable server ended with its PTY trees (taskkill): gone\|still running`；`[upgrade-interruption] detected: … source=incompatible` |
| 換新 | `[terminal-server] existing server on port <p> has no PTYs and runs v<舊> (this is v<新>) — replacing it`；結束不了時同上（`replaced server …`） |
| renderer | `[upgrade-interruption] notice shown: … reattached-ptys=N` |

### 驗證

- 單元：`electron/__tests__/holder-reattach.test.ts`（條件表逐列、`shouldReplaceIdleServer` 逐列、notice：接回 / 接回＋被結束的 agent / 同版 / 版本檔缺少時用紀錄版本 / finish 之後忽略、不相容來源（版本不同、同版＋紀錄、同版無紀錄）、hold 在清單前不放行、恢復被接回分頁 = 一個 `pty:kill` 再一個 `pty:create`、main.ts source guard（決策在 Recovery 提示前、hold → 共用保留 → 記下 → return、失敗 finally 放行、D5 先讀 registry、D6 分支、第一次載入不 re-probe））；`src/components/__tests__/upgrade-reattached-toast.test.tsx`（三語、parse、key / 值、toast 逐字、agent 列）。`recovery-create-hold.test.ts` 的 recover source guard 改為檢查共用函式（順序不變）。
- e2e：`e2e/t0861-holder-reattach.spec.ts`（Windows、打包版 `BAT_E2E_EXECUTABLE`，同 T0860 的暫存 holder）：cmd 分頁 → 升級請求 → 重開：沒有 Recovery 提示、`reattachedSameVersion` toast、同一個 holder pid 與 shell pid、輸入到達同一個 shell 且輸出回來；對照：紀錄的 holder pid 改錯 → 重開跳 Recovery 提示、「保留」後同一個 shell。
- 〈待 W6 驗收〉真實 N → N+1 升級後的接回與 toast 文字（版本不同）、不相容（降級到協定不同的版本）、per-machine 範圍（UAC 強制結束 → 沒有紀錄 → Recovery 提示）、0 個 PTY 的舊版 holder 換新。

## 已知限制

- **子項 4（holder 模型）**：PLAN-065 W1–W4（T0857–T0860）已做到「升級保留 holder」，W5（T0861）接回（不跳 Recovery 提示、toast「已接回」）；真實升級驗收在 W6。沒有 holder（zip、開發模式、macOS / Linux、holder 缺少或不符）時升級仍會結束所有終端；子項 3 只讓結束變成正常結束。
- macOS / Linux 的升級行為未研究：偵測邏輯在所有平台都會跑（有紀錄，或版本變＋有孤兒才觸發），但升級前的提示與 NSIS 請求只在 Windows。
- 只看「版本變＋（孤兒或紀錄）」：版本變了、上一次結束時剛好有 Terminal Server 被當機 / 手動結束（不是安裝程式）也會被說成升級。反過來，升級前已先「結束並停止 Terminal Server」的使用者沒有孤兒也沒有紀錄，不顯示（也沒有東西被結束）。
- 第一次升到含 T0823 的版本時（裝著的是 T0823 前的版本）不送請求，照舊強制結束、重開走孤兒清理；之後的升級才是正常結束。
- 標記只看安裝目錄：使用者自己複製或刪掉 `resources\installer-quit-request.supported` 會讓判斷失準（多送：舊版開一個視窗、15 s 後回退；少送：照舊強制結束）。
- 使用者的離開對話框開著時收到請求：不處理，交給安裝程式 15 s 後回退。
- 「只顯示一次」是每個 BAT 行程給第一個視窗；多個主視窗時其他視窗不顯示（清單本身每個視窗照舊只列自己的分頁）。
- `InterruptedAgentsStore` 只在記憶體（D211 P-5）：升級說明關掉後、BAT 再重開一次，清單就沒了。
- helper 派工的 Worker：升級後沒有 workorder / 塔台 id（env 不持久化），清單裡排在一般分頁，恢復走 main 的 builder、不帶 workorder。
- 孤兒清理以 registry 的舊 pid 結束程序：升級到重開之間 pid 被重用會誤殺（T0820 指出的既有風險）。T0823 起正常結束不留孤兒；回退到強制結束時（舊版、逾時、UAC inner instance）風險照舊。

## 驗證

- 單元：`electron/__tests__/upgrade-interruption.test.ts`（觸發條件四種＋T0846 同版＋紀錄 / 同版＋只有孤兒 / 同版＋空紀錄、版本檔讀寫失敗、來源判斷、`UpgradeInterruptionCheck` 生命週期與只給一次、`cause: 'upgrade'` 的 session-start 規則、main.ts 孤兒清理順序 source guard）；`src/components/__tests__/upgrade-interruption.test.tsx`（三語字串、更新通知只在 win32 顯示且既有內容不變、toast（T0846：同版文字、版本不同文字逐字不變）、對話框標題、App.tsx source guard）。突變：拿掉版本條件 / N 條件 / win32 判斷 / session-start 規則 → 對應測試失敗（T0821 實測）。
- e2e：`e2e/t0821-upgrade-interruption.spec.ts`（Windows、隔離 runtime、需先 `npx vite build`）：開兩個 shell 分頁 → 關閉時保留 Terminal Server → `taskkill /F /PID <server>`（不帶 `/T`，模擬安裝程式）→ 改寫 `last-run-version.json` 為舊版、寫一筆上一個行程的 claude session 紀錄（不啟動 claude、不呼叫模型）→ 重開：toast 含 N=2 與兩個版本、日誌 `detected … ended-ptys=2 agent-tabs=1`、兩個分頁還原、點 toast 開清單（1 列 claude-cli、session 前 8 碼、升級說明）、reload 後不再顯示；對照組（不改版本）：不顯示、沒有 `detected`，孤兒清理照舊。
- T0823 單元：`electron/__tests__/installer-quit-request.test.ts`（參數辨識、紀錄驗證與只讀一次、`InstallerQuitController` 啟動中保留 / 只處理一次 / 已在 quit 時不處理 / 失敗仍結束、沒有 BAT 主行程時停 server、新版偵測合併規則、main.ts / installer.nsh / package.json source guard、electron-builder 範本掛勾與版本）。突變 11 種（拿掉紀錄條件、啟動中直接執行、請求時不停 server、忽略紀錄、紀錄不刪、忽略進行中的 quit、nsh 不送請求、whenReady 不擋請求行程（兩種寫法）、nsh 不看標記、`customInstall` 不寫標記）→ 對應測試失敗。
- T0823 e2e：`e2e/t0823-installer-graceful-quit.spec.ts`（Windows、隔離 runtime、需先 `npx vite build`）：兩個 shell 分頁 → 第二個實例帶 `--installer-quit-request` → BAT 在 15 s 內結束（不跳對話框）、`[quit] terminal server stopped (via IPC server:shutdown)`、pid / port / registry 檔已清、shell 已結束、紀錄列 2 個終端 → 改寫上次版本後重開：toast N=2、`detected … source=installer`、紀錄已刪、沒有孤兒清理；對照（不改版本）：不顯示、紀錄已刪；server-only：保留 server 離開後送請求 → 請求行程停掉 server、紀錄 `server-only`。
- T0825（BUG-210）：單元 `electron/__tests__/second-instance-startup.test.ts`（whenReady 只有一個、判斷是 callback 第一個敘述且在所有啟動步驟之前、只記交接行並 return、T0823 `installerQuitWithoutApp` 不變）；突變 4 種（判斷只剩請求行程 / 只剩 lock、拿掉 return、log 帶 argv）→ 測試失敗。e2e `e2e/t0825-second-instance-startup.spec.ts`（隔離 runtime、需先 `npx vite build`）：一個 shell 分頁 → 第二個實例（不帶參數 / `--profile=<執行中視窗的 profile>`）約 0.35 s 結束、自己的日誌只有交接行（沒有 `app.whenReady fired`、tray、`[terminal-server]`）、沒有新的 Terminal Server 程序、pid / port 檔不變、執行中 BAT 的 shell 與 server 照跑；執行中的 BAT 照舊開新視窗 / 把該 profile 的視窗帶到前面。對照（拿掉修正）：第二個實例約 2.45 s 才結束，日誌有 `app.whenReady fired`、`system tray created`、`[helper-cap] restored …`、`[terminal-server] 1 live PTYs detected — deferring to user recovery decision`。
- T0860 單元：`electron/__tests__/installer-quit-holder.test.ts`（`--uninstall-quit-request` 辨識、hello 判斷 holder 與路徑規則、內嵌 agent 判斷（只比路徑、不含 shell、不含樹外、pid 重用）、程序清單解析、結束與日誌只記數量、schema 2 讀寫與 schema 1 不變、controller 兩條路（沒有 holder 時同步、逐字 T0823）與解除安裝、請求行程保留 holder / 解除安裝強制結束、真 TCP 的 `queryKeptHolder`（hello＋extendIdle 24 h、ALREADY_EXTENDED、不是 holder 不送 extendIdle）、下次啟動的 schema 2 偵測、main.ts / installer.nsh / 範本 source guard）。既有的 `installer-quit-request.test.ts`、`second-instance-startup.test.ts`、`upgrade-interruption.test.ts` 不改。
- T0860 e2e：`e2e/t0860-installer-quit-holder.spec.ts`（Windows、需要打包版 `BAT_E2E_EXECUTABLE`；holder 複製到暫存的 `LOCALAPPDATA`，同 T0859）：① BAT 在跑、cmd 分頁裡跑一個執行檔在安裝目錄下的替身（打包版 exe 以 node 模式執行）→ 升級請求 → BAT 0.7 s 內結束、holder 與 shell 還在、替身已結束、安裝目錄下沒有任何程序、紀錄 schema 2 `running-app`；② 沒有 BAT、經 TCP 在同一分頁再起替身 → 升級請求 → 請求行程結束替身、保留 holder、紀錄 `server-only`；③ 解除安裝請求 → holder 停止、pid / port / token 檔清掉、shell 結束。沒有 holder 的路徑：`e2e/t0823-installer-graceful-quit.spec.ts` 以原始碼版與打包版（`build:dir` 沒有 holder 根目錄與標記）各跑一次。T0860 同時把該 spec 的 control 情境改成 T0846 的同版規則（之前一直期待「不顯示」）。
- 〈待 W6 驗收〉安裝程式實際執行：N → N+1 升級時 holder 不被結束（含 N 的解除安裝程式 `--updated` 不碰 holder）、真的解除安裝刪掉根目錄（per-user / per-machine）、根目錄有程序在跑時保留、降級。
- 真實升級（pre.N → pre.N+1 兩版都含本功能）要等下次發版：以 T0820 的探測 spec（本機分支 `ct/T0820`）改寫，情境 ①② 重開後檢查 `[upgrade-interruption] detected` 行與 toast，並確認情境「先結束並停止 Terminal Server 再升級」不顯示。
