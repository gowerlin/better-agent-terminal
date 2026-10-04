---
schema_version: 1
schema_kind: workorder
id: T0430
title: "T0419 後續：remote:connect 以 pin 重連失敗時，舊 client 未 disconnect（背景自動重連且失去參照）"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-096
priority: P2
sizing: S
created_at: "2026-10-05T05:47:15+08:00"
started_at: null
updated_at: "2026-10-05T05:47:15+08:00"
completed_at: null
target_version: next
depends_on:
  - T0422
related:
  - "T0419 回報區「遭遇問題」未修項；commit `038c98e`（`remote-connect-plan.ts`）"
  - "D134 追加（使用者 05:46 斷點 C 裁決）"
affects_files:
  - electron/main.ts
  - electron/remote/remote-connect-plan.ts
  - electron/__tests__/remote-connect-plan.test.ts
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先確認現況**：以程式碼證據說明 `remote:connect` 的 `connect` 分支連線失敗時，舊 `remoteClient` 的實際狀態（是否仍在自動重連、`remoteClientProfileId` / `remoteClientTargets` 是否一致、其他依賴 `remoteClient` 的地方會看到什麼）。"
  - "🔴 修法須守 T0419 的不變式：`reject` 分支（未發生網路動作）**不動**現有槽位；只處理「已決定重連且連線失敗」。決定是 (a) 失敗時 disconnect 舊 client 並清空槽位，或 (b) 失敗時保留舊 client（不清空參照）——依現況結論擇一，回報區說明理由。不得讓同時存在兩個無人持有參照的 client。"
  - "🔴 依賴 T0422（同改 `electron/main.ts`）。開工前 `git log --oneline -5` 確認。`main.ts` commit 前 `git diff electron/main.ts` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0430 — remote:connect 失敗分支舊 client 處理

## 背景

T0419 指出：`remote:connect` 實際連線失敗的既有分支只把 `remoteClient = null`，沒有 `disconnect()` 舊 client → 舊 client 可能仍在背景連線 / 自動重連且失去參照。T0419 改為重用後，正常路徑不再走到此分支，但「以 pin 重連失敗」時仍會發生。

## 範圍

1. 現況確認（memory_overrides 第 1 條）
2. 修正失敗分支；若邏輯可放進 `remote-connect-plan.ts` 或新純函式則一併單測
3. 測試：連線失敗後無殘留連線中的孤兒 client；`reject` 分支不動槽位（既有測試維持綠）

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [ ] 回報區附現況結論與修法理由

## Sub-session 執行指示
1. 讀本工單 + T0419 回報區 + BUG-096
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
