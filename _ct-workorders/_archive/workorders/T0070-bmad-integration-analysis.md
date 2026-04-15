# 工單 T0070-bmad-integration-analysis

## 元資料
- **工單編號**：T0070
- **任務名稱**：BMad-Method 整合分析 — Epic/Story 看板 + 流程步進 + bmad-guide 整合可行性
- **狀態**：DONE
- **建立時間**：2026-04-13 00:04 (UTC+8)
- **開始時間**：2026-04-13 00:07 (UTC+8)
- **完成時間**：2026-04-13 00:13 (UTC+8)

## 工作量預估
- **預估規模**：大
- **Context Window 風險**：高（需掃描 BMad 目錄結構 + skill 定義 + 現有 UI）
- **降級策略**：若 CW 不足，優先完成 A（BMad 檔案結構）和 B（流程步進），C（bmad-guide 整合）可簡化

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需深度分析 BMad-Method 檔案結構、skill 定義、現有 UI component

## 任務指令

### 前置條件
需載入的文件清單：
- `CLAUDE.md`（專案規範）
- `_ct-workorders/_local-rules.md`（單據規範）
- `_ct-workorders/T0066-tower-ui-architecture-analysis.md`（現有 UI 架構，特別是 Kanban/Sprint component）

### 輸入上下文

BAT 塔台面板目前有 6 個頁籤，其中 Kanban（工單看板）和 Sprint（空頁籤）將被重新定位：

**Kanban → Epic/Story 看板**：
- 顯示 Epic 列表，展開看 Story
- Story 可追蹤到關聯的工單 T####（可選關聯，有的工單獨立存在）
- 一個 Story 可拆多張工單（Story = 需求，工單 = 任務）

**Sprint → BMad 流程步進**：
- 顯示 BMad-Method 大流程步驟的完成狀態
- 步驟包括但不限於：Discovery → PRD → Architecture → Epics → Implementation → Testing → Delivery
- 已完成的步驟可以 [瀏覽檔案] 打開對應產出物
- 未完成的步驟顯示為待辦
- 探索與 bmad-guide skill 的整合可能

**Orders 頁籤不變**，仍列出所有工單。

本工單是**分析工單**（不寫程式碼），產出分析報告供後續實作。

### 分析範圍

#### A. BMad-Method 檔案結構分析

1. **`_bmad/` 目錄**：
   - 完整掃描目錄結構（ls -R）
   - 分析各子目錄的用途（`_config/`、`bmm/`、`core/`、`tea/` 等）
   - 找到 BMad-Method 的版本和核心定義文件

2. **`_bmad-output/` 目錄**（若存在）：
   - 掃描已產出的 BMad 文件（PRD、Architecture、Epics、Stories 等）
   - 記錄每個文件的格式和結構
   - 分析哪些 BMad 流程步驟已完成

3. **BMad 標準格式**：
   - Epic 的標準格式是什麼？（frontmatter? markdown structure?）
   - Story 的標準格式是什麼？
   - Epic → Story 的關聯方式？
   - Story → 工單 T#### 的關聯方式（是否有標準欄位？）

4. **流程步驟定義**：
   - BMad-Method 定義了哪些標準流程步驟？
   - 每個步驟的產出物是什麼文件？
   - 步驟的完成判斷依據是什麼？（文件存在？特定狀態標記？）

#### B. 現有 UI Component 分析

1. **KanbanView**（`src/components/KanbanView.tsx`）：
   - 完整分析 component 結構和 props
   - 目前如何渲染工單？按什麼欄位分欄？
   - 改為 Epic/Story 看板需要修改哪些部分？
   - 是否值得複用還是重寫？

2. **SprintProgress**（`src/components/SprintProgress.tsx`）：
   - 完整分析 component 結構
   - 目前如何讀取和顯示 sprint-status.yaml？
   - 改為 BMad 流程步進需要修改哪些部分？

#### C. bmad-guide Skill 整合可行性

1. **bmad-guide skill 分析**：
   - 找到 bmad-guide skill 的定義檔位置
   - 分析它管理哪些流程步驟
   - 它如何判斷各步驟的完成狀態？
   - 它的資料來源是什麼？

2. **整合方案**：
   - UI 是否能直接複用 bmad-guide 的步驟定義和完成判斷邏輯？
   - 是否需要 bmad-guide 提供 API（如產出 JSON/YAML 狀態檔）？
   - 或者 UI 獨立解析 BMad 文件，不依賴 bmad-guide skill？

3. **建議**：
   - 整合 vs 獨立的利弊分析
   - 推薦方案和理由

#### D. 資料模型與擴充方案

1. **Epic/Story 資料模型建議**：
   - `EpicEntry` / `StoryEntry` interface 設計
   - 從哪個文件解析？用什麼 parser？
   - Story → 工單 T#### 的關聯如何建立和顯示？

2. **流程步進資料模型建議**：
   - `BmadPhase` / `BmadWorkflow` interface 設計
   - 每個步驟：名稱、狀態（完成/進行中/未開始）、產出檔案路徑
   - 產出檔案的 [瀏覽檔案] 連結路徑

3. **頁籤重命名建議**：
   - Kanban → ？（Epic/Story? Epics? Roadmap?）
   - Sprint → ？（Workflow? BMad Flow? Phases?）

### 預期產出
- 分析報告：寫入工單回報區
- 報告結構：按 A/B/C/D 四個區塊組織
- 每個發現附帶檔案路徑
- 包含明確的「建議方案」和「實作拆單建議」

### 驗收條件
- [ ] 完整掃描 `_bmad/` 目錄結構並記錄
- [ ] 確認 `_bmad-output/` 是否存在，記錄其內容
- [ ] 記錄 BMad Epic/Story 標準格式
- [ ] 記錄 BMad 流程步驟定義和產出物對應
- [ ] 分析 KanbanView component 的修改方案
- [ ] 分析 SprintProgress component 的修改方案
- [ ] 分析 bmad-guide skill 的整合可行性
- [ ] 提出 Epic/Story + 流程步進的資料模型建議
- [ ] 提出頁籤重命名建議
- [ ] 提出後續實作拆單建議

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. **A 部分**：掃描 `_bmad/` 和 `_bmad-output/` 目錄
4. **A 部分**：分析 BMad-Method 的 Epic/Story/Phase 標準格式
5. **B 部分**：分析 KanbanView 和 SprintProgress component
6. **C 部分**：找到並分析 bmad-guide skill 定義
7. **D 部分**：基於 A/B/C 提出資料模型和擴充方案
8. 將報告寫入回報區
9. 更新「狀態」和「完成時間」

### 執行注意事項
- 這是**分析工單**，不要修改任何程式碼
- BMad-Method 的檔案可能在 `_bmad/` 下有複雜的子目錄結構，耐心掃描
- bmad-guide skill 可能在 `~/.claude/skills/` 目錄下
- 若 `_bmad-output/` 不存在，記錄這個事實並分析含義（可能本專案尚未跑過完整 BMad 流程）
- 注意 CW 管理 — BMad skill 定義可能很大，只讀取必要部分

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
分析工單，無程式碼修改。產出：完整架構分析報告（寫入本回報區）。

---

## A. BMad-Method 檔案結構分析

### A-1. `_bmad/` 目錄結構

```
_bmad/
├── _config/
│   ├── manifest.yaml           ← BMad 安裝資訊（v6.3.0, 2026-04-11）
│   ├── files-manifest.csv      ← 所有安裝檔案清單（含 SHA hash）
│   ├── skill-manifest.csv      ← 40 個 skill 的 canonical ID、名稱、模組、路徑
│   ├── agent-manifest.csv      ← Agent 清單
│   ├── bmad-help.csv           ← 幫助索引
│   └── agents/                 ← 空目錄
├── bmm/                        ← BMad Method 主模組 (v6.3.0)
│   ├── config.yaml             ← 模組設定（project_name, output_folder 等）
│   ├── module-help.csv         ← 43 個 workflow 的完整定義（13 欄：phases, deps, outputs）
│   ├── 1-analysis/             ← Phase 1（空目錄 — thin installation）
│   │   └── research/           ← 空
│   ├── 2-plan-workflows/       ← Phase 2（空）
│   ├── 3-solutioning/          ← Phase 3（空）
│   └── 4-implementation/       ← Phase 4（空）
├── core/                       ← Core 模組 (v6.3.0)
│   ├── config.yaml
│   └── module-help.csv
└── tea/                        ← Test Architecture Enterprise 模組 (v1.7.2)
    ├── config.yaml
    ├── module-help.csv
    └── workflows/testarch/README.md
```

**關鍵發現**：
- 本專案為 **thin installation** — `_bmad/bmm/` 下的子目錄全部為空
- Skill 定義檔路徑在 `skill-manifest.csv` 中登記（如 `_bmad/bmm/3-solutioning/bmad-create-epics-and-stories/SKILL.md`），但實際不存在於本機
- BMad skills 透過 Claude Code 全域 skill 系統（`~/.claude/skills/`）執行，不依賴本地 SKILL.md 檔案
- 版本：BMad-Method v6.3.0 + TEA v1.7.2，安裝日期 2026-04-11

### A-2. `_bmad-output/` 目錄現況

```
_bmad-output/
├── planning-artifacts/          ← 空
├── implementation-artifacts/    ← 空
└── test-artifacts/              ← 空
```

**含義**：本專案**尚未跑過任何 BMad 標準流程**。沒有 PRD、Architecture、Epic、Story、Sprint Status 等任何 BMad 產出物。控制塔 UI 設計必須考慮「BMad 產出物不存在」的空狀態。

### A-3. BMad Epic/Story 標準格式

**Epic 格式**（基於 `workflow-map.md` + `module-help.csv`）：
- 由 `bmad-create-epics-and-stories` workflow 產生（Phase 3, agent: PM John）
- 輸出到 `_bmad-output/planning-artifacts/epics/`
- 檔名格式：`epic-001.md`, `epic-002.md`, ...
- 前置條件：`bmad-create-architecture` 必須先完成
- 內容結構（推測自 BMad 文件標準）：
  - Epic ID、Title、Priority
  - Stories 列表（每個 Story 有 ID、Title、Status）
  - 關聯 PRD 需求
  - 驗收條件

**Story 格式**：
- 由 `bmad-create-story` workflow 產生（Phase 4, agent: DEV Amelia）
- 輸出到 `_bmad-output/implementation-artifacts/story-*.md`
- Story 生命週期：`TODO → IN PROGRESS → READY FOR REVIEW → DONE`
- 包含：前置條件、實作步驟、測試需求、驗收標準

**Epic → Story 關聯方式**：
- Epic 文件內包含 Story 列表
- Story 文件的 epic 欄位回指 Epic ID
- `sprint-status.yaml` 的 stories 支援 `epic` 屬性（現有 parser 已支援 `story.epic` 欄位）

**Story → 工單 T#### 關聯方式**：
- `sprint-status.yaml` 中的 story 支援 `work_order` / `work_order_id` 欄位
- 現有 `SprintStory` type 已有 `workOrderId?: string` 屬性
- 不是所有 Story 都有工單——有的 Story 直接透過 `bmad-dev-story` 實作
- 工單更偏向「塔台任務管理」，Story 偏向「BMad 需求追蹤」

### A-4. BMad 流程步驟定義

基於 `module-help.csv` 的 `phase` 欄位和 `workflow-map.md`：

| 階段 | 名稱 | 關鍵 Workflow | 標準產出物 | 完成判斷 |
|------|------|-------------|-----------|---------|
| 1 | Analysis（可選） | brainstorming, market/domain/tech research, product-brief, prfaq | `brainstorming-report.md`, `product-brief.md`, `prfaq-*.md` | 相關文件存在於 `planning-artifacts/` |
| 2 | Planning（必要） | create-prd, create-ux-design | `PRD.md`, `ux-spec.md` | `PRD.md` 存在 |
| 3 | Solutioning | create-architecture, create-epics-and-stories, check-implementation-readiness | `architecture.md`, `epics/epic-*.md` | `epics/` 目錄有至少一個 epic |
| 4 | Implementation | sprint-planning, create-story, dev-story, code-review, retrospective | `sprint-status.yaml`, `story-*.md` | sprint-status 中的 stories 全部 DONE |
| — | Anytime | quick-dev, document-project, generate-project-context, correct-course | `spec-*.md`, `project-context.md` | — |

**完成判斷邏輯**：
- **基於檔案存在性**：檢查 `_bmad-output/planning-artifacts/` 和 `_bmad-output/implementation-artifacts/` 中的特定檔案是否存在
- **無狀態標記**：BMad-Method 本身不維護「階段完成狀態」的中央檔案
- **Sprint 唯一例外**：`sprint-status.yaml` 有 stories 的 status 追蹤

---

## B. 現有 UI Component 分析

### B-1. KanbanView 分析（`src/components/KanbanView.tsx`）

**現有功能**：
- 接收 `workOrders[]`，按狀態分到 5 個 lane（TODO, IN_PROGRESS, REVIEW, DONE, BLOCKED）
- 每張卡片顯示 ID、Title、Status badge
- PENDING/URGENT 工單有 ▶ 執行按鈕
- 支援 `onExecWorkOrder` 和 `onDoneWorkOrder` callbacks

**改為 Epic/Story 看板需要的修改**：

| 需修改部分 | 修改幅度 | 說明 |
|-----------|---------|------|
| Props | 重新設計 | 不再接收 `WorkOrder[]`，改為 `EpicEntry[]` 或雙層資料 |
| Lane 分類邏輯 | 重寫 | `workOrderToLane()` → 需要基於 Epic/Story 狀態的新 lane 邏輯 |
| Card 渲染 | 重寫 | 從工單卡片改為 Epic（可展開看 Stories）的雙層結構 |
| 操作按鈕 | 移除 | Epic/Story 看板是唯讀的（Phase 1） |
| 資料來源 | 完全不同 | 從 `_ct-workorders/*.md` 改為 `_bmad-output/planning-artifacts/epics/*.md` |

**建議：重寫（新建 component），不複用 KanbanView**
- KanbanView 的設計高度綁定 WorkOrder type 和塔台工單的狀態流
- Epic/Story 看板是完全不同的視角（需求追蹤 vs 任務管理）
- KanbanView 保留給 kanban 頁籤使用，不需修改

### B-2. SprintProgress 分析（`src/components/SprintProgress.tsx`）

**現有功能**：
- 接收 `SprintStatus`（從 `sprint-status.yaml` 解析）+ `workOrders[]`
- 顯示：Sprint Header → ProgressBar → Story Lanes → Cross Validation
- 子 component：`ProgressBar`, `StoryLanes`, `ValidationSection`
- `StoryLanes` 按 lane 分組顯示 stories（每個 story 顯示 id, title, workOrderId, epic）

**改為 BMad 流程步進需要的修改**：

| 需修改部分 | 修改幅度 | 說明 |
|-----------|---------|------|
| 整體概念 | 根本不同 | SprintProgress 追蹤的是一個 Sprint 內的 Stories 進度，而 BMad 流程步進追蹤的是 4 個大階段的完成狀態 |
| 資料來源 | 完全不同 | 從 `sprint-status.yaml` 改為掃描 `_bmad-output/` 的檔案存在性 |
| ProgressBar | 可複用概念 | 段落進度條的 UI pattern 可參考，但資料模型不同 |
| StoryLanes | 不適用 | BMad 流程步進不需要 lane 分組 |
| CrossValidation | 不適用 | 不需要工單交叉比對 |

**建議：新建 component**
- SprintProgress 的 YAML 解析和 Story-centric 設計與 BMad 流程步進差異太大
- SprintProgress 保留給 sprint 頁籤使用（若有 sprint-status.yaml）
- BMad 流程步進需要全新的「階段清單 + 檔案存在性檢測」邏輯

---

## C. bmad-guide Skill 整合可行性

### C-1. bmad-guide Skill 分析

**位置**：`~/.claude/skills/bmad-guide/`
**版本標記**：v6.2.2（注意：本地安裝為 v6.3.0）

**bmad-guide 的功能**：
- **純教學性質**：回答 BMad-Method 概念問題、推薦下一步 workflow
- **知識來源**：7 個 reference 檔案（workflow-map.md, supplementary-workflows.md, tea-module.md, ecosystem-modules.md, brownfield.md, diagrams.md, update-protocol.md）
- **互動方式**：產生 SVG 互動圖表 + 繁中說明

**bmad-guide 不做的事**：
- ❌ **不追蹤** 任何流程步驟的完成狀態
- ❌ **不讀取** `_bmad-output/` 中的任何產出檔案
- ❌ **不提供** 程式化 API（沒有 JSON/YAML 狀態輸出）
- ❌ **不維護** 專案的 BMad 進度資訊

**bmad-guide 提供的有用資訊**：
- ✅ `workflow-map.md`：完整的 Phase → Workflow → Output 對應表
- ✅ `module-help.csv`：43 個 workflow 的 phase, 依賴關係, 輸出位置
- ✅ 步驟定義和產出物對應是**靜態知識**，不會隨專案而變

### C-2. 整合方案分析

| 方案 | 描述 | 優點 | 缺點 |
|------|------|------|------|
| **A. UI 獨立解析** | UI 直接掃描 `_bmad-output/` 檔案結構，用硬編碼的 Phase → 產出物對應表判斷完成狀態 | 零依賴、完全自主、簡單可控 | 對應表需要手動維護，BMad 版本更新時可能不同步 |
| **B. 讀取 module-help.csv** | UI 讀取 `_bmad/bmm/module-help.csv` 提取 phase 和 output 欄位，動態構建對應表 | 與 BMad 安裝同步、自動適應版本更新 | CSV 解析複雜度略高、thin installation 可能 CSV 也不穩定 |
| **C. 整合 bmad-guide** | 讓 bmad-guide 產出 JSON 狀態檔供 UI 讀取 | — | 需要修改 bmad-guide（不屬於本專案控制範圍）、架構不合理 |

### C-3. 建議方案：A（UI 獨立解析）+ B（CSV 輔助，作為降級方案）

**推薦理由**：
1. **bmad-guide 不適合整合**：它是教學工具，不是狀態追蹤工具。強行整合會違反其設計目的
2. **BMad 流程步驟是相對穩定的**：Phase 1-4 的核心步驟在大版本間不會頻繁變動
3. **檔案存在性檢測** 是最可靠的完成判斷方式：
   - `PRD.md` 存在 → Phase 2 有進展
   - `architecture.md` 存在 → Phase 3 有進展
   - `epics/` 目錄有 Epic 檔 → Phase 3 完成
   - `sprint-status.yaml` 存在 → Phase 4 已啟動
4. **module-help.csv 可作為 fallback**：若需要動態解析 workflow 清單，可讀取 CSV 的 `phase` 和 `output-location` 欄位

---

## D. 資料模型與擴充方案

### D-1. Epic/Story 資料模型

```typescript
// src/types/bmad-epic.ts（新建）

export type EpicStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'
export type StoryStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'BLOCKED'

export interface BmadStory {
  id: string           // e.g. 'story-1.1'
  title: string
  status: StoryStatus
  workOrderId?: string // T#### 關聯（可選）
}

export interface BmadEpic {
  id: string           // e.g. 'epic-001'
  filename: string     // e.g. 'epic-001.md'
  title: string
  status: EpicStatus   // 從 stories 的狀態推算
  stories: BmadStory[]
  filePath: string     // 相對路徑，供 [瀏覽檔案] 使用
}
```

**資料來源**：掃描 `_bmad-output/planning-artifacts/epics/*.md`
**解析策略**：
- 讀取每個 `epic-*.md` 檔案
- 用 `extractField()` regex（複用 `control-tower.ts` 的 pattern）提取標題
- 解析 stories 區塊（Markdown 表格或列表）
- 若有 `sprint-status.yaml`，交叉比對 story 狀態

**Story → 工單關聯建立方式**：
1. 優先：`sprint-status.yaml` 中 story 的 `work_order` 欄位
2. 次要：story 文件內的 `相關工單` 欄位
3. UI 顯示：Story 卡片上的 T#### badge（類似現有 `SprintProgress` 中的 `ct-story-wo`）

### D-2. 流程步進資料模型

```typescript
// src/types/bmad-workflow.ts（新建）

export type PhaseStatus = 'NOT_STARTED' | 'PARTIAL' | 'DONE'

export interface BmadPhaseArtifact {
  name: string          // e.g. 'PRD.md'
  displayName: string   // e.g. 'Product Requirements Document'
  exists: boolean       // 檔案是否存在
  filePath: string      // 絕對路徑，供 [瀏覽檔案] 使用
}

export interface BmadPhase {
  id: number            // 1-4
  name: string          // e.g. '分析 (Analysis)'
  status: PhaseStatus   // 從 artifacts 推算
  artifacts: BmadPhaseArtifact[]
  isRequired: boolean   // Phase 1 optional, 2-4 required
}

export interface BmadWorkflow {
  phases: BmadPhase[]
  projectName: string   // 從 bmm/config.yaml 讀取
  bmadVersion: string   // 從 manifest.yaml 讀取
}
```

**硬編碼的 Phase → 產出物對應表**：

```typescript
const PHASE_DEFINITIONS: Array<{
  id: number; name: string; required: boolean
  artifacts: Array<{ name: string; displayName: string; dir: string }>
}> = [
  {
    id: 1, name: '分析 (Analysis)', required: false,
    artifacts: [
      { name: 'brainstorming-report.md', displayName: 'Brainstorming Report', dir: 'planning-artifacts' },
      { name: 'product-brief.md', displayName: 'Product Brief', dir: 'planning-artifacts' },
    ]
  },
  {
    id: 2, name: '規劃 (Planning)', required: true,
    artifacts: [
      { name: 'PRD.md', displayName: 'Product Requirements', dir: 'planning-artifacts' },
      { name: 'ux-spec.md', displayName: 'UX Specification', dir: 'planning-artifacts' },
    ]
  },
  {
    id: 3, name: '方案 (Solutioning)', required: true,
    artifacts: [
      { name: 'architecture.md', displayName: 'Architecture', dir: 'planning-artifacts' },
      // epics/ 目錄特殊處理：檢查目錄是否有 *.md 檔案
    ]
  },
  {
    id: 4, name: '實作 (Implementation)', required: true,
    artifacts: [
      { name: 'sprint-status.yaml', displayName: 'Sprint Status', dir: 'implementation-artifacts' },
      // story-*.md 特殊處理
    ]
  },
]
```

**Status 計算邏輯**：
- `NOT_STARTED`：所有 artifacts.exists === false
- `PARTIAL`：至少一個 artifact 存在，但不是全部
- `DONE`：所有 required artifacts 存在

### D-3. 頁籤重命名建議

| 現有名稱 | 建議新名稱 | 理由 |
|---------|-----------|------|
| Kanban | **Epics** | 明確表達「Epic/Story 需求追蹤」語義，且與 BMad 術語一致 |
| Sprint | **Workflow** | 表達「BMad 工作流程步進」，避免與 Sprint（敏捷衝刺）混淆 |

**其他考慮過但不推薦的選項**：
- "Roadmap" — 太抽象，不明確
- "BMad Flow" — 對不熟悉 BMad 的使用者不友好
- "Phases" — 太 BMad-specific，且如果未來有非 BMad 階段會不適用
- "Stories" — 與 Sprint 中的 Stories 混淆

**i18n 建議**：
```json
"tab": {
  "epics": "Epics",
  "workflow": "Workflow"
}
```

### D-4. 後續實作拆單建議

建議拆為 **3 張工單**，依序執行：

---

**T0071 — BMad Workflow 步進面板（Sprint → Workflow）**

規模：中 | CW 風險：低

任務：
1. 新建 `src/types/bmad-workflow.ts`（Phase/Artifact 資料模型 + 硬編碼對應表）
2. 新建 `src/components/BmadWorkflowView.tsx`（Phase 列表 + Artifact 存在性顯示 + 瀏覽檔案按鈕）
3. 修改 `ControlTowerPanel.tsx`：
   - 新增 `bmadPhases` state + `loadBmadWorkflow()` loader
   - Sprint tab rename → Workflow，改為渲染 `BmadWorkflowView`（當 `_bmad-output/` 存在時）
   - Sprint tab 保留為 sub-section（當 sprint-status.yaml 存在時在 Workflow 內顯示）
4. i18n 更新
5. CSS 新增 `ct-workflow-*` 樣式

驗收：Workflow 頁籤正確顯示 4 個 Phase，每個 Phase 列出 artifacts 並標示存在/不存在，已存在的可 [瀏覽檔案]。空 `_bmad-output/` 時顯示友善提示。

---

**T0072 — Epic/Story 看板（Kanban → Epics）**

規模：大 | CW 風險：中

前置條件：T0071 完成（需要 bmad-workflow 的 Artifact 檢測邏輯）

任務：
1. 新建 `src/types/bmad-epic.ts`（Epic/Story 資料模型 + parser）
2. 新建 `src/components/BmadEpicsView.tsx`（Epic 列表 + 展開 Story + Story→T#### 連結）
3. 修改 `ControlTowerPanel.tsx`：
   - 新增 `epics` state + `loadEpics()` loader
   - Kanban tab rename → Epics，改為渲染 `BmadEpicsView`（當 epics/ 目錄存在時）
   - Kanban 保留為 fallback（當無 Epic 但有 workOrders 時，仍顯示工單看板）
4. i18n 更新
5. CSS 新增 `ct-epic-*` 樣式

驗收：Epics 頁籤正確解析並顯示 Epic 列表，展開可看 Stories，Story 的 T#### 連結可跳轉。無 Epic 時顯示工單看板（向後相容）。

---

**T0073 — Sprint Status 整合至 Workflow 面板**

規模：小 | CW 風險：低

前置條件：T0071 完成

任務：
1. 將現有 `SprintProgress` component 嵌入 `BmadWorkflowView` 的 Phase 4 區塊
2. 在 Phase 4 展開時顯示 Sprint 進度條和 Story 清單
3. 移除獨立的 sprint tab（合併入 workflow tab）
4. Story → Epic 回指（從 sprint-status.yaml 的 epic 欄位連結到 Epics 頁籤）

驗收：Workflow 頁籤的 Phase 4 展開後顯示 Sprint 進度和 Stories，點擊 Story 的 Epic badge 可切換到 Epics 頁籤。

---

### 互動紀錄
無

### 遭遇問題

1. **BMad 本地安裝為 thin installation**：`_bmad/bmm/` 下的所有 workflow 子目錄為空。Skill 定義（SKILL.md）不在本地，無法直接讀取 Epic/Story 的精確模板格式。分析基於 `workflow-map.md` 和 `module-help.csv` 的文檔推斷。

2. **本專案尚未產出任何 BMad 文件**：`_bmad-output/` 三個子目錄全部為空。UI 設計必須優先處理「空狀態」（empty state），不能假設 Epic/Sprint 文件一定存在。

3. **bmad-guide 版本不一致**：skill 標記 v6.2.2，但本地安裝為 v6.3.0。不影響分析，但使用者可能需要 `*update` 同步。

4. **Epic 檔案精確格式未知**：由於 thin installation 沒有 `bmad-create-epics-and-stories/SKILL.md`，Epic 的內部 Markdown 結構只能從外部文檔推斷。建議 T0072 實作時，先手動跑一次 `bmad-create-epics-and-stories` 產出樣本檔，再設計 parser。

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-13 00:12 (UTC+8)
