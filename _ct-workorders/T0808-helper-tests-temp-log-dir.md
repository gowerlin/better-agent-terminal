---
schema_version: 1
schema_kind: workorder
id: T0808
title: "BUG-208：呼叫 helper 的測試一律把 `BAT_USER_DATA` / `BAT_HELPER_LOG_DIR` 指到暫存目錄，不再寫進真實的 `bat-scripts.log`"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-03T17:59:11+0800"
started_at: "2026-11-03T18:00:57+0800"
updated_at: "2026-11-03T18:00:57+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "BUG-208；D253；T0806 回報區〈環境還原〉〈後續〉第 4 點；CLAUDE.md「遠端 Tower 通知（PLAN-036 K）」（helper 測試須設 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 到 temp）、「Frontend unit tests」節"
affects_files:
  - "scripts/__tests__/**（呼叫 helper 的測試）"
  - "tests/bat-*.test.mjs（vitest 收的 5 個，若有同樣問題）"
  - "scripts/__tests__/helpers/** 或既有共用測試 helper（若新增共用 env 函式）"
  - _ct-workorders/T0808-helper-tests-temp-log-dir.md
renew_count: 0
tower_question: open
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改測試，不改 helper 腳本與產品程式。`electron/__tests__/**` 若也有同樣問題：先列出、問塔台（T0807 在 worktree 並行，可能動到 `electron/__tests__/` 的其他檔），塔台同意才改。"
  - "🔴 找法要有證據：以暫存的 `BAT_USER_DATA` 外的真實 log 位置（Windows `%APPDATA%\\BetterAgentTerminal\\Logs\\bat-scripts.log`、Linux `~/.config/BetterAgentTerminal/Logs/bat-scripts.log`）為準，**只讀**記錄跑測試前後的行數，不得修改或清除這兩個檔（本機 BAT 與其他分頁正在寫）。修正後再跑一次，確認測試期間真實 log 沒有新增本測試的紀錄（以 argv 與時間判斷；其他分頁的 helper 正常寫入不算）。"
  - "🔴 可加 source guard（例如掃 `scripts/__tests__` / `tests` 中 spawn helper 的測試都有設定暫存 env），放 vitest 收得到的位置（🔴 不放進 `tests/`，D177）。"
  - "🔴 驗證：`npm run test:unit`、`npm run test:legacy` 綠；不需要 typecheck（不改 src / electron，若有改則跑對應 typecheck）。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0808 — helper 測試改用暫存 log 目錄（BUG-208）

## 元資料

- **工單編號**：T0808
- **類型**：implementation（測試衛生）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T17:59:11+0800
- **預估規模**：S

## 背景

T0806 發現 `scripts/__tests__/server-bundle-helpers.test.mjs` 等測試對 `bat-terminal.mjs` / `bat-notify.mjs` 執行 `--version` / `--help` 時，env 只去掉 `BAT_*`、`HOME` 是真的，helper 退回舊推測位置，寫進使用者真實的 `bat-scripts.log`（Windows 與 Linux 各實測 10 行）。違反 CLAUDE.md 規則。與 T0807 同批修完再發版（D253）。

## 範圍

1. 找出所有呼叫 helper 但沒設暫存 `BAT_USER_DATA` / `BAT_HELPER_LOG_DIR` 的測試並補上（可抽共用函式）。
2. 視情況加 source guard。
3. 以真實 log 行數前後比對證明修好。

## 不做

- 不改 helper 與產品程式；不清使用者真實 log；不 push、不發版。

## 驗收

- [ ] 受影響測試清單與修法
- [ ] 修正前後真實 log 行數比對（只讀）
- [ ] source guard（若加）
- [ ] `npm run test:unit`、`npm run test:legacy` 綠

---

## 回報區

### 待塔台決策

#### Q-1：`electron/__tests__/bat-terminal-wait-started.test.ts` 也有同樣問題（`--help` 用 `run(['--help'], {})`，沒給暫存 log 目錄），要不要在本單一併修？
- 提問時間：2026-11-03T18:04:21+0800
- 選項：[A] 同意，本單一併修（只改該檔第 338 行：`--help` 也帶暫存 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA`，一行測試改動）/ [B] 不改，列為後續（另開單）/ [C] 其他：________
- Worker 建議：[A]。證據：把 `APPDATA` / `BAT_USER_DATA` 指到偵測目錄跑完整 `npm run test:unit`，偵測目錄收到 5 筆 helper 紀錄，其中 1 筆（`bat-terminal --help`，env 為空）來自這支測試；其餘 4 筆在 `scripts/__tests__`（本單範圍內）。`test:legacy` 0 筆。`electron/__tests__` 其他呼叫 helper 的測試都已帶 `BAT_HELPER_LOG_DIR`。改動只有一行、只動測試，與 T0807 的衝突風險低（T0807 若沒動這支檔就無衝突）。
- 影響範圍：`electron/__tests__/bat-terminal-wait-started.test.ts`（目前不在 `affects_files`）；本單 source guard 的掃描範圍是否含 `electron/__tests__`
- 阻塞：否（先修 `scripts/__tests__` 三處；收尾前等答覆）
