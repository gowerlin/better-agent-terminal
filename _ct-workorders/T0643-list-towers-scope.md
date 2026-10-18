---
schema_version: 1
schema_kind: workorder
id: T0643
title: "PLAN-050 C：`terminal:list { scope: 'towers' }`——已宣告的塔台列出同一 BAT 內所有塔台分頁（R2 (a)，放寬 D149）；併入 T0644 文件草稿"
type: feature
status: TODO
repo: better-agent-terminal
project: PLAN-050
priority: P2
sizing: S
created_at: "2026-10-18T17:11:36+0800"
depends_on: [T0642, T0644]
related:
  - "D167（使用者同意放寬 D149，新增 `scope: 'towers'`）；T0640 回報區（Q2-3 範圍分析、介面契約草案 C-6、實作切分 C）"
  - "T0642（`claudeSessionName` / `claudeSessionId` 查詢欄位、`claude-sessions.json`）；T0641（`claudeSessionNameRecords`、命名）；T0644 回報區「文件草稿」小節（本單併入 docs / CLAUDE.md）"
  - "T0582（`terminal:list` 契約、`authorizeHelperQueryTarget`、`scope: 'workspace'` 只給已宣告塔台）；T0584（`scripts/bat-mcp.mjs`、`readOnlyHint`）；D149（範圍權杖）"
affects_files:
  - electron/terminal-query-handlers.ts
  - "electron/remote/helper-capability.ts（只在範圍判斷需要時）"
  - "scripts/bat-mcp.mjs（`bat_list_terminals` 的 `scope` enum 與說明）"
  - "scripts/bat-terminal.mjs（只在 helper 已有對應的 list 參數、需要同步值域時）"
  - "electron/main.ts、electron/remote/headless-entry.ts（只在工作區名稱 dep 需要接線時）"
  - "electron/__tests__/**、electron/remote/__tests__/**、scripts/__tests__/**"
  - "e2e/t0643-list-towers.spec.ts（新，或擴充 e2e/t0642）"
  - "docs/agent-guide/claude-session-name.md、docs/agent-guide/helper-query-channels.md、docs/agent-guide/bat-mcp-shim.md、docs/agent-guide/remote-tower-notify.md（範圍表一句）、CLAUDE.md（PLAN-050 節與「helper 唯讀查詢 channel」節各一句）"
  - _ct-workorders/T0643-list-towers-scope.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **C-6 契約**（T0640 草案，D167 同意）：`terminal:list { scope: 'towers' }` 只有已 `--set-role tower` 宣告的塔台可呼叫（`helperQueryRole` = `tower`；否則 `NOT_OWNER`，與 `scope: 'workspace'` 相同規則）。回傳同一個 BAT host（同一 RemoteServer / 同一個主行程）上**所有工作區**中 `role: tower` 且執行中的分頁（呼叫者自己也列出，標示即可），每列**只有** `id` / `workspaceId` / `workspaceName` / `claudeSessionName` / `state` / `alive`（`title` 若本機有可加，回報說明）。🔴 **不回** `claudeSessionId`、`cwd`、輸出、`towerMode`、`workorder`、問題內容；對這些分頁的 `get-state` / `read-output` / `wait` 範圍**不變**（仍 `NOT_OWNER`）。"
  - "🔴 不改 `scope: 'mine'` / `'workspace'` 的行為與欄位；未知 scope 照現行回 `INVALID_ARGS`。舊 BAT 對 `scope: 'towers'` 回什麼（`INVALID_ARGS`？）寫進文件，給 CT 判斷不支援用。MCP `bat_list_terminals` 的 `scope` 加 `towers`，仍 `readOnlyHint: true`（`bat-mcp.test.mjs` 斷言）。稽核日誌 `[helper-query]` 記 `scope=towers`，不記名稱以外的內容。"
  - "🔴 `workspaceName` 取 `alias || name`（與 T0641 `cleanSessionWorkspaceName` 的來源一致）；headless 沒有工作區名稱時回 `null`（已知限制）。"
  - "🔴 **文件併入**：把 T0644 回報區「文件草稿」小節併入 `docs/agent-guide/claude-session-name.md`（新節「以塔台開啟 Claude（T0644）」）與 CLAUDE.md PLAN-050 節（一行），內容照草稿、只做格式整理；另把本單的 `scope: 'towers'` 寫進同一份 docs、`helper-query-channels.md` 契約表與範圍說明、CLAUDE.md。CLAUDE.md 依「CLAUDE.md 撰寫規則」：每節 3–12 行，細節放 docs。"
  - "🔴 非隔離工單，本單期間沒有其他 Worker。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。不 push。"
---

# T0643 — `scope: 'towers'`（PLAN-050 C）

## 背景

R2 (a)（D167）：從一般分頁開的塔台在 ListAgents 上的名稱是 `<工作區> · <短 ID>`，看不出角色；CT 需要問 BAT「這台機器上有哪些塔台、各自的 session 名稱」。使用者同意放寬 D149，讓已宣告的塔台可以列出同一 BAT 內所有工作區的塔台分頁（只有識別用的 metadata）。本單也把 T0644 的文件草稿併入正式文件，作為 PLAN-050 的收尾。

## 要做的事

1. `terminal:list` 支援 `scope: 'towers'`（契約見 memory_overrides）；範圍判斷集中在既有的範圍函式，不在 handler 內散寫。
2. MCP `bat_list_terminals` 的 `scope` 加 `towers`、說明一句。
3. 測試：已宣告塔台可列、未宣告 / worker / shell → `NOT_OWNER`；跨工作區列出所有塔台、不含非塔台分頁；欄位白名單（不含 sessionId / cwd 等）；對列出的別工作區塔台做 `get-state` / `read-output` / `wait` 仍 `NOT_OWNER`；稽核日誌；headless。
4. e2e（隔離實例、不耗 token）：兩個工作區各一個宣告為塔台的分頁（可用 T0644 入口開，或 helper `--set-role tower`），A 塔台以 MCP `bat_list_terminals scope=towers` 看到兩列，且 B 塔台的 `claudeSessionName` 正確；B 塔台 `get-state` 由 A 呼叫仍 `NOT_OWNER`。
5. 文件併入（T0644 草稿）與 `scope: 'towers'` 文件；整理一份「PLAN-050 對 CT 的介面契約總表」寫在回報區（C-1–C-8 的最終版，含 T0641 / T0642 / T0644 / 本單的實際欄位、值域、降級、舊 BAT 的反應），供塔台開 CT-T021。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（基線 5371 / 310）
- `npx vite build` 成功
- e2e 新增的 spec 通過；回歸 `e2e/t0582-helper-query.spec.ts`、`e2e/t0642-claude-session-query.spec.ts`

## 驗收

- 已宣告的塔台能跨工作區列出所有塔台與其 session 名稱；其他查詢範圍不變
- T0644 文件草稿已併入；CLAUDE.md 與 docs 一致
- 回報區附「PLAN-050 介面契約總表」；驗證全部通過；commit

---

## 回報區

（Worker 填寫）
