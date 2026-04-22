# BUG-037-git-graph-panel-blank-content

## 元資料
- **編號**:BUG-037
- **標題**:Git 圖譜 panel 內容全黑(T0156 regression)
- **狀態**:🚫 CLOSED
- **嚴重度**:🟡 Medium
- **建立時間**:2026-04-18 00:00 (UTC+8)
- **影響版本**:dev 模式(T0156 commit `b313494` 之後)
- **關聯 PLAN**:PLAN-014(Phase 3 Tα2 UAT 失敗)
- **關聯工單**:T0156 / T0157(研究 DONE)/ T0158(修復 DONE, commit `fbcf2d2`)
- **關閉時間**:2026-04-18 00:43 (UTC+8)
- **發現來源**:使用者 dev 模式 runtime 驗收 T0156

---

## 現象

使用者執行 `npm run dev` 後,打開「Git 圖譜」panel,**panel 內容區全黑**,看不到 commits graph、loading 提示、error 訊息或任何可辨識的 UI 元素。

## 預期行為

T0156 DoD 規定:
- Graph panel 顯示 BAT 本專案 commits(~1000 個)的 SVG graph
- 或顯示 loading / error / not-a-repo / empty-repo 其中一種合理提示

## 實際行為

panel 內容區呈現純黑色,無可見內容。

---

## 可重現

- **頻率**:100%(使用者 dev 測試確認)
- **環境**:Windows 11 Pro for Workstations,BAT dev 模式
- **Workaround**:無(graph 是 panel 核心內容)

---

## 候選根因(待 Worker 診斷)

1. **ResizeObserver 邊緣案例**(Worker T0156 遭遇問題 5 已預警):
   - panel 初始化時 `clientHeight=0` → `useVirtualizer.visibleCount=0` → 無 row 渲染
   - 重顯時 ResizeObserver 可能未正確觸發
2. **loadState 卡住**:
   - `loading` state 卡住(fetch 尚未完成)
   - `idle` state 未進入 load(workspaceFolderPath 問題)
3. **CSS 背景色衝突**:
   - panel CSS 背景色為黑
   - SVG 透明 + 無 commits → 整塊黑
4. **SVG 尺寸計算錯誤**:
   - SVG `height` 計算為 0
   - 或 virtualization `offsetTop` 錯誤
5. **IPC 問題**:
   - `healthCheck` 通過但 `listCommits` 回傳空陣列
   - IPC 未觸發(workspace context 傳遞問題)

---

## 相關 commits

- `b313494` — feat(git-panel): add SVG commit graph with virtualization (T0156)
- `881aba2` — feat(git-panel): add Git panel scaffold and simple-git IPC (T0155)

---

## 衍生工單

- **研究**:T0157(診斷根因,允許加 trace log 請使用者重測)
- **修復**:根因確認後另派
