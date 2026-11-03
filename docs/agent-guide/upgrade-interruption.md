# 升級前提示與升級後說明（PLAN-063 子項 1、2 / T0821）

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

| 上次版本 | 目前版本 | 孤兒清理找到的 PTY（N） | 結果 |
|---|---|---|---|
| 有，且不同 | — | ≥ 1 | **觸發**：「上次升級結束了 N 個終端」 |
| 與目前相同（當機、工作管理員結束） | — | 任意 | 不觸發（與 T0821 前相同） |
| 有，且不同 | — | 0（沒有孤兒，或 registry 是空的） | 不觸發，記一行 `none` |
| 沒有（第一次執行、檔案讀不到 / 內容不對） | — | 任意 | 不觸發 |

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
| main，觸發 | `[upgrade-interruption] detected: previous=<舊> current=<新> ended-ptys=<N> agent-tabs=<M>` |
| main，版本變了但沒觸發 | `[upgrade-interruption] none: previous=<舊或 unknown> current=<新> ended-ptys=<N>` |
| main，版本相同 | 不記 |
| main，版本檔寫不進去 | `[upgrade-interruption] could not write last-run-version.json (version <新>)` |
| main，清單 | 既有的 `[interrupted-agents] interrupted: terminal=… session=<前 8 碼>`，加 `[interrupted-agents] upgrade interrupted M agent tab(s); listed K` |
| renderer | `[upgrade-interruption] notice shown: previous=… current=… ended-ptys=N agent-tabs=M` |

🔴 不記 session id 全文、指令內容或權杖。

## 已知限制

- **子項 3（NSIS 自訂 `customCheckAppRunning` / 安裝前確認）、子項 4（holder 模型：讓 ConPTY 持有者撐過升級）未做**，見 PLAN-063。本功能只「偵測＋說明」，升級仍會結束所有終端。
- macOS / Linux 的升級行為未研究：偵測邏輯在所有平台都會跑（版本變＋有孤兒才觸發），但升級前的提示只在 Windows。
- 只看「版本變＋有孤兒」：版本變了、上一次結束時剛好有 Terminal Server 被當機 / 手動結束（不是安裝程式）也會被說成升級。反過來，升級前已先「結束並停止 Terminal Server」的使用者沒有孤兒，不顯示（也沒有東西被結束）。
- 「只顯示一次」是每個 BAT 行程給第一個視窗；多個主視窗時其他視窗不顯示（清單本身每個視窗照舊只列自己的分頁）。
- `InterruptedAgentsStore` 只在記憶體（D211 P-5）：升級說明關掉後、BAT 再重開一次，清單就沒了。
- 縮圖的 ⏸ tooltip 仍寫「因 Terminal Server 重啟而中斷」（`interruptedAgents.badgeTooltip`，`TerminalThumbnail.tsx` 不在本單範圍）。
- helper 派工的 Worker：升級後沒有 workorder / 塔台 id（env 不持久化），清單裡排在一般分頁，恢復走 main 的 builder、不帶 workorder。
- 孤兒清理以 registry 的舊 pid 結束程序：升級到重開之間 pid 被重用會誤殺（T0820 指出的既有風險，本單未改）。

## 驗證

- 單元：`electron/__tests__/upgrade-interruption.test.ts`（觸發條件四種、版本檔讀寫失敗、來源判斷、`UpgradeInterruptionCheck` 生命週期與只給一次、`cause: 'upgrade'` 的 session-start 規則、main.ts 孤兒清理順序 source guard）；`src/components/__tests__/upgrade-interruption.test.tsx`（三語字串、更新通知只在 win32 顯示且既有內容不變、toast、對話框標題、App.tsx source guard）。突變：拿掉版本條件 / N 條件 / win32 判斷 / session-start 規則 → 對應測試失敗（T0821 實測）。
- e2e：`e2e/t0821-upgrade-interruption.spec.ts`（Windows、隔離 runtime、需先 `npx vite build`）：開兩個 shell 分頁 → 關閉時保留 Terminal Server → `taskkill /F /PID <server>`（不帶 `/T`，模擬安裝程式）→ 改寫 `last-run-version.json` 為舊版、寫一筆上一個行程的 claude session 紀錄（不啟動 claude、不呼叫模型）→ 重開：toast 含 N=2 與兩個版本、日誌 `detected … ended-ptys=2 agent-tabs=1`、兩個分頁還原、點 toast 開清單（1 列 claude-cli、session 前 8 碼、升級說明）、reload 後不再顯示；對照組（不改版本）：不顯示、沒有 `detected`，孤兒清理照舊。
- 真實升級（pre.N → pre.N+1 兩版都含本功能）要等下次發版：以 T0820 的探測 spec（本機分支 `ct/T0820`）改寫，情境 ①② 重開後檢查 `[upgrade-interruption] detected` 行與 toast，並確認情境「先結束並停止 Terminal Server 再升級」不顯示。
