# 💡 PLAN-006：Scrollbar UX 改善（加粗 60% + 永遠佔位）

## 元資料

| 欄位 | 內容 |
|------|------|
| **計劃編號** | PLAN-006 |
| **狀態** | 💡 IDEA |
| **優先級** | 🟢 Low |
| **提出時間** | 2026-04-11 17:xx (UTC+8) |
| **提出人** | 使用者（dogfood 回報，登記為 UX-001） |
| **預估規模** | 小（主要是 CSS 調整） |
| **類型** | UX 改善 |

---

## 動機 / 背景

使用者 dogfood 回報（原登記為 UX-001）：
1. Scrollbar 太細，滑鼠不好定位和拖拉
2. 有 scroll / 無 scroll 切換時容器寬度變化造成 render 跳動

## 具體需求

1. **加粗 60%**：目前約 8-10px，目標約 13-16px
2. **永遠佔位**（`scrollbar-gutter: stable` 或 `overflow: scroll`）

**適用範圍**：所有有 scrollbar 的地方（終端、側邊欄、Settings、PromptBox 等）

## 預期效益

- 改善日常使用的 scrollbar 操作體驗
- 消除容器寬度跳動

## 技術方案候選

1. **CSS 全局樣式**（推薦）：`::-webkit-scrollbar { width: 14px }` + `scrollbar-gutter: stable`
2. xterm.js scrollbar 另外處理（有內建 scroll handling）

## 相關單據

- 與 BUG-008（overlay 錯位）可能有共通 CSS layout 根因

## 塔台決策

- **決定**：待分派
- **建議時機**：Phase 1 收官前的 UX polish pass
