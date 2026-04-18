# T0202a — BUG-046 獨立防禦:MinimalWS.close reject(silent hang → clear error)

## 元資料

- **編號**:T0202a
- **類型**:fix(trivial,scripts/bat-terminal.mjs 單點修補)
- **狀態**:✅ DONE
- **估時**:5-10 min(修 close handler ~3 + exit 路徑 ~2 + smoke ~3 + 回報 ~2)
- **建立時間**:2026-04-19 02:52 (UTC+8)
- **開始時間**:2026-04-19 02:54 (UTC+8)
- **完成時間**:2026-04-19 03:02 (UTC+8)
- **關聯**:BUG-046、T0200(發現)、T0201(研究確認獨立性)
- **優先級**:🔴 High(即使 TLS 不修也有價值:silent hang → 明確錯誤)

## 前置條件

- 閱讀 T0201 回報區 B 段(MinimalWS.close reject bug 獨立性確認)
- 閱讀 T0201 D 段 T0202a 列(範圍定義)
- 閱讀 `scripts/bat-terminal.mjs:263-315` 的 `MinimalWS.connect` 方法

## 背景(從 T0200/T0201 接力)

當 server 在 WS upgrade 階段 close socket(乾淨 FIN,不是 error),`net.Socket` 只觸發 `close` event,不觸發 `error`。

現況 `bat-terminal.mjs:313` 的 close handler **只清 timer,不 reject Promise**:
```javascript
this.#socket.once('close', () => {
  clearTimeout(timer)
})
```
→ Promise 永遠 pending → event loop 空 → node silent exit 0。

**獨立價值**:即使 T0202b/c 的 TLS 修復未做,這個防禦讓 dispatcher 在任何「TCP 連得上但 server 拒絕 upgrade 並關連線」的情境(auth 失敗、brute-force ban、server listener 替換期間、TLS handshake 失敗)都能明確 fail 而非 silent hang。

## 任務

### Step 1:讀碼確認 upgrade state 追蹤

讀 `scripts/bat-terminal.mjs:263-315`。關注:
- `MinimalWS` 是否有 upgrade completed 狀態欄位(例如 `#upgraded` / `#resolved` / 類似)?
- 若有 → 在 close handler 內判斷 `!#upgraded` 才 reject(避免 upgrade 成功後正常 close 也被 reject)
- 若無 → 用 local closure 變數 `let upgraded = false`,upgrade 成功時設 true

### Step 2:修 close handler

**目標寫法**(視實際 state 命名調整):
```javascript
let upgraded = false
this.#socket.once('close', () => {
  clearTimeout(timer)
  if (!upgraded) {
    reject(new Error('connection closed before upgrade (server rejected upgrade request)'))
  }
})
// ... upgrade 成功處
// upgraded = true
// resolve(ws)
```

### Step 3:確認 error handler 不衝突

`:312` 的 `error` handler 呼叫 `onFail`(應該就是 reject 相關)。確認:
- `error` → `close` 會連續觸發,兩者都 reject 會打架嗎?
- Promise 多次 reject 是 no-op(第一次決定),所以理論上安全
- 但為求乾淨,可加 `if (!resolved && !rejected)` guard,或用 Promise state flag

**保守原則**:若現況有 `onFail` / `resolved` flag,沿用;不為乾淨重寫整個 state machine。

### Step 4:確認 exit code 路徑

觸發 reject 後,上層 `await ws.connect(...)` 會 throw。追蹤:
- 是否有 try/catch 捕捉?log `exit { reason: 'connect-closed-before-upgrade' }` 寫入?
- 確認 exit code 會是 1(非 0)

若現況上層 `await` 沒 catch → 會變 unhandledRejection(T0200 已加全域 handler 會接住)→ exit 1。這也算 OK,但 log 名稱會是 `unhandled-rejection`,不夠精準。

**小修補**(若 T0200 的 connect 階段沒有對應 log event):可在 connect 呼叫處加:
```javascript
try {
  await ws.connect(host, port, 3000)
} catch (err) {
  logEvent('exit', {
    reason: 'connect-closed-before-upgrade',
    error: err?.message || String(err),
    hint: 'Server accepted TCP but rejected WS upgrade. Check BAT app is up-to-date or TLS/auth state.'
  })
  process.exit(1)
}
```

Worker 自行評估是否需要這層(若 T0200 的 connect 呼叫已有 try/catch 則不需要)。

### Step 5:Smoke 測試

**測試 1:本 session 當下派發**(server 會拒絕 upgrade,預期 clear error)
```bash
node scripts/bat-terminal.mjs --workspace "$BAT_WORKSPACE_ID" --mode off --no-interactive claude "echo T0202a-verify"
```

**期望**:
- 不再 silent hang
- stderr 顯示明確錯誤(`connection closed before upgrade` 或自訂 hint)
- `bat-scripts.log` 有 exit event(reason 明確,非 `unhandled`)
- exit code 1

**測試 2:假 port**(確認沒破壞 T0200 既有防禦)
```bash
BAT_REMOTE_PORT=59999 node scripts/bat-terminal.mjs --workspace "$BAT_WORKSPACE_ID" --mode off --no-interactive claude "echo test"
```
**期望**:仍正確 exit `connect-failed`(ECONNREFUSED 路徑)。

### Step 6:Commit

```
fix(bat-dispatcher): reject MinimalWS promise on pre-upgrade close (BUG-046, T0202a)

Socket clean close (FIN) during WS upgrade did not trigger 'error' event,
so close handler that only cleared timer left the connect Promise pending
forever, causing node to silent exit 0 with no diagnostic.

Added reject() in close handler guarded by upgrade-complete flag. Now
any "TCP up but server rejected upgrade" scenario (TLS handshake fail,
auth fail, brute-force ban, listener replacement) produces a clear
error message and exit code 1.

Independent defense; does not solve the TLS mismatch root cause (see T0202b).

Refs: BUG-046, T0200, T0201
```

## 驗收標準

- [ ] `MinimalWS.connect` close handler 在 pre-upgrade 時 reject Promise
- [ ] Upgrade 成功路徑不被誤 reject(guard 正確)
- [ ] 當前 BAT session 派發能看到 clear error(非 silent hang)
- [ ] 假 port 路徑仍正常(未破壞既有 connect-failed 防禦)
- [ ] exit code 1(非 0)
- [ ] 回報區含:修改 diff 摘要、兩個 smoke 結果、log event 名稱

## 禁止

- ❌ 不動 `net.createConnection`(留給 T0202b 換 TLS)
- ❌ 不改 upgrade handshake 邏輯
- ❌ 不改 `waitForMessage`(T0200 已處理)
- ❌ 不加新 cli flag / 新 config
- ❌ 不重寫 MinimalWS state machine(只加 close reject 一點)

## 回報區

### 修改 diff 摘要

- 修改檔:`scripts/bat-terminal.mjs`
- 修改 1(行 `312-325`):`MinimalWS.connect` 的 `close` handler 在 `!this.#upgraded` 時 `reject(new Error('connection closed before upgrade (...)'))`。加註解說明 Promise reject after resolve/reject 是 no-op,所以 upgrade 成功後正常 teardown 不會被誤 reject。
- 修改 2(行 `420-434`):`main()` 的 connect catch block 偵測 error message prefix `connection closed before upgrade`,將 log event `reason` 從 `connect-failed` 差異化為 `connect-closed-before-upgrade`,並附 hint 欄位(提示 BAT app 版本 / TLS / auth 問題)。
- Upgrade state 追蹤方式:**沿用現有 `#upgraded` private field**(原本就有,upgrade 成功處已設 `true`)。未新增 local closure 變數。

### Smoke 測試 1:當前 BAT session 派發

- stderr 輸出:`Error: Cannot connect to BAT RemoteServer (port 9876): connection closed before upgrade (server rejected upgrade request; possible TLS/auth/listener mismatch)`
- bat-scripts.log exit event:`{"event":"exit","code":1,"reason":"connect-closed-before-upgrade","error":"connection closed before upgrade (...)","hint":"Server accepted TCP but rejected WS upgrade. Check BAT app is up-to-date or TLS/auth state."}`
- exit code:**1**(非 0,無 silent hang)

### Smoke 測試 2:假 port

- 結果:`Error: Cannot connect to BAT RemoteServer (port 59999): connect ECONNREFUSED 127.0.0.1:59999` + exit 1
- exit event:`{"event":"exit","code":1,"reason":"connect-failed","error":"connect ECONNREFUSED 127.0.0.1:59999"}`(**reason 維持 `connect-failed`,未被新的 `connect-closed-before-upgrade` 誤判**)
- 確認未破壞既有防禦:✅

### Commit hash

`380fa3c0848b81d21bd2c503d09c1cc9dcee0487`

### 回報時間

2026-04-19 03:02 (UTC+8)

---
