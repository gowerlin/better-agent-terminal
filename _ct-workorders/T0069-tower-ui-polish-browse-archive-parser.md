# 工單 T0069-tower-ui-polish-browse-archive-parser

## 元資料
- **工單編號**：T0069
- **任務名稱**：塔台 UI 修正 — 瀏覽檔案連結 + 包含封存開關 + Backlog parser 修正
- **狀態**：DONE
- **建立時間**：2026-04-12 23:15 (UTC+8)
- **開始時間**：2026-04-12 23:19 (UTC+8)
- **完成時間**：2026-04-12 23:50 (UTC+8)

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：中（需讀取多個 component + parser）
- **降級策略**：若 CW 不足，優先完成「瀏覽檔案連結」（最直觀的缺陷），其餘交後續

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需讀取 T0067/T0068 產出的多個 component 檔案

## 任務指令

### 前置條件
需載入的文件清單：
- `CLAUDE.md`（專案規範）
- `_ct-workorders/_local-rules.md`（歸檔目錄結構定義）
- `_ct-workorders/_bug-tracker.md`（索引格式參考）
- `_ct-workorders/_backlog.md`（索引格式 — 注意 section heading）
- `src/components/ControlTowerPanel.tsx`（了解現有工單 [瀏覽檔案] 的實作方式）
- `src/components/BugTrackerView.tsx`（修改目標）
- `src/components/BacklogView.tsx`（修改目標）
- `src/components/DecisionsView.tsx`（修改目標）
- `src/types/backlog.ts`（parser 修正目標）

### 輸入上下文

T0067/T0068 完成了塔台 UI 的 BUG/Backlog/Decisions 三個新頁籤，但複驗發現以下缺陷：

#### 缺陷 1：缺少 [瀏覽檔案] 連結

**現象**：現有工單（orders）頁籤的每個條目有 [瀏覽檔案] 按鈕/連結，可以在系統中打開對應 .md 檔案。新增的三個頁籤（bugs/backlog/decisions）都缺少這個功能。

**修正方式**：
- 先找到 orders 頁籤中 [瀏覽檔案] 的實作方式（component + handler）
- 在 BugTrackerView / BacklogView / DecisionsView 中加入相同的連結
- BugEntry / BacklogEntry 已有 `linkPath` 欄位，可直接使用
- DecisionEntry 的瀏覽檔案應指向 `_decision-log.md`（單檔）

#### 缺陷 2：缺少 [包含封存] 開關

**現象**：已歸檔的 BUG/PLAN 條目只出現在索引檔中（連結指向 `_archive/` 路徑），但使用者無法選擇是否顯示這些歸檔項目。

**修正方式**：
- 在 BugTrackerView 和 BacklogView 的過濾區域加入 [包含封存] 開關（checkbox 或 switch）
- 預設為「關閉」（只顯示 active 項目）
- 開啟時顯示所有項目（含 `isArchived === true` 的條目）
- 歸檔項目在 UI 中應有視覺區隔（如淡化、標記 📦 icon、或灰色背景）
- **工單（orders）頁籤也要加此開關**：開啟後額外掃描 `_archive/workorders/T*.md`，歸檔工單同樣有視覺區隔
- DecisionsView 不需要此開關（_decision-log.md 是單檔，沒有歸檔概念）

**判斷 isArchived**：BugEntry / BacklogEntry 已有 `isArchived` 欄位（由 linkPath 是否含 `_archive/` 判斷）。

#### 缺陷 3：Backlog parser section mapping

**現象**：`_backlog.md` 的 section heading 是「🔄 Active（Ideas & Plans）」，但 `parseBacklog()` 的 sectionToStatus mapping 沒有匹配到這個 heading，導致 6 筆 PLAN 全部 fallback 到 IDEA 狀態。

**修正方式**：
- 檢查 `src/types/backlog.ts` 的 `parseBacklog()` 中 section heading → status 的 mapping 邏輯
- 修正為正確匹配 `_backlog.md` 的實際 section heading
- 確認：Active 區的 PLAN 狀態應從個別條目的「狀態」欄位讀取（💡 IDEA / 📋 PLANNED），**不是**由 section heading 決定
- 這與 `parseBugTracker()` 不同 — BUG tracker 的 section heading 確實代表狀態分組，但 Backlog 的 Active section 混合了多種狀態

### 預期產出

#### 修改檔案
1. **`src/components/ControlTowerPanel.tsx`** — 工單 orders 頁籤加入 [包含封存] 開關（開啟時額外掃描 `_archive/workorders/`）
2. **`src/components/BugTrackerView.tsx`** — 加入 [瀏覽檔案] + [包含封存] 開關
3. **`src/components/BacklogView.tsx`** — 加入 [瀏覽檔案] + [包含封存] 開關
4. **`src/components/DecisionsView.tsx`** — 加入 [瀏覽檔案]（指向 _decision-log.md）
5. **`src/types/backlog.ts`** — 修正 parseBacklog() 的狀態解析邏輯
5. **`src/styles/control-tower.css`** — 歸檔項目樣式 + 開關樣式（若需新增）
6. **`src/locales/en.json`** — [包含封存] / [瀏覽檔案] 翻譯鍵
7. **`src/locales/zh-TW.json`** — 同上
8. **`src/locales/zh-CN.json`** — 同上

### 驗收條件
- [ ] BugTrackerView 每個條目有 [瀏覽檔案] 連結，點擊可開啟對應 .md
- [ ] BacklogView 每個條目有 [瀏覽檔案] 連結
- [ ] DecisionsView 有 [瀏覽檔案] 連結（指向 _decision-log.md）
- [ ] 工單 orders 頁籤有 [包含封存] 開關，開啟時顯示 `_archive/workorders/` 的歸檔工單
- [ ] BugTrackerView 有 [包含封存] 開關，預設關閉
- [ ] 開啟 [包含封存] 後，已歸檔 BUG 出現且有視覺區隔
- [ ] 關閉 [包含封存] 後，已歸檔 BUG 隱藏
- [ ] BacklogView 有 [包含封存] 開關，行為同上
- [ ] 歸檔項目在所有頁籤中有一致的視覺區隔
- [ ] parseBacklog() 正確解析各 PLAN 的狀態（IDEA / PLANNED），不全部 fallback IDEA
- [ ] 現有功能無 regression
- [ ] `npx vite build` 編譯成功

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 先找到 ControlTowerPanel.tsx 中工單 orders 頁籤的 [瀏覽檔案] 實作方式
4. 修正 `src/types/backlog.ts` parseBacklog()（缺陷 3）
5. 修改 BugTrackerView（加 [瀏覽檔案] + [包含封存]）
6. 修改 BacklogView（加 [瀏覽檔案] + [包含封存]）
7. 修改 DecisionsView（加 [瀏覽檔案]）
8. 更新 CSS 和 i18n
9. `npx vite build` 確認編譯成功
10. 填寫回報區

### 執行注意事項
- [瀏覽檔案] 的行為要與工單 tab 完全一致（複用相同的 handler/utility）
- [包含封存] 開關的 state 不需要持久化（切換頁籤或重新載入時重置為關閉即可）
- 歸檔項目的視覺區隔要明顯但不突兀（建議：降低透明度 + 小 📦 icon）
- 遵循 CLAUDE.md No Regressions Policy

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
**修改檔案（9 個）：**
1. `src/types/backlog.ts` — 新增 `rowStatusToStatus()`，parseBacklog() 優先讀 row 的「狀態」欄位而非 section heading；修正 createdAt 支援「提出時間」欄
2. `src/types/control-tower.ts` — WorkOrder interface 新增 `isArchived?: boolean`
3. `src/components/BugTrackerView.tsx` — 加入 [瀏覽檔案] + [包含封存] toggle + ct-archived-item class
4. `src/components/BacklogView.tsx` — 同上（BacklogEntry 版本）
5. `src/components/DecisionsView.tsx` — 新增 ctDirPath prop，加入 [瀏覽檔案] 按鈕（指向 _decision-log.md）
6. `src/components/ControlTowerPanel.tsx` — 新增 showArchivedOrders/archivedOrders state + loadArchivedOrders + displayOrders + [包含封存] toggle；DecisionsView 傳入 ctDirPath
7. `src/styles/control-tower.css` — 新增 .ct-archived-item、.ct-archive-toggle、.ct-item-actions 樣式
8. `src/locales/en.json` — 新增 `includeArchived: 'Include Archived'`
9. `src/locales/zh-TW.json` — 新增 `includeArchived: '包含封存'`
10. `src/locales/zh-CN.json` — 新增 `includeArchived: '包含归档'`

**關鍵修正：**
- parseBacklog() defect 修正：Active section 的 PLAN-004 現在正確顯示 PLANNED（而非 IDEA）
- 所有新頁籤均可從展開詳情中點擊 [瀏覽檔案] 跳至檔案樹
- 工單/BUG/Backlog 三個頁籤均有 [包含封存] toggle，歸檔項目以 55% 透明度顯示

**事後補修（使用者驗收回饋）：**
- Bug/Backlog item 改為工單卡片風格（左側彩色狀態條）；filter button 改 pill 樣式（border-radius: 12px）
- 修正 Bug/Backlog item 套用 badge class 導致整張卡片出現毛玻璃底色（加 `background: none; color: inherit` 覆寫）
- [包含封存] 標籤加 `white-space: nowrap; flex-shrink: 0` 防止垂直換行撐高 filter 區
- 修正歸檔工單 [瀏覽檔案] 路徑錯誤：`order.filename` → `_archive/workorders/${order.filename}`（Bug/Backlog 的 linkPath 已含 _archive/ 前綴，無此問題）

### 互動紀錄
無

### 遭遇問題
無。build 一次成功（✓ built in 9.49s），只有既有的 chunk size 警告（非新增）。

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-12 23:50 (UTC+8)（含事後補修）
