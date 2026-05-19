---
schema_version: 1
schema_kind: workorder
id: T0354
title: Research BUG-080 — `resolveClaudeBaseCommand` shell quoting 三選項可行性評估
type: research
status: DONE
sizing: M
created_at: "2026-05-15T12:13:00+08:00"
started_at: "2026-05-15T12:15:56+08:00"
completed_at: "2026-05-15T12:20:37+08:00"
updated_at: "2026-05-15T12:20:37+08:00"
commit: a373c03
renew_count: 0
workdir: main repo（純讀取 + 跨平台 spec 評估）
---
# T0354 — Research BUG-080 `resolveClaudeBaseCommand` shell quoting hardening 三選項可行性評估

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0354 |
| 類型 | research（cross-platform quoting 規則調查 + 實作成本評估 + 拆單建議） |
| 所屬 | BUG-080 — `resolveClaudeBaseCommand` 雙引號無法防止 shell variable expansion |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-05-15 12:13 (UTC+8) |
| 派發時間 | 2026-05-15 12:15 (UTC+8) |
| 完成時間 | 2026-05-15 12:20 (UTC+8) |
| Sizing | M（estimate 45-90 min wall；3 個選項 × 3 平台 quoting 規則 + 實作位置盤點） |
| 依賴 | PR #18 merged `238ac3d8`、`electron/resolve-claude-base-command.ts`、`electron/claude-runtime-router.ts`、`electron/pty-manager.ts`（PTY shell 偵測位置） |
| 後續 | 拍板後拆 fix 工單（POSIX quoting + 白名單）+ 可能 research/fix 工單（Windows PowerShell quoting） |
| 互動旗標 | `--mode ask --interactive`（允許 Worker 在選項取捨時提問釐清） |
| Renew 次數 | 0 |
| 工作目錄 | main repo（純讀取 + 跨平台 spec 評估，禁止改 code） |
| `affects_files` | `_ct-workorders/T0354-*.md`（自身回報區）+ 可能更新 `BUG-080-*.md`（補實作細節） |
| commit | `a373c03` |

## 背景

PR #18（merged `238ac3d8`）引入 `electron/resolve-claude-base-command.ts`，把 BAT remote / `bat-terminal.mjs` auto-session 派發 `claude-cli` 時的 hardcoded `'claude'` 替換為呼叫 `claude-runtime-router.resolveClaudeRuntime()`，回傳格式為 `"${resolved.path}"`（雙引號包路徑）。

gemini-code-assist on PR #18 指出：bash 雙引號內 `$VAR` / backtick / `!` 仍會被展開，若使用者 customPath 含這些字元（例如 `/home/user/$DEV/claude`）會被 PTY bash 插值。

非安全漏洞（customPath 為本機 settings.json 非外部輸入），但屬於 robustness 缺口。

BUG-080 列出三個修正方向，本工單需評估可行性、實作成本、跨平台適用性。

## 任務

### 階段 1：盤點現況（read-only）

1. 讀取 `electron/resolve-claude-base-command.ts` 確認回傳值用途
2. 追蹤 `terminal:create-agent-command` IPC 流：
   - 哪裡接收 baseCommand？
   - 怎麼塞進 PTY 指令？
   - PTY 用的 shell 是 bash / pwsh / cmd？
3. 讀取 `electron/pty-manager.ts`（或對應檔案）查 PTY shell 偵測 / 設定位置
4. 讀取 `electron/claude-runtime-router.ts` 確認 `resolveClaudeRuntime` 是否能加入路徑校驗

### 階段 2：三選項可行性評估

對 BUG-080 列出的三個選項各做評估：

#### 選項 1：POSIX single-quote escape

- 驗證：`'${path.replace(/'/g, "'\\''")}'` 在 bash / zsh / dash 是否完全字面化
- 風險：git-bash on Windows 是否視同 POSIX？MSYS2 路徑轉換是否干擾？（參考 BUG-075 教訓）
- 實作位置：`resolve-claude-base-command.ts` 內加 helper

#### 選項 2：依目標 shell 切換 quoting

- 驗證：BAT 是否已偵測 PTY shell type？哪裡偵測？
- 風險：PowerShell quoting 規則（`'` strong quote、`"` weak quote、backtick escape）vs cmd.exe（`"` only）vs bash
- 實作成本：需新增 shell type 參數到 `resolveClaudeBaseCommand` 簽名，傳染面有多大？

#### 選項 3：customPath 白名單校驗

- 驗證：哪些字元應拒絕？（`$`、`` ` ``、`;`、`|`、`&`、`>`、`<`、newline、`!`？）
- 適用性：CLAUDE.md「Child Process Spawning」段的 `/^[a-zA-Z0-9._-]+$/` 白名單針對 distro / container name；路徑放寬到何種程度？
- UX：使用者設定 customPath 時要不要在 UI 端先校驗？拒絕時 fallback 行為？

### 階段 3：拆單建議

產出拆單建議表（C 區），格式：

| 工單編號（候選） | 類型 | 標題 | Sizing | 依賴 |
|------------------|------|------|--------|------|
| T0355 | fix | ... | S/M/L | ... |
| T0356 | research | ... | S/M | ... |

至少回答：
- 推薦哪幾個選項（單選 or 組合）？
- 是否需要先做 Windows quoting 獨立 research？還是合併處理？
- regression test 工單要不要獨立？

### 階段 4：選項決策建議

給塔台一個明確推薦，包含：
- 推薦的選項組合
- 理由（成本 vs robustness vs UX）
- 不採用其他選項的原因
- 風險清單

## 約束

- ❌ 不改任何 code（純研究 + 規格產出）
- ❌ 不跑 build / test（無需驗證）
- ✅ 可讀取 `electron/`、`scripts/`、`tests/` 任何檔案
- ✅ 可 grep 既有 quoting / shell 偵測模式
- ✅ 可參考 `_spec-*` 與 `_report-*` 既有文件
- ✅ 結論收斂不足時可使用 Renew 機制

## 交付物

回報區包含四個區段：

- **A 區：盤點現況**（PTY shell 偵測位置、IPC 流程圖、現有 quoting 樣板）
- **B 區：三選項評估**（每個選項一段：可行性 / 風險 / 跨平台適用性 / 實作成本）
- **C 區：拆單建議表**（含工單編號候選、類型、sizing、依賴）
- **D 區：決策建議**（推薦組合 + 理由 + 風險清單）

## 驗收

塔台讀完 D 區應能直接決策：
1. 採用哪個選項組合
2. 派下哪幾張後續工單
3. 是否需要再開研究工單調查 Windows 端

若 D 區結論不清晰 → 塔台 Renew 此工單補強，不開新工單。

---

（以下為 Worker 回報區）

## Worker 回報

### 完成狀態

DONE（純研究完成；未修改產品程式碼；等待塔台依 D 區拆後續 fix/research 工單）

### 產出摘要

- 盤點檔案：`electron/main.ts`、`electron/terminal-command-handlers.ts`、`electron/pty-manager.ts`、`electron/shell-path-resolver.ts`、`electron/claude-runtime-router.ts`、`electron/claude-resolver.ts`、`src/components/WorkspaceView.tsx`、`src/utils/control-tower-launch.ts`、`scripts/bat-terminal.mjs`、`_ct-workorders/BUG-080-*.md`。
- 重要現況：目前 `main` 找不到 `electron/resolve-claude-base-command.ts`，且 `git show 238ac3d8` 失敗；工單/BUG 描述的 PR #18 helper 不存在於本地 repo 物件庫。
- ad-hoc quoting probe：本機可用 `bash.exe`、`dash.exe`、`pwsh.exe`、`cmd.exe`；已用 Git Bash bash、dash、PowerShell 7 驗證 single-quote strong quote 文字化行為。未跑 build/test，符合工單約束。
- 修改檔案：僅 `_ct-workorders/T0354-research-bug080-claude-cli-shell-quoting-options.md`。
- commit：`a373c03`
- sprint-status.yaml：存在但無 T0354/BUG-080 條目，且檔頭標示重要節點由 Tower 更新；本工單未改動該檔。

### 遭遇問題

- 工單前提與目前 repo 不一致：`resolveClaudeBaseCommand` helper 與 `238ac3d8` commit 均不在本地。塔台拆 fix 工單時應先確認 PR #18 是否尚未同步到此 checkout，或 BUG-080 其實要針對現行 `WorkspaceView.startClaudeCliPty()` 的 `cmdParts = ["\"${cliPath}\""]` 與未來/外部 PR helper。
- 現行 remote auto-session `terminal:create-agent-command` 對 `claude-cli` 仍 fallback 成裸 `claude`，未套用 `claudeRuntime.customPath`；這代表 BUG-080 描述的 customPath shell expansion 不會在該路徑以「目前 main」重現，但也代表 remote worker 路徑尚未吃到 runtime router。

### 互動紀錄

無

### Renew 歷程

無

### A 區：盤點現況

#### A1. `terminal:create-agent-command` IPC 流程

流程：

1. `scripts/bat-terminal.mjs --skill ct-exec --workorder T####` 經 WebSocket invoke `terminal:create-agent-command`，並注入 `MSYS_NO_PATHCONV=1`、可選 `BAT_TOWER_TERMINAL_ID`、`CT_MODE`、`CT_INTERACTIVE`。
2. `electron/terminal-command-handlers.ts` handler 呼叫 `buildAgentPromptCommand()` 取得完整 command，再轉呼叫 `terminal:create-with-command`。
3. `terminal:create-with-command` 解析 persisted shell（`resolvePersistedShellPathWithDiagnostics`），建立 PTY，500ms 後 `ptyManager.write(id, command + '\r')`。
4. `electron/pty-manager.ts` 依 shell path 開 PTY；Windows auto/pwsh 走 PowerShell，git-bash 走 `bash.exe --login -i`，macOS/Linux 走 login interactive shell。

#### A2. Claude CLI command 現況

- `electron/main.ts buildAgentPromptCommand()` 對 `claude-cli` / `claude-cli-worktree` 因 `agentRegistry.buildLaunchCommand()` 回傳 null，直接 fallback：`baseCommand = 'claude'`。
- `shellQuoteForTerminalCommand()` 只 quote prompt，不 quote base command。
- 因此 remote auto-session 目前不使用 `claude:get-cli-path` / `resolveClaudeRuntime()` 的 customPath。
- standalone `src/components/WorkspaceView.tsx startClaudeCliPty()` 會呼叫 `window.electronAPI.claude.getCliPath()`，再用 `cmdParts = ["\"${cliPath}\""]` 寫入 PTY；這條路徑才是目前 main 上實際存在的雙引號 weak quote 風險。

#### A3. shell 偵測位置

- Remote / `terminal:create-agent-command`：`electron/terminal-command-handlers.ts` 已知道 `shellResolution.shell`、`basename`、`persistedShell`，但 command 已在 shell resolution 之前被 `buildAgentPromptCommand()` 產生。
- Renderer-created PTY：`src/components/WorkspaceView.tsx getShellFromSettings()` 會拿到 shell path，再 `pty.create()`；`startClaudeCliPty()` 同時知道 `shell` 和 `cliPath`，可在 renderer 端做 shell-aware command rendering。
- PTY fallback：`electron/pty-manager.ts getDefaultShell()` 在 Windows 優先 `pwsh.exe`，macOS/Linux 用 `$SHELL`/bash/sh；這是最晚階段，已只剩 shell path + 已組好的 command string。

#### A4. 現有 quoting 樣板

- POSIX prompt/argv quoting：`electron/main.ts shellQuoteForTerminalCommand()`、`scripts/bat-terminal.mjs shellQuote()` 使用 single-quote 並把 `'` 轉成 `'\''`。
- SSH remote command：`electron/remote/ssh-args.ts escapeSingleQuotesStrict()` 同樣使用 POSIX single-quote escape 並拒絕 control chars。
- custom path 白名單樣板：`electron/gh-resolver.ts isSafeCustomPath()` 要求 absolute path-like，允許 `[\w\s.():+\-\\/@]`，拒絕 shell metachar。
- PowerShell/cmd 專用 executable command quoting 目前沒有共用 helper。

### B 區：三選項評估

#### 選項 1：POSIX single-quote escape

可行性：高，但只適合 bash/zsh/dash/Git Bash 類 POSIX shell。`'${path.replace(/'/g, "'\\''")}'` 對 `$`、backtick、空格、`!`、雙引號都可字面化；本機 Git Bash bash/dash probe 通過。zsh 未安裝，但 zsh single quote 語意與 POSIX sh family 一致，風險低。

風險：不能直接當跨 shell 唯一解。PowerShell 中 quoted path 本身是 string expression，執行含空格路徑通常需要 call operator `& 'path'`；cmd.exe 不把 single quote 當 quote。Git Bash on Windows 可吃 POSIX quote，但仍需保留 `MSYS_NO_PATHCONV=1`，避免 slash command / POSIX-looking token 被 MSYS2 路徑轉換。

成本：S。可抽 helper 供 `shellQuoteForTerminalCommand()`、`bat-terminal.mjs`、未來 `resolveClaudeBaseCommand` 共享；但若只做此選項，應限制作用範圍為 bash/zsh/sh/git-bash。

#### 選項 2：依目標 shell 切換 quoting

可行性：中高，是最完整的 command-string 解法，但需要調整 command build 時序。現行 `terminal:create-agent-command` 先 build command、後 resolve shell；要 shell-aware quote base command，需把 shell resolution 提前，或把 shell path/persistedShell 傳入 `buildAgentPromptCommand()` / helper。

建議 shell 策略：

| shell family | executable path rendering | 備註 |
|--------------|---------------------------|------|
| bash / zsh / sh / Git Bash | POSIX single quote | `'/path/with $VAR'` 可直接作 command word |
| PowerShell / pwsh | `& '<path>'` | single quote strong quote；必須加 call operator 才是 invocation |
| cmd.exe | `"<path>"` + path validation | cmd 只有 double quote；拒絕 `%`、`!`、`&`、`|`、`<`、`>`、newline 等更實際 |

風險：cmd.exe quoting 最弱，且 `%VAR%` expansion / delayed expansion `!VAR!` 依環境不同；不要試圖用 escaping 承擔所有奇特 path，應搭配白名單。PowerShell 若少了 `&` 可能產生「只輸出字串不執行」的退化。

成本：M。至少影響 `buildAgentPromptCommand()`、`terminal-command-handlers.ts`、`WorkspaceView.startClaudeCliPty()`，以及對應 unit/integration tests。若要把 helper 放 main process 共享給 renderer，可能還要新增 preload IPC 或在 shared util 下實作純函式。

#### 選項 3：customPath 白名單校驗

可行性：高。`customPath` 來源是本機 settings，但它進入 shell command string 後仍會觸發 robustness 問題。最保守位置是 `electron/claude-resolver.ts detectSystemClaude(customPath)` 或 `electron/claude-runtime-router.ts getRuntimeSettingsSnapshot()` 後、`detectSystemClaude()` 前。

建議規則：

- 必須是 absolute path-like。
- 拒絕 control chars、CR/LF/NUL。
- 拒絕 shell metachar：`$`、backtick、`;`、`|`、`&`、`>`、`<`。
- 對 cmd 兼容另拒絕 `%`、`!`。
- 可允許常見路徑字元：字母數字、空白、`.`、`_`、`-`、`:`、`(`、`)`、`+`、`/`、`\`、`@`。
- 是否允許單引號：建議第一版拒絕，降低 cmd / UI / logging 複雜度；POSIX helper雖可 escape，但 path 中 apostrophe 很少見。

UX：UI 端 `ClaudeRuntimeSection` 應同步顯示 validation error；main process 仍須 fail-closed。fallback enabled 時可降級 embedded 並發 degraded toast；fallback disabled 時 throw `SystemClaudeUnavailableError` 類型，讓 UI 告知 customPath unsafe。

成本：S-M。main process validation + tests 是 S；若補 UI 即時校驗與 i18n 是 M。

### C 區：拆單建議表

| 工單編號（候選） | 類型 | 標題 | Sizing | 依賴 |
|------------------|------|------|--------|------|
| T0355 | fix | BUG-080 customPath 白名單校驗 + degraded/fallback 行為 | S/M | BUG-080、`claude-resolver.ts`、`claude-runtime-router.test.ts` |
| T0356 | fix | Claude CLI PTY command shell-aware quoting（POSIX + PowerShell + cmd guard） | M | T0355；需先確認 `resolveClaudeBaseCommand` 是否要同步/引入 |
| T0357 | test | quoting regression tests for bash/Git Bash/pwsh/cmd command rendering | S/M | T0356；可含 unit tests + Windows smoke，不必獨立 E2E |
| T0358 | research | Windows cmd.exe customPath edge-case policy（可選） | S | 僅當塔台要求支援 `%`/`!` 等特殊 Windows path；否則不開 |

拆單說明：

- T0355 可先做，因白名單可立即降低所有 shell family 的 metachar 風險，且不依賴 shell-aware command rendering。
- T0356 應同時處理兩條現行/預期路徑：`WorkspaceView.startClaudeCliPty()` 與 remote `terminal:create-agent-command` 若要改用 runtime router/customPath。
- T0357 可併入 T0356，除非塔台希望 Windows Git Bash / pwsh / cmd smoke 留給 QA 型工單。
- T0358 不建議預設開；更務實是第一版拒絕 cmd 難以安全表示的 metachar。

### D 區：決策建議

推薦採用「選項 3 + 選項 2 的窄版」，不要只做選項 1。

具體決策：

1. 先做 customPath 白名單校驗（T0355）：拒絕明確 shell metachar，fallback enabled 時降級 embedded；fallback disabled 時阻斷並提示 unsafe customPath。
2. 再做 shell-aware command renderer（T0356）：bash/zsh/sh/git-bash 用 POSIX single quote；pwsh/powershell 用 `& '<path>'`；cmd.exe 使用 double quote 但依賴白名單拒絕 `%` / `!` / metachar。
3. 若 PR #18 的 `resolveClaudeBaseCommand` 還在外部 branch，先把它同步或在 T0356 直接新建等效 helper；不要在 helper 內硬回傳 `"${resolved.path}"`。
4. Windows quoting 不需要先開獨立 research；以「PowerShell 支援、cmd 嚴格白名單」即可進 fix。只有在塔台要求支援含 `%`、`!`、`&` 的 cmd path 時才開 T0358。

不採用其他選項的原因：

- 只做選項 1：會修 Git Bash/bash，但可能讓 PowerShell/cmd 退化或不可執行，且 Windows auto 預設偏向 PowerShell。
- 只做選項 2：仍允許高風險 customPath 流入 command string，cmd.exe 仍難完全安全。
- 只做選項 3：可止血，但不修含空格/弱 quote 的 command rendering 一致性，且不能覆蓋未來若要支援較寬 path 字元的需求。

風險清單：

- 本地 repo 不含 `resolveClaudeBaseCommand` / `238ac3d8`，塔台需先釐清是否漏同步 PR #18；否則工單標題會指向不存在檔案。
- `terminal:create-agent-command` 目前未使用 `resolveClaudeRuntime()`，若 T0356 改為使用 customPath，會改變 remote Worker 啟動 semantics，需要保留 fallback/toast 或清楚記錄 degraded 行為。
- PowerShell invocation 必須包含 `&`；單純把 double quote 換 single quote 不夠。
- cmd.exe path 支援應刻意保守；不要為了 exotic path 放寬 `%`/`!`。

### 調查結論

BUG-080 的核心問題成立於「把 customPath 放進 shell command string」的路徑，但目前 main 的 remote `terminal:create-agent-command` 尚未走 customPath；實際可見風險主要在 standalone `claude-cli` PTY 的 `WorkspaceView.startClaudeCliPty()`，以及未同步/未落地的 PR #18 helper。最小可決策方案是先用白名單 fail-closed，再用 shell-aware renderer 消除弱 quote。

### 建議方向

推薦塔台派 T0355 + T0356；T0357 併入 T0356 或作為短 QA 工單；T0358 暫不開。若塔台發現 PR #18 確實尚未同步，先同步/定位該 branch，再讓 T0356 覆蓋 `resolveClaudeBaseCommand` 與現行 `WorkspaceView` 兩處。

### 回報時間

2026-05-15T12:19:01+08:00
