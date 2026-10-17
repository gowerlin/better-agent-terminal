---
schema_version: 1
schema_kind: workorder
id: T0375
title: "研究：BUG-085 Codex 0.160 daemon 在提權 Windows 拒絕啟動的影響範圍與 BAT 補強方案"
type: research
status: DONE
priority: P2
sizing: S
created_at: "2026-10-04T20:21:50+08:00"
updated_at: "2026-10-04T20:37:44+08:00"
started_at: "2026-10-04T20:23:14+08:00"
completed_at: "2026-10-04T20:37:44+08:00"
target_version: next
depends_on: []
related:
  - "BUG-085（本研究對象）"
  - "BUG-083 / T0366（Codex 版本研究，含 smoke 方法與隔離 CODEX_HOME 做法）"
  - "T0373（codex binary 選最新：electron/codex-runtime-resolver.ts）"
affects_files: []
interaction:
  mode_hint: on
  interactive: true
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究工單，不改產品程式碼、不升級依賴、不 commit `package.json` / `package-lock.json`**。實驗放 scratchpad 或 `git worktree`，結束前清乾淨；主工作樹除本工單檔外不得留下改動。"
  - "🔴 不要 `npm install -g` / `codex update` / 改動使用者全域 codex 安裝；`~/.codex/` 只讀（需要 smoke 時比照 T0366 用 scratchpad 隔離 CODEX_HOME，先問使用者）。"
  - "🔴 **不要改 UAC / 登錄檔 / 系統安全設定**。本機 `EnableLUA=0` 是使用者環境，只讀。"
  - "⚠️ 工作樹有使用者本機 build 留下的 dirty：`package.json`（version `1.26.1004195815`）與 `choco/better-agent-terminal.nuspec` —— 不要碰、不要 commit。"
---

# T0375 — 研究：BUG-085 Codex daemon 提權拒絕

## 元資料

- **類型**：research
- **互動模式**：enabled（每次 ≤ 3 題）
- **工作量預估**：S
- **Context Window 風險**：低

## 研究目標

1. **影響範圍**：除了終端 Codex CLI preset（互動 TUI），以下路徑在提權 Windows 是否也被擋？
   - Codex Agent 面板（SDK → `codex exec --experimental-json`，`electron/codex-agent-manager.ts`）
   - `codex --version` / 模型清單探測等 BAT 內部 spawn（`electron/codex-runtime-resolver.ts`）
   - BAT 內嵌 0.160 與使用者自裝 0.160 行為是否一致
2. **關閉 daemon 的手段**：`--no-daemon` 以外是否有 config.toml 鍵或 env（查 `codex --help`、`codex exec --help`、內嵌套件內的文件或字串）可停用 daemon？哪個最不侵入？
3. **`--no-daemon` 副作用**：對 resume / fork / exec 的相容性；舊版 codex（例如 0.124）遇到未知旗標會不會直接 exit（BAT 可能解析到使用者 PATH 上的舊版）
4. **BAT 補強方案**：比較並推薦
   - A：BAT 偵測自身行程提權（Windows）→ Codex CLI preset 自動補 `--no-daemon`（注入點：`src/types/agent-presets.ts` / `agent-registry.ts` / pty 啟動流程）
   - B：注入 env 或 config 覆寫（若研究目標 2 找到可用的方式）
   - C：不自動處理，只在 preset 失敗時顯示 i18n 提示
   - 也評估是否要在提權時給一次性警示（BAT 以管理員執行本身就是風險面）

## 已知資訊（塔台環境檢查，請自行複核）

- 錯誤原文：`Error: start the Windows daemon from a non-elevated terminal; shared clients must not inherit administrator privileges` / `To work without the background server, rerun the same command with --no-daemon (including resume or fork and its arguments).`
- 本機 `EnableLUA=0`（UAC 停用），BAT 父行程為 `explorer.exe`，子 shell 提權為 True
- 終端分頁 `codex` 解析為 `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe`（`codex-cli 0.160.0`）；PATH 上另有 npm shim
- 已安裝 BAT `1.26.1004195815`（本機 build ≈ `v0.5.9-pre.4`），內嵌 `@openai/codex-sdk` 0.160.0；內嵌 binary 在 `C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@openai\codex-win32-x64\...`
- preset 定義：`src/types/agent-presets.ts:75`；registry：`electron/agent-runtime/agent-registry.ts:157-161, 430`；使用者實際啟動指令為 `codex --yolo`（`--yolo` 可能來自 agentCustomArgs，請確認）
- 你自己的 shell 也繼承了提權（同一個 BAT），可以直接重現

## 調查範圍

- ✅ 上述檔案只讀；內嵌與 PATH 上 codex 的 `--help` / `--version` / 最小 smoke
- ✅ BAT debug log：`%APPDATA%\better-agent-terminal\Logs\debug-<stamp>.log`（L128）
- ❌ 不改 `src/` `electron/` `package*.json`；不改系統設定；不發 release

## 互動規則

- 每次 ≤ 3 題。需要真實 Codex 對話 smoke（消耗額度 / 使用 auth）前先問使用者
- 能用實驗回答的不要問

## 回報要求

- 研究目標 1-3 每項標註 **證實 / 排除 / 無法判定** 並附證據（指令輸出、行號）
- 目標 4 給推薦方案、改動檔案清單（可直接當實作工單的 `affects_files`）、測試建議、風險
- 若發現 BUG-085 嚴重度應調整（例如 Codex Agent 面板也壞），明確寫出建議

## Sub-session 執行指示

1. 讀取本工單全部內容 + `BUG-085`
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 依研究目標 1 → 4 調查
4. 填寫回報區、更新 `status` / `completed_at` / `updated_at`；完成請寫 **`DONE`**（不是 `FIXED`）
5. commit **僅本工單檔**（`git commit --only _ct-workorders/T0375-research-bug085-codex-daemon-elevated-windows.md`）
6. 依派發 mode 通知塔台（`bat-notify.mjs`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結論摘要

- **BUG-085 只影響互動 TUI 路徑**（終端 Codex CLI preset、Tower/remote 以 codex-cli 派發的終端、使用者手打 `codex` / `codex resume` / `codex fork`）。**Codex Agent 面板（SDK → `codex exec`）在提權下正常**（含 resume）⇒ **嚴重度維持 medium，不升 high**。
- 停用 daemon 的手段：argv `--no-daemon`、feature flag `daemon_auto_start=false`（`-c features.daemon_auto_start=false` / `--disable daemon_auto_start` / `config.toml [features]`）。**無 env 開關**。
- **推薦方案 B'**：BAT 偵測自身行程提權（Windows）→ `codex-cli` launch command 注入 **`-c features.daemon_auto_start=false`**（而非 `--no-daemon`；舊版 codex 0.133 遇 `--no-daemon` 會 exit 2，但容忍未知 `-c features.*`），外加一次性 i18n 提示（C 的變形）。

### Landing Zone Check

| 檢查 | 結果 | 說明 |
|------|------|------|
| C-0 repo identity | ⚠️ WARN | 工單 frontmatter 無 `repo` 欄位（`absent`）；觀察 `basename(REPO_ROOT)` = `better-agent-terminal` |
| C-1 work order path | ✅ PASS | 工單位於 `REPO_ROOT/_ct-workorders/` |
| C-3 affects_files | ℹ️ not applicable | `affects_files: []` |
| C-2 branch | ℹ️ n/a | 無 `branch` 欄位；實際 `main` |

整體 **WARN**（僅 C-0 欄位缺）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（evidence only）。`CT_MODE=on`、`CT_INTERACTIVE=1`。本 shell 提權 `True`、integrity `High Mandatory Level (S-1-16-12288)`。

### 實驗方法

- 所有 codex 執行皆設 `CODEX_HOME` 指向 scratchpad 隔離目錄；`~/.codex/` 只讀。
- 互動 TUI 需真 TTY（非 TTY 時 `Error: stdin is not a terminal` **先於** daemon 檢查觸發），故以 repo 的 `@lydell/node-pty`（ConPTY）寫 scratchpad `ptysmoke.cjs`：spawn → 收 9 秒輸出 → kill。判定：「已 exit 且 exitCode≠0」= 被擋；「9 秒後仍執行（停在登入畫面）」= 越過 daemon 檢查。
- SDK 路徑：scratchpad `sdksmoke.mjs`，用 repo `@openai/codex-sdk` 0.160.0，`new Codex({ codexPathOverride: <內嵌 codex.exe>, config: { check_for_update_on_startup: false } })` → `startThread` → `run` → `resumeThread(id)` → `run`，與 `electron/codex-agent-manager.ts:895-929` 同路徑。prompt：`Reply with exactly the single word: pong`。
- 實驗結束已刪除所有隔離 home（含 auth 複本）、strings dump 與 smoke 腳本。

### 目標 1：影響範圍

| 路徑 | 判定 | 證據 |
|------|------|------|
| 終端 Codex CLI preset（`codex` / `codex --yolo`） | **證實受影響** | ConPTY 下 0.160 `codex`、`codex --yolo` 皆印原錯誤 `Error: start the Windows daemon from a non-elevated terminal; ...`，`exitCode: 1`（`--yolo` 時 TUI 先畫出歡迎畫面後才 exit） |
| `codex resume --last` / `codex fork --last` | **證實受影響** | 同錯誤，`exitCode: 1` |
| Codex Agent 面板（SDK → `codex exec --experimental-json`） | **排除** | ① `codex exec --help` 無 `--no-daemon` 選項（TUI / resume / fork 的 help 皆有）；② 無 auth exec 照常發出 `{"type":"thread.started",...}`，只在 `401 Unauthorized` 失敗；③ auth 隔離複本 smoke：`[start] OK final="pong" ms=5072`、`[resume] OK ... final="pong" ms=3984`（同 thread id） |
| `codex --version`（`electron/codex-runtime-resolver.ts:218` `execFile(bin, ['--version'])`） | **排除** | 提權 shell 下內嵌與自裝 binary 皆 `codex-cli 0.160.0` `rc=0` |
| 模型清單 | **排除（不涉 spawn）** | `electron/codex-models.ts` 只讀 `$CODEX_HOME/models_cache.json`，不 spawn codex |
| BAT 內嵌 0.160 vs 使用者自裝 0.160 一致性 | **證實一致** | 兩者 SHA-256 相同 `fdda5fa3cf3fb3d000b876720742857676293e4315e4b045fae6f8bd7e866d1d`（326872368 bytes） |
| Tower 派發 / remote 以 codex-cli 開的終端 | **證實受影響（靜態推導）** | `electron/main.ts:589` `buildAgentPromptCommand()` 同樣呼叫 `agentRegistry.buildLaunchCommand()`，組出 `codex <customArgs> '<prompt>'` → 同 TUI 路徑。⇒ 提權環境下 **Tower 以 Codex CLI 派發 Worker 也會失敗**（未實跑派發） |

補充事實：
- `--yolo` **確認來自** `agentCustomArgs['codex-cli'] = "--yolo"`（`%APPDATA%\BetterAgentTerminal\settings.json`）。`agentCustomArgs['codex-agent']` 也是 `"--yolo"`，但 codex-agent 走 SDK，不受影響。
- PATH 上 codex 依序：`%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex`（0.160.0）、`%APPDATA%\npm\codex`（**0.133.0**）。終端 preset 是把指令打進 shell，**實際 binary 由 shell PATH 決定，BAT 不知版本** —— 這是方案選擇的關鍵限制。

**嚴重度建議**：維持 🟡 medium。Codex Agent 面板（BAT 主推整合路徑）不受影響；壞的是終端 TUI preset 與 codex-cli 派發。建議 BUG-085 `impact` 補上 `ct-dispatch-codex-cli（提權環境）`。

### 目標 2：關閉 daemon 的手段

| 手段 | 0.160 結果 | 0.133 結果 | 判定 |
|------|-----------|-----------|------|
| `--no-daemon`（TUI / resume / fork 皆有） | ✅ 越過（仍執行） | ❌ `error: unexpected argument '--no-daemon' found`，**exitCode 2** | 證實可用；舊版不相容 |
| `--disable daemon_auto_start` | ✅ 越過 | ❌ `Error: Unknown feature flag: daemon_auto_start`，**exitCode 1** | 證實可用；舊版不相容 |
| `-c features.daemon_auto_start=false` | ✅ 越過（含 `--strict-config`、放在 `resume` / `fork` 子命令前） | ✅ 容忍，正常進登入畫面 | **證實可用；跨版本相容** |
| `config.toml` `[features]` `daemon_auto_start = false` | ✅ 越過 | （未測；`-c` 等價） | 證實可用；但需改使用者 `~/.codex/config.toml`，侵入性最高 |
| env 開關 | — | — | **排除**：binary 字串中 daemon 相關 env 只有 `CODEX_DAEMON_SHUTDOWN_FILE` / `CODEX_DAEMON_SHUTDOWN_SOCKET` / `CODEX_DAEMON_TELEMETRY_HANDOFF` / `CODEX_INSTALL_DAEMON_ONLY`，**無**停用 auto-start 的 env |

`codex features list`：`daemon_auto_start   stable   true`（0.133 無此 feature）。binary 內 daemon 決策 reason 字串：`explicit_remote` / `incompatible_option` / `explicit_no_daemon` / `auto_start_disabled` / `existing_daemon` / `auto_start`；另有 `implicit daemon connection requires non-elevated current-user tokens`。

**最不侵入**：`-c features.daemon_auto_start=false`（僅作用於該次呼叫、不寫使用者 config、舊版容忍）。

### 目標 3：`--no-daemon` 副作用

| 項目 | 判定 | 證據 |
|------|------|------|
| resume / fork 相容 | **證實相容** | `codex resume --last --no-daemon`、`codex fork --last --no-daemon` 皆越過檢查；錯誤訊息本身也要求 resume/fork 加此旗標 |
| exec 相容 | **不適用** | exec 無此旗標、也不需要（見目標 1） |
| 與其他選項衝突 | **證實** | `--no-daemon --remote ...` → `ERROR: --no-daemon cannot be used with --remote.`（exit 1）；binary 字串另有 `--no-daemon cannot be used with codex agents` / `codex queue`（這兩個子命令本就需共享 server，提權下無論如何不可用） |
| 舊版 codex 遇未知旗標 | **證實直接 exit** | 0.133：`error: unexpected argument '--no-daemon' found`，exitCode 2 |
| `daemon_auto_start=false` 在「已有非提權 daemon 運行」時是否仍嘗試連線被拒 | **無法判定** | 本機 `EnableLUA=0`，無法產生非提權 token / daemon 重現；log DB（`logs_2.sqlite`）無 daemon 決策紀錄。`--no-daemon` help 明寫 "even if it is already running"，`auto_start_disabled` 無同等保證文字 |

### 目標 4：BAT 補強方案

| 方案 | 內容 | 優點 | 缺點 |
|------|------|------|------|
| A | 提權時注入 `--no-daemon` | 語意最明確（含既有 daemon 情境） | **PATH 上若是 < 0.160 codex 會 exit 2**（本機就有 0.133 npm shim）；BAT 無法得知 shell 會解析到哪一版 |
| **B'（推薦）** | 提權時注入 **`-c features.daemon_auto_start=false`** | 0.160 / 0.133 實測皆可啟動；不寫使用者 config；不需 env | 「已有非提權 daemon」情境無法判定（UAC 開啟機器才可能遇到）；使用者若在 customArgs 自加 `--strict-config` 且 PATH 為舊版會 exit 1（0.133 實測 `unknown configuration field features.daemon_auto_start`） |
| B（env / config.toml） | — | — | 無 env；改 `config.toml` 動到使用者全域設定，排除 |
| C | 只在失敗時顯示 i18n 提示 | 零行為改動 | 終端 preset 是打字進 shell，BAT 不解析 PTY 輸出，難以可靠偵測「失敗」；只能做成「提權時一次性提示」 |
| D（評估後排除） | 以降權 token 啟動 codex（`runas /trustlevel` 類） | — | `EnableLUA=0` 時無 limited token 可拆；脆弱且 Electron 側無乾淨 API |

**推薦：B' + 一次性提示（C 變形）**

1. **提權偵測**（main process，啟動時一次並 cache）：Windows 以 `execFile('%SystemRoot%\\System32\\whoami.exe', ['/groups'])` 找 `S-1-16-12288`（High Mandatory Level），timeout 5s；或 `fltmc` / `net session` exit code 0。非 Windows 一律 `false`。本機實測：`whoami /groups` → `Mandatory Label\High Mandatory Level ... S-1-16-12288`；`net session` / `fltmc` rc=0。⚠️ Git Bash 的 `whoami` 是 `/usr/bin/whoami`，**必須用 System32 絕對路徑**。
2. **注入點（單一 choke point）**：`electron/agent-runtime/agent-registry.ts` `buildLaunchCommand()` 於 `definitionId === 'codex-cli'` 時插入 `-c features.daemon_auto_start=false`。所有入口都經過它：renderer 3 處 `WorkspaceView.tsx`（:452 / :763 / :848，經 IPC `agent:build-launch-command` `electron/main.ts:3750-3752`）與 `main.ts:589` `buildAgentPromptCommand()`（Tower 派發 / remote）。registry 為同步方法 → 建議 app ready 時先偵測，把結果 set 進 registry（例如 `agentRegistry.setElevated(bool)`），不要讓它變 async。
   - 去重：customArgs 已含 `--no-daemon` 或 `daemon_auto_start` 時不注入（實測兩者並存也能跑，純整潔）。
   - 不對 `codex-agent` / `codex-agent-worktree` 注入（SDK 路徑不需要）。
3. **一次性提示**：提權時首次開 Codex CLI 分頁（或 app 啟動）toast 說明「BAT 以系統管理員權限執行，Codex CLI 已自動停用背景 daemon」，並附手動繞法 `--no-daemon`；可順帶提示「BAT 以管理員執行本身為風險面」。i18n 三語：`src/locales/en.json` / `zh-TW.json` / `zh-CN.json`。

**建議實作工單 `affects_files`**：
- `electron/agent-runtime/agent-registry.ts`（codex-cli 注入 + elevated 狀態）
- `electron/windows-elevation.ts`（新：提權偵測，`execFile` + 絕對路徑 + timeout，比照 `electron/claude-resolver.ts` 範本）
- `electron/main.ts`（app ready 偵測 → 注入 registry；提示用 IPC / event）
- `src/components/WorkspaceView.tsx`（若做一次性 toast）
- `src/locales/en.json`、`src/locales/zh-TW.json`、`src/locales/zh-CN.json`
- 測試：`electron/agent-runtime/__tests__/agent-registry*.test.ts`（新增或擴充）、`electron/__tests__/windows-elevation.test.ts`

**測試建議**：
- unit：`buildLaunchCommand('codex-cli')` 在 elevated=true/false 的輸出；customArgs 已含 `--no-daemon` 時去重；`codex-agent` 不注入；非 Windows 不注入；`whoami /groups` 輸出解析（High / Medium / 偵測失敗 → false）。
- runtime smoke（本機 `EnableLUA=0` 可直接重現）：開 Codex CLI 分頁 → 應進 TUI 而非 exit；Tower 以 codex-cli 派發一張工單。
- 迴歸：UAC 開啟 + 非提權執行 BAT 時，指令**不**應帶 `-c features.daemon_auto_start=false`（daemon 行為不變）。

**風險**：
- 「已有非提權 daemon」情境（UAC 開啟 + 以系統管理員執行 BAT + 使用者另在一般終端跑過 codex）下 `daemon_auto_start=false` 是否足夠：**無法判定**，需 UAC 開啟機器驗收；若不足，退路為偵測到 PATH codex ≥ 0.160 時改注入 `--no-daemon`（可沿用 `codex-runtime-resolver.ts` 的 `--version` 解析，但 shell PATH 與 BAT 解析的 PATH 可能不同）。
- codex 未來若改名 / 移除 `daemon_auto_start` feature：`-c` 未知鍵預設忽略，最差情況是退回現狀錯誤，不會更糟。
- 使用者手打 `codex` / `codex resume` 不會被注入，只能靠提示文字教育。

### 互動紀錄

| # | 問題 | 回答 |
|---|------|------|
| Q1 | 可否用 scratchpad 隔離 CODEX_HOME（無 auth）跑 codex 啟動 smoke | 允許（Recommended） |
| Q2 | 可否比照 T0366 複製 `~/.codex/auth.json` 到隔離 CODEX_HOME 跑一回合極小 smoke | 允許隔離複本 smoke（Recommended） |

auth 驗證：實驗前後 `~/.codex/auth.json` sha256 前 16 碼皆為 `3ca79ddeb98292fe`，mtime 皆為 `2026-09-30 14:27:37`，**未觸發 token refresh**。額度消耗：2 回合 `pong`（low effort）。

### 證據分道

| 分道 | 狀態 |
|------|------|
| source / docs 檢查 | PASS（preset / registry / main / WorkspaceView / SDK / resolver 只讀） |
| runtime smoke（隔離 CODEX_HOME，ConPTY + SDK） | PASS（如上） |
| build / tests | N/A（研究單，未改程式碼） |
| UAC 開啟機器驗證 | 未執行（本機 `EnableLUA=0`，且不得改 UAC） |

### 變更檔案

- `_ct-workorders/T0375-research-bug085-codex-daemon-elevated-windows.md`（僅本工單檔）
- 主工作樹 `package.json` / `choco/better-agent-terminal.nuspec` 為開工前既有 dirty，未碰、未 commit。`~/.codex/`、UAC、登錄檔皆未改動。scratchpad 已清空；實驗前即存在的 VS Code codex app-server（PID 40128）非本研究啟動。

### 建議下一張工單

- **T-next（fix）**：BUG-085 方案 B'，`affects_files` 如上；驗收需本機（提權）+ UAC 開啟機器各一次。
- BUG-085 欄位更新（塔台決定）：`impact` 的 `codex-agent（待確認）` → 不受影響（T0375 證實）；補 `ct-dispatch-codex-cli`；嚴重度維持 medium。

### Commit

僅 commit 本工單檔（`git commit --only`），不 push。
