# 工單 T0072-bmad-workflow-view

## 元資料
- **工單編號**：T0072
- **任務名稱**：BMad Workflow 步進面板（Sprint → Workflow 頁籤改造）
- **狀態**：DONE
- **建立時間**：2026-04-13 00:30 (UTC+8)
- **開始時間**：2026-04-13 00:33 (UTC+8)
- **完成時間**：2026-04-13 00:43 (UTC+8)

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：中
- **降級策略**：若 CW 不足，先完成 type + 基本 phase 列表，展開詳情和瀏覽檔案交後續

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需讀取 T0070 分析報告 + 參考專案 BMad 產出 + 多個現有 component

## 任務指令

### 前置條件
需載入的文件清單：
- `_ct-workorders/T0070-bmad-integration-analysis.md`（**必讀**，D 部分的資料模型和 Phase 定義）
- `CLAUDE.md`（專案規範）
- `src/components/ControlTowerPanel.tsx`（修改目標）
- `src/components/SprintProgress.tsx`（了解現有 Sprint component，暫時保留不動）
- `src/styles/control-tower.css`（樣式擴充）
- `src/locales/en.json`、`zh-TW.json`、`zh-CN.json`（i18n）

### 參考資料（另一專案的真實 BMad 產出物）
- **路徑**：`D:\ForgejoGit\2026_Cooperative\_bmad-output\`
- **用途**：了解 BMad 產出物的實際檔案結構和格式
- **注意**：此路徑僅供參考格式用，不要修改該專案的任何檔案
- 掃描該目錄結構（ls -R），記錄實際有哪些檔案、放在哪個子目錄

### 輸入上下文

將塔台的 Sprint 頁籤改造為 **Workflow** 頁籤，顯示 BMad-Method 四大階段的完成狀態。

**核心設計**（來自 T0070 分析報告 D-2）：
- 4 個 Phase（Analysis / Planning / Solutioning / Implementation）
- 每個 Phase 列出預期產出物（artifacts）
- 用**檔案存在性**判斷完成狀態（NOT_STARTED / PARTIAL / DONE）
- 已存在的 artifact 可 [瀏覽檔案]
- Phase 定義使用硬編碼對應表（T0070 D-2 中已定義）

**空狀態處理**：本專案 `_bmad-output/` 目前全空，需要友善的空狀態提示（如：「尚未啟動 BMad 流程。使用 bmad-guide 了解如何開始。」）

**頁籤重命名**：Sprint → Workflow

### 預期產出

#### 新建檔案
1. **`src/types/bmad-workflow.ts`** — BMad 流程資料模型
   - `PhaseStatus`, `BmadPhaseArtifact`, `BmadPhase`, `BmadWorkflow` interfaces
   - `PHASE_DEFINITIONS` 硬編碼對應表（參考 T0070 D-2 的定義，用參考專案的實際結構校準）
   - `buildBmadWorkflow(artifacts)` 函數：接收檔案存在性清單，回傳 `BmadWorkflow`
   - `phaseStatusColor()`, `phaseStatusLabel()` 工具函數

2. **`src/components/BmadWorkflowView.tsx`** — Workflow 頁籤 component
   - Props: `{ workflow: BmadWorkflow | null, loading: boolean, ctDirPath: string }`
   - 功能：
     - Phase 列表（4 個大階段，顯示名稱 + 狀態 badge + 進度指示）
     - 每個 Phase 可展開看 artifacts 清單（檔案名 + 存在/不存在 icon + [瀏覽檔案]）
     - 整體進度概覽（如：2/4 phases complete）
     - 空狀態：當 `_bmad-output/` 不存在或全空時顯示引導提示
     - Phase 1 標示為「可選」

#### 修改檔案
3. **`src/components/ControlTowerPanel.tsx`**
   - `CtTab` 類型：`'sprint'` → `'workflow'`（或保留 sprint 作為 internal key，UI label 改為 Workflow）
   - 新增 `bmadWorkflow: BmadWorkflow | null` state
   - 新增 `loadBmadWorkflow()` callback：
     - 偵測 `_bmad-output/` 是否存在
     - 逐一檢查每個 Phase 的 artifact 檔案是否存在（用 `fs:readFile` try/catch 或新增 `fs:exists` 簡易檢測）
     - 建構 `BmadWorkflow` 物件
   - `fs:changed` handler 中觸發 `loadBmadWorkflow()`
   - Workflow tab 條件渲染 `<BmadWorkflowView>`
   - **暫時保留 SprintProgress component**（不移除不修改，但如果 sprint-status.yaml 不存在就不渲染）

4. **`src/styles/control-tower.css`** — 新增 Workflow 樣式
   - `.ct-workflow-phase` 階段卡片
   - `.ct-phase-status-*` 狀態顏色（not-started: gray, partial: amber, done: green）
   - `.ct-artifact-item` 產出物列表項
   - `.ct-artifact-exists` / `.ct-artifact-missing` 存在/不存在視覺區隔
   - `.ct-workflow-empty` 空狀態樣式

5. **`src/locales/en.json`** — tab.workflow + workflow.* 翻譯鍵
6. **`src/locales/zh-TW.json`** — 同上（繁體中文）
7. **`src/locales/zh-CN.json`** — 同上（簡體中文）

### 驗收條件
- [ ] Sprint tab 重命名為 Workflow（UI label）
- [ ] Workflow 頁籤正確顯示 4 個 Phase
- [ ] Phase 1 標示為「可選」
- [ ] 每個 Phase 可展開看 artifacts 清單
- [ ] Artifact 正確顯示存在/不存在狀態
- [ ] 已存在的 artifact 有 [瀏覽檔案] 按鈕
- [ ] 空狀態（`_bmad-output/` 全空）顯示引導提示
- [ ] 整體進度概覽正確
- [ ] Phase 定義表已用參考專案的實際結構校準
- [ ] SprintProgress 保留不動（sprint-status.yaml 存在時仍可渲染）
- [ ] 現有功能無 regression
- [ ] `npx vite build` 編譯成功
- [ ] i18n 三語系完整

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. **先掃描參考專案**：`ls -R "D:/ForgejoGit/2026_Cooperative/_bmad-output/"` 了解實際檔案結構
4. 讀取 T0070 分析報告 D-2（Phase 定義和資料模型）
5. 用參考專案的實際結構校準 `PHASE_DEFINITIONS` 對應表
6. 新建 `src/types/bmad-workflow.ts`
7. 新建 `src/components/BmadWorkflowView.tsx`
8. 修改 `src/components/ControlTowerPanel.tsx`
9. 更新 CSS 和 i18n
10. `npx vite build` 確認編譯成功
11. 填寫回報區

### 執行注意事項
- 參考專案路徑 `D:\ForgejoGit\2026_Cooperative\_bmad-output\` 僅供**讀取參考**，不修改
- 檔案存在性檢測：用 `fs:readFile` try/catch（若回傳錯誤 = 不存在），或用 `fs:readdir` 列目錄
- 不要用 Node.js `fs.existsSync`（renderer 進程無法直接用）
- Phase 定義表內的 artifact displayName 使用英文（i18n 可後續擴充）
- 遵循 CLAUDE.md No Regressions Policy

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**新建檔案**：
- `src/types/bmad-workflow.ts` — PhaseStatus/BmadPhaseArtifact/BmadPhase/BmadWorkflow types + PHASE_DEFINITIONS 對應表 + buildBmadWorkflow() + phaseStatusColor/Label 工具函數
- `src/components/BmadWorkflowView.tsx` — Workflow 頁籤 component，含 PhaseCard、ArtifactItem 子元件、空狀態、進度概覽、展開/收合、瀏覽檔案按鈕

**修改檔案**：
- `src/components/ControlTowerPanel.tsx` — CtTab 'sprint'→'workflow'、新增 bmadWorkflow state + loadBmadWorkflow() 載入邏輯（readdir 偵測檔案存在性）、Workflow tab 永遠顯示、SprintProgress 保留在 workflow tab 內（條件渲染）
- `src/styles/control-tower.css` — 新增 ~180 行 workflow 樣式（.ct-workflow-*、.ct-phase-*、.ct-artifact-*、空狀態）
- `src/locales/en.json` — tab.sprint→tab.workflow、新增 workflow.empty/phasesComplete/optional
- `src/locales/zh-TW.json` — 同上（繁中）
- `src/locales/zh-CN.json` — 同上（簡中）

**Phase 定義表校準結果**（與 `D:\ForgejoGit\2026_Cooperative\_bmad-output\` 比對）：
- Phase 2: `ux-spec.md` → `ux-design.md`（實際檔名）
- Phase 3: 新增 `epics.md`（單檔）和 `implementation-readiness.md`
- Phase 4: `sprint-status.yaml` 在 `implementation-artifacts/`（確認正確）

### 互動紀錄
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-13 00:43 (UTC+8)
