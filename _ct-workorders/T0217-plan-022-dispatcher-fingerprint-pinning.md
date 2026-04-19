# 工單 T0217 — PLAN-022 Dispatcher fingerprint pinning(Step 1+2,同步修 bat-notify)

## 元資料
- **工單編號**:T0217
- **任務名稱**:PLAN-022 dispatcher 與 notify 共通 fingerprint pinning(對齊 PLAN-018 T0182 安全基建)
- **狀態**:PENDING
- **建立時間**:2026-04-19 19:30 (UTC+8)
- **開始時間**:(sub-session 開始時填入)
- **完成時間**:(完成時填入)
- **目標子專案**:(本專案根,non mono-repo)

## 工作量預估
- **預估規模**:小-中
- **預估工時**:~50-65 min(PLAN-022 Step 1+2 35-50 min + bat-notify 同步修 +15 min)
- **Context Window 風險**:低(預計改動 2 script 檔 + 讀 electron/remote/certificate.ts 參考)
- **降級策略**:若 bat-notify 同步修遇意外依賴差異,可先完成 bat-terminal.mjs,回報 PARTIAL 附 bat-notify 差異分析,塔台另開工單

## Session 建議
- **建議類型**:🆕 新 Session(YOLO 模式,BAT 內部終端)
- **原因**:安全相關改動需隔離 context;作為 BUG-050 階段 1 VERIFY 期 YOLO log 觀察樣本 #2

## 任務指令

### BMad 工作流程
無(手動執行,非 BMad story)

### 前置條件
需載入的文件清單:
- `_ct-workorders/PLAN-022-dispatcher-fingerprint-pinning.md`(本工單原始規格)
- `scripts/bat-terminal.mjs`(主要修改目標,MinimalWS.connect 的 TLS 升級處)
- `scripts/bat-notify.mjs`(同步修改目標,sibling fix per GP056)
- `electron/remote/certificate.ts`(server-cert.json 定義來源,理解 fingerprint 欄位命名)
- `_ct-workorders/T0202b-bug-046-dispatcher-tls-upgrade.md`(TLS 升級後現況 `rejectUnauthorized: false`)
- `_ct-workorders/T0205-bug-049-bat-notify-tls-port.md`(bat-notify TLS 升級,確認狀態與 bat-terminal 一致)

### 輸入上下文

**背景**:
- T0202b 完成 dispatcher TLS 升級,但 `rejectUnauthorized: false` 無 MITM 防護
- PLAN-018 T0182 已建立 server-side fingerprint 基建(`electron/remote/certificate.ts`,cert 寫入 `app.getPath('userData')/server-cert.json`)
- Electron client(`remote-client.ts`)已 TOFU 驗證,dispatcher 這條路徑是最後缺口
- **GP056 sibling fix 警告**:bat-notify.mjs 與 bat-terminal.mjs 是 MinimalWS 兩個 caller(BUG-046 → BUG-049 已重現模式),本張**同步修**避免再走一次 research → fix 循環

**決策採用**(塔台 + 使用者確認):
- Q1 拆單粒度:**[B]** 一張 T0217 只做 Step 1+2(跳過 Step 3 TOFU)
- Q2 讀失敗行為:**[A]** fail-close(exit 1,假設 BAT 已啟動)
- Q3 同步修 bat-notify:**[A]** 同步修(GP056 sibling fix 原則)
- Q4 Smoke 情境:**[B]** 匹配 + mismatch 兩場景

**技術棧**:
- Node.js ES modules(scripts/*.mjs)
- 現有 `tls.connect({ rejectUnauthorized: false })` 架構(T0202b 後)

**特殊注意**:
- `server-cert.json` 的 fingerprint 欄位名請讀 `electron/remote/certificate.ts` 確認(PLAN-022 骨架用 `fingerprint256` 為假設)
- `secureConnect` callback 位置 T0202b commit `831234b` 已預留 pinning 入口
- 跨平台路徑:Windows `%APPDATA%/BetterAgentTerminal/server-cert.json`;Unix `$HOME/Library/Application Support/BetterAgentTerminal/server-cert.json`;若 Linux 有其他路徑請查 BAT app 設定
- Fail-close 時 log event 必須結構化(`reason: 'fingerprint-mismatch'` 或 `'server-cert-unreadable'`)符合 T0200 log 事件命名慣例

### 預期產出

**修改檔案**:
- `scripts/bat-terminal.mjs`:
  - 新增 `loadTrustedFingerprint()` helper(讀 server-cert.json,跨平台路徑)
  - `MinimalWS.connect` 的 `secureConnect` callback 加 fingerprint 比對
  - mismatch → destroy + reject + structured log event
  - server-cert.json 讀失敗 → 同 mismatch 走 fail-close(但 log reason 不同 `'server-cert-unreadable'`)
- `scripts/bat-notify.mjs`:同上 pattern 套用(可考慮 `loadTrustedFingerprint` 抽共用,若兩 script 結構允許)
- `_ct-workorders/PLAN-022-dispatcher-fingerprint-pinning.md`:更新 Step 1+2 狀態,保留 Step 3 PLANNED

**不改**:
- `electron/remote/certificate.ts`(server 端不改,只讀它定義的 cert 格式)
- `remote-client.ts`(Electron client 已 TOFU)

**commit 策略**:
- 建議單一 commit(Step 1+2 緊耦合,拆反而難 revert)
- commit message 範例:`fix(dispatcher): T0217 PLAN-022 Step 1+2 — fingerprint pinning for bat-terminal + bat-notify (fail-close on cert mismatch or read failure)`

### 驗收條件

- [ ] `bat-terminal.mjs` 實作 `loadTrustedFingerprint()` + `secureConnect` fingerprint 比對
- [ ] `bat-notify.mjs` 同步實作(GP056 sibling fix)
- [ ] Fingerprint mismatch → exit 1 + structured log event(reason: `fingerprint-mismatch`)+ 明確錯誤訊息
- [ ] `server-cert.json` 讀失敗 → exit 1 + log event(reason: `server-cert-unreadable`)(fail-close)
- [ ] Fingerprint match → 正常走後續流程(行為與 T0202b 一致)
- [ ] **Smoke 2 情境通過**:
  1. **正常派發**:`node scripts/bat-notify.mjs --target $BAT_TERMINAL_ID "smoke-t0217-match"` → exit 0 + 訊息到達
  2. **Mismatch 觸發**:臨時改 `server-cert.json` 的 fingerprint 欄位為亂碼(或用環境變數覆蓋路徑指向假檔)→ 跑同指令 → exit 1 + stderr 顯示 fingerprint mismatch 錯誤
  3. 測完**務必還原** server-cert.json(或移除覆蓋 env)
- [ ] **不破壞 BUG-050 階段 1 smoke**:跑 T0215 smoke 兩場景仍通過(fingerprint pinning 不應改動 writeResp 結構)
- [ ] 更新 PLAN-022 狀態(Step 1+2 DONE / Step 3 保留 PLANNED)
- [ ] 跨平台考量:至少 Windows 路徑可用,Unix 路徑用 PLAN-022 骨架寫法(不需實機測)

## Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示,都必須填寫。
> **本張為 YOLO 模式**:完成後自動 auto-submit「T0217 完成」字串到塔台,不要改字串格式。
> **BUG-050 階段 1 觀察(樣本 #2)**:本張派發經過 bat-terminal.mjs create 路徑 + Worker 完成送出經過 bat-notify.mjs。如果 Worker 改 bat-notify 時觀察到 `[T0215-DEBUG-REMOVE]` log 結構或 `writeResp` payload 有異常,請在回報區附上實際觀察(協助塔台評估 BUG-050 階段 2 必要性)。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 載入前置條件中的文件(先 PLAN-022 + certificate.ts 確認 fingerprint 欄位名)
4. 在 `bat-terminal.mjs` 實作 `loadTrustedFingerprint()` + `secureConnect` 比對
5. 套用同 pattern 到 `bat-notify.mjs`(評估是否抽共用 helper)
6. Smoke 情境 1(match)實測
7. Smoke 情境 2(mismatch)實測 + 還原 cert
8. BUG-050 階段 1 smoke 回跑(兩場景確認未破壞)
9. 更新 PLAN-022 Step 1+2 狀態
10. commit + 填寫回報區 + 狀態(DONE / PARTIAL / FAILED / BLOCKED)+ 完成時間
11. YOLO auto-submit「T0217 完成」

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
(DONE / FAILED / BLOCKED / PARTIAL)

### 產出摘要
(列出修改檔案、關鍵實作決策、是否抽共用 helper、fingerprint 欄位確認結果)

### 互動紀錄
(YOLO 模式通常無互動,若有請記錄)

### Renew 歷程
(無 Renew 填「無」)

### 遭遇問題
(若 certificate.ts fingerprint 欄位名與 PLAN-022 骨架不符 / bat-notify 結構差異大需調整 / cross-platform 路徑疑慮等,在此描述)

### Smoke 實測結果
- 情境 1(match):exit=? / 訊息到達=?
- 情境 2(mismatch):exit=? / stderr=?
- BUG-050 階段 1 回跑(場景 1/2):通過=?

### BUG-050 階段 1 YOLO log 觀察(樣本 #2)
(改 bat-notify 過程中觀察到的 `writeResp` payload 結構 / 異常跡象;若一切正常也明確標示)

### Worker time 估算
(預估 vs 實際,供 GP042 累積樣本)

### sprint-status.yaml 已更新
(不適用,本專案未用 sprint-status)

### 回報時間
(填入當前時間)
