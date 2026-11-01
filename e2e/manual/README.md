# e2e/manual — 手動執行的驗收腳本

這個目錄的腳本不是 Playwright 測試（`playwright.config.ts` 的 `testMatch` 只收 `e2e/**/*.spec.ts`），也不會被 `npm run test:*` 執行。它們會動到本機安裝或需要先關閉 BAT，必須由使用者手動執行。

## nsis-reinstall-acceptance.ps1 — Windows NSIS 覆蓋安裝 / 解除安裝 / 乾淨重裝（T0740）

對應 CLAUDE.md「Packaging / Release 前置檢查」的 **Release 驗收必跑 NSIS 完整重裝**。一次跑完下列步驟，並輸出報告：

| 步驟 | 內容 |
|---|---|
| ⓪ 前置檢查 | 從 uninstall 鍵判斷安裝範圍（HKLM = 所有使用者、HKCU = 目前使用者）、安裝路徑與版本；列出從安裝目錄執行的程序，有就中止；備份 `%APPDATA%\BetterAgentTerminal*` 並對每個檔案取 SHA-256 快照 |
| ① 安裝檔 | `gh release download v<版號>`，以 GitHub 計算的 asset digest（sha256）與大小驗證（release 沒有上傳 `latest.yml`），另記錄 sha512 |
| ② 覆蓋安裝 | 同版本靜默安裝（`/S /allusers` 或 `/currentuser`，`/D=<原路徑>`），計時；檢查 uninstall 鍵版本、主程式版本、`resources/package.json`、3 個 helper `--version`、內嵌 claude / codex、捷徑、userData 沒有變動 |
| ③ 解除安裝 | 靜默解除安裝，計時；檢查 uninstall 鍵、安裝目錄、捷徑都已移除，userData 保留且沒有變動 |
| ④ 乾淨重裝 | 參數與檢查同 ② |
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
4. **切到 repo 根目錄，先演練一次**（只做唯讀檢查並下載安裝檔，不改任何東西）：

   ```powershell
   pwsh -NoProfile -ExecutionPolicy Bypass -File e2e\manual\nsis-reinstall-acceptance.ps1 -DryRun
   ```

   沒有 PowerShell 7 時，把 `pwsh` 換成 `powershell`（Windows PowerShell 5.1）。

5. **實際執行**。已經有下載好的安裝檔時（例如演練時下載的），用 `-InstallerPath` 重用，省掉下載：

   ```powershell
   pwsh -NoProfile -ExecutionPolicy Bypass -File e2e\manual\nsis-reinstall-acceptance.ps1 -InstallerPath "<安裝檔路徑>"
   ```

   不帶 `-InstallerPath` 會先下載（需要已登入的 `gh`）。要一併做 ⑤ 時加 `-LaunchCheck`。
6. **重開 BAT**，把腳本最後印出的報告路徑（`report.md`）告訴塔台。
7. 塔台判讀完後，刪除報告目錄裡的 `userdata-backup\`：它是 userData 的完整副本，含 `server-token.json` 等權杖檔。

### 參數

| 參數 | 說明 |
|---|---|
| `-Version` | 要驗的版本，預設 `0.7.2-pre.8`（下載 `v<版號>` 的 `BetterAgentTerminal.Setup.<版號>.exe`） |
| `-InstallerPath` | 使用已下載的安裝檔；仍以 `gh release view` 的 digest 驗證 |
| `-ExpectedSha256` | 沒有 `gh` 時手動提供預期的 SHA-256 |
| `-DryRun` | 只做唯讀檢查、下載並驗證安裝檔，印出每一步將執行的指令與判讀規則；另外用 ② 的檢查讀一次目前的安裝，確認檢查本身可用 |
| `-StopRunning` | ⓪ 發現 BAT 程序時，輸入 `STOP` 確認後先嘗試正常關閉、15 秒後強制結束程序樹。預設不結束任何程序 |
| `-LaunchCheck` | 執行 ⑤ |
| `-Scope` | `Auto`（預設，依 uninstall 鍵判斷）/ `AllUsers` / `CurrentUser`；兩個範圍都有安裝紀錄時必須指定 |
| `-OutputRoot` | 報告目錄的上層，預設 `%TEMP%` |
| `-InstallTimeoutSec` / `-UninstallTimeoutSec` | 安裝耗時的警告門檻（預設 900 s）/ 等待解除安裝完成的上限（預設 600 s） |

### 判讀注意

- 結束代碼：`0` = PASS、`PASS-WITH-WARN` 或演練；`1` = 有步驟 FAIL。
- 解除安裝程式會先把自己複製到 `%TEMP%` 再執行，原本的程序會馬上結束；腳本等到 uninstall 鍵與安裝目錄都消失，才算解除安裝完成，所以 ③ 的耗時包含這段等待。
- 在 BAT 分頁內執行時，⓪ 會偵測到 BAT 的環境變數：演練只記 WARN，實際模式直接中止。
- helper `--version` 檢查不會寫入 userData（T0745）：helper 一啟動就 append 一筆到 `bat-scripts.log`，在 BAT 外執行時預設落在 `%APPDATA%\BetterAgentTerminal\Logs\`，會被 ② / ④ 的 userData 比對判成「變更 1 檔」。腳本只在執行 helper 的子程序期間設 `BAT_HELPER_LOG_DIR=<報告目錄>\helper-logs`（`scripts/_bat-logger.mjs` 的第一優先），helper 的紀錄寫在報告目錄的 `helper-logs\bat-scripts.log`。userData 比對規則不變：`Logs\bat-scripts.log` 仍有變更就是 FAIL，代表驗收期間有其他程式寫入（例如 BAT 沒有完全關閉）。
- `-Version` 與目前安裝的版本相同時，② 才是真正的同版本覆蓋，⓪「目前安裝版本」為 PASS；版本不同時 ⓪ 記 WARN，② 實際上是升級或降級。例如已裝 0.7.2-pre.9 時重跑，帶 `-Version 0.7.2-pre.9`（可用 `-InstallerPath` 重用上次下載的安裝檔）。
