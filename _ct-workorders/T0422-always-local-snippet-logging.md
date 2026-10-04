---
schema_version: 1
schema_kind: workorder
id: T0422
title: "PLAN-036 P3 / J：snippet:*、settings:get-logging-info、settings:cleanup-logs 改列 always-local（ALWAYS_LOCAL_CHANNELS + parity / 分類表同步）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: S
created_at: "2026-10-05T05:35:22+08:00"
started_at: null
updated_at: "2026-10-05T05:35:22+08:00"
completed_at: null
target_version: next
depends_on:
  - T0417
related:
  - "T0386 建議清單 J（回報區約 :262）；PLAN-036 P3"
  - "T0416（全分類守門）/ T0406（PROXIED_EVENTS 分類守門）"
  - "D134（本 session 排程表第 6 列）"
affects_files:
  - electron/main.ts
  - electron/remote/headless-channel-status.ts
  - electron/remote/path-aware-channels.ts
  - electron/remote/protocol.ts
  - electron/remote/headless-entry.ts
  - electron/handlers/claude.ts
  - electron/remote/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先確認語意**：以程式碼證據說明 always-local 對遠端 profile 視窗的實際效果（呼叫在本機 Electron 執行、不代理到 headless）。snippet 是**本機 DB 的使用者片段**、logging info / cleanup 是**本機 BAT 的 log**——確認這正是使用者在遠端視窗應該看到的行為（遠端視窗的設定頁「日誌」顯示本機 log 路徑）。若發現某個 channel 改 always-local 會讓遠端視窗功能變差，該 channel 不改並在回報區說明。"
  - "🔴 依賴 T0417（同改分類表）。派發時 T0417 應已 commit；開工前 `git log --oneline -3` 確認。"
  - "🔴 同工作樹有其他 Worker 平行。`electron/main.ts` 只改相關註冊段。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL。"
---

# T0422 — J：always-local 改分類

## 背景

T0386 建議清單 J：`snippet:*`（better-sqlite3，本機 DB）、`settings:get-logging-info`、`settings:cleanup-logs` 目前列在 `PROXIED_CHANNELS` / `HEADLESS_UNSUPPORTED`（遠端視窗呼叫會打到 headless，回 unsupported），語意上應在本機執行 → 改進 `ALWAYS_LOCAL_CHANNELS`，parity 清單同步。T0401 已有前例（`claude:archive-*` 三個改 always-local）。

## 範圍

1. 語意確認（memory_overrides 第 1 條）
2. 移到 `ALWAYS_LOCAL_CHANNELS`（找出 SoT：`headless-channel-status.ts` / `main.ts` 綁定處），從 `HEADLESS_UNSUPPORTED` / `PROXIED_CHANNELS` / `PATH_FREE_CHANNELS` 等清單移除；比照 T0401 的 archive 三個 channel 做法
3. parity / 全分類守門測試更新；新增測試：遠端 profile 視窗呼叫這些 channel 時走本機 handler（比照既有 always-local 測試）
4. 回報區附 `HEADLESS_UNSUPPORTED` 計數前後

## 驗收條件

- [ ] 回報區附語意確認結論
- [ ] `npm run test:unit` 全綠（基線以 T0417 完成後為準）；`npx tsc --noEmit` ≤ 40
- [ ] PLAN-036 檔 P3 段補一行 J 完成註記（工單編號 + commit）

## Sub-session 執行指示
1. 讀本工單 + T0386 回報區 J 列 + T0401 回報區（archive always-local 做法）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + PLAN-036；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
