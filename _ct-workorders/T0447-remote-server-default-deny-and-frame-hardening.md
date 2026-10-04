---
schema_version: 1
schema_kind: workorder
id: T0447
title: "T0445 #1/#2/#3（critical/high）：RemoteServer 連線狀態預設拒絕（撤銷後 helper 不得落入 client invoke）、helper channel 原型鍵防護、未認證 null frame / message handler 例外防護、bat-server.mjs 程序級 handler"
type: fix
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P0
sizing: S
created_at: "2026-10-05T06:32:48+08:00"
started_at: null
updated_at: "2026-10-05T06:32:48+08:00"
completed_at: null
target_version: next
depends_on: []
related:
  - "T0445 安全 review（`2161b7e`）findings #1 / #2 / #3 與拆單 1；結論 BLOCK"
  - "T0432（`aec20c0`）"
  - "D134 追加（塔台 06:32 依授權直接決定）"
affects_files:
  - electron/remote/remote-server.ts
  - electron/remote/helper-capability.ts
  - scripts/bat-server.mjs
  - electron/remote/__tests__/
  - scripts/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **規格來源**：T0445 回報區 findings #1 / #2 / #3 的「觸發情境」與「建議修法」欄，逐條落實，並把 T0445 scratchpad PoC 的情境改寫成 repo 內負向測試（PoC 原檔在 scratchpad 不可依賴，依 findings 描述重寫）。"
  - "🔴 #1：已認證連線的 invoke **預設拒絕**——只有 `this.clients.has(ws)` 才走 client 路徑、只有 `helpers.has(ws)` 才走 helper 路徑，兩者皆非 → 回錯並 `ws.terminate()`；撤銷分支改 `terminate()`（不留 CLOSING 窗口）。測試：撤銷後 pipelined frame 與延遲 frame（client 不回 close frame）都不得到達 `invokeHandler`（以 spy 斷言零呼叫，並斷言 PTY 未被建立）。"
  - "🔴 #2：`HELPER_CHANNEL_ROLES` 查表改 `Object.hasOwn` / `Map` / null-prototype，先驗 `typeof channel === 'string'`；`handleHelperFrame` 全段 try（例外 = invoke-error）。測試 `constructor` / `__proto__` / `toString` / `hasOwnProperty` / `valueOf` / 非字串 channel。"
  - "🔴 #3：`JSON.parse` 後驗 frame 為非 null 物件、`type` 為字串，否則 close；整個 message handler 包 try。`scripts/bat-server.mjs` 加 `unhandledRejection` / `uncaughtException` 記錄 handler（只記錄、不吞掉致命錯誤的語意需說明：uncaughtException 記錄後是否結束行程，回報區說明取捨）。測試：未認證 `null` / `1` / `\"str\"` / `[]` frame 不使 server 行程結束。"
  - "🔴 Electron 本機 RemoteServer 行為：只有預設拒絕變嚴（不存在於 clients 的已認證 socket 本來就不該 invoke），其餘不變。"
  - "🔴 T0433 平行改 `headless-entry.ts` / `pty-manager.ts` / bundle 腳本；本單不碰那些檔。共用檔若被動到，以 `git diff` + `git apply --cached` 精準 stage。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push；不部署 WSL。"
---

# T0447 — RemoteServer 預設拒絕 + frame 強化（T0445 #1/#2/#3）

## 範圍

見 memory_overrides 第 2-4 條。

## 驗收條件

- [ ] 三個 finding 各有負向測試，並附「修正前會失敗」的證據（例如先寫測試看到紅，再修綠；回報區記錄）
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] 回報區逐條對應 T0445 #1 / #2 / #3

## Sub-session 執行指示
1. 讀本工單 + T0445 回報區全文 + T0432 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先寫負向測試（紅）→ 修 → 綠
4. 填回報區；完成寫 **`DONE`**
5. commit 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
