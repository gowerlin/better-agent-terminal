---
schema_version: 1
schema_kind: workorder
id: T0455
title: "RemoteServer client heartbeat 檢查 pong：半開 client 連續錯過 2 次 pong 即 terminate，不再計入 T0404 client 數（避免孤兒 PTY 回收被延後）"
type: fix
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: XS
created_at: "2026-10-05T07:04:57+08:00"
started_at: null
updated_at: "2026-10-05T07:04:57+08:00"
completed_at: null
target_version: next
depends_on:
  - T0451
related:
  - "T0451（`283337a`）回報區「遭遇問題」：client heartbeat 只 `ping()` 不檢查 pong；helper heartbeat 已於 T0451 比照處理（可沿用其做法）"
  - "T0404（孤兒 PTY 回收依 client 數）"
  - "D134 追加（塔台 07:05 依授權直接決定）"
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
  - "🔴 沿用 T0451 對 helper 的 heartbeat 做法（`isAlive` 旗標 / pong listener）套到 client：每個 heartbeat 週期若前一次 ping 未收到 pong 計 1，**連續 2 次**未收到才 `terminate()` 並自 `clients` 移除（容忍 SSH tunnel / 慢網路短暫延遲；不得 1 次就斷）。收到任何 pong 即歸零。heartbeat 間隔不改。"
  - "🔴 Electron 本機 RemoteServer 同樣受益；確認既有 client 斷線事件（`remote:client-status-changed`、T0404 回收計數、broadcastHub）在 terminate 路徑上照常觸發。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；取紅燈證據也不得以 `git show HEAD:… >` 覆寫檔案，改用「先寫測試看紅、再實作」）；不 push。"
---

# T0455 — client heartbeat pong 檢查

## 驗收條件

- [ ] 測試：client 停止回 pong（例如 pause socket）→ 2 個週期後被 terminate、`getClientCount()` 減少、孤兒回收可觸發；只錯過 1 次後恢復 → 不斷線
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0451 回報區 + T0404 回報區
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
