---
schema_version: 1
schema_kind: workorder
id: T0745
title: "NSIS 驗收腳本誤判：② 因 `Logs/bat-scripts.log` 變更判 FAIL（疑為腳本自己跑 helper `--version` 寫入）；查證原因並修正，本單只演練不安裝"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T20:06:13+0800"
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

- [ ] 變更來源查證結果寫在回報區（證據不含 log 內容全文與權杖）
- [ ] 腳本修正涵蓋 ② 與 ④；`-DryRun`（PS 7）跑過，列出 helper 指令與日誌導向位置
- [ ] PS 5.1 至少能通過語法解析（`[System.Management.Automation.Language.Parser]::ParseFile`）
- [ ] README 已補說明
- [ ] commit（只含 affects_files）

---

## 回報區

（Worker 填寫）
