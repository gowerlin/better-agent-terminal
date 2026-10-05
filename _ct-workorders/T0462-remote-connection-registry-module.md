---
schema_version: 1
schema_kind: workorder
id: T0462
title: "PLAN-039 工單 1：per-profile connection registry 模組（remote-connection-registry.ts）+ remote-connect-plan.ts 純函式改以 profile 為鍵；上限 8、閒置寬限 15 s、同 target 偵測；只單元測試，不接 main.ts"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-039
priority: P2
sizing: M
created_at: "2026-10-05T11:29:43+08:00"
started_at: null
updated_at: "2026-10-05T11:29:43+08:00"
completed_at: null
target_version: next
depends_on: []
related:
  - "T0459 研究（`49d71f9`）回報區「建議方向」資料結構 / 生命週期 / 測試策略與拆單第 1 列；使用者 Q1-Q3 裁決（最後視窗關閉 + 寬限期、上限 8、同 target 允許 + warn）"
  - "D135（PLAN-039 拆單，下 session 起派）"
affects_files:
  - electron/remote/remote-connection-registry.ts
  - electron/remote/remote-connect-plan.ts
  - electron/remote/__tests__/
  - electron/__tests__/remote-connect-plan.test.ts
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **規格來源**：T0459 回報區「建議方向」與 §2 表（純函式以 profile 為鍵）。新模組不 import electron，client factory 注入。`MAX_CONCURRENT_REMOTE_PROFILES = 8`、`IDLE_GRACE_MS = 15_000`、開窗保護 60 s；每 profile 一把 mutex；上限佔位在同步區段完成。"
  - "🔴 **不接 `main.ts`**（工單 2 / T0463）；既有 `remote-connect-plan.ts` 函式若改簽章，保留舊匯出供 `main.ts` 繼續編譯（或新增函式不動舊的），本單結束時 `main.ts` 行為與 HEAD 相同。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；不得以 `git show HEAD:… >` 覆寫取紅燈）；寫檔維持 LF；不 push。"
---

# T0462 — connection registry 模組（PLAN-039 工單 1）

## 驗收條件

- [ ] 單元：fake timers 驗寬限期 / 到期重算 / 取消；第 9 個 admission 拒絕且不擠掉既有；同時兩個 admission 不超額；同 target 偵測；per-profile mutex 串行
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0459 回報區全文 + `electron/remote/remote-connect-plan.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先寫測試（紅）→ 實作（綠）；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
