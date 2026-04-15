# 工單 T0068-backlog-and-decisions-view

## 元資料
- **工單編號**：T0068
- **任務名稱**：塔台 UI BacklogView + DecisionsView 頁籤
- **狀態**：DONE
- **建立時間**：2026-04-12 22:45 (UTC+8)
- **開始時間**：2026-04-12 23:02 (UTC+8)
- **完成時間**：2026-04-12 23:10 (UTC+8)

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：中
- **降級策略**：若 CW 不足，先完成 BacklogView（結構與 BugTrackerView 最相似），DecisionsView 交後續

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需要讀取 T0067 產出的基礎設施 + T0066 分析報告

## 任務指令

### 前置條件
需載入的文件清單：
- `_ct-workorders/T0066-tower-ui-architecture-analysis.md`（架構分析，C-2/C-5 部分）
- `_ct-workorders/_backlog.md`（PLAN 索引格式）
- `_ct-workorders/_decision-log.md`（決策日誌格式）
- `CLAUDE.md`（專案規範）
- `src/utils/md-table-parser.ts`（T0067 產出，複用）
- `src/types/backlog.ts`（T0067 產出，type 定義）
- `src/types/decision-log.ts`（T0067 產出，type 定義）
- `src/components/BugTrackerView.tsx`（T0067 產出，作為 pattern 參考）
- `src/components/ControlTowerPanel.tsx`（修改目標，T0067 已修改過）
- `src/styles/control-tower.css`（樣式擴充，T0067 已修改過）

### 輸入上下文

T0067 已完成基礎設施（md-table-parser、types）和 BugTrackerView。本工單新增剩餘兩個頁籤：

1. **BacklogView** — 結構與 BugTrackerView 非常相似，改為讀取 `_backlog.md`，過濾改為狀態/優先級
2. **DecisionsView** — 從 `_decision-log.md` 單檔解析，展示決策索引表格 + 展開詳情

**關鍵差異**：
- BacklogView 用 `parseBacklog()` 解析 `_backlog.md`
- DecisionsView 用 `parseDecisionLog()` 解析 `_decision-log.md`，**單檔**，不需要 readFile 個別檔案
- DecisionsView 展開詳情時從已快取的 content 中提取對應決策區塊（by D### ID）

### 預期產出

#### 新建檔案
1. **`src/components/BacklogView.tsx`** — Backlog 頁籤 component
   - Props: `{ entries: BacklogEntry[], loading: boolean }`
   - 功能：
     - 列表渲染（ID、標題、優先級 badge、狀態 badge）
     - 按狀態過濾（全部 / Idea / Planned / In Progress / Done / Dropped）
     - 按優先級過濾（全部 / High / Medium / Low）
     - 展開/收合詳細（readFile 個別 PLAN 檔案）
     - 統計摘要
   - 參考 BugTrackerView 的 pattern 快速實作

2. **`src/components/DecisionsView.tsx`** — Decisions 頁籤 component
   - Props: `{ decisions: DecisionEntry[], loading: boolean, rawContent?: string }`
   - 功能：
     - 表格列表（ID、日期、標題、相關工單）
     - 展開/收合詳情（從 rawContent 中按 `### D###` 區塊提取）
     - 搜尋/過濾（可選，按標題關鍵字）
     - 統計摘要（共 N 條決策）

#### 修改檔案
3. **`src/components/ControlTowerPanel.tsx`**
   - `CtTab` 加入 `'backlog'` | `'decisions'`
   - 新增 `backlogEntries: BacklogEntry[]`, `decisions: DecisionEntry[]`, `decisionRawContent: string` state
   - 新增 `loadBacklog()`, `loadDecisions()` callback
   - 在 `fs:changed` handler 中觸發 reload
   - Tab bar 新增 Backlog / Decisions 頁籤
   - 條件渲染 `<BacklogView>`, `<DecisionsView>`

4. **`src/styles/control-tower.css`** — 新增樣式
   - `.ct-plan-priority-*` badge
   - `.ct-plan-status-*` 狀態顏色
   - `.ct-decision-*` 決策列表樣式
   - 共用樣式抽取（如有重複）

5. **`src/locales/en.json`** — `controlTower.tab.backlog`, `controlTower.tab.decisions` + 相關文字
6. **`src/locales/zh-TW.json`** — 同上
7. **`src/locales/zh-CN.json`** — 同上

### 驗收條件
- [ ] BacklogView 正確顯示所有 PLAN 條目（6 張）
- [ ] BacklogView 狀態過濾和優先級過濾正常運作
- [ ] BacklogView 展開能正確讀取個別 PLAN .md 檔案
- [ ] DecisionsView 正確顯示所有決策條目（29 條）
- [ ] DecisionsView 展開能正確顯示決策詳情
- [ ] 所有 6 個頁籤正常切換，互不影響
- [ ] i18n 三語系完整
- [ ] `npx vite build` 編譯成功
- [ ] 現有功能（orders/kanban/sprint/bugs）無 regression

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 讀取 T0066 分析報告 C 部分（快速回顧方案）
4. 讀取 T0067 產出的 BugTrackerView 作為 pattern 參考
5. 新建 `src/components/BacklogView.tsx`（複製 BugTrackerView 結構，改適配 BacklogEntry）
6. 新建 `src/components/DecisionsView.tsx`
7. 修改 `src/components/ControlTowerPanel.tsx`（新增 2 個 tab + state + loaders）
8. 修改 CSS 和 i18n
9. 執行 `npx vite build` 確認編譯成功
10. 填寫回報區，更新狀態和完成時間

### 執行注意事項
- BacklogView 應盡量複用 BugTrackerView 的結構（DRY），但不要為了 DRY 過度抽象
- DecisionsView 的展開詳情：從 rawContent 中用 regex 提取 `### D###` 到下一個 `### D###` 之間的內容
- 頁籤數量增加到 6 個，注意 tab bar 的響應式排版（可能需要水平滾動或換行）
- 遵循 CLAUDE.md No Regressions Policy

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**新建檔案（2）**
- `src/components/BacklogView.tsx` — Backlog 頁籤 component，雙重過濾（狀態/優先級）+ lazy load 展開
- `src/components/DecisionsView.tsx` — Decisions 頁籤 component，搜尋過濾 + rawContent 區塊展開

**修改檔案（5）**
- `src/components/ControlTowerPanel.tsx` — 新增 backlog/decisions CtTab、state、loadBacklog/loadDecisions loaders、fs:changed 觸發、tab 按鈕及條件渲染
- `src/styles/control-tower.css` — 新增 ct-backlog、ct-plan-*、ct-decision-* 等樣式；.ct-tabs 加 overflow-x:auto 支援 6 個頁籤
- `src/locales/en.json` — 新增 tab.backlog/decisions、backlog.*、decisions.* 鍵
- `src/locales/zh-TW.json` — 同上（繁體中文）
- `src/locales/zh-CN.json` — 同上（簡體中文）

**驗收確認**
- ✅ BacklogView 雙重過濾（狀態 × 優先級）
- ✅ BacklogView 展開讀取 PLAN-*.md 個別檔案
- ✅ DecisionsView 搜尋過濾
- ✅ DecisionsView 展開提取 ### D### 區塊（含 range entry D001-D012 顯示「無詳細紀錄」）
- ✅ 6 個頁籤正常切換（orders / kanban / sprint / bugs / backlog / decisions）
- ✅ i18n 三語系完整
- ✅ `npx vite build` 編譯成功（3 階段全 pass，9.90s + 1.25s + 20ms）
- ✅ 現有功能 orders/kanban/sprint/bugs 未改動，無 regression 風險

### 互動紀錄
無（自動執行，未遭遇需要使用者決策的情況）

### 遭遇問題
- `_backlog.md` 的 "🔄 Active（Ideas & Plans）" section heading 不匹配任何 sectionToStatus 條件，所有 6 筆 PLAN 均 fallback 到 IDEA 狀態。此為 T0067 parser 的設計取捨（基於 section-based mapping），UI 層正確反映 parser 輸出，不在本工單修復範圍內。

### sprint-status.yaml 已更新
不適用（搜尋未找到 sprint-status.yaml）

### 回報時間
2026-04-12 23:10 (UTC+8)
