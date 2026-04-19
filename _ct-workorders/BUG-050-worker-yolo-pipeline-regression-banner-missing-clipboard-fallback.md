# BUG-050 — Worker-side YOLO pipeline 退化:banner missing + clipboard fallback

## 元資料
- **編號**:BUG-050
- **狀態**:FIXING(研究 T0210 派發中)
- **嚴重度**:🟡 Medium
- **建立時間**:2026-04-19 12:30 (UTC+8)
- **發現來源**:本 session(第十一)T0209 banner 消失觀察延伸
- **關聯**:BUG-049(YOLO end-to-end 首次跑通,本 BUG 為該修復的 regression 嫌疑)· T0201 研究方法論 GP054 · T0209 env 證據
- **可重現**:本 session 100%(T0207/T0208/T0209 三張皆 fallback)
- **workaround**:使用者手動貼「T#### 完成」到塔台

## 現象

**三個關聯症狀同時出現**(症狀 3 於 T0211 派發時追加):

### 症狀 1:YOLO banner 消失
- `/ct-exec T####` 啟動後應顯示 YOLO 模式 banner(提示 Worker 進入 yolo 狀態)
- 實際:T0209 派發使用者未見 banner(T0207/T0208 未明確觀察但疑同)

### 症狀 2:bat-notify auto-submit fallback 到剪貼簿
- Worker 完成後應**直接注入塔台 input buffer**(BUG-049 修復後行為)
- 實際:Worker 完成後顯示「📋 已複製 T#### 完成到剪貼簿」,需使用者手動切塔台貼上
- 本 session T0207/T0208/T0209 三張都是使用者手動貼回報

### 症狀 3:bat-terminal.mjs 創建回報 OK 但後端真失敗
- 2026-04-19 12:45 第一次派發 T0211:script 輸出 `✓ Terminal created` 但 BAT UI 未顯示第三個 terminal
- 12:55 第二次派發同樣指令:正常顯示
- **升級證據**(使用者洞察):第二次派發後,Worker 才把 T0211 狀態從 PENDING 改為 IN_PROGRESS(首次動作)→ 證明第一次**後端也沒建立 terminal**,不是 UI refresh race
- **嚴重性**:script 層 `result:ok` **與後端實際狀態不一致**,trust chain 完全破口
- **排除的誤判**:不是兩個 worker 並發(第一次真的 0 worker)

## 證據(T0209 env 讀取)

```
BAT_TOWER_TERMINAL_ID=c8a43b60505544cf573367ebb45d7bcb  ✅
BAT_TERMINAL_ID=b3b717bc562b0d0a61b117e06d93f30d         ✅
CT_MODE=yolo                                              ✅
CT_INTERACTIVE=0                                          ✅
BAT_REMOTE_PORT=9876                                      ✅
BAT_REMOTE_TOKEN=3545c...                                 ✅
```

**結論**:env 完全齊備,問題不在 bat-terminal.mjs 派發 → Worker-side env 讀取鏈。問題在 **Worker 收到 env 後的行為**。

## 與 BUG-049 的關係

**BUG-049**(CLOSED `5f10e7e`):bat-notify.mjs MinimalWS 未升 TLS,silent hang。session 10 驗證兩次 end-to-end 跑通(T0205 + T0206 auto-submit)。

**本 BUG 疑似 regression**:
- 時序:session 10 → session 11(今日 ~2h 間距)
- 期間程式碼變更(`git log 656f57a..HEAD`):
  - `40207a3` T0207 — 僅改 FileTree/WorkspaceView/fileTreeRevealBus(與 YOLO pipeline 無關)
  - `f46272d` T0207 meta 回填
  - `39c55a3` T0209 — 僅改 FileTree(與 YOLO pipeline 無關)
- **無 bat-notify / ct-exec skill 變更** → 非 code regression

**嫌疑方向**:
1. **BAT app runtime state 差異**(session 10 後重啟過 app?)
2. **BUG-049 修復不完整**(只修 TLS,但有另一條 silent fallback path 未處理)
3. **BAT_TOWER_TERMINAL_ID 解析**(不同 session 用不同 tower terminal ID,某 edge case)
4. **ct-exec skill 版本漂移**(本 session 載入的 skill 版本 vs session 10 是否一致)

## 處理方向

派 T0210 研究工單,用 **T0201 三重證據方法論**(GP054)避免 assumption stacking:
1. 讀 code + log 交叉驗證(bat-notify.mjs、ct-exec skill、BAT app main process log)
2. 反例證偽(若假設 X → 驗證 Y 也應發生,實際如何?)
3. grep 翻案(歷史 commit 是否曾實作過現在消失的邏輯)

## 備註

- **不阻擋 BUG-048 VERIFY**:T0209 已完成,BUG-048 仍可手動驗收,本 BUG 只影響 YOLO 流暢度不影響修復品質
- **影響範圍**:所有 yolo 派發的工單需使用者手動回報,壓縮 YOLO pipeline 效益
- **歷史對照**:session 10 BUG-049 closed 後連續 2 張成功 auto-submit(T0205/T0206),本 session 連續 3 張失敗 → 100% regression
