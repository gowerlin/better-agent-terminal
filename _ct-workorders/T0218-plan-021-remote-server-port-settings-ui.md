# 工單 T0218 — PLAN-021 Settings UI 自訂 RemoteServer port(Step 1+2+3+4 含熱切換)

## 元資料
- **工單編號**:T0218
- **任務名稱**:PLAN-021 Settings UI Remote 區塊 + port 自訂 + Test 按鈕 + QR 預覽 + active conn 警告 + 熱切換
- **狀態**:PENDING
- **建立時間**:2026-04-19 19:59 (UTC+8)
- **開始時間**:(sub-session 開始時填入)
- **完成時間**:(完成時填入)
- **目標子專案**:(本專案根,non mono-repo)

## 工作量預估
- **預估規模**:大
- **預估工時**:~150-215 min(Step 1 30-45 + Step 2 15-20 + Step 3+UI加料 60-80 + Step 4 熱切換 60-90,Worker time 可能壓縮到 15-30 min)
- **Context Window 風險**:中(預計改動 5-8 檔:main process settings / remote server / IPC / preload / renderer Settings 元件)
- **降級策略**:若熱切換 Step 4 實作揭露 RemoteServer cleanup 限制,可 PARTIAL 附差異分析,Step 4 拆到 T0219

## Session 建議
- **建議類型**:🆕 新 Session(YOLO 模式,BAT 內部終端)
- **原因**:大型工單需隔離 context;作為 BUG-050 階段 1 VERIFY 期 YOLO 樣本 #3(連續多單 YOLO 壓力測試使用者驗證角度)

## 任務指令

### BMad 工作流程
無(手動執行,非 BMad story)

### 前置條件
需載入的文件清單:
- `_ct-workorders/PLAN-021-remote-server-port-settings-ui.md`(本工單原始規格 + UI mockup + Port test 骨架)
- `electron/remote/` 目錄(RemoteServer 實作,含 certificate.ts、可能有 server.ts / remote-server.ts)
- `electron/main.ts` 或 `electron/index.ts`(main process 啟動點,RemoteServer 初始化處)
- `electron/preload.ts`(IPC bridge)
- `src/renderer/components/`(現有 Settings 元件位置,Worker 自行 locate;若無 Settings,需找對應設定面板元件)
- `_ct-workorders/T0217-plan-022-dispatcher-fingerprint-pinning.md`(T0217 Worker 對 certificate.ts 與 BAT_REMOTE_PORT env 傳遞已有理解,可參考)
- `_ct-workorders/PLAN-018-remote-app-access-hardening.md`(T0182 remote 資安基建,含 QR payload 結構:`{url, token, fingerprint, mode, addresses}`)

### 輸入上下文

**背景**:
- 目前 RemoteServer port **hardcoded 9876**(或 `BAT_REMOTE_PORT` env 指定),port 衝突時 app 啟動 EADDRINUSE 失敗
- 使用者自救需 export env var 或改 code,不友善
- PLAN-021 提供完整設計:Settings UI Remote 區塊 + Test 按鈕 + 預設 A(重啟生效)為 PLAN 推薦最簡路徑
- 本工單**升級到最完整**:實作 Step 1+2+3+4 + OS-specific port 佔用資訊 + QR 預覽 + active conn 警告 + 熱切換

**決策採用**(塔台 + 使用者確認):
- Q1 工單粒度:**[C]** Step 1+2+3+4 完整(含熱切換)
- Q2 Port 測試強度:**[B]** OS-specific 佔用 process 資訊(Windows netstat / Unix lsof)
- Q3 UI 複雜度:**[B] + [C]** PLAN 骨架 + QR 預覽 + active conn 警告
- Q4 Smoke 情境:**[C]** 完整(含 QR 對照 + BAT 內部終端回連)

**技術棧**:
- Electron main process:settings load/save + RemoteServer 管理
- React + TypeScript renderer:Settings UI
- Node.js APIs:`net.createServer()` for port test,`child_process` for OS-specific lookup
- 現有 `https.createServer` + `app.getPath('userData')` (T0182 基建)

**特殊注意 — YOLO 執行邊界(catch-22 防護)**:

本 session 的 Tower 與 Worker 都在**本 BAT 內部終端運行**(BAT_SESSION=1)。任何會中斷本 BAT RemoteServer 的操作會**殺死 Worker 自己的 session**,形成 catch-22。**Worker 必須嚴格遵守以下邊界**:

**YOLO-safe 可做**:
- ✅ 所有 code 實作(Step 1-4)— 純檔案編輯
- ✅ `tsc --noEmit` + `npx vite build`(純編譯驗證,不啟動 Electron)
- ✅ 在**非 9876 port** 做 bind/release 單元邏輯驗證(用 54321 或其他冷 port)
- ✅ Test 按鈕邏輯驗證(用假的 port 跑 `testPort()` 函式,驗證 available/in-use 回傳結構)

**嚴格禁止**:
- ❌ `npm run dev` / `npm start` / 任何會啟動新 Electron 實例的指令(會撞本 BAT 的 port 9876)
- ❌ 嘗試 kill / restart 當前運行的 RemoteServer
- ❌ 在 port 9876 上跑任何測試(本 BAT 正佔用,會互打)
- ❌ 手動改本機 `settings.json` 來「測試」port 切換(這會影響正在運行的 BAT)

**完成行為**:
- YOLO-safe 部分完成後 → 填寫回報區狀態 **PARTIAL** + 「dev server 手動 smoke 清單」(供塔台提示使用者何時切 dev 測試)
- auto-submit「T0218 部分完成」而非「T0218 完成」(字面區分,塔台識別需要後續人工 smoke)

### 技術細節

**Step 1 — Settings schema + main process load/save**
- locate 現有 settings 儲存位置(可能 `app.getPath('userData')/settings.json` 或其他慣例)
- 新增 schema:`remote.port: number`(default 9876,range 1024-65535)
- load:app 啟動時讀 settings,若無或無效則 fallback 9876
- save:寫入 settings.json,原子寫入避免 corruption
- RemoteServer 啟動處(可能 `electron/remote/server.ts` 或類似)改讀 settings 值而非 hardcoded 9876
- 保留 `BAT_REMOTE_PORT` env var 優先級高於 settings(讓 CI / override 仍能運作)

**Step 2 — IPC handler `settings:test-port`**
- main process handler 實作 PLAN 骨架的 `testPort(port: number)`
- **升級 Q2 B**:若 in-use,OS-specific 查佔用 process:
  - Windows:`netstat -ano | findstr :<port>` → 取 PID → `tasklist /FI "PID eq <pid>" /FO CSV` → 取 image name
  - macOS/Linux:`lsof -i :<port> -t` → 取 PID → `ps -p <pid> -o comm=` 取 process name
  - 降級:查詢失敗時回傳 `{ available: false, reason: 'in-use' }`(無 process 名亦可)
- preload bridge 新增 `window.electronAPI.settings.testPort(port: number)`
- IPC handler 回傳型別 `{ available: boolean, reason?: string, processName?: string, pid?: number }`

**Step 3 — Settings UI Remote 區塊**
- locate 現有 Settings 元件(可能 `src/renderer/components/Settings.tsx` 或類似)
- 新增 Remote 區塊,對齊 PLAN-021 UI mockup:
  - **Status**:「Running on port <current>」(讀 main process 當前生效 port)
  - **Port input**:text / number,範圍 1024-65535,validate 輸入
  - **Test 按鈕**:呼叫 IPC,即時顯示結果(✅ available / ❌ in-use by `<process>` (PID <pid>))
  - **QR 預覽卡片**(Q3 B 加料):
    - 當 port 變動時,即時顯示新 QR payload 的 url 部分(格式 `wss://<host>:<port>`)
    - 可重用 PLAN-018 T0182 現有 QR 渲染元件(Worker 自行 locate)
    - 若 QR 元件跨整個 Remote 流程重構工程過大,**降級**:只顯示 `url` 文字預覽(不渲染完整 QR 圖),附備註「完整 QR 需重啟後在現有 Remote 連線面板查看」
  - **Active connections 警告**(Q3 C 加料):
    - 顯示「當前 N 個活躍 dispatcher/remote client 連線」
    - 改 port 時警告「Save 後會斷 N 個連線」
    - count 來源:RemoteServer 內部的 WS client set(Worker 自行探查 count API,若無現成可加一個 getter)
  - **Reset to default**:回到 9876
  - **Save 按鈕**:觸發 Step 4 熱切換 OR 提示重啟(見 Step 4)

**Step 4 — 熱切換**
- Save 時呼叫 main process 的 `remoteServer.restart(newPort: number)` 類 API
- 實作流程:
  1. 廣播所有 active WS client 即將斷線(可選 grace period e.g. 2s)
  2. `httpsServer.close()` 等待現有連線 drain(timeout 5s 後強制)
  3. 用新 port 重新 bind + listen
  4. 通知 renderer 更新 UI status
  5. 更新 QR payload 內部 cache
- Edge case:新 port 又被佔用 → catch error → 回復舊 port + 提示使用者
- Save 按鈕 disable 期間顯示 loading(避免重複觸發)

**Step 1-4 安全單元 smoke(Worker 可在本 BAT 內跑)**:
```bash
# 測試 testPort 函式邏輯(不動真實 RemoteServer)
node -e "const {testPort} = require('./path/to/testPort'); testPort(54321).then(console.log); testPort(9876).then(console.log)"
# 預期:54321 available=true,9876 available=false + processName 含 Electron/BAT
```
若 testPort 不是獨立 module 不方便單測,可跳過此步,**只靠 tsc + vite build 驗證**。

### 預期產出

**修改檔案**(Worker 自行探查精確路徑):
- `electron/main.ts` 或對應 settings module(Settings schema + load/save + `remote.port`)
- `electron/remote/server.ts` 或 RemoteServer 實作檔(改讀 settings port + restart API)
- `electron/ipc/` 或對應 IPC handler 檔(`settings:test-port` + `settings:save-remote-port` + `remote:get-active-count`)
- `electron/preload.ts`(bridge `window.electronAPI.settings.testPort` + `saveRemotePort` + `remote.getActiveCount`)
- `src/renderer/components/Settings.tsx` 或對應元件(Remote 區塊 UI)
- 可能的新檔:`src/renderer/components/RemoteSettingsPanel.tsx` 若邏輯複雜可抽元件
- `_ct-workorders/PLAN-021-remote-server-port-settings-ui.md`(更新狀態 IDEA → IN_PROGRESS,附 Step 1-4 DONE 標記 + 待 dev smoke)

**commit 策略**:
- 建議拆 2-4 commit(per Step 邊界或 backend/UI 邊界)
- 最少 2 commit:backend(Step 1+2+Step 4 server 端) + UI(Step 3)
- commit message 範例:
  - `feat(remote): T0218 PLAN-021 Step 1+2+4 — settings-driven port + test IPC + hot-switch API`
  - `feat(settings): T0218 PLAN-021 Step 3 — Remote UI with QR preview and active conn warning`

### 驗收條件(分 Worker YOLO-safe + 使用者手動 dev smoke)

#### Worker YOLO-safe 範圍(必須在本 BAT 內完成)

- [ ] Step 1 Settings schema + load/save 實作
- [ ] Step 2 IPC handler `settings:test-port` 實作(含 OS-specific 佔用查詢)
- [ ] Step 3 Settings UI Remote 區塊(Status + Port input + Test + QR 預覽 + Active conn 警告 + Reset + Save)
- [ ] Step 4 熱切換 main process API 實作(server restart + edge case fallback)
- [ ] `tsc --noEmit` **0 錯誤**
- [ ] `npx vite build` **0 錯誤**
- [ ] 安全單元 smoke:testPort 函式在 port 54321(available)回傳 `{available:true}`
- [ ] **不改動當前運行的 RemoteServer / 不測 port 9876 / 不跑 npm run dev**
- [ ] 填寫回報區「dev server 手動 smoke 清單」(供塔台告知使用者)

#### 使用者手動 dev smoke 清單(Worker 列出,使用者切 dev 後執行)

- [ ] 1. **新 port 生效**:啟動 dev → Settings 改 port 到 54321 → 重啟 dev → 確認 54321 生效
- [ ] 2. **Test 按鈕**:dev 中測 54321(available)+ 測 9876(in-use,顯示 `<process> (PID <pid>)`)
- [ ] 3. **QR 對照**:改 port 前後,Settings QR 預覽顯示的 url 反映新 port
- [ ] 4. **熱切換**:不重啟 dev → 改 port Save → 舊 server 關 + 新 port 立即可用(不需 restart)
- [ ] 5. **Active conn 警告**:改 port 時正確 count 顯示活躍連線數
- [ ] 6. **BAT 內部終端模擬**:在 dev 中開終端 → 驗證新 port 下 `BAT_REMOTE_PORT` env 正確傳遞 + bat-notify/bat-terminal 能連上
- [ ] 7. **回歸**:port 設回 9876 重啟 → 既有行為照常(T0215/T0217 smoke 不受影響)

## Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示,都必須填寫。
> **本張為 YOLO 模式**:完成後自動 auto-submit 字串到塔台。
> **catch-22 防護**:請嚴格遵守「YOLO 執行邊界」區段的禁止行為。
> **完成訊息**:
> - 若所有 Worker YOLO-safe 驗收條件通過 → auto-submit「**T0218 部分完成**」(注意字面區分「完成」,塔台用此識別需要後續人工 smoke)
> - 若某 Worker YOLO-safe 步驟失敗 → auto-submit「**T0218 失敗**」+ 回報區詳述
> **BUG-050 階段 1 觀察(樣本 #3)**:本張是大工單,tool calls 較多,是 YOLO pipeline 壓力測試價值最高的樣本。回報區明確標示是否觀察到任何 `writeResp` 異常(不管 Worker 自己能不能看 `[T0215-DEBUG-REMOVE]` log,auto-submit 能否成功到塔台本身就是關鍵 signal)。

### 執行步驟

**Phase 1:實作(YOLO-safe)**
1. 讀取本工單 + PLAN-021 + 相關 electron/remote 程式碼
2. 更新「開始時間」欄位
3. locate Settings 儲存位置 + RemoteServer 啟動處 + 現有 Settings UI 元件
4. 實作 Step 1(Settings schema + load/save + RemoteServer 改讀 settings)
5. 實作 Step 2(IPC handler + OS-specific 查詢)
6. 實作 Step 4 main process API(熱切換 server restart + edge case)
7. 實作 Step 3 UI 元件(Remote 區塊完整)
8. `tsc --noEmit` 檢查
9. `npx vite build` 檢查
10. 安全單元 smoke:testPort(54321) 驗證函式邏輯

**Phase 2:回報**
11. 更新 PLAN-021 狀態(IDEA → IN_PROGRESS + Step 1-4 DONE + 待 dev smoke)
12. commit(2-4 張 atomic)
13. 填寫回報區:
   - 狀態:**PARTIAL**
   - 產出摘要:修改檔案清單 + 關鍵設計決策 + OS-specific 查詢實作方式 + QR 預覽實作方式(完整元件 vs url 文字降級)+ active conn count 取用方式
   - **dev server 手動 smoke 清單**(7 情境,列出後給塔台告知使用者)
   - BUG-050 YOLO 樣本 #3 觀察:auto-submit 是否成功
   - Worker time 實際 vs 預估
14. 填寫「完成時間」
15. YOLO auto-submit「**T0218 部分完成**」

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
(PARTIAL / FAILED / BLOCKED)

### 產出摘要
(列出修改檔案、關鍵設計決策、OS-specific 查詢實作、QR 預覽實作、active conn count 方式)

### 互動紀錄
(YOLO 模式通常無互動,若遇 catch-22 邊界模糊請主動 BLOCKED 回報)

### Renew 歷程
(無 Renew 填「無」)

### 遭遇問題
(若 RemoteServer 實作架構與 PLAN-021 技術考量不符 / Settings 位置非 `app.getPath('userData')/settings.json` / QR 元件難以重用 / active conn count 無現成 API 需新增 getter 等,在此描述)

### Worker YOLO-safe 驗收(逐項勾選)
- [ ] Step 1 Settings schema + load/save
- [ ] Step 2 IPC handler + OS-specific 查詢
- [ ] Step 3 UI Remote 區塊
- [ ] Step 4 熱切換 main process API
- [ ] tsc --noEmit 0 錯誤
- [ ] npx vite build 0 錯誤
- [ ] 安全單元 smoke testPort(54321)
- [ ] 未觸碰 port 9876 / 未改當前 RemoteServer / 未跑 npm run dev

### dev server 手動 smoke 清單(給塔台告知使用者)

| # | 情境 | 預期結果 |
|---|------|---------|
| 1 | 啟動 dev → Settings 改 port 54321 → 重啟 dev | 54321 生效 |
| 2 | Test 按鈕:54321(available)+ 9876(in-use) | 結構化回饋 + process 名 |
| 3 | QR 對照:改 port 前後 url 不同 | url 反映新 port |
| 4 | 熱切換:改 port Save(不重啟 dev) | 舊關新開立即可用 |
| 5 | Active conn 警告:改 port 時顯示連線數 | count 正確 |
| 6 | dev 中開 BAT 內部終端 + `BAT_REMOTE_PORT` env 傳遞 | bat-notify 連新 port OK |
| 7 | port 設回 9876 + 重啟 → 回歸原 T0215/T0217 smoke | 通過 |

### BUG-050 階段 1 YOLO log 觀察(樣本 #3,本張為大工單壓力測試)

**關鍵 signal**:
- auto-submit「T0218 部分完成」是否成功到達塔台 input buffer(若 fallback 到剪貼簿,即觀察到階段 2 必要信號)
- 工單執行過程中 tool call 次數 / 檔案 I/O 量(大工單 = YOLO pipeline 最大壓力)
- 若 Worker 過程中有嘗試主動 log writeResp payload 請附上

### Worker time 估算
- **預估**:~150-215 min
- **實際**:(填入)
- **壓縮倍率**:(若維持 7-13x 壓縮,實際約 15-30 min)

### sprint-status.yaml 已更新
不適用(本專案未用 sprint-status)

### 回報時間
(填入當前時間)
