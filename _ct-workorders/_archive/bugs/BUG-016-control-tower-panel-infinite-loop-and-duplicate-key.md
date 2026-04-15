# BUG-016 — ControlTowerPanel 載入工單無限循環 + 重複 key 警告

## 元資料

| 欄位 | 內容 |
|------|------|
| **BUG 編號** | BUG-016 |
| **嚴重度** | 🔴 High |
| **狀態** | 🚫 CLOSED |
| **報修時間** | 2026-04-13 09:47 (UTC+8) |
| **發現人** | 使用者（runtime 測試） |
| **相關工單** | T0072（BmadWorkflowView）, T0073（BmadEpicsView）, T0074（修復工單） |

---

## 現象描述

### 問題 1：React 重複 key 警告
```
Warning: Encountered two children with the same key, 'T0256'.
Keys should be unique so that components maintain their identity across updates.
at ControlTowerPanel (http://localhost:5173/src/components/ControlTowerPanel.tsx:44:37)
```

- 工單列表渲染時出現重複 key（`T0256` 出現兩次）
- 位置：`ControlTowerPanel.tsx:44`

### 問題 2：無限循環卡在「載入工單中」
- UI 顯示「載入工單中」後無法脫離此狀態
- 推測為 `useEffect` dependency array 設定錯誤，導致每次 render 重新觸發載入

### Log 檔案
```
C:\Users\Gower\AppData\Roaming\better-agent-terminal-runtime-1\Logs\debug-20260413-093319.log
```

---

## 預期行為

- ControlTowerPanel 正常顯示工單列表，無重複 key 警告
- 頁籤切換正常，不卡在「載入工單中」狀態

## 實際行為

- React console 持續輸出重複 key 警告
- UI 卡在載入狀態，無法使用 Workflow / Epics 頁籤

---

## 根因假設

1. **重複 key**：工單資料被 concat 兩次，或 WorkflowView/EpicsView 在初始化時對同一資料源做了重複掃描
2. **無限循環**：`BmadWorkflowView.tsx` 或 `BmadEpicsView.tsx` 的 `useEffect` 把非穩定物件（array/object）放進 dependency array，導致每次 render 都觸發

---

## 修復進度

- [ ] 閱讀 log 確認實際錯誤訊息
- [ ] 找到重複 key 的產生位置
- [ ] 找到 useEffect 無限循環的 dependency 問題
- [ ] 修復並驗收
