# PLAN-021-remote-server-port-settings-ui

## 元資料
- **編號**:PLAN-021
- **標題**:Settings UI 支援自訂 RemoteServer port(預設 9876,衝突時可改 + 測試按鈕)
- **狀態**:IDEA
- **優先級**:🟢 Low(無 user report,預防性,port 衝突目前靠「換 port」workaround 即可)
- **類型**:功能想法(UX 改善,降低新使用者 port 衝突時的排障成本)
- **建立時間**:2026-04-19 03:00 (UTC+8)
- **關聯**:BUG-046(dispatcher silent fail 討論時衍生)、PLAN-018(T0182 remote 資安基建)
- **驗證場景**:某 dev 環境 port 9876 被其他服務佔用 → 改 port 後 dispatcher + UI 皆可用

## 動機 / 背景

目前 BAT RemoteServer 的 port 是 **hardcoded 9876**(電子版實作層)或由 env var `BAT_REMOTE_PORT` 指定。當 port 被其他軟體佔用時:

- **Server 端**:`https.createServer.listen(9876)` 直接 `EADDRINUSE` bind 失敗 → app 啟動異常
- **Dispatcher 端**:連上「別人的 9876 process」→ TLS handshake 失敗或怪異行為(T0202a 會給 clear error,但 UX 仍然是「錯誤訊息看不懂」)
- **使用者自救**:目前需要手動 export env var 或改 code — 完全不友善

BUG-046 排查過程中使用者提問「若 port 被佔用怎辦」→ 確認這是真議題,但**與 BUG-046 正交**(BUG-046 是 TLS protocol mismatch,不是 port 衝突)。

## 目標

Settings UI 新增 Remote 區塊,讓使用者:

1. 看到當前生效的 port(顯示目前運行的 port,不只是 config 值)
2. 修改 port(text input / number,範圍 1024-65535)
3. **測試按鈕**:
   - 嘗試 bind listener 到輸入的 port → 確認可用
   - 回饋:✅ 可用 / ❌ 已被佔用(附占用 process 資訊若 OS 允許)
4. 儲存時提示「需重啟 BAT 才生效」,或支援熱切換(需重建 HTTPS server)

## 非目標(範圍外)

- ❌ 不做自動 fallback port(例如 9876 失敗 → 試 9877 ...)— 靜默切 port 反而讓使用者搞不清狀況
- ❌ 不做多 port 同時開放(YAGNI)
- ❌ 不動 dispatcher 端 `BAT_REMOTE_PORT` 環境變數傳遞邏輯(現況已正確,env var 會 inherit 到子 terminal)

## 技術考量

### Settings 儲存位置

對齊現有 Electron 配置路徑:
- `app.getPath('userData')/settings.json`(推測,需 Worker 研究時確認)
- 欄位:`remote.port: number`(預設 9876)

### Port Test 實作

```typescript
// main process
async function testPort(port: number): Promise<{ available: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', (err: any) => {
      resolve({ available: false, reason: err.code === 'EADDRINUSE' ? 'in-use' : err.code })
    })
    server.once('listening', () => {
      server.close(() => resolve({ available: true }))
    })
    server.listen(port, '127.0.0.1')
  })
}
```

暴露為 IPC handler(`settings:test-port`)供 renderer 呼叫。

### 生效時機

兩種選擇(實作時二選一):
- **A. 需重啟**:改 port → 存 settings → 提示「重啟 BAT 生效」。實作最簡單,但 UX 不完美
- **B. 熱切換**:改 port → trigger RemoteServer 重建 HTTPS server(close 舊 listener → 用新 port bind)。考慮 active WS 連線斷線提示、QR payload 重生成等副作用

預設 **A**(KISS,Port 不會天天改)。

### UI 配置建議

Settings → Remote 區塊:

```
┌─ Remote Server ─────────────────────────┐
│ Status: Running on port 9876            │
│                                         │
│ Port:  [9876          ]  [Test]         │
│        Default: 9876                    │
│                                         │
│ [Reset to default]  [Save]              │
└─────────────────────────────────────────┘
```

Test 結果即時顯示:
- ✅ Port 9876 is available
- ❌ Port 9876 is in use by another process

## 拆單建議(實作時)

| 工單 | 範圍 | 估時 |
|-----|------|------|
| T#### Step 1 | Settings schema + main process `remote.port` load/save + 讀取處改用 settings | 30-45 min |
| T#### Step 2 | IPC handler `settings:test-port` + preload bridge | 15-20 min |
| T#### Step 3 | Settings UI Remote 區塊 + Test 按鈕 + 即時回饋 | 45-60 min |
| T#### Step 4(選用) | 熱切換支援(B 方案) | 60-90 min |

## 驗收標準

- [ ] Settings 能設定自訂 port
- [ ] Test 按鈕正確回報 available/in-use
- [ ] 改 port + 重啟後 RemoteServer 在新 port 運行
- [ ] Dispatcher(BAT 內部終端)繼續能連上(`BAT_REMOTE_PORT` env var 會跟著更新)
- [ ] QR payload 的 url 反映新 port
- [ ] 回歸:預設 9876 未改時功能照常

## 備註

- 本 PLAN 非緊急,排入 backlog 等 dogfood 或使用者回報 port 衝突時再優先
- 與 BUG-046 完全正交,不阻擋 T0202a/b/c 修復鏈
- 實作時可參考 PLAN-018 T0182 對 Remote config 的操作模式
