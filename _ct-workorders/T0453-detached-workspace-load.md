---
schema_version: 1
schema_kind: workorder
id: T0453
title: "BUG-113：detached workspace 視窗唯讀載入父視窗 entry（workspace:load 經 detachedWindowRecords 解析），持久化只由父視窗負責；先實機 / e2e 確認現況"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-113
priority: P2
sizing: M
created_at: "2026-10-05T06:43:42+08:00"
started_at: null
updated_at: "2026-10-05T06:43:42+08:00"
completed_at: null
target_version: next
depends_on:
  - T0446
related:
  - "BUG-113；T0446（`acc94f5`）回報區「遭遇問題」1；`detachedWindowRecords`（T0446）"
  - "D134 追加（塔台 06:43 依授權直接決定）"
affects_files:
  - electron/main.ts
  - src/App.tsx
  - src/stores/workspace-store.ts
  - electron/__tests__/
  - src/__tests__/
  - e2e/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **第一步確認現況**：以 Playwright e2e（`e2e/` 既有 fixture，T0397 / T0399 隔離 runtime）或等效方式實際 detach 一個 workspace，確認是否顯示 Workspace not found。可以跑 `npx playwright test <你的新 spec>`（只跑本單 spec，不跑全套 e2e，L141）。若現況其實正常，回報區附證據並以 DONE（無需修）結案。"
  - "🔴 **設計**：detached 視窗的 `workspace:load` 經 T0446 的 detached 記錄解析父視窗，**唯讀**取父視窗 entry；detached 視窗的 `workspace:save` 不寫父視窗 entry（回 true 但 no-op，或只同步該 detached workspace 的狀態到父視窗——擇一並說明，**不得**造成兩視窗互相覆蓋）；父視窗已關閉時的行為明確（例如 detached 視窗關閉或顯示提示）。reattach 流程不得回歸。"
  - "🔴 本機（非 remote）detached 視窗也受益——這是本單主要目的；remote detached 視窗的路由已由 T0446 處理，不得改變。"
  - "🔴 T0436 可能仍有 `main.ts` 未提交 hunk：以 `git diff` + `git apply --cached` 精準 stage。**只跑 `npm run test:unit` + `npx tsc --noEmit` + 本單新 e2e spec；不跑全套 `npx vite build` / `npm run test:e2e`**（L141；e2e spec 若需 build，使用既有 e2e 流程允許的最小 build，回報區說明）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push。"
---

# T0453 — detached workspace 載入（BUG-113）

## 驗收條件

- [ ] 回報區附現況確認證據
- [ ] e2e：detach → 新視窗顯示該 workspace（終端可用）→ reattach 正常；父視窗 workspace 設定未被 detached 視窗覆寫
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] BUG-113 改 `FIXED`

## Sub-session 執行指示
1. 讀本工單 + BUG-113 + T0446 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 現況 → 設計 → 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單 + BUG-113（精準 stage）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
