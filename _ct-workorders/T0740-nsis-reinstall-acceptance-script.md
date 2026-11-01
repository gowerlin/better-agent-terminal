---
schema_version: 1
schema_kind: workorder
id: T0740
title: "NSIS 覆蓋安裝 / 解除安裝 / 乾淨重裝的獨立驗收腳本（以 v0.7.2-pre.8 安裝檔在本機驗；本單只寫腳本並跑不安裝的演練，實際執行由使用者關閉 BAT 後進行）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T17:35:39+0800"
started_at: ""
updated_at: "2026-11-01T17:35:39+0800"
completed_at: ""
depends_on: []
related:
  - "T0726 / D196（NSIS 關差分打包，exe 292.9 MiB）；CLAUDE.md「Packaging / Release 前置檢查」（**Release 驗收必跑 NSIS 完整重裝**）；`docs/agent-guide/packaging-release-checks.md`"
  - "`package.json` `build.nsis`：`oneClick: false`、`perMachine: false`、`allowToChangeInstallationDirectory: true`；本機目前安裝在 `C:\\Program Files\\BetterAgentTerminal`（helper `--version` = `v0.7.2-pre.8`）"
  - "GitHub release `v0.7.2-pre.8`（`gh release view v0.7.2-pre.8 -R gowerlin/better-agent-terminal`）"
affects_files:
  - "e2e/manual/nsis-reinstall-acceptance.ps1（新增，檔名可調；不在 Playwright `testMatch` 範圍）"
  - "e2e/manual/README.md（新增或補一段：用途、執行前提、步驟、輸出位置）"
  - docs/agent-guide/packaging-release-checks.md
  - _ct-workorders/T0740-nsis-reinstall-acceptance-script.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 本單 Worker 自己就在 BAT 分頁內執行：🔴 絕對不得實際執行安裝檔、解除安裝程式，不得結束任何 BetterAgentTerminal / node / Terminal Server 程序，不得改動 `C:\\Program Files\\BetterAgentTerminal` 與使用者 userData。只允許：寫腳本、下載安裝檔到暫存目錄、跑腳本的 `-DryRun`（只做唯讀檢查並印出將執行的步驟）。"
  - "🔴 腳本流程（實際模式，由使用者關閉 BAT 後在一般 PowerShell 執行）：⓪ 前置檢查：找出安裝狀態（登錄檔 uninstall 鍵在 HKLM 還是 HKCU、`InstallLocation`、`DisplayVersion`）；列出所有執行檔位於安裝目錄的程序（含 Terminal Server 的 node / 內嵌 claude / codex）→ 有任何一個就中止並列出（不自動結束，除非帶 `-StopRunning` 且再次確認）；userData（`%APPDATA%\\BetterAgentTerminal*`）先備份到時間戳目錄並記錄路徑。① 下載 `v0.7.2-pre.8` 的 Windows 安裝檔（`gh release download … -R gowerlin/better-agent-terminal`），以 release 內 `latest.yml` 的 sha512 驗證。② 覆蓋安裝（同版本）：依 ⓪ 的安裝範圍帶 `/S` ＋ `/allusers` 或 `/currentuser` ＋ `/D=<原路徑>`（electron-builder NSIS 參數，以文件 / 實測為準），計時；檢查 `DisplayVersion`、主程式與 `resources/scripts` 三個 helper `--version`、`resources/package.json`、內嵌 claude / codex 存在；userData 未被改動（設定檔雜湊比對）。③ 解除安裝（靜默）：計時；安裝目錄與 uninstall 鍵已移除、捷徑已移除、userData 保留。④ 乾淨重裝：同 ② 參數，計時，同 ② 檢查。⑤ 選做：啟動已安裝的 BAT 10 秒後正常關閉，檢查新的 debug log 沒有 `uncaughtException`。⑥ 輸出：一份 Markdown ＋ 一份 JSON（每步 PASS / FAIL、耗時、版本、檢查明細），寫到 `%TEMP%\\bat-nsis-acceptance-<YYYYMMDD-HHMMSS>\\`，並印出路徑。任何一步失敗：停下、寫報告、印出如何以備份還原 userData 與重新安裝的指令，不繼續後面步驟。"
  - "🔴 腳本規範：PowerShell 7 與 Windows PowerShell 5.1 都能跑（或在開頭檢查並說明）；`Set-StrictMode`、錯誤即停；所有時間取自系統；不寫入或印出任何權杖 / 認證；需要 UAC 時明確提示使用者。`-DryRun` 印出每一步將執行的指令與判讀規則，不改任何東西。不得修改 `package.json` / `build` 設定 / 產品程式碼。"
  - "🔴 演練（本單要做）：在本機以 `-DryRun` 跑一次，回報 ⓪ 的實際偵測結果（安裝範圍、路徑、版本、偵測到的執行中程序數 —— 現在 BAT 正在跑，預期會偵測到並示範『會中止』）、① 下載與 sha512 驗證結果、②–④ 將使用的實際參數。下載的安裝檔留在暫存目錄供使用者實跑時重用（腳本支援 `-InstallerPath`），路徑寫進回報區。"
  - "🔴 文件：`e2e/manual/README.md` 寫給使用者看的步驟（關閉 BAT → 確認 Terminal Server 也已結束 → 開一般 PowerShell → 執行指令 → 重開 BAT → 把報告路徑告訴塔台）；`docs/agent-guide/packaging-release-checks.md` 的 NSIS 重裝驗收段補一行指向腳本。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，腳本與文件不得寫死使用者家目錄或帳號（一律用環境變數）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0740 — NSIS 重裝驗收腳本

## 元資料

- **工單編號**：T0740
- **類型**：implementation（驗收工具）
- **優先級**：P2
- **建立時間**：2026-11-01T17:35:39+0800
- **預估規模**：M

## 背景

pre.6（T0726，NSIS 關差分打包）待驗 Windows NSIS 覆蓋安裝 / 解除安裝 / 乾淨重裝與安裝時間。本機沒有 Windows Sandbox；使用者要求直接以最新版（`v0.7.2-pre.8`）在本機驗。唯一的阻礙是安裝 / 解除安裝前 BAT 必須關閉，而塔台與 Worker 都在 BAT 內。因此本單寫一支獨立腳本：Worker 只做不安裝的演練；使用者關閉 BAT 後在一般 PowerShell 執行一次，自動完成全部步驟並輸出報告，重開 BAT 後交塔台判讀。

## 範圍

1. 腳本（⓪–⑥，含 `-DryRun`、`-InstallerPath`、`-StopRunning`）。
2. 本機 `-DryRun` 演練與下載驗證。
3. 使用說明與 docs 一行。

## 不做

- 不實際安裝 / 解除安裝、不結束任何 BAT 相關程序、不動安裝目錄與 userData。
- 不改打包設定與產品程式碼。

## 驗收

- [ ] 腳本完成，`-DryRun` 在本機跑過，⓪ 偵測結果正確、示範偵測到執行中程序會中止
- [ ] 安裝檔已下載並通過 sha512 驗證，路徑寫在回報區
- [ ] ②–④ 實際參數列出（含安裝範圍判斷依據）
- [ ] 使用說明（給使用者的步驟）

---

## 回報區

### 完成狀態

### 演練結果

### 給使用者的執行步驟

### 發現的問題

### 互動紀錄

### 回報時間
