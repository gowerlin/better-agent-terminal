# BUG-017 — BMad Workflow/Epics 無法偵測非當前工作區的 _bmad-output

## 元資料

| 欄位 | 內容 |
|------|------|
| **BUG 編號** | BUG-017 |
| **嚴重度** | 🟡 Medium |
| **狀態** | 📋 REPORTED |
| **報修時間** | 2026-04-13 10:05 (UTC+8) |
| **發現人** | 使用者（切換到 Keenbest 專案後觀察） |
| **相關工單** | T0072（BmadWorkflowView）, T0073（BmadEpicsView）, T0076（修復工單） |

---

## 現象描述

**環境**：
- 切換到 `D:\ForgejoGit\2026_Keenbest` 工作區
- 該專案確認有 `_bmad-output` 目錄

**問題**：
1. **Workflow 頁籤**：顯示空白或無內容，未顯示 BMad 流程步進
2. **Epics 頁籤**：顯示工單分群（舊的 Kanban 模式），未顯示 BMad Epic/Story 結構

**預期行為**：
- 切換到含 `_bmad-output` 的專案後，Workflow 應顯示 BMad 流程步進
- Epics 應顯示 BMad Epic/Story 看板結構

**實際行為**：
- Workflow 無內容
- Epics 回退到工單分群模式（與不含 _bmad-output 的專案相同）

---

## 根因假設

1. `bmadOutputPath` 路徑計算使用 hardcoded 或固定的專案路徑，未根據當前選取的 workspace 動態計算
2. BMad 偵測邏輯在 Keenbest 專案的路徑格式不符合（`_bmad-output` 在哪一層？）
3. 可能與 BUG-018（workspace 切換不重新整理）是同一根因

---

## 附加資訊

- 測試專案路徑：`D:\ForgejoGit\2026_Keenbest`
- `_bmad-output` 目錄確認存在（使用者說明）
- BmadWorkflowView / BmadEpicsView 的路徑偵測邏輯建立於 T0072/T0073
