---
schema_version: 1
schema_kind: workorder
id: T0397
title: "PLAN-036 P0 自動驗收（UI 層）：Playwright Electron e2e 覆蓋 BUG-095 / BUG-101 / T0393"
type: test
status: DONE
started_at: "2026-10-05T01:14:56+08:00"
updated_at: "2026-10-05T01:33:54+08:00"
completed_at: "2026-10-05T01:33:54+08:00"
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: M
created_at: "2026-10-05T01:13:27+08:00"
target_version: next
depends_on:
  - T0392
  - T0393
  - T0394
related:
  - "PLAN-036 §「P0 實機驗收準備（2026-10-05 01:01）」"
  - "T0396（同批平行：協定層 smoke）"
  - "既有範本：e2e/smoke.spec.ts（`_electron.launch` + `--runtime=` 隔離 userData）"
affects_files:
  - e2e/plan036-p0.spec.ts
  - e2e/fixtures/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不得影響使用者正在跑的 BAT（安裝版）**：e2e 一律以 `--runtime=e2e-plan036-<timestamp>` 啟動獨立 userData。開跑前先確認 Terminal Server 的端點（pipe / port）與 RemoteServer 埠是否**依 runtime 隔離**；若會連到 / 搶佔使用者 BAT 的 Terminal Server 或 RemoteServer 9876，該測試**不得執行**，標 SKIP 並在回報區說明原因與建議。"
  - "🔴 **WSL `bat-server.service` 不得 restart / stop / 重新部署**；若 T0393 測項需要連 WSL server（`127.0.0.1:9877`），只能以 client 連線，不得建立未清除的 PTY。"
  - "🔴 **不改 `package.json`**（T0396 同時在改）。不改產品程式碼（`electron/` / `src/`）；發現產品 bug → 回報區列出，不要順手修。"
  - "🔴 不送真實 Claude API 對話（不消耗 token）。BUG-095 只驗 IPC 綁定，不驗串流中止。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0397 — PLAN-036 P0 Electron e2e

## 元資料
- **工單編號**：T0397
- **任務名稱**：PLAN-036 P0 自動驗收（UI 層）
- **狀態**：DONE
- **建立時間**：2026-10-05 01:13 (UTC+8)
- **intervention_type**：fire-and-forget
- **affects_files**：`e2e/plan036-p0.spec.ts`、`e2e/fixtures/`（如需）

## 背景

使用者裁決 PLAN-036 P0 實機驗收「兩層都做」。T0396 做協定層；本單用既有 Playwright `_electron` 基礎（`npm run test:e2e`，`playwright.config.ts`，`e2e/smoke.spec.ts` 為範本）覆蓋需要 Electron 本體的三項。證據屬 **source build 層**（從 `dist-electron/` 啟動），不是安裝版；這點在回報區明寫。

## 範圍：`e2e/plan036-p0.spec.ts`

| # | 測項 | 對應 | 做法提示（以實作為準） |
|---|------|------|------|
| E1 | `claude:abort-session` 有 IPC 綁定 | T0392 / BUG-095 | renderer 以 `window.electronAPI` 對應的 abort API 傳不存在的 session id → 回應不得是 `No handler registered for 'claude:abort-session'`（回傳 false / 錯誤物件皆可，只要不是「沒 handler」）。同法順帶確認 `PROXIED_CHANNELS` 內其他 `claude:*` 在本機模式都有 handler（可選，若成本低） |
| E2 | Terminal Server 模式下 restart 終端不失聯 | T0394 / BUG-101 | 隔離 runtime 開啟 Terminal Server 模式 → 建終端 → 觸發 restart（`pty:restart` 或 UI 動作）→ 等待超過舊 PTY exit 事件抵達的時間 → 寫入 `echo <marker>`，output 出現 marker 且終端未被標記為 exited。**先做 memory_overrides 第 1 條的隔離確認** |
| E3 | 遠端 profile 的 shell 清單依 targetOS 過濾 | T0393 | 以 fixture 寫入 targetOS=linux 的遠端 profile（或連 WSL server），開 Settings → shell 選項只含 Linux shell，不含 `pwsh` / `cmd` / Windows 路徑 |
| E4 | WSL 工作區挑資料夾預設 WSL home + `/mnt/c` 提示 | T0393 | 以 `electronApp.evaluate` 在 main process stub `dialog.showOpenDialog`，記錄傳入的 `defaultPath`；斷言為 WSL home（`\\wsl.localhost\<distro>\home\<user>` 或 T0393 實作的形式），並斷言 renderer 顯示 `/mnt/c` 提示文字 |

每項都要能單獨 skip（前置條件不足時 `test.skip` 並寫明原因），不得因單項環境不足讓整支 spec 失敗。

## 驗收條件

- [ ] `npx vite build` 後 `npx playwright test e2e/plan036-p0.spec.ts` 實跑，E1-E4 結果（PASS / FAIL / SKIP + 原因）與輸出摘要附在回報區
- [ ] 既有 `e2e/smoke.spec.ts` 仍通過（`npm run test:e2e` 或單跑）
- [ ] `npm run test:unit` 全綠（基線 1085）；`npx tsc --noEmit` ≤ 40
- [ ] 跑完確認使用者的 BAT（安裝版）未受影響：沒有被關閉、沒有多出終端分頁（以 `--runtime` 隔離為證據即可）

## 不在範圍

- 不改產品程式碼、不改 `package.json`
- 不測遠端 PTY 協定（T0396）
- 不做視覺比對；「還原遠端終端畫面為空」屬已知 P1，不驗

## Sub-session 執行指示

1. 讀本工單 + `e2e/smoke.spec.ts`、`playwright.config.ts`、T0392 / T0393 / T0394 工單回報區（找實際 API / channel / UI 元素）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先做隔離確認 → 實作 → 實跑 → 驗收
4. 填回報區；完成寫 **`DONE`**；測項 FAIL 但測試本身正確 → 仍寫 `DONE`，FAIL 列入「遭遇問題」交塔台開 BUG
5. `git commit --only` 實際改動檔 + 本工單；不 push（不要 commit `e2e-results/`）
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** —— E1-E4 四項全部 **PASS**（source build 層）。驗收條件中「既有 `e2e/smoke.spec.ts` 仍通過」**未達成**：smoke 在主 repo 路徑本身就逾時（不是 `.kilo` 造成），根因是既有的結束確認對話框，**不是本單或產品回歸**，詳見「遭遇問題 1」。

- **開始**：2026-10-05T01:14:56+08:00（Worker，`CT_MODE=on`、`CT_INTERACTIVE=0`）
- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS（工單在 `REPO_ROOT` 下）；C-3 資訊性（`e2e/` 存在，`e2e/plan036-p0.spec.ts` 為新建）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- **證據層級**：**source build**（`npx vite build` → `dist-electron/`，以 `node_modules/electron` 41.2.1 啟動），**不是安裝版**

### 產出摘要

- 新增 `e2e/plan036-p0.spec.ts`（4 個 test，serial；每項各自啟動一個隔離 instance，各自可 `test.skip`）
- **沒有用到 `e2e/fixtures/`**：E3 / E4 需要的遠端 profile 改在執行期以 preload API（`profile.create` + `profile.update`）建在隔離 runtime 內，不需要靜態 fixture 檔，也不必把任何 token 寫進 repo
- **E3 / E4 的遠端連線做法（loopback）**：隔離 instance 以 `tunnel.getConnection()` 取得**自己**的 RemoteServer token / fingerprint，建立 `type: 'remote'`、`remoteHost: 127.0.0.1`、`remotePort: <隔離埠>`、`targetOS: 'wsl-linux'`、`wslDistro: <偵測到的 distro>` 的 profile，再以 `app.openNewInstance(profileId)` 開出遠端視窗。走的是真實路徑：main `loadProfileSnapshotDetailed` → renderer `initProfile` → `remote.connect` 成功 → `setWindowRemoteTarget`；main `dialog:select-folder` → `wslFolderDefaultForSender`（`remoteClientProfileId` 相符且 `isConnected`）→ `wsl -d <distro> printenv HOME`。**完全沒有連使用者的 9876 或 WSL `127.0.0.1:9877`**，也沒有在 WSL host 建任何 PTY
- 未改產品程式碼、`package.json`、`playwright.config.ts`、`e2e/smoke.spec.ts`

### 隔離確認

開跑前逐一核對 `electron/main.ts`：

| 資源 | 是否依 runtime 隔離 | 依據 | spec 的處理 |
|------|------|------|------|
| userData | ✅ | `--runtime=<id>` → `app.setPath('userData', <base>-runtime-<id>)`（`main.ts:156-162`） | 啟動後讀 `app.getPath('userData')`，斷言 basename 含 `-runtime-<id>`，否則立即失敗 |
| Terminal Server | ✅ | PID / port 檔在 userData（`pid-manager.ts`）；server `listen(0, '127.0.0.1')` 取臨時埠（`server.ts:128`）；fork 時 `BAT_USER_DATA` 覆寫為 runtime userData（`main.ts:368-377`） | E2 另以 `Get-CimInstance` 驗證該 PID 的命令列是本 repo 的 `dist-electron\terminal-server.js` |
| RemoteServer | ⚠️ **預設不隔離** | auto-start 埠的優先序是 `BAT_REMOTE_PORT` env > `settings.remotePort` > 9876（`main.ts:501-518`、`:1524-1533`）；不覆寫就會去試 9876（使用者 BAT 佔用 → `EADDRINUSE`，非阻塞） | 子行程 env **剔除所有繼承的 `BAT_*` / `CT_*` / `ELECTRON_RUN_AS_NODE`**，並設 `BAT_REMOTE_PORT=<空閒埠>`（排除 9876 / 9877）；E3 / E4 斷言 `remote.serverStatus().port` 等於該埠 |
| 結束流程 | — | `before-quit` 會跳結束確認對話框（T0144，`main.ts:1863-1895`），Playwright 的 `app.close()` 會被卡住 | teardown 在 main 端 stub `dialog.showMessageBox` → `{ response: 1, checkboxChecked: true }`（走真實的「離開＋結束 Terminal Server」路徑）；20s 內沒關掉就 kill；殘留的 Terminal Server **只有在命令列吻合本 repo `dist-electron\terminal-server.js` 時**才 `taskkill`；最後刪除 runtime userData |

結論：做了以上處理後，不會連到或搶佔使用者 BAT 的 Terminal Server、RemoteServer 9876。四項都可以執行，不需要 SKIP。

**使用者 BAT（安裝版）前後比對**（PowerShell；01:19 開跑前 / 01:30 全部跑完後）：

| 項目 | 前 | 後 |
|------|----|----|
| `BetterAgentTerminal` 行程數 / 最早 PID | 6 / 16484 | 6 / 16484 |
| 主視窗數 | 1 | 1 |
| 安裝版 Terminal Server（`%APPDATA%\BetterAgentTerminal\bat-pty-server.pid`） | 33184，alive，建立於 01:04:18 | 33184，alive，建立於 01:04:18 |
| 9876 LISTEN | `127.0.0.1/16484` | `127.0.0.1/16484` |
| 33184 子行程數 | 6 | 4（剩 01:04:19 與 01:14:41 兩組 conhost+bash，即塔台與本 Worker 的分頁） |

- 子行程 6 → 4：少掉的那一組**不是本單造成的**。本單每一次 `taskkill` 都先比對命令列含本 repo 的 `node_modules\electron` / `dist-electron` 路徑，從未對 bash 或安裝版行程動手；推測是同時段收工的 T0396 Worker 分頁（`5fc3f78` T0396 verified）。塔台如需要可再對照
- 每次測試後都確認：本 repo `node_modules\electron` 行程 0 個、`%APPDATA%\*runtime-e2e*` 目錄 0 個
- 使用者原有的 `wsl.exe -d Ubuntu-24.04 -- sleep infinity`（parent 16484，01:04）未受影響；測試期間沒有新增遺留的 `wsl.exe`

### E1-E4 實跑結果

`npx vite build` exit 0 之後執行 `npx playwright test e2e/plan036-p0.spec.ts`：**4 passed (9.7s)**。之後 `npm run test:e2e` 全套又跑了一次，E1-E4 仍是 4/4 PASS。

| # | 結果 | 關鍵輸出 |
|---|------|---------|
| E1 `claude:abort-session` 綁定（T0392 / BUG-095） | ✅ PASS | `abortSession('e2e-plan036-no-such-session')` → `{"ok":true,"value":false}`（沒有 `No handler registered`）。加碼：`PROXIED_CHANNELS` 中的 **43 個 `claude:*`** 逐一比對 `ipcMain._invokeHandlers`，**未綁定 0 個** |
| E2 Terminal Server restart 不失聯（T0394 / BUG-101） | ✅ PASS | Terminal Server pid 34328、port 64281、命令列 `…\dist-electron\terminal-server.js`。用 `cmd.exe` 建 PTY → `set /a 1200+34` 輸出 1234 → `pty.restart` 回 true → 等 4s：**`pty:exit` 0 個、`getCwd` = `C:\Users\Gower`** → `set /a 5000+678` 輸出 5678，仍是 0 個 exit → `kill` 後收到 1 個 `pty:exit`（marker 由 shell 計算，指令回顯不會造成誤判） |
| E3 遠端 shell 清單依 targetOS（T0393） | ✅ PASS | 本機視窗：`auto,pwsh,powershell,cmd,git-bash,custom`；loopback `wsl-linux` 遠端視窗：**`auto,zsh,bash,sh,custom`**，不含 `pwsh` / `powershell` / `cmd` / `git-bash`，選項文字也沒有 Windows 路徑 / PowerShell / Command Prompt |
| E4 WSL 挑資料夾預設 + `/mnt/c` 提示（T0393） | ✅ PASS | main 端 stub `dialog.showOpenDialog` 記錄到 **`defaultPath = \\wsl.localhost\Ubuntu-24.04\home\gower`**（與測試端 `wsl -d Ubuntu-24.04 printenv HOME` 推得的值相符）；回傳 `C:\Users\Gower\AppData\Local\Temp\bat-e2e-t0393-*` 之後，遠端視窗顯示提示：「工作區「C:\…\bat-e2e-t0393-hjmvGG」位於 Windows 磁碟（在 WSL 內為 /mnt/c/Users/Gower/AppData/Local/Temp/bat-e2e-t0393-hjmvGG）。」 |

Skip 條件（本機都沒有觸發）：`dist-electron/` 缺檔 → 全部 skip；E3 非 win32 或沒有 WSL distro → skip；E4 沒有 WSL distro，或 temp 目錄不在磁碟代號上 → skip。distro 用 `wsl -l -q`（UTF-16LE）偵測，優先 `Ubuntu-24.04`，排除 `docker-desktop*`，並過 `/^[a-zA-Z0-9._-]+$/`。

**其他驗收閘門**

| 閘門 | 結果 | 證據 |
|------|------|------|
| `npx vite build` | ✅ PASS | exit 0 |
| `npm run test:e2e`（`a7b1f13` 之後，14 tests） | ⚠️ 5 passed / 8 skipped / **1 failed** | passed = E1-E4 + `bug075-bat-auto-session`；skipped = `server-bundle-distribution.spec.ts` 既有的 `test.skip` skeleton；failed = 主 repo 的 `e2e\smoke.spec.ts`（見遭遇問題 1） |
| `e2e/smoke.spec.ts` 單跑 | ❌ FAIL（既有問題） | `Test timeout of 60000ms exceeded` + `Worker teardown timeout` |
| `npm run test:unit` | ✅ PASS | **79 files / 1141 tests** 全綠（基線 1085；增加的部分來自期間已 commit 的平行工單，本單沒有新增 unit test） |
| `npx tsc --noEmit` | ✅ PASS | **40**（≤ 40）。根 tsconfig 不含 `e2e/`，另外以 `tsc --noEmit --strict --skipLibCheck … e2e/plan036-p0.spec.ts` 做單檔檢查 → exit 0 |

### 互動紀錄
- 01:22 塔台通知：`.kilo/worktrees/*` 的舊 spec 被 Playwright 收進來跑，已在 `a7b1f13` 修好 `playwright.config.ts` 的 `testIgnore`（34 → 14 tests）；要求重跑 e2e，`.kilo` 的 smoke 失敗可以忽略，不得修改 `playwright.config.ts`。→ 已重跑，確認 `--list` 為 14 tests 且沒有 `.kilo` 路徑；**但主 repo 自己的 smoke 也失敗**，與 `.kilo` 無關，診斷見下方

### Renew 歷程
無

### 遭遇問題

1. **`e2e/smoke.spec.ts` 既有失敗（不是本單造成，也不是產品回歸；建議塔台開單修 spec）**
   - 症狀：`Test timeout of 60000ms exceeded`、`Worker teardown timeout of 60000ms exceeded`
   - 診斷（在 scratchpad 用腳本逐步計時，沒有改 repo 檔）：launch 383ms，708ms 時已讀到 title `"Better Agent Terminal - Default"` —— **測試主體其實已經成功**。卡住的是 `finally` 裡的 `app.close()`：Playwright 送出 `app.quit()` → `before-quit` 跳出結束確認對話框（T0144，`main.ts:1863-1895`）→ 沒人回應，行程永遠不退出。把對話框 stub 成立即回應後（本單 `closeIsolated` 的做法），close 在 1s 內完成。T0394 回報也記錄過同樣的卡住現象
   - 副作用：每跑一次 smoke 都會**遺留一個 Terminal Server、一個 crashpad 行程和 runtime userData 目錄**（本次共跑了 3 次，都已依命令列比對後清除，殘留 0）
   - 另一個隱患：smoke 沒有剔除繼承的 `BAT_*` env，也沒有覆寫 `BAT_REMOTE_PORT`，在 BAT 內執行時會去 listen 9876（log：`RemoteServer auto-start failed on port 9876 … EADDRINUSE`）。這次是非阻塞，沒有影響使用者的 BAT，但屬於隔離缺口
   - 建議修法（屬於 `e2e/smoke.spec.ts`，不在本單 `affects_files` 內）：close 前先執行 `app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: true }) })`，並比照 `plan036-p0.spec.ts` 的 `isolatedEnv()` 剔除 `BAT_*`、設定 `BAT_REMOTE_PORT`。也可以把 `launchIsolated` / `closeIsolated` 抽到 `e2e/fixtures/` 共用
2. **E3 / E4 是 loopback 模擬，不是真的 WSL server**：遠端視窗連的是隔離 instance 自己（Windows）的 RemoteServer，`targetOS` / `wslDistro` 由 profile 宣告。驗證的是 T0393 的 client 端判斷（shell 清單、資料夾預設、提示），這正好是 T0393 的改動範圍；`wsl -d <distro> printenv HOME` 與 UNC 路徑則是真實的 WSL 呼叫。連真 WSL server 的端到端驗證仍需使用者實機操作（T0393 回報的「P0 實機驗收步驟」）
3. **E1 的 `PROXIED_CHANNELS` 全量檢查依賴 Electron 私有欄位 `ipcMain._invokeHandlers`**：Electron 41 有這個欄位；若未來版本拿掉，spec 會記 log 並略過該子檢查，主斷言 `abortSession` 不受影響
4. 觀察（不在本單範圍）：隔離 runtime 的語言預設顯示為繁中（E4 的提示是 zh-TW 文案）；spec 以 `/mnt/c/` 比對，不依賴語系

### Commit
- 單一 commit，`git commit --only` 只含 `e2e/plan036-p0.spec.ts` 與本工單；沒有 push；沒有 commit `e2e-results/`。hash 見 `git log`（回報區在 commit 前寫入，不自我引用）
- 沒有使用 stash / reset / checkout / restore；沒有碰 WSL `bat-server.service`；沒有送任何 Claude API 對話

### 回報時間
2026-10-05T01:33:07+08:00
