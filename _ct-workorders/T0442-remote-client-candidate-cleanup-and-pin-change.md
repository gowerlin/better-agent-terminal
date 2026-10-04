---
schema_version: 1
schema_kind: workorder
id: T0442
title: "T0430 後續：loadProfileSnapshotDetailed 連線失敗時 disconnect 失敗的 candidate（SSH tunnel 殘留）；profile:update 變更 remoteFingerprint 時 fail-closed 拆既有 client"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-096
priority: P2
sizing: S
created_at: "2026-10-05T05:56:30+08:00"
started_at: null
updated_at: "2026-10-05T05:56:30+08:00"
completed_at: null
target_version: next
depends_on:
  - T0431
related:
  - "T0430 回報區「殘留風險（情境 3）」與「同類未修」；commit `a878b83`（`settleRemoteConnect`）"
  - "T0419（`038c98e`，`remote-connect-plan.ts`）"
  - "D134 追加（塔台 05:56 斷點 C 直接決定，使用者授權）"
affects_files:
  - electron/main.ts
  - electron/remote/remote-connect-plan.ts
  - electron/__tests__/remote-connect-plan.test.ts
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 (1) `loadProfileSnapshotDetailed` 連線失敗分支：沿用 T0430 的 `settleRemoteConnect`（或同等純函式）—— 失敗的新 client 必須 `disconnect()`（SSH tunnel 子行程一併清掉），槽位維持不變。"
  - "🔴 (2) `profile:update` 若變更了 `remoteFingerprint`（正規化後比對，大小寫 / 冒號無關），且目前槽位 client 綁同一 profile → disconnect 並清空槽位（fail-closed；下次 renderer `remote:connect` 會以新 pin 重連）。未變更 fingerprint 的 update 不得動槽位。回報區說明使用者可見影響（該 profile 視窗短暫斷線重連）。"
  - "🔴 依賴 T0431（同改 `electron/main.ts`）。開工前 `git log --oneline -8` 確認；`main.ts` commit 前 `git diff electron/main.ts` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0442 — remote client candidate 清理 + pin 變更 fail-closed

## 範圍

1. `loadProfileSnapshotDetailed` 失敗 candidate disconnect
2. `profile:update` fingerprint 變更 fail-closed
3. 測試：兩情境各自的正 / 負向（未變更 fingerprint 不動槽位；他 profile 的 update 不動槽位）

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [ ] 回報區附實機步驟（SSH tunnel profile 連線失敗後無殘留 ssh 子行程；改 fingerprint 後視窗以新 pin 重連）

## Sub-session 執行指示
1. 讀本工單 + T0430 / T0419 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
