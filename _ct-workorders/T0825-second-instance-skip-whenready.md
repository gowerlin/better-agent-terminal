---
schema_version: 1
schema_kind: workorder
id: T0825
title: "BUG-210：沒拿到 single-instance lock 的第二個 BAT 實例不跑 whenReady 的任何啟動步驟"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-04T03:04:55+0800"
started_at: "2026-11-04T03:06:24+0800"
updated_at: "2026-11-04T03:14:39+0800"
completed_at: "2026-11-04T03:14:39+0800"
session_ids:
  - "2d8adb95-5376-4cb0-806c-e7a8cf94e5d8"
depends_on: []
related:
  - "BUG-210；D268；T0823（`electron/main.ts` `installerQuitRequestProcess` / `installerQuitWithoutApp`、whenReady 開頭的 return；回報區〈實作中發現並修正的三件事〉1）；T0485（啟動期日誌、app-paths-bootstrap 規則）；PLAN-039（profile 視窗的 `second-instance --profile=`）"
affects_files:
  - _ct-workorders/T0825-second-instance-skip-whenready.md
  - electron/main.ts
  - electron/__tests__/
  - e2e/
  - docs/agent-guide/upgrade-interruption.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改沒拿到 lock 的實例：拿到 lock 的主實例啟動流程、`second-instance` handler（含 `--profile=` 開 profile 視窗、T0823 `--installer-quit-request`）的行為完全不變；T0823 的 `installerQuitWithoutApp`（請求行程拿到 lock、只停保留的 server）不變。"
  - "🔴 CLAUDE.md 既有規則照守：`app-paths-bootstrap` 必須維持 `main.ts` 的第一個 import（`app-paths-bootstrap-order.test.ts` 守住）；不在 main.ts handler 之前註冊 `uncaughtException` / `unhandledRejection`；任何模組不得在 import 期呼叫 `app.getPath('userData')`。若發現 ready 之前的模組層副作用對第二個實例有害、需要搬動，先問塔台，不要自行重排啟動順序。"
  - "🔴 不碰本機 BAT 安裝版與它的 Terminal Server；e2e 一律隔離 runtime（同 runtime 起兩個實例），結束只關自己啟動的程序。yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本單範圍。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0825 — 第二個實例不跑 whenReady（BUG-210）

## 元資料

- **工單編號**：T0825
- **類型**：implementation
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-04T03:04:55+0800
- **預估規模**：S

## 背景

見 BUG-210。`electron/main.ts` 約 230 行 `!gotTheLock` 時 `app.quit()`，但 whenReady（約 1786 行）照樣執行；T0823 只替 `--installer-quit-request` 的請求行程在 whenReady 開頭 return。使用者決定併入 `0.7.4-pre.6` 這一批（D268）。

## 範圍

1. whenReady 開頭：沒拿到 lock 的實例一律 return（與 T0823 的 return 合併成一個判斷，保留 T0823 的語意與註解；寫明為什麼 `app.quit()` 擋不住）。
2. 盤點 `ready` 之前、模組層會對第二個實例產生副作用的程式（寫檔、開埠、fork、改設定），列在回報；無害的照舊，有害的先問塔台。
3. 記一行 debug log（例 `[startup] second instance: handed off to the running BAT, skipping startup`），不記 argv 內容。

## 驗證

- 單元 / source guard：whenReady 開頭對 `!gotTheLock` 的 return；T0823 既有測試照過。
- e2e（隔離 runtime）：同 runtime 起主實例（含一個 shell 分頁）→ 再起第二個實例（不帶參數）→ 第二個實例退出、日誌沒有 whenReady 之後的啟動行、沒有新的 Terminal Server / pid 檔變動、主實例不受影響；帶 `--profile=` 的情境若既有 e2e 已涵蓋就跑它（PLAN-039）；T0823 的 `t0823-installer-graceful-quit` e2e 照過。
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`。

## 驗收

- [ ] 第二個實例不跑啟動步驟（附日誌與程序證據）
- [ ] ready 前副作用盤點
- [ ] 主實例 / `second-instance` / T0823 不回歸
- [ ] typecheck 0 / 0、unit、legacy、vite build
- [ ] docs（`upgrade-interruption.md` 若有提到第二個實例的已知限制就更新）

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-04T03:14:39+0800
- **session_id**：2d8adb95-5376-4cb0-806c-e7a8cf94e5d8
- **產品 commit**：`bfde0beb`（`fix(startup): second instance skips whenReady startup (T0825, BUG-210)`）；未 push

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）→ PASS
- C-1 PASS；C-3 PASS（`electron/main.ts`、`electron/__tests__/`、`e2e/`、`docs/agent-guide/upgrade-interruption.md` 都存在）；C-2 無 `branch` 欄位（目前 `main`）
- `CT_HOME` 未設定（不是 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 修改內容

| 檔案 | 改動 |
|---|---|
| `electron/main.ts` | whenReady 開頭 `if (installerQuitRequestProcess) return` → `if (!gotTheLock \|\| installerQuitRequestProcess) { if (!gotTheLock) logger.log('[startup] second instance: handed off to the running BAT, skipping startup'); return }`；註解寫明 `app.quit()` 在 ready 前呼叫、Electron 仍會發 `ready`（T0823 實測），並保留 T0823 的語意（請求行程不論有無 lock 都 return）。lock 檢查處補一行註解指向這裡。其他啟動順序未動。 |
| `electron/__tests__/second-instance-startup.test.ts`（新） | source guard 5 項：只有一個 `app.whenReady()`、沒有 `app.on/once('ready')`；lock 檢查仍 `app.quit()` 且在 whenReady 之前；判斷是 callback 第一個敘述（去掉註解後前 4 行固定）、log 不含 argv；判斷在 `logger.init`、`app.whenReady fired`、`rotateBatScriptsLog`、`crashReporter.start`、`new Tray`、`new UpgradeInterruptionCheck`、`begin()`、`takeInstallerQuitRecord`、`startTerminalServer()`、whenReady 的 `second-instance` handler、`markReady()` 之前；T0823 `installerQuitWithoutApp` 不變。 |
| `electron/__tests__/installer-quit-request.test.ts` | T0823 source guard 原本找 `if (installerQuitRequestProcess) return`（前 300 字）；改為找合併後的判斷、且在 `const t0 = Date.now()` 之前。測試語意不變（請求行程仍在 whenReady 開頭 return）。 |
| `e2e/t0825-second-instance-startup.spec.ts`（新） | 隔離 runtime：plain（不帶參數）、profile（`--profile=<執行中視窗的 profile>`）兩個情境，見〈驗證〉。 |
| `docs/agent-guide/upgrade-interruption.md` | 〈流程〉第 5 點補 T0825 的合併判斷與日誌行；〈驗證〉補 T0825 單元、突變、e2e 與對照。〈已知限制〉原本沒有第二個實例的條目，不需刪改。 |

### ready 之前的模組層副作用盤點（第二個實例）

全部判定無害，**沒有搬動任何程式、沒有改啟動順序**，所以沒有向塔台提問。

| 位置 | 動作 | 第二個實例的影響 | 判定 |
|---|---|---|---|
| `app-paths-bootstrap`（第一個 import） | `app.setName`、`migrateUserData`、`setPath('userData')`、`logger.init`（開新的 `debug-<stamp>.log`、清到只留 10 份）、`installEarlyCrashCapture`、macOS PATH fix | 遷移只在舊目錄存在時搬，主實例早已搬完 → 不動；多一個日誌檔（也是記錄交接行的地方），可能讓最舊的一份被清掉 | 無害（照舊；本單規則禁止重排） |
| main.ts 56–66 | Windows `spawnSync powershell` 隱藏 console（只影響 dev） | 一個短命 powershell | 無害 |
| main.ts 146–160 | `uncaughtException` / `unhandledRejection` handler、`handOffEarlyCrashCapture`、Linux `installChildProcessFdGuard` | 只註冊 listener / 包裝 spawn | 無害 |
| main.ts 164–183 | `appendSwitch`（GPU cache、ServiceWorker、Skia）、Linux sandbox log | 只影響本行程 Chromium 旗標；log 一行 | 無害 |
| `configureRuntimeRouter` | 只存 getter（lazy） | 無 | 無害 |
| main.ts 203–227（Windows） | `setAppUserModelId`；預設 runtime 時檢查開始功能表捷徑的 AppUserModelId，不同才 `writeShortcutLink` | 與主實例寫入相同的值；主實例啟動時已修好 → 實際不寫 | 無害（冪等） |
| `requestSingleInstanceLock` / `installerQuitWithoutApp` | 沒 lock → `app.quit()`；`installerQuitWithoutApp` 只在有 lock 時成立 | 不觸發 | 不變 |
| 模組層單例（`CtWorktreeService`、`ProfileManager`、`WslKeepAlive`、`HelperCapabilityRegistry`、`InterruptedAgentsStore`、`ClaudeSessionPersistence`、`RemoteServer`、`RemoteConnectionRegistry`、`WindowRegistry`…） | 建構子只存參數（逐一讀過），不開埠、不讀寫檔、不 spawn；`RemoteServer` 在 whenReady 才 `start` | 無 | 無害 |
| `app.on('second-instance', …)`（T0823 載入時註冊） | 沒有 lock 的行程不會收到 `second-instance` | 無 | 不變 |
| `before-quit` / `will-quit` / `window-all-closed` / `activate` | 在 `app.quit()` 之後才註冊（`app.quit()` 在 ready 前同步發 `before-quit` / `will-quit`，當時還沒有 listener）；e2e 實測第二個實例日誌沒有任何 `[quit]` 行、沒有離開對話框 | 無 | 無害 |
| `registerProxiedHandlers` / `bindProxiedHandlersToIpc` / `registerLocalHandlers`、`ipcMain.on(...)` | 只註冊 IPC handler；第二個實例沒有視窗，永遠不會被呼叫 | 無 | 無害 |
| `endEarlyCrashCapture()`（原在 whenReady） | 第二個實例現在不呼叫 → console.error 鏡像到磁碟日誌持續到行程結束（約 0.35 s） | 只多記可能的 console.error | 無害 |

### 驗證

| 證據線 | 結果 |
|---|---|
| `npm run typecheck` | 0（exit 0） |
| `npm run typecheck:electron` | 0（exit 0） |
| `npx vite build` | exit 0 |
| `npm run test:unit` | exit 0：406 檔 passed / 2 skipped；7124 tests passed / 38 skipped |
| `npm run test:legacy` | exit 0：33 / 33 檔，472 passed / 0 failed |
| 新單元 + T0823 + bootstrap 順序 | `second-instance-startup` / `installer-quit-request` / `app-paths-bootstrap-order` 3 檔 41 passed |
| 突變（備份→改壞→跑→由備份還原，未用 git restore） | 4 / 4 被抓到：判斷只剩 `installerQuitRequestProcess`（3 failed）、只剩 `!gotTheLock`（3 failed）、拿掉 `return`（1 failed）、log 帶 `${process.argv}`（1 failed）；還原後 `cmp` 相同 |
| e2e `t0825-second-instance-startup`（隔離 runtime、開發版 build） | **2 / 2 passed**。plain：第二個實例 exit 0、**354 ms**；它的日誌只有 `Debug logging started`、`node-pty loaded`、`[gpu] skia graphite`、交接行 4 行（沒有 `app.whenReady fired`、tray、`[terminal-server]`、`[upgrade-interruption]`、`[installer-quit]`、`[remote-server]`）；Terminal Server 程序前後都是 `[46304]`（沒有新的）、pid / port 檔 mtime 與內容不變、shell 與 server 照跑；執行中的 BAT 視窗數 1 → 2（既有 `second-instance` 行為）。profile：exit 0、**346 ms**，執行中的 BAT 記 `[profile-window] second-instance --profile=default: existing window …`、視窗數不變 |
| e2e 對照（暫時拿掉修正後 build，跑完由備份還原並重 build） | 2 / 2 failed（符合預期）。第二個實例 **2452–2457 ms** 才結束，日誌有 `[startup] app.whenReady fired at +25ms…`、`[startup] system tray created`、`[helper-cap] restored 1 capability record(s) from helper-capabilities.json — pending the Terminal Server's PTY list`、`[terminal-server] 1 live PTYs detected — deferring to user recovery decision` |
| 不回歸 e2e | `t0823-installer-graceful-quit` 3 / 3 + `t0825` 2 / 2 = **5 passed**（修正版 build） |
| `--profile=` 既有 e2e | repo 內沒有涵蓋 `second-instance --profile=` 的既有 e2e；改由本單 e2e 的 profile 情境覆蓋 |

### 驗收對照

- [x] 第二個實例不跑啟動步驟（日誌與程序證據見上表）
- [x] ready 前副作用盤點（全部無害，未搬動）
- [x] 主實例 / `second-instance`（新視窗、`--profile=`）/ T0823 不回歸
- [x] typecheck 0 / 0、unit、legacy、vite build
- [x] docs（`upgrade-interruption.md` 流程與驗證已更新；已知限制原本沒有相關條目）

### 遭遇問題

- e2e 第一次執行 2 / 2 失敗：我寫的「日誌不含 `--runtime=`」斷言太嚴，命中的是 logger 既有的 `Debug logging started … argv=` 行（T0485 起就記 argv，不是本單新增）。改成只檢查交接行本身等於固定字串後通過。
- 用 sed / python heredoc 改 spec 時 `\r` 被轉成真的 CR，改用 PowerShell 讀寫修正；最終檔案沒有 CR、非 ASCII 字元完整。

### 後續建議（給塔台）

1. CLAUDE.md「升級結束終端的提示與說明」節寫的是「請求行程（有沒有 lock）一律在 whenReady 開頭 return」，仍然正確；若要一併提到「所有拿不到 lock 的實例也 return（T0825）」，需另外改 CLAUDE.md（不在本單 `affects_files`）。
2. logger 的 `Debug logging started … argv=` 會把完整 argv 寫進日誌（含 `--profile=` 等）。不是本單範圍、目前也沒有敏感參數，僅記錄。

### 互動紀錄

- [03:06] 開工；yolo、未向塔台提問（所有選擇都在範圍內，記於上方）。

### Commit

- 產品：`bfde0beb`
- 工單：本次 closeout commit（只含本檔）
