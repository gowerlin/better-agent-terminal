---
schema_version: 1
schema_kind: workorder
id: T0868
title: "NSIS 重裝驗收腳本 ③ 跟上 T0860：容許 `--uninstall-quit-request` 造成的 debug log 輪替，並依 ② 裝上的版本檢查 holder"
type: implementation
status: PENDING
started_at: null
updated_at: "2026-11-05T11:10:29+0800"
completed_at: null
session_ids: []
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
- **工單編號**：T0868｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-05 11:10 (UTC+8)
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
