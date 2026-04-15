# 工單 T0067-bug-tracker-view-and-foundation

## 元資料
- **工單編號**：T0067
- **任務名稱**：塔台 UI 基礎層 + BugTrackerView 頁籤
- **狀態**：DONE
- **建立時間**：2026-04-12 22:45 (UTC+8)
- **開始時間**：2026-04-12 22:49 (UTC+8)
- **完成時間**：2026-04-12 22:59 (UTC+8)

## 工作量預估
- **預估規模**：大
- **Context Window 風險**：中（多個新建檔案 + 一個現有檔案修改）
- **降級策略**：若 CW 不足，可先完成 types + parser + 基本列表渲染，過濾和展開功能交後續

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需要讀取 T0066 分析報告 + 多個現有檔案 + 新建多個檔案

## 任務指令

### 前置條件
需載入的文件清單：
- `_ct-workorders/T0066-tower-ui-architecture-analysis.md`（**必讀**，架構分析報告，特別是 C 部分的擴充方案）
- `_ct-workorders/_local-rules.md`（了解單據類型和狀態流定義）
- `_ct-workorders/_bug-tracker.md`（了解索引檔格式，作為解析測試資料）
- `CLAUDE.md`（專案規範）
- `src/types/control-tower.ts`（了解現有 type pattern）
- `src/components/ControlTowerPanel.tsx`（修改目標）
- `src/styles/control-tower.css`（樣式擴充）
- `src/locales/en.json`、`src/locales/zh-TW.json`、`src/locales/zh-CN.json`（i18n 擴充）

### 輸入上下文

BAT 塔台面板目前有 3 個頁籤（orders/kanban/sprint），本工單新增第 4 個頁籤 **Bugs**，並建立後續頁籤可複用的基礎設施。

T0066 分析報告已完整記錄現有架構和建議方案，請以該報告 C 部分為實作藍圖。

**關鍵設計決策**：
- **索引優先策略**：從 `_bug-tracker.md` 解析 Markdown 表格取得列表資料，點擊展開時才 `readFile` 個別 BUG 檔案
- **無需新增 IPC**：複用現有 `fs:readFile` + `fs:watch`/`fs:changed`
- **只讀第一階段**：不需要寫入功能，但 type 設計預留 `id`/`filename`/`linkPath` 供未來擴充
- **歸檔感知**：索引檔中的連結可能指向 `_archive/bugs/BUG-*.md`，`isArchived` 欄位由連結路徑判斷

### 預期產出

#### 新建檔案
1. **`src/utils/md-table-parser.ts`** — 共用 Markdown 表格解析器
   - `parseMdTable(content: string): Record<string, string>[]`
   - 解析 `| col1 | col2 | ... |` 格式的表格行
   - 跳過標題分隔線（`|---|---|`）
   - 處理表格前的 section 標題（如 `## 🔴 Open`）

2. **`src/types/bug-tracker.ts`** — BUG 單 type 定義
   - `BugSeverity`, `BugStatus`, `BugEntry` interface
   - `parseBugTracker(content: string): BugEntry[]` 解析函數
   - `bugStatusColor()`, `bugStatusLabel()`, `bugSeverityColor()` 工具函數

3. **`src/types/backlog.ts`** — PLAN 單 type 定義（本工單先建 type，T0068 建 component）
   - `PlanPriority`, `PlanStatus`, `BacklogEntry` interface
   - `parseBacklog(content: string): BacklogEntry[]` 解析函數
   - `planStatusColor()`, `planStatusLabel()` 工具函數

4. **`src/types/decision-log.ts`** — 決策日誌 type 定義（本工單先建 type，T0068 建 component）
   - `DecisionEntry` interface
   - `parseDecisionLog(content: string): DecisionEntry[]` 解析函數

5. **`src/components/BugTrackerView.tsx`** — BUG 頁籤 component
   - Props: `{ bugs: BugEntry[], loading: boolean, onViewDetail?: (bug: BugEntry) => void }`
   - 功能：
     - 列表渲染（ID、標題、嚴重度 badge、狀態 badge）
     - 按狀態過濾（全部 / Open / Verify / Fixed / Closed）
     - 按嚴重度過濾（全部 / High / Medium / Low）
     - 展開/收合詳細（點擊時 readFile 個別 BUG 檔案內容）
     - 統計摘要（Open: N / Verify: N / Fixed: N / Closed: N）
   - 參考 T0066 報告 C-5 的 component 結構

#### 修改檔案
6. **`src/components/ControlTowerPanel.tsx`**
   - `CtTab` 類型加入 `'bugs'`
   - 新增 `bugEntries: BugEntry[]` state
   - 新增 `loadBugs()` callback（readFile `_bug-tracker.md` → `parseBugTracker`）
   - 在 `fs:changed` handler 中觸發 `loadBugs()`
   - Tab bar 新增 Bugs 頁籤
   - 條件渲染 `<BugTrackerView>`

7. **`src/styles/control-tower.css`** — 新增 BUG 相關樣式
   - `.ct-bug-severity-high/medium/low` badge 樣式
   - `.ct-bug-status-*` 狀態顏色
   - `.ct-bug-list`, `.ct-bug-item`, `.ct-bug-detail` 結構樣式
   - `.ct-filter-bar` 過濾器樣式（若尚無通用版本）

8. **`src/locales/en.json`** — `controlTower.tab.bugs` + bug 相關文字
9. **`src/locales/zh-TW.json`** — 同上（繁體中文）
10. **`src/locales/zh-CN.json`** — 同上（簡體中文）

### 驗收條件
- [ ] `md-table-parser.ts` 能正確解析 `_bug-tracker.md` 的多段表格
- [ ] `parseBugTracker()` 正確區分 Open / Verify / Fixed / Closed 四個狀態分組
- [ ] `BugEntry.isArchived` 正確判斷（連結路徑含 `_archive/`）
- [ ] BugTrackerView 列表正確顯示所有 BUG 條目（15 張）
- [ ] 狀態過濾和嚴重度過濾正常運作
- [ ] 展開 BUG 條目能正確讀取並顯示個別 .md 檔案內容
- [ ] 歸檔 BUG（`_archive/bugs/` 路徑）能正確讀取
- [ ] 統計摘要數字與 `_bug-tracker.md` 一致
- [ ] Tab 切換正常，不影響其他頁籤功能
- [ ] i18n 三語系完整
- [ ] `npx vite build` 編譯成功
- [ ] backlog.ts 和 decision-log.ts type 定義完整（供 T0068 使用）

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. **必讀** T0066 分析報告（特別是 A-4 解析邏輯、C-2 資料來源策略、C-3 Type 設計、C-5 Component 結構）
4. 載入前置條件中的現有檔案
5. 新建 `src/utils/md-table-parser.ts`
6. 新建 `src/types/bug-tracker.ts`、`src/types/backlog.ts`、`src/types/decision-log.ts`
7. 新建 `src/components/BugTrackerView.tsx`
8. 修改 `src/components/ControlTowerPanel.tsx`（新增 bugs tab + state + loader）
9. 修改 `src/styles/control-tower.css`
10. 修改 i18n 三語系檔案
11. 執行 `npx vite build` 確認編譯成功
12. 填寫回報區，更新狀態和完成時間

### 執行注意事項
- 遵循 CLAUDE.md 的 No Regressions Policy — 確認現有 3 個頁籤不受影響
- 遵循現有 component 的 coding style（useState pattern、useCallback、命名慣例）
- CSS 使用 `ct-` prefix 和現有樣式檔
- 不使用 `console.log`（使用 `window.electronAPI.debug.log`）
- Type 定義參考現有 `src/types/control-tower.ts` 的 pattern
- md-table-parser 要處理 emoji（如 🔴、🧪、✅）在表格欄位中的情況

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**新建檔案（5 個）**：
- `src/utils/md-table-parser.ts` — 通用 Markdown 表格解析器（`parseMdTable`）
- `src/types/bug-tracker.ts` — BugSeverity/BugStatus/BugEntry types + parseBugTracker() + bugSeverityColor/bugStatusColor/bugStatusLabel()
- `src/types/backlog.ts` — PlanPriority/PlanStatus/BacklogEntry types + parseBacklog() + planStatusColor/planStatusLabel()
- `src/types/decision-log.ts` — DecisionEntry type + parseDecisionLog()
- `src/components/BugTrackerView.tsx` — Bugs 頁籤 component（列表/過濾/展開/懶載入）

**修改檔案（5 個）**：
- `src/components/ControlTowerPanel.tsx` — 新增 `'bugs'` tab、`bugEntries` state、`loadBugs` callback、Bugs tab UI + BugTrackerView 渲染
- `src/styles/control-tower.css` — 新增 BUG 相關樣式（severity badge、status badge、list/item/detail layout）
- `src/locales/en.json` — 新增 `tab.bugs` + `bugs.*` 翻譯鍵
- `src/locales/zh-TW.json` — 同上（繁體中文）
- `src/locales/zh-CN.json` — 同上（簡體中文）

**關鍵設計決策**：
- 索引優先策略：parseBugTracker 解析 _bug-tracker.md 表格，展開時才 readFile 個別 BUG 檔案
- 無需新增 IPC：完全複用現有 fs:readFile + fs:watch/fs:changed
- `parseMdTable` 採用 stateful line parsing，正確處理 emoji、多表格、section 邊界
- Bugs tab 僅在 `bugEntries.length > 0` 時顯示（與 Sprint tab 同一慣例）

**Build 結果**：`npx vite build` 編譯成功，無 TypeScript 錯誤

### 互動紀錄
無

### 遭遇問題
無。T0066 架構分析報告非常完整，直接作為實作藍圖使用。

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-12 22:59 (UTC+8)
