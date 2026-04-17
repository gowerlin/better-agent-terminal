# BAT 擴展性評估報告

> **工單**:T0152(Phase 1 紙上調研 + API Survey)
> **關聯 PLAN**:PLAN-014
> **撰寫時間**:2026-04-17
> **範圍**:對等深度紙上評估兩個候選方向——方向 A(VS Code 插件支援)、方向 B(完整 Git 圖形介面)——**不含實作 POC**
> **報告性質**:長期參考文件(底線前綴,不進歸檔流程)

---

## 摘要(決策頁)

### 推薦方向:**[B] 只方向 B 值得 Phase 2 POC**

### 一句話結論
方向 A 的**授權風險**(MS Marketplace ToU)和**工作量**(人年級別)是雙重 showstopper;方向 B 有成熟 MIT 元件可組合、工作量人週/人月級、差異化清晰(CT 工單-commit 反查、BMad Phase-commit 對應),**驗證並強化** PLAN-014 的紙上傾向。

### 三要點
1. **方向 A 放棄紙上背書**:Microsoft Marketplace ToU 明文禁止非 In-Scope 產品載入 extensions,BAT 只能用 Open-VSX(extension 數量 / 品質顯著落後);即便技術上可行,完整 extension host 實作需 2-3 人年,MVP(LSP-only)也需 6-12 人月,與 VS Code 本體免費 + Cursor/Windsurf 已 AI 化的市場競爭相比難找縫隙。
2. **方向 B 紙上傾向成立**:`simple-git` (MIT, 7.9M weekly downloads) 作為後端穩定可靠;儘管 `gitgraph.js` 已 ARCHIVED 需自行用 SVG/Canvas 實作 graph 層,但 MVP(log + branch + diff + basic merge)估 4-6 人週、完整版(interactive rebase / stash / submodule)估 3-6 人月,可**分階段交付**。
3. **差異化關鍵**:BAT 與 BMad Guide + Control Tower 的深度整合(從 PLAN-### 反查相關 commits、commit 訊息自動連結工單、Phase 完成時的 commit 時間軸視覺化)是**市場上 SourceTree/GitKraken/Fork/Lazygit 都未涵蓋的縫隙**,構成真實差異化。

### Phase 2 建議範圍(供塔台參考,不在本工單範圍)
單張 POC 工單,2-3 週內驗證 3 個高風險假設:(a) 大 repo(10k+ commits)的 graph 渲染效能;(b) `simple-git` + CT 工單索引反查 commits 的 API 流暢度;(c) 互動式 rebase UX 是否能取代 Lazygit 在終端內的吸引力。不需要 EXP 單或 worktree(POC 不影響主線)。

---

## 方向 A:VS Code 插件支援

### A.1 技術可行性

**可行性評級:🔴 難(有先例但代價高)**

VS Code extension host **技術上可獨立於 VS Code 本體運行**,已有三個代表性先例:

| 先例 | 授權 | 策略 | BAT 借鏡性 |
|------|------|------|-----------|
| **code-server**(Coder) | MIT + VS Code patches | Fork VS Code 並套 patch,整個專案當 submodule | 🔴 巨型 fork 維護,每次 VS Code 升級都要 rebase patch |
| **openvscode-server**(Gitpod) | MIT | 類似 code-server,遠端 VS Code 瀏覽器版 | 🔴 同上,不適合 BAT 這種桌面 Electron |
| **Eclipse Theia**(Eclipse Foundation) | EPL-2.0 | 從零實作相容層,自己的 plugin runtime | 🟡 可考慮 fork Theia 作 BAT 基座,但會顯著放大 codebase |

**關鍵技術障礙**:
1. **Extension Host 是獨立 process**,與 renderer 透過 MessagePort/IPC 通訊(VS Code 2022-11 完成 process sandboxing 遷移,此後架構穩定但複雜)
2. **API Surface 巨大**:VS Code Extension API 涵蓋 vscode.window / workspace / commands / debug / terminal / tasks / notebook / webview / language features / SCM 等數十個命名空間;Theia 花多年時間才達成「Full Compatibility」(當前支援 VS Code 1.108.0 API,2026-03 釋出)
3. **執行環境耦合**:Extensions 預期讀檔、執行命令、開 webview、註冊語言伺服器。BAT 需要完整的 file system proxy、命令執行 proxy、語言服務整合——這些都是 VS Code 提供的**隱含契約**

### A.2 OSS 生態盤點

| 技術點 | 活躍度 | BAT 整合成本 | 結論 |
|--------|-------|-------------|------|
| **VS Code Extension Host(Microsoft 官方)** | 🟢 活躍(每月釋出) | 🔴 極高:只能透過 fork + patch | 不適合直接嵌入 |
| **code-server** | 🟢 活躍(v4.x) | 🔴 高:要求整套 fork | 可作為技術參考,不適合直接 fork |
| **Theia** | 🟢 活躍(2026-02 Community Release) | 🟡 中:若 fork Theia 作 BAT 基座 | **唯一真實選項**,但會重寫 BAT 現有 Electron 架構 |
| **@vscode/test-electron** | 🟢 活躍 | - | 測試工具,不是 embedding 起點 |
| **monaco-editor** | 🟢 活躍 | 🟢 低 | 只是編輯器核心,**不含 extension host**,分離理由不支持整合 |
| **vscode-languageserver-node** | 🟢 活躍 | 🟡 中 | 若只做 LSP extensions(不支援 webview / custom commands),可顯著降低工作量——但也顯著降低可用 extension 數量 |

### A.3 工作量估算 + MVP 定義

**三種策略的人力估算**(基於業界類似專案):

| 策略 | MVP 工作量 | 完整工作量 | MVP 可用 extensions 比例 |
|------|-----------|-----------|------------------------|
| **A1. Fork Theia** | 3-6 人月(熟悉 Theia codebase) | 1-2 人年 | ~80% OpenVSX 上的 extensions |
| **A2. Fork VS Code + Patch**(code-server 式) | 6-12 人月 | 2-3 人年 | ~90% OpenVSX extensions |
| **A3. 自建 LSP-only 支援** | 2-4 人月 | 6-12 人月 | <20%(只有純 LSP 型 extensions,無 webview / TreeView) |

**MVP 最小可行定義**:
- 能載入至少 5 個熱門 extensions(ESLint / Prettier / Python / GitLens / Copilot)並正常運作
- Extension 設定(settings.json)可持久化
- Extension 生命週期(install / uninstall / reload)正常
- 評估:三種策略的 MVP 都**無法達到此門檻**,A1/A2 需 1 人年以上才能接近,A3 會因為 GitLens/Copilot 不是純 LSP 而落空

### A.4 授權 / 安全 / 維護成本

#### 🔴 授權風險:高(本研究**最關鍵的發現**)

Microsoft Visual Studio Marketplace **Terms of Use**(當前 2025-03 版本)明文規定:

> "Marketplace Offerings are intended for use only with **In-Scope Products and Services** and you may not install, reverse-engineer, import or use Marketplace Offerings in products and services except for the In-Scope Products and Services."

「In-Scope Products」僅指微軟自家 Visual Studio 系列產品。實務上:
- **VSCodium**(VS Code 無 telemetry 版)受壓,社群需要手動切換到 Open-VSX
- **Cursor / Windsurf / Trae**(含 $20M+ 融資的商業產品)都受此限制,持續與 Microsoft 拉鋸
- BAT 作為獨立產品,**若從 MS Marketplace 載入 extensions = 違反 ToU**

**唯一合法路徑**:使用 **Open-VSX Registry**(Eclipse Foundation 維護,MIT/EPL-2.0)。但:
- Extension 數量 / 更新頻率 / 品質顯著落後 MS Marketplace
- 熱門 extensions(如官方 Python / C# / Remote-SSH)只在 MS Marketplace
- 使用者體感會是「extension 少一截」

#### 🔴 安全模型:高

Extensions 可讀檔、執行 shell 命令、開網路連線。VS Code 透過 extension host 獨立 process + sandbox 機制保護,但 BAT 若自建等價機制會需:
- 獨立 extension host process
- IPC 層(MessagePort 或 socket)
- 檔案系統 / 網路 / 命令執行的 proxy 層
- Extension 權限模型(例:package.json 的 activationEvents / contributes)

以上每一項都是獨立子系統。

#### 🔴 維護成本:高

- VS Code API 每月釋出新版本,相容性表每天自動產生(vscode-theia-comparator)
- 每次 API 升級都要評估 / 實作 / 測試相容層
- Theia 投入多位 full-time 工程師才能跟上

### A.5 與 BAT 整合點

| 整合點 | 複雜度 | 備註 |
|--------|-------|------|
| Extension host process 啟動 | 🔴 高 | 需獨立 Node.js runtime + fork/spawn 管理 |
| Extension 與 BAT terminal 互動 | 🟡 中 | 需 `vscode.window.createTerminal` API 對應到 BAT 的 xterm.js |
| Extension 與 BAT 檔案樹互動 | 🟡 中 | 需 workspace API 對應到 BAT 的 workspace 概念(目前 BAT 無 explicit workspace 概念) |
| Webview(最熱門 extension 用) | 🔴 高 | 需 Electron webview + message bus,相容性複雜 |
| Settings 持久化 | 🟢 低 | 可沿用 BAT 現有 settings store |

### A.6 推薦或放棄理由

**放棄方向 A(紙上結論)**——四重否決:

1. **授權否決**:MS Marketplace ToU 禁用,Open-VSX 品質落後,BAT 使用者會抱怨「extension 比 VS Code 少一截」
2. **工作量否決**:MVP 級別就要 6-12 人月(A2)或 3-6 人月(A1),本專案單人維護,投入過重
3. **差異化否決**:VS Code 本身免費,Cursor/Windsurf 已 AI 化 + 獲大額融資,BAT 以 terminal-first + AI agent 為賣點加 extension 支援無法構成差異化
4. **分階段交付否決**:MVP 可用 extensions 比例低(A3 只能跑純 LSP),使用者價值低;要到 1 人年以上投入才能達到「extension 體驗可用」門檻

---

## 方向 B:完整 Git 圖形介面

### B.1 技術可行性

**可行性評級:🟡 中(元件成熟但 graph 層需自建)**

BAT 是 Electron + React + TypeScript 專案,Node.js runtime 本地可用 → 可直接調用 `simple-git` wrapping git CLI。跨平台由 Git CLI 本身保證。主要挑戰在**視覺化層**(見 B.2)。

### B.2 OSS 生態盤點

#### Git 操作後端(**推薦 `simple-git`**)

| 函式庫 | Weekly Downloads | 效能 | 適用性 | 推薦度 |
|-------|------------------|------|-------|-------|
| **simple-git** | 7.9M | 中(wrap CLI) | Electron Node 環境最適 | 🟢 **推薦為主要後端** |
| **isomorphic-git** | 628k | 低(純 JS) | Browser + Node,但限制多 | 🔴 不推薦(見下) |
| **nodegit** | 29k | 高(libgit2 binding) | 安裝複雜、跨平台坑多 | 🟡 僅在需要極致效能時考慮 |

**isomorphic-git 已知限制**(官方 repo issues 驗證):
- ❌ 不支援 recursive merge strategy(多個 merge base 時直接失敗)
- ❌ 不支援 `git merge --continue` / `--abort`
- ❌ Rebase 尚未實作(Issue #1527 仍開放)
- ❌ 大 pack file 效能差(Issue #291 / #2017)
- ❌ 加少量檔案可能增 300-500 MB(Issue #2017)

**結論**:BAT 作為**專業 Git GUI**不應採用 `isomorphic-git` — 其限制會直接撞到日常使用者的 merge/rebase/大 repo 場景。`simple-git` 雖然是 CLI wrapper,但 Electron 環境 Git CLI 必然存在(跟 BAT 本身的終端核心共存不衝突),行為與真實 Git 100% 一致。

#### Git Graph 視覺化(**需自建**)

| 函式庫 | 狀態 | 結論 |
|-------|------|------|
| **gitgraph.js / @gitgraph/react** | 🔴 **已 ARCHIVED**(2024) | 不可採用,作者自己推薦遷移至 Mermaid |
| **Mermaid.js gitgraph 語法** | 🟢 活躍 | 可作靜態 diagram,但**不支援互動**(click commit / drag branch / virtualized scroll) |
| **自建 SVG / Canvas graph** | — | 🟡 需自行實作,但完全可控 |

**結論**:Graph 層需自建。好消息是 Git graph 佈局演算法已有公開文獻(GitKraken 等均可參考),實作量估 1-2 人週(簡單版)或 4-6 人週(含 virtualization 支援 10k+ commits)。

#### 競品對比(3 個代表性 feature 的縫隙分析)

| Feature | SourceTree | GitKraken | Fork | Lazygit | **BAT 定位機會** |
|---------|-----------|-----------|------|---------|-----------------|
| **3-way merge UI** | ✅ 有 | ✅ 有 | ✅ 有 | ❌ 無(用 editor) | 🟡 必做,無差異化空間 |
| **Interactive Rebase** | 🟡 基本 | ✅ 拖拉 | 🟡 基本 | ✅ 最強(鍵盤) | 🟢 BAT 結合終端 + 鍵盤操作可學 Lazygit |
| **Stash 管理** | ✅ 有 | ✅ 有 | ✅ 有 | ✅ 有 | 🟢 必做,無差異化空間 |
| **工單-commit 反查** | ❌ 無 | ❌ 無 | ❌ 無 | ❌ 無 | 🟢 **BAT 真正差異化**(CT PLAN-014 → 列出相關 commits) |
| **BMad Phase 視覺化** | ❌ 無 | ❌ 無 | ❌ 無 | ❌ 無 | 🟢 **BAT 真正差異化**(Phase 完成節點標示在 graph 上) |

#### TUI 啟發(Lazygit / GitUI)

- **Lazygit**(jesseduffield, 76k stars, 2026-04 v0.61.0 active):interactive rebase / 逐行 stage / worktrees / 自訂 script 綁定快捷鍵。**證明「終端風格 Git UI」在 2026 仍有強大需求**
- **GitUI**(Rust):更快啟動 / 更低記憶體,feature 較少
- **啟發價值**:BAT 若走「BAT 內嵌 Git panel,以終端 + 鍵盤為優先操作」路線,可搶佔 SourceTree/GitKraken 不擅長的市場(鍵盤重度使用者、開發者社群)

### B.3 工作量估算 + MVP 定義

| 階段 | 範圍 | 估算 |
|------|------|------|
| **MVP α**(2-3 週) | `simple-git` 整合、log 列表、branch 列表、commit diff 檢視、基本 checkout | 🟢 4-6 人週 |
| **MVP β**(再 2-3 週) | SVG graph 渲染(直接畫線,不做 virtualization)、merge 觸發 + 3-way 解衝突提示(跳外部 mergetool 可接受) | 🟢 再 4-6 人週 |
| **Differentiator**(2 週) | CT 工單索引 ↔ commit 反查、BMad Phase 節點標記 | 🟢 再 2-4 人週 |
| **Full parity**(3-6 月) | Interactive rebase UI、stash 管理 UI、submodule、virtualized graph(10k+ commits)、LFS | 🟡 3-6 人月 |

**MVP 可交付的使用者價值**:
- Week 6:使用者可在 BAT 內瀏覽 commits、切換 branch、看 diff、做基本 merge(與 SourceTree 基本 feature parity)
- Week 8:使用者可以「從 PLAN-014 工單跳到相關 commits 的 graph」——這是 SourceTree/GitKraken/Fork/Lazygit **都做不到的事**

### B.4 授權 / 安全 / 維護成本

#### 🟢 授權風險:低

| 函式庫 | 授權 | 風險 |
|-------|------|------|
| simple-git | MIT | 🟢 無 |
| Mermaid.js | MIT | 🟢 無 |
| nodegit(選用) | MIT | 🟢 無 |
| Lazygit(參考啟發,不引入代碼) | MIT | 🟢 無(只借鏡 UX) |

#### 🟢 安全模型:低

Git CLI 本身是系統工具,`simple-git` 只是 wrapper。唯一需注意:若要支援執行 user-provided git hooks 或遠端 fetch,需標準的 Electron IPC 隔離(BAT 現有架構已支援,無需新機制)。

#### 🟢 維護成本:低

- Git CLI 行為 15+ 年穩定
- `simple-git` 成熟、社群大、更新頻率合理(not aggressive)
- 自建 graph 層是**一次性投入,後續維護少**(不會因為 Git 升級而需跟進)

### B.5 與 BAT 整合點

| 整合點 | 複雜度 | 備註 |
|--------|-------|------|
| 在 BAT 側邊開 Git panel | 🟢 低 | BAT 已有 sidebar / docking / split-view 機制(T0117/T0118 的 lazy mounting 基礎) |
| `simple-git` 操作當前 cwd | 🟢 低 | BAT 已知 active workspace 的 cwd |
| Terminal 內 `git` 命令同步到 Git panel | 🟡 中 | 需監測 git command → 刷新 panel(可用 file watch `.git/HEAD` 等) |
| **CT 工單索引 ↔ commits 反查** | 🟡 中 | 需 parse commit messages 抓 `T####` / `PLAN-###` token,建立索引 |
| **BMad Phase 節點標記** | 🟡 中 | 需 parse sprint-status.yaml / phase completion time,對應到 commits |
| Graph 渲染元件(SVG/Canvas) | 🔴 中高 | 自建,但演算法清晰 |
| Virtualized scroll(大 repo) | 🔴 高 | Phase 2+ 才做,MVP 不需 |

### B.6 推薦或放棄理由

**推薦方向 B**——四重支持:

1. **可行性**:元件成熟、授權清晰、BAT 架構天然契合
2. **分階段交付**:每 2 週都可釋出有用 feature,使用者早期就能感受價值
3. **真實差異化**:CT 工單 ↔ commit 反查、BMad Phase 視覺化是**市場空白**,非模仿 SourceTree
4. **維護可持續**:Git CLI 穩定,一次建構後維護成本低,符合本專案單人維護模式

---

## 對比與結論

### 八維度對比表(驗證 PLAN-014 紙上傾向)

| # | 維度 | 方向 A(VS Code 插件) | 方向 B(Git GUI) | PLAN-014 紙上 | 本研究驗證 |
|---|------|-----------------------|--------------------|---------------|-----------|
| 1 | **技術可行性** | 🔴 難 | 🟡 中 | A 🔴 / B 🟡 | ✅ 一致 |
| 2 | **實作工作量(MVP)** | 🔴 6-12 人月 | 🟢 4-6 人週 | — | 🔍 新證據(A 比 PLAN-014 估計更重) |
| 3 | **實作工作量(完整)** | 🔴 2-3 人年 | 🟡 3-6 人月 | — | 🔍 新證據 |
| 4 | **維護成本** | 🔴 高(VS Code API 月更) | 🟢 低(git CLI 15+ 年穩定) | A 🔴 / B 🟢 | ✅ 一致 |
| 5 | **授權風險** | 🔴 高(MS Marketplace ToU) | 🟢 低(MIT) | — | 🔍 **新證據(紙上未充分討論,是關鍵發現)** |
| 6 | **分階段交付** | 🔴 難(MVP 比例低) | 🟢 易(每 2 週可交付) | A 🟡 / B 🟢 | ✅ 強化(A 比紙上更難) |
| 7 | **差異化潛力** | 🔴 低(VS Code 免費 + Cursor 已 AI 化) | 🟢 高(CT/BMad 整合) | A 🔴 / B 🟢 | ✅ 一致 |
| 8 | **競品強度** | 🔴 強(VS Code + Cursor + Theia) | 🟡 中(SourceTree/GitKraken/Lazygit 有縫隙) | — | 🔍 新證據 |

**PLAN-014 紙上傾向(方向 B 勝出)—— ✅ 驗證並強化**。關鍵新證據:
- **方向 A 的授權風險**是 showstopper 級(紙上未充分評估)
- **方向 A 的工作量**比紙上估計更重(MVP 就要人月級)
- **方向 B 的差異化**比紙上描述更具體(CT 工單反查 + BMad Phase 節點是市場空白)

### 建議下一步(Phase 2 範圍)

**推薦選項:[B] 只 B 值得 Phase 2 POC**

#### Phase 2 POC 建議範圍(供塔台另派工單參考)

**單張 POC 工單**(建議不超過 2 週,驗證 3 個高風險假設):

1. **Assumption-1:大 repo graph 渲染效能**
   - 驗證方法:在 Linux kernel repo(~1M commits)上跑 SVG graph,測 scroll FPS
   - 過關條件:10k commits 內 60fps 流暢;超過 10k 有 virtualization 策略
   - 風險:若 SVG 不夠用,需改 Canvas(多 1-2 週)

2. **Assumption-2:CT 工單-commit 反查 UX 流暢度**
   - 驗證方法:實作「從 `_ct-workorders/T0152.md` 點擊 → 跳到含 `T0152` 的 commits graph」
   - 過關條件:查詢 <100ms,UI 切換無明顯延遲
   - 風險:若 commit 訊息無 `T####` token 則無法反查(需 CT commit 規則強制)

3. **Assumption-3:互動式 rebase UX 是否值得做**
   - 驗證方法:實作**最小** interactive rebase 介面,和 Lazygit 比較鍵盤流暢度
   - 過關條件:使用者(本專案維護者自己)主觀評估不輸 Lazygit
   - 風險:若輸給 Lazygit,則 BAT 的 Git panel 不需要做 rebase,應該直接內嵌 Lazygit(或引導使用者走終端)

#### 不建議的 Phase 2 策略

- ❌ **不需要 EXP 單**:POC 只驗證假設,結論清楚後進正式工單實作
- ❌ **不需要 worktree 策略**:POC 範圍小、改動獨立、主線不受影響,main branch feature branch 即可
- ❌ **不要同時做 A/B POC**:方向 A 結論已足夠清楚放棄,同時做會分散資源

### 實作驗證需求(Phase 1 紙上無法完全回答的問題)

本 Phase 1 結論在「方向 A 放棄 / 方向 B 採用」層面**已可決策**,但方向 B 的具體實作策略有三點需 POC 驗證(見上方 Phase 2 建議)。紙上可結論的部分:

✅ 方向 A 不值得深入(授權 + 工作量雙否決)
✅ 方向 B 值得深入(技術可行 + 差異化清晰)
✅ `simple-git` 是方向 B 首選後端
✅ Git graph 層需自建(gitgraph.js 已 ARCHIVED)

❓ POC 才能確認(Phase 2):
- 大 repo 視覺化效能策略選擇(SVG vs Canvas vs virtualization)
- CT 工單反查的實務 UX
- Interactive rebase 是否要在 GUI 內做,還是外包給 Lazygit

---

## 附錄:參考資料清單

### 方向 A 來源

- [code-server FAQ and architecture](https://coder.com/docs/code-server/FAQ) — code-server 使用 submodule + patch 策略,以 Open-VSX 為 registry
- [openvscode-server (Gitpod)](https://github.com/gitpod-io/openvscode-server) — 類似 code-server 的上游 VS Code 遠端部署
- [Eclipse Theia VS Code Extension Compatibility](https://theia-ide.org/docs/user_install_vscode_extensions/) — Theia 全相容 VS Code Extension API(2026-02 Community Release 達到 1.108.0)
- [Celebrating Eclipse Theia's VS Code Extension API Compatibility Milestone](https://eclipse-foundation.blog/2023/12/18/celebrating-eclipse-theias-milestone-full-compatibility-with-vs-code-extension-api/) — 2023-12 Theia 全相容里程碑
- [Microsoft Visual Studio Marketplace Terms of Use (2025-03)](https://cdn.vsassets.io/v/M253_20250303.9/_content/Microsoft-Visual-Studio-Marketplace-Terms-of-Use.pdf) — **關鍵法務文件**:禁止非 In-Scope Products 使用 Marketplace offerings
- [Marketplace ToU vs GPL discussion (microsoft/vsmarketplace#322)](https://github.com/microsoft/vsmarketplace/discussions/322) — 社群對 ToU 爭議
- [Eclipse Open VSX Registry](https://open-vsx.org/) — VS Code extensions 的合法替代來源
- [Migrating VS Code to Process Sandboxing (2022-11)](https://code.visualstudio.com/blogs/2022/11/28/vscode-sandbox) — VS Code sandbox 遷移技術細節(extension host IPC)
- [VSCode Architecture Analysis](https://dev.to/ninglo/vscode-architecture-analysis-electron-project-cross-platform-best-practices-g2j) — Electron + VS Code 架構分層

### 方向 B 來源

- [npm Compare: isomorphic-git vs nodegit vs simple-git](https://npm-compare.com/isomorphic-git,nodegit,simple-git) — 三個 Git 函式庫的使用量與效能比較
- [npmtrends: isomorphic-git vs nodegit vs simple-git](https://npmtrends.com/isomorphic-git-vs-nodegit-vs-simple-git) — Weekly downloads 比較
- [isomorphic-git merge limitations](https://isomorphic-git.org/docs/en/merge.html) — 官方文件:不支援 recursive merge、無法 abort/continue
- [isomorphic-git: support incomplete merges (#841)](https://github.com/isomorphic-git/isomorphic-git/issues/841) — merge 限制討論
- [isomorphic-git: pull --rebase (#1527)](https://github.com/isomorphic-git/isomorphic-git/issues/1527) — Rebase 尚未實作
- [isomorphic-git: large pack file performance (#291)](https://github.com/isomorphic-git/isomorphic-git/issues/291) — 大 repo 效能問題
- [isomorphic-git: large repo usage problems (#2017)](https://github.com/isomorphic-git/isomorphic-git/issues/2017) — 多 pack file、size bloat
- [gitgraph.js (ARCHIVED)](https://github.com/nicoespeon/gitgraph.js/) — 已歸檔,作者推薦遷移至 Mermaid
- [@gitgraph/react on Snyk Advisor](https://snyk.io/advisor/npm-package/gitgraph-react) — 確認 12+ 個月無活動,實質為 discontinued
- [Mermaid gitgraph syntax](https://mermaid.ai/open-source/syntax/gitgraph.html) — 靜態 diagram 替代方案
- [Lazygit](https://github.com/jesseduffield/lazygit) — 76k stars, 2026-04 v0.61.0,interactive rebase / stash / worktree 的 TUI 標竿
- [Lazygit Interactive Rebasing wiki](https://github.com/jesseduffield/lazygit/wiki/Interactive-Rebasing) — Interactive rebase UX 參考
- [GitUI (Rust TUI)](https://kx.cloudingenium.com/en/gitui-terminal-ui-git-blazing-fast-rust-staging-guide/) — 速度導向的 Rust TUI 競品

### BAT 自有上下文(本地文件,非 URL)

- `_ct-workorders/PLAN-014-evaluate-vscode-extension-vs-git-gui.md` — 本研究的 PLAN 來源
- `_ct-workorders/_backlog.md` — PLAN-014 在 backlog 的記錄
- `CLAUDE.md` — BAT 專案規範
- Git log of T0063-T0151 — 本專案 4 月密集 sprint 的 commit 史(顯示 commit 訊息包含 T#### / BUG-### 結構化 token)

---

**報告撰寫完成時間**:2026-04-17(Phase 1 結束)
**下一步**:由塔台根據本結論決定是否派 Phase 2 POC 工單;PLAN-014 狀態建議由 IDEA → PLANNED(方向 B)並移除方向 A。
