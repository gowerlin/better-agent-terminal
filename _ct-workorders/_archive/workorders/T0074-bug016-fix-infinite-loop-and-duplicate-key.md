# 工單 T0074-bug016-fix-infinite-loop-and-duplicate-key

## 元資料
- **工單編號**：T0074
- **任務名稱**：BUG-016 修復 — ControlTowerPanel 無限循環 + 重複 key
- **狀態**：DONE
- **建立時間**：2026-04-13 09:47 (UTC+8)
- **開始時間**：2026-04-13 09:53 (UTC+8)
- **完成時間**：2026-04-13 09:59 (UTC+8)
- **相關單據**：BUG-016, T0072, T0073

---

## 工作量預估
- **預估規模**：小
- **Context Window 風險**：低
- **降級策略**：無需降級

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需讀取多個 component 檔案 + log，context 較乾淨

---

## 任務指令

### 前置條件
需載入的文件清單：
- `CLAUDE.md`（專案規範）
- `src/components/ControlTowerPanel.tsx`（line 44 附近的 key 問題）
- `src/components/BmadWorkflowView.tsx`（T0072 新增，useEffect 可能有問題）
- `src/components/BmadEpicsView.tsx`（T0073 新增，useEffect 可能有問題）

### Log 檔案（必讀）
```
C:\Users\Gower\AppData\Roaming\better-agent-terminal-runtime-1\Logs\debug-20260413-093319.log
```
讀取方式（貼到終端執行，只讀 ERROR/WARN）：
```powershell
Select-String -Path "C:\Users\Gower\AppData\Roaming\better-agent-terminal-runtime-1\Logs\debug-20260413-093319.log" -Pattern "ERROR|WARN|error|warn|duplicate|key|infinite|loop|workflow|epics" | Select-Object -Last 50
```

### 問題描述

**問題 1：React 重複 key**
```
Warning: Encountered two children with the same key, 'T0256'
at ControlTowerPanel.tsx:44:37
```
工單列表中同一個 workorder ID 出現兩次。

**問題 2：無限循環**
UI 卡在「載入工單中」無法脫離。推測是 `useEffect` dependency array 包含非穩定參考（array literal / inline object / callback）。

---

### 診斷步驟

1. **讀 log**：先執行上方 PowerShell 指令，確認 log 中的實際錯誤
2. **找重複 key 根源**：
   - 讀 `ControlTowerPanel.tsx` line 44 附近
   - 確認 workorder 列表是否被 concat/merge 兩次
   - 搜尋 `BmadWorkflowView` 或 `BmadEpicsView` 是否也在做獨立的 workorder 掃描
3. **找 useEffect 無限循環**：
   - 在 `BmadWorkflowView.tsx` 和 `BmadEpicsView.tsx` 中找所有 `useEffect`
   - 確認 dependency array 是否包含：每次 render 都會建立新參考的值（array、object、函數）
   - 常見問題：`useEffect(() => {...}, [someArray])` 但 `someArray` 是 `workorders.filter(...)` 這種每次 render 都產生新 array

### 預期修復方式

**重複 key**：
- 若是資料合併問題 → 找到合併點，用 `Array.from(new Set(...))` 或確保只合併一次
- 若是兩個 component 都渲染同一清單 → 其中一個移除多餘渲染

**無限循環**：
- 把 dependency array 中的不穩定參考換成穩定值
- 例如：用 `workorders.length` 或 `workorders.map(w => w.id).join(',')` 代替直接傳 `workorders` array
- 或者用 `useMemo` 穩定化衍生資料

---

### 預期產出

- 修復 `ControlTowerPanel.tsx`（若有重複 key 問題）
- 修復 `BmadWorkflowView.tsx`（若有 useEffect 問題）
- 修復 `BmadEpicsView.tsx`（若有 useEffect 問題）
- 重複 key 警告消失
- 頁籤正常切換，「載入工單中」不再無限循環

### 驗收條件
1. `npx vite build` 編譯通過，無 TypeScript 錯誤
2. Dev server 啟動後，切換到 Workflow / Epics 頁籤不出現 React 重複 key 警告
3. UI 不卡在「載入工單中」狀態
4. 其他既有頁籤（Bugs / Backlog / Decisions）功能不受影響

---

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀 log（用上方 PowerShell 指令）
2. 讀 `ControlTowerPanel.tsx`（特別是 line 44 附近 + workorder 資料來源）
3. 讀 `BmadWorkflowView.tsx` 所有 `useEffect`
4. 讀 `BmadEpicsView.tsx` 所有 `useEffect`
5. 修復問題
6. `npx vite build` 確認編譯通過
7. 填寫回報區

### 執行注意事項
- 只修 BUG-016 兩個問題，不改其他邏輯
- 不要重構或優化無關程式碼
- 若發現額外問題，記錄在回報區，不要順手修掉

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
修改 `src/components/ControlTowerPanel.tsx`：

**修復 1：無限循環（根因）**
- `loadEpics` 的 `useCallback` 原本依賴 `[bmadOutputPath, sprintStatus]`
- `sprintStatus` 是 state 物件，每次 `loadSprintStatus()` 會產生新參考
- 導致 `loadEpics` → 主 useEffect → `loadSprintStatus` → `sprintStatus` 變更 → `loadEpics` 變更 → 無限循環
- **修法**：新增 `sprintStatusRef` (useRef)，`loadEpics` 改讀 ref，依賴陣列改為 `[bmadOutputPath]`
- 新增獨立 useEffect 在 sprintStatus 變更時同步 ref 並觸發 `loadEpics()`

**修復 2：重複 key（防禦性）**
- `loadWorkOrders` 新增 Set-based 去重，確保同一 order ID 只出現一次

### 發現的額外問題
無
