---
schema_version: 1
schema_kind: bug
id: BUG-080
title: resolveClaudeBaseCommand 雙引號包路徑無法防止 shell variable expansion（$、backtick）
status: CLOSED
severity: low
created_at: "2026-05-15T12:11:00+08:00"
closed_at: "2026-05-15T12:58:00+08:00"
---
# BUG-080 — `resolveClaudeBaseCommand` shell quoting hardening

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-080 |
| 標題 | `electron/resolve-claude-base-command.ts` 用 `"${resolved.path}"` 雙引號包路徑，無法防止 bash 在 PTY 內展開 `$VAR` / backtick / `!`（history expansion）等特殊字元 |
| 嚴重度 | 🟢 Low（robustness 缺口；非安全漏洞，因 customPath 來源為本機 settings.json 而非外部輸入；預設安裝路徑無此風險） |
| 可重現 | 100%（若使用者把 customPath 設成 `/tmp/$USER/claude` 之類含 `$` 的路徑，PTY bash 會展開變數） |
| Workaround | 使用者避免在 customPath 用 `$`、`` ` ``、`!` 等字元；用預設安裝路徑 |
| 狀態 | ✅ CLOSED |
| 建立時間 | 2026-05-15 12:11 (UTC+8) |
| 關閉時間 | 2026-05-15 12:58 (UTC+8) |
| 修復方案 | T0355（customPath 白名單）+ T0356（shell-aware quoting）兩階段解決，覆蓋 `resolve-claude-base-command.ts` + `WorkspaceView.startClaudeCliPty()` 兩條路徑 |
| 驗收 | 塔台選項 [1]（直接 CLOSED）：unit test 476/476 PASS + Worker cross-shell command-word smoke PASS（pwsh `& '...'` / Git Bash `'...'` / cmd `"..."`）|
| 報告者 | gemini-code-assist on PR #18（gowerlin/better-agent-terminal） |
| 觸發情境 | BAT remote terminal 派發 `claude-cli` agent，且 `claudeRuntime.customPath` 含 shell metachar |
| 環境 | 跨平台（POSIX bash 內最明顯；Windows PowerShell quoting 規則不同需另行驗證） |
| 相關 PR | gowerlin/better-agent-terminal#18（merged `238ac3d8`，引入此 helper） |
| 相關 BUG | 無 |
| 相關工單 | T0354（research, DONE）、T0355（customPath whitelist, CLOSED `dad16c6`）、T0356（shell-aware quoting, CLOSED `b511faa`） |
| 上游 issue | gemini-code-assist review on PR #18 |

## 現象

### 觸發步驟

1. 使用者在 BAT settings.json 將 `claudeRuntime.customPath` 設成含 `$` 的路徑，例如 `/home/user/$DEV/claude`
2. 派發 `claude-cli` agent 經由 `terminal:create-agent-command` 路徑（BAT remote / bat-terminal.mjs auto-session）
3. `resolveClaudeBaseCommand` 回傳 `"/home/user/$DEV/claude"`（含雙引號）
4. PTY bash 收到指令，雙引號內 `$DEV` 被展開（若未定義為空字串）
5. 實際執行的路徑變成 `/home/user//claude` 或意外目錄

### 預期行為

無論 customPath 含何種 shell metachar，都應字面化傳給 spawned process，不被插值。

### 實際行為

雙引號內 `$`、`` ` ``、`\\`、`!`（interactive history）皆會被 bash 展開或特殊處理。

## Root Cause

`electron/resolve-claude-base-command.ts:25`：

```ts
return resolved.path ? `"${resolved.path}"` : 'claude'
```

雙引號（weak quote）僅防止 word splitting 和 glob expansion，**不防止** parameter / command / history expansion。POSIX 完全字面化需用 single quote 並對內含的 `'` 做 `'\''` 跳脫。

Windows 端 quoting 規則不同（PowerShell 與 cmd.exe 各異），需 cross-platform 處理。

## 建議修正方向（待 Worker 評估）

### 選項 1：POSIX 風格 single-quote escape

```ts
function shellQuotePosix(path: string): string {
  return `'${path.replace(/'/g, "'\\''")}'`
}
```

- 優：完全字面化，POSIX 標準
- 劣：Windows bash（git-bash / MSYS2）OK，但 PowerShell / cmd.exe 不認 single quote 為 strong quote

### 選項 2：依目標 shell 切換 quoting 策略

- BAT 偵測 PTY shell type（bash / pwsh / cmd），各自用對應 quoting
- 優：最 robust
- 劣：實作成本高，需查 PTY shell 偵測位置（可能在 `pty-manager.ts`）

### 選項 3：白名單校驗 + 拒絕含 metachar 的 customPath

- 在 `claude-runtime-router.resolveClaudeRuntime()` 內校驗，含 `[$`!\\]` 等字元直接 reject 並 fallback
- 優：簡單，與 CLAUDE.md「Child Process Spawning」段一致（已規定外部輸入過 `/^[a-zA-Z0-9._-]+$/` 白名單；路徑放寬到 `[a-zA-Z0-9._/:\\\\ -]`）
- 劣：限制使用者自由度

### 推薦

選項 1 + 選項 3：POSIX 路徑用 single-quote escape，並對 customPath 套白名單校驗（拒絕 `$`、`` ` ``、`;`、`|`、`&`、`>`、`<` 等明確危險字元）。Windows 端另開研究工單評估 PowerShell quoting。

## 測試要求（fix 工單交付物）

- Unit test：customPath 含 `$VAR`、`` `cmd` ``、單引號、雙引號、空格、UTF-8 字元
- Cross-platform 手動驗證：
  - Windows git-bash PTY
  - macOS Terminal（zsh / bash）
  - Linux bash
- 回歸：既有 3 個 branch 測試（customPath / embedded / throw）保持 PASS

## 影響評估

- **使用者影響**：極低。預設安裝路徑（`~/.local/bin/claude.exe`、`/opt/homebrew/bin/claude`、`C:\\Users\\...\\claude.exe`）皆無 metachar，不會觸發
- **安全評估**：非外部輸入攻擊面（customPath 由使用者自己改本機 settings.json），但屬於 robustness 缺口；若未來 customPath 來源擴展到 sync 或 remote config，會升級為安全議題
- **優先級依據**：先合併 PR #18 解下游 POS 專案 BUG-005 blocker，本 hardening 可分階段交付

## 後續處理

- T0356 已完成 shell-aware command path quoting，BUG-080 進入 VERIFY
- 待塔台安排 runtime smoke：Windows pwsh + Windows Git Bash + macOS/Linux POSIX shell

- T0354 research、T0355 customPath whitelist、T0356 shell-aware quoting 均已交付
