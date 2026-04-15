# 工單 T0077-ui-move-include-archive-checkbox

## 元資料
- **工單編號**：T0077
- **任務名稱**：UI 調整 — 「包含封存」勾選框移至統計列，適用所有單據頁籤
- **狀態**：DONE
- **建立時間**：2026-04-13 10:26 (UTC+8)
- **開始時間**：2026-04-13 10:43 (UTC+8)
- **完成時間**：2026-04-13 10:47 (UTC+8)
- **相關單據**：T0067（BugTrackerView）, T0068（Backlog/Decisions）, T0069（工單列表）

---

## 工作量預估
- **預估規模**：小
- **Context Window 風險**：低
- **降級策略**：若某個頁籤 component 結構差異太大，可先做 Bugs，其他頁籤後補

## Session 建議
- **建議類型**：🆕 新 Session（或接 T0076 session 若 CW 夠）

---

## 任務指令

### 設計需求說明

**目前狀態**：「包含封存」勾選框在篩選列第二行（與 High/Medium/Low 同一行）

**目標狀態**：「包含封存」勾選框移到**統計列右側**（與 `N pending / N done / N total` 同一行的右端）

截圖參考：`D:\Downloads\2026-04-13_102022.png`
- 紅色虛線圈標示目標位置：統計列（1 pending | 13 done | 14 total）右側
- 原本位置（第二行篩選列）需移除

### 適用範圍（所有單據類型）

| 頁籤 | Component | 有「包含封存」功能？ |
|------|-----------|-------------------|
| 工單 | WorkOrderList 或相關 | 需確認 |
| 臭蟲 | BugTrackerView | ✅ 有（截圖可見） |
| 待辦池 | BacklogView | 需確認 |
| 決策 | DecisionsView | 需確認 |

> **Worker**：先確認哪些頁籤有「包含封存」功能，再統一移位。

### 位置規格

```
統計列（修改後）：
┌────────────────────────────────────────┐
│ 1 pending  13 done  14 total  □ 包含封存 │
└────────────────────────────────────────┘
```

- 勾選框在統計列最右側
- 現有篩選列（第二行）移除「包含封存」項目，其他篩選項（High/Medium/Low）保留
- 若統計列空間不足，勾選框可縮小或只用 icon

### i18n
- 勾選框文字使用現有 i18n key（若無，新增：`includeArchived`）
- 三語言同步更新（en / zh-TW / zh-CN）

---

### 執行步驟

1. 確認哪些 component 有「包含封存」功能
2. 在每個 component 中：
   a. 找到統計列的 JSX（顯示 pending/done/total 的行）
   b. 在統計列右側加入勾選框 `□ 包含封存`
   c. 從原本位置（篩選行）移除勾選框
3. i18n 確認（en / zh-TW / zh-CN）
4. `npx vite build` 確認編譯通過

### 執行注意事項
- 只移動位置，不改變勾選框的邏輯和 state
- 不要改動篩選列（High/Medium/Low）的其他功能
- 視覺對齊保持與統計列其他元素一致（字體大小、間距）

---

### 驗收條件
1. 所有有「包含封存」功能的頁籤，勾選框出現在統計列右側
2. 原本篩選列的「包含封存」位置不再出現
3. 勾選 / 取消勾選功能正常（顯示/隱藏封存項目）
4. `npx vite build` 通過，無 TypeScript 錯誤

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
修改 4 個檔案，將「包含封存」勾選框從篩選列移到統計列右側：

- `src/components/BugTrackerView.tsx` — 勾選框從 severity filter bar → summary bar
- `src/components/BacklogView.tsx` — 勾選框從 priority filter bar → summary bar
- `src/components/ControlTowerPanel.tsx` — 勾選框從 status filter bar → summary bar（僅 orders tab 顯示）
- `src/styles/control-tower.css` — 新增 `.ct-summary .ct-archive-toggle { margin-left: auto }` 推至右端

i18n：三語言 key 已存在（`includeArchived`），無需新增。

### 遭遇問題
無

### 互動紀錄
無
