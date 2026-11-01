---
schema_version: 1
schema_kind: workorder
id: T0740
title: "NSIS 覆蓋安裝 / 解除安裝 / 乾淨重裝的獨立驗收腳本（以 v0.7.2-pre.8 安裝檔在本機驗；本單只寫腳本並跑不安裝的演練，實際執行由使用者關閉 BAT 後進行）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T17:35:39+0800"
started_at: "2026-11-01T17:37:16+0800"
updated_at: "2026-11-01T17:46:21+0800"
completed_at: "2026-11-01T17:46:21+0800"
depends_on: []
related:
  - "T0726 / D196（NSIS 關差分打包，exe 292.9 MiB）；CLAUDE.md「Packaging / Release 前置檢查」（**Release 驗收必跑 NSIS 完整重裝**）；`docs/agent-guide/packaging-release-checks.md`"
  - "`package.json` `build.nsis`：`oneClick: false`、`perMachine: false`、`allowToChangeInstallationDirectory: true`；本機目前安裝在 `C:\\Program Files\\BetterAgentTerminal`（helper `--version` = `v0.7.2-pre.8`）"
  - "GitHub release `v0.7.2-pre.8`（`gh release view v0.7.2-pre.8 -R gowerlin/better-agent-terminal`）"
affects_files:
  - "e2e/manual/nsis-reinstall-acceptance.ps1（新增，檔名可調；不在 Playwright `testMatch` 範圍）"
  - "e2e/manual/README.md（新增或補一段：用途、執行前提、步驟、輸出位置）"
  - docs/agent-guide/packaging-release-checks.md
  - _ct-workorders/T0740-nsis-reinstall-acceptance-script.md
session_ids:
  - "35df77cc-9185-43ea-94f1-012167f55676"
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 本單 Worker 自己就在 BAT 分頁內執行：🔴 絕對不得實際執行安裝檔、解除安裝程式，不得結束任何 BetterAgentTerminal / node / Terminal Server 程序，不得改動 `C:\\Program Files\\BetterAgentTerminal` 與使用者 userData。只允許：寫腳本、下載安裝檔到暫存目錄、跑腳本的 `-DryRun`（只做唯讀檢查並印出將執行的步驟）。"
  - "🔴 腳本流程（實際模式，由使用者關閉 BAT 後在一般 PowerShell 執行）：⓪ 前置檢查：找出安裝狀態（登錄檔 uninstall 鍵在 HKLM 還是 HKCU、`InstallLocation`、`DisplayVersion`）；列出所有執行檔位於安裝目錄的程序（含 Terminal Server 的 node / 內嵌 claude / codex）→ 有任何一個就中止並列出（不自動結束，除非帶 `-StopRunning` 且再次確認）；userData（`%APPDATA%\\BetterAgentTerminal*`）先備份到時間戳目錄並記錄路徑。① 下載 `v0.7.2-pre.8` 的 Windows 安裝檔（`gh release download … -R gowerlin/better-agent-terminal`），以 release 內 `latest.yml` 的 sha512 驗證。② 覆蓋安裝（同版本）：依 ⓪ 的安裝範圍帶 `/S` ＋ `/allusers` 或 `/currentuser` ＋ `/D=<原路徑>`（electron-builder NSIS 參數，以文件 / 實測為準），計時；檢查 `DisplayVersion`、主程式與 `resources/scripts` 三個 helper `--version`、`resources/package.json`、內嵌 claude / codex 存在；userData 未被改動（設定檔雜湊比對）。③ 解除安裝（靜默）：計時；安裝目錄與 uninstall 鍵已移除、捷徑已移除、userData 保留。④ 乾淨重裝：同 ② 參數，計時，同 ② 檢查。⑤ 選做：啟動已安裝的 BAT 10 秒後正常關閉，檢查新的 debug log 沒有 `uncaughtException`。⑥ 輸出：一份 Markdown ＋ 一份 JSON（每步 PASS / FAIL、耗時、版本、檢查明細），寫到 `%TEMP%\\bat-nsis-acceptance-<YYYYMMDD-HHMMSS>\\`，並印出路徑。任何一步失敗：停下、寫報告、印出如何以備份還原 userData 與重新安裝的指令，不繼續後面步驟。"
  - "🔴 腳本規範：PowerShell 7 與 Windows PowerShell 5.1 都能跑（或在開頭檢查並說明）；`Set-StrictMode`、錯誤即停；所有時間取自系統；不寫入或印出任何權杖 / 認證；需要 UAC 時明確提示使用者。`-DryRun` 印出每一步將執行的指令與判讀規則，不改任何東西。不得修改 `package.json` / `build` 設定 / 產品程式碼。"
  - "🔴 演練（本單要做）：在本機以 `-DryRun` 跑一次，回報 ⓪ 的實際偵測結果（安裝範圍、路徑、版本、偵測到的執行中程序數 —— 現在 BAT 正在跑，預期會偵測到並示範『會中止』）、① 下載與 sha512 驗證結果、②–④ 將使用的實際參數。下載的安裝檔留在暫存目錄供使用者實跑時重用（腳本支援 `-InstallerPath`），路徑寫進回報區。"
  - "🔴 文件：`e2e/manual/README.md` 寫給使用者看的步驟（關閉 BAT → 確認 Terminal Server 也已結束 → 開一般 PowerShell → 執行指令 → 重開 BAT → 把報告路徑告訴塔台）；`docs/agent-guide/packaging-release-checks.md` 的 NSIS 重裝驗收段補一行指向腳本。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，腳本與文件不得寫死使用者家目錄或帳號（一律用環境變數）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0740 — NSIS 重裝驗收腳本

## 元資料

- **工單編號**：T0740
- **類型**：implementation（驗收工具）
- **優先級**：P2
- **建立時間**：2026-11-01T17:35:39+0800
- **預估規模**：M

## 背景

pre.6（T0726，NSIS 關差分打包）待驗 Windows NSIS 覆蓋安裝 / 解除安裝 / 乾淨重裝與安裝時間。本機沒有 Windows Sandbox；使用者要求直接以最新版（`v0.7.2-pre.8`）在本機驗。唯一的阻礙是安裝 / 解除安裝前 BAT 必須關閉，而塔台與 Worker 都在 BAT 內。因此本單寫一支獨立腳本：Worker 只做不安裝的演練；使用者關閉 BAT 後在一般 PowerShell 執行一次，自動完成全部步驟並輸出報告，重開 BAT 後交塔台判讀。

## 範圍

1. 腳本（⓪–⑥，含 `-DryRun`、`-InstallerPath`、`-StopRunning`）。
2. 本機 `-DryRun` 演練與下載驗證。
3. 使用說明與 docs 一行。

## 不做

- 不實際安裝 / 解除安裝、不結束任何 BAT 相關程序、不動安裝目錄與 userData。
- 不改打包設定與產品程式碼。

## 驗收

- [x] 腳本完成，`-DryRun` 在本機跑過，⓪ 偵測結果正確、示範偵測到執行中程序會中止
- [x] 安裝檔已下載並通過雜湊驗證，路徑寫在回報區（release 沒有 `latest.yml`，改以 GitHub asset digest 的 sha256 驗證，另記 sha512；見〈發現的問題〉1）
- [x] ②–④ 實際參數列出（含安裝範圍判斷依據）
- [x] 使用說明（給使用者的步驟）

---

## 回報區

### 完成狀態

- **狀態**：DONE（Worker 範圍：腳本 + 本機 `-DryRun` 演練 + 文件；實際安裝 / 解除安裝 / 重裝由使用者關閉 BAT 後執行，不在本單驗收範圍）
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3 PASS（`e2e/`、`docs/agent-guide/packaging-release-checks.md` 存在）；C-2 無 `branch` 欄位。`CT_HOME` 未設（不是 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`。
- **產品 commit**：`ba38d83dba0d3be053645bf590b02021009afe22`（`test(e2e): NSIS reinstall acceptance script for Windows (T0740)`；`git commit --only` 三個檔）
- **變更檔案**：
  - `e2e/manual/nsis-reinstall-acceptance.ps1`（新增，UTF-8 BOM：Windows PowerShell 5.1 讀中文字串需要 BOM）
  - `e2e/manual/README.md`（新增）
  - `docs/agent-guide/packaging-release-checks.md`（NSIS 完整重裝段補一行指向腳本）
- **驗證**：
  - 原始碼：PowerShell 7.6.9 與 Windows PowerShell 5.1 的 parser 都是 0 個錯誤（5.1 第一次有 12 個：hashtable 內 `-replace 'x', ''` 的逗號，已加括號）
  - 演練：PS 7 跑兩次（第一次含下載）、PS 5.1 跑一次，結果一致，exit 0、整體 `DRYRUN`
  - 報告檔掃描 `batcap.` / `BAT_REMOTE_TOKEN=` / `sk-ant-` = 0 筆；腳本只記程序名稱 / PID / 執行檔路徑，不記命令列
  - 沒有改產品程式碼與打包設定：`npx vite build` / typecheck / unit test 不適用，未跑
  - 🔴 實際模式（②–⑤ 真的執行安裝 / 解除安裝、`-StopRunning`、`-LaunchCheck`）**沒有跑過**，只有程式碼與演練；第一次實跑時這些路徑本身也在受測
- **session_id**：35df77cc-9185-43ea-94f1-012167f55676

### 演練結果

演練輸出（`%TEMP%` = 使用者暫存目錄）：

| 目錄 | 內容 |
|---|---|
| `%TEMP%\bat-nsis-acceptance-20261101-174318\` | **下載的安裝檔** `BetterAgentTerminal.Setup.0.7.2-pre.8.exe`（307,151,212 bytes）＋第一次演練報告 |
| `%TEMP%\bat-nsis-acceptance-20261101-174404\` | PS 7 演練報告（`-InstallerPath` 重用安裝檔） |
| `%TEMP%\bat-nsis-acceptance-20261101-174414\` | Windows PowerShell 5.1 演練報告 |

**⓪ 前置檢查**（實際偵測結果）

| 項目 | 結果 |
|---|---|
| 安裝範圍 | **AllUsers（HKLM）**：uninstall 鍵 `HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\262fb336-7de2-518a-848d-1e2c171bd3c5`；HKCU 沒有安裝紀錄 |
| DisplayName / DisplayVersion | `BetterAgentTerminal 0.7.2-pre.8` / `0.7.2-pre.8` |
| 安裝路徑 | `C:\Program Files\BetterAgentTerminal`，來源 `HKLM\Software\262fb336-…\InstallLocation`（uninstall 鍵自己的 `InstallLocation` 是空的） |
| QuietUninstallString | `"C:\Program Files\BetterAgentTerminal\Uninstall BetterAgentTerminal.exe" /allusers /S` |
| 系統管理員 | 是（本 session 的 PowerShell 是提權的） |
| 執行中程序 | **11 個 → FAIL，實際模式會在此中止**：`BetterAgentTerminal.exe` ×6（執行檔在安裝目錄：主程式、renderer、Terminal Server 等）、`node.exe` ×5（命令列引用安裝目錄的 helper，例如各 claude 分頁的 BAT MCP shim）。演練印出「實際模式會在此中止（不自動結束程序；除非帶 -StopRunning 並輸入 STOP 確認）」 |
| BAT 分頁偵測 | 偵測到 `BAT_SESSION` / `BAT_TERMINAL_ID` → 演練 WARN，實際模式 FAIL 中止 |
| userData | `%APPDATA%\BetterAgentTerminal`（78 檔，798.4 MiB，大多是 whisper 模型與 server bundle 快取）；唯讀試算 SHA-256 快照：78 檔、11 檔讀不到（BAT 執行中開著的檔案）、0.7 s |
| 桌面捷徑（AllUsers） | 存在（`%PUBLIC%\Desktop\BetterAgentTerminal.lnk`） |

**① 安裝檔**

- `gh release view v0.7.2-pre.8 -R gowerlin/better-agent-terminal --json assets` → digest `sha256:e043fd287016b94a1b38822d8e4e327a9f8fda7222e4648204d7b41c6c0ce044`、size 307151212
- `gh release download … -p "BetterAgentTerminal.Setup.0.7.2-pre.8.exe"`：exit 0，13.3 s
- SHA-256 PASS、大小 PASS；sha512（base64，`latest.yml` 格式）`xWy1jDQwGoyjxr/woPqkZY02HCxIv+S0ENj8/baWKpCDC3BftlpZBt1KCR0bAr/baxS/iNAMj7DsURq1jsXfhg==`（沒有參考值可比，只記錄）

**②p 安裝後檢查試跑（唯讀，對象是目前安裝的 pre.8）**：12 PASS、1 WARN（「安裝後沒有自動啟動 BAT」= 11 個程序，因為 BAT 正在跑，預期 WARN）。PASS 項：DisplayVersion、InstallLocation、另一範圍沒有安裝、主程式 FileVersion `0.7.2-pre.8`、`resources/package.json`（只有 `name` / `version`）、`bat-terminal.mjs` / `bat-notify.mjs` / `bat-mcp.mjs --version` = `v0.7.2-pre.8`、內嵌 claude 335,469,216 bytes、內嵌 codex 371,735,856 bytes、開始功能表捷徑、桌面捷徑。

**②–④ 實際參數**

| 步驟 | 指令 |
|---|---|
| ② 覆蓋安裝 | `Start-Process -FilePath "<安裝檔>" -ArgumentList '/S /allusers /D=C:\Program Files\BetterAgentTerminal' -Wait -PassThru` |
| ③ 解除安裝 | `Start-Process -FilePath "C:\Program Files\BetterAgentTerminal\Uninstall BetterAgentTerminal.exe" -ArgumentList '/allusers /S' -Wait -PassThru`，之後輪詢 uninstall 鍵與主程式都消失（≤ 600 s），再等 `%TEMP%\~nsu*.tmp\` 內的解除安裝程式副本結束（≤ 60 s） |
| ④ 乾淨重裝 | 同 ② |

安裝範圍判斷依據：⓪ 找到的 uninstall 鍵在 HKLM → `/allusers`（在 HKCU → `/currentuser`；兩邊都有 → 要求 `-Scope`）。參數來源是 electron-builder 26.8.1 的 NSIS 模板：`assistedInstaller.nsh` 讀 `/allusers` / `/currentuser` 決定範圍、`multiUser.nsh` 的 `GetDParameter` 讓 `/D=` 覆寫路徑（NSIS 規則：`/D=` 放最後、不加引號）；解除安裝不帶 `--delete-app-data` 時保留 userData（`uninstaller.nsh`，本專案沒設 `deleteAppDataOnUninstall`）。per-machine 範圍時，非系統管理員的 PowerShell 會在 ⓪ 中止並請使用者以系統管理員身分重開（腳本不自動提權）。

### 給使用者的執行步驟

（完整版在 `e2e/manual/README.md`）

1. 關閉所有 BAT 視窗（Terminal Server 會一起結束）。
2. 確認沒有 BAT 程序：工作管理員沒有 `BetterAgentTerminal.exe`，或執行
   `Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like "*\BetterAgentTerminal\*" } | Select-Object Name, ProcessId` 沒有輸出。
3. 以「**以系統管理員身分執行**」開一般 PowerShell（本機是所有使用者安裝），切到 repo 根目錄。
4. 執行（重用演練下載的安裝檔）：

   ```powershell
   pwsh -NoProfile -ExecutionPolicy Bypass -File e2e\manual\nsis-reinstall-acceptance.ps1 -InstallerPath "$env:TEMP\bat-nsis-acceptance-20261101-174318\BetterAgentTerminal.Setup.0.7.2-pre.8.exe"
   ```

   要一併做 ⑤ 啟動檢查就加 `-LaunchCheck`（BAT 會還原上次的工作區與分頁，10 秒後腳本請它關閉；跳出關閉確認時手動關）。
5. 重開 BAT，把腳本最後印的 `report.md` 路徑告訴塔台。
6. 塔台判讀完後刪除報告目錄裡的 `userdata-backup\`（userData 完整副本，含權杖檔）。

### 發現的問題

1. **release 沒有 `latest.yml`**：工單寫「以 `latest.yml` 的 sha512 驗證」，但 `v0.7.2-pre.8` 的資產只有 exe / zip / dmg / AppImage（docs「NSIS 差分打包關閉」已記載 `latest.yml` 不上傳）。改以 GitHub 計算的 asset digest（sha256）與大小驗證，另算 sha512（base64）記在報告；release 日後有 `latest.yml` 時腳本會在報告註明。屬範圍內判斷，未問塔台。
2. **`perMachine: false` 但本機是 per-machine 安裝**：assisted installer 讓使用者選範圍，本機當初選了所有使用者。所以實跑需要系統管理員 PowerShell；不同機器可能是 HKCU，腳本依 uninstall 鍵判斷。
3. **HKLM uninstall 鍵的 `InstallLocation` 是空的**：electron-builder 把路徑寫在 `HKLM\Software\<GUID>\InstallLocation`；腳本依序讀 `Software\<GUID>` → uninstall 鍵 → `UninstallString`。
4. **有一個不屬於目前安裝範圍的捷徑**：`%APPDATA%\Microsoft\Windows\Start Menu\Programs\BetterAgentTerminal.lnk`（per-user 開始功能表）存在，但 HKCU 沒有安裝紀錄，推測是更早的 per-user 安裝留下的。腳本只檢查目前範圍（AllUsers）的捷徑，不碰這個檔；③ 之後它大概仍會存在，判讀時不要當成解除安裝殘留。
5. **主程式沒跑 `--version`**：`BetterAgentTerminal.exe --version` 會開啟 GUI，改讀檔案版本資訊（`FileVersion` = `0.7.2-pre.8`；`ProductVersion` 是 `0.7.2.0`）。3 個 helper 照工單跑 `--version`（有 `node` 用 `node`，沒有時用主程式加 `ELECTRON_RUN_AS_NODE=1`）。
6. **實際模式沒有實測過**（見〈完成狀態〉）。最可能需要調整的地方：`Start-Process -Wait` 等安裝程式的方式、③ 的完成判定（輪詢）、`-LaunchCheck` 遇到關閉確認對話框的處理。實跑失敗時，報告會留下失敗步驟與還原指令。
7. 演練時 userData 有 11 個檔讀不到（BAT 執行中）；實際模式若仍有讀不到的檔，⓪ 會記 WARN（代表 BAT 沒有完全關閉）。

### 互動紀錄

- 無（yolo；沒有問使用者，也沒有問塔台）。

### 回報時間

- 2026-11-01T17:45:10+0800
