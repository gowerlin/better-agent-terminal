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

### ct-accept-act.mjs — 逐步操作（T0923）

CT 6.2.0 驗收（T0923）把 T0915 只放在 scratchpad 的逐步操作整理成一支腳本，同樣經 `ct610-driver.ts` 的 loopback 協定（狀態檔、secret），只動隔離的 app。

```powershell
node e2e/manual/ct-accept-act.mjs seed s1 S1 C:/Users/demo/accept/runs/S1   # 工作區（defaultAgent claude-cli、參數 --dangerously-skip-permissions）＋reload
node e2e/manual/ct-accept-act.mjs ids s1                                    # 分頁 id
node e2e/manual/ct-accept-act.mjs send s1 <id> C:/Users/demo/tmp/prompt.txt # 一次輸入＋Enter（中文長提示詞寫檔）
node e2e/manual/ct-accept-act.mjs type s1 <id> 'U-1、U-2：放棄 測試'        # 逐鍵手打＋Enter
node e2e/manual/ct-accept-act.mjs wait s1 <id> turn 600                      # 等回合：選單 → 0、結束 → 6
node e2e/manual/ct-accept-act.mjs key s1 <id> ArrowDown                      # 選單操作
node e2e/manual/ct-accept-act.mjs screen s1 <id> C:/Users/demo/accept/results/M-1/screen.txt
node e2e/manual/ct-accept-act.mjs inbox s1                                   # 待辦分頁 DOM 摘要
```

- `screen`：xterm 用 canvas renderer，DOM 沒有文字；腳本從 TerminalPanel 的 React fiber 取到該分頁的 xterm `Terminal`，讀 active buffer 可見的列（含 claude 的選單畫面）。
- `wait`：讀 host 的 `pty.attentionSnapshot`（claude hook 的 `busy` / `blockedReason`），`question` = AskUserQuestion 選單開著；權限詢問 exit `3`、逾時 `5`。需要分頁的 BAT hooks 正常。
- 指令與 exit code 見檔頭註解。

T0928（CT 6.2.0-pre.2 補跑）加了選單操作與 BUG-224 的實機驗證：

```powershell
node e2e/manual/ct-accept-act.mjs menu s5 <id>                 # 目前選單的編號選項與反白項（JSON）
node e2e/manual/ct-accept-act.mjs pick s5 <id> last            # 移到最後一個選項（內建「Type something.」之前）再 Enter
node e2e/manual/ct-accept-act.mjs pick s5 <id> A               # 移到文字以 A 開頭的選項再 Enter
node e2e/manual/ct-accept-act.mjs other s5 <id> '放棄 改天再說'  # 移到內建的自由輸入列，逐鍵輸入後 Enter
node e2e/manual/ct-accept-act.mjs fastesc s5 <id> 300          # 等選單：偵測到 question 後一畫出選單就送 Esc，印出時間差
```

- `pick` / `other` 從畫面讀選單（`❯ 1. …` 的編號列），移動後重讀畫面確認反白項才按 Enter；找不到選項 exit `1`。
- `fastesc`：每 20 ms 讀一次 attention，`question` 出現後每 10 ms 讀畫面，看到選單底部提示就以該分頁自己的鍵盤輸入（`terminal.input('\x1b', true)`，與按 Esc 走同一條 `onData` 路徑）送 Esc；輸出 `menuDrawnAfterQuestionMs` / `escAfterMenuMs` 等時間差。用來重現 BUG-224 的時序（選單出現後 < 0.2 s 按 Esc）。

T0939（CT 6.3.0-pre.1 驗收）在 `inbox` 的每一筆待決多印出：清單種類（`radiogroup` / `group+multi` / `free`）、「可複選」一行、各選項代號與輸入類型、所有「推薦」標記、目前勾選的代號、「其他」開或關、自由回答欄的放棄提示。待辦分頁的操作直接用驅動的 `click` / `fill`（`fill` 的參數是 `value`）：

```powershell
node e2e/manual/ct-accept-act.mjs ctl s1 '{"op":"click","selector":"[data-inbox-awaiting=\"U-1\"] [data-inbox-option-other] input"}'   # 「其他」
node e2e/manual/ct-accept-act.mjs ctl s1 '{"op":"click","selector":"[data-inbox-awaiting=\"U-1\"] [data-inbox-option=B] input"}'       # 勾 B
node e2e/manual/ct-accept-act.mjs ctl s1 '{"op":"click","selector":"[data-inbox-entry-buttons=\"U-1\"] button.primary"}'               # 送出
node e2e/manual/ct-accept-act.mjs ctl s1 '{"op":"click","selector":"[data-inbox-dismiss=\"U-5\"]"}'                                     # 放棄…
node e2e/manual/ct-accept-act.mjs ctl s1 '{"op":"fill","selector":"[data-inbox-dismiss-note=\"U-5\"]","value":"原因"}'
node e2e/manual/ct-accept-act.mjs ctl s1 '{"op":"click","selector":"[data-inbox-dismiss-send=\"U-5\"]"}'
```

- claude 2.1.331 的多選選單（`multiSelect`）：每個選項前是 `[ ]`，Enter 切換勾選；「Type something」也是有勾選框的一列，移到那裡直接逐鍵輸入就會勾上，可以和其他勾選並存；`Next` / `Submit` 是選項下方的一列，最後有「Review your answers」確認頁（`Submit answers`）。`menu` / `pick` 的解析把 `[ ]` / `[✔]` 當成選項文字的一部分。
- 多行訊息一次送出：以 xterm 的 `paste()`（bracketed paste）貼上再 Enter，claude 顯示 `[Pasted text #1 +N lines]`；`send` 的 `insert` 會把換行當 Enter。

### 已知限制

- AskUserQuestion 選單出現後立刻按 Esc（約 0.1 秒內）時，較晚到的 `PermissionRequest` hook 會在「使用者輸入清除」之後把分頁設回 `question`，直到下一次按鍵（T0923 回報區 BUG 建議，BUG-224）。`0.8.0-exp.2` 起已修（T0926）；測更早的版本時，驅動選單先等幾秒再按 Esc。
- claude 2.1.331 的塔台是全螢幕畫面（alt screen）：xterm 沒有 scrollback，捲動由 claude 自己處理；畫面文字只能從 PTY 擷取（TUI 重繪，閃爍的符號會洗掉尾端），判斷內容請以對話紀錄為準。
- 權限詢問：以 BAT 縮圖 `.attention-badge.blocked[data-blocked-reason=permission]` 判斷；claude 一次排隊多個權限詢問時只有第一個有 hook 事件（T0915 回報區），需另看對話紀錄中沒有結果的工具呼叫。
- 塔台分頁的輸入框草稿判斷（T0904 `draft`）看不到 claude 畫面內部。T0939 時用數字鍵關掉 claude 的意見調查列後，那一鍵被當成輸入框有字、待辦分頁的回答排進「📨 待送」；T0940（BUG-227）起 BAT 從輸出認得調查列（圖例），調查列出現 ≥ 1 s 後剛好按一個有效鍵就不算草稿。仍會保留的情況：調查列出現後 1 s 內按鍵、按鍵前先點了分頁、按了調查列不收的鍵、比 T0940 舊的 BAT（規則見 `docs/agent-guide/tower-inbox.md`「不進輸入框的按鍵」）。驅動在送出前仍應確認沒有待送，有就在空的輸入框按一次 Enter。

## t0955-v081-acceptance.ts / t0955-fake-claude.cs / t0955-fake-claude.mjs — 交付版 ⏻ / 塔台接回自動驗收（T0955）

以發佈的 zip 開一個隔離 BAT，用**假 claude**（不連模型、不花額度）一次跑完 A-19～A-23（BUG-228 / 229 / 230 / 231、T0950）與兩個反例，輸出 PASS / FAIL / 未判定與證據。不會被 `npm run test:*` 執行，只支援 Windows。

- **隔離**：`--runtime=e2e-t0955-<時間>`（獨立 userData、Terminal Server、remote port），子程序 env 去掉 `BAT_*` / `CT_*` 與 Claude Code session 的變數，`CLAUDE_CONFIG_DIR` 指向結果目錄。只結束自己啟動的程序（以 pid），不碰安裝版 BAT 與它的 userData；最後比對使用者層 `~/.claude` / `~/.codex` 設定檔雜湊（settings、CLAUDE.md、skills / agents / commands、plugins 清單、codex config / skills；session 紀錄由執行中的 Claude Code 寫入，不列入）與安裝版 BAT 的程序 pid 前後相同。
- **設定**：啟動前寫 runtime 的 `settings.json`：Shell = Git Bash、Claude Runtime = system、`customPath` = 假 `claude.exe`、`fallbackToEmbedded: false`（內嵌 claude 絕不啟動）、啟動更新檢查關閉。
- **假 claude**：BAT 的 system claude 偵測只收真的 `.exe`，所以腳本用 .NET Framework 的 `csc.exe` 把 `t0955-fake-claude.cs` 編到結果目錄。`--version` 回 `2.1.331 (Claude Code)`；在分頁內啟動時記錄 argv，主控台設成 VT 輸入 / 輸出（ConPTY 只在這個模式轉送滑鼠模式與 SGR 滑鼠回報），印 5 行標記＋60 行填充，參數有 `/control-tower` 就以分頁自己的 helper env 執行 `bat-terminal.mjs --set-role tower --bat-contract 2 --mode on`，再依 `control.json` 進全螢幕（`ESC[?1049h ESC[?1003h ESC[?1006h ESC[?25l`）或留在 normal buffer，stdin 每段以 base64 記錄。`t0955-fake-claude.mjs` 只做 meta / set-role / 回應驅動的 `bat_whoami`（stdio 都導向，不碰主控台）。
- **情境**：A-19 塔台分頁 argv 最後是 `/control-tower`、命令列有 `MSYS2_ARG_CONV_EXCL=`、log `[T0946]`；A-20 全螢幕＋滑鼠追蹤下按 ⏻，期間持續移動滑鼠、新 PTY 一出現就鍵入 `abc`，檢查新 claude 的 argv、stdin、沒有 `35;…M`、log `[mouse-tracking] reset: before-new-pty` 與保留輸入的 `[agent-command] … sent after it`；A-23 ⏻ 後 normal buffer、滾輪可捲回標記行、記錄游標；反例：一般 Claude CLI 分頁 ⏻ 不帶 `/control-tower`、一般 shell 分頁 ⏻ 後打字立即出現；A-21 保留 Terminal Server 結束 → 同 runtime 與同 port 重開 → Recovery「保留」→ log `[tower-role] restored:`、同一個假 claude 程序仍在、從該分頁查 `bat_whoami` 是 `role: tower` / 契約 2；A-22 同上選「重新開始」→ 塔台分頁重新帶 `/control-tower`、log `not restored`。

```powershell
# repo 根目錄，先 npm ci（驅動用 tsx 執行）
$env:BAT_E2E_EXECUTABLE='C:/Users/demo/AppData/Local/BAT-TestBuilds/0.8.1-pre.1-win/BetterAgentTerminal.exe'
$env:T0955_RESULTS='C:/Users/demo/AppData/Local/BAT-TestBuilds/T0955-results'
node node_modules/tsx/dist/cli.mjs e2e/manual/t0955-v081-acceptance.ts
```

- 選填：`T0955_GIT_BASH`（預設 `C:\Program Files\Git\bin\bash.exe`，不存在 → exit `2`）、`T0955_CSC`（預設 `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe`）。
- exit `0` = 全部 PASS、`1` = 有 FAIL / 未判定、`2` = 用法或環境錯誤。結果：`<T0955_RESULTS>/report-<時間>.json`，每次執行的 `run-<時間>/`（`driver.log`、假 claude 的 argv / stdin / meta、分頁輸出、遮罩過的 BAT 日誌、`tower-roles.json`、截圖）。結果目錄含本機路徑與使用者名稱，不要放進 repo。
- 已知限制：假 claude 不跑 BAT hooks，塔台縮圖會顯示 `🪝✕`（hooks `none (no-report)`），與本驗收項目無關；待辦分頁在預設版面沒有渲染時，A-21 以 helper 查詢與日誌判定。
- `auth status`（T0959 起，選用）：`control.json` 有 `"authStatus": "loggedOut"` 時，假 claude 對 `auth status` 印出 `{"loggedIn": false, …}` 並 exit `1`（同 claude 未登入時），讓 Claude Agent 面板顯示「未登入」導引；沒有這個鍵時行為與 T0955 相同。

## t0959-v081-pre2-acceptance.ts — ⏻ 後游標（BUG-233）與登入導引分頁的命令前輸入（BUG-232）自動驗收（T0959）

沿用 T0955 的隔離方式與假 claude，以發佈的 zip 開兩個隔離 BAT（各自 `--runtime=e2e-t0959-<階段>-<時間>`），輸出 PASS / FAIL / 未判定與證據。R0（T0955 全套）另以 `t0955-v081-acceptance.ts` 對同一個 exe 執行。不會被 `npm run test:*` 執行，只支援 Windows。

- **wsl 階段**（Settings → Shell = 自訂 `wsl.exe`，只開使用者預設 distro 的 shell，不安裝、不設定、不寫入 distro；沒有 `wsl.exe` → B233 未判定）：先對閒置 shell 按 ⏻（對照：沒有 `cursor shown` / `cursor state unknown` 日誌），再打 `printf '\033[?1049h\033[?25l'; sleep 6007`（游標隱藏且程式仍在跑）後按 ⏻ → 新 shell 的 xterm `isCursorHidden=false`、normal buffer、log `[mouse-tracking] cursor shown: new-pty-spawned`，並記錄新 shell 自己的輸出是否含 `ESC[?25h`。
- **git 階段**（Shell = Git Bash，假 claude 的 `auth status` 回未登入）：同樣的隱藏游標 ⏻（不回歸：游標看得到）與閒置 ⏻；B232-login：「+」→ Claude Agent → 面板顯示「未登入」導引 → 按開啟終端 → 新 PTY 一出現就鍵入 `abc` → 輸入列是 `<cli> auth login` 在前、`abc` 在後，假 claude 沒有被執行（沒有 Enter），log 有 `[agent-command] … input before the launch command … sent after it`；對照：再開一次不打字 → 只有命令、沒有保留紀錄。
- **B232-install** 需要遠端 profile 視窗；本機能取得的方式（WSL 精靈、手動在 distro 跑 bat-server）與安裝動作本身都會改動使用者的 WSL，所以固定記「未判定」。
- **隔離**：同 T0955，另把安裝版 BAT 的程序分成核心（`BetterAgentTerminal.exe` / `bat-pty-holder.exe`，pid 前後必須相同）與 agent 端子程序（使用者分頁裡的 claude / node / hooks，會隨使用者操作增減，只記錄）；收尾只結束自己的殘留（假 claude、Git Bash `sleep 6008`，以及 WSL 內 `sleep 6007`，皆以 pid），並記在 `driver.log` 的 `ended leftover`。
- **已知限制**：Windows 上 WSL 分頁仍經 ConPTY，⏻ 後新的 ConPTY 自己會送 `ESC[?25l` … `ESC[?25h`，所以即使沒有 T0957 的修正游標也看得到；本驗收能確認修正路徑有執行且不回歸，原 bug（PTY 在非 Windows 主機）要在遠端 profile 視窗驗證。

```powershell
# repo 根目錄，先 npm ci（驅動用 tsx 執行）
$env:BAT_E2E_EXECUTABLE='C:/Users/demo/AppData/Local/BAT-TestBuilds/0.8.1-pre.2-win/BetterAgentTerminal.exe'
$env:T0959_RESULTS='C:/Users/demo/AppData/Local/BAT-TestBuilds/T0959-results'
node node_modules/tsx/dist/cli.mjs e2e/manual/t0959-v081-pre2-acceptance.ts
```

- 選填：`T0959_WSL`（預設 `%WINDIR%\System32\wsl.exe`）、`T0959_GIT_BASH`（預設 `C:\Program Files\Git\bin\bash.exe`）、`T0959_CSC`。
- exit `0` = 可判定的項目全部 PASS（B232-install 固定未判定、不影響 exit）、`1` = 有 FAIL 或其他未判定、`2` = 用法或環境錯誤。結果：`<T0959_RESULTS>/report-<時間>.json` 與 `run-<時間>/`（`driver.log`、兩個階段遮罩過的 BAT 日誌 `logs-wsl/` / `logs-git/`、分頁輸出、截圖）。結果目錄含本機路徑，不要放進 repo。
