---
schema_version: 1
schema_kind: workorder
id: T0356
title: Fix BUG-080 — Claude CLI PTY command shell-aware quoting（POSIX + PowerShell + cmd guard）
type: fix
status: CLOSED
sizing: M
created_at: "2026-05-15T12:42:00+08:00"
started_at: "2026-05-15T12:47:55+08:00"
completed_at: "2026-05-15T12:53:20+08:00"
closed_at: "2026-05-15T12:58:00+08:00"
updated_at: "2026-05-15T12:58:00+08:00"
commit: b511faa
verified_by: tower (unit test 476 PASS + Worker cross-shell command-word smoke PASS on pwsh/git-bash/cmd)
renew_count: 0
workdir: main repo
affects_files:
  - electron/resolve-claude-base-command.ts
  - electron/main.ts
  - electron/terminal-command-handlers.ts
  - electron/pty-manager.ts
  - electron/__tests__/resolve-claude-base-command.test.ts
  - src/components/WorkspaceView.tsx
  - src/utils/shell-quote.ts
  - src/utils/__tests__/shell-quote.test.ts
  - _ct-workorders/T0356-*.md
  - _ct-workorders/BUG-080-*.md
---
# T0356 — Fix BUG-080 Claude CLI PTY command shell-aware quoting

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0356 |
| 類型 | fix（command rendering + shell-aware quoting helper + tests） |
| 所屬 | BUG-080 — `resolveClaudeBaseCommand` shell quoting hardening |
| 狀態 | ✅ CLOSED |
| 關閉時間 | 2026-05-15T12:58:00+08:00 |
| Commit | b511faa |
| 驗收 | 塔台選項 [1]（直接 CLOSED）：unit test 476/476 PASS + Worker cross-shell command-word smoke PASS（pwsh `& '...'` / Git Bash `'...'` / cmd `"..."` 三家 quoting 策略均輸出 v24.15.0） |
| Sizing | M（兩條路徑改 quoting + 共用 helper + cross-shell tests） |
| 依賴 | T0355 已 CLOSED（白名單已生效，本工單聚焦 quoting 一致性）/ T0354 D 區決策 |
| 後續 | BUG-080 → VERIFY → CLOSED（兩條路徑驗收通過後） |
| 互動旗標 | `--mode ask --interactive`（cross-shell 行為決策需釐清） |
| Renew 次數 | 0 |
| 工作目錄 | main repo |

## 背景

T0355 已落地 customPath 白名單校驗（拒絕 `$`、`` ` ``、`;`、`|`、`&` 等 metachar），但兩條 PTY command 組裝路徑仍使用**弱雙引號**：

1. **`electron/resolve-claude-base-command.ts`**（PR #18 引入）：`return resolved.path ? \`"${resolved.path}"\` : 'claude'`
2. **`src/components/WorkspaceView.tsx startClaudeCliPty()`**：`cmdParts = [\`"${cliPath}"\`]`

雖然 T0355 的白名單已擋掉危險字元，但 quoting 一致性仍是缺口：
- PowerShell 不認 bare quoted string 作 invocation（需 call operator `& 'path'`）
- cmd.exe quoting 規則不同
- 未來若白名單放寬（例如允許單引號），雙引號處理會立即失效

本工單做 **T0354 D 區的「選項 2 窄版」**：shell-aware quoting helper，依目標 shell 切換策略。

## 任務

### 階段 1：建立共用 helper

#### 1.1 `src/utils/shell-quote.ts`（renderer + main 共用純函式）

匯出兩個函式：

```ts
export type ShellFamily = 'posix' | 'pwsh' | 'cmd'

/**
 * 偵測 shell family from shell path or basename.
 * - bash, zsh, sh, dash, ash, git-bash → 'posix'
 * - pwsh, powershell → 'pwsh'
 * - cmd → 'cmd'
 * - unknown → 'posix' (safest default for PTY shells)
 */
export function detectShellFamily(shellPath: string): ShellFamily

/**
 * Quote a path for safe invocation as a command word.
 * - posix: 'path' with `'\''` escape; works as command word directly
 * - pwsh: `& 'path'` (call operator + single quote strong quote)
 * - cmd: `"path"` (assumes whitelist已過濾 metachar)
 */
export function quoteCommandPath(path: string, shell: ShellFamily): string
```

> 注意：T0355 的 `isSafeClaudeCustomPath` 已拒絕 `'`，所以 `'\''` escape 主要為了 future-proof 和 non-customPath 使用情境。

#### 1.2 Unit test `src/utils/__tests__/shell-quote.test.ts`

涵蓋：
- `detectShellFamily`：bash / zsh / sh / dash / git-bash.exe / pwsh / pwsh.exe / powershell.exe / cmd.exe / 未知 → 預期 family
- `quoteCommandPath` 每個 shell × 每類 path（含空格、含 `(` `)`、含 `\\`、含 `$`、含單引號）
- 至少 30 個 cases

### 階段 2：替換現有 quoting

#### 2.1 `electron/resolve-claude-base-command.ts`

簽名擴展為 `resolveClaudeBaseCommand(shell?: ShellFamily): Promise<string>`：

- 預設 `shell = 'posix'`（remote PTY 通常是 bash）
- 內部呼叫 `quoteCommandPath(resolved.path, shell)`
- caller 在知道 shell 時傳入；不知道時保持 posix default

#### 2.2 `electron/main.ts buildAgentPromptCommand()`

調用前 resolve shell：
- 若 caller 已傳入 shell info → 用 caller 的
- 否則從 `terminal-command-handlers.ts` 的 `shellResolution.shell` 取得（need refactor — see 2.3）

#### 2.3 `electron/terminal-command-handlers.ts`

把 shell resolution 提前到 `buildAgentPromptCommand()` **之前**，把 `shellFamily` 透過 opts 傳入。

> 注意：可能涉及把 `resolveClaudeBaseCommand()` 從 main.ts 內部呼叫改為由 terminal-command-handlers 顯式注入。Worker 評估後選最小改動方案。

#### 2.4 `src/components/WorkspaceView.tsx startClaudeCliPty()`

Renderer 端：
- `getShellFromSettings()` 已知 shell path → 呼叫 `detectShellFamily()`
- `cmdParts[0]` 從 `\`"${cliPath}"\`` 改為 `quoteCommandPath(cliPath, shellFamily)`

### 階段 3：測試補強

#### 3.1 更新 `electron/__tests__/resolve-claude-base-command.test.ts`

PR #18 原本 3 cases，擴展為：
- POSIX × (customPath / embedded / throw) = 3
- pwsh × (customPath / embedded) = 2
- cmd × (customPath / embedded) = 2
- 預設 shell（不傳參）= 1
- 共 8 cases

預期回傳：
- POSIX customPath `/usr/local/bin/claude` → `'/usr/local/bin/claude'`
- pwsh customPath `C:\Users\u\claude.exe` → `` & 'C:\Users\u\claude.exe' ``
- cmd customPath `C:\Users\u\claude.exe` → `"C:\Users\u\claude.exe"`

#### 3.2 WorkspaceView 既有測試（若有）

若 `src/components/__tests__/WorkspaceView.test.tsx` 存在，補 `startClaudeCliPty` cross-shell 情境（mock `getShellFromSettings` 回傳不同 shell）。

### 階段 4：驗證

- `npm run test:unit` 全綠
- `npx vite build` PASS
- 手動 cross-shell smoke：
  - Windows Git Bash PTY：啟動 claude-cli，看到 `'C:\Users\...\claude.exe'`，正常執行
  - Windows pwsh PTY：看到 `& 'C:\Users\...\claude.exe'`，正常執行
  - Windows cmd PTY（若 BAT 支援）：看到 `"C:\Users\...\claude.exe"`，正常執行
  - macOS / Linux bash：看到 `'/usr/local/bin/claude'`，正常執行

## 約束

- ✅ 修改 `affects_files` 內列出的檔案
- ✅ 新建 `src/utils/shell-quote.ts` + 對應 test
- ❌ 不放寬 T0355 白名單（規則由 T0355 owner，T0356 只負責 quoting）
- ❌ 不改 `claude-resolver.ts` 或 `claude-runtime-router.ts`（T0355 已收尾）
- ❌ 禁用 `child_process.exec` 模板字串呼叫（CLAUDE.md 規定）
- ✅ 遵循「No Regressions Policy」

## 交付物

回報區包含：

1. **變更摘要**：每檔 diff 重點
2. **shell-aware 行為對照表**（實測各 shell × path 樣本的 quoted 輸出）
3. **測試結果**：`npm run test:unit` PASS 數量 + 新增 cases 數
4. **build 結果**：`npx vite build` PASS
5. **手動 cross-shell smoke 紀錄**（至少 2 個 shell 實測；其他 shell 若無環境可標示為「待塔台驗收補測」）
6. **commit hash**：建議 squash 成單一 commit `fix(claude-cli): shell-aware command quoting (BUG-080 T0356)`
7. **BUG-080 狀態更新**：FIXING → VERIFY（兩條路徑都改完）

## 驗收

塔台收到回報後：

1. 確認 unit test 全綠 + build PASS
2. 派驗收方式（runtime smoke 重點：windows pwsh + windows bash + macOS bash 三組合）
3. BUG-080 → VERIFY → CLOSED

## 風險清單（從 T0354 D 區複製）

- PowerShell invocation 必須包含 `&`；單純把 double quote 換 single quote 不夠
- cmd.exe path 支援應刻意保守，依賴白名單已過濾 `%` / `!`
- Git Bash on Windows 視同 POSIX，但需保留 `MSYS_NO_PATHCONV=1`，避免 slash command / POSIX-looking token 被 MSYS2 路徑轉換
- terminal-command-handlers refactor 把 shell resolution 提前可能影響其他 IPC caller，需 grep 確認影響面

---

（以下為 Worker 回報區）

## Worker 回報

### 完成狀態

FIXED（修復已完成，等待塔台驗收）

### 產出摘要

- `src/utils/shell-quote.ts`：新增 `ShellFamily`、`detectShellFamily()`、`quoteCommandPath()`，支援 POSIX / PowerShell / cmd command path quoting。
- `electron/resolve-claude-base-command.ts`：`resolveClaudeBaseCommand(shell = 'posix')` 改用 shared helper，resolver 失敗仍 fallback bare `claude`。
- `electron/terminal-command-handlers.ts`：`terminal:create-agent-command` 在 build command 前解析 shell family，傳入 `buildAgentPromptCommand()`。
- `electron/main.ts`：agent command builder 接收 `shellFamily`，remote `claude-cli`/`claude-cli-worktree` command path 依 shell family quote。
- `src/components/WorkspaceView.tsx`：renderer `startClaudeCliPty()` 使用設定 shell path 偵測 family，替換弱雙引號 command path。
- `electron/__tests__/resolve-claude-base-command.test.ts`：擴充 POSIX / pwsh / cmd × customPath / embedded / fallback/default cases。
- `electron/__tests__/terminal-command-handlers.test.ts`：新增 handler shell family 傳遞測試。
- `src/utils/__tests__/shell-quote.test.ts`：新增 shell 偵測與 path quoting 測試，共涵蓋空格、括號、反斜線、`$`、單引號等樣本。
- `_ct-workorders/BUG-080-claude-cli-resolve-shell-quoting-hardening.md`：BUG-080 狀態 `FIXING` → `VERIFY`。

### shell-aware 行為對照表

| shell family | 樣本 path | quoted output |
|---|---|---|
| posix | `/usr/local/bin/claude` | `'/usr/local/bin/claude'` |
| posix | `/tmp/user's/claude` | `'/tmp/user'\''s/claude'` |
| posix | `C:\Program Files\Claude\claude.exe` | `'C:\Program Files\Claude\claude.exe'` |
| pwsh | `C:\Program Files\Claude\claude.exe` | `& 'C:\Program Files\Claude\claude.exe'` |
| pwsh | `C:\Users\O'Brien\claude.exe` | `& 'C:\Users\O''Brien\claude.exe'` |
| cmd | `C:\Program Files\Claude\claude.exe` | `"C:\Program Files\Claude\claude.exe"` |

### 測試結果

- `npm run test:unit -- src/utils/__tests__/shell-quote.test.ts electron/__tests__/resolve-claude-base-command.test.ts electron/__tests__/terminal-command-handlers.test.ts`：PASS（3 files / 44 tests）
- `npm run test:unit`：PASS（37 files / 476 tests）
- 新增 cases：`shell-quote.test.ts` 33 cases + `terminal-command-handlers.test.ts` 3 cases；resolver 測試由 3 cases 擴充到 8 cases。

### build 結果

- `npx vite build`：PASS（僅既有 chunk-size / dynamic-import warning）

### 手動 cross-shell smoke

以實際 shell 執行同策略 command word，目標 executable 為本機 `C:\nvm4w\nodejs\node.exe`：

| shell | command word | 結果 |
|---|---|---|
| PowerShell 7 | `& 'C:\nvm4w\nodejs\node.exe' --version` | PASS，輸出 `v24.15.0` |
| Git Bash | `'C:\nvm4w\nodejs\node.exe' --version` | PASS，輸出 `v24.15.0` |
| cmd.exe | `"C:\nvm4w\nodejs\node.exe" --version` | PASS，輸出 `v24.15.0` |

實際 Claude CLI PTY runtime smoke（Windows pwsh / Windows Git Bash / macOS bash）仍建議由塔台驗收補測，因本 Worker session 未啟動 BAT UI 端 terminal。

### 遭遇問題

無。

### 互動紀錄

無。

### Renew 歷程

無。

### sprint-status.yaml

不適用。檔案存在但內容為舊里程碑摘要，無 T0356 / BUG-080 條目，未修改。

### 回報時間

2026-05-15T12:53:20+08:00

### commit

b511faa
