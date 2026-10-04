---
schema_version: 1
schema_kind: workorder
id: T0448
title: "T0445 #4：pty:restart 保留原 PTY 的 customEnv（BAT_TOWER_TERMINAL_ID）/ capability 角色，worker 重啟後不升為 tower"
type: fix
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: XS
created_at: "2026-10-05T06:32:48+08:00"
started_at: null
updated_at: "2026-10-05T06:32:48+08:00"
completed_at: null
target_version: next
depends_on:
  - T0433
related:
  - "T0445 finding #4 / 拆單 2（審查時為 T0433 工作樹版本）"
  - "D134 追加（塔台 06:32 依授權直接決定）"
affects_files:
  - electron/pty-manager.ts
  - electron/remote/headless-entry.ts
  - electron/__tests__/
  - electron/remote/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 先確認 T0433 commit 後的實際程式（`PtyManager.restart` 是否仍丟 `customEnv`、`buildHeadlessHelperEnv` 依什麼決定角色）。若 T0433 已自行修正，回報區附證據、只補「restart 後角色 / towerId 不變」測試即可 DONE。"
  - "🔴 修法偏好：restart 沿用原 PTY 的 `customEnv`（至少 `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE`）；並確認舊權杖撤銷、新權杖角色與 towerId 與舊者一致。本機 Electron restart 行為不得改變（測試鎖住）。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；共用檔精準 stage；不 push。"
---

# T0448 — restart 保留權杖角色（T0445 #4）

## 驗收條件

- [ ] 測試：worker PTY restart 後仍為 worker、towerId 相同、不可 `create-agent-command`；tower PTY restart 後仍為 tower；舊權杖失效
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39

## Sub-session 執行指示
1. 讀本工單 + T0445 #4 + T0433 回報區
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
