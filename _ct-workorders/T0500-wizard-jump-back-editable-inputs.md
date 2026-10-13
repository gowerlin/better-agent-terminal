---
schema_version: 1
schema_kind: workorder
id: T0500
title: "Setup wizard：跳回（edit-config）後目標步驟真的可編輯——editable 步驟被跳回時清掉自己的輸入（containerMode / dockerMounts 等），重跑時重新詢問"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-13T23:33:27+08:00"
started_at: null
updated_at: "2026-10-13T23:33:27+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0489"
related:
  - "T0489 回報區「觀察」：跳回 `pick-container` 時 `ctx.state.containerMode` 已有值不再詢問；跳回 `configure-mounts` 時 `dockerMounts` 已有值不再開選擇器 ⇒ 使用者實際無法編輯（T0309 起既有行為）"
  - "T0489 跳回 rollback 鏈（`wizard-runner.ts` `rollbackForJump`、`forgetCompletedStep`）；T0444 擁有權規則"
affects_files:
  - "src/components/setup-wizard/wizard-runner.ts"
  - "src/components/setup-wizard/steps/"
  - "src/components/setup-wizard/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 清輸入不等於 rollback 資源：目標步驟的資源回收仍依 T0489 / T0444 規則（只回收本次擁有），本單只處理「讓使用者重新輸入」"
  - "🔴 不改 `integration.transitions.test.ts`；新測試放新檔"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md；`npm run typecheck` 維持 0"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0500 — 跳回後真的能編輯

## 實作

1. 盤點所有 `edit-config` 可跳回的目標步驟（registry 中哪些錯誤對應 `edit-config` 指向哪步）與各步驟「已有值就不再詢問」的輸入（`ctx.state` / `ctx` 欄位）
2. 設計：新增 step hook（例如 `resetForEdit(ctx)`），runner 在跳回目標步驟時（rollback 鏈完成後、重跑前）呼叫；或等效做法（擇一並說明）
3. 每個 editable 步驟實作清輸入；重跑時重新詢問 / 開選擇器，預設值帶入先前的選擇（若 UI 支援預設值）以免使用者重打
4. retry / skip / cancel 行為不變；非跳回情境不清輸入

## 驗收條件

- [ ] 單元測試：跳回 `pick-container` → 重新詢問模式；跳回 `configure-mounts` → 重新開選擇器；其他 editable 步驟同理；retry 不清輸入
- [ ] `npx vitest run src/components/setup-wizard`、`npm run test:unit`、`npm run typecheck`、`npx vite build`
- [ ] 回報區：editable 步驟清單與處置、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0489 回報區 + `wizard-runner.ts` + 相關 steps
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
