---
schema_version: 1
schema_kind: workorder
id: T0444
title: "BUG-111：精靈 rollback 只清本次精靈建立 / 啟動的資源（Docker container / bundle / 啟動狀態、write-profile 多次 create）"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-111
priority: P1
sizing: S
created_at: "2026-10-05T06:13:14+08:00"
started_at: null
updated_at: "2026-10-05T06:13:14+08:00"
completed_at: null
target_version: next
depends_on:
  - T0427
related:
  - "BUG-111；T0426 回報區「遭遇問題」3（冪等性盤點表）"
  - "D134 追加（塔台 06:13 依授權直接決定）"
affects_files:
  - src/components/setup-wizard/steps/docker/
  - src/components/setup-wizard/steps/wsl/write-profile.ts
  - src/components/setup-wizard/wizard-runner.ts
  - src/components/setup-wizard/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **原則：rollback 只撤銷本次精靈執行實際造成的變更**。每個有 rollback 的 Docker 步驟在執行時記錄所有權旗標（例：`containerCreatedByWizard`、`containerWasRunningBefore`、`bundleInstalledByWizard`），寫入精靈 state；rollback 依旗標決定，旗標缺失（舊 state / 判斷失敗）時**不動作**並 warn（fail-safe = 不刪）。"
  - "🔴 Docker `pick-container` new 模式：建立前若同名容器已存在，**不得**沿用並在 rollback 刪除——改為報錯要求換名（或產生不衝突名稱，擇一並說明）。existing 模式 rollback 不 stop 原本就在跑的容器、不 `rm -rf` 非精靈安裝的路徑。"
  - "🔴 `write-profile`：記錄所有本次建立的 profile id（陣列），rollback 全部刪除；不得覆寫遺失。"
  - "🔴 依賴 T0427（同改 `steps/docker/`）。開工前 `git log --oneline -5` 確認。共用檔 commit 前 `git diff <file>` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push；不對任何實際 docker daemon 執行破壞性指令。"
---

# T0444 — 精靈 rollback 所有權（BUG-111）

## 範圍

1. Docker 三步驟（`pick-container` / `install-server-bundle` / `start-server`）所有權旗標 + rollback 改寫
2. `write-profile` 多 id 記錄
3. 測試：每個步驟 × (精靈建立 / 使用者既有) × (rollback) 的矩陣；旗標缺失不動作；同名容器存在時 new 模式報錯

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] 回報區附所有權矩陣
- [ ] BUG-111 改 `FIXED`

## Sub-session 執行指示
1. 讀本工單 + BUG-111 + T0426 回報區（冪等性表）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 實際改動檔 + 本工單 + BUG-111；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
