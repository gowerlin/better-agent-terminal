---
schema_version: 1
schema_kind: workorder
id: T0860
title: "PLAN-065 W4：安裝程式與解除安裝整合（升級時只結束主行程、保留 holder；先結束安裝目錄下的內嵌 claude 並記錄；idle 延長 24 h；--uninstall-quit-request；紀錄 schema 2）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-065
priority: P2
sizing: M
created_at: "2026-11-04T18:28:20+0800"
depends_on: [T0857, T0859]
related:
  - "PLAN-065；D286（D3 內嵌 claude 先結束並記錄、D7 安裝程式觸發時 idle 延長到 24 h、D2 依範圍）；T0856 回報區〈調查結論〉Q4 與〈建議下一步〉W4；T0823（`InstallerQuitController`、`build/installer.nsh`）；T0821 / T0846（`detectUpgradeInterruption`）；T0766（被中斷的 agent 分頁）；T0825（第二個實例不跑 whenReady）"
affects_files:
  - _ct-workorders/T0860-installer-quit-keeps-pty-holder.md
  - electron/installer-quit-request.ts
  - electron/main.ts
  - build/installer.nsh
  - electron/upgrade-interruption.ts
  - electron/__tests__/
  - e2e/
  - docs/agent-guide/upgrade-interruption.md
  - CLAUDE.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 兩條路都要守住：Terminal Server 正在從有效的 holder 執行 → 新行為；沒有 holder（zip、開發模式、holder 缺少或不符、macOS / Linux）→ T0823 原行為逐字不變（完整 quit、`stopTerminalServerGracefully`、不跳確認、Windows 不用 SIGTERM）。既有 source guard（`installer-quit-request.test.ts`、`second-instance-startup.test.ts`、`upgrade-interruption.test.ts`）照舊通過，新增的分支另寫測試。"
  - "🔴 版本 N 的解除安裝程式會在 N+1 升級時執行、N+1 的安裝程式會對已安裝的 N 送 quit 請求（T0856 Q4「解除安裝」列）：這兩段行為在 N 發佈後就改不了。`${isUpdated}` 為真（升級時舊版的解除安裝）→ 不停 holder、不刪 holder 目錄；為假（真的解除安裝）→ 先請 holder 正常結束，逾時才以路徑前綴強制結束，再刪 holder 根目錄。範本的 `_CHECK_APP_RUNNING` 原樣插入、不複製（T0823 規則）。"
  - "🔴 內嵌 claude（D3）：結束前只結束分頁程序樹中執行檔在安裝目錄下的程序（以路徑判斷，不以名稱），記下 tab id 與 claude session（沿用 `claudeSessionPersistence`），升級後列進 `InterruptedAgentsStore`（`cause: 'upgrade'`，沿用 T0766 一鍵接回）；🔴 shell 與其他程序不得被結束；不自動 resume、不通知塔台。"
  - "🔴 日誌 `[installer-quit]` / `[upgrade-interruption]` 只記數量與結果，不記路徑內容以外的資訊、不記權杖。child_process 規則照 CLAUDE.md。yolo：不得問使用者；問題問塔台。不發版、不 push、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。不碰本機 BAT 安裝版，不執行任何安裝檔。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0860 — PLAN-065 W4：安裝程式與解除安裝整合

## 元資料
- **工單編號**：T0860｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 18:28 (UTC+8)
- **規模**：M｜**決策**：D286｜**依賴**：T0857（idle 延長請求、權杖）、T0859（判斷 server 是否從 holder 執行）

## 背景
T0823 讓安裝程式先請 BAT 正常結束，結束時連 Terminal Server 一起停。有 holder 之後，安裝程式觸發的 quit 應只結束主行程、保留 holder；但分頁裡執行檔在安裝目錄下的程序（內嵌 claude）仍會被安裝程式結束，BAT 要先自己結束並記錄，避免安裝程式等滿 15 s 又跳「正在執行」對話框。細節見 T0856 回報區 Q4。

## 任務
1. `InstallerQuitController`：server 從有效 holder 執行時 `shouldStopServer = false`；送 T0857 的延長 idle 請求（D7：24 h）；結束前處理內嵌 claude（D3）並寫紀錄。
2. `runInstallerQuitWithoutApp`：holder 版不停 holder。
3. 新參數 `--uninstall-quit-request`（與 `--installer-quit-request` 分開）：請 holder 正常結束；第二個實例的規則照 T0823 / T0825（whenReady 開頭 return）。
4. `build/installer.nsh`：`customCheckAppRunning` 在 `un.` 環境依 `${isUpdated}` 選參數；新增 `customUnInstall`（非 `--updated` → 停 holder、刪 holder 根目錄）。holder 根目錄規則以 T0858 為準（`BAT-PtyHolder`，per-user `$LOCALAPPDATA`、per-machine `$PROGRAMFILES64`；前綴衝突時不碰；見 `docs/agent-guide/packaging-release-checks.md`「Windows PTY holder 打包」）。只刪**本次安裝範圍**的根目錄；另一個範圍留下的根目錄不刪（回報區寫明已知限制）。T0823 的標記檔邏輯照舊（舊版沒有標記就不送請求）；新請求也要有對應的標記檔，讓舊版不會把新參數當成開新視窗。
5. `installer-quit-record.json` schema 2：`holderKept`、holder pid、`endedPtys`、`endedAgentProcesses`；`takeInstallerQuitRecord` 讀 schema 1 與 2。`detectUpgradeInterruption` 依 schema 2 調整觸發（接回成功時的 toast 文字由 W5 做；本單只確保資料正確、schema 1 行為不變）。
6. 測試：兩條路、`isUpdated` 分支（source guard）、內嵌 claude 判斷（只比路徑）、紀錄 schema 1 / 2、`--uninstall-quit-request`。T0823 的 e2e 擴成有 holder 與沒有 holder 兩種，做不到的列〈待 W6 驗收〉。
7. 文件：`docs/agent-guide/upgrade-interruption.md` 補 holder 版流程；`CLAUDE.md`「升級結束終端的提示與說明」節補必守規則（`isUpdated` 分支、兩條路）。

### 驗收條件
- [ ] 上述測試通過；T0823 / T0825 / T0846 相關測試不回歸
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [ ] 回報區列出 N → N+1 升級、真的解除安裝、降級三種情況下各個 NSIS 掛點與 BAT 的實際動作順序
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
