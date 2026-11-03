---
schema_version: 1
schema_kind: workorder
id: T0820
title: "研究（PLAN-059 Q4）：NSIS 覆蓋升級時，執行中的 BAT 與 Terminal Server（含其中的 shell）會不會被結束"
type: research
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T01:17:22+0800"
started_at: "2026-11-04T01:18:10+0800"
updated_at: "2026-11-04T01:18:10+0800"
depends_on: []
related:
  - "PLAN-059（子項 D、Q4）；D265；T0740 / T0801（`e2e/manual/nsis-reinstall-acceptance.ps1`，前置條件是 BAT 已關閉）；T0540 / T0704（Terminal Server 程序樹、recovery）；T0578（Recovery 提示）；T0783 / T0797（只 build 不發布、手動驗收 workflow 的前例）"
affects_files:
  - _ct-workorders/T0820-research-nsis-upgrade-running-terminal-server.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 研究型：只查證、不修。main 上唯一可改的是本工單（回報區）；不得 commit 產品程式、測試、文件、或 main 上的 workflow。結論寫給塔台判斷 PLAN-059 子項 D 的價值，由塔台決定是否開子 PLAN。"
  - "🔴 絕對不在本機實測：本機 Windows 正在使用的 BAT 安裝版（`C:\\Program Files\\BetterAgentTerminal`）不得重裝、升級、解除安裝、關閉，不得結束它或它的 Terminal Server；不執行任何 BAT 安裝檔、不跑 `nsis-reinstall-acceptance.ps1`。本機只做靜態分析（讀 `node_modules/app-builder-lib` 的 NSIS 模板、`package.json` `build` 設定、BAT 原始碼）。"
  - "🔴 實測只在 GitHub Actions Windows runner：授權 push 分支 `ct/T0820`（自 `main` 開出），分支上可新增一個**暫時的** workflow（`on: push: branches: [ct/T0820]`，因 `workflow_dispatch` 須在預設分支才能觸發），只做驗收、不建 tag / Release / Pages、不帶任何 secret（`GITHUB_TOKEN` 唯讀即可下載公開 release）。驗完刪遠端 `ct/T0820`；本機分支保留給塔台判斷。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 L185：只開 shell 分頁，不開 claude / codex 分頁、不對 agent TUI 送按鍵、不登入任何服務。回報不記權杖或環境變數值（只記名稱），不寫家目錄真實路徑或帳號名（D176）。實測不到的部分標「推論」。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版。Git（main）：只 commit 本工單（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0820 — 研究：NSIS 覆蓋升級時執行中的 Terminal Server（PLAN-059 Q4）

## 元資料

- **工單編號**：T0820
- **類型**：research（靜態分析＋CI 實測，不修）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-04T01:17:22+0800
- **預估規模**：M

## 背景

PLAN-059 子項 D 借鏡 Herdr 的 holder 模型（每個終端一個 holder，core 可單獨重啟 / 更新）。它的價值取決於 Q4：**使用者在 BAT 開著（含 Terminal Server 與其中的 shell / agent）時執行新版 NSIS 安裝檔，這些程序會不會被結束？** 歷次 NSIS 驗收（T0740 / T0801 腳本）都要求先關閉 BAT，沒有測到這個情況。

塔台推論（未驗證）：Terminal Server 以 `process.execPath`（同一個 `BetterAgentTerminal.exe`，`ELECTRON_RUN_AS_NODE`）fork；electron-builder 的 NSIS 安裝程式會偵測並結束執行中的 app，且 Windows 上執行中的 exe 不能覆寫，所以推論「會被結束」。另外 Terminal Server 存活時 BAT 重開會出現 Recovery 提示（T0578），升級後若 server 被殺，重開就沒有可還原的 PTY。

## 研究問題

1. **靜態**：electron-builder 26.x 的 NSIS 模板（`allowOnlyOneInstallerInstance.nsh`、`installUtil` / `CHECK_APP_RUNNING` 等）如何偵測、提示、結束執行中的 app？比對的是程序名稱、路徑、還是其他條件？互動安裝與 `/S` 靜默安裝的差別？`package.json` 的 `build.nsis` 設定（`oneClick`、`perMachine`、`allowElevation` 等）會走哪條路？覆蓋安裝時舊版解除安裝程式（`uninstallOldVersion`）的角色？BAT 有沒有自動更新（electron-updater 或其他）路徑，有的話它的流程。
2. **實測**（Windows runner）：安裝 `v0.7.4-pre.4`（NSIS，`/S`；範圍選一種並寫明）→ 以隔離方式啟動 BAT（可用 Playwright `_electron.launch` 指向安裝版 exe 與 `--runtime=<id>`，比照 `e2e/fixtures/electron-isolation.ts`），開 shell 分頁並在其中跑一個長命令（例 `ping -t 127.0.0.1` 或 node 計時器）確認 Terminal Server 存活 → **BAT 主視窗仍開著**時執行 `v0.7.4-pre.5` 安裝檔 `/S` → 記錄：安裝程式 exit code、耗時；主行程、Terminal Server、shell、長命令四者是否存活（pid 前後）；安裝結果的 FileVersion。再做一輪「主行程已關閉、保留 Terminal Server（關閉確認選保留，或等效作法）」的情境，看 server 與 shell 是否存活、升級後重開是否出現 Recovery 提示、能否還原。
3. **互動安裝**（推論即可，能實測更好）：使用者雙擊安裝檔時看到什麼（「app 正在執行，請關閉」對話框？自動結束？）。
4. **結論**：Q4 的答案（會 / 不會 / 視情況），對使用者的影響（升級會中斷哪些東西），以及對 PLAN-059 子項 D 的意涵：holder 模型或更小的替代（例：升級前提示、升級後 Recovery 說明、Terminal Server 放在安裝目錄外）是否值得做、大致規模。

## 不做

- 不修程式、不改 main 上的任何檔案（本工單除外）；不開 BUG / PLAN（塔台依結論處理）；不碰本機 BAT 安裝；不發版。

## 驗收

- [ ] 靜態分析：NSIS 偵測 / 結束 app 的機制（附檔案與行號）、`build.nsis` 設定、互動 vs 靜默、自動更新路徑有無
- [ ] CI 實測：workflow run id、兩個情境（主視窗開著 / 只剩 Terminal Server）的四項程序存活結果、安裝 exit code、Recovery 提示有無
- [ ] 遠端 `ct/T0820` 已刪（附指令輸出）
- [ ] Q4 結論與對子項 D 的建議（含替代方案與規模）

---

## 回報區

（由 Worker 填寫）
