# PLAN-014-evaluate-vscode-extension-vs-git-gui

## 元資料
- **編號**:PLAN-014
- **標題**:BAT 內建 Git 圖形介面(方向 B — 方向 A 於 Phase 1 放棄)
- **狀態**:📋 PLANNED
- **優先級**:🟡 Medium
- **類型**:技術改善(擴展性實作)
- **建立時間**:2026-04-17 22:00 (UTC+8)
- **更新時間**:2026-04-17 22:30 (UTC+8)
- **來源**:使用者於 PLAN-012 全案結案後的下一階段探索發想

---

## Phase 1 研究結論(T0152 DONE,2026-04-17 22:21)

### 方向選擇:B 單獨推進(A 紙上否決)

**方向 A(VS Code 插件)🔴 紙上放棄** — 四重否決:
1. **授權否決**:MS Marketplace ToU 禁止非 In-Scope 產品載入 extensions,BAT 只能用 Open-VSX(extension 數量/品質落後)
2. **工作量否決**:MVP 就要 6-12 人月(Fork VS Code)或 3-6 人月(Fork Theia)
3. **差異化否決**:VS Code 本身免費 + Cursor/Windsurf 已 AI 化,BAT 難以構成差異化
4. **分階段交付否決**:LSP-only 精簡策略僅支援 <20% extensions,無法達可接受門檻

**方向 B(Git GUI)🟢 通過驗證** — 四重支持:
1. **元件成熟**:`simple-git`(MIT,7.9M weekly downloads)作為 Git 後端
2. **授權清晰**:所有候選函式庫皆 MIT
3. **分階段交付容易**:MVP α(4-6 人週)→ MVP β(再 4-6 人週)→ Differentiator(再 2-4 人週)
4. **真實差異化**:CT 工單 ↔ commit 反查、BMad Phase 節點視覺化是市場空白(SourceTree/GitKraken/Fork/Lazygit 皆未涵蓋)

### Phase 1 引用
- **研究報告**:[`_report-bat-extensibility-evaluation.md`](_report-bat-extensibility-evaluation.md)
- **T0152 commit**:`ef29bb2`
- **T0152 工單**:[T0152-research-bat-extensibility-evaluation.md](T0152-research-bat-extensibility-evaluation.md)

---

## Phase 2 進行中(T0153 PENDING)

POC Spike 驗證方向 B 的 3 個高風險假設:
1. 大 repo graph 渲染效能(SVG vs Canvas vs virtualization)
2. CT 工單 ↔ commit 反查 UX(<100ms 切換可行性)
3. Interactive rebase 是否值得在 GUI 做(vs Lazygit)

**工單**:[T0153-poc-git-gui-feasibility-spike.md](T0153-poc-git-gui-feasibility-spike.md)
**預計工時**:2-3 週
**無 EXP / worktree**(POC 範圍小、改動獨立)

Phase 3 完整實作 PLAN 由塔台根據 T0153 結論決定(可能多張工單)。

---

## 動機(歷史,Phase 1 以前的考量保留作為脈絡)

BAT 目前定位為「Better Agent Terminal」— 結合終端機 + BMad Guide + Control Tower 的 Electron 應用。使用者想擴展 BAT 能力邊界,考慮兩個方向:

1. **VS Code 插件支援**:讓 BAT 能載入 / 執行 VS Code 生態的 extension,直接承接既有開發者工具鏈
2. **完整 Git 圖形介面**:類 SourceTree / GitKraken 的 commit / branch / merge / rebase 視覺化工作流

兩個方向的**野心都不小**,需要先做**統合評估**:可行性、維護成本、使用者價值、與既有 BAT 架構的衝突面。確定哪個方向(或哪個子集)值得深入後,再拆成實作 PLAN。

---

## 評估範圍

### 方向 A:VS Code 插件支援

#### 候選路線
| # | 路線 | 實作面 | 可行性 |
|---|------|--------|--------|
| A1 | 內嵌 VS Code Extension Host | 整合 `@vscode/test-electron` / `vscode` npm module | 🟡 中度(需處理 extension API surface) |
| A2 | 支援特定子集(如 LSP-based extensions) | 自建精簡 extension loader | 🟢 可控(範圍明確) |
| A3 | 啟動外部 VS Code 並橋接 | IPC / socket 通訊 | 🟢 容易但價值低 |

#### 關鍵問題
- VS Code extension host 能獨立於 VS Code 本體運行嗎?
- extension API surface 有多大?完整實作代價?
- 授權(MIT / 但包含 Microsoft marketplace ToS)
- 安全模型:extension 能讀檔/執行命令,BAT 如何沙盒化?

### 方向 B:完整 Git 圖形介面

#### 候選路線
| # | 路線 | 實作面 | 可行性 |
|---|------|--------|--------|
| B1 | 自製 React Git UI(調用 git CLI) | React + `simple-git` / `isomorphic-git` | 🟡 中度(UX 細節多) |
| B2 | 整合既有 OSS Git UI 組件 | 如 `gitgraph.js` / `@git-community/gitgraph` | 🟢 可控(組合既有元件) |
| B3 | 嵌入 GitAhead / Lazygit 類 TUI | 在 BAT 終端內運行 | 🟢 極簡(等於推薦 lazygit) |

#### 關鍵問題
- BAT 的使用者是否期待「在終端機裡看 Git 圖」?還是期待獨立分頁?
- 與既有 Git 工具(SourceTree、Fork、GitKraken)競爭策略?
- 如果做到 80% SourceTree 功能,維護成本多大?
- 是否與 BMad Guide / Control Tower 工作流整合(如工單與 commit 關聯視覺化)?

---

## 對比維度(兩方向並列)

| 維度 | 方向 A(VS Code 插件) | 方向 B(Git GUI) |
|------|-----------------------|--------------------|
| **使用者價值** | 承接生態、降低學習成本 | 提升版本控制工作流順暢度 |
| **實作複雜度** | 🔴 高(extension host 是巨獸) | 🟡 中(有成熟元件可組合) |
| **維護成本** | 🔴 高(跟隨 VS Code API 變化) | 🟢 可控(git CLI 介面穩定) |
| **與 BAT 定位契合度** | 🟡 擴展定位但風險模糊化本體 | 🟢 補強終端 + Agent + Git 閉環 |
| **差異化** | 🔴 難(VS Code 本體已免費且強) | 🟢 可(整合 BMad Guide/CT 工單-commit 關聯) |
| **可分階段交付** | 🟡 難(extension API surface 大,小 MVP 價值低) | 🟢 易(先 commit log 視覺化 → 再 branch → 再 merge) |
| **技術風險** | 🔴 高(授權、安全模型、API 穩定性) | 🟢 低(git CLI 成熟) |

---

## 初步傾向(待深入驗證)

基於上表,**方向 B(Git 圖形介面)看起來更適合 BAT**:
- 維護成本較低、差異化可能性更高、可分階段交付
- 與既有工作流(BMad Guide + Control Tower 工單)整合空間大(例如:commit 視覺化連結到 PLAN-###)

**方向 A(VS Code 插件)** 的挑戰:
- VS Code 本體已免費、生態鎖定深,BAT 難以差異化
- extension host 維護成本吃重(需追隨 API 變化)
- 可能模糊 BAT 的定位(到底是終端 + Agent 工具,還是 VS Code 競品?)

但這只是**紙上分析**,需要實際 spike 才能確定。

---

## 預期影響

### 若方向 B 成立
- BAT 成為「終端 + Agent + Git 工作流」閉環工具
- 新增主要分頁 / 側邊欄(Git 視覺化區域)
- 與既有 workspace 切換、CT 面板整合點:commit 與工單關聯視覺化

### 若方向 A 成立(低機率)
- BAT 吸納 VS Code 擴展,但需重新思考定位
- 大幅增加 Electron 應用複雜度和啟動成本

### 若**兩者皆不成立**
- 本 PLAN 歸檔為 DROPPED,但研究結論保留作未來參考
- 嘗試其他擴展方向(如更深整合 AI Agent 工作流)

---

## 開工前置(轉 PLANNED 前必做)

1. **調研 Spike**(產出研究報告 `_report-bat-extensibility-evaluation.md`):
   - VS Code extension host 獨立運行可行性(查閱 OSS 案例,如 `code-server` / `theia`)
   - Git GUI 元件生態成熟度(評估 `gitgraph.js` / `isomorphic-git` / `simple-git` 實際能力)
   - 競品對比(SourceTree / GitKraken / Fork 的差異化縫隙)
2. **使用者價值訪談**:
   - 問自己 / 潛在使用者:哪個方向在你日常工作流裡痛點最大?
   - 是否有第三個選項被兩個方向掩蓋(如:單純改善 BAT 內建終端對 git CLI 的視覺輔助)
3. **POC**(選一個方向淺度試水):
   - 方向 B 的最小 MVP:commit log 視覺化頁籤(調用 `git log --graph` 並解析)
   - 方向 A 的最小 MVP:載入一個極簡的 LSP extension 並驗證 API surface

---

## 相關單據

- 無直接前置單據(獨立擴展性探索)
- 關聯 BAT 定位討論:本 PLAN 的結論可能影響未來里程碑規劃

---

## 備註

本 PLAN 為高抽象度的**方向性評估**,非具體實作 PLAN。結論成熟後應拆成具體的實作 PLAN(如 `PLAN-XXX-git-commit-log-visualization`)。

優先級標 🟢 Low 因為 PLAN-012 才剛結案、backlog 還有多張 🟡 Medium(PLAN-004 GPU Whisper / PLAN-009 Sprint Dashboard),本 PLAN 先進冷藏庫,等上述完成或使用者再提才動手。
