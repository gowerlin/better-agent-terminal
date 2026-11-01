---
schema_version: 1
schema_kind: workorder
id: T0727
title: "pre.6 自動化驗收（一）：Claude 面板以本機假 Anthropic API 跑 e2e —— 工作清單（Claude 5 / 4.x、resume 重建）、SDK 0.3 對話 / 權限詢問 / sub-agent、V2 遷移分頁接續"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T10:57:56+0800"
started_at: "2026-11-01T10:59:25+0800"
updated_at: "2026-11-01T11:17:03+0800"
completed_at: "2026-11-01T11:17:03+0800"
depends_on: []
related:
  - "T0725 回報區〈實機驗收步驟〉1–3、5（工作清單）；T0718 回報區〈需實機驗證〉（SDK 0.3 對話、權限詢問、resume、sub-agent、V2 遷移後接續）"
  - "做法參考：`e2e/t0621-codex-osc-state.spec.ts` 的本機假模型（codex `/v1/responses`），本單改成假 Anthropic Messages API"
  - "CLAUDE.md「Claude Agent SDK / CLI」、「Sub-agent / Active Tasks Tracking」；`docs/agent-guide/claude-agent-sdk-cli.md`「Claude 面板工作清單」"
affects_files:
  - "e2e/v072-pre6-claude-panel.spec.ts（新增，檔名可調）"
  - "e2e/fixtures/（假 Anthropic API server，若抽成共用 fixture）"
  - docs/agent-guide/claude-agent-sdk-cli.md
  - _ct-workorders/T0727-e2e-claude-panel-fake-api-acceptance.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 不耗 token：Claude 面板（SDK 0.3 → 內嵌 CLI 2.1.316）的模型請求一律打到 spec 自己起的本機假 Anthropic API（`ANTHROPIC_BASE_URL` + 假 `ANTHROPIC_API_KEY`，或 CLI 認得的等價方式；以 CLI 實際行為為準）。不得使用使用者的 OAuth / 真實 API key，不得有任何請求送到 api.anthropic.com（spec 內斷言或記錄所有對外請求）。若 CLI 在假 base URL 下無法完成一個 turn（例如啟動前強制線上檢查），停下來回報 PARTIAL，附遇到的請求與錯誤，不要繞過認證。"
  - "🔴 驗收情境（每項在回報區給 PASS / FAIL / 未涵蓋與證據）：① Claude 5 模型 id（例 `claude-opus-5-5`）送出的第一個請求 `tools` 含 `TaskCreate` / `TaskUpdate` / `TaskList`；② 4.x 模型 id（例 `claude-sonnet-4-6`）同樣含；③ 假 API 依序回 3 次 `TaskCreate` 與數次 `TaskUpdate` tool_use，面板畫出工作清單、勾選與「已完成 n/3」跟著變，active task bar 不出現這些項目；④ resume 該 session（或重開隔離實例讓分頁還原）後清單重建相同；⑤ 串流文字正常顯示；⑥ 權限詢問：假 API 回一個需要權限的 tool_use（例 Bash），面板出現權限詢問，allow 與 deny 各一次結果正確；⑦ sub-agent：假 API 回 `Agent` tool_use，面板出現 Agent 卡片與 active tasks bar，結束後清掉；⑧ V2 遷移：以含 `claude-code-v2` 分頁（帶 `sdkSessionId`，並在隔離的 claude 設定目錄放對應 session 檔）的假 userData 啟動，分頁讀成 Claude Agent，送訊息時記錄實際走 resume 接上，還是顯示 `Previous session could not be resumed. Starting fresh...`（兩者都可接受，回報實際走哪一條）；⑨ Claude CLI 終端分頁的 env 沒有 `CLAUDE_CODE_ENABLE_TODO_TOOLS`（T0725 步驟 5）。做不到的項目寫原因，不硬湊。"
  - "🔴 不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）。發現產品缺陷 → 記在回報區〈發現的問題〉附重現步驟，由塔台開 BUG，不在本單修。"
  - "🔴 隔離：一律用 `e2e/fixtures/electron-isolation.ts` 的隔離實例（`--runtime=e2e-…`、獨立 userData 與 remote port）；claude 的設定目錄（`CLAUDE_CONFIG_DIR` 或 HOME）也指到 temp，不讀寫使用者的 `~/.claude`。不得以預設實例啟動 source build；不碰使用者正在用的 BAT 與其 userData；不執行任何安裝檔。先 `npx vite build`。`TMP` 指到長路徑 scratchpad 時 git worktree 測試會失敗（T0716），用系統預設 TMP。"
  - "🔴 測試失敗輸出不得傾印整個 `process.env`（T0725 遭遇問題 2）：斷言只比對特定 key；log / 回報不含任何權杖值。"
  - "🔴 驗證：新 spec 綠（或依上條部分綠並說明）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0（spec 若在 tsconfig 範圍外則註明）。docs 的「Claude 面板工作清單」或驗證清單補一行指向本 spec。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0727 — pre.6 自動化驗收（一）：Claude 面板假 API e2e

## 元資料

- **工單編號**：T0727
- **類型**：implementation（驗收用 e2e）
- **優先級**：P2
- **建立時間**：2026-11-01T10:57:56+0800
- **預估規模**：M

## 背景

`v0.7.2-pre.6` 已安裝（helper `v0.7.2-pre.6`）。T0725（Claude 面板工作清單）與 T0718（SDK 0.3、V2 下架）都把「真實對話」留給實機驗收，原因是會耗 token。使用者要求可自動化的驗收先安排：本單以本機假 Anthropic API 驅動真的內嵌 CLI，涵蓋 BAT 這端的接線與畫面。「真實模型會不會主動選 Task*」不在本單範圍，仍是實機項目。

## 範圍

1. 假 Anthropic Messages API（串流 SSE、依腳本回 text / tool_use，並記錄每個請求的 model 與 tools）。
2. e2e spec 涵蓋 memory_overrides 列的 ①–⑨。
3. docs 補一行。

## 不做

- 不改產品程式碼、不修發現的缺陷。
- 不用真實模型、不耗 token。
- NSIS 安裝驗收（另行手動）。

## 驗收

- [ ] ①–⑨ 逐項 PASS / FAIL / 未涵蓋與證據
- [ ] 沒有任何請求送到真實 API（附證據）
- [ ] spec commit 進 `e2e/`；兩個 typecheck = 0
- [ ] 〈發現的問題〉（若有）附重現步驟

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** —— ①–⑨ 全部 PASS（新 spec 連跑 2 次皆綠，各約 14 s）；沒有任何請求離開本機；兩個 typecheck = 0。另發現 1 個產品缺陷、1 個相容問題（見〈發現的問題〉），未修。

### 落點檢查

- 結果：**PASS**
- C-0：工單 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於 REPO_ROOT 之下 → PASS
- C-3：`e2e/` 與 `docs/agent-guide/` 存在 → PASS（C-0 已 PASS，僅記錄）
- C-2：工單沒有 `branch` 欄位，不適用（目前在 `main`）
- `CT_HOME` 未設（非 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 交付

| 檔案 | 內容 |
|---|---|
| `e2e/fixtures/fake-anthropic-api.ts`（新增） | 假 Anthropic Messages API：SSE 串流 text / tool_use，以 user 訊息裡的 `[[T0727:<名稱>]]` 選腳本、以 tool 回合數當步驟（無狀態，resume 也適用）；`gate` / `release` 讓 spec 一次放行一個模型回合；記錄每個請求的 model、`tools`、ToolSearch deferred 清單。另附 `startBlockingProxy`（拒絕並記錄所有經 proxy 的連線） |
| `e2e/v072-pre6-claude-panel.spec.ts`（新增） | ①–⑨；兩次啟動同一個隔離 runtime（④ 用重開） |
| `docs/agent-guide/claude-agent-sdk-cli.md` | 「Claude 面板工作清單」的驗證段加一行指向本 spec 與隔離方式 |

Commit：`b534941c test(e2e): Claude panel against a fake Anthropic API (T0727)`（只含上列 3 檔；未 push）。

### 隔離與「不耗 token」的做法（實測後的設計）

- 隔離實例：`launchIsolated('t0727')`（`--runtime=e2e-t0727-<ts>`、獨立 remote port），先跑過 `npx vite build`。
- 假 API：`ANTHROPIC_BASE_URL=http://127.0.0.1:<port>`、`ANTHROPIC_API_KEY=t0727-fake-key`（不檢查）。內嵌 CLI 2.1.316 在這設定下可完整跑完 turn，不需要任何線上檢查。
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`：實測**不加**時，CLI 每個 session 會嘗試 3 次 `CONNECT api.anthropic.com:443`（非模型請求，被 proxy 擋下）；加了之後是 0 次。
- `HTTPS_PROXY` / `HTTP_PROXY` 指向拒絕並記錄的 proxy（`NO_PROXY=127.0.0.1,localhost`）；主行程另外記錄 `fetch` 與 `session.webRequest`。
- **暫存 HOME（USERPROFILE / HOME），不用 `CLAUDE_CONFIG_DIR`**：BAT 讀 session 歷史與 plugins 清單時用的是 `os.homedir()/.claude`，不是 `CLAUDE_CONFIG_DIR`（見〈發現的問題〉2）。只設 `CLAUDE_CONFIG_DIR` 的話，④ 的歷史會讀不到，主行程也還是會讀使用者的 `~/.claude/plugins`。Windows 會用 process env 展開 known folder，所以暫存 home 裡要先建好 `AppData\Roaming` / `AppData\Local`；隔離實例的 userData 因此也落在暫存 home 裡（仍帶 runtime 後綴，結束時刪除）。
- **工作區放在 `%ProgramData%\bat-e2e-t0727-*`**：CLI 會把 cwd 每一層上層目錄的 `.claude/CLAUDE.md` 都當成專案記憶載入。工作區若放在使用者 TMP（`<使用者資料夾>\AppData\Local\Temp\…`）底下，會讀到使用者自己的 `~/.claude/CLAUDE.md`，原型實測過。
- 測試行程繼承的 `ANTHROPIC_*` / `CLAUDE*` 變數（例如本 session 自己的 `CLAUDE_CODE_*`）在啟動前暫時移除，不交給隔離實例。
- log 只記請求摘要（model / scenario / step / tools 數 / deferred 的 Task\*）、env 探針只記 4 個指定 key，不傾印 `process.env`，不含任何權杖值。

### 驗收情境結果（第 2 次執行的 log 摘錄）

| # | 結果 | 證據 |
|---|---|---|
| ① Claude 5 首個請求 | **PASS** | `claude-opus-5-5` 第一個 `/v1/messages`：`tools` 15 個 + deferred `[…, TaskCreate, TaskGet, TaskList, TaskStop, TaskUpdate, …]`。CLI 2.1.316 把 Task\* 放在 ToolSearch 的 deferred 清單（system-reminder；Claude 5 請求是放在最後一則 `system` role 訊息），不在 `tools` 陣列裡。spec 斷言「`tools` ∪ deferred」包含 TaskCreate / TaskUpdate / TaskList。對照組（原型，SDK 直接呼叫同一個 CLI）：不設 `CLAUDE_CODE_ENABLE_TODO_TOOLS` 時，`claude-opus-5-5` 的請求完全沒有 TaskCreate，`claude-sonnet-4-6` 有，與 T0721 R2 的分析一致 |
| ② 4.x 首個請求 | **PASS** | `claude-sonnet-4-6` 第一個請求：同樣有 TaskCreate / TaskGet / TaskList / TaskStop / TaskUpdate（deferred） |
| ③ 工作清單逐回合 | **PASS** | 假 API 依序回 3×`TaskCreate`、`TaskUpdate #1 in_progress`、`#1 completed`、`#2 completed`，每個回合 gate 住、檢查畫面後再放行：`已完成 0/1` → `0/2` → `0/3` → `0/3`（#1 in_progress）→ `已完成 1/3` → `已完成 2/3`；勾選狀態逐步一致；整段 Task\* 只畫一份清單（最後一張卡）；每一步 `.claude-active-task-item` = 0。截圖 `t0727-task-list.png` |
| ④ resume 重建 | **PASS** | 關閉後以同一個 runtime 重開（`keepUserData`），分頁還原，存檔中的 `sdkSessionId` 相同，自動 resume 載入歷史後清單仍是 `[completed:Draft spec, completed:Run checks, pending:Write report]`、`已完成 2/3`，與重開前完全相同，串流全文也在。截圖 `t0727-task-list-resumed.png` |
| ⑤ 串流 | **PASS** | 最後一回合分 6 段、每段間隔 500 ms：串流中畫面為 `"T0727 |"`（游標 `.claude-cursor`），還沒有 `END-OF-STREAM`；結束後全文 `T0727 stream chunk-2 chunk-3 chunk-4 END-OF-STREAM`，游標消失 |
| ⑥ 權限詢問 | **PASS** | `default` 模式下回 `Bash` `mkdir t0727-perm-allow`：出現 `.claude-permission-card`「允許此 Bash 呼叫？」並顯示指令；選「是」→ 資料夾建立、模型收到結果並回覆。`mkdir t0727-perm-deny`：選「否」→ 資料夾不存在、模型收到拒絕並回覆。截圖 `t0727-permission.png` |
| ⑦ sub-agent | **PASS** | 回 `Agent` tool_use（`run_in_background: false`）；sub-agent 的請求被 gate 住期間：Agent 卡片 `dot-running`，active tasks bar 1 項 `"T0727 sub-agent probe"`；放行後 bar = 0，卡片 `dot-success`。截圖 `t0727-agent-running.png` |
| ⑧ V2 遷移 | **PASS（走 resume）** | 存檔分頁 `agentPreset: claude-code-v2`、標題 `Claude Agent V2`，帶 Sonnet 分頁的 `sdkSessionId`，經 `workspace.save` 後讓 renderer reload 讀入：標題讀成「Claude Agent」、開 Claude Agent 面板並顯示舊歷史；送出訊息後的請求帶著先前的 13 則對話，**實際走 resume 接上**，沒有出現 `Previous session could not be resumed…`；`sdkSessionId` 不變；之後存檔變成 `claude-code` / `Claude Agent`。注意：這是「寫存檔＋renderer reload」，不是「放好假 userData 再冷啟動」，載入路徑相同（store 載入時遷移） |
| ⑨ claude-cli 分頁 env | **PASS** | `pty.create({ agentPreset: 'claude-cli' })` 建立 PTY 後，在分頁內以 node 探針讀取：`CLAUDE_CODE_ENABLE_TODO_TOOLS=null`、`CLAUDE_CODE_ENABLE_TASKS=null`；`DISABLE_UPDATES=1` 是正向對照，證明確實套到 claude-cli 的 embedded env；主行程 `process.env.CLAUDE_CODE_ENABLE_TODO_TOOLS=null`。說明：這裡直接建 PTY，沒有讓 TerminalPanel 打 `claude` 指令，因為那會在假 API 下啟動 claude TUI。檢查的是同一個 `buildPtyEnv` 組出的分頁 env |

### 沒有請求送到真實 API（證據）

- 假 API 收到 24 個請求，全部是 `POST /v1/messages?beta=true`（spec 斷言所有路徑都以 `/v1/messages` 開頭）。
- 擋下並記錄的 proxy：`attempts = []`（spec 斷言）；主行程 `fetch` / `webRequest` 對外 URL：`[]`（spec 斷言）。
- 使用者 `~/.claude/projects` 下沒有本次 run 的項目（spec 斷言；只比對名稱含 `t0727` 的目錄）；session 檔都寫在暫存 home（`C--ProgramData-bat-e2e-t0727-…-ws`、`D--`）。
- 原型（SDK 直接呼叫）同樣 `proxy attempts = []`，請求內容不含使用者名稱與使用者的 CLAUDE.md。

### 驗證

- `npx vite build`：成功（exit 0）。
- `npx playwright test e2e/v072-pre6-claude-panel.spec.ts`：**1 passed**（13.8 s），連跑兩次都綠。前幾次失敗都出在 spec 本身，已修正：暫存 home 缺 AppData、`setPermissionMode` 在兩個回合之間回傳 `false`、重開後 meta 還沒有 `sdkSessionId`、renderer 不照存檔的 active 分頁。
- `npm run typecheck` = 0；`npm run typecheck:electron` = 0。spec 與 fixture 不在這兩個 tsconfig 的 include 內，另以 `tsc --noEmit --strict … e2e/v072-pre6-claude-panel.spec.ts e2e/fixtures/fake-anthropic-api.ts` 檢查 = 0。
- `validated_sha`（跑 gate 時）：`e891d5e7` + 工作區未提交的 3 檔，與 commit `b534941c` 內容相同（gate 跑完後沒有再改這 3 檔）。

### 發現的問題

1. **Claude 面板查模型清單時，會送一次真的模型請求（耗 token）**（建議開 BUG）
   - 位置：`ClaudeAgentManager.getSupportedModels`（`electron/claude-agent-manager.ts`）以 `query({ prompt: '', options: { cwd: '/' } })` 啟動 CLI，只為了 `supportedModels()`，之後 `close()`。CLI 拿到空 prompt 仍會跑一個 turn。
   - 證據：原型（SDK 直接呼叫同一個 CLI 與假 API）——`supportedModels()` 回 5 個模型時還沒有請求，3 秒內假 API 收到 1 個 `claude-opus-5-5`（預設模型）的完整請求（14 個 tools、system prompt、空白使用者訊息），並在 `~/.claude/projects/D--`（`cwd: '/'` = 磁碟根目錄）留下一個 session 檔。e2e 中面板在 session 取得 `sdkSessionId` 後呼叫一次（`ClaudeAgentPanel.tsx` 載入模型清單的 effect），對應 log 裡 scenario 為 `-`、14 tools 的 `claude-opus-5-5` 請求（第 1 次全綠執行的 #4 / #11 / #20 / #21）。請求有沒有送出看 `close()` 跟 CLI 誰快，第 2 次執行重開期間就是 0 次。
   - 影響：真實帳號下，每次查模型清單可能多一個完整 system prompt＋工具定義的 input token 請求（不論使用者選哪個模型，都用預設模型）；另外在 `~/.claude/projects/<磁碟根>` 累積 session 檔，`/resume` 清單可能看得到。
   - 重現：用 `e2e/fixtures/fake-anthropic-api.ts` 起假 API，env 同 spec，對內嵌 CLI 執行 `query({ prompt: '', options: { cwd: '/', env, pathToClaudeCodeExecutable } }).supportedModels()`，等 3 秒再看 `fake.requests`。或跑本 spec，看 `model requests` log 中 `scenario=- … tools=14` 的請求。
2. **BAT 讀 Claude session 歷史 / session 清單 / plugins 時不理 `CLAUDE_CONFIG_DIR`**（相容問題，建議開 BUG 或列已知限制）
   - 位置：`loadSessionHistory`、`listSessionsFallback` 讀 `os.homedir()/.claude/projects/<encoded cwd>`；`runQuery` 的 installed plugins 讀 `os.homedir()/.claude/plugins/installed_plugins.json`（`electron/claude-agent-manager.ts`）。同一個 repo 的 `bat-mcp-launch.ts`、`ct-install-detect.ts`、`handlers/claude.ts` 都會優先用 `CLAUDE_CONFIG_DIR`。
   - 證據：原型實測 CLI 在設定 `CLAUDE_CONFIG_DIR` 時，session 檔寫到 `<CLAUDE_CONFIG_DIR>/projects/…`（不在 `~/.claude`）；BAT 讀的是另一個位置，所以設了 `CLAUDE_CONFIG_DIR` 的使用者，分頁還原 / resume 時面板的歷史會是空的，plugins 也從錯的位置載入。本 spec 為此改用暫存 HOME 隔離。這是讀程式碼加 CLI 實測得出的結論，沒有在 BAT 裡實際用 `CLAUDE_CONFIG_DIR` 重現面板的空歷史。
   - 重現：設定 `CLAUDE_CONFIG_DIR=<某目錄>` 啟動 BAT → Claude Agent 分頁對話一輪 → 重開 BAT → 分頁 resume 後看歷史。
3. 觀察（不判定為缺陷）：`claude:set-permission-mode` 在兩個回合之間（上一個 query 已結束）回傳 `false`，因為對已結束的 `queryInstance` 呼叫 `setPermissionMode` 會丟例外。不過 `session.permissionMode` 已先更新，下一回合照新模式執行（⑥ 就是這樣跑的），面板的模式切換也不看回傳值。
4. 觀察：CLI 2.1.316 的 `Agent` 預設在背景執行（原型裡 tool_result 立刻回 `Async agent launched successfully`，sub-agent 結束後主 agent 再收到通知、多跑一回合）。⑦ 驗的是前景 `run_in_background: false`；背景 Agent 在面板上的卡片與 active tasks bar 行為本單未涵蓋，真實模型多半走背景路徑，建議列入實機觀察。

### 子代理與 Workflow 使用

未使用。

### 遭遇問題

- 初版原型把一份請求內容（含當時讀到的使用者 CLAUDE.md）存到 repo 根目錄 `req-claude-opus-5-5-0.json`，已刪除，從未 commit。原型與 dump 都只在 scratchpad。

### 互動紀錄

無（yolo，沒有向塔台提問）。

### 回報時間

2026-11-01T11:15:52+0800
