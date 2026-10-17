---
schema_version: 1
schema_kind: workorder
id: T0608
title: "PLAN-048 B：Worker 問塔台 — helper（`bat-notify --ask / --wait-answer / --cancel-question`、`bat-terminal --answer`）與唯讀 MCP tool（`bat_list_questions` / `bat_wait_question`）"
type: feature
status: PENDING
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: M
created_at: "2026-10-18T04:50:47+0800"
started_at: ""
updated_at: "2026-10-18T04:50:47+0800"
completed_at: ""
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

### 完成狀態

### 產出摘要

### 文件草稿

### 互動紀錄

### 遭遇問題

### 隔離分支證據

### 回報時間
