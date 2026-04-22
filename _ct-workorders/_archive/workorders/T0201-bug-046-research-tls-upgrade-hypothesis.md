# T0201 — BUG-046 研究:驗證 TLS upgrade 假設 + 修復拆單建議

## 元資料

- **編號**:T0201
- **類型**:🔍 research(驗證假設 + 給修復計畫,不改 code)
- **狀態**:✅ DONE
- **估時**:15-25 min(grep ~5 + 對照 ~5 + 評估拆單 ~5 + 回報 ~5)
- **建立時間**:2026-04-19 02:48 (UTC+8)
- **開始時間**:2026-04-19 02:47 (UTC+8)
- **完成時間**:2026-04-19 02:50 (UTC+8)
- **Commit**:b37297c
- **關聯**:BUG-046(第二翻案)、T0200(發現獨立 bug)、PLAN-018 T0182(TLS 升級候選真因)
- **優先級**:🔴 High(阻擋塔台 yolo 派發鏈)

## 前置條件

- 閱讀 T0200 回報區「遭遇問題」段(發現 MinimalWS.connect close handler 不 reject)
- 閱讀 `_ct-workorders/BUG-046-bat-dispatch-interactive-flag-silent-fail.md`(含第一次翻案)
- 閱讀 `CLAUDE.md` 的 **Remote 資安(PLAN-018 T0182)** 段(wss:// + 自簽憑證 + fingerprint pinning)

## 背景(雙重翻案)

**第一翻案**(BUG-046 建檔時):排除「T0193 regression」→ 假設 token mismatch
**第二翻案**(T0200 實測):token 正確派發(Test 3)**同樣 silent hang**,真卡點在 `scripts/bat-terminal.mjs:263-315` 的 `MinimalWS.connect`。

**T0200 實測現象**:
1. TCP 握手成功(connect OK)
2. 送 HTTP upgrade 請求後 server 立刻 close socket,不回 HTTP 101
3. `socket.once('close', ...)` 只清 timer,**不 reject Promise**
4. Promise 永遠 pending → event loop 空 → node exit 0 silent

**強假設**(本工單目標驗證):
- CLAUDE.md 明載「PLAN-018 T0182 起以 `wss://` + 自簽憑證運行」
- 若 server 升到 TLS,dispatcher 仍送 plain HTTP upgrade → server 因 TLS handshake 失敗而 close socket,完全符合現象

## 任務(純研究,禁改 code)

### Step 1:驗證 server 端 TLS 配置

```bash
# 找 server 實作
grep -rn "createServer\|WebSocket.Server\|wss://\|selfsigned\|tls\." electron/remote/ electron/
grep -rn "PLAN-018\|T0182" electron/remote/ 2>/dev/null
```

**期望產出**:
- Server 啟動碼位置(檔案:行號)
- 是 `http.createServer` 還是 `https.createServer` / `tls.createServer`?
- 是否 import `selfsigned` / 讀 `server-cert.json`?
- WebSocket.Server 掛在 http 還是 https?

### Step 2:確認 dispatcher 端現況

讀 `scripts/bat-terminal.mjs:259-315` 的 `MinimalWS.connect`:
- 用 `net.connect` 還是 `tls.connect`?
- 送的 `GET ... HTTP/1.1` + `Upgrade: websocket` 是純文字還是 TLS 包裝?
- 有沒有處理 TLS handshake?

### Step 3:對照 BAT 實機行為

```bash
# 檢查 server-cert.json 是否存在
ls -la "%APPDATA%/BetterAgentTerminal/server-cert.json" 2>/dev/null
# 或 Unix 路徑
ls -la "$HOME/Library/Application Support/BetterAgentTerminal/server-cert.json" 2>/dev/null

# 用 openssl / curl 探測 server 行為(不需要實際完成握手,只要看 server 回什麼)
# Windows 若無 openssl 可跳過
echo "GET / HTTP/1.1" | nc -w 2 127.0.0.1 9876 2>&1 | head -5
```

**期望**:
- 若 `server-cert.json` 存在 + TLS handshake 明顯 → **TLS 假設 ✅ 成立**
- 若 server 接受 plain HTTP 但某 middleware 拒絕 → **TLS 假設 ❌,另尋真因**

### Step 4:評估 MinimalWS.close reject bug 範圍

看 `scripts/bat-terminal.mjs:313` 附近:
- close handler 內邏輯
- 修法預估:一行 reject(`promise.reject(new Error('connection closed before upgrade'))`)還是要改整個 state machine?
- 這個 bug 是否 T0200 才發現 / 還是先前就潛伏?

### Step 5:評估 fingerprint pinning 工作量

CLAUDE.md 提到 profile 有 `remoteFingerprint` 欄位,dispatcher 若要對齊要:
- 從哪裡讀 fingerprint?(env var / 某 config / 從 `server-cert.json` 算?)
- 第一次 TOFU(trust-on-first-use)邏輯怎麼做?
- 是否需要人類介入授權?

### Step 6:D 區段 — 修復拆單建議(給塔台決策)

輸出格式:

| 工單候選 | 類型 | 範圍 | 估時 | 依賴 |
|---------|------|------|------|------|
| T0202a | fix | MinimalWS.close 補 reject(防禦,無論 TLS 如何都該有) | 5-10 min | 無 |
| T0202b | fix | dispatcher 升 wss:// + 對 self-signed cert 寬鬆 | 15-30 min | T0202a |
| T0202c | fix | dispatcher 加 fingerprint pinning(對齊 PLAN-018) | 30-60 min | T0202b |

或其他切法,由 Worker 依實際結構建議。每個候選工單要有**明確邊界**,避免單張範圍爆炸。

## 驗收標準

- [ ] Server 端 TLS 配置確認(http / https / tls 其中之一,附 grep 證據)
- [ ] Dispatcher 端 MinimalWS 協議確認(plain TCP / TLS)
- [ ] `server-cert.json` 存在性確認
- [ ] TLS 假設判定:✅ 成立 / ❌ 推翻(附證據)
- [ ] MinimalWS.close reject bug 修法範圍評估
- [ ] Fingerprint pinning 工作量評估
- [ ] D 區段:修復拆單建議(至少 2-3 張候選工單,含估時)
- [ ] 回報區含:關鍵檔案 line 引用、TLS/fingerprint 證據、推薦下一步

## 禁止

- ❌ **不改任何 code**(純研究,禁寫入)
- ❌ 不動 dispatcher 邏輯
- ❌ 不做完整 TLS handshake 實驗(若 openssl 複雜 → 用 grep 和 cert 檔存在性推論即可)
- ❌ 不擴大範圍到其他 remote 功能(本張只研究 dispatcher connect 失敗)

## 互動規則

本張為 research 工單,**允許互動**。Worker 遇到以下情境可回報塔台詢問:
- TLS 假設某關鍵證據查不到(例如 server 啟動碼在非預期位置)
- 修復拆單超過 5 張(範圍判斷需要塔台 input)
- 發現第三個獨立 bug(翻案再翻案)

每次提問上限依 `research_max_questions: 3`。

## 回報區

### A. 事實摘要

- **Server 端 TLS 配置**:**HTTPS + wss://**
  - `electron/remote/remote-server.ts:210-212`:`loadOrCreateServerCertificate(configDir)` 載入 self-signed cert
  - `electron/remote/remote-server.ts:216`:`this.httpsServer = https.createServer({ cert, key })`
  - `electron/remote/remote-server.ts:232-235`:`new WebSocketServer({ server: this.httpsServer, maxPayload: ... })` — WS 掛在 HTTPS server 上,所有 upgrade 必須先完成 TLS handshake
  - `electron/remote/certificate.ts:4, 67-70`:`selfsigned v5 async` 產生憑證
  - `electron/remote/tunnel-manager.ts:36`:`wss://${primary.ip}:${port}` QR payload
  - `electron/remote/remote-client.ts:106`:Electron client 端 `wss://${host}:${port}` + `rejectUnauthorized: false`(line 109)+ upgrade 事件 handshake 後讀 `getPeerCertificate().fingerprint256` 驗 pinning(line 126-151)
- **Dispatcher 端協議**:**純 TCP + plain HTTP/1.1 upgrade(不含 TLS)**
  - `scripts/bat-terminal.mjs:21`:`import { createConnection } from 'net'`(只 import net,沒 import tls)
  - `scripts/bat-terminal.mjs:282`:`createConnection({ host, port }, ...)` 開純 TCP socket
  - `scripts/bat-terminal.mjs:284-287`:open callback 立刻寫 `GET / HTTP/1.1\r\nHost: ...\r\nUpgrade: websocket\r\n...` — plain text,無 TLS 包裝
  - 無 `fingerprint` / `rejectUnauthorized` 字樣(全檔 grep 無匹配)
- **`server-cert.json` 存在性**:✅ 存在(`C:\Users\Gower\AppData\Roaming\BetterAgentTerminal\server-cert.json`, 3071 bytes, mtime 2026-04-19 00:09)
  - app name `BetterAgentTerminal`(大駝峰),非 Unix 習慣的 `better-agent-terminal`
- **BAT 實機現況**:CLAUDE.md Remote 資安段(line 186-198)與實作完全一致,T0182 以降所有 remote 流量走 wss://,client 走 fingerprint TOFU pinning

### B. 根因判定

- **TLS 假設**:✅ **成立**
- **證據**(三重交叉驗證):
  1. Server 開的是 `https.createServer`(line 216)+ WebSocketServer 掛 HTTPS(line 232)→ 任何純 HTTP upgrade 請求在 TLS handshake 階段就會被 Node https module 直接 close,完全不進 HTTP parser
  2. Dispatcher 用 `net.createConnection`(line 282)純 TCP + plain `GET / HTTP/1.1` upgrade(line 284-287),與 server 要求的 TLS 完全不對應
  3. `server-cert.json` 實機存在且大小正常(3071 bytes),證明 server 確實在用 self-signed cert,T0182 配置已生效
  4. T0200 觀察到的「TCP 連上 → 送 upgrade → server 立刻 close → 無 HTTP 101」完全吻合「TLS handshake 失敗 server fail-close」行為特徵
- **MinimalWS.close reject bug 獨立性**:**與 TLS 議題正交,是獨立防禦缺失**
  - `bat-terminal.mjs:313`:`this.#socket.once('close', () => { clearTimeout(timer) })` — 只清 timer,不 reject
  - `bat-terminal.mjs:312`:`this.#socket.on('error', onFail)` — 只在 `error` event 時 reject
  - TLS handshake 失敗時 server 送 FIN(乾淨關閉),不觸發 TCP `error`,只觸發 `close` → Promise 永遠 pending
  - **即使 TLS 假設不成立**,此 bug 在任何「TCP 連得上但 server 拒絕 upgrade 並關連線」的情境都會 silent hang(例如 auth 失敗、brute-force ban、server listener 替換期間),是防禦性缺陷
  - T0200 才露出,但先前就潛伏(MinimalWS 引入時即存在,但過去 server 是純 HTTP 所以 close-before-upgrade 不發生)

### C. 修法評估

- **最小修補**(只修 MinimalWS.close reject):**不解決卡 hang**
  - 補 reject 後,dispatcher 會收到明確 error `connection closed before upgrade`(而非 silent hang)
  - 但 TLS 不對齊的根本問題仍在 → 連線仍會失敗,只是從「silent hang」變「明確失敗訊息」
  - 價值:讓 bat-notify 能 exit 1 而不是 silent exit 0;使用者能從 stderr 看到問題
  - 工作量:改一行 + exit code 處理,5-10 min
- **完整對齊 PLAN-018**(dispatcher 升 wss:// + fingerprint):**徹底解決**
  - MinimalWS 改用 `tls.connect({ host, port, rejectUnauthorized: false })` 取代 `net.createConnection`
  - handshake 後從 TLSSocket.getPeerCertificate().fingerprint256 取指紋
  - 讀 `server-cert.json` 裡的 fingerprint 或用 env var(如 `BAT_REMOTE_FINGERPRINT`)比對
  - 若無指紋 → TOFU(第一次存到某 dispatcher-side config,後續比對)
  - 工作量:TLS 升級 15-25 min,fingerprint pinning 另外 30-60 min(需設計 dispatcher-side 信任儲存)

### D. 修復拆單建議

| 工單候選 | 類型 | 範圍 | 估時 | 依賴 |
|---------|------|------|------|------|
| T0202a | fix | `MinimalWS.connect` 的 `close` handler 補 reject(若 `!#upgraded` 就 reject `new Error('connection closed before upgrade')`),並確保 bat-notify/bat-dispatcher exit code 反映失敗 | 5-10 min | 無(獨立防禦) |
| T0202b | fix | `MinimalWS` 改用 `tls.connect` 取代 `net.createConnection`,開 `rejectUnauthorized: false`,送 upgrade 前等 `secureConnect` event;更新 bat-terminal 連線 URL 語義從 `ws://` 到 `wss://`(目前程式碼未寫 scheme,只有 host/port,估計只需改 connect 呼叫) | 15-25 min | T0202a(先有明確錯誤訊息才能確認 TLS 接上了) |
| T0202c | fix | Dispatcher 端 fingerprint pinning:讀 `server-cert.json`(user-data dir)取 fingerprint,於 `secureConnect` 後用 `TLSSocket.getPeerCertificate().fingerprint256` 比對;不匹配即 reject;首次執行無 pin 時走 TOFU 寫入 dispatcher-side config(例如 `~/.bat-dispatcher/trust.json`) | 30-60 min | T0202b |
| T0202d(選用) | test | 為 `MinimalWS` 加 smoke test:mock HTTPS server 測 TLS handshake 成功 / fingerprint mismatch / close-before-upgrade 三情境,避免 regression | 20-30 min | T0202c |

**推薦執行順序**:T0202a → T0202b → T0202c。T0202a 可獨立發佈,立刻解除 silent hang 造成的塔台 yolo 派發鏈卡死;T0202b 恢復 dispatcher 可用性;T0202c 補齊 PLAN-018 安全對齊。T0202d 視 sprint 容量決定。

**關鍵邊界判斷**:
- T0202a 範圍**僅限** `MinimalWS.connect` 的 Promise lifecycle,不動 TLS、不動 upgrade 邏輯
- T0202b 範圍**僅限** `net` → `tls` 替換與 handshake 時序,**不做** fingerprint pinning(留給 T0202c)
- T0202c 才觸碰 dispatcher 信任儲存設計,這張會需要塔台決策 TOFU 策略(env var 覆寫 vs. 自動 TOFU vs. 強制 pin)
- 若塔台想合併 T0202b+T0202c:單張工單範圍約 45-85 min,上下文壓力高且 fingerprint 設計可能要中途徵詢使用者,**不建議合併**

### E. 塔台詢問紀錄(若有)

無(證據蒐集階段無需互動;TLS 假設於 Step 1-3 即單向確立,無須翻案)。

---


---
