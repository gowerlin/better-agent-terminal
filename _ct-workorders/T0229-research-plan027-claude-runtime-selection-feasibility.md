# 工單 T0229 — PLAN-027 研究:Claude Runtime 選擇機制可行性調查

## 元資料

- **工單編號**:T0229
- **任務名稱**:Claude Runtime 選擇機制(內嵌 SDK vs 系統 CLI)的可行性研究 + 隱藏陷阱盤點 + 細化拆單建議
- **類型**:research(互動型,非 yolo)
- **狀態**:🔄 IN_PROGRESS
- **建立時間**:2026-04-22 11:55 (UTC+8)
- **派發時間**:2026-04-22 11:56 (UTC+8) — 剪貼簿指令寫入,等使用者新開 session 貼上
- **開始時間**:2026-04-22 12:10 (UTC+8)
- **派發模式**:`--mode on`(非 yolo;Worker 允許**最多 3 輪**與使用者互動釐清方向)
- **互動旗標**:`--interactive`
- **預估工時**:45-90 min(視互動輪數 + 實際 POC 驗證深度)
- **優先級**:🟡 Medium(PLAN-027 啟動工單)
- **Renew 次數**:0
- **關聯**:
  - **所屬 PLAN**:PLAN-027(Claude Runtime 選擇機制)
  - **先前對齊**:PLAN-027 已完成 Q1-Q7 需求對齊
  - **參考**:CLAUDE.md 專案規則「Claude Agent SDK / CLI」段、`electron/claude-agent-manager.ts`

## 背景

PLAN-027 對齊決議(摘要):
- 預設內嵌 SDK(保底)、Advanced 頁 opt-in 切系統版
- 路徑來源:PATH 自動偵測為主,可覆寫為自訂路徑
- Fallback:系統版不可用時自動回內嵌 + toast 通知
- 生效時機:每個新 session 啟動時讀取(舊 session 不變)
- 顯示:內嵌版號 + 偵測到的系統版號並列

**本研究工單的目的**:在動手實作前,先回答幾個關鍵未知數,避免拆單後才發現根本做不出來或有重大成本陷阱。

---

## 研究問題清單

### R1:Child_process 模式是否可接 Agent SDK transport?

- `@anthropic-ai/claude-agent-sdk` 的 transport 層是否支援指向外部 `claude` binary 而非內嵌?
- 若不支援官方方式,是否有 workaround(例如自己 spawn child_process + 手動 wire stdio)?
- stdio streaming(stdout/stderr/stdin)在 child_process 模式下 vs 內嵌,效能差異如何?(latency / throughput / memory)
- **產出**:可行 / 有限制可行 / 不可行,若後兩者列具體技術限制

### R2:`claude` binary 偵測策略(跨平台)

- Windows:PATH 偵測 + 空格 / 中文路徑 / PowerShell vs cmd / `.cmd` wrapper 的處理
- macOS:PATH + Gatekeeper(未簽章 binary 的行為)+ `/opt/homebrew/bin` vs `/usr/local/bin`
- Linux:PATH + symlink chains
- 常見安裝路徑清單(給使用者指定路徑的 placeholder 建議)
- **產出**:三平台各自的偵測流程虛擬碼 + 邊界情況對照表

### R3:版號 parse 與健康檢查

- `claude --version` 輸出格式穩定嗎?歷史版本有變過嗎?
- 需要支援的版號範圍(最低相容版本 vs 當前內嵌版 2.1.113)
- 健康檢查要做到什麼程度才算「可用」?
  - Level A:binary 存在 + 可執行
  - Level B:A + `--version` 成功 parse
  - Level C:B + 簡單 echo test(例如 `echo test | claude ...`)
- **產出**:推薦 Level + 實際驗證腳本草稿

### R4:隱藏陷阱盤點

- **Auth token 傳遞**:使用者的系統 `claude` 可能讀不同的 token 來源(`~/.config/anthropic/`、`ANTHROPIC_API_KEY` env、keyring);內嵌 SDK 走的是什麼路徑?切換會不會無縫?
- **Working directory**:child_process 繼承 parent cwd,但系統 `claude` 可能對 cwd 有特殊假設(例如 `.claude/settings.json` 搜尋)
- **Environment variables**:`ANTHROPIC_*` 等環境變數透傳策略(PLAN-027 R4 已列)
- **Session state**:兩種 runtime 共用 sessions 嗎?切換 runtime 會不會丟失當前 session?
- **Signal handling**:child_process 被殺(SIGKILL)時,agent 狀態如何清理?
- **產出**:陷阱清單 + 對應緩解策略

### R5:細化拆單建議

根據 R1-R4 的發現,**修正或細化** PLAN-027 既有的 7 張工單拆解:

- 哪些拆單建議仍然正確?
- 哪些需要細分 / 合併 / 重排依賴?
- 是否出現新工單(例如「token migration」或「session state isolation」)?
- 是否出現原本沒想到的 blocker,要另開 spike 工單?

---

## Scope(Worker 可做的事)

1. **讀原始碼**:
   - `@anthropic-ai/claude-agent-sdk` node_modules 內的 transport 層實作(或 GitHub 公開 repo)
   - `@anthropic-ai/claude-code` binary 的 CLI interface
   - 本專案 `electron/claude-agent-manager.ts` 確認 BAT 目前是怎麼接 SDK 的
2. **查官方文件**:Anthropic 官方的 SDK / CLI docs,特別是 transport / auth / version 章節(用 context7 MCP 或 web fetch)
3. **可選 POC**:若 R1 不確定,允許 Worker 寫 minimal POC(例如 10-20 行 spawn `claude --version` 並 parse 輸出),**不污染本 repo**(放 `_tmp/` 或直接內嵌報告)
4. **與使用者互動**:最多 3 輪,釐清:
   - 不確定的方向選擇(例如「R3 要 Level B 還是 Level C?」)
   - 是否要做 POC
   - 拆單粒度偏好
5. **產出**:研究報告 + 細化拆單建議

## Acceptance Criteria

- [ ] AC-1:研究報告涵蓋 R1-R4 全部,每個 R 都有「結論 / 技術細節 / 限制 / 推薦做法」四段
- [ ] AC-2:R5 細化拆單建議完整,含每張工單的:編號建議、scope 摘要、預估工時、依賴
- [ ] AC-3:報告中明列所有「不確定 / 需後續 spike 驗證」的點,不假裝懂
- [ ] AC-4:互動紀錄完整(Worker 問了什麼 / 使用者答了什麼)
- [ ] AC-5:Worker yolo 模式關閉下的正常 commit(非 yolo,等使用者最終確認收尾)

## 產出位置

- **研究報告**:`_ct-workorders/_report-plan027-claude-runtime-selection.md`(200-400 行,視深度)
- **拆單建議**:直接寫在研究報告末段,或更新 PLAN-027 的「初步拆單建議」章節(Worker 可詢問偏好)

## 驗收依據

- 塔台讀研究報告,確認 R1-R5 全覆蓋
- 特別檢查 R3 推薦 Level 是否可落地(過於嚴格 → 實作成本爆;過於寬鬆 → fallback 頻繁觸發)
- R5 拆單建議對比 PLAN-027 原拆單,差異處要有理由

## 風險與備註

- **風險 1**:Worker 可能越界開始實作 → Scope 明確寫「研究 + 可選 POC」,實作留給後續工單
- **風險 2**:R1 若結論是「不可行」→ PLAN-027 整個要重新規劃(或 Drop),這是本研究最核心的價值
- **風險 3**:Worker 互動太多輪(>3)耗時間 → 硬上限 3 輪,超過要回塔台 Renew

---

## 回報區

### 完成狀態

✅ DONE

### 研究結論摘要(R1-R5)

- **R1(SDK transport)**:✅ 完全可行,SDK v0.2.113 官方支援 `pathToClaudeCodeExecutable` option(`sdk.d.ts:1406`),BAT 現有程式碼(`claude-agent-manager.ts:669, 1348, 2227`)已用此 option 指向內嵌 binary,**切換系統版只是把 path 字串換成偵測結果**,核心 routing 邏輯幾乎為零。stdio transport 內嵌 vs 系統版完全一致(SDK 內部一律 child_process.spawn),latency / throughput 不會有差。
- **R2(跨平台偵測)**:✅ 可直接複用 `electron/node-resolver.ts` 模式(PATH 搜尋 → 常見路徑 fallback)。Windows 額外處理 `.cmd`/`.bat` shim,優先選 `.exe`(避免 Node `.cmd` CVE 行為)。三平台共用一套程式碼 + 平台分支處理副檔名與常見路徑(macOS `/opt/homebrew/bin`、Linux `~/.local/bin`)。空格/中文路徑無需特別處理(Node fs API 走 UTF-16,SDK spawn 自動 quote)。
- **R3(版號 parse)**:✅ Level B(`--version` 成功 parse)。實測本機三條 binary 輸出格式完全一致:`<semver> (Claude Code)`,單行、無顏色 escape、無 stderr 雜訊。Parse regex `/^(\d+\.\d+\.\d+(?:-\w+)?)\s+\(Claude Code\)/`。版號相容範圍:`>= 2.0.0` 接受、`< 2.1.111` 加 warning badge、`< 2.0.0` 拒絕切換。
- **R4(隱藏陷阱)**:✅ 9 個陷阱全有現成緩解。最重要 3 個:(a)Auth/env 完全繼承 `process.env`,系統 claude 自走原生 auth chain,BAT 不介入;(b)session state 共用性需 spike 驗證(同 cwd → 同 hash → 同 transcript 目錄,理論可 resume,實機要測);(c)Windows `.cmd` shim 偵測時優先選 `.exe` 避開 spawn quoting 風險。
- **R5(拆單建議)**:✅ 收斂為 **5 張**(原 7 張),總估時 **3h 40min**(原 4-5h)。合併理由:R1 證實 routing 是 1-3 行差別,fallback 是 catch + IPC emit,Settings schema 只是 interface + key,各自單獨拆單 ceremony 比實作還重。詳見報告 R5 章節新拆單表。

### 研究報告路徑

`_ct-workorders/_report-plan027-claude-runtime-selection.md`(498 行)

### 互動紀錄

[12:13] Q: R3 健康檢查 Level / R4 Auth-env 策略 / R5 拆單粒度三選擇 → A: Level B + 繼承 env + 收斂為 5 張 → Action: 採用全部三項推薦,撰寫研究報告

(1 / 3 輪互動,未用滿上限)

### 回報時間

2026-04-22 12:20 (UTC+8)

### Commit hash

(待 Step 8 commit 後填入)

### Renew 歷程

無。
