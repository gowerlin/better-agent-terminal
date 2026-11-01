---
schema_version: 1
schema_kind: workorder
id: T0721
title: "研究：pre.5 後續候選三項（claude 單行 `Press enter to continue` 是否觸發 `claude-stale`、Task tools 清單 UI、`queryOptions` 改用 SDK `Options` 型別）的價值、做法與規模（只查不修）"
type: research
status: DONE
repo: better-agent-terminal
project: ""
priority: P2
sizing: M
created_at: "2026-11-01T09:49:34+0800"
started_at: "2026-11-01T09:52:31+0800"
updated_at: "2026-11-01T10:03:25+0800"
completed_at: "2026-11-01T10:03:25+0800"
depends_on: []
related:
  - "T0717 回報區「後續候選」第 1 點：claude 2.1.316 新增單行 `Usage limit has reset · Press enter to continue`，不在 `src/lib/usage-limit.ts` 句型內（`claude-stale` 認的是兩行 `Your usage limit has reset` + `Press enter to continue`）；D148 / D192"
  - "T0718 回報區「後續候選」：Task tools 清單 UI（`TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList`，取代 `TodoWrite` 快照；`tools` 點名或 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` 需決策）、`queryOptions` 改用 SDK `Options`（目前 `Record<string, unknown>` 再轉型）"
  - "CLAUDE.md「用量限制自動繼續（PLAN-044 / T0566，D148）」、「Sub-agent / Active Tasks Tracking」、「React Rendering」、「Claude Agent SDK / CLI」；`docs/agent-guide/usage-limit-continue.md`、`docs/agent-guide/claude-agent-sdk-cli.md`"
  - "T0722（同時進行：「Claude Agent V1」改名「Claude Agent」，D194）—— 本單不涵蓋改名"
affects_files:
  - _ct-workorders/T0721-research-pre5-followup-candidates.md
  - "_ct-workorders/_report-T0721-followup-candidates.md（回報太長時另寫，選用）"
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只查不修：不改任何產品程式、測試檔、`package.json` / lock、CI、CLAUDE.md、docs。型別試驗、暫存腳本放 Worker 的 scratchpad（例：scratchpad 內的 `tsc` 試驗檔，比照 T0718 的 `optcheck/check.ts`）。"
  - "🔴 不在本 repo 跑 `npx vite build` / `npm run build*` / e2e：T0722 Worker 同時在本 repo 改程式並跑 build。單元測試若要跑，只跑與本單相關的單一檔案（`npx vitest run <file>`），並註明當下工作樹可能含 T0722 未 commit 的變更。"
  - "🔴 不送真實模型請求、不耗 token：claude CLI 行為以官方 changelog、binary 字串、SDK 型別宣告與既有測試判斷；需要實機互動才看得到的，寫進「待實機確認」。"
  - "🔴 結論要有證據：每個「現況是 X」附檔案:行號、binary 字串或官方出處；推論與事實分開標示（【推論】）。"
  - "🔴 可以自己開唯讀子代理平行讀程式碼；回報區要有「子代理使用」紀錄：幾個、做什麼、約多少 tokens（讀不到就寫怎麼估的）。不使用 Workflow 工具（本單沒有授權）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報不寫真名、家目錄路徑或權杖。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit `affects_files`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0721 — 研究：pre.5 後續候選三項

## 元資料

- **工單編號**：T0721
- **類型**：research（只查不修）
- **優先級**：P2
- **建立時間**：2026-11-01T09:49:34+0800
- **預估規模**：M

## 研究目標

T0717 / T0718 留下的後續候選，逐項判斷「要不要做、怎麼做、多大」，讓塔台能直接開實作單或結案。每項的結論第一句寫成「建議 做 / 不做 / 等條件 ___；理由 ___」。

1. **R1：claude 2.1.316 單行 `Usage limit has reset · Press enter to continue`**
   - 這句在 CLI 中何時出現、出現時 CLI 是否真的在等 Enter；和 CLI 內建 `autoContinueAtUsageLimit`（D148：BAT 對 claude 絕不送文字）的關係。
   - 若讓它觸發 `claude-stale`（BAT 送 Enter），會不會和 CLI 自己的自動繼續重複、多產生一個 turn，或在使用者正在打字時送出 Enter。
   - 若要做：`src/lib/usage-limit.ts` 句型與決策表要怎麼改、測試要補什麼；若不做：是否需要只顯示提示。
2. **R2：Task tools 清單 UI**
   - SDK 0.3 / CLI 2.1.316 下，Claude 面板實際會收到 `TodoWrite` 還是 `TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList`（依模型、`tools` 設定、`CLAUDE_CODE_ENABLE_TODO_TOOLS`）；目前面板怎麼顯示這些工具（T0718 ④ 的紀錄）。
   - 清單 UI 的設計選項（依 task id 累積狀態、顯示位置、與既有 TodoWrite 清單 / active tasks bar 的關係），🔴 不得把 Task* 當成 sub-agent（CLAUDE.md「Sub-agent / Active Tasks Tracking」）；`flushSync` 規則是否適用。
   - 需要使用者決策的點（例如是否點名 `tools` 或設 env）列出選項與建議。
3. **R3：`queryOptions` 改用 SDK `Options` 型別**
   - `electron/claude-agent-manager.ts` `runQuery` 的選項物件改成 `Options`（或 `Partial<Options>`）型別宣告的可行性：在 scratchpad 試驗會出現哪些 `typecheck:electron` 錯誤、有沒有 BAT 傳了但 SDK 型別沒有的選項。
   - 預估改動行數與風險（純型別、不改執行期行為）。

## 已知資訊

- T0717：`claude-stale` 用的兩行句型在 2.1.316 沒變；新單行通知 2.1.306 為小寫 `press`，兩版都不是 BAT 句型。
- T0718：scratchpad `optcheck/check.ts` 以 0.3.316 的 `Options` 驗過 24 個選項名稱都存在；`runQuery` 目前 `Record<string, unknown>` 再轉型。
- 「Claude Agent V1」改名已由使用者決定（D194），另開 T0722 實作，**不在本單範圍**。

## 調查範圍

- `src/lib/usage-limit.ts`、`electron/usage-limit-continue.ts`、對應測試；內嵌 CLI binary 字串（`node_modules/@anthropic-ai/claude-code`）。
- `electron/claude-agent-manager.ts`（`runQuery`、tool_use 處理、`activeTasks`）、Claude 面板的工具卡片 / Todo 清單元件、SDK 0.3 型別宣告（`node_modules/@anthropic-ai/claude-agent-sdk`）。

## 研究指引

- 每項給：結論一句 → 證據 → 若做的實作單草案（範圍、`affects_files`、驗收、規模 S/M/L）→ 需要使用者決策的點。
- 三項之間若可併成同一張實作單，請說明。

## 互動規則

- yolo：不問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台，每輪最多 3 題。
- 互動紀錄寫入回報區。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（研究單，三項都有結論與證據；沒有改任何產品檔）

- 落點檢查：**PASS**。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 只有 `_ct-workorders/`，不適用；C-2 工單沒有 `branch` 欄位（目前在 `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只當證據）。`CT_HOME` 沒設，不是 worktree。
- 模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- 證據來源：內嵌 CLI `node_modules/@anthropic-ai/claude-code/bin/claude.exe`（2.1.316）的字串，以 scratchpad 的 `bgrep.mjs`（`Buffer.indexOf`）讀取，下面的 `@數字` 是 binary 內的位元組位移；SDK `node_modules/@anthropic-ai/claude-agent-sdk`（0.3.316）的 `sdk.d.ts` / `sdk-tools.d.ts` / `sdk.mjs`。沒有送任何模型請求。
- R3 型別試驗在 scratchpad 進行：`git archive HEAD`（當時 HEAD `1ba04195`，T0722 已 commit）解出 `electron/` / `src/` / tsconfig，`node_modules` 用 junction 指回 repo；repo 工作樹沒動，也沒在 repo 跑 build / test。

### 互動紀錄

無。沒有需要問塔台的判讀問題（需要使用者決策的點列在各項「需要決策」）。

### 調查結論

#### R1：claude 2.1.316 單行 `Usage limit has reset · Press enter to continue`

**建議：不做（不加句型）。理由：** 這行單行通知和 BAT 已經在辨識的兩行 footer 是**同一個 `stale` 事件**同時畫出來的；footer 只在 stale 期間顯示，單行通知會留在對話紀錄裡。拿單行通知當觸發條件，stale 結束後還會誤判，等於失去「再確認」的保護。可以順手補一個負向測試，把現在的行為鎖住（S，見建議下一步）。

證據（事實）：
1. **何時出現**：armed 狀態下，CLI 發現電腦休眠跨過重置時間（`s>u&&e>=o.state.fireAtMs` → `o.sleptThroughReset=!0`），**不自動續行**，改設 `phase:"stale"` 並 `emit("stale")`（字串 `tengu_quota_auto_resume_stale`，與 `return F(o)…"fired"` 的自動續行分支互斥）。
2. **同一事件畫兩樣東西**（`@315916722`，同一個元件）：
   - `case"stale":{R("Usage limit has reset \xB7 Press enter to continue","notice"),N("Usage limit reset — press enter to continue","quota_auto_resume_stale")}`：`R` 是 `d.apply({type:"append",messages:[…]})`，**append 進對話紀錄**；`N` 是系統通知。
   - 同一元件的 render：`Pn=wt(E,C)`。`wt()`（`@315915953`）在 `phase==="stale"` 時回 `{status:"Your usage limit has reset",next:"Press enter to continue"}`，也就是 BAT 認得的兩行 footer（`src/lib/usage-limit.ts:136-137`、`:181-192`、`:269-270`）。這個 footer 跟著 `phase` 走，離開 stale 就消失。
3. **stale 時 CLI 確實在等 Enter，而且不會自己續行**：送出路徑 `@318135086`：輸入框為空、按 Enter → `q0=aIo()`，`aIo()`（`@298463077`）只在 `phase==="stale"` 時回續行提示 → 送出一個續行 turn。不是 stale 時，空白 Enter 會走 `g("prompt_submit_empty");return`，什麼都不做。使用者自己打字再送出 → `j(e)` 記 `tengu_quota_auto_resume_stale_resumed`，回到 idle。⇒ BAT 在 stale 送 Enter **不會和 CLI 自己的自動繼續重複**（D148 的「claude 絕不送文字」不受影響；stale 本來就是 D148 唯一的補位）。
4. **現況**：單行通知目前被分類成 `none`。`CLAUDE_STALE_HEAD_RE` 要求開頭是 `Your usage limit has reset`、`CLAUDE_STALE_PRESS_RE` 要求開頭是 `Press enter`、`CLAUDE_RESUMED_RE` 認的是 `Usage limit reset ·`（沒有 `has`），三個都不會命中（`usage-limit.ts:134-137`）。

若讓它觸發 `claude-stale`，會有的風險（【推論】，依上面的程式路徑）：
- 單行通知在 stale 結束後還留在畫面上（使用者按了 Enter、續行 turn 跑完）。classifier 取的是**最下面那一行被辨識的句子**，一般回覆文字不會被辨識，所以只要它還在最後 40 行內，就會被判成 `claude-stale` → 排程 Enter；renderer 送出前的再確認（`usageLimitRecheckFailure`）用的是同一個 classifier，一樣會通過。現在以 footer 判斷時，footer 一消失再確認就失敗、取消送出（`usage-limit.test.ts:315`）。
- 空白輸入框收到多餘的 Enter 通常沒事（`prompt_submit_empty`）；但那時如果畫面上有選單或權限對話框（例如 AskUserQuestion、權限詢問），Enter 會直接選中目前反白的選項。
- 「使用者正在打字時送出 Enter」：等待期間的使用者輸入本來就會取消排程（`electron/usage-limit-continue.ts:163-171`），這一點不受影響。

不需要另外顯示提示：footer 兩行已經觸發 `send-enter`（yolo）或 `not-yolo` 提示（`usage-limit-continue.ts:297-299`）；CLI 自己也會發系統通知。

待實機確認：footer 實際是一行（`status · next`）還是兩行，以及 fullscreen / 非 fullscreen 是否都畫得出來（兩種寫法 `usage-limit.test.ts:158-159` 都已涵蓋；沒有休眠跨過重置的實機樣本）。

#### R2：Task tools 清單 UI

**建議：等條件。條件是使用者決定要在 Claude 面板看到工作清單。** 決定要的話，開一張 M 單：新增 Task 清單 UI，並為 Claude 5 模型開啟 todo 工具（建議用 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`）。**理由**：BAT 內建的 4 個 Claude 5 模型預設根本不會拿到 Task 工具，清單 UI 只對 4.x 模型有效；要讓 Claude 5 也用，等於改變模型預設可用的工具，這屬於產品決策。

證據（事實，CLI 2.1.316）：
1. **工具啟用條件**：
   - `TodoWrite.isEnabled = !QM()&&o3()`（`@300150793`）。
   - `TaskCreate` / `TaskGet` / `TaskUpdate` / `TaskList.isEnabled = que()`，其中 `que()=QM()&&o3()`（`@300229712` 起四處）。
   - `QM()`：只有 `CLAUDE_CODE_ENABLE_TASKS===false` 時是 false（`@290990957`）。
   ⇒ **預設一定是 Task\*，不會是 `TodoWrite`**。`TodoWrite` 只在 `CLAUDE_CODE_ENABLE_TASKS` 關掉時出現（舊 session 的歷史紀錄裡仍可能看到）。
2. **`o3()`（`@294743954`）** 回 true 的條件，任一成立即可：`Ac()`、`Kws()`、主模型未知、inference profile、舊模型清單（`claude-3*`、`claude-opus-4-0/4-1/4-5/4-6/4-7`、`claude-sonnet-4-0/4-5/4-6`、`claude-haiku-4-5`），或 `CLAUDE_CODE_ENABLE_TODO_TOOLS===true`。
3. **`Kws()`（todo opt-in，`@299967397`）**：`--tools` 清單（非 preset）或 `allowedTools` 點名其中一個 todo / task 工具時成立。BAT 傳的是 `tools: { type: 'preset', preset: 'claude_code' }`，也沒有 `allowedTools`（`electron/claude-agent-manager.ts:826-850`），所以不成立。
   ⇒ BAT 面板選 Claude 5（`BAT_BUILTIN_MODELS` 前 4 個，`claude-agent-manager.ts:31-34`）**不會出現 Task\* 卡片**；選內建的 4.x（Opus 4.7 / 4.6、Sonnet 4.6、Haiku 4.5，`:35-41`）**會出現**（【推論】`[1m]` 變體經 canonical 名稱比對後同樣算舊模型）。
4. **面板現況**：
   - Task\* 一律畫成一般工具卡片。`toolDescription` 只顯示 `input.description`（`ClaudeAgentPanel.tsx:2226-2229`），所以 `TaskCreate` 顯示描述文字，`TaskUpdate` / `TaskList` 只有工具名稱。
   - 權限詢問時 `TaskCreate` / `TaskUpdate` 是 warning 等級（`:3048`）。
   - `TodoWrite` 畫成勾選清單（`:2310-2321`、`renderTodoChecklist` `:2254`）。
   - sub-agent 判斷全部是 `=== 'Task' || === 'Agent'` 的精確比對（`ClaudeAgentPanel.tsx:421-423`、`:674`、`electron/claude-agent-manager.ts:1107`），Task\* 不會進 `activeTasks`，T0718 的 `electron/__tests__/claude-sdk03-task-tools.test.ts` 也守住這一點。
5. **能拿來累積狀態的資料**（`sdk-tools.d.ts:2805-2871`、`:4016-4050`，以及 CLI 的 `mapToolResultToToolResultBlockParam`）：
   - `TaskCreate`：輸入 `subject` / `description` / `activeForm?`；結果文字 `Task #<id> created successfully: <subject>`。**id 只出現在結果文字裡**（BAT 存的 `result` 是文字，沒用 `tool_use_result`）。
   - `TaskUpdate`：輸入 `taskId` / `status` (`pending|in_progress|completed|deleted`) / `subject?` 等；結果文字 `Updated task #<id> <fields>`，失敗時是錯誤文字或 `Task #<id> not found`。
   - `TaskList`：結果每行 `#<id> [<status>] <subject>[ (<owner>)][ [blocked by #…]]`，可以當完整快照，用來重新同步。

設計選項（實作單用）：
- **A（建議）**：新增純函式 `src/lib/claude-task-list.ts`，把訊息依序重播：`TaskCreate` 結果建項目、`TaskUpdate` 輸入改狀態、`TaskList` 結果整份取代。面板上，最新清單畫在 `TaskCreate` / `TaskUpdate` 卡片原位（比照 `TodoWrite` 的勾選清單樣式，重用 `renderTodoChecklist` 的 CSS）。必要時在 pinned 區（`:2925` 一帶）上方加一個可收合的「工作清單」區塊。歷史 / resume 載入時同一函式重播即可，不需要新 IPC。
- B：只改卡片文字（顯示 subject / 狀態變化），不累積狀態。S，但看不到全貌。
- 🔴 不得進 `activeTasks`、不得改 `Task` / `Agent` 判斷。
- `flushSync`（CLAUDE.md「React Rendering」）：**不適用**。只有影響 active tasks bar 顯示與否的 Agent / Task 狀態變化才用，Task\* 清單照一般工具處理。
- Codex 面板不受影響：`update_plan` → `TodoWrite` 的對應不變（`electron/codex-agent-manager.ts:514`）。

需要決策（使用者）：
1. 要不要讓 Claude 5 模型也用 todo / task 工具。
   - (a) 不開，維持 CLI 預設。清單 UI 只對 4.x 有用。
   - (b) **建議**：在 SDK spawn env 加 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`（`sdkSpawnEnv` 一處）。只影響 Claude 面板，不影響終端分頁。
   - (c) 加 `allowedTools: ['TaskCreate', …]`。不建議：`allowedTools` 同時是免詢問權限清單，會改變權限行為。
   - 要不要做成 Settings 開關也一併決定。【推論】CLI 對 Claude 5 預設關閉應是刻意的，所以開或不開都是產品決策，不是 bug。
2. 選 (a) 的話，清單 UI 價值偏低（只服務 4.x），建議連 UI 一起延後。

#### R3：`queryOptions` 改用 SDK `Options` 型別

**建議：做（S，純型別）。理由：** 改完 `typecheck:electron` = 0，只需要一個收窄的轉型，執行期行為不變。改完之後，SDK 升版時選項改名或移除就會被 typecheck 抓到。試驗也找到一個型別與執行期不一致的地方：`executable`。

試驗紀錄（scratchpad `r3/`，`tsc --noEmit -p tsconfig.node.json --composite false --target ES2022`，與 `npm run typecheck:electron` 同旗標）：

| 步驟 | 改動 | 結果 |
|---|---|---|
| 基線 | 無 | exit 0、0 錯誤 |
| v1 | `import type { …, Options }`；`claude-agent-manager.ts:826` `Record<string, unknown>` → `Options`；`:892` 拿掉轉型；`:2224` 轉型改 `satisfies Options` | **3 個錯誤**，都在 `executable`：`Type 'string' is not assignable to type '"node" \| "bun" \| "deno" \| undefined'`（`:826`、`:2215`、`:2224`） |
| v2 | 再把 `:845`、`:2223` 改成 `{ executable: nodeExecutable as Options['executable'] }` | **exit 0、0 錯誤** |
| v3（偵測力） | 故意把直接屬性改錯字 `promptSuggestionz`，並把條件 spread 改成 `pluginz` | 直接屬性**抓得到**（`TS2561 … Did you mean to write 'promptSuggestions'?`）；條件 spread 裡的 `pluginz` **抓不到**（TS 不對 spread 做 excess property check） |

- **BAT 有傳、但 SDK 型別沒有的選項：沒有**（與 T0718 的 24 個選項名稱核對一致）。唯一不一致的是 `executable` 的**值域**。SDK 宣告是 `'bun' | 'deno' | 'node'`（`sdk.d.ts:1728`），BAT 傳的是 node / Electron 執行檔的完整路徑（`getNodeExecutable()`，`claude-agent-manager.ts:845`、`:2223`）。
- **執行期 SDK 怎麼用 `executable`**（`sdk.mjs` `initialize()`）：`X6e(l)` 判斷 `pathToClaudeCodeExecutable` 是否**不**以 `.js/.mjs/.ts/.tsx/.jsx` 結尾，接著 `At=nt?l:s`、`Yt=nt?[...i,...V]:[...i,l,...V]`，再用 `spawn(command:At, args:Yt)`。
  ⇒ 內嵌 CLI 是原生 `claude.exe`，這時 `executable` **完全被忽略**；只有 CLI 路徑是 `.js` 時，才拿 `executable` 當 spawn 的 command，傳路徑在執行期是可以用的。所以轉型只是讓型別承認現況，不改行為。轉型處要加註解說明這一點。
- `getSupportedModels`（`:1604-1610`）本來就是型別化的物件字面值，不用改。
- 規模：1 個檔、約 6–10 行。要讓條件 spread 也受檢查，每個 `...(cond ? {…} : {})` 加 `satisfies Partial<Options>`，再加 5–6 處。TS 5.9.3 支援 `satisfies`。
- 風險：低。esbuild 只轉譯，產物不變。沒有測試或 source guard 依賴 `queryOptions` 的寫法（`grep queryOptions electron/__tests__` 沒有結果）。

### 建議方向

- R1 不做句型，只補負向測試與文件註記。
- R2 等使用者決策。決策 (b) → 開 M 單；決策 (a) → 延後並結案候選。
- R3 做，S。
- 合併：R3 和 R1 的負向測試可以合成一張 S 單（「pre.5 後續清理」：型別 + 測試，都不改執行期行為），符合「整批修、一次發版」。R2 牽涉使用者決策與 UI，另開一張；如果與 R3 同一批做，R2 的 `sdkSpawnEnv` 改動和 R3 在同一個檔案，建議 R3 先 commit。

### 建議下一步

**實作單草案 1（S）：`queryOptions` 型別化 + usage-limit 負向測試**
- 範圍：
  - ① `electron/claude-agent-manager.ts`：`import type Options`；`queryOptions: Options`；拿掉 `:892` 的轉型，`:2224` 改 `satisfies Options`；`executable` 收窄轉型並加註解（SDK 宣告是 runtime 名稱，執行期當成 spawn command；CLI 是原生 binary 時忽略）；條件 spread 加 `satisfies Partial<Options>`。
  - ② `src/lib/__tests__/usage-limit.test.ts`：補一個案例，單行 `Usage limit has reset · Press enter to continue`（含 2.1.306 的小寫 `press`）單獨出現 → `none`；與兩行 footer 同時出現 → `send-enter`。
  - ③ `src/lib/usage-limit.ts` 檔頭註記這行是對話紀錄通知，刻意不辨識。
  - ④ `docs/agent-guide/usage-limit-continue.md` 同步一句。
- `affects_files`：`electron/claude-agent-manager.ts`、`src/lib/__tests__/usage-limit.test.ts`、`src/lib/usage-limit.ts`、`docs/agent-guide/usage-limit-continue.md`。
- 驗收：`npm run typecheck:electron` = 0、`npm run typecheck` = 0、`npx vitest run src/lib/__tests__/usage-limit.test.ts electron/__tests__/usage-limit-continue.test.ts electron/__tests__/claude-sdk03-task-tools.test.ts` 通過、`npx vite build` 成功。回報附「故意寫錯一個直接屬性名稱 → typecheck 失敗」的截錄，證明偵測力。

**實作單草案 2（M，使用者決策 (b) 之後）：Claude 面板 Task 清單**
- 範圍：新增 `src/lib/claude-task-list.ts`（重播函式）與測試；`ClaudeAgentPanel.tsx` 的 Task\* 卡片改畫累積清單（也可加 pinned 區塊）；i18n 字串；`sdkSpawnEnv` 加 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`（或依決策加 Settings 開關）；CLAUDE.md「Sub-agent / Active Tasks Tracking」補一行「Task\* 是清單工具，不是 sub-agent」；`docs/agent-guide/claude-agent-sdk-cli.md`。
- `affects_files`：`src/lib/claude-task-list.ts`、`src/lib/__tests__/claude-task-list.test.ts`、`src/components/ClaudeAgentPanel.tsx`、`src/locales/*`（實際檔名以 repo 為準）、`electron/claude-agent-manager.ts`、CLAUDE.md、docs。
- 驗收：
  - 重播測試涵蓋 create / update / deleted / TaskList 快照 / 結果文字解析失敗。
  - `activeTasks` 不受影響（沿用 `claude-sdk03-task-tools.test.ts`）。
  - 兩個 typecheck = 0、build 成功。
  - 實機：Claude 5 開 env 後出現 Task\* 與清單；4.x 不開 env 也有清單；關掉 env 時 Claude 5 沒有 Task\*。實機會耗 token，要使用者同意。

**R1**：不另開單，併入草案 1 的 ②–④，就可以結案這個候選。

### 子代理使用

未使用子代理，也未使用 Workflow 工具；三項都由主 Worker 直接讀檔與 binary。

### 遭遇問題

- 用 Git Bash 的 `grep -a -o -E '.{0,500}…'` 掃 335 MB 的 `claude.exe` 超過 120 s，被移到背景（task `bxha18tsd`）。改用 scratchpad 的 `bgrep.mjs`（`Buffer.indexOf`）後每次約 1 秒。那個背景 grep 不影響任何檔案。
- scratchpad 的 `r3/node_modules` 是指回 repo `node_modules` 的 junction。要清 scratchpad 時只移除 junction 本身，不要遞迴刪除目標。
- 工作期間 repo HEAD 前進了（T0722 closeout、T0723 start），與本單無關。工作樹另有 `_ct-workorders/T0720-…md` 未 commit 的變更，不屬本單，沒有碰。

### 回報時間

2026-11-01T10:01:57+0800
