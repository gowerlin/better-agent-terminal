---
schema_version: 1
schema_kind: workorder
id: T0733
title: "研究：Claude 面板每個 turn 結束後 CLI 在同一對話多送的一個模型請求是什麼、能不能關"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T12:25:49+0800"
started_at: "2026-11-01T12:27:45+0800"
updated_at: "2026-11-01T12:36:23+0800"
completed_at: "2026-11-01T12:36:23+0800"
depends_on: []
related:
  - "T0729 回報區〈發現的問題 / 後續〉1；D198"
  - "`e2e/fixtures/fake-anthropic-api.ts`（T0727）；T0729 的 SDK 直接呼叫原型做法（假 API、暫存 HOME、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`、擋外連 proxy）"
  - "CLAUDE.md「Claude Agent SDK / CLI」；`electron/claude-agent-manager.ts`（面板的 `query()` 選項）"
affects_files:
  - _ct-workorders/T0733-research-claude-panel-extra-request-after-turn.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只查不改：不改產品程式碼、測試、docs；不跑 `vite build` / 打包 / e2e（T0730 / T0732 在同一 repo build）。原型腳本只放 scratchpad，以 SDK 0.3.316 直接驅動內嵌 CLI 2.1.316，打本機假 Anthropic API；不得用使用者的 OAuth / 真實 API key，不得有請求送到 api.anthropic.com；暫存 HOME，不讀寫使用者 `~/.claude`。"
  - "🔴 要回答：① 這個請求的性質（請求內容的特徵：model、system prompt 片段、tools 數、`max_tokens`、使用者訊息、metadata；對照 CLI binary 字串找出對應功能，例如 prompt suggestion / 摘要 / 標題產生），附證據但不得把使用者資料或權杖寫進回報；② 是否每個 turn 都送、與 `query()` 哪些選項有關（以 BAT 面板實際傳的選項重現，`electron/claude-agent-manager.ts`）；③ 能否以 SDK 選項或 env 關閉（候選如 `promptSuggestions`、`CLAUDE_CODE_*` env 等，以 SDK 型別與 CLI 實測為準），關閉後對面板功能有無影響（BAT 是否用到該結果）；④ 真實帳號下每次大約多少 input / output token（以假 API 收到的請求內容估算，標明是估算）；⑤ 同樣的請求在 Claude CLI 終端分頁是否也會發生（只看 CLI 預設行為，不實測真實帳號）。"
  - "🔴 回報區給：結論、建議（改 / 不改，若改則列實作單草案：範圍、affects_files、驗證方式），以及需要使用者決定的點。不耗 token、不 build。log / 回報不含權杖或完整 session id。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
---

# T0733 — 研究：Claude 面板 turn 後多出的請求

## 元資料

- **工單編號**：T0733
- **類型**：research
- **優先級**：P2
- **建立時間**：2026-11-01T12:25:49+0800
- **預估規模**：S

## 背景

T0729 以假 Anthropic API 觀察到：Claude 面板每個情境的最後一個 turn 結束後，CLI 在同一段對話又送一個請求（無新的使用者訊息、分頁自己的模型、15 tools），疑似 CLI 自己的後續功能（例如 prompt suggestion），真實帳號會耗 token。使用者決定開研究單（D198）。

## 範圍

1. 以 SDK 直接呼叫原型重現並辨識請求性質。
2. 查可否關閉、影響、token 估算、CLI 分頁是否同樣。
3. 建議與實作單草案。

## 不做

- 不改任何產品檔案、不 build、不耗 token。

## 驗收

- [x] ①–⑤ 各有結論與證據
- [x] 建議（含實作單草案或不改理由）與待決點

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**：多出來的請求是 CLI 的 **prompt suggestion**（預測使用者下一句要打什麼）。觸發來源是 BAT 面板自己在 `query()` 傳了 `promptSuggestions: true`（`electron/claude-agent-manager.ts:884`，2026-02-28 `cdfa90a1` 引入），結果會顯示成面板的「Suggested Tab:」建議晶片。①–⑤ 都有實測或 CLI 原始碼證據。建議：**不改程式**；要不要加開關交使用者決定（附實作單草案）。

### 落地檢查

- **PASS**。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS。C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS。C-3：`affects_files` 只有本工單（`_ct-workorders/` 底下排除）→ not applicable。C-2：沒有 `branch` 欄位（目前在 `main`）。
- 不在 worktree（`CT_HOME` 未設）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只作證據）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 做法

- 原型 `probe.mjs` 只放在 scratchpad。以 SDK 0.3.316 的 `query()` 直接驅動內嵌 CLI 2.1.316（`node_modules/@anthropic-ai/claude-code/bin/claude.exe`），打本機假 Anthropic API，假 API 會存下完整請求內容供分析。
- 選項照 BAT 面板（`queryOptions`，`claude-agent-manager.ts:876-904`）：preset systemPrompt / tools、`includePartialMessages`、`promptSuggestions: true`、`settingSources: ['user','project','local']`、`thinking: adaptive`、`effort`、`toolConfig`、`agentProgressSummaries: true`、`model: claude-opus-5-5`、`canUseTool`。每則使用者訊息都是一次新的 `query()`，第二則起帶 `resume`，和 BAT `runQuery` 相同。每個情境 3 個 turn。
- 隔離做法：env 從零組（不繼承使用者的 Claude 登入）、暫存 HOME / `CLAUDE_CONFIG_DIR`、`ANTHROPIC_API_KEY` 用假值、`HTTPS_PROXY` 指向擋外連的 proxy、`DISABLE_AUTOUPDATER` / `DISABLE_UPDATES`。結果：沒有任何請求送到 api.anthropic.com（下表 proxy 欄）。
- 偏差（已處理）：第一次執行時 cwd 放在 `os.tmpdir()`，位於使用者家目錄底下。CLI 往上層目錄找 `CLAUDE.md`，結果把 `<使用者資料夾>\.claude\CLAUDE.md` 當成 project instructions **讀進**請求，只送到本機假 API，沒有寫入。那次的請求檔已立刻刪除，cwd / HOME 改放 `D:\t0733-probe-tmp\` 後重跑；正式數據都是重跑的結果。重跑的請求內容已掃過，沒有使用者名稱或路徑。暫存目錄跑完已刪除。

### 實測結果

| 情境 | turn 1 | turn 2 | turn 3 | 面板收到 `prompt_suggestion` | proxy 外連嘗試 |
|---|---|---|---|---|---|
| BAT 選項（`promptSuggestions: true`） | 1 個請求 | 2 個（主 turn＋結果後 1 個 SUGGESTION MODE） | 2 個（同左） | turn 2、3 有（`run the tests`） | 0 |
| `promptSuggestions: false` | 1 | 1 | 1 | 無 | 0 |
| env `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=false` | 1 | 1 | 1 | 無 | 0 |
| 使用者 settings `promptSuggestionEnabled: false` | 1 | 1 | 1 | 無 | 0 |
| plan mode | 1 | 1 | 1 | 無 | 0 |
| BAT 選項，但不設 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | 2（多 1 個 0 tools 的**標題產生**請求） | 2 | 2 | turn 2、3 有 | 9 次 `CONNECT api.anthropic.com:443`（都被 proxy 403 擋下，沒送出） |

（上表「BAT 選項」那幾列都有設 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`，和 T0729 相同；最後一列是對照。）

### ① 請求性質

- **對應功能**：CLI 的 prompt suggestion。請求的最後一則 user 訊息是 CLI 內建的提示，開頭為 `[SUGGESTION MODE: Suggest what the user might naturally type next into Claude Code.]`，共 1363 字元。內容是預測使用者下一句、2–12 個字、不確定就不回答；CLI 二進位裡就是這段字串（`var I=\`[SUGGESTION MODE…`）。
- **請求特徵**（和同一個 turn 的主請求比較）：
  - `model`：和分頁相同（`claude-opus-5-5`）。
  - `system`：3 個 block，和主請求**逐位元相同**。
  - `tools`：15 個（Agent、AskUserQuestion、Bash、Edit、Glob、Grep、ListAgents、Read、ReportFindings、ScheduleWakeup、Skill、ToolSearch、Workflow、DeferredToolPlaceholder、Write），也逐位元相同。
  - `max_tokens` 128000、`thinking: {type: adaptive, display: updates}`、`output_config.effort` 都和主請求相同；`metadata.user_id` 同一個 session。
  - `messages`：完整對話，加上主 turn 剛回的 assistant 訊息，再加上 SUGGESTION MODE 那則 user 訊息。`cache_control` 標在最後一則 assistant 訊息上。
  - 結論：這是用 CLI 的 cache-safe 參數把主對話 fork 一次（SDK 型別說明寫「piggyback on the parent's prompt cache」）。
- **在哪裡產生**：在 `result` 之後、同一個子行程裡。SDK 隨後送出 `{type: 'prompt_suggestion', suggestion}`；BAT 經 `processMessage`（`claude-agent-manager.ts:1291-1295`）→ `claude:prompt-suggestion` IPC → `ClaudeAgentPanel.tsx` 的建議晶片（`:3486-3494`）與空輸入時按 Tab 自動填入（`:1772-1776`）。
- 附帶發現：不設 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` 時（真實使用者的情況），第一個 turn 另有一個 0 tools 的**會話標題產生**請求（system 為「You are naming a coding session…」）。這和本單的請求無關，每個 session 只有一次。

### ② 是否每個 turn 都送、與哪些選項有關

- 開關：SDK 選項 `promptSuggestions`。CLI 端是 `promptSuggestionEnabled: r.promptSuggestions && BBn()`，`BBn()` = env `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION`，沒設 env 才看 settings 的 `promptSuggestionEnabled !== false`。不帶這個選項 = 關。
- 不送的情況（CLI `fSo` / `L` 原始碼＋實測）：
  - 對話裡的 assistant 訊息少於 2 則（`early_conversation`，所以 turn 1 不送，實測吻合）。
  - 上一次回應是 API 錯誤。
  - 有待回答的權限 / sandbox 請求或 MCP elicitation。
  - plan mode（實測吻合）。
  - 帳號用量狀態不是 `allowed`（接近或到達限制）。
  - 改用 usage credits 計費時。
  - **cache 沒熱**：上一次回應的 `input + output > 10,000`（`uncached`），或再加 `cache_creation > 10,000`（`cache_write`），就不送。所以大量新內容寫進 cache 的那個 turn 會跳過。
  - SDK 端另有 `prefix_not_warm` 檢查。
- 結論：BAT 面板從第 2 個 turn 起，**每個符合條件的 turn 結束後送 1 個**；一個 turn 裡有多個工具回合時也只送 1 個，在 `result` 之後。和 `agentProgressSummaries`、`includePartialMessages`、`thinking` 無關（關掉 `promptSuggestions` 其他不變就是 0 個），但 `thinking` / `effort` 會原樣帶進這個請求。
- SDK 路徑**沒有** CLI 終端的三個節流（見 ⑤）：GrowthBook 旗標、使用者連續不採用時降頻、終端沒有焦點時不產生。所以面板分頁不在畫面上時，照樣會產生。

### ③ 能否關閉、關閉後的影響

- 三種做法實測都是 0 個額外請求：
  - SDK 選項 `promptSuggestions: false`（或不傳）；
  - spawn env `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=false`；
  - settings `promptSuggestionEnabled: false`（面板 `settingSources` 含 `user`，所以使用者自己寫在 `~/.claude/settings.json` 就生效，**不必改 BAT**）。
- env 優先於 setting。plan mode 本來就不送。
- 影響：BAT **有用到**這個結果，關掉後面板就沒有「Suggested Tab:」建議晶片，空輸入時按 Tab 也不會自動填入。其他功能（狀態列、用量、工具、權限）不受影響：那個請求的結果只走 `prompt_suggestion` 這一條路。`CodexAgentPanel.tsx` 雖然也聽 `onPromptSuggestion`，但 codex 管理器不送這個事件，所以不受影響。

### ④ 真實帳號下的 token（估算，不是實測）

- 假 API 收到的大小（最小環境：沒有 CLAUDE.md、plugins、MCP）：
  - 主請求約 55.5 KB（system 6.1 KB＋tools 38.8 KB＋messages 約 10.2 KB）。
  - suggestion 請求約 57.0 KB，多出的約 1.5 KB 是上一則回覆＋SUGGESTION 提示。
  - 以約 4 B/token 估：基底約 14k tokens，每次 suggestion 專屬的部分約 300–400 tokens。
- 真實 BAT session 還會載入使用者層與專案 CLAUDE.md（本 repo 的就有 74.5 KB）、skills 清單、MCP、plugins，加上對話歷史。所以每次 suggestion 的 **input 約等於整段 context，估 30k–150k+ tokens**。
- 但 CLI 只在 cache 熱的時候送（見 ②），所以大部分是 **cache read**（計價約 0.1×）：
  - 換算成一般 input 約 **3k–15k tokens 等值**；
  - 加上未快取約 300–400 tokens；
  - cache write 只有上一則 assistant 回覆（下一個主 turn 本來就要寫，等於提前寫入）。
- output：建議文字 2–12 個字（約 5–30 tokens），**另加 adaptive thinking**：帶著分頁的 `effort`，可能會思考，數量假 API 量不到，屬未知。
- 對照：每個 turn 的主請求本身也要 cache read 整段 context，所以 suggestion 大約讓每個 turn 的 cache read **多一倍**、新增 input 多數百 tokens。訂閱帳號會計入用量限制，但用量接近限制時 CLI 自己會停送。

### ⑤ Claude CLI 終端分頁是否也會送

- 會，視條件而定（只看 CLI 2.1.316 原始碼，沒有用真實帳號實測）。互動模式的預設判斷 `UBn()` 依序為：
  1. env `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION` 有設就照它；
  2. GrowthBook 旗標 `tengu_chomp_inflection`（預設 false，由服務端逐帳號開放）沒開 → 關；
  3. 非互動（`-p`）→ 關；
  4. swarm teammate → 關；
  5. 其餘看 settings `promptSuggestionEnabled !== false`（預設開）。
- 終端另有面板沒有的節流：
  - 只在終端有焦點時產生（`unfocused` / `bg_unattached` 跳過）；
  - 使用者連續不採用時降頻（`unused_streak`：每 10 個符合條件的 turn 才產生 1 次）；
  - 其餘抑制條件（turn 1、plan mode、cache 沒熱、用量限制）相同。
- 所以 BAT 的 claude-cli 終端分頁行為和一般 `claude` 相同，BAT 沒有額外開啟。helper 派工的 Worker 也是互動式 TUI，同樣適用。面板經 SDK 選項直接開啟，**繞過 GrowthBook 旗標與上述兩個節流**，產生頻率比終端高。

### 結論與建議

- **結論**：這個請求是 BAT 刻意開啟、而且有在用的功能（建議晶片），不是 BUG，也不是 CLI 擅自加的。成本主要是 cache read，CLI 在 cache 沒熱和用量接近限制時會自己停送；使用者已經能用 settings `promptSuggestionEnabled: false` 或 env 自行關閉，BAT 也會遵守。
- **建議：不改程式**。理由：功能可見且有人用；關閉方式已經存在；改預設會拿掉現有功能（No Regressions）。如果塔台同意，可以開一張純文件小單，在 `docs/agent-guide/claude-agent-sdk-cli.md` 記下「面板開了 prompt suggestion、成本特性、怎麼關、面板比終端少了哪些節流」。
- **若使用者要 BAT 層的控制，實作單草案**（建議 S）：
  - 範圍：Settings 加「Claude 面板：下一步建議」開關（建議**預設開**，保留現行行為），對應 `queryOptions.promptSuggestions`；關閉時面板不顯示建議晶片。只影響之後開始的 turn；不改 claude-cli 終端分頁。
  - affects_files：`electron/claude-agent-manager.ts`（`queryOptions`）、`src/types/index.ts`（設定型別）、Settings 面板元件與 i18n、`electron/__tests__/` 一個選項測試、`docs/agent-guide/claude-agent-sdk-cli.md`。e2e 可選：`e2e/v072-pre6-claude-panel.spec.ts` 加一段「關閉時結果後沒有 SUGGESTION MODE 請求」。
  - 驗證：單元測試確認開 / 關時 `promptSuggestions` 的值；假 API e2e 或 SDK 原型確認關閉時 turn 2 起 0 個額外請求、開啟時 1 個；`test:unit`、兩個 typecheck、`vite build`。
- 相關但不在本單範圍：面板同時開了 `agentProgressSummaries: true`。SDK 說明是 subagent 執行時每約 30 秒 fork 一次產生進度摘要，也會耗 token。這次沒有 subagent，所以沒觀察到；要不要另外研究由塔台決定。

### 需要使用者決定的點

1. 維持現狀（建議）／加 Settings 開關（預設開）／改成預設關？
2. 要不要開文件小單，把成本與關閉方式寫進 `docs/agent-guide/claude-agent-sdk-cli.md`？
3. 要不要另開研究單看 `agentProgressSummaries` 的 token 成本？

### 修改檔案

- 只有本工單。產品程式碼、測試、docs 都沒動；沒跑 build / e2e / 打包。

### Commit

- 本工單：收尾 commit（`git commit --only`）。未 push。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### 回報時間

2026-11-01T12:36:23+0800
