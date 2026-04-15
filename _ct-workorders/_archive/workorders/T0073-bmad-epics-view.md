# 工單 T0073-bmad-epics-view

## 元資料
- **工單編號**：T0073
- **任務名稱**：BMad Epic/Story 看板（Kanban → Epics 頁籤改造）
- **狀態**：DONE
- **建立時間**：2026-04-13 00:55 (UTC+8)
- **開始時間**：2026-04-13 00:57 (UTC+8)
- **完成時間**：2026-04-13 01:04 (UTC+8)

## 工作量預估
- **預估規模**：大
- **Context Window 風險**：中
- **降級策略**：若 CW 不足，先完成 Epic 列表（不展開 Story），Story 詳情交後續

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需讀取多個參考檔案 + 新建多個 component

## 任務指令

### 前置條件
需載入的文件清單：
- `_ct-workorders/T0070-bmad-integration-analysis.md`（D-1 Epic/Story 資料模型）
- `CLAUDE.md`（專案規範）
- `src/components/ControlTowerPanel.tsx`（修改目標）
- `src/components/KanbanView.tsx`（了解現有看板 — 保留不動）
- `src/types/bmad-workflow.ts`（T0072 產出，了解 buildBmadWorkflow 邏輯）
- `src/styles/control-tower.css`（樣式擴充）

### 參考資料（真實 BMad 產出物）
- **Epic 格式參考**：`D:\ForgejoGit\2026_Cooperative\_bmad-output\` 下的 epic 相關檔案
- 先掃描目錄找到 epic 檔案，讀取 1-2 個了解實際格式
- Story 格式參考：同目錄下的 story 相關檔案
- **注意**：僅供讀取參考，不要修改該專案的任何檔案

### 輸入上下文

將塔台的 Kanban 頁籤改造為 **Epics** 頁籤，顯示 BMad-Method 的 Epic/Story 需求追蹤。

**核心設計**（來自 T0070 分析報告 D-1）：
- 掃描 `_bmad-output/planning-artifacts/` 下的 Epic 檔案（epics.md 或 epics/ 目錄）
- 顯示 Epic 列表，展開可看 Stories
- Story 可追蹤到關聯的工單 T####（可選，有的工單獨立存在）
- 只讀（Phase 1），預留未來可寫入的欄位

**空狀態**：若無 Epic 檔案，Epics 頁籤顯示引導提示。

**向後相容**：KanbanView 完整保留不動；無 Epic 資料時，Kanban 頁籤仍可渲染工單看板（備用）。頁籤 UI label 改為 Epics。

**Story → 工單關聯建立方式**（優先順序）：
1. `sprint-status.yaml` 中 story 的 `work_order` 或 `work_order_id` 欄位
2. Story 文件內的「相關工單」欄位
3. 無關聯時不顯示（不強求）

### 預期產出

#### 新建檔案
1. **`src/types/bmad-epic.ts`** — Epic/Story 資料模型
   - `StoryStatus`, `EpicStatus`, `BmadStory`, `BmadEpic` interfaces（參考 T0070 D-1）
   - `parseEpicFile(content: string): BmadEpic` — 解析 epic .md 檔案（格式從參考專案校準）
   - `parseStoriesSection(content: string): BmadStory[]` — 解析 story 列表
   - `epicStatusColor()`, `epicStatusLabel()`, `storyStatusColor()`, `storyStatusLabel()` 工具函數

2. **`src/components/BmadEpicsView.tsx`** — Epics 頁籤 component
   - Props: `{ epics: BmadEpic[], loading: boolean, ctDirPath: string }`
   - 功能：
     - Epic 卡片列表（ID、Title、狀態 badge、Story 完成進度 bar）
     - 展開 Epic 看 Story 列表（ID、Title、狀態 badge、T#### 連結 badge）
     - Story 的 T#### badge 點擊可切換到 Orders 頁籤篩選（或 tooltip 顯示工單標題）
     - 統計摘要（N Epics / N Stories / N DONE）
     - 空狀態引導提示

#### 修改檔案
3. **`src/components/ControlTowerPanel.tsx`**
   - `CtTab`：`'kanban'` 保留（internal key），UI label 改為 `Epics`
   - 新增 `bmadEpics: BmadEpic[]` state
   - 新增 `loadEpics()` callback：
     - 嘗試讀取 `_bmad-output/planning-artifacts/epics.md`（單檔）
     - 或掃描 `_bmad-output/planning-artifacts/epics/` 目錄（多檔）
     - 視參考專案的實際結構決定
   - `fs:changed` handler 觸發 `loadEpics()`
   - Kanban tab 條件渲染：
     - 有 Epic 資料 → 渲染 `<BmadEpicsView>`
     - 無 Epic 資料 → 渲染 `<KanbanView>`（原有工單看板，向後相容）
   - Tab label：i18n key `tab.kanban` → `tab.epics`

4. **`src/styles/control-tower.css`** — 新增 Epic/Story 樣式
   - `.ct-epic-*` Epic 卡片和狀態樣式
   - `.ct-story-*` Story 列表項樣式
   - `.ct-story-wo-badge` 工單關聯 badge
   - `.ct-epic-progress-bar` Story 完成進度條

5. **`src/locales/en.json`** — `tab.kanban` → `tab.epics` + epics.* 翻譯鍵
6. **`src/locales/zh-TW.json`** — 同上
7. **`src/locales/zh-CN.json`** — 同上

### 驗收條件
- [ ] Kanban 頁籤 UI label 改為 Epics
- [ ] 有 Epic 資料時顯示 `BmadEpicsView`
- [ ] Epic 列表正確解析（從參考專案驗證格式）
- [ ] 展開 Epic 可看 Story 列表
- [ ] Story 的 T#### 關聯正確顯示（若有）
- [ ] 無 Epic 資料時顯示 KanbanView（向後相容）
- [ ] 空狀態（無任何 Epic）有引導提示
- [ ] 統計摘要正確
- [ ] KanbanView 原有功能保留完整
- [ ] `npx vite build` 編譯成功
- [ ] i18n 三語系完整
- [ ] 現有功能無 regression

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. **先掃描參考專案**：找到 epic 相關檔案，讀取 1-2 個了解格式（`D:\ForgejoGit\2026_Cooperative\_bmad-output\`）
4. 讀取 T0070 D-1 資料模型設計
5. 新建 `src/types/bmad-epic.ts`（格式從真實檔案校準）
6. 新建 `src/components/BmadEpicsView.tsx`
7. 修改 `src/components/ControlTowerPanel.tsx`
8. 更新 CSS 和 i18n
9. `npx vite build` 確認編譯成功
10. 填寫回報區

### 執行注意事項
- Epic 的實際格式以**參考專案的真實檔案**為準，不要猜測
- epics 可能是單檔（`epics.md`）或目錄（`epics/epic-001.md`）— 以實際情況決定
- Story → T#### 關聯若查無資料，UI 不強求顯示，靜默跳過
- Kanban 頁籤改名為 Epics，但 KanbanView component 完整保留（向後相容性）
- 遵循 CLAUDE.md No Regressions Policy

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
**新建檔案：**
- `src/types/bmad-epic.ts` — Epic/Story 資料模型 + `parseEpicsFile()` parser + `buildSprintStoryMap()` 工具
- `src/components/BmadEpicsView.tsx` — Epics 頁籤 component（Epic 卡片列表 + Story 展開 + 進度條 + 空狀態）

**修改檔案：**
- `src/components/ControlTowerPanel.tsx` — 新增 bmadEpics state + loadEpics() callback + Kanban tab label 改為 Epics + 條件渲染（有 Epic → BmadEpicsView / 無 Epic → KanbanView）
- `src/styles/control-tower.css` — 新增 .ct-epic-* / .ct-story-* / .ct-epics-* 完整樣式
- `src/locales/en.json` — 新增 tab.epics + epics.* 翻譯鍵
- `src/locales/zh-TW.json` — 同上（繁體中文）
- `src/locales/zh-CN.json` — 同上（簡體中文）

**關鍵設計決策：**
- Epic 資料來源：解析 `_bmad-output/planning-artifacts/epics.md` 單檔（與參考專案 2026_Cooperative 格式校準）
- Story 狀態：預設 TODO，若有 sprint-status.yaml 則交叉比對取得實際狀態和 T#### 關聯
- Kanban tab 改名 Epics（internal key 保留 'kanban'），KanbanView component 完整保留（向後相容）

### 互動紀錄
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-13 01:04 (UTC+8)
