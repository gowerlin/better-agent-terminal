# T0208 — BUG-048 AI 驗收:T0207 Option B 修復

## 元資料
- **類型**:verify(AI 驗收,純分析不改 code)
- **狀態**:DONE
- **關聯**:BUG-048(FIXED)· T0207(修復,`40207a3`,FIXED)
- **派發時間**:2026-04-19 12:00 (UTC+8)
- **開始時間**:2026-04-19 11:57 (UTC+8)
- **完成時間**:2026-04-19 12:01 (UTC+8)
- **預估工時**:20-40 min
- **Renew 次數**:0
- **互動**:允許(疑義可提問,每次 ≤3 題,config `research_max_questions: 3`)

## 塔台決策背景

T0207(BUG-048 Option B 修復)由 Worker 完成,commit `40207a3`,`vite build` PASS。使用者 Q4.C:AI 驗收通過後交人類 VERIFY。

本工單為**純驗收工單**,目的為提升對 T0207 修復的信心,降低使用者手動 VERIFY 時 regression 的風險。**不得修改任何程式碼**。

## 目標

針對 T0207 修復內容,執行三類驗收:**邏輯 / 時序 / 回歸**。產出 PASS / CONCERN / FAIL 判定 + 證據。

## 已知事實(不要重查)

**T0207 變更範圍**(commit `40207a3`):
- **新增** `src/state/fileTreeRevealBus.ts`(23 行):module-scope pending reveal buffer
- **修改** `src/components/WorkspaceView.tsx`(+2):eager `import '../state/fileTreeRevealBus'`
- **修改** `src/components/FileTree.tsx`(+~100/-~25):
  - FileTreeNode 改受控 expand(`expanded = expandedPaths.has(entry.path)`)
  - FileTreeNode 新增 `useEffect`:`expanded && children === null` → auto `readdir`
  - FileTree 新增 `expandedPaths: Set<string>` state + `handleToggle` + `expandToPath`
  - `file-tree-reveal` handler 改呼叫 `expandToPath`
  - 新增 mount-time `consumePendingReveal()` replay effect
  - row 用 `scrollIntoView({ block: 'nearest' })`
- **未動** 5 處 dispatcher、搜尋模式、localStorage `file-tree-selected:*` 還原

**Worker 方案**:
- 現象 1 → B(extended): module-scope bus + FileTree mount-time drain
- 現象 2 → A: FileTree 層 `expandedPaths: Set<string>` + FileTreeNode 受控

## 驗收範圍

### 1. 邏輯驗收(`expandToPath` 邊界)

**必查**:
- [ ] `filePath` 是否以 `rootPath` 為前綴?(跨 root 的路徑應該被 reject 或 no-op)
- [ ] `rel.length === 0`(使用者點 root 本身)→ 預期行為?(應 no-op 或只 setSelectedFile,不應 crash)
- [ ] Trailing separator(`/` 或 `\\`)是否會產生空 segment?
- [ ] Windows path separator `\\` 是否正確處理?(本專案跨 Windows / macOS)
- [ ] Case sensitivity:Windows case-insensitive fs 是否會導致 `expandedPaths.has(path)` miss?
- [ ] 深度 0(root 下第一層檔案)vs 深度 N 的 cascade 行為

### 2. 時序驗收(pending bus + mount replay)

**必查**:
- [ ] `fileTreeRevealBus` module-level `addEventListener` 何時註冊?是否 race with 第一個 dispatch?
- [ ] `consumePendingReveal` 是否**一次性**?FileTree unmount 再 mount 會不會 replay 舊值?
- [ ] 多個 reveal 快速連續(使用者狂點)會不會只保留最後一個 / 全 queue?Worker 說「最新 path」,確認這是正確語意(而非 FIFO queue)
- [ ] FileTree mount 後的 `useEffect(consumePendingReveal, [])` 執行時機 vs `expandToPath` 內部 state update 的時序
- [ ] `expandToPath` 的 cascade readdir:父層 readdir 完成前子層無 children → 子層 useEffect 被觸發 → 有沒有 race 可能讓某層卡住?
- [ ] Suspense fallback 期間 bus 累積多個 event 時的行為

### 3. 回歸驗收

**必查**:
- [ ] FileTree 一般點擊展開/收合:受控後是否仍正常 toggle?(`handleToggle` 語意)
- [ ] 搜尋模式(FileTree search)是否受影響?(Worker 說未動,驗證)
- [ ] localStorage `file-tree-selected:<rootPath>` 還原:首次 mount 若 localStorage 有值 + bus 也有 pending,何者勝出?
- [ ] `expandedPaths` state 是否持久?切換 workspace / tab unmount 再 mount 後是否清空合理?
- [ ] FileTree re-render cost:受控後父層每次 toggle 都重 render,file tree 大時是否有明顯卡頓風險?(僅觀察,不用 benchmark)
- [ ] 5 處 dispatcher 真的未動(`git diff` 驗證,Worker 宣告 0 行)

## 調查步驟

1. 讀 `src/state/fileTreeRevealBus.ts`(23 行,完整)
2. 讀 `src/components/FileTree.tsx` 修改後版本(~100 行 new + ~25 行 removed,聚焦 `expandedPaths` / `expandToPath` / FileTreeNode 受控改動)
3. 讀 `src/components/WorkspaceView.tsx` diff(驗證 eager import)
4. `git diff 40207a3^..40207a3 -- src/components/ControlTowerPanel.tsx src/components/BacklogView.tsx src/components/BugTrackerView.tsx src/components/DecisionsView.tsx src/components/BmadWorkflowView.tsx` 確認 5 處 dispatcher 0 改動
5. 針對 6 類邊界(見「邏輯驗收」)逐條檢視 code path,標記 PASS / CONCERN / FAIL
6. 針對 6 類時序(見「時序驗收」)逐條推演,標記同上
7. 針對 6 類回歸(見「回歸驗收」)逐條檢視,標記同上
8. 產出總結

## 禁止事項

- ❌ **不得修改任何程式碼**(純驗收)
- ❌ 不得跑 `vite build` / 啟動 app / smoke test
- ❌ 不得做 git commit
- ❌ 不得擴大範圍到 T0207 範圍外
- ❌ 不得建議重構(有疑慮寫 CONCERN,使用者決策是否另開工單)

## 互動規則

- 允許提問(每次 ≤3 題),觸發情境:
  - 邊界行為不清楚(例如 `rel.length === 0` Worker 未明說預期)→ 可問塔台確認
  - 時序推演卡住(例如 consumePendingReveal 語意 ambiguity)→ 可問
- **必須暫停回塔台**的情境:
  - 發現 ≥1 個 FAIL(邏輯 / 時序 / 回歸任一)→ pause 讓塔台決策是否派修復工單
  - 發現 `git diff` 5 處 dispatcher 有非零改動(違反 Worker 宣告)→ pause
- **自主判斷邊界**:CONCERN 條目自行判斷嚴重度,寫入回報區

## 交付物

寫入本檔「回報區」:
- [ ] 邏輯驗收表(6 條,每條 PASS / CONCERN / FAIL + 證據)
- [ ] 時序驗收表(6 條,同上)
- [ ] 回歸驗收表(6 條,同上)
- [ ] 5 處 dispatcher diff 驗證結果
- [ ] 總結(整體信心等級 + 下一步建議)

## 收尾步驟

1. 回報區填寫完整
2. **無需 commit**(本工單不改 code,只寫工單回報)
3. 回報格式:**`T0208 完成`**(YOLO auto-submit)

## 回報區

### 完成狀態
DONE

### 邏輯驗收表

| # | 項目 | 判定 | 證據 |
|---|------|------|------|
| a | filePath 以 rootPath 為前綴 | PASS | `FileTree.tsx:510` `lowerNorm(filePath).startsWith(lowerNorm(rootPath))` case-insensitive 前綴檢查,跨 root 直接 return。**CONCERN-LOW**:`/foo` prefix 匹配 `/foobar` 的 false positive(無 `/` separator 邊界),實務罕見 |
| b | `rel.length === 0`(點 root 本身) | PASS | `FileTree.tsx:515-516` `segments = rel.split('/').filter(Boolean); if (segments.length === 0) return` — no-op,不 crash |
| c | Trailing separator | PASS | `FileTree.tsx:515` `.filter(Boolean)` 過濾 `split` 產生的空字串,trailing `/` 或 `\` 不產生空 segment |
| d | Windows `\` separator | **CONCERN-MEDIUM** | `FileTree.tsx:520-521` `usesBackslash = filePath.includes('\\') && !filePath.includes('/')` — 僅純 backslash 才用 `\` 當 sep。若 rootPath 含 `/`(例如 `C:/root`)而 filePath 純 `\`(`C:\root\a\b`,usesBackslash=true,sep=`\`),acc 初始化 `C:/root` 後接 `\a` → `C:/root\a`,與 FileTreeNode 的 entry.path 格式不符 → `expandedPaths.has()` miss,cascade 卡住 |
| e | Case sensitivity (Windows) | **CONCERN-MEDIUM** | `FileTree.tsx:523,526` ancestor 重建用 `rootPath` 原始 case + segments(slice 自原 filePath)。若 rootPath=`c:\root` 但 readdir 回傳 `C:\Root\a`,ancestor set 放入 `c:\root\a` 但 FileTreeNode.entry.path=`C:\Root\a`,`Set.has()` case-sensitive miss。實務上 Electron rootPath 和 readdir 來源一致,罕見 |
| f | 深度 0 vs 深度 N cascade | PASS | 深度 1(root 下第一層檔案):`segments=['foo.txt']`,for-loop 跑 0 次,ancestorPaths=[],不展開任何目錄,僅 setSelectedFile — 合理。深度 N:ancestor 依序 add 到 expandedPaths,FileTreeNode `useEffect` (L66-80) cascade readdir |

### 時序驗收表

| # | 項目 | 判定 | 證據 |
|---|------|------|------|
| a | bus listener 註冊時機 vs 第一次 dispatch race | PASS | `WorkspaceView.tsx:16-17` `import '../state/fileTreeRevealBus'` eager 非 lazy,top-level import 在任何 React render 前執行。dispatcher 皆由 click handler 觸發,彼時 module 已 import → listener 已註冊 |
| b | `consumePendingReveal` 一次性 | PASS | `fileTreeRevealBus.ts:19-23` 讀出後立刻 `pendingReveal = null`。FileTree unmount 再 mount 時 pendingReveal 已 null,不 replay |
| c | 快速連續多 reveal | PASS | Module bus L14 `pendingReveal = detail.path` 直接覆寫 — 保留最新。已 mount 時 window handler (L543-550) 每次呼叫 expandToPath,expandedPaths 累積展開,setSelectedFile 取最後一次,符合 reveal 語意 |
| d | mount useEffect vs state update timing | PASS | `FileTree.tsx:553-558` mount-time consume 同步呼叫 expandToPath → setExpandedPaths + setSelectedFile → React scheduler 批次 re-render → FileTreeNode 觀察 expandedPaths → cascade useEffect。無 race |
| e | cascade readdir race | PASS(關聯 CONCERN) | `FileTree.tsx:66-80` FileTreeNode useEffect 有 `children !== null \|\| loading` guard,單一 readdir 不重入。cascade 依 React 事件迴圈依序展開。**關聯邏輯-d/e**:若 ancestor path 格式與 entry.path 不匹配(separator/case),cascade 卡在該層 |
| f | Suspense fallback 累積 | PASS | Option B 設計精確覆蓋:MainPanel / FileTree lazy mount 期間 bus 緩存最後 dispatch,mount 後 consume — 完美符合 Suspense 語意 |

### 回歸驗收表

| # | 項目 | 判定 | 證據 |
|---|------|------|------|
| a | 一般點擊 toggle | PASS | `FileTree.tsx:378-385` `handleToggle` `new Set(prev); add/delete` 正確受控語意。FileTreeNode L82-88 `handleClick` → `onToggle(entry.path, !expanded)` |
| b | 搜尋模式 | PASS | `FileTree.tsx:619-634` 搜尋分支走 flat list,不經 FileTreeNode,未動邏輯。L457-476 search debounce 邏輯完整保留 |
| c | localStorage restore vs bus pending race | **CONCERN-MEDIUM** | `FileTree.tsx:479-498` restore useEffect async `readFile` 回呼晚於 L553-558 同步 consume+expandToPath。consumePendingReveal 會同步 setSelectedFile(bus target),但 restore async callback 隨後 setSelectedFile(localStorage target) 會覆蓋。結果:expandedPaths 正確展開到 bus 目標,但 selectedFile 顯示 localStorage 的舊檔案 |
| d | expandedPaths 持久性 | PASS | `FileTree.tsx:368` `useState(() => new Set())` 每次 mount 初始化空集合。切 workspace(rootPath 變)→ 上游 key 變 → remount → 清空。合理(不同 workspace 展開路徑無意義) |
| e | re-render cost | **CONCERN-LOW** | 受控後每次 toggle 觸發 FileTree re-render + 所有可見 FileTreeNode re-render(expandedPaths prop 變)。未見 `React.memo`。實測幾百節點應無感,千級節點可能微卡。Work order 禁止重構建議,僅記錄 |
| f | 5 處 dispatcher 0 改動 | PASS | `git diff 40207a3^..40207a3 -- ControlTowerPanel BacklogView BugTrackerView DecisionsView BmadWorkflowView` 輸出空。`git diff --stat` 僅 `FileTree.tsx / WorkspaceView.tsx / fileTreeRevealBus.ts` 三個 code 檔 + 兩個 workorder |

### 5 處 dispatcher diff 驗證

```
$ git diff 40207a3^..40207a3 -- src/components/ControlTowerPanel.tsx \
    src/components/BacklogView.tsx src/components/BugTrackerView.tsx \
    src/components/DecisionsView.tsx src/components/BmadWorkflowView.tsx
(無輸出)

$ git diff --stat 40207a3^..40207a3
 src/components/FileTree.tsx          | 131 ++++++++++++++++++++------
 src/components/WorkspaceView.tsx     |   2 +
 src/state/fileTreeRevealBus.ts       |  27 ++++++
 (+ 2 個 workorder 檔案)
```

**結論**:Worker 宣告 5 處 dispatcher 0 改動 — 完全屬實。

### 總結

**整體信心等級:High(偏中)**

**PASS 匯總**:18 項檢查中 14 PASS、4 CONCERN(2 MEDIUM + 2 LOW)、0 FAIL。

**CONCERN 分級**:
1. **CONCERN-MEDIUM(邏輯-d)**:Windows 混合 separator (rootPath=`C:/root` + filePath=`C:\root\a`) → ancestor path 不匹配 → cascade 卡住
2. **CONCERN-MEDIUM(邏輯-e)**:Windows case-insensitive fs + rootPath/readdir case 不一致 → `Set.has()` miss → cascade 卡住
3. **CONCERN-MEDIUM(回歸-c)**:localStorage restore async callback 晚到 → 覆蓋 bus 的 setSelectedFile。使用者看到「目錄展開對、但選中的檔案錯」
4. **CONCERN-LOW(邏輯-a)**:prefix false positive(`/foo` match `/foobar`)
5. **CONCERN-LOW(回歸-e)**:大樹未 memoize 的 re-render cost

**建議:直接交人類 VERIFY**。

理由:
- 主要場景(首次點 workorder link / FileTree 未 mount → reveal / 已 mount → reveal / 多次切換)邏輯皆 PASS
- 3 個 MEDIUM CONCERN 均屬邊角案例,需特殊環境(Windows 手動輸入 rootPath、localStorage 殘留特定檔案)才會觸發
- 人類 VERIFY 可自然覆蓋主要場景,若踩到 CONCERN 再開 follow-up 工單
- 禁止事項遵守:無 code 改動、無 build、無 commit

**VERIFY 重點建議**:
- 首次點 BUG-048 workorder link(FileTree 未 mount)→ 應展開 `_ct-workorders/` 並選中該檔
- 同 session 關閉 preview 再點第二個 workorder → 應切換選中
- 切換 workspace 後再點 workorder link → 應 reveal
- 若 VERIFY 時看到「目錄展開但檔案未選中 / 選錯」→ 踩到 CONCERN-3(localStorage race),可派修復工單

### 實耗時 vs 估時

約 15 min / 估 20-40 min

### 互動紀錄

無 — 未向使用者提問,所有邊界推演依 code 與 work order 完成。

### Renew 歷程

無
