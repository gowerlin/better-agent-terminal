---
schema_version: 1
schema_kind: workorder
id: T0491
title: "remote 失敗對話框三語化（unreachable / trust / protocol）+ detached 視窗內新增 / 關閉終端持久化到父視窗 entry（BUG-113 已知限制）"
type: implementation
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
depends_on:
  - "T0485"
  - "T0486"
related:
  - "T0464 回報區：對話框 i18n 只做 limit，main 端其他 remote 失敗對話框（unreachable / trust / protocol）仍為英文；`showRemoteProfileFailureDialog`（`electron/main.ts:1370`）"
  - "BUG-113：detached 視窗唯讀載入父視窗 entry、持久化只由父視窗負責；已知限制：detached 視窗內新增 / 關閉的終端不會持久化（save 為 no-op），reattach 後顯示 detach 當時的終端清單"
affects_files:
  - "electron/main.ts"
  - "electron/window-registry.ts"
  - "electron/preload.ts"
  - "src/types/electron.d.ts"
  - "src/stores/"
  - "src/components/"
  - "src/locales/"
  - "electron/__tests__/"
  - "e2e/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 detached 持久化不得回到 BUG-113 前「detached store 覆寫父視窗 entry」：只同步該 detached workspace 的終端增刪，由 main 合併進父視窗 entry；父視窗 30 秒 autosave 與 detached 更新的競態要處理並測試"
  - "🔴 i18n 三語（以現有 locales 為準），文案風格比照 T0464 的 limit 對話框"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 **不改 `CLAUDE.md`**（除非本單 frontmatter 另有授權）：需更新的文件內容寫在回報區「CLAUDE.md 建議文字」，由 T0493 統一套用"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0491 — remote 失敗對話框三語化（unreachable / trust / protocol）+ detached 視窗內新增 / 關閉終端持久化到父視窗 entry（BUG-113 已知限制）

## A. remote 失敗對話框三語化

- `showRemoteProfileFailureDialog` 的所有 reason（unreachable / trust / protocol / 其他）走 main 端 i18n（比照 T0464 `limit`），保留原始錯誤細節（detail）
- 單元測試：每個 reason 三語文案存在、detail 保留

## B. detached 視窗終端持久化

- detached renderer 在終端增刪時通知 main → main 只更新父視窗 entry 中對應 workspace 的終端清單（最小合併），不寫其他 workspace
- 競態：父視窗 autosave 與 detached 更新交錯時不得互相覆蓋（測試證明）
- reattach 後父視窗顯示 detached 期間的最新終端清單
- e2e（isolated runtime）：detach → 新增終端 → reattach / 關閉 → 父視窗清單正確、重啟後仍正確

## 驗收條件

- [ ] A / B 單元測試；B 的 e2e
- [ ] `npm run test:unit`、`npx vite build`、`npx tsc --noEmit -p .`（T0486 後應為 0）；CLAUDE.md 建議文字

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
