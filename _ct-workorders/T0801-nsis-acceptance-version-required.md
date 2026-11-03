---
schema_version: 1
schema_kind: workorder
id: T0801
title: "NSIS 重裝驗收腳本 `-Version` 改必填（預設值停在 `0.7.2-pre.8`，漏帶就驗到舊版）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-03T13:30:03+0800"
started_at: "2026-11-03T13:32:09+0800"
updated_at: "2026-11-03T13:38:19+0800"
completed_at: "2026-11-03T13:38:19+0800"
session_ids:
  - "ace9b8c4-da1c-4509-8ee7-c953e5d4b888"
depends_on: []
related:
  - "D247；T0740（腳本建立）/ T0745（log 誤判 FAIL）；`_local-rules.md` Release 節「回報發佈完成時必附 NSIS 重裝驗收提醒與指令」"
affects_files:
  - e2e/manual/nsis-reinstall-acceptance.ps1
  - e2e/manual/README.md
  - e2e/manual/__tests__/**
  - scripts/__tests__/nsis-reinstall-acceptance-version.test.mjs
  - docs/agent-guide/packaging-release-checks.md
  - _ct-workorders/T0801-nsis-acceptance-version-required.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 `-Version` 改必填：不帶時腳本在做任何事之前（下載、備份、安裝之前）就失敗並印出可直接照抄的用法（含 `-Version <版號>` 範例與 `-DryRun`）。`-DryRun` 也必須帶。版號格式先檢查（例 `^\\d+\\.\\d+\\.\\d+(-pre\\.\\d+)?$`，以腳本與 release 實際的版號形式為準），不合法同樣在開始前失敗。不加「自動取最新 release」之類的推測行為。"
  - "🔴 注意 PowerShell 的 `[Parameter(Mandatory)]` 在非互動（`-NonInteractive`、CI、被其他程序呼叫）時會報錯，互動時則會停下來問；選擇哪種寫法、失敗時的訊息與 exit code，寫進回報區。以 `pwsh -NoProfile -NonInteractive -File …`（不帶 `-Version`）實測，確認不會卡住等輸入。"
  - "🔴 其他參數與行為完全不變（`-InstallerPath`、`-ExpectedSha256`、`-Scope`、`-StopRunning`、`-LaunchCheck`、`-DryRun` 等），報告格式不變。既有測試（若有）要綠；腳本有可測的部分就補測試（放 vitest 收得到的位置或沿用既有方式，CLAUDE.md「Frontend unit tests」🔴 不放進 `tests/`）。"
  - "🔴 文件：`e2e/manual/README.md` 與 `docs/agent-guide/packaging-release-checks.md` 中的指令範例都帶 `-Version`、說明它是必填。不改 CHANGELOG / release-note（塔台發版時處理）。不動 `_ct-workorders/_local-rules.md`（塔台收單後自己改）。"
  - "🔴 不得實際執行安裝 / 解除安裝（只做不帶 `-Version` 與格式錯誤的失敗路徑實測；`-DryRun` 若會下載安裝檔就不跑）。不發版、不 push。公開 repo 去識別化（D176）：回報不寫家目錄真實路徑，用 `<使用者資料夾>`。yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。暫存檔放系統暫存目錄，收尾刪除。"
---

# T0801 — NSIS 重裝驗收腳本 `-Version` 改必填

## 元資料

- **工單編號**：T0801
- **類型**：implementation（驗收腳本）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-03T13:30:03+0800
- **預估規模**：S

## 背景

`e2e/manual/nsis-reinstall-acceptance.ps1`（T0740）的 `param` 區 `[string]$Version = '0.7.2-pre.8'` 是舊版號。每次發版後使用者都要手動跑這支腳本；漏帶 `-Version` 就會下載並安裝舊版，驗收結果看起來 PASS 卻不是本版。塔台目前靠發版回報提醒「`-Version` 必帶」（`_local-rules.md`）。改成必填後，漏帶會直接失敗（D247）。

## 範圍

1. `-Version` 改必填，不帶或格式錯誤時在做任何事之前就失敗，並印出用法。
2. 非互動執行時不卡住等輸入（實測）。
3. 更新 `e2e/manual/README.md`、`docs/agent-guide/packaging-release-checks.md` 的指令範例與說明。

## 不做

- 不改其他參數、步驟與報告格式；不實際安裝；不改 CHANGELOG / release-note / `_local-rules.md`；不發版、不 push。

## 驗收

- [x] 不帶 `-Version`：開始前失敗、印出用法、非互動不卡住（附實測輸出與 exit code）
- [x] 格式錯誤的 `-Version`：開始前失敗（附實測）
- [x] 帶合法 `-Version` 的路徑不受影響（說明如何確認；不實際安裝）
- [x] README / docs 指令範例都帶 `-Version`
- [x] 既有測試綠（若有）；可測部分補測試

---

## 回報區

### 待塔台決策

#### Q-1：新測試放哪裡？`affects_files` 只有 `e2e/manual/__tests__/**`，但 vitest 收不到那裡
- **提問時間**：2026-11-03T13:35:20+0800
- **背景**：`vite.config.ts` 的 `test.exclude` 含 `e2e/**`，`test:legacy` 只掃 `tests/`（且 🔴 不得放 `tests/`）。放在 `e2e/manual/__tests__/` 的測試不會被 `npm run test:unit` / `test:legacy` / CI 執行。腳本與兩份文件已改完、失敗路徑已實測。測試內容：以 `pwsh -NoProfile -NonInteractive -File` 執行腳本，斷言不帶 `-Version`、`-Version v0.7.4-pre.2`、`-Version 0.7.4-exp.1` 等都 exit 2、stderr 有用法、`-OutputRoot`（temp）底下沒有產生任何目錄；合法版號以 `-OutputRoot 'C:\bad|name'` 讓腳本在 New-Item 停下，斷言錯誤來自 New-Item（不會下載 / 安裝）；沒有 pwsh / 非 Windows 時 skip。
- **選項**：
  - A. 放 `scripts/__tests__/nsis-reinstall-acceptance-version.test.mjs`（vitest 已收；`affects_files` 多一個檔）
  - B. 放 `e2e/manual/__tests__/`，並改 `vite.config.ts` 的 include / exclude 讓 vitest 收（`affects_files` 多 `vite.config.ts`，動到共用設定）
  - C. 不補自動測試，只留回報區的實測紀錄
  - 其他
- **建議**：A。理由：不動共用設定、與既有 `scripts/__tests__/linux-acceptance-w1.test.mjs` 等驗收腳本測試同處；只多一個測試檔。
- **影響**：只影響測試檔位置與 `affects_files`；產品腳本與文件不受影響。
- **是否阻擋後續**：是（阻擋補測試與收尾）
- **通道**：BAT（`q-c429b3ef-…`，13:35 送出、9.6 s 後 `answered`，choice 1）

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-03T13:38:19+0800
- **session_id**：ace9b8c4-da1c-4509-8ee7-c953e5d4b888

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 下 → PASS；C-3：`affects_files` 都存在（資訊性）；C-2：工單無 `branch` 欄位
- `CT_HOME` 未設定（非 worktree，在主 checkout 執行）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 結果摘要

1. **`-Version` 改必填**（`e2e/manual/nsis-reinstall-acceptance.ps1`）：`param` 的 `[string]$Version = ''`（拿掉 `'0.7.2-pre.8'`）；`param` 之後、第一個動作（`New-Item` 建輸出目錄）之前檢查 `$Version -cnotmatch '^\d+\.\d+\.\d+(-pre\.\d+)?$'`（大小寫敏感），不符 → 用法寫到 **stderr**、**exit 2**。`-DryRun` 也一樣要帶。不加任何「自動取最新 release」的推測。其他參數、步驟、報告格式都沒改。
   - 版號格式依據：本 fork `v0.*` tag 只有 `vX.Y.Z`（13）與 `vX.Y.Z-pre.N`（95）兩種（另 2 個舊的 `-pre.N-(Pre-Release)` 異常 tag 不收）。
   - 錯誤訊息分兩種：沒帶 / 空字串 →「缺少 -Version（必填）」；格式錯 →「-Version 格式不正確：'<值>'（應為 X.Y.Z 或 X.Y.Z-pre.N，不加 v 前綴）」。後面接「沒有做任何事」、版號 = release tag 去掉 v 的說明，以及三條可照抄的指令（演練 `-Version <版號> -DryRun`、`-InstallerPath`、先下載），路徑用 `$PSCommandPath`（從哪個 cwd 執行都能照抄）。範例刻意用 `<版號>` 佔位而不寫具體版號：照抄沒換會被格式檢查擋下，不會又驗到舊版。
   - **為什麼不用 `[Parameter(Mandatory)]`**：互動執行時 PowerShell 會停下來要求輸入（不是失敗）；`-NonInteractive` 時實測（pwsh 7.6.9，對照用的小腳本）輸出「無法處理命令，因為遺漏一或多個必要參數:  Version。」exit `1`，不會印用法，exit code 也和「步驟 FAIL」的 `1` 混在一起。自己檢查則任何模式都直接結束、印用法、exit `2`。
   - **exit 2** 是新的結束代碼（= 用法錯誤，什麼都沒做、沒有報告目錄），既有的 `0` / `1` 意義不變；已寫進 README「判讀注意」。
2. **文件**：`e2e/manual/README.md` 演練與實際執行的指令都帶 `-Version <版號>`，加上必填說明（版號 = tag 去掉 `v` 的例子）、參數表 `-Version` 改「必填、無預設」、結束代碼加 `2`。`docs/agent-guide/packaging-release-checks.md` 的「Release 驗收必跑 NSIS 完整重裝」那一行加上兩條帶 `-Version <版號>` 的指令與必填說明。腳本開頭的 `.DESCRIPTION` / `.EXAMPLE` 也改成帶 `-Version <版號>`。
3. **測試**（依 Q-1 塔台答覆 A）：`scripts/__tests__/nsis-reinstall-acceptance-version.test.mjs`，17 個：
   - source guard 2 個：`$Version` 沒有預設值、沒有 `[Parameter(Mandatory)]` attribute、版號檢查在第一個 `New-Item -ItemType Directory` 之前、regex 原文。
   - 沒帶 `-Version` 4 個（無參數、只有 `-DryRun`、`-Version ''`、只帶其他參數）＋格式錯 8 個（`v0.7.4-pre.2`、`0.7.4-PRE.2`、`0.7.4-exp.1`、`0.7`、`0.7.4-pre`、`0.7.4.1`、前面有空白、`<版號>`）：都以 `pwsh -NoProfile -NonInteractive -File` 實際執行，斷言 exit 2、stdout 空、stderr 有原因與兩條用法、temp `-OutputRoot` 底下沒有任何東西。
   - 合法版號 3 個（只在 Windows）：`-OutputRoot 'C:\t0801|illegal'`（`|` 在 Windows 路徑不合法），斷言 exit 1、錯誤來自 `New-Item`、沒有用法訊息、沒有進入任何步驟（stdout 沒有 `=== `）。
   - 沒有 pwsh 時整組 skip；CI ubuntu 有 pwsh 時，失敗路徑照跑、合法版號那 3 個 skip。

### 驗收對照

- [x] 不帶 `-Version`：開始前失敗、印出用法、非互動不卡住 —— 實測如下（`pwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass -File … `，stdin 關閉）：

  ```text
  args: (無)            exit=2  耗時 1 s  stdout 空
  args: -DryRun         exit=2  耗時 0 s  stdout 空
  args: -Version '' -DryRun  exit=2  stdout 空
  stderr（三者相同）：
  nsis-reinstall-acceptance.ps1: 缺少 -Version（必填）
  沒有做任何事：沒有建立輸出目錄、下載、備份或安裝。

  版號 = 要驗收的 GitHub release tag 去掉 v（tag v<版號> → -Version <版號>），每次都要明確帶。

  用法（把 <版號> 換成要驗收的版號）：
    演練（只做唯讀檢查並下載安裝檔）：
      pwsh -NoProfile -ExecutionPolicy Bypass -File "<repo>\e2e\manual\nsis-reinstall-acceptance.ps1" -Version <版號> -DryRun
    實際執行（重用已下載的安裝檔）：
      pwsh -NoProfile -ExecutionPolicy Bypass -File "<repo>\e2e\manual\nsis-reinstall-acceptance.ps1" -Version <版號> -InstallerPath "<安裝檔路徑>"
    實際執行（先下載，需要已登入的 gh）：
      pwsh -NoProfile -ExecutionPolicy Bypass -File "<repo>\e2e\manual\nsis-reinstall-acceptance.ps1" -Version <版號>
  ```

  Windows PowerShell 5.1（`powershell -NoProfile -NonInteractive -File … -DryRun`）：exit 2、stderr 中文正常。`-OutputRoot` 指到的 temp 目錄執行後沒有任何 `bat-nsis-acceptance-*`。
- [x] 格式錯誤的 `-Version`：`v0.7.4-pre.2`、`0.7.4-PRE.2`、`0.7.4-exp.1`、`<版號>` 都 exit 2，第一行「-Version 格式不正確：'<值>'（應為 X.Y.Z 或 X.Y.Z-pre.N，不加 v 前綴）」，其餘同上；另外 4 種在測試裡驗。
- [x] 帶合法 `-Version` 的路徑不受影響：① 檢查之後的程式碼一行沒動（diff 只有 `param` 預設值、註解 / 說明，以及在 `try { [Console]::OutputEncoding … }` 與 `# 常數` 之間插入的檢查區塊）；② 實測 `-Version 0.7.4-pre.2` / `0.7.4` 加 `-OutputRoot 'C:\bad|name'`：exit 1、錯誤是第 90 行 `New-Item`（＝原本的第一個動作），表示通過檢查後照原流程往下走；`C:\bad*` 不存在。③ 另見〈遭遇問題〉：意外跑了一次真的 `-DryRun`，⓪–④ 照原樣跑完並產出報告。
- [x] README / docs 指令範例都帶 `-Version`：`e2e/manual/README.md` 兩條、`docs/agent-guide/packaging-release-checks.md` 兩條、腳本 `.EXAMPLE` 兩條。repo 內其他提到這支腳本的只有 `CHANGELOG.md`（只有檔名、沒有指令，依工單不改）。
- [x] 既有測試綠；可測部分補測試：`npx vitest run scripts/__tests__/nsis-reinstall-acceptance-version.test.mjs` 17 / 17；`npm run test:unit` 390 檔全過（6843 passed、24 skipped）。原本沒有這支腳本的測試。沒有改 `src/` / `electron/`，不跑 typecheck；沒有改產品程式，不跑 `npx vite build`。

### 修改的檔案

- `e2e/manual/nsis-reinstall-acceptance.ps1`
- `e2e/manual/README.md`
- `docs/agent-guide/packaging-release-checks.md`
- `scripts/__tests__/nsis-reinstall-acceptance-version.test.mjs`（新增，Q-1 答覆 A）
- `_ct-workorders/T0801-nsis-acceptance-version-required.md`

### Commit

- `a9b5130a` fix(e2e): NSIS reinstall acceptance requires -Version (T0801)
- `7d12bf86` chore: T0801 question Q-1 for tower (ct)
- `9e9b3244` test(e2e): cover NSIS acceptance -Version gate (T0801)
- 工單收尾 commit 在本回報之後。都用 `git commit --only`，沒有 push。工作目錄裡 T0802 的檔案（`_ct-workorders/T0802-…`、`electron/whisper-addon-loader.ts`、`src/lib/voice-availability.ts`）不是本單的，沒碰。

### 遭遇問題

- 🟡 **意外跑了一次真的 `-DryRun`（有下載，沒有安裝）**：為了證明合法版號會通過檢查，我在 Git Bash 用 `mktemp -d` 建 temp 目錄、在裡面 `touch` 一個檔，想讓 `-OutputRoot <檔案>/sub` 使 `New-Item` 失敗。但 bash 的 `/tmp/...` 傳給 pwsh 後被解析成 `D:\tmp\...`（另一個實體目錄），`New-Item` 成功，腳本以 `-Version 0.7.4-pre.2 -DryRun` 與 `-Version 0.7.4 -DryRun` 各跑完一次演練：0.7.4-pre.2 下載了 `BetterAgentTerminal.Setup.0.7.4-pre.2.exe`（約 305 MiB）到報告目錄，0.7.4 下載失敗（沒有這個 release）。兩份報告 `mode=dry-run`、② / ③ / ④ 都是 `DRYRUN`，沒有安裝、解除安裝或結束任何程序，沒有 `userdata-backup`。整個 `D:\tmp\tmp.e56eDX32r6` 已刪除（`D:\tmp` 本身 2026-10-16 就存在，保留）。違反工單「`-DryRun` 若會下載安裝檔就不跑」，但不影響本機安裝；之後改用 `C:\bad|name` 這種 Windows 原生不合法路徑驗證（測試同樣用這個方式，且只在 Windows 跑）。
  - 附帶觀察：這兩次演練是在 BAT 分頁內跑的，⓪ 記 WARN「偵測到 BAT 分頁環境變數」，符合 README 說明。
- Python heredoc 改中文文件時 assert 失敗（cp950 讀 stdin，見記憶「Python heredoc non-ASCII」），沒有寫入任何東西，改用 Edit。

### 後續建議（給塔台）

- `desktop-build.yml` 產的 `0.0.0-exp.N` 安裝檔現在被格式檢查擋下，不能用這支腳本驗（`-InstallerPath` + `-ExpectedSha256` 原本可行）。目前沒有這個需求；要的話另開單決定是否放寬成 `X.Y.Z-<suffix>.N`，並同時處理 `gh release view` 取不到 digest 的情況。
- `_ct-workorders/_local-rules.md` Release 節的提醒文字可依 D247 調整（工單已註明塔台收單後自己改）。

### 互動紀錄

- [13:35] Q-1: 新測試放哪（vitest 的 `exclude` 含 `e2e/**`，`e2e/manual/__tests__/` 收不到）→ A（塔台，BAT 通道）: 放 `scripts/__tests__/nsis-reinstall-acceptance-version.test.mjs`，塔台同步 `affects_files`，不動 `vite.config.ts` → Action: 照做，frontmatter 已見塔台補上的路徑。
