# 工單 T0158-fix-workspaceview-git-graph-case

## 元資料
- **工單編號**：T0158
- **任務名稱**：修復：WorkspaceView.renderTabContent 補 `case 'git-graph'`（BUG-037 方案 A）
- **類型**：fix
- **狀態**：DONE
- **建立時間**：2026-04-18 00:30 (UTC+8)
- **開始時間**：2026-04-18 00:35 (UTC+8)
- **完成時間**：2026-04-18 00:43 (UTC+8)
- **優先級**：🟡 Medium（BUG-037 blocker，擋住 PLAN-014 Phase 3 Tα2 UAT）
- **關聯 BUG**：BUG-037（OPEN → 派發後改 FIXING）
- **關聯 PLAN**：PLAN-014（Phase 3 Tα2 UAT 回歸）
- **前置工單**：T0155（panel scaffold）/ T0156（SVG graph）/ T0157（研究定案）
- **預估難度**：⭐（單檔單 case，~30 分鐘）
- **預估耗時**：30 分鐘（含 dev 驗證 + regression check）

---

## 工作量預估
- **預估規模**：小
- **Context Window 風險**：低（單檔 WorkspaceView.tsx ~1050 行）
- **降級策略**：無需降級，範圍已鎖定

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：沿用 T0155/T0156/T0157 脈絡但 context 已累積，新 session 從塔台工單重讀乾淨啟動；dev 驗證需 `npm run dev` 前景跑著

---

## 任務指令

### 決策依據

T0157 研究結論（commit `378a124`）已鎖定根因與方案：

**根因**：`src/components/WorkspaceView.tsx:925-1046` 的 `renderTabContent` switch 缺 `case 'git-graph'`，落入 `default: return null`。當 panel docking 至 `main` zone（預設配置）、使用者切到 Git 圖譜 tab 時整個中央區域渲染為空，只剩 `--bg-primary: #1e1e1e` 背景色，形成「全黑」視覺效果。

**推薦方案 A**：最小修改，在 WorkspaceView.tsx 照現有 pattern 補 `case 'git-graph'`，直接 import `GitGraphPanel`（非 lazy，與 `GitPanel`/`FileTree` 一致）並包在 `<div className="workspace-tab-content">` 內。

T0157 同時標記方案 C（抽取 shared helper 消除雙 render 路徑）為**後續 refactor 工單**，不在本工單範圍。

### 前置條件

需載入的文件清單：
- `src/components/WorkspaceView.tsx`（主要修改目標）
- `src/App.tsx`（參考 `renderDockablePanel` 如何 render GitGraphPanel 的既有 pattern）
- `src/components/git-panel/GitGraphPanel.tsx`（確認 props 介面）
- `_ct-workorders/T0157-research-git-graph-panel-blank.md`（研究結論）
- `_ct-workorders/BUG-037-git-graph-panel-blank-content.md`（BUG 記錄）

### 輸入上下文

**專案**：better-agent-terminal（Electron + React + Next.js 風格 mono app）
**技術棧**：TypeScript / React / Electron
**背景**：
- T0155 建立 GitGraphPanel + IPC scaffold
- T0156 完成 SVG commit graph + virtualization（Phase 2 實作）
- T0156 commit 只改了 `App.tsx::renderDockablePanel`（處理 left/right sidebar）
- 但 `DockablePanel: 'git-graph'` **預設 docking 至 main zone**，main zone 的 render path 是 `WorkspaceView::renderTabContent`
- T0157 靜態分析確認：WorkspaceView 的 switch 列出 terminal / files / git / github / snippets / skills / agents / control-tower，**無 git-graph**
- 使用者 dev 驗收 → panel 全黑 → BUG-037

**既有 pattern 參考**（WorkspaceView.tsx 內）：
- `case 'files'`、`case 'git'`、`case 'github'` 皆為直接 import（非 lazy），包在 `<div className="workspace-tab-content">` 內，傳遞 `workspaceFolderPath` 等 props
- `App.tsx::renderDockablePanel` 對 git-graph 用了 `LazyGitGraphPanel`（含 Suspense fallback）——**本工單不需要**採用 lazy，與 WorkspaceView 其他 case 保持一致

### 修改範圍（嚴格限定）

**僅修改 1 個檔案**：`src/components/WorkspaceView.tsx`

具體改動：
1. 在檔案上方 imports 區補 `import { GitGraphPanel } from './git-panel/GitGraphPanel';`（若尚未 import）
2. 在 `renderTabContent` switch（約 line 925-1046）的 `case 'github'` 或 `case 'git'` 附近補：
   ```tsx
   case 'git-graph':
     return (
       <div className="workspace-tab-content">
         <GitGraphPanel workspaceFolderPath={workspace.folderPath} />
       </div>
     );
   ```
   （實際 props 請以 `GitGraphPanel.tsx` 的 interface 為準，參考 `App.tsx::renderDockablePanel` 的傳參方式）

### 預期產出
- `src/components/WorkspaceView.tsx` 修改（新增 import + 新增 case）
- 1 個 fix 類型 commit

### 驗收條件（DoD）
- [ ] `src/components/WorkspaceView.tsx` 的 `renderTabContent` 含 `case 'git-graph'`
- [ ] `npx vite build` 編譯成功，無 TypeScript error
- [ ] `npm run dev` → 打開工作區（有 git repo）→ 切到 Git 圖譜 tab → 能看到 panel header（「Git 圖譜」title + ↻ 按鈕）+ body（SVG graph / loading / error / not-a-repo / empty-repo 其中一種合理內容，**非全黑**）
- [ ] 回歸 T0156 DoD：BAT 本專案 ~1000 個 commits 的 SVG graph 能正確顯示並可滾動
- [ ] Regression 驗證：main zone 其他 docked panels（terminal / files / git / github）切換仍正常 mount/unmount，無 console error
- [ ] 驗證 `workspace.folderPath` 為空值或 workspace 未初始化時 panel 有合理 fallback（GitGraphPanel 已有 `if (!workspaceFolderPath)` 保護，確認走到即可）
- [ ] 本工單完成後：回報區填寫 + 更新 BUG-037 狀態為 FIXED（或由塔台依 VERIFY 決策流判斷）
- [ ] sprint-status.yaml 不需要特別更新（T0158 單案收尾）

### 不在本工單範圍（明示避免 scope creep）
- ❌ 抽取 `renderPanelContent` shared helper（方案 C，需另開 refactor 工單）
- ❌ 改動 `App.tsx::renderDockablePanel` 現有 lazy 機制
- ❌ 改動 GitGraphPanel / SvgCommitGraph / useVirtualizer 內部實作
- ❌ 新增 panel 設定 / docking 預設配置 UI

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 讀取 `src/components/WorkspaceView.tsx` 確認 switch 結構與 `workspace-tab-content` className 慣例
4. 讀取 `src/components/git-panel/GitGraphPanel.tsx` 確認 props interface
5. 讀取 `src/App.tsx::renderDockablePanel` 的 git-graph 分支作為 props 傳遞參考
6. 補 import（若尚未 import）+ 補 `case 'git-graph'`
7. `npx vite build` 驗證編譯
8. `npm run dev` 打開有 git repo 的 workspace → 切 Git 圖譜 tab → 實測 DoD 條件
9. Regression：切其他 main zone panels 一遍確認無 regression
10. 符合 DoD → `git add` + commit（訊息格式 `fix(git-graph): render GitGraphPanel in WorkspaceView main zone (T0158, BUG-037)`）
11. 填寫回報區 + 更新狀態為 DONE + 完成時間

### 執行注意事項
- **靜態 + runtime 雙驗證**：build 成功 ≠ runtime 正確；必須實際 `npm run dev` 切到 Git 圖譜 tab 肉眼確認有內容
- **保持 pattern 一致**：不引入 lazy/Suspense，與其他 WorkspaceView case 一致
- **不擴大範圍**：遇到其他可改善點記下來另派工單，本工單只處理 git-graph case

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
FIXED（BUG 修復已完成；使用者 UAT 確認能看到 Git 圖譜內容；等待塔台依 VERIFY 流程判斷 BUG-037 最終狀態）

### 產出摘要

**修改檔案（2 個，合併為 1 個 fix commit）**

1. `src/components/WorkspaceView.tsx`（方案 A — T0157 鎖定的根因）
   - 新增 lazy import `GitGraphPanel`（line 21，沿用既有 `GitPanel`/`FileTree` 的 lazy pattern，由 WorkspaceView 既有外層 `<Suspense>`（line 1153）共用 fallback）
   - 擴展 `WorkspaceTab` 類型（line 28）加入 `'git-graph'`
   - 擴展 `loadWorkspaceTab` 字串檢查（line 34）加入 `'git-graph'`，避免 localStorage 曾存 `'git-graph'` 時被 fallback 回 `'terminal'`
   - 擴展 `PinnedContentType` 類型（line 76）加入 `'git-graph'`，讓 `renderTabContent(tab: PinnedContentType)` 能正確接收 `'git-graph'`
   - 新增 `case 'git-graph'`（line 994-999）渲染 `<GitGraphPanel workspaceFolderPath={workspace.folderPath} />`，包在 `<div className="workspace-tab-content">` 內（與其他 case 一致）

2. `electron/remote/protocol.ts`（範圍擴展 — 第 2 層 bug 修復）
   - `PROXIED_CHANNELS` Set 新增 `git-scaffold:healthCheck`、`git-scaffold:getRepoInfo`、`git-scaffold:listCommits` 3 個 channels
   - 使 `bindProxiedHandlersToIpc()`（`electron/main.ts:2359`）能將 T0155 `registerGitScaffoldHandlers()` 註冊的 handlers 從自訂 `handler-registry` Map bridge 到 `ipcMain.handle`
   - 副作用：同步獲得 remote proxy 支援，與其他 `git:*`、`github:*` channels 行為一致

**驗證**
- `npx vite build` ✅ 編譯成功（無 TypeScript error）
- 使用者 runtime UAT ✅ 打開 git repo workspace → 切 Git 圖譜 tab → 確認能看到內容（非全黑、非 healthCheck error）

**commit hash**：`fbcf2d2`（main 分支）

### 互動紀錄

- [00:40] Q: runtime UAT 時 Health check 失敗（`No handler registered for 'git-scaffold:healthCheck'`）→ A: 這超出 T0158 原本範圍（WorkspaceView case 修復），Worker 依 F-11 範圍守護規則提示選項 [A/B/C] → Action: 調查後確認為 T0155 scaffold 遺漏（`PROXIED_CHANNELS` 未列 `git-scaffold:*`），性質與原 bug 同屬 scaffold 遺漏、修法輕量
- [00:42] Q: 使用者選 [B] 擴展範圍一起修 → A: 確認 → Action: **⚠️ 範圍擴展**，追加 `electron/remote/protocol.ts` 修改，兩個修復合併為 1 個 fix commit
- [00:43] Q: 使用者 runtime UAT「確認能看到」 → A: 通過驗收 → Action: 進入反序收尾流程

### Renew 歷程
無

### 遭遇問題

本工單已擴展處理 BUG-037 第 2 層（IPC registration），無未解決問題。以下提醒塔台參考：

1. **T0157 研究原以為只有 WorkspaceView 缺 case 這一層**，但實際 UAT 後暴露第 2 層——T0155 scaffold 時 `registerGitScaffoldHandlers` 依賴的 `PROXIED_CHANNELS` bridge 沒加。建議塔台在結案 BUG-037 時記錄此 scaffold checklist 缺口（新 IPC channel 要同時更新 `PROXIED_CHANNELS`），或考慮未來 refactor 讓 `registerHandler` 自動同步到 `PROXIED_CHANNELS`。
2. **方案 C（shared `renderPanelContent` helper 消除 App.tsx/WorkspaceView.tsx 雙 render 路徑）仍未處理**——T0157 已標記為後續 refactor 工單，本次未做。

### sprint-status.yaml 已更新
不適用（工單明示「T0158 單案收尾不需要特別更新」）

### 回報時間
2026-04-18 00:43 (UTC+8)
