---
schema_version: 1
schema_kind: workorder
id: T0451
title: "T0445 #9：helper 連線衛生——拒絕 log 的 channel 限長跳脫、每權杖連線數上限、helper 拒絕節流、heartbeat 涵蓋 helper"
type: fix
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: XS
created_at: "2026-10-05T06:32:48+08:00"
started_at: null
updated_at: "2026-10-05T06:32:48+08:00"
completed_at: null
target_version: next
depends_on:
  - T0450
related:
  - "T0445 finding #9、拆單 5"
  - "D134 追加（塔台 06:32 依授權直接決定）"
affects_files:
  - electron/remote/remote-server.ts
  - electron/remote/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 拒絕 log 的 `channel`：非字串直接拒（不 log 原值）、字串截至 64 字元並跳脫控制字元；每權杖同時連線 ≤ 4；helper 被拒次數節流（例如 1 分鐘內 > 30 次拒絕 → terminate）；heartbeat ping / terminate helper（比照 client）。"
  - "🔴 依賴 T0450（同改 `remote-server.ts`）。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push。"
---

# T0451 — helper 連線衛生（T0445 #9）

## 驗收條件

- [ ] 測試：含換行 / 超長 channel 的 log 被截斷跳脫；第 5 條同權杖連線被拒；拒絕節流觸發 terminate；半開 helper 被 heartbeat 清除
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39

## Sub-session 執行指示
1. 讀本工單 + T0445 #9 + T0450 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
