---
schema_version: 1
schema_kind: workorder
id: T0368
title: "研究：Claude Agent SDK 0.2.113 → 0.3.x / claude-code 2.1.113 → 2.1.289 升級影響與 Claude 5 系列模型支援"
type: research
status: DONE
priority: P2
sizing: S
created_at: "2026-10-04T15:57:28+08:00"
updated_at: "2026-10-04T16:08:49+08:00"
started_at: "2026-10-04T15:58:31+08:00"
completed_at: "2026-10-04T16:08:49+08:00"
target_version: next
depends_on: []
related:
  - "T0165 / commit 84c2930（2026-04-18 上次 bump：SDK ^0.2.111 / CLI ^2.1.111 + Opus 4.7）"
  - "PLAN-027（claude runtime selection：embedded / system；electron/claude-runtime-router.ts）"
  - "BUG-059（embedded CLI auto-update；DISABLE_AUTOUPDATER 注入）"
  - "T0366（同類研究：Codex 版本落後，可參考其方法與報告結構）"
affects_files: []
interaction:
  mode_hint: yolo
  interactive: true
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究工單，不改產品程式碼、不升級依賴、不 commit `package.json` / `package-lock.json`**。實驗請在 scratchpad 或 `git worktree` 進行，結束前清乾淨；主工作樹除本工單檔外不得留下改動。"
  - "🔴 **與 T0367 並行**：T0367 正在改 `electron/codex-agent-manager.ts`、`src/components/CodexAgentPanel.tsx`、`src/locales/*`、`src/lib/codex-error-classify*`。這些檔一律不要碰，也不要 `git stash` / `checkout` 主工作樹。"
  - "🔴 不改 `~/.claude/` 下任何檔案、不改使用者全域安裝的 claude CLI（只讀）。"
  - "🔴 模型 ID、context 長度、價格**一律以官方來源為準**（Anthropic 文件 / SDK 型別 / CLI 實測），不得憑記憶填寫；來源要寫在報告裡。"
---

# T0368 — 研究：Claude Agent SDK 0.3 升級影響與 Claude 5 系列模型支援

## 元資料

- **類型**：research
- **互動模式**：enabled（每次 ≤ 3 題；能用實驗回答的不要問）
- **工作量預估**：S
- **Context Window 風險**：中（SDK changelog 跨 0.2.113 → 0.3.289，請挑與 BAT 用法相關的重點）

## 背景

塔台 2026-10-04 查得：

| 套件 | `package.json` | 實裝（repo 與已安裝 BAT 相同） | npm 最新 |
|------|---------------|------------------------------|---------|
| `@anthropic-ai/claude-agent-sdk` | `^0.2.111`（:43） | 0.2.113（2026-04-17） | **0.3.289**（2026-10-03）—— `^0.2` 不會自動跨到 0.3 |
| `@anthropic-ai/claude-code` | `^2.1.111`（:44） | 2.1.113 | **2.1.289**（同 range，被 lock 鎖住） |

`BAT_BUILTIN_MODELS`（`electron/claude-agent-manager.ts`）最新只到 `claude-opus-4-7`，無 Claude 5 系列。Codex 端已因同類落後出事（BUG-083 / T0366：服務端以 CLI 版本擋新模型）。Claude 端有 PLAN-027 system runtime 可繞，但預設 embedded 使用者沒有。

## 研究目標

1. **現況是否已壞**：內嵌 CLI 2.1.113（經 SDK 0.2.113，與 BAT 同路徑）能否使用 Claude 5 系列模型？是否有「需要新版」類錯誤、模型清單刷新失敗等徵兆？舊模型（Opus 4.7 / Sonnet 4.6）是否仍可用？
2. **0.2 → 0.3 breaking changes**：對 BAT 的實際影響範圍。SDK 使用點：`electron/claude-agent-manager.ts`（`import type { Query, PermissionMode, CanUseTool, SlashCommand, SDKSession }` 等）、`electron/main.ts`、`scripts/build-server-bundle.mjs`（remote server bundle 也打包 SDK）。重點檢查：
   - `query()` 參數 / 回傳型別、串流 message 型別（含 `system` / `task_*` / `tool_use` / `tool_result`）
   - Agent/Task 子 agent 追蹤（CLAUDE.md「Sub-agent / Active Tasks Tracking」：BAT 從 `tool_use` 追蹤 `activeTasks`、`stopTask()` fallback）
   - permission / `canUseTool`、effort 參數與 `EFFORT_LEVELS`（`src/types/index.ts:123`）、`settingSources`、session resume / fork
   - 打包：`package.json` `build.asarUnpack` 中 `@anthropic-ai/claude-code` / `claude-agent-sdk` 的 binary 路徑是否改變（**T0366 發現 Codex 0.160 改了平台套件目錄結構，導致寫死路徑失效——請特別檢查 Claude 是否有同類變化**，含 `electron/claude-resolver.ts` / `claude-runtime-router.ts` 的 embedded 路徑解析）
3. **CLI 2.1.113 → 2.1.289**：若 SDK 留在 0.2，單獨把 CLI 升到 2.1.289 是否可行（SDK 0.2 驅動新 CLI 的相容性）？可作為低風險的第一步嗎？
4. **模型清單與計價**：需新增哪些模型 ID（含 `[1m]` 等 context 變體是否仍適用）、應否移除過時項；`MODEL_PRICING`（`src/components/ClaudeAgentPanel.tsx:3588`）需補哪些價格。**以官方來源為準並附出處**
5. **auto-update（BUG-059）**：新版 CLI 的 auto-update 行為與 `DISABLE_AUTOUPDATER=1` 是否仍有效

## 實驗限制

- 可用使用者現有 Claude 登入跑**極小** smoke（例如 prompt `Reply with exactly: pong`），每個組合 1 次，總數控制在 ~10 次內；**若需複製 credential 到隔離目錄，先問使用者**（T0366 Q1 先例）
- 新版 SDK/CLI 請裝在 scratchpad 或 worktree，不得動主工作樹 `node_modules`

## 回報要求

- 「調查結論」逐題作答，附證據（指令輸出、型別 diff、程式碼行號）
- 「建議方向」給升級路徑選項（例：A 只升 CLI 2.1.289 + 補模型清單；B SDK 0.3 + CLI 一起升；或分階段），每個選項列改動檔案、工作量、風險，並給推薦
- 「建議下一步」列可直接拆成實作工單的項目與建議 `affects_files`
- 指出 CLAUDE.md「Claude Agent SDK / CLI」節需要更新的內容（**本工單不改 CLAUDE.md**，只列出）

## Sub-session 執行指示

1. 讀取本工單全部內容；可參考 `T0366-research-bug083-codex-version-skew.md` 的報告結構
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 依研究目標 1 → 5 調查
4. 填寫回報區、更新 `status` / `completed_at` / `updated_at`
5. commit **僅本工單檔**（`git commit --only _ct-workorders/T0368-research-claude-sdk-0.3-upgrade.md`）
6. 依派發 mode 通知塔台（`bat-notify.mjs`；YOLO 依 ct-exec 規則帶 `--submit`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** — 五個研究目標皆有實驗或型別證據的結論，可直接拆實作工單。

- **Landing Zone**：WARN — C-0 `repo` 欄位 absent（觀察到 `basename(REPO_ROOT)` = `better-agent-terminal`）；C-1 PASS（工單位於 `REPO_ROOT/_ct-workorders/`）；C-3 not applicable（`affects_files: []`）；C-2 無 `branch` 欄位（HEAD = `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅作證據）。
- **派發模式**：`CT_MODE=yolo`、`CT_INTERACTIVE=1`。
- **主工作樹**：除本工單檔外無改動（`AGENTS.md` 為開工前既有的 dirty，未碰；T0367 / T0369 的檔案未碰）。新版套件裝在 scratchpad `t0368/new/`；`~/.claude/` 只讀。
- **Commit**：僅本工單檔（`git commit --only`），未 push。

### 互動紀錄

| # | 問題 | 使用者回答 |
|---|------|-----------|
| Q1 | 是否允許把 `~/.claude/.credentials.json` 複製到 scratchpad 隔離的 `CLAUDE_CONFIG_DIR` 跑極小 smoke（跑完刪除；風險：少量額度、OAuth refresh 輪替） | 允許隔離複本 smoke |

auth 驗證：實驗前後 `~/.claude/.credentials.json` sha256 前 16 碼皆為 `8169ed6e7b1ea452`，mtime 皆為 `2026-10-04 15:18:25.43 +0800`；隔離複本跑完與主檔 byte 相同（**未觸發 token refresh**），已刪除。smoke 共 10 次（遠低於上限），全部設 `DISABLE_AUTOUPDATER=1`。

### 調查結論

#### 0. 研究基準

| 項目 | 值 |
|------|----|
| repo `node_modules` | `claude-agent-sdk` 0.2.113（自帶 `claude-agent-sdk-win32-x64/claude.exe` = 2.1.113）、`claude-code` 2.1.113 |
| 已安裝 BAT（`C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@anthropic-ai\`） | 同上；`claude-code/bin/claude.exe`、`claude-code-win32-x64/claude.exe`、`claude-agent-sdk-win32-x64/claude.exe` **三份各 245,966,496 bytes** |
| PATH 上的 claude | `C:\Users\Gower\.local\bin\claude` → `2.1.288`（官方 installer） |
| npm 最新 | `claude-agent-sdk` `latest`=0.3.289（0.2 線最後一版 0.2.141）；`claude-code` `latest`=2.1.289、`stable`=2.1.285 |
| 新版實驗位置 | scratchpad `t0368/new/`（`npm install @anthropic-ai/claude-agent-sdk@0.3.289 @anthropic-ai/claude-code@2.1.289`，npm 11.19.0） |

smoke 方法：scratchpad `smoke.mjs` 以 `query()` + 與 `electron/claude-agent-manager.ts:707-728` 相同的關鍵選項（`systemPrompt`/`tools` preset `claude_code`、`settingSources: ['user','project','local']`、`thinking: {type:'enabled'}`、`effort`、`includePartialMessages`、`canUseTool`、`pathToClaudeCodeExecutable`）；prompt `Reply with exactly: pong`。

#### 1. 現況是否已壞：**是 —— 內嵌 2.1.113 已被服務端擋掉 Claude 5 主力模型**

| # | SDK / CLI | model | 結果 |
|---|-----------|-------|------|
| 1 | 0.2.113 / 2.1.113（= BAT 內嵌） | `claude-opus-5-5` | ❌ `API Error: 400 ... "Claude Code 2.1.113 does not support this model; version 2.1.280 or newer is required. Run 'claude update', or update the Claude desktop app, then try again." "error_code":"claude_code_version_too_old"`（`req_011CfgrA72sUuecgiqB9xRCj`） |
| 2 | 0.2.113 / 2.1.113 | `claude-sonnet-5-5` | ✅ `pong`（目前尚未設門檻） |
| 3 | 0.2.113 / 2.1.113 | `claude-fable-5-1` | ❌ 同上，`version 2.1.251 or newer is required`（`req_011CfgrAfh9bUb1c67swXH3u`） |
| 4 | 0.2.113 / 2.1.113 | `claude-opus-4-7` | ✅ `pong` |

- 與 Codex（BUG-083 / T0366 H1）**完全同型**：服務端以 CLI 版本擋新模型，且錯誤有機器可讀的 `error_code: claude_code_version_too_old`。
- BAT 看到的形式：assistant 訊息文字即為 `API Error: 400 {...}`，`result` 為 `subtype:'success'` + `is_error:true` + `api_error_status:400`，之後 SDK 迭代器拋例外。
- 模型清單徵兆：2.1.113 的 `supportedModels()` 只回 `default`（Sonnet 4.6）/ `sonnet[1m]` / `opus[1m]`（Opus 4.7）/ `haiku`，**完全看不到 Claude 5**；2.1.289 回 `default`/`opus` → `claude-opus-5-5`、`fable` → `claude-fable-5-1`、`sonnet` → `claude-sonnet-5-5`、`haiku` → `claude-haiku-4-5-20251001`。
- 時程風險：Sonnet 5.5 今天仍可在 2.1.113 使用，但門檻是服務端逐模型設定的（Opus 5.5 要 ≥2.1.280、Fable 5.1 要 ≥2.1.251），**隨時可能擴及 Sonnet 5.5**；屆時 embedded 使用者只剩 4.x 模型可用。
- 附帶發現（dev 環境）：repo `node_modules/@anthropic-ai/claude-code/bin/` 只剩 `claude.exe.old.1776856737641`，`claude-code-win32-x64/` 同樣只剩 `.old.1776856737641`（時間戳 = 2026-04-22T11:18:57Z，BUG-059 修復前的自動更新殘骸）。⇒ **dev mode 的 embedded 路徑目前不存在**（`resolveClaudeCodePath()` 會觸發 `assertClaudeCodePathOnce` 的 error log）。已安裝 BAT 不受影響。重裝 `@anthropic-ai/claude-code*` 即可恢復；`npm rebuild` 不夠（平台套件裡的 binary 也被改名）。本工單未修（禁止動主工作樹 `node_modules`）。

#### 2. SDK 0.2 → 0.3 breaking changes 對 BAT 的影響

**方法**：scratchpad 兩份 tsconfig，以 repo 的 TypeScript 對 `electron/claude-agent-manager.ts` + `electron/main.ts` 型別檢查，`paths` 分別指向 0.2.113 / 0.3.289 的 `sdk.d.ts`，比對錯誤 diff（基準本來就有 138 個與 SDK 無關的錯誤；0.3 為 140 個）。官方 CHANGELOG：`https://raw.githubusercontent.com/anthropics/claude-agent-sdk-typescript/main/CHANGELOG.md`。

| 面向 | 0.3 變化（CHANGELOG 版本） | 對 BAT 影響 |
|------|--------------------------|------------|
| **V2 session API** | 0.3.142 **Breaking**：移除 `unstable_v2_createSession` / `unstable_v2_resumeSession` / `unstable_v2_prompt` / `SDKSession` / `SDKSessionOptions`（0.2.133 起 deprecated）；改用 `query()` + `AsyncIterable<SDKUserMessage>` 或 `options.resume` | 🔴 **編譯失敗**：`claude-agent-manager.ts:8`（`SDKSession` import）、`:59-68`（`getV2Api`）、`:1391-1480`（V2 send/stream 路徑）。`claude-code-v2`「Claude Agent V2」preset（`electron/agent-runtime/agent-registry.ts:55`）須改寫成 `query()` 或下架。tsc diff 唯一新增的真錯誤就是這組 |
| `CanUseTool` 回傳型別 | 0.3 允許回傳 `null`（抑制自動 control response，`requestId` 關聯） | 型別訊息改變但錯誤數不變（`:603/624/667/670`、`:1326/1342/1376/1379` 是既有錯誤，訊息從 `PermissionResult` 變成 `PermissionResult \| null`）；runtime 無影響 |
| `query()` 參數 | `systemPrompt`/`tools` preset、`settingSources`、`thinking`、`effort`、`toolConfig.askUserQuestion.previewFormat`、`agentProgressSummaries`、`promptSuggestions`、`plugins`、`resume`/`continue`、`pathToClaudeCodeExecutable`、`executable` 皆保留 | 無 breaking（tsc diff 無新增） |
| `EffortLevel` | 0.2.113 與 0.3.289 皆為 `'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max'` | `EFFORT_LEVELS`（`src/types/index.ts:123`）不需改 |
| 串流 message | `system/init`、`task_started/progress/notification`、`stream_event`、`rate_limit_event`、`api_retry`、`result` 保留；新增 `system/commands_changed`、`background_tasks_changed`、`permission_denied`、`task_*` 多了 `ambient`/`is_backgrounded`/`spawn_depth` 等選填欄位；`api_retry` 的 529 改報 `error:'overloaded'` | 增量，BAT 未處理的 subtype 會被忽略；無 breaking |
| Agent/Task 追蹤 | `tool_use` 名稱仍可能是 `Task` 或 `Agent`（0.2.x 一度改名又 revert，預告下個 minor 改 `Agent`） | BAT 兩者都接（`claude-agent-manager.ts:978`、`ClaudeAgentPanel.tsx:368/608/2299`）✅；`stopTask()` fallback 不受影響 |
| **TodoWrite → Task tools** | 0.3.142 **Breaking**：headless/SDK session 改用 `TaskCreate/TaskUpdate/TaskGet/TaskList`；另（CLI 側）Opus 4.8 / Sonnet 5 / Fable 5 / Mythos 5 及更新模型**預設不提供** todo/task 工具，需在 `tools`/`allowedTools` 點名或設 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` | 🟠 行為退化：`ClaudeAgentPanel.tsx:2230` 的 TodoWrite 勾選清單在 Claude 5 模型上不會出現。**此項與 CLI 版本綁定，即使 SDK 留 0.2、只升 CLI 也會發生** |
| MCP 連線 | 0.3.142 **Breaking**：MCP server 改背景連線，慢的 server 在 `init` 回 `status:"pending"` | BAT 不自帶 `mcpServers` 選項，影響僅限使用者設定檔中的 MCP（首輪可能還沒工具）。可用 `MCP_CONNECTION_NONBLOCKING=0` 還原 |
| 依賴 | 0.3.143：`@anthropic-ai/sdk`（`>=0.93.0`）、`@modelcontextprotocol/sdk`（`^1.29.0`）、`zod`（`^4.0.0`）改為 peerDependencies；runtime 仍 bundle 在 `sdk.mjs` | repo 現為 `zod` 4.3.6 ✅、`@modelcontextprotocol/sdk` 1.29.0 ✅、`@anthropic-ai/sdk` 0.81.0 ❌（需 npm 自動補裝 ≥0.93）。只影響型別解析 |
| 打包 / binary 路徑 | `claude-code` 2.1.289 仍是 `bin/claude.exe`（postinstall `install.cjs` 從平台套件 copy/hardlink）；平台套件 `claude-code-win32-x64/claude.exe`、`claude-code-linux-x64/claude`、`claude-code-darwin-arm64/claude`（unpkg `?meta` 實查）與 2.1.113 **完全相同**；SDK 平台套件仍是 `claude-agent-sdk-<platform>/claude(.exe)` | ✅ **沒有 Codex 0.160 那類目錄結構變更**。`resolveClaudeCodePath()`（`claude-agent-manager.ts:94`）、`resolveEmbeddedClaudePath()`（`claude-runtime-router.ts:82`）、`main.ts:2191-2201`、`scripts/build-server-bundle.mjs:333-355`、`asarUnpack`（`package.json:214-217`）都不需改 |
| 體積 | win32-x64 binary 245,966,496 → 249,522,848 bytes（+1.4%）；linux-x64 246 MB、darwin-arm64 230 MB | 可忽略。但 BAT 目前每平台 ship **三份**同一 binary（見 0.），是既有的體積大戶 |
| engines | `claude-code` 2.1.289 `engines.node >=22`（2.1.113 為 `>=18`） | `.github/workflows/release.yml:134` desktop build job 仍用 **Node 20**（`pre-release.yml` 已是 24）→ `npm ci` 會出 EBADENGINE 警告，postinstall 在 Node 20 下執行有風險 |

#### 3. 只升 CLI 2.1.289、SDK 留 0.2：**可行，實測通過**

| # | SDK / CLI | 呼叫 | 結果 |
|---|-----------|------|------|
| 5 | 0.2.113 / 2.1.289 | `query()` `claude-opus-5-5` effort `xhigh` | ✅ `pong`（`claude_code_version: 2.1.289`；多了 `system/commands_changed` 事件，無害） |
| 6 | 0.2.113 / 2.1.289 | `query()` `claude-fable-5-1` | ✅ `pong` |
| 7 | 0.2.113 / 2.1.289 | **V2 API** `unstable_v2_createSession` + `send`/`stream` `claude-sonnet-5-5` | ✅ `pong` —— `claude-code-v2` preset 在此組合下仍可用 |
| 8 | 0.2.113 / 2.1.289 | `query()` `claude-opus-5-5[1m]` | ✅ `pong`（`modelUsage` key 為 `claude-opus-5-5[1m]`） |
| 9 | 0.3.289 / 2.1.289 | `query()` `claude-opus-5-5` effort `high` | ✅ `pong` |
| 10 | 0.3.289 / 2.1.289 | `query()` `claude-opus-4-7` | ✅ `pong`（舊模型仍可用） |

另外 `supportedModels()`：0.2.113 SDK 驅動 2.1.289 或系統 2.1.288 時，回傳的都是新清單（含 Claude 5）。

注意事項：
- `getSupportedModels()`（`claude-agent-manager.ts:1702-1718`）呼叫 `query({ prompt: '', cwd: '/' })` **沒帶 `pathToClaudeCodeExecutable`**（`cwd` 也放錯層），會用 SDK 自帶的 `claude-agent-sdk-win32-x64/claude.exe`。只升 CLI 時，這支仍是 2.1.113 → **下拉的 SDK 補充清單仍是舊的**。修法：帶上 runtime router 解出的路徑（一行）。
- 0.2.113 SDK 本身是 0.2 線較早版本，CLI 2.1.289 新增的 control 訊息它不認得，但上述 10 次與 V2 都沒有出錯；長期仍應升到 0.3（見建議方向）。

#### 4. 模型清單與計價（官方來源）

來源：
- ① CLI 2.1.289 `supportedModels()`（上方第 1 節，實測輸出）
- ② `https://platform.claude.com/docs/en/models/overview`（2026-10-04 擷取）
- ③ `https://platform.claude.com/docs/en/about-claude/pricing`（2026-10-04 擷取）

| Claude API ID | Context（②） | 預設 effort（②） | Input / Output（③） | 5m / 1h cache write（③） | Cache read（③） |
|---------------|-------------|-----------------|---------------------|-------------------------|-----------------|
| `claude-fable-5-1` | 1M | `high` | $10 / $50 | $12.50 / $20 | **$0.25（0.025x）** |
| `claude-opus-5-5` | 1M | `medium` | $4 / $20 | $5 / $8 | **$0.20（0.05x）** |
| `claude-sonnet-5-5` | 1M | `high` | $2 / $10 | $2.50 / $4 | $0.20（0.1x） |
| `claude-haiku-4-5-20251001` | 200K | 不支援 | $1 / $5 | $1.25 / $2 | $0.10 |
| Legacy：`claude-opus-5` / `claude-opus-4-8` | — | — | $5 / $25 | $6.25 / $10 | $0.50 |
| Legacy：`claude-sonnet-5` | — | — | $2 / $10 | $2.50 / $4 | $0.20 |
| Legacy：`claude-fable-5` | — | — | $10 / $50 | $12.50 / $20 | $1（0.1x） |

- ③ 另註明：Claude 4.6 及之後的模型 1M context 以標準價計（無長 context 加價）；Opus 5.5 fast mode $8 / $40。
- **`BAT_BUILTIN_MODELS`（`claude-agent-manager.ts:28-36`）建議**：新增 `claude-opus-5-5`、`claude-fable-5-1`、`claude-sonnet-5-5`（皆原生 1M context）。**不建議為 5 系列加 `[1m]` 變體**：CLI 2.1.289 的模型清單已不列 `[1m]` 行，官方 context window 即 1M；`[1m]` 後綴雖仍被接受（#8）但沒有必要。既有 `claude-opus-4-7[1m]` / `-4-6[1m]` / `sonnet-4-6[1m]` 仍可保留（legacy 但未退役）。殘留待確認：CLI 對無後綴 5 系列 ID 實際套用的 context 上限，實作工單以 `getContextUsage()` 驗一次。
- **`MODEL_PRICING`（`src/components/ClaudeAgentPanel.tsx:3586-3611`）需改**：
  - 新增 `opus-5-5` P(4,20)、`fable-5-1` P(10,50)、`sonnet-5-5` P(2,10)、`opus-5` / `opus-4-8` P(5,25)、`sonnet-5` P(2,10)、`fable-5` P(10,50)，並在 `getModelPricing()` 加對應 `includes()`（須注意 `opus-5-5` 要排在 `opus-5` 之前、`fable-5-1` 要排在 `fable-5` 之前）。
  - 🔴 `P()` 寫死 `cacheRead: input * 0.1`（:3586），**Opus 5.5（0.05x）與 Fable 5.1（0.025x）會高估 2x / 4x 的 cache read 成本**；`P()` 需加可選的 cache-read 倍率參數。
  - 目前 5 系列 ID 皆不命中任何規則 → 成本顯示 `—`（不會算錯，只是缺資料）。
  - `src/components/CodexAgentPanel.tsx:3990-4003` 有同一份複本（T0367/T0369 範圍，本工單未碰），建議一併抽成共用常數。
- 其他寫死舊模型的地方：`src/stores/settings-store.ts:34` `defaultModel: 'claude-opus-4-6'`。
- `thinking: { type: 'enabled' }`（`claude-agent-manager.ts:717`）：② 說明 extended thinking（`enabled` + budget）「not accepted on later models」，但實測 #5/#6/#9 經 CLI 都成功（CLI 會轉換）。建議改成 `{ type: 'adaptive' }`（0.2.113 型別已支援，`sdk.d.ts:1318`）以符合官方建議。

#### 5. auto-update（BUG-059）：**`DISABLE_AUTOUPDATER=1` 仍有效；2.1.289 多了更強的 `DISABLE_UPDATES`**

binary 字串檢查（`claude.exe` 2.1.289）：
- 決策函式：`if(a.DISABLE_UPDATES)return{type:"env",envVar:"DISABLE_UPDATES"};if(Ne(process.env.DISABLE_AUTOUPDATER))return{type:"env",envVar:"DISABLE_AUTOUPDATER"};...if(n.autoUpdates===!1&&(n.installMethod!=="native"||n.autoUpdatesProtectedForNative!==!0))` → `DISABLE_AUTOUPDATER` 仍會關掉**背景**自動更新（BUG-059 的根因路徑）。
- 新的 `DISABLE_UPDATES`：連手動 `claude update` / upgrade 都會拒絕（`Updates are disabled by your administrator...`）。
- 對 BAT 的意義：embedded 的 binary 在 `app.asar.unpacked` 內，使用者若在 BAT terminal 的 embedded claude-cli 裡手動 `claude update`，仍可能重演 BUG-059 的 rename。**建議 embedded runtime 額外注入 `DISABLE_UPDATES=1`**；system runtime **不要**注入（使用者需要能自己更新）。
- 實測：本研究 10 次 smoke 後，scratchpad 的 2.1.289 `bin/claude.exe` 與平台套件仍為 hardlink（link count 2）、大小不變，未被改名。
- 現有注入點仍在：`claude-agent-manager.ts:227`（`process.env.DISABLE_AUTOUPDATER = '1'`）、`pty-manager.ts:421/474/554`。SDK 0.2.113 起「`options.env` 取代 `process.env`」，BAT 沒傳 `options.env`，繼承 `process.env` ✅。
- 附註：npm 11.19 安裝 2.1.289 時會出 `install-scripts ... not yet covered by allowScripts` 警告（本次 postinstall 仍有執行）。若未來 npm 預設封鎖 install scripts，`bin/claude.exe` 會停在 placeholder stub → CI 應確認 `npm ci` 後 `bin/claude.exe --version` 可跑（可加進 `scripts/verify-native-modules.js`）。

### 建議方向

| 選項 | 內容 | 改動檔案 | 工作量 | 風險 |
|------|------|---------|-------|------|
| **A：只升 CLI + 模型清單** | `@anthropic-ai/claude-code` → `^2.1.289`；SDK 留 `^0.2.111`（lock 0.2.113）；補 `BAT_BUILTIN_MODELS` / `MODEL_PRICING`；`getSupportedModels()` 帶 `pathToClaudeCodeExecutable` | `package.json`、`package-lock.json`、`electron/claude-agent-manager.ts`、`src/components/ClaudeAgentPanel.tsx` | S | 低：#5-#8 實測可用（含 V2 preset）。但 SDK 自帶的 2.1.113 binary 仍隨包 ship；TodoWrite 清單在 Claude 5 模型上照樣消失 |
| **B：SDK 0.3 + CLI 一起升** | A 的全部 + SDK → `^0.3.289`；改寫或下架 `claude-code-v2`（V2 API 已移除）；Task tools UI；`@anthropic-ai/sdk` peer 補到 `>=0.93`；`thinking: adaptive` | 上述 + `electron/agent-runtime/agent-registry.ts`、`src/components/ClaudeAgentPanel.tsx`（Task tools 呈現）、可能 `src/types/index.ts` | M | 中：V2 preset 遷移是唯一的編譯斷點，其他皆增量 |
| C：只補模型清單 | 不升任何套件 | — | — | ❌ 無效：Opus 5.5 / Fable 5.1 會直接 400 |

**推薦：分階段 A → B。**
- **Phase 1（A，P1，先做）**：今天 embedded 使用者選 Claude 5 主力模型就會 400，且 CLI 2.1.289 + SDK 0.2.113 的相容性已實測（含 V2）。這一步改動小、可立即發佈，同時修好 dev 環境殘骸（重裝 `claude-code` 即覆蓋 `.old.<ts>`）。
- **Phase 2（B，P2）**：獨立工單處理 V2 preset 去留（建議下架或改成 `query()` + AsyncIterable 的 thin wrapper），再升 SDK 0.3。分開做可讓 Phase 1 不被 V2 遷移拖住。
- **並行小修（建議與 Phase 1 同批）**：版本過舊錯誤分類（比照 T0367：偵測 `claude_code_version_too_old` → 顯示「目前 runtime 為內嵌 CLI X，請升級 BAT 或於 Settings → Advanced → Claude Runtime 切換 system」）；`claude-resolver.ts:52` `HEALTHY_MIN` `2.1.111` → `2.1.280`（Opus 5.5 門檻），讓 system runtime 低於此版本時出 `version-warning`。
- **追版節奏**（同 T0366 建議）：每次預覽版發布前 `npm view @anthropic-ai/claude-code version`；Anthropic 已經以 `claude_code_version_too_old` 在服務端擋舊 CLI，落後會直接變成功能故障。

### 建議下一步

| 建議工單 | 內容 | 建議 `affects_files` | 估計 |
|---------|------|---------------------|------|
| T-A（P1） | **CLI bump 2.1.289 + Claude 5 模型清單**：bump `@anthropic-ai/claude-code`；`BAT_BUILTIN_MODELS` 加 `claude-opus-5-5` / `claude-fable-5-1` / `claude-sonnet-5-5`；`getSupportedModels()` 帶 `pathToClaudeCodeExecutable`、修 `cwd` 位置；`thinking: { type: 'adaptive' }`；重裝後驗 dev embedded path 恢復；`release.yml:134` Node 20 → 24 | `package.json`、`package-lock.json`、`electron/claude-agent-manager.ts`、`.github/workflows/release.yml` | S |
| T-B（P1，可與 T-A 同批） | **計價表**：`P()` 加 cache-read 倍率；補 5 系列與 legacy `opus-5`/`opus-4-8`/`sonnet-5`/`fable-5`；抽出 Claude/Codex 面板共用的 pricing 模組 | `src/components/ClaudeAgentPanel.tsx`、`src/components/CodexAgentPanel.tsx`（須等 T0369 收尾）、新檔 `src/lib/model-pricing.ts` + 單元測試 | S |
| T-C（P1） | **版本過舊錯誤分類 + embedded 防更新**：偵測 `claude_code_version_too_old` 給可操作訊息；`HEALTHY_MIN` → `2.1.280`；embedded spawn 加 `DISABLE_UPDATES=1`（system 不加） | `electron/claude-agent-manager.ts`、`electron/claude-resolver.ts`、`electron/pty-manager.ts`、`src/components/ClaudeAgentPanel.tsx`、`src/locales/*` | S |
| T-D（P2） | **SDK 0.3.289**：V2 preset 下架或遷移成 `query()`；Task tools（`TaskCreate/Update/Get/List`）清單 UI，或對 Claude 5 模型點名 `tools`；peer `@anthropic-ai/sdk >=0.93`；MCP 非阻塞連線評估 | `package.json`、`package-lock.json`、`electron/claude-agent-manager.ts`、`electron/agent-runtime/agent-registry.ts`、`src/components/ClaudeAgentPanel.tsx` | M |
| T-E（P3，選做） | **binary 去重**：每平台 ship 三份 ~246 MB 同一 binary（`claude-code/bin`、`claude-code-<plat>`、`claude-agent-sdk-<plat>`）；評估以 `files`/`asarUnpack` 排除其一（需同時改 `getSupportedModels` 與 terminal preset 路徑），並在 `verify-native-modules.js` 加 `bin/claude.exe --version` 檢查（防 npm allowScripts 封鎖 postinstall） | `package.json`（`build`）、`scripts/verify-native-modules.js`、`electron/claude-agent-manager.ts` | M |

**CLAUDE.md「Claude Agent SDK / CLI」節需更新（本工單不改，僅列出）**：
1. 版本行 `^0.2.111` / `^2.1.111`（實裝 0.2.113 / 2.1.113）→ 實作後的新版本；「Opus 4.7 model 支援」改為 Claude 5 系列（`claude-opus-5-5` / `claude-fable-5-1` / `claude-sonnet-5-5`）。
2. 新增說明：**服務端以 CLI 版本擋新模型**（`error_code: claude_code_version_too_old`；Opus 5.5 需 ≥2.1.280、Fable 5.1 需 ≥2.1.251），內嵌 CLI 落後即功能故障。
3. `BAT_BUILTIN_MODELS` 段：已前插 Claude 5 模型；5 系列原生 1M，不再加 `[1m]` 變體。
4. `MODEL_PRICING` 段：`opus-4-7: P(5, 25)` 說法過時；註明 Opus 5.5 / Fable 5.1 cache read 倍率非 0.1x。
5. Effort 段：`max`「(Opus only)」標示需重檢 —— 2.1.289 對 Sonnet 5.5 / Fable 5.1 / Opus 5.5 的 `supportedEffortLevels` 皆含 `max` 與 `xhigh`。
6. 「Claude Runtime Selection」常見故障表：`version-warning` 門檻 `2.1.111` → 新門檻；新增「選 Claude 5 模型回 400 `claude_code_version_too_old`」一列（解法：升級 BAT 或切 system runtime）。
7. 「Embedded claude auto-update 停用（BUG-059）」：補充 `DISABLE_UPDATES`（2.1.289 新增，可擋手動 `claude update`）及其注入範圍（若 T-C 落地）。
8. 若 T-D 落地：移除 V2 API 相關描述，並註記 SDK 0.3 的 TodoWrite → Task tools 變更。

### 遭遇問題

- 無阻塞。tsc 基準本來就有 138 個與 SDK 無關的型別錯誤（electron 沒有專用 tsconfig），因此以「新舊 SDK 錯誤 diff」判定影響，而非錯誤總數。
- 未測：macOS / Linux 實機、打包後安裝檔實際大小、API key 登入模式、server bundle（linux）實際建置。
- CLI 對無 `[1m]` 後綴的 5 系列 ID 的實際 context 上限未直接量測（binary 中有 `native1m` 判斷，官方文件為 1M），留給 T-A 以 `getContextUsage()` 驗證。
- smoke 共 10 次（模型呼叫 8 次 + V2 1 次 + `[1m]` 1 次），另有 4 次 `supportedModels()` 探測（空設定目錄、不呼叫模型）；SDK 回報的 `total_cost_usd` 合計約 $1.66（不含 V2 那次；訂閱帳號的估算值，非實際扣款）。
- 研究期間 T0367 / T0369 已由其他 session 提交（`c786c7b`、`ca0d292`），本工單未碰其檔案。

### 回報時間

2026-10-04T16:06:38+08:00
