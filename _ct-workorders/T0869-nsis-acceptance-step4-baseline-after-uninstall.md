---
schema_version: 1
schema_kind: workorder
id: T0869
title: "NSIS 重裝驗收腳本 ④ 以 ③ 結束時的 userData 快照為基準（不重算 ③ 已容許的 debug log 差異）"
type: implementation
status: DONE
created_at: "2026-11-05T11:25:05+0800"
updated_at: "2026-11-05T11:30:02+08:00"
completed_at: "2026-11-05T11:30:02+08:00"
started_at: "2026-11-05T11:26:06+08:00"
session_ids:
  - "73501548-3488-425e-97d5-d5c213020cc0"
repo: better-agent-terminal
project: PLAN-065
priority: P1
sizing: S
depends_on:
  - T0868
related:
  - "D293 / D292；重跑報告 `%TEMP%\\bat-nsis-acceptance-20261105-112218\\report.md`（③ PASS、④ FAIL）；T0868（`Get-UninstallUserDataVerdict`、`nsis-reinstall-acceptance-uninstall.test.mjs`）；T0740 / T0801"
affects_files:
  - _ct-workorders/T0869-nsis-acceptance-step4-baseline-after-uninstall.md
  - e2e/manual/nsis-reinstall-acceptance.ps1
  - e2e/manual/README.md
  - scripts/__tests__/
  - docs/agent-guide/pty-holder.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改驗收腳本與它的文件 / 測試，不改產品（`build/installer.nsh`、`electron/**`、`src/**`）。"
  - "🔴 ② 與 ③ 的 userData 規則不變（② 對 ⓪ 快照完全相同；③ 沿用 T0868 `Get-UninstallUserDataVerdict`）。④ 的規則仍是「完全相同才 PASS」，只把基準從 ⓪ 快照改成 ③ 結束時重取的快照。不得放寬 ④ 去容許任何差異。"
  - "🔴 不得在開發機真的安裝 / 解除安裝 BAT（本 session 就跑在已安裝的 BAT 裡）：只能跑 `-DryRun`、PowerShell 解析檢查與 vitest。真的執行由使用者驗收時跑。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push、不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）；寫去識別化掃描結果時只寫「依 .private 第 N 節樣式」，不寫檢查詞原文。"
---

# T0869 — NSIS 重裝驗收 ④ 的 userData 基準改為 ③ 結束時的快照

## 元資料
- **工單編號**：T0869｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-05 11:25 (UTC+8)
- **規模**：S｜**依賴**：T0868（DONE）｜**決策**：D293

## 背景
使用者 2026-11-05 11:22 重跑 `e2e/manual/nsis-reinstall-acceptance.ps1 -Version 0.7.5-pre.1`（T0868 之後的腳本，原安裝 pre.1、AllUsers）：

- ⓪ ① ② PASS。
- ③ PASS：userData 差異 = 新增 `BetterAgentTerminal\Logs\debug-20261105-112244.log`、輪替刪除 ⓪ 時最舊的 `debug-20261104-140749.log`，T0868 新規則判為預期；holder 依 ② 版本檢查、根目錄已移除。
- ④ 乾淨重裝：其他檢查全 PASS，只有「userData 未被改動」FAIL，差異正是上面同一組 2 檔。

原因：④ 呼叫 `Test-InstalledState $s4 … $snapshot0`（約 L923），與 ⓪ 快照比對，把 ③ 已容許的差異再算一次。T0868 工單寫「② / ④ 的 userData 規則不變」是塔台的規格缺口（D293）。

## 任務
1. ③ 結束後（③ userData 判讀為 PASS 或 WARN，且 userData 快照可取得時）重取 userData 快照（例 `$snapshot3`），④ 以它為基準呼叫 `Test-InstalledState`；④ 的檢查名稱 / 預期 / 判讀規則欄寫清楚基準是「③ 結束時的快照」（例預期「與 ③ 結束時的 SHA-256 快照相同」），② 仍寫「與 ⓪ …」。`Test-InstalledState` 目前把「與 ⓪ 的 SHA-256 快照相同」寫死，需能依呼叫端標示基準。
2. ③ 判 FAIL 時腳本本來就停止（④ 不跑），維持原行為；若 ③ 的 userData 判讀是 WARN 而腳本繼續到 ④，也用 ③ 結束時的快照。取不到快照（例 ③ 沒跑到比對）時 fallback 用 ⓪ 快照並加 Note。
3. `-DryRun` 時 ④ 的說明文字同步（基準 = ③ 結束時的快照）。
4. 文件：`e2e/manual/README.md` ④ 列 / 判讀注意補一句；`docs/agent-guide/pty-holder.md` 只在描述與新規則不符時改。
5. 測試：擴充 `scripts/__tests__/nsis-reinstall-acceptance-uninstall.test.mjs`（或新檔，vitest 收得到的位置）加 source guard：④ 的 `Test-InstalledState` 不再傳 `$snapshot0`、改傳 ③ 之後取的快照；② 仍傳 `$snapshot0`；③ 仍用 `Get-UninstallUserDataVerdict`。

## 驗收條件
- [ ] PowerShell 解析無錯（`[System.Management.Automation.Language.Parser]::ParseFile` 0 errors）
- [ ] `pwsh -NoProfile -ExecutionPolicy Bypass -File e2e\manual\nsis-reinstall-acceptance.ps1 -Version 0.7.5-pre.1 -DryRun` 跑完，④ 的說明是新基準（報告路徑用 `%TEMP%` 寫法）；演練產生的 userData 備份（若有）跑完即刪
- [ ] `npm run test:unit` 全過（附數字）
- [ ] 以本次報告說明：③ 結束時快照已含 `debug-20261105-112244.log`、不含 `debug-20261104-140749.log`，④ 乾淨重裝沒有再動 userData → 新規則判 PASS；④ 期間若 userData 有任何差異仍判 FAIL
- [ ] commit 只含本單範圍

## 收尾
- 回報後塔台請使用者再重跑 NSIS 重裝驗收（BAT 須完全關閉；系統管理員 PowerShell；`-Version 0.7.5-pre.1`）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **狀態**：DONE
- **session_id**：73501548-3488-425e-97d5-d5c213020cc0
- **產品 commit**：`6269139c`（`fix(T0869): NSIS acceptance step 4 compares userData with the snapshot at the end of step 3`）

### 落點檢查
- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 的 `_ct-workorders/` 下 → PASS
- C-3：測試的 4 個項目（`e2e/manual/nsis-reinstall-acceptance.ps1`、`e2e/manual/README.md`、`scripts/__tests__/`、`docs/agent-guide/pty-holder.md`）都存在 → PASS
- C-2：工單沒有 `branch` 欄位，略過；目前分支 `main`
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`CT_HOME` 未設（不是 worktree）、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`、`BAT_REMOTE_TOKEN` 已設定

### 變更內容
1. `e2e/manual/nsis-reinstall-acceptance.ps1`
   - `Test-InstalledState` 多一個參數 `[string]$SnapshotBaseline = '⓪ 的'`：檢查名稱不變（`userData 未被改動`），預期欄改成 `"與 $SnapshotBaseline SHA-256 快照相同"`，判讀規則欄改成「逐檔 SHA-256 + 大小；基準 = <基準> 快照；任何差異 FAIL」。判讀仍是 `$diff.same` 才 PASS、否則 FAIL（沒有放寬）。
   - ②：`Test-InstalledState $s2 … $snapshot0 $desktop0 '⓪ 的'`（基準不變，只是明確標示）。
   - ③：開頭 `$snapshot3 = $null`；判讀用的快照存成 `$snapshotAfter3`，`Get-UninstallUserDataVerdict` 判 PASS / WARN 時 `$snapshot3 = $snapshotAfter3`，並加 Note（檔數、無法讀取數）。③ 的判讀規則（T0868）完全不變。保存的是 ③ 判讀用的那一份快照（不是再取一次），所以「④ 的基準」與「③ 判讀的內容」是同一份，中間沒有空窗。
   - ④：`$snapshot4Base = $snapshot3`、標示 `③ 結束時的`；`$snapshot3` 為 `$null` 時退回 `$snapshot0`、標示 `⓪ 的`，並加 Note「取不到 ③ 結束時的 userData 快照（③ 沒有跑到 userData 比對），改以 ⓪ 的快照為基準」。③ 判 FAIL 時腳本照舊在 ④ 之前停止（`Stop-Acceptance`），未改。
   - `-DryRun` 說明同步：⓪ 判讀說明（② ③ 與 ⓪ 比對、④ 與 ③ 結束時的快照比對）、② 說明（與 ⓪ 的 SHA-256 快照相同）、③ 說明（判讀 PASS / WARN 時保存這份快照作為 ④ 的基準）、④ 說明（userData 基準 = ③ 結束時的 SHA-256 快照…完全相同才 PASS）。
2. `e2e/manual/README.md`：步驟表 ④ 列補「userData 改與 ③ 結束時的快照比對（T0869），完全相同才通過」；判讀注意新增一條說明 ④ 的基準、fallback 與「④ 期間任何差異仍 FAIL」，② / ④ 規則不變那句補「（完全相同才 PASS）」。
3. `scripts/__tests__/nsis-reinstall-acceptance-step4-baseline.test.mjs`（新檔，vitest `scripts/__tests__/**/*.test.mjs` 收得到）：
   - source guard：`Test-InstalledState` 有 `$SnapshotBaseline`、不再寫死「與 ⓪ 的 SHA-256 快照相同」、仍是 `$diff.same` 判讀且不用 `Get-UninstallUserDataVerdict`；② 傳 `$snapshot0`；③ 仍用 `Get-UninstallUserDataVerdict` 且只在 PASS / WARN 時保存 `$snapshot3`；④ 傳 `$snapshot4Base`（= `$snapshot3`，`$null` 才退回 `$snapshot0`），④ 的 `Test-InstalledState` 呼叫不含 `$snapshot0`、④ 不用 `Get-UninstallUserDataVerdict`；`Test-InstalledState` 呼叫點只有 `$s2p` / `$s2` / `$s4`。
   - 行為（以 PowerShell parser 抽出 `Compare-Snapshot` 單獨執行，沒有 pwsh 時略過）：以本次重跑報告的情境建快照，④ 對 ⓪ → 新增 `debug-20261105-112244.log`、刪除 `debug-20261104-140749.log`（舊的 FAIL）；④ 對 ③ 快照且 ④ 期間沒有變動 → 相同；④ 期間 settings 變更 / 多一份 debug log / 刪一檔 → 不同。
4. `docs/agent-guide/pty-holder.md`：未改。它只描述 ③ 的 userData 容許（D292），沒有寫 ④ 的規則，與新規則不衝突。

### 驗證
- PowerShell 解析：`[System.Management.Automation.Language.Parser]::ParseFile` → `errors=0`；檔案仍是 UTF-8 with BOM。
- `-DryRun`：`pwsh -NoProfile -ExecutionPolicy Bypass -File e2e\manual\nsis-reinstall-acceptance.ps1 -Version 0.7.5-pre.1 -DryRun` 跑完，整體結果 `DRYRUN`。④ 的說明是「安裝後檢查同 ②（桌面捷徑預期存在）；userData 基準 = ③ 結束時的 SHA-256 快照（③ 的 userData 判讀為 PASS / WARN 時保存；取不到時退回 ⓪ 的快照並加 Note），完全相同才 PASS（T0869 / D293）」；② 說明是「userData 與 ⓪ 的 SHA-256 快照相同」。報告 `%TEMP%\bat-nsis-acceptance-20261105-112750\report.md`。輸出目錄只有安裝檔、`helper-logs`、`report.md` / `report.json`，沒有 userData 備份（演練不執行 robocopy），沒有需要刪的備份。
- `npx vitest run` 兩個 NSIS 驗收測試檔：2 files / 31 tests passed（pwsh 部分有執行）。
- `npm run test:unit`：456 files passed / 3 skipped；8355 tests passed / 41 skipped，0 failed。
- 沒有改 `src/**` / `electron/**`，typecheck 與 vite build 不受影響，未跑。
- 依規定沒有在開發機真的安裝 / 解除安裝。

### 以本次重跑報告說明新規則
- ③ 判讀用的快照（= ⓪ 快照 + `BetterAgentTerminal\Logs\debug-20261105-112244.log` − `BetterAgentTerminal\Logs\debug-20261104-140749.log`），T0868 規則判 PASS → 腳本把這份存成 `$snapshot3`。
- ④ 乾淨重裝沒有動 userData → ④ 結束時的快照與 `$snapshot3` 逐檔相同 → 「userData 未被改動」PASS（預期欄「與 ③ 結束時的 SHA-256 快照相同」）。原本 FAIL 的那 2 檔是 ③ 的差異，不再於 ④ 算一次。
- ④ 期間 userData 有任何新增 / 刪除 / 變更（例如又多一份 debug log、settings 被改）→ `$diff.same` 為假 → FAIL，與修改前相同（行為測試 `settingsChangedIn4` / `debugLogAddedIn4` / `fileRemovedIn4`）。

### 遭遇問題
- 無。

### 互動紀錄
- 無（yolo，沒有向塔台提問；執行期間沒有塔台補充段落）。

### 去識別化
- 依 .private 第五節、第六節、第七節樣式掃描本單變更的 4 個檔（腳本、README、新測試、本工單），0 筆。

### 後續
- 塔台請使用者再重跑 NSIS 重裝驗收（BAT 須完全關閉；系統管理員 PowerShell；`-Version 0.7.5-pre.1`）。
