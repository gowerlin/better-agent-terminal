---
schema_version: 1
schema_kind: workorder
id: T0823
title: "PLAN-063 子項 3：Windows NSIS 安裝新版時先請執行中的 BAT 正常結束（存檔、停 Terminal Server），逾時才照舊強制結束"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
isolation: worktree
created_at: "2026-11-04T02:02:42+0800"
depends_on: []
related:
  - "PLAN-063；D267；T0820（NSIS `allowOnlyOneInstallerInstance.nsh` 的 `FIND_PROCESS` / `KILL_PROCESS` / `_CHECK_APP_RUNNING`，`customCheckAppRunning` 覆寫點；實測 run `41683870546`；本機分支 `ct/T0820` 的探測 spec＋暫時 workflow）；T0821（`710e4179`：升級後說明以『版本變＋孤兒清理 N ≥ 1』觸發）；T0504（關窗前 flush）；T0540（`stopTerminalServerGracefully` / `server:shutdown`，Windows 不得用 SIGTERM）；T0783（`desktop-build.yml`）"
affects_files:
  - _ct-workorders/T0823-nsis-graceful-quit-before-upgrade.md
  - package.json
  - build/installer.nsh
  - electron/main.ts
  - electron/upgrade-interruption.ts
  - electron/installer-quit-request.ts
  - electron/__tests__/
  - e2e/t0823-installer-graceful-quit.spec.ts
  - CLAUDE.md
  - docs/agent-guide/upgrade-interruption.md
  - docs/agent-guide/packaging-release-checks.md
renew_count: 0
workdir: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 失敗時的行為必須與現在相同：BAT 沒有在執行、BAT 是舊版不認得請求、請求逾時、或任何步驟出錯 → 一律回到 electron-builder 預設的偵測與強制結束（T0820 記錄的 `Stop-Process` 流程與對話框）；安裝絕不能因為本單而卡住或失敗。互動安裝的『正在執行，按 OK 關閉』對話框與 `/S` 靜默行為的使用者可見差異要在回報列出。"
  - "🔴 正常結束必須同時停止 Terminal Server（server 的 exe 在安裝目錄，留著會被強制結束、shell 一樣中斷）：走既有的完整結束路徑（flush-save T0504、`stopTerminalServerGracefully` / `server:shutdown`、T0540 先程序樹再 shell），不跳關閉確認對話框、不保留 server。🔴 Windows 不得用 SIGTERM 結束 server（T0540）。"
  - "🔴 與 T0821 的升級後說明一致：正常結束後沒有孤兒，T0821 的『孤兒清理 N ≥ 1』不會觸發——必須讓這條路徑也能在新版第一次啟動時顯示同一則說明（例：正常結束前把『被安裝程式結束的終端數與 agent 分頁』寫進 userData 的小檔，新版啟動時與孤兒清理的結果合併判斷），並把 agent 分頁列進既有清單（`cause: 'upgrade'`）。偵測規則改動須同步改 T0821 的測試與 docs，既有觸發條件（版本變＋孤兒）保留。"
  - "🔴 請求通道的安全：只接受同一使用者、本機的請求；不得新增可被其他程式利用來任意結束 BAT 的網路埠；優先沿用既有的 single-instance（`app.requestSingleInstanceLock` / `second-instance`，`electron/main.ts`）以特定參數傳遞，參數之外不接受任何資料；記一行 `[installer-quit] …` 日誌（不記權杖）。若必須另開通道，先問塔台。"
  - "🔴 CI 驗證授權：可 push `ct/T0823`（worktree 分支）並以 `gh workflow run desktop-build.yml -R gowerlin/better-agent-terminal -f ref=ct/T0823` 打安裝檔；可在**另一個**分支 `ct/T0823-probe`（自 `ct/T0823` 開出）放暫時的 push 觸發 workflow 與探測 spec（可參考本機分支 `ct/T0820` 的 `e2e/t0820-nsis-upgrade-running.spec.ts` 與 workflow），驗完刪兩個遠端分支；`ct/T0823-probe` 的檔案不得出現在 `ct/T0823`。不帶 secret、不建 tag / Release / Pages。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 不碰本機 BAT 安裝版與它的 Terminal Server；本機不執行任何 BAT 安裝檔。L185：只開 shell 分頁。yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不合併 main。Git：只 commit 本單範圍。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0823 — NSIS 安裝新版前先請 BAT 正常結束（PLAN-063 子項 3）

## 元資料

- **工單編號**：T0823
- **類型**：implementation（worktree 隔離）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-04T02:02:42+0800
- **預估規模**：M

## 背景

T0820 實測：Windows 的 NSIS 安裝程式以 `Win32_Process.Path` 開頭為安裝目錄比對執行中的程序，`Stop-Process`（TerminateProcess）強制結束，BAT 主行程與 Terminal Server 都沒有正常結束路徑——沒有 flush-save（T0504）、server 沒跑 shutdown（pid / port / registry 檔留著，下次啟動走孤兒清理，pid 若被重用有誤殺風險）。electron-builder 提供 `customCheckAppRunning` 巨集（`node_modules/app-builder-lib/templates/nsis/include/allowOnlyOneInstallerInstance.nsh:5, 39-40`）可覆寫這一步；BAT 的 `build.nsis` 目前沒有 `include` / `script`。T0821 已做升級前提示與升級後說明（觸發：版本變＋孤兒清理 N ≥ 1）。

使用者決定把本項與 T0822 湊成一批後發 `0.7.4-pre.6`（D267）。

## 範圍

1. **研究並確認**（寫進回報）：`customCheckAppRunning` 在安裝程式與舊版解除安裝程式（覆蓋安裝時以 `--updated` 執行）各自何時被呼叫；per-user / per-machine（含 UAC inner instance）各走哪條；覆寫後如何回退到預設的 `_CHECK_APP_RUNNING` 邏輯（不得複製一份會隨 electron-builder 升版而過時的拷貝——若只能複製，寫明對應的 electron-builder 版本並加測試或檢查提醒）。
2. **安裝程式端**（`build/installer.nsh` 或等效，`build.nsis.include`）：偵測到 BAT 在執行 → 以安裝目錄裡的 `BetterAgentTerminal.exe` 帶一個專用參數（例 `--installer-quit-request`）啟動，讓執行中的實例經 single-instance 收到請求 → 等待安裝目錄下的程序全部結束（上限例 15 s，常數寫明）→ 仍有程序 → 回到預設的強制結束流程。
3. **BAT 端**（`electron/installer-quit-request.ts` 等）：收到請求 → 記錄「將被結束的終端數與 agent 分頁」到 userData 小檔（供新版啟動時顯示 T0821 的說明，見 memory_overrides 第 3 點）→ 走完整結束路徑（flush-save、停 Terminal Server、不跳關閉確認、不保留 server）→ 結束。第二個實例（帶參數者）不開視窗、不做其他事，立即退出。detached 視窗、remote profile 視窗也要一起正常關閉（沿用既有 quit 流程）。
4. **新版啟動**：T0821 的偵測合併「安裝程式要求結束」的紀錄——版本變＋（孤兒清理 N ≥ 1 **或** 有安裝程式結束紀錄）→ 顯示同一則說明、列 agent 分頁；紀錄只用一次。
5. **文件**：CLAUDE.md「升級結束終端的提示與說明」節更新（正常結束路徑、唯一實作、不變式）；`docs/agent-guide/upgrade-interruption.md`（另移除〈已知限制〉中「縮圖 ⏸ tooltip 仍寫因 Terminal Server 重啟而中斷」那一句——並行的 T0822 處理 tooltip、不改 docs）、`docs/agent-guide/packaging-release-checks.md`（NSIS include、升級 electron-builder 時要檢查的點）。

## 驗證

- 單元：參數辨識、請求處理（記錄內容、走完整結束、不跳確認）、新版偵測的合併規則（孤兒 / 紀錄 / 兩者皆無 / 版本相同）、紀錄只用一次；突變檢查。
- e2e（隔離 runtime、開發版 build，本機）：以第二個實例帶參數送出請求 → 主實例在上限內結束、Terminal Server 正常 shutdown（pid / port / registry 檔已清）、shell 結束；重開（改寫上次版本模擬升級）→ 顯示說明、N 正確；對照：不改版本 → 不顯示。
- **CI 實測（Windows runner）**：以 `desktop-build.yml -f ref=ct/T0823` 打出的安裝檔，在 `ct/T0823-probe` 的暫時 workflow 中：安裝 → 啟動 BAT＋shell 分頁（長命令）→ 以同一份安裝檔 `/S` 覆蓋安裝 → 記錄：主行程與 server 是正常結束（日誌有 `[installer-quit]`、server shutdown、pid 檔已清）而非 TerminateProcess、安裝 exit 0 與耗時、重開後顯示說明。對照：安裝 `v0.7.4-pre.5`（舊版不認得請求）執行中時，以新安裝檔覆蓋 → 逾時後回到強制結束、安裝 exit 0。互動安裝的畫面差異以推論或截圖說明。
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`；T0821 的 `upgrade-interruption` 單元與 e2e、`t0766` / `t0578` e2e 不回歸。

## 驗收

- [ ] 範圍 1 的研究結論（呼叫時機、回退方式、版本相依）
- [ ] 安裝程式端與 BAT 端實作、常數與日誌
- [ ] 新版啟動的說明在正常結束路徑也會出現
- [ ] 單元＋突變、本機 e2e（含對照）
- [ ] CI 實測兩組（新→新正常結束、舊版執行中→回退強制結束）的 run id 與結果；遠端 `ct/T0823`、`ct/T0823-probe` 已刪
- [ ] typecheck 0 / 0、unit、legacy、vite build、不回歸
- [ ] CLAUDE.md / docs 更新
- [ ] 隔離分支證據（head SHA、validated SHA）

---

## 回報區

（由 Worker 填寫）
