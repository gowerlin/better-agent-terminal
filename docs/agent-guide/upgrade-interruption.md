# 升級前提示與升級後說明（PLAN-063 子項 1、2 / T0821；子項 3 / T0823）

> 對應 CLAUDE.md「升級結束終端的提示與說明（PLAN-063 / T0821）」節。改這個功能時兩邊一起更新。

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
| 有，且不同 | ≥ 1 | 任意 | **觸發**：「上次升級結束了 N 個終端」 |
| 有，且不同 | 任意 | ≥ 1 | **觸發**（正常結束沒有孤兒，靠紀錄） |
| 與目前相同（當機、工作管理員結束、安裝取消） | 任意 | 任意 | 不觸發（與 T0821 前相同；紀錄照樣刪掉） |
| 有，且不同 | 0 | 0 / 沒有紀錄 | 不觸發，記一行 `none` |
| 沒有（第一次執行、檔案讀不到 / 內容不對） | 任意 | 任意 | 不觸發 |

N = 兩份清單依 terminal id 的聯集（紀錄在前）；claude session 以紀錄的為準（紀錄是在 PTY 還在跑時取的）。日誌 `detected` 行結尾的 `source=orphans|installer|installer+orphans` 標明來源。

- 「上次版本」存在 `<userData>/last-run-version.json`（`{ "schema": 1, "version": "<app.getVersion()>" }`）。`UpgradeInterruptionCheck.begin()` 在 whenReady、`startTerminalServer()` 之前讀舊值、再寫入目前版本（版本相同時不寫）；所以升級前的版本在升級前就已經寫好。寫入走 temp 檔＋rename，失敗只記一行、不丟例外；路徑由 main 傳入（🔴 模組不在 import 期呼叫 `app.getPath`）。
- N = 孤兒清理讀到的 `bat-pty-registry.json` 的 `ptys.length`（與 `Cleaned N orphan PTY process(es)` 同一個數）。`noteOrphanCleanup` 只記下 registry 的 id / cwd 與上一個行程的 claude session 紀錄（`claudeSessionPersistence.entries()`，此時都還是 pending），不碰程序。只有每個行程第一次孤兒清理算數；`finish` 只執行一次。
- 🔴 孤兒清理本身的行為與順序不變：`readRegistry` → （T0821：記下）→ `killOrphanPtyProcesses`（T0540：先殺程序樹再殺 shell）→ `Cleaned …` → `clearRegistry` → 刪 pid / port 檔。Recovery 提示（T0578）、Terminal Server recovery（T0704）的觸發條件與流程不變。`upgrade-interruption.test.ts` 有 source guard 守住順序。

### 說明的顯示

- main：`finishUpgradeInterruptionCheck()`（`electron/main.ts`，`startTerminalServer()` 之後、建立視窗之前）判定一次，結果留在 `UpgradeInterruptionCheck`。IPC `terminal-server:query-upgrade-interruption`（`ipcMain.handle`，🔴 只給本機 renderer，不是 helper / RemoteServer channel）回 `{ previousVersion, currentVersion, ptyCount, agentCount }`，**第一個問的視窗拿到、之後回 null**（只顯示一次；reload 不再出現；版本檔已改成目前版本，下次啟動也不會再觸發）。
- renderer：`App.tsx` 掛載時 pull（`parseUpgradeInterruptionNotice` 驗證），沿用既有的 `ServerStatusToast`（key `UPGRADE_INTERRUPTED_TOAST_KEY` = `app.upgradeInterrupted`，帶 `count` / `from` / `to`）。
  - 選 `ServerStatusToast` 的理由：同一個位置、同一種「Terminal Server 的分頁被重建」語意；T0766 已在它上面加了「N 個 agent 分頁已中斷，按此查看」一行與點擊開清單，升級說明直接沿用，不新開 Dialog（CLAUDE.md Dialog 規則：不新增 Dialog）。
  - heartbeat toast（T0112）顯示中時優先顯示它，升級說明排在後面；升級說明不自動消失，點一下關閉（有 agent 分頁時同時開清單）。
- 文字（三語）：「BAT 已升級（v舊 → v新）。安裝新版時結束了 N 個終端，包括其中執行中的指令與 agent；分頁已用新的 shell 重新開啟。」

### agent 分頁（沿用「被中斷的 agent 分頁」）

- 來源 `buildUpgradeInterruptedSources`：對每個被清掉的 PTY id，
  - 存檔分頁（`windows.json` 各視窗的 `terminals`，`windowRegistry.readAll()`）的 `agentPreset`（不是 `none` 才算）、`workspaceId`、`launchRole: 'tower'`（當成 `role: 'tower'`，排序用）；
  - 上一個行程的 `claude-sessions.json` 紀錄：有 session id（UUID）或 `--name` 而存檔沒有 `agentPreset`（helper 派工的 claude Worker）→ 當成 `claude-cli`；session id 只取 UUID。
  - 其他升級後都不存在（沒有 `session-start` / OSC、沒有 workorder env），`startedAt` null、`blockedDetection` `none`。
- 之後與 recovery 同一條路：`buildInterruptedAgentSnapshot(…, { cause: 'upgrade' })` → `InterruptedAgentsStore.record(snapshot, 'upgrade')`。不改任何持久化格式：只多一個記憶體欄位 `InterruptedAgent.cause: 'upgrade'`（renderer 的 `InterruptedAgentInfo` 同名鏡像）。
- 與 recovery 的差異（只對 `cause: 'upgrade'` 的項目）：
  - `record(…, 'upgrade')` 送 `reason: 'update'`：對話框不自己開（視窗此時還不存在，renderer 以既有的 pull 取得清單），由升級說明 toast 點開。
  - 🔴 `session-start` 不移除項目：還原的 claude-cli 分頁會自己開一個新的 claude（`WorkspaceView` 還原流程），它的 `SessionStart` 不是 resume。其餘移除時機不變（恢復時先 kill → `pty-ended`、main 的 `resumed`、略過 `dismissed`、關分頁 / ⏻ → `pty-ended`）。
  - 對話框（`InterruptedAgentsDialog`）在每一列都是升級造成時改用 `interruptedAgents.upgradeTitle` / `upgradeDesc`（說明 claude / codex 分頁可能已經開了新的 agent，按「恢復」會結束它、接續升級前的對話）；有 recovery 列時維持原標題與說明。
- 🔴 恢復沿用 T0766 / T0767：claude-cli 分頁 `startClaudeCliPty` ＋ `claudeResumeArgs`（session 未知 → `--resume` picker），codex-cli 分頁 `resumeCodexCliTab` ＋ `codexResumeArgs`（codex 自己的 resume 選單），其他經 main `terminal:resume-interrupted-agent`。不自動 resume、不自動重跑指令、不通知塔台。

### 日誌

| 位置 | 內容 |
|---|---|
| main，觸發 | `[upgrade-interruption] detected: previous=<舊> current=<新> ended-ptys=<N> agent-tabs=<M> source=<orphans\|installer\|installer+orphans>` |
| main，版本變了但沒觸發 | `[upgrade-interruption] none: previous=<舊或 unknown> current=<新> ended-ptys=<N>` |
| main，版本相同 | 不記 |
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
| 新版安裝程式，本身已以系統管理員執行 | install section（非 inner instance） | 有，但 `${UAC_IsAdmin}` 時本單不送請求（避免以系統管理員身分啟動 BAT），只跑範本原本的檢查 |
| 舊版解除安裝程式（覆蓋安裝時新版以 `/S --updated` 執行） | `un.checkAppRunning` | 用的是**舊版**編進去的版本：T0823 前的版本照舊強制結束；T0823 之後的版本有本單的巨集（`--updated` → 不跳提示），但此時 BAT 已被新版安裝程式請走，找不到程序 |
| 使用者解除安裝（設定 → 應用程式） | `un.checkAppRunning`（靜默時於 `un.onInit`） | 有（同安裝程式；提權時不送請求） |

- 覆寫方式：`build/installer.nsh` 經 `build.nsis.include` 放進 header（在範本 `allowOnlyOneInstallerInstance.nsh` 之前）。定義 `customCheckAppRunning` 後範本**不再** `!include "getProcessInfo.nsh"`、不宣告 `Var pid`，所以本檔自己補上；回退是原樣 `!insertmacro _CHECK_APP_RUNNING`（範本的巨集，不是複製）。`IS_POWERSHELL_AVAILABLE` / `FIND_PROCESS` 也是範本的巨集。
- 升級 electron-builder 時：`electron/__tests__/installer-quit-request.test.ts` 的最後一個測試鎖住 `app-builder-lib` 版本（26.8.1）與上面這些掛勾的原文，版本一變就失敗，提醒依 [packaging-release-checks.md](packaging-release-checks.md)「NSIS：安裝前請 BAT 正常結束」重新核對。

### 流程

1. 安裝程式（`batRequestGracefulQuit`）：不是 app 本身、未提權、`$INSTDIR\BetterAgentTerminal.exe` 存在，且 `FIND_PROCESS` 找到安裝目錄下的程序 →
2. 不是 `--updated` 時先顯示範本同一句提示（`$(appRunning)`，確定 / 取消；取消 = 結束安裝程式；`/S` 自動確定）。
3. `Exec "<安裝目錄>\BetterAgentTerminal.exe --installer-quit-request"`，每 `BAT_INSTALLER_QUIT_POLL_MS` = 500 ms 以 `FIND_PROCESS` 檢查，最多 `BAT_INSTALLER_QUIT_TIMEOUT_MS` = 15 s（`GetTickCount` 計時）。
4. 無論結果，接著跑範本的 `_CHECK_APP_RUNNING`：程序都結束了 → 什麼都不做；還有 → 範本原本的提示 / 強制結束（與 T0823 前相同）。
5. BAT 端（`electron/installer-quit-request.ts`）：
   - 帶參數的行程拿不到 lock（BAT 在跑）→ Electron 把 argv 交給執行中的 BAT（`second-instance`），自己 `app.quit()`。🔴 這個行程（不論有沒有 lock）在 whenReady 開頭 return（`installerQuitRequestProcess`）：T0823 本機 e2e 實測，第二個實例 `app.quit()` 後 whenReady 照樣執行，執行中的 BAT 一結束、釋放 lock 與 Terminal Server，它就會跑完整啟動、讀掉紀錄並 fork 新 server。
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
| BAT 是 T0823 前的版本（例 pre.5 → pre.6 這一次） | 強制結束 | 請求被舊版當成「開新視窗」（舊版的 `second-instance`）；等滿 15 s 後範本照舊：互動安裝**再顯示一次**提示，然後強制結束。安裝多花約 15 s |
| 提權（所有使用者）安裝 | 強制結束（或 inner instance 不檢查） | 相同 |
| 只剩保留的 Terminal Server | server 被強制結束、重開走孤兒清理 | 請求行程請 server 正常 shutdown |
| BAT 以 `--runtime=N` 執行 | 強制結束 | 相同（請求只到預設 runtime 的 lock；逾時後回退） |
| 重開後的說明 | 版本變＋孤兒 → toast | 版本變＋（孤兒或紀錄）→ 同一則 toast；文字相同 |

## 已知限制

- **子項 4（holder 模型：讓 ConPTY 持有者撐過升級）未做**，見 PLAN-063。升級仍會結束所有終端；子項 3 只讓結束變成正常結束。
- macOS / Linux 的升級行為未研究：偵測邏輯在所有平台都會跑（版本變＋有孤兒或紀錄才觸發），但升級前的提示與 NSIS 請求只在 Windows。
- 只看「版本變＋（孤兒或紀錄）」：版本變了、上一次結束時剛好有 Terminal Server 被當機 / 手動結束（不是安裝程式）也會被說成升級。反過來，升級前已先「結束並停止 Terminal Server」的使用者沒有孤兒也沒有紀錄，不顯示（也沒有東西被結束）。
- T0823 前的版本在跑時，請求會讓它開一個新視窗（舊版 `second-instance` 的行為），接著被強制結束；只在升到第一個含 T0823 的版本時發生一次。
- 使用者的離開對話框開著時收到請求：不處理，交給安裝程式 15 s 後回退。
- 「只顯示一次」是每個 BAT 行程給第一個視窗；多個主視窗時其他視窗不顯示（清單本身每個視窗照舊只列自己的分頁）。
- `InterruptedAgentsStore` 只在記憶體（D211 P-5）：升級說明關掉後、BAT 再重開一次，清單就沒了。
- helper 派工的 Worker：升級後沒有 workorder / 塔台 id（env 不持久化），清單裡排在一般分頁，恢復走 main 的 builder、不帶 workorder。
- 孤兒清理以 registry 的舊 pid 結束程序：升級到重開之間 pid 被重用會誤殺（T0820 指出的既有風險）。T0823 起正常結束不留孤兒；回退到強制結束時（舊版、逾時、提權）風險照舊。

## 驗證

- 單元：`electron/__tests__/upgrade-interruption.test.ts`（觸發條件四種、版本檔讀寫失敗、來源判斷、`UpgradeInterruptionCheck` 生命週期與只給一次、`cause: 'upgrade'` 的 session-start 規則、main.ts 孤兒清理順序 source guard）；`src/components/__tests__/upgrade-interruption.test.tsx`（三語字串、更新通知只在 win32 顯示且既有內容不變、toast、對話框標題、App.tsx source guard）。突變：拿掉版本條件 / N 條件 / win32 判斷 / session-start 規則 → 對應測試失敗（T0821 實測）。
- e2e：`e2e/t0821-upgrade-interruption.spec.ts`（Windows、隔離 runtime、需先 `npx vite build`）：開兩個 shell 分頁 → 關閉時保留 Terminal Server → `taskkill /F /PID <server>`（不帶 `/T`，模擬安裝程式）→ 改寫 `last-run-version.json` 為舊版、寫一筆上一個行程的 claude session 紀錄（不啟動 claude、不呼叫模型）→ 重開：toast 含 N=2 與兩個版本、日誌 `detected … ended-ptys=2 agent-tabs=1`、兩個分頁還原、點 toast 開清單（1 列 claude-cli、session 前 8 碼、升級說明）、reload 後不再顯示；對照組（不改版本）：不顯示、沒有 `detected`，孤兒清理照舊。
- T0823 單元：`electron/__tests__/installer-quit-request.test.ts`（參數辨識、紀錄驗證與只讀一次、`InstallerQuitController` 啟動中保留 / 只處理一次 / 已在 quit 時不處理 / 失敗仍結束、沒有 BAT 主行程時停 server、新版偵測合併規則、main.ts / installer.nsh / package.json source guard、electron-builder 範本掛勾與版本）。突變 9 種（拿掉紀錄條件、啟動中直接執行、請求時不停 server、忽略紀錄、紀錄不刪、忽略進行中的 quit、nsh 不送請求、whenReady 不擋請求行程（兩種寫法））→ 對應測試失敗。
- T0823 e2e：`e2e/t0823-installer-graceful-quit.spec.ts`（Windows、隔離 runtime、需先 `npx vite build`）：兩個 shell 分頁 → 第二個實例帶 `--installer-quit-request` → BAT 在 15 s 內結束（不跳對話框）、`[quit] terminal server stopped (via IPC server:shutdown)`、pid / port / registry 檔已清、shell 已結束、紀錄列 2 個終端 → 改寫上次版本後重開：toast N=2、`detected … source=installer`、紀錄已刪、沒有孤兒清理；對照（不改版本）：不顯示、紀錄已刪；server-only：保留 server 離開後送請求 → 請求行程停掉 server、紀錄 `server-only`。
- 真實升級（pre.N → pre.N+1 兩版都含本功能）要等下次發版：以 T0820 的探測 spec（本機分支 `ct/T0820`）改寫，情境 ①② 重開後檢查 `[upgrade-interruption] detected` 行與 toast，並確認情境「先結束並停止 Terminal Server 再升級」不顯示。
