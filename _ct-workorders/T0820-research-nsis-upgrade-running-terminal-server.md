---
schema_version: 1
schema_kind: workorder
id: T0820
title: "研究（PLAN-059 Q4）：NSIS 覆蓋升級時，執行中的 BAT 與 Terminal Server（含其中的 shell）會不會被結束"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T01:17:22+0800"
started_at: "2026-11-04T01:18:10+0800"
updated_at: "2026-11-04T01:33:04+0800"
completed_at: "2026-11-04T01:33:04+0800"
session_ids:
  - "b2aea0ae-1832-475e-ae11-3fc868e654c4"
depends_on: []
related:
  - "PLAN-059（子項 D、Q4）；D265；T0740 / T0801（`e2e/manual/nsis-reinstall-acceptance.ps1`，前置條件是 BAT 已關閉）；T0540 / T0704（Terminal Server 程序樹、recovery）；T0578（Recovery 提示）；T0783 / T0797（只 build 不發布、手動驗收 workflow 的前例）"
affects_files:
  - _ct-workorders/T0820-research-nsis-upgrade-running-terminal-server.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 研究型：只查證、不修。main 上唯一可改的是本工單（回報區）；不得 commit 產品程式、測試、文件、或 main 上的 workflow。結論寫給塔台判斷 PLAN-059 子項 D 的價值，由塔台決定是否開子 PLAN。"
  - "🔴 絕對不在本機實測：本機 Windows 正在使用的 BAT 安裝版（`C:\\Program Files\\BetterAgentTerminal`）不得重裝、升級、解除安裝、關閉，不得結束它或它的 Terminal Server；不執行任何 BAT 安裝檔、不跑 `nsis-reinstall-acceptance.ps1`。本機只做靜態分析（讀 `node_modules/app-builder-lib` 的 NSIS 模板、`package.json` `build` 設定、BAT 原始碼）。"
  - "🔴 實測只在 GitHub Actions Windows runner：授權 push 分支 `ct/T0820`（自 `main` 開出），分支上可新增一個**暫時的** workflow（`on: push: branches: [ct/T0820]`，因 `workflow_dispatch` 須在預設分支才能觸發），只做驗收、不建 tag / Release / Pages、不帶任何 secret（`GITHUB_TOKEN` 唯讀即可下載公開 release）。驗完刪遠端 `ct/T0820`；本機分支保留給塔台判斷。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 L185：只開 shell 分頁，不開 claude / codex 分頁、不對 agent TUI 送按鍵、不登入任何服務。回報不記權杖或環境變數值（只記名稱），不寫家目錄真實路徑或帳號名（D176）。實測不到的部分標「推論」。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版。Git（main）：只 commit 本工單（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0820 — 研究：NSIS 覆蓋升級時執行中的 Terminal Server（PLAN-059 Q4）

## 元資料

- **工單編號**：T0820
- **類型**：research（靜態分析＋CI 實測，不修）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-04T01:17:22+0800
- **預估規模**：M

## 背景

PLAN-059 子項 D 借鏡 Herdr 的 holder 模型（每個終端一個 holder，core 可單獨重啟 / 更新）。它的價值取決於 Q4：**使用者在 BAT 開著（含 Terminal Server 與其中的 shell / agent）時執行新版 NSIS 安裝檔，這些程序會不會被結束？** 歷次 NSIS 驗收（T0740 / T0801 腳本）都要求先關閉 BAT，沒有測到這個情況。

塔台推論（未驗證）：Terminal Server 以 `process.execPath`（同一個 `BetterAgentTerminal.exe`，`ELECTRON_RUN_AS_NODE`）fork；electron-builder 的 NSIS 安裝程式會偵測並結束執行中的 app，且 Windows 上執行中的 exe 不能覆寫，所以推論「會被結束」。另外 Terminal Server 存活時 BAT 重開會出現 Recovery 提示（T0578），升級後若 server 被殺，重開就沒有可還原的 PTY。

## 研究問題

1. **靜態**：electron-builder 26.x 的 NSIS 模板（`allowOnlyOneInstallerInstance.nsh`、`installUtil` / `CHECK_APP_RUNNING` 等）如何偵測、提示、結束執行中的 app？比對的是程序名稱、路徑、還是其他條件？互動安裝與 `/S` 靜默安裝的差別？`package.json` 的 `build.nsis` 設定（`oneClick`、`perMachine`、`allowElevation` 等）會走哪條路？覆蓋安裝時舊版解除安裝程式（`uninstallOldVersion`）的角色？BAT 有沒有自動更新（electron-updater 或其他）路徑，有的話它的流程。
2. **實測**（Windows runner）：安裝 `v0.7.4-pre.4`（NSIS，`/S`；範圍選一種並寫明）→ 以隔離方式啟動 BAT（可用 Playwright `_electron.launch` 指向安裝版 exe 與 `--runtime=<id>`，比照 `e2e/fixtures/electron-isolation.ts`），開 shell 分頁並在其中跑一個長命令（例 `ping -t 127.0.0.1` 或 node 計時器）確認 Terminal Server 存活 → **BAT 主視窗仍開著**時執行 `v0.7.4-pre.5` 安裝檔 `/S` → 記錄：安裝程式 exit code、耗時；主行程、Terminal Server、shell、長命令四者是否存活（pid 前後）；安裝結果的 FileVersion。再做一輪「主行程已關閉、保留 Terminal Server（關閉確認選保留，或等效作法）」的情境，看 server 與 shell 是否存活、升級後重開是否出現 Recovery 提示、能否還原。
3. **互動安裝**（推論即可，能實測更好）：使用者雙擊安裝檔時看到什麼（「app 正在執行，請關閉」對話框？自動結束？）。
4. **結論**：Q4 的答案（會 / 不會 / 視情況），對使用者的影響（升級會中斷哪些東西），以及對 PLAN-059 子項 D 的意涵：holder 模型或更小的替代（例：升級前提示、升級後 Recovery 說明、Terminal Server 放在安裝目錄外）是否值得做、大致規模。

## 不做

- 不修程式、不改 main 上的任何檔案（本工單除外）；不開 BUG / PLAN（塔台依結論處理）；不碰本機 BAT 安裝；不發版。

## 驗收

- [ ] 靜態分析：NSIS 偵測 / 結束 app 的機制（附檔案與行號）、`build.nsis` 設定、互動 vs 靜默、自動更新路徑有無
- [ ] CI 實測：workflow run id、兩個情境（主視窗開著 / 只剩 Terminal Server）的四項程序存活結果、安裝 exit code、Recovery 提示有無
- [ ] 遠端 `ct/T0820` 已刪（附指令輸出）
- [ ] Q4 結論與對子項 D 的建議（含替代方案與規模）

---

## 回報區

### 完成狀態

- **狀態**：DONE（研究型；四項驗收都有證據）
- **完成時間**：2026-11-04T01:33:04+0800
- **session_id**：b2aea0ae-1832-475e-ae11-3fc868e654c4

### 落點檢查

- 結果：**PASS**。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = main checkout）；C-1 PASS；C-3 不適用（`affects_files` 只有本工單）；C-2 工單無 `branch` 欄位。
- 未設 `CT_HOME`（不是 worktree 派工）；`BAT_WORKSPACE_ID` 有設（只記錄存在）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 結論摘要（Q4）

**會被結束，而且在所有情境都一樣。** 新版 NSIS 安裝檔（`/S` 實測；互動安裝按「確定」後同一段程式）會結束安裝目錄底下的每一個程序 —— BAT 主行程、Terminal Server（同一個 `BetterAgentTerminal.exe`）、內嵌 claude / codex。分頁裡的 shell 不在安裝目錄，但它們的 ConPTY 由 Terminal Server 持有，**server 一死，shell 與其中的指令在 5 秒內跟著結束**（對照組實測）。升級後重開 BAT **不會**出現 Recovery 提示：啟動時把舊 server 當孤兒清掉，分頁依存檔還原、各開一個新 shell（舊輸出與執行中的指令都沒了）。

### 1. 靜態分析（electron-builder / app-builder-lib 26.8.1）

| 項目 | 位置 | 內容 |
|---|---|---|
| 怎麼比對執行中的 app | `node_modules/app-builder-lib/templates/nsis/include/allowOnlyOneInstallerInstance.nsh:66-79`（`FIND_PROCESS`） | PowerShell 可用（`Get-CimInstance` 存在且 Process 執行原則不是 `Restricted`，`:47-64`）時：**`Win32_Process.Path` 以 `$INSTDIR` 開頭**（不分大小寫）的任何程序。不可用時退回映像名稱 `BetterAgentTerminal.exe`（per-user 再加 `USERNAME` 篩選）。兩種方式都會比到 Terminal Server（同一個 exe） |
| 怎麼結束 | 同檔 `:81-103`（`KILL_PROCESS`）、`:105-164`（`_CHECK_APP_RUNNING`） | 先 `Stop-Process`（不帶 `-Force`），300 ms 後再找；還在 → 等 1 s 後 `Stop-Process -Force`，再等 2 s 重試；第二輪後還在 → `appCannotBeClosed`「無法關閉，請手動關閉後按重試」。Windows 上 `Stop-Process` 就是 TerminateProcess，**沒有任何正常結束路徑**（BAT 的 `before-quit`、Terminal Server 的 shutdown 都不會跑，pid / port / registry 檔留著） |
| 互動 vs `/S` | 同檔 `:120` | `MessageBox MB_OKCANCEL "$(appRunning)" /SD IDOK`：互動時跳「BetterAgentTerminal 正在執行。點擊 OK 關閉。如果無法關閉，試著手動關閉。」（`messages.yml:82` zh_TW），OK → 結束程序、Cancel → 安裝程式結束；`/S` 時預設 IDOK，**不詢問直接結束** |
| 何時檢查 | `installSection.nsh:33-37` | `oneClick: false`（BAT 的設定）→ 按下「安裝」進入安裝頁時才檢查（不是一開啟就檢查），且只在非 UAC inner instance |
| 覆蓋安裝的舊版解除安裝 | `installSection.nsh:52-58`、`include/installUtil.nsh:142-243` | 讀登錄檔 `UninstallString`，把舊 uninstaller 複製到 `$PLUGINSDIR` 執行：`/S /KEEP_APP_DATA /currentuser|/allusers --updated _?=<安裝目錄>`（`:224`），失敗重試 5 次後 `appCannotBeClosed`（`:218-219`）。舊 uninstaller 在靜默模式也會跑 `un.checkAppRunning`（`uninstaller.nsh:1-3, 17-19`），帶 `--updated` 時不跳對話框直接結束（`allowOnlyOneInstallerInstance.nsh:108-119`）；檔案仍被占用 → `atomicRMDir` 失敗、還原舊檔並中止（`uninstaller.nsh:164-181`） |
| 提權（per-machine） | `multiUserUi.nsh:32-36, 49-52`；`installSection.nsh:35-37` | 選「所有使用者」且未提權 → `UAC_RunElevated` 起 inner instance，inner 不跑 `CHECK_APP_RUNNING`、**也不跳「正在執行」對話框**；結束程序改由舊 uninstaller（靜默＋`--updated`）做。推論：本機這類 `C:\Program Files` 安裝的互動升級，使用者可能**看不到任何提示就被關掉** |
| `isUpdated` | `common.nsh:125-126`、`installUtil.nsh:205-206` | 指命令列帶 `--updated`（electron-updater 啟動安裝檔時帶）。巨集定義不在 app-builder-lib 的 templates / out，也不在本機 nsis-resources 快取；語意依呼叫點判斷 |
| BAT 的 `build.nsis` | `package.json` `build.nsis` | `oneClick: false`、`perMachine: false`（有「只給我 / 所有使用者」頁）、`allowToChangeInstallationDirectory: true`、`differentialPackage: false`；沒有 `include` / `script`，**沒有** `customCheckAppRunning` 等自訂巨集 → 全部走預設模板 |
| Terminal Server 的映像 | `electron/main.ts:342-360`（`forkTerminalServer`） | `child_process.fork(serverScript, …, { detached: true })`，未指定 `execPath` → 用 `process.execPath` = 安裝目錄的 `BetterAgentTerminal.exe`；腳本在 `resources/app.asar.unpacked`（`package.json` `asarUnpack`）。分頁 shell 用系統 ConPTY（`@lydell/node-pty-win32-x64` 只有 `conpty.node`，沒有內附 `OpenConsole.exe` / `conpty.dll`），conhost 是 `System32\conhost.exe`，不在安裝目錄 |
| 內嵌 claude / codex | `package.json` `asarUnpack` | `@anthropic-ai/claude-code*`、`@openai/codex-*` 解開在安裝目錄 → 用內嵌 runtime 的 claude / codex 分頁與 Claude 面板的 CLI 程序**本身**就會被比到並結束（推論，未實測：L185 不開 agent 分頁） |
| 自動更新 | `electron/update-checker.ts`、`src/components/UpdateNotification.tsx:61`、`package-lock.json` | **沒有** electron-updater（lock 檔 0 筆）。只查 GitHub `releases/latest` 比版號，通知列按鈕開 releases 頁面；使用者自己下載、雙擊安裝 → 一律走互動安裝路徑 |

### 2. CI 實測（GitHub Actions `windows-latest`）

- **run**：`41683870546`（workflow `T0820 NSIS upgrade probe (temporary)`，push `ct/T0820` 觸發，head `e46ab405`），2026-11-03T17:24:01Z → 17:29:50Z，conclusion `success`。artifact `t0820-probe-attempt1`（7 天）。
- **做法**：分支上暫時的 spec `e2e/t0820-nsis-upgrade-running.spec.ts` ＋ workflow；`gh release download` 下載兩個安裝檔並比對 release 的 SHA-256 digest；安裝參數 `/S /currentuser /D=<runner temp>\bat-t0820\BetterAgentTerminal`（**範圍：per-user**）；BAT 以 Playwright `_electron.launch` 啟動安裝版 exe ＋ `--runtime=<id>`（`BAT_E2E_EXECUTABLE`，`e2e/fixtures/electron-isolation.ts`）；分頁只開 shell（pwsh），執行 `ping -t 127.0.0.1`；程序存活以 `Get-CimInstance Win32_Process` 比對 pid ＋映像名稱。沒有用任何 secret，沒有 tag / Release / Pages。
- runner：PowerShell 5.1 有 `Get-CimInstance` → 安裝程式走「路徑比對」分支。

| 情境 | 安裝 exit / 耗時 | 主行程 | Terminal Server | conhost | pwsh | ping | 安裝後 FileVersion | 重開：Recovery 提示 | 重開後 |
|---|---|---|---|---|---|---|---|---|---|
| ① 主視窗開著，升級 pre.4 → pre.5 | `0` / 20.4 s | ❌ 被結束 | ❌ | ❌ | ❌ | ❌ | `0.7.4-pre.5` | **沒有** | 1 個分頁還原、新 server / 新 shell |
| ② 關主視窗、保留 Terminal Server（關閉確認選「結束」不勾「同時停止 Terminal Server」），升級 | `0` / 17.3 s | （已關） | ❌（關窗後仍活、升級後死） | ❌ | ❌ | ❌ | `0.7.4-pre.5` | **沒有** | 同上 |
| ③ 對照：同 ②，但不跑安裝檔，自己 `Stop-Process -Id <server>`（安裝程式第一步的同一指令） | — | （已關） | ❌ | ❌ | ❌ | ❌ | — | **沒有** | 同上 |

- 安裝前裝 pre.4 皆 exit `0`（34.0 s / 15.0 s，②是從 pre.5 降回 pre.4）。
- ①安裝前安裝目錄有 6 個程序（主行程、4 個 Chromium 子程序、Terminal Server，server 的 ppid = 主行程）；安裝後 0 個，沒有自動啟動。
- ①②③安裝 / 結束後 `bat-pty-server.pid`、`.port`、`bat-pty-registry.json` 三檔都還在（server 沒跑 shutdown）。
- 重開的 debug log（三個情境同型）：`[terminal-server] orphan PID <舊> detected — cleaning up stale files` → `Cleaned 1 orphan PTY process(es) from registry` → `started with pid <新>`（`electron/main.ts:376-395`，`isServerRunning` 為 false 走孤兒清理，不進 `pendingRecovery`）。
- ③說明 ①② 的 shell / ping 不是安裝程式直接殺的（它們不在安裝目錄），而是 **ConPTY 持有者（Terminal Server）被 TerminateProcess 後，conhost 與附在上面的 console 程序一起結束**。
- 互動安裝（研究問題 3）：**推論**，未實測（需要點對話框）。per-user 或已提權：按「安裝」後跳「BetterAgentTerminal 正在執行。點擊 OK 關閉…」，OK → 與 `/S` 相同的結束流程；Cancel → 安裝程式結束、不安裝。per-machine 且需 UAC 提權：inner instance 不跳這個對話框，由舊 uninstaller 靜默結束程序。

### 3. 遠端分支已刪

```text
$ git push origin --delete ct/T0820
To https://github.com/gowerlin/better-agent-terminal.git
 - [deleted]           ct/T0820
$ git ls-remote --heads origin ct/T0820 | wc -l
0
$ gh api repos/gowerlin/better-agent-terminal/branches/ct%2FT0820
{"message":"Branch not found",…,"status":"404"}
```

- 本機分支 `ct/T0820`（`e46ab405`，在 `main` `b0a853ec` 之上 1 個 commit：spec ＋ workflow）**保留**給塔台判斷；暫用的 scratchpad worktree 已移除（先拆 node_modules junction，main 的 `node_modules` 確認完整）。

### 4. 對使用者的影響與對 PLAN-059 子項 D 的建議

**升級會中斷的東西**（已實測 ＝ ✅，推論 ＝ 🔸）：
- ✅ 所有終端分頁的 shell 與其中執行中的指令（建置、ssh、`ping` 類長命令），scrollback 也沒了（新 shell）。
- ✅ 即使先關主視窗、保留 Terminal Server，升級也一樣全部結束；重開不會有 Recovery 提示，使用者以為「保留」了其實沒有。
- 🔸 claude / codex 分頁（agent TUI 是 console 程序，server 一死就跟著結束；內嵌 runtime 的本身也在安裝目錄）→ 回合中斷。T0766 / T0767 的「被中斷的 agent 分頁」只在 Terminal Server recovery 時觸發，升級後的孤兒清理路徑**不會**列出它們（推論，依 `main.ts:376-395` 沒有呼叫 `onAgentsInterrupted`）。
- 🔸 主行程被 TerminateProcess：沒有 flush-save（T0504），最後一次存檔後的版面變更會遺失；Claude 面板回合中斷。
- 🔸 per-machine 互動升級可能沒有任何「正在執行」提示。
- 🔸 孤兒清理以 registry 裡的舊 pid `killOrphanPtyProcesses`：升級到重開之間若 pid 被別的程序重用，會誤殺（既有風險，升級讓它變成常態路徑；未實測）。

**對子項 D（holder 模型）的意涵**：
- 光是「core 可單獨重啟」不夠。要撐過升級，持有 ConPTY 的程序必須 (a) 映像**不在安裝目錄**（否則被 `$INSTDIR` 路徑比對殺掉），(b) 檔案不被安裝程式覆寫 / 刪除（atomicRMDir 會整個搬走安裝目錄），(c) 新版 BAT 能接回舊版 holder（跨版本協定相容）。每個終端一個 holder 不是必要條件，必要的是「ConPTY 的擁有者在升級時不死」。
- 這等於在安裝目錄外放一份長駐 runtime（例：`%LOCALAPPDATA%` 下的版本化 holder 或獨立 node），涉及安裝 / 清理 / 版本協商 / 防毒誤判，規模 **L**（推論：數張工單＋三平台驗收；macOS / Linux 的升級方式不同，未在本單研究）。
- 也可改用 `customCheckAppRunning` 讓安裝程式跳過 Terminal Server，但 server 的 exe 在安裝目錄，覆寫時檔案被占用 → 舊 uninstaller `atomicRMDir` 失敗、升級中止；所以不可行，除非 server 映像先移出安裝目錄（就回到上一點）。

**建議（給塔台裁示）**：先不做 holder，改做小的替代，依價值排序：
1. **升級前提示**（S）：更新通知列 / 下載前提醒「安裝新版會結束所有終端分頁與 agent，請先完成工作」；`build.nsis.include` 加 `customCheckAppRunning` 只改提示文字（例：列出會結束的分頁數由 BAT 無法提供，只能寫通用說明）。
2. **升級後說明**（S）：啟動時偵測「上次版本 ≠ 本次版本且走了孤兒清理」→ toast「上次升級結束了 N 個終端」，並對 claude / codex 分頁沿用 T0766 / T0767 的 resume 對話框（session id 已存在 `claude-sessions.json`，但 `interrupted` 不跨重開，需調整）（M）。
3. **正常結束代替 TerminateProcess**（M，推論）：`customCheckAppRunning` 先以命名管道 / 本機 port 請 BAT 走正常 quit（flush-save、server `shutdown`、清 pid 檔），逾時才回到預設強制結束 —— 不保住 shell，但保住版面與避免 pid 重用誤殺。
4. holder 模型（L）：只有在使用者確實需要「升級不中斷長任務」時再開子 PLAN。

### 驗收對照

- [x] 靜態分析：NSIS 偵測 / 結束 app 的機制（附檔案與行號）、`build.nsis` 設定、互動 vs 靜默、自動更新路徑有無 —— 第 1 節
- [x] CI 實測：run `41683870546`、兩個情境（＋對照組）的四項程序存活、安裝 exit code、Recovery 提示有無 —— 第 2 節
- [x] 遠端 `ct/T0820` 已刪（附指令輸出）—— 第 3 節
- [x] Q4 結論與對子項 D 的建議（含替代方案與規模）—— 結論摘要、第 4 節

### 變更檔案

- main：只有本工單（`git commit --only`）。
- 本機分支 `ct/T0820`（未合併、遠端已刪）：`e2e/t0820-nsis-upgrade-running.spec.ts`、`.github/workflows/t0820-nsis-upgrade-probe.yml`。spec 在本機只跑過 `tsc --noEmit`（exit 0）與 `playwright test --list`（3 tests），**沒有**在本機執行。

### 遭遇問題

- 無阻斷。`isUpdated` 巨集的定義找不到原始碼（只在呼叫點看到語意），已在表中註明。
- 互動安裝與 agent 分頁未實測（工單允許推論；L185 不開 agent 分頁）。

### 互動紀錄

- 無（yolo，沒有提問塔台；未讀到塔台補充段落）。

### 後續建議（塔台判斷）

- 是否開子 PLAN：建議先開「升級前提示＋升級後說明」小單（上面 1、2），holder 模型維持 IDEA。
- 可順手補進 `e2e/manual/nsis-reinstall-acceptance.ps1` 的說明：前置條件「BAT 已關閉」的理由（升級會強制結束 BAT 與所有分頁），本單有實測依據。
- 本機 `ct/T0820` 分支：不需要可刪（`git branch -D ct/T0820`）；要保留成可重跑的手動驗收，需改成 `workflow_dispatch` 放上 main（另開工單）。
