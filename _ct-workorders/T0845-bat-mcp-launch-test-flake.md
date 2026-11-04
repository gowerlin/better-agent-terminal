---
schema_version: 1
schema_kind: workorder
id: T0845
title: "修測試偶發失敗：bat-mcp-launch.test.ts 的「設定檔不含權杖」斷言被暫存目錄的隨機後綴（例 `17ENVT`）誤判"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-04T13:23:28+0800"
started_at: ""
updated_at: "2026-11-04T13:23:28+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "T0844 回報區〈發現的問題〉1；T0584（BAT MCP shim）；T0767（該測試檔最後改動 `5d104926`）；D275"
affects_files:
  - _ct-workorders/T0845-bat-mcp-launch-test-flake.md
  - electron/__tests__/bat-mcp-launch.test.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改這個測試檔，不改產品碼。斷言的意圖不得變弱：寫進 `--mcp-config` 檔的內容不得含任何 env 區塊、權杖值或 `BAT_REMOTE_*`（CLAUDE.md「BAT MCP shim」：權杖值不得出現在命令列與設定檔）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0845 — bat-mcp-launch 測試偶發失敗

## 元資料
- **工單編號**：T0845｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 13:23 (UTC+8)
- **規模**：S

## 現象（T0844）
`electron/__tests__/bat-mcp-launch.test.ts` 約第 87 行 `expect(content).not.toMatch(/env|token|BAT_REMOTE/i)`。設定檔的 `args` 含暫存目錄路徑（第 48 行 `fs.mkdtempSync(path.join(os.tmpdir(), 't0584-launch-'))`），隨機後綴碰巧是 `17ENVT` 時被 `/env/i` 比到而失敗；內容本身正確。發版 CI 的 tests job 碰到就會擋發版。

## 任務
1. 改斷言讓它不受路徑影響、意圖不變：例如解析 JSON 後檢查 `mcpServers.bat` 只有預期的鍵（`type` / `command` / `args`，依實際）、沒有 `env`；`args` 與整份內容在**移除暫存目錄路徑之後**才比對 `/env|token|BAT_REMOTE/i`；另斷言測試用的假權杖值不出現在內容中。
2. 同檔若有其他對含暫存路徑的字串做同類正則比對的斷言，一併處理。
3. 以固定會命中的暫存名稱（例如在測試內建 `…-ENVtoken` 目錄）證明新斷言不再誤判，並保留「內容含 env 區塊或權杖時會失敗」的反例。

### 驗收條件
- [ ] `npx vitest run electron/__tests__/bat-mcp-launch.test.ts` 通過；`npm run test:unit` 全過；`npm run typecheck:electron` = 0
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 互動紀錄

### 回報時間
