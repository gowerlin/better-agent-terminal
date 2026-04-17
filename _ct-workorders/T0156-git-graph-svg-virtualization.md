# T0156-git-graph-svg-virtualization

## 元資料
- **工單編號**:T0156
- **任務名稱**:Phase 3 Tα2 — SVG commit graph + 自製 virtualization
- **狀態**:DONE
- **類型**:implementation
- **互動模式**:disabled
- **建立時間**:2026-04-17 23:35 (UTC+8)
- **開始時間**:2026-04-17 23:43 (UTC+8)
- **完成時間**:2026-04-17 23:51 (UTC+8)
- **Commit**:b313494
- **關聯 PLAN**:PLAN-014(Phase 3 Tα2)
- **前置工單**:T0152 / T0153 / T0154 / T0155
- **預計工時**:1.0 人週(Worker 自行判斷,單 sub-session 完成為佳)

---

## 目標

將 T0155 的 Git panel placeholder 換成**真實 SVG commit graph**,整合 T0154 benchmark 代碼到正式路徑,用 `git-scaffold:listCommits` IPC 資料驅動。

**本工單不涉及**:branch layout 演算法(Tα3)、commit 互動(Tβ2)、CT 工單反查(Tα4)。

---

## 實作範圍

### 1. 代碼遷移(T0154 benchmark → 正式路徑)

從 `src/components/git-poc/benchmark/` 遷移以下檔案到 `src/components/git-panel/`:
- `useVirtualizer.ts` — 自製 windowed virtualization hook(T0154 實測撐 500k commits @ 60FPS)
- `SvgCommitGraph.tsx` — SVG graph 渲染元件
- `CommitIndex.ts`(**可選**,若 Tα4 範圍)—暫不需要

**遷移原則**:保留 T0154 架構,但:
- 移除合成資料(`synthGen.ts` 不遷,留在 benchmark 目錄)
- 移除 benchmark 專用 props(FPS meter 等)
- 保留核心 virtualization + graph 繪製邏輯

### 2. 真實資料整合

替換合成資料為真實 IPC:
- `GitGraphPanel.tsx` 呼叫 `window.electronAPI.gitScaffold.listCommits(cwd, { limit: 10000 })`
- 初始載入 10k commits(後續若使用者 scroll 到底,再載入下 10k — 分頁機制)
- 接 `parents` 欄位繪製 edge(父子連線)
- Loading / error / empty repo 狀態處理

### 3. Branch 簡化版 layout(非完整演算法)

Tα3 才是完整 branch layout 演算法。本工單用**簡化版**:
- 每個 commit 一列(vertical)
- 單 lane(如果有 N 個 parents,視覺上畫 N 條 edge 到上一個 commit,不做 lane shift)
- 僅用 commit 順序(`listCommits` 回傳順序)決定位置

這讓 graph 可用但不美觀。Tα3 會改成 git-graph-drawer 類演算法(lane assignment / edge routing)。

### 4. CSS 類別化

T0155 遺留問題 3:panel 內用 inline style。本工單**順帶**遷移到 CSS:
- 新檔:`src/components/git-panel/git-graph-panel.css`(或符合 BAT 既有 CSS 模組 pattern)
- 所有 inline style → CSS class
- 僅處理 git-panel 目錄內檔案,不擴散到其他 style files

---

## 完成條件(DoD)

- ✅ BAT 啟動後,Git Graph panel 顯示真實 commits 的 SVG graph
- ✅ 10k commits 實際 repo 場景 60FPS 穩定(可用 BAT 本專案或 clone `vuejs/core` 測試)
- ✅ 100k commits 場景(若測試環境允許)不退化到 <30FPS
- ✅ Scroll 流暢無閃爍
- ✅ Workspace 切換後 graph 重載(新 repo 的 commits)
- ✅ 空 repo / 非 repo workspace 顯示合理提示(不 crash)
- ✅ `npm run build` 通過
- ✅ 無破壞既有功能(CT panel / BMad panel / Terminal 冒煙)

---

## 技術指引

### T0154 架構直接採納

T0154 實測證實的架構:
- **Virtualization**:自製 windowed(不引入 react-window 依賴),T0154 已實測 500k @ 60FPS
- **SVG 渲染**:每個 commit 用 `<circle>` + edges 用 `<path>`,見 T0154 `SvgCommitGraph.tsx`
- **MVP 規模目標**:500k commits(T0154 確認上限)

### IPC 分頁策略(順延 T0154 建議)

```ts
// 初始載入
const { commits } = await gitScaffold.listCommits(cwd, { limit: 10000, offset: 0 });

// Scroll 到底時載入下一頁(Tα3 後期再做,本工單可簡化為一次載入 10k)
```

### 禁止項

- ❌ 不要引入新依賴(sticking with simple-git + React)
- ❌ 不要實作 Tα3 的 lane assignment 演算法(Worker 只做簡化版)
- ❌ 不要處理使用者互動(點擊 commit / hover / 選中)— Tα5 / Tβ2 範圍
- ❌ 不要動舊 `GitPanel.tsx`(與 git-graph panel 並存)
- ❌ 不要動 `src/components/git-poc/benchmark/`(保留作對比)

---

## 預期 commits

- `feat(git-panel): add SVG commit graph with virtualization (T0156)`
- 可拆多 commits(遷移 / 整合 / CSS 各自獨立)

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 互動紀錄
無

### 實作摘要

**遷移檔案**(採**複製**而非搬移,遵守「不要動 benchmark/」禁止項,保留對比基準):
- `src/components/git-poc/benchmark/useVirtualizer.ts` → `src/components/git-panel/useVirtualizer.ts`(核心邏輯不變,型別 import 改為 `type RefObject` 顯式 import 與 React 18 相容)
- `src/components/git-poc/benchmark/SvgCommitGraph.tsx` → `src/components/git-panel/SvgCommitGraph.tsx`
  - 型別:`SynthCommit` → `GitScaffoldCommit`(from `../../lib/git-scaffold`)
  - 移除 benchmark 專用 prop(`branchColors`、ticket highlight)
  - 移除 `branchColumn` / `tickets` 依賴(簡化 layout 下用不到)
  - 所有固定樣式 → CSS class,僅保留必須 dynamic 值(height / offsetTop / width / svg height)為 inline

**新增檔案**:
- `src/components/git-panel/SvgCommitGraph.tsx`(遷移後的 graph component)
- `src/components/git-panel/useVirtualizer.ts`(遷移後的 virtualization hook)
- `src/components/git-panel/git-graph-panel.css`(panel + graph 所有 static class)

**修改檔案**:
- `src/components/git-panel/GitGraphPanel.tsx`:
  - placeholder 換成真實 graph
  - `useEffect` 依 `workspaceFolderPath` 載入 → `healthCheck` → 若是 repo 則 `listCommits({limit:10000, offset:0})`
  - `LoadState` discriminated union(idle / loading / ready / error)
  - Loading / error / not-a-repo / empty-repo 分支渲染
  - `ResizeObserver` 追蹤 body 高度提供給 `SvgCommitGraph`
  - Refresh 按鈕重新完整 load(不只 healthCheck)
  - 顯示 commit 總數於 header(locale-aware toLocaleString)
  - 全部 inline style 移除,改 `git-graph-panel.css` class
- `electron/git/git-ipc.ts`:`git-scaffold:listCommits` limit cap 從 2000 → 10000,以支援單次 10k 載入(附註釋說明 Tα3 後會改為真正分頁)
- `src/locales/{en,zh-TW,zh-CN}.json`:新增 `gitGraph.status.{loading,empty}` i18n key

**IPC 對接**:
- 策略:單次呼叫 `listCommits(cwd, { limit: 10000, offset: 0 })`(工單明示「本工單可簡化為一次載入 10k」)
- 分頁:未實作(Tα3 範圍)。當前若 repo 超過 10k commits,最舊部分不顯示;cap 提高可直接撈完整 10k
- 錯誤處理:`health.ok=false` / `listCommits.ok=false` → error state;`isRepo=false` → not-a-repo 提示;`commits.length === 0` → empty-repo 提示
- Workspace 切換:`useEffect([load])` 偵測 `workspaceFolderPath` 變動自動重載

**簡化 layout 實作**:
- 所有 commits 擺 column 0 單 lane(所有 `cx = laneCx`)
- Parent edge:每個 parent hash 用 `hashToIndex` Map O(1) 查對應 row 位置,直線從 child 連到 parent(`M cx cY L cx pY`,單純 vertical line)
- 若 parent 在可見範圍之外或距離超過 `MAX_EDGE_ROWS (40)` 則不畫(避免 very-long edges)
- 多 parent(merge commit)畫多條重疊的垂直線(視覺上一條)—— 單 lane 下不做 lane shift,Tα3 會改真正的 branch layout 演算法

### 驗證結果

- [x] `npx vite build` 通過(9.46s,51 modules transformed,無錯誤)
- [x] `npx tsc --noEmit` 本工單新增/修改範圍 0 錯誤(git-panel/*、git-ipc.ts、git-scaffold)— 既有錯誤屬其他模組與本工單無關
- [x] 代碼邏輯靜態驗證:workspace 切換經 `useEffect([load])` 自動觸發;空 repo / 非 repo 分支皆有明確提示(見 `GitGraphBody`);既有 `GitPanel` / `ControlTower` / `ClaudeAgent` 等皆未修改
- [ ] BAT 本專案實際 runtime 60FPS 驗證 — 需啟動 electron(本 sub-session 未執行),但架構繼承 T0154 實測已驗證 500k @ 60FPS 的同一實作,10k commits 規模應輕鬆達成
- [ ] 中型 repo(如 vuejs/core)實測 — 同上,留予塔台/使用者驗收
- [ ] Workspace 切換重載 — 靜態邏輯通過,runtime 驗收同上
- [ ] 空 repo / 非 repo 提示合理 — 靜態邏輯通過(i18n key 已定義),runtime 驗收同上

### 遭遇問題

1. **IPC limit cap 衝突**:原 `listCommits` 的 limit cap 為 2000,但工單指定初始載入 10000。選項:(A) 提高 cap、(B) Worker 多次呼叫分頁累積。選 A(改 10000)以符合工單「一次載入 10k」的簡化指示,且附註釋聲明 Tα3 將改真正分頁。**無需塔台介入**。

2. **T0152 / T0155 stale metadata**:發現 working tree 還有兩張前次 session 的工單狀態/commit 回填變更未 commit(T0152 狀態改 DONE + commit hash 回填、T0155 commit hash 回填)。為保持 T0156 commit 乾淨,未一併 stage。**建議塔台執行 `*sync` 或另起 chore commit 補齊**。

3. **既有 tsc 錯誤**:專案現存多處 tsc 型別錯誤(App.tsx / ClaudeAgentPanel.tsx 等),非本工單引入,但使得 `npx tsc --noEmit` 無法在 CI 中作為 green gate。**非本工單範圍,僅記錄**。

### Phase 3 下一張建議
- [x] 可直接派 Tα3(branch layout 演算法 + web worker)— 本工單的簡化單 lane 已足以 UAT,Tα3 換成真正的 lane assignment(git-graph-drawer 類演算法)即可升級視覺品質
- [ ] 需先調整 Tα3 範圍(說明):若 Tα3 要併入「分頁載入」機制,可順帶把 IPC cap 從 10000 回調到 2000 + 真正的 offset 分頁;若 Tα3 僅做 layout 演算法,保留現 10000 cap 即可
- [x] 其他發現:
  - 舊 `src/components/GitPanel.tsx` 與新 `git-panel/GitGraphPanel.tsx` 目前並存(工單禁止動舊 panel)。T0155 遭遇問題已提,Tα5 前仍懸而未決
  - `ResizeObserver` 處理 docking 切換可能需要額外測試(panel 隱藏/顯示時 `clientHeight` 變為 0 → virtualization `visibleCount` 為 0 → 無 row 渲染,重顯時應自動復原,但建議 UAT 時確認)

### Commit(s)
- `b313494` — feat(git-panel): add SVG commit graph with virtualization (T0156)

### 回報時間
2026-04-17 23:51 (UTC+8)
