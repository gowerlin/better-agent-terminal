---
schema_version: 1
schema_kind: workorder
id: T0443
title: "BUG-110：遠端 profile 視窗未連線時 proxied invoke fail-closed（結構化錯誤，不落本機）+ 連線狀態變化事件推給視窗"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-110
priority: P1
sizing: M
created_at: "2026-10-05T06:12:22+08:00"
started_at: null
updated_at: "2026-10-05T06:12:22+08:00"
completed_at: null
target_version: next
depends_on:
  - T0442
related:
  - "BUG-110；T0442 / T0430 回報區「遭遇問題」（既有路由落本機）"
  - "D134 追加（塔台 06:12 依授權直接決定）"
affects_files:
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/remote/remote-connect-plan.ts
  - src/App.tsx
  - src/components/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **路由規則**：`bindProxiedHandlersToIpc` 中，sender 是 remote profile 視窗時——ALWAYS_LOCAL channel 照舊本機（既有短路，不得改變）；其餘 channel 只有在槽位屬於該 profile 且已連線時才 `remoteClient.invoke`，否則**拋 / 回結構化錯誤**（code 例 `REMOTE_NOT_CONNECTED`，含 profileId），絕不呼叫本機 `invokeHandler`。本機（非 remote profile）視窗行為完全不變。判斷抽成純函式（放 `remote-connect-plan.ts` 或新模組）並單測全部分支。"
  - "🔴 **事件**：RemoteClient 連線狀態變化（connected / disconnected / reconnecting、槽位換手 / 清空）時，main 推送事件（例 `remote:client-status-changed`）給綁該 profile 的視窗；renderer 狀態列 / 既有 remote 狀態 UI 據此更新，並在 `REMOTE_NOT_CONNECTED` 時給一次可讀提示（i18n 三語，避免每個失敗 invoke 都 toast 洗版）。**不做自動重連**（範圍外）。"
  - "🔴 先盤點 renderer 端在 remote 視窗啟動 / 重連期間會呼叫哪些 proxied channel（例如 init 時的 pty:create / settings），確認 fail-closed 不會讓視窗開啟流程卡死或白畫面——必要時這些呼叫在收到 `REMOTE_NOT_CONNECTED` 時延後到 connected 事件再重試一次（只限 init 路徑），回報區列出處理點。"
  - "🔴 依賴 T0442（同改 `main.ts` / `remote-connect-plan.ts`）。T0426 / T0436 可能仍有 `main.ts` / `preload.ts` 未提交 hunk：commit 前 `git diff <file>` 確認，混有他人 hunk 時以 `git diff` 擷取本單 hunk + `git apply --cached` 精準 stage（T0431 / T0442 做法），不得夾帶。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push；不部署 WSL。"
---

# T0443 — 遠端視窗 fail-closed 路由（BUG-110）

## 範圍

1. 路由純函式 + `bindProxiedHandlersToIpc` 改寫（memory_overrides 第 1 條）
2. 連線狀態事件 + renderer 狀態 / 提示（第 2 條）
3. init 路徑盤點與處理（第 3 條）
4. 測試：路由矩陣（本機視窗 / remote 視窗 × ALWAYS_LOCAL / proxied × 已連線同 profile / 未連線 / 槽位他 profile / 槽位空）；事件推送對象正確；renderer 收到錯誤 code 的提示只出現一次

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] 回報區附 init 路徑盤點、實機步驟（WSL profile 視窗開著時 `wsl --shutdown` 或停 bat-server → 視窗操作得到錯誤提示而非本機 shell；兩個不同 remote profile 同時開窗 → 先開者顯示未連線而非本機執行）
- [ ] BUG-110 改 `FIXED`（多 profile 同時連線仍為已知限制，寫入 BUG-110）

## Sub-session 執行指示
1. 讀本工單 + BUG-110 + T0430 / T0442 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 盤點 → 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 實際改動檔 + 本工單 + BUG-110（精準 stage）；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
