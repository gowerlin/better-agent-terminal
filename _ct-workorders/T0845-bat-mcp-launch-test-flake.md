---
schema_version: 1
schema_kind: workorder
id: T0845
title: "修測試偶發失敗：bat-mcp-launch.test.ts 的「設定檔不含權杖」斷言被暫存目錄的隨機後綴（例 `17ENVT`）誤判"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-04T13:23:28+0800"
started_at: "2026-11-04T13:24:21+08:00"
updated_at: "2026-11-04T13:27:03+08:00"
completed_at: "2026-11-04T13:27:03+08:00"
session_ids:
  - "1d5a5488-d52d-4a2d-8350-544f148f93cb"
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
- **工單編號**：T0845｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 13:23 (UTC+8)
- **規模**：S

## 現象（T0844）
`electron/__tests__/bat-mcp-launch.test.ts` 約第 87 行 `expect(content).not.toMatch(/env|token|BAT_REMOTE/i)`。設定檔的 `args` 含暫存目錄路徑（第 48 行 `fs.mkdtempSync(path.join(os.tmpdir(), 't0584-launch-'))`），隨機後綴碰巧是 `17ENVT` 時被 `/env/i` 比到而失敗；內容本身正確。發版 CI 的 tests job 碰到就會擋發版。

## 任務
1. 改斷言讓它不受路徑影響、意圖不變：例如解析 JSON 後檢查 `mcpServers.bat` 只有預期的鍵（`type` / `command` / `args`，依實際）、沒有 `env`；`args` 與整份內容在**移除暫存目錄路徑之後**才比對 `/env|token|BAT_REMOTE/i`；另斷言測試用的假權杖值不出現在內容中。
2. 同檔若有其他對含暫存路徑的字串做同類正則比對的斷言，一併處理。
3. 以固定會命中的暫存名稱（例如在測試內建 `…-ENVtoken` 目錄）證明新斷言不再誤判，並保留「內容含 env 區塊或權杖時會失敗」的反例。

### 驗收條件
- [x] `npx vitest run electron/__tests__/bat-mcp-launch.test.ts` 通過；`npm run test:unit` 全過；`npm run typecheck:electron` = 0
- [x] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE
- **落點檢查**：PASS（C-0：`repo`=`better-agent-terminal`，`basename(REPO_ROOT)`=`better-agent-terminal`；C-1 PASS；C-3 兩項皆存在；C-2 無 `branch` 欄位；`BAT_WORKSPACE_ID`=`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`，僅記錄）
- **環境**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_REMOTE_TOKEN` 已設定；非 worktree（`CT_HOME` 未設）
- **產品 commit**：`e0e9e6b7`（只含 `electron/__tests__/bat-mcp-launch.test.ts`）
- **session_id**：1d5a5488-d52d-4a2d-8350-544f148f93cb

### 產出摘要
**原因**：原第 87 行 `expect(content).not.toMatch(/env|token|BAT_REMOTE/i)` 直接比對整份 `--mcp-config` 檔；`args` 內的 shim 路徑在 `mkdtemp` 目錄下，隨機後綴（例 `17ENVT`）就會命中 `/env/i`。

**改動**（只改測試檔，未動產品碼）：
1. 新增 `expectNoSecretsInMcpConfig(content, tempRoot)`：
   - 未遮罩的原文 `not.toContain(TOKEN)`（假權杖值不得出現）；
   - 解析 JSON 後鎖定鍵：頂層只有 `mcpServers`、其下只有 `bat`、`bat` 只有 `args` / `command` / `type`（不得有 `env`）；
   - 把暫存根目錄（以 `JSON.stringify(tempRoot).slice(1, -1)` 取 JSON 跳脫後的形式，Windows 的 `\` 在檔內是 `\\`）替換成 `<tmp>` 後，才比對 `/env|token|BAT_REMOTE/i`。
   原測試的 `toEqual` 整份比對也保留，意圖沒有變弱（反而多了鍵的白名單）。
2. 新增測試 `T0845: a temp path that spells env / token / BAT_REMOTE does not trip the check; an env block or a token does`：
   - 建固定會命中的暫存目錄 `t0845-17ENVT-token-BAT_REMOTE-XXXXXX`，先斷言舊的原始比對**確實會命中**，再斷言新檢查通過；
   - 6 個反例（含權杖的 env 區塊、空 env 區塊、args 含權杖值、`--token=x`、`BAT_REMOTE_PORT=1`、command 為 `env`）都讓新檢查失敗。
3. 任務 2（同檔其他同類斷言）：逐一檢查 `toMatch` / `not.toContain`，其餘皆為錨定前綴或 `.*` 跨過路徑（第 97–98、183、251 行等）或只比對權杖值（第 194 行 logs），不受暫存路徑影響，未改。

**驗證**：
- `npx vitest run electron/__tests__/bat-mcp-launch.test.ts`：1 檔 19 項通過
- `npm run test:unit`：exit 0，435 檔通過 / 3 skipped；7733 項通過 / 40 skipped
- `npm run typecheck:electron`：exit 0（另以 `npx tsc … ; echo $?` 確認 0）

**驗收條件**：兩項皆達成（commit 只含本單範圍：產品 commit 只有測試檔，工單 commit 只有本工單檔）。

### 互動紀錄
- 無（yolo，未提問）

### 回報時間
- 2026-11-04T13:26:36+0800
