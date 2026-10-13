---
schema_version: 1
schema_kind: workorder
id: T0493
title: "批次收尾：套用 T0484-T0492 回報的 CLAUDE.md / README 建議文字 + 新增 .gitattributes（LF 存庫）+ fsevents 不列 allowScripts 的記錄"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-13T23:13:05+08:00"
started_at: null
updated_at: "2026-10-13T23:13:05+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0484"
  - "T0485"
  - "T0486"
  - "T0487"
  - "T0488"
  - "T0489"
  - "T0490"
  - "T0491"
  - "T0492"
  - "T0494"
  - "T0495"
  - "T0496"
related:
  - "T0484-T0492 回報區「CLAUDE.md 建議文字」"
  - "T0454 回報區 `.gitattributes` 評估（index 全 LF、renormalize 預期 0 檔；建議 `* text=auto eol=lf`、`*.png binary`、`*.ico binary`）"
  - "D139（fsevents：比照 electron-winstaller 不列入 allowScripts）"
affects_files:
  - "CLAUDE.md"
  - "README.md"
  - "docs/"
  - ".gitattributes"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權改 `CLAUDE.md`"
  - "🔴 `.gitattributes`：新增後執行 `git add --renormalize .` 檢查——預期 0 個內容變更；若有任何檔案被 renormalize，**不 commit `.gitattributes`**，回報清單交塔台"
  - "🔴 不對使用者工作樹做重新 checkout / reset（既有工作樹的 CRLF 不處理，只在回報區說明）"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0493 — 批次收尾：套用 T0484-T0492 回報的 CLAUDE.md / README 建議文字 + 新增 .gitattributes（LF 存庫）+ fsevents 不列 allowScripts 的記錄

## 實作

1. 讀 T0484-T0492 回報區，套用其 CLAUDE.md / README / docs 建議文字（與程式碼現況有出入時以程式碼為準並列出）
2. `.gitattributes`（T0454 建議內容）+ renormalize 檢查（見 memory_overrides）
3. CLAUDE.md「本機開發：npm 12 install scripts」補 fsevents：mac 上 npm 12 會擋 `fsevents` install script，刻意不列入 `allowScripts`（理由比照 electron-winstaller：寫 `false` 會改變 npm 11 / CI 行為；fsevents 為 optional、mac 開發一般不受影響）
4. 全 repo grep 確認本批改動後無過期描述（tsc 基線數字、better-sqlite3、Actions 版本、runner、Haiku 計價等）

## 驗收條件

- [ ] 各工單建議文字的套用對照表（工單 → 段落 → 處置）
- [ ] `.gitattributes` renormalize 結果；`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
