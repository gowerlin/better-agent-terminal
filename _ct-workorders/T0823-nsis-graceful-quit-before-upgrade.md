---
schema_version: 1
schema_kind: workorder
id: T0823
title: "PLAN-063 子項 3：Windows NSIS 安裝新版時先請執行中的 BAT 正常結束（存檔、停 Terminal Server），逾時才照舊強制結束"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
isolation: worktree
created_at: "2026-11-04T02:02:42+0800"
started_at: "2026-11-04T02:04:46+0800"
updated_at: "2026-11-04T02:58:49+0800"
completed_at: "2026-11-04T02:58:49+0800"
session_ids:
  - "2686bbd1-dce9-4928-b7be-3cf97b206e68"
depends_on: []
related:
  - "PLAN-063；D267；T0820（NSIS `allowOnlyOneInstallerInstance.nsh` 的 `FIND_PROCESS` / `KILL_PROCESS` / `_CHECK_APP_RUNNING`，`customCheckAppRunning` 覆寫點；實測 run `41683870546`；本機分支 `ct/T0820` 的探測 spec＋暫時 workflow）；T0821（`710e4179`：升級後說明以『版本變＋孤兒清理 N ≥ 1』觸發）；T0504（關窗前 flush）；T0540（`stopTerminalServerGracefully` / `server:shutdown`，Windows 不得用 SIGTERM）；T0783（`desktop-build.yml`）"
affects_files:
  - _ct-workorders/T0823-nsis-graceful-quit-before-upgrade.md
  - package.json
  - build/installer.nsh
  - electron/main.ts
  - electron/upgrade-interruption.ts
  - electron/installer-quit-request.ts
  - electron/__tests__/
  - e2e/t0823-installer-graceful-quit.spec.ts
  - CLAUDE.md
  - docs/agent-guide/upgrade-interruption.md
  - docs/agent-guide/packaging-release-checks.md
renew_count: 0
workdir: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 失敗時的行為必須與現在相同：BAT 沒有在執行、BAT 是舊版不認得請求、請求逾時、或任何步驟出錯 → 一律回到 electron-builder 預設的偵測與強制結束（T0820 記錄的 `Stop-Process` 流程與對話框）；安裝絕不能因為本單而卡住或失敗。互動安裝的『正在執行，按 OK 關閉』對話框與 `/S` 靜默行為的使用者可見差異要在回報列出。"
  - "🔴 正常結束必須同時停止 Terminal Server（server 的 exe 在安裝目錄，留著會被強制結束、shell 一樣中斷）：走既有的完整結束路徑（flush-save T0504、`stopTerminalServerGracefully` / `server:shutdown`、T0540 先程序樹再 shell），不跳關閉確認對話框、不保留 server。🔴 Windows 不得用 SIGTERM 結束 server（T0540）。"
  - "🔴 與 T0821 的升級後說明一致：正常結束後沒有孤兒，T0821 的『孤兒清理 N ≥ 1』不會觸發——必須讓這條路徑也能在新版第一次啟動時顯示同一則說明（例：正常結束前把『被安裝程式結束的終端數與 agent 分頁』寫進 userData 的小檔，新版啟動時與孤兒清理的結果合併判斷），並把 agent 分頁列進既有清單（`cause: 'upgrade'`）。偵測規則改動須同步改 T0821 的測試與 docs，既有觸發條件（版本變＋孤兒）保留。"
  - "🔴 請求通道的安全：只接受同一使用者、本機的請求；不得新增可被其他程式利用來任意結束 BAT 的網路埠；優先沿用既有的 single-instance（`app.requestSingleInstanceLock` / `second-instance`，`electron/main.ts`）以特定參數傳遞，參數之外不接受任何資料；記一行 `[installer-quit] …` 日誌（不記權杖）。若必須另開通道，先問塔台。"
  - "🔴 CI 驗證授權：可 push `ct/T0823`（worktree 分支）並以 `gh workflow run desktop-build.yml -R gowerlin/better-agent-terminal -f ref=ct/T0823` 打安裝檔；可在**另一個**分支 `ct/T0823-probe`（自 `ct/T0823` 開出）放暫時的 push 觸發 workflow 與探測 spec（可參考本機分支 `ct/T0820` 的 `e2e/t0820-nsis-upgrade-running.spec.ts` 與 workflow），驗完刪兩個遠端分支；`ct/T0823-probe` 的檔案不得出現在 `ct/T0823`。不帶 secret、不建 tag / Release / Pages。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 不碰本機 BAT 安裝版與它的 Terminal Server；本機不執行任何 BAT 安裝檔。L185：只開 shell 分頁。yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不合併 main。Git：只 commit 本單範圍。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0823 — NSIS 安裝新版前先請 BAT 正常結束（PLAN-063 子項 3）

## 元資料

- **工單編號**：T0823
- **類型**：implementation（worktree 隔離）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-04T02:02:42+0800
- **預估規模**：M

## 背景

T0820 實測：Windows 的 NSIS 安裝程式以 `Win32_Process.Path` 開頭為安裝目錄比對執行中的程序，`Stop-Process`（TerminateProcess）強制結束，BAT 主行程與 Terminal Server 都沒有正常結束路徑——沒有 flush-save（T0504）、server 沒跑 shutdown（pid / port / registry 檔留著，下次啟動走孤兒清理，pid 若被重用有誤殺風險）。electron-builder 提供 `customCheckAppRunning` 巨集（`node_modules/app-builder-lib/templates/nsis/include/allowOnlyOneInstallerInstance.nsh:5, 39-40`）可覆寫這一步；BAT 的 `build.nsis` 目前沒有 `include` / `script`。T0821 已做升級前提示與升級後說明（觸發：版本變＋孤兒清理 N ≥ 1）。

使用者決定把本項與 T0822 湊成一批後發 `0.7.4-pre.6`（D267）。

## 範圍

1. **研究並確認**（寫進回報）：`customCheckAppRunning` 在安裝程式與舊版解除安裝程式（覆蓋安裝時以 `--updated` 執行）各自何時被呼叫；per-user / per-machine（含 UAC inner instance）各走哪條；覆寫後如何回退到預設的 `_CHECK_APP_RUNNING` 邏輯（不得複製一份會隨 electron-builder 升版而過時的拷貝——若只能複製，寫明對應的 electron-builder 版本並加測試或檢查提醒）。
2. **安裝程式端**（`build/installer.nsh` 或等效，`build.nsis.include`）：偵測到 BAT 在執行 → 以安裝目錄裡的 `BetterAgentTerminal.exe` 帶一個專用參數（例 `--installer-quit-request`）啟動，讓執行中的實例經 single-instance 收到請求 → 等待安裝目錄下的程序全部結束（上限例 15 s，常數寫明）→ 仍有程序 → 回到預設的強制結束流程。
3. **BAT 端**（`electron/installer-quit-request.ts` 等）：收到請求 → 記錄「將被結束的終端數與 agent 分頁」到 userData 小檔（供新版啟動時顯示 T0821 的說明，見 memory_overrides 第 3 點）→ 走完整結束路徑（flush-save、停 Terminal Server、不跳關閉確認、不保留 server）→ 結束。第二個實例（帶參數者）不開視窗、不做其他事，立即退出。detached 視窗、remote profile 視窗也要一起正常關閉（沿用既有 quit 流程）。
4. **新版啟動**：T0821 的偵測合併「安裝程式要求結束」的紀錄——版本變＋（孤兒清理 N ≥ 1 **或** 有安裝程式結束紀錄）→ 顯示同一則說明、列 agent 分頁；紀錄只用一次。
5. **文件**：CLAUDE.md「升級結束終端的提示與說明」節更新（正常結束路徑、唯一實作、不變式）；`docs/agent-guide/upgrade-interruption.md`（另移除〈已知限制〉中「縮圖 ⏸ tooltip 仍寫因 Terminal Server 重啟而中斷」那一句——並行的 T0822 處理 tooltip、不改 docs）、`docs/agent-guide/packaging-release-checks.md`（NSIS include、升級 electron-builder 時要檢查的點）。

## 驗證

- 單元：參數辨識、請求處理（記錄內容、走完整結束、不跳確認）、新版偵測的合併規則（孤兒 / 紀錄 / 兩者皆無 / 版本相同）、紀錄只用一次；突變檢查。
- e2e（隔離 runtime、開發版 build，本機）：以第二個實例帶參數送出請求 → 主實例在上限內結束、Terminal Server 正常 shutdown（pid / port / registry 檔已清）、shell 結束；重開（改寫上次版本模擬升級）→ 顯示說明、N 正確；對照：不改版本 → 不顯示。
- **CI 實測（Windows runner）**：以 `desktop-build.yml -f ref=ct/T0823` 打出的安裝檔，在 `ct/T0823-probe` 的暫時 workflow 中：安裝 → 啟動 BAT＋shell 分頁（長命令）→ 以同一份安裝檔 `/S` 覆蓋安裝 → 記錄：主行程與 server 是正常結束（日誌有 `[installer-quit]`、server shutdown、pid 檔已清）而非 TerminateProcess、安裝 exit 0 與耗時、重開後顯示說明。對照：安裝 `v0.7.4-pre.5`（舊版不認得請求）執行中時，以新安裝檔覆蓋 → 逾時後回到強制結束、安裝 exit 0。互動安裝的畫面差異以推論或截圖說明。
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`；T0821 的 `upgrade-interruption` 單元與 e2e、`t0766` / `t0578` e2e 不回歸。

## 驗收

- [ ] 範圍 1 的研究結論（呼叫時機、回退方式、版本相依）
- [ ] 安裝程式端與 BAT 端實作、常數與日誌
- [ ] 新版啟動的說明在正常結束路徑也會出現
- [ ] 單元＋突變、本機 e2e（含對照）
- [ ] CI 實測兩組（新→新正常結束、舊版執行中→回退強制結束）的 run id 與結果；遠端 `ct/T0823`、`ct/T0823-probe` 已刪
- [ ] typecheck 0 / 0、unit、legacy、vite build、不回歸
- [ ] CLAUDE.md / docs 更新
- [ ] 隔離分支證據（head SHA、validated SHA）

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-04T02:58:49+0800
- **session_id**：2686bbd1-dce9-4928-b7be-3cf97b206e68
- **隔離分支證據**：
  - `branch`：`ct/T0823`（遠端已刪，本機 worktree 分支保留供合併）
  - `base_sha`：`8d071c884a9fc679a02eecbafd93edb3e3c0bdee`
  - `validated_sha`：`edec0dfee5fbd7356c9e0b8edfba6e3f5e5c8dd7`
  - `head_sha`：`edec0dfee5fbd7356c9e0b8edfba6e3f5e5c8dd7`（= validated；CI 安裝檔的 BUILD-INFO commit 也是這個）
  - worktree `git status --porcelain`：空
- **產品 commit**（`ct/T0823`）：`3738d6ca` feat、`0530fd1f` docs、`79ff3ced` fix（標記檔）、`edec0dfe` fix（提權也送請求）

### 落點檢查

- PASS。C-0：frontmatter `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`。C-1：工單在 `$CT_HOME/_ct-workorders/` 下。C-3：`affects_files` 抽查皆有既存祖先目錄（`build/`、`electron/`、`e2e/`、`docs/agent-guide/`）。C-2：無 `branch` 欄位。
- `CT_HOME` 已設定；`CT_WORKTREE_BRANCH` = `ct/T0823`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`BAT_REMOTE_TOKEN` 已設定。`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`。
- 依賴：worktree 內 `npm ci`（CLAUDE.md 未另述，照 CI 做法）。

### 範圍 1：研究結論（electron-builder / app-builder-lib 26.8.1，實讀範本）

| 誰 | 何時 | 是否呼叫 `customCheckAppRunning` |
|---|---|---|
| 新版安裝程式（per-user，本專案預設 `oneClick: false`、`perMachine: false`） | install section 開頭、`uninstallOldVersion` 之前（`installSection.nsh:33-36`） | 是 |
| 新版安裝程式，「所有使用者」→ UAC 提權 | 提權後的 inner instance 跑 install section，`${ifNot} ${UAC_IsInnerInstance}` 擋掉 | **否**（範本本來就不檢查，之後舊版解除安裝程式以舊版範本強制結束） |
| 安裝程式本身已以系統管理員執行（含 UAC 關閉的電腦、GitHub runner） | install section（非 inner instance） | 是 |
| 舊版解除安裝程式（覆蓋安裝時新版以 `/S --updated` 執行） | `un.checkAppRunning`（`uninstaller.nsh:1-3`） | 用**舊版**編進去的版本；T0823+ 的版本有本單巨集，`--updated` → 不跳提示；此時 BAT 已被新版安裝程式請走 |
| 使用者解除安裝 | `un.checkAppRunning` | 是 |

- 覆寫點：`build/installer.nsh` 經 `build.nsis.include` 進入共用 header（`NsisTarget.computeCommonInstallerScriptHeader`），位置在 `allowOnlyOneInstallerInstance.nsh` 之前。範本 `!ifmacrondef customCheckAppRunning` 時才 `!include "getProcessInfo.nsh"` 與 `Var pid`，所以本檔自己補這兩行。
- 回退：**原樣** `!insertmacro _CHECK_APP_RUNNING`（範本巨集，不是複製）；`IS_POWERSHELL_AVAILABLE` / `FIND_PROCESS` 也沿用範本。
- 版本相依提醒：`installer-quit-request.test.ts` 最後一個測試鎖住 `app-builder-lib` = 26.8.1 與上述掛勾原文（含 `customInstall` 插入點、解除安裝 `RMDir /r $INSTDIR`），版本一變就失敗並指向 `packaging-release-checks.md`「NSIS：安裝前請 BAT 正常結束」的 5 點核對清單。

### 實作摘要

- **安裝程式端**（`build/installer.nsh`，`package.json` `build.nsis.include`）：
  - `customInstall`：檔案放好後寫標記 `$INSTDIR\resources\installer-quit-request.supported`（`BAT_INSTALLER_QUIT_MARKER`）。
  - `customCheckAppRunning` = `IS_POWERSHELL_AVAILABLE` → `batRequestGracefulQuit` → `_CHECK_APP_RUNNING`。
  - `batRequestGracefulQuit`：不是 app 本身、`$INSTDIR\BetterAgentTerminal.exe` 與標記檔都在、`FIND_PROCESS` 找到程序 → 非 `--updated` 時先顯示範本同一句 `$(appRunning)`（確定 / 取消，`/S` 自動確定）→ `Exec "<exe>" --installer-quit-request` → 每 `BAT_INSTALLER_QUIT_POLL_MS` = 500 ms 檢查，最多 `BAT_INSTALLER_QUIT_TIMEOUT_MS` = 15000 ms（`GetTickCount`）→ 範本的 `_CHECK_APP_RUNNING`（程序都結束 → 什麼都不做；否則照舊）。
- **BAT 端**（唯一實作 `electron/installer-quit-request.ts`，不 import electron）：
  - 參數 `--installer-quit-request`（完全相等才算），其他 argv / `additionalData` 不讀，不開埠。
  - 執行中的 BAT：載入時註冊的 `second-instance` listener → `InstallerQuitController`（啟動未完成時保留到 `markReady()`；只處理一次；已在 quit → 只記一行）→ 寫 `<userData>/installer-quit-record.json`（PTY id / cwd、這些 PTY 的 claude session；temp＋rename、0600）→ `installerQuitRequested = true; app.quit()` → `before-quit` 不顯示確認、`shouldStopServer = true`，其餘照原流程（flush 每個 renderer 含 detached、profile 快照、`stopTerminalServerGracefully`、`runCleanupOnce`）。
  - 沒有 BAT 主行程（請求行程拿到 lock）：`runInstallerQuitWithoutApp` → 保留的 Terminal Server 在跑就以 registry 寫紀錄（`source: server-only`）、TCP `server:shutdown`、等最多 8 s → `app.exit(0)`。
  - 🔴 請求行程不論有沒有 lock，whenReady 開頭 return（`installerQuitRequestProcess`）。
  - 日誌 `[installer-quit] …` 只記數量。
- **新版啟動**：`begin()` 後 `takeInstallerQuitRecord`（讀一次即刪，壞掉也刪）→ `noteInstallerQuit`。`detectUpgradeInterruption`：版本變 **且**（孤兒 ≥ 1 **或** 紀錄 ≥ 1）；N = 兩份依 id 的聯集；claude session 以紀錄為準；`detected` 行結尾加 `source=orphans|installer|installer+orphans`（T0821 單元測試的精確字串同步改；T0821 e2e 用子字串比對，不受影響）。

### 實作中發現並修正的三件事

1. **第二個實例的 `app.quit()` 不會擋掉 whenReady**（本機 e2e 實測）：帶參數的第二個實例在主實例結束、釋放 lock 與 Terminal Server 後跑起完整啟動，讀掉紀錄並 fork 了新 server（pid 檔殘留）。修正：請求行程一律在 whenReady 開頭 return。
   - 這也代表**一般的第二個實例**（不帶參數）同樣會跑部分 whenReady，是 T0823 前就有的行為，本單未改，列入後續。
2. **舊版 BAT 會把參數當成「開新視窗」**：舊版 `second-instance` 沒有 `--profile` 時 `createEntry`（立即存 windows.json）＋ `createWindow`，15 s 後仍被強制結束，重開會多一個空視窗。修正：只有 T0823+ 安裝程式寫的標記檔存在才送請求。降版時解除安裝程式 `RMDir /r $INSTDIR`，標記會一起消失。CI 實測舊版情境：`marker=false`、不送請求、重開只有 1 個視窗、windows.json 1 筆。
3. **提權守門讓 CI 一個請求都沒送**：原本加了 `${AndIfNot} ${UAC_IsAdmin}`（避免以系統管理員啟動 BAT）。探測 run `41694445245` 顯示 runner `elevated: True`，新→新情境 BAT 仍被強制結束。請求行程只轉交 argv / 停 server 就結束、不開視窗，所以拿掉守門。UAC 經 inner instance 的 per-machine 安裝照舊不呼叫。

### 驗證

| 證據線 | 結果 |
|---|---|
| `npm run typecheck` | 0（exit 0，`edec0dfe`） |
| `npm run typecheck:electron` | 0（exit 0） |
| `npx vite build` | exit 0 |
| `npm run test:unit` | 404 檔 passed / 2 skipped；7113 tests passed / 38 skipped |
| `npm run test:legacy` | 33 / 33 檔，472 passed / 0 failed |
| 新單元 `electron/__tests__/installer-quit-request.test.ts` | 26 passed（與 `upgrade-interruption.test.ts` 合計） |
| 突變（每次備份→改壞→跑→還原，未用 git restore） | 11 / 11 被抓到：拿掉紀錄條件、啟動中直接執行、請求時不停 server、忽略紀錄、紀錄不刪、忽略進行中的 quit、nsh 不送請求、whenReady 不擋請求行程（拿掉 / 改回 `installerQuitWithoutApp`）、nsh 不看標記、`customInstall` 不寫標記。拿回 `UAC_IsAdmin` 由 `not.toContain` 守住 |
| 本機 e2e `e2e/t0823-installer-graceful-quit.spec.ts`（隔離 runtime、開發版 build） | 3 / 3 passed。upgrade：請求後 BAT 約 0.5 s 結束、不跳對話框、`[quit] terminal server stopped (via IPC server:shutdown)`、pid / port / registry 檔已清、shell 結束、紀錄 2 個終端 → 改寫上次版本重開：toast「結束了 2 個終端」、`detected … ended-ptys=2 agent-tabs=0 source=installer`、紀錄已刪、無孤兒清理。control：不顯示、紀錄已刪。server-only：請求行程 0.47 s 結束、server 停、紀錄 `server-only` |
| 不回歸 e2e | `t0821-upgrade-interruption` 2 / 2、`t0766-interrupted-agents-recovery`、`t0578-recovery-no-direct-shell`；與 t0823 合計 8 / 8 passed |
| 本機 NSIS 編譯 | `npx electron-builder --win nsis --x64 --publish never`（`-WX`）安裝程式與解除安裝程式皆成功；`builder-debug.yml` header 含 `!include "…\build\installer.nsh"`。本機未執行任何安裝檔 |
| CI 打包 | `desktop-build.yml -f ref=ct/T0823`：run `41693086032`（`3738d6ca`，0.7.4-exp.823）、`41694382819`（`79ff3ced`，已取消）、**`41695712401`（`edec0dfe`，0.7.4-exp.8232，三平台 success）** |
| CI 實測（Windows runner，`ct/T0823-probe`，暫時 workflow＋探測 spec，預設 runtime） | 最終 run **`41697475355`** success（3 / 3），見下表；第一次 run `41694445245` 用的是提權守門版本，揭露問題 3 |

**最終 CI 實測（run `41697475355`，`/S /currentuser`，runner 為 elevated）**

| 情境 | 安裝 exit / 耗時 | 結束方式 | 檔案 / 紀錄 | 重開 |
|---|---|---|---|---|
| 新→新（exp.8232 執行中＋`ping -t` 分頁，再裝 exp.8232） | 0 / 21.5 s | 正常結束：`request received: recorded 1 terminal(s)` → `quit without confirmation` → flush → profile → `terminal server stopped (via IPC server:shutdown)`，約 0.2 s。main / server / shell / ping 都結束 | pid / port / registry 檔已清；紀錄 `running-app`、1 個 PTY | 上次版本改成 pre.5 模擬：toast「v0.7.4-pre.5 → v0.7.4-exp.8232 … 結束了 1 個終端」；`detected … source=installer`；1 個視窗 |
| 舊版執行中（pre.5 執行中，裝 exp.8232） | 0 / 24.0 s | 沒有標記（`marker=false`）→ 不送請求 → 範本照舊強制結束（與 T0823 前相同） | pid / port / registry 檔留著；無紀錄 | 孤兒清理 `Cleaned 1 orphan`；pre.5 沒有 `last-run-version.json`（T0821 尚未發佈）→ `none: previous=unknown`、不顯示；1 個視窗、windows.json 1 筆（沒有多出視窗） |
| 只剩 server（exp.8232 離開時保留 server，再裝 exp.8232） | 0 / 20.4 s | 請求行程拿到 lock：`no running BAT; Terminal Server running with 1 terminal(s) (recorded)` → `Terminal Server stopped (server:shutdown)`，約 0.2 s | 檔案已清；紀錄 `server-only` | toast 出現、`detected … source=installer` |

- 對照的耗時差異：新→新 21.5 s 與舊版情境 24.0 s 相近，正常結束沒有拖慢安裝。
- 工單原本預期「舊版執行中 → 逾時後回到強制結束」；標記檔讓它**不送請求、直接**照舊強制結束（不等 15 s、不開視窗）。決策理由見上面第 2 點。
- 遠端分支 `ct/T0823`、`ct/T0823-probe` 已刪（`git ls-remote` 0 筆）；探測檔案只在 `ct/T0823-probe` 的 commit（`e572cfae`，以 `commit-tree` 建立），不在 `ct/T0823`。未帶 secret，未建 tag / Release / Pages。

### 使用者看得到的差異（互動安裝與 `/S`）

| 情況 | T0823 前 | T0823 後 |
|---|---|---|
| 互動安裝、BAT 由 T0823+ 安裝程式所裝且在跑 | 「正在執行，按確定關閉」→ 強制結束 | 同一句提示（同一個語言字串）→ BAT 自己存檔、停 Terminal Server 後結束（通常 1 秒內）；不會出現 BAT 自己的離開確認對話框 |
| `/S` 靜默 | 直接強制結束 | 直接請 BAT 正常結束（CI 實測） |
| BAT 由 T0823 前的安裝程式所裝（pre.5 → pre.6 這一次） | 強制結束 | 相同（CI 實測） |
| BAT 還在啟動、或使用者的離開對話框開著 | 強制結束 | 送出請求、等滿 15 s，然後範本照舊：互動安裝**再顯示一次**提示，再強制結束（推論，未截圖） |
| 「所有使用者」經 UAC 提權 | inner instance 不檢查 | 相同 |
| 以另一個帳號的憑證提權 | 強制結束 | 請求到不了使用者的 BAT（lock 依帳號），等 15 s 後回退（推論） |
| BAT 以 `--runtime=N` 執行 | 強制結束 | 相同，但先等 15 s（請求只到預設 runtime；推論） |
| 重開後的說明 | 版本變＋孤兒 → toast | 版本變＋（孤兒或紀錄）→ 同一則 toast，文字不變 |

### 變更檔案

- `build/installer.nsh`（新）、`package.json`（`build.nsis.include`）
- `electron/installer-quit-request.ts`（新）、`electron/main.ts`、`electron/upgrade-interruption.ts`
- `electron/__tests__/installer-quit-request.test.ts`（新）、`electron/__tests__/upgrade-interruption.test.ts`（`detected` 行加 `source=orphans`）
- `e2e/t0823-installer-graceful-quit.spec.ts`（新）
- `CLAUDE.md`（「升級結束終端的提示與說明」節：觸發條件＋子項 3 一點）、`docs/agent-guide/upgrade-interruption.md`（子項 3 全節：呼叫時機表、流程、安全、使用者差異；偵測表、日誌；移除 ⏸ tooltip 那句已知限制）、`docs/agent-guide/packaging-release-checks.md`（新節「NSIS：安裝前請 BAT 正常結束」與升級 electron-builder 的核對清單）

### 遭遇問題

- 見〈實作中發現並修正的三件事〉。
- Python heredoc 在本機以 cp950 讀取，含中文的取代失敗（未寫入任何檔案），改用 Edit 工具。
- 第二次 desktop-build（`41694382819`）因提權守門要拿掉而取消。

### 後續建議（給塔台）

1. **一般第二個實例也會跑 whenReady**（T0823 實測副產品）：不帶參數的第二個實例 `app.quit()` 後 whenReady 照樣執行（建 tray、`begin()`、`startTerminalServer()` 等），直到行程退出。主實例在跑時通常無害，但與主實例結束的時間點重疊時，可能像本單第 1 點那樣 fork 出新 server。建議另開工單評估，是否在 `!gotTheLock` 時一律讓 whenReady return。
2. 真實升級 pre.6 → pre.7（兩版都含本功能）發佈後，以本單探測 spec 的做法再驗一次，不必模擬上次版本。探測 spec 只存在已刪的 `ct/T0823-probe`；本機 commit `e572cfae` 仍在 object store，可 `git show e572cfae:e2e/t0823-nsis-probe.spec.ts` 取回。
3. 互動安裝的畫面差異只有推論（CI 只能跑 `/S`）；發版後的 NSIS 重裝驗收可順手看一次（BAT 開著時互動安裝）。

### 互動紀錄

- [02:04] 開工；yolo、沒有向塔台提問（所有設計選擇都在範圍內自行決定，記於上方）。
- [02:38] 依 CI run `41694445245` 拿掉提權守門（範圍內的實作修正）。
