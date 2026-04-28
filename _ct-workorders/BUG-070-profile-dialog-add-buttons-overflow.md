---
schema_version: 1
schema_kind: bug
id: BUG-070
title: Profile 配置 Dialog 的 Add 按鈕橫向溢出，建議改群組化下拉
status: CLOSED
severity: high
---
# BUG-070 — Profile 配置 Dialog 的 Add 按鈕橫向溢出，建議改群組化下拉

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-070 |
| 標題 | Profile 配置 Dialog 頂部工具列（儲存目前狀態 / +本機 / +遠端 / Add WSL Profile / Add Docker / Add SSH）橫向溢出固定寬度 Dialog 邊界，最右側按鈕被裁切無法點擊 |
| 嚴重度 | 🔴 High |
| 可重現 | 偶爾 — Dialog 為固定大小不可調整；溢出條件依「啟用的 profile 類型 + label 語系寬度」而定（中文 label 較窄、英文 label 較寬；WSL/Docker/SSH 類型全啟用時必觸發） |
| Workaround | ❌ 無 — Dialog 固定寬度且不可橫向滾動，被裁切按鈕完全無法觸及 |
| 狀態 | 🚫 CLOSED — 2026-04-27 使用者實機驗收通過（T0306 commit `014da72`） |
| 建立時間 | 2026-04-26 22:?? (UTC+8) |
| 報告者 | 使用者（v0.4.1 release 後 dogfood） |
| 影響範圍 | `src/components/ProfilePanel.tsx` 工具列佈局；隨 PLAN-007 Phase 2-4 陸續加入 WSL / Docker / SSH 三個 Add 按鈕後出現 |
| 建議修復方向 | 參考「新增 Agent」按鈕的群組化下拉模式（screenshot #2）— 主工具列僅保留高頻操作（儲存目前狀態 / +本機 / +遠端），進階 profile 類型（WSL / Docker / SSH，未來可能更多）收進單一「+」按鈕展開的分類選單 |
| 相關 PLAN | PLAN-007（觸發來源，引入 WSL/Docker/SSH 三類遠端 profile）/ **PLAN-030（收斂方）— ProfilePanel + Setup Wizard UI overhaul** |
| Release target | 由 PLAN-030 統一規劃（預期 v0.4.2 patch 或 v0.5.0） |

## 現象

### 預期行為
Profile 配置 Dialog 的所有 Add 按鈕都應在 Dialog 範圍內可見且可點擊。

### 實際行為
工具列按鈕橫向溢出 Dialog 邊界，最右側的「Add ...」按鈕被裁切（見 screenshot #1，「Add WSL Profile」右側可見「Add」字樣即被截斷的下一顆按鈕）。

### 觸發條件
- Dialog 為固定寬度，無法調整或橫向滾動
- 工具列按鈕數量隨 PLAN-007 Phase 2-4 累積（+本機 / +遠端 → +WSL → +Docker → +SSH）
- 中英混排 label 寬度疊加超過 Dialog 內容區寬度

### 截圖
- screenshot #1：Profile Dialog 工具列溢出現況
- screenshot #2：新增 Agent 的群組化下拉模式（建議參考的設計）

## 設計建議（使用者提案）

主工具列：
- `儲存目前狀態` — 高頻
- `+ 本機` — 高頻
- `+ 遠端` — 高頻
- `+ ▼` — 群組化下拉，展開後分類列出：
  - WSL Profile
  - Docker Profile
  - SSH Profile
  - （未來新增類型直接加進選單，不再撐爆工具列）

優點：
1. 工具列寬度恆定，不隨 profile 類型增加而溢出
2. 視覺一致性 — 與右下角「新增 Agent」按鈕的互動模式對齊
3. 為未來擴充（PLAN-014 / 其他 profile 類型）預留空間

## 後續處理待塔台決策

- [ ] 立即派修復工單（FIXING）
- [ ] 先記錄，PLAN-007 完整收尾後再處理（OPEN，等批次 UI polish）
- [ ] 評估是否合併到既有 PLAN-014 或開新 PLAN
