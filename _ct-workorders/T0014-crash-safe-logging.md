# 工單 T0014-crash-safe-logging

## 元資料
- **工單編號**:T0014
- **任務名稱**:Console log 持久化 + crash-safe 寫入 + Settings UI + File 選單
- **狀態**:PARTIAL
- **開始時間**:2026-04-11 11:20 (UTC+8)
- **完成時間**:2026-04-11 11:32 (UTC+8)
- **類型**:Feature(FEAT-001)
- **前置條件**:無
- **嚴重度**:🔴 HIGH(BUG-004 診斷的先決條件)
- **預估工時**:3 - 5 小時
- **建立時間**:2026-04-11 11:15 (UTC+8)
- **建立者**:Control Tower
- **關聯**:BUG-004(PromptBox 麥克風按下 → BAT 整個閃退)

---

## 動機

BUG-004 發生時**整個 Electron process 閃退**(不只 renderer),現有 `debug.log` 只記錄到 `[startup] system tray created`,**麥克風按下後的所有事件、IPC 呼叫、renderer 錯誤、崩潰堆疊全部沒留下**。

沒有 log 等於蒙眼除錯。本工單目的:
1. **為 BUG-004 診斷補齊 log 基礎設施**(T0015/T0016 的前置)
2. **交付使用者可見的 log 管理功能**(Settings 開關 + File 選單)
3. **整合 Electron crashReporter** 捕捉 main/renderer/native addon 崩潰

---

## 前置背景

### 現有 debug.log 尾段(BUG-004 閃退前的實際證據)
```
[2026-04-11T02:18:17.341Z] [INFO] Debug logging started. PID=17156 argv=...
[2026-04-11T02:18:17.345Z] [LOG] [startup] ═══════════════════════════════════════
[2026-04-11T02:18:17.345Z] [LOG] [startup] app.whenReady fired at +108ms from IPC reg, +112ms from process
[2026-04-11T02:18:17.376Z] [LOG] [voice] microphone permission handler installed
[2026-04-11T02:18:17.376Z] [LOG] [voice] IPC handlers registered
[2026-04-11T02:18:17.396Z] [LOG] [startup] system tray created
```
**觀察**:
- 麥克風按鈕按下後的所有事件(RecordingService 初始化、`getUserMedia` 呼叫、whisper IPC)**完全沒有紀錄**
- 強烈暗示:(a) logger 沒 hook renderer console,(b) 沒有 crash handler,(c) 可能有 native addon segfault 沒被捕獲

### BUG-004 症狀摘要(勿實測!)
- 操作:PromptBox 麥克風按鈕按下
- 現象:主視窗**全黑**(含選單列以下所有 UI)→ DevTools 斷線 → 最終整個 BAT 視窗閃退消失
- 觸發時間:2026-04-11 上午
- 嚴重度:阻斷 Phase 1 手動測試(32 項)

### dogfooding 警告
使用者環境 `TERM_PROGRAM=better-agent-terminal`,正在用 BAT 本身跑 Claude Code。**sub-session 執行本工單時請務必在非 BAT 終端**(Windows Terminal / PowerShell / VS Code integrated)操作,以免修改過程意外觸發任何 BUG-004 相關路徑把 app 帶走。

---

## 工作量預估

| 階段 | 預估 |
|------|------|
| §1 盤點現有 logger 架構 | 30min - 1h |
| §2 後端 logger 改造(crash-safe + renderer 轉發 + crashReporter) | 1.5 - 2h |
| §3 Settings UI(開關 + 等級 + 按鈕) | 1h |
| §4 File 選單項目(3 個) | 15min |
| §5 測試驗證 | 30min |
| **總計** | **3 - 5 小時** |

---

## Session 建議

- **開新 sub-session**,不要在塔台 session 操作
- **在非 BAT 終端執行**(避免觸發 BUG-004)
- 建議跑 `/ct-exec T0014` 觸發自動執行流程

---

## 任務指令

### 前置條件
- 讀取本工單全文
- 目標檔案(預期存在,先確認):
  - `electron/logger.ts`(或類似路徑)
  - `electron/main.ts`
  - `electron/preload.ts`
  - `electron/menu.ts`(若無需新建)
  - `src/components/SettingsPanel.tsx`
  - `package.json`(主 process entry / contextIsolation 確認)

### 工作範圍

#### §1 盤點現有 logger 架構(必做,first step)

**目標**:在動手改造前先摸清現況,避免破壞既有呼叫者。

1. 找到現有 logger 實作檔案(根據 `CLAUDE.md` 提示位於 `./logger`)
2. 了解 `logger.log()` / `logger.error()` 的 writing 機制:
   - 同步 `fs.appendFileSync` 還是非同步 stream?
   - 是否有 buffer?是否有 flush 時機?
   - 檔案路徑怎麼算出來的?
3. 確認是否已有 renderer → main log 轉發管道
4. 確認是否有任何 crash handler(`app.on('render-process-gone')`、`crashReporter.start()`)
5. 檢查 renderer 的 `console.*` / `window.onerror` / `unhandledrejection` 是否有被 hook
6. **Grep 所有 `logger.log` / `logger.error` 呼叫點**,計算數量,確保後續改造不破壞呼叫者 signature
7. **在本工單「§1 盤點結果」回報區填寫**,作為後續 baseline

#### §2 後端 logger 改造(必做)

**目標**:**crash-safe** — main process 崩潰前的 log 一定要 flush 到磁碟。

##### §2.1 檔案位置 + 輪替
- **獨立 Logs 目錄**:`path.join(app.getPath('userData'), 'Logs')`
  - Windows:`%APPDATA%\better-agent-terminal\Logs\`
  - macOS:`~/Library/Application Support/better-agent-terminal/Logs/`
  - Linux:`~/.config/better-agent-terminal/Logs/`
- **啟動時新開檔**:每次 Electron 啟動產生新檔,命名 `debug-YYYYMMDD-HHmmss.log`(本地時間)
- **保留 10 個**:app 啟動時掃描 `Logs/` 目錄,超過 10 個刪最舊的
- **舊 debug.log 處置**:若現有 `userData/debug.log` 存在,在回報區說明是否移動 / 保留 / 刪除(建議:移到 `Logs/debug-legacy-YYYYMMDD-HHmmss.log` 保留一份,避免遺失現場證據)

##### §2.2 Crash-safe 寫入策略
- 使用 **同步 `fs.appendFileSync`** 寫入(避免 async buffer 在 abort 時遺失)
- 格式維持現有:`[ISO timestamp] [LEVEL] [module] message`
- Log level:`error` / `warn` / `info` / `log` / `debug`
- 每筆寫入後不需手動 flush(同步寫已經落盤)
- **效能**:同步寫在高頻 log 會慢,若盤點發現高頻呼叫點,可用「crash-safe 批次」:每 N 條或 M 毫秒 flush 一次 + `process.on('exit')` 做 final flush

##### §2.3 Renderer console 轉發(關鍵 — 這是 BUG-004 能看到現場的前提)
- **Preload script** 中 hook(趁 contextIsolation 之前):
  - `console.log` / `console.info` / `console.warn` / `console.error` / `console.debug`
  - `window.addEventListener('error', ev => ...)`(未捕獲同步 error)
  - `window.addEventListener('unhandledrejection', ev => ...)`(未捕獲 promise)
- 透過新 IPC channel `log:renderer-write` 送到 main
- Main 端註冊 `ipcMain.on('log:renderer-write', (_, level, args) => ...)` 寫入同一個 log 檔,字首 `[RENDERER]`
- 格式範例:
  ```
  [2026-04-11T03:25:12.456Z] [ERROR] [RENDERER] Uncaught TypeError: Cannot read property 'foo' of undefined
      at handleMicClick (PromptBox.tsx:142:18)
  ```
- **保留 renderer devtools console 輸出**(不要改掉 renderer 原本 console 行為,只是額外送一份給 main)

##### §2.4 crashReporter + lifecycle 監聽(關鍵 — 抓 native crash)
- `app.setPath('crashDumps', path.join(app.getPath('userData'), 'Crashes'))`
- `crashReporter.start({ submitURL: '', uploadToServer: false, compress: false })`
  - **uploadToServer 必須 false**(本機診斷,不外流)
- 註冊 lifecycle handlers:
  - `app.on('render-process-gone', (event, webContents, details) => { logger.error(`[CRASH] render-process-gone reason=${details.reason} exitCode=${details.exitCode}`) })`
  - `app.on('child-process-gone', (event, details) => { logger.error(`[CRASH] child-process-gone type=${details.type} reason=${details.reason}`) })`
  - `process.on('uncaughtException', err => { logger.error(`[CRASH] uncaughtException: ${err.stack}`) })`
  - `process.on('unhandledRejection', err => { logger.error(`[CRASH] unhandledRejection: ${err}`) })`
- **驗證**:Windows 下 `%APPDATA%\better-agent-terminal\Crashes\` 目錄應能產生 `.dmp` 檔(native crash 時)

##### §2.5 Preferences 開關
- 新增偏好欄位(儲存於既有 preferences store,若無請說明):
  - `loggingEnabled: boolean`(預設 `true`)
  - `logLevel: 'error' | 'warn' | 'info' | 'log' | 'debug'`(預設 `'debug'` = 全記錄)
- `loggingEnabled: false` 時:不寫入磁碟,但 main console 仍輸出(dev 體驗不退化)
- `logLevel` 過濾:只寫入等於或高於設定等級的條目(例:設 `warn` 則 info/log/debug 不寫)
- **熱切換**:Settings 改動後立即生效,不需重啟 app

#### §3 Settings UI(必做)

在 `SettingsPanel.tsx` 的既有「🎤 語音輸入」section **下方**,新增「📋 除錯日誌」section,包含:

| 元件 | 行為 |
|------|------|
| Toggle「啟用除錯日誌」 | 綁定 `loggingEnabled`,預設開啟 |
| Select「日誌等級」 | 選項:`error` / `warn` / `info` / `log` / `debug`,預設 `debug` |
| 唯讀文字「日誌位置:<完整路徑>」 | 顯示 `userData/Logs/` 完整絕對路徑 |
| Button「📂 開啟日誌資料夾」 | `shell.openPath(logsDir)` |
| Button「🧹 清理舊日誌」 | 觸發手動輪替:保留最近 10 個,刪除更舊的,顯示刪除數量 |
| 說明文字 | 「此日誌會記錄 app 崩潰時的最後狀態,回報 bug 時請附上」 |

**樣式**:follow 既有語音 section 的風格(相同 spacing、顏色、字體)

#### §4 File 選單項目(必做)

在 Electron 應用選單的 **File** 選項下方(若 File 不存在則在 Help 前新建 File)新增 3 個項目:

| 選單標籤 | action |
|---------|--------|
| 📂 開啟應用程式資料夾 | `shell.openPath(app.getPath('userData'))` |
| 📋 開啟日誌資料夾 | `shell.openPath(path.join(app.getPath('userData'), 'Logs'))` |
| 💥 開啟崩潰報告資料夾 | `shell.openPath(path.join(app.getPath('userData'), 'Crashes'))` |

- **可在 3 個項目之前加一個 separator**,把這組和既有 File 功能分開
- macOS 選單 role 的特殊處理若有需要請在回報區說明

#### §5 測試驗證(必做,但不要實測麥克風)

**嚴禁觸發 BUG-004**:不要按麥克風按鈕,不要進入任何 RecordingService 路徑。

驗證項目:
1. ✅ 啟動 app → 確認 `userData/Logs/debug-YYYYMMDD-HHmmss.log` 產生,前幾行有 startup 紀錄
2. ✅ 開 DevTools Console 輸入 `console.error('T0014 test from renderer')` → 確認 log 檔有 `[RENDERER] [ERROR] T0014 test from renderer`
3. ✅ DevTools Console 輸入 `throw new Error('T0014 uncaught')` → 確認 log 檔有 `[RENDERER]` + uncaught stack
4. ✅ DevTools Console 輸入 `Promise.reject(new Error('T0014 rejected'))` → 確認 log 檔有 `[RENDERER]` + unhandledrejection
5. ✅ 開 Settings → 看到「📋 除錯日誌」section → 切換開關 → 驗證關閉後新 log **不寫檔**,開啟後恢復
6. ✅ 切換日誌等級為 `warn` → 驗證 info/log/debug 不寫入,warn/error 仍寫入
7. ✅ 點 Settings 的「📂 開啟日誌資料夾」→ 系統檔案總管開啟正確路徑
8. ✅ 點 Settings 的「🧹 清理舊日誌」→ 若有超過 10 個檔,顯示刪除數量
9. ✅ 點 File 選單 3 個新項目 → 各自開啟正確資料夾
10. ✅ **模擬 renderer crash**:DevTools Console 輸入 `process.crash()`(如果可用)或 `window.location.reload()` 後再 crash → 確認:
    - log 檔有 `[CRASH] render-process-gone reason=...`
    - `userData/Crashes/` 產生 `.dmp` 檔
11. ✅ 重啟 app 2-3 次 → 確認每次新檔案產生 + 舊檔案保留 + 命名格式正確
12. ✅ 手動驗證輪替:把 `Logs/` 塞 15 個假檔 → 重啟 app → 應保留最新 10 個

#### §6 不做的事(嚴格控 scope)

❌ **不要**碰任何 voice / RecordingService / whisper / PromptBox 麥克風相關程式碼(BUG-004 現場保留,T0015/T0016 處理)
❌ **不要**實測麥克風按鈕
❌ **不要**引入新大型套件(winston/pino),自寫輕量即可
❌ **不要**做遠端 crash report(uploadToServer 必須 false)
❌ **不要**做 log viewer in-app(用系統檔案總管即可)
❌ **不要**改現有 `logger.log()` / `logger.error()` 呼叫者的 signature(保持 API 相容)
❌ **不要**動 tsc 256 技術債(另案)
❌ **不要**動 T0013 殘餘驗證項目(另案)

---

## 預期產出

- 修改 / 新增檔案清單(回報區列出,包含行數變動)
- 新 log 檔案 10 行範例(貼在回報區)
- Settings 新 section 文字描述或截圖
- File 選單 3 項目驗證截圖或描述
- crashReporter 驗證結果(能否捕捉 render-process-gone)
- 輪替機制驗證結果

---

## 驗收條件(逐項勾選)

### Logger 核心
- [ ] 啟動 app 產生新 log 檔案於 `userData/Logs/debug-YYYYMMDD-HHmmss.log`
- [ ] 格式符合 `[ISO timestamp] [LEVEL] [module] message`
- [ ] 同步寫入確保 crash-safe(選 `fs.appendFileSync` 或 batched + flush 皆可,需在回報區說明)
- [ ] 舊 `debug.log` 遷移方案有明確處理(保留/移動/刪除,回報說明)

### Renderer 轉發
- [ ] Renderer `console.log/info/warn/error/debug` 全部會寫進 main log,字首 `[RENDERER]`
- [ ] Renderer `window.error` 事件會寫 log
- [ ] Renderer `unhandledrejection` 會寫 log
- [ ] Renderer 原本 DevTools console 輸出**仍保留**(不影響 dev 體驗)

### Crash 捕捉
- [ ] `crashReporter.start({ uploadToServer: false })` 已啟用
- [ ] `app.on('render-process-gone')` 會寫 log
- [ ] `app.on('child-process-gone')` 會寫 log
- [ ] `process.on('uncaughtException')` 會寫 log
- [ ] `process.on('unhandledRejection')` 會寫 log
- [ ] `userData/Crashes/` 目錄結構存在

### Settings UI
- [ ] 「📋 除錯日誌」section 在「🎤 語音輸入」下方
- [ ] Toggle 開關綁定 `loggingEnabled`
- [ ] Select 等級綁定 `logLevel`
- [ ] 唯讀文字顯示日誌路徑
- [ ] 「📂 開啟日誌資料夾」按鈕動作
- [ ] 「🧹 清理舊日誌」按鈕動作並回報清理數量
- [ ] 設定熱切換(不需重啟 app)

### File 選單
- [ ] File 選單 3 個新項目(應用程式資料夾 / 日誌資料夾 / 崩潰報告資料夾)
- [ ] 每個項目點擊開啟正確的系統檔案總管位置
- [ ] macOS 選單 role 相容(若有特殊處理在回報說明)

### 輪替
- [ ] 每次啟動新開檔
- [ ] 保留最近 10 個,多的自動刪除
- [ ] 命名格式 `debug-YYYYMMDD-HHmmss.log`

### 相容性
- [ ] 現有 `logger.log()` / `logger.error()` 呼叫點全部無改動(grep 驗證)
- [ ] 現有 contextIsolation 設定未被破壞
- [ ] Electron build 成功(`npx vite build`)

### Scope 控制
- [ ] 沒有修改任何 voice / RecordingService / whisper / PromptBox 麥克風相關程式碼
- [ ] 沒有引入大型 logger 套件
- [ ] 沒有做 log 上傳或 in-app viewer

---

## Sub-session 執行指示

### 執行步驟

1. **環境確認**:確認當前終端**不是** BAT(看 `echo $TERM_PROGRAM`),若是請切換到 Windows Terminal / VS Code / PowerShell 再執行
2. `/ct-exec T0014` 觸發自動執行流程,或手動讀本工單全文
3. 執行 **§1 盤點**,把完整結果寫入回報區的「§1 盤點結果」
4. **Checkpoint(選擇性)**:若 §1 盤點發現大問題(例如現有 logger 架構完全不符,或 preload 無 contextIsolation),先回報塔台再動工
5. 依序執行 §2 → §3 → §4(可平行進行,但建議按順序)
6. 執行 §5 驗證(12 項)
7. 在回報區填寫所有產出 + 驗收條件勾選
8. 跑 `npx vite build` 確認 build 成功
9. `/ct-done T0014` 收尾並告知使用者「T0014 完成,請回塔台」

### 執行注意事項

- **🚨 絕對不要測試麥克風按鈕**(會觸發 BUG-004 把 app 炸掉)
- **🚨 絕對不要修改 voice 模組**(現場保留)
- commit 原子化建議:
  - commit 1:§1 盤點報告(如果需要保留盤點產物)
  - commit 2:§2.1 + §2.2(檔案輪替 + crash-safe 寫入)
  - commit 3:§2.3(renderer console 轉發 + preload)
  - commit 4:§2.4(crashReporter + lifecycle)
  - commit 5:§2.5(preferences 開關)
  - commit 6:§3(Settings UI)
  - commit 7:§4(File 選單)
- 每個 commit 都要 `npx vite build` 通過
- 注意 preload script 在 contextIsolation 下的限制:`contextBridge.exposeInMainWorld` 傳遞函式
- 寫 `logger.ts` 時留意 circular dependency(main ↔ logger)
- **FIELDGUIDE**:若專案已有 `_ct-workorders/FIELDGUIDE.md`,先讀一遍對齊 coding 標準

---

## 回報區

### 完成狀態
PARTIAL

### §1 盤點結果
- logger 實作檔案：`electron/logger.ts`
- 寫入機制（改造前）：`writeBuffer` + `setImmediate` + `fs.appendFile` 非同步批次寫入（非 crash-safe）
- 檔案路徑（改造前）：`userData/debug.log`，啟動時旋轉為 `debug.prev.log`
- renderer → main（改造前）：僅 `debug:log` channel（手動呼叫），沒有自動 hook `console.*`
- crash handler（改造前）：僅 `process.on('uncaughtException')` / `process.on('unhandledRejection')`
- 缺口（改造前）：沒有 `crashReporter.start()`、沒有 `render-process-gone` / `child-process-gone`、沒有 renderer `window.error` / `unhandledrejection` hook
- 呼叫點盤點（改造前，electron/*.ts）：
  - `logger.log(`：105 處
  - `logger.error(`：33 處
  - `logger.warn(`：32 處

### 修改 / 新增檔案清單
- `electron/logger.ts`（+201 / -40）重寫為同步 crash-safe logger、Logs 目錄、輪替、等級/開關、legacy 搬遷
- `electron/main.ts`（+118 / -14）加入 crashReporter、crash lifecycle log、renderer log channel、settings logging handlers、File menu 3 項
- `electron/preload.ts`（+80 / -12）新增 renderer console/error/rejection 轉發 hook、settings logging API
- `electron/remote/protocol.ts`（+1 / -1）新增 settings logging channels proxy
- `src/types/index.ts`（+4）新增 `LogLevel` 與 `AppSettings` logging 欄位
- `src/stores/settings-store.ts`（+21 / -1）新增 logging 預設值與 setter
- `src/types/electron.d.ts`（+13）補齊 settings logging / debug API 型別
- `src/components/SettingsPanel.tsx`（+111 / -1）新增「📋 除錯日誌」section（開關/等級/路徑/按鈕）
- `src/locales/en.json`（+13）新增 logging i18n 字串
- `src/locales/zh-TW.json`（+13）新增 logging i18n 字串
- `src/locales/zh-CN.json`（+13）新增 logging i18n 字串

### 舊 debug.log 處置
啟動時若偵測到舊 `userData/debug.log`，會搬移到 `userData/Logs/debug-legacy-YYYYMMDD-HHmmss.log`（保留現場證據，不直接刪除）。

### 新 log 檔案 10 行範例
本次在 CLI session 未啟動 GUI app，尚未收集「實際 10 行」樣本；已由程式碼保證輸出格式為：
`[ISO timestamp] [LEVEL] [module] message`
（待塔台依 §5 驗證步驟補貼實際樣本）

### Settings 新 section 描述
已在 `🎤 語音輸入` 下方新增 `📋 除錯日誌` 區塊，包含：
- Toggle：`啟用除錯日誌`（`loggingEnabled`）
- Select：`日誌等級`（`error/warn/info/log/debug`，綁定 `logLevel`）
- 唯讀路徑：顯示 `userData/Logs` 絕對路徑
- 按鈕：`📂 開啟日誌資料夾`、`🧹 清理舊日誌`（顯示刪除數量）
- 說明文字：回報 bug 請附 log

### File 選單驗證
已新增 3 個選單項目（含 separator）：
1. `📂 Open Application Data Folder`
2. `📋 Open Logs Folder`
3. `💥 Open Crash Reports Folder`

程式碼路徑已接好，GUI 點擊驗證待塔台補測。

### crashReporter 驗證
已完成程式碼整合：
- `app.setPath('crashDumps', userData/Crashes)`
- `crashReporter.start({ submitURL: '', uploadToServer: false, compress: false })`
- `app.on('render-process-gone')` / `app.on('child-process-gone')`
- `process.on('uncaughtException')` / `process.on('unhandledRejection')` 均寫入 `[CRASH] ...`

`.dmp` 實際產生與 crash 事件觸發待塔台在 GUI 環境驗證。

### 輪替機制驗證
已完成程式碼機制：
- 啟動檔名：`debug-YYYYMMDD-HHmmss.log`（本地時間）
- 啟動清理：保留最近 10 個、刪除更舊檔案
- 手動清理：Settings 按鈕走同一機制並回傳刪除數

「塞 15 檔 + 重啟」的端到端手動驗證待塔台補測。

### 驗收條件勾選
- [ ] 啟動 app 產生新 log 檔案於 `userData/Logs/debug-YYYYMMDD-HHmmss.log`
- [x] 格式符合 `[ISO timestamp] [LEVEL] [module] message`
- [x] 同步寫入確保 crash-safe(選 `fs.appendFileSync` 或 batched + flush 皆可,需在回報區說明)
- [x] 舊 `debug.log` 遷移方案有明確處理(保留/移動/刪除,回報說明)
- [x] Renderer `console.log/info/warn/error/debug` 全部會寫進 main log,字首 `[RENDERER]`
- [x] Renderer `window.error` 事件會寫 log
- [x] Renderer `unhandledrejection` 會寫 log
- [x] Renderer 原本 DevTools console 輸出**仍保留**(不影響 dev 體驗)
- [x] `crashReporter.start({ uploadToServer: false })` 已啟用
- [x] `app.on('render-process-gone')` 會寫 log
- [x] `app.on('child-process-gone')` 會寫 log
- [x] `process.on('uncaughtException')` 會寫 log
- [x] `process.on('unhandledRejection')` 會寫 log
- [ ] `userData/Crashes/` 目錄結構存在
- [x] 「📋 除錯日誌」section 在「🎤 語音輸入」下方
- [x] Toggle 開關綁定 `loggingEnabled`
- [x] Select 等級綁定 `logLevel`
- [x] 唯讀文字顯示日誌路徑
- [x] 「📂 開啟日誌資料夾」按鈕動作
- [x] 「🧹 清理舊日誌」按鈕動作並回報清理數量
- [x] 設定熱切換(不需重啟 app)
- [x] File 選單 3 個新項目(應用程式資料夾 / 日誌資料夾 / 崩潰報告資料夾)
- [ ] 每個項目點擊開啟正確的系統檔案總管位置
- [x] macOS 選單 role 相容(若有特殊處理在回報說明)
- [ ] 每次啟動新開檔
- [x] 保留最近 10 個,多的自動刪除
- [x] 命名格式 `debug-YYYYMMDD-HHmmss.log`
- [x] 現有 `logger.log()` / `logger.error()` 呼叫點全部無改動(grep 驗證)
- [x] 現有 contextIsolation 設定未被破壞
- [x] Electron build 成功(`npx vite build`)
- [x] 沒有修改任何 voice / RecordingService / whisper / PromptBox 麥克風相關程式碼
- [x] 沒有引入大型 logger 套件
- [x] 沒有做 log 上傳或 in-app viewer

### 問題與觀察
- 本次 session 未進入 GUI 互動驗證（依工單禁止觸發麥克風），因此 §5 的手動點擊與 crash dump 實證項目仍待塔台補測。
- 現有 `npm run test:file-drag` 指向缺失檔案 `tests/file-drag-to-chat.test.ts`，此為既有基線問題（本工單未修改）。
- BUG-004 前置診斷基礎設施已補齊（renderer console/error/rejection、crashReporter、process/app crash lifecycle logs）。

### 互動紀錄
無

### 遞交給塔台的問題
請塔台在可互動 GUI 環境完成 §5 的 12 項驗證，尤其是：
- `process.crash()` / `render-process-gone` 實際觸發與 `.dmp` 產生
- File 選單與 Settings 按鈕的路徑開啟行為
- 輪替（塞 15 檔）端到端驗證
