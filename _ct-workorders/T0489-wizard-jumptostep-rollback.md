---
schema_version: 1
schema_kind: workorder
id: T0489
title: "Setup wizard：jumpToStep 跳回前面步驟時走 rollback 鏈（只回收本次精靈擁有的資源），補 T0309 既有 TODO"
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
depends_on: []
related:
  - "T0309 既有 TODO；T0426（取消時 rollback 鏈）、T0444（rollback 只回收本次擁有的資源，旗標以容器名稱為鍵）回報區"
  - "T0426 回報區：skip / jumpToStep 時失敗步驟不走 rollback（SSH fetch-fingerprint tunnel 繞道仍保留）"
affects_files:
  - "src/components/setup-wizard/wizard-runner.ts"
  - "src/components/setup-wizard/SetupWizardShell.tsx"
  - "src/components/setup-wizard/steps/"
  - "src/components/setup-wizard/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改 `src/components/setup-wizard/__tests__/integration.transitions.test.ts`（T0486 修其型別錯誤）；新測試放新檔"
  - "🔴 rollback 只回收本次精靈擁有的資源（T0444 規則）；使用者既有資源（容器 / distro / tunnel / 設定）不得被刪"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 **不改 `CLAUDE.md`**（除非本單 frontmatter 另有授權）：需更新的文件內容寫在回報區「CLAUDE.md 建議文字」，由 T0493 統一套用"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0489 — Setup wizard：jumpToStep 跳回前面步驟時走 rollback 鏈（只回收本次精靈擁有的資源），補 T0309 既有 TODO

## 實作

- 盤點 jumpToStep 現行路徑（`wizard-runner.ts`）與 retry / skip / cancel 的 rollback 差異
- 跳回第 k 步：對 k 之後「已完成且有 rollback」的步驟（含目前失敗步驟）依反序 rollback，沿用 cancel 的 rollback 鏈與錯誤處理（rollback 失敗時阻擋或提示——依既有 cancel 語意決定並說明）
- 評估 T0387 的 SSH fetch-fingerprint tunnel 繞道在新行為下可否移除（只建議，除非測試完整證明）
- UI：跳回是否需要確認提示（會回收資源）——依既有 i18n / 對話框慣例決定並說明

## 驗收條件

- [ ] 單元 / 整合測試：跳回觸發反序 rollback、只回收擁有資源、rollback 失敗路徑、skip 與 retry 行為不變
- [ ] `npm run test:unit`、`npx vite build`；CLAUDE.md 建議文字（如需）

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
