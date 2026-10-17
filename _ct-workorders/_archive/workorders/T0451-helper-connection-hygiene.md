---
schema_version: 1
schema_kind: workorder
id: T0451
title: "T0445 #9：helper 連線衛生——拒絕 log 的 channel 限長跳脫、每權杖連線數上限、helper 拒絕節流、heartbeat 涵蓋 helper"
type: fix
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: XS
created_at: "2026-10-05T06:32:48+08:00"
started_at: "2026-10-05T06:59:03+08:00"
updated_at: "2026-10-05T07:04:47+08:00"
completed_at: "2026-10-05T07:04:47+08:00"
target_version: next
depends_on:
  - T0450
related:
  - "T0445 finding #9、拆單 5"
  - "D134 追加（塔台 06:32 依授權直接決定）"
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
  - "🔴 拒絕 log 的 `channel`：非字串直接拒（不 log 原值）、字串截至 64 字元並跳脫控制字元；每權杖同時連線 ≤ 4；helper 被拒次數節流（例如 1 分鐘內 > 30 次拒絕 → terminate）；heartbeat ping / terminate helper（比照 client）。"
  - "🔴 依賴 T0450（同改 `remote-server.ts`）。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push。"
---

# T0451 — helper 連線衛生（T0445 #9）

## 驗收條件

- [x] 測試：含換行 / 超長 channel 的 log 被截斷跳脫；第 5 條同權杖連線被拒；拒絕節流觸發 terminate；半開 helper 被 heartbeat 清除
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39

## Sub-session 執行指示
1. 讀本工單 + T0445 #9 + T0450 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 PASS（`electron/remote/remote-server.ts` 存在、`electron/remote/__tests__/` 存在，資訊性）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；依賴 T0450 已在 `7effa79`
- 驗收：
  - [x] 新增 `electron/remote/__tests__/helper-connection-hygiene.test.ts`（22 案，真 `RemoteServer` + wss loopback + 暫存目錄憑證 + raw `ws` helper）：channel 含 `\n` / `\r\n` + 偽造 `[RemoteServer] Client authenticated: Evil` → 單行、跳脫為 `\\n`、無偽造行；100 000 字 channel → log 只帶 64 字 + `…(+99936 chars)`；number / object / 缺 channel → `Forbidden: channel-not-allowed`，log 只寫 `<number>` / `<object>` / `<undefined>`、不含原值；同權杖第 5 條連線 → `Too many helper connections`（其他權杖、server token 不受影響，關掉一條後可再連）；第 31 次拒絕 → 連線 terminate（1006）、只 log 30 行拒絕 + 1 行 throttled，之後同權杖 auth → `Too many denied requests` 且不再寫 log；connection-limit 拒絕同樣計入節流；`autoPong: false` 的半開 helper 在 heartbeat 後被 terminate、正常 helper 存活；半開連線清除後釋放連線名額
  - [x] `npm run test:unit`：**154 files / 2466 passed / 1 skipped，0 failed**（stderr 的 `AttachConsole failed` 為 node-pty conpty agent 既有雜訊）；`npx tsc --noEmit`：**36**（≤ 39）
  - 未跑 `npx vite build` / `npm run test:e2e`（依 memory_overrides L141）

### 產出摘要

全部在 `electron/remote/remote-server.ts`：

- **(a) 拒絕 log 的 `channel`**：新增 `formatLogChannel(channel)`（export）—— 非字串只寫型別（`<number>` / `<object>` / `<array>` / `<null>` / `<undefined>` …），不 log 原值；字串截至 `HELPER_LOG_CHANNEL_MAX_CHARS = 64`（不切斷 surrogate pair，附 `…(+N chars)`），C0 / DEL / C1 / U+2028 / U+2029 / 反斜線跳脫（`\n` `\r` `\t` `\xNN` `\uNNNN` `\\`）。一般 channel（如 `fs:readdir`）輸出不變，既有 log 斷言（`headless-helper-capability.test.ts`）不受影響
- **非字串 channel 直接拒**：`handleHelperFrame` 原本 `frame.type !== 'invoke' || !frame.channel` 對缺 / 空 / falsy channel **靜默丟棄**；改為只過濾非 invoke，channel 交 `authorizeHelperInvoke`（已 `typeof channel !== 'string'` → `channel-not-allowed`）⇒ 一律回 `Forbidden: channel-not-allowed` 並計入節流
- **(b) 每權杖連線上限**：`HELPER_MAX_CONNECTIONS_PER_CAPABILITY = 4`；`acceptHelper` 改回傳 `'accepted' | 'rejected' | 'connection-limit' | 'throttled'`，以 `capabilityKey` 計數現有 helper 連線（排除自身 socket）；超過 → `auth-result` error `Too many helper connections` + close，**不**計入 server-token / capability 的 IP 失敗計數
- **(c) helper 拒絕節流**：`HELPER_DENIAL_THRESHOLD = 30` / `HELPER_DENIAL_WINDOW_MS = 60_000`，per capability key（重連不會重置）。`recordHelperDenial` / `isHelperThrottled`（export）。第 31 次拒絕 → 回 `Forbidden: too-many-denials`（terminate 時不保證送達）、`dropHelper` + `ws.terminate()`，並寫**一行** `Helper throttled`；之後窗口內同權杖 auth → `Too many denied requests`（不 log）。connection-limit 拒絕也計入（擋重連迴圈灌 log）。窗口過期項目在 heartbeat 清除；`stop()` 清空
- **(d) heartbeat 涵蓋 helper**：`HelperConnection.alive`；`ws.on('pong')` 標記存活；heartbeat 對 helper `ping()`，上一輪未回 pong 的 → warn `Helper missed a heartbeat; terminated` + `dropHelper` + `terminate()`。新增選項 `heartbeatIntervalMs`（預設 `HEARTBEAT_INTERVAL_MS = 30_000`，原硬編 `30000`），供測試縮短

**Commit**：`283337a`（訊息含 `T0451`，`git commit --only` 精準提交 `remote-server.ts` + 新測試 + 本工單；未 push）

### 遭遇問題

- **client heartbeat 未比照**：client 端 heartbeat 原本只 `ping()`、不檢查 pong（半開 client 也不會被清除，且持續計入 T0404 client 數 → 可能延後孤兒 PTY 回收）。本單範圍限 helper，未改 client 行為以免回歸；建議塔台評估另開小單
- **`too-many-denials` 回應不保證送達**：送出後立即 `terminate()`（沿用 T0447 理由：close 的 CLOSING 窗口仍會收 frame），socket destroy 可能丟棄未 flush 的資料；測試只斷言連線 1006 關閉，不斷言收到該回應
- terminate 後同一 TCP chunk 內已緩衝的 frame 會走 T0447 的 default-deny 路徑（每 frame 一行無攻擊者內容的 warn），量受單一 chunk 限制，未另行處理
- 編輯時 regex 內 `  ` 曾被寫成實際字元（TS1161），已改回跳脫序列；最終以 `tsc` 單檔檢查確認 `remote-server.ts` 無新增型別錯誤（剩餘 `WebSocket.RawData` / `args: unknown` 兩類錯誤在 HEAD 即存在，屬臨時旗標產物）
- 工作樹中他人未提交改動（`CLAUDE.md`、`docs/remote-dev-overview.md`、`scripts/*`、`src/components/*AgentPanel.tsx`、`src/lib/snippet-context.ts`、T0434 的 `headless-remote-tower-e2e.test.ts`、其他工單 / `_tower-state.md`）未碰、未提交；未用 `git stash` / `reset` / `checkout --` / `restore`

### 回報時間

2026-10-05T07:04:08+08:00
