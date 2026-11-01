---
schema_version: 1
schema_kind: workorder
id: T0745
title: "NSIS 驗收腳本誤判：② 因 `Logs/bat-scripts.log` 變更判 FAIL（疑為腳本自己跑 helper `--version` 寫入）；查證原因並修正，本單只演練不安裝"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T20:06:13+0800"
started_at: "2026-11-01T20:06:54+0800"
updated_at: "2026-11-01T20:09:51+0800"
completed_at: "2026-11-01T20:09:51+0800"
session_ids:
  - "01ecc28d-7466-4bad-8e29-819f36778eda"
depends_on: []
related:
  - "T0740（腳本 `e2e/manual/nsis-reinstall-acceptance.ps1`、`e2e/manual/README.md`）"
  - "使用者 2026-11-01 20:02 實跑報告：`%TEMP%\\bat-nsis-acceptance-20261101-200229\\report.md` / `report.json`（pre.8 → pre.9；⓪ WARN 版本不同屬預期、① PASS、② FAIL：唯一失敗項 `userData 未被改動` = 變更 1 檔 `BetterAgentTerminal\\Logs\\bat-scripts.log`；③ / ④ 未跑）"
  - "CLAUDE.md「Remote Tower 通知」節：helper 測試須設 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 到 temp；`scripts/_bat-logger.mjs` 的 userData 解析順序（T0481）"
affects_files:
  - e2e/manual/nsis-reinstall-acceptance.ps1
  - e2e/manual/README.md
  - _ct-workorders/T0745-nsis-acceptance-script-log-false-fail.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 本單 Worker 在 BAT 分頁內執行：🔴 絕對不得實際執行安裝檔或解除安裝程式，不得結束任何 BetterAgentTerminal / node / Terminal Server 程序，不得改動 `C:\\Program Files\\BetterAgentTerminal` 與使用者 userData（`Logs/bat-scripts.log` 因一般 helper 呼叫而 append 屬正常使用，可以）。只允許：改腳本與 README、跑腳本的 `-DryRun`、唯讀讀取上列報告檔。"
  - "🔴 先查證再改：以唯讀方式確認 `Logs/bat-scripts.log` 的變更來源（例：只比對該檔大小與最後幾筆紀錄的 `script` / `event` 欄位與時間是否落在 ② 的 helper `--version` 檢查時間；不得把整份 log 或任何權杖貼進回報區）。查證結果寫進回報區：是腳本自己造成 → 照下方修；不是 → 停下，以 ct-exec § Questions For Tower 問塔台。"
  - "🔴 修正方向（塔台建議，Worker 可依查證結果調整並說明）：腳本跑 helper `--version` 時把 helper 的日誌導到報告目錄（`BAT_HELPER_LOG_DIR` 等 helper 實際認得的變數，以 `scripts/_bat-logger.mjs` 為準；只對該子程序設定，不改使用者環境），讓檢查本身不寫 userData；userData 比對規則維持嚴格（不得整個排除 `Logs/`）。若 helper 沒有可用的導向方式，改為：helper 檢查移到 userData 快照比對之後，或對 `Logs/bat-scripts.log` 只接受「純 append、且新增內容都來自本腳本的 helper 呼叫」並在報告中以 INFO 列出。② 與 ④ 兩處都要涵蓋。"
  - "🔴 不改其他判讀規則；不改 `package.json` / 打包設定 / 產品程式碼 / helper 腳本。README 補一行說明（helper 檢查不會寫入 userData，或 bat-scripts.log 的判讀方式）。演練：`-DryRun` 跑一次（PS 7），回報將執行的 helper 指令與日誌導向位置。重跑時 `-Version 0.7.2-pre.9` 對已安裝的 pre.9 是真正的同版本覆蓋，README 若有需要補這點。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報區與腳本不寫使用者家目錄（寫 `%TEMP%` / `<使用者資料夾>`）。yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。Git：只用 `git commit --only` commit 自己改的檔案；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。不 push、不發版。"
---

# T0745 — NSIS 驗收腳本誤判 bat-scripts.log

## 元資料

- **工單編號**：T0745
- **類型**：implementation（驗收工具修正）
- **優先級**：P2
- **建立時間**：2026-11-01T20:06:13+0800
- **預估規模**：S

## 背景

使用者 20:02 依 T0740 腳本實跑 pre.8 → pre.9 升級。② 的實質檢查全部 PASS（exit 0、DisplayVersion / FileVersion / `resources/package.json` / 三個 helper `--version` = pre.9、內嵌 claude / codex、捷徑、無並存安裝、未自動啟動），唯一 FAIL 是 userData 逐檔 SHA-256 比對發現 `Logs/bat-scripts.log` 變更。塔台推論：腳本在快照之後、比對之前自己以 node 執行三個 helper `--version`，helper 會寫這個檔 → 腳本自己造成的誤判（未查證）。腳本依設計在 ② 停下，③ 解除 / ④ 乾淨重裝沒跑。

## 範圍

1. 查證 `bat-scripts.log` 變更來源。
2. 修正腳本，讓 helper 檢查不影響 userData 比對（② / ④）。
3. README 補說明；`-DryRun` 演練。

## 不做

- 不實際安裝 / 解除安裝、不結束 BAT 相關程序。
- 不放寬 userData 比對（不得整個排除 `Logs/`）。
- 不改產品程式碼、helper、打包設定。

## 驗收

- [x] 變更來源查證結果寫在回報區（證據不含 log 內容全文與權杖）
- [x] 腳本修正涵蓋 ② 與 ④；`-DryRun`（PS 7）跑過，列出 helper 指令與日誌導向位置
- [x] PS 5.1 至少能通過語法解析（`[System.Management.Automation.Language.Parser]::ParseFile`）
- [x] README 已補說明
- [x] commit（只含 affects_files）

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-01T20:09:51+0800
- **session_id**：01ecc28d-7466-4bad-8e29-819f36778eda

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於 REPO_ROOT 下 → PASS；C-3：`e2e/manual/*` 兩檔存在 → PASS；C-2：工單無 `branch` 欄位（目前 `main`）
- 不在 worktree（`CT_HOME` 未設）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 變更來源查證（唯讀）

結論：**是腳本自己造成**（helper `--version` 寫入），照塔台建議方向修正。

證據（只比對大小、雜湊與 `ts` / `script` / `event` / argv 是否含 `--version`，未貼 log 內容）：

1. 報告 `%TEMP%\bat-nsis-acceptance-20261101-200229\report.json`：⓪ 20:02:29 取快照；② 20:03:05 開始、耗時 11.4 s，報告 `finishedAt` 20:03:18；② 唯一 FAIL = `userData 未被改動`（新增 0 / 刪除 0 / 變更 1）。
2. ⓪ 備份的 `bat-scripts.log` = 444040 bytes；目前檔案的前 444040 bytes SHA-256 與備份**完全相同** → 快照後是**純 append**。
3. 快照之後最先 append 的兩筆：`2026-11-01T12:03:17.704Z`（= 20:03:17 +0800）`bat-terminal` / `invoke`、argv 只有 `--version`；`12:03:17.778Z` `bat-notify` / `invoke`、argv 只有 `--version`。兩筆的 `env` 都沒有 BAT_* → 在 BAT 外執行，落到 `_bat-logger.mjs` 第 3 順位（`%APPDATA%\BetterAgentTerminal\Logs`）。時間落在 ② 的 helper 檢查之後、userData 比對（20:03:18 前）之前。
4. 下一筆 append 是 `12:03:29Z`（20:03:29，`remote-server` / `report-hook`），在報告結束之後（使用者重開 BAT）；20:02:29–20:03:17 之間沒有其他寫入。
5. `bat-mcp.mjs --version` 不寫 log（只有前兩個 helper 寫）。

### 修正內容

- `e2e/manual/nsis-reinstall-acceptance.ps1`
  - `Invoke-Helper`：執行 helper 時，只在該子程序期間（本腳本程序的 Process 範圍，`finally` 還原）設 `BAT_HELPER_LOG_DIR=<報告目錄>\helper-logs`（`scripts/_bat-logger.mjs` 第一優先，只接受絕對路徑）；原本的 `ELECTRON_RUN_AS_NODE` 也併入同一個設定 / 還原流程。不改使用者環境。
  - `$OutDir` 建立後轉成絕對路徑（`-OutputRoot` 若給相對路徑，`BAT_HELPER_LOG_DIR` 會被 helper 忽略而又寫回 userData），`$BackupDir` 隨之重算。
  - `Test-InstalledState`（② / ④ / 演練的 ②p 共用）：每個 helper 加一行 note 記錄實際指令與子程序環境；結束後記錄導向的 log 檔與本步驟新增行數。
  - ② 的演練說明加一行導向說明（註明 ④ 相同）。
  - userData 比對規則不變（仍逐檔 SHA-256 + 大小，沒有排除 `Logs/`）；其他判讀規則不變。
- `e2e/manual/README.md`〈判讀注意〉補兩行：helper 檢查不寫入 userData（與 `bat-scripts.log` 仍變更時的意義）；`-Version` 與已安裝版本相同才是真正的同版本覆蓋（例：已裝 pre.9 重跑帶 `-Version 0.7.2-pre.9`）。

### 驗證

| 證據道 | 結果 | 內容 |
|---|---|---|
| 演練（PS 7） | PASS | `pwsh -NoProfile -ExecutionPolicy Bypass -File e2e\manual\nsis-reinstall-acceptance.ps1 -DryRun -Version 0.7.2-pre.9 -InstallerPath <上次下載的 pre.9 安裝檔> -OutputRoot <scratchpad>` → 整體 `DRYRUN`、exit 0。⓪「沒有從安裝目錄執行的程序」FAIL（BAT 執行中，演練只記錄、實際模式會中止，屬預期）；① SHA-256 / 大小 PASS；②p 3 個 helper `--version` PASS |
| helper 指令與導向 | PASS | `"<node>" "C:\Program Files\BetterAgentTerminal\resources\scripts\bat-terminal.mjs" --version`（`bat-notify.mjs`、`bat-mcp.mjs` 同），子程序環境 `BAT_HELPER_LOG_DIR=<報告目錄>\helper-logs`；導向檔 `<報告目錄>\helper-logs\bat-scripts.log` 新增 2 行（`bat-terminal` / `bat-notify` 的 `invoke --version`） |
| userData 未被 helper 寫入 | PASS | 演練開始後 userData `bat-scripts.log` 新增 2 筆，都是 BAT 本身的活動，含 `--version` 的 = 0 |
| PS 5.1 語法解析 | PASS | `[System.Management.Automation.Language.Parser]::ParseFile` 於 PS 5.1.28000.3365：parse errors = 0 |
| 實際安裝 / 解除安裝 | 未執行 | 依工單禁止；需使用者在 BAT 關閉後重跑實際模式驗證 ② / ③ / ④ |

### Commit

- 產品（驗收工具）：`ae6b4f84` fix(e2e): redirect helper --version log out of userData in NSIS acceptance (T0745)（只含 `e2e/manual/nsis-reinstall-acceptance.ps1`、`e2e/manual/README.md`）
- 工單：本次回報 commit（只含本工單檔）
- 未 push、未發版

### 偏離與遭遇問題

- 無偏離。修正採塔台建議的第一方案（helper 有可用的導向變數，不需要退回「移後檢查」或「append 白名單」）。
- 注意：使用者重跑實際模式時，若 BAT 未完全關閉，BAT 本身（`remote-server` / `bat-hook`）仍會寫 `bat-scripts.log`，那時的 FAIL 是真實訊號（README 已說明），不是本單範圍的誤判。

### 後續建議

- 使用者重跑實際模式（已裝 pre.9：`-Version 0.7.2-pre.9 -InstallerPath <上次下載的 pre.9 安裝檔>`），完成 ② / ③ / ④ 驗收；報告的 ② / ④ 會多出 helper 指令與導向的 note。

### 互動紀錄

- 無（yolo，未向塔台提問）。
