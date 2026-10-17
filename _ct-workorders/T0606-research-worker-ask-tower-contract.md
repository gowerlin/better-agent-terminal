---
schema_version: 1
schema_kind: workorder
id: T0606
title: "研究：PLAN-048 Worker 問塔台 / 塔台答覆通道 — 現況盤點、介面契約草案、實作切分（D155）"
type: research
status: PENDING
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: M
created_at: "2026-10-18T04:36:18+0800"
started_at: ""
updated_at: "2026-10-18T04:36:18+0800"
completed_at: ""
depends_on: []
related:
  - "PLAN-048（BMad-Guide D036 需求摘要）；D155（本單的設計前提，使用者 2026-10-18 選定）"
  - "CLAUDE.md「遠端 Tower 通知（PLAN-036 K）」「helper 唯讀查詢 channel（T0582）」「BAT MCP shim（T0584）」「blocked 狀態偵測（T0590）」「Worker 啟動確認（T0600）」「Worker 分頁回收（PLAN-041）」小節與對應 docs/agent-guide/*.md"
  - "CT v5.5.0 現行做法：yolo Worker 把問題寫進工單（`T#### 提問`）→ notify 塔台 → 原地等；塔台寫回答覆（control-tower `references/yolo-mode.md` § Worker 向塔台提問，本機 `~/.claude/skills/control-tower/`，只讀）"
affects_files:
  - _ct-workorders/T0606-research-worker-ask-tower-contract.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：**不改任何產品程式碼、測試、CLAUDE.md、docs、package.json**；唯一可寫入並 commit 的檔案是本工單（`git commit --only <本檔>`）。原型或實驗檔一律放 repo 外暫存目錄，結束後刪除，只把關鍵片段貼進回報區。"
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；含反斜線的內容用 Write 工具（L129）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）；需要 BAT 時用隔離實例（先 `npx vite build`）。不得對 claude / codex 送出任何 prompt（不耗額度）。不得修改 `~/.claude/skills/**` / `~/.codex/skills/**`（只讀）。"
  - "🔴 外部查證（claude / codex 的 MCP tool 逾時等）以官方文件或 CLI 二進位字串為準，附 URL + 取用日期或二進位版本；查不到寫「未證實」。"
  - "🔴 D155 的四項前提是使用者決定，契約草案必須依它寫；認為某項不可行時，在「待塔台 / 使用者決定」列出理由與替代案，不得自行改掉。"
---

# T0606 — 研究：Worker 問塔台 / 塔台答覆通道

## 背景

BMad-Guide（D036）要求 yolo Worker 能以結構化通道問塔台、等答覆，取代目前「寫工單檔 → notify → 讀檔等待」的做法（見 PLAN-048）。本單只做研究與契約草案，實作另開單。

## 設計前提（D155，使用者 2026-10-18 選定，不得更改）

1. **先研究再實作**：本單產出介面契約草案，塔台 / 使用者審過後才開實作單，並轉交 CT（CT-T019）。
2. **答覆走 helper CLI**：塔台以 `bat-terminal.mjs --answer <問題 id> …`（名稱可提案）回答；待答問題以 **唯讀** MCP tool 讀取。BAT MCP 維持全唯讀以外的寫入一律走 helper（比照 `--close-worker`）。Worker 端「提問」本身是寫入，請評估它走 MCP tool（例 `bat_ask_tower`）是否違反「MCP 唯讀」原則，以及改走 helper（例 `bat-notify.mjs --ask`）的取捨，給推薦。
3. **只存記憶體**：BAT 重開 / Terminal Server recovery 後待答問題消失，Worker 收到明確的「已遺失」結果，CT 改走工單檔往返；問答內容不寫入磁碟（日誌也不記內容）。
4. **`blocked` 新增原因 `tower`**：Worker 等塔台答覆時 `state: blocked`、`blockedReason: tower`；擴充 T0590 契約。注意此狀態由 BAT 自己知道（不靠 claude hook），評估 codex 分頁（`blockedDetection: none`）是否也能回報。

等待方式（塔台預設，可提案修正）：Worker 端單次最多等 45 s（同 `terminal:wait`），未答回「pending」由 Worker 再呼叫；須落在 claude / codex 的 MCP tool 逾時之內（codex 目前注入 `tool_timeout_sec=60`）。

## 調查範圍

### R1 現況盤點（指出唯一實作位置與要擴充的點）
- 範圍權杖與角色：`HELPER_CHANNEL_ROLES`、`authorizeHelperInvoke`、`authorizeHelperQueryTarget`（`electron/remote/helper-capability.ts`）；worker → 塔台現有 notify / `pty:write` / keypress 路徑。
- 查詢 channel 與 shim：`electron/terminal-query-handlers.ts`、`scripts/bat-mcp.mjs`（tool 清單、逾時、錯誤格式）；`terminal:wait` 的上限與並行限制。
- blocked：`TerminalBlockedTracker`（`electron/terminal-blocked-state.ts`）的優先序、清除規則、PTY 結束 / restart / recovery 的清理。
- 本機與 headless 共用的接線方式（新 channel 要怎麼同時進兩邊）。

### R2 外部查證
- claude CLI（內嵌 2.1.300 / 系統 2.1.302）MCP tool 呼叫的逾時與長時間 tool 的行為（`MCP_TOOL_TIMEOUT` 等）；codex 的 `tool_timeout_sec` 預設與上限。決定單次等待上限是否 45 s 可行。

### R3 介面契約草案（比照 T0585 / T0600「介面契約」寫法：參數、回傳、exit code、日誌、版本判定）
- Worker 提問：入口（MCP 或 helper，依前提 2 推薦）、參數（問題、選項、可否自由回答）、回傳狀態（`answered` / `pending` / `lost` / `cancelled` / 其他）、問題 id、再等待的方式。
- 塔台讀取：唯讀 MCP tool（或擴充 `bat_get_state` / `bat_list_terminals`）列出自己 Worker 的待答問題。
- 塔台答覆：helper 參數、exit code（沿用 `0` / `3` NOT_FOUND / `4` NOT_OWNER / `1` 等慣例）、重複答覆與已過期的處理。
- 塔台如何得知有新問題：沿用 Worker → 塔台 notify（預填 / yolo `--submit`）或其他，給推薦。
- `blocked` / `tower`：進入、清除（答覆、取消、Worker 輸入、PTY 結束）、與其他 reason 的優先序；`terminal:wait` 是否需新 `until`。
- 生命週期與限制：每個 Worker 同時待答數、問題 / 答案長度、整體過期時間、Worker / 塔台分頁結束時的處理、遠端 headless 行為。
- 安全：權限列（worker 只能問綁定的塔台、塔台只能答自己派出的 Worker）、遮罩（`redactTerminalSecrets`）、日誌只記 id / 長度 / 結果。
- 舊 BAT 判定：CT 怎麼知道 BAT 不支援（MCP tool 不存在、helper `Unknown option`），降級到工單檔往返。

### R4 實作切分與驗證計畫
- 建議切成幾張實作單（可並行與否、`affects_files` 粗估）、需要的 unit / e2e 測試、CLAUDE.md 與 docs 要新增的小節。
- 列出要轉交 CT（CT-T019）的契約項目，以及 CT 端要改的流程（`yolo-mode.md` § Worker 向塔台提問、斷點 D 對 `tower` 的處理）。

## 驗收

- 回報區依 R1–R4 回答，每項結論標「程式碼位置」/「官方文件」/「二進位字串」/「推論」。
- 契約草案是可以直接貼進實作工單的完整版本。
- 「待塔台 / 使用者決定」列出所有需要再決定的點，每點附推薦。
- 只 commit 本工單檔。

---

## 回報區

### 完成狀態

### 互動紀錄

### 調查結論

### 介面契約草案

### 實作切分與驗證計畫

### 待塔台 / 使用者決定

### 遭遇問題

### 回報時間
