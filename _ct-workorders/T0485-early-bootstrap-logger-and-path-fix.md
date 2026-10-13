---
schema_version: 1
schema_kind: workorder
id: T0485
title: "啟動韌性：bootstrap 階段提早初始化磁碟日誌 + early uncaughtException / unhandledRejection 落地 + macOS PATH 修正移到所有 import 之前"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P2
sizing: M
created_at: "2026-10-13T23:13:05+08:00"
started_at: null
updated_at: "2026-10-13T23:13:05+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0480"
related:
  - "T0479 回報區第 7 節（R6，選配 D）與「偏離 / 範圍外發現」4（`main.ts:17-61` PATH 修正實際晚於所有 import 的模組主體）"
  - "T0480（`electron/app-paths-bootstrap.ts` 為 `main.ts` 第一個 import；import 白名單測試 `app-paths-bootstrap-order.test.ts`）"
  - "BUG-116（mac 主程序在 logger.init 前崩潰 → 無 Logs）"
affects_files:
  - "electron/app-paths-bootstrap.ts"
  - "electron/logger.ts"
  - "electron/main.ts"
  - "electron/early-*.ts"
  - "electron/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 `main.ts` 只改：檔頭 PATH 修正段（`:17-61` 一帶）、`uncaughtException` 註冊處（`:137` 一帶）、whenReady 的 `logger.init` 一帶；其他區段不動（T0491 稍後會改 main.ts 的對話框區）"
  - "🔴 bootstrap 仍須是 `main.ts` 第一個 import；若新增 early 模組，更新 import 白名單測試並說明"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 **不改 `CLAUDE.md`**（除非本單 frontmatter 另有授權）：需更新的文件內容寫在回報區「CLAUDE.md 建議文字」，由 T0493 統一套用"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0485 — 啟動韌性：bootstrap 階段提早初始化磁碟日誌 + early uncaughtException / unhandledRejection 落地 + macOS PATH 修正移到所有 import 之前

## A. 提早日誌（T0479 選配 D）

- bootstrap 在 `setPath('userData')` 之後即初始化磁碟日誌（只需 fs）；同步讀取 `settings.json` 的 logging 設定（`loggingEnabled` / `logLevel`），與 whenReady 現行行為一致
- whenReady 的 `logger.init` 改為冪等（已初始化則不重開檔、不重複輪替），migration report 照常寫出
- 在 bootstrap（早於其他模組主體）註冊 early `uncaughtException` / `unhandledRejection`：寫入磁碟日誌後維持現行處理語意（不得改變是否退出 / 對話框等既有行為）；與 main.ts 既有 handler 的分工要清楚，避免重複記錄
- 驗證：模擬「import 期丟錯」（測試用 fake 模組）→ 磁碟日誌有記錄；正常啟動只開一個日誌檔

## B. macOS PATH 修正提前

- 現況：`main.ts:17-61` 註解宣稱在所有 import 前執行，但 bundle 中晚於所有 import 的模組主體
- 盤點 import 期讀取 `process.env.PATH` 的模組（含間接依賴，如 resolver 快取）；把 PATH 修正搬進 bootstrap（或 bootstrap 之內的 early 模組），mac / Linux 邏輯與 Windows no-op 不變
- 以 `npx vite build` 產物 offset 證明 PATH 修正早於其他模組主體（回報數字）

## 驗收條件

- [ ] 單元測試：logger 冪等、early handler 寫檔、PATH 修正純函式（mac / linux / win 分支）
- [ ] 產物順序 offset（PATH 修正、early handler 註冊 < 其他模組主體）
- [ ] e2e isolated runtime：啟動後 `Logs/` 只有一個新檔且含 `[userdata-migration]`；`smoke` / `plan039-multi-remote` 回歸
- [ ] `npm run test:unit`、`npx vite build`；CLAUDE.md 建議文字（Logging 段）

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
