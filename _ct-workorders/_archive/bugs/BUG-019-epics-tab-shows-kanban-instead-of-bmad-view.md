# BUG-019 — Epics 頁籤顯示舊版 KanbanView 而非 BmadEpicsView

## 元資料

| 欄位 | 內容 |
|------|------|
| **BUG 編號** | BUG-019 |
| **嚴重度** | 🟡 Medium |
| **狀態** | 🚫 CLOSED |
| **報修時間** | 2026-04-13 10:18 (UTC+8) |
| **發現人** | 使用者（runtime 觀察） |
| **相關工單** | T0073（BmadEpicsView）, T0074（BUG-016 修復）, T0076（修復工單，含此 bug） |
| **關聯 Bug** | BUG-017（Keenbest Epics 顯示工單分群） |

---

## 現象描述

「史詩」頁籤（Epics tab）顯示**舊版工單 Kanban 分群樣式**（待辦 / 進行中 / 已完成），而不是 T0073 實作的 `BmadEpicsView`。

截圖中可確認：
- 顯示 T0075/T0076（最新工單）→ 資料是**正確**的
- 但顯示格式為舊版 KanbanView（狀態分群），非 BmadEpicsView

使用者反映此狀態「回不來了」（無法切回 BmadEpicsView）。

---

## 根因假設（優先順序）

**假設 A（最可能）**：BUG-016 修復（T0074）在 `ControlTowerPanel.tsx` 中意外將 Epics tab 的 component 改回 `KanbanView` 而非 `BmadEpicsView`。

**假設 B**：`BmadEpicsView` 的 fallback 邏輯設計為「無 _bmad-output 時顯示工單 Kanban」，但 T0073 原設計的 fallback 應為提示訊息（非完整 Kanban）。

**假設 C**：`ControlTowerPanel.tsx` 中 Epics tab 的 component 切換邏輯在 T0074 修復後有 regression。

---

## 修復方向

Worker 在修復 BUG-018 時一併確認：

1. `ControlTowerPanel.tsx` 的 Epics tab 是否掛的是 `BmadEpicsView`（而非 `KanbanView`）
2. `BmadEpicsView` 的 fallback 邏輯：無 _bmad-output 時應顯示提示訊息，不應重新渲染完整 KanbanView
3. 若 fallback 是工單 Kanban → 改為顯示提示（例如「此專案未找到 _bmad-output，無 Epic 資料」）

---

## 附加資訊

- T0073 的驗收條件：「無 _bmad-output 時自動 fallback 至提示訊息」
- 截圖顯示 BAT 專案（無 _bmad-output）的 Epics tab 顯示完整工單 Kanban → 不符驗收條件
- 此 bug 已加入 T0076 一起修復
