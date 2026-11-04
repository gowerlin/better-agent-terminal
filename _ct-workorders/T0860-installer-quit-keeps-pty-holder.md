---
schema_version: 1
schema_kind: workorder
id: T0860
title: "PLAN-065 W4：安裝程式與解除安裝整合（升級時只結束主行程、保留 holder；先結束安裝目錄下的內嵌 claude 並記錄；idle 延長 24 h；--uninstall-quit-request；紀錄 schema 2）"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-065
priority: P2
sizing: M
created_at: "2026-11-04T18:28:20+0800"
started_at: "2026-11-05T07:03:33+0800"
updated_at: "2026-11-05T07:35:47+0800"
completed_at: "2026-11-05T07:35:47+0800"
session_ids:
  - "fcc0b9cc-eb2f-43a8-bae4-62e505ef0ea2"
depends_on: [T0857, T0859]
related:
  - "PLAN-065；D286（D3 內嵌 claude 先結束並記錄、D7 安裝程式觸發時 idle 延長到 24 h、D2 依範圍）；T0856 回報區〈調查結論〉Q4 與〈建議下一步〉W4；T0823（`InstallerQuitController`、`build/installer.nsh`）；T0821 / T0846（`detectUpgradeInterruption`）；T0766（被中斷的 agent 分頁）；T0825（第二個實例不跑 whenReady）"
affects_files:
  - _ct-workorders/T0860-installer-quit-keeps-pty-holder.md
  - electron/installer-quit-request.ts
  - electron/main.ts
  - build/installer.nsh
  - electron/upgrade-interruption.ts
  - electron/__tests__/
  - e2e/
  - docs/agent-guide/upgrade-interruption.md
  - CLAUDE.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 兩條路都要守住：Terminal Server 正在從有效的 holder 執行 → 新行為；沒有 holder（zip、開發模式、holder 缺少或不符、macOS / Linux）→ T0823 原行為逐字不變（完整 quit、`stopTerminalServerGracefully`、不跳確認、Windows 不用 SIGTERM）。既有 source guard（`installer-quit-request.test.ts`、`second-instance-startup.test.ts`、`upgrade-interruption.test.ts`）照舊通過，新增的分支另寫測試。"
  - "🔴 版本 N 的解除安裝程式會在 N+1 升級時執行、N+1 的安裝程式會對已安裝的 N 送 quit 請求（T0856 Q4「解除安裝」列）：這兩段行為在 N 發佈後就改不了。`${isUpdated}` 為真（升級時舊版的解除安裝）→ 不停 holder、不刪 holder 目錄；為假（真的解除安裝）→ 先請 holder 正常結束，逾時才以路徑前綴強制結束，再刪 holder 根目錄。範本的 `_CHECK_APP_RUNNING` 原樣插入、不複製（T0823 規則）。"
  - "🔴 內嵌 claude（D3）：結束前只結束分頁程序樹中執行檔在安裝目錄下的程序（以路徑判斷，不以名稱），記下 tab id 與 claude session（沿用 `claudeSessionPersistence`），升級後列進 `InterruptedAgentsStore`（`cause: 'upgrade'`，沿用 T0766 一鍵接回）；🔴 shell 與其他程序不得被結束；不自動 resume、不通知塔台。"
  - "🔴 日誌 `[installer-quit]` / `[upgrade-interruption]` 只記數量與結果，不記路徑內容以外的資訊、不記權杖。child_process 規則照 CLAUDE.md。yolo：不得問使用者；問題問塔台。不發版、不 push、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。不碰本機 BAT 安裝版，不執行任何安裝檔。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0860 — PLAN-065 W4：安裝程式與解除安裝整合

## 元資料
- **工單編號**：T0860｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 18:28 (UTC+8)
- **規模**：M｜**決策**：D286｜**依賴**：T0857（idle 延長請求、權杖）、T0859（判斷 server 是否從 holder 執行）

## 背景
T0823 讓安裝程式先請 BAT 正常結束，結束時連 Terminal Server 一起停。有 holder 之後，安裝程式觸發的 quit 應只結束主行程、保留 holder；但分頁裡執行檔在安裝目錄下的程序（內嵌 claude）仍會被安裝程式結束，BAT 要先自己結束並記錄，避免安裝程式等滿 15 s 又跳「正在執行」對話框。細節見 T0856 回報區 Q4。

## 任務
1. `InstallerQuitController`：server 從有效 holder 執行時 `shouldStopServer = false`；送 T0857 的延長 idle 請求（D7：24 h）；結束前處理內嵌 claude（D3）並寫紀錄。
2. `runInstallerQuitWithoutApp`：holder 版不停 holder。
3. 新參數 `--uninstall-quit-request`（與 `--installer-quit-request` 分開）：請 holder 正常結束；第二個實例的規則照 T0823 / T0825（whenReady 開頭 return）。
4. `build/installer.nsh`：`customCheckAppRunning` 在 `un.` 環境依 `${isUpdated}` 選參數；新增 `customUnInstall`（非 `--updated` → 停 holder、刪 holder 根目錄）。holder 根目錄規則以 T0858 為準（`BAT-PtyHolder`，per-user `$LOCALAPPDATA`、per-machine `$PROGRAMFILES64`；前綴衝突時不碰；見 `docs/agent-guide/packaging-release-checks.md`「Windows PTY holder 打包」）。只刪**本次安裝範圍**的根目錄；另一個範圍留下的根目錄不刪（回報區寫明已知限制）。T0823 的標記檔邏輯照舊（舊版沒有標記就不送請求）；新請求也要有對應的標記檔，讓舊版不會把新參數當成開新視窗。
5. `installer-quit-record.json` schema 2：`holderKept`、holder pid、`endedPtys`、`endedAgentProcesses`；`takeInstallerQuitRecord` 讀 schema 1 與 2。`detectUpgradeInterruption` 依 schema 2 調整觸發（接回成功時的 toast 文字由 W5 做；本單只確保資料正確、schema 1 行為不變）。
6. 測試：兩條路、`isUpdated` 分支（source guard）、內嵌 claude 判斷（只比路徑）、紀錄 schema 1 / 2、`--uninstall-quit-request`。T0823 的 e2e 擴成有 holder 與沒有 holder 兩種，做不到的列〈待 W6 驗收〉。
7. 文件：`docs/agent-guide/upgrade-interruption.md` 補 holder 版流程；`CLAUDE.md`「升級結束終端的提示與說明」節補必守規則（`isUpdated` 分支、兩條路）。

## 塔台補充（開工前，T0859 收單後 2026-11-04 19:15）

先讀 T0857、T0858、T0859 回報區。要點：

1. **判斷 server 是否從 holder 執行**：T0859 的 `resolvePtyHolder`（`electron/pty-holder.ts`）決定；`forkTerminalServer` 有效時以 `spawn(holderSpawnSpec(...))` 啟動（不是 `fork`：Electron 主行程的 `fork` 一定會加 `ELECTRON_RUN_AS_NODE=1`）。TCP 接回時 `hello-ok.runtime.name === 'node'`＋`holderDir` 代表 holder 版 server。主行程要記住「目前的 server 是不是 holder 版」，quit 時依此選路徑；不要只看檔案存在。
2. **延長 idle**：T0857 的 `server:extendIdle { durationMs: 86400000 }` 已可用，在 quit 前、主行程仍連著 server 時送（IPC 或 TCP 皆可）；回 `ALREADY_EXTENDED` 不算失敗。
3. **安裝程式比對**：holder 的路徑是 `<根目錄>\<key>\bat-pty-holder.exe`，映像名稱不是 `BetterAgentTerminal.exe`，範本的 `_CHECK_APP_RUNNING` 不會比到它。zip / `build:dir` 沒有 T0823 標記，T0859 不用 holder，走 T0823 原路徑。
4. **解除安裝清理**：刪 holder 根目錄前，先請 holder 正常結束，再以 T0858 的 `batPtyHolderInUse` 確認沒有程序在跑；仍有程序 → 保留並記下（不強制刪）。
5. holder 版 server 的 stderr 照舊是 `ignore`；需要診斷資訊時以主行程日誌為準。

### 驗收條件
- [ ] 上述測試通過；T0823 / T0825 / T0846 相關測試不回歸
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [ ] 回報區列出 N → N+1 升級、真的解除安裝、降級三種情況下各個 NSIS 掛點與 BAT 的實際動作順序
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **DONE**：Terminal Server 從有效的 PTY holder 執行時，升級的 quit 請求只結束 BAT 主行程：holder 的 idle 延長到 24 h、分頁程序樹中安裝目錄下的程序先由 BAT 結束並記錄、紀錄寫 schema 2、server 不停。沒有 holder 時走 T0823 原路徑，行為不變。新增 `--uninstall-quit-request` 與 `customUnInstall`。驗收條件 4 項都達成。安裝程式實際執行列在〈待 W6 驗收〉。
- **落點檢查**：PASS。
  - C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。
  - C-1：工單在 REPO_ROOT 下，PASS。
  - C-3：`affects_files` 都存在，或祖先目錄存在（新檔），資訊性 PASS。
  - C-2：工單沒有 `branch`。
  - `CT_HOME` 未設。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- **產品 commit**：`44982662`。共 9 個檔，都在 `affects_files` 內：
  - `electron/installer-quit-request.ts`、`electron/main.ts`、`electron/upgrade-interruption.ts`
  - `build/installer.nsh`
  - `electron/__tests__/installer-quit-holder.test.ts`（新）
  - `e2e/t0860-installer-quit-holder.spec.ts`（新）、`e2e/t0823-installer-graceful-quit.spec.ts`
  - `docs/agent-guide/upgrade-interruption.md`、`CLAUDE.md`
- **session_id**：fcc0b9cc-eb2f-43a8-bae4-62e505ef0ea2

### 互動紀錄

- [07:03] 開工。沒有向塔台提問。三個塔台補充檢查節點都只看到開工前那一段，沒有新段落。
- [07:21] e2e 場景 2 第一次跑時記錄了 193 個程序。原因是 spec 自己的 `tcpWrite` 沒清 buffer，每收到一次 `pty:data` 就重送一次指令，cmd 因此起了上百個替身程序。這些替身全都是該分頁樹裡、安裝目錄下的程序，產品程式判斷正確。修 spec 後只剩 1 個。也確認過沒有殘留程序：路徑在 `release\win-unpacked` 或測試暫存目錄下的程序 = 0。
- [07:24] 發現 T0823 e2e 的 control 情境本來就會失敗。T0846（D278）之後，同版本＋安裝程式紀錄 ≥ 1 會顯示同版文字，但這支 spec 仍期待「不顯示」。本單已把期待改成 T0846 的規則（見〈偏離〉2）。
- [07:30] 全套 unit 有 1 項失敗：T0859 的 source guard 要求 `const spec = …` 與 `return spawn(…)` 相鄰，我插在中間的旗標破壞了它。沒有改那個 guard，改成在 `if (holder.use)` 前寫 `terminalServerFromHolder = holder.use`。main.ts 因此在打包後又改了，所以重新 `build:dir` 並重跑 e2e。

### 實作摘要

| 檔案 | 內容 |
|---|---|
| `electron/installer-quit-request.ts` | 參數：`UNINSTALL_QUIT_REQUEST_ARG` / `isUninstallQuitRequest`。<br>紀錄 schema 2：`InstallerQuitHolderRecord`、`buildHolderKeptQuitRecord`；`read` / `take` 讀 schema 1 與 2。<br>holder 判斷：`isPathInsideDir`、`isKeptHolderHello`、`queryKeptHolder`（一條 TCP 連線：hello ＋權杖 → 確認是 holder → `server:extendIdle` 86,400,000 ms）。<br>D3：`listWindowsProcesses`（PowerShell CIM，`execFile` ＋陣列參數＋ 8 s timeout）、`parseProcessList`、`findInstallDirAgentProcesses`、`endInstallDirAgentProcesses`、`ptyRootsOf`、`summarizeEndedAgents`。<br>`InstallerQuitController`：`request(kind)`；`serverFromHolder` 為真時走 `runKeepingHolder`，否則走 `runStopping`（T0823 原本的 `run`，同步執行）。<br>`runInstallerQuitWithoutApp`：新增 `kind` / `keptHolder` / `endAgentProcesses` / `forceStopServer` / `writeHolderRecord` |
| `electron/main.ts` | `terminalServerFromHolder` 的來源：`forkTerminalServer` 的 holder 判斷，或 `noteTerminalServerHello`（probe、0 PTY 重連、Recovery「保留」三處的 hello）。<br>controller 接上新 deps，`quitKeepingServer` 設定 `installerQuitKeepsServer`；`before-quit` 只在這個旗標為真時 `shouldStopServer = false`。<br>請求行程：`installerQuitHolderDepsWithoutApp`、`forceStopTerminalServer`。<br>`--uninstall-quit-request` 也算請求行程（whenReady 開頭 return）；載入時註冊的 listener 收到它就 `request('uninstall')`，whenReady 的 handler 收到它就 return |
| `electron/upgrade-interruption.ts` | `noteInstallerQuit` 接受 schema 2：`endedPtys` ＋ agent 分頁。`detectUpgradeInterruption` 多 `installerQuitAgentTabCount`。agent 分頁列進來源（`cause: 'upgrade'`）。notice 多 `holderKept: true`；log 結尾加 ` holder-kept ended-agent-tabs=N` |
| `build/installer.nsh` | `batRequestGracefulQuit` 的參數存在 `$R8`（Push / Pop），只有 `!ifdef BUILD_UNINSTALLER` 且 `${IfNot} ${isUpdated}` 且有新標記時才換成解除安裝參數。<br>`customInstall` 在 T0823 標記之後、複製 holder 之前寫 `resources\uninstall-quit-request.supported`。<br>新增 `batUninstallPtyHolder` 與 `customUnInstall`（`${IfNot} ${isUpdated}`） |
| 測試 | 新 `installer-quit-holder.test.ts`：38 項，含真 TCP 的 `queryKeptHolder` 與 source guard。既有的 `installer-quit-request` / `second-instance-startup` / `upgrade-interruption` / `pty-holder` 測試都沒有改 |
| e2e | 新 `t0860-installer-quit-holder.spec.ts`（3 個場景）。`t0823` 的 control 情境改成 T0846 規則，標頭註明「這是沒有 holder 的路徑，原始碼版與打包版各跑一次」 |
| 文件 | `upgrade-interruption.md` 新增「holder 版：升級保留 holder、解除安裝停 holder（T0860）」一節：兩條路、D3、schema 2、NSIS、三種情況的順序、日誌、已知限制；驗證與已知限制兩節也一併更新。`CLAUDE.md` 同節加入必守規則 |

### 決定事項（本單範圍內自行決定）

1. **schema 2 只在保留 holder 時寫**：沒有 holder 時照舊寫 schema 1。理由：「沒有 holder → T0823 逐字不變」；而且降版到 T0860 前的版本時，舊版仍讀得懂 schema 1。
2. **holder 判斷用兩道**：
   - 第一道是 main 記住的狀態（塔台補充 1）。它為假時，controller 照 T0823 同步執行，連一個 microtask 的延遲都沒有。
   - 第二道是 quit 時重新做一次 TCP hello。hello 失敗、或不是 holder → 照 T0823 停 server，記一行說明。
   - 請求行程沒有記憶可用，只看 hello，不看檔案是否存在。
3. **idle 延長走新的 TCP 連線**：PtyManager 不在 `affects_files` 內，現有 IPC / TCP 通道又不轉送 `server:idle-extended`。新連線的 hello 會清掉舊的延長（T0857 規則），所以 hello 之後立刻在同一條連線送 extendIdle，之後不再對 server hello。
4. **強制結束改由 BAT 做，NSIS 不做**：memory_override 寫「逾時才以路徑前綴強制結束」，塔台補充 4 寫「不強制刪」，T0823 的 source guard 又要求 nsh 內不出現 `Stop-Process|taskkill|KILL_PROCESS`。三者都要成立，所以：
   - 逾時的強制結束由請求行程的 `forceStopTerminalServer` 處理：先結束 registry 的 PTY 程序樹（T0540 順序），再 `taskkill /F /T` pid 檔記的 server。這是以 pid 判斷，不是以路徑前綴。
   - NSIS 只負責等待，並確認根目錄沒有程序在用才刪；仍在用 → 保留並 `DetailPrint`。
5. **D3 防 pid 重用**：子程序的建立時間早於父程序時，不當成它的子程序。
6. **解除安裝也寫 schema 1 紀錄**：真的解除安裝走的就是 T0823 那條路，所以照舊寫紀錄。之後重新安裝時，依 T0846 會顯示同版文字。

### N → N+1 升級、真的解除安裝、降級：NSIS 掛點與 BAT 的動作順序

N = 第一個有 holder 的版本。docs 有同一份內容。

**N → N+1 升級（per-user，BAT 在跑）**

1. N+1 安裝程式的 install section 執行 `customCheckAppRunning`（安裝程式版）：
   - `FIND_PROCESS` 找到 `$INSTDIR` 下的程序 → 顯示提示（`/S` 時自動確定）。
   - `Exec <N 的 exe> --installer-quit-request`。
2. N 的 BAT（`second-instance` → controller），`serverFromHolder` 為真：
   1. TCP hello ＋ `extendIdle` 24 h；
   2. 結束分頁樹中 `$INSTDIR` 下的程序；
   3. 寫 schema 2；
   4. quit：flush-save、存 profile，`stopTerminalServer=false`。
3. 安裝程式的等待迴圈看到 `$INSTDIR` 下沒有程序 → 範本 `_CHECK_APP_RUNNING` 不做事。
4. `uninstallOldVersion` 以 `/S --updated` 執行 **N 的**解除安裝程式：
   - `un.checkAppRunning`：`${isUpdated}` 為真，用安裝程式參數；這時已找不到程序。
   - `customUnInstall`：`${isUpdated}` 為真 → 不做事。
   - 範本刪 `$INSTDIR`。
5. `customInstall`：寫兩個標記、複製 N+1 的 holder（N 的 holder 目錄有程序在用 → 保留）。
6. N+1 第一次啟動：
   - 讀 schema 2 紀錄。
   - probe 到 N 的 holder，仍有 PTY → 目前會跳 Recovery 提示（W5 改成直接接回）。
   - 被結束 agent 的分頁列進中斷清單。

BAT 沒在跑、只剩 holder 時：只有 `$INSTDIR` 下有程序（例如 holder 分頁裡的內嵌 claude）才會送請求。請求行程結束那些程序、寫 schema 2（`server-only`）、不停 holder（e2e 場景 2 實測過）。

**真的解除安裝（N，per-user）**

1. `un.checkAppRunning` 執行 `customCheckAppRunning`（解除安裝程式版，`${isUpdated}` 為假）：
   - 有 `$INSTDIR` 下的程序 → 提示 → `--uninstall-quit-request`。
   - BAT 收到 `request('uninstall')` → 走 T0823 那條：寫 schema 1、停 server（holder 也停）。
2. `customUnInstall` 執行 `batUninstallPtyHolder`：
   1. 依 `$installMode` 決定根目錄，檢查前綴衝突。
   2. 根目錄存在 → 再 `Exec --uninstall-quit-request`。這時沒有 BAT，由請求行程 `server:shutdown`；8 s 內沒結束 → `forceStopServer`。
   3. 每 500 ms 檢查根目錄與 `$INSTDIR`，最多 20 s。
   4. 根目錄沒有程序在用 → `RMDir /r`；否則保留並 `DetailPrint`。
3. 範本刪 `$INSTDIR`（兩個標記檔一起刪）。

**降級（N+1 → N，或 → 沒有 holder 的版本）**

1. 舊版安裝程式的 `customCheckAppRunning` 送 `--installer-quit-request`。N+1 的 BAT 有 holder → 保留 holder，與升級相同。
2. 舊版安裝程式接著以 `/S --updated` 執行**較新的** N+1 解除安裝程式 → `customUnInstall` 不做事，holder 留著。
3. 舊版第一次啟動：
   - 有 holder 支援且協定相容 → 接回（W5）。
   - T0857 前的舊版：hello 未認證被關閉 → T0704 recovery → 終端結束（T0856 Q4）。
   - T0860 前的版本讀到 schema 2 → `invalid`，丟掉。

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | ✅ 0 |
| `npm run typecheck:electron` | ✅ 0 |
| `npm run test:unit` | ✅ 448 檔通過、3 skipped；8224 passed / 0 failed / 40 skipped |
| `npm run test:legacy` | ✅ 33 檔；472 passed / 0 failed |
| `npx vite build` | ✅ exit 0 |
| 新測試 `installer-quit-holder.test.ts` | ✅ 38 / 38，涵蓋：<br>• 兩條路（沒有 holder 時同步、紀錄 schema 1、與 T0823 的 log 逐字相同）<br>• uninstall 一律停 server<br>• 啟動中收到 uninstall 時優先處理<br>• D3：只比路徑、不含 shell、不含樹外、不含 `<安裝目錄>-old`、pid 重用<br>• schema 1 / 2 的讀寫<br>• 真 TCP：hello 帶權杖 → extendIdle 24 h；`ALREADY_EXTENDED`；不是 holder 時不送 extendIdle<br>• 下次啟動的 schema 2 偵測<br>• source guard：`${isUpdated}` 分支、`customUnInstall`、標記順序、範本掛點 |
| 既有 guard（T0823 / T0825 / T0846 / T0859） | ✅ `installer-quit-request`、`second-instance-startup`、`upgrade-interruption`、`pty-holder` 都沒有改，全部通過 |
| NSIS 實際編譯（`electron-builder --win nsis --prepackaged release/win-unpacked`，輸出到 scratchpad，**只編譯、不執行**） | ✅ exit 0（`-WX`，安裝程式與解除安裝程式都編過）；產出的安裝檔已刪除 |
| e2e `t0860-installer-quit-holder`（打包版 ＋ 暫存 `LOCALAPPDATA` 的 holder） | ✅ 1 passed，3 個場景：<br>① 升級請求 → request 0.34 s 結束，BAT 0.65 s 內結束。holder 與 cmd shell 仍在；替身（安裝目錄的 exe 以 node 模式執行）已結束；安裝目錄下的程序數 = 0；紀錄 schema 2（`running-app`、holderPid = server pid、`[{tab,1}]`）；log 有 `idle extended`、`stopTerminalServer=false, PTY holder kept`。<br>② 沒有 BAT 時的升級請求 → exit 0，0.65 s；替身結束，holder 與 shell 仍在，紀錄為 `server-only`。<br>③ `--uninstall-quit-request` → exit 0，0.86 s；holder 與 shell 都結束，pid / port / token 檔已刪 |
| e2e `t0823`（沒有 holder 的路徑） | ✅ 原始碼版 3/3、打包版 3/3（`build:dir` 沒有標記，不用 holder） |
| e2e `t0859`（不回歸） | ✅ 1/1 |
| 最後一次（main.ts 修正後重新 `build:dir`） | ✅ t0859 ＋ t0860 ＋ t0823 打包版共 5 passed；殘留程序 0 |

**證據分道**：原始碼 / 文件 ✅；build / tests ✅；runtime（打包版 ＋ 真 holder ＋ 真 ConPTY ＋ 真第二實例請求）✅；安裝程式實際執行 **〈待 W6 驗收〉**。

### 待 W6 驗收

- N → N+1 真實升級：
  - N 的 BAT 收到請求後保留 holder，安裝程式不跳第二次「正在執行」；
  - N 的解除安裝程式以 `--updated` 執行時不碰 holder；
  - `customInstall` 保留執行中的 N holder 目錄；
  - 升級後 holder 的 pid 不變、分頁輸出持續（接回本身要等 W5）。
- 真的解除安裝（per-user / per-machine）：holder 結束、本次範圍的根目錄被刪；根目錄有程序在跑時保留，並有 `DetailPrint`。
- 降級（N+1 → N、N → 沒有 holder 的版本）。
- 內嵌 claude 的實機情境（e2e 用的是替身）：claude 被結束後，分頁 shell 是否回到提示列，以及清單恢復是否正常。

### 偏離

1. **強制結束的位置**（見〈決定事項〉4）：memory_override 寫「NSIS 以路徑前綴強制結束」，實作改成請求行程以 pid 結束。原因是 T0823 的 guard 規定 nsh 內不得出現強制結束指令，而且塔台補充 4 寫「不強制刪」。
2. **`e2e/t0823-installer-graceful-quit.spec.ts` 的 control 情境**：T0846 之後它一直會失敗，期待已改成 T0846 的同版規則：顯示 `app.upgradeReinstalled`、log 有 `same-version`。這不是本單造成的回歸；本單 HEAD 上的失敗訊息就是 `detected … same-version`。建議塔台確認 T0846 收單時有沒有跑這支 e2e。

### 遭遇問題

- 這個環境的 bash heredoc 會改壞反斜線（T0857 / T0859 也遇過）。NSIS 與診斷腳本改用 Edit / Write 寫，沒有留下錯誤內容。
- 無阻斷。

### 已知限制（docs 已寫）

- 只刪本次安裝範圍的根目錄；另一個範圍留下的根目錄不刪。
- 解除安裝的請求只會送到預設 runtime 的 userData。`--runtime=N`，或以另一個帳號提權時，holder 不會被請走 → 根目錄被保留。
- per-machine 互動升級時，UAC inner instance 不跑 `CHECK_APP_RUNNING`：主行程被強制結束、沒有紀錄，holder 仍活著，下次啟動會跳 Recovery 提示。
- 列程序清單到結束程序之間有時間差：期間新起的程序不會被結束（安裝程式等滿 15 s 後回退）。
- idle 延長只有一次；延長之後任何 client 的 hello 都會把它清掉。
- 內嵌 agent 結束後，分頁 shell 還在；恢復走既有清單，不會自動 resume。

### 後續建議（給塔台）

1. **W5（T0861）**：
   - 下次啟動時，若紀錄 `holderKept` 且 `holderPid` 與 pid 檔一致 → 直接接回，不跳 Recovery 提示。
   - notice 的 `holderKept: true` / `ptyCount: 0` / `agentCount` 已經就緒，「已接回 N 個終端」的 toast 文字由 W5 加。
   - 被結束 agent 的分頁仍列在清單中；接回後，那些分頁的 shell 是同一個 PTY，W5 要確認 T0766 的恢復路徑（例如 `startClaudeCliPty` 會先 kill）與保留的 PTY 不衝突。
2. **W6**：照〈待 W6 驗收〉。`e2e/t0860-installer-quit-holder.spec.ts` 可以當成升級驗收 spec 的基礎。
3. **T0846 收單流程**：e2e `t0823` 的 control 情境過時了很久才被發現，建議以後改到偵測規則時，把 `t0821` / `t0823` e2e 列為必跑。

### 方法論狀態回寫

- 不適用（工單沒有 `methodology`）。

### 回報時間

- 2026-11-05T07:34:27+0800
