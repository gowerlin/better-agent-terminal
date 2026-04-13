# BUG-018 — 切換工作區後其他頁籤未更新（停留在舊專案）

## 元資料

| 欄位 | 內容 |
|------|------|
| **BUG 編號** | BUG-018 |
| **嚴重度** | 🔴 High |
| **狀態** | 📋 REPORTED |
| **報修時間** | 2026-04-13 10:05 (UTC+8) |
| **發現人** | 使用者（切換工作區測試） |
| **相關工單** | T0067（BugTrackerView）, T0068（Backlog/Decisions）, T0072（Workflow）, T0073（Epics）, T0076（修復工單） |

---

## 現象描述

**操作步驟**：
1. 在 better-agent-terminal 專案開啟塔台面板
2. 切換工作區到其他專案（例如 Keenbest）

**問題**：
- **工單頁籤**（Workorders）：✅ 正常更新，顯示新工作區的工單
- **Bugs 頁籤**：❌ 仍顯示舊專案（better-agent-terminal）的 bug 資料
- **Backlog 頁籤**：❌ 仍顯示舊專案的 backlog
- **Decisions 頁籤**：❌ 仍顯示舊專案的決策日誌
- **Workflow 頁籤**：❌ 未更新（仍顯示舊專案或空白）
- **Epics 頁籤**：❌ 未更新（仍顯示舊專案）

---

## 預期行為

切換工作區後，**所有頁籤**應重新從新工作區路徑載入資料。

---

## 根因假設

工作區路徑（`workspacePath` 或 `selectedFolder`）切換時，只有工單列表訂閱了路徑變更事件，其他頁籤的 `useEffect` 沒有將工作區路徑納入 dependency array，導致不重新載入。

**受影響 component 清單**（待 Worker 確認）：
- `BugTrackerView.tsx`（T0067 建立）
- `BacklogView.tsx` 或相關 component（T0068 建立）
- `DecisionsView.tsx` 或相關 component（T0068 建立）
- `BmadWorkflowView.tsx`（T0072 建立）
- `BmadEpicsView.tsx`（T0073 建立）

---

## 附加資訊

- 工單列表（Workorders tab）切換正常，可作為參考的「已正確實作」範例
- BUG-017 的根因可能是 BUG-018 的子集（workspace 不更新 → bmad 路徑也不更新）
- 建議 T0076 一併修復
