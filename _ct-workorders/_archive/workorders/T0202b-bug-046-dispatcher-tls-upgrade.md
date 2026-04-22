# T0202b — BUG-046 主修:Dispatcher 升 wss:// TLS(解鎖 yolo 派發鏈)

## 元資料

- **編號**:T0202b
- **類型**:fix(dispatcher TLS 升級,不含 fingerprint pinning)
- **狀態**:✅ DONE
- **估時**:15-25 min(讀 MinimalWS ~3 + tls 改寫 ~8-12 + smoke ~3-5 + 回報 ~3)
- **建立時間**:2026-04-19 03:03 (UTC+8)
- **開始時間**:2026-04-19 03:08 (UTC+8)
- **完成時間**:2026-04-19 03:12 (UTC+8)
- **Commit**:831234b
- **關聯**:BUG-046、T0200(防禦基底)、T0201(TLS 假設確認)、T0202a(reject 防禦)、PLAN-018 T0182(server 端 TLS 基建)
- **優先級**:🔴 High(本張修完 yolo 派發鏈就解鎖)

## 前置條件

- T0202a 已完成並 commit `380fa3c`(silent hang → clear error)
- 閱讀 T0201 回報區 A/B/C 段(TLS 假設三重證據)
- 閱讀 T0201 D 段 T0202b 列(範圍定義)
- 閱讀 `electron/remote/remote-client.ts:106-151`(Electron 端 wss:// 實作,作 TLS 時序參考)
- 閱讀 `scripts/bat-terminal.mjs` 的 `MinimalWS.connect`(T0202a 後狀態)

## 背景(TLS 假設確認)

T0201 研究 + T0202a 實測雙重驗證:
- **Server**:`electron/remote/remote-server.ts:216` `https.createServer` + WSServer 掛 HTTPS
- **Dispatcher(現況)**:`net.createConnection` 純 TCP + plain HTTP upgrade
- **現象**:TLS handshake 失敗 → server FIN close → T0202a 的 reject 接到 `connect-closed-before-upgrade`

**本張目標**:MinimalWS 改用 `tls.connect` 取代 `net.createConnection`,等 `secureConnect` 後才送 upgrade,讓 dispatcher 能與 server 正確 TLS 握手。

## 任務

### Step 1:讀碼,定位改動點

讀 `scripts/bat-terminal.mjs:263-315`(T0202a 後):
- `import { createConnection } from 'net'`(line 21)→ 需改為 `import { connect as tlsConnect } from 'tls'`(或並存)
- `createConnection({ host, port }, ...)`(line 282)→ 改為 `tlsConnect({ host, port, rejectUnauthorized: false }, ...)`
- open callback 時序:`net.Socket` 在 `'connect'` event 觸發,`tls.TLSSocket` 要等 `'secureConnect'`(握手完成)才能送 HTTP upgrade

### Step 2:TLS 連線邏輯

參考 `electron/remote/remote-client.ts:106-151`(Electron 端 wss:// client 實作),關鍵模式:
```javascript
const socket = tls.connect({
  host,
  port,
  rejectUnauthorized: false,  // self-signed cert
  servername: host             // SNI,有些 TLS stack 需要
})

socket.once('secureConnect', () => {
  // 現在可以送 HTTP upgrade 了
  socket.write('GET / HTTP/1.1\r\n...')
})

socket.once('error', onFail)
socket.once('close', /* T0202a 已加 reject guard */)
```

**注意**:
- `error` event 會在 TLS handshake 失敗時觸發(如 cert 解析錯誤)— 確保 T0202a 的 onFail 能接到
- `close` event 會在 TLS handshake 失敗 → FIN 時觸發 — T0202a 的 reject 路徑涵蓋
- 原本 `'connect'` event handler 的寫 upgrade 請求邏輯,移到 `'secureConnect'`

### Step 3:清理 import

- 若完全不用 `net.createConnection` → 移除 `import { createConnection } from 'net'`
- 若有其他地方用 net → 保留 import,只改 MinimalWS 用 tls

### Step 4:保守原則

- **不加 fingerprint 比對**(留給 T0202c)
- **不加新 config**(`BAT_REMOTE_CERT_*` 之類 env var 留給 T0202c)
- **不改 protocol 字串**(scheme 仍是概念上的 wss://,但 code 裡面原本就沒寫 scheme 字面,只有 host/port)
- **不重寫 HTTP upgrade handshake 邏輯**(line 284-287 的 `GET / HTTP/1.1` 區塊原樣搬到 `secureConnect` callback)
- **不碰 auth / waitForMessage**(T0200 已處理)

### Step 5:Smoke 測試

**測試 1:本 session 當前派發**(真正的驗證)
```bash
node scripts/bat-terminal.mjs --workspace "$BAT_WORKSPACE_ID" --mode off --no-interactive claude "echo T0202b-tls-live"
```

**期望**:
- ✅ TLS handshake 完成
- ✅ HTTP upgrade 成功(server 回 101)
- ✅ Auth 流程走完
- ✅ Terminal 實際開起來執行 `echo T0202b-tls-live`
- ✅ `bat-scripts.log` 完整事件鏈:`invoke → parsed → await-auth-response → [auth-success] → await-invoke-response → [invoke-success] → terminal-created → exit{code:0}`
- ✅ exit code 0

**如果 auth 失敗**(token 仍 stale 等問題):
- T0200 的 `await-auth-response` / `exit:auth-timeout` 會接住,給 clear error
- 這時 hint 會指向 token refresh(非本張責任)
- 回報區註記「TLS OK 但 auth fail」,本張仍算 DONE(TLS 目標達成)

**測試 2:假 port**(確保 T0200 的 connect-failed 仍正常)
```bash
BAT_REMOTE_PORT=59999 node scripts/bat-terminal.mjs --workspace "$BAT_WORKSPACE_ID" --mode off --no-interactive claude "echo test"
```
**期望**:ECONNREFUSED → `connect-failed` exit 1(行為不變)。

**測試 3:故意送錯 cert**(若時間允許)
跳過 — 這屬於 fingerprint pinning(T0202c)範圍。

### Step 6:Commit

```
fix(bat-dispatcher): upgrade MinimalWS to TLS (wss://) to match HTTPS server (BUG-046, T0202b)

Server migrated to https.createServer + wss:// since PLAN-018 T0182,
but dispatcher stayed on plain net.createConnection + HTTP/1.1 upgrade.
TLS handshake failed silently (before T0202a) or produced
connect-closed-before-upgrade error (after T0202a). Neither allowed the
dispatcher to reach auth stage.

Changes in scripts/bat-terminal.mjs MinimalWS.connect:
- Replace net.createConnection with tls.connect
- rejectUnauthorized: false (self-signed cert, fingerprint pinning comes in T0202c)
- servername: host for SNI compatibility
- Move HTTP upgrade write from 'connect' to 'secureConnect' event
- Error/close handlers unchanged (T0202a defense still applies)

Locally verified tower dispatch now successfully opens terminals via the
BAT RemoteServer. connect-failed path (ECONNREFUSED) preserved.

Defers to T0202c: fingerprint pinning for full PLAN-018 alignment.

Refs: BUG-046, T0200, T0201, T0202a, PLAN-018
```

## 驗收標準

- [ ] `MinimalWS.connect` 用 `tls.connect` 取代 `net.createConnection`
- [ ] `rejectUnauthorized: false` + `servername` 設置
- [ ] HTTP upgrade write 在 `secureConnect` 後執行
- [ ] T0202a 的 close reject 和 onFail error handler 仍正常運作
- [ ] Smoke 1(本 session 派發)成功 — terminal 開起來執行指令,exit 0
- [ ] Smoke 2(假 port)仍 `connect-failed` exit 1
- [ ] 回報區含:diff 摘要、Smoke 結果、完整 bat-scripts.log 事件鏈

## 禁止

- ❌ **不加 fingerprint pinning**(嚴格留給 T0202c)
- ❌ 不改 server 端任何 code(`electron/remote/*`)
- ❌ 不改 auth 流程 / token 處理
- ❌ 不新增 cli flag 或 env var(例如 `BAT_SKIP_TLS_VERIFY` 之類)
- ❌ 不做 TLS version pinning / cipher 設定(預設即可)
- ❌ 若 Smoke 1 TLS OK 但 auth 失敗 → 標記為本張 DONE(TLS 目標達成),auth 問題另開工單

## 回報區

### 完成狀態

DONE — TLS 升級完成,yolo 派發鏈解鎖。

### 修改 diff 摘要

- `import` 變更:`import { createConnection } from 'net'` → `import { connect as tlsConnect } from 'tls'`(line 21)
- `MinimalWS.connect` 主要改動:
  - Line 282-290(原 `createConnection`)→ 改為 `tlsConnect({ host, port, rejectUnauthorized: false, ...(isIpLiteral ? {} : { servername: host }) })`
  - Line 292-298:HTTP upgrade write 從 open callback 搬到 `socket.once('secureConnect', () => {...})`
- `secureConnect` vs `connect` event 時序處理:改用 `'secureConnect'` 確保 TLS handshake 完成後才送 HTTP/1.1 upgrade;T0202a 的 `'close'` reject guard 和 `'error'` onFail 原樣保留,TLS handshake 失敗會走同一路徑
- **額外處理**:初版設 `servername: host` 直接觸發 `ERR_INVALID_ARG_VALUE: Setting the TLS ServerName to an IP address is not permitted`(RFC 6066 禁止 SNI 使用 IP literal)。加上 `isIpLiteral` 偵測(IPv4 / IPv6 含 `:`)僅在 hostname 時帶 SNI。

### Smoke 測試 1:本 session 派發(TLS 真實驗證)

- Terminal 是否開起來:✅
- `echo T0202b-tls-live` 輸出:Terminal 成功建立(`✓ Terminal created: claude 'echo T0202b-tls-live'`),命令已派發到新 PTY 執行
- exit code:0
- bat-scripts.log 完整事件鏈(pid 30164):
```
invoke → parsed → await-auth-response (timeoutMs:3000)
  → invoke-create-with-command (terminalId, workspaceId, CT_MODE:off, CT_INTERACTIVE:0)
  → await-invoke-response (timeoutMs:3000)
  → terminal-created (result:ok)
  → exit (code:0)
```

### Smoke 測試 2:假 port

- 結果:`Error: Cannot connect to BAT RemoteServer (port 59999): connect ECONNREFUSED 127.0.0.1:59999`,exit 1
- reason 仍是 `connect-failed`:✅(log pid 31444 `reason":"connect-failed"`)

### Commit hash

`831234b` — fix(bat-dispatcher): upgrade MinimalWS to TLS (wss://) to match HTTPS server (BUG-046, T0202b)

### 其他觀察

- **SNI + IP literal edge case**:remote-client.ts 用 `new WebSocket(url, ...)` 封裝,URL 解析器會幫忙處理 IP hostname;MinimalWS 直接用 `tls.connect`,必須手動守住 RFC 6066(SNI 不接受 IP)。T0202c 若改成用完整 URL / 新增 host override 時需留意。
- **T0202a 防禦生效**:首次驗證(servername IP 錯誤)由 `error` event → onFail 接到,沒出現 silent hang。reject guard 路徑與 TLS 失敗路徑整合良好。
- **auth 沒觸發問題**:Smoke 1 跑到 terminal-created,表示 TLS + WS upgrade + auth 整條鏈都通。本張 TLS 目標達成,yolo 派發鏈已解鎖。
- **fingerprint pinning 預留 T0202c**:目前 `rejectUnauthorized: false` 等同 TOFU without verification;需比照 remote-client.ts 的 `this.ws.on('upgrade', ...)` fingerprint 驗證機制。

---
