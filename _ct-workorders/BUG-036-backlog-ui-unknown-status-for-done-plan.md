# BUG-036 — CT Panel Backlog 列表對 DONE 狀態的 PLAN 顯示 Unknown

## 元資料
- **BUG 編號**：BUG-036
- **標題**：PLAN-012 狀態更新為 `✅ DONE` 後，CT panel Backlog tab 列表顯示為「Unknown」+ 💡 Idea 標籤，與右側詳細頁的 `✅ DONE` 不一致
- **狀態**：🚫 CLOSED
- **修復 commits**：`cb0d535`（status 主修）+ `4d9fba4`（priority follow-up）
- **CLOSED 時間**：2026-04-17 17:30 (UTC+8)（使用者驗證通過 — D046）
- **嚴重度**：🟢 Low（純 UI 顯示不一致，不影響資料正確性和功能；檔案內容 + 右側詳細頁皆正確）
- **建立時間**：2026-04-17 17:22 (UTC+8)
- **發現於**：D044 批次結案後，使用者在 CT panel Backlog tab 看到 PLAN-012 顯示 Unknown；PLAN-012 檔案 `狀態: ✅ DONE`，`_backlog.md` 已將 PLAN-012 移至 Completed 區塊
- **關聯 PLAN**：（無直接關聯，屬 CT panel UI 缺陷）
- **修復工單**：T0151（派發中，使用者選項 [B] 直接派修復工單，Worker 自行定位 parser）
- **可重現**：100%（任何從 Active 移到 Completed 的 PLAN 應該都會觸發）

---

## 現象描述

### 使用者截圖（2026-04-17 17:18）
- 右側檔案預覽：PLAN-012 狀態欄明確顯示 `✅ DONE`，DONE 時間 2026-04-17 17:12
- 左側 Backlog 列表：PLAN-012 顯示狀態標籤為 **Unknown**（灰底），優先級燈泡仍是 💡 Idea（橘色）
- 同列表中：
  - PLAN-004 / PLAN-009 顯示 📋 Planned 正確
  - PLAN-001 / 002 / 003 / 005 / 007 / 013 顯示 💡 Idea 正確
  - **只有 PLAN-012（✅ DONE）顯示為 Unknown** → 特例

### 預期行為
- Backlog tab 列表應顯示 PLAN-012 為 `✅ Done` 狀態（綠色 Done 標籤）
- 或至少與詳細頁一致，不得顯示 Unknown

### 實際行為
- 列表顯示 Unknown 灰標籤
- 統計「28 done / 30 total」代表 parser 有能力算 DONE 總數（可能從其他路徑）
- 但列表渲染時沒把 PLAN-012 對應到 Done 狀態

### 可能假設（未驗證，交給 T0151 Worker 確認）

1. **列表 parser 只讀 `_backlog.md` Active 表**：找不到 PLAN-012（已移到 Completed 區塊）→ fallback Unknown
2. **列表 parser 直接讀 PLAN-*.md 檔案**：但識別 regex 只抓 IDEA / PLANNED / IN_PROGRESS / DROPPED，未覆蓋 DONE
3. **列表 parser 不認識 `✅ DONE` 帶 emoji 前綴的狀態值**：但其他 DONE PLAN 能正確計入統計，代表有地方識別對了
4. **Cache / refresh 問題**：首次載入後沒重讀檔案（使用者可先按刷新鈕排除）
5. **Status enum UI 映射缺 DONE**：TypeScript enum 或 status mapping table 沒 `DONE` 這個 case，UI fallback 顯示 Unknown

### 影響範圍
- 純 UI 顯示不一致（資料正確，功能正常）
- 使用者觀感：狀態不可信任，需額外點進詳細頁確認
- 使用頻率：每次有 PLAN 達到 DONE 狀態時會觸發
- 本 session 為第一次實測，歷史 DONE PLAN（PLAN-008、PLAN-010、PLAN-011）已歸檔到 `_archive/plans/`，可能在歸檔後 parser 就不掃到 → 看不到 Unknown

---

## 使用者測試資訊
- **BAT 版本**：打包版（2026-04-17 剛 rebuild，含 T0149 `cd460d2` + T0150 `31b4ec2`）
- **觸發路徑**：D044 commit `1a7aeed` 將 PLAN-012 狀態從 PLANNED 改為 DONE 並移到 `_backlog.md` Completed 區塊
- **截圖**：`D:\Downloads\2026-04-17_171835.png`
- **統計線索**：左上角「28 done / 30 total」、`💡 7 | 📋 2`、total 30 = 10 熱區 + 20 歸檔
- **資料狀態**：
  - `_ct-workorders/PLAN-012-*.md` → `- **狀態**：✅ DONE`（與歷史歸檔 PLAN-008 格式一致）
  - `_ct-workorders/_backlog.md` → PLAN-012 在 Completed 區塊，不在 Active 表

---

## 塔台行動
1. ✅ 建立 BUG-036（本檔）
2. ✅ 派 T0151 修復工單（使用者選項 [B]，Worker 自行定位 parser）
3. ⏸ Worker 讀 CT panel Backlog UI code → 找 parser → 修 → commit
4. ⏸ 使用者驗收（刷新後 PLAN-012 顯示 Done）
5. ⏸ BUG-036 CLOSED

---

## 相關單據
- PLAN-012（✅ DONE）：本 BUG 的觸發對象
- PLAN-013（💡 IDEA）：列表顯示正常的對照
- PLAN-004 / PLAN-009（📋 PLANNED）：列表顯示正常的對照
- D044（PLAN-012 結案）：本 BUG 的上游事件
- T0151（📋 READY）：本 BUG 修復工單
