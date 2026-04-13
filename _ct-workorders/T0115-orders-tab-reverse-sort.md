# T0115 — Orders 頁籤同群內反序排列

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0115 |
| **標題** | CT 面板 Orders 頁籤：同狀態群組內反序排列（新的在上） |
| **類型** | UX 改善 |
| **狀態** | ✅ DONE |
| **開始時間** | 2026-04-13 23:12 UTC+8 |
| **優先級** | 低 |
| **建立時間** | 2026-04-13 23:06 UTC+8 |

---

## 需求

Orders 頁籤目前按狀態分群（IN_PROGRESS / TODO / DONE 等），群組順序正確。

**但同群內的排序需要改為反序**：工單編號大的排上面（新的在前）。

目前：
```
IN_PROGRESS
  T0001
  T0002
  T0114
```

期望：
```
IN_PROGRESS
  T0114
  T0002
  T0001
```

---

## 修改位置

`src/components/ControlTowerPanel.tsx`（或排序邏輯所在的地方）：

找到 Orders 列表的排序邏輯，在狀態分群後，對同群內的工單按 ID **降序**排列。

```typescript
// 大致邏輯
workOrders.sort((a, b) => {
  // 1. 先按狀態群組排序（保持現有邏輯）
  const statusOrder = getStatusOrder(a.status) - getStatusOrder(b.status)
  if (statusOrder !== 0) return statusOrder
  // 2. 同群內按 ID 降序（新的在上）
  return b.id.localeCompare(a.id, undefined, { numeric: true })
})
```

> `numeric: true` 確保 T0002 < T0114（數字比較而非字串比較）

---

## 驗收條件

1. 同狀態群組內，工單編號大的排上面
2. 群組間順序不變
3. Build 通過

---

## 回報區（Worker 填寫）

### Commit Hash
（待 commit）

### 完成時間
2026-04-13 23:13 UTC+8

### 產出摘要
- 修改 `src/components/ControlTowerPanel.tsx` 第 284 行排序邏輯
- 原本僅按狀態群組排序，新增二級排序：同群內按 ID 降序（`b.id.localeCompare(a.id, undefined, { numeric: true })`）

### 遭遇問題
無

### 互動紀錄
無
