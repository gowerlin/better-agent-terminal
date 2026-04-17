# Git GUI POC 驗證報告(T0153)

**工單**:T0153 POC:方向 B(Git GUI)三個高風險假設驗證 Spike
**關聯 PLAN**:PLAN-014
**前置工單**:T0152(Phase 1 紙上調研,commit `ef29bb2`)
**報告日期**:2026-04-17
**執行人**:sub-session worker
**狀態**:PARTIAL(本次僅完成紙上分析,實測需 Phase 3 實作後補充)

---

## 摘要

### 整體 POC 判定:🟡 partial go(Phase 3 可啟動,但需分階段)

**關鍵發現**:

1. **假設 1(graph 渲染)🟡 conditional go**:純 SVG 僅能撐 10k commits,超過必須 virtualization。Linux kernel 級別(1M+)需要 Canvas。**MVP α 可用 SVG + virtualization 撐 95% 真實 repo,1M+ 留到 Differentiator 階段**。

2. **假設 2(CT 工單反查)🟡 conditional go**:<100ms 流暢目標可達,但**必須預建 commit↔工單索引**。無索引時 100k commits scan 會超過 200ms。**索引為架構核心,不可選**。

3. **假設 3(interactive rebase)🔴 no-go 於自建,🟢 go 於 Lazygit 整合**:自建 GUI 版相比 Lazygit 無明顯增益。**推薦方向:BAT 一鍵開啟 Lazygit 在內部終端(利用 T0129),外加 CT 工單感知的 rebase todo 產生器**。

### 戰略意涵

- **MVP α 可行**:SVG graph + CT 反查 + 主流 Git 操作,預估 3-4 人週(比 T0152 原估 2-3 人週**略高**,因 virtualization 工作量)
- **MVP β 調整**:interactive rebase 改為 Lazygit 整合,**省 1-1.5 人週**;總 β 範圍預估 5-7 人週
- **Differentiator 延後**:Canvas 版大 repo、跨 workspace graph、sparse-checkout 等留到 Phase 4(不阻擋 β 發布)

### 本次 POC 的誠實限制

本 sub-session 僅完成**紙上深度分析 + POC 代碼骨架**,未完成:
- ❌ 實際 clone Linux kernel / React / Vue 測量 FPS
- ❌ 實際實作 SVG graph 並用 Chrome DevTools 錄 Performance trace
- ❌ 實際實作 CT 反查流程並量測延遲

原因:工單預計 2-3 週,單一 sub-session 容量不足。**建議塔台拆 3-5 張 Phase 3 子工單執行實測**。

---

## 假設 1:大 repo graph 渲染效能

### 測試方法(本次以紙上分析為主)

- **未執行的實測**:clone `torvalds/linux`(~1.3M commits)、`facebook/react`(~18k commits)、`vuejs/core`(~9k commits),逐一渲染後用 Chrome DevTools Performance 錄 scroll FPS
- **本次實際執行**:基於公開技術證據與開源案例比對,估算三種方案的規模上限

### 數據(基於公開案例推論)

| 方案 | 10k commits | 100k commits | 1M+ commits | 典型實作 |
|------|-------------|--------------|-------------|----------|
| 純 SVG(無 virtualization) | ~15-25 FPS | <5 FPS(不可用) | 崩潰 | gitgraph.js、教學用 graph |
| SVG + virtualization | 50-60 FPS | 30-45 FPS | ~10-20 FPS | 自製 + react-window |
| Canvas + virtualization | 60 FPS | 60 FPS | 45-60 FPS | GitKraken、GitLens webview |
| Canvas + worker thread layout | 60 FPS | 60 FPS | 60 FPS | GitKraken Enterprise |

**關鍵推論依據**:
- **VS Code Git Graph extension**(最熱門,~5M 下載):採用 Canvas,預設載 500 commits 分頁,實測在 Linux kernel repo 順暢
- **GitKraken**:Canvas + virtualization,官方聲稱支援「數千萬 commit」
- **SourceTree**:舊版 HTML/CSS 渲染,10 萬 commit 以上明顯卡頓,已知問題
- **gitgraph.js**(開源 SVG 庫):設計用途為教學/小型 graph,README 明確標示不適合大 repo
- **SVG 技術瓶頸**:每個 commit 至少 3-5 個 DOM node(圓點 + 線條 + label),10k commits = 30-50k DOM,接近瀏覽器 DOM 處理極限

### 結論:🟡 conditional go

**MVP α 推薦策略(3-4 人週)**:
- 技術棧:**React + SVG + react-window(或自製 virtualization)**
- 規模目標:≤10k commits 60 FPS,10k-50k commits ≥30 FPS(涵蓋 95% 真實專案)
- 降級:滾動超過 50k 範圍時顯示「使用 Load more」或分支切換提示

**MVP β 升級路徑(+2-3 人週)**:
- 若使用者回饋遇到大 repo(如 monorepo,100k+ commits),加入 **Canvas 渲染切換**
- 維持 SVG 作為預設(DOM 除錯友善、CSS 樣式彈性),Canvas 作為 opt-in

**Differentiator(Phase 4,+3-4 人週)**:
- Linux kernel 等 1M+ repo 支援:Canvas + web worker 做 layout,非同步產出 render data
- 此為「彰顯技術力」用途,非主力使用者需求

**風險清單**:
- ⚠️ react-window 對非定高 row 支援有限(commit row 可能因分支 merge graph 高度不同)→ 需自製或用 `react-virtuoso`
- ⚠️ SVG 的 `<path>` 彎曲線條在高密度時 anti-aliasing 可能糊化,需實測
- ⚠️ 分支 layout 演算法(column assignment)本身若不優化,100k commits 計算可能 >500ms

---

## 假設 2:CT 工單 ↔ commit 反查 UX

### 測試方法(本次以架構拆解為主)

- **未執行的實測**:建立 10+ 張含 `Commit:` 欄位的工單,實作反查 UX,用 `performance.now()` 量測從點擊到 graph 渲染完成的延遲
- **本次實際執行**:拆解反查流程的每個階段,基於 React/Electron 已知效能特徵估算各階段延遲

### 數據(延遲階段拆解)

**情境 A**:已預建索引(Map<ticketId, commitHash[]>)

| 階段 | 延遲 | 備註 |
|------|------|------|
| 點擊 T#### → IPC renderer→main | 1-5ms | Electron IPC 典型 |
| 索引查詢(Map lookup) | <1ms | O(1) |
| Panel 切換(若需) | 0-50ms | 若已開 Git POC panel 則 0ms |
| Graph scroll to position | 16ms | 1 frame |
| Highlight 渲染 | 16ms | 1 frame(CSS transition 起始) |
| **總計** | **~35-90ms** | **符合 <100ms 目標** |

**情境 B**:無索引(臨時 scan commit messages)

| 階段 | 延遲(100k commits) | 備註 |
|------|---------------------|------|
| Scan 100k commit message 字串 match | 200-500ms | 主執行緒阻塞 |
| 其他階段(同上) | ~35-90ms | |
| **總計** | **~235-590ms** | **超標(失敗)** |

### 結論:🟡 conditional go

**關鍵前提**:索引為架構核心,**不可選**。無索引方案不達標。

**推薦策略(MVP α 範圍內,0.5-1 人週)**:

1. **在 main process 維護索引**:
   ```
   CommitIndex {
     ticketToCommits: Map<string, string[]>  // "T0151" → ["abc123", "def456"]
     commitToTickets: Map<string, string[]>  // "abc123" → ["T0151", "T0149"]
   }
   ```

2. **索引建立時機**:
   - 啟動時:掃 `git log --format='%H %s'`,regex match `T\d{4}` 建索引(100k commits 約 2-5s)
   - 增量更新:`git pull` / 新 commit 後僅 scan 新 commits(<50ms)

3. **反查流程**:
   - Renderer 點 T#### → IPC invoke `getCommitsByTicket(ticketId)` → 回傳 hash 陣列
   - 切換 panel → scroll 到第一個 commit 的 Y 座標 → CSS highlight class

4. **延遲優化**:
   - 索引查詢結果 cache 在 renderer(避免重複 IPC)
   - Scroll animation 用 `scroll-behavior: smooth` 但設 80ms 而非預設 300ms
   - Highlight 用 CSS `animation: pulse 1.2s ease-out 2`,非同步

**風險清單**:
- ⚠️ 索引建立時若 commit message 有非 ASCII 字元,regex 需處理 UTF-8 edge case
- ⚠️ rebase 後 commit hash 變動,索引需能偵測並重建(監聽 `.git/HEAD` 或 `git reflog`)
- ⚠️ 若使用者在 detached HEAD / 多個 remote 情況下,「反查範圍」需定義(目前 branch?所有 branches?)

---

## 假設 3:Interactive rebase 是否值得在 GUI 做

### 競品調查

#### SourceTree(Atlassian)

- **實作**:原生 UI,commit 列表拖拉排序 + 下拉選 squash / fixup / edit / drop
- **優點**:視覺直觀,對 Git 新手友善
- **缺點**:
  - 已知 bug:interactive rebase 中途失敗常需手動介入終端
  - Windows / macOS only,停止支援 Linux
  - 大型 rebase(>20 commits)UI 操作效率低
- **典型使用者反饋**(GitHub issue、論壇):「喜歡一般 commit/merge,但 rebase 還是回終端跑更穩」

#### GitKraken(Axosoft,商業版)

- **實作**:視覺化拖拉 UI,動畫流暢,支援 merge conflict 視覺化解決
- **優點**:專業軟體體驗、conflict resolver 優秀
- **缺點**:
  - 付費($4.95-$9.95/month)
  - 封閉原始碼,BAT 無法參考實作
  - 效能:大 repo 啟動時間長(見 Reddit 回報)

#### Lazygit(開源,MIT)

- **實作**:TUI(terminal user interface),鍵盤驅動
- **Interactive rebase 操作**:
  ```
  進入 branch view → 選擇 commit → 按 `e` 進 interactive rebase
  上下鍵選 commit → `s`=squash、`f`=fixup、`d`=drop、`e`=edit、`r`=reword
  `j/k`=移動 commit 順序
  `m`=啟用/停用(skip)
  Enter=執行
  ```
- **優點**:
  - **極快**:熟練使用者 <10 秒完成 5-commit squash
  - MIT 開源
  - 社群活躍(~50k GitHub stars)
  - 跨平台(Windows/macOS/Linux,靠 `go install`)
  - 處理 merge conflict 優秀
- **缺點**:
  - 學習曲線(鍵盤驅動對 CLI 不熟者不友善)
  - 無 GUI 拖拉(但這也是速度優勢)

#### VS Code Git Graph extension

- **實作**:webview + Canvas
- **Interactive rebase**:**無原生 GUI 支援**,點「Rebase」僅執行標準 rebase,interactive 還是進 CLI
- **結論**:連最熱門的 IDE extension 都沒有做 interactive rebase GUI,值得深思

### 使用者體驗評估:BAT 自建 vs Lazygit 整合

**情境**:使用者要 squash 本工單(T0151)的 4 個 commit

**方案 A:BAT 自建 GUI rebase**
- 點 Git POC panel → 右鍵選取 4 個 commit → 「Squash」
- 預估成本:2-3 人週實作 + 1 人週 conflict resolver
- 價值:視覺化 UI,對新手友善

**方案 B:BAT 內部終端 + Lazygit(推薦)**
- BAT 按鈕「在新終端開啟 Lazygit」(利用 T0129 內部終端)
- 使用者按鍵流程:`e` → `s s s` → Enter(5 秒)
- 預估成本:**0.3-0.5 人週**(只需安裝檢查、快捷按鈕、文件)
- 價值:沿用業界成熟工具,保留 BAT 差異化給更高價值 feature

**方案 C:混合 — CT 工單感知的 rebase todo 產生器(新穎!)**
- BAT 提供按鈕「Squash T0151 的 commits」→
  1. 查 CommitIndex,找出 T0151 的 4 個 commits
  2. 產生 git rebase todo 檔(`pick abc → squash def,ghi,jkl`)
  3. 呼叫 `GIT_SEQUENCE_EDITOR='<產生的檔案>' git rebase -i <base>`
  4. 留給使用者在 BAT 內部終端(或 Lazygit)做最後確認
- 預估成本:**0.8-1.2 人週**
- 價值:**這才是 BAT 的差異化**(CT/BMad 整合 + 業界工具)

### 決策維度比較

| 維度 | 自建 GUI | Lazygit 整合 | CT 感知 todo 產生器 |
|------|---------|--------------|---------------------|
| 實作成本 | 3-4 人週 | 0.3-0.5 人週 | 0.8-1.2 人週 |
| 相比 Lazygit 的增量價值 | 視覺化拖拉(有限) | N/A | **CT 整合(獨特)** |
| 維護成本 | 高(conflict edge cases) | 幾乎零 | 中(todo 產生邏輯) |
| 跨平台風險 | 低(React/Electron) | **Lazygit 安裝依賴** | 中 |
| 使用者學習成本 | 中(新 UI) | 中(鍵盤驅動) | **低(按鈕 + 背後用 Lazygit)** |

### 結論:🔴 no-go 於「自建 GUI rebase」+ 🟢 go 於「混合策略」

**推薦決策**:
- **不**自建 GUI interactive rebase(Lazygit 已夠好,自建 ROI 低)
- **做** BAT 一鍵開啟 Lazygit(MVP β,0.3-0.5 人週)
- **做** CT 工單感知的 rebase todo 產生器(Differentiator,0.8-1.2 人週)

**替代方案細節**(MVP β 實作建議):
1. BAT 偵測 Lazygit 是否安裝(執行 `lazygit --version`)
2. 未安裝時,Panel 顯示安裝指南(`winget install jesseduffield.lazygit` / `brew install lazygit` / `go install github.com/jesseduffield/lazygit@latest`)
3. 已安裝時,Git POC panel 右上角放「Open in Lazygit」按鈕 → 在 BAT 內部終端(T0129)開啟 `lazygit -p <workspace>`
4. Phase 4(Differentiator)實作 CT 感知 rebase todo 產生器

---

## Phase 3 完整實作建議

### MVP α 範圍(基於 POC 調整)

**估算人週**:**3-4 人週**(比 T0152 原估 2-3 人週略高,因 virtualization 工作量)

**功能清單**:
1. Git POC panel 基礎框架(整合到 dock system)— 0.3 人週
2. `simple-git` IPC handler(commits、branches、status)— 0.5 人週
3. SVG commit graph(支援 ≤50k commits)+ react-window virtualization — 1.5-2 人週
4. Branch layout 演算法(column assignment)— 0.5 人週
5. CT 工單索引 + 反查流程 — 0.5-0.8 人週
6. 基礎操作:checkout branch、view diff、copy hash — 0.3 人週
7. i18n + 樣式打磨 — 0.2-0.3 人週

### MVP β 範圍

**估算人週**:**2-3 人週**(基於 MVP α 之上)

**功能清單**:
1. Lazygit 整合(偵測、安裝指南、一鍵開啟)— 0.3-0.5 人週
2. Commit 詳細視圖(diff、files changed)— 0.5-0.8 人週
3. Branch 切換、merge、rebase(非 interactive,呼叫 simple-git)— 0.5 人週
4. Stash 管理(簡化 UI)— 0.3-0.5 人週
5. Remote 管理(fetch/pull/push UI)— 0.3 人週
6. Search commits(by message / author / hash)— 0.2 人週

### Differentiator 範圍

**估算人週**:**3-4 人週**

**功能清單**:
1. CT 感知 rebase todo 產生器(「Squash T#### 的 commits」)— 1-1.5 人週
2. CT 工單 ↔ commit 雙向跳轉優化(延遲 <50ms)— 0.3 人週
3. Canvas renderer 選項(處理 100k-1M commits)— 1.5-2 人週
4. 跨 workspace 整合視圖(同時看多個 repo)— 0.3-0.5 人週

### 推薦派工單策略

**建議由塔台派發 6-8 張子工單**(避免單張過大無法追蹤):

**Phase 3.1 — MVP α 基礎(並行)**:
- Tα1:Git POC panel + IPC + simple-git 整合骨架(~1 人週)
- Tα2:SVG commit graph + layout 演算法(~1.5 人週)
- Tα3:CT 工單索引 + 反查 UX(~1 人週)
- Tα4:virtualization + 基礎操作 + i18n(~0.8 人週)

**Phase 3.2 — MVP β(α 完成後)**:
- Tβ1:Lazygit 整合 + 一鍵開啟(~0.5 人週)
- Tβ2:commit 詳細視圖 + branch/merge/rebase(~1.5 人週)
- Tβ3:stash + remote + search(~1 人週)

**Phase 3.3 — Differentiator(β 穩定後)**:
- Tδ1:CT 感知 rebase todo 產生器(~1 人週)
- Tδ2:Canvas renderer(大 repo 支援,~1.5 人週,可選)

**合計:α 4 張 + β 3 張 + δ 2 張 = 9 張工單**,總範圍 **8-11 人週**(與 T0152 原估 4-6 人週比,**顯著擴大**,主因為 virtualization 與 Canvas 支援)。

### 關鍵風險(Phase 3 執行時仍需關注)

1. **效能瓶頸**:layout 演算法在 100k+ commits 可能阻塞主執行緒,需在 web worker 或 IPC main process 做
2. **Git repo 特殊情況**:shallow clone、submodules、sparse-checkout、LFS 檔案,simple-git 覆蓋度需實測
3. **跨平台**:Lazygit 安裝(Windows winget vs macOS brew vs Linux go install)文件要清楚
4. **Conflict resolver**:若 MVP β 支援 rebase,conflict 可能發生,解決 UI 不做的話使用者要回 Lazygit / CLI
5. **CT 工單索引失效**:rebase 後 commit hash 變動,索引重建邏輯要穩健
6. **TypeScript 型別完整性**:simple-git 的 TS 型別定義不完整,部分需手動補
7. **BAT 既有功能 regression**:docking system 新增 panel 時需逐一測試其他 panel 切換、collapse 狀態(參考 BUG-027 教訓)

---

## 附錄 A:POC 代碼位置與使用方法

### 路徑調整

工單寫 `src/renderer/components/git-poc/`,但 BAT 實際結構為 `src/components/`,**本次建立的 POC 代碼位於 `src/components/git-poc/`**。建議 Phase 3 沿用此路徑。

### 檔案清單

```
src/components/git-poc/
├── README.md                   # POC 狀態、啟用步驟、限制說明
└── GitPocPlaceholder.tsx       # 元件骨架(placeholder)
```

### 使用方法

POC 代碼**未**整合到 App.tsx dock system,原因:
1. 避免修改核心(降低 regression 風險)
2. 本次僅完成紙上分析,無實測數據,整合後空轉元件會誤導使用者

Phase 3 啟動時,按 README.md 步驟逐步啟用。

---

## 附錄 B:本次未完成的實測項目清單

**給塔台拆單時的參考**:

1. **實測假設 1**:clone 3 種規模 repo,逐一渲染測 FPS,產出效能圖表
2. **實測假設 2**:實作索引 + 反查,用 `performance.now()` 量測,產出延遲分佈圖
3. **Lazygit 實戰**:在 BAT 內部終端(T0129)開 Lazygit 跑一次 interactive rebase,錄製 GIF 作為文件範例
4. **竞品實測**:下載 SourceTree / GitKraken 試用版,實測 interactive rebase 流程,補齊 UX 對比細節
5. **Canvas POC**:若 Phase 4 啟動 Differentiator,先做 Canvas renderer spike(1 人週預算)驗證 1M commits

---

## 附錄 C:本報告的可信度聲明

本報告的結論基於:
- ✅ T0152 紙上調研(simple-git 評估、授權確認)— 可信度高
- ✅ 公開技術證據(開源專案 README、GitHub issue、官方文件)— 可信度中高
- ✅ React/Electron/SVG/Canvas 的已知效能特徵 — 可信度高
- ⚠️ FPS 與延遲數字為**理論估算**,非實測 — 可信度中(實測可能 ±30% 偏差)
- ⚠️ GitKraken / SourceTree 內部實作為閉源,相關描述為社群觀察 — 可信度中

**建議**:塔台在拆 Phase 3 工單時,**至少保留 1 張 Spike 子工單**實測假設 1 與假設 2,避免基於估算直接進生產實作。
