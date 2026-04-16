# 工單 T0121-ct-workspace-switch-audit

## 元資料
- **工單編號**：T0121
- **任務名稱**：研究：CT 面板全頁籤 workspace switch 合規性盤點
- **狀態**：DONE
- **類型**：research
- **互動模式**：enabled
- **Renew 次數**：0
- **建立時間**：2026-04-16 12:15 (UTC+8)
- **開始時間**：2026-04-16 12:45 (UTC+8)
- **完成時間**：2026-04-16 12:53 (UTC+8)

## 研究目標

盤點 CT 面板所有頁籤在**切換工作區（workspace）**時，是否正確：
1. 偵測 workspace 變更事件
2. 重新載入該工作區的資料（而非顯示前一個工作區的殘留資料）
3. 處理目標工作區缺少某些檔案的情況（如無 `_decision-log.md`）

## 已知資訊

**歷史修復**：
- T0076 修復了 BUG-017/018/019/020（workspace switch 問題）
- 修復範圍：BMad Workflow、Epics、其他頁籤

**T0076 之後新增/大幅修改的元件**（可能未納入 workspace switch 邏輯）：
- Sprint Dashboard（T0114，新增頁籤）
- Decision Parser（T0119，v3+v4 雙格式）
- 刷新機制（T0120，resetWatch + .git 監聽）
- Bug Tracker / Backlog 索引重建邏輯

## 調查範圍

### 逐頁籤檢查清單

| # | 頁籤 | 元件 | 檢查項 |
|---|------|------|--------|
| 1 | 總覽（Sprint） | SprintDashboard 或同等 | workspace switch 時重讀 sprint-status.yaml？ |
| 2 | 工單（Orders） | WorkOrdersView 或同等 | workspace switch 時重掃 T*.md？ |
| 3 | 史詩（Epics） | BmadEpicsView 或同等 | T0076 已修，確認仍正常 |
| 4 | 工作流程（Workflow） | BmadWorkflowView 或同等 | T0076 已修，確認仍正常 |
| 5 | 臭蟲（Bugs） | BugTrackerView 或同等 | workspace switch 時重讀 _bug-tracker.md？ |
| 6 | 待辦池（Backlog） | BacklogView 或同等 | workspace switch 時重讀 _backlog.md？ |
| 7 | 決策（Decisions） | DecisionsView 或同等 | workspace switch 時重讀 _decision-log.md？ |

### 每個頁籤需確認的 3 件事

1. **有沒有監聽 workspace 變更？**（useEffect dependency、event listener、store subscription）
2. **變更時有沒有重新載入資料？**（呼叫 load/fetch 函式）
3. **目標工作區缺檔時的 fallback？**（空狀態 UI 還是報錯？）

### 額外檢查

- `ControlTowerPanel.tsx` 的 workspace 切換邏輯是統一的還是各頁籤自己處理？
- file watcher（T0120 的 resetWatch）在切換 workspace 時有沒有重建？
- `.git/` 監聽（T0120 P1）切換 workspace 後是否指向新的 `.git/` 目錄？

## 研究指引

1. 從 `ControlTowerPanel.tsx` 入手，找到 workspace/activeWorkspaceId 的 prop 或 state
2. 追蹤它如何傳遞給各子元件
3. 檢查每個子元件是否有 `useEffect([workspaceId], ...)` 或同等邏輯
4. 特別關注 T0076 之後新增的元件
5. 產出一份合規性報告，標明每個頁籤的狀態：✅ 合規 / ⚠️ 部分 / ❌ 缺失

## 互動規則
- Worker 可主動向使用者提問以縮小範圍
- 每次提問不超過 3 個問題
- 每個問題提供選項 + 「其他：________」兜底
- 互動紀錄寫入回報區

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 互動紀錄
無（純程式碼追蹤，無需使用者互動）

### 調查結論

**架構重要發現**：CT 面板採用「多實例架構」，不是單一元件切換 workspace。

- App.tsx 為每個 workspace 渲染獨立的 `WorkspaceView` → 各自獨立的 `ControlTowerPanel` 實例
- workspace 切換是 CSS `.active`/`.hidden` 切換（App.tsx:961），不更換 `workspaceFolderPath` prop
- WorkspaceView 的 tab 系統使用 `visibility` 而非 mount/unmount（layout.css:419-432），一旦開啟就持久掛載
- `isVisible` 對所有實例都是 `true`（WorkspaceView.tsx:1019），背景 workspace 的 watcher 持續運行保持資料新鮮
- 所有子元件僅接收 **props**，不自行載入資料

**逐頁籤合規性報告**：

| # | 頁籤 | 監聽 workspace？ | 切換時重載？ | 缺檔 fallback？ | 判定 |
|---|------|-----------------|-------------|-----------------|------|
| 1 | 總覽（Sprint） | ✅ 父元件 `loadSprintStatus` 依賴 `workspaceFolderPath` | ✅ 多實例獨立載入 | ✅ 顯示「未找到 sprint-status.yaml」空狀態 | ✅ 合規 |
| 2 | 工單（Orders） | ✅ 父元件 `loadWorkOrders` 依賴 `ctDirPath` | ✅ 多實例獨立載入 | ✅ `hasCtDir=false` 顯示未偵測提示 | ✅ 合規 |
| 3 | 史詩（Epics） | ✅ 父元件 `loadEpics` 依賴 `bmadOutputPath` | ✅ 多實例獨立載入 | ✅ 空陣列 → 空狀態 | ✅ 合規 |
| 4 | 工作流程（Workflow） | ✅ 父元件 `loadBmadWorkflow` 依賴 `bmadOutputPath` | ✅ 多實例獨立載入 | ✅ `allEmpty` → 空狀態 | ✅ 合規 |
| 5 | 臭蟲（Bugs） | ✅ 父元件 `loadBugs` 依賴 `ctDirPath` | ✅ 多實例獨立載入 | ✅ catch → 空列表 | ✅ 合規 |
| 6 | 待辦池（Backlog） | ✅ 父元件 `loadBacklog` 依賴 `ctDirPath` | ✅ 多實例獨立載入 | ✅ catch → 空列表 | ✅ 合規 |
| 7 | 決策（Decisions） | ✅ 父元件 `loadDecisions` 依賴 `ctDirPath` | ✅ 多實例獨立載入 | ✅ catch → 空列表 + 空 rawContent | ✅ 合規 |

**file watcher / .git 監聽**：
- resetWatch 在 workspace 切換時：✅ 不需處理。多實例架構下每個 workspace 的 watcher 獨立。`forceRefresh()` 使用當前 `ctDirPath`/`bmadOutputPath`。
- .git 監聽在 workspace 切換時：✅ 不需處理。watcher useEffect 使用 `workspaceFolderPath` 構建 `gitDirPath`，每個實例各自監聽自己的 `.git/`。cleanup 透過 closure 正確 unwatch 舊路徑。

**T0076 修復狀態**：仍有效。多實例架構本身就避免了 workspace 切換問題。

**T0076 之後新增元件**：
- SprintDashboard（T0114）：✅ 純 props，無 workspace 相關 state
- DecisionsView（T0119 v3+v4）：✅ 純 props，detail 從 rawContent prop 即時提取
- resetWatch/git 監聽（T0120）：✅ 依賴 React effect 系統，path 正確跟隨 workspace

**潛在低風險問題**（不影響多工作區主流程）：
1. `prevOrdersRef`（ControlTowerPanel.tsx:67）多實例下各自獨立無問題。若未來改為單實例切換模式，workspace 切換時未清空 prevMap 會導致誤觸 toast。
2. `detailCache`（BugTrackerView:26、BacklogView:23）多實例下各自獨立無問題。但若同一實例的 `ctDirPath` 改變，cache 未清空可能顯示舊展開內容。
3. 背景 workspace 的 ControlTowerPanel 持續 `isVisible={true}` → watcher 持續運行，有少量資源浪費但保持資料新鮮。

### 建議方向
- [A] 不需修改：多工作區模式下全部合規，低風險問題是 edge case
  - 優點：零風險，無程式碼變更
  - 缺點：背景 workspace 有輕微資源浪費
- [B] 防禦性加固：為 BugTrackerView 和 BacklogView 添加 `useEffect([ctDirPath], () => setDetailCache({}))` 清空 cache
  - 優點：消除所有 edge case，未來架構變更時不會出問題
  - 缺點：增加少量程式碼
- **推薦**：[A] 不需修改。架構健全，全部頁籤合規。低風險問題僅在「單實例切換 workspace」場景才會觸發，目前系統不存在此路徑。

### 建議下一步
- [x] 結論：全部頁籤合規，不需開實作工單
- [ ] 可選優化：若未來重構為單實例架構，屆時再處理 detailCache 和 prevOrdersRef 清空

### Renew 歷程
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-16 12:53 (UTC+8)
