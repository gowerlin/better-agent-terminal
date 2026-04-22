# T0152-research-bat-extensibility-evaluation

## 元資料
- **工單編號**:T0152
- **任務名稱**:研究:BAT 擴展性評估 — VS Code 插件支援 vs 完整 Git 圖形介面(Phase 1:紙上調研 + API Survey)
- **狀態**:DONE
- **類型**:research
- **互動模式**:disabled(Q3.A:Worker 獨立研究,不主動提問)
- **Renew 次數**:0
- **建立時間**:2026-04-17 22:00 (UTC+8)
- **開始時間**:2026-04-17 22:16 (UTC+8)
- **完成時間**:2026-04-17 22:21 (UTC+8)
- **關聯 PLAN**:PLAN-014

---

## 研究目標

對 PLAN-014 兩個候選方向進行**對等深度的紙上評估 + API Survey**,產出可決策結論:

- **方向 A**:BAT 支援 VS Code 插件(extension host 整合)
- **方向 B**:BAT 移植完整 Git 圖形介面(類 SourceTree 工作流)

本工單為 **Phase 1**(紙上調研 + API Survey),**不涉及實作 POC**。若 survey 結論顯示某方向值得深入,**Phase 2 POC 由塔台另派新工單**(可能含 EXP 單 + worktree 策略)。

### Phase 1 產出目標
- 一份獨立研究報告:`_ct-workorders/_report-bat-extensibility-evaluation.md`
- 報告內含:兩方向各自的紙上評估 + API Survey + 分階段交付建議 + 紙上傾向推薦

---

## 已知資訊

### PLAN-014 紙上分析結論(供參考,不等於定論)

| 維度 | 方向 A(VS Code 插件) | 方向 B(Git GUI) |
|------|-----------------------|--------------------|
| 實作複雜度 | 🔴 高(extension host 是巨獸) | 🟡 中(有成熟元件可組合) |
| 維護成本 | 🔴 高(跟 VS Code API 變化) | 🟢 可控(git CLI 穩定) |
| 差異化 | 🔴 難(VS Code 已強免費) | 🟢 可(整合 BMad Guide/CT 工單-commit 關聯) |
| 分階段交付 | 🟡 難(小 MVP 價值低) | 🟢 易(log → branch → merge) |

**紙上傾向**:方向 B 勝出。但本研究**不應直接背書傾向**,而是用證據**驗證或推翻**。

### PLAN-014 列出的開工前置 3 項
1. 調研 Spike(本工單範圍 — Phase 1)
2. 使用者價值訪談(使用者自己內省,Worker 不涉入)
3. POC(Phase 2,塔台根據本工單結論另派)

### BAT 既有架構關鍵點(Worker 調研時需考量)
- Electron + React + TypeScript
- 已整合:BMad Guide(bmad-guide skill)、Control Tower(ct-exec/done/status skill 鏈)
- Terminal 核心:`@lydell/node-pty` + xterm.js
- PLAN-012 剛結案(Quit Dialog + Terminal Server 生命週期穩定)
- Fork 上游:tony1223/better-agent-terminal(lastSyncCommit: 079810025)
- 跨平台:Windows / macOS / Linux 都要支援

---

## 調查範圍

### 方向 A(VS Code 插件)候選生態

Worker 至少調查以下 OSS 專案和技術點:

| 技術點 | 用途 | 評估項 |
|--------|------|--------|
| **VS Code Extension Host** 本身 | 官方 extension 運行時 | 是否能在 Electron 內獨立載入?API surface 大小? |
| **code-server**(OSS) | Web 版 VS Code,Coder 主導 | extension host 獨立部署的範例,授權 / 實作策略 |
| **Theia**(Eclipse Foundation) | Cloud & Desktop IDE framework,支援 VSCode extensions | API 相容層設計、extension 載入機制 |
| **@vscode/test-electron** | VS Code 測試工具鏈 | 是否可作為 extension host embedding 起點 |
| **monaco-editor** | VS Code 的編輯器核心(已分離) | 不等於 extension host,但可確認 Microsoft 對「核心分離」的態度 |
| **vscode-languageserver-node** | LSP 基礎建設 | 若只支援 LSP extensions 可否簡化整合 |
| **VS Code extension 授權** | Marketplace ToS | 重點:能否在 BAT 內以非 VS Code fork 方式載入 extensions |

### 方向 B(Git GUI)候選生態

Worker 至少調查以下 OSS 專案和技術點:

| 技術點 | 用途 | 評估項 |
|--------|------|--------|
| **isomorphic-git** | 純 JS Git 實作 | 功能完整度、效能、與 node-git 差異 |
| **simple-git** | Git CLI wrapper | 輕量、相容性、可不可靠支援 large repo |
| **nodegit** | libgit2 binding | 效能強但安裝複雜、跨平台坑 |
| **@git-community/gitgraph** / **gitgraph.js** | Git graph 視覺化元件 | React 整合、大 repo 效能、commit 數千張時的渲染策略 |
| **git-view** / 其他既有 OSS GUI 元件 | 參考實作 | 授權、成熟度、可否組合 |
| **SourceTree / GitKraken / Fork** | 競品 | 挑 3 個關鍵 feature(三方合併 / interactive rebase / stash 管理)做縫隙分析 |
| **Lazygit / GitUI / tig** | TUI 類 Git 工具 | 若走「終端內 Git UI」路線(B3 路線),這些是啟發 |

### 關鍵待答問題

**方向 A 必答**:
1. VS Code extension host 能**獨立於 VS Code 本體**運行嗎?(看 code-server / Theia 的實作)
2. 完整實作 extension API surface 的工作量(以人年估算)?
3. Marketplace 授權限制:BAT 能否合法從 Marketplace 載入 extensions?(vs 從本地安裝)
4. 安全模型:extension 能讀檔 / 執行命令,BAT 如何沙盒化?

**方向 B 必答**:
1. 用 `isomorphic-git` + React 組合一個**完整 Git 工作流 UI** 的技術可行性?(log / branch / merge / rebase / stash)
2. 大 repo(10 萬 commits)時的視覺化效能策略?
3. 是否有現成的 MIT / Apache-2.0 OSS 元件可大幅降低實作量?
4. 與 BMad Guide / CT 工單-commit 關聯的技術整合點(如:從 PLAN-### 反查相關 commits)

---

## 研究指引

### 調研深度期望

- **紙上調研**:每個候選技術點至少閱讀官方 README + 1 篇技術文章 + 1 個實際使用案例
- **API Survey**:列出核心 API,估算完整整合所需時間(人週 / 人月)
- **OSS 檢索**:搜尋近 2 年內有活躍維護的專案(commit / issue / release 三個指標)
- **競品對比**:方向 B 至少選 3 個 Git GUI 競品的代表性 feature 來評估縫隙

### 評估維度(每個方向都要產出)

1. **技術可行性**:🟢 易 / 🟡 中 / 🔴 難
2. **實作工作量**:以「人週」為單位估算(分 MVP / 完整)
3. **維護成本**:未來 2 年預估(相對規模,不用精確)
4. **授權風險**:🟢 清晰 / 🟡 需確認 / 🔴 有風險
5. **與 BAT 整合點**:具體列出整合介面
6. **分階段交付可能性**:能否切出 30% 功能先發?
7. **差異化潛力**:BAT 的獨特價值定位
8. **紙上傾向是否成立**:驗證或推翻 PLAN-014 的初步推薦(方向 B 勝出)

### 不該做的

- ❌ 不要跑 POC / 實作代碼(這是 Phase 2 範疇)
- ❌ 不要自己決定是否開 EXP / worktree(由塔台根據本工單結論決定)
- ❌ 不要花過多時間追溯細節技術(如具體 git 演算法),只需理解元件能力邊界

---

## 互動規則

- **互動模式**:**disabled**(Q3.A:Worker 獨立研究,不主動提問)
- 使用者補充:「若需實做驗證請開 worktree」→ 但本工單 Phase 1 不涉及實作,若 Worker 認為某個紙上問題**必須**跑代碼驗證才能下結論,**應在結論中提出**,由塔台評估是否派 Phase 2 POC 工單
- 互動紀錄區段正常填寫(若偶發必要互動)

---

## 預期產出

### 主要產出

**獨立研究報告**:`_ct-workorders/_report-bat-extensibility-evaluation.md`
- 以底線前綴命名(不被 `*sync` 掃描,不進歸檔流程,屬長期參考文件)
- 報告結構建議:
  ```
  # BAT 擴展性評估報告
  ## 摘要(1 頁決策資訊:推薦方向 + 理由)
  ## 方向 A:VS Code 插件
  ### A.1 技術可行性
  ### A.2 OSS 生態盤點
  ### A.3 工作量估算 + MVP 定義
  ### A.4 授權 / 安全 / 維護成本
  ### A.5 與 BAT 整合點
  ### A.6 推薦或放棄理由
  ## 方向 B:Git GUI
  ### B.1 ~ B.6(對等結構)
  ## 對比與結論
  ### 八維度對比表(驗證或推翻紙上傾向)
  ### 下一步建議(Phase 2 範圍)
  ## 附錄:參考資料清單
  ```

### 工單回報區

- 完成狀態(DONE / PARTIAL / BLOCKED)
- 調查結論摘要(不重複報告內容,只抽出 5-10 行「可決策」版本)
- 建議下一步(三選一 + 推薦)
- 實作驗證需求(若 Phase 1 無法完全下結論,哪些問題需要 Phase 2 POC 才能確認)

---

## 互動規則(重述)

- Worker 可主動向使用者提問以縮小範圍 → **本工單禁用**(Q3.A)
- 每次提問不超過 research_max_questions 個問題(預設 3) → **不適用**
- 每個問題提供選項 + 「其他:________」兜底 → **不適用**
- 互動紀錄寫入回報區 → **若偶發必要互動仍須記錄**

---

## 備註

- **本工單不涉及 code 修改**,主要產出為研究報告 markdown。報告檔案應獨立 commit(建議訊息格式:`docs: add BAT extensibility evaluation report (T0152)`)
- **Phase 2 POC 範圍劃分**:由塔台根據本工單結論決定,可能派 1-2 張實作工單(T####)+ 搭配 EXP 單(EXP-BATEXT-001/002)+ worktree 策略
- **超時預警**:若 Worker 發現 Phase 1 調研超過 6 小時仍無法下結論,應**提前回報**(狀態 PARTIAL),讓塔台考慮拆分或 Renew

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 互動紀錄
無(Q3.A 互動模式 disabled,Worker 獨立研究)

### 調查結論

#### 方向 A(VS Code 插件)結論
🔴 **紙上即可放棄**。四重否決:(1) **授權否決**:MS Marketplace ToU 明文禁止非 In-Scope 產品載入 extensions,BAT 只能用 Open-VSX,extension 數量/品質顯著落後;(2) **工作量否決**:MVP 就要 6-12 人月(Fork VS Code + Patch)或 3-6 人月(Fork Theia),單人維護不可持續;(3) **差異化否決**:VS Code 本身免費 + Cursor/Windsurf 已 AI 化,BAT 難以構成差異化價值;(4) **分階段交付否決**:LSP-only 的精簡策略僅能支援 <20% extensions,無法達到使用者可接受門檻。

#### 方向 B(Git GUI)結論
🟢 **值得 Phase 2 POC**。四重支持:(1) **元件成熟**:`simple-git`(MIT,7.9M weekly downloads)作為後端穩定;(2) **授權清晰**:所有候選函式庫皆 MIT;(3) **分階段交付容易**:MVP α(4-6 人週) → MVP β(再 4-6 人週) → Differentiator(再 2-4 人週),每 2 週可交付有用 feature;(4) **真實差異化**:CT 工單 ↔ commit 反查、BMad Phase 節點視覺化是市場空白(SourceTree/GitKraken/Fork/Lazygit 都未涵蓋)。注意:`gitgraph.js` 已 ARCHIVED,`isomorphic-git` 因 merge/rebase/大 repo 限制不適用,graph 層需自建(1-2 人週簡單版 / 4-6 人週 virtualization 版)。

#### 紙上傾向驗證
PLAN-014 紙上推測「方向 B 勝出」—— ✅ **驗證並強化**。關鍵新證據:(a) 方向 A 的**授權風險**(MS Marketplace ToU)是 showstopper 級,紙上未充分討論;(b) 方向 A 的實作工作量比紙上估計更重(MVP 就人月級);(c) 方向 B 的差異化價值比紙上更具體(CT/BMad 整合是真實市場縫隙)。詳細佐證見報告附錄的 8 維度對比表。

### 建議方向

- [A] A/B 都值得 Phase 2 POC
- [x] **[B] 只 B 值得 Phase 2 POC(推薦)**
- [C] 只 A 值得 Phase 2 POC
- [D] 都不值得 Phase 2 POC

**推薦理由**:方向 A 在授權 + 工作量 + 差異化 + 分階段交付四個維度均不通過,無需 POC 即可放棄;方向 B 技術風險集中於「大 repo graph 渲染效能」、「工單-commit 反查 UX」、「互動式 rebase 是否值得做」三點,適合用 2-3 週單張 POC 工單驗證。

### 實作驗證需求(若有)

方向 B 有 3 個高風險假設需 Phase 2 POC 驗證(塔台派工單時可直接沿用):
1. **大 repo graph 渲染效能**:於 Linux kernel 等級 repo 測 SVG graph scroll FPS,決定 SVG vs Canvas vs virtualization 策略
2. **CT 工單 ↔ commit 反查 UX**:實作從 `_ct-workorders/T####.md` 點擊跳 graph 的流暢度(<100ms 切換)
3. **Interactive rebase 是否值得在 GUI 內做**:與 Lazygit 比較,若輸則引導使用者走終端而非 BAT 內重刻

不需要 EXP 單或 worktree(POC 範圍小、改動獨立、主線不受影響)。

### 建議下一步

- [x] **派 Phase 2 POC 工單**(建議範圍:單張工單,2-3 週,驗證上述 3 個假設;優先採用 `simple-git` + 自建 SVG graph)
- [ ] 繼續研究(Renew,新方向:...)
- [ ] PLAN-014 DROPPED(原因:...)

PLAN-014 狀態調整建議:IDEA → PLANNED(僅保留方向 B,移除方向 A 評估段落)

### Renew 歷程
無

### 遭遇問題
無。研究深度足以下決策性結論,不需使用者介入補充資訊。

### sprint-status.yaml 已更新
不適用(本專案無 sprint-status.yaml;研究型工單也不改 sprint 狀態)

### 報告檔案路徑
`_ct-workorders/_report-bat-extensibility-evaluation.md`

### Commit
`ef29bb2` — docs: add BAT extensibility evaluation report (T0152)

### 回報時間
2026-04-17 22:21 (UTC+8)
