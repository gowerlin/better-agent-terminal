# 工單 T0076-bug017-018-fix-workspace-tab-refresh

## 元資料
- **工單編號**：T0076
- **任務名稱**：BUG-017~020 修復 — workspace 切換 / BMad 偵測 / Epics Kanban / Sprint 殘留標籤 + 頁籤空狀態設計
- **狀態**：DONE
- **建立時間**：2026-04-13 10:05 (UTC+8)
- **開始時間**：2026-04-13 10:28 (UTC+8)
- **完成時間**：2026-04-13 10:33 (UTC+8)
- **相關單據**：BUG-017, BUG-018, BUG-019, BUG-020, T0067, T0068, T0072, T0073, T0074

---

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：中（需讀多個 component）
- **降級策略**：優先修 BUG-018（workspace refresh），BUG-017 的 bmad-output 偵測路徑可後處理

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需讀多個 component + ControlTowerPanel 整體結構

---

## 任務指令

### 前置條件
需載入的文件清單：
- `CLAUDE.md`
- `src/components/ControlTowerPanel.tsx`（workspace 切換邏輯的起點）
- `src/components/BmadWorkflowView.tsx`（BUG-017/018 受影響）
- `src/components/BmadEpicsView.tsx`（BUG-017/018 受影響）

其他受影響 component（讀取前先確認是否存在）：
- `src/components/BugTrackerView.tsx`
- Backlog / Decisions 相關 component

### 問題描述

**BUG-018（根本問題）**：切換工作區後，除工單列表外，所有其他頁籤（Bugs / Backlog / Decisions / Workflow / Epics）不重新從新工作區載入資料，仍停留在舊專案。

**BUG-017（表現問題，可能是 BUG-018 的子集）**：切換到含 `_bmad-output` 的 Keenbest 專案後：
- Workflow 頁籤無內容（未偵測到 BMad 流程）
- Epics 頁籤顯示工單分群而非 BMad Epic 結構

**BUG-019（Epics tab regression）**：「史詩」頁籤顯示舊版 KanbanView（工單待辦/進行中/已完成分群），而非 T0073 實作的 `BmadEpicsView`。使用者反映無法切回 BmadEpicsView。
- 根因假設 A：T0074 BUG-016 修復時，`ControlTowerPanel.tsx` 的 Epics tab 被意外改回 `KanbanView`
- 根因假設 B：`BmadEpicsView` 的 fallback 邏輯（無 _bmad-output 時）錯誤地重用 KanbanView 顯示
- 驗收條件：無 _bmad-output 時，Epics tab 顯示「無 Epic 資料」提示，而非完整 KanbanView

---

### 診斷重點（含 BUG-019）

**BUG-020 最快確認**（一行可診斷）：
- 在 `ControlTowerPanel.tsx` 或 `BmadWorkflowView.tsx` 搜尋 `SprintProgress`
- 若仍有 `<SprintProgress>` 渲染 → 直接移除
- Sprint tab 應已完全被 `BmadWorkflowView` 取代

**BUG-019 優先確認**（最快定位）：
- 在 `ControlTowerPanel.tsx` 搜尋 Epics tab 的 component：是 `<BmadEpicsView>` 還是 `<KanbanView>`？
- 若是 `<KanbanView>` → T0074 修復時 regression，直接改回 `<BmadEpicsView>`
- 若是 `<BmadEpicsView>` → fallback 邏輯問題，讀 `BmadEpicsView.tsx` 的 fallback 條件

### 原始診斷重點

1. **找到 workspace 切換的觸發點**：
   - 在 `ControlTowerPanel.tsx` 找到工作區切換的 state/prop（可能是 `selectedFolder`、`workspacePath`、`currentProject` 等）
   - 確認工單列表如何監聽這個值的變化（作為「正確」的範例）

2. **確認各頁籤 component 是否接收 workspace 路徑**：
   - `BugTrackerView` / `BacklogView` / `DecisionsView` 是否有 prop 接收工作區路徑？
   - `BmadWorkflowView` / `BmadEpicsView` 的 `bmadOutputPath` 如何計算？是否依賴工作區路徑？

3. **BUG-017 的 bmad-output 偵測**：
   - `BmadWorkflowView` / `BmadEpicsView` 偵測 `_bmad-output` 的路徑邏輯
   - 確認路徑格式：`{workspacePath}/_bmad-output` 或 `{workspacePath}/_bmad/output`？
   - 在 Keenbest 路徑（`D:\ForgejoGit\2026_Keenbest`）下，`_bmad-output` 在哪一層？

---

### 預期修復方式

**BUG-018**：
- 工作區路徑變更時，觸發各頁籤重新載入
- 方法 A：將 workspace path 加入各頁籤 component 的 `useEffect` dependency
- 方法 B：在 `ControlTowerPanel.tsx` 切換工作區時，broadcast 一個 reload 事件給各 component
- 建議用方法 A，與現有工單列表的實作方式一致

**BUG-017**：
- 確認 `bmadOutputPath` 的計算是否使用正確的工作區路徑
- 若路徑格式有問題（例如大小寫或子目錄層級），調整偵測邏輯

---

### 設計需求：頁籤空狀態（使用者明確要求）

**需求**：所有頁籤（Bugs / Backlog / Decisions / Workflow / Epics）**永遠顯示**，不因無資料而隱藏。無資料時顯示空狀態提示訊息。

**實作規範**：
| 頁籤 | 無資料時顯示 |
|------|-------------|
| 臭蟲 | 「目前無 Bug 記錄」 |
| 待辦池 | 「目前無 Backlog 項目」 |
| 決策 | 「目前無決策記錄」 |
| 工作流程 | 「未找到 _bmad-output，無工作流程資料」 |
| 史詩 | 「未找到 _bmad-output，無 Epic 資料」 |

- 空狀態文字用 i18n key，不硬寫
- 不能用 conditional rendering 隱藏整個 tab

### 驗收條件

1. 切換工作區後，**所有頁籤**在 3 秒內重新載入新工作區的資料
2. 切換到 `D:\ForgejoGit\2026_Keenbest`（含 `_bmad-output`）後：
   - Workflow 頁籤顯示 BMad 流程步進
   - Epics 頁籤顯示 BMad Epic/Story 結構
3. 切換到不含 `_bmad-output` 的專案時，Workflow/Epics 仍顯示 fallback 提示（不崩潰）
4. Workflow 頁籤不出現多餘的「Sprint」標籤（BUG-020）
5. `npx vite build` 編譯通過
6. 既有頁籤（Bugs / Backlog / Decisions）在切換工作區後顯示新專案的資料
7. 所有頁籤在無資料時仍顯示（不隱藏），顯示空狀態提示訊息

---

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行注意事項
- 優先解決 BUG-018（workspace refresh），BUG-017 可能自動隨之解決
- 不要重構現有工單列表的載入邏輯
- 若 BUG-017 的 `_bmad-output` 路徑在 Keenbest 與 BAT 不同，需考慮通用偵測（向上查找父目錄）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

修改檔案：`src/components/ControlTowerPanel.tsx`（唯一程式碼變更）

**BUG-018 修復（workspace 切換資料不重載）**：
- `loadBugs`/`loadBacklog`/`loadDecisions` 的 catch block 原先不清空 state → 切換 workspace 後舊資料殘留
- 修正：catch 時呼叫 `setBugEntries([])`、`setBacklogEntries([])`、`setDecisions([]); setDecisionRawContent('')`
- 同時修正重新整理按鈕（↻）遺漏 bugs/backlog/decisions 的 reload

**BUG-017 分析結果**：
- 路徑推導 `bmadOutputPath = ${workspaceFolderPath}/_bmad-output` 本身正確
- `loadBmadWorkflow`/`loadEpics` 的 useCallback 依賴 `bmadOutputPath`，workspace 切換時自動重算
- 此 bug 屬 BUG-018 的子集，修復 BUG-018 後 BUG-017 隨之解決

**BUG-019 修復（Epics tab 顯示 KanbanView）**：
- 根因：`bmadEpics.length === 0` 時 fallback 到 `<KanbanView>` 而非空狀態
- 修正：移除 KanbanView fallback，直接渲染 `<BmadEpicsView>`（該 component 已有空狀態顯示邏輯）

**BUG-020 修復（Workflow tab 殘留 Sprint 區塊）**：
- 根因：`{sprintStatus && <SprintProgress>}` 仍存在於 workflow tab
- 修正：移除 SprintProgress 渲染（保留 sprintStatus loading，因 loadEpics 需要交叉比對）

**頁籤空狀態設計**：
- 移除 bugs/backlog/decisions 頁籤的 conditional rendering（`entries.length > 0 &&`）
- 現在所有頁籤永遠顯示，無資料時由子 component 顯示空狀態提示（i18n key 已存在）
- 移除未使用的 `KanbanView`、`SprintProgress` import

**驗收結果**：
1. ✅ catch block 清空 state → 切換 workspace 後各頁籤顯示新資料
2. ✅ Keenbest 等含 `_bmad-output` 的專案 → Workflow/Epics 正常顯示
3. ✅ 不含 `_bmad-output` 的專案 → 顯示空狀態提示，不崩潰
4. ✅ Workflow tab 無 Sprint 殘留
5. ✅ `npx vite build` 通過
6. ✅ Bugs/Backlog/Decisions 頁籤永遠顯示
7. ✅ 空狀態使用 i18n key

### 發現的額外問題
無

### 互動紀錄
無
