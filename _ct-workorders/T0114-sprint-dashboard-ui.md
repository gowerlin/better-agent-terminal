# T0114 — PLAN-009：Sprint 儀表板頁籤

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0114 |
| **標題** | CT 面板新增 Sprint 頁籤：總覽摘要儀表板 |
| **類型** | 功能開發 |
| **狀態** | ✅ DONE |
| **開始時間** | 2026-04-13 22:56 UTC+8 |
| **優先級** | 中 |
| **建立時間** | 2026-04-13 22:50 UTC+8 |
| **相關** | PLAN-009 / T0098（sprint-status.yaml） |

---

## 背景

CT 面板目前有 Orders / Bugs / Backlog / Decisions / Workflow / Epics 頁籤，各自顯示細節。
缺少一個「一眼看全局」的總覽頁面。

PLAN-009 決定新增 Sprint 頁籤，讀取 `sprint-status.yaml` 顯示摘要儀表板。

**定位**：駕駛艙儀表板——不重複其他頁籤的細節，只提供全局概覽。

---

## 設計

### 頁籤位置

新增「Sprint」頁籤，與 Orders / Bugs / Backlog / Decisions / Workflow / Epics 並列。
建議放在**第一個位置**（最左側），因為它是總覽入口。

### 資料來源

**唯一來源**：`sprint-status.yaml`（已有 `parseSprintStatus()` parser）

不額外掃描工單/BUG/PLAN 源文件——那些資訊已在 sprint-status.yaml 的摘要中。

### UI 佈局

```
┌─────────────────────────────────────────────────┐
│  Sprint Dashboard                               │
├─────────────────────────────────────────────────┤
│                                                 │
│  📊 里程碑                                       │
│  ┌──────────────────────────────────────┐       │
│  │ Phase 1 — Voice Input     ✅ DONE    │       │
│  │ Phase 2 — Terminal Arch   ✅ DONE    │       │
│  │ Phase 3+ — 功能延伸       📋 BACKLOG │       │
│  └──────────────────────────────────────┘       │
│                                                 │
│  🔢 統計                                         │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │  113   │ │   0    │ │  26    │ │   8    │   │
│  │ 工單完成│ │ Active │ │ Bug關閉│ │ PLAN   │   │
│  └────────┘ └────────┘ └────────┘ └────────┘   │
│                                                 │
│  🐛 Bug 狀態                                     │
│  Open: 0 | Fixing: 0 | Fixed: 0 | Closed: 26  │
│                                                 │
│  📋 Backlog 摘要                                  │
│  PLAN-004 GPU Whisper (Planned)                 │
│  PLAN-009 Sprint Dashboard (In Progress)        │
│  PLAN-007 Remote Dev (Idea) ...                 │
│                                                 │
│  ⏱ 最後更新：2026-04-13 22:45                    │
└─────────────────────────────────────────────────┘
```

### 各區塊資料映射

| UI 區塊 | sprint-status.yaml 欄位 |
|---------|------------------------|
| 里程碑列表 | `milestones[].name` + `milestones[].status` |
| 統計卡片 | `summary.completed` / `summary.in_progress` / `bugs.closed` / `backlog_plans` |
| Bug 狀態條 | `bugs.open` / `bugs.fixing` / `bugs.fixed` / `bugs.closed` |
| Backlog 摘要 | `plans[].id` + `plans[].title` + `plans[].status`（只顯示非 DONE/DROPPED） |
| 最後更新 | `last_updated` |

### 視覺風格

- 沿用 CT 面板現有 CSS 變數（`var(--bg-secondary)` / `var(--border-color)` 等）
- 統計卡片：簡潔數字 + 標籤，無圖表
- 里程碑：狀態 badge（✅ / 📋 / 🔄）
- Backlog 項目：單行 compact 列表
- 整體保持 compact，不需要捲動

---

## 任務清單

### Step 1：建立 SprintDashboard 元件

新增 `src/components/SprintDashboard.tsx`：

```tsx
interface SprintDashboardProps {
  sprintStatus: SprintStatus | null  // 已有的 parseSprintStatus 回傳型別
}

function SprintDashboard({ sprintStatus }: SprintDashboardProps) {
  if (!sprintStatus) {
    return <EmptyState message="未找到 sprint-status.yaml" />
  }

  return (
    <div className="sprint-dashboard">
      <MilestoneSection milestones={sprintStatus.milestones} />
      <StatsCards summary={sprintStatus.summary} bugs={sprintStatus.bugs} />
      <BugStatusBar bugs={sprintStatus.bugs} />
      <BacklogSummary plans={sprintStatus.plans} />
      <LastUpdated timestamp={sprintStatus.last_updated} />
    </div>
  )
}
```

> 子元件可以都寫在同一個檔案內（compact，不需拆檔），或依複雜度決定。

### Step 2：整合到 ControlTowerPanel

修改 `src/components/ControlTowerPanel.tsx`：

```tsx
// 新增 Sprint tab（放在第一個位置）
const tabs = ['sprint', 'orders', 'bugs', 'backlog', 'decisions', 'workflow', 'epics']

// Sprint tab 內容
case 'sprint':
  return <SprintDashboard sprintStatus={sprintStatus} />
```

> `sprintStatus` 已由 `loadSprintStatus()` 在 ControlTowerPanel 中載入，直接傳入即可。

### Step 2.5：確認 sprint-status.yaml 搜尋路徑容錯

`loadSprintStatus()` 已有多路徑搜尋（_ct-workorders/ → project root → _bmad-output/ → docs/）。
**確認** SprintDashboard 不自己讀檔，只接收 ControlTowerPanel 傳入的 `sprintStatus` prop。
若使用者的 sprint-status.yaml 在 `_ct-workorders/` 而非 project root，現有搜尋邏輯已覆蓋。

### Step 3：確認 SprintStatus 型別完整性

檢查 `parseSprintStatus()` 回傳的型別是否包含所有需要的欄位：
- `milestones[]`
- `summary`（completed / in_progress / backlog_plans）
- `bugs`（open / fixing / fixed / closed）
- `plans[]`（id / title / status）
- `last_updated`

若缺少欄位，擴充 parser + 型別定義。

### Step 4：CSS 樣式

在 `src/styles/control-tower.css` 中加入：
- `.sprint-dashboard` 容器
- `.sprint-milestone-list` 里程碑列表
- `.sprint-stats-grid` 統計卡片（CSS Grid 4 欄）
- `.sprint-bug-bar` Bug 狀態條
- `.sprint-backlog-list` Backlog 摘要
- `.sprint-last-updated` 時間戳

### Step 5：Build 驗證

```bash
npx vite build
```

---

## 不在範圍

- ❌ 不修改 sprint-status.yaml 格式
- ❌ 不從工單源文件掃描資料（只讀 sprint-status.yaml）
- ❌ 不加圖表（保持文字 compact）
- ❌ 不加互動（點擊跳轉到其他頁籤——可作為後續增強）

---

## 驗收條件

1. CT 面板新增 Sprint 頁籤（第一個位置）
2. 顯示里程碑列表（名稱 + 狀態 badge）
3. 顯示統計卡片（工單完成 / Active / Bug / PLAN）
4. 顯示 Bug 狀態摘要
5. 顯示 Backlog 摘要（非 DONE/DROPPED 的 PLAN）
6. 無 sprint-status.yaml 時顯示空狀態提示
7. File watch 自動刷新（CT 面板現有機制）
8. Build 通過

---

## 交付物

- `src/components/SprintDashboard.tsx` 新增
- `src/components/ControlTowerPanel.tsx` 修改（新增 Sprint tab）
- `src/styles/control-tower.css` 修改（Dashboard 樣式）
- 可能：`src/types/control-tower.ts` 擴充（SprintStatus 型別）
- Git commit

---

## 回報區（Worker 填寫）

### 執行摘要

CT 面板新增 Sprint 總覽頁籤，作為第一個頁籤位置。讀取 sprint-status.yaml 顯示：
- 里程碑列表（名稱 + 狀態 badge）
- 統計卡片（工單完成 / Active / Bug 關閉 / PLAN 數）
- Bug 狀態摘要（Open / Closed / Won't Fix / Total + 活躍 Bug）
- Backlog 摘要（若 yaml 中有 plans[] 陣列）
- 最後更新時間
- 無 sprint-status.yaml 時顯示空狀態提示

### SprintStatus 型別變動

是，擴充了 `sprint-status.ts`：
- 新增 `SprintMilestone`, `SprintBugSummary`, `SprintSummaryData`, `SprintPlanEntry` 介面
- `SprintStatus` 新增 `milestones`, `bugs`, `summary`, `plans`, `lastUpdated` 欄位
- 新增 4 個提取函式：`extractMilestones`, `extractBugSummary`, `extractSummaryData`, `extractPlans`
- 向後相容：既有 `stories` 和 `raw` 欄位不受影響

### UI 截圖或描述

Sprint Dashboard 佈局：
1. 📊 里程碑區塊 — 每個里程碑一行，含 badge + 名稱 + 狀態文字
2. 🔢 統計區塊 — 4 欄 CSS Grid 卡片（大數字 + 標籤）
3. 🐛 Bug 狀態條 — inline 顯示各狀態數量 + 活躍 Bug 提示
4. 📋 Backlog 摘要 — compact 單行列表（需 yaml 有 plans[] 陣列）
5. ⏱ 最後更新 — 右下角時間戳

### 產出檔案

- `src/components/SprintDashboard.tsx` 新增
- `src/types/sprint-status.ts` 修改（型別擴充 + 提取函式）
- `src/components/ControlTowerPanel.tsx` 修改（Sprint tab + import）
- `src/styles/control-tower.css` 修改（Dashboard 樣式）
- `src/locales/en.json` 修改（sprint tab i18n）
- `src/locales/zh-TW.json` 修改（sprint tab i18n）
- `src/locales/zh-CN.json` 修改（sprint tab i18n）

### Commit Hash
（待 commit）

### 問題 / 卡點
無

### 互動紀錄
無

### 完成時間
2026-04-13 23:03 UTC+8
