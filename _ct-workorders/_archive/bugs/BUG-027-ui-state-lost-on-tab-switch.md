# BUG-027 — 切換頁籤/面板時 UI 篩選與展開狀態遺失

## 狀態
**🚫 CLOSED**（T0117 + T0118 修復，2026-04-14｜人工驗收通過 2026-04-15）

## 發現時間
2026-04-13 23:18 UTC+8

## 嚴重度
**🟡 Medium**（UX 一致性問題，不崩潰但體驗差）

## 現象描述

切換頁籤或面板時，部分 UI 的篩選條件和 item 展開狀態會重置為預設值。

**已確認受影響**：
- CT 面板 — Bugs 頁籤（篩選 + 展開狀態）
- CT 面板 — Backlog 頁籤（篩選 + 展開狀態）
- CT 面板 — Decisions 頁籤（篩選 + 展開狀態）

**不受影響（狀態保持）**：
- CT 面板 — Orders 頁籤

**待確認**（可能也受影響）：
- 側邊欄 — 終端列表
- 側邊欄 — 檔案樹
- 側邊欄 — Git 面板
- 側邊欄 — GitHub 面板
- 側邊欄 — 程式碼片段
- Docking 切換左右面板/主區

## 預期行為

**全系統 UX 一致**：任何頁籤/面板/dock 切換後，回來時狀態完整保留：
- 篩選條件
- 展開/摺疊狀態
- 捲動位置
- 選中項目

## 根因推測

元件使用 conditional rendering（`{activeTab === 'bugs' && <BugsView />}`），切換時 unmount → 重新 mount，React local state 遺失。
Orders 可能用了 parent-level state 或 store，所以保留。

## 修復方向

| 方案 | 說明 | 優缺點 |
|------|------|--------|
| A. 狀態提升 | 各 tab 的 filter/expansion state 提升到 ControlTowerPanel | 中等改動，明確 |
| B. CSS 隱藏 | `display: none` 取代 conditional render，元件保持 mounted | 最小改動，但所有 tab 同時存在於 DOM |
| C. Store 持久化 | 用 zustand store 儲存各面板 UI state | 最徹底，但改動大 |

## 相關
- 修復工單：T0117（待開）
