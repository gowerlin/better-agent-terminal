# T0102 — CT 面板資料來源診斷

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0102 |
| **標題** | CT 面板各頁籤資料來源診斷 |
| **類型** | 診斷 / 分析 |
| **狀態** | ✅ DONE |
| **開始時間** | 2026-04-13 18:14 UTC+8 |
| **完成時間** | 2026-04-13 18:17 UTC+8 |
| **優先級** | 高 |
| **建立時間** | 2026-04-13 18:11 UTC+8 |
| **相關** | D030（索引架構改革決策，待 T0102 完成後確立） |

---

## 背景

Control Tower 目前維護多個 index 檔：
- `_bug-tracker.md`
- `_workorder-index.md`
- `_backlog.md`
- `sprint-status.yaml`

這些 index 與 workorder 源文件（T####.md / BUG-###.md / PLAN-###.md）之間存在**雙重維護問題**：
任何狀態變更都需要同步更新 index，人工維護容易遺漏，導致索引偏差。

**改革方向**（待本診斷確認可行性）：
- 讓 `_bug-tracker.md` 改為 `*sync` 自動重建（非人工維護）
- 評估 `_workorder-index.md` 和 `_backlog.md` 是否可以直接移除
- 精簡 `sprint-status.yaml`

**關鍵前提**：在決定哪些 index 可移除之前，必須先確認 BAT（Electron UI）的每個 CT 頁籤實際讀取哪些文件。因為 Tower 和 BAT 是兩個獨立的消費者，需求不同。

---

## 目標

列出 CT 面板每個 UI 元件/頁籤的**實際資料來源**（讀哪些文件？用什麼格式 parse？），讓塔台能做出有依據的索引架構決策。

---

## 任務清單

### 1. 找出所有 CT 面板相關元件

掃描以下路徑：
```
src/components/     → 找 CT / ControlTower / BugTracker / Backlog / Sprint / Workorder 相關元件
src/types/          → 找 parser / type 定義（如 bug-tracker.ts, control-tower.ts）
electron/           → 找 file watch / IPC handler（main.ts / preload.ts）
```

重點找：
- `BugTrackerView.tsx`（或同等元件）
- CT 主面板元件（WorkorderList？CTPanel？）
- Backlog / Sprint / Decision 頁籤元件
- 任何讀取 `_ct-workorders/` 目錄的地方

### 2. 對每個元件，記錄

```
元件名稱：
  讀取文件：（具體路徑或模式，如 _bug-tracker.md / T*.md / 全掃描）
  讀取方式：（IPC 呼叫 / 直接 file read / file watch）
  Parse 邏輯：（section 標題 / YAML / 正則 / 自訂 parser）
  UI 呈現：（列表 / 看板 / 統計數字）
  硬相依：（若缺少這個檔案，UI 會壞掉？）
```

### 3. 整理 file watch 範圍

在 `electron/main.ts`（或相關 IPC handler）中找出：
- file watch 監聽哪些路徑？
- 哪些文件改變會觸發 UI 重新載入？
- 新建檔案是否在 watch 範圍內？（BUG-025 的根因）

### 4. 填寫回報區的結論表格

---

## 不在範圍

- 不需要修改任何程式碼
- 不需要執行 build 或 runtime 測試
- 只做靜態分析（讀 source code）

---

## 交付物

回報區填寫：
1. **頁籤資料來源對照表**（每個 UI 元件 → 讀哪些文件）
2. **硬相依清單**（哪些 index 若移除會讓 UI 壞掉）
3. **可安全移除的 index 清單**（Tower 和 BAT 都不硬相依的）
4. **架構建議**（基於分析，提出索引改革的具體可行方案）

---

## 回報區（Worker 填寫）

### 執行摘要

靜態分析完成。掃描了 `src/components/`（37 個元件）、`src/types/`（14 個 type 文件）、`electron/main.ts` 和 `electron/preload.ts`。

**關鍵發現**：
- `_workorder-index.md` **UI 完全不讀取** — 可直接移除或改為 sync
- Orders 頁籤讀取**源文件目錄**（T####-*.md），不讀 index
- Bugs/Backlog/Decisions 頁籤各自硬依賴對應的 `_` 前綴 index 文件
- File Watch 只覆蓋 `_ct-workorders/`，`_bmad-output/` **未被監聽**

### 頁籤資料來源對照表

| UI 元件 / 頁籤 | 讀取文件 | 讀取方式 | Parse 方式 | 硬相依？ |
|--------------|---------|---------|-----------|---------|
| **Orders 頁籤** | `_ct-workorders/T####-*.md`（全目錄掃描）<br>歸檔: `_ct-workorders/_archive/workorders/*.md` | IPC `fs:readdir` + `fs:readFile` (per file) | `parseWorkOrder()`: 支援 table/list/YAML frontmatter 三種格式 | ✅ 目錄必須存在，否則顯示「未偵測」畫面 |
| **Epics 頁籤** (`kanban`) | `_bmad-output/planning-artifacts/epics.md` | IPC `fs:readFile` | `parseEpicsFile()`；可選 cross-ref sprint-status.yaml | ❌ 缺失顯示空狀態 |
| **Workflow 頁籤** | `_bmad-output/planning-artifacts/` 和 `_bmad-output/implementation-artifacts/`（只檢查文件存在性） | IPC `fs:readdir` × 2 | `buildBmadWorkflow(fileExistsMap)`：只看文件存在/不存在 | ❌ 缺失顯示空狀態 |
| **Bugs 頁籤** | 索引: `_ct-workorders/_bug-tracker.md`<br>詳情: `_ct-workorders/BUG-###-*.md`（懶載入） | IPC `fs:readFile` | `parseBugTracker()`: 分割 `## Status` section → 解析 Markdown table | ✅ `_bug-tracker.md` 缺失 → 空列表（功能喪失但不崩潰） |
| **Backlog 頁籤** | 索引: `_ct-workorders/_backlog.md`<br>詳情: `_ct-workorders/PLAN-###-*.md`（懶載入） | IPC `fs:readFile` | `parseBacklog()`: 分割 `## Status` section → 解析 Markdown table；row-level `狀態` 欄可覆蓋 section | ✅ `_backlog.md` 缺失 → 空列表 |
| **Decisions 頁籤** | `_ct-workorders/_decision-log.md`（單一文件，無個別決策文件） | IPC `fs:readFile` | `parseDecisionLog()`: 解析整個文件的 Markdown table；詳情從 raw content 提取 `### D###` block | ✅ `_decision-log.md` 缺失 → 空列表 |
| **Sprint Status**（跨功能） | 依優先序搜尋：`_ct-workorders/sprint-status.yaml` → `{workspace}/sprint-status.yaml` → `_bmad-output/...` → `docs/...` | IPC `fs:readFile`（逐一嘗試） | `parseSprintStatus()`：js-yaml 解析，容錯多格式 | ❌ 缺失 → sprintStatus=null，功能降級不崩潰 |

### File Watch 範圍

| 監聽目標 | 模式 | 防抖 | 觸發動作 |
|---------|------|------|---------|
| `_ct-workorders/` | `fsSync.watch(path, { recursive: true }, ...)` | 500ms | 重新載入**全部**資料：workOrders + sprintStatus + bugs + backlog + decisions + bmadWorkflow + epics |

**⚠️ 監聽缺口**：`_bmad-output/` 目錄**未被監聽**。Workflow 頁籤和 Epics 頁籤的資料變更後，需要手動點「↻」才會更新。

### 硬相依清單

| 文件 | 移除後果 | 影響 Tab | 可容忍？ |
|------|---------|---------|---------|
| `_ct-workorders/` 目錄 | UI 顯示「CT 未偵測」，**全部功能失效** | 全部 | ❌ 不可移除 |
| `_ct-workorders/_bug-tracker.md` | Bugs 頁籤顯示空列表 | bugs | ⚠️ 功能喪失但不崩潰 |
| `_ct-workorders/_backlog.md` | Backlog 頁籤顯示空列表 | backlog | ⚠️ 功能喪失但不崩潰 |
| `_ct-workorders/_decision-log.md` | Decisions 頁籤顯示空列表 | decisions | ⚠️ 功能喪失但不崩潰 |

### 可安全移除的 Index

| 文件 | 狀態 | 說明 |
|------|------|------|
| `_workorder-index.md` | ✅ **可完全移除** | BAT UI 完全不讀取。Orders 頁籤直接讀源文件目錄。只有 Tower（Claude）使用。 |
| `sprint-status.yaml` | ⚠️ **可精簡，不建議完全移除** | Epics 頁籤 cross-reference 用，缺失降級顯示。可精簡格式但保留文件。 |

### 架構建議

基於本次診斷，針對「索引架構改革（D030）」提出以下建議：

#### 1. `_workorder-index.md` → 立即可改為 sync 自動重建
- BAT 完全不讀取，Tower 是唯一消費者
- 自動重建（非人工維護）對 UI 零影響
- **建議**：立即採用，解除雙重維護問題

#### 2. `_bug-tracker.md` → 改為 sync 自動重建（需格式相容）
- Bugs 頁籤的核心 index
- `parseBugTracker()` 要求：`## StatusSection` 標題 + Markdown 表格，欄位包含 `ID, 標題, 嚴重度, 連結, 報修時間/關閉時間, 修復工單/相關工單`
- **建議**：可改為 sync 重建，但重建腳本必須維持此格式。等同讓 Tower 自動維護 `_bug-tracker.md`，BAT 繼續讀此文件。

#### 3. `_backlog.md` → 依功能取捨
- 若保留 Backlog 頁籤 → 必須保留（或 sync 重建）
- 若廢棄 Backlog 頁籤 → 可移除
- **建議**：保留並 sync 重建，格式要求同 bug-tracker（section + table）

#### 4. `_decision-log.md` → 保留，維護成本低
- 單一文件，無個別決策文件，維護相對簡單
- **建議**：保留人工維護即可，或改為 append-only 自動記錄

#### 5. File Watch 改善建議（額外發現）
- 目前 `_bmad-output/` 未被監聽，Workflow/Epics 頁籤資料不能自動刷新
- **建議**：增加 `_bmad-output/` 的 watch，在 ControlTowerPanel 的 useEffect 中加入第二個 watch

### 問題 / 卡點

無。靜態分析順利完成。

### 完成時間

2026-04-13 18:17 UTC+8
