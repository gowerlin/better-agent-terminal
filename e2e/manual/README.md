# e2e/manual — 手動執行的驗收腳本

這個目錄的腳本不是 Playwright 測試（`playwright.config.ts` 的 `testMatch` 只收 `e2e/**/*.spec.ts`），也不會被 `npm run test:*` 執行。它們會動到本機安裝、需要先關閉 BAT，或要驅動真的 claude，必須手動執行。

## nsis-reinstall-acceptance.ps1 — Windows NSIS 覆蓋安裝 / 解除安裝 / 乾淨重裝（T0740）

對應 CLAUDE.md「Packaging / Release 前置檢查」的 **Release 驗收必跑 NSIS 完整重裝**。一次跑完下列步驟，並輸出報告：

| 步驟 | 內容 |
|---|---|
| ⓪ 前置檢查 | 從 uninstall 鍵判斷安裝範圍（HKLM = 所有使用者、HKCU = 目前使用者）、安裝路徑與版本；列出從安裝目錄執行的程序，有就中止；備份 `%APPDATA%\BetterAgentTerminal*` 並對每個檔案取 SHA-256 快照 |
| ① 安裝檔 | `gh release download v<版號>`，以 GitHub 計算的 asset digest（sha256）與大小驗證（release 沒有上傳 `latest.yml`），另記錄 sha512 |
| ② 覆蓋安裝 | 同版本靜默安裝（`/S /allusers` 或 `/currentuser`，`/D=<原路徑>`），計時；檢查 uninstall 鍵版本、主程式版本、`resources/package.json`、3 個 helper `--version`、內嵌 claude / codex、捷徑、userData 沒有變動 |
| ③ 解除安裝 | 靜默解除安裝，計時；檢查 uninstall 鍵、安裝目錄、捷徑都已移除，userData 保留且沒有變動（只容許 debug log 新增 / 輪替，見下方「判讀注意」）；解除安裝前（② 裝上）的版本有 PTY holder 時，另查當時執行中的 holder 已結束、holder 根目錄已移除 |
| ④ 乾淨重裝 | 參數與檢查同 ②；userData 改與 ③ 結束時的快照比對（T0869），完全相同才通過 |
| ⑤ 啟動檢查（選做） | 加 `-LaunchCheck`：啟動 BAT 10 秒後關閉，檢查新的 debug log 沒有 `uncaughtException` / `unhandledRejection`（BAT 會還原上次的工作區與分頁） |
| ⑥ 報告 | `%TEMP%\bat-nsis-acceptance-<YYYYMMDD-HHMMSS>\report.md` 與 `report.json` |

任何一步失敗就停下、寫報告，並印出以備份還原 userData 與重新安裝的指令，不繼續後面的步驟。

### 執行步驟

1. **完全關閉 BAT**：關掉所有 BAT 視窗。BAT 結束時會一併關閉 Terminal Server。
2. **確認 BAT 相關程序都已結束**：開工作管理員，確認沒有 `BetterAgentTerminal.exe`。也可以在 PowerShell 執行下面的指令，沒有任何輸出才算結束：

   ```powershell
   Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like "*\BetterAgentTerminal\*" } | Select-Object Name, ProcessId
   ```

3. **開一般 PowerShell**（不要在 BAT 分頁裡開）。BAT 裝在所有使用者（預設 `C:\Program Files\BetterAgentTerminal`）時，要用「以系統管理員身分執行」開啟；腳本不會自動要求提權，權限不足時會在 ⓪ 中止並說明。
4. **切到 repo 根目錄，先演練一次**（只做唯讀檢查並下載安裝檔，不改任何東西）。`<版號>` 換成要驗收的版號（GitHub release tag 去掉 `v`，例 tag `v0.7.4-pre.2` → `-Version 0.7.4-pre.2`）：

   ```powershell
   pwsh -NoProfile -ExecutionPolicy Bypass -File e2e\manual\nsis-reinstall-acceptance.ps1 -Version <版號> -DryRun
   ```

   🔴 `-Version` 必填（T0801），演練與實際執行都要帶：沒帶或格式不對時，腳本在建立輸出目錄、下載、備份、安裝之前就以 exit `2` 結束並印出用法（T0801 前預設 `0.7.2-pre.8`，漏帶會驗收到舊版）。

   沒有 PowerShell 7 時，把 `pwsh` 換成 `powershell`（Windows PowerShell 5.1）。

5. **實際執行**。已經有下載好的安裝檔時（例如演練時下載的），用 `-InstallerPath` 重用，省掉下載：

   ```powershell
   pwsh -NoProfile -ExecutionPolicy Bypass -File e2e\manual\nsis-reinstall-acceptance.ps1 -Version <版號> -InstallerPath "<安裝檔路徑>"
   ```

   不帶 `-InstallerPath` 會先下載（需要已登入的 `gh`）。要一併做 ⑤ 時加 `-LaunchCheck`。
6. **重開 BAT**，把腳本最後印出的報告路徑（`report.md`）告訴塔台。
7. 塔台判讀完後，刪除報告目錄裡的 `userdata-backup\`：它是 userData 的完整副本，含 `server-token.json` 等權杖檔。

### 參數

| 參數 | 說明 |
|---|---|
| `-Version` | **必填**（T0801）：要驗的版本，格式 `X.Y.Z` 或 `X.Y.Z-pre.N`（不加 `v`；下載 `v<版號>` 的 `BetterAgentTerminal.Setup.<版號>.exe`）。沒有預設值，不會自動取最新 release；沒帶或格式不對 → exit `2`、印出用法、不做任何事 |
| `-InstallerPath` | 使用已下載的安裝檔；仍以 `gh release view` 的 digest 驗證 |
| `-ExpectedSha256` | 沒有 `gh` 時手動提供預期的 SHA-256 |
| `-DryRun` | 只做唯讀檢查、下載並驗證安裝檔，印出每一步將執行的指令與判讀規則；另外用 ② 的檢查讀一次目前的安裝，確認檢查本身可用 |
| `-StopRunning` | ⓪ 發現 BAT 程序時，輸入 `STOP` 確認後先嘗試正常關閉、15 秒後強制結束程序樹。預設不結束任何程序 |
| `-LaunchCheck` | 執行 ⑤ |
| `-Scope` | `Auto`（預設，依 uninstall 鍵判斷）/ `AllUsers` / `CurrentUser`；兩個範圍都有安裝紀錄時必須指定 |
| `-OutputRoot` | 報告目錄的上層，預設 `%TEMP%` |
| `-InstallTimeoutSec` / `-UninstallTimeoutSec` | 安裝耗時的警告門檻（預設 900 s）/ 等待解除安裝完成的上限（預設 600 s） |

### 判讀注意

- 結束代碼：`0` = PASS、`PASS-WITH-WARN` 或演練；`1` = 有步驟 FAIL；`2` = 用法錯誤（沒帶 `-Version` 或格式不對，什麼都沒做、沒有報告目錄；T0801）。
- 解除安裝程式會先把自己複製到 `%TEMP%` 再執行，原本的程序會馬上結束；腳本等到 uninstall 鍵與安裝目錄都消失，才算解除安裝完成，所以 ③ 的耗時包含這段等待。
- 在 BAT 分頁內執行時，⓪ 會偵測到 BAT 的環境變數：演練只記 WARN，實際模式直接中止。
- helper `--version` 檢查不會寫入 userData（T0745）：helper 一啟動就 append 一筆到 `bat-scripts.log`，在 BAT 外執行時預設落在 `%APPDATA%\BetterAgentTerminal\Logs\`，會被 ② / ④ 的 userData 比對判成「變更 1 檔」。腳本只在執行 helper 的子程序期間設 `BAT_HELPER_LOG_DIR=<報告目錄>\helper-logs`（`scripts/_bat-logger.mjs` 的第一優先），helper 的紀錄寫在報告目錄的 `helper-logs\bat-scripts.log`。userData 比對規則不變：`Logs\bat-scripts.log` 仍有變更就是 FAIL，代表驗收期間有其他程式寫入（例如 BAT 沒有完全關閉）。
- ③ 的 userData 比對容許 debug log 新增 / 輪替（T0868 / D292）：真的解除安裝時，解除安裝程式啟動 `BetterAgentTerminal.exe --uninstall-quit-request`（T0860，沒有 BAT 在跑也會送，用來停 holder），這個程序建立一份 debug log，並依「保留最近 10 個」刪掉修改時間最舊的一份。只有 ③、只有 `BetterAgentTerminal\Logs\debug-*.log`（不含子目錄與其他 userData 目錄）、新增 ≤ 1 份、因輪替刪除 ≤ 1 份且是 ⓪ 時修改時間最舊的那份才判 PASS，報告逐檔加說明；⓪ 沒有被刪那份的修改時間時判 WARN。其他任何差異（`Logs` 內其他檔、`bat-scripts*.log`、settings、權杖檔、debug log 內容變更）仍判 FAIL。② / ④ 的規則不變（完全相同才 PASS）。
- ④ 的 userData 基準是 ③ 結束時的快照（T0869 / D293）：③ 的 userData 判讀為 PASS / WARN 時保存判讀用的那份快照，④ 與它比對，所以 ③ 已容許的 debug log 新增 / 輪替不會在 ④ 再算一次；④ 期間 userData 有任何差異仍判 FAIL。取不到 ③ 的快照（③ 沒有跑到 userData 比對）時退回與 ⓪ 的快照比對，報告加說明。② 仍與 ⓪ 的快照比對。
- ③ 的 PTY holder 檢查依解除安裝前的版本（實際模式 = ② 裝上的版本），不是 ⓪ 時的版本：⓪ 是沒有 holder 的舊版、② 裝上有 holder 的版本時，③ 照樣檢查（T0868）。
- `-Version` 與目前安裝的版本相同時，② 才是真正的同版本覆蓋，⓪「目前安裝版本」為 PASS；版本不同時 ⓪ 記 WARN，② 實際上是升級或降級。例如已裝 0.7.2-pre.9 時重跑，帶 `-Version 0.7.2-pre.9`（可用 `-InstallerPath` 重用上次下載的安裝檔）。

## ct610-driver.ts / ct610-ctl.mjs / ct610-transcript.mjs — 以 Playwright 驅動隔離 BAT 跑真 claude 塔台（T0915）

CT 6.1.0 驗收清單 M-C1–M-C7（PLAN-068 契約 v2 的實機項目）用的互動式驅動。真的 claude 每次回答不同，所以不寫成一次跑完的測試：驅動啟動**一個**隔離的 BAT 後在 loopback HTTP 等指令，每一步由人（或 agent）用 `ct610-ctl.mjs` 送出、看完結果再決定下一步。不會被 `npm run test:*` 執行，不碰使用者的安裝版 BAT 與它的 userData / Terminal Server。

- **啟動方式**：`e2e/fixtures/electron-isolation.ts` 的 `launchIsolated`＋`BAT_E2E_EXECUTABLE`（打包版 exe，例如 zip 測試版），`--runtime=e2e-<名稱>-<時間>`。子程序 env 去掉 `BAT_*` / `CT_*`（fixture 既有）以及本機 Claude Code session 的變數（`CLAUDECODE`、`CLAUDE_CODE_*`、`CLAUDE_PID`、`CLAUDE_EFFORT`、`CLAUDE_PLUGIN_*`，`launchIsolated` 的 opt-in `dropEnv`），加上 `CLAUDE_CONFIG_DIR`，所以 BAT 開的塔台與它派出的 Worker 都用測試用的 claude 設定目錄。
- **安全**：只聽 `127.0.0.1`，每個請求要帶狀態檔裡的隨機 secret（header `x-ct610-secret`），結束時刪除狀態檔。擷取的終端輸出與日誌會遮罩 `batcap.*` 權杖與 `BAT_REMOTE_TOKEN` 的值。

### 環境變數（路徑一律由 env 提供）

| 變數 | 說明 |
|---|---|
| `BAT_E2E_EXECUTABLE` | 必填：要測的 `BetterAgentTerminal.exe` |
| `CT610_CONFIG_DIR` | 必填：給 BAT 內所有 claude 的 `CLAUDE_CONFIG_DIR` |
| `CT610_NAME` | 必填：runtime 名稱（`[a-zA-Z0-9._-]+`），也是 `ct610-ctl.mjs` 的第一個參數 |
| `CT610_LOG` | 必填：驅動把每個指令與結果摘要附加寫進這個檔 |
| `CT610_STATE_DIR` | 選填：狀態檔（port / secret）的目錄，預設 `os.tmpdir()` |
| `CT610_KEEP_USERDATA` | 選填：`1` = 結束時保留 runtime userData（預設刪除；要留日誌先用 `copyLogs`） |

### 執行

```powershell
# repo 根目錄，先 npm ci（驅動用 tsx 執行）
$env:BAT_E2E_EXECUTABLE='C:/Users/demo/BAT-TestBuilds/0.0.0-exp.20-win/BetterAgentTerminal.exe'
$env:CT610_CONFIG_DIR='C:/Users/demo/accept/claude-config'
$env:CT610_NAME='mc7'
$env:CT610_LOG='C:/Users/demo/accept/results/driver-mc7.log'
node node_modules/tsx/dist/cli.mjs e2e/manual/ct610-driver.ts     # 印出 CT610 DRIVER READY 後保持執行
```

另開一個 shell 送指令（JSON 一行，或 `@檔案`；中文與長內容建議寫檔再用 `@`）：

```powershell
node e2e/manual/ct610-ctl.mjs mc7 '{"op":"ping"}'
node e2e/manual/ct610-ctl.mjs mc7 '{"op":"click","selector":".workspace-container.active .thumbnail-add-btn"}'
node e2e/manual/ct610-ctl.mjs mc7 '{"op":"click","selector":".thumbnail-add-menu-item","hasText":"以塔台開啟 Claude"}'
node e2e/manual/ct610-ctl.mjs mc7 @C:/Users/demo/tmp/type-control-tower.json
node e2e/manual/ct610-ctl.mjs mc7 '{"op":"quit"}'
```

exit `0` = 指令成功、`1` = 指令失敗（印出錯誤）、`2` = 用法錯誤或驅動沒在跑。

### 指令（`op`）

| op | 參數 | 說明 |
|---|---|---|
| `ping` | — | runtime id、userData、remote port、目前 URL |
| `eval` / `evalMain` | `js`（async 函式本體） | 在 renderer / 主行程執行並回傳結果（主行程可用 `electron`） |
| `reload` | — | 重新載入 renderer 並重裝輸出擷取（Terminal Server 有存活 PTY 時 BAT 會跳 Recovery 提示） |
| `type` / `insert` / `press` | `text` / `text` / `key` | 鍵盤輸入到目前焦點（xterm 要先 `click` 它的 `.xterm-screen`） |
| `click` / `hover` / `fill` / `check` | `selector`、選填 `nth`、`hasText`、`position` | Playwright locator 操作 |
| `wheel` | `selector`、`dy`、`steps` | 在元素中心捲動滑鼠滾輪 |
| `count` / `text` / `attrs` | `selector` | 讀 DOM（`attrs` 回傳屬性與前 300 字） |
| `waitFor` | `selector`、`state`、`timeout` | 等元素出現 / 消失 |
| `shot` | `path` | 截圖 |
| `out` / `outMark` / `outSince` | `id`、`path`、`from`、`tail` | 啟動後擷取的 PTY 輸出（`pty.onOutput`）；`out` 帶 `path` 時寫去 ANSI 版與 `.raw` 原始版 |
| `grepLog` / `copyLogs` | `re` / `dest` | 搜尋或複製 runtime 的 `Logs/`（debug log、bat-scripts.log） |
| `wait` | `ms` | 等待 |
| `quit` | — | 以 `closeIsolated` 關閉（回答結束確認、停 Terminal Server）並結束驅動 |

### ct610-transcript.mjs

把 claude 的對話紀錄（`<CLAUDE_CONFIG_DIR>/projects/<專案>/<session>.jsonl`）轉成純文字：使用者訊息、助理文字、每個工具呼叫（Bash / PowerShell 指令全文）與結果。`--grep <regex>` 只留指令符合的工具呼叫與結果（例 `--grep "set-role tower"` 取 `--set-role` 那幾次）。

```powershell
node e2e/manual/ct610-transcript.mjs <session.jsonl> <out.txt> [--grep <regex>]
```

### 已知限制

- claude 2.1.331 的塔台是全螢幕畫面（alt screen）：xterm 沒有 scrollback，捲動由 claude 自己處理；畫面文字只能從 PTY 擷取（TUI 重繪，閃爍的符號會洗掉尾端），判斷內容請以對話紀錄為準。
- 權限詢問：以 BAT 縮圖 `.attention-badge.blocked[data-blocked-reason=permission]` 判斷；claude 一次排隊多個權限詢問時只有第一個有 hook 事件（T0915 回報區），需另看對話紀錄中沒有結果的工具呼叫。
