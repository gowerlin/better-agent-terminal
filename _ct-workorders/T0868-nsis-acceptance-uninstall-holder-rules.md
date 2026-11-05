---
schema_version: 1
schema_kind: workorder
id: T0868
title: "NSIS 重裝驗收腳本 ③ 跟上 T0860：容許 `--uninstall-quit-request` 造成的 debug log 輪替，並依 ② 裝上的版本檢查 holder"
type: implementation
status: DONE
started_at: "2026-11-05T11:11:50+0800"
updated_at: "2026-11-05T11:19:39+0800"
completed_at: "2026-11-05T11:19:39+0800"
session_ids:
  - "46464a1e-78fe-4da2-aae1-6785045b8c90"
repo: better-agent-terminal
project: PLAN-065
priority: P1
sizing: S
created_at: "2026-11-05T11:10:29+0800"
depends_on: []
related:
  - "D292；`0.7.5-pre.1` NSIS 重裝驗收報告 `%TEMP%\\bat-nsis-acceptance-20261105-110355\\report.md`（③ FAIL）；T0740（腳本）、T0801（`-Version` 必填）、T0860（`--uninstall-quit-request`、`customUnInstall`）、T0862（腳本的 holder 檢查）；`build/installer.nsh` `batUninstallPtyHolder` / `customUnInstall`；CLAUDE.md「Logging」（每次啟動一檔、保留最近 10 個）"
affects_files:
  - _ct-workorders/T0868-nsis-acceptance-uninstall-holder-rules.md
  - e2e/manual/nsis-reinstall-acceptance.ps1
  - e2e/manual/README.md
  - scripts/__tests__/
  - docs/agent-guide/pty-holder.md
  - docs/agent-guide/packaging-release-checks.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改驗收腳本與它的文件 / 測試，不改產品（`build/installer.nsh`、`electron/**`、`src/**`）。D292：解除安裝啟動 `--uninstall-quit-request` 造成的 debug log 新增 / 輪替是設計行為，由腳本容許，不由產品消除。"
  - "🔴 容許範圍要窄：只有 ③ 期間、只有 `BetterAgentTerminal\\Logs\\debug-*.log`（新增 ≤ 1 份、因輪替刪除 ≤ 1 份且是最舊的那份）；其他任何 userData 差異（含 `Logs` 內其他檔、`bat-scripts*.log`、settings、權杖檔）仍判 FAIL。② / ④ 的 userData 規則不變。"
  - "🔴 不得在開發機真的安裝 / 解除安裝 BAT（本 session 就跑在已安裝的 BAT 裡）：只能跑 `-DryRun`、PowerShell 解析檢查與 vitest。真的執行由使用者驗收時跑。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push、不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0868 — NSIS 重裝驗收腳本 ③ 跟上 T0860

## 元資料
- **工單編號**：T0868｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-05 11:10 (UTC+8)
- **規模**：S｜**依賴**：無｜**決策**：D292

## 背景
使用者 2026-11-05 11:03 對 `0.7.5-pre.1` 跑 `e2e/manual/nsis-reinstall-acceptance.ps1 -Version 0.7.5-pre.1`（原安裝版 `0.7.4-pre.9`，AllUsers）：⓪ WARN（版本不同，預期）、① ② PASS（② 已查到 holder 目錄與執行檔），③ 只有一項 FAIL：

- 「userData 保留且未被改動」：新增 `BetterAgentTerminal\Logs\debug-20261105-110422.log`、刪除 `BetterAgentTerminal\Logs\debug-20261104-140843.log`（③ 期間 11:04:22；③ 共 4.7 s）。
- 腳本因 ③ FAIL 停止，④ ⑤ 沒跑。

塔台判讀：真的解除安裝時 `customUnInstall` → `batUninstallPtyHolder` 一律啟動 `$INSTDIR\BetterAgentTerminal.exe --uninstall-quit-request`（沒有 BAT 在跑也會送，用來停 holder，T0860 設計）；請求程序啟動時 `logger.init` 建立一份 debug log，並依「保留最近 10 個」刪掉最舊的一份。產品符合設計，腳本 ③ 的「userData 完全不變」是 T0860 前的規則。

另一個缺口：③ 的 holder 檢查以 `$holderVersion0`（⓪ 時的安裝目錄有沒有 `resources\pty-holder`，約 L596–599）決定。這次 ⓪ 是 pre.9（沒有 holder），② 裝上 pre.1（有 holder），③ 卻跳過「holder 已結束」「holder 根目錄已移除」兩項檢查——正好是這版最需要驗的路徑。

## 任務
1. ③ 的 userData 比對：差異只在上述容許範圍時判 `PASS`，並逐檔加 Note（例「debug log 新增 / 輪替：解除安裝程式啟動 `--uninstall-quit-request`（T0860），屬預期」）；超出範圍照舊 `FAIL`。判讀規則欄寫清楚容許條件。若無法確認被刪的是最舊那份（例如 ⓪ 快照取不到修改時間），寧可判 `WARN` 也不要放寬到 PASS。
2. ③ 的 holder 檢查改依「解除安裝前、② 裝上的版本」決定（例：③ 開始前讀 `$installDir` 的 `resources\pty-holder` manifest，與 ② 的 `Test-HolderState` 同一來源）；⓪ 的 `$holderVersion0` 若別處還用到，維持原意。③ 也要記錄 ② 之後執行中的 holder（若有）並檢查已結束；沒有執行中的 holder 時只查根目錄。
3. `-DryRun` 時 ③ 的說明文字同步（容許條件、holder 依 ② 的版本）。
4. 文件：`e2e/manual/README.md` 的 ③ 判讀；`docs/agent-guide/pty-holder.md` 驗證清單「發佈後手動」一列、`docs/agent-guide/packaging-release-checks.md` 對應段落，只在描述與新規則不符時改（一兩句）。
5. 測試：在 `scripts/__tests__/`（vitest 收得到的位置，可擴充 `nsis-reinstall-acceptance-version.test.mjs` 或新檔）加 source guard 或可執行的純函式測試，至少守住：③ 的容許只限 `Logs\debug-*.log`、③ 的 holder 判斷不再只看 `$holderVersion0`。能把比對邏輯抽成可單獨呼叫的函式並以 pwsh 實測更好（`pwsh` 不在時 skip，沿用該檔的 `pwshAvailable` 寫法）。

## 驗收條件
- [ ] PowerShell 解析無錯（`[System.Management.Automation.Language.Parser]::ParseFile` 0 errors）
- [ ] `pwsh -NoProfile -ExecutionPolicy Bypass -File e2e\manual\nsis-reinstall-acceptance.ps1 -Version 0.7.5-pre.1 -DryRun` 跑完，報告中 ③ 的說明是新規則（附報告路徑，用 `%TEMP%` 寫法）；演練產生的 userData 備份（若有）跑完即刪
- [ ] `npm run test:unit` 全過（附數字）
- [ ] 以本次 FAIL 報告的差異（新增 1 份 `debug-20261105-110422.log`、刪除最舊的 `debug-20261104-140843.log`）說明新規則會判 PASS；並說明另一種差異（例 `settings.json` 變更）仍判 FAIL
- [ ] commit 只含本單範圍

## 收尾
- 回報後塔台請使用者重跑 NSIS 重裝驗收（BAT 須完全關閉；系統管理員 PowerShell；`-Version 0.7.5-pre.1`）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **狀態**：DONE
- **完成時間**：2026-11-05 11:18 (UTC+8)
- **session_id**：46464a1e-78fe-4da2-aae1-6785045b8c90

### 落點檢查
- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 之下 → PASS；C-3：`e2e/manual/nsis-reinstall-acceptance.ps1`、`e2e/manual/README.md`、`docs/agent-guide/*.md`、`scripts/__tests__/` 都存在 → PASS（C-0 已通過，僅記錄）；C-2：工單沒有 `branch` 欄位，目前 `main`
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_HOME` 未設定（非 worktree）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 結果摘要
1. **③ userData 比對**：新增純函式 `Get-UninstallUserDataVerdict`（`e2e/manual/nsis-reinstall-acceptance.ps1`），只用在 ③；② / ④ 的 `Test-InstalledState` 仍是「快照完全相同才 PASS」。判讀：
   - 沒有差異 → PASS。
   - 差異只在 `BetterAgentTerminal\Logs\debug-*.log`（regex `^BetterAgentTerminal\\Logs\\debug-[^\\]*\.log$`：不含子目錄、不含 `BetterAgentTerminal-runtime-*` 等其他 userData 目錄）、新增 ≤ 1 份、刪除 ≤ 1 份且刪除時一定有新增、被刪的是 ⓪ 時**修改時間**最舊的那份 → PASS，逐檔 Note（「debug log 新增：… — 解除安裝程式啟動 --uninstall-quit-request（T0860），屬預期」「debug log 輪替刪除：… — ⓪ 時 N 份中修改時間最舊的一份…」）。
   - ⓪ 沒有被刪那份的修改時間 → WARN（不放寬為 PASS）。
   - 其他任何差異（變更任何檔，含 debug log 內容；`Logs` 內其他檔、`bat-scripts*.log`、settings、權杖檔；刪除的不是最舊；新增 / 刪除 > 1；只刪不增）→ FAIL，超出範圍的檔案逐一列 Note。
   - 判讀規則欄寫入 `$UninstallUserDataRule`（容許條件全文）。
   - 「最舊」依修改時間，與 `electron/logger.ts` `listManagedLogs`（依 `mtimeMs` 排序）相同。⓪ 的快照只有大小與雜湊，所以 ⓪ 在取快照的同時另以 `Get-DebugLogTimes` 記錄各 userData `Logs\debug-*.log` 的 `LastWriteTimeUtc.Ticks`（`$script:DebugLogTimes0`），只用在這個判斷。
2. **③ holder 檢查**：③ 開始時以 `$holderVersion3 = [bool](Get-PackagedHolderManifest $installDir)`（與 ② 的 `Test-HolderState` 同一來源；實際模式此時是 ② 裝上的版本）決定，並記錄當時執行中的 holder（`$holderRun3`，名稱 / PID / 子程序）；解除安裝後檢查 `$holderRun3` 每個 PID 已結束、holder 根目錄已移除（有程序在跑時保留 = WARN，原規則）。沒有執行中的 holder 時只查根目錄。`$holderVersion0` / `$holderRun0` 只留在 ⓪（與 ② 的 PID 不變檢查），原意不變。`$holderRun3` 有執行中的 holder 時也設 `IgnoreServerFiles`（與 ⓪ 有 holder 時相同，③ 停 holder 會清 Terminal Server 自己的 pid / port / token / registry 檔）。另記錄解除安裝前的版本有沒有 `resources\uninstall-quit-request.supported`（佐證）。
3. **-DryRun**：③ 說明改為新規則（容許條件全文、holder 依解除安裝前的版本、目前 `Logs` 有幾份 debug log 與以此預期 ③ 新增 / 刪除幾份）。
4. **文件**：`e2e/manual/README.md` 步驟表 ③ 列＋「判讀注意」加兩點；`docs/agent-guide/pty-holder.md` 驗證清單「發佈後手動」一列補一句。`docs/agent-guide/packaging-release-checks.md` 第 62 行只描述腳本用法、沒寫 ③ 判讀，與新規則不衝突 → 不改。
5. **測試**：新檔 `scripts/__tests__/nsis-reinstall-acceptance-uninstall.test.mjs`：source guard 4 項（③ 用 verdict 函式而 ② / ④ 仍嚴格、只有一個呼叫點；容許 regex 限 `BetterAgentTerminal\Logs\debug-*.log`；③ 區段沒有 `$holderVersion0` / `$holderRun0` 且用 `$holderVersion3` / `$holderRun3`；⓪ 在快照旁記錄修改時間）＋以 PowerShell parser 從腳本抽出 `Get-UninstallUserDataVerdict` 單獨執行 17 個案例（`pwsh` 不在時 skip，沿用 `pwshAvailable`）。

### 以本次 FAIL 報告說明新規則
- 0.7.5-pre.1 報告（`%TEMP%\bat-nsis-acceptance-20261105-110355\report.md`）③ 的差異：新增 `BetterAgentTerminal\Logs\debug-20261105-110422.log`、刪除 `BetterAgentTerminal\Logs\debug-20261104-140843.log`、變更 0。兩者都在 `BetterAgentTerminal\Logs\` 且符合 `debug-*.log`，新增 1、刪除 1；被刪那份若是 ⓪ 時修改時間最舊（實際模式 ⓪ 會記錄）→ **PASS**，兩檔各一行 Note。測試案例 `failReport` 以這組差異實跑得到 `PASS`、`新增 1 / 刪除 1 / 變更 0`。
- 佐證「依修改時間」是對的：目前 `Logs` 仍有 `debug-20261104-140749.log`（檔名比被刪的 `140843` 早，但修改時間 2026-11-04 14:51），表示 logger 刪的是修改時間最舊、不是檔名最舊；若改以檔名判斷，這次就會被誤判為 FAIL。
- 同一組再加上 `BetterAgentTerminal\settings.json` 變更（案例 `failReportPlusSettings`）、或只有 `settings.json` 變更（`settingsChanged`）→ **FAIL**，Note「userData 差異（超出容許範圍）：BetterAgentTerminal\settings.json」。`server-token.json` 刪除、`bat-scripts.log` 新增、`Logs\old\debug-….log`、`BetterAgentTerminal-runtime-1\Logs\debug-….log`、debug log 內容變更、刪的不是最舊、新增 2 份 / 刪除 2 份、只刪不增 → 都是 FAIL；⓪ 沒有修改時間 → WARN。

### 驗證證據
| 項目 | 結果 | 證據 |
|---|---|---|
| PowerShell 解析 | PASS | `[System.Management.Automation.Language.Parser]::ParseFile` errors=0（最後一次修改後重跑） |
| `-DryRun` | PASS | `pwsh -NoProfile -ExecutionPolicy Bypass -File e2e\manual\nsis-reinstall-acceptance.ps1 -Version 0.7.5-pre.1 -DryRun` 跑完 exit 0、整體 DRYRUN；最後一次報告 `%TEMP%\bat-nsis-acceptance-20261105-111718\report.md`（以 `-InstallerPath` 重用第一次演練下載的安裝檔），③ 的說明為新規則（見上）。演練不建立 userData 備份（目錄內只有 `helper-logs\`、`report.json`、`report.md`）；第一次演練目錄 `%TEMP%\bat-nsis-acceptance-20261105-111621`（含下載的安裝檔）已刪除，所以最後一份報告 ① 列的安裝檔路徑已不存在。⓪ 為 FAIL 是因本 session 跑在 BAT 內、安裝目錄有執行中的程序（演練預期，實際模式會在 ⓪ 中止）。 |
| `npm run test:unit` | PASS | Test Files 455 passed / 3 skipped（458）；Tests 8345 passed / 41 skipped（8386） |
| 新測試 | PASS | `nsis-reinstall-acceptance-uninstall.test.mjs` 21 項＋原 `nsis-reinstall-acceptance-version.test.mjs`，兩檔合計 38 passed（pwsh 可用，未 skip） |
| 真的安裝 / 解除安裝 | 未執行（依工單） | 由使用者驗收時跑 |

### 變更檔案
- `e2e/manual/nsis-reinstall-acceptance.ps1`
- `e2e/manual/README.md`
- `docs/agent-guide/pty-holder.md`
- `scripts/__tests__/nsis-reinstall-acceptance-uninstall.test.mjs`（新）
- `_ct-workorders/T0868-nsis-acceptance-uninstall-holder-rules.md`

### Commit
- 產品：`f92b561f`（`fix(T0868): NSIS acceptance step 3 allows the --uninstall-quit-request debug log rotation and checks the holder by the version step 2 installed`），只含上列 4 個產品 / 文件 / 測試檔。
- 工單：本檔另一個 commit。未 push。

### 遭遇問題
- 無阻塞。第一次跑測試時 source guard 抓到 ③ 區段的註解提到 `$holderVersion0`，改寫註解後通過。

### 殘留風險 / 後續
- logger 在建新檔**之前**清理（刪「現有份數 − 10」份），平常 `Logs` 是 11 份 debug log，③ 新增 1、刪 1。若 ⓪ 時有 12 份以上（例如有其他程序在 init 後才開始寫日誌），③ 會刪 2 份以上而判 FAIL；這是工單限定的「刪除 ≤ 1 份」範圍，沒有放寬。演練的 ③ Note 會依目前份數預告預期刪幾份（> 1 時註明會 FAIL），使用者跑之前可先看。目前本機是 11 份。
- 解除安裝程式只在 holder 根目錄存在且安裝目錄有 `uninstall-quit-request.supported` 時才啟動 `--uninstall-quit-request`；沒有啟動時 userData 不會有 debug log 差異，新規則照樣 PASS（容許是「≤」）。
- 收尾：請塔台請使用者重跑 NSIS 重裝驗收（BAT 須完全關閉；系統管理員 PowerShell；`-Version 0.7.5-pre.1`）。

### 互動紀錄
- [11:11] 啟動，yolo，無塔台提問。
- [11:16] 演練時發現目前 `Logs` 有 11 份 debug log，查 `electron/logger.ts` 確認是「先清理再建檔」的穩定狀態 → 修正演練 Note 的預期份數說明（不改判讀範圍）。
