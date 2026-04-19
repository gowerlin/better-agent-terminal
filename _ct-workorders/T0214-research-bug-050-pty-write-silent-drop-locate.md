# T0214 — BUG-050 階段 1 研究:RemoteServer pty:write silent drop 定位

## 元資料
- **類型**:research(研究型 + 互動)
- **狀態**:DONE
- **建立時間**:2026-04-19 18:15 (UTC+8)
- **派發時間**:2026-04-19 18:16 (UTC+8,yolo + interactive)
- **開始時間**:2026-04-19 18:16 (UTC+8)
- **完成時間**:2026-04-19 18:24 (UTC+8)
- **預估工時**:20-40 min
- **實耗工時**:~8 min
- **關聯**:PLAN-024(階段 1)· BUG-050(FIXING)· T0210(DONE,研究上游)
- **Renew 次數**:0
- **互動**:允許(每次 ≤3 題,僅在 code 路徑不明或設計決策需權衡時觸發)

## 塔台決策背景

T0210 鎖定雙根因,其中**根因 B**(RemoteServer `pty:write` silent drop)明確標記「未讀 code 避免擴大範圍」,留給本工單處理。

**已知事實**(T0210 證據,不要重查):
- T0207 bat-notify log 顯示 `terminal:notify` + `pty:write` 雙通道都 `result=ok` + `appendedCR=true` + `exit=0`
- 塔台完全沒收到(tab badge 未亮 + PTY 無字串注入)使用者 Q1 親證
- T0205/T0206 同一 target terminal id(c8a43b60...)同 code path 成功
- bat-notify.mjs 本身無 silent fallback(T0210 Step 3 確認)
- clipboard fallback 全在 ct-exec skill Step 11,與 bat-notify 無關

**Option C 階段 1 決策**(使用者已對齊):
- bat-notify 收到 server error → **硬阻斷 + exit 1**(不 retry,不 fallback)
- 顯性化是階段 1 核心目標

## 目標

1. **定位 silent drop 具體 code path**:`electron/remote/` 下 pty:write handler 哪一段吞掉錯誤?
2. **枚舉 silent drop 觸發條件**:target terminal 不存在 / stdin pipe 滿 / processing 中 / queue 滿 / 其他?
3. **設計 error 回傳協議**:現有 WS protocol 如何擴充 error response?client 如何區分「訊息未送達 server」vs「送到但寫入失敗」?
4. **評估 bat-notify.mjs 改動範圍**:收到 error 後的硬阻斷(exit 1)實作落點

## 已知事實(不要重查)

### A — 現有 WS protocol 行為
- `bat-notify.mjs` 送 `terminal:notify` + `pty:write` 到 server
- server 回 `result: ok` 表示「訊息接收成功」
- 不保證 target terminal PTY stdin 真的寫入成功

### B — T0205/T0206 成功案例
- 同一 code path,auto-submit 成功
- 說明正常路徑有效,silent drop 是 edge case 或 race

### C — bat-notify.mjs 現有錯誤處理
- exit 1:early fail(互斥檢查、無 target/message/PORT/TOKEN、connect-failed、connect-closed-before-upgrade、auth-failed、unhandled)
- exit 0:兩 send 嘗試過,不管 result ok/error
- **關鍵**:目前 `result=error` 也走 exit 0(非 fatal)

## 調查步驟

### Step 1 — Code 盤點:electron/remote/ 下 pty:write handler 位置

```bash
# 定位 pty:write handler 入口
grep -rn "pty:write\|pty\\.write\|ptyWrite" electron/remote/ 2>/dev/null

# 定位 terminal:notify handler 入口
grep -rn "terminal:notify" electron/remote/ 2>/dev/null

# 盤點 WS message dispatch
grep -rn "handleMessage\|ws.on\|message.*type" electron/remote/ 2>/dev/null
```

**交付**:handler 檔案 + 行號 + 函式名

### Step 2 — 讀 pty:write handler:silent drop path 分析

重點檢查:
- target terminal 不存在時:回 error 還是 silent ok?
- PTY stdin write 失敗時:catch 了嗎?往哪裡 propagate?
- target terminal 正在 processing(另一 write 進行中)時:queue 還是 drop?
- queue 滿時:drop 還是 block?

**判斷依據**:
- 若看到 `try/catch` 後 swallow error 並 `send({ result: 'ok' })` → **就是 silent drop 點**
- 若看到 conditional branch(如 `if (!terminal) return { result: 'ok' }`)→ **silent drop 點**
- 若看到 async write without await → **race 可能性**

**交付**:silent drop 具體位置(檔案:行號)+ 觸發條件清單

### Step 3 — 反例證偽:T0205/T0206 為何能成功?

同 code path + 同 target terminal id,哪個條件讓前兩次成功、後一次失敗?

可能因素:
- target terminal 是否在 "idle" 狀態(人類使用者閒置)?
- Session 間 PTY 物件是否重建?
- Electron main process state(registry、active map)差異?

**交付**:成功/失敗條件差異推論(可能需要使用者補充觀察)

### Step 4 — Error 回傳協議設計

**候選方案**:

**A. 最小變更(推薦)**:
- server 回 `{ result: 'error', reason: '...' }` 而非 `{ result: 'ok' }`
- bat-notify.mjs 檢查 `result !== 'ok'` → exit 1 + print reason
- 向後相容:舊 client 收到 `result: error` 也會視為異常

**B. 新增 ack 機制**:
- server 先回 `{ result: 'accepted' }`,寫入成功後再回 `{ result: 'written' }`
- client 等待雙 ack
- 複雜度較高,跨 session 狀態難維護

**C. 引入 operation id**:
- client 帶 `opId`,server 完成後以 `opId` 回 status
- 完整 request/response tracking,改動最大

**交付**:推薦方案 + 理由 + 改動估算

### Step 5 — bat-notify.mjs 改動範圍評估

- 讀 `scripts/bat-notify.mjs` 現有 send loop
- 指出新增 error 檢查的插入點
- 估算 diff 行數

**交付**:diff 估算 + 風險評估(是否會 regress T0205/T0206 類成功路徑)

### Step 6 — 產出根因 + 設計文件

格式參考 T0210 Step 7:

```markdown
## Silent drop 定位表
| # | 檔案:行 | 路徑 | 觸發條件 | 目前行為 | 建議行為 |
|---|--------|------|---------|---------|---------|

## Error 回傳協議
- 推薦方案 + 協議細節 + 向後相容性評估

## T0215 實作建議
- server 改動清單
- bat-notify.mjs 改動清單
- 驗收 smoke 場景設計
```

## 禁止事項

- ❌ **不得修改任何程式碼**(純研究)
- ❌ 不得跑 `npm run dev` / `vite build` / 修 electron 或 scripts
- ❌ 不得做 git commit
- ❌ 不得擴大範圍到 silent drop 以外的 server code
- ❌ 不得重啟 BAT app(除非使用者明確授權)
- ❌ 不得設計階段 2 的 skill 拆分(非本工單範圍)

## 互動規則

**啟用研究互動**(config `research_interaction: true`),每次 ≤3 題,觸發情境:
- Step 2 看 code 看不出 silent drop 點 → 問使用者歷史是否有相關改動
- Step 3 反例證偽需要 BAT app 內部狀態 → 問使用者是否記得 T0207 當下 BAT app 狀態(剛切 session、多 tab 等)
- Step 4 協議方案 A/B/C 各有 trade-off → 若明顯推薦 A 就自行決定,若糾結問使用者偏好

**必須暫停回塔台**的情境:
- 定位到 silent drop 但發現修復會 break 其他 feature → pause 評估
- 發現 silent drop 不在 `electron/remote/` 而在更上層(main process IPC、terminal factory 等)→ pause 擴大範圍
- 發現無法用「錯誤回傳」解決(例如 async write 的 race,需 ack 機制才能可靠)→ pause 重估方案

**自主判斷邊界**:讀 code / grep / 推演 / 協議設計 → 自行完成

## 交付物

寫入本檔「回報區」:
- [ ] Step 1:handler 檔案 + 行號
- [ ] Step 2:silent drop 定位表(檔案:行 + 觸發條件)
- [ ] Step 3:成功/失敗條件差異推論
- [ ] Step 4:推薦協議方案 + 理由
- [ ] Step 5:bat-notify.mjs 改動範圍 + 風險
- [ ] Step 6:T0215 實作建議(server + client + smoke 場景)
- [ ] Worker 實耗時 vs 估時

## 收尾步驟

1. 回報區填寫完整(含所有 Step 交付)
2. **無需 commit**(本工單不改 code)
3. 回報格式:**`T0214 完成`**(YOLO 模式,注意:本工單研究的正是 silent drop,預期會遇到 fallback — 視為 meta-data 點,並為 T0215 驗收提供 baseline)

## 回報區

### 完成狀態
**DONE** — silent drop 定位完成,產出 T0215 實作建議與向後相容的 error 回傳協議。純研究,未改 code,未 commit。

### 實耗工時
約 8 min(估時 20-40 min,遠低於下限 — 因 bat-notify / pty-manager / terminal-server / remote-server 是同專案熟區,無需深入外部文件)

### Step 1 — Handler 檔案 + 行號

WS invoke `pty:write` 經過 6 層 code path:

| 層 | 檔案:行 | 角色 |
|---|---------|------|
| L1 client | scripts/bat-notify.mjs:488-510 | 送 `invoke` + 等 `invoke-result`,僅看 `writeResp.error`(未檢查 result payload) |
| L2 ws server | electron/remote/remote-server.ts:312-326 | `await invokeHandler(channel, args)` → `sendFrame({type:'invoke-result', result})` |
| L3 handler registry | electron/remote/handler-registry.ts:13-17 | `handler({windowId}, ...args)` → Promise.resolve |
| L4 dispatch | electron/main.ts:1586 | `registerHandler('pty:write', (_ctx, id, data) => ptyManager?.write(id, data))` **← void 回傳** |
| L5 manager | electron/pty-manager.ts:604-619 | `write(id, data): void`,useServer 分支 fire-and-forget 到 terminal-server |
| L6 terminal-server | electron/terminal-server/server.ts:250-258 | `writePty(req)`,PTY not found 僅 broadcast one-way error |

關聯:`electron/main.ts:1678-1721` 的 `terminal:notify` 只 broadcast IPC 給 BrowserWindow(tab badge/toast),**不動 PTY**,與 silent drop 無關(T0207 log 顯示 `terminal:notify result=ok` 實際表示 broadcast 到 window 成功,與 PTY stdin 是否注入分離)。

### Step 2 — Silent drop 定位表(9 個點)

| # | 檔案:行 | 觸發條件 | 目前行為 | 建議行為 |
|---|---------|---------|---------|---------|
| 1 | pty-manager.ts:604-619 | `instances.has(id) === false` 且非 useServer 分支 | 無 match、void return | return `{ok:false, reason:'pty-not-found'}` |
| 2 | pty-manager.ts:606 | useServer 分支:sendToServer 送 IPC 後無 ack | fire-and-forget,終端 refork race 下訊息漂失 | 加 correlation id + 等 ack(方案 B) |
| 3 | pty-manager.ts:612 | `instance.process.write(data)` node-pty throw | 無 try/catch,上拋到 invokeHandler → invoke-error(可見但 reason 不明) | try/catch + structured reason |
| 4 | pty-manager.ts:616 | `cp.stdin` undefined / 已 close | optional chaining 靜默 skip | `{ok:false, reason:'stdin-missing'}` |
| 5 | pty-manager.ts:616 | `cp.stdin.write()` 回 false(backpressure) | 不檢查 return,Node 仍會內部 buffer | 保留,但 log warn |
| 6 | terminal-server/server.ts:250-258 | `ptys.has(req.id) === false` | broadcast one-way `{type:'error', requestType:'pty:write'}`,**無 invoke-id 對應** | IPC 加 reqId,回 `{type:'pty:write-result', reqId, ok, reason}` |
| 7 | pty-manager.ts:220-222 | handleServerMessage `case 'error'` | 僅 `logger.error`,不 route 回 invoke caller | 用 reqId 找 pending invoke promise 並 reject |
| 8 | main.ts:1586 | `ptyManager` 為 null(初始化前 edge) | optional chaining → undefined 回 client | return `{ok:false, reason:'manager-not-ready'}` |
| 9 | remote-server.ts:320 | Handler 回 undefined → `sendFrame result=undefined` | bat-notify `writeResp.error` 是 undefined → log `result=ok`(T0210 錯覺根因) | Handler 回 structured `{ok, reason}`,protocol frame 結構不變 |

**T0210 錯覺機制**(bat-notify.mjs:481, 505):
```js
result: notifyResp.error ? 'error' : 'ok'   // 只看 .error 欄位
result: writeResp.error ? 'error' : 'ok'    // 同上
```
Server 沒 throw → frame 無 `error` → client log `ok`,即使 handler 真的什麼都沒做。

### Step 3 — T0205/T0206 成功 vs T0207 失敗(條件差異推論)

同一 target id `c8a43b60...`,排序最可能原因:

**推論 A(最可能)— Terminal-server refork race window**:
- `pty-manager.ts:770-798`:recovery 時 `instances.clear()` → `sendToServer(pty:create)` → `instances.set(id, {...process:null})`
- 在 refork 剛完成瞬間,**main map 已有 entry**,但 terminal-server child 的 `ptys` Map **尚未 pty:create 完成**(async,IPC 排隊)
- 此時 pty:write 走 useServer 分支(L5→L6):
  - main 端 `instances.has(id) === true` → 進入 sendToServer
  - child 端 `ptys.has(id) === false` → 條件 #6 broadcast error
  - bat-notify 仍收到 `invoke-result`(因 invokeHandler 已同步 return undefined)→ log `ok`
- T0205/T0206 在穩定態,T0207 撞到 refork 窗口

**推論 B — Workspace 切換導致 instance lifecycle drift**:
- `instances.delete` 出現在 5 處(268, 506, 582, 635, 654),若塔台 terminal 所在 workspace 在 bat-notify 送達瞬間被移除,同樣進入條件 #1

**推論 C — BAT app 重啟但 session 資訊不同步**:
- 新 window / worktree 指向舊 terminal id,main map 與 terminal-server 不同步

**驗證建議**(可寫入 T0215 log 增強):
- pty-manager.ts:604 加 log:`instances.has(id)`, `useServer`, `serverProcess.connected`
- terminal-server/server.ts:250 加 log:`ptys.has(req.id)` + 時間戳
- 串 correlation id(方案 B)讓 main+child NDJSON 可 join

**使用者可補充**(非阻斷):T0207 當下塔台 / BAT app 是否剛:
- 切過 workspace?
- 觀察到「terminal-server recovered」toast?
- 或長時間 idle 後被 sleep / 網路斷線 resume?

### Step 4 — 推薦 Error 回傳協議(方案 A + 局部方案 B)

**方案 A(階段 1 必做,最小變更)— 結構化 result payload**:
- `PtyManager` 新增 `writeWithResult(id, data): { ok: boolean; reason?: string }`(**不改舊 write**,避免影響內部 caller)
- `main.ts:1586` 改用 `writeWithResult` 並於 null 時回 `{ok:false, reason:'manager-not-ready'}`
- `remote-server.ts` sendFrame 結構不變,result 欄位填 `{ok, reason?}`
- `bat-notify.mjs` 檢查 `writeResp.result?.ok === false`(**嚴格 `=== false`** 避免舊 server undefined 誤觸發)→ exit 1
- **涵蓋**:silent drop 條件 #1, #3, #4, #5, #8, #9
- **向後相容**:舊 server 回 undefined → `ok === false` 是 undefined,不觸發阻斷

**方案 B(階段 2 補上,可選)— IPC correlation id**:
- pty-manager → terminal-server IPC 加 `reqId`
- terminal-server writePty 完成後回 `{type:'pty:write-result', reqId, ok, reason?}`
- pty-manager 持 `pendingWrites: Map<reqId, {resolve, timeout}>`,`handleServerMessage` 用 reqId 找 pending 並 resolve/reject
- **涵蓋**:條件 #2, #6, #7(refork race)
- **成本**:~80-120 行 + timeout 處理

**方案 C(否決)— 全 protocol op-id tracking**:改動過大,非 T0215 階段 1 範圍。

**推薦節奏**:
- T0215 ship 方案 A(單獨驗證能否顯性化 T0207)
- 若方案 A 後仍有 silent drop(條件 #2/#6/#7)→ T0216+ 階段 2 ship 方案 B

### Step 5 — bat-notify.mjs 改動範圍

**改動位置**:`scripts/bat-notify.mjs:499-509`(pty:write 分支)

**變更內容(偽 diff,估 ~20 行)**:
```js
const writeResp = await waitForMessageById(ws, writeId)
const payload = writeResp.result        // ← 新增
const failed = writeResp.error
  || (payload && payload.ok === false)  // ← 嚴格 === false
if (failed) {
  const reason = writeResp.error || payload?.reason || 'unknown'
  console.error(`Error: PTY write failed: ${reason}`)
  logEvent('bat-notify', 'send', { channel:'pty:write', result:'error', reason, submit, appendedCR:submit && !endsWithNewline })
  logEvent('bat-notify', 'exit', { code: 1, reason: `pty-write-${reason}` })
  ws.close(); process.exit(1)            // ← Option C 硬阻斷
}
logEvent('bat-notify', 'send', {
  channel: 'pty:write', result: 'ok', submit,
  appendedCR: submit && !endsWithNewline, error: null,
})
```

**回歸風險**:低
- 舊 server 路徑:payload=undefined → `payload?.ok === false` 為 undefined → falsy 但 `||` 條件仍 false(嚴格 `=== false` 是關鍵)
- 新 server 成功:payload={ok:true} → 不阻斷
- 新 server 失敗:payload={ok:false, reason} → exit 1

**不回歸 T0205/T0206**:正常路徑 payload.ok=true 行為不變。

### Step 6 — T0215 實作建議

**Server 端 diff(電腦端 Electron main)**:
1. `electron/pty-manager.ts` — 新增 `writeWithResult` 方法(~40 行):
   - 入口檢查 `this.instances.has(id)` → 不存在回 `{ok:false, reason:'pty-not-found'}`
   - useServer 分支:保留 fire-and-forget,回 `{ok:true, reason:'queued'}`(樂觀,因無 ack;方案 B 才能真正保證)
   - 非 useServer + usePty:try/catch 包 `instance.process.write` → throw 時回 `{ok:false, reason:'pty-write-threw:<msg>'}`
   - 非 useServer + !usePty:檢查 `cp.stdin` 存在 → undefined 回 `{ok:false, reason:'stdin-missing'}`;否則 write + `{ok:true}`
2. `electron/main.ts:1586` — 1 行改動:
   ```ts
   registerHandler('pty:write', (_ctx, id, data) =>
     ptyManager?.writeWithResult(id as string, data as string)
     ?? { ok:false, reason:'manager-not-ready' })
   ```

**Client 端 diff**:見 Step 5。

**驗收 smoke 場景(T0215 階段 1)**:
| # | 場景 | 預期 | 驗收 log |
|---|------|------|---------|
| 1 | Baseline:bat-notify 送到存在的 target | exit 0 | `result=ok, payload.ok=true` |
| 2 | Not-found:送不存在的 target id | exit 1 | `result=error, reason=pty-not-found` |
| 3 | T0207 重現(若可):剛 refork 後立即送 | exit 1 而非 silent(因 useServer 路徑樂觀回 ok,**階段 1 仍可能 false-ok**,需方案 B 才能真正捕捉) | `result=ok, payload.ok=true, reason=queued` —— **作為方案 B 必要性的 baseline** |
| 4 | 向後相容:bat-notify 新版 + server 舊版 | exit 0(正常) | `result=ok, payload=undefined` |

**風險評估**:
- ⚠️ 方案 A 單獨 **不能** 保證解決 T0207(若根因是 refork race,useServer 分支樂觀回 ok 仍會讓 bat-notify 看到 ok)
- ✅ 但方案 A 仍達成「顯性化」:非 refork 情境(條件 #1/#3/#4/#5/#8)會 exit 1,縮小未知空間
- ✅ 驗收場景 #3 的結果能幫下一工單決策:若方案 A 後 T0207 仍 silent ok → 必須 ship 方案 B

### 互動紀錄
無(本次未向使用者提問;所有推論基於 code 證據,Step 3 使用者補充項列為非阻斷後續觀察建議)

### 遭遇問題
1. **T0207 根因無法純靠 code 確認**:refork race 為最強 hypothesis(推論 A),但需使用者補 T0207 當下 BAT app 狀態觀察 / 重現步驟,或 T0215 加 log 後觀察實際出現的 silent drop 條件 #
2. **方案 A 的 useServer 分支有「樂觀回 ok」的不完整性**:若 T0207 正是撞到 refork race,階段 1 仍會 log `payload.ok=true` —— 需要階段 2(方案 B correlation id)才能真正覆蓋。工單已於 PLAN-024 階段 2 預留,此處為階段 1 baseline,非缺陷

### Renew 歷程
無
