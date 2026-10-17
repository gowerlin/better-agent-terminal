---
schema_version: 1
schema_kind: workorder
id: T0608
title: "PLAN-048 B：Worker 問塔台 — helper（`bat-notify --ask / --wait-answer / --cancel-question`、`bat-terminal --answer`）與唯讀 MCP tool（`bat_list_questions` / `bat_wait_question`）"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: M
created_at: "2026-10-18T04:50:47+0800"
started_at: "2026-10-18T04:51:24+0800"
updated_at: "2026-10-18T05:17:42+0800"
completed_at: "2026-10-18T05:17:42+0800"
isolation: worktree
depends_on: [T0606]
related:
  - "T0606 回報區「介面契約草案」C-1–C-11 = 本單介面契約（D156 全部採用推薦；CT-T019 依此撰寫，不得單方更改）；「實作切分」B 節 = 本單範圍"
  - "D155 / D156；並行工單 T0607（A：主行程 store + channel，主 checkout）"
affects_files:
  - scripts/bat-notify.mjs
  - scripts/bat-terminal.mjs
  - scripts/bat-mcp.mjs
  - "scripts/__tests__/**"
  - docs/agent-guide/bat-mcp-shim.md
  - _ct-workorders/T0608-tower-questions-helper-mcp.md
renew_count: 0
workdir: "BAT 隔離 worktree（`CT_WORKTREE`）"
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 隔離派工：依 `ct-exec` § Worktree Isolation。產品變更在 worktree（`CT_WORKTREE`）裡改並 commit 到 `ct/T0608`；本工單檔一律在主 checkout（`CT_HOME`）修改；worktree 裡的 `_ct-workorders/` 不得修改、不得 stage。不得在主 checkout commit 產品檔、不得切換主 checkout 的分支；不 merge 回 main（塔台另派合併）。"
  - "🔴 依賴由你安裝（D152）：在 worktree 執行 `npm ci`。所有 build / typecheck / test 都在 worktree 跑。"
  - "🔴 契約 = T0606 回報區「介面契約草案」C-5、C-6、C-11（以及 C-1–C-3 的 channel 參數 / 回傳格式），D156 已全部採用推薦。必須照寫；發現不可行或需改名，停下以 `T0608 提問` 問塔台，不得自行改契約。主行程的 channel 由 T0607 並行實作，本單以假 RemoteServer 測試。"
  - "🔴 內容不落地（D155）：問題 / 答案**只從 stdin 讀**，不得出現在 argv、bat-scripts.log、helper 日誌或 stdout 摘要以外的地方；日誌只記 id / 長度 / 選項數 / 結果（測試要斷言 argv 與日誌不含內容）。BAT MCP 的 annotation 維持全部 `readOnlyHint: true`，不新增任何寫入 tool。"
  - "🔴 並行：T0607 在主 checkout 改 `electron/**`、CLAUDE.md、`docs/agent-guide/` 的 tower-questions / blocked-state / helper-query-channels / remote-tower-notify / README。本單只改 `affects_files` 列的檔；CLAUDE.md 不改，要補進 CLAUDE.md 與 `tower-questions.md` 的 helper / MCP 文字寫在回報區「文件草稿」，由收尾單併入。"
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；含反斜線的內容用 Write / Edit 工具（L129）。不碰使用者正在用的 BAT（port 9876）；不得對 claude / codex 送出任何 prompt。"
---

# T0608 — PLAN-048 B：helper 與唯讀 MCP tool

## 背景

PLAN-048（D155 / D156）。T0606 已寫定介面契約；本單是 B（helper + MCP shim），與 A（T0607，主行程）並行，C（e2e）待合併後再派。

## 任務

1. 依 T0606 契約 C-5 實作 helper：
   - `bat-notify.mjs --ask --source T#### --target <tower> [--submit] [--expires-min <1-120>] "<訊息>" < question.json`：`question:ask` 成功後走現有 notify 流程；notify 任一步失敗 → `question:cancel` → exit 1；stdout / stderr / exit code 照契約（含 `10` TOO_MANY_QUESTIONS）。
   - `bat-notify.mjs --wait-answer <id> [--timeout-ms <0-45000>]`（stdout 最後一行一行 JSON）、`--cancel-question <id>`。
   - `bat-terminal.mjs --answer <id> --notify-id <tower> [--choice <n>] < answer.txt`（exit `0` / `3`（含 `answer: LOST`）/ `4` / `9` CLOSED / `1`）。
   - stdin UTF-8、上限 64 KiB；舊 host（`No handler for channel` / `Forbidden: channel-not-allowed`）→ `UNSUPPORTED`；回應以 frame id 比對（BUG-114）。
2. 依 C-6 在 `scripts/bat-mcp.mjs` 加 `bat_list_questions` / `bat_wait_question`（annotation `READ_ONLY`，`bat_wait_question` `idempotentHint: false`、invoke 逾時 55 s 同 `bat_wait`）、`summarize`、`instructions` 補「and tower questions」；舊 BAT → `UNSUPPORTED`。
3. 測試：T0606「實作切分」B 節列的全部（假 RemoteServer，`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指到 temp）；跑 `npm run verify:helpers` 一次。
4. 文件：`docs/agent-guide/bat-mcp-shim.md` 的 tool 表加兩列；CLAUDE.md 與 `docs/agent-guide/tower-questions.md` 的 helper / MCP 段落寫成「文件草稿」貼在回報區。

## 驗收條件

1. 在 worktree：`npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠（回報 passed / files 數）；`npm run verify:helpers` 通過。
2. 回報區附：每個 helper 指令的 stdout / exit 範例、MCP `tools/list` 摘錄（證明全部 `readOnlyHint: true`）、argv / 日誌不含內容的測試名稱、文件草稿、與契約的差異（若有，必須是已問過塔台的）、隔離分支證據。

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

無（沒有提問；契約 C-5 / C-6 / C-11 照寫，沒有需要改名或不可行之處）。

### 完成狀態

**DONE**：任務 1–4 全部完成，驗收條件 1–2 全部達成。

落點檢查：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`；`basename "$CT_HOME"` = `better-agent-terminal` → PASS（`CT_HOME` = `D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\better-agent-terminal`；`REPO_ROOT` = worktree `…\.bat-worktrees\better-agent-terminal\T0608`）
- C-1：工單在 `$CT_HOME/_ct-workorders/` → PASS
- C-3：`scripts/bat-notify.mjs`、`scripts/bat-terminal.mjs`、`scripts/bat-mcp.mjs`、`docs/agent-guide/bat-mcp-shim.md` 在 worktree 皆存在（`scripts/__tests__/**` 含萬用字元排除）→ PASS
- C-2：工單沒有 `branch` 欄位；worktree 分支 `ct/T0608`（= `CT_WORKTREE_BRANCH`）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 依賴：worktree 內 `npm ci`（exit 0）

驗收閘門（全部在 worktree、於 `validated_sha` = `2e7740b0` 執行）：

| 閘門 | 結果 |
|---|---|
| `npx vite build` | PASS（exit 0） |
| `npm run typecheck` | PASS（0） |
| `npm run typecheck:electron` | PASS（0） |
| `npm run test:unit` | PASS：**295 files passed / 5152 passed / 3 skipped**（5155） |
| `npm run verify:helpers` | PASS（`all 18 helper .mjs files … reachable`；沒有新增 `_bat-*.mjs`） |
| 本單新增 / 修改的測試 | `bat-notify-questions.test.mjs` 19、`bat-terminal-answer.test.mjs` 7、`bat-mcp.test.mjs` 34（原 27 + 7）全過 |

穩定性：第一版測試每個假 server 都重產 2048-bit RSA 憑證，全跑時 3 次有 2 次讓**無關的真 git 測試**（`worktree-status-after-close.test.ts`、`ct-worktree-status.test.ts`）超過 5 s 逾時；排除新測試連跑 2 次全綠 → 判定是本單測試的 CPU 負載。改成每個測試程序只產生一次憑證（`2e7740b0`）後全跑連續 4 次全綠（含最終驗收那次）。

### 產出摘要

**變更檔案**（`git diff --stat a28c7f0b..2e7740b0`，全部在 `affects_files` 內）：`scripts/bat-notify.mjs`（+444）、`scripts/bat-terminal.mjs`（+241）、`scripts/bat-mcp.mjs`（+70）、`scripts/__tests__/_question-mock-remote.mjs`（新，假 RemoteServer 共用模組，非測試檔）、`scripts/__tests__/bat-notify-questions.test.mjs`（新）、`scripts/__tests__/bat-terminal-answer.test.mjs`（新）、`scripts/__tests__/bat-mcp.test.mjs`、`docs/agent-guide/bat-mcp-shim.md`。

**helper 指令的 stdout / exit 範例**（以假 RemoteServer 實跑，`bat-notify` 的 `[bat-notify]` 說明行在 stderr）：

```
$ bat-notify.mjs --ask --source T0608 --submit --expires-min 30 "T0608 提問" < question.json
✓ Notified tower-1…: T0608 提問
  question: q-0123abcd-0123456789abcdef
  expires: 2026-10-18T05:30:00.000Z
  notified: yes
(exit 0；invoke 順序 question:ask → terminal:notify → pty:write → terminal:keypress)

$ … --ask "T0608 提問" < question.json        # terminal:notify 失敗
stderr: Error: UI notify failed: Forbidden: target-not-bound
        [bat-notify] The Tower was not notified; question q-0123abcd-0123456789abcdef was cancelled.
        ask: NOTIFY_FAILED                      (exit 1；之後送了 question:cancel { questionId })
… NOT_FOUND → stderr "ask: NOT_FOUND" exit 3；TOO_MANY_QUESTIONS → "ask: TOO_MANY_QUESTIONS" exit 10
… 舊 host（Forbidden: channel-not-allowed / No handler for channel）→ "Error: Question not asked (UNSUPPORTED): this BAT does not support questions for the Tower (update BAT); no question was registered" + "ask: UNSUPPORTED" exit 1（沒有任何 notify）
… stdin 不是 JSON → "Error: stdin is not valid JSON" + "ask: INVALID_INPUT" exit 1（不連線、不回顯輸入）

$ bat-notify.mjs --wait-answer q-0123abcd-0123456789abcdef
{"questionId":"q-0123abcd-0123456789abcdef","changed":true,"status":"answered","answer":{"choice":1,"text":"改，理由：相容"},"answeredAt":1760763600000,"waitedMs":1200}
(exit 0)
{"questionId":"q-…","changed":false,"status":"pending","waitedMs":45000}   (exit 0，逾時)
{"questionId":"q-…","changed":true,"status":"lost","waitedMs":0}          (exit 0)
NOT_OWNER → stderr "wait-answer: NOT_OWNER" exit 4；NOT_FOUND → exit 3

$ bat-notify.mjs --cancel-question q-0123abcd-0123456789abcdef
✓ Question cancelled: q-0123abcd-0123456789abcdef
  status: cancelled worker                      (exit 0)

$ bat-terminal.mjs --answer q-0123abcd-0123456789abcdef --notify-id tower-1 --choice 1 < answer.txt
✓ Question answered: q-0123abcd-0123456789abcdef
  answered: q-0123abcd-0123456789abcdef         (exit 0)
CLOSED → stdout "  status: expired not-polled"，stderr "answer: CLOSED" exit 9
lost   → stderr "answer: LOST" exit 3；NOT_OWNER → "answer: NOT_OWNER" exit 4
舊 host → "Error: This BAT does not support --answer (update BAT)" + "answer: UNSUPPORTED" exit 1
```

**MCP `tools/list` 摘錄**（真 shim 程序 stdio，`annotations`）：

```
bat_whoami           {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false}
bat_list_terminals   {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false}
bat_get_state        {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false}
bat_read_output      {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false}
bat_wait             {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":false,"openWorldHint":false}
bat_worktree_status  {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false}
bat_list_questions   {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false}
bat_wait_question    {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":false,"openWorldHint":false}
```
（各列另有 `title`；8 個 tool 全部 `readOnlyHint: true`，沒有對應 `question:ask` / `cancel` / `answer` 的 tool，`bat-mcp.test.mjs`「lists the eight contract tools, all read-only」斷言。）

**argv / 日誌不含內容（D155）的測試**：
- `bat-notify-questions.test.mjs`「D155: question / options / detail text never reach argv, bat-scripts.log or stdout」（另斷言內容確實經 socket 到達 `question:ask`、`invoke` 事件的 argv 逐字等於命令列）
- `bat-notify-questions.test.mjs`「answered: stdout last line is the reply … the log has no answer text」
- `bat-notify-questions.test.mjs`「bad stdin → exit 1, ask: INVALID_INPUT, no connection, the input never echoed」（`JSON.parse` 的錯誤訊息會引用輸入，helper 不印、不記）
- `bat-terminal-answer.test.mjs`「D155: the answer text never reaches argv or bat-scripts.log」
- `bat-mcp.test.mjs`「the audit line never carries question or answer text」

**其他測試涵蓋**：notify 三步各自失敗 → `question:cancel`；取消也失敗；exit code 對照表（ask 3 / 10 / 1、wait 0 / 3 / 4 / 1、cancel 0 / 3 LOST / 4、answer 0 / 3 / 3 LOST / 4 / 9 / 1）；舊 host 兩種錯誤字串 → `UNSUPPORTED`；frame id 比對（假 server 持續廣播 `pty:output`，且每個回應前先送一個 id 不同的 `invoke-result`）；UTF-8 BOM 去掉、中文完整到達；stdin 超過 64 KiB / 非 UTF-8 / 空 / 不是物件 / 沒有 `question`；`--answer` 缺 `--notify-id` / `--choice` 單獨 / 與其他模式並用 / 沒有東西可送；`--timeout-ms` 截到 45000；`--help` 文字。

**與契約的差異**：channel 名稱、參數、回傳、exit code 全部照 C-3 / C-5 / C-6 / C-11，**沒有改契約**。以下是契約沒寫死、由本單補的細節（未問塔台，因都不影響 CT 依 exit code / 一行 JSON 判斷）：
1. stdout 第一行沿用各 helper 既有的 `✓ …` 摘要行（`✓ Notified …` / `✓ Question answered: …` / `✓ Question cancelled: …`），之後才是契約的兩空白結果行；`[bat-notify]` / `[bat-terminal]` 前綴照舊只用在 stderr 說明行。`--wait-answer` 的 stdout 只有那一行 JSON。
2. `--ask` 下 `terminal:notify` 回錯也算「notify 失敗」→ 取消（一般 notify 照舊只警告）；回應逾時同樣算失敗。
3. `--timeout-ms` 超過 45000 截成 45000 並在 stderr 說明（比照 `--wait-started`），不是用法錯誤。
4. `--cancel-question` 對 `lost`（`NOT_FOUND` + `status: lost`）另印 `cancel-question: LOST`（exit 仍是 3，比照 `--answer`）。
5. stdin：終端機（沒有重導）= 空；10 s 不結束 = 錯誤（`INVALID_INPUT`）；stdin JSON 只轉送 `question` / `options` / `allowFreeText` / `detail` / `blocking` / `expiresInMs`，`--expires-min` 優先；`--answer` 去掉結尾換行、空白 = 不送 `text`。
6. MCP 摘要：`status: all` 且有已結束的題目時寫 `N questions: <id> (T####, <status>, …)`；`bat_wait_question` 在 `status` 後附 `(<endReason>)`、`pending` 逾時附 `(timed out; call again)`。`structuredContent` 不變。
7. `bat_get_state` 的 description 補上 `blockedReason: tower` 與 `pendingQuestions`（依 C-7；只改說明文字，給 agent 看）。

### 文件草稿

> 依 memory_overrides：CLAUDE.md 與 `docs/agent-guide/tower-questions.md` 不在本單改，以下草稿由收尾單併入。`docs/agent-guide/bat-mcp-shim.md` 已在本單改（tool 表兩列 + 唯讀說明 + 驗證行）。

**(1) CLAUDE.md「## Worker 問塔台（PLAN-048 / T0607 / T0608）」節的 helper / MCP 部分**（與 T0607 的主行程部分合併成一節，3–12 行）：

```markdown
- helper（唯一實作 `scripts/bat-notify.mjs` `--ask` / `--wait-answer` / `--cancel-question`、`scripts/bat-terminal.mjs` `--answer`；契約 T0606 C-5，CT-T019 依此撰寫，不得單方更改）：
  Worker `bat-notify.mjs --ask --source T#### --target "$BAT_TOWER_TERMINAL_ID" [--submit] [--expires-min <1-120>] "T#### 提問" < question.json`（exit `0` / `3` NOT_FOUND / `10` TOO_MANY_QUESTIONS / `1`；notify 任一步失敗 → helper 送 `question:cancel` 再 exit 1，stderr `ask: NOTIFY_FAILED`）；
  `--wait-answer <id> [--timeout-ms ≤45000]`（stdout 最後一行一行 JSON，任何狀態含 `pending` / `lost` 都 exit 0；`3` / `4` / `1`）；塔台 `bat-terminal.mjs --answer <id> --notify-id "$BAT_TERMINAL_ID" [--choice <n>] < answer.txt`（`0` / `3`（含 `answer: LOST`）/ `4` / `9` CLOSED / `1`）。
- 🔴 問題 / 答案內容**只從 stdin 讀**（UTF-8、≤ 64 KiB、BOM 去掉；stdin 10 s 不結束 = 錯誤）：helper 啟動時把完整 argv 寫進 `bat-scripts.log`，內容不得進 argv；helper 日誌只記 id / 長度 / 選項數 / choice / 結果（`scripts/__tests__/bat-notify-questions.test.mjs`、`bat-terminal-answer.test.mjs` 斷言）。
- BAT MCP 新增唯讀 `bat_list_questions`（`question:list`）/ `bat_wait_question`（`question:wait`，invoke 逾時 55 s，`idempotentHint: false`）；🔴 不得新增問答寫入 tool（D155 / D156），所有 tool 維持 `readOnlyHint: true`（`bat-mcp.test.mjs` 斷言）。
- 完整契約與範例：[docs/agent-guide/tower-questions.md](docs/agent-guide/tower-questions.md)
```

**(2) `docs/agent-guide/tower-questions.md` 的「helper 與 MCP」節**：

```markdown
## helper（T0608，契約 T0606 C-5）

共通：問題與答案只從 stdin 讀（UTF-8，上限 65 536 bytes；UTF-8 BOM 去掉；不是 UTF-8 → 拒絕，不轉成 U+FFFD）。stdin 是終端機（沒有重導）視為空；stdin 10 s 內沒有結束 → 錯誤（避免掛住）。理由：`bat-notify.mjs` / `bat-terminal.mjs` 啟動時把 argv 原樣寫進 `bat-scripts.log`（T0192），命令列也會出現在程序列表與 agent 的工具紀錄。Windows PowerShell 5.1 的管線預設不是 UTF-8，請用 pwsh 7 或 Git Bash heredoc。回應一律以 frame id 比對（BUG-114）。舊 host（`No handler for channel` / `Forbidden: channel-not-allowed`）→ `UNSUPPORTED`；其他 `Forbidden: …` → `FORBIDDEN`。每個非 0 結束在 stderr 印一行 `<mode>: <CODE>`（`ask` / `wait-answer` / `cancel-question` / `answer`）。

### Worker 提問 `bat-notify.mjs --ask`

    "${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --ask --source T#### --target "$BAT_TOWER_TERMINAL_ID" [--submit] [--expires-min <1-120>] "T#### 提問" < question.json

- stdin JSON：`{ "question", "options"?, "allowFreeText"?, "detail"?, "blocking"?, "expiresInMs"? }`，只轉送這些鍵（其他鍵丟掉）；`--expires-min n` → `expiresInMs = n × 60 000`（優先於 JSON）。helper 只檢查「是物件、`question` 是非空字串」，其餘由 BAT 驗證（`INVALID_ARGS`）。
- 流程：`question:ask` → `terminal:notify` → `pty:write`（預填）→ `--submit` 時 `terminal:keypress`。三步任一失敗（含逾時、`--ask` 下 `terminal:notify` 錯誤也算失敗，與一般 notify 只警告不同）→ `question:cancel { questionId }` → exit 1（stderr `ask: NOTIFY_FAILED`；取消也失敗時印出到期時間）。
- stdout（成功）：
      ✓ Notified 5f679fbf…: T0608 提問
        question: q-0123abcd-0123456789abcdef
        expires: 2026-10-18T05:30:00.000Z
        notified: yes
- exit：`0` / `3` NOT_FOUND / `10` TOO_MANY_QUESTIONS / `1`（`USAGE`、`INVALID_INPUT`、`NOT_IN_BAT`、`CONNECT_FAILED`、`AUTH_FAILED`、`TIMEOUT`、`UNSUPPORTED`、`FORBIDDEN`、`INVALID_ARGS`、`NOTIFY_FAILED`）。
- 已知限制：`question:ask` 逾時（3 s 沒有回應）時 helper 不知道 id、無法取消；BAT 若已登記，該題由租約（blocking 120 s）或 `expiresAt` 結束。

### Worker 等答覆 `--wait-answer`（備援；主路徑 MCP `bat_wait_question`）

    "${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --wait-answer <questionId> [--timeout-ms <0-45000>]

- `--timeout-ms` 超過 45 000 截成 45 000（stderr 一行說明）；不帶 = 不送，BAT 預設 45 s。invoke 逾時 = 等待時間 + 5 s。
- stdout 只有一行 JSON（`question:wait` 回傳去掉 `ok`），例：`{"questionId":"q-…","changed":true,"status":"answered","answer":{"choice":1,"text":"…"},"answeredAt":…,"waitedMs":1200}`；`{"changed":false,"status":"pending",…}` = 逾時，再呼叫。
- exit：`0`（任何狀態，含 `pending`、`lost`）/ `3` NOT_FOUND / `4` NOT_OWNER / `1`（含 `TOO_MANY_WAITS`、連線失敗、`UNSUPPORTED`）。日誌只記狀態、choice 與答覆長度。

### Worker 取消 `--cancel-question <id>`

- stdout `✓ Question cancelled: <id>`（或 `✓ Question already ended: <id>`）+ `  status: <status> [<endReason>]`；exit `0` / `3`（`lost` → stderr `cancel-question: LOST`）/ `4` / `1`。

### 塔台答覆 `bat-terminal.mjs --answer`

    "${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --answer <questionId> --notify-id "$BAT_TERMINAL_ID" [--choice <n>] < answer.txt

- 送 `question:answer { towerId: --notify-id, questionId, choice?, text? }`；stdin 去掉結尾換行，空白 = 不送 `text`（此時必須有 `--choice`，否則 `answer: USAGE`）。不能與其他模式或建立分頁的參數並用。
- stdout：`✓ Question answered: <id>` + `  answered: <id>`；`CLOSED` 時 `  status: <answered|cancelled|expired> [<endReason>]`。
- exit：`0` / `3` NOT_FOUND（`lost` → stderr `answer: LOST`）/ `4` NOT_OWNER / `9` CLOSED / `1`（`USAGE`、`INVALID_INPUT`、`INVALID_ARGS`、`FORBIDDEN`（例 `tower-not-bound`：`--notify-id` 不是自己）、`UNSUPPORTED`、連線失敗）。
- BAT 不對 Worker 分頁寫任何東西；Worker 以 `bat_wait_question` / `--wait-answer` 收到。

## 唯讀 MCP tool（T0608，契約 T0606 C-6）

| tool | channel | 參數 | invoke 逾時 |
|---|---|---|---|
| `bat_list_questions` | `question:list` | `terminalId?`、`status?: pending\|all` | 3 s |
| `bat_wait_question` | `question:wait` | `questionId`（必填）、`timeoutMs?`（≤ 45 000） | 55 s（`idempotentHint: false`） |

- 全部 `readOnlyHint: true`；寫入沒有 MCP tool。`instructions`：「Read-only queries about BAT terminals and tower questions: …」。舊 BAT → `UNSUPPORTED`（同一 shim 程序內記住，不再送）。
- 摘要：`N pending questions: <id> (T####, <前 60 字>)`（`status: all` 且有已結束者 → `N questions: <id> (T####, <status>, <前 60 字>)`）；`status=<s>[ (<endReason>)] after <ms> ms`，`answered` 另起行附 `choice: <n>` 與答覆全文，`pending` 逾時附 `(timed out; call again)`。`structuredContent` 是 channel 回傳去掉 `ok`（含全文）。
- 稽核：每次 tools/call 一行（tool / ok / code / 耗時），不記問題、答案、問題 id。

## 驗證（helper / MCP）

- `scripts/__tests__/bat-notify-questions.test.mjs`、`scripts/__tests__/bat-terminal-answer.test.mjs`（假 RemoteServer，持續廣播 + 錯 id 的回應，`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指 temp）、`scripts/__tests__/bat-mcp.test.mjs`（八個 tool、全唯讀、沒有寫入 channel、摘要、instructions）。
```

**(3) CLAUDE.md「BAT MCP shim」節補一行**（收尾單）：`T0608 起 8 個 tool（+ bat_list_questions / bat_wait_question），全部唯讀；問答寫入只走 helper。`

### 互動紀錄

無（yolo、`CT_INTERACTIVE=0`；沒有向塔台或使用者提問）。

### 遭遇問題

- 🔴 **合併後會壞的 e2e 斷言（不在本單 `affects_files`，未改）**：`e2e/t0584-bat-mcp-shim.spec.ts:213` 與 `e2e/t0592-codex-tower-worker.spec.ts:371` 逐字比對「六個 tool」清單，本單合併後應改為八個（加 `bat_list_questions`、`bat_wait_question`）。建議由合併單或 C（e2e）單一併修改；unit 閘門不跑 e2e，所以本單驗收看不到。
- 全跑 unit 時的負載問題已在本單修正（見「完成狀態」穩定性段）。
- 已知限制（寫進文件草稿）：`question:ask` 3 s 沒有回應時 helper 不知道問題 id、無法取消；若 BAT 已登記，該題由租約（blocking 120 s）或 `expiresAt` 結束。
- 本單只以假 RemoteServer 驗證；與 T0607 真 channel 的整合（含 `blocked` / `tower`、`pendingQuestions`）待合併後由 C（e2e）驗證。
- 未啟動任何 BAT 實例、未碰 port 9876、未對 claude / codex 送 prompt。開發初期有一次 `node scripts/bat-notify.mjs --ask --wait-answer x` 的用法錯誤手動測試沒有指定 `BAT_HELPER_LOG_DIR`，在使用者的 `bat-scripts.log` 留下一筆 `invoke`（argv 只有 `--ask --wait-answer x`，無內容）；之後的手動執行都把日誌導到 temp。
- 未 push、未建 tag、未改版號；未使用 `git stash` / `reset` / `checkout -- <path>` / `restore`；CLAUDE.md 未改；worktree 的 `_ct-workorders/` 未改、未 stage。

### 隔離分支證據

- `branch`: `ct/T0608`
- `base_sha`: `a28c7f0bf3bd1d201811edacbb6a3367cd503392`
- `validated_sha`: `2e7740b0d0af3808facc973c544d4ded0eb3dff9`
- `head_sha`: `2e7740b0d0af3808facc973c544d4ded0eb3dff9`（= `validated_sha`）
- 產品 commit（`ct/T0608`）：`d307e87e` feat（helper / MCP / 測試 / docs）、`19edb0f8` fix（UNSUPPORTED 訊息只印一次）、`2e7740b0` test（假 server 憑證每程序只產生一次）
- `git -C "$CT_WORKTREE" status --porcelain`：空
- `CT_HOME` = `D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\better-agent-terminal`；`CT_WORKTREE` = `D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\.bat-worktrees\better-agent-terminal\T0608`
- 合併判斷：`ct/T0608` 只改 `scripts/**` 與 `docs/agent-guide/bat-mcp-shim.md`；T0607 宣告的檔案（`electron/**`、CLAUDE.md、其他 docs）本單都沒碰

### 回報時間

2026-10-18T05:17:42+0800
