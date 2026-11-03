---
schema_version: 1
schema_kind: workorder
id: T0808
title: "BUG-208：呼叫 helper 的測試一律把 `BAT_USER_DATA` / `BAT_HELPER_LOG_DIR` 指到暫存目錄，不再寫進真實的 `bat-scripts.log`"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-03T17:59:11+0800"
started_at: ""
updated_at: "2026-11-03T17:59:11+0800"
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
