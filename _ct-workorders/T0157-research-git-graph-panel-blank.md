# T0157-research-git-graph-panel-blank

## 元資料
- **工單編號**:T0157
- **任務名稱**:研究:Git 圖譜 panel 內容全黑根因診斷(BUG-037)
- **狀態**:DONE
- **類型**:research
- **互動模式**:**enabled**(允許 Worker 加 trace log 請使用者重測 / 提供截圖)
- **Renew 次數**:0
- **建立時間**:2026-04-18 00:00 (UTC+8)
- **開始時間**:2026-04-18 00:03 (UTC+8)
- **完成時間**:2026-04-18 00:23 (UTC+8)
- **關聯 BUG**:BUG-037
- **關聯 PLAN**:PLAN-014
- **前置工單**:T0155 / T0156
- **預計工時**:< 1 天(根因定位即可,不含修復)

---

## 研究目標

診斷 BUG-037 根因。使用者 dev 模式打開 Git 圖譜 panel 後內容全黑,需定位具體原因才能修復。

**本工單只做根因診斷**,修復由塔台根據結論另派工單(參考 BUG-033/T0146→T0147 處理模式)。

---

## 已知資訊

### 現象
`npm run dev` → 開啟 Git 圖譜 panel → panel body 全黑,無任何可見元素(無 commits graph、無 loading 提示、無 error 訊息)

### T0156 相關實作(commit `b313494`)
- `src/components/git-panel/GitGraphPanel.tsx`:LoadState discriminated union (idle/loading/ready/error),ResizeObserver 追蹤 body 高度
- `src/components/git-panel/SvgCommitGraph.tsx`:SVG + virtualization 渲染
- `src/components/git-panel/useVirtualizer.ts`:自製 windowed virtualization
- `src/components/git-panel/git-graph-panel.css`:全部 inline style 遷出到 CSS class

### Worker 在 T0156 已預警
遭遇問題 5:
> `ResizeObserver` 處理 docking 切換可能需要額外測試(panel 隱藏/顯示時 `clientHeight` 變為 0 → virtualization `visibleCount` 為 0 → 無 row 渲染,重顯時應自動復原,但建議 UAT 時確認)

這可能是根因之一,但不一定是唯一原因(可能多因素疊加)。

### T0154 benchmark 版能正常渲染
T0154 的 `_bench-screenshot-100k.png` / `_bench-screenshot-500k.png` 證明 `SvgCommitGraph` + `useVirtualizer` 架構在獨立 Vite benchmark 環境下可正常渲染。問題在**整合到 BAT Electron 環境後**出現。

---

## 候選根因清單(供 Worker 診斷優先序參考)

| # | 候選根因 | 優先級 | 驗證方式 |
|---|---------|--------|---------|
| 1 | ResizeObserver 邊緣案例:`clientHeight=0` → `visibleCount=0` | 🔴 High | 加 trace log 印 `clientHeight` 和 `visibleCount` |
| 2 | CSS 背景色衝突(panel / SVG 背景全黑) | 🔴 High | 檢查 `git-graph-panel.css` + DevTools 檢查 computed style |
| 3 | loadState 卡在 `idle` 或 `loading`(IPC 未觸發或 response 遺失) | 🟡 Med | 加 trace log 印 loadState 變化 |
| 4 | SVG `height` / `offsetTop` 計算為 0 | 🟡 Med | DevTools 檢查 SVG element 尺寸 |
| 5 | IPC `listCommits` 回傳空陣列(workspace context 問題) | 🟢 Low | 加 trace log 印 commits.length |
| 6 | 其他(Electron / Vite dev HMR / React StrictMode 雙重渲染等) | 🟢 Low | 若前 5 項都排除 |

---

## 研究指引

### 互動允許範圍(config `research_interaction: true`)

Worker **允許**:
- 加 trace log 或 `console.log` 到 GitGraphPanel / SvgCommitGraph / useVirtualizer
- 請使用者執行 `npm run dev` + 打開 Chrome DevTools 提供 console output
- 請使用者提供 DevTools Elements / Computed style 截圖
- 詢問使用者 workspace 狀態(是 BAT 本專案還是其他 repo?是 git repo 嗎?)

**每次互動最多 3 個問題**(依 config `research_max_questions`)。

### 預期研究步驟

1. **Static 分析**:先讀 `GitGraphPanel.tsx` / `SvgCommitGraph.tsx` / `useVirtualizer.ts` / `git-graph-panel.css`,找最可能的根因(若 CSS 背景全黑這類 trivial bug,可能靜態即可確認)
2. **若靜態無法確認**:加 trace log,請使用者 `npm run dev` + 打開 Chrome DevTools(F12),提供 console output
3. **定位根因**:可能是單一原因,也可能多因素疊加
4. **驗證假設**:Worker 可建議小改動請使用者 rebuild 快速驗證(但**不做完整修復** — 這是 T0158 範圍)

### 禁止項

- ❌ 不做完整修復(發現根因後回報,修復另派工單)
- ❌ 不修改核心模組(TerminalServer / PtyManager / dock 核心邏輯)
- ❌ 不擴大調查範圍(只聚焦 BUG-037,不順帶修其他)

---

## 預期產出

### 調查結論(必須可決策)

- **根因**:具體指出是候選根因的哪個(或多個),附證據(log / 截圖 / 代碼引用)
- **修復方向**:建議方案(可多個,帶推薦)
- **修復複雜度**:預估人時(避免 T0158 又派過大)
- **副作用風險**:修復後是否會影響其他 panel / 場景

### 工單回報區

- 完成狀態(DONE / PARTIAL / BLOCKED)
- 互動紀錄(若有 trace log 互動,格式:`[HH:MM] Q: ... → A: ... → Action: ...`)
- 根因定位(具體 + 證據)
- 修復建議(方案 A/B/... + 推薦)

---

## 互動規則

- **互動模式**:**enabled**
- 每次提問上限:3 個
- 提問格式:選項式 + 「其他:________」兜底
- 互動紀錄寫入回報區

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 互動紀錄

- `[00:05]` Q(第 1 輪,3 問):Q1 能否跑 dev?Q2 header 看得見嗎?Q3 觸發條件是什麼? → A:Q1=A 可以跑、Q2=A header 看得見下方 body 全黑、Q3=D 任何時候打開都黑 → Action:使用者提供截圖,觀察到中央 docking tab「Git 圖譜」active 但整個內容區域完全空白(連 panel header 的「Git 圖譜」title + ↻ 按鈕都看不見),矛盾於使用者 Q2=A 的主觀描述(使用者把 docking tab bar 當成 header)
- `[00:15]` Action:截圖啟發——panel **根本沒渲染出來**(不是 body 內部高度問題),懷疑 main zone 的 render 路徑漏 case。靜態檢查 `WorkspaceView.tsx` 的 `renderTabContent` switch,發現 **缺 `case 'git-graph'`**,default 回傳 null → 根因確認
- `[00:20]` Action:撤回預先加的 trace log(3 個檔案),靜態即可定案。無需使用者跑 runtime 測試

### 根因定位

**根因**:`src/components/WorkspaceView.tsx` line 925-1046 的 `renderTabContent` switch 缺 `case 'git-graph'`,當 panel docking 至 `main` zone(預設配置)且使用者切換到 Git 圖譜 tab,switch 落入 `default: return null`,整個中央區域渲染為空,只看到 `main-content` 背景色(`--bg-primary: #1e1e1e`)造成「全黑」視覺效果。

**證據**:
1. `WorkspaceView.tsx:925-1046` — switch 列出 terminal / files / git / github / snippets / skills / agents / control-tower,**無 git-graph**
2. `WorkspaceView.tsx:1041-1042` — `default: return null`
3. T0155 commit `881aba2` message 明確列出:「`src/App.tsx`: LazyGitGraphPanel + renderDockablePanel switch + 兩處 icon mapping」,**未提及 WorkspaceView.tsx**
4. T0155 commit message 也寫:「DockablePanel 新增 'git-graph' 成員,**預設落在 main zone**」——而 main zone 的 render path 是 `WorkspaceView.renderTabContent`,不是 `App.tsx.renderDockablePanel`(後者只處理 left/right sidebar)
5. 使用者截圖完全吻合:docking tab bar 有「Git 圖譜」(那是 WorkspaceView 的 tab bar,獨立渲染),但中央內容區域完全空(`renderTabContent` return null)
6. T0154 benchmark 能正常渲染——那是獨立 Vite dev 環境,不經 WorkspaceView

**性質**:
- [x] 單一原因
- [ ] 多因素疊加

**為何 T0156 靜態驗證未捕獲**:
- T0156 只改了 `GitGraphPanel.tsx` / `SvgCommitGraph.tsx` / `useVirtualizer.ts` / `git-graph-panel.css`(panel 內部),假設 panel 能被正確掛載(T0155 範圍)
- T0155 完成時只驗證「dist bundle 有 GitGraphPanel」(靜態 build 產物),未執行 runtime 跑 `npm run dev` + 切到 main zone 的 Git 圖譜 tab
- **Learning**:引入新 `DockablePanel` 成員時必須同時修改 **兩個 render 路徑**:
  1. `App.tsx::renderDockablePanel`(left/right sidebar)
  2. `WorkspaceView.tsx::renderTabContent`(main zone)
- **Learning**:這類多路徑渲染的架構容易造成「漏掉一個 switch case」的靜默 bug,建議 T0158 修復時一併考慮抽取 shared helper(方案 C)讓兩處共用,未來新增 panel 只改一處

### 修復方向

- **[A] 最小修改(推薦)**:在 `WorkspaceView.tsx:1030` 之後補 `case 'git-graph'`,照現有 pattern 直接 import `GitGraphPanel`(非 lazy,與 `GitPanel`/`FileTree` 一致)並包在 `<div className="workspace-tab-content">` 內。
  - 優:改動範圍小、低風險、符合現有 pattern、相容現有 import 結構
  - 缺:維持雙 render 路徑,未來再加新 panel 仍需改兩處(潛在重複 debt)
  - 人時:~30 分鐘(包含 import、補 case、驗證 build + dev 實際打開 Git 圖譜)

- **[B] lazy mount 維持一致**:在 WorkspaceView 也用 `React.lazy`,與 App.tsx 用同一個 `LazyGitGraphPanel`,並在外層包 Suspense fallback。
  - 優:與 App.tsx 行為一致(lazy chunk)
  - 缺:WorkspaceView 的 switch 其他 case 全部直接 import(非 lazy),單獨對 git-graph 做 lazy 不一致、需要處理 Suspense
  - 人時:~1 小時

- **[C] 架構重構**:抽取 `renderPanelContent(panel, ctx)` shared helper,讓 `App.tsx::renderDockablePanel` 與 `WorkspaceView::renderTabContent` 都呼叫同一 helper,消除雙路徑。
  - 優:結構性修復,防止未來再發生同類 bug
  - 缺:重構範圍大、需要小心 props 傳遞與回呼差異(App.tsx 與 WorkspaceView 的 context 不完全相同,如 terminals / hasGithubRemote 等)、潛在 regression 風險
  - 人時:~3-4 小時(含回歸測試)

- **推薦**:**方案 A**。BUG-037 是 T0156 UAT 失敗的 blocker,優先以最小修改快速復原功能。方案 C 的架構清理可另開獨立工單(建議類型:refactor,非 BUG 修復)在 Tα3 之後處理。

### 副作用風險

**方案 A 幾乎零副作用**:
- 只新增 case,不修改其他 panel 的 render 邏輯
- `GitGraphPanel` 本身已在其他路徑(left/right sidebar)經 App.tsx 測試過,可信度高
- 需驗證:`workspace.folderPath` 空值、workspace 未初始化等邊界狀況(GitGraphPanel 已有 `if (!workspaceFolderPath)` 保護)
- 需驗證:在 main zone 切換「終端 / 檔案 / Git / Git 圖譜 / GitHub」時 panel 正確 mount/unmount,不影響其他 panel 狀態

### 建議下一步

- [x] 派 T0158 修復工單(推薦方案:A,人時 ~30 分鐘,commit type `fix`)
- [ ] T0158 DoD 建議:
  1. 在 `WorkspaceView.tsx` 補 `case 'git-graph'`
  2. Runtime 驗證:`npm run dev` → 切到 Git 圖譜 tab → 能看到 panel header + body(依 workspace repo 狀態顯示 SVG graph / loading / error / not-a-repo)
  3. Regression 驗證:其他 main zone docked panels(files / git / github 等)仍正常
  4. 回歸 T0156 DoD(能看到 BAT 本專案 ~1000 個 commits 的 SVG graph)
- [ ] (可選)長期:另開 refactor 工單處理方案 C(shared panel render helper)

### Renew 歷程
無

### 遭遇問題
無。靜態分析 + 使用者 1 輪互動即定案,未進入 runtime trace log 階段即關閉。預先加的 trace log 已完整撤回(`git diff` 為空)。

### 回報時間
2026-04-18 00:23 (UTC+8)

### Commit
`378a124` — docs(ct): T0157 研究收尾——BUG-037 根因為 WorkspaceView 缺 git-graph case
