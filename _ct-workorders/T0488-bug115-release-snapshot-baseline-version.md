---
schema_version: 1
schema_kind: workorder
id: T0488
title: "BUG-115 修復：release.ps1 -Snapshot 的 fetch:baseline 以 snapshot 版號下載 → 404；baseline 版號改取基底版號"
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
depends_on: []
related:
  - "BUG-115 全文（現象、待查方向、暫行對策）"
  - "CLAUDE.md「Server bundle baseline（PLAN-031）」（`prebuild` hook 串接 `fetch:baseline`）；D125（本地打包版號來源規則）"
affects_files:
  - "scripts/fetch-baseline-tarball.mjs"
  - "scripts/build-version.js"
  - ".vscode/scripts/release.ps1"
  - "scripts/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改 `package.json`（T0486 / T0492 會改）；若修法必須改 package.json scripts，回報區寫明需求並優先採不改 package.json 的方案"
  - "🔴 CI 路徑（`VERSION` env）行為不得改變"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 **不改 `CLAUDE.md`**（除非本單 frontmatter 另有授權）：需更新的文件內容寫在回報區「CLAUDE.md 建議文字」，由 T0493 統一套用"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0488 — BUG-115 修復：release.ps1 -Snapshot 的 fetch:baseline 以 snapshot 版號下載 → 404；baseline 版號改取基底版號

## 修正

- `fetch-baseline-tarball.mjs` 版號來源：snapshot 後綴（以 `build-version.js` 實際產生格式為準，如 `.local.<stamp>`）→ 取基底版號；或由 `build-version.js` 以 env 明確傳 baseline 版號（擇一並說明）
- 「`-Version X` 與 package.json 不同、X 尚無 server-bundle release」情境：明確錯誤訊息或 fallback 規則（附理由）
- 重複 fetch：確認第二次命中快取且版號一致；是否移除重複呼叫（需改 package.json）只建議

## 驗收條件

- [ ] 單元測試：snapshot 版號 → 基底版號；一般版號不變；CI `VERSION` 路徑不變
- [ ] `pwsh .vscode/scripts/release.ps1 -Snapshot` 至少通過兩次 fetch:baseline（可在 electron-builder 前中止或完整跑完；完整跑完時產物留 `release/`、不安裝並記錄）；並行 Worker 可能同時 build，失敗須判斷歸屬
- [ ] BUG-115 可結案證據；CLAUDE.md 建議文字

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
