---
schema_version: 1
schema_kind: workorder
id: T0449
title: "T0445 #5/#8：auth 節流與 helper 分流——loopback 不被權杖失敗 ban 死、撤銷權杖回 Capability revoked、helper 成功不清 server token 失敗計數"
type: fix
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: S
created_at: "2026-10-05T06:32:48+08:00"
started_at: null
updated_at: "2026-10-05T06:32:48+08:00"
completed_at: null
target_version: next
depends_on:
  - T0447
related:
  - "T0445 findings #5 / #8、拆單 3"
  - "D134 追加（塔台 06:32 依授權直接決定）"
affects_files:
  - electron/remote/remote-server.ts
  - electron/remote/helper-capability.ts
  - electron/remote/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **塔台裁決**：權杖 auth 失敗與 server token auth 失敗**分開計數**；權杖失敗**不觸發 IP ban**（權杖為 256-bit 隨機值，暴力猜測不可行；ban 只會傷到同機 BAT client）。已撤銷權杖（registry 記得最近撤銷的 digest，有界、TTL）回 `Capability revoked` 且不計失敗。server token 失敗的既有節流維持，但 helper auth 成功**不得**清除 server token 失敗計數（#8）。"
  - "🔴 loopback 的 server token 失敗是否仍 ban：維持既有行為（不改），回報區說明 SSH tunnel 情境下的風險已因權杖失敗不計入而大幅縮小。"
  - "🔴 依賴 T0447（同改 `remote-server.ts`）。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push。"
---

# T0449 — auth 節流分流（T0445 #5/#8）

## 驗收條件

- [ ] 測試：同 loopback IP 連續 10 次錯誤權杖後，server token auth 仍成功；撤銷權杖回 `Capability revoked`；4 次 server token 失敗 + 1 次權杖成功 + 1 次 server token 失敗 → 觸發 ban（計數未被清）
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39

## Sub-session 執行指示
1. 讀本工單 + T0445 #5 / #8 + T0447 回報區
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
