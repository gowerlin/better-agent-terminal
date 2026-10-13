---
schema_version: 1
schema_kind: workorder
id: T0490
title: "研究 BUG-114：派工分頁 terminal-created 成功但 Worker 未執行預載 /ct-exec（或 commit 前停住）——追預載指令送達時序，提出修法與啟動心跳設計"
type: research
status: TODO
repo: better-agent-terminal
project: D139
priority: P3
sizing: M
created_at: "2026-10-13T23:13:05+08:00"
started_at: null
updated_at: "2026-10-13T23:13:05+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on: []
related:
  - "BUG-114 全文（T0452 / T0457 / T0436 證據、待查方向、L143 暫行對策）"
  - "CLAUDE.md「遠端 Tower 通知（PLAN-036 K）」（create-agent-command 路徑）；`scripts/bat-terminal.mjs`"
affects_files: []
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：不改產品程式碼，只寫本工單回報區；實驗用 isolated runtime / scratchpad，結束清除並回報"
  - "🔴 不得對使用者正在使用的 BAT（本機 RemoteServer）派發測試分頁；需要真 BAT 才能重現時，寫出重現步驟交塔台"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 **不改 `CLAUDE.md`**（除非本單 frontmatter 另有授權）：需更新的文件內容寫在回報區「CLAUDE.md 建議文字」，由 T0493 統一套用"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0490 — 研究 BUG-114：派工分頁 terminal-created 成功但 Worker 未執行預載 /ct-exec（或 commit 前停住）——追預載指令送達時序，提出修法與啟動心跳設計

## 研究項目

1. 追 `bat-terminal.mjs --skill ct-exec --workorder` → `terminal:create-agent-command` → PTY 建立 → agent 啟動 → 預載指令送出 的完整路徑與時序（檔案:行）；agent（Claude CLI / Codex）尚未 ready 時送出的輸入是否會被吞
2. 現有「等待 agent ready」機制（若有）：判斷依據、timeout、失敗行為；多分頁同時建立時的佇列 / 焦點
3. 以 isolated 環境或單元層級模擬「輸入早於 ready」（可行即做）
4. T0436 型（Worker 寫完回報後停在 commit 前）是否為不同根因：從 ct-exec 流程與 agent 權限提示角度分析（只讀）
5. 修法選項比較並推薦：ready 偵測 + 重送、BAT 確認預載已被接收、Worker 啟動時 `bat-notify` 心跳（`T#### started`）、塔台自動偵測未啟動
6. 實作單拆分建議（affects_files、驗收、是否需要 e2e）

## 產出

回報區：時序表、重現結果、根因判定（確定 / 推測分開）、修法比較 + 推薦、實作單規格

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
