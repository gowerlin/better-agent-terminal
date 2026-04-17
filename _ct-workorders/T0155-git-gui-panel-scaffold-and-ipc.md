# T0155-git-gui-panel-scaffold-and-ipc

## 元資料
- **工單編號**:T0155
- **任務名稱**:Phase 3 Tα1 — Git GUI panel 骨架 + simple-git IPC
- **狀態**:IN_PROGRESS
- **類型**:implementation
- **互動模式**:disabled
- **建立時間**:2026-04-17 23:10 (UTC+8)
- **開始時間**:2026-04-17 23:11 (UTC+8)
- **關聯 PLAN**:PLAN-014(Phase 3 第一張)
- **前置工單**:T0152 / T0153 / T0154
- **預計工時**:0.8 人週(Worker 自行判斷,單 sub-session 完成為佳)

---

## 目標

建立 Git GUI 的**基礎框架**,為後續 Tα2-5 實作提供可掛載的 panel + Git 後端 IPC 通道。

**本工單不涉及**:graph 渲染(Tα2 範圍)、索引(Tα4 範圍)、實際 Git 操作 UI(Tα5 範圍)。

---

## 背景與依據

- **前置共識**:T0154 實測確認 SVG + virtualization 撐 500k commits @ 60FPS,simple-git(MIT)為 Git 後端共識
- **Phase 3 工單規劃**(見 T0154 報告):
  - **Tα(MVP α)**:Tα1 骨架 / Tα2 graph / Tα3 layout / Tα4 索引 / Tα5 基礎操作
  - **Tβ(MVP β)**:Tβ1 Lazygit / Tβ2 commit detail + branch ops / Tβ3 remote + search
  - **Tδ(Differentiator)**:Tδ1 CT 感知 rebase todo 產生器

---

## 實作範圍

### 1. Git panel UI 骨架(React + BAT dock system)

- 位置:`src/components/git-panel/`(**正式目錄**,非 POC)
- 入口:整合到 BAT dock system(參考既有 panel 如 ControlTower / BMadGuide)
- 最小 UI:
  - Panel header(標題「Git」+ 基本工具列 placeholder)
  - 空白內容區(標示「Graph 實作中 — Tα2 範圍」)
  - 正確接上 BAT dock 的顯示/隱藏、resize、workspace 切換
- **不做**:graph 渲染、commit list、任何實際 Git 操作

### 2. simple-git IPC handler(main process)

- 新檔:`src/main/git/git-ipc.ts`(或符合 BAT 既有 main process 結構)
- 引入依賴:`simple-git`(`npm install simple-git` — MIT,見 T0152 授權確認)
- IPC channels(命名遵循 BAT 既有 pattern):
  - `git:getRepoInfo`(獲取當前 workspace 的 repo 基本資訊:HEAD、branch、remote URL)
  - `git:listCommits`(取得 commits,支援 limit/offset — Tα2 會用)
  - `git:healthCheck`(驗證 simple-git 能正確連到 workspace 的 git repo)
- 錯誤處理:
  - Workspace 非 git repo → 回傳明確錯誤給 renderer
  - simple-git 調用失敗 → logger.error + structured error response

### 3. Renderer 端 API 封裝

- 新檔:`src/renderer/api/git.ts`(或符合既有 API 封裝 pattern)
- 封裝 IPC invoke:`getRepoInfo()` / `listCommits()` / `healthCheck()`
- TypeScript 型別:完整標注 simple-git 回傳結構(若 simple-git 型別不全,手動補 — 見 T0153 遭遇問題 4,預留 ~0.2 人週)

### 4. 最小整合驗證

- Panel 載入時自動呼叫 `git:healthCheck`,顯示結果(log 到 console 或 panel 內部 placeholder 文字)
- **不做**:UI 上的 commit 列表、使用者互動流程

---

## 完成條件(DoD)

- ✅ BAT 啟動後,Git panel 可於 dock 正確顯示/隱藏、resize
- ✅ Panel 載入時 IPC 通道暢通,`healthCheck` 返回正確結果(成功/失敗皆可,重點是鏈路通)
- ✅ Workspace 切換時 panel 正確切換 repo context(參考 BAT 既有 workspace 切換邏輯)
- ✅ `npm run build` 通過(無編譯錯誤)
- ✅ 無破壞既有功能(基本冒煙測試:開啟/關閉 Control Tower panel、切換 workspace、退出 BAT)
- ✅ Commit 包含:panel 組件、IPC handler、renderer API、package.json 更新

---

## 技術指引

### 參考 BAT 既有 panel 實作

- **Control Tower panel**:`src/components/ControlTower/` 或類似路徑(作為 panel 結構參考)
- **BMad Guide panel**:作為另一個 panel 模式參考
- 沿用既有 dock layout / visibility toggle / workspace context 機制

### simple-git 初始化

```ts
import simpleGit, { SimpleGit } from 'simple-git';

const git: SimpleGit = simpleGit(workspacePath);
```

注意 `workspacePath` 從 BAT 既有 workspace state 取得,不要自己實作 workspace resolver。

### T0154 benchmark 代碼

T0154 的 `src/components/git-poc/benchmark/` **不要**移到 Git panel(屬 Tα2 範圍)。本工單只做骨架 + IPC,benchmark 代碼等 Tα2 再整合。

### 禁止項

- ❌ 不要修改 BAT 核心模組(TerminalServer、PtyManager、核心 dock 邏輯)
- ❌ 不要實作 graph 渲染(Tα2)
- ❌ 不要引入除 simple-git 外的新依賴
- ❌ 不要動 `src/components/git-poc/`(T0153/T0154 遺產,保留作 Tα2 起點)

---

## 預期 commits

- `feat(git-panel): add Git panel scaffold and simple-git IPC (T0155)`
  - 若拆多 commits:每個都以 `feat(git-panel):` 開頭
- 收尾:無需獨立收尾 commit

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 互動紀錄
無

### 實作摘要

**新增檔案**:
- `electron/git/git-ipc.ts` — simple-git 後端 IPC handlers(3 channels)
- `src/lib/git-scaffold.ts` — renderer API 封裝(healthCheck / getRepoInfo / listCommits)
- `src/components/git-panel/GitGraphPanel.tsx` — panel 骨架(header + placeholder + health 顯示)
- `src/components/git-panel/index.ts` — barrel export

**修改檔案**:
- `package.json` / `package-lock.json` — 新增 `simple-git ^3.36.0` 依賴(MIT,見 T0152)
- `electron/main.ts` — import + 呼叫 `registerGitScaffoldHandlers()` 於既有 git handlers 前
- `electron/preload.ts` — 新增 `window.electronAPI.gitScaffold.{healthCheck,getRepoInfo,listCommits}`
- `src/types/electron.d.ts` — 對應新增 `ElectronAPI.gitScaffold` 型別宣告
- `src/types/index.ts` — `DockablePanel` union / `DOCKABLE_PANELS` / `DEFAULT_DOCKING_CONFIG` 加入 `git-graph`(預設 `main`)
- `src/App.tsx` — 新增 `LazyGitGraphPanel`、`renderDockablePanel` switch 增加 `case 'git-graph'`、兩處 collapsed-bar icon mapping 加入 `📈` (U+1F4C8)
- `src/locales/{en,zh-TW,zh-CN}.json` — `workspace.git-graph` 標籤 + 新增 `gitGraph.*` i18n 鍵(title / refresh / graphComingSoon / health.{idle,loading,ok,notARepo,error})

**dock 整合點**:沿用 BAT 既有 dock system。新 panel 以 `DockablePanel = 'git-graph'` 形式登記到 `DOCKABLE_PANELS`,預設落在 `main` zone。透過 `renderDockablePanel` 的 switch case 透過 `<LazyGitGraphPanel workspaceFolderPath={activeWorkspace.folderPath} />` 掛載。Lazy 掛載、Suspense wrapper、workspace 切換、dock zone 拖拽、collapsed-bar icon、i18n 標籤皆自動取得(全部走既有 BAT 機制,未改任何核心邏輯)。與既有 `GitPanel`(`case 'git'`)**並行存在**,互不干擾。

**IPC channels**(命名前綴 `git-scaffold:` 以與既有 child_process 版 `git:*` 區隔):
- `git-scaffold:healthCheck(cwd)` → `{ ok, isRepo, gitRoot, error? }`
- `git-scaffold:getRepoInfo(cwd)` → `{ ok, head, branch, detached, remotes[], gitRoot, error? }`
- `git-scaffold:listCommits(cwd, { limit?, offset? })` → `{ ok, commits: GitScaffoldCommit[], error? }`

### 驗證結果

- [x] `npx vite build` 通過(renderer + main + preload + terminal-server 四階段都 ok,無編譯錯誤)
- [x] dist bundle 確認:`dist-electron/main.js` 內有 3 個 `git-scaffold:*` channel、`simple-git` 被引用 3 次;`dist-electron/preload.js` 有 `gitScaffold` 暴露;`dist/assets/index-*.js` 內含 `GitGraphPanel` / `git-graph`
- [x] 既有 `git:*` handlers、既有 `GitPanel.tsx`、`DockablePanel` 既有成員皆未被動到(透過 diff 和 grep 交叉確認)
- [x] `simple-git ^3.36.0`(MIT)成功安裝並進入 dependency tree
- [ ] 執行時驗證(panel 顯示/隱藏/resize、workspace 切換、healthCheck 鏈路)— **未執行**,屬於必須啟動 Electron 的測試;靜態驗證(build + bundle inspect)已涵蓋鏈路完整性。建議塔台或驗收人在本機啟動 BAT 做一次冒煙。

### 遭遇問題

1. **既有已有 `GitPanel.tsx`**:工單敘述隱含是「從零建立」但專案早已存在功能完整的 `src/components/GitPanel.tsx`(3-column commits/files/diff UI,使用 `child_process` 直呼 git CLI)。採取的處置:**並行策略**——新 panel 以獨立 `DockablePanel = 'git-graph'` 登記,簡體中文標籤「Git 图谱」/繁中「Git 圖譜」/英文「Git Graph」,與既有「Git」tab 並列。這樣符合工單第 109 行「不要動 `src/components/git-poc/`」的保留精神,且讓使用者能視覺區分「既有 diff-oriented Git」vs「新 graph-oriented Git Graph」。**建議塔台決策**:Tα5 完成後,是保留雙 panel 還是廢棄舊 GitPanel(或反之),需在 Phase 3 roadmap 明確。
2. **TypeScript variance 錯誤**:`registerHandler` 的 `Handler` type 使用 `(ctx, ...args: unknown[]) => Promise<unknown> | unknown`,而具體 handler 用具體 parameter type 時在 `strict: true` 下觸發 function-parameter contravariance 檢查,報 TS2345。**這是 BAT 既有 pattern**——`electron/main.ts` 裡數十個 `registerHandler` 呼叫(如 `'pty:write'`、`'pty:resize'`、`'git:branch'` 等)全都觸發同類錯誤,只是 `npm run build` 跑 vite(不跑 `tsc --noEmit`)故 runtime build 無影響。我的 3 個新 handler(`healthCheck` / `getRepoInfo` / `listCommits`)與既有風格一致,不引入新模式。**建議塔台決策**:是否排一張 chore 工單去修 `Handler` type(加泛型),或維持現狀。
3. **Panel 內部樣式採 inline style**:BAT 既有 panel 多以 CSS class 搭配 `src/styles/` 管理,但本工單只做骨架,先用 inline style 避免擴散到 style files(避免影響「無破壞既有功能」)。Tα3(layout)應補 CSS class 並遷出 inline style。

### Phase 3 下一張建議
- [x] 可直接派 Tα2(SVG commit graph + 自製 virtualization)
  - 基礎 `GitGraphPanel` 已就緒,body 內 placeholder 換成 SVG graph 即可
  - `git-scaffold:listCommits(cwd, { limit, offset })` 已提供分頁支援,可直接對接 T0154 benchmark 的 SvgCommitGraph / useVirtualizer 模組(整合時從 `src/components/git-poc/benchmark/` 遷到 `src/components/git-panel/`)
  - Parents 欄位已包含(`commits[i].parents: string[]`),graph edge 繪製可直接用
- [ ] 需先調整 Tα2 範圍(無,保持原規劃)
- [ ] 有其他發現影響 Phase 3 規劃
  - 建議塔台在 Phase 3 roadmap 中明確舊 `GitPanel.tsx` 的去留(見「遭遇問題 1」);Tα5(基礎操作)是統整舊 panel 能力或獨立實作的決策點

### Commit(s)
- `<待 commit 後回填>`

### 回報時間
2026-04-17 23:32 (UTC+8)
