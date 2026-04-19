# T0200 — BUG-046 dispatcher 防禦性修復:try/catch + timeout + 卡點 log

## 元資料

- **編號**:T0200
- **類型**:實作(trivial-medium,scripts/bat-terminal.mjs 範圍)
- **狀態**:✅ DONE(2026-04-20 第十六 session rescan 升級 — 防禦性修復 code 已 commit,階段目標達成;BUG-046 由 T0202b 實證派發成功後於 2026-04-19 CLOSED)
- **估時**:30-50 min(grep ~5 + code ~15-20 + 本地測試 ~10-15 + 回報 ~5)
- **建立時間**:2026-04-19 02:25 (UTC+8)
- **開始時間**:2026-04-19 02:28 (UTC+8)
- **完成時間**:2026-04-19 02:42 (UTC+8)
- **關聯**:BUG-046、T0192/T0193(日誌儀表)、T0194 派發實錄
- **優先級**:🔴 High(阻擋塔台 yolo 自動派發,有 workaround 但長期不可接受)

## 前置條件

- 閱讀 `_ct-workorders/BUG-046-bat-dispatch-interactive-flag-silent-fail.md`(完整根因分析 + 翻案說明)
- 閱讀 `scripts/bat-terminal.mjs` 全檔,特別是:
  - line 436 附近(auth `waitForMessage`)
  - line 480 附近(invoke `waitForMessage`)
  - `main()` 及其 `.catch()` 處理
- 閱讀 T0192 建立的 `_bat-logger.mjs`(NDJSON 事件 log 模組)

## 背景(簡版)

T0194 派發 4 次連續 silent fail,root cause 假設是 auth token mismatch(BAT restart 後舊 token 被 server 認不出)。現象:
- `invoke` → `parsed` 後**無聲消失**,`bat-scripts.log` 無 exit 事件
- bash 看到 exit code 0(子進程被外部終止)
- 降級 `--no-interactive` 也失敗(非 flag-specific)

**無論 root cause 如何**,dispatcher 自身沒 try/catch 包 `waitForMessage` 就是 bug — timeout 會變 unhandled rejection 靜默死亡,main().catch() 救不到。

## 任務

### Step 1:結構 grep + line 確認

```bash
grep -n "waitForMessage\|await.*ws\.\|main().catch\|setTimeout\|unhandled" scripts/bat-terminal.mjs
grep -n "logger\.\|bat-logger\|logEvent" scripts/bat-terminal.mjs
```

**期待產出**:
- 所有 `waitForMessage` 呼叫點(預計 2 處:auth、invoke)
- 目前的 log 事件名稱清單(確認不撞名)
- `main()` 入口和錯誤處理位置

### Step 2:設計修改

**A. 包 try/catch**(兩個 await 點):

```javascript
// before (line 436 附近, auth)
await waitForMessage(ws, 'auth-success', 5000)

// after
logger.log('await-auth-response', { timeout: 5000 })
try {
  await waitForMessage(ws, 'auth-success', 5000)
} catch (err) {
  logger.log('exit', {
    reason: 'auth-timeout',
    error: err?.message || String(err),
    hint: 'BAT_REMOTE_TOKEN may be stale. Try restart this terminal or re-export token from BAT app.'
  })
  process.exit(1)
}
```

同樣處理 invoke `waitForMessage`(line 480 附近),reason 改為 `invoke-timeout`。

**B. main() unhandled 保險網**(若現況不完善):

```javascript
// 若現在沒有全域 unhandledRejection handler,補一個:
process.on('unhandledRejection', (reason) => {
  logger.log('exit', {
    reason: 'unhandled-rejection',
    error: reason?.message || String(reason),
    stack: reason?.stack
  })
  process.exit(1)
})
```

若現況已有 handler,確認它會寫 log 再 exit,不要只印 console。

**C. hint 訊息內容**(UX 考量):

auth-timeout 的 hint 要讓使用者立刻知道怎麼自救:
- 「BAT_REMOTE_TOKEN may be stale. Try restart this terminal or re-export token from BAT app.」

invoke-timeout 的 hint:
- 「Invoke response not received in Xms. Check BAT app is running and log at %APPDATA%/BetterAgentTerminal/Logs/bat-scripts.log」

### Step 3:保守原則

- **不重寫 waitForMessage**:目前實作可能 race condition,但本張不碰(範圍守護)
- **不改 timeout 值**:保持現有 5000ms(或實際值),只是把它包起來
- **不改 auth 流程本身**:token 取得/送出邏輯不動
- **不加新 cli flag**:不引入 debug mode / verbose 等新選項

### Step 4:本地測試(模擬三種失敗)

**測試 1:token 錯誤**
```bash
# 備份當前 token,換一個假的
BAT_REMOTE_TOKEN_ORIG=$BAT_REMOTE_TOKEN
export BAT_REMOTE_TOKEN="fake-token-$(date +%s)"
node scripts/bat-terminal.mjs --workspace "$BAT_WORKSPACE_ID" --mode off claude "echo test"
export BAT_REMOTE_TOKEN="$BAT_REMOTE_TOKEN_ORIG"
```

**期望**:
- 不再 silent hang
- `bat-scripts.log` 出現 `await-auth-response` 後 `exit { reason: 'auth-timeout' }`
- stdout 看到 hint 訊息
- exit code 1(非 0)

**測試 2:port 關閉**(模擬 BAT app 沒開)
```bash
BAT_REMOTE_PORT_ORIG=$BAT_REMOTE_PORT
export BAT_REMOTE_PORT=59999  # 假設沒服務
node scripts/bat-terminal.mjs --workspace "$BAT_WORKSPACE_ID" --mode off claude "echo test"
export BAT_REMOTE_PORT="$BAT_REMOTE_PORT_ORIG"
```

**期望**:
- WebSocket connect 失敗,明確 log `exit { reason: 'connect-failed' }` 或類似
- 不 hang

**測試 3:正常派發**(確認沒破壞)
```bash
node scripts/bat-terminal.mjs --workspace "$BAT_WORKSPACE_ID" --mode off --no-interactive claude "echo T0200-verify"
```

**期望**:
- 正常開 terminal 執行指令
- `bat-scripts.log` 完整事件鏈(parsed → await-auth-response → auth-success → await-invoke-response → invoke-success → terminal-created → exit)
- 若現在正常派發也 hang → 證實 BUG-046 token 假設,本張已能清楚看到卡在哪 event

### Step 5:log 檢視

完成本地測試後:
```bash
tail -200 %APPDATA%/BetterAgentTerminal/Logs/bat-scripts.log | grep -E "await-auth-response|await-invoke-response|exit" | tail -20
```

把最後 20 行 NDJSON 記到回報區(方便未來 debug 比對)。

### Step 6:Commit

```
fix(bat-dispatcher): wrap waitForMessage with try/catch and timeout logs (BUG-046, T0200)

Previously silent hang when auth token stale or invoke never replied.
waitForMessage rejections escaped main().catch() via unhandled
rejection, leaving bash exit 0 with no diagnostic.

Changes in scripts/bat-terminal.mjs:
- Wrap auth waitForMessage: log await-auth-response + exit reason=auth-timeout
- Wrap invoke waitForMessage: log await-invoke-response + exit reason=invoke-timeout
- Global unhandledRejection handler: log exit reason=unhandled-rejection
- User-facing hint strings suggest concrete remedies (token refresh / BAT app check)

No behavioral change when auth/invoke succeed. Locally verified 3 failure
modes (token invalid / port closed / normal) produce clear exit events.

Refs: BUG-046, T0192/T0193
```

## 驗收標準

- [ ] `scripts/bat-terminal.mjs` 兩處 `waitForMessage` 包 try/catch
- [ ] 各加 `await-*-response` + `exit { reason: '*-timeout' }` NDJSON log 事件
- [ ] `unhandledRejection` handler 存在且會寫 log 再 exit(補或確認)
- [ ] Hint 訊息包含 token 和 BAT app check 指引
- [ ] 本地測試 1(假 token)產生 auth-timeout exit 事件,不 hang
- [ ] 本地測試 2(假 port)產生連線失敗 exit 事件,不 hang
- [ ] 本地測試 3(正常派發)仍正常工作,完整事件鏈
- [ ] 回報區含:grep 結果、最後 20 行 NDJSON log、三個測試結果

## 禁止

- ❌ 不動 `electron/remote/*`(範圍守護,Electron 端另案 Q3.A 決策)
- ❌ 不改 `waitForMessage` 實作本身
- ❌ 不改 auth 流程 / token 取得邏輯
- ❌ 不引入新 cli flag 或 debug mode
- ❌ 不做跨平台測試(Windows 優先,其他平台由 CI 涵蓋)
- ❌ 若本地測試 3(正常派發)失敗 → **停手回報**,可能 token 真的失效,不要硬改

## 回報區

### 完成狀態:PARTIAL

**原因**:程式碼防禦已落地且通過語法與 Test 2 驗證;**但 Test 1 / Test 3 無法按工單期望驗證**,因實機環境下 `ws.connect` 在 HTTP upgrade 階段就靜默卡住(server 收到 GET 後直接 close socket,不回 101),根本到不了 `waitForMessage`。此屬另一個 bug(MinimalWS.connect 的 close handler 只清 timer 不 reject → Promise pending → event loop 空 → node 以 exit 0 靜默退出),超出本工單「不重寫 waitForMessage / 不改 auth 流程」的保守範圍。依 §禁止「若本地測試 3 失敗 → **停手回報**」,不硬改。

### Step 1 grep 結果

- `waitForMessage` 呼叫點(line 和用途):
  - `scripts/bat-terminal.mjs:436`(改前):auth 回應等待
  - `scripts/bat-terminal.mjs:480`(改前):invoke 回應等待
  - `scripts/bat-terminal.mjs:400`:function 本體定義(預設 timeoutMs=3000)
- 現有 log 事件清單(`bat-terminal` script):
  - `invoke`(entry)、`parsed`、`exit{reason:no-command|no-BAT_REMOTE_PORT|no-BAT_REMOTE_TOKEN|connect-failed|auth-failed|terminal-create-failed|unhandled|code:0}`、`invoke-create-with-command`、`terminal-created`
  - **新增**(本工單):`await-auth-response`、`await-invoke-response`、`exit{reason:auth-timeout|invoke-timeout|unhandled-rejection}`
- `main()` 錯誤處理位置:
  - `scripts/bat-terminal.mjs:496`(改前)/`:514`(改後):`main().catch(err => logEvent('exit',reason:'unhandled'))`
  - 改後另加 `process.on('unhandledRejection', ...)`(行 `:508-518`)作保險網

### Step 2 修改摘要

- **auth try/catch 行號**:`scripts/bat-terminal.mjs:436-456`
  - 前一行 `logEvent('await-auth-response', { timeoutMs: 3000 })`
  - catch 內 log `exit{reason:'auth-timeout', error, hint}` + stderr 輸出 hint「BAT_REMOTE_TOKEN may be stale. Try restart this terminal or re-export token from BAT app.」+ `ws.close()` + `process.exit(1)`
- **invoke try/catch 行號**:`scripts/bat-terminal.mjs:497-518`
  - 前一行 `logEvent('await-invoke-response', { timeoutMs: 3000 })`
  - catch 內 log `exit{reason:'invoke-timeout', error, hint}` + stderr hint 附 log 檔路徑(Windows 用 `%APPDATA%/...`,其他平台用 `~/Library/.../Logs/bat-scripts.log`)+ exit(1)
- **unhandledRejection handler 狀態**:**新增**(改前沒有)
  - 位於 `scripts/bat-terminal.mjs:508-518`,捕捉逃出 `main().catch()` 的 rejection(例如 MinimalWS 內部 socket 事件處理拋出),log `exit{reason:'unhandled-rejection', error, stack}` 後 exit(1)

### Step 4 本地測試結果

**測試 1 假 token**(`BAT_REMOTE_TOKEN="fake-..." node scripts/bat-terminal.mjs --workspace ... --mode off claude "echo test"`):
- **結果:silent hang in connect**(不是 auth 階段)
- 輸出 hint:❌ 無(stdout/stderr 完全空白)
- log 事件:僅 `invoke` + `parsed`,**沒有** `await-auth-response`、也沒有任何 exit event
- exit code:**0**(錯誤退出碼,與 BUG-046 現象一致)
- 診斷:臨時在 `main()` 加 stderr 追蹤(已移除)確認流程卡在 `ws.connect('127.0.0.1', 9876, 3000)`。raw TCP 探測證實 server 接受 TCP 連線但收到 HTTP upgrade 請求後立刻 close socket(不回 HTTP 101)。MinimalWS 的 `socket.once('close', () => clearTimeout(timer))` 只清 timer,不 reject pending Promise,於是 event loop 空 → node 以 exit 0 離開。**此 bug 在 MinimalWS.connect(`scripts/bat-terminal.mjs:263-315`)**,與本工單目標的 `waitForMessage` 無關。
- 結論:本工單新增的 auth-timeout 路徑沒機會觸發。要驗證必須先修 connect 的 reject 邏輯(超出保守原則)。

**測試 2 假 port**(`BAT_REMOTE_PORT=59999 node ...`):
- **結果**:✅ PASS(這條路徑本來就有防禦,確認未被本工單修改破壞)
- 輸出 hint:`Error: Cannot connect to BAT RemoteServer (port 59999): connect ECONNREFUSED 127.0.0.1:59999`
- log 事件:`invoke` → `parsed` → `exit{code:1, reason:"connect-failed", error:"connect ECONNREFUSED 127.0.0.1:59999"}`
- exit code:**1**

**測試 3 正常派發**(`node scripts/bat-terminal.mjs --workspace ... --mode off --no-interactive claude "echo T0200-test3-live"`):
- **結果:silent hang in connect**(與 Test 1 相同失敗模式)
- 完整事件鏈:**不完整**。僅 `invoke` + `parsed` 後 silent exit 0,無 terminal-created、無任何 exit event
- 診斷:token 是真 token(`TOKEN.len=32`),但同樣卡在 `ws.connect` 的 WS upgrade 階段。**證明 BUG-046 的根因不是 token stale,而是 server 端拒絕我們的 HTTP upgrade 請求**(可能 RemoteServer 現況有額外 header 要求,或 MinimalWS 產生的 Sec-WebSocket-Key 被拒)。
- 依工單 §禁止「若本地測試 3 失敗 → 停手回報」,不繼續硬改。

### Step 5 最後 20 行 NDJSON log(含本次測試)

```
{"ts":"2026-04-18T18:30:23.037Z","event":"invoke","pid":36948,"argv":["--workspace","...","--mode","off","claude","echo test"]}
{"ts":"2026-04-18T18:30:23.038Z","event":"parsed","pid":36948,"mode":"off","cmd":"claude","cmdArgs":["echo test"]}
{"ts":"2026-04-18T18:31:51.051Z","event":"invoke","pid":22348,...}
{"ts":"2026-04-18T18:31:51.053Z","event":"parsed","pid":22348,...}
{"ts":"2026-04-18T18:33:55.882Z","event":"invoke","pid":26644,"argv":[]}
{"ts":"2026-04-18T18:33:55.886Z","event":"exit","pid":26644,"code":1,"reason":"no-command"}
{"ts":"2026-04-18T18:34:18.793Z","event":"invoke","pid":12828,...}
{"ts":"2026-04-18T18:34:18.795Z","event":"parsed","pid":12828,...}
{"ts":"2026-04-18T18:34:42.082Z","event":"invoke","pid":30560,"argv":[...,"echo verify-trace"]}
{"ts":"2026-04-18T18:34:42.084Z","event":"parsed","pid":30560,...}
{"ts":"2026-04-18T18:35:06.713Z","event":"invoke","pid":22516,"argv":[...,"echo trace2"]}
{"ts":"2026-04-18T18:35:06.714Z","event":"parsed","pid":22516,...}
{"ts":"2026-04-18T18:36:20.570Z","event":"invoke","pid":23244,"argv":[...,"echo trace"]}
{"ts":"2026-04-18T18:36:20.572Z","event":"parsed","pid":23244,...}
{"ts":"2026-04-18T18:36:53.869Z","event":"invoke","pid":4736,"argv":[...,"echo T0200-test3-live"]}  ← Test 3
{"ts":"2026-04-18T18:36:53.871Z","event":"parsed","pid":4736,...}  ← Test 3 停在這
{"ts":"2026-04-18T18:38:43.912Z","event":"invoke","pid":27896,"argv":[...],"env":{"BAT_REMOTE_PORT":"59999",...}}  ← Test 2
{"ts":"2026-04-18T18:38:43.914Z","event":"parsed","pid":27896,...}  ← Test 2
{"ts":"2026-04-18T18:38:43.919Z","event":"exit","pid":27896,"code":1,"reason":"connect-failed","error":"connect ECONNREFUSED 127.0.0.1:59999"}  ← Test 2 正確收尾
```

> 關鍵觀察:**Test 3(正常派發)與 Test 1(假 token)都只留下 `invoke` + `parsed` 兩個事件就靜默消失,與 BUG-046 T0194 記錄的派發失敗模式完全一致**。Test 2(假 port)則有完整 `connect-failed` exit 事件。證明:
> 1. 本工單新增的 NDJSON 事件讓診斷能力提升(現在能明確看到卡在「parsed 之後、await-auth-response 之前」,鎖定到 `ws.connect`)
> 2. 但真正讓 T0194 派發 silent fail 的是 MinimalWS.connect 的 close-without-reject bug,不是 `waitForMessage` timeout。
>
> 後續建議:開新工單修 MinimalWS.connect(在 `.once('close', ...)` 內若 upgrade 未完成就 reject),或調查為何 BAT RemoteServer 現況拒絕 WS upgrade(可能最近的 electron/remote 改動或 TLS cert 相關變更)。

### 產出摘要

- 修改檔案:`scripts/bat-terminal.mjs`(+58 -2)
- 新增 NDJSON 事件:`await-auth-response`、`await-invoke-response`、`exit{reason:auth-timeout|invoke-timeout|unhandled-rejection}`
- 新增 stderr hint 訊息(2 條),引導使用者自救
- 新增全域 `unhandledRejection` handler
- Test 2 通過(未破壞既有防禦);Test 1 / Test 3 受獨立 connect bug 阻擋無法驗證目標路徑

### 互動紀錄

無。

### 遭遇問題

**發現獨立 bug:MinimalWS.connect 的 close handler 只清 timer 不 reject**(`scripts/bat-terminal.mjs:313`)
- 現象:server 在 WS upgrade 階段 close socket → Promise 永遠 pending → node 以 exit 0 靜默退出
- 影響範圍:所有派發(不論 token 正確與否)目前都卡在此處
- 建議處理:開新工單補 reject。本工單的修改無法觸發 auth/invoke timeout 路徑,但當 connect 修好後,這些防禦碼就會在真實 timeout 情境發揮作用。

### Renew 歷程

無。

### Commit hash

`29cd124` — `fix(bat-dispatcher): wrap waitForMessage with try/catch and timeout logs (BUG-046, T0200)`

---
