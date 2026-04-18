# PLAN-022-dispatcher-fingerprint-pinning

## 元資料
- **編號**:PLAN-022
- **標題**:Dispatcher fingerprint pinning(對齊 PLAN-018 T0182 安全要求)
- **狀態**:PLANNED
- **優先級**:🟡 Medium(非功能 blocker,但 `rejectUnauthorized: false` 長期是安全缺口)
- **類型**:技術改善(安全對齊)
- **建立時間**:2026-04-19 03:15 (UTC+8)
- **關聯**:T0201(D 段 T0202c 列)、T0202b(TLS 升級但未加 pinning)、PLAN-018 T0182(server 端 fingerprint pinning 基建)、BUG-046(延伸議題)

## 動機 / 背景

T0202b 完成 dispatcher TLS 升級,但為避免範圍爆炸,**刻意跳過 fingerprint pinning**:

```javascript
// T0202b 後現況:
tls.connect({
  host,
  port,
  rejectUnauthorized: false  // ← 接受任何 cert,無 MITM 防護
})
```

這等於 PLAN-018 T0182 的 fingerprint pinning 只在 **Electron client(remote-client.ts)** 生效,dispatcher 這條路徑仍是信任任何 cert。雖然 dispatcher 限定 localhost(`127.0.0.1`)使用,但:

1. **攻擊面**:本機另一 process 若能監聽 port 9876(race condition 或 BAT 未啟時),dispatcher 會連上並送 token
2. **對齊 PLAN-018**:T0182 明載「client 以 SHA-256 fingerprint (TOFU) 驗證」,dispatcher 是合法 client 之一,卻沒做
3. **符合 KISS**:T0201 D 段建議分三張做,本張是最後一張的安全補強

## 目標

Dispatcher(`scripts/bat-terminal.mjs` 的 `MinimalWS.connect`)驗證 server cert fingerprint:

1. 連線後從 `TLSSocket.getPeerCertificate().fingerprint256` 取指紋
2. 與**已知信任指紋**比對
3. 不匹配 → reject + 明確錯誤訊息
4. 首次無記錄 → TOFU 寫入 dispatcher-side trust store

## 拆單建議(實作時)

| 工單 | 範圍 | 估時 |
|-----|------|------|
| T#### Step 1 | 從 `server-cert.json`(user-data dir)讀 fingerprint(最簡方案,信任來源為 BAT app 本身) | 15-20 min |
| T#### Step 2 | 加 fingerprint 比對邏輯 + 失敗錯誤訊息 + T0200 log event(`exit:fingerprint-mismatch`) | 20-30 min |
| T#### Step 3(選用) | TOFU fallback:若無 `server-cert.json` → 第一次連線後寫 `~/.bat-dispatcher/trust.json` 記錄;後續比對 | 20-30 min |

## 技術考量

### 信任來源選擇

**推薦選 A**:讀 BAT app 的 `server-cert.json`

路徑(Windows):`%APPDATA%/BetterAgentTerminal/server-cert.json`
路徑(Unix):`$HOME/Library/Application Support/BetterAgentTerminal/server-cert.json`

優點:
- BAT app 本身持有 cert 生成權,檔案就是 ground truth
- 不需要額外的 TOFU 流程(單純讀檔比對即可)
- Dispatcher 與 BAT app 同機,路徑永遠可用

缺點:
- 強耦合於 BAT app 安裝路徑約定
- 若 BAT app 未啟動 / 未初始化 cert → dispatcher 也無法連線(但這情境本來就不該連)

**備案 B**:TOFU(第一次信任 → 存 dispatcher-side config)

優點:
- dispatcher 可完全獨立於 BAT app 安裝結構

缺點:
- 引入 dispatcher-side trust store(新增 `.bat-dispatcher/` 配置目錄)
- TOFU 的第一次若是惡意 process 就永久被騙(MITM 窗口)

**建議**:主走 A,B 作為 fallback(若 `server-cert.json` 讀失敗才啟用)。

### 實作骨架

```javascript
import { readFileSync } from 'node:fs'
import path from 'node:path'

function loadTrustedFingerprint() {
  const userData = process.platform === 'win32'
    ? path.join(process.env.APPDATA, 'BetterAgentTerminal', 'server-cert.json')
    : path.join(process.env.HOME, 'Library/Application Support/BetterAgentTerminal/server-cert.json')

  try {
    const cert = JSON.parse(readFileSync(userData, 'utf-8'))
    return cert.fingerprint256  // 假設 BAT app 存入時用此欄位名
  } catch (err) {
    return null  // TOFU fallback 可選
  }
}

// MinimalWS.connect 內:
socket.once('secureConnect', () => {
  const peer = socket.getPeerCertificate()
  const actualFp = peer.fingerprint256
  const expectedFp = loadTrustedFingerprint()

  if (expectedFp && actualFp !== expectedFp) {
    logEvent('exit', {
      reason: 'fingerprint-mismatch',
      expected: expectedFp,
      actual: actualFp,
      hint: 'Server certificate does not match trusted fingerprint. Possible MITM or BAT app reinstalled.'
    })
    socket.destroy()
    return reject(new Error('Server cert fingerprint mismatch'))
  }
  // ... 繼續送 HTTP upgrade
})
```

## 驗收標準

- [ ] Dispatcher 連線後驗證 fingerprint
- [ ] 不匹配 → 明確錯誤訊息 + exit 1 + log event
- [ ] 匹配 → 正常走後續流程(與 T0202b 狀態一致)
- [ ] `server-cert.json` 讀失敗 → 決定走 TOFU 或 fail-close(實作時二選一)
- [ ] smoke 測試:正常派發 OK / 故意改 cert 觸發 mismatch OK

## 風險與備註

- **風險**:若 BAT app 升級重生 cert 但 dispatcher cache 了舊 fingerprint → 所有派發失敗。需決定刷新策略(讀檔 = 每次新鮮 / TOFU = 需手動清 trust store)
- **非緊急**:本機攻擊模型對多數使用者不是威脅,但對齊 PLAN-018 是長期正確方向
- **建議排程**:下次 session 若無其他高優先任務可開始;或 BUG 回報 dispatcher 被攻擊 / MITM 疑慮時優先處理

## 備註

- 本 PLAN 從 BUG-046 延伸而生(T0201 研究 D 段 T0202c 候選)
- T0202b commit `831234b` 已預留 pinning 入口(`secureConnect` callback),實作 T0202c 時只需擴充該 callback
