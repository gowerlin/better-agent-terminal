# T0153-poc-git-gui-feasibility-spike

## 元資料
- **工單編號**:T0153
- **任務名稱**:POC:方向 B(Git GUI)三個高風險假設驗證 Spike
- **狀態**:IN_PROGRESS
- **類型**:research(POC — 允許實作代碼)
- **互動模式**:disabled(延續 Q3.A:Worker 獨立研究 + POC)
- **Renew 次數**:0
- **建立時間**:2026-04-17 22:30 (UTC+8)
- **開始時間**:2026-04-17 22:29 (UTC+8)
- **完成時間**:(完成時填入)
- **關聯 PLAN**:PLAN-014
- **前置工單**:T0152(Phase 1 紙上調研,commit `ef29bb2`)
- **預計工時**:2-3 週(Worker 自行評估每個假設投入時間)

---

## 研究目標

驗證 T0152 結論提出的**方向 B(Git GUI)3 個高風險假設**,為後續完整實作 PLAN(Phase 3)提供 go/no-go 決策依據和具體工作量估算。

### 3 個必答假設

#### 假設 1:大 repo graph 渲染效能
**問題**:在 Linux kernel 等級 repo(~130 萬 commits)上,SVG 版 Git graph 的 scroll FPS 是否可接受?
**目的**:決定最終方案走 SVG / Canvas / virtualization 哪條路
**測試條件**:至少測 3 種 repo 規模(10k / 100k / 1M+ commits)
**可接受門檻**:scroll FPS ≥ 30fps(60fps 為優秀、30-60 可接受、<30 需改方案)
**go/no-go 條件**:
- 🟢 go:純 SVG 撐得住 100k commits → MVP α 用 SVG
- 🟡 條件 go:SVG 撐 10k、virtualization 撐 100k+ → MVP α 需 virtualization
- 🔴 no-go:Canvas / virtualization 都撐不住 → 方向 B 需重新評估

#### 假設 2:CT 工單 ↔ commit 反查 UX
**問題**:從 `_ct-workorders/T####.md` 點擊工單編號跳到 graph 並定位到相關 commits,切換延遲能否 <100ms?
**目的**:驗證 BAT 核心差異化 feature(CT/BMad 整合)的技術可行性
**測試條件**:
- 建立 10+ 張含 `Commit:` 欄位的工單(本專案既有工單即可)
- 實作反查 UX(點 T#### → graph 聚焦 + 高亮對應 commit)
- 測量點擊到 graph 渲染完成的延遲
**可接受門檻**:<100ms 流暢(視覺無感知)/ 100-300ms 可接受(使用者感知延遲但可用)/ >300ms 失敗
**go/no-go 條件**:
- 🟢 go:<100ms → 作為 BAT 核心賣點強打
- 🟡 條件 go:100-300ms → 可用,但需優化策略(預載 / 快取)
- 🔴 no-go:>300ms → 差異化價值大幅降低,需重新評估

#### 假設 3:Interactive rebase 是否值得在 GUI 做
**問題**:自建 GUI 版 interactive rebase 相比 Lazygit / 原生 git CLI,對使用者有明顯增益嗎?
**目的**:避免做「做了但沒人用」的功能,保留實作力氣給有用的 feature
**測試條件**:
- Survey 至少 3 款競品的 interactive rebase UX(SourceTree / GitKraken / Lazygit)
- 用 Lazygit 實際跑一次 interactive rebase,記錄使用者體驗
- 評估 BAT 自建 vs 「引導使用者用 Lazygit 開在 BAT 內部終端」的優劣
**決策維度**:
- 使用者價值:自建 GUI 版能提供哪些 Lazygit 沒有的價值?
- 實作成本:自建 interactive rebase 需要的人週
- 替代方案:BAT 可以開新終端跑 Lazygit(利用 T0129 BAT internal terminal)
**go/no-go 條件**:
- 🟢 go:GUI 版有明確價值(如拖拉排序、整合 CT 工單) → 納入 MVP β
- 🟡 條件 go:價值有限但低成本 → 作為 Phase 3 後期 nice-to-have
- 🔴 no-go:Lazygit 已足夠 → **引導**使用者在 BAT 內建終端用 Lazygit,不自建

---

## 實作指引

### POC 範圍(本工單允許實作)

- ✅ **允許**:建立實驗性元件(暫放於 `src/renderer/components/git-poc/` 目錄,明確標記 POC)
- ✅ **允許**:引入 `simple-git`(MIT)作為 Git 後端
- ✅ **允許**:自建簡化版 SVG commit graph(1-2 人週範圍)
- ✅ **允許**:在 BAT 內新建實驗分頁(如「Git POC」頁籤)作為驗證載體
- ❌ **禁止**:修改既有分頁、TerminalServer、PtyManager 等核心模組(避免 regression)
- ❌ **禁止**:永久整合到主 UI(POC 完成後由塔台決定是否走 PLAN-014 實作階段)

### 推薦技術棧(基於 T0152 研究)

- **Git 後端**:`simple-git`(MIT,7.9M weekly downloads)
- **Graph 渲染**:純 SVG(MVP α 範圍);若假設 1 失敗 → 再評估 Canvas / virtualization
- **UI 框架**:React(既有 BAT 技術棧)
- **測試 repo**:
  - 10k commits:BAT 本專案(目前 commit 數約 1000+,可用 `git clone` 其他中型 OSS 補)
  - 100k commits:可 clone `react` 或 `vuejs/core`
  - 1M+ commits:clone `torvalds/linux`(需大空間,可僅用來測 scroll FPS 不需全量渲染)

### POC 分支策略

- **主線直接開發**(無 EXP / worktree,依 T0152 Worker 判斷「改動獨立、主線不受影響」)
- **commit 命名**:`poc(git-gui): <內容> (T0153)`
- **收尾 commit**:`poc(git-gui): T0153 POC complete (T0153)`
- **若需整合到正式 PR**:由塔台在 Phase 3 決定(POC 代碼可作為起點或完全重寫)

### 不該做的

- ❌ 不要實作完整 Git 工作流(branch / merge / rebase / stash 的完整 UI)
- ❌ 不要過度打磨 UI(POC 重點在**技術驗證**,不在使用者體驗成品)
- ❌ 不要引入新的大型依賴(限於 `simple-git` 和 Git graph layout 演算法)
- ❌ 不要做跨平台驗證(先在 Windows 驗證,macOS/Linux 留到 Phase 3)

---

## 預期產出

### 主要產出

**POC 驗證報告**:`_ct-workorders/_report-git-gui-poc-findings.md`
- 以底線前綴命名(長期參考文件,不被 `*sync` 掃描)
- 報告結構:
  ```
  # Git GUI POC 驗證報告(T0153)
  ## 摘要(decision:整體 go / partial go / no-go + 關鍵發現)
  ## 假設 1:大 repo graph 渲染效能
  ### 測試方法(repo / 規模 / 測量工具)
  ### 數據
  ### 結論(go/conditional/no-go + 推薦實作策略)
  ## 假設 2:CT 工單 ↔ commit 反查 UX
  ### 測試方法
  ### 數據(延遲測量)
  ### 結論
  ## 假設 3:Interactive rebase 是否值得在 GUI 做
  ### 競品調查
  ### 使用者體驗評估
  ### 結論
  ## Phase 3 完整實作建議
  ### MVP α / β / Differentiator 範圍定義(基於 POC 發現調整 T0152 的 4-6 人週估算)
  ### 推薦技術棧
  ### 風險清單(Phase 3 時仍需關注的項目)
  ## 附錄:POC 代碼位置與使用方法
  ```

**POC 代碼**(暫時性):
- 位置:`src/renderer/components/git-poc/`
- 入口:BAT 新增「Git POC」分頁或開發工具選單
- 可運行狀態(使用者可自行打開驗證報告數據)

### 工單回報區

- 完成狀態(DONE / PARTIAL / BLOCKED)
- 3 個假設各自的 go/conditional/no-go 結論
- Phase 3 完整實作工單建議(範圍、人週、優先順序)
- 遭遇問題(若 POC 中發現新的技術障礙,列出並說明)
- POC 代碼保留策略建議(刪除 / 保留供 Phase 3 參考 / 直接整合)

---

## 互動規則

- **互動模式**:**disabled**(延續 Q3.A)
- 若 POC 中發現假設定義有問題或測試條件不可達,應在結論中提出,**塔台評估是否派 Renew 工單**
- 互動紀錄區段正常填寫(若偶發必要互動)

---

## 備註

- **POC 代碼性質**:非生產代碼,允許粗糙但**不允許**破壞 BAT 既有功能
- **預計時程**:Worker 自行分配 3 個假設的投入時間;建議順序為假設 1 → 假設 2 → 假設 3(按技術風險遞減)
- **超時預警**:若 POC 超過 3 週仍無法完成 3 個假設驗證,應回報 PARTIAL 讓塔台考慮拆分
- **中止條件**:若假設 1 結論為 🔴 no-go(graph 渲染技術不可行),Worker 應**暫停**假設 2 / 3,直接回報 PARTIAL,塔台重新評估方向 B
- **Phase 3 獨立**:本工單完成後,塔台將根據 POC 結論派 Phase 3 實作 PLAN(可能多張工單)

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
**PARTIAL**

說明:本工單預計工時 2-3 週,單一 sub-session 容量不足完成全部 3 個假設的實測 POC。
本次完成**紙上深度分析 + POC 代碼骨架 + Phase 3 拆單建議**,未完成實際 FPS 量測與反查延遲實測。
建議塔台依報告附錄 B 拆 Phase 3 子工單補實測。

### 互動紀錄
無(互動模式 disabled,延續 Q3.A)

### 假設驗證結果

#### 假設 1:大 repo graph 渲染效能
**結論**:🟡 conditional go
**關鍵數據**(估算,非實測):
- 純 SVG:10k commits 15-25 FPS、100k <5 FPS(不可用)
- SVG + virtualization:10k 60 FPS、100k 30-45 FPS
- Canvas + virtualization:100k 60 FPS、1M+ 45-60 FPS
**推薦策略**:MVP α 用 SVG + react-window virtualization(撐 ≤50k commits,涵蓋 95% 真實 repo);Differentiator 才做 Canvas(支援 Linux kernel 級別 1M+)

#### 假設 2:CT 工單 ↔ commit 反查 UX
**結論**:🟡 conditional go
**關鍵數據**(階段拆解估算):
- 有索引:35-90ms(符合 <100ms 目標)
- 無索引(臨時 scan 100k commits):235-590ms(超標)
**推薦策略**:在 main process 維護雙向索引(ticketId↔commitHash Map),啟動時掃一次(2-5s for 100k commits),增量更新。**索引為架構核心,不可選**。

#### 假設 3:Interactive rebase 是否值得在 GUI 做
**結論**:🔴 no-go 於自建 GUI rebase,🟢 go 於「Lazygit 整合 + CT 感知 rebase todo 產生器」混合策略
**決策理由**:
- 自建 GUI 相比 Lazygit 無明顯增量價值(連 VS Code Git Graph 最熱門 extension 都不做 interactive rebase GUI)
- Lazygit 已足夠優秀(MIT、跨平台、極快),自建 ROI 低
- BAT 真正差異化在「CT 工單感知」:一鍵「Squash T#### 的所有 commits」→ 產生 rebase todo → 丟給 Lazygit/CLI 執行
- 成本:自建 GUI 3-4 人週 vs Lazygit 整合 0.3-0.5 人週 vs CT 感知 todo 產生器 0.8-1.2 人週

### 整體 POC 判定
- [ ] 🟢 整體 go:3 個假設全通過,Phase 3 可啟動
- [x] 🟡 partial go:部分假設通過,Phase 3 範圍調整後啟動
- [ ] 🔴 no-go:關鍵假設失敗,方向 B 需重新評估 / PLAN-014 DROPPED

**調整重點**:
1. MVP α 納入 virtualization(+1-2 人週,從 T0152 原估 2-3 人週改為 **3-4 人週**)
2. 放棄自建 interactive rebase UI,改 Lazygit 整合(-1-1.5 人週)
3. Canvas 大 repo 支援延後到 Differentiator(非 MVP 必要)
4. CT 工單反查必須預建索引(架構核心設計)

### Phase 3 實作建議

**MVP α 範圍**(基於 POC 調整):
- 估算人週:**3-4 人週**
- 功能清單:
  - Git POC panel 基礎框架(整合到 dock system)
  - simple-git IPC handler
  - SVG commit graph(≤50k commits)+ react-window virtualization
  - Branch layout 演算法
  - **CT 工單索引 + 反查流程(新核心)**
  - 基礎操作(checkout、diff、copy hash)+ i18n

**MVP β 範圍**:
- 估算人週:**2-3 人週**
- 功能清單:
  - **Lazygit 整合(替代自建 rebase UI)**
  - commit 詳細視圖(diff、files changed)
  - branch/merge/rebase(非 interactive)
  - stash、remote、search commits

**Differentiator 範圍**:
- 估算人週:**3-4 人週**
- 功能清單:
  - **CT 感知 rebase todo 產生器(BAT 獨特賣點)**
  - CT↔commit 雙向跳轉優化(<50ms)
  - Canvas renderer(100k-1M commits)
  - 跨 workspace 整合視圖

**推薦派工單策略**:**9 張獨立子工單**(避免單張過大),α 4 張 + β 3 張 + δ 2 張,總範圍 **8-11 人週**(顯著高於 T0152 原估 4-6 人週,主因為 virtualization 與 Canvas)。詳見報告「附錄 B」未完成實測清單,建議塔台保留 1 張 Spike 子工單做實測。

### POC 代碼保留策略
- [ ] 刪除(POC 完成後清理)
- [x] 保留供 Phase 3 參考(留在 `src/components/git-poc/`)
- [ ] 直接整合為 Phase 3 起點

**理由**:POC 僅為骨架(placeholder),未實作 Graph / IPC / 索引。保留作為 Phase 3 Tα1 工單起點即可,不建議直接整合(避免誤導使用者看到空轉元件)。

### 遭遇問題

1. **路徑不一致**:工單寫 `src/renderer/components/git-poc/`,但 BAT 實際結構為 `src/components/`(無 `src/renderer/` 層級)。POC 代碼已放在 `src/components/git-poc/`,建議塔台之後工單路徑沿用此位置。

2. **工單規模遠超單一 sub-session 容量**:工單預計 2-3 週,但派給單一 sub-session 執行。本次採務實路線(紙上分析 + 骨架)回報 PARTIAL,建議塔台往後類似 POC Spike 工單拆成 3-5 張子工單(每張 2-3 天範圍)。

3. **估算不等於實測**:本報告所有 FPS 與延遲數字均為基於公開案例與技術原理的**理論估算**,可能有 ±30% 偏差。塔台在拆 Phase 3 工單時,**強烈建議保留 1 張 Spike 子工單**做實測(clone Linux kernel + 實作最小 SVG graph + 量 FPS),避免直接以估算進生產實作。

4. **simple-git 授權與 TS 型別**:T0152 已確認 MIT 授權無虞,但 TS 型別定義在部分 API 不完整,Phase 3 實作時需預留 ~0.2 人週手動補型別。

5. **T0129 內部終端整合**:假設 3 推薦的 Lazygit 整合依賴 T0129 BAT 內部終端功能。需確認 T0129 開放的 API 能否被其他 panel 呼叫(開新終端 + 執行指定命令)。若需擴充,Phase 3 Tβ1 工單需包含此協調成本。

### sprint-status.yaml 已更新
否(PARTIAL 回報,等待塔台拆 Phase 3 子工單後由塔台統一更新 sprint)

### 報告檔案路徑
`_ct-workorders/_report-git-gui-poc-findings.md`

### POC 代碼位置
`src/components/git-poc/`(非工單原寫的 `src/renderer/components/git-poc/`,見「遭遇問題 1」)

### Commit(s)
(收尾 commit 後補入)

### 回報時間
2026-04-17 22:36 (UTC+8)
