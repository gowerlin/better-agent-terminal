# BUG-046 — BAT dispatcher `--interactive` flag 派發 silent fail（T0193 疑似 regression）

## 元資料
- **編號**:BUG-046
- **狀態**:CLOSED(T0202b 實證本 session 派發成功,yolo 派發鏈解鎖)
- **嚴重度**:🔴 High（完全阻擋 dispatcher → terminal 啟動,塔台 yolo 派發失效）
- **建立時間**:2026-04-19 00:32 (UTC+8) | **更新**:00:40 第一次翻案,02:42 第二次翻案,03:12 CLOSED
- **關閉時間**:2026-04-19 03:12 (UTC+8)
- **發現來源**:T0194 派發實錄(4 次連續失敗,降級 `--no-interactive` 也失敗)
- **關聯**:T0200(dispatcher defense + 發現 MinimalWS.close bug)、T0201(TLS 假設確認)、T0202a(close reject 獨立防禦)、T0202b(TLS 升級 + yolo 解鎖)、PLAN-018 T0182(server 端 TLS 基建)
- **修復 commits**:`380fa3c` T0202a(close reject)+ `831234b` T0202b(TLS 升級)
- **可重現**:100%(4 次派發完全相同症狀)
- **workaround**:**手動開新終端** + 直接執行 `claude "/ct-exec T####"`(新終端 fork 自 BAT 主進程,token 會 fresh)
- **真根因**(雙重翻案後確認):PLAN-018 T0182 將 server 升級到 `https.createServer` + wss://,但 dispatcher `MinimalWS.connect` 仍用 `net.createConnection` + plain HTTP upgrade。TLS handshake 失敗 server FIN close → MinimalWS close handler 不 reject → Promise pending → silent exit 0。
- **延伸議題**:T0202c fingerprint pinning 對齊 PLAN-018 安全 — 另開 PLAN-022 追蹤

## 翻案說明（2026-04-19 00:40）

原假設「T0193 `--interactive` 路徑 regression」**錯誤**。新證據：

1. `--no-interactive` 同樣失敗 — 不是 flag-specific
2. `bat-scripts.log` 經 grep 只有 0 個 `script:"remote-server"` 條目 — T0193 的 Electron 端 mirror 從未被呼叫過 → handler 根本沒被觸發 → T0193 沒「破壞」任何東西,只是診斷儀表還沒派上用場
3. 日誌檔被 truncate 過（6486 bytes → 1570 bytes,先前條目消失）— 暗示 BAT app 重啟過
4. dispatcher 卡 `await waitForMessage` → 進程被某機制終止（沒寫 exit log,bash 看到 EXIT=0）

## 真正根因假設（按可能性）

1. **🔴 Auth token 失效（最可能）**:本 Tower terminal 的 `BAT_REMOTE_TOKEN` 是 BAT restart 前的舊值,新 RemoteServer 認不出 → auth 不回 → dispatcher 卡死
   - 解釋為何 handler 從未被觸發（auth 沒過,handler 不會執行）
   - 解釋為何沒有 exit log（waitForMessage 永久卡住,進程被某機制終止）
   - 但 Test-NetConnection 顯示 port 9876 listen 中 → server 在,只是 token 不同
2. **🟡 BAT app 啟動時清空 bat-scripts.log**:日誌檔被 truncate 印證 app 重啟,但這是症狀不是因
3. **🟢 dispatcher 自身防禦不足**:`scripts/bat-terminal.mjs:436` `waitForMessage` 沒包 try/catch → timeout 變 unhandled rejection → 連 `main().catch()` 都救不到（這條是真 bug,獨立修）

## 鐵證對照（更新版）

| 派發 | 時間 (UTC) | flag | 事件鏈 | 結果 |
|------|-----------|------|-------|------|
| T0193 | 15:49:30 | `--no-interactive` | invoke → parsed → invoke-create-with-command → terminal-created → exit(0) | ✅ 成功（BAT restart 前） |
| T0194 #1 | 16:24:48 | `--interactive` | invoke → parsed → **[silent hang]** | ❌ 失敗 |
| T0194 #2 | 16:27:42 | `--interactive` | invoke → parsed → **[silent hang]** | ❌ 失敗 |
| T0194 #3 | 16:33:11 | `--no-interactive` | invoke → parsed → **[silent hang]** | ❌ 失敗（推翻 flag-specific 假設） |
| T0194 #4 | 16:36:?? | `--no-interactive` | invoke → parsed → **[silent hang]** | ❌ 失敗 |

`grep '"script":"remote-server"'` count = **0** → handler 從未執行,排除 T0193 直接因果。

## 鐵證對照

`%APPDATA%/BetterAgentTerminal/Logs/bat-scripts.log`:

| 派發 | 時間 (UTC) | flag | 事件鏈 | 結果 |
|------|-----------|------|-------|------|
| T0193 | 15:49:30 | `--no-interactive` | invoke → parsed → **invoke-create-with-command** → terminal-created → exit(0) | ✅ 成功 |
| T0194 #1 | 16:24:48 | `--interactive` | invoke → parsed → **[無聲消失,無 exit log]** | ❌ 失敗 |
| T0194 #2 | 16:27:42 | `--interactive` | invoke → parsed → **[無聲消失,無 exit log]** | ❌ 失敗 |

bash 看到的 exit code 為 0,但 script 沒有寫任何 `exit` 事件 → script 在 `parsed` 後、`invoke-create-with-command` 前**未完成 await**(可能 `waitForMessage` timeout 觸發 unhandled rejection)。

## 根因假設(三選一,需調查)

1. **Electron handler regression**:T0193 commit `2950800` 修改 `electron/remote/*` 加 IPC mirroring,可能破壞 `terminal:create-with-command` handler 在 `CT_INTERACTIVE=1` payload 下的處理路徑(只影響 interactive customEnv 觸發的 code path)
2. **Dispatcher 自身 bug**:`scripts/bat-terminal.mjs:455-460` 的 `interactive === true` 分支與 `customEnv` 合併產生意外 payload(但 spread 應該沒問題)
3. **WebSocket auth/connect 競態**:`waitForMessage` 沒包 try/catch(`scripts/bat-terminal.mjs:436`)→ timeout 變 unhandled rejection 靜默退出。但這條路徑與 `--interactive` 無關

**最可能根因排序**:1 > 3 > 2

**證據**:
- T0193 commit 之前 `--interactive` 是否 work?(需查 git history,可能 BAT 重啟前還沒載入新 Electron code,所以歷史成功只代表「舊 Electron + 任何 flag」OK)
- 本 BAT 重啟後第一次 `--interactive` 派發即失敗

## 預期 vs 實際

- **預期**:`--interactive` 與 `--no-interactive` 唯一差異是 `customEnv.CT_INTERACTIVE` = `'1'` vs `'0'`,Electron 端應該照常 spawn terminal
- **實際**:`--interactive` 路徑 Electron 端疑似 crash/hang,terminal 完全沒起;dispatcher 等不到 invoke response 靜默死亡

## 建議修復方向

### Phase 1：驗證 token 假設（最快路徑）
1. 比對舊 Tower terminal env 與 BAT 當下發送的 token 是否一致
2. 確認 BAT app 是否在 T0193 dispatch 之後、T0194 dispatch 之前 restart 過
3. 若驗證 token mismatch → root cause 確認

### Phase 2：dispatcher 防禦性修復（無論 root cause 如何都該做）
- `scripts/bat-terminal.mjs:436` `waitForMessage` 包 try/catch,timeout 寫 `exit { reason: 'auth-timeout' }` log 事件
- `scripts/bat-terminal.mjs:480` `waitForMessage` 同樣處理,寫 `exit { reason: 'invoke-timeout' }`
- 加 `await-auth-response` / `await-invoke-response` 兩個 log 事件,定位卡點
- main() 任何 await 都該有對應 timeout 寫 exit log

### Phase 3：BAT app 修復
- 排查為何 bat-scripts.log 會被 truncate（BAT 啟動初始化是否有清檔邏輯?）
- 若 token rotation 是 by design → 提供 token refresh 機制給長壽 Tower terminal
- 若 token 應該長期穩定 → 排查為何 restart 後 token 變了

### Phase 4：驗收
- dispatcher 任一卡點都會寫 exit log（無 silent fail）
- `bat-scripts.log` 跨 BAT restart 不被 truncate
- token mismatch 時 dispatcher 明確報錯（而非永久 hang）

## 備註

- **BUG-043 排除**:BUG-043 是「Worker 端 yolo banner 偶發失效」(終端有起,只是 banner 沒顯示)。本張是「終端完全沒起」,根因不同
- **本 session 影響**:T0194 已降級為 `--no-interactive` 派發,Worker 若需要互動只能 pause 回報
- **不阻擋 PLAN-019 後續**:BUG-044/045 修復鏈不依賴 `--interactive`(只是 Worker 互動體驗降級)
- **後續處理**:本 session 只建檔,實際修復排程下次 session 或專門 dogfood 時段
