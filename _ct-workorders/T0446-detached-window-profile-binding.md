---
schema_version: 1
schema_kind: workorder
id: T0446
title: "BUG-112：detached workspace 視窗綁回父視窗的 profile——proxied 路由套 T0443 fail-closed、remote 事件轉發含 detached 視窗"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-112
priority: P1
sizing: S
created_at: "2026-10-05T06:28:31+08:00"
started_at: null
updated_at: "2026-10-05T06:28:31+08:00"
completed_at: null
target_version: next
depends_on:
  - T0443
related:
  - "BUG-112；T0443（`72ac25c`）回報區「遭遇問題」；`planProxiedInvokeRoute`（`electron/remote/remote-connect-plan.ts`）"
  - "D134 追加（塔台 06:28 依授權直接決定）"
affects_files:
  - electron/main.ts
  - electron/remote/remote-connect-plan.ts
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先盤點**：`workspace:detach` / reattach / 關閉的生命週期，`detachedWindows` 結構，所有以 `getWindowIdByWebContents` / `windowMap` 判斷 sender 身分的地方（不只 `bindProxiedHandlersToIpc`：還有 `remote:client-status`、`remote:connect`（T0419 綁定判斷）、`getWindowsForProfile` / 事件轉發、path-aware 轉換取 translator 的地方）。回報區附清單與每處處理。"
  - "🔴 修法：detached 視窗解析出其父視窗（或 profileId），在上述各處與 `windowMap` 視窗同等對待；**無法解析時 fail-closed**（remote 判斷不明 → 不落本機：若父視窗已不存在，以 detach 時記錄的 profileId 判斷）。本機 profile 的 detached 視窗行為不變。判斷抽純函式並單測。"
  - "🔴 T0436 可能仍有 `main.ts` 未提交 hunk：commit 時以 `git diff` 擷取本單 hunk + `git apply --cached` 精準 stage（T0431 / T0442 / T0443 做法），不得夾帶。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push。"
---

# T0446 — detached 視窗 profile 綁定（BUG-112）

## 範圍

1. 盤點（memory_overrides 第 1 條）
2. detached 視窗 → profile 解析 + 各處套用
3. 測試：remote profile detached 視窗 × 已連線 / 未連線 → 遠端 / 拒絕；本機 detached 不變；父視窗關閉後仍 fail-closed；事件轉發包含 detached 視窗

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] 回報區附盤點清單與實機步驟（WSL profile 視窗 detach 一個 workspace → 終端為遠端 shell；停 bat-server → detached 視窗顯示未連線而非本機）
- [ ] BUG-112 改 `FIXED`

## Sub-session 執行指示
1. 讀本工單 + BUG-112 + BUG-110 + T0443 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 盤點 → 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 實際改動檔 + 本工單 + BUG-112（精準 stage）；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
