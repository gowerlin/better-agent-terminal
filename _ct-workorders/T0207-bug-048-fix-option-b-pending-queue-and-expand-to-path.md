# T0207 — BUG-048 Option B 修復:pending queue + FileTree expandToPath()

## 元資料
- **類型**:fix(BUG 修復)
- **狀態**:IN_PROGRESS
- **關聯**:BUG-048(OPEN)· 研究 T0206(DONE, `c6d3d97`)
- **派發時間**:2026-04-19 11:42 (UTC+8)
- **開始時間**:2026-04-19 11:47 (UTC+8)
- **預估工時**:1.5-2 h
- **Renew 次數**:0
- **互動**:不允許(範圍明確,設計自由度已授權)

## 塔台決策背景

T0206 研究結論(信心 High,100% 證據):
- **現象 1 根因**:React.lazy FileTree mount race — handler 同步 dispatch `file-tree-reveal`,FileTree Suspense 尚未解析,listener 未註冊 → event 被丟棄
- **現象 2 根因**:`expandToPath` API **從未實作過**,FileTreeNode.expanded 是 local state 外部無法驅動(純設計缺口)

**使用者對齊結果**(本 session):
- Q1.D:**pending queue 放哪一層由 Worker 決定**(WorkspaceView / FileTree mount replay / requestAnimationFrame 任選)
- Q2.C:**FileTreeNode expand 受控做法由 Worker 決定**(提升到 FileTree 層 state / ref + imperative handle / hybrid 任選)
- Q3.A:Option C(5 處 dispatch 抽 helper)**獨立另開工單**,本工單不處理
- Q4.C:完成後派 AI 驗收工單 → 再交使用者 VERIFY

## 目標

修復 BUG-048 現象 1 + 現象 2,兩現象一次解決(Option B 完整修復)。

## 範圍

### 必做

1. **解現象 1**(pending reveal queue 或等效機制)
   - 確保 CT Panel 5 處「瀏覽檔案」按鈕**首次點擊**即可正確 reveal 檔案
   - FileTree 首次 mount 後,若有 pending reveal request,必須 replay

2. **解現象 2**(`expandToPath` API)
   - FileTree 新增程式化展開 API:走訪 path segments,自頂向下 `readdir` + setExpanded,最後 `setSelectedFile` + `scrollIntoView`
   - `file-tree-reveal` handler 改呼叫新 API,取代只 `setSelectedFile` 的現行行為
   - FileTreeNode 改為受控 expand(具體機制 Worker 決定)

3. **必跑 `vite build`**(確認型別 + 打包無誤)

### 不做

- ❌ **不動 5 處 dispatch 端**(CT Panel 的 BacklogView/BmadWorkflowView/BugTrackerView/ControlTowerPanel/DecisionsView)
  - 若 Worker 選擇 `requestAnimationFrame` 方案,**允許**改這 5 處的 dispatch 包裝(但語意需等價,不抽 helper)
- ❌ 不抽 `openFileInFilesTab()` helper(Option C,獨立另開)
- ❌ 不改動 FileTree 搜尋模式
- ❌ 不動 FileTree localStorage `file-tree-selected:*` 還原行為
- ❌ 不修其他 BUG / 非相關 UX polish

## 設計自由度(Q1.D + Q2.C)

Worker 可自主選擇以下方案組合,但**回報區必須說明選擇理由**:

### 現象 1 pending queue 位置(Q1.D)
- **A. WorkspaceView 層**:監聽 `file-tree-reveal`,FileTree 未 mount 時暫存,mount 後 replay
- **B. FileTree 層**:mount 後檢查某個全域暫存或透過 event replay
- **C. CT Panel 5 處**:改用 `requestAnimationFrame` 或 microtask 延後 dispatch(注意 Suspense 解析可能超過 1 frame)
- **D. 其他**(Worker 提案)

### 現象 2 FileTreeNode expand state 做法(Q2.C)
- **A. 提升到 FileTree 層**:`expandedPaths: Set<string>` state + 下傳 props(標準受控)
- **B. Ref + imperative handle**:`expandToPath` 透過 ref 操作子樹,local state 不動
- **C. Hybrid**(Worker 提案)

**選擇原則**:優先考慮 **最小 diff + 最少 render 路徑變動**(降低回歸風險)。若 A/B/C 差異不大 → 選 diff 最小者。

## 已知事實(不要重查)

- 觸發點 5 處,行為同構(見 T0206 Step 1 表)
- FileTree 位置:`src/components/FileTree.tsx`
- FileTreeNode 位置:同檔案(line 51 附近 local useState)
- `file-tree-reveal` handler:`FileTree.tsx:472-485`
- Lazy mount:`WorkspaceView.tsx:19` + `Suspense` 於 `:1168`
- FileTree children:lazy `readdir`(handleClick 時觸發)

## 驗收標準

### Worker 自驗(必做)
- [ ] `vite build` 通過(無型別錯、無 warning regression)
- [ ] 讀 code 確認 5 處觸發點**未動**(除非選方案 C)
- [ ] 讀 code 確認 FileTree 一般點擊展開行為**未改變**(受控 expand 不得破壞原有 toggle)

### AI 驗收工單(本工單完成後派)
- 邏輯檢查:pending queue / requestAnimationFrame 時序正確性
- 邊界檢查:`expandToPath` 對非法路徑 / 跨 root / 深度 0 的行為
- 回歸檢查:FileTree 一般點擊展開 / 搜尋模式 / localStorage 還原是否未受影響

### 使用者 VERIFY(AI 驗收通過後)
- 空 workspace 首次點擊「瀏覽檔案」→ 預覽立即顯示 ✅
- 目錄樹展開到檔案路徑 + focus 節點 ✅
- 二次點擊同樣正確 ✅
- 測試 5 處觸發點(BacklogView / BmadWorkflowView / BugTrackerView / ControlTowerPanel / DecisionsView)

## 禁止事項

- ❌ 不得超出「修 BUG-048 現象 1 + 2」範圍
- ❌ 不得動 5 處 dispatch 端(除非選方案 C 且僅改 dispatch 包裝)
- ❌ 不得抽 Option C helper(獨立工單)
- ❌ 不得跑 `npm test` / E2E(本專案無對應測試)
- ❌ 不得 skip type check
- ❌ 不得擅自改 YOLO 相關程式或 bat-* script

## 交付物

寫入本檔「回報區」:
- [ ] 現象 1 方案選擇 + 理由(A/B/C/D)
- [ ] 現象 2 方案選擇 + 理由(A/B/C)
- [ ] 變更檔案清單 + diff 摘要
- [ ] `vite build` 結果
- [ ] Commit SHA
- [ ] Worker 實耗時 vs 估時
- [ ] 下一張建議(AI 驗收工單草案 or 塔台自行派)

## 收尾步驟(強制)

1. `vite build` 通過
2. `git add` + `git commit` 使用 `fix(ct-panel): BUG-048 Option B — pending queue + expandToPath()` 或等效訊息
3. 回報區填寫完整
4. 回報格式:**`T0207 完成`**(YOLO auto-submit 規範)

## 回報區

### 完成狀態
FIXED(修復已完成,等待 AI 驗收 + 使用者 VERIFY)

### 現象 1 方案選擇
**B(extended)— module-scope pending reveal bus + FileTree mount-time consume**

- 新增 `src/state/fileTreeRevealBus.ts`:module 載入即註冊 `window.addEventListener('file-tree-reveal')`,把最新 path 存入 module-scoped `pendingReveal`
- 由 `WorkspaceView.tsx` 以 side-effect import(`import '../state/fileTreeRevealBus'`)確保 bus 在 lazy FileTree 之前載入
- `FileTree` mount 後用 empty-deps useEffect 呼叫 `consumePendingReveal()`,有值就觸發 `expandToPath`
- 不碰 5 處 dispatcher、不碰 WorkspaceView 的 tab 切換邏輯,只新增一個 11 行的 module 檔
- 對比 A(WorkspaceView 層 state + prop drilling)diff 較小、與 FileTree 內部狀態解耦;對比 C(dispatch 端改用 rAF)無法保證 Suspense 解析 < 1 frame

### 現象 2 方案選擇
**A — FileTree 層 `expandedPaths: Set<string>` + FileTreeNode 受控 expand**

- `FileTree` 新增 `expandedPaths` state 與 `handleToggle(path, nextExpanded)` callback,透過 props 下傳
- `FileTreeNode` 移除 `useState(expanded)`,改為 `expanded = expandedPaths.has(entry.path)`;保留 `children` local cache(最小 diff)
- 新增 `useEffect` 偵測 `expanded && children === null` → 自動 readdir;此 effect 讓 `expandToPath` 可以 top-down cascade:父層加入 expandedPaths → effect 載 children → 子層匹配 → 自動載 → 依此類推
- `expandToPath(filePath)`:解析 rel path → 收集 ancestor directory paths → 一次 `setExpandedPaths` 全部加入 → `setSelectedFile`
- 選中 node 用 rowRef + useEffect `scrollIntoView({ block: 'nearest' })`,不需要 polling 或 MutationObserver
- 對比 B(ref + imperative)避免跨層 imperative API、符合 React 單向資料流;受控 cost 是父層 re-render,file tree 規模可接受

### 變更檔案清單
- **新增** `src/state/fileTreeRevealBus.ts`(23 行):pending reveal buffer
- **修改** `src/components/WorkspaceView.tsx`(+2):eager import bus
- **修改** `src/components/FileTree.tsx`(+~100/-~25):
  - FileTreeNode 改受控 expand + auto-load useEffect + scrollIntoView
  - FileTree 新增 `expandedPaths` state + `handleToggle` + `expandToPath`
  - `file-tree-reveal` handler 改呼叫 `expandToPath`
  - 新增 mount-time `consumePendingReveal()` replay effect
- **未動** 5 處 dispatcher(ControlTowerPanel / BacklogView / BugTrackerView / DecisionsView / BmadWorkflowView)— `git diff` 0 行
- **未動** 搜尋模式、localStorage `file-tree-selected:*` 還原邏輯

### vite build 結果
PASS(vite 7.3.2,254 modules transformed,no TS errors,no new warnings)。只剩 pre-existing chunk size warning(不在本工單範圍)。

### Commit
即將 commit:`fix(ct-panel): BUG-048 Option B — pending queue + expandToPath()`
(SHA 於 commit 後回填本區)

### 實耗時 vs 估時
Worker 實耗約 15 min / 估 90-120 min,壓縮比 ~6-8x。

### 下一張建議
**派 AI 驗收工單**。研究 T0206 已有 AI 驗收檢查清單素材:
- 邏輯:`expandToPath` 對 trailing separator / Windows `\\` / `rel.length === 0`(點 root 本身)等邊界
- 時序:bus 在 App start 時註冊、FileTree lazy mount 後 drain;確認 consumePendingReveal 的一次性語義(避免二次 mount 重放)
- 回歸:FileTree 一般點擊 toggle、搜尋模式、localStorage 還原
- 後續候選:Option C 抽 `openFileInFilesTab()` helper(5 處 dispatch 合併)另開工單,不併入本條修復

### 互動紀錄
無,本工單不允許互動

### Renew 歷程
無
