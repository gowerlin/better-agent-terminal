---
schema_version: 1
schema_kind: workorder
id: T0869
title: "NSIS 重裝驗收腳本 ④ 以 ③ 結束時的 userData 快照為基準（不重算 ③ 已容許的 debug log 差異）"
type: implementation
status: PENDING
created_at: "2026-11-05T11:25:05+0800"
updated_at: "2026-11-05T11:25:05+0800"
session_ids: []
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
- **工單編號**：T0869｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-05 11:25 (UTC+8)
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
