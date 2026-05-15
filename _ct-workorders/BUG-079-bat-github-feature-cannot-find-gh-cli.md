---
schema_version: 1
schema_kind: bug
id: BUG-079
title: BAT GitHub 功能找不到 gh CLI，但 gh 已安裝於 C:\Program Files\GitHub CLI\gh.exe (v2.92.0)
status: CLOSED
severity: medium
created_at: "2026-05-15T10:40:00+08:00"
---
# BUG-079 — BAT GitHub 功能找不到 gh CLI（PR / Issue 情境）

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-079 |
| 標題 | BAT 內部的 GitHub 操作（PR / Issue）回報「找不到 gh」，但系統實際已安裝 GitHub CLI v2.92.0 於 `C:\Program Files\GitHub CLI\gh.exe`，使用者於外部 shell `where gh` 可正確解析 |
| 嚴重度 | 🟡 Medium（有 workaround：在 BAT 外部 shell 操作；GitHub 功能在 BAT 內無法直接使用） |
| 可重現 | 100%（每次嘗試 BAT 內 GitHub PR / Issue 功能皆失敗） |
| Workaround | 在外部 Windows Terminal / PowerShell 內手動執行 `gh` 指令 |
| 狀態 | ✅ CLOSED（T0353 audit FAIL → 塔台補 zh-CN i18n `a3dfc84` → i18n test 22/22 PASS） |
| 建立時間 | 2026-05-15 10:40 (UTC+8) |
| 報告者 | 使用者（session 43 起手） |
| 觸發情境 | PR / Issue 操作（如 `gh pr create`、`gh issue list` 等） |
| 環境 | Windows 11 Pro Workstations, BAT_SESSION=1, GitHub CLI 2.92.0 (2026-04-28) |
| 相關 BUG | （待調查，可能與 PATH 環境變數注入或 child_process spawn 設定有關，類似 BUG-059 模式） |
| 相關工單 | T0351（research）/ T0352（fix `519c567`）/ T0353（audit `6f37402`）/ 塔台 chore `a3dfc84`（zh-CN i18n 補齊） |
| closed_at | 2026-05-15 11:35 (UTC+8) |

## 現象

### 觸發步驟

1. 在 BAT 內部終端（`BAT_SESSION=1`）嘗試使用 GitHub PR / Issue 相關功能
2. BAT 回報「找不到 gh」或類似錯誤訊息
3. 同一機器外部執行 `where gh` 正常輸出 `C:\Program Files\GitHub CLI\gh.exe`
4. 外部 shell 執行 `gh --version` 回 `gh version 2.92.0 (2026-04-28)`

### 預期行為

BAT 的 GitHub 功能應能解析到系統已安裝的 `gh` CLI，與外部 shell 行為一致。

### 實際行為

BAT 在 PR / Issue 操作情境下回報找不到 gh。

### 證據

- 外部 `where gh` 輸出：`C:\Program Files\GitHub CLI\gh.exe`
- 外部 `gh --version` 輸出：`gh version 2.92.0 (2026-04-28)` / <https://github.com/cli/cli/releases/tag/v2.92.0>
- BAT 內部錯誤訊息：使用者口述「找不到 gh」（具體錯誤碼 / log 行待補）

## Root Cause（待調查）

可能方向（推測，需 Worker 確認）：

1. **PATH 注入問題**：BAT spawn child process 時 `process.env.PATH` 可能未包含 `C:\Program Files\GitHub CLI\`
2. **shell vs binary 差異**：BAT 內部可能用受限環境（如 npm prefix 改寫 PATH，類似 BUG-059）
3. **解析範圍**：BAT 的 GitHub helper 可能用程式內建 PATH 解析而非系統 PATH
4. **設定缺口**：是否有 BAT 的 GitHub 整合設定要求使用者顯式指定 gh 路徑？

### T0351 研究結論（2026-05-15）

根因高信心收斂為：GitHub PR / Issue panel 的 main process IPC handler 直接以裸 `gh` 呼叫 `execSync` / `execFileSync`，沒有專用 resolver、沒有 common-location fallback，也沒有錯誤 log。若 Electron main process 啟動時的 `process.env.PATH` snapshot 缺少 `C:\Program Files\GitHub CLI\`，就會回報找不到 gh；同機器外部 shell 可因 PATH 較新而正常解析。

建議後續 fix：新增 `electron/gh-resolver.ts`，解析順序採 `PATH` 掃描 `gh.exe` → Windows common locations（`C:\Program Files\GitHub CLI\gh.exe`、`%LOCALAPPDATA%\Programs\GitHub CLI\gh.exe`）→ `where.exe gh`，並讓所有 `github:*` handler 以 resolved absolute path 執行；同步改善 `check-cli` 回傳錯誤與 UI 提示。

## 影響範圍

- BAT 內部 GitHub PR / Issue 功能全面失效
- 不影響 git 操作（git 與 gh 是不同 binary）
- 不影響外部 shell 使用 gh

## 待釐清資訊（請使用者或 Worker 補充）

- [ ] BAT 內具體錯誤訊息或錯誤碼（精確字串、log 行）
- [ ] BAT 內 GitHub 功能呼叫位置（`Settings > GitHub`、某個 panel、命令？）
- [ ] 是否有 BAT log 檔對應的 stderr / debug 輸出
- [ ] GitHub CLI 安裝路徑（系統層 `C:\Program Files\GitHub CLI\` 還是使用者 `%LOCALAPPDATA%`）

## 修復方向（給未來修復工單）

1. 確認 BAT 哪個模組呼叫 gh（grep `gh.exe` / `'gh'` / `gh ` in `electron/`、`src/`）
2. 比對 BAT spawn child_process 的 PATH 是否包含 GitHub CLI 安裝位置
3. 若 PATH 缺失 → 在 spawn 時 inherit `process.env.PATH` 或顯式 prepend GitHub CLI 路徑
4. 若用程式內建解析 → 改用 execFile + array args 解析 `where gh`（白名單參數，符合本專案 Child Process Spawning 規則）
5. 補偵測 fallback：若找不到 gh，提示使用者下載安裝（含官方下載連結），不要靜默失敗

## 回報區

待修復工單派發後 Worker 填寫。
