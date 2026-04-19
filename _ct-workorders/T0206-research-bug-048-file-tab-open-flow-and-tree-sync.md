# T0206 — BUG-048 研究:主區檔案頁籤開啟流程 + 目錄樹同步全盤點

## 元資料
- **類型**:research(研究型 + 互動)
- **狀態**:IN_PROGRESS
- **關聯**:BUG-048 · 可能關聯(待 Worker grep 後補):MainPanel / FileTree / CT Panel 各區塊
- **派發時間**:2026-04-19 11:16 (UTC+8)
- **開始時間**:2026-04-19 11:27 (UTC+8)
- **預估工時**:45-90 min(範圍大,可能觸發互動)
- **Renew 次數**:0
- **互動**:允許(每次 ≤3 題,config `research_max_questions: 3`)

## 塔台決策背景

BUG-048 使用者回報:
- **現象 1**:CT Panel「瀏覽檔案」按鈕**首次點擊**(該 workspace 無既有檔案頁籤)→ 頁籤開啟但 **Preview 空白**,再按一次才正常
- **現象 2**:左側**目錄樹未同步** — 預期展開該檔案所在路徑並 focus 節點,實際無反應

已知觸發點:工單 / 臭蟲 / 待辦池 CT Panel(**至少** 3 處)。真實範圍未知。

**使用者決策**:
- Q1.A — 先研究再修(不直接派修復)
- Q2.C — **全 repo 盤點所有「開啟主區檔案頁籤」路徑**(最大範圍)
- Q3.A — 允許互動(smoke test / 設計意圖確認)

**兩現象判定**(Q1.A):都屬 bug(既有設計缺失),非 feature request。

## 目標

1. 盤點全 repo **所有開啟主區檔案頁籤的觸發點**(含 CT Panel、檔案樹、快速開啟、Command Palette、拖放等)
2. 定位現象 1 的 race window(首次點擊 vs 二次點擊差異原因)
3. 盤點 FileTree 現有 expand/focus API(或其缺失),評估目錄樹同步可行性
4. 比對各觸發點是否「應該」同步目錄樹 — 若有 subset 已同步 → 其他為缺漏;若全無 → 整個功能從未實作
5. 產出 A/B/C 處理方向建議(獨立修 / 統一重構 / UX polish)+ 理由
6. 回報 Git history 簡要(此功能是否曾存在過,參考 T0203 方法論 GP057)

## 已知事實(不要重查)

- BUG-048 至少 3 個觸發點:CT Panel 的工單 / 臭蟲 / 待辦池區塊的「瀏覽檔案」按鈕
- 使用者 workaround:現象 1 再按一次;現象 2 無 workaround
- 100% 可重現(空 workspace 首次點擊條件下)

## 調查步驟

### Step 1:全 repo 盤點「開啟主區檔案頁籤」觸發點

```bash
# 關鍵字搜尋:尋找所有可能的「開啟檔案」路徑
grep -rn "openFile\|addTab\|addFileTab\|openFilePath\|setActiveFile\|file.*tab\|tab.*file" src/ --include="*.{ts,tsx}" | head -50

# CT Panel 側:grep 所有「瀏覽檔案」按鈕觸發的 handler
grep -rn "瀏覽檔案\|browseFile\|browse.*file\|openInEditor\|open.*file\|viewFile" src/ --include="*.{ts,tsx}" | head -30

# Tab 管理 store / context
grep -rn "tabStore\|useTabStore\|activeTabId\|addTab\|tabs\s*:" src/ --include="*.{ts,tsx}" | head -30

# FileTree expand / focus API
grep -rn "expand.*path\|focus.*node\|revealInTree\|scrollIntoView.*tree\|FileTree" src/ --include="*.{ts,tsx}" | head -30
```

**交付**:表格列出所有觸發點
| 位置 | 觸發方式 | 目標 action | 是否同步目錄樹 |
|------|---------|-----------|---------------|

### Step 2:現象 1 — 首次點擊 Preview 空白 race 定位

- 讀取任一觸發點的完整流程(建議選 CT Panel 工單 panel 的「瀏覽檔案」作為 anchor)
- 追流程:按鈕 click → Tab 建立 → Preview 元件 mount → 檔案讀取 → Preview render
- 找出「首次 vs 二次」差異的可能點:
  - Preview 元件是否 lazy load?首次需要時間初始化?
  - File 讀取 IPC 是否 async?首次 state 不同步?
  - Tab active state 切換時序是否在 Preview 載入前 / 後?
  - useEffect deps 是否有 timing issue?
- 提出 race window 假設 + 驗證方法(reading code + 若需 smoke test 可問使用者)

### Step 3:現象 2 — 目錄樹同步可行性

- 讀 FileTree 元件實作,確認:
  - 有無 `expandPath(path)` / `focusNode(nodeId)` 類 API?
  - 有無 event emitter / store subscription 機制?
  - 目前哪些觸發點**有**呼叫?(例如使用者在 FileTree 本身點檔案時,path 應該是自己就 focus)
- 比對 CT Panel 各「瀏覽檔案」按鈕 → 是否有呼叫 FileTree sync?
- 判定:
  - **A. FileTree 有 API,CT Panel 沒接**(最常見,trivial fix)
  - **B. FileTree 無 API,需要新增**(中等複雜度)
  - **C. 現有實作有 bug,部分觸發點 OK 部分不 OK**(需補 upstream drift 假設)

### Step 4:Git history(選查)

若現象 2 的「未同步」行為看起來像**刻意不做**,grep git log 確認:
```bash
git log --all -p -S "expandPath\|focusNode\|revealInTree" -- src/ | head -100
```
若歷史曾存在過 → 參考 T0203 GP057 self-inflicted drift 假設

**不展開**:本 Step 只做 surface check,若 >10 min 無明確線索 → pause 回塔台

### Step 5:產出根因 + 推薦

填寫回報區,格式參考 T0203:

```markdown
## 現象 1 根因
- race window 定位
- 假設選定 + 證據

## 現象 2 根因
- FileTree API 現況
- 判定 A / B / C

## 觸發點全盤點表
- N 個觸發點清單

## 推薦處理方向
- Option A / B / C
- 理由 + 風險 + 範圍估算
```

## 禁止事項

- ❌ **不得修改任何程式碼**(純研究)
- ❌ 不得跑 `vite build` 或實際啟動 app
- ❌ 不得做 git commit(本工單只讀不寫程式)
- ❌ 不得給實作成本詳細估算(工單未要求 Q2.C 級細節)
- ❌ 不得擴大到「主區檔案頁籤以外」的 panel(保持在檔案頁籤開啟流程)

## 互動規則

- **啟用研究互動**(Q3.A),每次提問 ≤3 題
- **必須暫停回塔台**的情境:
  - Step 1 盤點發現 >15 個觸發點(範圍爆擊) → pause 讓塔台決策是否收斂範圍
  - Step 2 race window 定位需要使用者 smoke test 驗證(例如需要你用 Chrome DevTools 抓 timeline) → pause 問可否協助
  - FileTree API 設計意圖不明(看起來不像技術債但又沒接好) → pause 問使用者是否記得設計原始意圖
  - Git history 顯示「曾實作過目錄樹同步,後被移除」→ pause 回報並問塔台是否擴大到 T0203 類追溯
- **自主判斷邊界**:grep / 讀 code / 畫流程圖 → 自行完成

## 交付物

寫入本檔「回報區」:
- [ ] Step 1 觸發點全盤點表
- [ ] Step 2 現象 1 race 定位
- [ ] Step 3 現象 2 FileTree API 現況 + A/B/C 判定
- [ ] Step 4 Git history 簡要(若有線索)
- [ ] Step 5 推薦處理方向 + 理由
- [ ] Worker 實耗時 vs 估時

## 回報區

### 完成狀態
DONE — 研究型工單,未改程式碼

### 實耗時 vs 估時
實耗 ~35 min / 估 45-90 min(範圍收斂因觸發點只有 5 處且行為同構)

### 產出摘要
純 grep / 讀 code / 讀 git log,零檔案修改。

### 互動紀錄
無(範圍清晰、行為同構、無設計意圖模糊處,全程自主判斷)

### Renew 歷程
無

---

## 調查結論

### 名詞澄清(重要)

**本專案「主區檔案頁籤」 = WorkspaceView 的 sidebar-level `files` tab**,不是 per-file tab strip。
- 真正的「主區」(MainPanel) 跑 terminal / agent panels,與檔案預覽無關
- 「檔案預覽」在 `files` tab 內:FileTree(左)+ FilePreview split(右),靠 `selectedFile` state 控制
- CT Panel 的「瀏覽檔案」按鈕 = 切到 files tab + reveal 指定路徑

### Step 1 — 觸發點全盤點表

| # | 位置 | 觸發方式 | 派發事件 | 同步目錄樹 |
|---|------|---------|---------|-----------|
| 1 | `BacklogView.tsx:180-181` | 「瀏覽檔案」按鈕 click | `workspace-switch-tab` + `file-tree-reveal` | ❌ 只 `setSelectedFile` |
| 2 | `BmadWorkflowView.tsx:139-140` | 「瀏覽檔案」按鈕 click | 同上 | ❌ |
| 3 | `BugTrackerView.tsx:189-190` | 「瀏覽檔案」按鈕 click | 同上 | ❌ |
| 4 | `ControlTowerPanel.tsx:695-696` | 「瀏覽檔案」按鈕 click | 同上 | ❌ |
| 5 | `DecisionsView.tsx:82-83` | 「瀏覽檔案」按鈕 click | 同上 | ❌ |

- 全 repo 共 **5 個觸發點**,行為完全同構(複製貼上的 dispatch 兩行)
- 沒有其他路徑(FileTree 自家點擊、Git panel、Command Palette、拖放、快速開啟等皆無)
- App.tsx:413 的 `workspace-switch-tab` 是切到 terminal tab,不在本範圍

### Step 2 — 現象 1 Race Window 定位(100% 證據)

**Race chain**:
1. 使用者首次點「瀏覽檔案」— workspace 之前沒開過 files tab
2. Handler 同步執行:
   ```ts
   dispatchEvent('workspace-switch-tab', { tab: 'files' })   // (a)
   dispatchEvent('file-tree-reveal', { path: filePath })      // (b)
   ```
3. `(a)` 觸發 `WorkspaceView.handleSwitchTab`(`WorkspaceView.tsx:239-244`):`setActiveTab('files')` + `mountedTabs.add('files')`
4. React 尚未 re-render,`(b)` 已經 dispatch → 此時 FileTree **尚未 mount**,因為:
   - `WorkspaceView.tsx:19`:`const FileTree = lazy(() => import('./FileTree').then(...))`
   - `WorkspaceView.tsx:1168`:`<Suspense fallback={...}>` 包住 `renderTabContent()`
   - Lazy chunk 首次需動態 import,非同步
5. `FileTree.tsx:472-485` 的 `useEffect(() => addEventListener('file-tree-reveal', ...))` 在 mount 後才註冊
6. → `(b)` event 在 window 上 bubble 後**無 listener 接收,被丟棄**
7. 第二次點擊時 FileTree 已 mount + listener 已註冊 → 正常接收 → preview 顯示

**為何看起來有時正常**:FileTree 首次 mount 會從 `localStorage('file-tree-selected:<rootPath>')` 還原上次選的檔案(`FileTree.tsx:444-464`)。若使用者曾開過 files tab 並選過某檔案,回來首次點 CT Panel「瀏覽檔案」時,preview 會顯示**上次那個檔**(不是空白也不是目標檔)——這解釋為何有人只回報空白、有人回報「顯示錯的檔」。

**證據彙整**:
- ✅ 唯一 `file-tree-reveal` listener 在 FileTree 內 (grep 全 repo 驗證)
- ✅ FileTree 為 React.lazy + Suspense 包裹
- ✅ dispatch 順序同步,React batching 讓首次 render 一定晚於 dispatch
- ✅ 假設不需要 smoke test 驗證 — code evidence 已 self-contained

### Step 3 — 現象 2 FileTree API 現況

**判定:B — FileTree 無 `expandPath` / `revealInTree` 類 API,需新增**

`FileTree.tsx:472-485` 的 `file-tree-reveal` handler 全文:
```ts
const handler = (e: Event) => {
  const { path: filePath } = (e as CustomEvent).detail
  if (!norm(filePath).startsWith(norm(rootPath))) return
  const entry = { path: filePath, name: ..., isDirectory: false }
  setSelectedFile(entry)                                 // 只做這個
  localStorage.setItem('file-tree-selected:...', ...)    // 和這個
}
```

**缺失**:
- ❌ 未走訪 `filePath` 的 parent segments 載入並展開各層 directory
- ❌ 未 scrollIntoView 讓選取項在可視範圍
- ❌ FileTreeNode 的 `expanded` state 是 local `useState`(`FileTree.tsx:51`),僅 `handleClick` 內部 toggle,**外部無法驅動**

**結構限制**:children 採 lazy load — `handleClick` 時才 `readdir` 取得 children。若要程式化展開深層路徑,需遞迴 readdir + setExpanded,這是新邏輯而非 toggle。

**搜尋模式不是替代方案**:FileTree 的搜尋框只會顯示 flat search results(`FileTree.tsx:546-561`),不會展開樹。

### Step 4 — Git History(刪除假設否決)

```
git log --all --oneline -S "file-tree-reveal"
  b26c7ea T0072-T0074 BMad Workflow tabs          (新增 dispatch)
  9f62848 T0067-T0069 BUG/Backlog/Decisions tabs  (新增 dispatch)
  f6858cb ct-sync check + UI enhancements         (新增 dispatch)

git log --all --oneline -S "expandPath|revealInTree|scrollIntoView" -- src/
  (0 筆)
```

**結論**:expand/reveal 功能**從未實作過**。非 self-inflicted drift,是設計缺口(Q1.A 判定正確——bug 而非 feature request)。

---

## 推薦處理方向

### Option A — 最小修復(只修現象 1)
**內容**:現象 1 用延遲 dispatch 或 pending queue 繞過 lazy mount race;現象 2 不處理。

**成本**:~30 min  
**風險**:現象 2 未解,使用者仍會回報「目錄樹沒同步」(UX 只改善 50%)  
**不推薦** — 治標不治本

### Option B — 完整修復 ⭐推薦
**內容**:
1. **解現象 1**(pending reveal queue):
   - WorkspaceView 監聽 `file-tree-reveal`,若 FileTree 尚未 mount,暫存 path
   - FileTree 新增 mount 後 replay 機制(透過 event 或 prop)
   - 或更簡單:CT Panel 5 處改成 `requestAnimationFrame(() => dispatch(file-tree-reveal))` 等 Suspense 解析
2. **解現象 2**(新增 `expandToPath` API):
   - FileTree 新增 `expandToPath(path: string)`:走訪 path segments,自頂向下 `readdir` + setExpanded,最後 `setSelectedFile` + `scrollIntoView`
   - FileTreeNode 改為受控 expand:改接 `expandedPaths: Set<string>` prop 或改成 FileTree 層的 state tree
   - `file-tree-reveal` handler 改呼叫 `expandToPath` 取代 `setSelectedFile`

**成本**:~1.5-2 h  
**風險**:低 — expand 邏輯純新增,不動現有 click 行為;但 FileTreeNode 從 local state 改受控會碰 render 路徑,需回歸測試一般點擊展開  
**推薦**:現象 1/2 一次解,無折衷

### Option C — Option B + 呼叫端重構
**內容**:Option B + 把 5 處 CT Panel `dispatch` 抽成共用 `openFileInFilesTab(path)` helper。

**成本**:Option B + ~20 min  
**好處**:未來新增 CT Panel view 不會再複製貼上錯誤;有 single source of truth  
**評估**:抽 helper 建議**獨立 follow-up 工單**做,不要綁在 BUG-048 修復 PR(範圍才單純)

### 推薦路徑
- **主工單**:Option B(實作 `expandToPath` + pending queue)
- **Follow-up 工單(建議新開 T02XX)**:Option C helper 抽離 + 未來 CT Panel view 規範

---
