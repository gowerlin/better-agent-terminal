---
schema_version: 1
schema_kind: workorder
id: T0485
title: "啟動韌性：bootstrap 階段提早初始化磁碟日誌 + early uncaughtException / unhandledRejection 落地 + macOS PATH 修正移到所有 import 之前"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P2
sizing: M
created_at: "2026-10-13T23:13:05+08:00"
started_at: "2026-10-13T23:17:15+08:00"
updated_at: "2026-10-13T23:41:41+08:00"
completed_at: "2026-10-13T23:41:41+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - "T0480"
related:
  - "T0479 回報區第 7 節（R6，選配 D）與「偏離 / 範圍外發現」4（`main.ts:17-61` PATH 修正實際晚於所有 import 的模組主體）"
  - "T0480（`electron/app-paths-bootstrap.ts` 為 `main.ts` 第一個 import；import 白名單測試 `app-paths-bootstrap-order.test.ts`）"
  - "BUG-116（mac 主程序在 logger.init 前崩潰 → 無 Logs）"
affects_files:
  - "electron/app-paths-bootstrap.ts"
  - "electron/logger.ts"
  - "electron/main.ts"
  - "electron/early-*.ts"
  - "electron/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 `main.ts` 只改：檔頭 PATH 修正段（`:17-61` 一帶）、`uncaughtException` 註冊處（`:137` 一帶）、whenReady 的 `logger.init` 一帶；其他區段不動（T0491 稍後會改 main.ts 的對話框區）"
  - "🔴 bootstrap 仍須是 `main.ts` 第一個 import；若新增 early 模組，更新 import 白名單測試並說明"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 **不改 `CLAUDE.md`**（除非本單 frontmatter 另有授權）：需更新的文件內容寫在回報區「CLAUDE.md 建議文字」，由 T0493 統一套用"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0485 — 啟動韌性：bootstrap 階段提早初始化磁碟日誌 + early uncaughtException / unhandledRejection 落地 + macOS PATH 修正移到所有 import 之前

## A. 提早日誌（T0479 選配 D）

- bootstrap 在 `setPath('userData')` 之後即初始化磁碟日誌（只需 fs）；同步讀取 `settings.json` 的 logging 設定（`loggingEnabled` / `logLevel`），與 whenReady 現行行為一致
- whenReady 的 `logger.init` 改為冪等（已初始化則不重開檔、不重複輪替），migration report 照常寫出
- 在 bootstrap（早於其他模組主體）註冊 early `uncaughtException` / `unhandledRejection`：寫入磁碟日誌後維持現行處理語意（不得改變是否退出 / 對話框等既有行為）；與 main.ts 既有 handler 的分工要清楚，避免重複記錄
- 驗證：模擬「import 期丟錯」（測試用 fake 模組）→ 磁碟日誌有記錄；正常啟動只開一個日誌檔

## B. macOS PATH 修正提前

- 現況：`main.ts:17-61` 註解宣稱在所有 import 前執行，但 bundle 中晚於所有 import 的模組主體
- 盤點 import 期讀取 `process.env.PATH` 的模組（含間接依賴，如 resolver 快取）；把 PATH 修正搬進 bootstrap（或 bootstrap 之內的 early 模組），mac / Linux 邏輯與 Windows no-op 不變
- 以 `npx vite build` 產物 offset 證明 PATH 修正早於其他模組主體（回報數字）

## 驗收條件

- [ ] 單元測試：logger 冪等、early handler 寫檔、PATH 修正純函式（mac / linux / win 分支）
- [ ] 產物順序 offset（PATH 修正、early handler 註冊 < 其他模組主體）
- [ ] e2e isolated runtime：啟動後 `Logs/` 只有一個新檔且含 `[userdata-migration]`；`smoke` / `plan039-multi-remote` 回歸
- [ ] `npm run test:unit`、`npx vite build`；CLAUDE.md 建議文字（Logging 段）

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。A（提早日誌 + early crash capture）與 B（macOS PATH 修正提前）都已完成，驗收條件全部通過。

🔴 **與工單字面不同之處（已依「不得改變既有行為」處理，詳見第 2 節）**：沒有在 bootstrap 註冊 early `uncaughtException` / `unhandledRejection` listener，改用 `uncaughtExceptionMonitor` 加上載入期間的 `console.error` 鏡像。以 Electron 41 實測確認：
- 載入期同步丟錯**不會**觸發 `uncaughtException` 或 monitor。Electron 會自行 catch，再以 `console.error('App threw an error during load')` 加上 stack 印出，行程不退出、也沒有視窗
- 提早註冊 `uncaughtException` 會關掉 Electron 預設的錯誤對話框
- 提早註冊 `unhandledRejection` 會抑制 Node 的 warning（Electron 是 warn 模式）

### 1. 著陸檢查

- **PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`
- C-1：工單位於 REPO_ROOT 之下
- C-3：`affects_files` 中可測的項目都存在（僅供參考）
- C-2：工單沒有 `branch` 欄位，目前在 `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 執行模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 2. A：提早日誌與 early crash capture

**行為探針**（scratchpad 中的最小 Electron app，`node_modules/electron/dist/electron.exe`，Electron 41；探針與 `%APPDATA%\t0485-probe*` 都已刪除）：

| 探針 | 觀察 |
|---|---|
| p1：預設 listener 數 | `process.listenerCount('uncaughtException')` = 1（Electron 預設的對話框 handler）。加上 `uncaughtExceptionMonitor` 後仍是 1。`unhandledRejection` = 0 |
| p1：rejection | 印出 `UnhandledPromiseRejectionWarning`，行程不退出，monitor 不觸發 ⇒ warn 模式 |
| p2 / p3：載入期 `throw` | 印出 `App threw an error during load` 加 stack。`uncaughtException`、monitor、`unhandledRejection` 都**沒有**觸發。行程繼續存活，沒有視窗（timer 仍會執行） |
| p4：載入期 `throw` 並 patch `console.error` | patch 後的 `console.error` 收到 2 次呼叫（訊息字串、stack 字串）。加了 `unhandledRejection` listener 之後就不再出現 warning |
| p5：rejection 並 patch `console.error` | Node 的 `UnhandledPromiseRejectionWarning` 會經過 `console.error`，也會觸發 `warning` 事件 |

**實作**：

- `electron/logger.ts`
  - `init` 改為冪等：第一次成功才開檔並輪替；之後的呼叫只套用設定。若 userData 不同，寫一行 warn 並保留第一次的路徑。建立 `Logs/` 失敗時不標記為已初始化，所以 whenReady 會重試
  - 新增 `logger.readSettings(userData)`，同步讀取 `settings.json` 的 `loggingEnabled` / `logLevel`，規則與 `main.ts` 的 `readLoggingConfigSync` 相同
  - 新增 `logger.mirrorConsoleErrors(enabled)`：啟用期間，每次 `console.error` 都會以 `[console.error] …` 寫入磁碟日誌，接著照常呼叫原本的函式。`logger.error` 自己 echo 到 console 時有 guard，不會重複寫入
- `electron/early-crash-log.ts`（新增）
  - `installEarlyCrashCapture()`：註冊 `uncaughtExceptionMonitor`（以 `logger.error('[CRASH] early <origin>: …')` 寫入，EPIPE 照 `main.ts` 的規則忽略），並啟用 console 鏡像
  - `handOffEarlyCrashCapture()`：移除 monitor
  - `endEarlyCrashCapture()`：移除 monitor 並停止鏡像
- `electron/app-paths-bootstrap.ts`：在 `setPath('userData')` 之後依序執行 `logger.init(resolvedUserData, logger.readSettings(...))` → `installEarlyCrashCapture()` → PATH 修正（B）
- `electron/main.ts`
  - 註冊自己的 `uncaughtException` / `unhandledRejection` 之後，緊接著呼叫 `handOffEarlyCrashCapture()`，從此由 main.ts 負責記錄，monitor 不再重複
  - whenReady 的 `logger.init` 保留，現在只是重新套用設定。之後呼叫 `endEarlyCrashCapture()`，因為 bundle 已載入完成。migration report 照常寫出

**與 main.ts 的分工**：

| 階段 | 誰負責記錄 |
|---|---|
| bootstrap → main.ts 註冊 handler 之前 | monitor 負責 async exception。實務上這段是同步執行，只有在載入失敗、main.ts 的 handler 沒有註冊時才會用到 |
| 載入期同步丟錯（任何位置，含 main.ts 主體） | console 鏡像（Electron 的 load-error 報告） |
| main.ts 註冊 handler 之後 | main.ts 的 handler，monitor 已移除 |
| bootstrap → whenReady 之間的其他 `console.error`（含 Node 的 rejection warning） | console 鏡像 |
| whenReady 之後 | 回到原本的行為，不再鏡像 |

**既有行為沒有改變**：
- 沒有新增 `uncaughtException` / `unhandledRejection` listener（單元測試斷言 listener 數為 0）。Electron 對話框、是否退出、rejection warning 都和以前一樣
- 鏡像只多寫磁碟，仍會呼叫原本的 `console.error`
- 鏡像依賴 Electron 用 `console.error` 回報 load error。若日後 Electron 改變這個做法，載入期丟錯會回到「只在 console」，但不會造成錯誤

### 3. B：macOS PATH 修正提前

**盤點 import 期讀取 `PATH` 的模組**（以 HEAD 產物 `main-CdoKG_Pe.js` 為準）：
- 第一方程式與打包進 bundle 的 node_modules 中，`env.PATH` / `"PATH"` 共有 7 處：`claude-resolver` 的 `fA`、`gh-resolver` 的 `fw`、`node-resolver` 的 `mR`、`codex-runtime-resolver` 的 `PR`、`headless-entry` 的 `tv`/`iN`，以及 main.ts 的修正本身。全部都在函式內，呼叫端也都在函式內，**沒有任何一處在 import 期執行**
- 延遲載入的 chunk（`sdk-*`、`index-*`（codex）、`arch-detect-*`、`server-bundle-*`、`resolve-claude-base-command-*`）都以 `await Promise.resolve().then(() => require(...))` 動態載入，不在 import 期
- 只有 Node 內建模組與 `ws` 的 `require` 會被 hoist 到 chunk 最上方，比 bootstrap 更早。它們都不讀 `PATH`
- 模組層級的 env 快照只有 `HOME` / `USERPROFILE`（`claude-resolver.ts:52`、`node-resolver.ts:15`），沒有複製 `PATH`
- ⇒ 目前沒有可觀察到的影響。這次搬移是結構性修正，避免日後有模組在 import 期讀 `PATH` 時靜默拿到 GUI 啟動時的精簡 PATH

**實作**：
- 新增 `electron/early-path-fix.ts`
  - `resolveGuiLaunchPath(deps)` 是純函式，可注入 platform / env / execFileSync / readdirSync
  - `applyGuiLaunchPathFix()` 套用到 `process.env.PATH`
- 規則與原本完全相同：只處理 darwin。先用 login shell 取 PATH（fish 用 `string join`）；輸出為空就不改；失敗時 fallback，在前面加上 homebrew、`/usr/local/bin`、volta 與最新的 nvm 版本。Linux / Windows 不做任何事
- bootstrap 在 early capture 之後呼叫。有修正時寫一行 `[startup] PATH fixed for GUI launch (source=login-shell|fallback)`
- `main.ts`：刪除原本的 PATH 區塊，改成一行指向新位置的註解。`execFileSync` 已沒有用到，從 `child_process` import 中移除。Windows 隱藏 console 的區塊不動

### 4. 驗證

**單元測試（新增 / 修改）**：

| 檔案 | 內容 |
|---|---|
| `electron/__tests__/logger-early-init.test.ts`（9） | 冪等：同一個檔案、只有一行 startup、設定重新套用。不同 userData 時 warn。mkdir 失敗後可重試。disabled 時不開檔。`readSettings` 讀取與預設值。鏡像有寫入、停用後還原、`logger.error` 不重複、上層另有 wrapper 時保持 pass-through |
| `electron/__tests__/early-crash-log.test.ts`（4） | 只註冊 monitor（`uncaughtException` / `unhandledRejection` 的 listener 數 = 0）。monitor 會寫入、忽略 EPIPE、非 Error 也能處理。hand-off 後停止 monitor、鏡像持續到 end。**fake 模組 `fixtures/t0485-throwing-module.ts` 在 import 期丟錯 → 磁碟日誌有 stack** |
| `electron/__tests__/early-path-fix.test.ts`（7） | darwin：login shell、預設 zsh、fish、輸出為空時為 null、fallback（nvm 取 `v20.10.0`）、無 nvm 也無 PATH。linux / win32：null，且不 spawn、不讀目錄 |
| `electron/__tests__/app-paths-bootstrap-order.test.ts`（+3） | import 白名單加入 `./logger`、`./early-crash-log`、`./early-path-fix`，並限制這三個模組自己的 import。main.ts 不再有 `process.env.PATH =`。bootstrap 原始碼順序為 setPath → logger.init → installEarlyCrashCapture → applyGuiLaunchPathFix。runtime：呼叫序列結尾是 `setPath:userData`、`pathFix`；`Logs/` 在 bootstrap 中建立在正確的 userData 下，`logLevel` 取自 `settings.json` |

**真 Electron 驗證（import 期丟錯 → 磁碟日誌）：PASS**
- 用 esbuild 把 `electron/app-paths-bootstrap.ts` 和一個主體會丟錯的 fake 模組打成 CJS，以 `--runtime=98485` 啟動
- `BetterAgentTerminal-runtime-98485/Logs/debug-20261013-232717.log` 的內容：
  ```
  [INFO] [startup] Debug logging started. PID=6856 …
  [ERROR] [console.error] App threw an error during load
  [ERROR] [console.error] Error: T0485 probe: fake native addon failed to load
      at Object.<anonymous> (…probe-boot\main.js:650:7) …
  ```
- 修改前，這個情境不會產生 `Logs/`（T0479 R6）
- 結束後已刪除該 runtime 目錄，沒有產生 legacy 目錄，也沒有殘留行程

**`npm run test:unit`：PASS**

182 files / 3123 passed / 1 skipped（共 3124）

**`npx vite build`：PASS**

exit 0

**產物順序：PASS**

`dist-electron/main-B5ZNu3iJ.js`（698369 bytes）中的 offset：

| 位置 | offset |
|---|---|
| bootstrap `setName(` | 13109 |
| bootstrap `setPath("userData",…)` | 13470 |
| bootstrap `logger.init` 呼叫（`p.init(Is,p.readSettings(Is))`） | 13529 |
| bootstrap `installEarlyCrashCapture()` 呼叫（`xE()`，註冊 monitor 與鏡像） | 13559 |
| bootstrap `applyGuiLaunchPathFix()` 呼叫（`RE()`） | 13564 |
| **bootstrap 之後第一個模組主體**（window-registry 的 `windows.json` helper） | **13642** |
| snippet-db 單例 `new bO` | 277228 |
| main.ts `process.on("uncaughtException"` | 640766 |
| main.ts `handOffEarlyCrashCapture()` 呼叫（`Yw()`） | 641009 |
| `requestSingleInstanceLock(` | 641944 |

- 修改前（HEAD 產物 `main-CdoKG_Pe.js`）：PATH 修正 `process.env.PATH=` 在 637180 / 637631，`process.on("uncaughtException"` 約在 640000，都在 snippet-db 等所有模組主體之後
- 修改後：PATH 修正與 handler 註冊都在 13529–13564，早於所有其他模組主體（從 13642 開始）
- 比 bootstrap 更早的只有 bootstrap 自己 import 的模組主體：pid-manager、userdata-migration、logger、early-*。這些模組的主體只有宣告，沒有副作用

**e2e（isolated runtime）：PASS**
- 新增 `e2e/t0485-early-logging.spec.ts`
  - `Logs/` 只有 1 個檔案（`debug-20261013-232811.log`）
  - `[startup] Debug logging started` 只出現 1 次
  - offset：startup=34 < `[userdata-migration]`=442 < `app.whenReady fired`=801
  - `getLoggingInfo().currentLogFilePath` 指向同一個檔案
  - 正常啟動時，鏡像的 `[console.error]` 有 0 行
- 回歸：`smoke`、`bug119-userdata-unification`（2）、`plan039-multi-remote`（4）全部通過（t0485 / smoke / bug119 共 4 passed，13.8 s；plan039 4 passed，21.0 s）

**tsc（以檔案為單位）：PASS**
- `npm run typecheck:electron`：工作樹 77 個錯誤，HEAD 快照（`git archive HEAD` 匯出到 scratchpad、node_modules 用 junction）同樣 77 個
- `electron/main.ts` 兩邊都是 19 個，去掉行號後完全相同，都是既有錯誤（`Handler` 型別、`app.dock`、`fs.promises` 等）
- 新檔案（`early-*`、`logger.ts`、`app-paths-bootstrap.ts`、新測試）：0 個錯誤
- `npm run typecheck`（`tsconfig.json`）：本單檔案 0 個錯誤

**未執行**：mac 實機驗證（PATH 修正在 mac GUI 啟動的實際效果，以及 BUG-116 類崩潰在 mac 上能否寫進日誌）。這需要真人在 mac 上確認；目前的證據是單元測試加上 Windows 上的 Electron 探針。

### 5. 異動檔案

- 修改
  - `electron/app-paths-bootstrap.ts`
  - `electron/logger.ts`（CRLF 維持）
  - `electron/main.ts`
  - `electron/__tests__/app-paths-bootstrap-order.test.ts`
- 新增
  - `electron/early-crash-log.ts`
  - `electron/early-path-fix.ts`
  - `electron/__tests__/early-crash-log.test.ts`
  - `electron/__tests__/early-path-fix.test.ts`
  - `electron/__tests__/logger-early-init.test.ts`
  - `electron/__tests__/fixtures/t0485-throwing-module.ts`
  - `e2e/t0485-early-logging.spec.ts`
- `main.ts` 改動範圍：
  - 檔頭 PATH 區段（改成 `early-crash-log` 的 import 加上註解）
  - `uncaughtException` 註冊處（註解與 `handOffEarlyCrashCapture()`）
  - whenReady 的 `logger.init` 附近（註解與 `endEarlyCrashCapture()`）
  - 範圍外只多改一處：第 9 行 `child_process` import 移除不再使用的 `execFileSync`。對話框區沒有動

### 6. 偏離 / 範圍外發現

1. **early handler 的形式**（見摘要與第 2 節）：工單寫的是 early `uncaughtException` / `unhandledRejection`，實作改用 monitor 加 console 鏡像。理由是實測證明直接註冊會改變既有行為（關掉對話框、抑制 warning），而且也抓不到載入期丟錯
2. **e2e spec 不在 `affects_files` 內**：驗收條件要求 e2e，所以新增了 `e2e/t0485-early-logging.spec.ts`（只有測試）
3. 🆕 **範圍外（交塔台）**：主程序載入期丟錯時，Electron 41 會讓行程繼續存活，但沒有視窗（探針 p3 與 probe-boot 都要靠 timeout 才結束）。使用者看到的是「點了沒反應」，行程卻還在。這是既有行為，本單沒有改。若要處理（例如在 load error 時顯示對話框並退出），需要另開工單決定 UX
4. `tmp/` 這個 untracked 目錄不是本單建立的，沒有動

### 7. CLAUDE.md 建議文字（交 T0493 套用）

**「Logging」段**，在「Log file location」那一項之後加入：

> - **啟動期日誌（T0485）**：磁碟日誌由 `electron/app-paths-bootstrap.ts` 在 `setPath('userData')` 之後立即 `logger.init`（設定以 `logger.readSettings` 同步讀 `settings.json`），早於所有其他模組主體；whenReady 的 `logger.init` 為冪等（已初始化只重套設定，不重開檔、不重複輪替），一次啟動只產生一個 `debug-*.log`。bootstrap 同時呼叫 `installEarlyCrashCapture()`（`electron/early-crash-log.ts`）：
>   - `uncaughtExceptionMonitor` → `[CRASH] early <origin>: …`；main.ts 註冊自己的 `uncaughtException` / `unhandledRejection` 後呼叫 `handOffEarlyCrashCapture()` 移除，不重複記錄
>   - `console.error` 鏡像（`logger.mirrorConsoleErrors`）→ `[console.error] …`，到 whenReady 的 `endEarlyCrashCapture()` 為止。Electron 41 對主 bundle **載入期同步丟錯**不發 `uncaughtException`，而是 `console.error('App threw an error during load')` + stack 後讓行程無視窗存活；Node 的 `UnhandledPromiseRejectionWarning` 也走 `console.error`。鏡像是這兩者進磁碟日誌的唯一管道
>   - **不得**在 main.ts handler 之前註冊 `uncaughtException` / `unhandledRejection` listener：前者會關掉 Electron 預設錯誤對話框（它只在 listener 數為 1 時顯示），後者會抑制 rejection warning（Electron 為 warn 模式）

**「單一 userData 目錄」段**的開發規則 ①，把「且它只 import `electron` / `path` / `./userdata-migration`」改為：

> 且它只 import `electron` / `path` / `./userdata-migration` / `./logger` / `./early-crash-log` / `./early-path-fix`（後三者各自只 import fs / path / child_process / `./logger`；`app-paths-bootstrap-order.test.ts` 靜態守住）

並在同段補一句：

> **macOS GUI 啟動 PATH 修正**（T0485）在 `electron/early-path-fix.ts`，由 bootstrap 在 early capture 之後呼叫（早於所有其他模組主體）；先前寫在 `main.ts` 頂部，實際晚於所有 import 的模組主體。

### 8. Commit

- `6867d3a` fix: T0485 early disk log + crash capture in bootstrap, macOS PATH fix before all module bodies（`git commit --only`，12 個檔案，只有本單的檔案）
- 收尾 commit：本工單 status / `completed_at`
- 沒有 push、沒有觸發 workflow、沒有建 tag

### 9. 暫存物清理

- scratchpad：probe1–5、probe-boot（含 src）、HEAD 快照（先移除 junction 再刪）都已刪除，只留 log 檔
- `%APPDATA%`：`t0485-probe1..5` 與 `BetterAgentTerminal-runtime-98485` 都已刪除
- e2e runtime 由 fixture 自行清除（log 顯示 `runtime userData removed: true`）
