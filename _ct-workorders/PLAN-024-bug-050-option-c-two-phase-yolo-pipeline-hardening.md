# PLAN-024 — BUG-050 Option C 雙階段:YOLO pipeline 顯性化與 Worker skill 一致性

## 元資料
- **編號**:PLAN-024
- **狀態**:🚫 DROPPED(2026-04-23 — BUG-050 CLOSED 後不再需要。階段 1 方案 A `38725e9` 已穩定 2 樣本零異常,階段 2 Option C 顯性化為過度設計,於 BUG-050 驗收閉環時一併丟棄)
- **原狀態**:PLANNED(階段 1 T0215 DONE `38725e9` ✅ smoke 通過;階段 2 **暫緩** D064 — 2 樣本零異常,待真實 refork race 觸發再啟動)
- **優先級**:🟡 Medium
- **類型**:bug 修復包裹(雙根因並存)
- **建立時間**:2026-04-19 18:15 (UTC+8)
- **發現來源**:BUG-050 T0210 研究工單結論(雙根因鎖定)

## 動機

BUG-050(Worker-side YOLO pipeline 退化:banner missing + clipboard fallback)T0210 研究鎖定**雙根因並存**,任一單方修復無法閉環:

### 根因 A — Worker LLM 執行 skill 一致性 regression
- SKILL.md 470+ 行過長,LLM 長 context 省略 Step 0(banner)+ Step 8.5(bat-notify 呼叫)
- T0208/T0209 完全無 bat-notify log → Worker 未呼叫 skill 定義的硬鉤子
- 症狀:banner missing + 跳過 Step 8.5 直接走 Step 11 clipboard fallback(違反互斥規則)

### 根因 B — RemoteServer `pty:write` silent drop
- T0207 bat-notify log 完整(send=ok + appendedCR=true + exit 0)但塔台完全沒收到(使用者 Q1 親證)
- `send: ok` 語義僅保證 WS 訊息到達 server,**不保證** server 實際寫入 target terminal PTY stdin
- 推測 `electron/remote/` 下 pty:write handler 存在 silent drop path

### 為何要雙管齊下
- 單修 A:T0207 類問題仍會 silent fail(server drop 不可見)
- 單修 B:T0208/T0209 類 Worker 跳過呼叫仍會 fallback 剪貼簿
- 雙根因並存 → 必須雙階段交付才能 BUG-050 閉環

## 範圍(兩階段)

### 階段 1 — Silent drop 顯性化(~1-2h)

**目標**:讓 T0207 類 silent drop 變成可觀察的 error(而非 server 回 ok + Worker 誤以為成功)

**拆單**:
- **T0214**(research,est 20-40 min)— 定位 `electron/remote/` 下 pty:write handler 的 silent drop 具體路徑 + 設計錯誤回傳協議
- **T0215**(fix,est 60-90 min,T0214 完成後開)— 實作 server error 回傳 + `bat-notify.mjs` 硬阻斷(exit 1)

**關鍵決策**(使用者對齊確認):
- bat-notify 收到 server error → **硬阻斷 + exit 1**(不 retry,不 fallback 剪貼簿)
- 理由:顯性化是階段 1 核心,retry 遮掩 silent drop,fallback+warning 等同現況

**驗收**:
- pty:write 失敗場景(target 不存在 / stdin pipe 滿 / queue 滿 / processing 中)server 回 error 而非 silent ok
- bat-notify 收到 error 時 exit 1 + 明確錯誤訊息
- 不影響現有成功路徑(T0205/T0206 類 auto-submit 仍正常)

### 階段 2 — Worker skill 一致性 enforcement(~4-6h,獨立啟動)

**目標**:解決 LLM 省略 Step 0 / Step 8.5 的長工單省略 pattern

**設計方向**(T0210 Option B):
- 拆 ct-exec SKILL.md:Step 0/8.5/11 抽成強制執行的 pre/post hook 或獨立 enforcement reference
- 設計 post-exec 檢查:CT_MODE=yolo 且 Worker 未呼叫 bat-notify → warn + 強制補跑 / 要求使用者介入

**觸發條件**:
- 階段 1 驗收通過
- 使用者確認階段 2 啟動(可能另有工單優先)
- 階段 2 需獨立研究工單評估 skill + hook 雙層架構可行性

**非本 PLAN 當下範圍**:階段 2 規劃留 placeholder,細節留到階段 1 結束後再展開。

## 驗收標準

### 階段 1
- [ ] T0214 研究產出:silent drop 具體 code path 定位 + error 回傳協議設計
- [ ] T0215 實作:server error 回傳 + bat-notify 硬阻斷
- [ ] 人工 smoke:派發 yolo 工單,刻意觸發 silent drop 場景,Worker 收到 error + 塔台看到明確失敗訊息
- [ ] 不 regress:成功路徑 T0205/T0206 類 auto-submit 仍正常

### 階段 2
- 待階段 1 完成後再定

## 關聯

- **BUG-050**(FIXING)— 本 PLAN 閉環目標
- **T0210**(DONE)— 研究工單,推薦 Option C 雙階段
- **BUG-049**(CLOSED,`5f10e7e`)— session 10 YOLO end-to-end 首次跑通,session 11 regression 為本 PLAN 觸發點
- **GP054**(T0201 方法論)— 三重證據排除嫌疑
- **GP060**(AI 驗收 runtime 限制)— 本 PLAN 需人工 smoke 驗收

## 備註

- **與 PLAN-023 獨立**:PLAN-023 是 FileTree 架構,與 YOLO pipeline 無關
- **階段 1 使用 yolo 派發**(使用者指定):meta-data 點是 YOLO 本身壞掉,Worker 會 fallback 剪貼簿,手貼回報為 baseline,不影響工單執行
- **工時總估**:5-8h(階段 1 ~1-2h + 階段 2 ~4-6h)
- **階段 2 可跳過**:若階段 1 顯性化後觀察一段時間發現根因 A 不再頻繁觸發,階段 2 可降級或取消(技術債 acceptable)
