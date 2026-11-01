---
schema_version: 1
schema_kind: workorder
id: T0727
title: "pre.6 自動化驗收（一）：Claude 面板以本機假 Anthropic API 跑 e2e —— 工作清單（Claude 5 / 4.x、resume 重建）、SDK 0.3 對話 / 權限詢問 / sub-agent、V2 遷移分頁接續"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T10:57:56+0800"
started_at: ""
updated_at: "2026-11-01T10:57:56+0800"
completed_at: ""
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

### 互動紀錄

### 回報時間
