# 工單 T0054-sidebar-tower-icon-differentiation

## 元資料
- **工單編號**：T0054
- **任務名稱**：側邊欄塔台圖示與 Agents 區分
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-12 17:54 (UTC+8)
- **開始時間**：2026-04-12 17:56 (UTC+8)
- **完成時間**：（完成時填入）

## 工作量預估
- **預估規模**：極小（換一個 icon）
- **Context Window 風險**：極低

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：極簡操作

## 任務指令

### Bug 描述

側邊欄的 [Agents] 和 [塔台] 都使用機器人圖示（🤖 或類似），視覺上無法區分。需要把塔台的圖示換掉。

### 前置條件
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）

### 修復方向

1. 找到側邊欄的圖示定義（搜尋 `sidebar`、`tower`、`塔台`、`agent` icon 相關）
2. 確認目前 icon 使用的方式（SVG? emoji? icon library?）
3. 把塔台的圖示換成以下其中一個（依可用 icon 庫選擇最合適的）：
   - **燈塔**（lighthouse）🗼 — 首選，與「指揮塔」語意最符
   - **指揮棒**（conductor baton）🎵 — 備選
   - **望遠鏡**（telescope）🔭 — 備選
   - **皇冠**（crown）👑 — 備選
4. 若使用 icon library（如 lucide-react），搜尋 `Lighthouse`、`Tower`、`Castle` 等名稱
5. 若使用 emoji/unicode，直接替換字元

### Commit 規範
```
fix(ui): differentiate sidebar tower icon from agents icon
```

### 驗收條件
- [ ] 側邊欄 [Agents] 和 [塔台] 使用不同圖示
- [ ] 新圖示語意清楚（一看就知道是「塔台/指揮」而非「agent」）
- [ ] `npx vite build` 通過

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
（DONE / FAILED / BLOCKED / PARTIAL）

### 產出摘要
（修改檔案、最終選用的圖示、commit hash）

### 遭遇問題
（若有）

### 回報時間
（填入當前時間）
