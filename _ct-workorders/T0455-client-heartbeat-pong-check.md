---
schema_version: 1
schema_kind: workorder
id: T0455
title: "RemoteServer client heartbeat 檢查 pong：半開 client 連續錯過 2 次 pong 即 terminate，不再計入 T0404 client 數（避免孤兒 PTY 回收被延後）"
type: fix
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: XS
created_at: "2026-10-05T07:04:57+08:00"
started_at: "2026-10-05T07:06:00+08:00"
updated_at: "2026-10-05T07:08:57+08:00"
completed_at: "2026-10-05T07:08:57+08:00"
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

- [x] 測試：client 停止回 pong（例如 pause socket）→ 2 個週期後被 terminate、`getClientCount()` 減少、孤兒回收可觸發；只錯過 1 次後恢復 → 不斷線
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0451 回報區 + T0404 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先寫測試（紅）→ 實作（綠）；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 PASS（`electron/remote/remote-server.ts`、`electron/remote/__tests__/` 皆存在，資訊性）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- 驗收：
  - [x] 新增 `electron/remote/__tests__/client-heartbeat.test.ts`（5 案，真 `RemoteServer` + wss loopback + 暫存目錄憑證 + raw `ws` client，`heartbeatIntervalMs: 100`）：先寫測試跑出紅燈（3 failed：`CLIENT_MAX_MISSED_HEARTBEATS` 不存在、兩個半開 client 5 s 內未被斷線），實作後 5/5 綠
    - 半開 client（`autoPong: false` 且永不回 pong）→ 連線 1006 關閉、`getClientCount()` 2→1、收到 ≥ 2 次 ping 才斷（非第 1 次就斷）、`onClientDisconnect` 觸發 1 次、log `Client missed 2 heartbeats; terminated: Silent`、`onClientCountChange` 最後值 1；另一個正常 client 存活，期間 T0404 `HeadlessOrphanPtyReclaimer` 不回收，該 client 也離開後 count→0、reclaim 觸發
    - 半開 client 為唯一 client → 被 terminate 後 count→0、reclaimer 觸發回收
    - 隔一次才回 pong（每次只錯過 1 次）的 client → 收到 ≥ 8 次 ping 仍未斷線、count 仍 1、無 `missed` log
    - 正常 auto-pong client → 6 個週期後仍連線
  - [x] `npm run test:unit`：**155 files / 2471 passed / 1 skipped，0 failed**（T0451 基線 154 / 2466 + 本單 1 檔 5 案）
  - [x] `npx tsc --noEmit`：**37**，其中 1 筆為工作樹中他人未追蹤的 `src/lib/client-paths.ts`（`resolveClientPaths` 尚未在 preload 型別，疑為平行 T0437 進行中）；扣除後 **36**（≤ 36），`remote-server.ts` / 新測試 **0** 筆
  - 未跑 `npx vite build` / `npm run test:e2e`（依 memory_overrides L141）

### 產出摘要

全部在 `electron/remote/remote-server.ts`，沿用 T0451 對 helper 的做法：

- `AuthenticatedClient` 加 `alive: boolean`（auth 成功時 `true`）與 `missedHeartbeats: number`
- 新常數 `CLIENT_MAX_MISSED_HEARTBEATS = 2`（export）；heartbeat 間隔不變（`HEARTBEAT_INTERVAL_MS = 30_000`）
- `ws.on('pong')`：除 helper 外，client 收到任何 pong 即 `alive = true`、`missedHeartbeats = 0`
- heartbeat 週期：對每個 client，前一次 ping 未回 pong 則 `missedHeartbeats + 1`（有回則歸零）；達 2 → warn `[RemoteServer] Client missed 2 heartbeats; terminated: <label>` + `dropClient()` + `ws.terminate()`；否則 `alive = false` 再 `ping()`。迴圈改為迭代 `Array.from(this.clients.values())`（迴圈內會刪除）
- 時序：auth 後第 1 輪 ping → 第 2 輪計 1、仍 ping → 第 3 輪計 2 才斷 ⇒ 正式環境半開 client 約 60–90 s 內被清除（原本永不清除）
- 斷線事件：`dropClient()` 同步移除並觸發 `onClientDisconnect`（T0406 per-connection 清理）；同一 heartbeat 尾端既有的 `notifyClientCount()` 推送新計數（T0404 回收計時器隨之武裝）；之後 `terminate()` 觸發的 `close` 事件中 `dropClient` 為 no-op、`notifyClientCount` 計數未變不重複通知。broadcast 只迭代 `clients`，被移除後即不再送。Electron 本機 `RemoteServer` 為同一類別，同樣受益
- `remote:client-status-changed` 是 **client 端**（`RemoteClient` 偵測自己的 socket close → reconnecting）推給 renderer 的事件，server 端 terminate 送 RST，client 若仍在線即走既有 close/reconnect 路徑；真正半開（client 已不在）則無接收者，行為不變
- 相容性：BAT `RemoteClient`（`remote-client.ts:360`）以 `ws` 預設 `autoPong: true` 連線，自動回 pong，不受影響

### 遭遇問題

- `tsc` 37 筆中多出的 1 筆來自他人未追蹤檔 `src/lib/client-paths.ts`（非本單），未碰
- 殘餘風險：client 端事件迴圈若被阻塞超過約 60–90 s（無法回 pong）會被 server 斷線並觸發重連；依工單「連續 2 次」容忍度為塔台既定取捨
- 工作樹中他人未提交改動（`CLAUDE.md`、`docs/remote-dev-overview.md`、`scripts/*`、T0427/T0434/T0436/T0437 工單、PLAN-036、`headless-remote-tower-e2e.test.ts`、`src/lib/client-paths.ts` 等）未碰、未提交；未用 `git stash` / `reset` / `checkout --` / `restore`
- Commit：以 `git commit --only` 精準提交 `electron/remote/remote-server.ts` + `electron/remote/__tests__/client-heartbeat.test.ts` + 本工單（訊息含 `T0455`；hash 見 `git log`）；未 push

### 回報時間

2026-10-05T07:08:23+08:00
