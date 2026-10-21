---
schema_version: 1
schema_kind: workorder
id: T0664
title: "v0.7.1-pre.2 已安裝版自動化驗收：BUG-162 權限請求不經鍵盤結束後 ⚠️ 消失（PostToolBatch）"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-verify-071pre2
priority: P1
sizing: S
created_at: "2026-10-18T21:30:28+0800"
started_at: "2026-10-18T21:32:31+0800"
updated_at: "2026-10-18T21:44:19+0800"
completed_at: "2026-10-18T21:44:19+0800"
target_version: "0.7.1-pre.2（驗收，不發版）"
related:
  - "BUG-162 / T0657（`ff14fa5d`；回報區第 3 點：bypass 下 safety check 仍回 `ask`、`autoDenyWindow`、`PostToolBatch` 時機）"
  - "`e2e/t0590-blocked-state.spec.ts`（blocked 狀態 e2e 範本）、`e2e/pre7-acceptance.spec.ts`（安裝版 + 隔離實例範本）"
  - "docs/agent-guide/blocked-state.md"
  - "T0663（同時進行：BUG-157 / 158 / 160 / 161 / 163，另一個 spec 檔）"
affects_files:
  - e2e/v071-pre2-blocked-acceptance.spec.ts
  - _ct-workorders/T0664-pre2-installed-blocked-clear-acceptance.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只寫驗收工具 / opt-in spec，不改產品程式碼**（`electron/**`、`src/**`、`scripts/**`、`package.json`、`e2e/fixtures/**` 不動，`e2e/fixtures/` 只讀 / 只 import）。發現產品缺陷 → 回報區記證據，該項 FAIL、整單 PARTIAL，**不自行修**。BUG 檔與 `_bug-tracker.md` 不動。"
  - "🔴 **受測 build = 已安裝的 pre.2**：`C:/Program Files/BetterAgentTerminal/BetterAgentTerminal.exe`（開工時確認 FileVersion `0.7.1-pre.2`，隔離實例 `app.getVersion()` 也要相符），以 `BAT_E2E_EXECUTABLE` + `e2e/fixtures/electron-isolation.ts` 的 `launchIsolated` 啟動。hook 腳本與 claude 一律用**安裝版內附**的（`resources/scripts/bat-hook.mjs`、內嵌 claude），不用 repo 的 `scripts/`。"
  - "🔴 **不碰使用者正在用的 BAT**（port 9876、真實 userData 只讀）；不得對使用者的分頁送任何輸入。"
  - "🔴 **Claude token 上限**：只有 V2 可以跑真實 claude，最多 3 個短回合（能指定就用最便宜的模型，例如 `--model haiku`），回報區記實際回合數。使用者 `~/.claude` 只讀。真實 claude 的 cwd 一律是本單建立的 temp 目錄；prompt 要它刪除的目標只能是該 temp 目錄底下本單建立的檔案。"
  - "🔴 **驗證期間不得有使用者輸入**：判定 ⚠️ 消失的那一段，不得經 `pty:write`（使用者輸入會清 `blocked`）；需要寫入 PTY 時只用 `pty:write` 第三參數 `{ auto: true }`，並在回報區寫明。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 `npm run test:e2e`（L141）。commit 用 `git commit --only <本單檔案>`（L168：T0663 同時在跑）。工作樹裡 `src/styles/settings.css` 顯示 M（內容無差異），不要動、不要提交。"
  - "🔴 **證據不要放在 Playwright `outputDir`（`e2e-results/`）底下**（L169）；放 temp / scratch 目錄，回報區寫絕對路徑。"
---

# T0664 — v0.7.1-pre.2 已安裝版自動化驗收（BUG-162）

## 背景

`v0.7.1-pre.2` 已安裝（FileVersion `0.7.1-pre.2`，塔台 2026-10-18 21:27 確認）。BUG-162：權限請求（hook `permission-request`）讓分頁進入 `blocked` / `permission`，但請求不經鍵盤結束（滑鼠允許 / 拒絕、自動拒絕）後 ⚠️ 一直留到該回合 `Stop`。T0657 加了 async `PostToolBatch` hook（批次結束後只清 `permission`，依 `agent_id` 區分 subagent），驗的是單元測試與 headless e2e，**沒有用真實 claude 跑過**。本單用已安裝的 pre.2 驗。

使用者指示「只做能自動化的」：能以 state 查詢 / 日誌判定的做到 PASS / FAIL；真實 claude 觸發不了權限提示時記 NEEDS-HUMAN 並寫明試過什麼，不要為了湊 PASS 擴大範圍。

## 驗收項目

| # | 驗收重點 |
|---|---|
| V0 | 安裝版內容：隔離實例的 claude-cli 分頁注入的 `--settings=<dataDir>/bat-mcp/claude-settings.json` 含 `PostToolBatch`（async、無 matcher）；安裝版 `resources/scripts/bat-hook.mjs` 認得 `post-tool-batch`；內嵌 claude 版本（記版號）的二進位含 `PostToolBatch` |
| V1 | 合成 hook（不耗 token）：在隔離實例的分頁內，以該分頁自己的 env 跑安裝版 `bat-hook.mjs`，依序送 `PermissionRequest` → 數秒後 `PostToolBatch` 的 payload（stdin JSON，欄位依 T0657 回報區）：`terminal:get-state` 由 `blocked` / `permission` / `source: hook` 變回非 blocked，期間沒有使用者輸入；subagent 情境（`agent_id` 不同）：主執行緒的批次結束**不**清 subagent 的權限，subagent 自己的批次結束才清。hook 腳本 exit 0、stdout 0 bytes |
| V2 | 真實 claude（≤ 3 回合）：隔離實例開 claude-cli 分頁（內嵌 claude，BAT 照常注入 hooks；需要時帶 `--dangerously-skip-permissions`），讓它執行會觸發權限提示的指令（T0657 回報區：bypass 下 safety check 仍 `ask`，例如危險的 `rm`，目標只能是本單 temp 目錄內的檔案；或一般模式下的 Bash）。過程不經使用者輸入：(a) 出現 `blocked` / `permission`；(b) 權限請求結束（自動拒絕 / 逾時，或以 `{ auto: true }` 寫入允許）後、該回合 `Stop` 之前，state 離開 `blocked`；(c) 隔離實例 debug log 有 `post-tool-batch` 事件造成的清除。觸發不了權限提示 → V2 NEEDS-HUMAN（寫明試過的 prompt / 模式） |

每項標 PASS / FAIL / NEEDS-HUMAN，附證據（state 回傳的時間序列、debug log 摘錄、`bat-scripts.log` 摘錄；不得記權杖值）。

## 驗證

- 新增 opt-in spec `e2e/v071-pre2-blocked-acceptance.spec.ts`：以 `BAT_E2E_V071PRE2=1` + `BAT_E2E_EXECUTABLE` gate，預設 skip；V2 另需 `BAT_E2E_REAL_CLAUDE=1`（預設 skip，避免日後誤耗 token）。
- 回報區附執行指令、結果（passed 數、耗時）、claude 實際回合數、證據目錄。
- 收尾：隔離 userData 已刪、Terminal Server 與 claude 程序不殘留、temp 目錄已刪。

## 驗收條件

- [x] V0–V2 各有 PASS / FAIL / NEEDS-HUMAN 與證據
- [x] 受測 exe FileVersion 與 `app.getVersion()` = `0.7.1-pre.2`
- [x] 未改產品程式碼；未碰使用者 BAT；claude 回合數 ≤ 3
- [x] 環境清理完成

## Sub-session 執行指示

1. 讀本工單、BUG-162、T0657 回報區、`docs/agent-guide/blocked-state.md`、`e2e/t0590-blocked-state.spec.ts`、`e2e/fixtures/electron-isolation.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（時間用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取，R-G001）
3. 實作 → 執行 → 填回報區（DONE：每項都有結論且無 FAIL；PARTIAL：有 FAIL 或沒做完）
4. `git commit --only` 本單產出；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

**DONE**：V0 / V1 / V2 全部 **PASS**，沒有 FAIL / NEEDS-HUMAN。BUG-162 的修正（T0657 `PostToolBatch`）在已安裝的 `0.7.1-pre.2` 以真實內嵌 claude 驗證有效。

### 落點檢查（Landing Zone）

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 REPO_ROOT 下 → PASS；C-3：`e2e/v071-pre2-blocked-acceptance.spec.ts` 的上層 `e2e/` 存在 → PASS；C-2：工單無 `branch` 欄位（目前 `main`）
- 非隔離工單（`CT_HOME` 未設）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 產出摘要

**受測 build**：`C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`，FileVersion `0.7.1-pre.2`；兩次隔離實例的 `app.getVersion()` 都是 `0.7.1-pre.2`（spec 內 `expect` 驗證）。hook 腳本是安裝版 `resources/scripts/bat-hook.mjs`（`BAT_HELPER_DIR` = 安裝版目錄），claude 是內嵌 `resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code/bin/claude.exe` **2.1.300**。

**新增 opt-in spec** `e2e/v071-pre2-blocked-acceptance.spec.ts`（commit `67ef0a73`）：`BAT_E2E_V071PRE2=1` + `BAT_E2E_EXECUTABLE` gate（沒設 → 2 skipped，已實跑確認）；V2 另需 `BAT_E2E_REAL_CLAUDE=1`。每個檢查把結論寫進 `<evidence>/results.json`（`BAT_E2E_V071PRE2_EVIDENCE_DIR`，預設 `%TEMP%\bat-v071pre2-blocked\evidence`，不在 `e2e-results/` 底下）。spec 單獨 `tsc --strict` 0 錯誤。

| # | 結論 | 證據 |
|---|---|---|
| V0 | **PASS** | `batMcpLaunchArgs('claude-cli', …)` 回 `'--mcp-config=…' '--settings=<userData>\bat-mcp\claude-settings.json'`；設定檔只有 `hooks`，事件序 `PermissionRequest, PreToolUse, Notification, PostToolUse, ElicitationResult, PostToolBatch, UserPromptSubmit, Stop, SessionStart`；`PostToolBatch` = 一個 entry、**無 matcher**、`async: true`、command `node 'C:/Program Files/BetterAgentTerminal/resources/scripts/bat-hook.mjs' post-tool-batch`；無權杖 / `disableAllHooks`。安裝版 `bat-hook.mjs` 的 `HOOK_EVENTS` 含 `post-tool-batch`、`'post-tool-batch': ['PostToolBatch']`、`HOOK_INPUT_STOP_FIELDS` 有 `'post-tool-batch': 'tool_calls'`。內嵌 claude `2.1.300 (Claude Code)`，二進位含 `PostToolBatch` 字串（spec 計數 > 0；手動 `grep -c` = 34） |
| V1 | **PASS** | 合成 hook（不耗 token）。塔台分頁 `--set-role tower` 後派工 custom CLI Worker，Worker 分頁以自己的 env 跑安裝版 `bat-hook.mjs`；塔台以 BAT MCP `bat_get_state` 讀狀態（時間序列見下）。5 次 hook 全部 exit 0、stdout 0 bytes（55–64 ms）。Worker 分頁從未收到任何寫入 |
| V2 | **PASS** | 真實 claude **1 個回合**（haiku `claude-haiku-5-5`），bypass 下危險 rm 安全檢查對話框，無人回答，120 s 後 claude 自動拒絕；`post-tool-batch` 在 `Stop` 之前 2 s 清除。細節見下 |

**V1 時間序列**（UTC，塔台 `bat_get_state`）：
- 13:40:00.950 PermissionRequest（主執行緒）後：`blocked` / `permission` / `source: hook` / `blockedDetection: hook`
- 13:40:05.239 約 3 s 後 PostToolBatch（主執行緒）後：`working` / `source: output`（離開 blocked）
- 13:40:05.718 PermissionRequest（`agent_id` `a1b2c3d4e5f6`）後：`blocked` / `permission` / `hook`
- 13:40:09.983 PostToolBatch（主執行緒、無 `agent_id`）後：**仍** `blocked` / `permission`（bat-scripts.log 該次 `result: unchanged`）
- 13:40:14.261 PostToolBatch（`agent_id` `a1b2c3d4e5f6`）後：`idle`（離開 blocked）
- debug log：`[blocked] terminal=94cf3b9b… → blocked reason=permission (hook permission-request tool=Bash)` / `→ cleared (hook post-tool-batch)` / `→ blocked reason=permission (hook permission-request tool=Bash agent=a1b2c3d4e5f6)` / `→ cleared (hook post-tool-batch agent=a1b2c3d4e5f6)`；沒有 `cleared (user input)`；`tool_input` / `tool_calls` 內的標記字串不在 debug log 與 bat-scripts.log

**V2 真實 claude**：
- 做法：隔離實例的塔台分頁派工 `bat-terminal.mjs --notify-id … --workspace … --agent claude-cli --prompt "<prompt>"`（不經 `pty:write` 輸入 prompt）；工作區 `agentCustomArgs['claude-cli']` = `--dangerously-skip-permissions --model claude-haiku-5-5`。實際啟動命令：安裝版內嵌 `claude.exe '--mcp-config=…' '--settings=…\claude-settings.json' '--name=T0664 claude · 8ad265' --dangerously-skip-permissions --model claude-haiku-5-5 '<prompt>'`。prompt：在拋棄式暫存目錄、只用 Bash 執行一次 `rm -rf <claude 自己的 cwd（本單建立的 temp\ws）>`，被拒絕就不要重試、回 DONE。觸發的是 claude 2.1.300 內建檢查「Dangerous rm operation on working directory or its ancestor」（Worker 輸出擷取），不受 bypass 影響。
- bat-scripts.log（Worker 的 bat-hook 回報，UTC）：13:40:40.624 `session-start → started`；13:40:40.625 `user-prompt-submit → unchanged`；13:40:42.305 `permission-request → blocked`；**13:42:42.335 `post-tool-batch → cleared`**（剛好 120 s，claude 逾時自動拒絕）；13:42:44.343 `stop → unchanged`。
- (a) PASS：塔台 poller（`bat_get_state` 每 2 s）取樣到 `blocked` / `permission` / `hook`。
- (b) PASS：`post-tool-batch` 清除（13:42:42.335）早於 `Stop`（13:42:44.343），`Stop` 的結果是 `unchanged`（當時已不是 blocked）；清除後第一個取樣 13:42:43.918 為 `working`。整段沒有任何寫入 Worker 分頁（沒有使用者輸入，也沒用 `{ auto: true }` 寫 Worker）。
- (c) PASS：debug log `[blocked] terminal=8ad265dc… → blocked reason=permission (hook permission-request tool=Bash)` → `[blocked] terminal=8ad265dc… → cleared (hook post-tool-batch)`，沒有 `cleared (user input)`。
- claude 實際回合數：**1**（`UserPromptSubmit` 回報 1 次；claude 回覆 `DONE`，沒有重試）。
- claude 設定隔離：`CLAUDE_CONFIG_DIR` = 本單 temp 目錄（預填 onboarding / 信任 / bypass 確認），只從使用者 `~/.claude/.credentials.json` **讀取**存取權杖寫進 temp（不複製 refresh token，避免輪替使用者登入；權杖 15 分鐘內到期時 spec 自動 skip）。事後確認：使用者 `.credentials.json` mtime 仍為 16:38:49（未變）、`~/.claude/projects` 沒有本單目錄。

**執行指令與結果**（PowerShell 寫法見 spec 檔頭；本次以 Git Bash 設 env）：
- `BAT_E2E_V071PRE2=1 BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe' BAT_E2E_V071PRE2_EVIDENCE_DIR=<evidence> npx playwright test e2e/v071-pre2-blocked-acceptance.spec.ts -g "V0"` → **1 passed / 1 skipped（V2）**，19.8 s
- 同上加 `BAT_E2E_REAL_CLAUDE=1`，`-g "V2"` → **1 passed**，2.3 min（21:40:32–21:42:51 +0800）
- 不帶 env：**2 skipped**

**證據目錄**：`<使用者資料夾>\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\0e4f8b39-d65e-44ba-8dfe-62e4ca82b7af\scratchpad\t0664-evidence\`（`results.json`、`v0-claude-settings.json`、`v1-debug-blocked.log`、`v1-bat-scripts.jsonl`、`v2-debug.log`、`v2-bat-scripts.jsonl`、`v2-state-samples.jsonl`、`v2-worker-output.txt`）；所有檔案 `batcap.` / `accessToken` / `sk-ant` 計數 0。

**環境清理**：兩次 teardown 都是「Terminal Server pid … alive after teardown: false」、「runtime userData removed: true」、「temp dir removed: true」；V2 另查 `claude.exe` 中命令列含該 runtime 的程序：none。事後 `ls` 確認 `%TEMP%\bat-t0664-*`、`%APPDATA%\BetterAgentTerminal-runtime-e2e-t0664-*` 都不存在。

**約束遵守**：未改產品程式碼（只新增 spec、只 import `e2e/fixtures/electron-isolation.ts`）；BUG 檔 / `_bug-tracker.md` 未動；未碰使用者 BAT（隔離實例的 RemoteServer 在空閒 port，fixture 去掉繼承的 `BAT_*`）；`pty:write` 只寫隔離實例的塔台分頁、一律 `{ auto: true }`；未用 stash / reset / checkout / restore；不 push；未跑全套 e2e；`src/styles/settings.css` 未動未提交。

### Commit

- `67ef0a73` test(e2e): T0664 v0.7.1-pre.2 installed acceptance of BUG-162 PostToolBatch clear (opt-in)（`git commit --only` 該 spec）
- 本工單收尾另一個 commit（`git commit --only` 本工單檔）；未 push

### 互動紀錄

- 無（yolo、`CT_INTERACTIVE=0`，沒有需要塔台決定的問題）。

### 遭遇問題

- 無阻塞。
- 附註：V2 Worker 輸出開頭有一行舊命令（另一個 e2e runtime `e2e-t0644-…` 的 repo claude `--version`），是 pwsh PSReadLine 歷史顯示，不是本次執行的命令；本次實際命令為安裝版內嵌 claude（見上）。
- 觀察（非本單範圍、未驗證）：`agentStarted` 在 V1 的 custom CLI Worker 一直是 `false`（沒有 `SessionStart`），符合 T0600 契約，不影響結論。

### 回報時間

2026-10-18T21:43:27+0800
