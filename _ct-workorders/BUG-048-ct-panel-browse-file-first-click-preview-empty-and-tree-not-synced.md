# BUG-048 — 塔台「瀏覽檔案」首次點擊 Preview 空白 + 目錄樹未同步

## 元資料
- **編號**:BUG-048
- **狀態**:OPEN(研究完成,等下 session 派修復工單)
- **嚴重度**:🟡 Medium
- **建立時間**:2026-04-19 10:42 (UTC+8)
- **發現來源**:使用者回報(第十 session)
- **關聯**:T0206(研究,`c6d3d97`,DONE)· 下一張候選 T0207(Option B 修復)
- **可重現**:100%(特定條件下)
- **workaround**:現象 1 再按一次按鈕;現象 2 無 workaround

## T0206 研究結論(2026-04-19 11:32)

**觸發點全盤點**(5 處,行為同構):
| 位置 | 觸發 |
|------|------|
| BacklogView.tsx:180-181 | 瀏覽檔案按鈕 |
| BmadWorkflowView.tsx:139-140 | 同 |
| BugTrackerView.tsx:189-190 | 同 |
| ControlTowerPanel.tsx:695-696 | 同 |
| DecisionsView.tsx:82-83 | 同 |

**現象 1 根因**(100% 證據):React.lazy FileTree mount race
- Handler 同步 dispatch `workspace-switch-tab` + `file-tree-reveal`
- React.lazy + Suspense FileTree 首次需動態 import → 尚未 mount 時 listener 未註冊 → event 被丟棄
- 第二次點擊時 FileTree 已 mount → 正常
- 「彩蛋」:FileTree mount 會從 localStorage 還原上次選擇 → 解釋為何有時「空白」有時「錯誤檔」

**現象 2 根因**:`expandToPath` API **從未實作過**(git log `-S` 0 筆)
- FileTreeNode.expanded 是 local useState,外部無法驅動
- children 採 lazy readdir,程式化展開深層需遞迴實作
- 非 self-inflicted drift,純設計缺口(Q1.A 判定正確)

**推薦處理方向**:**Option B**(信心 High,est ~1.5-2h)
1. 解現象 1:pending queue 或 `requestAnimationFrame` 等 Suspense 解析
2. 解現象 2:FileTree 新增 `expandToPath()` 遞迴 API + FileTreeNode 改受控 expand

**Follow-up 建議**:Option C(5 處 dispatch 抽 `openFileInFilesTab()` helper)另開獨立工單,不綁在 BUG-048 主 PR。

**下 session 接手**:派 T0207(Option B 修復)。

## 現象

本 BUG 併入兩個相關問題,皆與塔台 CT Panel 內「瀏覽檔案」類按鈕(直接開啟主區檔案頁籤)有關。

### 現象 1:首次點擊 Preview 空白

- **觸發條件**:該 workspace **尚無任何檔案頁籤**開啟
- **行為**:第一次按「瀏覽檔案」→ 檔案頁籤開啟,但 Preview 空白
- **workaround**:再按一次同一「瀏覽檔案」按鈕 → Preview 正常顯示
- **推測方向**(待 Worker 研究):
  - Race condition:頁籤建立與 Preview 載入順序問題
  - 首次初始化 Preview 元件時狀態未就緒
  - 檔案讀取 / IPC 異步回呼錯過首次 render

### 現象 2:左側目錄樹未同步

- **預期**:點「瀏覽檔案」後,左側目錄樹應**展開**該檔案所在路徑並 **focus** 到該節點
- **實際**:目錄樹完全無反應
- **判定**(Q1.A):屬既有設計應有行為的缺失(非 feature request)
- **推測方向**(待 Worker 研究):
  - 檔案選取事件未廣播到 FileTree 元件
  - FileTree 有 focus API 但 CT Panel 瀏覽檔案按鈕未呼叫
  - 原本設計有同步機制,某次 refactor 後斷掉

## 已知觸發點

塔台 CT Panel 內至少以下 3 處按鈕符合「瀏覽檔案」模式(直接連接開啟主區檔案頁籤):

- **工單 panel**
- **臭蟲 panel**(Bug Tracker)
- **待辦池 panel**(Backlog)

**範圍待擴**(Q3.C):全 repo 盤點由 Worker 研究時 grep 確認,可能還有其他 panel(決策日誌 / FIELDGUIDE / Playbook 等)也有類似觸發點。

## 預期 vs 實際

| 情境 | 預期 | 實際 |
|------|------|------|
| 空 workspace 首次點擊 | Preview 立即顯示檔案內容 | Preview 空白,需再點一次 |
| 點擊後目錄樹 | 展開路徑 + focus 節點 | 目錄樹無變化 |

## 處理方向(三選一,待調查)

- [A] **Race condition 修復**(現象 1)+ 接入 FileTree focus API(現象 2)— 兩現象獨立修復
- [B] **統一重構 CT Panel 瀏覽檔案流程**:包一層 helper,處理 Preview 初始化 + 目錄樹同步 + 頁籤開啟的順序保證 — 根治但範圍大
- [C] **降級為 UX polish**:現象 1 在 Preview 空白時顯示 loading spinner + 自動重試一次;現象 2 獨立開 task 補 FileTree 同步 — 現象 1 走保守路線

## 建議下一步

開調查型工單(研究型)確認:

1. CT Panel 各「瀏覽檔案」按鈕的實作差異(grep 全 repo,盤點所有觸發點)
2. 檔案頁籤開啟流程(Tab 建立 → Preview 載入 → render)的時序,找首次點擊 race window
3. FileTree 現有 API(是否有 expand/focus method?),CT Panel 如何接入
4. 是否有歷史 commit 顯示曾實作過目錄樹同步(假設 Upstream drift)

## 備註

- **不派修復工單**:使用者決策「先記錄,稍後處理」(第十 session 優先級:等 T0203 / BUG-047 pre.2 收尾)
- **YOLO 不建議**:涉及 UI race + 跨元件事件流,建議走研究型工單先定位根因再修
- **與 BUG-042 共同主題**:兩者都涉及 UI 元件與 store / event 的連動缺失,修 CT Panel 時可檢視是否有系統性架構債
