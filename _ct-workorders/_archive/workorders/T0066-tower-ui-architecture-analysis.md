# 工單 T0066-tower-ui-architecture-analysis

## 元資料
- **工單編號**：T0066
- **任務名稱**：塔台 UI 現有架構分析 — 為 BUG/PLAN/Decision 頁籤擴充做準備
- **狀態**：DONE
- **建立時間**：2026-04-12 22:32 (UTC+8)
- **開始時間**：2026-04-12 22:35 (UTC+8)
- **完成時間**：2026-04-12 22:39 (UTC+8)

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：中（需掃描多個 component + IPC 通道）
- **降級策略**：若 CW 不足，優先完成「現有架構分析」和「歸檔相容性」，「擴充方案」可簡化

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需要深度閱讀 renderer/main 端原始碼，避免塔台 context 污染

## 任務指令

### 前置條件
需載入的文件清單：
- `_ct-workorders/_local-rules.md`（了解單據類型、索引同步、歸檔結構）
- `_ct-workorders/_workorder-index.md`（了解索引格式）
- `_ct-workorders/_bug-tracker.md`（了解 BUG 索引格式）
- `_ct-workorders/_backlog.md`（了解 PLAN 索引格式）
- `_ct-workorders/_decision-log.md`（了解決策日誌格式）
- `CLAUDE.md`（專案規範，特別是 logging、IPC、React rendering 規則）

### 輸入上下文

BAT (Better Agent Terminal) 是一個 Electron + React 應用程式，側邊欄有「塔台」面板，其中已有工單（T####）的 UI 整合。

目標是在塔台面板中擴充子頁籤，新增 BUG Tracker / Backlog / Decisions 的瀏覽功能。

本工單是**分析工單**（不寫程式碼），產出架構分析報告供後續實作工單使用。

**重要**：專案最近新增了歸檔功能（T0064），已完成的工單/BUG/PLAN 會被 `git mv` 到 `_ct-workorders/_archive/<type>/` 子目錄。現有工單 UI 可能尚未考慮這個路徑變更，需要一併檢查。

### 分析範圍

#### A. 現有工單 UI 架構（核心）

1. **Component 結構**：
   - 找到塔台面板的 React component 入口
   - 追蹤子頁籤的 component 樹（特別是工單列表 component）
   - 記錄 component 檔案路徑、props 介面、state 管理方式

2. **資料流**：
   - 工單資料如何從 .md 檔案進入 UI？
   - IPC 通道名稱和 handler 位置（main process 端）
   - 解析邏輯：如何解析 .md 檔案的元資料（狀態、標題等）？
   - 索引檔（`_workorder-index.md`）是否被使用？還是直接 Glob .md 檔案？
   - 「雙重比對」的具體邏輯是什麼？

3. **可複用 Pattern**：
   - 列表渲染 component 是否泛化？還是工單專用？
   - 狀態 badge/icon 的 mapping 邏輯
   - 檔案讀取/監聽的 utility

#### B. 歸檔相容性檢查（重要）

1. **路徑問題**：
   - 現有 UI 掃描路徑是 `_ct-workorders/T*.md` 還是遞迴掃描？
   - 已歸檔工單（`_archive/workorders/T*.md`）是否會被掃描到？
   - 索引檔中的相對路徑（`_archive/<type>/FILENAME.md`）能否正確解析？

2. **影響評估**：
   - 若 UI 不掃描 `_archive/`，是否只顯示 active 工單？（可能是期望行為）
   - 若 UI 透過索引檔讀取，已修復 BUG 的連結指向 `_archive/bugs/` 是否能正確打開？
   - 需要修改什麼才能支援歸檔工單的顯示/隱藏切換？

3. **建議**：
   - 是否需要修改現有工單 UI 以相容歸檔結構？
   - 修改範圍和風險評估

#### C. 擴充方案建議

1. **新增頁籤方案**：
   - 建議的 component 結構（可複用 vs 新建）
   - 每個頁籤的資料來源和解析策略：
     - BUG Tracker：索引檔 `_bug-tracker.md` + 個別 `BUG-*.md`
     - Backlog：索引檔 `_backlog.md` + 個別 `PLAN-*.md`
     - Decisions：`_decision-log.md`（單檔）
   - 建議的 IPC 通道設計

2. **架構考量**：
   - 只讀第一階段，但架構如何預留未來可操作（改狀態、開新單）
   - 檔案監聽策略（file watcher 範圍、debounce）
   - 效能考量（大量歸檔檔案是否影響掃描速度）

### 預期產出
- 分析報告：寫入工單回報區（不另建檔案）
- 報告結構：按上述 A/B/C 三個區塊組織
- 每個發現附帶具體檔案路徑和行號

### 驗收條件
- [ ] 找到塔台面板 component 入口和完整 component 樹
- [ ] 記錄工單資料流（.md → IPC → renderer）完整路徑
- [ ] 記錄所有相關 IPC 通道名稱和 handler 位置
- [ ] 記錄 .md 解析邏輯（正則/parser/格式）
- [ ] 完成歸檔相容性檢查（路徑掃描、索引連結、影響評估）
- [ ] 提供擴充方案建議（component 結構、IPC 設計、資料來源）
- [ ] 標註可複用的 component 和 utility
- [ ] 每個發現附帶檔案路徑和行號

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 載入前置條件文件（_local-rules.md、各索引檔、CLAUDE.md）
4. **A 部分**：從 sidebar component 入口開始追蹤，找到塔台面板和工單 UI 的完整架構
5. **A 部分**：追蹤 IPC 通道到 main process，記錄解析邏輯
6. **B 部分**：檢查掃描路徑是否包含 `_archive/`，評估歸檔相容性
7. **C 部分**：基於 A/B 的發現，提出擴充方案
8. 將分析結果寫入回報區
9. 更新「狀態」和「完成時間」

### 執行注意事項
- 這是**分析工單**，不要修改任何程式碼
- 重點在於準確記錄現有架構，不要猜測
- 檔案路徑使用相對路徑（相對於專案根目錄）
- 若發現現有 UI 有 bug 或不一致，在回報區「遭遇問題」中記錄

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

分析工單，無程式碼修改。產出：完整架構分析報告（寫入本回報區）。

---

## A. 現有工單 UI 架構分析

### A-1. Component 結構

**外部入口（兩個掛載點）**：
- `src/App.tsx:24` — `LazyControlTowerPanel`（`lazy` import）
- `src/components/WorkspaceView.tsx:24` — 同樣 `lazy` import
- 兩處都在 `case 'control-tower':` 分支渲染，接收相同 props

**主 Component**：`src/components/ControlTowerPanel.tsx`
```
Props: { isVisible, workspaceFolderPath, onExecWorkOrder?, onDoneWorkOrder? }
State: workOrders[], loading, hasCtDir, expandedId, filterStatus, activeTab, sprintStatus
CtTab = 'orders' | 'kanban' | 'sprint'
```

**子 Component 樹**：
```
ControlTowerPanel (src/components/ControlTowerPanel.tsx)
├── CtToast          (src/components/CtToast.tsx)           — toast 通知
├── KanbanView       (src/components/KanbanView.tsx)         — 看板視圖
│   └── 接收 workOrders[] + onExecWorkOrder + onDoneWorkOrder
└── SprintProgress   (src/components/SprintProgress.tsx)     — Sprint 進度
    ├── ProgressBar (local function)
    ├── StoryLanes  (local function)
    └── ValidationSection (local function)
        └── 接收 sprint: SprintStatus + workOrders[]
```

**State 管理**：純 `useState` + `useCallback`，無 Redux/Zustand，所有狀態本地於 `ControlTowerPanel`。

**Type Definitions**：
- `src/types/control-tower.ts` — `WorkOrder`, `WorkOrderStatus`, `parseWorkOrder()`, `isWorkOrderFile()`, `statusColor()`, `statusLabel()`
- `src/types/sprint-status.ts` — `SprintStatus`, `parseSprintStatus()`, `getSprintYamlPaths()`, `crossValidate()`

**CSS**：`src/styles/control-tower.css`（獨立樣式檔，`ct-` prefix）

**i18n**：`src/locales/{en,zh-CN,zh-TW}.json` 下的 `controlTower` key，包含 `tab.orders`, `tab.kanban`, `tab.sprint`

---

### A-2. 資料流（.md → IPC → Renderer）完整路徑

```
_ct-workorders/*.md
      ↓ (electron/main.ts:1643)
  fs:readdir IPC handler
      ↓ Node.js fs.readdir(dirPath, { withFileTypes: true }) ← 非遞迴！
  entries[] → filter: !e.isDirectory
      ↓
  fs:readFile IPC handler (electron/main.ts:1653)
      ↓ Node.js fs.readFile(filePath, 'utf-8') ← 限 512KB
  { content: string }
      ↓
  parseWorkOrder(filename, content) (src/types/control-tower.ts:30)
      ↓ regex: /\*\*欄位\*\*[：:]\s*(.+)/m
  WorkOrder[]
      ↓
  sort by priority map → setWorkOrders()
      ↓
  detectStatusChanges() → CtToast 通知
```

**File Watching 機制**：
- `fs:watch(ctDirPath)` 設置 `fsSync.watch(_dirPath, { recursive: true })` — **遞迴監聽**
- Debounce 500ms → broadcast `fs:changed` event
- Renderer 收到後呼叫 `loadWorkOrders()` + `loadSprintStatus()`
- ⚠️ Watch 是遞迴的（含 `_archive/`），但 reload 只讀頂層目錄

**Preload 橋接** (`electron/preload.ts:303`)：
```
fs.readdir  → ipcRenderer.invoke('fs:readdir',   dirPath)
fs.readFile → ipcRenderer.invoke('fs:readFile',  filePath)
fs.watch    → ipcRenderer.invoke('fs:watch',     dirPath)
fs.unwatch  → ipcRenderer.invoke('fs:unwatch',   dirPath)
fs.onChanged → ipcRenderer.on('fs:changed', handler)
```

---

### A-3. IPC 通道清單

| 通道名稱 | 方向 | Handler 位置 | 用途 |
|---------|------|------------|------|
| `fs:readdir` | Renderer→Main | `electron/main.ts:1643` | 讀取目錄列表（非遞迴） |
| `fs:readFile` | Renderer→Main | `electron/main.ts:1653` | 讀取單檔內容（限 512KB） |
| `fs:watch` | Renderer→Main | `electron/main.ts:1617` | 設置遞迴目錄監聽 |
| `fs:unwatch` | Renderer→Main | `electron/main.ts:1634` | 取消監聽 |
| `fs:changed` | Main→Renderer | (broadcast) | 目錄有變更通知 |

---

### A-4. .md 解析邏輯（`src/types/control-tower.ts`）

**`parseWorkOrder(filename, content)`**（第 30 行起）：
```typescript
// 主要提取方式：Markdown 粗體格式
const regex = new RegExp(`\\*\\*${label}\\*\\*[：:]\\s*(.+)`, 'm')
// 後備：YAML frontmatter
content.match(/^status:\s*(\S+)/im)
```

**提取欄位**：
- `**工單編號**` → `id`（後備：filename regex `/^(T\d+)/`）
- `**任務名稱**` 或 `**標題**` → `title`
- `**狀態**` → `status`（支援括號附加文字，如 `DONE（塔台追認）` → `DONE`）
- `**建立時間**`, `**開始時間**`, `**完成時間**`, `**預估規模**`, `**Context Window 風險**`, `**目標子專案**`

**`isWorkOrderFile(filename)`**（第 72 行）：
```typescript
return filename.endsWith('.md') && !filename.startsWith('_') && /^T\d+/.test(filename)
```
→ 過濾掉 `_workorder-index.md`, `_bug-tracker.md` 等以 `_` 開頭的系統檔

**重要發現**：UI **不使用** `_workorder-index.md`！完全靠 Glob 掃描目錄。

**「雙重比對」**（`src/types/sprint-status.ts:crossValidate()`）：指工單狀態 vs Sprint YAML 狀態的交叉比對，只出現在 Sprint 頁籤，非工單列表的功能。

---

### A-5. 可複用 Pattern

| Pattern | 位置（檔案:行號） | 複用方式 |
|---------|---------------|---------|
| `extractField(label)` regex | `src/types/control-tower.ts:30-34` | 直接複用解析 BUG/PLAN 的 `**欄位**：值` |
| `isWorkOrderFile()` 邏輯 | `src/types/control-tower.ts:70-73` | 新建 `isBugFile()`, `isPlanFile()` 類似函數 |
| `statusColor()` / `statusLabel()` | `src/types/control-tower.ts:82-105` | 新建 BUG/PLAN 版本 |
| `loadWorkOrders` 模式 | `ControlTowerPanel.tsx:74-104` | `useCallback + try/catch + setLoading` 模式 |
| `detectStatusChanges` + toast | `ControlTowerPanel.tsx:57-73` | 可擴充支援 BUG 狀態變更 |
| `fs:watch` recursive | `electron/main.ts:1617-1632` | 現有 watcher 已覆蓋整個 `_ct-workorders/`，直接複用 |

---

## B. 歸檔相容性檢查

### B-1. 路徑掃描分析

**現有掃描範圍**：`ControlTowerPanel.tsx:loadWorkOrders`
```javascript
const entries = await window.electronAPI.fs.readdir(ctDirPath)
// ctDirPath = workspace/_ct-workorders
```

**`fs:readdir` handler** (`electron/main.ts:1646`)：
```javascript
const entries = await fs.readdir(dirPath, { withFileTypes: true })
// 無 recursive: true — 只返回直接子項目
```

**結論**：
- ✅ `_ct-workorders/T*.md` → **會被掃描**（頂層 T 開頭工單）
- ❌ `_ct-workorders/_archive/workorders/T*.md` → **不會被掃描**（在子目錄，readdir 非遞迴）
- ❌ `_ct-workorders/_workorder-index.md` → **不會被掃描**（`_` 開頭被 `isWorkOrderFile` 過濾）

---

### B-2. 影響評估

**工單列表（Orders/Kanban 頁籤）**：
- ✅ 歸檔後的工單自動從 UI 消失（期望行為，active-only 設計）
- ✅ File watcher 雖監聽 `_archive/`，但 reload 後仍只讀頂層，無副作用
- ✅ **現有工單 UI 不需要任何修改**來相容歸檔結構

**索引連結（如 `_bug-tracker.md` 中的 `[詳細](_archive/bugs/BUG-003-xxx.md)` 路徑）**：
- 索引目前不被 UI 讀取，所以無立即影響
- 但**未來若 UI 需要點擊「查看詳細」來打開歸檔檔案**，需要：
  - 解析相對路徑：`_archive/bugs/BUG-*.md` → 拼接 `ctDirPath/_archive/bugs/BUG-*.md`
  - 現有 `viewFile` 按鈕已實作類似邏輯（`ctDirPath/${order.filename}`），可複用

**Sprint YAML 交叉比對**：
- 工單歸檔後不在 `workOrders[]` 中，Sprint YAML 中仍引用 T#### 的條目會顯示為「狀態不符」
- 建議：Sprint YAML 交叉比對只檢查 `status !== 'DONE'` 的 story

---

### B-3. 建議

1. **現有工單 UI**：**不需要修改**，架構已天然相容歸檔設計
2. **新增頁籤（BUG/PLAN/Decisions）**：採用「索引檔優先」策略（見 C 部分），只讀索引的摘要表格，不掃描個別歸檔檔案，性能無虞
3. **未來「顯示已歸檔」功能**：需新增 `readdir(ctDirPath + '/_archive/workorders')` 呼叫，並在 UI 增加「顯示已歸檔」開關

---

## C. 擴充方案建議

### C-1. 新增頁籤設計

**頁籤類型擴充**：
```typescript
// ControlTowerPanel.tsx
type CtTab = 'orders' | 'kanban' | 'sprint' | 'bugs' | 'backlog' | 'decisions'
```

**i18n 新增**（`src/locales/*.json`）：
```json
"tab": {
  "bugs": "Bugs",
  "backlog": "Backlog",
  "decisions": "Decisions"
}
```

---

### C-2. 資料來源與解析策略

**「索引優先」策略**（建議）：從索引 .md 檔案解析表格摘要，點擊條目時再 `readFile` 個別檔案

| 頁籤 | 索引檔 | 個別檔案前綴 | 歸檔路徑 |
|------|-------|------------|---------|
| Bugs | `_bug-tracker.md` | `BUG-###-*.md` | `_archive/bugs/BUG-*.md` |
| Backlog | `_backlog.md` | `PLAN-###-*.md` | `_archive/plans/PLAN-*.md` |
| Decisions | `_decision-log.md` | — (單檔) | — |

**Markdown 表格解析** — 需新建 `src/utils/md-table-parser.ts`：
```typescript
// 解析形如：| BUG-001 | 標題 | 🔴 High | 🧪 VERIFY | 2026-04-12 | [詳細](BUG-001-xxx.md) |
function parseMdTable(content: string): Record<string, string>[]
```

**BUG 索引解析規則**（從 `_bug-tracker.md` 表格）：
- 每節標題（`## 🔴 Open`、`## 🧪 驗收中`、`## ✅ 已修復`、`## 🚫 已關閉`）決定狀態分組
- 表格欄位：`ID | 標題 | 嚴重度 | 狀態 | 時間 | 連結`

**PLAN 索引解析規則**（從 `_backlog.md` 表格）：
- 表格欄位：`ID | 標題 | 優先級 | 狀態 | 時間 | 連結`

**Decisions 解析規則**（從 `_decision-log.md`）：
- 「決策索引」表格：`ID | 日期 | 標題 | 相關工單`
- 展開時讀取「決策紀錄」區塊的詳細內容

---

### C-3. 新 Type 設計

```typescript
// src/types/bug-tracker.ts  (新建)
export type BugSeverity = 'High' | 'Medium' | 'Low'
export type BugStatus =
  | 'REPORTED' | 'INVESTIGATING' | 'FIXING' | 'VERIFY'
  | 'FIXED' | 'CLOSED' | 'WONTFIX'

export interface BugEntry {
  id: string            // 'BUG-001'
  filename: string      // 'BUG-001-claude-oauth-paste-truncated.md'
  title: string
  severity: BugSeverity
  status: BugStatus
  reportedAt: string
  relatedWorkOrder?: string
  isArchived: boolean   // 連結路徑含 _archive/ 時為 true
  linkPath: string      // 用於 readFile 的完整相對路徑
}

// src/types/backlog.ts  (新建)
export type PlanPriority = 'High' | 'Medium' | 'Low'
export type PlanStatus = 'IDEA' | 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'DROPPED'

export interface BacklogEntry {
  id: string            // 'PLAN-001'
  filename: string
  title: string
  priority: PlanPriority
  status: PlanStatus
  createdAt: string
  isArchived: boolean
  linkPath: string
}

// src/types/decision-log.ts  (新建)
export interface DecisionEntry {
  id: string         // 'D029'
  date: string       // '2026-04-12'
  title: string
  relatedWorkOrder?: string
  // 詳細內容：點擊時按需 readFile 載入
}
```

---

### C-4. IPC 設計

**現有 IPC 通道完全足夠，無需新增**：

| 操作 | 使用的 IPC | 說明 |
|------|-----------|------|
| 讀取索引檔 | `fs:readFile` | 直接讀 `_bug-tracker.md` 等 |
| 讀取個別 BUG/PLAN 詳細 | `fs:readFile` | 按需讀取（lazy load） |
| 監聽索引變更 | `fs:watch` + `fs:changed` | 已覆蓋，watch 是 recursive 的 |
| 顯示已歸檔項目（未來） | `fs:readdir` on archive dir | 新增一個 readdir 呼叫 |

**觸發 reload 條件**：現有 `fs:watch(ctDirPath)` 已設置遞迴監聽，`_bug-tracker.md`、`_backlog.md`、`_decision-log.md` 的任何修改都會觸發 `fs:changed` → reload。

---

### C-5. Component 結構（推薦）

```
ControlTowerPanel.tsx  (修改：新增 state + tab)
├── 新 state: bugEntries[], backlogEntries[], decisions[]
├── 新 loaders: loadBugs(), loadBacklog(), loadDecisions()
│   └── 呼叫 fs:readFile + parseMdTable
├── BugTrackerView.tsx    (新建 src/components/BugTrackerView.tsx)
│   ├── 列表渲染（類比 Orders 頁籤）
│   ├── 按狀態/嚴重度過濾
│   └── 展開時 readFile 顯示個別 BUG 詳細
├── BacklogView.tsx       (新建 src/components/BacklogView.tsx)
│   ├── 列表渲染
│   ├── 按狀態/優先級過濾
│   └── 展開時 readFile 顯示個別 PLAN 詳細
└── DecisionsView.tsx     (新建 src/components/DecisionsView.tsx)
    ├── 表格列表（ID, 日期, 標題, 相關工單）
    └── 展開時顯示決策詳情（從 _decision-log.md 解析）

src/utils/md-table-parser.ts   (新建：共用 Markdown 表格解析)
src/types/bug-tracker.ts       (新建)
src/types/backlog.ts           (新建)
src/types/decision-log.ts      (新建)
```

---

### C-6. 架構考量

| 考量點 | 設計決策 |
|--------|---------|
| 只讀第一階段 | 不需要新增 `fs:writeFile` IPC，全部用 `fs:readFile` |
| 預留可操作性 | BugEntry/BacklogEntry 保留 `id`, `filename`, `linkPath`，未來可直接新增「改狀態」功能 |
| 文件監聽範圍 | 現有 `fs:watch(ctDirPath)` 已覆蓋，無需新增 watcher |
| 大量歸檔性能 | 索引優先策略不掃描個別 archive 檔案，性能影響極小 |
| Decisions 單檔設計 | `_decision-log.md` 是單一大檔，展開顯示時直接從已快取的 content 中提取對應決策區塊，無需二次 readFile |

---

### 互動紀錄
無

### 遭遇問題
無。現有架構清晰，歸檔設計已天然相容。

**唯一需要注意的邊緣案例**：Sprint 頁籤的 Cross Validation 在工單歸檔後可能顯示誤報（已歸檔工單不在 `workOrders[]` 但 YAML 仍引用），建議未來在 `crossValidate()` 邏輯中對 DONE story 不報警。

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-12 22:39 (UTC+8)
