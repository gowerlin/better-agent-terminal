---
schema_version: 1
schema_kind: workorder
id: T0640
title: "研究：PLAN-050 Claude 分頁的 session 識別——實測 claude `--name` / `--session-id` 與 ListAgents，提出 R1–R3 的 BAT 做法與介面契約草案"
type: research
status: DONE
repo: better-agent-terminal
project: PLAN-050
priority: P2
sizing: M
created_at: "2026-10-18T15:52:18+0800"
started_at: "2026-10-18T15:53:15+0800"
updated_at: "2026-10-18T16:07:34+0800"
completed_at: "2026-10-18T16:07:34+0800"
depends_on: []
related:
  - "PLAN-050（CT D067 需求提案原文：`D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_request-2026-10-18-bat-session-identity.md`，唯讀）"
  - "T0562（`--set-role tower` / 塔台分頁標題）、T0582（`terminal:list` / `whoami` 契約、`authorizeHelperQueryTarget` 範圍）、T0584（`buildBatMcpLaunchArgs` 注入唯一組裝點、`bat-mcp-launch.test.ts` source guard）、T0553（外部建立分頁標題）、D149（範圍權杖）"
affects_files:
  - _ct-workorders/T0640-research-claude-session-name-identity.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：**不改任何產品檔、不 commit 產品檔**；實驗腳本、設定、擷取檔一律放系統暫存目錄或 scratchpad（不得寫進 repo）。只 commit 本工單檔（`git commit --only`）。不 push。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 不得修改使用者的 `%APPDATA%\\BetterAgentTerminal\\settings.json`、`~/.claude/`、`~/.codex/`；可以讀，回報不寫任何權杖 / API key / 帳號資訊（`BAT_REMOTE_TOKEN` 只寫「已設定」）。"
  - "🔴 實測 claude 時用最便宜的模型、最短的 prompt，或用不呼叫模型的方式（例如只啟動到 TUI 就結束、`--help`）；回報記下大約用了幾次模型呼叫。實驗開的 claude session 用完要結束，不得留下會出現在 ListAgents 的殘留 session。"
  - "🔴 不得對其他 session 送 SendMessage（只可用 ListAgents 唯讀觀察）；不得改名塔台或其他分頁的 session。"
  - "🔴 yolo Worker：不得問使用者；範圍內無法決定且猜錯會返工的選擇，依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。R2 選 (a) / (b) / (c) 哪個是**使用者決定**，你只提推薦與理由，不要問塔台代決。"
---

# T0640 — 研究：Claude 分頁的 session 識別（PLAN-050）

## 背景

BMad-Guide 塔台以跨 session 訊息找 BAT 塔台時，ListAgents 只顯示「工作目錄名＋兩字元」（例 `better-agent-terminal-93`），分不出塔台與 Worker（今天兩次實例，見 PLAN-050）。CT 的需求：R1 派出的 Claude Worker 名稱含工作區與 `T####`；R2 看得出是哪個專案的塔台；R3 `bat_list_terminals` 等可查分頁 ↔ session 對應。CT 提的做法是 claude 現有啟動參數 `--name` / `--session-id`，R2 有 (a)(b)(c) 三案（見 PLAN-050）。

## 要回答的問題

### Q1 — claude CLI 的實際行為（實測，內嵌 CLI 與本機 system claude 各記版本）

1. `--name` / `-n`、`--session-id` 在目前內嵌版本（`@anthropic-ai/claude-code` `2.1.300` 線）是否存在、`--help` 原文怎麼寫
2. 帶 `--name "<名稱>"` 啟動後，**另一個** Claude session 的 ListAgents 是否顯示這個名稱（你自己就是 Claude session，可直接用 ListAgents 觀察）；名稱含 `·`、空白、中文時顯示是否正確、有無長度或字元限制、兩個 session 同名時 ListAgents 怎麼呈現
3. `--name` 與 `--resume` / `--continue`、`/rename`、`--session-id` 的互動（例：resume 時名稱是否沿用或被覆寫）
4. 較舊的 claude 遇到不認得的 `--name` 會怎樣（啟動失敗？忽略？）——以 `claude --help` 文件、changelog 或二進位字串判斷即可，不必安裝舊版；system runtime 的 claude 版本可能落後，這點決定要不要做版本門檻
5. `--session-id` 的 UUID 由呼叫端指定時的限制（格式、重複時的行為）；session 中能否查到自己的 sessionId / 名稱（例如 env、檔案）

### Q2 — BAT 的注入點與現況（讀程式碼）

1. claude 啟動參數的組裝點：BAT MCP 唯一組裝點 `buildBatMcpLaunchArgs`（`electron/bat-mcp-launch.ts`）/ renderer `withBatMcpLaunchArgs`（`src/lib/bat-mcp-launch.ts`）、helper 派工 `createAgentPromptCommandBuilder`；`--name` 應該放哪、自訂參數已含 `--name` / `-n` 時怎麼處理
2. 分頁 ↔ session 對應目前有沒有任何資料（例如 Claude Agent SDK 面板的 sessionId、`claude-cli` 分頁有沒有記）；R3 要新增的欄位放在哪個回傳（`terminal:list` / `whoami` / `get-state`）、是否需要持久化（BAT 重開、Terminal Server 存活）
3. R2 的跨專案查塔台：`list scope=workspace` 目前只到同工作區（`authorizeHelperQueryTarget`）；(a) 案需要的「跨工作區列出塔台分頁」會放寬哪些範圍、是否碰到 D149 權杖範圍的原則；不放寬的替代（例如只靠名稱前綴）是否足夠
4. 名稱格式建議：與分頁標題（T0553 `externalTerminalTitle`、T0562 `<Agent> · Tower`）的關係；工作區名含特殊字元時的處理

### Q3 — 方案與推薦

- R1、R3 的推薦做法；R2 三案 (a)(b)(c) 的比較表（使用者操作、BAT 改動量、跨專案找塔台是否可靠、與 `--set-role` 時序的關係、已知限制），給一個推薦與理由
- 介面契約草案（給 CT 依此撰寫，格式比照 T0583 / T0600 的「介面契約」）：新欄位名與值域、名稱格式、不支援時的降級（舊 claude / system runtime / codex 分頁 / raw command）
- 實作切分建議（S / M / L、會動哪些檔、需要的 e2e）與風險

## 交付

回報區依 Q1–Q3 作答，每個結論附證據（指令輸出、ListAgents 觀察、檔案:行號）；標明哪些是實測、哪些是推論。

---

## 回報區

### 結論摘要

- **`--name` 可用且就是 ListAgents 顯示的名稱**（實測）：內嵌 `2.1.300` 與系統 `2.1.302` 都有 `-n, --name <name>`；名稱原樣進 claude 的 session 登錄與 ListAgents（`·`、空白、全形括號、中文都正確），上限 200 字元（超過會截斷），同名可並存（ListAgents 只靠 `[ref]` 區分）。`--name` 從 claude `2.1.76` 才有；更舊的版本遇到不認得的參數會 `error: unknown option` exit 1 → **system runtime 要做版本門檻**。
- **`--session-id` 不適合拿來做 R3**（實測）：跟 `--resume` / `--continue` 一起用會 exit 1（除非加 `--fork-session`），重用已經落檔的 UUID 也會 exit 1，而且 `/clear` 後 sessionId 會換。**R3 的 sessionId 改由 BAT 現有的 `SessionStart` hook 回報**（hook stdin 有 `session_id`，實測），名稱則記 BAT 自己注入的 `--name` 值。
- **hook 的 `sessionTitle` 不能拿來改 ListAgents 名稱**（實測）：`SessionStart` 回 `hookSpecificOutput.sessionTitle` 只改了終端標題，登錄裡的名稱（ListAgents 看到的）沒變。所以 `--set-role tower` 之後要改名，claude 現有的路徑只剩 `/rename`。
- **推薦**：R1 = 派工的 Worker 啟動時帶 `--name "<工作區> · Worker · T####"`；R3 = `terminal:list` / `whoami` / `get-state` 多 `claudeSessionName` / `claudeSessionId`；R2 = **(a)+(b) 並用**（理由見 Q3），(c) 作為發版前的過渡做法。R2 選哪一案由使用者決定。

證據標示：**【實測】** = 本 session 執行過；**【碼】** = 讀程式碼或 claude 二進位字串；**【文】** = claude 官方 CHANGELOG；**【推論】** = 沒有直接驗證。

---

### Q1 — claude CLI 的實際行為

**版本**【實測】：內嵌 `node_modules/@anthropic-ai/claude-code/bin/claude.exe` = `2.1.300 (Claude Code)`；系統 `~/.local/bin/claude` = `2.1.302 (Claude Code)`；安裝版 BAT `C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@anthropic-ai\claude-code` = `2.1.300`。兩版的 `--help` 輸出完全相同（`diff` 無差異）。

**實驗方法**：在 scratchpad 寫 node-pty harness（`harness.cjs`），以 120x30 PTY、cwd = 本 repo、拿掉 `BAT_*` / `CT_*` / `CLAUDE*` env 的環境啟動互動 TUI，不送 prompt；ready 後讀 `~/.claude/sessions/<pid>.json`（claude 自己的 session 登錄），並從本 session 呼叫 ListAgents 觀察；結束時送 Ctrl+C ×2。

#### Q1-1 `--help` 原文【實測】

```
  -n, --name <name>                     Set a display name for this session
                                        (shown in the prompt box, /resume
                                        picker, and terminal title)
  --session-id <uuid>                   Use a specific session ID for the
                                        conversation (must be a valid UUID)
  -r, --resume [value]                  Resume a conversation by session ID, or
                                        open interactive picker with optional
                                        search term
  -c, --continue                        Continue the most recent conversation in
  --fork-session                        When resuming, create a new session ID
                                        instead of reusing the original (use
                                        with --resume or --continue)
```

#### Q1-2 ListAgents 顯示【實測】

| 實驗 | 參數 | 登錄 `name` / `nameSource` | ListAgents 列 |
|---|---|---|---|
| e1（內嵌 2.1.300） | `--name "better-agent-terminal · Worker · T9991"` | 同字串 / `user` | `better-agent-terminal · Worker · T9991 [818599] · interactive · idle` |
| e3（系統 2.1.302，與 e1 同時） | 同名 | 同字串 / `user` | 第二列同名 `[706f87]`，與 e1 並列，兩列只靠 `[ref]` 區分 |
| e2（內嵌） | `測試工作區（中文）· Tower · x…`（169 字元） | 完整保留 | 完整顯示，中文、全形括號、`·` 都正確 |
| e9（內嵌） | `/T0640 y…`（257 字元，`/` 開頭） | **截成 200 字元** | 顯示 200 字元版本（`/` 開頭仍列出） |
| e10（內嵌） | `"--name=T0640 eq-form" -n "T0640 last-wins"` | `T0640 last-wins` | `=` 形式可用；**重複時最後一個生效** |
| 未命名（對照） | 無 | `better-agent-terminal-3e` / `derived` | 即 PLAN-050 說的「目錄名＋兩字元」 |

- 名稱也透過 OSC 0 設成終端標題（`]0;✳ <名稱>`，e1/e2/e3 輸出擷取）。BAT 沒有接 xterm 的 `onTitleChange`（`src/`、`electron/` grep 無結果）【碼】，所以**不會影響 BAT 分頁標題**，跟 T0553 / T0562 的標題邏輯互不干擾。
- ListAgents 的 `[ref]` 不是 sessionId 的前綴（本 session `[212b2f]`，sessionId `d97ee6d8-…`）【實測】。CT 送訊息靠名稱（同名時要附 `[ref]`），不是靠 sessionId。
- CHANGELOG【文】：`2.1.234` 提到 session 名稱有 200 字元上限（與 e9 一致）；`2.1.239` 起 Windows 才支援跨 session 訊息（`ListAgents` / `SendMessage`），`2.1.224` 起 macOS / Linux 支援；`2.1.239` 修正 `/` 開頭的名稱無法被定址；`2.1.221` 起各種改名來源的名稱都會被 sanitize。

#### Q1-3 與 `--resume` / `--continue` / `/rename` / `--session-id` 的互動【實測，除另註】

| 步驟 | 結果 |
|---|---|
| e5a：`--session-id U2 --name "T0640 probe A"`，再打 `/rename T0640 probe renamed` | 登錄名稱改成 `renamed`（`user`）；transcript 寫入 `custom-title` / `agent-name` 兩筆（不呼叫模型） |
| e5b：`--resume U2`（不帶 `--name`） | 沿用存檔名稱 `T0640 probe renamed` |
| e5c：`--resume U2 --name "T0640 probe resumed-with-name"` | **`--name` 覆寫**，並寫回 transcript（之後再 resume 就是新名稱） |
| e5d/e5e：`--session-id U3 --name "T0640 probe initname"`，打 `!echo t0640` 讓 transcript 落檔，再 `--resume U3` | 啟動時的 `--name` 有寫進 transcript，resume 後沿用 |
| 只啟動、不送任何訊息就結束（e1/e2/e3） | **不產生 transcript**（`~/.claude/projects/<proj>/<id>.jsonl` 不存在），無法 resume |
| `--continue` | **未實測**（cwd 最近一筆 transcript 可能是本 session 自己，風險太高）。【推論】`--continue` = resume 最近一筆，名稱行為應與 `--resume` 相同 |
| `/clear` | **未實測**。【文】`2.1.243`：`/clear` 後名稱保留給新的 session；【推論】`/clear` 會換 sessionId（CHANGELOG 說是「the new session」），`SessionStart` 會以 `source=clear` 再觸發 |

結論：BAT 帶 `--name` 時，使用者若在自訂參數加 `--continue` / `--resume`，**BAT 的名稱會蓋掉使用者先前 `/rename` 的名稱**。對 PLAN-050 來說這是預期行為（分頁身分以 BAT 為準）；使用者事後 `/rename` 仍可改，但改完之後 BAT 記的名稱就會跟實際名稱不一致（見 Q3 已知限制）。

#### Q1-4 舊版 claude 遇到不認得的 `--name`

- 【文】CHANGELOG `2.1.76`：「Added `-n` / `--name <name>` CLI flag to set a display name for the session at startup」→ `< 2.1.76` 不認得。
- 【實測】用內嵌 2.1.300 帶一個不存在的參數（`--bogus-t0640-flag`）：`error: unknown option '--bogus-t0640-flag'`，**exit 1，TUI 不會啟動**。【推論】舊版遇到 `--name` 也是同一個 commander 錯誤 → 分頁裡的 claude 直接啟動失敗。
- 實際門檻：要 `>= 2.1.76` 才不會讓 claude 啟動失敗；但要讓名稱在 ListAgents 上有用，Windows 要 `>= 2.1.239`（macOS / Linux `>= 2.1.224`）。內嵌版固定是 `2.1.300` 線，沒問題；**system runtime 必須做版本檢查**（可比照 `createCodexOscVersionCheck`，`electron/codex-osc-version.ts`：`execFile` 跑 `--version`、5 s timeout、依路徑 + mtime 快取）。

#### Q1-5 `--session-id` 的限制、自我查詢【實測】

| 情況 | 結果 |
|---|---|
| e4a：`--session-id not-a-uuid` | `Error: Invalid session ID. Must be a valid UUID.` exit 1 |
| e4e：`--session-id <uuid> --resume <uuid>` | `Error: --session-id can only be used with --continue or --resume if --fork-session is also specified.` exit 1 |
| e4d：用一個已有 transcript 的舊 sessionId | `Error: Session ID ab511f5b-… is already in use.` exit 1 |
| e4b + e4c：兩個 session 同時用同一個**還沒落檔**的新 UUID | 兩個都能啟動，登錄裡 sessionId 相同，ListAgents 各列一行 |

- 【碼】判斷「已在使用」的函式只檢查 `<projects>/<id>.jsonl` 是否存在（二進位 `function EDn(e){…statSync(…\`${e}.jsonl\`)…}`），不檢查同一個 UUID 是否已有 session 在跑。
- 對 BAT 的影響：使用者自訂參數含 `--resume` / `--continue` / `-r` / `-c` / `--from-pr` 時，BAT 加 `--session-id` 會讓 claude **啟動失敗**；⏻ 重啟沿用舊的 UUID 也會失敗；`/clear` 之後 sessionId 也會換。所以**不建議用 `--session-id`**。
- 自我查詢：claude 的 tool 子程序看得到 `CLAUDE_CODE_SESSION_ID`（本 session = `d97ee6d8-…`，與 scratchpad 路徑、登錄 `44424.json` 一致）與 `CLAUDE_PID`；名稱沒有 env，只存在 `~/.claude/sessions/<pid>.json`（claude 內部格式，**不建議 BAT 依賴**）。
- **hook 拿得到 sessionId**：`SessionStart` hook 的 stdin 欄位實測是 `session_id,transcript_path,cwd,scratchpad_dir,hook_event_name,source,model`。BAT 已經在 claude 分頁注入 `SessionStart` hook（T0600），回報時順便帶 `session_id`，就不必動啟動參數。

#### 補充：hook 能不能改名（R2 的另一條路）【實測】

- e7：`--settings=<scratchpad>/title-settings.json`（`SessionStart` hook 回 `{"hookSpecificOutput":{"hookEventName":"SessionStart","sessionTitle":"T0640 probe hook"}}`），不帶 `--name` → 終端標題變成 `✳ T0640 probe hook`，**但登錄 / ListAgents 仍是 `better-agent-terminal-3e`（`derived`）**。
- e8：`--name "T0640 probe usr"` 再加上同一個 hook → 終端標題被 hook 蓋成 `hook-vs-name`，ListAgents 仍是 `T0640 probe usr`。
- 結論：`sessionTitle`【文】`2.1.152` / `2.1.94` 只改顯示標題，不改 ListAgents 的名稱；`UserPromptSubmit` 版本沒實測（需要送 prompt）。另外這需要 hook 往 stdout 寫東西，違反 T0590 / T0600 的 🔴「stdout 不輸出任何東西」。**排除此路**。

#### 實驗成本與殘留

- **模型呼叫**：約 1 次。e5d 用 bash 模式（`!echo t0640`）讓 transcript 落檔後，claude 自己送出了一次 `repl_main_thread` 請求（transcript 記為 `api-request`，`model: claude-opus-5-5`，也就是使用者的預設模型，不是最便宜的），請求進行中就被收尾的 Ctrl+C 中斷，`cost-state` 記 `totalCostUSD: 0`、`modelUsage: {}`。其餘實驗都沒有呼叫模型。
- **session**：共啟動 18 次（e1–e10，其中 e4a / e4d / e4e / e6 是參數錯誤立即 exit 1），TUI 都以 Ctrl+C 正常結束（exit 0），收尾時 `~/.claude/sessions/` 只剩原本的 4 個（26856 / 44424 / 46824 / 48564），**ListAgents 沒有殘留**。
- **claude 自己寫進 `~/.claude/` 的東西**（依工單規則不刪，請塔台 / 使用者決定是否清除）：本 repo 的 project 目錄下有兩個實驗 transcript，會出現在 `/resume` 選單：`c5b6277e-d62c-42f5-9b1c-dc9a8907024c.jsonl`（名稱 `T0640 probe resumed-with-name`）、`717781df-10e4-46cb-a045-319c1d88e877.jsonl`（`T0640 probe initname`）；`history.jsonl` 也可能有 `/rename`、`!echo` 的輸入紀錄。
- 沒有改 `settings.json`、`~/.claude/settings.json`、`~/.codex/`：hook 實驗用 `--settings=<scratchpad 檔>` 帶入。過程中讀過 `~/.claude/sessions/*.key`，裡面的 `peerToken` 不寫進本報告。

---

### Q2 — BAT 的注入點與現況（讀程式碼）

#### Q2-1 claude 啟動參數的組裝點【碼】

- 唯一組裝點 `buildBatMcpLaunchArgs`（`electron/bat-mcp-launch.ts:300`）。renderer 經 `agent:bat-mcp-launch-args` → `withBatMcpLaunchArgs`（`src/lib/bat-mcp-launch.ts:15`）呼叫；claude 分頁在 `WorkspaceView.tsx:749`，參數順序是「CLI 路徑 + BAT 參數 + 自訂參數」。helper 派工走 `createAgentPromptCommandBuilder`（`electron/terminal-command-handlers.ts:1023`，`batMcpLaunchArgs` dep），順序是「base + BAT 參數 + 自訂參數 + prompt」。
- **限制**：`buildBatMcpLaunchArgs` 在 `batMcpEnabled` 關閉時直接 return（`:304`，`turned off in Settings`），回傳型別 `BatMcpLaunchResult` 也只描述 MCP / hooks。`--name` 不該跟 BAT MCP 開關綁在一起（ListAgents 是 claude 自己的功能），所以**建議在同一個入口裡另起一段**（與 `mcp` / `hooks` 並列的 `name` 部分，各自有 reason），讓 `bat-mcp-launch.test.ts` 的 source guard（數 `buildLaunchCommand(` 次數）繼續保證所有啟動路徑都經過這裡。
- 名稱需要的資料：renderer 有 `workspace`（alias / name）與 `terminal.id`；派工有 `opts.workspaceId`、`opts.workorder`、`opts.terminalId`，工作區名稱可從 window registry 拿（`electron/dispatch-workspace.ts:107` 已經是 `alias ?? name`）。`BatMcpLaunchRequest` 需要多一個欄位（例如 `sessionName`），**名稱由呼叫端用共用函式算好再傳入**；main 不自己猜工作區（renderer 呼叫時 PTY 還沒建立，`WorkspaceView.tsx:749` 在 `createPtyThenLaunch` 之前）。
- **自訂參數已經有 `--name` / `-n`**：自訂參數排在 BAT 參數後面，claude 取最後一個（e10 實測），所以使用者的名稱一定生效。BAT 這時應該**不注入、記為 `user-args`**，否則 R3 會回報一個實際上沒生效的名稱。偵測寫法比照 `userArgsPassClaudeSettings`（`:97`）：`(^|\s)(--name|-n)(\s|=|$)`，再加上合併短旗標 `-[A-Za-z]*n`（【文】`2.1.176` 有 `claude --bg -cn <name>` 的用法）。
- 引號：`quoteArgForShell(value, shell)`，與 `--mcp-config=` 相同。`--name=<值>` 的形式可用（e10）。

#### Q2-2 分頁 ↔ session 的現況與 R3 落點【碼】

- 現況：只有 Claude / Codex **Agent SDK 面板**有 `sdkSessionId`（`src/types/index.ts:52`，`workspaceStore.setTerminalSdkSessionId`，用於 auto-resume）。**`claude-cli` 分頁沒有任何 session 資訊**，`PtyManager` / `terminal-query-handlers.ts` 都沒有。
- hook 管道已經存在：`scripts/bat-hook.mjs` 讀 stdin，但只取 `hook_event_name` / `tool_name` / `notification_type`（`:17`、`hookReport` `:67`），`terminal:report-hook` 只接受 `event` / `toolName`（`electron/terminal-blocked-state.ts:402–418`）。T0600 規則是「不送 `source` 等 payload」→ **要加 `session_id` 就是改 T0600 契約，需要塔台決策**（sessionId 不是權杖，但還是建議驗證 UUID 格式、日誌只記前 8 碼）。
- 狀態放哪裡：`TerminalBlockedTracker` 以 terminal id 為 key、跟 PTY 是否存在無關（`setBlockedDetection` 在 PTY 建立前就會被呼叫，`pty-manager.ts:1031`，`main.ts:716`），`claudeSessionName` / `claudeSessionId` 可以用同樣模式記錄。
- 回傳欄位：`terminal:whoami`（`terminal-query-handlers.ts:430`，目前沒有工作區名稱）、`terminal:list` 每列（`:486–501`）、`terminal:get-state` 都加。
- 持久化：tracker 只在主行程記憶體裡；BAT 重開但 Terminal Server 還活著時，claude 不會重跑 `SessionStart`，**sessionId 會遺失**。名稱可以用（工作區、角色、工單、分頁 ID）重算，但角色不持久化（T0562），Tower 的名稱算不回來。建議把兩個值存進 window registry 的分頁紀錄（`savedTabsFromRegistry`，`:118`，已經存 `title` / `workspaceId` / `towerTerminalId`），沒有權杖。headless 沒有 window registry → 重開後是 `null`（已知限制）。

#### Q2-3 R2 跨工作區查塔台與 D149【碼】

- 目前範圍：`authorizeHelperQueryTarget`（`electron/remote/helper-capability.ts:480`）：tower 只能看自己的 Worker，worker 只能看自己 + 綁定塔台的 metadata；`terminal:list scope=workspace` 只能由已宣告的 tower 呼叫，把同 `workspaceOf` 的分頁加進來（`terminal-query-handlers.ts:474–482`）。**沒有任何跨工作區的查詢**。
- (a) 要放寬的部分：新增 `scope: 'towers'`，讓已宣告的 tower 列出**同一個 BAT host 上所有工作區**的 tower 分頁（只回 metadata 子集合）。這等於把 D149「範圍權杖只看得到自己的東西」放寬到「看得到其他工作區有哪個 tower」。風險評估【推論】：同一台機器、同一個使用者；而且 ListAgents 本來就讓每個 claude session 看到其他 session 的名稱、cwd、狀態，所以多揭露的只有「哪個分頁是 tower」。建議只回 `id` / `workspaceId` / `workspaceName` / `claudeSessionName` / `state` / `alive`，**不回 sessionId、cwd、輸出**，`read-output` / `wait` 的範圍不變。
- 不放寬、只靠名稱前綴是否足夠：(a) 的名稱是 `<工作區> · <短 ID>`，不含角色，**光看前綴分不出 Tower / Worker / 一般分頁**，所以 (a) 一定要搭配 `scope: 'towers'`（或 (b)）。
- 適用範圍：`scope: 'towers'` 只限同一個 BAT host（同一個 RemoteServer）。另一個 BAT runtime（`BetterAgentTerminal-runtime-<N>`）、遠端 headless、或不在 BAT 裡的塔台都查不到；這些情況只有 (b) 的名稱有效。

#### Q2-4 名稱格式【碼 + 實測】

- 與分頁標題的關係：T0553 Worker 標題是 `<Agent 顯示名> · Worker · T####`（`src/lib/external-terminal-title.ts`），T0562 是 `<Agent> · Tower`（`src/lib/tower-terminal-title.ts`）。session 名稱改用**工作區名稱當前綴**（ListAgents 是跨專案的，Agent 名稱沒有辨識力），分隔字元一樣用 ` · `。兩者是不同的值：分頁標題可以被使用者改，session 名稱是 BAT 啟動時給的。
- 工作區名稱的實際資料（讀 `%APPDATA%\BetterAgentTerminal\windows.json`，唯讀）：19 個工作區裡有**重名**（`better-agent-terminal` ×2、`BMad-Guide` ×2、`2025_CathayCube_V3` ×2，都是不同 id），也有 `.` 開頭的（`.claude`）。⇒ `<工作區> · Tower` 可能撞名；ListAgents 允許同名，但 CT 這時要靠 `[ref]` 或 R3 才分得出來。
- 建議的清理規則：取 `alias ?? name`；移除 C0 / C1 控制字元、把連續空白壓成一個、trim、去掉開頭的 `/`；工作區部分最多 60 字元；整個名稱 ≤ 200 字元（claude 的上限）。**截斷時從工作區部分截**，`T####` / `Tower` 放在結尾所以一定會保留；清理後是空字串就用 `BAT`。
- 未驗證的風險：`·`（U+00B7）與中文工作區名稱經 PTY **用打字的方式**送進 pwsh / cmd / bash 時的編碼。本研究的 harness 是用 argv 直接傳，沒經過 shell；cmd 的 code page 950 可能會變亂碼。實作時要用 e2e 驗三種 shell，失敗就退回 ASCII 分隔字元 ` - `。

---

### Q3 — 方案與推薦

#### R1（Worker）推薦

helper 派工（`createAgentPromptCommandBuilder`，有 `workorder`）的 claude 啟動時帶 `--name "<工作區> · Worker · <T####>"`；工作區 = 派工落點（T0523）。只有實際注入時才記 `claudeSessionName`。

#### R3 推薦

- `claudeSessionName`：BAT 注入的名稱（R1 / R2 都會用到）。
- `claudeSessionId`：由 `SessionStart` hook 回報（`startup` / `resume` / `clear` / `compact` 都會更新），**不用 `--session-id`**（原因見 Q1-5）。
- 兩者都放在 `whoami` / `list` / `get-state`，存進 window registry 的分頁紀錄。

#### R2 三案比較

| | (a) 所有 Claude 分頁啟動即命名 `<ws> · <短 ID>` + R3 + `scope: 'towers'` | (b)「以塔台開啟」，啟動即 `<ws> · Tower` | (c) 使用者 `/rename <ws> · Tower` |
|---|---|---|---|
| 使用者操作 | 無 | 開塔台時改用新的入口（選單 / 按鈕） | 每次開塔台都要手動打 |
| BAT 改動量 | M：命名套用到所有 claude 啟動路徑、R3、新的 list scope、MCP schema、契約 | S–M：一個 UI 入口 + i18n + 命名（共用 R1 的函式） | 0（只要寫文件） |
| 跨專案找塔台 | 可靠，但**只限同一個 BAT host**；CT 要多一步 `bat_list_terminals scope=towers` 才拿得到名稱 | ListAgents 直接看得到，**不限 BAT host**（其他 runtime、非 BAT 的 session 也看得到）；工作區重名時要靠 `[ref]` | 跟 (b) 一樣，但要靠使用者記得做 |
| 與 `--set-role` 的時序 | 不受影響：名稱在啟動時就有，角色之後才由 `--set-role` 宣告，`scope: 'towers'` 用的是當下的角色 | 名稱在 `--set-role` **之前**就決定了：如果使用者從一般分頁開塔台，或之後改了角色，名稱就不對 | 使用者自己控制 |
| 已知限制 | 光看 ListAgents 名稱分不出角色；需要放寬 D149；headless / BAT 重開後 sessionId 可能是 `null`；改到所有 claude 分頁，影響面最大 | 已經在跑的塔台要重開才會套用；⏻ 重啟時角色不持久化，要另外記住這個分頁是用「以塔台開啟」開的；同一工作區開兩個 Tower 會同名 | 使用者忘了就跟現在一樣；BAT 不知道名稱，R3 查不到 |

**推薦 (a)+(b) 並用**，(c) 作為過渡：
1. (b) 解決最常見的情況：使用者明確要開塔台時，ListAgents 直接看得到名稱，跨 BAT host 也有效，CT 不用呼叫 BAT。
2. (a) 補上 (b) 沒蓋到的情況：塔台是從一般分頁開的、或是 BAT 開新版之前就在跑的。所有 claude 分頁至少都有 `<工作區> · <短 ID>`，CT 用 `scope: 'towers'` 就能對應。這也順便解掉 PLAN-050 的實例（Worker 被當成塔台），因為每個分頁的名稱都帶工作區。
3. 如果只能選一個：選 **(a)**。它不需要使用者改變習慣，而且 R3 本來就要做，增加的部分主要是 `scope: 'towers'` 與 D149 放寬的決策。只選 (b) 的話，「從一般分頁開的塔台」這個現況最常見的情況完全沒有解決。
4. 發版前 CT 可以先用 (c)（PLAN-050 原文 §4 的做法）。

另外考慮過、**不推薦**的做法：
- (d) BAT 在 `--set-role tower` 後替使用者在塔台 PTY 打 `/rename`：會跟使用者正在輸入的內容混在一起，而且 claude 忙碌時是否會立即執行也沒有實測。
- (e) hook 的 `sessionTitle`：實測不會改 ListAgents 名稱，而且違反 hook stdout 規則。

#### 介面契約草案（給 CT 依此撰寫；格式比照 T0583 / T0600）

- **C-1 名稱格式**（唯一實作建議放在 `src/lib/claude-session-name.ts` 的 `claudeSessionName(input)`，main / renderer 共用，不 import electron / DOM）：
  - Worker（helper 派工帶 `--workorder`）：`<ws> · Worker · <T####>`（`T####` 依 `WORKORDER_ID_PATTERN`，可帶 `CT-` 等前綴）
  - Tower 啟動（(b)）：`<ws> · Tower`
  - 其他 claude 分頁（(a)）：`<ws> · <短 ID>`，短 ID = terminal id 去掉 `-` 後取前 6 碼小寫
  - `<ws>` = 工作區 `alias ?? name`，清理規則見 Q2-4；空字串用 `BAT`；整個名稱 ≤ 200 字元，從 `<ws>` 截斷
- **C-2 注入**：claude-cli / claude-cli-worktree 啟動時，在 base command 後、自訂參數前加 `--name=<quoted>`（`quoteArgForShell`）；入口是 `buildBatMcpLaunchArgs`，**不受 `batMcpEnabled` 影響**（是否加 Settings 開關由塔台決定）。
- **C-3 降級（不注入，`claudeSessionName: null`，記錄原因）**：
  - 不是 claude 分頁：codex / gemini / 自訂 CLI / raw command（`terminal:create-with-command`）/ Claude Agent SDK 面板
  - 自訂參數含 `--name` / `-n` / 合併短旗標含 `n` → 原因 `user-args`
  - system runtime 版本 `< 2.1.76` 或讀不到版本 → 原因 `claude-too-old` / `version-unknown`（🔴 不得注入，否則 claude 會 exit 1）
  - `2.1.76 <= 版本 < 2.1.239`（Windows）：照常注入（無害），但 ListAgents 沒有這個功能
- **C-4 狀態欄位**：`terminal:whoami` / `terminal:list` 每列 / `terminal:get-state` 多兩個欄位：
  - `claudeSessionName: string | null`
  - `claudeSessionId: string | null`（UUID；`blockedDetection: none` 的分頁、尚未回報、BAT 重開後無紀錄時都是 `null`；🔴 `null` 不代表沒有 session）
  - 結束紀錄（exited）保留最後的值
- **C-5 hook 回報（改 T0600 契約，需要塔台決策）**：`terminal:report-hook { event: 'session-start', sessionId?: string }`。`bat-hook.mjs` 只在 `session-start` 讀 stdin 的 `session_id`，驗證 UUID 格式，不合格就不帶；仍然 exit 0、stdout 不輸出；日誌只記前 8 碼。
- **C-6 跨工作區查塔台（只有 (a) 需要）**：`terminal:list { scope: 'towers' }`，只有已宣告的 tower 可以呼叫（否則 `NOT_OWNER`）。回傳同一個 host 上所有 `role: tower` 的分頁，每列只有 `id` / `workspaceId` / `workspaceName` / `claudeSessionName` / `state` / `alive`；不回 `claudeSessionId` / `cwd`。MCP `bat_list_terminals` 的 `scope` 加 `towers`（仍然 `readOnlyHint: true`）。
- **C-7 (b) 的入口**：「以塔台開啟 Claude」只負責命名，**不代替 `--set-role tower`**（角色仍由 CT 宣告）；⏻ 重啟沿用分頁紀錄裡的 `launchRole: 'tower'`。
- **C-8 持久化**：Electron 把 `claudeSessionName` / `claudeSessionId` / `launchRole` 存進 window registry 的分頁紀錄；Terminal Server 還活著、BAT 重開時從分頁紀錄還原；headless 不持久化。

#### 實作切分建議

| 單 | 內容 | 大小 | 主要檔案 | 驗證 |
|---|---|---|---|---|
| A | C-1 / C-2 / C-3 + R1：命名函式、注入、`user-args` 偵測、system runtime 版本檢查 | M | `src/lib/claude-session-name.ts`（新）、`electron/bat-mcp-launch.ts`、`electron/terminal-command-handlers.ts`、`src/lib/bat-mcp-launch.ts`、`WorkspaceView.tsx`、`electron/main.ts` / `headless-entry.ts`（工作區名稱 dep） | 單元測試（命名 / 截斷 / 清理 / 偵測）；e2e：隔離實例派一個 Worker，檢查 PTY 指令列含 `--name=`；pwsh / cmd / bash 各跑一次，確認 `·` 與中文沒有亂碼（用分頁內的 node 腳本印出 `process.argv`） |
| B | C-4 / C-5 / C-8 + R3：hook 帶 sessionId、tracker、查詢欄位、分頁紀錄、MCP 欄位 | M | `scripts/bat-hook.mjs`、`electron/terminal-blocked-state.ts`、`electron/terminal-query-handlers.ts`、`scripts/bat-mcp.mjs`、window registry | 單元測試；e2e 比照 T0600：claude 分頁 `SessionStart` 之後 `get-state` 拿得到 UUID |
| C | C-6（若選 (a)）：`scope: 'towers'` | S | `terminal-query-handlers.ts`、`helper-capability.ts`、`bat-mcp.mjs` | 範圍測試：worker 被拒、跨工作區只有 tower 列、不回 sessionId |
| D | C-7（若選 (b)）：UI 入口 | S–M | `WorkspaceView.tsx` / 選單、i18n、`workspace-store` | e2e：開塔台分頁後指令列含 `<ws> · Tower` |

人工驗收：兩個工作區各開一個塔台，從另一個 claude session 的 ListAgents 找得到對方（這是 R2 原文的驗收條件，e2e 做不到，需要真人或 AI session 做）。

#### 風險

1. `·` / 中文經 shell 打字輸入的編碼（未驗證，見 Q2-4）。
2. system runtime 版本檢查會讓 claude 分頁啟動多一次 `execFile`（有快取；比照 codex 的做法，延遲應該可以忽略）。
3. 使用者事後 `/rename`，BAT 記的 `claudeSessionName` 就跟實際名稱不一致；只能文件註明「名稱是 BAT 啟動時給的值」。
4. `/clear` 換 sessionId 是推論；B 單 e2e 要驗。
5. D149 放寬（C-6）需要塔台決策。
6. 新的 BAT 版號線（`0.7.0` 已發到 pre.9，D151）由塔台決定。

### 待塔台決策

（R2 選哪一案是**使用者決定**，依工單規則 Worker 不向塔台提問。以下列給塔台下單時參考，不阻擋本研究。）

1. R2 採 (a) / (b) / (a)+(b)（Worker 推薦 (a)+(b)；只能選一個就選 (a)）。
2. C-5 要不要改 T0600 契約，讓 hook 回報 `session_id`。
3. C-6 是否放寬 D149，增加 `scope: 'towers'`。
4. `--name` 注入要不要有 Settings 開關（建議不加、預設啟用，比照 D144）。

### 互動紀錄

無（yolo、`CT_INTERACTIVE=0`；沒有需要問塔台的範圍內問題）。

### 落點檢查（Landing Zone）

- 結果：**PASS**（C-3 不適用）
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 底下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 底下的項目 → `C-3 not applicable`
- C-2：工單沒有 `branch` 欄位，目前分支 `main`
- `CT_HOME` 未設定（不是 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`BAT_REMOTE_TOKEN` 已設定

### 驗證證據分道

- 文件 / 程式碼：Q2 各條附 `檔案:行號` → PASS
- 實測（runtime）：Q1 e1–e10 → PASS（`--continue` / `/clear` / `UserPromptSubmit` 的 `sessionTitle` 未實測，已標示）
- build / tests：研究單，不適用（沒有改產品檔）

### 異動檔案與 commit

- 只改了本工單檔（`git commit --only`）。產品檔 0 個；`src/styles/settings.css` 的 M 不是本單的變更，沒有動。
- 實驗腳本與擷取檔都在 scratchpad（`harness.cjs`、`waitfor.cjs`、`title-hook.cjs`、`title-settings.json`、`e*.out`、`dl/CHANGELOG.md`），沒有寫進 repo。
- 沒有 push。

### 遭遇問題

- e5d 為了讓 transcript 落檔而送了 bash 模式的指令，結果 claude 送出一次模型請求（已中斷，記錄費用 0）。原本以為 bash 模式不會呼叫模型，這個假設不成立。
- 收尾 self-check（v5.7.1）：(a) 沒有 `#### Q-n`，不適用；(b) 沒有殘留的範本佔位文字；(c) `### 互動紀錄` 只有一個。
