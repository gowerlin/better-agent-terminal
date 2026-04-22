# 工單 T0219 — PLAN-021 UX 簡化(移除 Test 按鈕 + 停止伺服器 confirm dialog)

## 元資料
- **工單編號**:T0219
- **任務名稱**:PLAN-021 UX 簡化 — 依 D065 移除 Test 按鈕冗餘 + 停止伺服器前顯示活躍連線警告
- **狀態**:DONE
- **建立時間**:2026-04-19 20:55 (UTC+8)
- **開始時間**:2026-04-19 21:00 (UTC+8)
- **完成時間**:2026-04-19 21:07 (UTC+8)
- **關聯**:PLAN-021(IN_PROGRESS)、T0218(DONE)、D065 決策、GP064 UX 反模式
- **目標子專案**:(本專案根,non mono-repo)

## 工作量預估
- **預估規模**:中
- **預估工時**:~30-45 min(Worker time 預期 5-10 min,依 GP042 壓縮慣例)
- **Context Window 風險**:低(改動 ~7 檔,刪減為主新增少量)
- **降級策略**:若 IPC handler 或 `port-test.ts` 刪除遇到殘留呼叫點,可保留檔案只移除 UI,記錄到回報區

## Session 建議
- **建議類型**:🆕 新 Session(YOLO 模式,BAT 內部終端)
- **原因**:新 context window 開工,catch-22 邊界同 T0218(本 session Tower + Worker 皆在 BAT 內部終端運行);作為 BUG-050 階段 1 VERIFY 期 YOLO 樣本 #6

## 任務指令

### BMad 工作流程
無(手動執行,非 BMad story)

### 前置條件

需載入的文件清單:
- `_ct-workorders/T0218-plan-021-remote-server-port-settings-ui.md`(T0218 完整回報區,了解 Test 按鈕/port-test.ts 實作細節)
- `_ct-workorders/PLAN-021-remote-server-port-settings-ui.md`(UI mockup 原設計)
- `_ct-workorders/_decision-log.md`(D065 決策紀錄,對齊移除/保留清單)
- `src/components/SettingsPanel.tsx`(主改動,約 line 70-300 state/handlers + line 1140-1220 UI)
- `electron/main.ts`(搜尋 `settings:test-port` handler)
- `electron/remote/port-test.ts`(T0218 新建,待評估刪除)
- `electron/preload.ts`(搜尋 `testPort` bridge)
- `src/types/index.ts` + `src/types/electron.d.ts`(`settings.testPort` 型別宣告)
- `src/locales/en.json` + `zh-TW.json` + `zh-CN.json`(i18n keys)

### 輸入上下文

**D065 決策摘要(使用者 T0218 smoke 後識別)**:

> Test 按鈕冗餘:Error path 已提供同樣資訊(port 衝突時啟動會報錯),Test 只是預演同樣邏輯。符合 GP064 反模式 —「Error path 已提供回饋時勿加 Test/Preview/Dry-run helper 按鈕」。
>
> 取而代之的是更有價值的 UX:**停止伺服器**是比改 port 更危險的動作(會殺所有活躍連線),但目前 Stop server 按鈕無警告。應新增 confirm dialog。

**變更清單(權威)**:

#### 移除項目(Test 按鈕相關)

- **UI**:`Test` 按鈕 + `portTestResult` 顯示區塊(`SettingsPanel.tsx` 約 line 1160-1207)
- **State**:`portTestResult`(連同其 type 定義)+ `portTesting`
- **Handler**:`handleTestPort` callback
- **IPC handler**:`settings:test-port`(`electron/main.ts`)
- **Preload bridge**:`settings.testPort`(`electron/preload.ts`)
- **型別宣告**:`src/types/electron.d.ts` 中 `settings.testPort` 介面
- **Port test 模組**:`electron/remote/port-test.ts` 檔案(整檔刪除 — 僅供 Test 按鈕 IPC handler 使用,刪除 handler 後無其他 consumer)
- **i18n keys**(9 keys × 3 locales = 27 條):
  - `settings.remotePortTest`
  - `settings.remotePortTestHint`
  - `settings.remotePortTesting`
  - `settings.remotePortAvailable`
  - `settings.remotePortInvalid`
  - `settings.remotePortPermissionDenied`
  - `settings.remotePortInUseBy`
  - `settings.remotePortInUse`
  - `settings.remotePortUnknown`

> ⚠️ Worker 刪除 `port-test.ts` 前,必須 Grep 全專案確認無其他 import(除 `main.ts` handler 外)。若有殘留,回報時明確標示。

#### 新增項目(停止伺服器 confirm dialog)

**位置**:`SettingsPanel.tsx` 的 `handleStopServer`(約 line 229)

**行為**:
- 按下 Stop server 按鈕時,若 `serverStatus.clients.length > 0` → 顯示 confirm dialog
- Dialog 文案:「即將中斷 N 個活躍連線,確定停止伺服器?」(N = `serverStatus.clients.length`)
- 若 `clients.length === 0` → 不顯示 dialog,直接停止(免打擾)
- 使用 Web 原生 `window.confirm()` 或專案內若有既有 dialog 元件(Worker 探查),優先用既有元件保持風格一致
- 若使用者 Cancel → 不執行 stop,僅 return

**i18n keys 新增**(3 keys × 3 locales):
- `settings.stopServerConfirmTitle`:「確定停止 Remote Server?」/ 「Stop Remote Server?」/ 「确定停止 Remote Server?」
- `settings.stopServerConfirmMessage`:「即將中斷 {{count}} 個活躍連線。停止後所有遠端 client 將無法連線,需重新啟動伺服器。」/ 英文 / 簡中同義
- `settings.stopServerConfirmNoConnections`:預留(無連線時不顯示 dialog,但保留 key 備未來用;或可省略)

> Worker 可依現有 i18n 風格決定 key 精確命名,保持與 `stopServer` 等 key 的前綴一致性。

#### 保留項目(D065 明確保留)

- Port editor(input + Save & hot-switch + rollback 機制)
- URL preview(`wss://<host>:<port>`)
- 改 port 時的 `remotePortActiveConnWarning`(只出現在「改 port」情境,不涉及停止伺服器)
- Reset to default 按鈕
- `portSaving` / `portSaveError` / `portSaveNotice` state

#### 附帶驗收(Image #4 Port editor render 問題)

T0218 smoke 時使用者回報 **server running 狀態下 Port editor 區塊沒顯示**(Image #4)。可能原因:
- Dev HMR gap(重啟 dev 後自然解決,無真 bug)
- JSX 條件渲染邏輯錯誤(某個 `serverStatus?.running &&` 判斷誤把 Port editor 也擋掉)

Worker 需:
1. 讀 `SettingsPanel.tsx` Remote 區塊完整 JSX(約 line 1100-1220)
2. 檢查 Port editor 區塊的條件渲染:應該是「server 存在時就顯示(不論 running/stopped)」還是僅 `running` 時?對齊 T0218 工單原設計 — Port editor **always 顯示**(連 stopped 狀態也能先 preview 新 port),但 Save & hot-switch 按鈕只在 running 時能用
3. 若邏輯正確 → 回報區註明「條件渲染邏輯無 bug,判定 Image #4 為 dev HMR 暫時性問題」
4. 若邏輯有 bug → 一併修復,回報區標示 root cause

### 技術細節

**移除順序建議**(避免 tsc 錯誤連鎖):

1. 先改 UI(`SettingsPanel.tsx`):移除 Test 按鈕 + state + handler + 顯示區塊
2. 改型別(`src/types/electron.d.ts`):移除 `settings.testPort` 介面
3. 改 preload(`electron/preload.ts`):移除 `testPort` bridge
4. 改 main(`electron/main.ts`):移除 `settings:test-port` handler + `import` of port-test
5. 刪除 `electron/remote/port-test.ts`(確認無殘留 import 後)
6. 改 i18n(3 個 locale 檔案)移除 9 keys + 新增 3 keys

**新增 confirm dialog 實作**:

```typescript
const handleStopServer = async () => {
  const activeCount = serverStatus?.clients?.length ?? 0
  if (activeCount > 0) {
    const confirmed = window.confirm(
      t('settings.stopServerConfirmMessage', { count: activeCount })
    )
    if (!confirmed) return
  }
  await window.electronAPI.remote.stopServer()
  setServerToken(null)
  const ss = await window.electronAPI.remote.serverStatus()
  setServerStatus(ss)
}
```

> 若專案有既有 confirm dialog 元件(Worker Grep `Confirm\|Modal\|Dialog`),優先使用保持風格一致。無則用 `window.confirm()` 降級。

### 預期產出

**修改/刪除檔案清單**(Worker 確認最終清單):

| 檔案 | 變更 |
|------|------|
| `src/components/SettingsPanel.tsx` | 移除 Test 按鈕 UI + state + handler(~50 行);`handleStopServer` 加 confirm |
| `src/types/electron.d.ts` | 移除 `settings.testPort` 介面宣告 |
| `electron/preload.ts` | 移除 `testPort` bridge |
| `electron/main.ts` | 移除 `settings:test-port` handler + `port-test` import |
| `electron/remote/port-test.ts` | 🗑️ 整檔刪除 |
| `src/locales/en.json` | -9 keys / +3 keys |
| `src/locales/zh-TW.json` | -9 keys / +3 keys |
| `src/locales/zh-CN.json` | -9 keys / +3 keys |
| `_ct-workorders/PLAN-021-*.md` | 附註 T0219 完成,UX 簡化 DONE(可留 IN_PROGRESS 或依 PLAN 整體進度判斷) |

**commit 策略**:
- 建議 1-2 commit:可合為單一 commit `refactor(settings): T0219 PLAN-021 UX 簡化 — 移除 Test 按鈕 + 新增停止確認 dialog`,或拆為 `remove Test button` + `add stop server confirm`

### 驗收條件(分 Worker YOLO-safe + 使用者手動 dev smoke)

#### Worker YOLO-safe 範圍(必須在本 BAT 內完成)

- [ ] Test 按鈕 UI + state + handler 完全移除
- [ ] `settings:test-port` IPC handler 移除
- [ ] `port-test.ts` 檔案刪除(或若有殘留 import,保留檔案並說明)
- [ ] Preload bridge `testPort` 移除
- [ ] 9 個 `remotePortTest*` i18n keys 從 3 個 locale 移除
- [ ] 3 個新 `stopServerConfirm*` i18n keys 加入 3 個 locale
- [ ] `handleStopServer` 加入 confirm 邏輯(`clients.length > 0` 時)
- [ ] Image #4 Port editor 條件渲染邏輯盤點(回報區明確說明結論)
- [ ] `tsc --noEmit` **0 錯誤**
- [ ] `npx vite build` **0 錯誤**
- [ ] Grep 專案確認無 `testPort` / `port-test` 殘留引用
- [ ] **不改動當前運行的 RemoteServer / 不測 port 9876 / 不跑 npm run dev**

#### 使用者手動 dev smoke 清單

- [ ] 1. **Stop 按鈕無連線情境**:Server running + 0 connections → 按 Stop → 無 dialog,直接停止
- [ ] 2. **Stop 按鈕有連線情境**:Server running + N>0 connections → 按 Stop → 跳 dialog 顯示正確 count → Cancel 不停止、Confirm 才停止
- [ ] 3. **Test 按鈕不存在**:Settings Remote 區塊不再出現 Test 按鈕
- [ ] 4. **Port editor 正常 render**:Server running 狀態下 Port editor 區塊顯示(對照 T0218 Image #4 問題)
- [ ] 5. **Hot-switch 不受影響**:改 port + Save → 仍正常熱切換
- [ ] 6. **i18n 完整**:切換 en / zh-TW / zh-CN,新增的 confirm dialog 文案顯示正確
- [ ] 7. **回歸 T0218 smoke 7 情境**:Port 改值 / Save / Reset / Active conn warning / BAT 內部終端連線 — 全部照常通過

### YOLO 執行邊界(catch-22 防護,同 T0218)

本 session 的 Tower 與 Worker 都在**本 BAT 內部終端運行**(BAT_SESSION=1)。Worker 嚴格遵守:

**YOLO-safe 可做**:
- ✅ 所有 code 實作(移除 + 新增)— 純檔案編輯
- ✅ `tsc --noEmit` + `npx vite build`(純編譯驗證,不啟動 Electron)
- ✅ `git rm` 刪除 `port-test.ts`

**嚴格禁止**:
- ❌ `npm run dev` / `npm start` / 任何會啟動新 Electron 實例的指令(會撞本 BAT 的 port 9876)
- ❌ 嘗試 kill / restart 當前運行的 RemoteServer
- ❌ 呼叫 `remote:stop-server` / `remote:restart-server` IPC(會殺本 session 自己)
- ❌ 手動改本機 `settings.json` 測試

### Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示,都必須填寫。
> **本張為 YOLO 模式**:完成後自動 auto-submit 字串到塔台。
> **完成訊息**:
> - 若所有 Worker YOLO-safe 驗收條件通過 → auto-submit「**T0219 完成**」
> - 若某 Worker YOLO-safe 步驟失敗 → auto-submit「**T0219 失敗**」+ 回報區詳述
> - 若有殘留 import 或意外障礙需先確認 → auto-submit「**T0219 部分完成**」+ 回報區詳述

**BUG-050 階段 1 觀察(樣本 #6)**:
- 本張中等規模工單,預期 tool call ~20-30 次(Read/Edit/Glob/Grep 為主,Bash 少量用於 grep/tsc/vite build)
- 回報區明確標示是否觀察到任何 auto-submit 或 write 異常

### 執行步驟

**Phase 1:實作(YOLO-safe)**

1. 讀取本工單 + T0218 回報區 + D065 決策 + SettingsPanel.tsx 相關區段
2. 更新「開始時間」欄位
3. Grep 確認 `testPort` / `port-test` 所有引用點
4. 依「移除順序建議」逐步移除 Test 按鈕相關邏輯
5. 實作 `handleStopServer` confirm dialog + 3 個新 i18n keys
6. 檢查 Image #4 Port editor 條件渲染邏輯,修復(若有 bug)或確認(若 dev HMR)
7. `tsc --noEmit` 檢查
8. `npx vite build` 檢查
9. 最終 Grep 確認 `testPort` / `port-test` 無殘留

**Phase 2:回報**

10. 更新 PLAN-021(附註 T0219 完成)
11. commit(1-2 張 atomic)
12. 填寫回報區:
    - 狀態:**DONE** / PARTIAL / 失敗
    - 移除/新增檔案清單(實際執行結果)
    - Image #4 Port editor render 結論(bug 修復 / dev HMR 無 bug)
    - Grep 殘留檢查結果
    - Worker time 實際 vs 預估
    - BUG-050 樣本 #6 auto-submit 觀察
13. 填寫「完成時間」
14. YOLO auto-submit「T0219 完成」(或對應狀態字串)

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
**DONE**(Worker YOLO-safe 範圍全數通過,等待使用者手動 dev smoke 7 情境驗收)

### 產出摘要

**commit**:`f395225` — `refactor(settings): T0219 PLAN-021 UX 簡化 — 移除 Test 按鈕 + 新增停止確認 dialog`

**檔案變動**(9 files changed, +25 / -284):

| 檔案 | 變更 |
|------|------|
| `src/components/SettingsPanel.tsx` | 移除 Test button UI + `portTestResult`/`portTesting` state + `handleTestPort` + useEffect/input/reset 的 `setPortTestResult(null)` 清理;`handleStopServer` 改用 `window.electronAPI.dialog.confirm` 保護(clients>0 時提示) |
| `src/types/electron.d.ts` | 移除 `settings.testPort` 介面宣告(7 行) |
| `electron/preload.ts` | 移除 `testPort` bridge(8 行) |
| `electron/main.ts` | 移除 `import testPortImpl` + `ipcMain.handle('settings:test-port', ...)` handler(共 13 行) |
| `electron/remote/port-test.ts` | 🗑️ 整檔刪除(234 行,`git rm`) |
| `src/locales/en.json` | -9 keys / +2 keys(stopServerConfirmTitle + stopServerConfirmMessage) |
| `src/locales/zh-TW.json` | -9 keys / +2 keys(同上,繁中) |
| `src/locales/zh-CN.json` | -9 keys / +2 keys(同上,簡中) |
| `_ct-workorders/PLAN-021-*.md` | 元資料狀態欄加註 T0219 code DONE,等待 dev smoke |

> 實際新增 i18n key **2 個**(而非工單預估 3 個):`stopServerConfirmNoConnections` 按工單原註記「預留或可省略」判斷為冗餘(零連線情境不顯示 dialog,不需文案),故省略,保持精實。

**設計決策**:

1. **使用既有 `dialog.confirm` bridge**:專案已有 `window.electronAPI.dialog.confirm(message, title)` IPC(`electron/main.ts:2595`,被 ClaudeAgentPanel/TerminalPanel 共用),優於工單建議的 `window.confirm()`,保持全專案風格一致。支援 title 參數,UI 呈現為原生 Electron dialog,無需引入新 modal 元件。
2. **`stopServerConfirmNoConnections` key 省略**:無連線時直接 return 不顯示 dialog,該 key 無使用場景,刪除以符合 YAGNI。
3. **commit 策略**:採單一 atomic commit(而非拆為 2 commit),理由:Test 按鈕移除 + 停止 confirm 兩者互為替代(移除舊冗餘 / 新增真正有價值的保護),D065 決策視為整體 UX 調整,不宜切割。

### 互動紀錄
無(YOLO 執行,未與使用者互動)

### Renew 歷程
無

### 遭遇問題
無。Grep 階段即確認 `port-test.ts` 無其他 consumer;tsc + vite build 一次通過。唯一微小決策是 `stopServerConfirmNoConnections` 是否加入 — 依 YAGNI 原則省略。

### Worker YOLO-safe 驗收(逐項勾選)

- [x] Test 按鈕 UI + state + handler 完全移除
- [x] `settings:test-port` IPC handler 移除
- [x] `port-test.ts` 檔案刪除(`git rm` 保留歷程)
- [x] Preload bridge `testPort` 移除
- [x] 9 個 `remotePortTest*` i18n keys 從 3 個 locale 移除
- [x] 2 個新 `stopServerConfirm*` i18n keys 加入 3 個 locale(省略 NoConnections key,理由見上)
- [x] `handleStopServer` 加入 confirm 邏輯(`clients.length > 0` 時呼叫 `dialog.confirm`)
- [x] Image #4 Port editor 條件渲染邏輯盤點(結論見下)
- [x] `tsc --noEmit` **0 錯誤**(無 stdout 輸出即 pass)
- [x] `npx vite build` **0 錯誤**(client + main + preload + terminal-server 4 個 bundle 全綠)
- [x] Grep 專案確認無 `testPort` / `port-test` 殘留引用(`src/` 與 `electron/` 均無 match)
- [x] **未改動當前運行的 RemoteServer / 未測 port 9876 / 未跑 npm run dev**

### Image #4 Port editor 條件渲染盤點結論

**結論:條件渲染邏輯無 bug,判定 Image #4 為 dev HMR 暫時性問題。**

**盤點細節**(`src/components/SettingsPanel.tsx:1131-1306`):

- Remote section 採 `serverStatus.running ? (<>...</>) : (<>...</>)` ternary 分流
- Running 分支(line 1132-1272)內含:Stop button(line 1133-1143)+ Port editor + URL preview + active conn warning(line 1145-1210)+ fingerprint/token/clients(line 1213-1265)
- Stopped 分支(line 1273-1306)內含:獨立的 port input(`serverPort` state,非 `desiredPort`)+ bind interface select + Start button
- Port editor **無任何額外條件包裹**,只要 `serverStatus.running === true` 就渲染
- 即 running 狀態下 Port editor 必然顯示,無可能被 JSX 條件邏輯擋掉

**推論 Image #4 成因**:使用者 T0218 smoke 時 dev server 可能處於 HMR 中間狀態(component re-mount 期間 `serverStatus` 一時誤判為 `{running: false}`),重啟 dev 後自然解決。與本工單 UX 簡化無因果關係,無需修復。

> **備註**:與工單原設計「Port editor always 顯示(stopped 也能 preview)」有小差異 — 當前實作是 stopped 走另一個 input(`serverPort`),running 走 `desiredPort`+hot-switch。這是 T0218 的刻意設計(Start server 和 Hot-switch 是兩種不同操作),D065 亦未質疑此結構,**本工單不變更 stopped-state 行為**。

### Grep 殘留檢查結果

最終 Grep `testPort|port-test|test-port|portTestResult|portTesting|handleTestPort|remotePortTest|remotePortAvailable|remotePortInUse|remotePortPermissionDenied|remotePortInvalid|remotePortUnknown`:

- `src/` 目錄:**0 match**
- `electron/` 目錄:**0 match**
- 剩餘 match 僅在 `_ct-workorders/` 文件(工單 / 決策紀錄 / PLAN 骨架)內,皆為歷史引用,非 runtime code。

✅ Runtime code 完全清理,無殘留。

### BUG-050 階段 1 YOLO log 觀察(樣本 #6)

**樣本 #6 觀察**:
- 本 session 執行過程 tool call **約 22 次**(Read/Edit/Glob/Grep 為主 ≈ 18,Bash 4:`date` x2 + `npm rebuild`/`tsc --noEmit`/`vite build`/`git rm`/`git commit`),符合工單預估的 20-30 次區間
- **Auto-submit 相關異常:無**。Step 8.5 bat-notify 將在本回應結尾執行
- **Write 異常:無**。所有 Edit 指令 exact-match 成功,僅一次 `PLAN-021 *.md` 遇到 "File has not been read yet" → Read 後重試成功(正常行為,非 BUG-050 徵兆)
- **CT_MODE env 注入:正常** — `CT_MODE=yolo` 正確讀取,Step 0 banner + Step 8.5 `--submit` flag 將依規格執行
- 壓縮倍率:**~6x**(7 分鐘 Worker time vs. 預估 30-45 min 下界 = 30/7 ≈ 4.3x,上界 = 45/7 ≈ 6.4x,取上界做 GP042 壓縮慣例估算)

### Worker time 估算
- **預估**:~30-45 min
- **實際**:~7 min(21:00 → 21:07)
- **壓縮倍率**:**~5x**(取 30-45 min 中位 37 min / 7 min ≈ 5.3x,符合 GP042 壓縮慣例)

### sprint-status.yaml 已更新
不適用(本專案未用 sprint-status)

### 回報時間
2026-04-19 21:07 (UTC+8)
