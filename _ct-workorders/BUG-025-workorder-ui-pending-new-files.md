# BUG-025 — Control Tower 面板：新建工單持續 Pending，file watch 不感知

## 狀態
**🔴 OPEN**

## 發現時間
2026-04-13 17:xx UTC+8

## 現象描述

Control Tower 面板中，部分工單一直顯示 **Pending** 狀態，修改 .md 檔案後 UI 不更新。

**受影響工單**：T0093 / T0097 / T0098（三者共同點：均為後期建立的工單）

## 重現步驟

1. 啟動 Control Tower 面板
2. 建立新工單 .md 檔案（在 _ct-workorders/ 目錄）
3. 修改工單狀態（如 `📋 TODO` → `✅ DONE`）
4. 觀察 CT 面板 → **工單狀態仍顯示 Pending，UI 未更新**

## 假設根因

**最可能**：file watch 在初始化時不包含後來新建的 .md 文件

- BUG-024（T0095）修復了「CT 面板不監聽 _workorder-index.md」
- 但可能修復方式是：把已存在的 .md 文件加入 watch
- **後來建立的新文件**（如 T0097/T0098 在本 session 才建立）不在 watch 範圍內

**其他可能**：
- Parser 容錯邏輯過濾了某些工單格式（新模板與舊格式差異）
- _workorder-index.md 有重複行（T0096），導致 parser 狀態混亂
- Pending 是 UI 的預設初始狀態，未被觸發更新

## 相關歷史

- **BUG-024**（T0095）：CT 面板不監聽 _ct-workorders/ 目錄的索引文件 → 已修復
- 之前的 workorder parser 容錯：[需查明對應的工單編號]

## 影響範圍

- Control Tower 面板（BUG/工單列表頁）
- 所有在現有 session 期間新建的 .md 工單文件

## 驗收條件

- [ ] 新建工單 .md 後，CT 面板在 1-2 秒內自動反映新工單
- [ ] 修改工單 .md 狀態後，CT 面板即時更新（不需重啟 app）
- [ ] 回歸測試：T0093 / T0097 / T0098 的狀態正常顯示
