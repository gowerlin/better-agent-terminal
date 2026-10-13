---
schema_version: 1
schema_kind: workorder
id: T0482
title: "BUG-119 修復 C：文件改回單一 userData 目錄 + 搬移 / 降版說明（README、CLAUDE.md、docs/plan-027）"
type: implementation
status: TODO
repo: better-agent-terminal
project: BUG-119
priority: P2
sizing: S
created_at: "2026-10-13T22:32:56+08:00"
started_at: null
updated_at: "2026-10-13T22:32:56+08:00"
completed_at: null
target_version: v0.6.0-pre.4
depends_on:
  - T0480
  - T0481
related:
  - "D138；T0479 回報區第 4 節（降版 / 回滾表）、第 5 節表格 C 列"
  - "T0480 / T0481 回報區（以實作結果為準，不以 T0479 規格為準）"
affects_files:
  - README.md
  - CLAUDE.md
  - docs/plan-027-cross-platform-verification.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改文件；路徑與行為以 T0480 / T0481 實作與回報區為準，有出入以程式碼為準並在回報區列出"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0482 — BUG-119 文件同步

1. README「設定」/「除錯日誌」（T0478 寫成兩目錄）：改為單一 `<appData>/BetterAgentTerminal[-runtime-<N>]/`，`Logs/`、`Crashes/` 在其下；說明升版自動搬移哪些（`Local State`、`snippets.json`、`message-archives`、runtime 目錄改名）、舊 `better-agent-terminal/` 保留不自動清理（舊日誌在那裡）、降版行為（T0479 第 4 節降版表的使用者可見部分）、不要同時執行新舊兩版
2. CLAUDE.md「Logging」：改回單一目錄；「日誌與設定不在同一目錄」段改寫為 BUG-119 已修 + bootstrap 必須是 `main.ts` 第一個 import、不得在 import 期呼叫 `getPath('userData')` 的開發規則；helper env 解析順序（T0481）
3. `docs/plan-027-cross-platform-verification.md:50`、`:92` 過期 `debug.log` 路徑
4. 全 repo grep `better-agent-terminal/`（userData 語境）、`debug.log`、`-runtime-` 確認無殘留過期描述（`_ct-workorders/` 除外）

## 驗收條件

- [ ] 文件路徑與 T0480 / T0481 實作一致（回報區附程式碼依據 檔案:行）
- [ ] 回報區附 `git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D138 + T0479 第 4 節 + T0480 / T0481 回報區 + 上列檔案
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 填回報區 → `DONE`；commit；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
