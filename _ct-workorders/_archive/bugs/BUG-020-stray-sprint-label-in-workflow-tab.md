# BUG-020 — Workflow 頁籤內顯示殘留「Sprint」標籤

## 元資料

| 欄位 | 內容 |
|------|------|
| **BUG 編號** | BUG-020 |
| **嚴重度** | 🟡 Medium |
| **狀態** | 🚫 CLOSED |
| **報修時間** | 2026-04-13 10:22 (UTC+8) |
| **發現人** | 使用者（Workflow 頁籤觀察） |
| **相關工單** | T0072（BmadWorkflowView）, T0076（修復工單） |

---

## 現象描述

「工作流程」頁籤（Workflow tab）內容正確顯示 BMad 4 個階段，但在內容**下方**出現一個多餘的「Sprint」標籤。

截圖確認：
- BMad 工作流程 4/4 階段 Done（顯示正常）
- 頁籤內容區底部有殘留「Sprint」文字

---

## 根因假設

1. `BmadWorkflowView.tsx` 或 `ControlTowerPanel.tsx` 在渲染 Workflow 頁籤時，仍有舊的 `SprintProgress` component 被條件性渲染
2. T0072 將 Sprint tab 改為 Workflow 時，只改了 tab label，但 `SprintProgress` component 仍在某處被渲染
3. CSS 隱藏但 DOM 仍存在，造成標籤可見

---

## 修復方向

- 找到 `ControlTowerPanel.tsx` 或 `BmadWorkflowView.tsx` 中仍引用 `SprintProgress` 的地方
- 確認 Sprint tab 對應的 component 是否已完全替換為 `BmadWorkflowView`
- 移除多餘的 `SprintProgress` 渲染邏輯

---

## 附加資訊

- 此 bug 已加入 T0076 一起修復
- 截圖路徑：`D:\Downloads\2026-04-13_101647.png`
